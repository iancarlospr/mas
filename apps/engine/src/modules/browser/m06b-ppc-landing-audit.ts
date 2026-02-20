/**
 * M06b - PPC Landing Page Audit
 *
 * Audits the paid media landing page (navigated by the runner from M21 CTA URL)
 * for tracking parity, conversion readiness, SEO compliance, and page focus
 * against the homepage baseline from M05/M06.
 *
 * Checkpoints:
 *   1. Paid landing page detection (M21 CTA vs fallback)
 *   2. Tracking script parity vs homepage
 *   3. GA4/GTM parity vs homepage
 *   4. Noindex compliance (for dedicated PPC paths)
 *   5. Conversion readiness (form + CTA above fold)
 *   6. Page focus (exit links)
 *   7. Consent compliance parity
 *   8. Page load speed
 *   9. CTA presence (from contentAnalysis)
 *  10. Trust signals (from contentAnalysis)
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determines if a URL path is a dedicated PPC landing page (should have noindex). */
function isDedicatedPpcPath(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  const patterns = ['/lp/', '/landing/', '/go/', '/offer/', '/promo/', '/campaign/', '/ad/', '/paid/'];
  return patterns.some(p => path.includes(p));
}

interface PaidPageAudit {
  hasGA4: boolean;
  hasGTM: boolean;
  hasMetaPixel: boolean;
  hasGoogleAds: boolean;
  hasTikTok: boolean;
  hasLinkedIn: boolean;
  hasTwitter: boolean;
  hasUET: boolean;
  hasConsent: boolean;
  trackingScripts: string[];
  hasNoindex: boolean;
  hasCanonical: boolean;
  formCount: number;
  ctaAboveFold: boolean;
  ctaText: string | null;
  h1Text: string | null;
  navLinkCount: number;
  externalLinkCount: number;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const paidPageUrl = ctx.paidMediaUrl ?? ctx.url;
  const isRealPaidPage = !!ctx.paidMediaUrl && ctx.paidMediaUrl !== ctx.url;

  data.paidPageUrl = paidPageUrl;
  data.isRealPaidPage = isRealPaidPage;

  if (!page) {
    return {
      moduleId: 'M06b' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M06b',
    };
  }

