/**
 * Mixed Content Detector
 *
 * Detects HTTP resources loaded on HTTPS pages via two passes:
 *   1. Network: scan captured requests for http:// URLs
 *   2. HTML: regex scan for src="http://..." and link[rel] href="http://..."
 *
 * Active mixed content (scripts, stylesheets, XHR) is blocked by browsers.
 * Passive mixed content (images, media, fonts) triggers warnings.
 *
 * NOTE: <a href="http://..."> anchor links are NOT mixed content — they are
 * navigation links, not subresource loads. The HTML regex only captures
 * src attributes and <link> href attributes, not <a> tags.
 */

import type { NetworkCollector } from './network.js';
import type { MixedContentEntry, MixedContentReport } from '../modules/types.js';
import pino from 'pino';

const logger = pino({ name: 'mixed-content-detector' });

const MAX_ENTRIES = 50;

/** Resource types that constitute "active" mixed content (browsers block these). */
const ACTIVE_TYPES = new Set(['script', 'stylesheet', 'xhr', 'fetch', 'xmlhttprequest', 'websocket', 'object', 'embed']);

/** Map resource type to severity. */
function getSeverity(resourceType: string): 'active' | 'passive' {
  return ACTIVE_TYPES.has(resourceType.toLowerCase()) ? 'active' : 'passive';
}

/** Classify a URL's resource type from its file extension or context. */
function classifyUrlType(url: string, context: 'src' | 'link-href'): string {
  const lower = url.toLowerCase();
  if (/\.js(\?|$)/.test(lower)) return 'script';
  if (/\.css(\?|$)/.test(lower)) return 'stylesheet';
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico|bmp)(\?|$)/.test(lower)) return 'image';
  if (/\.(mp4|webm|ogg|mp3|wav|m3u8)(\?|$)/.test(lower)) return 'media';
  if (/\.(woff2?|ttf|otf|eot)(\?|$)/.test(lower)) return 'font';
  // <link href> is typically stylesheet; src is typically other
  return context === 'link-href' ? 'stylesheet' : 'other';
}

/**
 * Detect mixed content on a page.
 *
 * @param pageUrl - The page URL being scanned
 * @param networkCollector - Network request collector from the browser phase
 * @param html - Raw HTML for regex-based fallback detection
 * @returns MixedContentReport or null if page is not HTTPS
 */
export function detectMixedContent(
  pageUrl: string,
  networkCollector: NetworkCollector | null,
  html: string | null,
): MixedContentReport | null {
  const isHttps = pageUrl.startsWith('https://');

  if (!isHttps) {
    return { isHttps: false, activeCount: 0, passiveCount: 0, entries: [] };
  }

  const seen = new Set<string>();
  const entries: MixedContentEntry[] = [];

  // ── Pass 1: Network requests ───────────────────────────────────────────
  if (networkCollector) {
    const requests = networkCollector.getAllRequests();
    for (const req of requests) {
      if (entries.length >= MAX_ENTRIES) break;
      if (!req.url.startsWith('http://')) continue;

      const url = req.url;
      if (seen.has(url)) continue;
      seen.add(url);

      const resourceType = req.resourceType || 'other';
      entries.push({
        url,
        resourceType,
        source: 'network',
        severity: getSeverity(resourceType),
      });
    }
  }

  // ── Pass 2: HTML regex scan ────────────────────────────────────────────
  // Only match src="http://..." and <link ... href="http://...">
  // Explicitly excludes <a href> which is a navigation link, not a resource load.
  if (html && entries.length < MAX_ENTRIES) {
    // Match src="http://..." attributes (any element)
    const srcPattern = /\bsrc\s*=\s*["'](http:\/\/[^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = srcPattern.exec(html)) !== null && entries.length < MAX_ENTRIES) {
      const url = match[1]!;
      if (seen.has(url)) continue;
      seen.add(url);

      const resourceType = classifyUrlType(url, 'src');
      entries.push({
        url,
        resourceType,
        source: 'html',
        severity: getSeverity(resourceType),
      });
    }

    // Match <link ... href="http://..." > (stylesheets, preloads — not <a> anchors)
    const linkHrefPattern = /<link\b[^>]*\bhref\s*=\s*["'](http:\/\/[^"']+)["'][^>]*>/gi;
    while ((match = linkHrefPattern.exec(html)) !== null && entries.length < MAX_ENTRIES) {
      const url = match[1]!;
      if (seen.has(url)) continue;
      seen.add(url);

      const resourceType = classifyUrlType(url, 'link-href');
      entries.push({
        url,
        resourceType,
        source: 'html',
        severity: getSeverity(resourceType),
      });
    }
  }

  let activeCount = 0;
  let passiveCount = 0;
  for (const e of entries) {
    if (e.severity === 'active') activeCount++;
    else passiveCount++;
  }

  if (activeCount > 0 || passiveCount > 0) {
    logger.debug(
      { activeCount, passiveCount, total: entries.length },
      'Mixed content detected',
    );
  }

  return {
    isHttps: true,
    activeCount,
    passiveCount,
    entries,
  };
}
