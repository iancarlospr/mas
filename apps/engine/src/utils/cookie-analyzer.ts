/**
 * CookieAnalyzer — Extracts per-cookie attributes via Playwright's cookies API.
 *
 * Captures cookie metadata (name, domain, flags, tool matches) without storing
 * actual values to avoid PII leakage. Uses page.context().cookies() for
 * comprehensive cookie enumeration including HttpOnly cookies not visible to JS.
 *
 * Consumers: M05 (tool detection), M08 (tag governance), M12 (consent audit),
 *            M07 (martech confirmation)
 */

import type { Page } from 'patchright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CookieDetail {
  name: string;
  domain: string;
  path: string;
  expires: number;          // -1 for session
  size: number;             // name.length + value.length
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;         // 'Strict' | 'Lax' | 'None' | ''
  isFirstParty: boolean;
  isSession: boolean;
  partitioned: boolean;
  toolMatch: string | null;
  category: 'analytics' | 'advertising' | 'functional' | 'necessary' | 'unknown';
}

export interface CookieSummary {
  totalCookies: number;
  firstPartyCount: number;
  thirdPartyCount: number;
  sessionCount: number;
  persistentCount: number;
  totalSizeBytes: number;
  secureCount: number;
  httpOnlyCount: number;
  sameSiteNoneCount: number;
  sameSiteLaxCount: number;
  sameSiteStrictCount: number;
  sameSiteUnsetCount: number;
  categoryCounts: Record<string, number>;
  toolCounts: Record<string, number>;
}

export interface CookieAnalysis {
  cookies: CookieDetail[];     // capped at 200
  summary: CookieSummary;
}

// ---------------------------------------------------------------------------
// Cookie name patterns — matches cookie names to known tools + categories
// ---------------------------------------------------------------------------

type CookieCategory = CookieDetail['category'];

interface CookiePattern {
  pattern: RegExp;
  tool: string;
  category: CookieCategory;
}

const COOKIE_PATTERNS: CookiePattern[] = [
  // Google Analytics
  { pattern: /^_ga$/, tool: 'Google Analytics', category: 'analytics' },
  { pattern: /^_ga_/, tool: 'Google Analytics', category: 'analytics' },
  { pattern: /^_gid$/, tool: 'Google Analytics', category: 'analytics' },
  { pattern: /^_gat/, tool: 'Google Analytics', category: 'analytics' },

  // Google Ads
  { pattern: /^_gcl_/, tool: 'Google Ads', category: 'advertising' },

  // Meta Pixel
  { pattern: /^_fbp$/, tool: 'Meta Pixel', category: 'advertising' },
  { pattern: /^_fbc$/, tool: 'Meta Pixel', category: 'advertising' },

  // Microsoft Ads
  { pattern: /^_uet/, tool: 'Microsoft Ads', category: 'advertising' },

  // TikTok
  { pattern: /^_tt_/, tool: 'TikTok', category: 'advertising' },

  // Pinterest
  { pattern: /^_pin_/, tool: 'Pinterest', category: 'advertising' },

  // LinkedIn
  { pattern: /^_li_/, tool: 'LinkedIn', category: 'advertising' },
  { pattern: /^li_/, tool: 'LinkedIn', category: 'advertising' },

  // HubSpot
  { pattern: /^hubspotutk$/, tool: 'HubSpot', category: 'functional' },
  { pattern: /^__hs/, tool: 'HubSpot', category: 'functional' },

  // Amplitude
  { pattern: /^amplitude_id/, tool: 'Amplitude', category: 'analytics' },

  // Mixpanel
  { pattern: /^mp_.*_mixpanel$/, tool: 'Mixpanel', category: 'analytics' },

  // Hotjar
  { pattern: /^_hjid$/, tool: 'Hotjar', category: 'analytics' },
  { pattern: /^_hjSession/, tool: 'Hotjar', category: 'analytics' },

  // Segment
  { pattern: /^ajs_/, tool: 'Segment', category: 'analytics' },

  // Matomo
  { pattern: /^_pk_/, tool: 'Matomo', category: 'analytics' },

  // Microsoft Clarity
  { pattern: /^_clck$/, tool: 'Microsoft Clarity', category: 'analytics' },
  { pattern: /^_clsk$/, tool: 'Microsoft Clarity', category: 'analytics' },

  // OneTrust
  { pattern: /^OptanonConsent$/, tool: 'OneTrust', category: 'necessary' },
  { pattern: /^OptanonAlertBox/, tool: 'OneTrust', category: 'necessary' },

  // Cookiebot
  { pattern: /^CookieConsent$/, tool: 'Cookiebot', category: 'necessary' },

  // Cloudflare
  { pattern: /^__cf_bm$/, tool: 'Cloudflare', category: 'necessary' },
  { pattern: /^cf_clearance$/, tool: 'Cloudflare', category: 'necessary' },

  // Stripe
  { pattern: /^__stripe_/, tool: 'Stripe', category: 'functional' },

  // Intercom
  { pattern: /^intercom-/, tool: 'Intercom', category: 'functional' },

  // Crisp
  { pattern: /^crisp-client/, tool: 'Crisp', category: 'functional' },
];

