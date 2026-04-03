import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { normalizeUrl } from '../../utils/url.js';
import { fetchWithRetry } from '../../utils/http.js';
import { parseHtml, extractLinks } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import { detectPageLanguage, getMultilingualKeywords } from '../../utils/i18n-probes.js';
import * as cheerio from 'cheerio';

const PRESS_LINK_KEYWORDS_BASE = [
  'press', 'newsroom', 'media', 'news', 'press releases',
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProbeResult {
  path: string;
  found: boolean;
  html?: string;
  status?: number;
  /** Full URL when sourced from sitemapPages (avoids baseUrl + path double-prefix). */
  fullUrl?: string;
}

/**
 * Parse a date string found in HTML and return the Date object, or null.
 */
function parseDateFromText(text: string): Date | null {
  // Match common date patterns: "January 15, 2024", "2024-01-15", "01/15/2024", "Jan 15, 2024"
  const patterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const date = new Date(match[0]);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return null;
}

/**
 * Find the most recent date-like text in press release content.
 */
function findMostRecentDate($: CheerioAPI): Date | null {
  let mostRecent: Date | null = null;

  // Look for dates in common press release containers
  const selectors = [
    'article time[datetime]',
    'time[datetime]',
    '.press-release date',
    '.date',
    '.published-date',
    '.post-date',
    'article .meta',
    '.news-date',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const elem = $(el);
      const datetime = elem.attr('datetime');
      const text = datetime ?? elem.text().trim();
      const date = parseDateFromText(text);
      if (date && (!mostRecent || date > mostRecent)) {
        mostRecent = date;
      }
    });
  }

  // Fallback: scan visible text for date patterns
  if (!mostRecent) {
    const bodyText = $('body').text();
    const dateRegex = /(?:\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})|(?:\d{4}-\d{2}-\d{2})/gi;
    const matches = bodyText.match(dateRegex);
    if (matches) {
      for (const match of matches) {
        const date = parseDateFromText(match);
        if (date && (!mostRecent || date > mostRecent)) {
          mostRecent = date;
        }
      }
    }
  }

  return mostRecent;
}

/**
 * Detect whether an RSS feed link is present in HTML.
 */
function detectRssFeed($: CheerioAPI): string | null {
  // Check <link> tags for RSS/Atom autodiscovery
  const rssLink = $('link[type="application/rss+xml"]').attr('href')
    ?? $('link[type="application/atom+xml"]').attr('href');
  if (rssLink) return rssLink;

  // Check for common RSS link patterns in anchors
  let rssFeedUrl: string | null = null;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/\/(rss|feed|atom)\b/i.test(href) || href.endsWith('.rss') || href.endsWith('.xml')) {
      rssFeedUrl = href;
      return false; // break
    }
  });

  return rssFeedUrl;
}

/**
 * Detect media contact information (email, phone, media kit link).
 */
function detectMediaContact($: CheerioAPI): {
  email: string | null;
  phone: string | null;
  mediaKitUrl: string | null;
} {
  const result = { email: null as string | null, phone: null as string | null, mediaKitUrl: null as string | null };
  const bodyText = $('body').text();
  const bodyHtml = $('body').html() ?? '';

  // Look for press/media email addresses
  const emailRegex = /(?:press|media|pr|communications|comms)@[\w.-]+\.\w{2,}/gi;
  const emailMatch = bodyText.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  // Fallback: look for mailto links in the page
  if (!result.email) {
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const addr = (href.replace('mailto:', '').split('?')[0] ?? '').toLowerCase();
      if (/press|media|pr|comms|communications/.test(addr)) {
        result.email = addr;
        return false;
      }
    });
  }

  // Look for phone numbers near "press" or "media contact" context
  // Extract a ~500 char window around "media contact", "press contact", etc.
  const contactContext = bodyText.match(/(?:media|press|pr|communications)\s*(?:contact|inquir|office|department)[^]*?(?=\n\n|\r\n\r\n|$)/i);
  if (contactContext) {
    const contextWindow = contactContext[0].slice(0, 500);
    const phoneRegex = /(?:\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatch = contextWindow.match(phoneRegex);
    if (phoneMatch) {
      const digits = phoneMatch[0].replace(/\D/g, '');
      // Validate: 10-11 digits (US/intl format)
      if (digits.length >= 10 && digits.length <= 11) {
        result.phone = phoneMatch[0];
      }
    }
  }

  // Look for media kit link
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().toLowerCase();
    if (/media[-\s]?kit/i.test(href) || /media[-\s]?kit/i.test(text)) {
      result.mediaKitUrl = href;
      return false;
    }
  });

  return result;
}

