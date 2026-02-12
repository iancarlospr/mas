/**
 * Third-Party Profiler — builds per-domain third-party performance profiles
 * from NetworkCollector data and HTML analysis.
 *
 * Used by M03 (Performance), M07 (MarTech), M08 (Tag Governance) to understand
 * the cost and behavior of each third-party domain loaded on a page.
 */

import type { Page } from 'patchright';
import type { NetworkCollector, CapturedRequest, CapturedResponse } from './network.js';
import { getRegistrableDomain } from './url.js';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface ThirdPartyProfile {
  domain: string;
  category: 'analytics' | 'advertising' | 'tag_manager' | 'martech' | 'social' | 'cdn' | 'font' | 'other';
  requestCount: number;
  totalBytes: number;
  avgLatency: number;            // ms
  isRenderBlocking: boolean;     // has sync script or blocking stylesheet
  hasSyncScript: boolean;
  cookiesSet: number;            // placeholder — filled by caller from CookieAnalyzer
  toolName: string | null;       // from domain -> tool mapping
}

export interface ThirdPartyAnalysis {
  profiles: ThirdPartyProfile[];  // capped at 30, sorted by totalBytes desc
  totalThirdPartyRequests: number;
  totalThirdPartyBytes: number;
  renderBlockingCount: number;
  uniqueDomains: number;
}

// ---------------------------------------------------------------------------
// Domain -> category classification
// ---------------------------------------------------------------------------

type ProfileCategory = ThirdPartyProfile['category'];

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: ProfileCategory }> = [
  // Analytics
  { pattern: /google-analytics\.com/, category: 'analytics' },
  { pattern: /googletagmanager\.com/, category: 'analytics' },
  { pattern: /analytics\.google\.com/, category: 'analytics' },
  { pattern: /segment\.(io|com)|cdn\.segment\.com/, category: 'analytics' },
  { pattern: /amplitude\.com/, category: 'analytics' },
  { pattern: /mixpanel\.com/, category: 'analytics' },
  { pattern: /hotjar\.com/, category: 'analytics' },
  { pattern: /clarity\.ms/, category: 'analytics' },
  { pattern: /fullstory\.com/, category: 'analytics' },
  { pattern: /heap-analytics\.com/, category: 'analytics' },
  { pattern: /posthog\.com/, category: 'analytics' },
  { pattern: /pendo\.io/, category: 'analytics' },
  { pattern: /rudderstack\.com/, category: 'analytics' },
  { pattern: /matomo\.cloud/, category: 'analytics' },

  // Advertising
  { pattern: /doubleclick\.net/, category: 'advertising' },
  { pattern: /googlesyndication\.com/, category: 'advertising' },
  { pattern: /googleadservices\.com/, category: 'advertising' },
  { pattern: /facebook\.net/, category: 'advertising' },
  { pattern: /fbcdn\.net/, category: 'advertising' },
  { pattern: /ads-twitter\.com/, category: 'advertising' },
  { pattern: /adsymptotic\.com/, category: 'advertising' },
  { pattern: /criteo\.(com|net)/, category: 'advertising' },
  { pattern: /adnxs\.com/, category: 'advertising' },
  { pattern: /amazon-adsystem\.com/, category: 'advertising' },
  { pattern: /linkedin\.com\/li\//, category: 'advertising' },
  { pattern: /bing\.com\/bat/, category: 'advertising' },
  { pattern: /tiktok\.com\/i18n\/pixel/, category: 'advertising' },
  { pattern: /pinterest\.com\/ct/, category: 'advertising' },
  { pattern: /snapchat\.com\/scevent/, category: 'advertising' },
  { pattern: /taboola\.com/, category: 'advertising' },
  { pattern: /outbrain\.com/, category: 'advertising' },

  // Tag Managers (checked after analytics so GTM /gtm.js can still be analytics above)
  { pattern: /googletagmanager\.com/, category: 'tag_manager' },
  { pattern: /tags\.tiqcdn\.com/, category: 'tag_manager' },
  { pattern: /cdn\.cookielaw\.org/, category: 'tag_manager' },
  { pattern: /consentmanager\.net/, category: 'tag_manager' },

  // MarTech
  { pattern: /hubspot\.com/, category: 'martech' },
  { pattern: /hs-analytics\.net/, category: 'martech' },
  { pattern: /hs-scripts\.com/, category: 'martech' },
  { pattern: /marketo\.net/, category: 'martech' },
  { pattern: /mktoresp\.com/, category: 'martech' },
  { pattern: /pardot\.com/, category: 'martech' },
  { pattern: /intercom\.io/, category: 'martech' },
  { pattern: /intercomcdn\.com/, category: 'martech' },
  { pattern: /drift\.com/, category: 'martech' },
  { pattern: /crisp\.chat/, category: 'martech' },
  { pattern: /zendesk\.com/, category: 'martech' },
  { pattern: /freshdesk\.com/, category: 'martech' },
  { pattern: /livechatinc\.com/, category: 'martech' },
  { pattern: /olark\.com/, category: 'martech' },
  { pattern: /tawk\.to/, category: 'martech' },

  // Social
  { pattern: /platform\.twitter\.com/, category: 'social' },
  { pattern: /connect\.facebook\.net/, category: 'social' },
  { pattern: /platform\.linkedin\.com/, category: 'social' },
  { pattern: /apis\.google\.com\/js\/plusone/, category: 'social' },

  // CDN
  { pattern: /cdnjs\.cloudflare\.com/, category: 'cdn' },
  { pattern: /cdn\.jsdelivr\.net/, category: 'cdn' },
  { pattern: /unpkg\.com/, category: 'cdn' },
  { pattern: /ajax\.googleapis\.com/, category: 'cdn' },
  { pattern: /stackpath\.bootstrapcdn\.com/, category: 'cdn' },
  { pattern: /maxcdn\.bootstrapcdn\.com/, category: 'cdn' },
  { pattern: /cdn\.shopify\.com/, category: 'cdn' },
  { pattern: /fastly\.net/, category: 'cdn' },
  { pattern: /akamaized\.net/, category: 'cdn' },
  { pattern: /cloudfront\.net/, category: 'cdn' },

  // Font
  { pattern: /fonts\.googleapis\.com/, category: 'font' },
  { pattern: /fonts\.gstatic\.com/, category: 'font' },
  { pattern: /use\.typekit\.net/, category: 'font' },
  { pattern: /use\.fontawesome\.com/, category: 'font' },
  { pattern: /kit\.fontawesome\.com/, category: 'font' },
];

function classifyDomain(domain: string): ProfileCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(domain)) return category;
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Domain -> tool name mapping
// ---------------------------------------------------------------------------

