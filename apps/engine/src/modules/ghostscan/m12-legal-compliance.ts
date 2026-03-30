/**
 * M12 - Legal, Security & Compliance
 *
 * Audits privacy policy, terms of service, cookie consent banners,
 * security headers (HSTS, CSP), cookie security flags, SRI coverage,
 * and regulatory compliance signals (GDPR, CCPA).
 *
 * Checkpoints:
 *   1. Privacy policy
 *   2. Terms of service
 *   3. Cookie consent banner
 *   4. Pre-consent tracking
 *   5. HSTS configuration
 *   6. CSP policy (PCI DSS 4.0 script-src check)
 *   7. SRI on third-party scripts (PCI DSS 4.0 Req 6.4.3)
 *   8. Cookie security flags
 *   9. security.txt
 *  10. CCPA opt-out link
 *  11. Financial regulatory disclosures (FDIC, NCUA, Equal Housing, NMLS, FINRA/SIPC)
 *  12. Accessibility statement (ADA / Section 508)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { probeConsentBanner } from '../../ghostscan/probes.js';
import { probeUrl } from '../../utils/url.js';

// ─── Jurisdiction detection ─────────────────────────────────────────────────

/**
 * Jurisdiction signal strength: determines whether a site is primarily EU-facing,
 * US-only, or indeterminate. This controls consent checkpoint severity.
 *
 * EU signals (any = EU-facing):
 *   - EU/EEA ccTLD (.de, .fr, .co.uk, .nl, .at, .be, .ie, etc.)
 *   - Unambiguous EU hreflang entries (de, fr, nl, it, etc.)
 *   - Region-qualified hreflang for EU (es-ES, pt-PT but NOT bare es/pt)
 *   - TCF (Transparency & Consent Framework) string/global detected
 *   - Consent Mode v2 active (strong signal the site targets EU users)
 *
 * US-only signals:
 *   - .gov, .mil TLD → ALWAYS us_only (US government, no override)
 *   - .us, .pr TLD → us_only unless unambiguous EU hreflang present
 */
type Jurisdiction = 'eu_facing' | 'us_only' | 'indeterminate';

const EU_CCTLDS = new Set([
  // EU member states
  'at', 'be', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fi', 'fr',
  'de', 'gr', 'hu', 'ie', 'it', 'lv', 'lt', 'lu', 'mt', 'nl',
  'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se',
  // EEA + UK (still has GDPR-equivalent UK GDPR)
  'no', 'is', 'li', 'uk',
  // Common EU second-level TLDs
  'eu',
]);

// Languages that are unambiguously EU (NOT widely spoken in the Americas)
const EU_UNAMBIGUOUS_LANGS = new Set([
  'de', 'fr', 'nl', 'it', 'pl', 'sv', 'da', 'fi',
  'no', 'cs', 'ro', 'hu', 'sk', 'bg', 'hr', 'sl', 'et', 'lv',
  'lt', 'mt', 'ga', 'el',
]);

// Languages spoken in both EU and Americas — only count as EU when region-qualified
// e.g. "es" is ambiguous (could be Latin America), but "es-ES" is definitely Spain
const AMBIGUOUS_LANGS = new Set(['es', 'pt']);

// EU region codes that disambiguate (lowercase for matching)
const EU_REGION_QUALIFIERS = new Set([
  'es-es', 'pt-pt', 'fr-fr', 'fr-be', 'fr-lu', 'de-de', 'de-at', 'de-lu',
  'nl-nl', 'nl-be', 'it-it', 'el-gr', 'sv-se', 'da-dk', 'fi-fi',
  'pl-pl', 'cs-cz', 'ro-ro', 'hu-hu', 'sk-sk', 'bg-bg', 'hr-hr',
  'sl-si', 'et-ee', 'lv-lv', 'lt-lt', 'mt-mt', 'ga-ie', 'no-no',
]);

/**
 * Determine whether a hreflang entry set contains evidence of EU targeting.
 * Handles ambiguous languages (es, pt) by requiring an EU region qualifier.
 */
function hasEuHreflangSignal(entries: string[]): boolean {
  for (const code of entries) {
    const normalized = code.toLowerCase().replace('_', '-');
    const baseLang = normalized.split('-')[0]!;

    // Unambiguous EU language → definite EU signal
    if (EU_UNAMBIGUOUS_LANGS.has(baseLang)) return true;

    // Ambiguous language → only counts if region-qualified for EU
    if (AMBIGUOUS_LANGS.has(baseLang) && EU_REGION_QUALIFIERS.has(normalized)) return true;
  }
  return false;
}