/**
 * Detect "As seen in" or media mention logos.
 */
function detectMediaLogos($: CheerioAPI): boolean {
  const bodyText = $('body').text().toLowerCase();
  const bodyHtml = ($('body').html() ?? '').toLowerCase();

  // Check for common "as seen in" or "featured in" patterns
  const patterns = [
    'as seen in',
    'as featured in',
    'featured in',
    'in the press',
    'in the news',
    'media coverage',
    'press coverage',
    'mentioned in',
    'as seen on',
  ];

  for (const pattern of patterns) {
    if (bodyText.includes(pattern)) {
      return true;
    }
  }

  // Check for image alt text referencing media outlets
  let logoFound = false;
  $('img[alt]').each((_, el) => {
    const alt = ($(el).attr('alt') ?? '').toLowerCase();
    const mediaOutlets = ['forbes', 'techcrunch', 'nytimes', 'wsj', 'bloomberg', 'cnbc', 'reuters', 'bbc', 'wired', 'inc.com', 'fast company', 'entrepreneur', 'venturebeat', 'the verge'];
    for (const outlet of mediaOutlets) {
      if (alt.includes(outlet)) {
        logoFound = true;
        return false; // break inner
      }
    }
    if (logoFound) return false; // break outer
  });

  return logoFound;
}

/**
 * Detect press wire service usage (PRNewswire, BusinessWire, etc.)
 */
const WIRE_SERVICES = [
  { id: 'prnewswire', pattern: /prnewswire\.com/i, name: 'PR Newswire' },
  { id: 'businesswire', pattern: /businesswire\.com/i, name: 'Business Wire' },
  { id: 'globenewswire', pattern: /globenewswire\.com/i, name: 'GlobeNewsWire' },
  { id: 'cision', pattern: /cision\.com/i, name: 'Cision' },
  { id: 'accesswire', pattern: /accesswire\.com/i, name: 'Accesswire' },
  { id: 'prweb', pattern: /prweb\.com/i, name: 'PRWeb' },
];

function detectWireServices($: CheerioAPI): string[] {
  const found = new Set<string>();
  const html = ($('body').html() ?? '').toLowerCase();
  for (const ws of WIRE_SERVICES) {
    if (ws.pattern.test(html)) found.add(ws.name);
  }
  return [...found];
}

/**
 * Count press articles/entries on the page by looking for common article containers.
 */
function countPressArticles($: CheerioAPI): number {
  const selectors = [
    'article', '.press-release', '.news-item', '.post', '.blog-post',
    '.news-entry', '.article-card', '.press-item', '.entry',
    '[class*="press"] li', '[class*="news"] li',
    // Broader patterns for custom CMS markup
    '[class*="release"]', '[class*="article"]',
    '[class*="newsroom"] li', '[class*="media"] li',
    '.listing-item', '.content-item',
    // CMS-specific card patterns (Q4 Web Systems, custom enterprise CMS)
    '[class*="mm-card__content"]', '[class*="mm-card__title"]',
    '[class*="press-card"]', '[class*="news-card"]',
  ];
  let maxCount = 0;
  for (const sel of selectors) {
    const count = $(sel).length;
    if (count > maxCount) maxCount = count;
  }

  // Fallback: count elements that have both a date-like <time> tag and a heading
  // inside them — these are almost certainly article/press items
  if (maxCount === 0) {
    const timeElements = $('time').length;
    if (timeElements > 0) {
      maxCount = timeElements;
    }
  }

  // Final fallback: count distinct date strings in the body text as a proxy
  if (maxCount === 0) {
    const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi;
    const bodyText = $('body').text();
    const dateMatches = bodyText.match(datePattern);
    if (dateMatches) {
      // Deduplicate — same date appearing in headline + body shouldn't double-count
      const uniqueDates = new Set(dateMatches.map(d => d.toLowerCase()));
      maxCount = uniqueDates.size;
    }
  }

  return maxCount;
}