const TOOL_NAME_PATTERNS: Array<{ pattern: RegExp; tool: string }> = [
  { pattern: /google-analytics\.com|analytics\.google\.com/, tool: 'Google Analytics' },
  { pattern: /googletagmanager\.com/, tool: 'Google Tag Manager' },
  { pattern: /segment\.(io|com)|cdn\.segment\.com/, tool: 'Segment' },
  { pattern: /amplitude\.com/, tool: 'Amplitude' },
  { pattern: /mixpanel\.com/, tool: 'Mixpanel' },
  { pattern: /hotjar\.com/, tool: 'Hotjar' },
  { pattern: /clarity\.ms/, tool: 'Microsoft Clarity' },
  { pattern: /fullstory\.com/, tool: 'FullStory' },
  { pattern: /doubleclick\.net|googlesyndication\.com|googleadservices\.com/, tool: 'Google Ads' },
  { pattern: /connect\.facebook\.net|facebook\.net/, tool: 'Meta' },
  { pattern: /hubspot\.com|hs-analytics\.net|hs-scripts\.com/, tool: 'HubSpot' },
  { pattern: /intercom\.io|intercomcdn\.com/, tool: 'Intercom' },
  { pattern: /drift\.com/, tool: 'Drift' },
  { pattern: /crisp\.chat/, tool: 'Crisp' },
  { pattern: /cdn\.cookielaw\.org/, tool: 'OneTrust' },
  { pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/, tool: 'Google Fonts' },
  { pattern: /use\.typekit\.net/, tool: 'Adobe Fonts' },
];