  // ─── Step 1: Audit the current paid page ────────────────────────────────
  const audit = await page.evaluate((): PaidPageAudit => {
    const w = window as unknown as Record<string, unknown>;

    // --- Tracking detection ---
    const hasGA4 = !!(w['gtag'] || w['google_tag_data']);
    const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
    const hasGTM = !!(gtmObj && Object.keys(gtmObj).some(k => k.startsWith('GTM-')));
    const hasMetaPixel = typeof w['fbq'] === 'function' || !!w['_fbq'];
    const hasGoogleAds = !!(
      (gtmObj && Object.keys(gtmObj).some(k => k.startsWith('AW-'))) ||
      document.cookie.includes('_gcl_au')
    );
    const hasTikTok = !!(w['ttq'] && typeof (w['ttq'] as Record<string, unknown>)['track'] === 'function');
    const hasLinkedIn = !!(w['_linkedin_partner_id'] || w['lintrk']);
    const hasTwitter = !!(typeof w['twq'] === 'function' || (w['twq'] && typeof (w['twq'] as Record<string, unknown>)['exe'] === 'function'));
    const hasUET = !!(w['uetq'] || w['UET']);

    const hasConsent = !!(
      w['OneTrust'] || w['Cookiebot'] || w['__tcfapi'] ||
      w['CookieConsent'] || w['_iub'] || w['Osano'] ||
      document.querySelector('[class*="cookie-banner"], [class*="consent-banner"], [id*="cookie-banner"]') ||
      document.querySelector('script[src*="hs-banner"], [class*="hs-cookie"]')
    );

    const trackingScripts: string[] = [];
    if (hasGA4) trackingScripts.push('GA4');
    if (hasGTM) trackingScripts.push('GTM');
    if (hasMetaPixel) trackingScripts.push('Meta Pixel');
    if (hasGoogleAds) trackingScripts.push('Google Ads');
    if (hasTikTok) trackingScripts.push('TikTok');
    if (hasLinkedIn) trackingScripts.push('LinkedIn');
    if (hasTwitter) trackingScripts.push('Twitter/X');
    if (hasUET) trackingScripts.push('Microsoft Ads');

    // --- PPC quality signals ---

    // Noindex check
    const robotsMeta = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const hasNoindex = /noindex/i.test(robotsMeta);

    // Canonical
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const hasCanonical = !!canonical;

    // Form detection
    const forms = document.querySelectorAll('form');
    const formCount = forms.length;

    // CTA above fold
    let ctaAboveFold = false;
    let ctaText: string | null = null;
    const ctaSelectors = [
      'a[class*="cta"], button[class*="cta"]',
      'a[class*="btn-primary"], button[class*="btn-primary"]',
      'a[class*="button-primary"], button[class*="button-primary"]',
      '[class*="hero"] a, [class*="hero"] button',
      '[class*="banner"] a[href], [class*="banner"] button',
      'a[href*="demo"], a[href*="trial"], a[href*="signup"], a[href*="get-started"]',
    ];
    for (const sel of ctaSelectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.width > 0) {
          ctaAboveFold = true;
          ctaText = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
          break;
        }
      }
    }
    // Also check forms as CTAs
    if (!ctaAboveFold && formCount > 0) {
      const firstForm = forms[0] as HTMLElement;
      const rect = firstForm?.getBoundingClientRect();
      if (rect && rect.top < window.innerHeight) {
        ctaAboveFold = true;
        const submit = firstForm.querySelector('button[type="submit"], input[type="submit"]');
        ctaText = (submit?.textContent || 'Form submit').trim().replace(/\s+/g, ' ').slice(0, 80);
      }
    }

    // H1 detection
    const h1 = document.querySelector('h1');
    const h1Text = h1 ? (h1.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120) : null;

