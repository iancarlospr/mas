/**
 * Sitemap & robots.txt based path discovery.
 *
 * Instead of brute-forcing dozens of known paths, we read the site's own
 * robots.txt and sitemap.xml to discover real URLs matching keyword patterns
 * (e.g. "investor", "careers", "press"). This is both faster and more
 * accurate — the site literally tells us what pages exist.
 */
import pino from 'pino';
import { fetchWithRetry } from './http.js';

const logger = pino({ name: 'sitemap' });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SitemapDiscoveryResult {
  /** Paths found matching the keywords (relative to baseUrl, e.g. "/investors") */
  matchedPaths: string[];
  /** Disallow paths from robots.txt that matched keywords */
  robotsHints: string[];
  /** Whether we successfully fetched and parsed any sitemap */
  sitemapFound: boolean;
}

// ─── robots.txt parsing ──────────────────────────────────────────────────────

interface RobotsResult {
  sitemapUrls: string[];
  disallowPaths: string[];
}

function parseRobotsTxt(body: string): RobotsResult {
  const sitemapUrls: string[] = [];
  const disallowPaths: string[] = [];

  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    // Sitemap: directives (case-insensitive, can appear anywhere)
    const sitemapMatch = trimmed.match(/^Sitemap:\s*(.+)/i);
    if (sitemapMatch?.[1]) {
      sitemapUrls.push(sitemapMatch[1].trim());
    }
    // Disallow: paths reveal site structure
    const disallowMatch = trimmed.match(/^Disallow:\s*(\/.+)/i);
    if (disallowMatch?.[1]) {
      disallowPaths.push(disallowMatch[1].trim().replace(/\*.*$/, '').replace(/\$$/, ''));
    }
  }

  return { sitemapUrls: [...new Set(sitemapUrls)], disallowPaths: [...new Set(disallowPaths)] };
}

// ─── Sitemap XML parsing ─────────────────────────────────────────────────────

/** Extract <loc> URLs from XML sitemap (handles both regular sitemaps and sitemap indexes). */
function parseSitemapXml(xml: string): { urls: string[]; childSitemaps: string[] } {
  const urls: string[] = [];
  const childSitemaps: string[] = [];

  // Check if this is a sitemap index (contains <sitemapindex>)
  const isSitemapIndex = /<sitemapindex/i.test(xml);

  // Extract all <loc> values
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1]!.replace(/&amp;/g, '&').trim();
    if (isSitemapIndex) {
      childSitemaps.push(url);
    } else {
      urls.push(url);
    }
  }

  return { urls, childSitemaps };
}

// ─── Main discovery function ─────────────────────────────────────────────────

/**
 * Discover paths on a site that match keyword patterns, using robots.txt and
 * sitemap.xml as the primary discovery mechanism.
 *
 * @param baseUrl - The site's base URL (e.g. "https://www.ibm.com")
 * @param keywords - Keywords to search for in discovered URLs (e.g. ["investor", "ir", "shareholder"])
 * @param options - Configuration options
 * @returns Matching paths and metadata
 */