function resolveToolName(domain: string): string | null {
  for (const { pattern, tool } of TOOL_NAME_PATTERNS) {
    if (pattern.test(domain)) return tool;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Render-blocking detection result (from page.evaluate)
// ---------------------------------------------------------------------------

interface RenderBlockingInfo {
  syncScriptDomains: string[];
  blockingStylesheetDomains: string[];
}

// ---------------------------------------------------------------------------
// ThirdPartyProfiler
// ---------------------------------------------------------------------------

/** Maximum profiles returned in the analysis. */
const MAX_PROFILES = 30;

export class ThirdPartyProfiler {
  /**
   * Analyse third-party resources loaded on a page.
   *
   * @param page              – live Playwright page (used for render-blocking detection)
   * @param networkCollector  – populated NetworkCollector with captured requests/responses
   * @param targetDomain      – the first-party registrable domain (e.g. "example.com")
   */
  static async profile(
    page: Page,
    networkCollector: NetworkCollector,
    targetDomain: string,
  ): Promise<ThirdPartyAnalysis> {
    const requests = networkCollector.getAllRequests();
    const responses = networkCollector.getAllResponses();

    // Build a response lookup: requestUrl -> CapturedResponse
    const responseByUrl = new Map<string, CapturedResponse>();
    for (const resp of responses) {
      // Keep the latest response per URL (redirects may produce multiple)
      responseByUrl.set(resp.requestUrl, resp);
    }

    // Build a request timestamp lookup: url -> earliest timestamp
    const requestTimestampByUrl = new Map<string, number>();
    for (const req of requests) {
      const existing = requestTimestampByUrl.get(req.url);
      if (existing == null || req.timestamp < existing) {
        requestTimestampByUrl.set(req.url, req.timestamp);
      }
    }

    // Normalise target domain for comparison
    const normalizedTarget = targetDomain.toLowerCase().replace(/^www\./, '');

    // Group requests by registrable domain (third-party only)
    const domainGroups = new Map<string, CapturedRequest[]>();

    for (const req of requests) {
      const reqDomain = extractRequestDomain(req.url);
      if (!reqDomain) continue;

      const normalizedReq = reqDomain.toLowerCase().replace(/^www\./, '');
      if (normalizedReq === normalizedTarget) continue; // first-party — skip

      const registrable = getRegistrableDomain(req.url);
      const domainKey = registrable ?? normalizedReq;

      const group = domainGroups.get(domainKey);
      if (group) {
        group.push(req);
      } else {
        domainGroups.set(domainKey, [req]);
      }
    }

    // Detect render-blocking resources via page.evaluate
    const renderBlocking = await detectRenderBlocking(page, normalizedTarget);
    const renderBlockingDomains = new Set<string>([
      ...renderBlocking.syncScriptDomains,
      ...renderBlocking.blockingStylesheetDomains,
    ]);
    const syncScriptDomainSet = new Set(renderBlocking.syncScriptDomains);

    // Build profiles
    const profiles: ThirdPartyProfile[] = [];

    for (const [domain, reqs] of domainGroups) {
      let totalBytes = 0;
      let totalLatency = 0;
      let latencySamples = 0;

      for (const req of reqs) {
        const resp = responseByUrl.get(req.url);
        if (resp) {
          // Size from content-length header
          const contentLength = resp.headers['content-length'];
          if (contentLength) {
            const parsed = parseInt(contentLength, 10);
            if (!isNaN(parsed) && parsed > 0) {
              totalBytes += parsed;
            }
          }

          // Duration approximated via timestamp delta
          const reqTs = requestTimestampByUrl.get(req.url);
          if (reqTs != null) {
            const duration = resp.timestamp - reqTs;
            if (duration >= 0) {
              totalLatency += duration;
              latencySamples++;
            }
          }
        }
      }

      const avgLatency = latencySamples > 0 ? Math.round(totalLatency / latencySamples) : 0;

      profiles.push({
        domain,
        category: classifyDomain(domain),
        requestCount: reqs.length,
        totalBytes,
        avgLatency,
        isRenderBlocking: renderBlockingDomains.has(domain),
        hasSyncScript: syncScriptDomainSet.has(domain),
        cookiesSet: 0, // placeholder — filled by caller from CookieAnalyzer
        toolName: resolveToolName(domain),
      });
    }

    // Sort by totalBytes descending, cap at MAX_PROFILES
    profiles.sort((a, b) => b.totalBytes - a.totalBytes);
    const capped = profiles.slice(0, MAX_PROFILES);

    // Build summary
    const totalThirdPartyRequests = profiles.reduce((sum, p) => sum + p.requestCount, 0);
    const totalThirdPartyBytes = profiles.reduce((sum, p) => sum + p.totalBytes, 0);
    const renderBlockingCount = profiles.filter((p) => p.isRenderBlocking).length;

    return {
      profiles: capped,
      totalThirdPartyRequests,
      totalThirdPartyBytes,
      renderBlockingCount,
      uniqueDomains: profiles.length,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the hostname from a URL string, returning null on failure.
 */
function extractRequestDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Detect render-blocking third-party resources in the DOM.
 * Returns lists of third-party registrable domains that have
 * synchronous scripts or blocking stylesheets.
 */
async function detectRenderBlocking(
  page: Page,
  normalizedTarget: string,
): Promise<RenderBlockingInfo> {
  try {
    const result = await page.evaluate(() => {
      const syncScriptSrcs: string[] = [];
      const blockingStylesheetHrefs: string[] = [];

      // Synchronous scripts: <script src="..."> without async or defer
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach((el) => {
        const script = el as HTMLScriptElement;
        if (!script.async && !script.defer && script.src) {
          syncScriptSrcs.push(script.src);
        }
      });

      // Blocking stylesheets: <link rel="stylesheet" href="...">
      const links = document.querySelectorAll('link[rel="stylesheet"][href]');
      links.forEach((el) => {
        const link = el as HTMLLinkElement;
        if (link.href) {
          blockingStylesheetHrefs.push(link.href);
        }
      });

      return { syncScriptSrcs, blockingStylesheetHrefs };
    });

    const syncScriptDomains = resolveThirdPartyDomains(result.syncScriptSrcs, normalizedTarget);
    const blockingStylesheetDomains = resolveThirdPartyDomains(result.blockingStylesheetHrefs, normalizedTarget);

    return { syncScriptDomains, blockingStylesheetDomains };
  } catch {
    // Page may have been closed or navigated away
    return { syncScriptDomains: [], blockingStylesheetDomains: [] };
  }
}

/**
 * Given a list of URLs, return unique registrable domains that are third-party
 * relative to normalizedTarget.
 */
function resolveThirdPartyDomains(urls: string[], normalizedTarget: string): string[] {
  const domains = new Set<string>();

  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      const registrable = getRegistrableDomain(url);
      const domainKey = registrable ?? hostname;

      if (domainKey !== normalizedTarget) {
        domains.add(domainKey);
      }
    } catch {
      // Invalid URL — skip
    }
  }

  return Array.from(domains);
}