function detectJurisdiction(
  url: string,
  hreflangEntries: string[],
  hasConsentMode: boolean,
  hasTcf: boolean,
): Jurisdiction {
  const hostname = new URL(url).hostname.toLowerCase();

  // .gov and .mil are ALWAYS US government — no override
  if (/\.(gov|mil)$/i.test(hostname)) {
    return 'us_only';
  }

  // .us and .pr TLDs — US-only unless there's unambiguous EU hreflang
  if (/\.us$/i.test(hostname) || /\.pr$/i.test(hostname)) {
    if (!hasEuHreflangSignal(hreflangEntries)) return 'us_only';
  }

  // Check for EU ccTLD (strongest signal)
  const tldParts = hostname.split('.');
  const tld = tldParts[tldParts.length - 1]!;
  const secondLevel = tldParts.length >= 3 ? tldParts[tldParts.length - 2]! : null;
  // Handle .co.uk style TLDs
  if (EU_CCTLDS.has(tld) || (secondLevel && EU_CCTLDS.has(secondLevel))) {
    return 'eu_facing';
  }

  // Check for unambiguous EU hreflang entries
  if (hasEuHreflangSignal(hreflangEntries)) return 'eu_facing';

  // TCF framework presence is a definitive EU signal
  if (hasTcf) return 'eu_facing';

  // Consent Mode v2 active suggests EU targeting (companies don't implement it for fun)
  if (hasConsentMode) return 'eu_facing';

  // .com, .org, .io etc. with no EU signals — can't determine definitively
  return 'indeterminate';
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const nc = ctx.networkCollector;

  if (!page) {
    return { moduleId: 'M12' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  const baseUrl = new URL(ctx.url);

  // ─── Step 1: Detect legal pages & consent elements ─────────────────────
  const legalData = await page.evaluate(() => {
    // Use object method pattern throughout to avoid esbuild __name injection
    // which causes "ReferenceError: __name is not defined" in page.evaluate().
    const helpers = {
      // ── Deep link collector: traverses Shadow DOM (Web Components) ──
      // AEM Edge Delivery, Salesforce Lightning, Shoelace, etc. render footer/nav
      // inside shadow roots that document.querySelectorAll cannot pierce.
      collectAllLinks(): HTMLAnchorElement[] {
        const result: HTMLAnchorElement[] = [];
        const q = [document as Document | ShadowRoot];
        while (q.length > 0) {
          const root = q.pop()!;
          result.push(...Array.from(root.querySelectorAll('a[href]')) as HTMLAnchorElement[]);
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) q.push(el.shadowRoot);
          }
        }
        return result;
      },

      // Extract visible text from a link — handles slotted content in Web Components
      // where textContent from the shadow root side returns empty string.
      getLinkText(link: HTMLAnchorElement): string {
        const direct = (link.textContent ?? '').trim();
        if (direct) return direct;
        // Shadow DOM slotted content: check assigned nodes of <slot> children
        for (const child of link.querySelectorAll('slot')) {
          const assigned = (child as HTMLSlotElement).assignedNodes({ flatten: true });
          const slotText = assigned.map(n => n.textContent ?? '').join('').trim();
          if (slotText) return slotText;
        }
        // Last resort: aria-label or title attribute
        return link.getAttribute('aria-label') ?? link.getAttribute('title') ?? '';
      },

      // Prioritized link search: first check text-only matches (stronger signal),
      // then text+href matches to avoid false positives from URLs that happen to
      // contain the keyword (e.g. /privacy-security/... matching as privacy policy).
      findLink(textPatterns: RegExp[], hrefPatterns?: RegExp[]): { found: boolean; href: string | null; text: string | null } {
        // Pass 1: Match on link TEXT only (strongest signal — the visible label matters)
        for (const link of links) {
          const text = helpers.getLinkText(link).toLowerCase();
          for (const pat of textPatterns) {
            if (pat.test(text)) {
              return { found: true, href: link.href, text: helpers.getLinkText(link).slice(0, 80) };
            }
          }
        }
        // Pass 2: Match on link HREF for URL path patterns
        const hrefPats = hrefPatterns ?? textPatterns;
        for (const link of links) {
          const href = link.href.toLowerCase();
          for (const pat of hrefPats) {
            if (pat.test(href)) {
              return { found: true, href: link.href, text: helpers.getLinkText(link).slice(0, 80) || href };
            }
          }
        }
        return { found: false, href: null, text: null };
      },
    };

    const links = helpers.collectAllLinks();

    // Privacy: text patterns (visible labels), then href patterns (URL paths)
    const privacyPolicy = helpers.findLink(
      [/privacy\s*(policy|notice|statement)/i, /\bprivacy\b/i, /datenschutz/i, /privacidad/i],
      [/\/privacy[-_]?policy/i, /\/privacy[-_]?notice/i, /\/privacy\/?$/i, /datenschutz/i],
    );
    const termsOfService = helpers.findLink(
      [/terms\s+(of\s+)?(service|use)/i, /terms\s+(&|and)\s+conditions/i, /\btos\b/i, /nutzungsbedingungen/i, /legal[- ]?(disclaimer|stuff|notice)/i, /eula/i, /acceptable[- ]?use/i],
      [/\/terms[-_]?(of[-_]?service|of[-_]?use)?/i, /\/legal[-_]?disclaimer/i, /\/tos\/?$/i, /\/eula\/?$/i],
    );
    const cookiePolicy = helpers.findLink(
      [/cookie[- ]?policy/i, /cookie[- ]?notice/i, /\bcookies?\b/i],
      [/\/cookie[-_]?policy/i, /\/cookie[-_]?notice/i, /\/cookies?\/?$/i],
    );
    // CCPA: specific legal language only — "Do Not Sell" / "Your Privacy Choices"
    // NOT generic "opt-out" (which matches DAA AdChoices, newsletter unsubscribes, etc.)
    const ccpaOptOut = helpers.findLink(
      [/do[- ]?not[- ]?sell/i, /your[- ]?privacy[- ]?choices/i, /ccpa/i],
      [/do[- ]?not[- ]?sell/i, /privacy[- ]?choices/i, /ccpa[- ]?opt/i],
    );
    const dsarLink = helpers.findLink([/data[- ]?subject/i, /dsar/i, /data[- ]?request/i, /my[- ]?data/i]);

    // Cookie consent banner detection — layered approach:
    // 1. Visible banner in DOM (strongest evidence, can inspect reject/granular)
    // 2. Hidden banner element in DOM (user already consented, banner dismissed)
    // 3. Consent platform script detected (banner lazy-loaded from CDN)
    const bannerSelectors = [
      // Major CMPs
      '#onetrust-banner-sdk', '#CybotCookiebotDialog', '.cc-banner',
      '#cookie-law-info-bar', '.evidon-consent-button', '#gdpr-cookie-notice',
      '.qc-cmp2-summary-buttons',
      // HubSpot
      '#hs-eu-cookie-confirmation', '[id*="hs-eu-cookie"]', '[class*="hs-cookie"]',
      // Other major CMPs
      '#truste-consent-track', '#didomi-popup', '.osano-cm-dialog',
      '#iubenda-cs-banner', '#uc-center-container', '#termly-code-snippet-support',
      '#cmplz-cookiebanner-container',
      // Generic
      '#consent-banner', '.cookie-consent', '.cookie-banner',
      '[class*="cookie-consent"]', '[class*="cookie-banner"]',
      '[class*="consent-banner"]', '[id*="cookie-consent"]', '[id*="cookie-banner"]',
    ];

    // Provider mapping: selector substring → provider name
    const providerKeys: Array<[string, string]> = [
      ['onetrust', 'OneTrust'], ['Cookiebot', 'Cookiebot'],
      ['cc-banner', 'CookieConsent'], ['cookie-law-info', 'GDPR Cookie Compliance'],
      ['evidon', 'Evidon/Crownpeak'], ['qc-cmp2', 'Quantcast'],
      ['hs-eu-cookie', 'HubSpot'], ['hs-cookie', 'HubSpot'],
      ['truste', 'TrustArc'], ['didomi', 'Didomi'], ['osano', 'Osano'],
      ['iubenda', 'Iubenda'], ['uc-center', 'Usercentrics'],
      ['termly', 'Termly'], ['cmplz', 'Complianz'],
    ];

    let consentBanner: {
      found: boolean; provider: string | null; hasReject: boolean; hasGranular: boolean;
      detectionSource: 'visible_banner' | 'hidden_element' | 'consent_script' | 'network' | null;
    } = {
      found: false, provider: null, hasReject: false, hasGranular: false, detectionSource: null,
    };

    // Layer 1: Visible banner in DOM
    for (const sel of bannerSelectors) {
      const el = document.querySelector(sel);
      if (el && (el as HTMLElement).offsetHeight > 0) {
        let provider: string | null = null;
        for (const [key, name] of providerKeys) {
          if (sel.includes(key)) { provider = name; break; }
        }

        const rejectPatterns = ['reject', 'decline', 'deny', 'refuse', 'no thanks', 'only essential', 'necessary only'];
        const buttons = Array.from(el.querySelectorAll('button, a[role="button"], [class*="btn"]'));
        const hasReject = buttons.some(b => {
          const txt = (b.textContent ?? '').toLowerCase();
          return rejectPatterns.some(p => txt.includes(p));
        });

        const hasGranular = !!el.querySelector(
          'input[type="checkbox"], [class*="toggle"], [class*="category"], [class*="preference"]'
        );

        consentBanner = { found: true, provider, hasReject, hasGranular, detectionSource: 'visible_banner' };
        break;
      }
    }

    // Layer 2: Hidden banner element (user already consented, banner dismissed)
    if (!consentBanner.found) {
      for (const sel of bannerSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          let provider: string | null = null;
          for (const [key, name] of providerKeys) {
            if (sel.includes(key)) { provider = name; break; }
          }
          consentBanner = { found: true, provider, hasReject: false, hasGranular: false, detectionSource: 'hidden_element' };
          break;
        }
      }
    }

    // Layer 3: Consent platform script tags (banner lazy-loaded from CDN)
    if (!consentBanner.found) {
      const scriptPatterns: Array<[RegExp, string]> = [
        [/js\.hs-banner\.com|\/hs-banner\b/i, 'HubSpot'],
        [/cdn\.cookielaw\.org|optanon|onetrust/i, 'OneTrust'],
        [/consent\.cookiebot\.com|cookiebot/i, 'Cookiebot'],
        [/cdn\.privacy-mgmt\.com|sourcepoint/i, 'Sourcepoint'],
        [/quantcast.*choice|quantcast.*cmp/i, 'Quantcast'],
        [/didomi/i, 'Didomi'], [/osano/i, 'Osano'],
        [/iubenda/i, 'Iubenda'], [/usercentrics/i, 'Usercentrics'],
        [/app\.termly/i, 'Termly'], [/trustarc|truste/i, 'TrustArc'],
        [/cassiecloud\.com|cassie-loader/i, 'Cassie'],
        [/consentmanager\.net/i, 'consentmanager'],
        [/secureprivacy\.ai/i, 'Secure Privacy'],
      ];
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      for (const s of scripts) {
        const src = (s as HTMLScriptElement).src;
        for (const [pattern, name] of scriptPatterns) {
          if (pattern.test(src)) {
            consentBanner = { found: true, provider: name, hasReject: false, hasGranular: false, detectionSource: 'consent_script' };
            break;
          }
        }
        if (consentBanner.found) break;
      }
    }

    // ── Google Consent Mode detection (multi-layer) ──
    const w = window as unknown as Record<string, unknown>;
    const dataLayer = w['dataLayer'] as Array<Record<string, unknown>> | undefined;
    let hasConsentMode = false;

    // Layer 1: dataLayer consent entries (gtag-based sites)
    if (Array.isArray(dataLayer)) {
      hasConsentMode = dataLayer.some(entry =>
        (Array.isArray(entry) && entry[0] === 'consent') ||
        entry['event'] === 'consent_update'
      );
    }

    // Layer 2: Google's internal consent state (google_tag_data.ics)
    if (!hasConsentMode) {
      const gtd = w['google_tag_data'] as Record<string, unknown> | undefined;
      if (gtd?.['ics']) {
        const ics = gtd['ics'] as Record<string, unknown>;
        if (ics['entries'] || ics['default'] || ics['wasSetLate'] != null) {
          hasConsentMode = true;
        }
      }
    }

    // Layer 3: Consent Mode v2 state cookies (exact name match via parsed cookie names)
    if (!hasConsentMode) {
      const CONSENT_MODE_COOKIES = new Set([
        'ad_storage', 'analytics_storage', 'personalization_storage',
        'functionality_storage', 'security_storage',
        'ad_user_data', 'ad_personalization',
      ]);
      let cookieStr = '';
      try { cookieStr = document.cookie; } catch { /* SecurityError on strict CSP sites */ }
      const cookieNames = cookieStr.split(';').map(c => c.trim().split('=')[0]!);
      if (cookieNames.some(name => CONSENT_MODE_COOKIES.has(name))) {
        hasConsentMode = true;
      }
    }

    // Regulatory notices (banking/finance + healthcare compliance)
    const bodyText = document.body?.textContent ?? '';
    const regulatoryNotices: string[] = [];

    // ── Banking/Finance ──
    if (/member\s+fdic|miembro\s+fdic/i.test(bodyText)) regulatoryNotices.push('FDIC Member');
    if (/ncua/i.test(bodyText)) regulatoryNotices.push('NCUA');
    if (/equal\s+housing\s+(lender|opportunity)/i.test(bodyText)) regulatoryNotices.push('Equal Housing');
    if (/nmls\s*#?\s*\d+/i.test(bodyText)) {
      const nmlsMatch = bodyText.match(/nmls\s*#?\s*(\d+)/i);
      regulatoryNotices.push(`NMLS #${nmlsMatch?.[1] ?? ''}`);
    }
    if (/finra/i.test(bodyText) || /sipc/i.test(bodyText)) regulatoryNotices.push('FINRA/SIPC');
    if (/sec\s+registered/i.test(bodyText)) regulatoryNotices.push('SEC Registered');

    // ── Healthcare ──
    // HIPAA Notice of Privacy Practices (required for all covered entities)
    const hipaaLink = helpers.findLink(
      [/notice\s+of\s+privacy\s+practices/i, /hipaa\s+(notice|privacy)/i],
      [/\/hipaa/i, /\/notice[-_]?of[-_]?privacy/i, /\/privacy[-_]?practices/i],
    );
    if (hipaaLink.found) regulatoryNotices.push('HIPAA Notice of Privacy Practices');

    // Non-Discrimination Notice (ACA Section 1557 — required for healthcare providers)
    const nonDiscrimText = bodyText.toLowerCase();
    if (/non[-\s]?discrimination/i.test(nonDiscrimText) && (/title\s+vi/i.test(nonDiscrimText) || /civil\s+rights/i.test(nonDiscrimText) || /section\s+1557/i.test(nonDiscrimText))) {
      regulatoryNotices.push('Non-Discrimination Notice');
    } else {
      const nonDiscrimLink = helpers.findLink(
        [/non[-\s]?discrimination/i],
        [/\/non[-_]?discrimination/i, /\/public[-_]?notices/i, /\/civil[-_]?rights/i],
      );
      if (nonDiscrimLink.found) regulatoryNotices.push('Non-Discrimination Notice');
    }

    // Joint Commission accreditation
    if (/joint\s+commission/i.test(bodyText)) regulatoryNotices.push('Joint Commission');

    // Patient Rights
    const patientRightsLink = helpers.findLink(
      [/patient['']?s?\s+rights/i, /bill\s+of\s+rights/i],
      [/\/patient[-_]?rights/i],
    );
    if (patientRightsLink.found) regulatoryNotices.push('Patient Rights');

    // Hill-Burton (free/reduced-cost care — required for qualifying hospitals)
    if (/hill[-\s]?burton/i.test(bodyText)) regulatoryNotices.push('Hill-Burton');

    // HITECH Act reference
    if (/hitech\s+act/i.test(bodyText)) regulatoryNotices.push('HITECH Act');

    // Health Information Exchange notice
    const hieLink = helpers.findLink(
      [/health\s+information\s+exchange/i],
      [/\/health[-_]?information[-_]?exchange/i],
    );
    if (hieLink.found) regulatoryNotices.push('Health Information Exchange');

    // ADA/Accessibility statement (Section 508 compliance — important for banks)
    const accessibilityLink = helpers.findLink(
      [/accessibility/i],
      [/\/accessibility/i],
    );

    return {
      privacyPolicy,
      termsOfService,
      cookiePolicy,
      ccpaOptOut,
      dsarLink,
      consentBanner,
      hasConsentMode,
      regulatoryNotices,
      accessibilityLink,
    };
  });

  // ─── Layer 4: Network-based consent detection ───────────────────────
  // If page.evaluate didn't find a consent banner, check network requests
  if (!legalData.consentBanner.found && nc) {
    const consentNetPatterns: Array<[RegExp, string]> = [
      [/js\.hs-banner\.com|hs-banner/i, 'HubSpot'],
      [/cdn\.cookielaw\.org|onetrust/i, 'OneTrust'],
      [/cookiebot\.com/i, 'Cookiebot'],
      [/privacy-mgmt\.com|sourcepoint/i, 'Sourcepoint'],
      [/cmp\.quantcast/i, 'Quantcast'],
      [/didomi/i, 'Didomi'], [/osano/i, 'Osano'],
      [/iubenda/i, 'Iubenda'], [/usercentrics/i, 'Usercentrics'],
      [/termly/i, 'Termly'], [/trustarc|truste/i, 'TrustArc'],
      [/cassiecloud\.com/i, 'Cassie'],
      [/consentmanager\.net/i, 'consentmanager'],
      [/secureprivacy\.ai/i, 'Secure Privacy'],
    ];
    const allReqs = nc.getAllRequests();
    for (const req of allReqs) {
      for (const [pattern, name] of consentNetPatterns) {
        if (pattern.test(req.url)) {
          legalData.consentBanner = { found: true, provider: name, hasReject: false, hasGranular: false, detectionSource: 'network' };
          break;
        }
      }
      if (legalData.consentBanner.found) break;
    }
  }

  // ─── Layer 5: Cross-reference M08 consent data (DRY) ──────────────
  if (!legalData.consentBanner.found) {
    const m08 = ctx.previousResults?.get('M08' as ModuleId);
    if (m08?.status === 'success' && m08.data) {
      const m08Data = m08.data as Record<string, unknown>;
      const consent = m08Data.consent as { hasConsentBanner?: boolean; consentScripts?: string[] } | undefined;
      if (consent?.hasConsentBanner) {
        const scriptUrl = consent.consentScripts?.[0] ?? '';
        let provider: string | null = null;
        if (/hs-banner/i.test(scriptUrl)) provider = 'HubSpot';
        else if (/onetrust|cookielaw/i.test(scriptUrl)) provider = 'OneTrust';
        else if (/cookiebot/i.test(scriptUrl)) provider = 'Cookiebot';
        legalData.consentBanner = { found: true, provider, hasReject: false, hasGranular: false, detectionSource: 'network' };
      }
    }
  }

  data.legal = legalData;

  // ─── Jurisdiction detection ─────────────────────────────────────────────
  // Determine whether the site is EU-facing (consent required by GDPR) or
  // US-only (consent recommended but not legally mandated at federal level).
  // This controls the severity of consent-related checkpoints (CP3, CP4).
  let hreflangCodes: string[] = [];
  const m04 = ctx.previousResults?.get('M04' as ModuleId);
  if (m04?.status === 'success' && m04.data) {
    const m04Data = m04.data as Record<string, unknown>;
    const hreflang = m04Data.hreflang as Array<{ lang: string }> | undefined;
    if (Array.isArray(hreflang)) {
      hreflangCodes = hreflang.map(h => h.lang);
    }
  }

  // TCF detection: check for __tcfapi global (IAB Transparency & Consent Framework)
  let hasTcf = false;
  try {
    hasTcf = await page.evaluate(() => typeof (window as unknown as Record<string, unknown>)['__tcfapi'] === 'function');
  } catch { /* page may be gone */ }

  const jurisdiction = detectJurisdiction(ctx.url, hreflangCodes, legalData.hasConsentMode, hasTcf);
  data.jurisdiction = jurisdiction;
  data.hasTcf = hasTcf;

  // ─── Step 2: Security headers ──────────────────────────────────────────
  const headers = ctx.headers;

  const hsts = headers['strict-transport-security'] ?? null;
  const csp = headers['content-security-policy'] ?? null;
  const xFrameOptions = headers['x-frame-options'] ?? null;
  const xContentType = headers['x-content-type-options'] ?? null;

  let hstsMaxAge = 0;
  let hstsIncludesSub = false;
  let hstsPreload = false;
  if (hsts) {
    const maxAgeMatch = hsts.match(/max-age=(\d+)/);
    if (maxAgeMatch?.[1]) hstsMaxAge = parseInt(maxAgeMatch[1]);
    hstsIncludesSub = /includeSubDomains/i.test(hsts);
    hstsPreload = /preload/i.test(hsts);
  }

  // Parse CSP directives — differentiate unsafe-inline in style-src vs script-src
  let cspHasUnsafeInline = false;  // unsafe-inline in script-src (or default-src fallback)
  let cspHasUnsafeInlineStyleOnly = false; // unsafe-inline ONLY in style-src (acceptable)
  let cspHasUnsafeEval = false;
  let cspHasReportUri = false;
  let cspHasScriptSrc = false;
  let cspHasDefaultSrc = false;
  let cspIsFrameOnly = false;
  let cspHasNonce = false;
  if (csp) {
    const directives = csp.split(';').map(d => d.trim().toLowerCase());
    const scriptSrc = directives.find(d => d.startsWith('script-src'));
    const styleSrc = directives.find(d => d.startsWith('style-src'));
    const defaultSrc = directives.find(d => d.startsWith('default-src'));
    // unsafe-inline in script-src is a real problem; in style-src it's common/acceptable
    const unsafeInlineInScript = scriptSrc?.includes("'unsafe-inline'")
      ?? (!scriptSrc && defaultSrc?.includes("'unsafe-inline'"));
    cspHasUnsafeInline = unsafeInlineInScript ?? false;
    cspHasUnsafeInlineStyleOnly = !cspHasUnsafeInline && (styleSrc?.includes("'unsafe-inline'") ?? false);
    cspHasNonce = scriptSrc?.includes("'nonce-") ?? false;
    cspHasUnsafeEval = scriptSrc?.includes("'unsafe-eval'")
      ?? (!scriptSrc && defaultSrc?.includes("'unsafe-eval'"))
      ?? false;
    cspHasReportUri = /report-(uri|to)/i.test(csp);
    cspHasScriptSrc = !!scriptSrc;
    cspHasDefaultSrc = !!defaultSrc;
    // frame-ancestors only = clickjacking protection but NO script protection
    // PCI DSS 4.0 Req 11.6.1 specifically requires script-src controls
    cspIsFrameOnly = /frame-ancestors/i.test(csp) && !cspHasScriptSrc && !cspHasDefaultSrc;
  }

  data.securityHeaders = {
    hsts, hstsMaxAge, hstsIncludesSub, hstsPreload,
    csp: csp ? csp.slice(0, 500) : null,
    cspHasUnsafeInline, cspHasUnsafeInlineStyleOnly, cspHasUnsafeEval, cspHasReportUri,
    cspHasScriptSrc, cspHasDefaultSrc, cspIsFrameOnly, cspHasNonce,
    xFrameOptions, xContentType,
  };

  // ─── Step 3: Cookie security audit ─────────────────────────────────────
  const cookies = await page.context().cookies();
  const cookieAudit = {
    total: cookies.length,
    secure: cookies.filter(c => c.secure).length,
    httpOnly: cookies.filter(c => c.httpOnly).length,
    sameSite: cookies.filter(c => c.sameSite === 'Strict' || c.sameSite === 'Lax').length,
    thirdParty: cookies.filter(c => !c.domain.includes(baseUrl.hostname.replace('www.', ''))).length,
  };

  data.cookies = cookieAudit;

  // ─── Step 4: SRI coverage on third-party scripts ───────────────────────
  const sriData = await page.evaluate((hostname: string) => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    let thirdPartyScripts = 0;
    let withSri = 0;

    for (const script of scripts) {
      const src = (script as HTMLScriptElement).src;
      try {
        const scriptHost = new URL(src).hostname;
        if (!scriptHost.includes(hostname.replace('www.', ''))) {
          thirdPartyScripts++;
          if (script.hasAttribute('integrity')) {
            withSri++;
          }
        }
      } catch { /* invalid URL */ }
    }

    return { thirdPartyScripts, withSri };
  }, baseUrl.hostname);

  data.sri = sriData;

  // ─── Step 5: Check for pre-consent tracking ────────────────────────────
  let preConsentTracking: string[] = [];
  let firstPartyTracking: string[] = [];
  if (nc) {
    const baseDomain = baseUrl.hostname.replace(/^www\./, '');
    const allRequests = nc.getAllRequests();
    const trackingRequests = allRequests.filter(r => r.category === 'analytics' || r.category === 'advertising');
    const allDomains = trackingRequests.map(r => {
      try { return new URL(r.url).hostname; } catch { return r.url.slice(0, 60); }
    });
    const uniqueDomains = [...new Set(allDomains)];
    // Separate first-party vs third-party tracking
    preConsentTracking = uniqueDomains.filter(d => !d.includes(baseDomain)).slice(0, 15);
    firstPartyTracking = uniqueDomains.filter(d => d.includes(baseDomain)).slice(0, 10);
  }
  data.preConsentTracking = preConsentTracking;
  data.firstPartyTracking = firstPartyTracking;

  // ─── Step 6: Probe security.txt ────────────────────────────────────────
  let hasSecurityTxt = false;
  try {
    const secUrl = `${baseUrl.origin}/.well-known/security.txt`;
    const secResult = await probeUrl(secUrl, 5000);
    hasSecurityTxt = secResult.exists;
  } catch { /* */ }
  data.hasSecurityTxt = hasSecurityTxt;

  // ─── Signals ───────────────────────────────────────────────────────────
  if (legalData.consentBanner.found && legalData.consentBanner.provider) {
    signals.push(createSignal({
      type: 'consent_platform', name: legalData.consentBanner.provider,
      confidence: 0.9, evidence: `Consent banner: ${legalData.consentBanner.provider}`,
      category: 'compliance',
    }));
  }

  if (preConsentTracking.length > 0) {
    signals.push(createSignal({
      type: 'pre_consent_tracking', name: 'Pre-consent pixels',
      confidence: 0.85, evidence: `Third-party tracking before consent: ${preConsentTracking.slice(0, 5).join(', ')}`,
      category: 'compliance',
    }));
  }

  // ─── Checkpoints ───────────────────────────────────────────────────────

  // CP1: Privacy policy
  {
    checkpoints.push(createCheckpoint({
      id: 'm12-privacy-policy', name: 'Privacy Policy', weight: 0.9,
      health: legalData.privacyPolicy.found ? 'excellent' : 'critical',
      evidence: legalData.privacyPolicy.found
        ? `Privacy policy found: "${legalData.privacyPolicy.text}"`
        : 'No privacy policy link detected — may violate GDPR/CCPA requirements',
      recommendation: legalData.privacyPolicy.found ? undefined : 'Add a clearly visible privacy policy link in the footer.',
    }));
  }

  // CP2: Terms of service
  {
    checkpoints.push(createCheckpoint({
      id: 'm12-terms', name: 'Terms of Service', weight: 0.5,
      health: legalData.termsOfService.found ? 'excellent' : 'warning',
      evidence: legalData.termsOfService.found
        ? `Terms of service found: "${legalData.termsOfService.text}"`
        : 'No terms of service link detected',
    }));
  }

  // CP3: Cookie consent banner (jurisdiction-aware)
  {
    const cb = legalData.consentBanner;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (cb.found && cb.detectionSource === 'visible_banner') {
      // Banner visible in DOM — can inspect quality
      if (cb.hasReject && cb.hasGranular) {
        health = 'excellent';
        evidence = `Cookie consent banner with reject option and granular categories${cb.provider ? ` (${cb.provider})` : ''}`;
      } else if (cb.hasReject) {
        health = 'good';
        evidence = `Cookie consent banner with reject option${cb.provider ? ` (${cb.provider})` : ''}`;
      } else {
        health = 'warning';
        evidence = `Cookie consent banner present but no reject/decline option${cb.provider ? ` (${cb.provider})` : ''} — may not satisfy GDPR`;
      }
    } else if (cb.found) {
      // Consent platform detected via hidden element, script tag, or network request
      const sourceLabel = cb.detectionSource === 'hidden_element'
        ? 'banner dismissed (user previously consented)'
        : cb.detectionSource === 'consent_script'
          ? 'consent script loaded'
          : 'consent platform detected via network';
      health = 'good';
      evidence = `Consent platform active${cb.provider ? ` (${cb.provider})` : ''} — ${sourceLabel}`;
    } else {
      // Not found at all — severity depends on jurisdiction + whether tracking is present
      const hasTracking = nc ? nc.getAnalyticsRequests().length > 0 || nc.getAdvertisingRequests().length > 0 : false;
      if (hasTracking) {
        if (jurisdiction === 'eu_facing') {
          // EU-facing: consent required by GDPR before any tracking
          health = 'critical';
          evidence = 'No cookie consent banner but tracking scripts are present — GDPR requires prior consent for EU users';
          recommendation = 'Implement a consent management platform (OneTrust, Cookiebot) that blocks tracking until user consents.';
        } else if (jurisdiction === 'us_only') {
          // US-only: no federal consent requirement, but CCPA/state laws recommend transparency
          health = 'good';
          evidence = 'No cookie consent banner detected (US-only site — no federal consent requirement, tracking present)';
          recommendation = 'Consider adding a consent banner for CCPA/state privacy law compliance and user trust.';
        } else {
          // Indeterminate (.com, .org, etc.): treat as warning — can't confirm no EU users
          health = 'warning';
          evidence = 'No cookie consent banner but tracking scripts are present — consent recommended';
          recommendation = 'Add a consent management platform if the site serves EU visitors (GDPR) or California residents (CCPA).';
        }
      } else {
        health = 'good';
        evidence = 'No cookie consent banner (no tracking detected, may not be required)';
      }
    }

    checkpoints.push(createCheckpoint({ id: 'm12-consent-banner', name: 'Cookie Consent Banner', weight: 0.9, health, evidence, recommendation }));
  }

  // CP4: Pre-consent tracking (jurisdiction-aware)
  {
    const cb = legalData.consentBanner;
    if (!cb.found && preConsentTracking.length === 0) {
      checkpoints.push(infoCheckpoint('m12-pre-consent', 'Pre-Consent Tracking', 'No consent banner and no tracking — pre-consent check not applicable'));
    } else if (!cb.found && preConsentTracking.length > 0) {
      // No consent mechanism detected but tracking IS present — severity depends on jurisdiction
      if (jurisdiction === 'eu_facing') {
        checkpoints.push(createCheckpoint({
          id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
          health: 'critical',
          evidence: `${preConsentTracking.length} third-party tracking domain(s) active with no consent mechanism: ${preConsentTracking.slice(0, 5).join(', ')}`,
          recommendation: 'GDPR requires consent before tracking EU users. Implement a CMP that blocks tracking until consent is granted.',
        }));
      } else if (jurisdiction === 'us_only') {
        checkpoints.push(createCheckpoint({
          id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
          health: 'good',
          evidence: `${preConsentTracking.length} third-party tracking domain(s) active (US-only site — no federal pre-consent requirement): ${preConsentTracking.slice(0, 5).join(', ')}`,
          recommendation: 'Consider opt-out mechanisms for CCPA compliance if serving California residents.',
        }));
      } else {
        checkpoints.push(createCheckpoint({
          id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
          health: 'warning',
          evidence: `${preConsentTracking.length} third-party tracking domain(s) active with no consent mechanism: ${preConsentTracking.slice(0, 5).join(', ')}`,
          recommendation: 'Implement a consent management platform before loading tracking scripts, especially if serving EU visitors.',
        }));
      }
    } else if (cb.found && cb.detectionSource !== 'visible_banner') {
      // Consent platform exists but banner wasn't visible — can't verify pre-consent behavior
      checkpoints.push(createCheckpoint({
        id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
        health: preConsentTracking.length > 0 ? 'good' : 'excellent',
        evidence: preConsentTracking.length > 0
          ? `${preConsentTracking.length} tracking domain(s) active; consent platform detected but banner not visible (may have been pre-consented)`
          : 'No tracking pixels detected; consent platform present',
      }));
    } else if (preConsentTracking.length === 0) {
      checkpoints.push(createCheckpoint({
        id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
        health: 'excellent', evidence: 'No tracking pixels detected before consent interaction',
      }));
    } else {
      // Consent banner is visible but tracking fires before interaction
      const majorTrackers = preConsentTracking.filter(d =>
        d.includes('google-analytics') || d.includes('analytics.google') ||
        d.includes('facebook') || d.includes('connect.facebook') || d.includes('doubleclick') ||
        d.includes('licdn') || d.includes('ads-twitter') || d.includes('bat.bing') ||
        d.includes('tiktok') || d.includes('pinterest')
      );

      if (jurisdiction === 'eu_facing') {
        checkpoints.push(createCheckpoint({
          id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
          health: majorTrackers.length > 0 ? 'critical' : 'warning',
          evidence: `${preConsentTracking.length} third-party tracking domain(s) fire before consent: ${preConsentTracking.slice(0, 5).join(', ')}`,
          recommendation: 'GDPR requires no tracking before consent. Ensure the CMP blocks all third-party scripts until the user opts in.',
        }));
      } else if (jurisdiction === 'us_only') {
        // US-only: pre-consent tracking with a banner present is common and generally acceptable
        checkpoints.push(createCheckpoint({
          id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
          health: 'good',
          evidence: `${preConsentTracking.length} third-party tracking domain(s) active (US-only — consent banner present, opt-out model is standard): ${preConsentTracking.slice(0, 5).join(', ')}`,
        }));
      } else {
        checkpoints.push(createCheckpoint({
          id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
          health: majorTrackers.length > 0 ? 'warning' : 'good',
          evidence: `${preConsentTracking.length} third-party tracking domain(s) fire before consent: ${preConsentTracking.slice(0, 5).join(', ')}`,
          recommendation: 'Ensure no third-party analytics or advertising scripts fire before the user provides consent if serving EU visitors.',
        }));
      }
    }
  }

  // CP5: HSTS
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (hstsMaxAge >= 31536000 && hstsIncludesSub && hstsPreload) {
      health = 'excellent';
      evidence = `HSTS: max-age=${hstsMaxAge} (>1yr), includeSubDomains, preload`;
    } else if (hstsMaxAge >= 15768000) {
      health = 'good';
      evidence = `HSTS: max-age=${hstsMaxAge}${hstsIncludesSub ? ', includeSubDomains' : ''}${hstsPreload ? ', preload' : ''}`;
    } else if (hsts) {
      health = 'warning';
      evidence = `HSTS: max-age=${hstsMaxAge} (too short, recommend >1 year)`;
    } else {
      health = 'warning';
      evidence = 'No HSTS header — browsers can be downgraded from HTTPS to HTTP';
      // Not 'critical' because not all sites use HTTPS
    }

    checkpoints.push(createCheckpoint({ id: 'm12-hsts', name: 'HSTS Configuration', weight: 0.6, health, evidence }));
  }

  // CP6: CSP
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (csp && !cspHasUnsafeInline && !cspHasUnsafeEval && cspHasScriptSrc && cspHasReportUri) {
      health = 'excellent';
      evidence = 'Content Security Policy is strict with script-src controls and reporting enabled';
      if (cspHasNonce) evidence += ' (nonce-based)';
    } else if (csp && cspHasNonce && !cspHasUnsafeEval && cspHasScriptSrc) {
      // Nonce-based script-src is PCI DSS 4.0 compliant even if style-src has unsafe-inline
      health = cspHasReportUri ? 'excellent' : 'good';
      evidence = 'CSP uses nonce-based script-src' + (cspHasReportUri ? ' with reporting' : '');
      if (cspHasUnsafeInlineStyleOnly) evidence += ' (style-src has unsafe-inline — acceptable)';
    } else if (csp && !cspHasUnsafeInline && !cspHasUnsafeEval && (cspHasScriptSrc || cspHasDefaultSrc)) {
      health = 'good';
      evidence = 'Content Security Policy with script source controls';
      if (cspHasUnsafeInlineStyleOnly) evidence += ' (style-src has unsafe-inline — acceptable)';
    } else if (cspIsFrameOnly) {
      health = 'warning';
      evidence = 'CSP only has frame-ancestors (clickjacking protection) — no script-src or default-src directive to prevent XSS';
      recommendation = 'Add script-src directive to CSP to control which scripts can execute. Required by PCI DSS 4.0 Req 11.6.1 for payment-handling sites.';
    } else if (csp && (cspHasUnsafeInline || cspHasUnsafeEval)) {
      health = 'warning';
      evidence = `CSP present but has ${[cspHasUnsafeInline ? "'unsafe-inline' in script-src" : '', cspHasUnsafeEval ? "'unsafe-eval'" : ''].filter(Boolean).join(' and ')}`;
    } else if (csp) {
      health = 'good';
      evidence = 'Content Security Policy present without unsafe directives';
    } else {
      health = 'warning';
      evidence = 'No Content Security Policy header — site vulnerable to XSS attacks';
      recommendation = 'Add a Content Security Policy header with at minimum default-src and script-src directives.';
    }

    checkpoints.push(createCheckpoint({ id: 'm12-csp', name: 'Content Security Policy', weight: 0.6, health, evidence, recommendation }));
  }

  // CP7: SRI coverage (PCI DSS 4.0 Req 6.4.3 requires SRI for externally-sourced scripts)
  {
    const sri = sriData;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (sri.thirdPartyScripts === 0) {
      health = 'good';
      evidence = 'No third-party scripts to audit for SRI';
    } else {
      const ratio = sri.withSri / sri.thirdPartyScripts;
      if (ratio >= 0.8) {
        health = 'excellent';
        evidence = `SRI on ${sri.withSri}/${sri.thirdPartyScripts} third-party scripts (${Math.round(ratio * 100)}%)`;
      } else if (ratio >= 0.5) {
        health = 'good';
        evidence = `SRI on ${sri.withSri}/${sri.thirdPartyScripts} third-party scripts`;
      } else {
        health = 'warning';
        evidence = `${sri.withSri}/${sri.thirdPartyScripts} third-party scripts have SRI — supply chain risk`;
        recommendation = 'Add integrity attributes to all third-party script tags. PCI DSS 4.0 Req 6.4.3 requires integrity verification for all externally-sourced scripts on payment pages.';
      }
    }

    checkpoints.push(createCheckpoint({ id: 'm12-sri', name: 'Subresource Integrity', weight: 0.5, health, evidence, recommendation }));
  }

  // CP8: Cookie security flags
  {
    const c = cookieAudit;
    let health: CheckpointHealth;
    let evidence: string;

    if (c.total === 0) {
      health = 'good';
      evidence = 'No cookies to audit';
    } else {
      const secureRatio = c.secure / c.total;
      const httpOnlyRatio = c.httpOnly / c.total;
      const avgSecurity = (secureRatio + httpOnlyRatio) / 2;

      if (avgSecurity >= 0.8) {
        health = 'excellent';
        evidence = `${c.total} cookies: ${c.secure} Secure, ${c.httpOnly} HttpOnly, ${c.sameSite} SameSite`;
      } else if (avgSecurity >= 0.5) {
        health = 'good';
        evidence = `${c.total} cookies: ${c.secure} Secure, ${c.httpOnly} HttpOnly`;
      } else {
        health = 'warning';
        evidence = `${c.total} cookies: only ${c.secure} Secure, ${c.httpOnly} HttpOnly — insecure cookies can be intercepted`;
      }
    }

    checkpoints.push(createCheckpoint({ id: 'm12-cookie-flags', name: 'Cookie Security Flags', weight: 0.6, health, evidence }));
  }

  // CP9: security.txt
  {
    checkpoints.push(createCheckpoint({
      id: 'm12-security-txt', name: 'security.txt', weight: 0.3,
      health: hasSecurityTxt ? 'excellent' : 'good',
      evidence: hasSecurityTxt
        ? 'security.txt present at /.well-known/security.txt'
        : 'No security.txt — recommended for responsible disclosure',
    }));
  }

  // CP10: CCPA opt-out
  {
    if (legalData.ccpaOptOut.found) {
      checkpoints.push(createCheckpoint({
        id: 'm12-ccpa', name: 'CCPA Opt-Out', weight: 0.4,
        health: 'excellent',
        evidence: `CCPA "Do Not Sell" link found: "${legalData.ccpaOptOut.text}"`,
      }));
    } else {
      checkpoints.push(createCheckpoint({
        id: 'm12-ccpa', name: 'CCPA Opt-Out', weight: 0.4,
        health: 'good',
        evidence: 'No "Do Not Sell" / CCPA opt-out link detected (may not be required)',
      }));
    }
  }

  // CP11: Financial regulatory disclosures
  // Banks/credit unions/broker-dealers have specific notice requirements
  {
    const notices = legalData.regulatoryNotices;
    data.regulatoryNotices = notices;
    data.accessibilityLink = legalData.accessibilityLink;

    if (notices.length >= 3) {
      checkpoints.push(createCheckpoint({
        id: 'm12-regulatory', name: 'Regulatory Disclosures', weight: 0.4,
        health: 'excellent',
        evidence: `Regulatory notices: ${notices.join(', ')}`,
      }));
    } else if (notices.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm12-regulatory', name: 'Regulatory Disclosures', weight: 0.4,
        health: 'good',
        evidence: `Regulatory notices: ${notices.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint(
        'm12-regulatory', 'Regulatory Disclosures',
        'No industry regulatory notices detected (banking: FDIC, NCUA, FINRA/SIPC; healthcare: HIPAA NPP, Non-Discrimination, Joint Commission)',
      ));
    }
  }

  // CP12: Accessibility statement (ADA / Section 508)
  // Critical for financial institutions under ADA Title III and Section 508
  {
    if (legalData.accessibilityLink.found) {
      checkpoints.push(createCheckpoint({
        id: 'm12-accessibility-stmt', name: 'Accessibility Statement', weight: 0.3,
        health: 'excellent',
        evidence: `Accessibility statement/page found: "${legalData.accessibilityLink.text}"`,
      }));
    } else {
      checkpoints.push(createCheckpoint({
        id: 'm12-accessibility-stmt', name: 'Accessibility Statement', weight: 0.3,
        health: 'good',
        evidence: 'No dedicated accessibility statement page detected',
        recommendation: 'Consider adding an accessibility statement page. Required for federal agencies (Section 508), healthcare providers (Section 504 / WCAG 2.1 AA by May 2026), and strongly recommended under ADA Title III.',
      }));
    }
  }

  // CP13: Pre-Consent Storage Tracking
  // If analytics storage keys exist but no consent banner detected → potential GDPR violation
  {
    const storageTrackingTools: string[] = [];
    if (ctx.storageSnapshot) {
      const allMatches = [
        ...ctx.storageSnapshot.localStorage.sdkMatches,
        ...ctx.storageSnapshot.sessionStorage.sdkMatches,
      ];
      for (const match of allMatches) {
        if (!storageTrackingTools.includes(match.tool)) {
          storageTrackingTools.push(match.tool);
        }
      }
    }

    data.storageTrackingTools = storageTrackingTools;

    if (storageTrackingTools.length > 0 && !legalData.consentBanner.found) {
      if (jurisdiction === 'eu_facing') {
        checkpoints.push(createCheckpoint({
          id: 'm12-storage-preconsent', name: 'Pre-Consent Storage Tracking', weight: 0.8,
          health: 'critical',
          evidence: `${storageTrackingTools.length} analytics tool(s) writing to browser storage without consent mechanism: ${storageTrackingTools.join(', ')}`,
          recommendation: 'GDPR requires consent before storing tracking identifiers. Ensure your CMP blocks analytics storage writes until the user consents.',
        }));
      } else if (jurisdiction === 'us_only') {
        checkpoints.push(createCheckpoint({
          id: 'm12-storage-preconsent', name: 'Pre-Consent Storage Tracking', weight: 0.8,
          health: 'good',
          evidence: `${storageTrackingTools.length} analytics tool(s) using browser storage (US-only site — no federal consent requirement): ${storageTrackingTools.join(', ')}`,
        }));
      } else {
        checkpoints.push(createCheckpoint({
          id: 'm12-storage-preconsent', name: 'Pre-Consent Storage Tracking', weight: 0.8,
          health: 'warning',
          evidence: `${storageTrackingTools.length} analytics tool(s) writing to browser storage without consent banner: ${storageTrackingTools.join(', ')}`,
          recommendation: 'Consider implementing a consent mechanism before analytics tools write to browser storage, especially for EU visitors.',
        }));
      }
    } else if (storageTrackingTools.length > 0 && legalData.consentBanner.found) {
      checkpoints.push(createCheckpoint({
        id: 'm12-storage-preconsent', name: 'Pre-Consent Storage Tracking', weight: 0.8,
        health: 'good',
        evidence: `${storageTrackingTools.length} analytics tool(s) using browser storage; consent banner is present (${legalData.consentBanner.provider ?? 'unknown'})`,
      }));
    } else {
      checkpoints.push(infoCheckpoint(
        'm12-storage-preconsent', 'Pre-Consent Storage Tracking',
        'No analytics tools detected in browser storage',
      ));
    }
  }

  // ─── Pre-consent cookie audit (from CookieAnalyzer) ────────────────────
  if (ctx.cookieAnalysis) {
    const thirdPartyCookies = ctx.cookieAnalysis.cookies.filter(c => !c.isFirstParty);
    const advertisingBeforeConsent = thirdPartyCookies.filter(c => c.category === 'advertising');
    const analyticsBeforeConsent = thirdPartyCookies.filter(c => c.category === 'analytics');

    data.cookieCompliance = {
      thirdPartyCookieCount: thirdPartyCookies.length,
      advertisingCookies: advertisingBeforeConsent.length,
      analyticsCookies: analyticsBeforeConsent.length,
      sameSiteNoneCount: ctx.cookieAnalysis.summary.sameSiteNoneCount,
      insecureCookies: ctx.cookieAnalysis.cookies.filter(c => !c.secure).length,
    };
  }

  // CP: Cookie Attribute Compliance
  {
    if (ctx.cookieAnalysis) {
      const sameSiteNoneInsecure = ctx.cookieAnalysis.cookies.filter(
        c => c.sameSite === 'None' && !c.secure,
      ).length;
      const thirdPartyAd = ctx.cookieAnalysis.cookies.filter(
        c => !c.isFirstParty && c.category === 'advertising',
      ).length;
      const insecureCount = ctx.cookieAnalysis.cookies.filter(c => !c.secure).length;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (sameSiteNoneInsecure > 0) {
        health = 'critical';
        evidence = `${sameSiteNoneInsecure} cookie(s) with SameSite=None but no Secure flag — browsers will reject these`;
        recommendation = 'All cookies with SameSite=None must also have the Secure flag set.';
      } else if (thirdPartyAd > 0) {
        health = 'warning';
        evidence = `${thirdPartyAd} third-party advertising cookie(s) present — may indicate pre-consent tracking`;
        recommendation = 'Ensure advertising cookies are only set after user consent, especially for GDPR/ePrivacy compliance.';
      } else if (insecureCount > 5) {
        health = 'warning';
        evidence = `${insecureCount} cookie(s) on HTTPS site missing Secure flag`;
        recommendation = 'Set the Secure flag on all cookies to prevent transmission over unencrypted connections.';
      } else {
        health = 'excellent';
        evidence = 'All cookie attributes are compliant — no SameSite/Secure mismatches, no pre-consent advertising cookies';
      }

      checkpoints.push(createCheckpoint({ id: 'm12-cookie-compliance', name: 'Cookie Attribute Compliance', weight: 0.4, health, evidence, recommendation }));
    } else {
      checkpoints.push(infoCheckpoint('m12-cookie-compliance', 'Cookie Attribute Compliance', 'Cookie deep analysis not available'));
    }
  }

  // ─── Privacy policy in forms (from FormCollector) ─────────────────────
  if (ctx.formSnapshot) {
    const formsWithPrivacyLink = ctx.formSnapshot.forms.filter(f => {
      // Check if any field or surrounding content has privacy policy link
      return f.fields.some(field => /privacy|gdpr|terms/i.test(field.name));
    });
    data.formPrivacy = {
      totalForms: ctx.formSnapshot.totalForms,
      formsWithPrivacyReference: formsWithPrivacyLink.length,
    };
  }

  return { moduleId: 'M12' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M12' as ModuleId, execute);
