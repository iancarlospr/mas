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
 *   6. CSP policy
 *   7. SRI on third-party scripts
 *   8. Cookie security flags
 *   9. security.txt
 *  10. CCPA opt-out link
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { probeConsentBanner } from '../../ghostscan/probes.js';
import { probeUrl } from '../../utils/url.js';

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
    const links = Array.from(document.querySelectorAll('a[href]'));

    const findLink = (patterns: RegExp[]): { found: boolean; href: string | null; text: string | null } => {
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href.toLowerCase();
        const text = (link.textContent ?? '').toLowerCase().trim();
        for (const pat of patterns) {
          if (pat.test(href) || pat.test(text)) {
            return { found: true, href: (link as HTMLAnchorElement).href, text: (link.textContent ?? '').trim().slice(0, 80) };
          }
        }
      }
      return { found: false, href: null, text: null };
    };

    const privacyPolicy = findLink([/privacy/i, /datenschutz/i, /privacidad/i]);
    const termsOfService = findLink([/terms/i, /tos\b/i, /conditions/i, /nutzungsbedingungen/i]);
    const cookiePolicy = findLink([/cookie[- ]?policy/i, /cookie[- ]?notice/i]);
    const ccpaOptOut = findLink([/do[- ]?not[- ]?sell/i, /opt[- ]?out/i, /ccpa/i, /your[- ]?privacy[- ]?choices/i]);
    const dsarLink = findLink([/data[- ]?subject/i, /dsar/i, /data[- ]?request/i, /my[- ]?data/i]);

    // Cookie consent banner detection
    const bannerSelectors = [
      '#onetrust-banner-sdk', '#CybotCookiebotDialog', '.cc-banner',
      '#cookie-law-info-bar', '.evidon-consent-button', '#gdpr-cookie-notice',
      '.qc-cmp2-summary-buttons', '#consent-banner', '.cookie-consent',
      '.cookie-banner', '[class*="cookie-consent"]', '[class*="cookie-banner"]',
      '[class*="consent-banner"]', '[id*="cookie-consent"]', '[id*="cookie-banner"]',
    ];

    let consentBanner: { found: boolean; provider: string | null; hasReject: boolean; hasGranular: boolean } = {
      found: false, provider: null, hasReject: false, hasGranular: false,
    };

    for (const sel of bannerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const visible = (el as HTMLElement).offsetHeight > 0;
        if (visible) {
          // Identify provider
          let provider: string | null = null;
          if (sel.includes('onetrust')) provider = 'OneTrust';
          else if (sel.includes('Cookiebot')) provider = 'Cookiebot';
          else if (sel.includes('cc-banner')) provider = 'CookieConsent';
          else if (sel.includes('cookie-law-info')) provider = 'GDPR Cookie Compliance';
          else if (sel.includes('evidon')) provider = 'Evidon/Crownpeak';
          else if (sel.includes('qc-cmp2')) provider = 'Quantcast';

          // Check for reject button
          const bannerEl = el;
          const rejectPatterns = ['reject', 'decline', 'deny', 'refuse', 'no thanks', 'only essential', 'necessary only'];
          const buttons = Array.from(bannerEl.querySelectorAll('button, a[role="button"], [class*="btn"]'));
          const hasReject = buttons.some(b => {
            const txt = (b.textContent ?? '').toLowerCase();
            return rejectPatterns.some(p => txt.includes(p));
          });

          // Check for granular categories
          const hasGranular = !!bannerEl.querySelector(
            'input[type="checkbox"], [class*="toggle"], [class*="category"], [class*="preference"]'
          );

          consentBanner = { found: true, provider, hasReject, hasGranular };
          break;
        }
      }
    }

    // Check for consent mode (Google)
    const w = window as unknown as Record<string, unknown>;
    const dataLayer = w['dataLayer'] as Array<Record<string, unknown>> | undefined;
    let hasConsentMode = false;
    if (Array.isArray(dataLayer)) {
      hasConsentMode = dataLayer.some(entry =>
        entry[0] === 'consent' || entry['event'] === 'consent_update' ||
        JSON.stringify(entry).includes('consent')
      );
    }

    return {
      privacyPolicy,
      termsOfService,
      cookiePolicy,
      ccpaOptOut,
      dsarLink,
      consentBanner,
      hasConsentMode,
    };
  });

  data.legal = legalData;

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

  // Parse CSP directives
  let cspHasUnsafeInline = false;
  let cspHasUnsafeEval = false;
  let cspHasReportUri = false;
  if (csp) {
    cspHasUnsafeInline = csp.includes("'unsafe-inline'");
    cspHasUnsafeEval = csp.includes("'unsafe-eval'");
    cspHasReportUri = /report-(uri|to)/i.test(csp);
  }

  data.securityHeaders = {
    hsts, hstsMaxAge, hstsIncludesSub, hstsPreload,
    csp: csp ? csp.slice(0, 500) : null,
    cspHasUnsafeInline, cspHasUnsafeEval, cspHasReportUri,
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
  if (nc && legalData.consentBanner.found) {
    const allRequests = nc.getAllRequests();
    const trackingDomains = allRequests
      .filter(r => r.category === 'analytics' || r.category === 'advertising')
      .map(r => {
        try { return new URL(r.url).hostname; } catch { return r.url.slice(0, 60); }
      });
    preConsentTracking = [...new Set(trackingDomains)].slice(0, 15);
  }
  data.preConsentTracking = preConsentTracking;

  // ─── Step 6: Probe security.txt ────────────────────────────────────────
  let hasSecurityTxt = false;
  try {
    const secUrl = `${baseUrl.origin}/.well-known/security.txt`;
    const secResult = await probeUrl(secUrl, 5000);
    hasSecurityTxt = secResult !== null;
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
      confidence: 0.85, evidence: `Tracking before consent: ${preConsentTracking.slice(0, 5).join(', ')}`,
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

  // CP3: Cookie consent banner
  {
    const cb = legalData.consentBanner;
    let health: CheckpointHealth;
    let evidence: string;

    if (cb.found && cb.hasReject && cb.hasGranular) {
      health = 'excellent';
      evidence = `Cookie consent banner with reject option and granular categories${cb.provider ? ` (${cb.provider})` : ''}`;
    } else if (cb.found && cb.hasReject) {
      health = 'good';
      evidence = `Cookie consent banner with reject option${cb.provider ? ` (${cb.provider})` : ''}`;
    } else if (cb.found) {
      health = 'warning';
      evidence = `Cookie consent banner present but no reject/decline option${cb.provider ? ` (${cb.provider})` : ''} — may not satisfy GDPR`;
    } else {
      // Check if there's any tracking that would require consent
      const hasTracking = nc ? nc.getAnalyticsRequests().length > 0 || nc.getAdvertisingRequests().length > 0 : false;
      if (hasTracking) {
        health = 'critical';
        evidence = 'No cookie consent banner but tracking scripts are present — likely non-compliant';
      } else {
        health = 'good';
        evidence = 'No cookie consent banner (no tracking detected, may not be required)';
      }
    }

    checkpoints.push(createCheckpoint({ id: 'm12-consent-banner', name: 'Cookie Consent Banner', weight: 0.9, health, evidence }));
  }

  // CP4: Pre-consent tracking
  {
    if (!legalData.consentBanner.found) {
      checkpoints.push(infoCheckpoint('m12-pre-consent', 'Pre-Consent Tracking', 'No consent banner — pre-consent check not applicable'));
    } else if (preConsentTracking.length === 0) {
      checkpoints.push(createCheckpoint({
        id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
        health: 'excellent', evidence: 'No tracking pixels detected before consent interaction',
      }));
    } else {
      const majorTrackers = preConsentTracking.filter(d =>
        d.includes('google-analytics') || d.includes('analytics.google') ||
        d.includes('facebook') || d.includes('meta') || d.includes('doubleclick')
      );
      checkpoints.push(createCheckpoint({
        id: 'm12-pre-consent', name: 'Pre-Consent Tracking', weight: 1.0,
        health: majorTrackers.length > 0 ? 'critical' : 'warning',
        evidence: `${preConsentTracking.length} tracking domain(s) fire before consent: ${preConsentTracking.slice(0, 5).join(', ')}`,
        recommendation: 'Ensure no analytics or advertising scripts fire before the user provides consent.',
      }));
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

    if (csp && !cspHasUnsafeInline && !cspHasUnsafeEval && cspHasReportUri) {
      health = 'excellent';
      evidence = 'Content Security Policy is strict with reporting enabled';
    } else if (csp && !cspHasUnsafeInline && !cspHasUnsafeEval) {
      health = 'good';
      evidence = 'Content Security Policy present without unsafe directives';
    } else if (csp) {
      health = 'warning';
      evidence = `CSP present but has ${[cspHasUnsafeInline ? "'unsafe-inline'" : '', cspHasUnsafeEval ? "'unsafe-eval'" : ''].filter(Boolean).join(' and ')}`;
    } else {
      health = 'warning';
      evidence = 'No Content Security Policy header — site vulnerable to XSS attacks';
    }

    checkpoints.push(createCheckpoint({ id: 'm12-csp', name: 'Content Security Policy', weight: 0.6, health, evidence }));
  }

  // CP7: SRI coverage
  {
    const sri = sriData;
    let health: CheckpointHealth;
    let evidence: string;

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
      } else if (ratio >= 0.1) {
        health = 'warning';
        evidence = `Only ${sri.withSri}/${sri.thirdPartyScripts} third-party scripts have SRI integrity attributes`;
      } else {
        health = 'warning';
        evidence = `${sri.withSri}/${sri.thirdPartyScripts} third-party scripts have SRI — supply chain risk`;
      }
    }

    checkpoints.push(createCheckpoint({ id: 'm12-sri', name: 'Subresource Integrity', weight: 0.5, health, evidence }));
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

  return { moduleId: 'M12' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M12' as ModuleId, execute);