const MAX_COOKIES = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a domain for comparison by stripping a leading dot.
 * e.g. ".example.com" → "example.com"
 */
function normalizeDomain(domain: string): string {
  return domain.startsWith('.') ? domain.slice(1) : domain;
}

/**
 * Check whether a cookie domain belongs to the target domain (first-party).
 * A cookie is first-party if its (normalized) domain matches the target domain
 * exactly, or is a subdomain of the target domain.
 */
function isFirstParty(cookieDomain: string, targetDomain: string): boolean {
  const normalized = normalizeDomain(cookieDomain).toLowerCase();
  const target = normalizeDomain(targetDomain).toLowerCase();

  // Exact match
  if (normalized === target) return true;

  // Subdomain match: cookie domain ends with ".target"
  if (normalized.endsWith(`.${target}`)) return true;

  // Target is a subdomain of cookie domain (e.g. cookie domain ".example.com"
  // covers "www.example.com")
  if (target.endsWith(`.${normalized}`)) return true;

  return false;
}

/**
 * Match a cookie name against known tool patterns.
 * Returns the tool name and category, or null/unknown if no match.
 */
function matchCookieTool(name: string): { tool: string | null; category: CookieCategory } {
  for (const { pattern, tool, category } of COOKIE_PATTERNS) {
    if (pattern.test(name)) {
      return { tool, category };
    }
  }
  return { tool: null, category: 'unknown' };
}

// ---------------------------------------------------------------------------
// CookieAnalyzer
// ---------------------------------------------------------------------------

export class CookieAnalyzer {
  /**
   * Analyze all cookies accessible via the browser context.
   * Returns cookie metadata (no values) and an aggregate summary.
   *
   * @param page - Patchright/Playwright Page instance
   * @param targetDomain - The domain being audited (e.g. "example.com")
   */
  static async analyze(page: Page, targetDomain: string): Promise<CookieAnalysis> {
    // Retrieve all cookies from the browser context
    const rawCookies = await page.context().cookies();

    // Cap at MAX_COOKIES
    const capped = rawCookies.slice(0, MAX_COOKIES);

    // Classify each cookie
    const cookies: CookieDetail[] = capped.map((cookie) => {
      const { tool, category } = matchCookieTool(cookie.name);
      const isSession = cookie.expires === -1 || cookie.expires === 0;
      const firstParty = isFirstParty(cookie.domain, targetDomain);

      // Compute size from name + value, then discard value
      const size = cookie.name.length + (cookie.value?.length ?? 0);

      // Check for partitioned attribute (CHIPS — newer browsers)
      const partitioned = 'partitioned' in cookie
        ? Boolean((cookie as Record<string, unknown>)['partitioned'])
        : false;

      // sameSite from Playwright: 'Strict' | 'Lax' | 'None'
      // Normalize: if missing or empty, treat as unset ('')
      const sameSite = cookie.sameSite ?? '';

      return {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        size,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite,
        isFirstParty: firstParty,
        isSession,
        partitioned,
        toolMatch: tool,
        category,
      };
    });

    // Build summary
    const summary = CookieAnalyzer.buildSummary(cookies);

    return { cookies, summary };
  }

  /**
   * Aggregate cookie details into a summary object.
   */
  private static buildSummary(cookies: CookieDetail[]): CookieSummary {
    const categoryCounts: Record<string, number> = {};
    const toolCounts: Record<string, number> = {};

    let firstPartyCount = 0;
    let thirdPartyCount = 0;
    let sessionCount = 0;
    let persistentCount = 0;
    let totalSizeBytes = 0;
    let secureCount = 0;
    let httpOnlyCount = 0;
    let sameSiteNoneCount = 0;
    let sameSiteLaxCount = 0;
    let sameSiteStrictCount = 0;
    let sameSiteUnsetCount = 0;

    for (const cookie of cookies) {
      // First/third party
      if (cookie.isFirstParty) {
        firstPartyCount++;
      } else {
        thirdPartyCount++;
      }

      // Session/persistent
      if (cookie.isSession) {
        sessionCount++;
      } else {
        persistentCount++;
      }

      // Size
      totalSizeBytes += cookie.size;

      // Flags
      if (cookie.secure) secureCount++;
      if (cookie.httpOnly) httpOnlyCount++;

      // SameSite
      switch (cookie.sameSite) {
        case 'None':
          sameSiteNoneCount++;
          break;
        case 'Lax':
          sameSiteLaxCount++;
          break;
        case 'Strict':
          sameSiteStrictCount++;
          break;
        default:
          sameSiteUnsetCount++;
          break;
      }

      // Category counts
      categoryCounts[cookie.category] = (categoryCounts[cookie.category] ?? 0) + 1;

      // Tool counts
      if (cookie.toolMatch) {
        toolCounts[cookie.toolMatch] = (toolCounts[cookie.toolMatch] ?? 0) + 1;
      }
    }

    return {
      totalCookies: cookies.length,
      firstPartyCount,
      thirdPartyCount,
      sessionCount,
      persistentCount,
      totalSizeBytes,
      secureCount,
      httpOnlyCount,
      sameSiteNoneCount,
      sameSiteLaxCount,
      sameSiteStrictCount,
      sameSiteUnsetCount,
      categoryCounts,
      toolCounts,
    };
  }
}