/**
 * Detect NewsArticle / BlogPosting structured data on press pages.
 */
function detectPressSchema($: CheerioAPI): string[] {
  const types: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() ?? '';
    try {
      const data = JSON.parse(text);
      const checkType = (obj: Record<string, unknown>) => {
        const t = obj['@type'];
        if (typeof t === 'string' && /article|blogposting|newsarticle|pressrelease/i.test(t)) {
          types.push(t);
        }
      };
      if (Array.isArray(data)) data.forEach((d: Record<string, unknown>) => checkType(d));
      else if (data && typeof data === 'object') {
        checkType(data as Record<string, unknown>);
        if (Array.isArray((data as Record<string, unknown>)['@graph'])) {
          ((data as Record<string, unknown>)['@graph'] as Record<string, unknown>[]).forEach(checkType);
        }
      }
    } catch { /* skip */ }
  });
  return types;
}

/**
 * Find all unique dates on a press page to compute frequency.
 */
function findAllDates($: CheerioAPI): Date[] {
  const dates: Date[] = [];
  const bodyText = $('body').text();
  const dateRegex = /(?:\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})|(?:\d{4}-\d{2}-\d{2})/gi;
  const matches = bodyText.match(dateRegex);
  if (matches) {
    for (const m of matches) {
      const d = parseDateFromText(m);
      if (d && d.getTime() > 0 && d.getTime() < Date.now()) dates.push(d);
    }
  }
  // Also check time[datetime] elements
  $('time[datetime]').each((_, el) => {
    const d = parseDateFromText($(el).attr('datetime') ?? '');
    if (d && d.getTime() > 0 && d.getTime() < Date.now()) dates.push(d);
  });
  // Dedupe by date string
  const seen = new Set<string>();
  return dates.filter(d => {
    const key = d.toISOString().slice(0, 10);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.getTime() - a.getTime());
}

/**
 * Check the main page HTML for nav/footer links to press-related pages.
 * Uses multilingual keywords based on the page's detected language.
 */