export async function discoverPathsFromSitemap(
  baseUrl: string,
  keywords: string[],
  options: {
    /** Maximum number of child sitemaps to fetch from a sitemap index. Default: 3 */
    maxChildSitemaps?: number;
    /** Maximum total URLs to process (prevents OOM on huge sitemaps). Default: 50000 */
    maxUrls?: number;
    /** Maximum matched paths to return. Default: 30 */
    maxMatchedPaths?: number;
    /** Timeout per fetch in ms. Default: 8000 */
    timeout?: number;
  } = {},
): Promise<SitemapDiscoveryResult> {
  const {
    maxChildSitemaps = 3,
    maxUrls = 50_000,
    timeout = 8000,
  } = options;

  const result: SitemapDiscoveryResult = {
    matchedPaths: [],
    robotsHints: [],
    sitemapFound: false,
  };

  const baseHost = new URL(baseUrl).hostname;
  // For short keywords (≤3 chars like "ir"), use word boundaries to avoid
  // substring false positives (e.g. "ir" matching "virginia", "ireviews")
  const keywordPatterns = keywords.map(kw =>
    kw.length <= 3 ? `\\b${kw}\\b` : kw
  );
  const keywordRegex = new RegExp(keywordPatterns.join('|'), 'i');

  // ── Step 1: Fetch robots.txt ─────────────────────────────────────────────
  let robotsData: RobotsResult = { sitemapUrls: [], disallowPaths: [] };
  try {
    const robotsResp = await fetchWithRetry(`${baseUrl}/robots.txt`, {
      timeout,
      retries: 1,
    });
    if (robotsResp.ok && robotsResp.body.length < 500_000) {
      robotsData = parseRobotsTxt(robotsResp.body);
    }
  } catch {
    // robots.txt unavailable — continue with default sitemap URL
  }

  // Extract keyword-matching paths from Disallow directives
  for (const path of robotsData.disallowPaths) {
    if (keywordRegex.test(path)) {
      // Clean up the path: remove trailing wildcards, keep base path
      const cleanPath = path.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
      result.robotsHints.push(cleanPath);
    }
  }

  // ── Step 2: Fetch sitemap(s) ─────────────────────────────────────────────
  // Start with sitemaps declared in robots.txt, fall back to standard location
  const sitemapUrls = robotsData.sitemapUrls.length > 0
    ? robotsData.sitemapUrls
    : [`${baseUrl}/sitemap.xml`];

  let allUrls: string[] = [];
  let childSitemapsToFetch: string[] = [];

  for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
    try {
      const resp = await fetchWithRetry(sitemapUrl, { timeout, retries: 1 });
      if (!resp.ok || !resp.body) continue;

      result.sitemapFound = true;
      const parsed = parseSitemapXml(resp.body);
      allUrls.push(...parsed.urls);
      childSitemapsToFetch.push(...parsed.childSitemaps);

      if (allUrls.length >= maxUrls) break;
    } catch {
      // Sitemap unavailable
    }
  }

  // If this was a sitemap index, fetch child sitemaps that are likely to
  // contain relevant URLs (prioritize those with matching keywords in the URL)
  if (childSitemapsToFetch.length > 0) {
    // Sort: keyword-matching sitemaps first, then first N
    const prioritized = [
      ...childSitemapsToFetch.filter(url => keywordRegex.test(url)),
      ...childSitemapsToFetch.filter(url => !keywordRegex.test(url)),
    ].slice(0, maxChildSitemaps);

    const childResults = await Promise.allSettled(
      prioritized.map(async (url) => {
        try {
          const resp = await fetchWithRetry(url, { timeout, retries: 1 });
          if (resp.ok && resp.body) {
            return parseSitemapXml(resp.body).urls;
          }
          return [];
        } catch {
          return [];
        }
      }),
    );

    for (const childResult of childResults) {
      if (childResult.status === 'fulfilled') {
        allUrls.push(...childResult.value);
        if (allUrls.length >= maxUrls) break;
      }
    }
  }

  // ── Step 3: Filter URLs matching keywords ────────────────────────────────
  const seenPaths = new Set<string>();

  for (const url of allUrls.slice(0, maxUrls)) {
    try {
      const parsed = new URL(url);
      // Only include same-host URLs (or known IR subdomains)
      const urlHost = parsed.hostname.replace(/^www\./, '');
      const base = baseHost.replace(/^www\./, '');
      if (!urlHost.endsWith(base)) continue;

      const fullPath = parsed.pathname + parsed.search;
      if (!keywordRegex.test(fullPath)) continue;

      // Skip overly specific URLs (articles, paginated, query-heavy)
      // We want directory-level pages like /investors, /careers, /newsroom
      // not /news/2024/01/some-article-headline or /news/very-long-slug-title
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length > 3) continue;
      // Skip article-like paths: if the last segment is very long, it's likely
      // an individual article, not a section landing page
      const lastSeg = segments[segments.length - 1] ?? '';
      if (segments.length >= 2 && lastSeg.length > 40) continue;

      // Deduplicate: normalize path
      const normalized = parsed.pathname.replace(/\/$/, '') || '/';
      if (seenPaths.has(normalized)) continue;
      seenPaths.add(normalized);

      result.matchedPaths.push(normalized);
      // Cap matched paths to avoid probing hundreds of sitemap URLs
      if (result.matchedPaths.length >= (options.maxMatchedPaths ?? 30)) break;
    } catch {
      // Malformed URL — skip
    }
  }

  // Deduplicate robots.txt hints
  result.robotsHints = [...new Set(result.robotsHints)].filter(
    p => !seenPaths.has(p),
  );

  logger.debug(
    {
      baseUrl,
      keywords,
      sitemapFound: result.sitemapFound,
      matchedCount: result.matchedPaths.length,
      robotsHints: result.robotsHints.length,
      totalSitemapUrls: allUrls.length,
    },
    'Sitemap discovery complete',
  );

  return result;
}
