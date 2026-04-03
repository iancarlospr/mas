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
 * Fetch and parse an RSS/Atom feed to count items and extract dates.
 * Returns null if the feed cannot be fetched or parsed.
 */
async function fetchRssFeedData(
  feedUrl: string,
  baseUrl: string,
): Promise<{ itemCount: number; totalFeedItems: number; dates: Date[] } | null> {
  try {
    // Resolve relative URLs — use origin (not baseUrl) to avoid doubling locale prefixes
    const origin = new URL(baseUrl).origin;
    const fullUrl = feedUrl.startsWith('http') ? feedUrl : `${origin}${feedUrl.startsWith('/') ? '' : '/'}${feedUrl}`;
    const result = await fetchWithRetry(fullUrl, { timeout: 10_000, retries: 1 });
    if (!result.ok || !result.body) return null;

    // Parse as XML using cheerio (handles both RSS and Atom)
    const $ = cheerio.load(result.body, { xml: true });

    // RSS 2.0: <item>, Atom: <entry>
    const allItems = $('item').toArray().concat($('entry').toArray());
    if (allItems.length === 0) return null;

    // Filter to press/newsroom items only — exclude blog posts, case studies,
    // product pages. RSS feeds often contain ALL site content, not just press.
    const PRESS_URL_KEYWORDS = /\b(?:news|newsroom|press|media|release|announcement)\b/i;
    const BLOG_URL_KEYWORDS = /(?:\/blog|\/insights?|\/case-stud|\/white-?paper|\/webinar|\/podcast|\/tutorial|\/guide|\/brochure|\/video|\/infographic|\/ebook)/i;

    let pressCount = 0;
    let totalCount = allItems.length;
    const dates: Date[] = [];

    for (const item of allItems) {
      const $item = $(item);
      // Check item URL (link, xml:base, guid) for press vs blog content
      const itemUrl = $item.attr('xml:base') ?? $item.find('link').text() ?? $item.find('guid').text() ?? '';

      const isPress = PRESS_URL_KEYWORDS.test(itemUrl);
      const isBlog = BLOG_URL_KEYWORDS.test(itemUrl);

      // Count as press if: explicitly press-related, OR not identifiable as blog
      // (for feeds that are purely press, URLs may not contain press keywords)
      if (isPress || (!isBlog && !itemUrl.includes('/blog'))) {
        pressCount++;
      }

      // Extract dates from all items (press recency benefits from full date range)
      const dateText = $item.find('pubDate').text()
        || $item.find('published').text()
        || $item.find('updated').text();
      if (dateText) {
        const d = new Date(dateText.trim());
        if (!isNaN(d.getTime())) dates.push(d);
      }
    }

    return {
      itemCount: pressCount > 0 ? pressCount : totalCount,
      totalFeedItems: totalCount,
      dates,
    };
  } catch {
    return null;
  }
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

  // Fallback: count <time> elements (more reliable than date string matching)
  if (maxCount === 0) {
    const timeElements = $('time').length;
    if (timeElements > 0) {
      maxCount = timeElements;
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

  // Follow external newsroom subdomains (e.g., newsroom.ryder.com)
  // Many enterprises host press releases on a dedicated subdomain
  const domain = new URL(baseUrl).hostname.replace(/^www\./, '');
  let externalNewsroomUrl: string | null = null;
  const NEWSROOM_SUBDOMAIN_PATTERN = /^https?:\/\/(?:newsroom|press|news|media)\.[^/]+/i;
  for (const link of mainPagePressLinks) {
    if (typeof link === 'string' && NEWSROOM_SUBDOMAIN_PATTERN.test(link)) {
      const linkHost = new URL(link).hostname.replace(/^www\./, '');
      if (linkHost.endsWith(domain) && linkHost !== domain) {
        externalNewsroomUrl = link;
        break;
      }
    }
  }

  let externalArticleCount = 0;
  if (externalNewsroomUrl) {
    try {
      // Fetch the external newsroom page
      const extOrigin = new URL(externalNewsroomUrl).origin;
      const extResult = await fetchWithRetry(extOrigin, { timeout: 15_000, retries: 1 });
      if (extResult.ok && extResult.body.length > 500) {
        foundPages.push({
          path: '/',
          found: true,
          html: extResult.body,
          status: extResult.status,
          fullUrl: extOrigin,
        });

        // Detect Q4 Web Systems CMS — extract API key and query press release count
        // Q4 is used by hundreds of public companies for investor/newsroom sites
        const q4ApiKeyMatch = extResult.body.match(/Q4ApiKey\s*=\s*['"]([A-F0-9]{32})['"]/i);
        if (q4ApiKeyMatch) {
          try {
            const q4Key = q4ApiKeyMatch[1];
            const q4Url = `${extOrigin}/feed/PressRelease.svc/GetPressReleaseList?apiKey=${q4Key}&LanguageId=1&bodyType=0&pressReleaseDateFilter=3&categoryId=1cb807d2-208f-4bc3-9133-6a9ad45ac3b0&pageSize=1&pageNumber=0&tagList=&includeTags=true&year=-1&searchTerm=`;
            const q4Result = await fetchWithRetry(q4Url, { timeout: 10_000, retries: 0 });
            if (q4Result.ok) {
              const q4Data = JSON.parse(q4Result.body) as Record<string, unknown>;
              const items = q4Data['GetPressReleaseListResult'];
              if (Array.isArray(items)) {
                // pageSize=1 but we need total — request a large page to get full count
                const q4FullUrl = q4Url.replace('pageSize=1', 'pageSize=10000');
                const q4FullResult = await fetchWithRetry(q4FullUrl, { timeout: 15_000, retries: 0 });
                if (q4FullResult.ok) {
                  const fullData = JSON.parse(q4FullResult.body) as Record<string, unknown>;
                  const fullItems = fullData['GetPressReleaseListResult'];
                  if (Array.isArray(fullItems)) {
                    externalArticleCount = fullItems.length;
                  }
                }
              }
            }
          } catch { /* Q4 API query failed — fall through */ }
        }
      }
    } catch { /* external newsroom unreachable */ }
  }
  data.external_newsroom = externalNewsroomUrl;
  data.external_article_count = externalArticleCount > 0 ? externalArticleCount : null;

  data.found_pages = foundPages.map((p) => p.fullUrl ?? p.path);

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

  // Fetch RSS feed for recency detection only (NOT article counting).
  // RSS feeds are unreliable for counts — they mix content types (blogs,
  // case studies, brochures) and have arbitrary item limits. Article count
  // stays based on what's visible on the press page HTML.
  if (rssFound) {
    const rssFeed = await fetchRssFeedData(rssFound, baseUrl);
    if (rssFeed) {
      // Only use RSS dates to improve recency detection
      for (const d of rssFeed.dates) {
        allDates.push(d);
        if (!mostRecentDate || d > mostRecentDate) {
          mostRecentDate = d;
        }
      }
    }
  }

  // Pagination crawling: detect and follow paginated press pages
  // Handles both WordPress (/page/N/) and query-param (?pg=N, ?page=N, ?paged=N) styles
  if (bestPressPage?.html && externalArticleCount === 0) {
    const pressUrl = bestPressPage.fullUrl ?? `${baseUrl}${bestPressPage.path}`;

    // Detect pagination style from links in the press page HTML
    const wpPagination = bestPressPage.html.match(/\/page\/(\d+)/g);
    const qsPagination = bestPressPage.html.match(/[?&](?:pg|page|paged)=(\d+)/g);

    let maxPage = 0;
    let paginationStyle: 'path' | 'query' | null = null;
    let queryParam = 'pg';

    if (qsPagination) {
      // Query-param pagination (?pg=2, ?page=2, ?paged=2)
      const paramMatch = bestPressPage.html.match(/[?&](pg|page|paged)=(\d+)/);
      if (paramMatch) queryParam = paramMatch[1]!;
      maxPage = Math.max(...qsPagination.map(p => parseInt(p.replace(/.*=/, ''), 10)));
      paginationStyle = 'query';
    } else if (wpPagination) {
      // WordPress-style path pagination (/page/2/)
      maxPage = Math.max(...wpPagination.map(p => parseInt(p.replace(/\/page\//, ''), 10)));
      paginationStyle = 'path';
    }

    if (paginationStyle && maxPage >= 2) {
      const pressPath = new URL(pressUrl).pathname.replace(/\/$/, '');
      const pressOrigin = new URL(pressUrl).origin;

      // Count unique article links across all paginated pages.
      // Handles: /press-path/slug, /noticias/detalle?id=N, and "read more" links
      function extractArticleUrls(pageHtml: string): Set<string> {
        const urls = new Set<string>();
        let m: RegExpExecArray | null;

        // Pattern 1: slug-based articles under press path
        const slugPattern = new RegExp(
          `href="[^"]*${pressPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([a-z0-9][-a-z0-9]{7,})/?[^"]*"`, 'gi',
        );
        while ((m = slugPattern.exec(pageHtml)) !== null) urls.add(m[1]!);

        // Pattern 2: id-based article detail pages (?id=N)
        const idPattern = /href="[^"]*(?:detalle|detail|noticia|article)\?id=(\d+)[^"]*"/gi;
        while ((m = idPattern.exec(pageHtml)) !== null) urls.add(`id-${m[1]}`);

        // Pattern 3: "read more" / "leer más" links
        const readMorePattern = /href="([^"]+)"[^>]*>\s*(?:(?:LEER|Leer|leer)\s+(?:MÁS|más)|(?:READ|Read|read)\s+(?:MORE|more))/gi;
        while ((m = readMorePattern.exec(pageHtml)) !== null) {
          const href = m[1]!;
          // If the URL contains an id= param, normalize to id-N to dedup with pattern 2
          const idMatch = href.match(/[?&]id=(\d+)/);
          if (idMatch) {
            urls.add(`id-${idMatch[1]}`);
          } else {
            try {
              const u = href.startsWith('http') ? new URL(href) : new URL(href, pressOrigin);
              urls.add(u.pathname + u.search);
            } catch { urls.add(href); }
          }
        }
        return urls;
      }

      // Page 1
      let allArticles: Set<string>;
      try {
        allArticles = extractArticleUrls(bestPressPage.html);
      } catch {
        allArticles = new Set();
      }

      // Detect per-page param (e.g., per-page=3). HTML may encode & as &amp;
      const perPageMatch = bestPressPage.html.match(/(?:[?&]|&amp;)(per-page|per_page|pagesize)=(\d+)/i);
      const perPageParam = perPageMatch ? `&${perPageMatch[1]}=${perPageMatch[2]}` : '';

      // Crawl remaining pages — keep going until no new articles found
      // (maxPage from page 1 may only show the next page link, not all pages)
      for (let p = 2; p <= 50; p++) {
        try {
          // Construct pagination URL: preserve trailing slash if original had one, omit if not
          const cleanPressUrl = pressUrl.replace(/\/$/, '');
          const sep = pressUrl.endsWith('/') ? '/?' : '?';
          const pageUrl = paginationStyle === 'query'
            ? `${cleanPressUrl}${sep}${queryParam}=${p}${perPageParam}`
            : `${cleanPressUrl}/page/${p}/`;
          const pageResult = await fetchWithRetry(pageUrl, { timeout: 8_000, retries: 0 });
          if (!pageResult.ok || pageResult.body.length < 500) break;

          const prevSize = allArticles.size;
          for (const a of extractArticleUrls(pageResult.body)) allArticles.add(a);
          if (allArticles.size === prevSize) break;
        } catch {
          break;
        }
      }

      if (allArticles.size > 0) {
        totalArticleCount = allArticles.size;
      }
    }
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
  // Use external newsroom article count when available (most accurate)
  data.article_count = externalArticleCount > 0 ? externalArticleCount : totalArticleCount;
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