function findPressLinksInMainPage($: CheerioAPI, lang: string, rawHtml?: string): string[] {
  const pressLinks: string[] = [];
  const keywords = getMultilingualKeywords(PRESS_LINK_KEYWORDS_BASE, lang, 'press');

  // Build word-boundary regexes for each keyword to avoid false positives
  // (e.g. "press" matching "WordPress" or "Pressure")
  const keywordRegexes = keywords.map(kw => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
  // Also build path-segment regexes: keyword must be a full path segment
  const pathRegexes = keywords.map(kw => new RegExp(`/${kw.replace(/\s+/g, '-').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|$|\\?)`, 'i'));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().toLowerCase();

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i]!;
      if (text === kw || keywordRegexes[i]!.test(text) || pathRegexes[i]!.test(href)) {
        pressLinks.push(href);
        break;
      }
    }
  });

  // Fallback: scan raw HTML for URLs inside JS strings that Cheerio can't parse
  // (e.g. footer links injected via innerHTML from a script-defined data structure)
  // Use path-segment matching: keyword must be a full path segment (e.g. /press/ not /pressure/)
  if (rawHtml) {
    const urlMatches = rawHtml.matchAll(/https?:\/\/[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}[^\s"'`\\<)]*\/(?:newsroom|press|prensa|noticias|sala-de-prensa)(?:\/|$)[^\s"'`\\<)]*/gi);
    for (const match of urlMatches) {
      pressLinks.push(match[0]);
    }
    // Also match URLs where the keyword is in the subdomain/path before the rest
    const urlMatches2 = rawHtml.matchAll(/https?:\/\/(?:newsroom|press|prensa|noticias)[.\-][a-zA-Z0-9._-]+\.[a-zA-Z]{2,}[^\s"'`\\<)]*/gi);
    for (const match of urlMatches2) {
      pressLinks.push(match[0]);
    }
  }

  return [...new Set(pressLinks)];
}

// ─── Module execute function ────────────────────────────────────────────────

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = normalizeUrl(ctx.url);

  // Detect page language for multilingual probe expansion
  const lang = ctx.html ? detectPageLanguage(ctx.html) : 'en';
  data.detected_language = lang;

  // 1. Check the main page for press-related links + RSS + media logos
  let mainPagePressLinks: string[] = [];
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPagePressLinks = findPressLinksInMainPage($main, lang, ctx.html);

    // Check RSS feed in main page
    const mainRss = detectRssFeed($main);
    if (mainRss) {
      data.rss_feed_main_page = mainRss;
    }

    // Check for media logos on main page
    if (detectMediaLogos($main)) {
      data.media_logos_main_page = true;
    }
  }

  // 2. Use pre-rendered sitemap pages from runner, then validate content
  const PRESS_TITLE_KEYWORDS = /\b(?:press|news|newsroom|media|announcement|release|prensa|noticias|presse|nachrichten|actualite|imprensa)\b/i;

  function validatePressPage(page: ProbeResult): boolean {
    if (!page.html) return true; // no HTML = can't validate, allow
    const $p = parseHtml(page.html);
    const pageTitle = $p('title').first().text().toLowerCase();
    const h1Text = $p('h1').first().text().toLowerCase();
    return PRESS_TITLE_KEYWORDS.test(`${pageTitle} ${h1Text}`);
  }

  let foundPages: ProbeResult[] = [];

  // Try sitemap pages first
  for (const page of ctx.sitemapPages?.press ?? []) {
    const result: ProbeResult = { path: page.path, found: true, html: page.html, status: 200, fullUrl: page.url };
    if (validatePressPage(result)) {
      foundPages.push(result);
    }
  }

  // Fallback: if no valid press pages from sitemap, probe common paths
  if (foundPages.length === 0) {
    const PRESS_PROBE_PATHS = [
      '/press/', '/press-release/', '/press-releases/',
      '/media/', '/newsroom/', '/news-room/', '/news/',
      '/about/press/', '/about/media/', '/about/newsroom/', '/about/news/',
    ];
    const probeResults = await Promise.allSettled(
      PRESS_PROBE_PATHS.map(async (path) => {
        try {
          const url = `${baseUrl}${path}`;
          const res = await fetchWithRetry(url, { timeout: 10_000, retries: 0 });
          if (res.ok && res.body.length > 500 && !res.body.trimStart().startsWith('{')) {
            return { path, found: true, html: res.body, status: 200 } as ProbeResult;
          }
        } catch { /* not found */ }
        return null;
      }),
    );
    for (const r of probeResults) {
      if (r.status === 'fulfilled' && r.value && validatePressPage(r.value)) {
        foundPages.push(r.value);
      }
    }
  }

  data.found_pages = foundPages.map((p) => p.path);

  // 3. Analyze found pages
  let bestPressPage: ProbeResult | null = null;
  let mostRecentDate: Date | null = null;
  let mediaContact = { email: null as string | null, phone: null as string | null, mediaKitUrl: null as string | null };
  let rssFound: string | null = null;
  let mediaLogosFound = data.media_logos_main_page === true;
  let totalArticleCount = 0;
  const wireServices = new Set<string>();
  const pressSchemaTypes: string[] = [];
  let allDates: Date[] = [];

  for (const page of foundPages) {
    if (!page.html) continue;

    const $ = parseHtml(page.html);

    // Use the first found page as the "best" press page
    if (!bestPressPage) {
      bestPressPage = page;
    }

    // Find the most recent press release date
    const pageDate = findMostRecentDate($);
    if (pageDate && (!mostRecentDate || pageDate > mostRecentDate)) {
      mostRecentDate = pageDate;
    }

    // Collect all dates for frequency analysis
    const pageDates = findAllDates($);
    allDates = allDates.concat(pageDates);

    // Count press articles
    totalArticleCount += countPressArticles($);

    // Detect wire services
    for (const ws of detectWireServices($)) wireServices.add(ws);

    // Detect press-related structured data
    pressSchemaTypes.push(...detectPressSchema($));

    // Detect media contact info
    const contact = detectMediaContact($);
    if (contact.email && !mediaContact.email) mediaContact.email = contact.email;
    if (contact.phone && !mediaContact.phone) mediaContact.phone = contact.phone;
    if (contact.mediaKitUrl && !mediaContact.mediaKitUrl) mediaContact.mediaKitUrl = contact.mediaKitUrl;

    // Detect RSS feed
    if (!rssFound) {
      rssFound = detectRssFeed($);
    }

    // Detect media logos
    if (!mediaLogosFound) {
      mediaLogosFound = detectMediaLogos($);
    }
  }

  // Also use RSS from main page if not found in press pages
  if (!rssFound && data.rss_feed_main_page) {
    rssFound = data.rss_feed_main_page as string;
  }

  // Dedupe dates
  const datesSeen = new Set<string>();
  allDates = allDates.filter(d => {
    const key = d.toISOString().slice(0, 10);
    if (datesSeen.has(key)) return false;
    datesSeen.add(key);
    return true;
  }).sort((a, b) => b.getTime() - a.getTime());

  // Store data
  // Use fullUrl from sitemapPages when available (avoids baseUrl + path double-prefix)
  // Fall back to baseUrl + path for HTTP-probed pages, or https:// for external subdomains
  const pressPageUrl = bestPressPage
    ? bestPressPage.fullUrl
      ?? ((bestPressPage.path.includes('.') && !bestPressPage.path.startsWith('/'))
        ? `https://${bestPressPage.path}`
        : `${baseUrl}${bestPressPage.path}`)
    : null;
  data.press_page_url = pressPageUrl;
  data.press_page_type = bestPressPage?.path.replace('/', '') ?? null;
  data.press_contact_email = mediaContact.email;
  data.press_contact_phone = mediaContact.phone;
  data.media_kit_url = mediaContact.mediaKitUrl;
  data.rss_feed = rssFound;
  data.media_logos = mediaLogosFound;
  data.most_recent_date = mostRecentDate?.toISOString() ?? null;
  data.oldest_date = allDates.length > 0 ? allDates[allDates.length - 1]!.toISOString().slice(0, 10) : null;
  data.date_count = allDates.length;
  data.article_count = totalArticleCount;
  data.wire_services = [...wireServices];
  data.press_schema_types = pressSchemaTypes;
  data.main_page_press_links = mainPagePressLinks;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (bestPressPage) {
    signals.push(
      createSignal({
        type: 'press_page',
        name: 'Press/Newsroom Page',
        confidence: 0.95,
        evidence: `Press page found at ${pressPageUrl}`,
        category: 'seo_content',
      }),
    );
  }

  if (mediaContact.mediaKitUrl) {
    signals.push(
      createSignal({
        type: 'media_kit',
        name: 'Media Kit',
        confidence: 0.9,
        evidence: `Media kit linked at ${mediaContact.mediaKitUrl}`,
        category: 'seo_content',
      }),
    );
  }

  if (mediaContact.email) {
    signals.push(
      createSignal({
        type: 'press_contact',
        name: 'Press Contact',
        confidence: 0.9,
        evidence: `Press email: ${mediaContact.email}`,
        category: 'seo_content',
      }),
    );
  }

  if (rssFound) {
    signals.push(
      createSignal({
        type: 'rss_feed',
        name: 'RSS Feed',
        confidence: 0.9,
        evidence: `RSS feed discovered: ${rssFound}`,
        category: 'seo_content',
      }),
    );
  }

  if (mediaLogosFound) {
    signals.push(
      createSignal({
        type: 'media_logos',
        name: 'Media Mention Logos',
        confidence: 0.7,
        evidence: 'Media mention / "As seen in" logos detected',
        category: 'seo_content',
      }),
    );
  }

  if (wireServices.size > 0) {
    signals.push(
      createSignal({
        type: 'wire_service',
        name: 'PR Wire Services',
        confidence: 0.85,
        evidence: `Wire services detected: ${[...wireServices].join(', ')}`,
        category: 'brand_presence',
      }),
    );
  }

  if (pressSchemaTypes.length > 0) {
    signals.push(
      createSignal({
        type: 'press_schema',
        name: 'Press Structured Data',
        confidence: 0.9,
        evidence: `Press-related schema types: ${pressSchemaTypes.join(', ')}`,
        category: 'seo_content',
      }),
    );
  }

  // ─── Build checkpoints ──────────────────────────────────────────────────

  // CP1: Press/newsroom page (weight 5/10 = 0.5)
  if (bestPressPage && mostRecentDate) {
    const monthsAgo = (Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo <= 6) {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-page',
          name: 'Press/newsroom page',
          weight: 0.5,
          health: 'excellent',
          evidence: `Dedicated press page with recent releases (last: ${mostRecentDate.toISOString().slice(0, 10)})`,
        }),
      );
    } else if (monthsAgo <= 12) {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-page',
          name: 'Press/newsroom page',
          weight: 0.5,
          health: 'warning',
          evidence: `Press page found but content is outdated (last: ${mostRecentDate.toISOString().slice(0, 10)})`,
          recommendation: 'Publish fresh press releases or news updates at least quarterly',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-page',
          name: 'Press/newsroom page',
          weight: 0.5,
          health: 'warning',
          evidence: `Press page found but content is stale (>1yr, last: ${mostRecentDate.toISOString().slice(0, 10)})`,
          recommendation: 'Update press page with current releases or archive outdated content',
        }),
      );
    }
  } else if (bestPressPage) {
    checkpoints.push(
      createCheckpoint({
        id: 'm16-press-page',
        name: 'Press/newsroom page',
        weight: 0.5,
        health: 'good',
        evidence: `Press page found at ${pressPageUrl}`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm16-press-page',
        'Press/newsroom page',
        'No dedicated press or newsroom page found',
      ),
    );
  }

  // CP2: Media contact (weight 4/10 = 0.4)
  if (mediaContact.email && mediaContact.phone && mediaContact.mediaKitUrl) {
    checkpoints.push(
      createCheckpoint({
        id: 'm16-media-contact',
        name: 'Media contact',
        weight: 0.4,
        health: 'excellent',
        evidence: `Press email (${mediaContact.email}), phone, and media kit all available`,
      }),
    );
  } else if (mediaContact.email) {
    checkpoints.push(
      createCheckpoint({
        id: 'm16-media-contact',
        name: 'Media contact',
        weight: 0.4,
        health: 'good',
        evidence: `Press email available: ${mediaContact.email}`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm16-media-contact',
        'Media contact',
        'No dedicated press contact information found',
      ),
    );
  }

  // CP3: RSS feed (weight 3/10 = 0.3)
  if (rssFound) {
    checkpoints.push(
      createCheckpoint({
        id: 'm16-rss-feed',
        name: 'RSS feed',
        weight: 0.3,
        health: 'good',
        evidence: `RSS feed auto-discovered: ${rssFound}`,
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm16-rss-feed',
        'RSS feed',
        'No RSS feed detected for press content',
      ),
    );
  }

  // CP4: "As seen in" logos (weight 3/10 = 0.3)
  if (mediaLogosFound) {
    checkpoints.push(
      createCheckpoint({
        id: 'm16-media-logos',
        name: '"As seen in" logos',
        weight: 0.3,
        health: 'excellent',
        evidence: 'Media mention logos or "As seen in" section detected',
      }),
    );
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm16-media-logos',
        '"As seen in" logos',
        'No media mention logos detected',
      ),
    );
  }

  // CP5: Press release recency (weight 4/10 = 0.4)
  if (mostRecentDate) {
    const monthsAgo = (Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    const dateStr = mostRecentDate.toISOString().slice(0, 10);

    if (monthsAgo <= 3) {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-recency',
          name: 'Press release recency',
          weight: 0.4,
          health: 'excellent',
          evidence: `Most recent press content within 3 months (${dateStr})`,
        }),
      );
    } else if (monthsAgo <= 6) {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-recency',
          name: 'Press release recency',
          weight: 0.4,
          health: 'good',
          evidence: `Most recent press content within 6 months (${dateStr})`,
        }),
      );
    } else if (monthsAgo <= 12) {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-recency',
          name: 'Press release recency',
          weight: 0.4,
          health: 'warning',
          evidence: `Most recent press content within 1 year (${dateStr})`,
          recommendation: 'Consider publishing press releases more frequently',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm16-press-recency',
          name: 'Press release recency',
          weight: 0.4,
          health: 'critical',
          evidence: `Press content is over 1 year old (${dateStr})`,
          recommendation: 'Update press page with current news and releases',
        }),
      );
    }
  } else {
    checkpoints.push(
      infoCheckpoint(
        'm16-press-recency',
        'Press release recency',
        'No dateable press content found',
      ),
    );
  }

  return {
    moduleId: 'M16' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null, // calculated by runner from checkpoints
    checkpoints,
    duration: 0, // set by runner
  };
};

// ─── Register ───────────────────────────────────────────────────────────────
export { execute };
registerModuleExecutor('M16' as ModuleId, execute);
