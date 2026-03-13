/**
 * Crawl-first page discovery utility.
 *
 * Search Cloudflare crawl results for pages matching paths or content keywords,
 * then return uncovered paths that need individual HTTP probing as fallback.
 */
import type { CrawledPage } from '../services/cloudflare-crawl.js';

/**
 * Normalize a URL for comparison: lowercase host, strip trailing slash.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Search crawl results for pages matching the given paths or content keywords.
 * Returns all matching CrawledPages with their HTML.
 *
 * Two-pass matching:
 *  1. Exact path match: check if crawlPages has baseUrl + path
 *  2. Content scan: scan ALL crawl pages for contentValidator matches
 *     (crawl may find press/careers at unexpected URLs)
 */
export function findMatchingCrawlPages(
  crawlPages: Map<string, CrawledPage> | undefined,
  baseUrl: string,
  targetPaths: string[],
  contentValidator: (htmlLower: string) => boolean,
): CrawledPage[] {
  if (!crawlPages || crawlPages.size === 0) return [];

  const matched = new Map<string, CrawledPage>();
  const normalizedBase = normalizeUrl(baseUrl);
  const baseHost = new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, '');

  // Pass 1: exact path matches
  for (const path of targetPaths) {
    const targetUrl = normalizeUrl(`${normalizedBase}${path}`);
    const page = crawlPages.get(targetUrl);
    if (page?.status === 'completed' && page.html) {
      matched.set(targetUrl, page);
    }
  }

  // Pass 2: content scan — check all crawl pages for keyword matches
  for (const [url, page] of crawlPages) {
    if (matched.has(url)) continue;
    if (page.status !== 'completed' || !page.html) continue;

    // Only consider same-host pages
    try {
      const pageHost = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      if (!pageHost.endsWith(baseHost)) continue;
    } catch {
      continue;
    }

    const htmlLower = page.html.toLowerCase();
    if (contentValidator(htmlLower)) {
      matched.set(url, page);
    }
  }

  return [...matched.values()];
}

/**
 * Given a list of paths, return those NOT covered by crawl results.
 * These need individual HTTP probing as fallback.
 */
export function getUncoveredPaths(
  crawlPages: Map<string, CrawledPage> | undefined,
  baseUrl: string,
  paths: string[],
): string[] {
  if (!crawlPages || crawlPages.size === 0) return paths;

  const normalizedBase = normalizeUrl(baseUrl);

  return paths.filter((path) => {
    const targetUrl = normalizeUrl(`${normalizedBase}${path}`);
    const page = crawlPages.get(targetUrl);
    // Covered = completed with HTML content
    return !(page?.status === 'completed' && page.html);
  });
}
