import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext, ModuleExecuteFn } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fetchWithRetry } from '../../utils/http.js';
import { normalizeUrl } from '../../utils/url.js';
import { parseHtml, extractLinks } from '../../utils/html.js';
import type { CheerioAPI } from '../../utils/html.js';
import * as cheerio from 'cheerio';

// ─── Probe paths ────────────────────────────────────────────────────────────
const PRESS_PATHS = ['/press', '/newsroom', '/media', '/news', '/press-releases', '/media-kit'];

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ProbeResult {
  path: string;
  found: boolean;
  html?: string;
  status?: number;
}

async function probePath(
  baseUrl: string,
  path: string,
): Promise<ProbeResult> {
  try {
    const result = await fetchWithRetry(`${baseUrl}${path}`, {
      timeout: 8000,
      retries: 1,
    });
    if (result.ok) {
      return { path, found: true, html: result.body, status: result.status };
    }
    return { path, found: false, status: result.status };
  } catch {
    return { path, found: false };
  }
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

  // Look for phone numbers near "press" or "media" context
  const phoneRegex = /(?:\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phoneMatches = bodyText.match(phoneRegex);
  if (phoneMatches && /press|media|pr\b|communications/i.test(bodyText)) {
    result.phone = phoneMatches[0];
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
 * Check the main page HTML for nav/footer links to press-related pages.
 */
function findPressLinksInMainPage($: CheerioAPI): string[] {
  const pressLinks: string[] = [];
  const keywords = ['press', 'newsroom', 'media', 'news', 'press releases'];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim().toLowerCase();

    for (const keyword of keywords) {
      if (text === keyword || href.toLowerCase().includes(`/${keyword.replace(/\s+/g, '-')}`)) {
        pressLinks.push(href);
        break;
      }
    }
  });

  return [...new Set(pressLinks)];
}

// ─── Module execute function ────────────────────────────────────────────────

const execute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const baseUrl = normalizeUrl(ctx.url);

  // 1. Check the main page for press-related links
  let mainPagePressLinks: string[] = [];
  if (ctx.html) {
    const $main = parseHtml(ctx.html);
    mainPagePressLinks = findPressLinksInMainPage($main);

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

  // 2. Probe known press/media paths
  const probeResults = await Promise.allSettled(
    PRESS_PATHS.map((path) => probePath(baseUrl, path)),
  );

  const foundPages: ProbeResult[] = [];
  for (const result of probeResults) {
    if (result.status === 'fulfilled' && result.value.found) {
      foundPages.push(result.value);
    }
  }

  data.probed_paths = PRESS_PATHS;
  data.found_pages = foundPages.map((p) => p.path);

  // 3. Analyze found pages
  let bestPressPage: ProbeResult | null = null;
  let mostRecentDate: Date | null = null;
  let mediaContact = { email: null as string | null, phone: null as string | null, mediaKitUrl: null as string | null };
  let rssFound: string | null = null;
  let mediaLogosFound = data.media_logos_main_page === true;

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

  // Store data
  data.press_page_url = bestPressPage ? `${baseUrl}${bestPressPage.path}` : null;
  data.press_contact_email = mediaContact.email;
  data.press_contact_phone = mediaContact.phone;
  data.media_kit_url = mediaContact.mediaKitUrl;
  data.rss_feed = rssFound;
  data.media_logos = mediaLogosFound;
  data.most_recent_date = mostRecentDate?.toISOString() ?? null;
  data.main_page_press_links = mainPagePressLinks;

  // ─── Build signals ──────────────────────────────────────────────────────

  if (bestPressPage) {
    signals.push(
      createSignal({
        type: 'press_page',
        name: 'Press/Newsroom Page',
        confidence: 0.95,
        evidence: `Press page found at ${baseUrl}${bestPressPage.path}`,
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
        evidence: `Press page found at ${bestPressPage.path}`,
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
registerModuleExecutor('M16' as ModuleId, execute);
