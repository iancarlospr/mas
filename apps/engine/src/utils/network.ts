import type { Page, Request, Response } from 'playwright';
import { getRegistrableDomain } from './url.js';
import pino from 'pino';

const logger = pino({ name: 'network-collector' });

export interface CapturedRequest {
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  postData: string | null;
  timestamp: number;
  domain: string | null;
  category: RequestCategory;
}

export interface CapturedResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
  requestUrl: string;
}

export type RequestCategory =
  | 'analytics'
  | 'advertising'
  | 'tag_manager'
  | 'martech'
  | 'social'
  | 'cdn'
  | 'media'
  | 'font'
  | 'first_party'
  | 'third_party'
  | 'unknown';

/**
 * Domain patterns for categorizing network requests.
 */
const DOMAIN_PATTERNS: Array<{ pattern: RegExp; category: RequestCategory }> = [
  // Analytics
  { pattern: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/, category: 'analytics' },
  { pattern: /segment\.(com|io)|cdn\.segment\.com/, category: 'analytics' },
  { pattern: /mixpanel\.com/, category: 'analytics' },
  { pattern: /amplitude\.com/, category: 'analytics' },
  { pattern: /heap\.io|heapanalytics\.com/, category: 'analytics' },
  { pattern: /fullstory\.(com|io)/, category: 'analytics' },
  { pattern: /hotjar\.(com|io)/, category: 'analytics' },
  { pattern: /posthog\.(com|io)|us\.posthog\.com|eu\.posthog\.com/, category: 'analytics' },
  { pattern: /plausible\.io/, category: 'analytics' },
  { pattern: /matomo\.(org|cloud)/, category: 'analytics' },
  { pattern: /clarity\.ms/, category: 'analytics' },
  { pattern: /mouseflow\.com/, category: 'analytics' },
  { pattern: /crazyegg\.com/, category: 'analytics' },
  { pattern: /luckyorange\.com/, category: 'analytics' },

  // Advertising
  { pattern: /doubleclick\.net|googlesyndication\.com|googleads\.g\.doubleclick\.net/, category: 'advertising' },
  { pattern: /facebook\.com\/tr|connect\.facebook\.net/, category: 'advertising' },
  { pattern: /ads-twitter\.com|analytics\.twitter\.com|t\.co/, category: 'advertising' },
  { pattern: /linkedin\.com\/px|snap\.licdn\.com/, category: 'advertising' },
  { pattern: /tiktok\.com\/i18n|analytics\.tiktok\.com/, category: 'advertising' },
  { pattern: /bing\.com\/bat|bat\.bing\.com/, category: 'advertising' },
  { pattern: /snap\.com|sc-static\.net/, category: 'advertising' },
  { pattern: /pinterest\.com\/ct|ct\.pinterest\.com/, category: 'advertising' },
  { pattern: /criteo\.(com|net)/, category: 'advertising' },
  { pattern: /taboola\.com/, category: 'advertising' },
  { pattern: /outbrain\.com/, category: 'advertising' },
  { pattern: /adroll\.com/, category: 'advertising' },
  { pattern: /rubiconproject\.com/, category: 'advertising' },
  { pattern: /pubmatic\.com/, category: 'advertising' },

  // Tag Managers
  { pattern: /googletagmanager\.com\/gtm\.js/, category: 'tag_manager' },
  { pattern: /tealiumiq\.com|tags\.tiqcdn\.com/, category: 'tag_manager' },
  { pattern: /ensighten\.com/, category: 'tag_manager' },
  { pattern: /adobedtm\.com|assets\.adobedtm\.com/, category: 'tag_manager' },

  // MarTech
  { pattern: /hubspot\.(com|net)|js\.hs-scripts\.com|js\.hs-analytics\.net/, category: 'martech' },
  { pattern: /marketo\.(com|net)|munchkin\.marketo\.net/, category: 'martech' },
  { pattern: /pardot\.com|pi\.pardot\.com/, category: 'martech' },
  { pattern: /intercom\.(com|io)|widget\.intercom\.io/, category: 'martech' },
  { pattern: /drift\.(com|io)|js\.driftt\.com/, category: 'martech' },
  { pattern: /zendesk\.com|static\.zdassets\.com/, category: 'martech' },
  { pattern: /freshdesk\.com|freshchat\.com/, category: 'martech' },
  { pattern: /mailchimp\.com|chimpstatic\.com/, category: 'martech' },
  { pattern: /klaviyo\.com|static\.klaviyo\.com/, category: 'martech' },
  { pattern: /optimizely\.com|cdn\.optimizely\.com/, category: 'martech' },
  { pattern: /launchdarkly\.com/, category: 'martech' },
  { pattern: /vwo\.com|dev\.visualwebsiteoptimizer\.com/, category: 'martech' },

  // Social
  { pattern: /platform\.twitter\.com|syndication\.twitter\.com/, category: 'social' },
  { pattern: /platform\.linkedin\.com/, category: 'social' },
  { pattern: /connect\.facebook\.net.*sdk/, category: 'social' },

  // CDN
  { pattern: /cloudflare\.com|cdnjs\.cloudflare\.com/, category: 'cdn' },
  { pattern: /fastly\.net|fastlylb\.net/, category: 'cdn' },
  { pattern: /akamai\.net|akamaized\.net/, category: 'cdn' },
  { pattern: /cloudfront\.net/, category: 'cdn' },
  { pattern: /jsdelivr\.net/, category: 'cdn' },
  { pattern: /unpkg\.com/, category: 'cdn' },
  { pattern: /gstatic\.com/, category: 'cdn' },

  // Media
  { pattern: /youtube\.com|ytimg\.com/, category: 'media' },
  { pattern: /vimeo\.com|vimeocdn\.com/, category: 'media' },
  { pattern: /wistia\.(com|net)/, category: 'media' },

  // Fonts
  { pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/, category: 'font' },
  { pattern: /use\.typekit\.net/, category: 'font' },
];

