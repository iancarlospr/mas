/**
 * M06b - PPC Landing Page Audit
 *
 * Discovers hidden PPC landing pages by probing common paid-traffic
 * URL patterns, then audits their tracking parity against the main page.
 *
 * Checkpoints:
 *   1. PPC page discovery
 *   2. Tracking script parity
 *   3. GA4/GTM parity
 *   4. Enhanced conversions parity
 *   5. Consent compliance parity
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { probeUrl } from '../../utils/url.js';

// ---------------------------------------------------------------------------
// PPC path patterns to probe
// ---------------------------------------------------------------------------

const PPC_PATHS = [
  '/lp/', '/landing/', '/go/', '/get/', '/offer/', '/promo/',
  '/campaign/', '/demo/', '/free-trial/', '/request-demo/',
  '/signup/', '/start/', '/try/', '/book/', '/schedule/',
];

interface DiscoveredPage {
  url: string;
  status: number;
  path: string;
  hasGA4: boolean;
  hasGTM: boolean;
  hasMetaPixel: boolean;
  hasConsent: boolean;
  trackingScripts: string[];
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

  // ─── Step 2: For each discovered page, check tracking parity ─────────────
  const page = ctx.page;
  const maxPages = 3; // Limit to avoid timeout

  for (const found of validPages.slice(0, maxPages)) {
    if (!page) break;

    try {
      await page.goto(found.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(2000);

      const audit = await page.evaluate((): Omit<DiscoveredPage, 'url' | 'status' | 'path'> => {
        const w = window as unknown as Record<string, unknown>;

        const hasGA4 = !!(w['gtag'] || w['google_tag_data']);
        const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
        const hasGTM = !!(gtmObj && Object.keys(gtmObj).some(k => k.startsWith('GTM-')));
        const hasMetaPixel = typeof w['fbq'] === 'function';
        const hasConsent = !!(w['OneTrust'] || w['Cookiebot'] || w['__tcfapi']);

        const trackingScripts: string[] = [];
        if (hasGA4) trackingScripts.push('GA4');
        if (hasGTM) trackingScripts.push('GTM');
        if (hasMetaPixel) trackingScripts.push('Meta Pixel');
        if (w['ttq']) trackingScripts.push('TikTok');
        if (w['_linkedin_partner_id']) trackingScripts.push('LinkedIn');
        if (w['uetq']) trackingScripts.push('Microsoft Ads');

        return { hasGA4, hasGTM, hasMetaPixel, hasConsent, trackingScripts };
      });

      discovered.push({ ...found, ...audit });
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
  data.probedPaths = PPC_PATHS.length;
  data.foundCount = discovered.length;

  // ─── Step 3: Get main page baseline from M05/M06 results ────────────────
  const m05Data = (ctx.previousResults.get('M05' as ModuleId)?.data ?? {}) as Record<string, unknown>;
  const m06Data = (ctx.previousResults.get('M06' as ModuleId)?.data ?? {}) as Record<string, unknown>;

  const mainToolNames = (m05Data['toolNames'] as string[]) ?? [];
  const mainHasGA4 = mainToolNames.includes('Google Analytics 4');
  const mainHasGTM = mainToolNames.includes('Google Tag Manager');
  const mainPixelNames = (m06Data['pixelNames'] as string[]) ?? [];

  // ─── Step 4: Build signals ───────────────────────────────────────────────
  for (const pg of discovered) {
    signals.push(
      createSignal({
        type: 'ppc_page',
        name: `PPC Landing: ${pg.path}`,
        confidence: 0.85,
        evidence: `Discovered at ${pg.url} (status ${pg.status})`,
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
      evidence = `Found ${discovered.length} PPC page(s): ${discovered.map(p => p.path).join(', ')}`;
    } else {
      health = 'good';
      evidence = `No PPC landing pages found at standard paths (probed ${PPC_PATHS.length} patterns)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm06b-discovery', name: 'PPC Page Discovery', weight: 0.8, health, evidence }));
  }

  if (discovered.length === 0) {
    // No PPC pages found — skip parity checks
    checkpoints.push(infoCheckpoint({ id: 'm06b-parity', name: 'Tracking Parity', weight: 0.9, evidence: 'No PPC pages to audit — parity check skipped' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-ga4-parity', name: 'GA4/GTM Parity', weight: 0.8, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-enhanced-parity', name: 'Enhanced Conversions Parity', weight: 0.7, evidence: 'N/A — no PPC pages' }));
    checkpoints.push(infoCheckpoint({ id: 'm06b-consent-parity', name: 'Consent Compliance Parity', weight: 0.8, evidence: 'N/A — no PPC pages' }));
  } else {
    // CP2: Tracking script parity
    {
      const mainScripts = new Set([...mainToolNames, ...mainPixelNames]);
      let totalParity = 0;

      for (const pg of discovered) {
        const pgScripts = new Set(pg.trackingScripts);
        const intersection = [...mainScripts].filter(s => pgScripts.has(s)).length;
        totalParity += mainScripts.size > 0 ? intersection / mainScripts.size : 1;
      }
      const avgParity = totalParity / discovered.length;

      let health: CheckpointHealth;
      let evidence: string;

      if (avgParity >= 0.8) {
        health = 'excellent';
        evidence = `${Math.round(avgParity * 100)}% tracking parity across PPC pages`;
      } else if (avgParity >= 0.5) {
        health = 'warning';
        evidence = `${Math.round(avgParity * 100)}% tracking parity — some scripts missing on PPC pages`;
      } else {
        health = 'critical';
        evidence = `${Math.round(avgParity * 100)}% parity — major tracking gaps on PPC pages`;
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-parity', name: 'Tracking Script Parity', weight: 0.9, health, evidence }));
    }

    // CP3: GA4/GTM parity
    {
      const ga4Missing = discovered.filter(p => mainHasGA4 && !p.hasGA4);
      const gtmMissing = discovered.filter(p => mainHasGTM && !p.hasGTM);
      const issues = ga4Missing.length + gtmMissing.length;

      let health: CheckpointHealth;
      let evidence: string;

      if (issues === 0) {
        health = 'excellent';
        evidence = 'GA4/GTM consistent across all PPC pages';
      } else {
        health = 'critical';
        evidence = `${ga4Missing.length} PPC page(s) missing GA4, ${gtmMissing.length} missing GTM`;
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-ga4-parity', name: 'GA4/GTM Parity', weight: 0.8, health, evidence }));
    }

    // CP4: Enhanced conversions parity (simplified)
    {
      checkpoints.push(infoCheckpoint({ id: 'm06b-enhanced-parity', name: 'Enhanced Conversions Parity', weight: 0.7, evidence: `Enhanced conversion parity requires deeper page analysis — ${discovered.length} PPC pages found for manual review` }));
    }

    // CP5: Consent compliance parity
    {
      const consentMissing = discovered.filter(p => !p.hasConsent);
      const m05Consent = (m05Data['consent'] as Record<string, unknown>)?.consentPlatform;

      let health: CheckpointHealth;
      let evidence: string;

      if (!m05Consent) {
        health = 'good';
        evidence = 'No consent platform on main site — parity N/A';
      } else if (consentMissing.length === 0) {
        health = 'excellent';
        evidence = 'Consent banner present on all PPC pages';
      } else {
        health = 'critical';
        evidence = `${consentMissing.length}/${discovered.length} PPC pages missing consent banner`;
      }

      checkpoints.push(createCheckpoint({ id: 'm06b-consent-parity', name: 'Consent Compliance Parity', weight: 0.8, health, evidence }));
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

registerModuleExecutor('M06b' as ModuleId, execute);
