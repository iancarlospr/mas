/**
 * M06b - PPC Landing Page Audit
 *
 * Discovers hidden PPC landing pages by probing common paid-traffic
 * URL patterns, then audits their tracking parity, conversion readiness,
 * and SEO/consent compliance against the main page.
 *
 * Checkpoints:
 *   1. PPC page discovery
 *   2. Tracking script parity
 *   3. GA4/GTM parity
 *   4. Noindex compliance
 *   5. Conversion readiness (form + CTA)
 *   6. Page focus (exit links)
 *   7. Consent compliance parity
 *   8. Page load speed
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { probeUrl } from '../../utils/url.js';

// ---------------------------------------------------------------------------
// PPC path patterns to probe (exhaustive)
// ---------------------------------------------------------------------------

// Dedicated PPC paths — typically ad-only, should have noindex
const DEDICATED_PPC_PATHS = new Set([
  '/lp/', '/landing/', '/go/', '/offer/', '/promo/',
  '/campaign/', '/ad/', '/paid/',
]);

const PPC_PATHS = [
  // Dedicated PPC landing pages
  '/lp/', '/landing/', '/go/', '/offer/', '/promo/',
  '/campaign/', '/ad/', '/paid/',
  // Shared acquisition pages (serve both organic + paid — should NOT have noindex)
  '/demo/', '/free-trial/', '/request-demo/', '/get-started/',
  '/signup/', '/start/', '/try/', '/book/', '/schedule/',
  '/register/', '/contact/', '/quote/', '/pricing/',
  // Content offers (often used as PPC landing)
  '/ebook/', '/webinar/', '/whitepaper/', '/report/',
  '/guide/', '/download/', '/resources/', '/toolkit/',
  // Comparison / product pages
  '/compare/', '/products/', '/solutions/', '/platform/',
];

interface DiscoveredPage {
  url: string;
  status: number;
  path: string;
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
  // PPC quality signals
  hasNoindex: boolean;
  hasCanonical: boolean;
  formCount: number;
  ctaAboveFold: boolean;
  ctaText: string | null;
  h1Text: string | null;
  navLinkCount: number;
  externalLinkCount: number;
  loadTimeMs: number;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  // ─── Step 1: Discover PPC pages by probing paths ─────────────────────────
  const baseUrl = new URL(ctx.url);
  const discovered: DiscoveredPage[] = [];

  // Probe in parallel with concurrency limit
  const probePromises = PPC_PATHS.map(async (path) => {
    const testUrl = `${baseUrl.origin}${path}`;
    try {
      const result = await probeUrl(testUrl, 8_000);
      if (result.status >= 200 && result.status < 400) {
        return { url: testUrl, status: result.status, path };
      }
    } catch {
      // Probe failure is expected for most paths
    }
    return null;
  });

  const probeResults = await Promise.allSettled(probePromises);
  const validPages = probeResults
    .filter((r): r is PromiseFulfilledResult<{ url: string; status: number; path: string } | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((r): r is { url: string; status: number; path: string } => r !== null);

  data.probedPaths = PPC_PATHS.length;
  data.validPageCount = validPages.length;

  // ─── Step 2: For each discovered page, deep audit ─────────────────────────
  const page = ctx.page;
  const maxPages = 5;

  for (const found of validPages.slice(0, maxPages)) {
    if (!page) break;

    try {
      const startTime = Date.now();
      await page.goto(found.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(3000);
      const loadTimeMs = Date.now() - startTime;

      const audit = await page.evaluate((): Omit<DiscoveredPage, 'url' | 'status' | 'path' | 'loadTimeMs'> => {
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
          // Count nav links (in header/nav elements)
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

      discovered.push({ ...found, ...audit, loadTimeMs });
    } catch {
      // Navigation failure — skip
    }
  }

  // Navigate back to original URL
  if (page && discovered.length > 0) {
    try {
      await page.goto(ctx.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    } catch {
      // Non-fatal
    }
  }

  data.discoveredPages = discovered;
  data.foundCount = discovered.length;

  // ─── Step 3: Get main page baseline from M05/M06 results ────────────────
  const m05Data = (ctx.previousResults.get('M05' as ModuleId)?.data ?? {}) as Record<string, unknown>;
  const m06Data = (ctx.previousResults.get('M06' as ModuleId)?.data ?? {}) as Record<string, unknown>;

  const mainToolNames = (m05Data['toolNames'] as string[]) ?? [];
  const mainPixelNames = (m06Data['pixelNames'] as string[]) ?? [];
  const mainHasGA4 = mainToolNames.includes('Google Analytics 4');
  const mainHasGTM = mainToolNames.includes('Google Tag Manager');

  // ─── Step 4: Build signals ───────────────────────────────────────────────
  for (const pg of discovered) {
    signals.push(
      createSignal({
        type: 'ppc_page',
        name: `PPC Landing: ${pg.path}`,
        confidence: 0.85,
        evidence: `${pg.url} (${pg.status}) — ${pg.trackingScripts.length} trackers, ${pg.formCount} form(s)${pg.hasNoindex ? ', noindex' : ''}`,
        category: 'paid_media',
      }),
    );
  }

  // ─── Step 5: Build checkpoints ───────────────────────────────────────────

  // CP1: PPC page discovery
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (discovered.length >= 3) {
      health = 'excellent';
      evidence = `Found ${discovered.length} PPC landing pages: ${discovered.map(p => p.path).join(', ')}`;
    } else if (discovered.length >= 1) {
      health = 'good';
      evidence = `Found ${discovered.length} PPC page(s): ${discovered.map(p => p.path).join(', ')} (probed ${PPC_PATHS.length} patterns)`;
    } else {
      health = 'good';
      evidence = `No PPC landing pages found at standard paths (probed ${PPC_PATHS.length} patterns — may use custom paths)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-discovery', name: 'PPC Page Discovery', weight: 0.8, health, evidence }));
  }

  if (discovered.length === 0) {
    // No PPC pages found — skip all parity/quality checks
    checkpoints.push(infoCheckpoint({ id: 'm06b-parity', name: 'Tracking Parity', weight: 0.9, evidence: 'No PPC pages to audit — parity check skipped' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-ga4-parity', name: 'GA4/GTM Parity', weight: 0.8, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-noindex', name: 'Noindex Compliance', weight: 0.4, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-conversion', name: 'Conversion Readiness', weight: 0.7, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-focus', name: 'Page Focus', weight: 0.3, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-consent-parity', name: 'Consent Compliance Parity', weight: 0.8, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-speed', name: 'PPC Page Speed', weight: 0.4, evidence: 'N/A — no PPC pages' }));
  } else {
    // CP2: Tracking script parity
    {
      // Build main page tracking set from M05/M06 data
      const mainTrackingSet = new Set<string>();
      // Map M05 tool names to our short names
      if (mainToolNames.includes('Google Analytics 4')) mainTrackingSet.add('GA4');
      if (mainToolNames.includes('Google Tag Manager')) mainTrackingSet.add('GTM');
      // Map M06 pixel names to short names
      for (const pn of mainPixelNames) {
        if (pn === 'Meta Pixel') mainTrackingSet.add('Meta Pixel');
        if (pn === 'Google Ads') mainTrackingSet.add('Google Ads');
        if (pn === 'TikTok Pixel') mainTrackingSet.add('TikTok');
        if (pn === 'LinkedIn Insight') mainTrackingSet.add('LinkedIn');
        if (pn === 'Twitter/X Pixel') mainTrackingSet.add('Twitter/X');
        if (pn === 'Microsoft Ads (UET)') mainTrackingSet.add('Microsoft Ads');
      }

      // If no baseline (standalone test), use the first PPC page as reference
      if (mainTrackingSet.size === 0 && discovered.length > 0) {
        for (const s of discovered[0]!.trackingScripts) mainTrackingSet.add(s);
      }

      let totalParity = 0;
      const missingByPage: Array<{ path: string; missing: string[] }> = [];

      for (const pg of discovered) {
        const pgScripts = new Set(pg.trackingScripts);
        const missing = [...mainTrackingSet].filter(s => !pgScripts.has(s));
        const intersection = [...mainTrackingSet].filter(s => pgScripts.has(s)).length;
        totalParity += mainTrackingSet.size > 0 ? intersection / mainTrackingSet.size : 1;
        if (missing.length > 0) missingByPage.push({ path: pg.path, missing });
      }
      const avgParity = totalParity / discovered.length;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (avgParity >= 0.9) {
        health = 'excellent';
        evidence = `${Math.round(avgParity * 100)}% tracking parity across ${discovered.length} PPC pages`;
      } else if (avgParity >= 0.6) {
        health = 'warning';
        evidence = `${Math.round(avgParity * 100)}% tracking parity — missing: ${missingByPage.map(p => `${p.path} (${p.missing.join(', ')})`).join('; ')}`;
        recommendation = 'Ensure all ad pixels from the main site are also present on PPC landing pages for full attribution.';
      } else {
        health = 'critical';
        evidence = `${Math.round(avgParity * 100)}% parity — major tracking gaps on PPC pages`;
        recommendation = 'Critical: PPC pages are missing key tracking pixels, leading to lost attribution data.';
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-parity', name: 'Tracking Script Parity', weight: 0.9, health, evidence, recommendation }));
    }

    // CP3: GA4/GTM parity
    {
      const ga4Missing = discovered.filter(p => mainHasGA4 && !p.hasGA4);
      const gtmMissing = discovered.filter(p => mainHasGTM && !p.hasGTM);
      const issues = ga4Missing.length + gtmMissing.length;

      let health: CheckpointHealth;
      let evidence: string;

      if (!mainHasGA4 && !mainHasGTM) {
        // No baseline — check if PPC pages are consistent with each other
        const allHaveGA4 = discovered.every(p => p.hasGA4);
        const allHaveGTM = discovered.every(p => p.hasGTM);
        health = allHaveGA4 && allHaveGTM ? 'excellent' : 'good';
        evidence = `PPC pages: ${allHaveGA4 ? 'all have GA4' : 'some missing GA4'}, ${allHaveGTM ? 'all have GTM' : 'some missing GTM'}`;
      } else if (issues === 0) {
        health = 'excellent';
        evidence = 'GA4/GTM consistent across all PPC pages';
      } else {
        health = 'critical';
        evidence = `${ga4Missing.length} PPC page(s) missing GA4, ${gtmMissing.length} missing GTM`;
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-ga4-parity', name: 'GA4/GTM Parity', weight: 0.8, health, evidence }));
    }

    // CP4: Noindex compliance (only for dedicated PPC paths — shared pages like /pricing/ SHOULD be indexed)
    {
      const dedicatedPages = discovered.filter(p => DEDICATED_PPC_PATHS.has(p.path));
      const sharedPages = discovered.filter(p => !DEDICATED_PPC_PATHS.has(p.path));

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (dedicatedPages.length === 0) {
        // All discovered pages are shared acquisition pages — noindex not needed
        health = 'excellent';
        evidence = `All ${discovered.length} pages are shared acquisition pages (${sharedPages.map(p => p.path).join(', ')}) — correctly indexed for organic + paid`;
      } else {
        const noindexDedicated = dedicatedPages.filter(p => p.hasNoindex);
        const indexedDedicated = dedicatedPages.filter(p => !p.hasNoindex);

        if (noindexDedicated.length === dedicatedPages.length) {
          health = 'excellent';
          evidence = `All ${dedicatedPages.length} dedicated PPC pages have noindex${sharedPages.length > 0 ? ` (${sharedPages.length} shared pages correctly indexed)` : ''}`;
        } else if (indexedDedicated.length > 0) {
          health = 'warning';
          evidence = `${indexedDedicated.length} dedicated PPC page(s) missing noindex: ${indexedDedicated.map(p => p.path).join(', ')}`;
          recommendation = `Add noindex to dedicated PPC pages: ${indexedDedicated.map(p => p.path).join(', ')} to prevent SEO cannibalization.`;
        } else {
          health = 'good';
          evidence = `${noindexDedicated.length}/${dedicatedPages.length} dedicated PPC pages have noindex`;
        }
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-noindex', name: 'Noindex Compliance', weight: 0.4, health, evidence, recommendation }));
    }

    // CP5: Conversion readiness (form + CTA above fold)
    {
      const pagesWithForm = discovered.filter(p => p.formCount > 0);
      const pagesWithCta = discovered.filter(p => p.ctaAboveFold);

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (pagesWithForm.length === discovered.length && pagesWithCta.length === discovered.length) {
        health = 'excellent';
        evidence = `All ${discovered.length} PPC pages have form + above-fold CTA${discovered[0]?.ctaText ? ` (e.g. "${discovered[0].ctaText}")` : ''}`;
      } else if (pagesWithCta.length === discovered.length || pagesWithForm.length === discovered.length) {
        health = 'good';
        evidence = `${pagesWithForm.length} with form(s), ${pagesWithCta.length} with above-fold CTA`;
      } else if (pagesWithCta.length > 0 || pagesWithForm.length > 0) {
        health = 'warning';
        evidence = `${pagesWithForm.length}/${discovered.length} have forms, ${pagesWithCta.length}/${discovered.length} have above-fold CTA`;
        recommendation = 'PPC landing pages should have a clear CTA above the fold and a conversion form.';
      } else {
        health = 'critical';
        evidence = 'No PPC pages have forms or above-fold CTAs — conversion likely suffers';
        recommendation = 'Add conversion forms and prominent CTAs to all PPC landing pages.';
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-conversion', name: 'Conversion Readiness', weight: 0.7, health, evidence, recommendation }));
    }

    // CP6: Page focus (minimize exits)
    {
      const avgNavLinks = discovered.reduce((s, p) => s + p.navLinkCount, 0) / discovered.length;
      const avgExternalLinks = discovered.reduce((s, p) => s + p.externalLinkCount, 0) / discovered.length;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (avgNavLinks <= 5 && avgExternalLinks <= 2) {
        health = 'excellent';
        evidence = `Focused PPC pages: avg ${Math.round(avgNavLinks)} nav links, ${Math.round(avgExternalLinks)} external links`;
      } else if (avgNavLinks <= 15) {
        health = 'good';
        evidence = `PPC pages: avg ${Math.round(avgNavLinks)} nav links, ${Math.round(avgExternalLinks)} external links`;
      } else {
        health = 'warning';
        evidence = `PPC pages have avg ${Math.round(avgNavLinks)} nav links — too many exit points`;
        recommendation = 'Reduce navigation on PPC landing pages to keep visitors focused on conversion.';
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-focus', name: 'Page Focus', weight: 0.3, health, evidence, recommendation }));
    }

    // CP7: Consent compliance parity
    {
      const consentMissing = discovered.filter(p => !p.hasConsent);
      const m05Consent = (m05Data['consent'] as Record<string, unknown>)?.consentPlatform;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (!m05Consent) {
        // No baseline — check if PPC pages have consent
        const anyConsent = discovered.some(p => p.hasConsent);
        health = anyConsent ? 'good' : 'good';
        evidence = anyConsent
          ? `${discovered.filter(p => p.hasConsent).length}/${discovered.length} PPC pages have consent management`
          : 'No consent management detected on main site or PPC pages';
      } else if (consentMissing.length === 0) {
        health = 'excellent';
        evidence = 'Consent banner present on all PPC pages';
      } else {
        health = 'critical';
        evidence = `${consentMissing.length}/${discovered.length} PPC pages missing consent banner: ${consentMissing.map(p => p.path).join(', ')}`;
        recommendation = 'Ensure consent management is present on all PPC pages to maintain GDPR/CCPA compliance.';
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-consent-parity', name: 'Consent Compliance Parity', weight: 0.8, health, evidence, recommendation }));
    }

    // CP8: PPC page speed
    {
      const avgLoad = discovered.reduce((s, p) => s + p.loadTimeMs, 0) / discovered.length;
      const slowPages = discovered.filter(p => p.loadTimeMs > 5000);

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (avgLoad < 3000) {
        health = 'excellent';
        evidence = `Fast PPC pages: avg ${Math.round(avgLoad)}ms load time`;
      } else if (avgLoad < 5000) {
        health = 'good';
        evidence = `PPC pages load in avg ${Math.round(avgLoad)}ms`;
      } else {
        health = 'warning';
        evidence = `Slow PPC pages: avg ${Math.round(avgLoad)}ms (${slowPages.length} pages > 5s)`;
        recommendation = 'PPC landing pages should load in under 3 seconds to minimize bounce rate from paid traffic.';
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-speed', name: 'PPC Page Speed', weight: 0.4, health, evidence, recommendation }));
    }
  }

  // ─── Step 6: CTA & Trust Signal analysis (from ContentAnalyzer) ────────
  if (ctx.contentAnalysis) {
    data.ctaAnalysis = {
      totalCTAs: ctx.contentAnalysis.ctas.length,
      ctaAboveFold: ctx.contentAnalysis.ctaAboveFold,
      ctas: ctx.contentAnalysis.ctas,
    };
    data.trustSignals = ctx.contentAnalysis.trustSignals;
  }

  // CP: CTA Presence
  {
    if (ctx.contentAnalysis) {
      const { ctas, ctaAboveFold } = ctx.contentAnalysis;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (ctaAboveFold > 0) {
        health = 'excellent';
        evidence = `${ctas.length} CTA(s) detected, ${ctaAboveFold} above the fold`;
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

  // CP: Trust Signals
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