    // Navigation/exit link count
    const allLinks = document.querySelectorAll('a[href]');
    let navLinkCount = 0;
    let externalLinkCount = 0;
    const origin = window.location.origin;
    allLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('http') && !href.startsWith(origin)) {
        externalLinkCount++;
      }
      if (a.closest('nav, header, [role="navigation"]')) {
        navLinkCount++;
      }
    });

    return {
      hasGA4, hasGTM, hasMetaPixel, hasGoogleAds, hasTikTok,
      hasLinkedIn, hasTwitter, hasUET, hasConsent, trackingScripts,
      hasNoindex, hasCanonical, formCount, ctaAboveFold, ctaText,
      h1Text, navLinkCount, externalLinkCount,
    };
  });

  data.pageAudit = audit;

  // ─── Step 2: Get homepage baseline from M05/M06 ─────────────────────────
  const m05Data = (ctx.previousResults.get('M05' as ModuleId)?.data ?? {}) as Record<string, unknown>;
  const m06Data = (ctx.previousResults.get('M06' as ModuleId)?.data ?? {}) as Record<string, unknown>;

  const mainToolNames = (m05Data['toolNames'] as string[]) ?? [];
  const mainPixelNames = (m06Data['pixelNames'] as string[]) ?? [];
  const mainHasGA4 = mainToolNames.includes('Google Analytics 4');
  const mainHasGTM = mainToolNames.includes('Google Tag Manager');
  const mainConsentPlatform = ((m05Data['consent'] as Record<string, unknown>)?.['consentPlatform'] as string | null) ?? null;

  data.homepageBaseline = {
    toolNames: mainToolNames,
    pixelNames: mainPixelNames,
    hasGA4: mainHasGA4,
    hasGTM: mainHasGTM,
    consentPlatform: mainConsentPlatform,
  };

  // ─── Step 3: Build tracking parity ──────────────────────────────────────
  const mainTrackingSet = new Set<string>();
  if (mainToolNames.includes('Google Analytics 4')) mainTrackingSet.add('GA4');
  if (mainToolNames.includes('Google Tag Manager')) mainTrackingSet.add('GTM');
  for (const pn of mainPixelNames) {
    if (pn === 'Meta Pixel') mainTrackingSet.add('Meta Pixel');
    if (pn === 'Google Ads') mainTrackingSet.add('Google Ads');
    if (pn === 'TikTok Pixel') mainTrackingSet.add('TikTok');
    if (pn === 'LinkedIn Insight') mainTrackingSet.add('LinkedIn');
    if (pn === 'Twitter/X Pixel') mainTrackingSet.add('Twitter/X');
    if (pn === 'Microsoft Ads (UET)') mainTrackingSet.add('Microsoft Ads');
  }

  const paidPageScripts = new Set(audit.trackingScripts);
  const missing = [...mainTrackingSet].filter(s => !paidPageScripts.has(s));
  const extra = [...paidPageScripts].filter(s => !mainTrackingSet.has(s));
  const intersection = [...mainTrackingSet].filter(s => paidPageScripts.has(s)).length;
  const parityRatio = mainTrackingSet.size > 0 ? intersection / mainTrackingSet.size : 1;

  data.trackingParity = {
    mainTrackingSet: [...mainTrackingSet],
    paidPageTrackingSet: [...paidPageScripts],
    missing,
    extra,
    parityRatio,
  };

  // ─── Step 4: Measure page speed via Performance API ─────────────────────
  let loadTimeMs = 0;
  try {
    loadTimeMs = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return nav ? Math.round(nav.loadEventEnd - nav.startTime) : 0;
    });
  } catch { /* */ }
  data.loadTimeMs = loadTimeMs;

  // ─── Step 5: Build signal ───────────────────────────────────────────────
  signals.push(
    createSignal({
      type: 'ppc_page',
      name: `PPC Landing: ${new URL(paidPageUrl).pathname}`,
      confidence: isRealPaidPage ? 0.95 : 0.5,
      evidence: `${paidPageUrl} — ${audit.trackingScripts.length} trackers, ${audit.formCount} form(s)${audit.hasNoindex ? ', noindex' : ''}`,
      category: 'paid_media',
    }),
  );

  // ─── Step 6: Build checkpoints ──────────────────────────────────────────

  // CP1: Paid landing page detection
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (isRealPaidPage) {
      health = 'excellent';
      evidence = `Real paid landing page from M21 ad CTA: ${paidPageUrl}`;
    } else {
      health = 'warning';
      evidence = 'No paid landing page CTA found in ads — fell back to homepage URL for audit';
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-paid-page', name: 'Paid Landing Page Detected', weight: 0.8, health, evidence }));
  }

  // CP2: Tracking script parity
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (mainTrackingSet.size === 0) {
      // No homepage baseline — can't compare
      health = 'good';
      evidence = `Paid page has ${audit.trackingScripts.length} tracker(s): ${audit.trackingScripts.join(', ') || 'none'}`;
    } else if (parityRatio >= 0.9) {
      health = 'excellent';
      evidence = `${Math.round(parityRatio * 100)}% tracking parity between paid page and homepage`;
    } else if (parityRatio >= 0.6) {
      health = 'warning';
      evidence = `${Math.round(parityRatio * 100)}% tracking parity — missing on paid page: ${missing.join(', ')}`;
      recommendation = 'Ensure all ad pixels from the main site are also present on the paid landing page for full attribution.';
    } else {
      health = 'critical';
      evidence = `${Math.round(parityRatio * 100)}% parity — major tracking gaps: missing ${missing.join(', ')}`;
      recommendation = 'Critical: paid page missing key tracking pixels, leading to lost attribution data.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-parity', name: 'Tracking Script Parity', weight: 0.9, health, evidence, recommendation }));
  }

  // CP3: GA4/GTM parity
  {
    const ga4Missing = mainHasGA4 && !audit.hasGA4;
    const gtmMissing = mainHasGTM && !audit.hasGTM;

    let health: CheckpointHealth;
    let evidence: string;

    if (!mainHasGA4 && !mainHasGTM) {
      health = audit.hasGA4 || audit.hasGTM ? 'good' : 'good';
      evidence = `Paid page: ${audit.hasGA4 ? 'has GA4' : 'no GA4'}, ${audit.hasGTM ? 'has GTM' : 'no GTM'} (no homepage baseline)`;
    } else if (!ga4Missing && !gtmMissing) {
      health = 'excellent';
      evidence = 'GA4/GTM consistent between homepage and paid page';
    } else {
      health = 'critical';
      evidence = `Paid page${ga4Missing ? ' missing GA4' : ''}${ga4Missing && gtmMissing ? ' and' : ''}${gtmMissing ? ' missing GTM' : ''} vs homepage`;
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-ga4-parity', name: 'GA4/GTM Parity', weight: 0.8, health, evidence }));
  }

  // CP4: Noindex compliance
  {
    const isDedicated = isDedicatedPpcPath(paidPageUrl);
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (!isDedicated) {
      health = 'excellent';
      evidence = `Paid page (${new URL(paidPageUrl).pathname}) is a shared acquisition page — correctly indexed for organic + paid`;
    } else if (audit.hasNoindex) {
      health = 'excellent';
      evidence = 'Dedicated PPC page has noindex — correctly hidden from search engines';
    } else {
      health = 'warning';
      evidence = `Dedicated PPC page (${new URL(paidPageUrl).pathname}) missing noindex`;
      recommendation = 'Add noindex to this dedicated PPC landing page to prevent SEO cannibalization.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-noindex', name: 'Noindex Compliance', weight: 0.4, health, evidence, recommendation }));
  }

  // CP5: Conversion readiness
  {
    const hasForm = audit.formCount > 0;
    const hasCta = audit.ctaAboveFold;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (hasForm && hasCta) {
      health = 'excellent';
      evidence = `Paid page has ${audit.formCount} form(s) + above-fold CTA${audit.ctaText ? ` ("${audit.ctaText}")` : ''}`;
    } else if (hasCta || hasForm) {
      health = 'good';
      evidence = `${hasForm ? `${audit.formCount} form(s)` : 'No form'}${hasCta ? ', CTA above fold' : ', no CTA above fold'}`;
    } else {
      health = 'critical';
      evidence = 'No form or above-fold CTA on paid landing page';
      recommendation = 'Add a conversion form and prominent CTA to the paid landing page.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-conversion', name: 'Conversion Readiness', weight: 0.7, health, evidence, recommendation }));
  }

  // CP6: Page focus
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (audit.navLinkCount <= 5 && audit.externalLinkCount <= 2) {
      health = 'excellent';
      evidence = `Focused paid page: ${audit.navLinkCount} nav links, ${audit.externalLinkCount} external links`;
    } else if (audit.navLinkCount <= 15) {
      health = 'good';
      evidence = `Paid page: ${audit.navLinkCount} nav links, ${audit.externalLinkCount} external links`;
    } else {
      health = 'warning';
      evidence = `Paid page has ${audit.navLinkCount} nav links — too many exit points`;
      recommendation = 'Reduce navigation on PPC landing page to keep visitors focused on conversion.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-focus', name: 'Page Focus', weight: 0.3, health, evidence, recommendation }));
  }

  // CP7: Consent compliance parity
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (!mainConsentPlatform) {
      health = 'good';
      evidence = audit.hasConsent
        ? 'Consent banner present on paid page (no homepage baseline)'
        : 'No consent management detected on homepage or paid page';
    } else if (audit.hasConsent) {
      health = 'excellent';
      evidence = `Consent banner present on paid page (matches homepage: ${mainConsentPlatform})`;
    } else {
      health = 'critical';
      evidence = `Homepage has consent (${mainConsentPlatform}) but paid page is missing it`;
      recommendation = 'Ensure consent management is present on the paid landing page for GDPR/CCPA compliance.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-consent-parity', name: 'Consent Compliance Parity', weight: 0.8, health, evidence, recommendation }));
  }

  // CP8: Page speed
  {
    if (loadTimeMs <= 0) {
      checkpoints.push(infoCheckpoint({ id: 'm06b-speed', name: 'PPC Page Speed', weight: 0.4, evidence: 'Navigation timing not available' }));
    } else if (loadTimeMs < 3000) {
      checkpoints.push(createCheckpoint({ id: 'm06b-speed', name: 'PPC Page Speed', weight: 0.4, health: 'excellent', evidence: `Fast paid page: ${loadTimeMs}ms load time` }));
    } else if (loadTimeMs < 5000) {
      checkpoints.push(createCheckpoint({ id: 'm06b-speed', name: 'PPC Page Speed', weight: 0.4, health: 'good', evidence: `Paid page loads in ${loadTimeMs}ms` }));
    } else {
      checkpoints.push(createCheckpoint({ id: 'm06b-speed', name: 'PPC Page Speed', weight: 0.4, health: 'warning', evidence: `Slow paid page: ${loadTimeMs}ms load time`, recommendation: 'PPC landing pages should load under 3s to minimize bounce rate from paid traffic.' }));
    }
  }

  // ─── Step 7: CTA & Trust Signal analysis (from ContentAnalyzer) ─────────
  if (ctx.contentAnalysis) {
    data.ctaAnalysis = {
      totalCTAs: ctx.contentAnalysis.ctas.length,
      ctaAboveFold: ctx.contentAnalysis.ctaAboveFold,
      ctas: ctx.contentAnalysis.ctas,
    };
    data.trustSignals = ctx.contentAnalysis.trustSignals;
  }

  // CP9: CTA Presence
  {
    if (ctx.contentAnalysis) {
      const { ctas, ctaAboveFold: ctaAbove } = ctx.contentAnalysis;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (ctaAbove > 0) {
        health = 'excellent';
        evidence = `${ctas.length} CTA(s) detected, ${ctaAbove} above the fold`;
      } else if (ctas.length > 0) {
        health = 'warning';
        evidence = `${ctas.length} CTA(s) detected but none above the fold`;
        recommendation = 'Move at least one call-to-action above the fold to improve conversion rates on PPC traffic.';
      } else {
        health = 'critical';
        evidence = 'No call-to-action elements detected on the main page';
        recommendation = 'Add clear CTAs (buttons, forms) to convert paid traffic. Every PPC landing flow needs a visible conversion action.';
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-cta-analysis', name: 'CTA Presence', weight: 0.5, health, evidence, recommendation }));
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm06b-cta-analysis', name: 'CTA Presence', weight: 0.5, evidence: 'Content analysis not available' }));
    }
  }

  // CP10: Trust Signals
  {
    if (ctx.contentAnalysis) {
      const { trustSignals } = ctx.contentAnalysis;

      let health: CheckpointHealth;
      let evidence: string;

      if (trustSignals.length >= 3) {
        health = 'excellent';
        evidence = `${trustSignals.length} trust signals found: ${trustSignals.map(s => s.type).join(', ')}`;
      } else if (trustSignals.length >= 1) {
        health = 'good';
        evidence = `${trustSignals.length} trust signal(s) found: ${trustSignals.map(s => s.type).join(', ')}`;
      } else {
        health = 'info';
        evidence = 'No trust signals detected (testimonials, reviews, security badges, certifications)';
      }

      if (health === 'info') {
        checkpoints.push(infoCheckpoint({ id: 'm06b-trust-signals', name: 'Trust Signals', weight: 0.3, evidence }));
      } else {
        checkpoints.push(createCheckpoint({ id: 'm06b-trust-signals', name: 'Trust Signals', weight: 0.3, health, evidence }));
      }
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm06b-trust-signals', name: 'Trust Signals', weight: 0.3, evidence: 'Content analysis not available' }));
    }
  }

  return {
    moduleId: 'M06b' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

export { execute };
registerModuleExecutor('M06b' as ModuleId, execute);