/**
 * Classify a URL into a request category based on domain patterns.
 */
function classifyRequest(url: string, scanDomain: string | null): RequestCategory {
  try {
    const urlDomain = getRegistrableDomain(url);

    // Check known patterns first
    for (const { pattern, category } of DOMAIN_PATTERNS) {
      if (pattern.test(url)) {
        return category;
      }
    }

    // Check if it's first-party
    if (urlDomain && scanDomain && urlDomain === scanDomain) {
      return 'first_party';
    }

    // If it has a different domain, it's third-party
    if (urlDomain && scanDomain && urlDomain !== scanDomain) {
      return 'third_party';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * NetworkCollector captures all Playwright requests and responses during
 * a page navigation. It classifies requests by domain category and
 * provides filtered query methods for each module type.
 *
 * Specified in OP-5 of the architecture plan.
 */
export class NetworkCollector {
  private requests: CapturedRequest[] = [];
  private responses: CapturedResponse[] = [];
  private scanDomain: string | null;
  private collecting = false;

  constructor(scanDomain: string | null) {
    this.scanDomain = scanDomain;
  }

  /**
   * Start collecting network requests from a Playwright page.
   */
  attach(page: Page): void {
    if (this.collecting) return;
    this.collecting = true;

    page.on('request', (request: Request) => {
      try {
        const url = request.url();
        const domain = getRegistrableDomain(url);
        const category = classifyRequest(url, this.scanDomain);

        this.requests.push({
          url,
          method: request.method(),
          resourceType: request.resourceType(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: Date.now(),
          domain,
          category,
        });
      } catch (error) {
        logger.debug({ error: (error as Error).message }, 'Failed to capture request');
      }
    });

    page.on('response', (response: Response) => {
      try {
        const url = response.url();
        const headers: Record<string, string> = {};
        const allHeaders = response.headers();
        for (const [key, value] of Object.entries(allHeaders)) {
          headers[key] = value;
        }

        this.responses.push({
          url,
          status: response.status(),
          headers,
          timestamp: Date.now(),
          requestUrl: response.request().url(),
        });
      } catch (error) {
        logger.debug({ error: (error as Error).message }, 'Failed to capture response');
      }
    });
  }

  /**
   * Get all captured requests.
   */
  getAllRequests(): CapturedRequest[] {
    return [...this.requests];
  }

  /**
   * Get all captured responses.
   */
  getAllResponses(): CapturedResponse[] {
    return [...this.responses];
  }

  /**
   * Get requests filtered by category.
   */
  getByCategory(category: RequestCategory): CapturedRequest[] {
    return this.requests.filter((r) => r.category === category);
  }

  /**
   * Get analytics-related requests (for M05).
   */
  getAnalyticsRequests(): CapturedRequest[] {
    return this.getByCategory('analytics');
  }

  /**
   * Get advertising-related requests (for M06, M06b).
   */
  getAdvertisingRequests(): CapturedRequest[] {
    return this.getByCategory('advertising');
  }

  /**
   * Get tag manager requests (for M08).
   */
  getTagManagerRequests(): CapturedRequest[] {
    return this.getByCategory('tag_manager');
  }

  /**
   * Get martech-related requests (for M07).
   */
  getMartechRequests(): CapturedRequest[] {
    return this.getByCategory('martech');
  }

  /**
   * Get social-related requests (for M15).
   */
  getSocialRequests(): CapturedRequest[] {
    return this.getByCategory('social');
  }

  /**
   * Get first-party requests.
   */
  getFirstPartyRequests(): CapturedRequest[] {
    return this.getByCategory('first_party');
  }

  /**
   * Get third-party requests (all non-first-party).
   */
  getThirdPartyRequests(): CapturedRequest[] {
    return this.requests.filter((r) => r.category !== 'first_party');
  }

  /**
   * Get requests matching a URL pattern.
   */
  getByUrlPattern(pattern: RegExp): CapturedRequest[] {
    return this.requests.filter((r) => pattern.test(r.url));
  }

  /**
   * Get requests with POST data (useful for tracking pixel data).
   */
  getPostRequests(): CapturedRequest[] {
    return this.requests.filter((r) => r.method === 'POST' && r.postData);
  }

  /**
   * Get unique third-party domains found.
   */
  getThirdPartyDomains(): string[] {
    const domains = new Set<string>();
    for (const req of this.requests) {
      if (req.domain && req.category !== 'first_party') {
        domains.add(req.domain);
      }
    }
    return Array.from(domains);
  }

  /**
   * Get a snapshot of requests captured since a given timestamp.
   * Useful for captureNetworkDelta in ghostscan probes.
   */
  getRequestsSince(timestamp: number): CapturedRequest[] {
    return this.requests.filter((r) => r.timestamp >= timestamp);
  }

  /**
   * Get summary statistics.
   */
  getSummary(): {
    totalRequests: number;
    totalResponses: number;
    byCategory: Record<RequestCategory, number>;
    thirdPartyDomains: number;
    failedRequests: number;
  } {
    const byCategory: Record<RequestCategory, number> = {
      analytics: 0,
      advertising: 0,
      tag_manager: 0,
      martech: 0,
      social: 0,
      cdn: 0,
      media: 0,
      font: 0,
      first_party: 0,
      third_party: 0,
      unknown: 0,
    };

    for (const req of this.requests) {
      byCategory[req.category]++;
    }

    const failedRequests = this.responses.filter((r) => r.status >= 400).length;

    return {
      totalRequests: this.requests.length,
      totalResponses: this.responses.length,
      byCategory,
      thirdPartyDomains: this.getThirdPartyDomains().length,
      failedRequests,
    };
  }

  /**
   * Clear all captured data.
   */
  clear(): void {
    this.requests = [];
    this.responses = [];
  }
}
