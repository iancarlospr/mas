/**
 * M06 - Paid Media Infrastructure
 *
 * Detects advertising pixels, conversion events, click ID preservation,
 * attribution cookies, UTM handling, and ad script performance impact.
 *
 * Checkpoints:
 *   1. Ad pixel presence
 *   2. Enhanced conversions
 *   3. Conversion event coverage
 *   4. Click ID capture
 *   5. Attribution cookies
 *   6. UTM parameter handling
 *   7. CAPI / server-side pixels
 *   8. Pixel consent compliance
 *   9. Ad script performance impact
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdPixel {
  name: string;
  id: string | null;
  events: string[];
  hasEnhancedConversions: boolean;
  serverSide: boolean;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const nc = ctx.networkCollector;

  if (!page) {
    return {
      moduleId: 'M06' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M06',
    };
  }

  // ─── Step 1: Detect ad pixels via window globals ─────────────────────────
  const pixels = await page.evaluate((): AdPixel[] => {
    const found: AdPixel[] = [];
    const w = window as unknown as Record<string, unknown>;

    // --- Meta/Facebook Pixel ---
    const fbq = w['fbq'] as ((...args: unknown[]) => void) & { _i?: unknown[]; getState?: () => Record<string, unknown> } | undefined;
    if (typeof fbq === 'function') {
      const pixelIds: string[] = [];
      const events: string[] = [];
      // Extract pixel IDs from fbq queue
      const fbqQueue = (w['_fbq'] as Record<string, unknown>)?.['loaded'] as Record<string, unknown>[] | undefined;
      if (Array.isArray(fbq._i)) {
        for (const entry of fbq._i) {
          if (Array.isArray(entry) && typeof entry[0] === 'string') pixelIds.push(entry[0]);
        }
      }
      // Check callMethod queue for events
      const fbqCalls = (w['_fbq'] as Record<string, unknown>)?.['callMethod'] as unknown[] | undefined;
      if (Array.isArray((w['fbq'] as Record<string, unknown>)?.['queue'])) {
        for (const call of (w['fbq'] as Record<string, unknown>)['queue'] as unknown[][]) {
          if (Array.isArray(call) && call[0] === 'track' && typeof call[1] === 'string') events.push(call[1]);
        }
      }
      const hasAdvancedMatching = !!(fbq.getState?.()?.['pixelInitialized']);
      found.push({
        name: 'Meta Pixel',
        id: pixelIds[0] ?? null,
        events: [...new Set(events)],
        hasEnhancedConversions: hasAdvancedMatching,
        serverSide: false,
        confidence: 0.95,
      });
    }

    // --- Google Ads ---
    const gtag = w['gtag'] as ((...args: unknown[]) => void) | undefined;
    if (typeof gtag === 'function') {
      const awIds: string[] = [];
      const conversionLabels: string[] = [];
      const dl = (w['dataLayer'] as Array<Record<string, unknown>>) || [];
      for (const entry of dl) {
        if (Array.isArray(entry)) {
          const arr = entry as unknown[];
          if (arr[0] === 'config' && typeof arr[1] === 'string' && (arr[1] as string).startsWith('AW-')) {
            awIds.push(arr[1] as string);
          }
          if (arr[0] === 'event' && arr[1] === 'conversion' && typeof arr[2] === 'object') {
            const label = (arr[2] as Record<string, unknown>)?.['send_to'] as string;
            if (label) conversionLabels.push(label);
          }
        }
      }
      // Also check google_tag_manager for AW- IDs
      const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
      if (gtmObj) {
        for (const key of Object.keys(gtmObj)) {
          if (key.startsWith('AW-')) awIds.push(key);
        }
      }
      const hasEnhanced = dl.some(e => {
        if (!e || typeof e !== 'object') return false;
        return 'user_data' in e || (Array.isArray(e) && (e as unknown[])[2]?.toString().includes('user_data'));
      });
      if (awIds.length > 0) {
        found.push({
          name: 'Google Ads',
          id: awIds[0] ?? null,
          events: conversionLabels.length > 0 ? ['conversion'] : [],
          hasEnhancedConversions: hasEnhanced,
          serverSide: false,
          confidence: 0.95,
        });
      }
    }

    // --- TikTok Pixel ---
    const ttq = w['ttq'] as Record<string, unknown> | undefined;
    if (ttq && typeof ttq['track'] === 'function') {
      found.push({
        name: 'TikTok Pixel',
        id: (ttq['_i'] as string[])?.[0] ?? null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.9,
      });
    }

    // --- LinkedIn Insight Tag ---
    if (w['_linkedin_partner_id'] || w['lintrk']) {
      found.push({
        name: 'LinkedIn Insight',
        id: (w['_linkedin_partner_id'] as string) ?? null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.9,
      });
    }

    // --- Twitter/X Pixel ---
    const twq = w['twq'] as Record<string, unknown> | undefined;
    if (typeof twq === 'function' || (twq && typeof twq['exe'] === 'function')) {
      found.push({
        name: 'Twitter/X Pixel',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
      });
    }

    // --- Pinterest Tag ---
    const pintrk = w['pintrk'] as Record<string, unknown> | undefined;
    if (typeof pintrk === 'function') {
      found.push({
        name: 'Pinterest Tag',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
      });
    }

    // --- Snapchat Pixel ---
    const snaptr = w['snaptr'] as Record<string, unknown> | undefined;
    if (typeof snaptr === 'function') {
      found.push({
        name: 'Snapchat Pixel',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
      });
    }

    // --- Microsoft/Bing UET ---
    if (w['uetq'] || w['UET']) {
      found.push({
        name: 'Microsoft Ads (UET)',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.9,
      });
    }

    // --- Reddit Pixel ---
    const rdt = w['rdt'] as Record<string, unknown> | undefined;
    if (typeof rdt === 'function') {
      found.push({
        name: 'Reddit Pixel',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
      });
    }

    // --- Criteo ---
    if (w['criteo_q'] || w['Criteo']) {
      found.push({
        name: 'Criteo',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.85,
      });
    }

    // --- Taboola ---
    if (w['_tfa'] || w['TRC']) {
      found.push({
        name: 'Taboola',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
      });
    }

    // --- Outbrain ---
    if (w['obApi'] || w['OBR$']) {
      found.push({
        name: 'Outbrain',
        id: null,
        events: [],
        hasEnhancedConversions: false,
        serverSide: false,
        confidence: 0.8,
      });
    }

    return found;
  });

  data.pixels = pixels;

  // ─── Step 2: Enrich from network requests ────────────────────────────────
  const adRequests = nc?.getAdvertisingRequests() ?? [];
  data.adRequestCount = adRequests.length;

  // Detect server-side conversion API (CAPI) indicators
  let capiDetected = false;
  const allRequests = nc?.getAllRequests() ?? [];
  for (const req of allRequests) {
    if (/graph\.facebook\.com.*events|facebook\.com\/tr.*server/i.test(req.url)) {
      capiDetected = true;
      const metaPixel = pixels.find(p => p.name === 'Meta Pixel');
      if (metaPixel) metaPixel.serverSide = true;
    }
  }
  data.capiDetected = capiDetected;

  // Calculate total ad script bytes
  let adScriptBytes = 0;
  let adScriptCount = 0;
  for (const req of adRequests) {
    if (req.resourceType === 'script') {
      adScriptCount++;
      // Estimate ~50KB per ad script if size unknown
      adScriptBytes += 50_000;
    }
  }
  data.adScriptBytes = adScriptBytes;
  data.adScriptCount = adScriptCount;

  // ─── Step 3: Click IDs and UTMs ──────────────────────────────────────────
  const pageUrl = page.url();
  const urlParams = new URL(pageUrl).searchParams;

  const clickIds: Record<string, string | null> = {};
  const clickIdParams = ['gclid', 'fbclid', 'ttclid', 'li_fat_id', 'msclkid', 'twclid', 'ScCid', 'rdt_cid', 'epik'];
  for (const param of clickIdParams) {
    const val = urlParams.get(param);
    if (val) clickIds[param] = val;
  }
  data.clickIds = clickIds;
  const clickIdCount = Object.keys(clickIds).length;

  const utmParams: Record<string, string | null> = {};
  for (const param of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const val = urlParams.get(param);
    if (val) utmParams[param] = val;
  }
  data.utmParams = utmParams;

  // ─── Step 4: Attribution cookies ─────────────────────────────────────────
  let attributionCookies: Array<{ name: string; domain: string }> = [];
  try {
    const rawCookies = await page.context().cookies();
    const attrPatterns = [/_fbp/, /_fbc/, /_gcl_aw/, /_gcl_au/, /_ttp/, /_uet/, /li_sugr/, /_pin_unauth/];
    attributionCookies = rawCookies
      .filter(c => attrPatterns.some(p => p.test(c.name)))
      .map(c => ({ name: c.name, domain: c.domain }));
  } catch {
    // Cookie access failure is non-fatal
  }
  data.attributionCookies = attributionCookies;

  // ─── Step 5: Build signals ───────────────────────────────────────────────
  for (const pixel of pixels) {
    signals.push(
      createSignal({
        type: 'ad_pixel',
        name: pixel.name,
        confidence: pixel.confidence,
        evidence: pixel.id ? `${pixel.name} (${pixel.id})` : `${pixel.name} detected`,
        category: 'advertising',
      }),
    );
  }

  // ─── Step 6: Build checkpoints ───────────────────────────────────────────
  const hasAnyPixel = pixels.length > 0 || adRequests.length > 0;

  // CP1: Ad pixel presence
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (pixels.length >= 2 && adRequests.length > 0) {
      health = 'excellent';
      evidence = `${pixels.length} ad pixels detected and firing: ${pixels.map(p => p.name).join(', ')}`;
    } else if (pixels.length >= 1 && adRequests.length > 0) {
      health = 'good';
      evidence = `${pixels.length} ad pixel(s) detected: ${pixels.map(p => p.name).join(', ')}`;
    } else if (pixels.length >= 1) {
      health = 'warning';
      evidence = 'Ad pixel script loads but no pixel fires detected in network';
      recommendation = 'Verify pixel initialization — the script may load but not trigger events.';
    } else {
      health = 'critical';
      evidence = 'No advertising pixels detected';
      recommendation = 'If running paid media, install the appropriate conversion pixels (Meta, Google Ads, etc.).';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-pixel-presence', name: 'Ad Pixel Presence', weight: 0.9, health, evidence, recommendation }));
  }

  // CP2: Enhanced conversions
  {
    const hasEnhanced = pixels.some(p => p.hasEnhancedConversions);
    const hasConversion = pixels.some(p => p.events.length > 0);

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (hasEnhanced) {
      health = 'excellent';
      evidence = `Enhanced conversions enabled: ${pixels.filter(p => p.hasEnhancedConversions).map(p => p.name).join(', ')}`;
    } else if (hasConversion) {
      health = 'good';
      evidence = 'Standard conversion tracking detected';
      recommendation = 'Enable Enhanced Conversions (Google Ads) or Advanced Matching (Meta) for better attribution.';
    } else if (hasAnyPixel) {
      health = 'warning';
      evidence = 'Pixels present but no conversion events detected';
      recommendation = 'Configure conversion events (Purchase, Lead, etc.) for proper attribution.';
    } else {
      health = 'critical';
      evidence = 'No conversion tracking infrastructure detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-enhanced-conv', name: 'Enhanced Conversions', weight: 0.7, health, evidence, recommendation }));
  }

  // CP3: Conversion event coverage
  {
    const allEvents = pixels.flatMap(p => p.events);
    const keyEvents = ['Purchase', 'Lead', 'AddToCart', 'ViewContent', 'CompleteRegistration', 'conversion'];
    const foundKeyEvents = allEvents.filter(e => keyEvents.some(ke => e.toLowerCase().includes(ke.toLowerCase())));

    let health: CheckpointHealth;
    let evidence: string;

    if (foundKeyEvents.length >= 2) {
      health = 'excellent';
      evidence = `Key conversion events tracked: ${foundKeyEvents.join(', ')}`;
    } else if (foundKeyEvents.length === 1 || allEvents.length > 0) {
      health = 'good';
      evidence = `Conversion events detected: ${allEvents.join(', ') || 'basic events'}`;
    } else if (hasAnyPixel) {
      health = 'warning';
      evidence = 'Pixels present but no conversion events detected on this page';
    } else {
      health = 'critical';
      evidence = 'No conversion event coverage';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-conv-events', name: 'Conversion Event Coverage', weight: 0.8, health, evidence }));
  }

  // CP4: Click ID capture
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (clickIdCount >= 2) {
      health = 'excellent';
      evidence = `Click IDs preserved: ${Object.keys(clickIds).join(', ')}`;
    } else if (clickIdCount === 1) {
      health = 'good';
      evidence = `Click ID captured: ${Object.keys(clickIds)[0]}`;
    } else {
      // Not necessarily bad — URL may not have click IDs in normal browsing
      health = 'good';
      evidence = 'No click IDs in current URL (normal for organic/direct visits)';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-click-ids', name: 'Click ID Capture', weight: 0.6, health, evidence }));
  }

  // CP5: Attribution cookies
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (attributionCookies.length >= 3) {
      health = 'excellent';
      evidence = `Attribution cookies present: ${attributionCookies.map(c => c.name).join(', ')}`;
    } else if (attributionCookies.length >= 1) {
      health = 'good';
      evidence = `${attributionCookies.length} attribution cookie(s): ${attributionCookies.map(c => c.name).join(', ')}`;
    } else if (hasAnyPixel) {
      health = 'warning';
      evidence = 'Ad pixels present but no attribution cookies set';
    } else {
      health = 'good';
      evidence = 'No attribution cookies (no ad pixels detected)';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-attr-cookies', name: 'Attribution Cookies', weight: 0.5, health, evidence }));
  }

  // CP6: UTM parameter handling
  {
    const hasUtm = Object.keys(utmParams).length > 0;
    checkpoints.push(
      hasUtm
        ? createCheckpoint({ id: 'm06-utm', name: 'UTM Parameter Handling', weight: 0.6, health: 'excellent', evidence: `UTM parameters detected: ${Object.entries(utmParams).map(([k, v]) => `${k}=${v}`).join(', ')}` })
        : infoCheckpoint({ id: 'm06-utm', name: 'UTM Parameter Handling', weight: 0.6, evidence: 'No UTM parameters in current URL (normal for organic/direct)' }),
    );
  }

  // CP7: CAPI / server-side pixels
  {
    const hasServerSide = capiDetected || pixels.some(p => p.serverSide);
    checkpoints.push(
      hasServerSide
        ? createCheckpoint({ id: 'm06-capi', name: 'Server-Side Conversions (CAPI)', weight: 0.5, health: 'excellent', evidence: 'Server-side conversion events detected (CAPI or sGTM)' })
        : infoCheckpoint({ id: 'm06-capi', name: 'Server-Side Conversions (CAPI)', weight: 0.5, evidence: 'Client-side pixels only — server-side CAPI improves attribution accuracy' }),
    );
  }

  // CP8: Pixel consent compliance
  {
    // Check if consent mode was detected in M05 results
    const m05Result = ctx.previousResults.get('M05' as ModuleId);
    const hasConsent = (m05Result?.data as Record<string, unknown>)?.consent;
    const consentPlatform = (hasConsent as Record<string, unknown>)?.consentPlatform;

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (consentPlatform && adRequests.length > 0) {
      health = 'good';
      evidence = `Consent platform (${consentPlatform}) detected alongside ad pixels — manual verification needed for pre-consent fires`;
    } else if (!consentPlatform && adRequests.length > 0) {
      health = 'warning';
      evidence = 'Ad pixels fire but no consent management platform detected';
      recommendation = 'Implement a CMP to gate ad pixel firing until user consent is obtained.';
    } else if (consentPlatform) {
      health = 'excellent';
      evidence = `Consent platform (${consentPlatform}) active, no ad requests fired (may be awaiting consent)`;
    } else {
      health = 'good';
      evidence = 'No ad pixels to gate (consent N/A)';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-pixel-consent', name: 'Pixel Consent Compliance', weight: 0.8, health, evidence, recommendation }));
  }

  // CP9: Ad script performance impact
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (adScriptCount === 0) {
      health = 'excellent';
      evidence = 'No ad scripts detected — zero performance impact';
    } else if (adScriptBytes < 100_000) {
      health = 'excellent';
      evidence = `${adScriptCount} ad scripts (~${Math.round(adScriptBytes / 1024)}KB), async loaded`;
    } else if (adScriptBytes < 200_000) {
      health = 'good';
      evidence = `${adScriptCount} ad scripts (~${Math.round(adScriptBytes / 1024)}KB)`;
    } else if (adScriptBytes < 500_000) {
      health = 'warning';
      evidence = `${adScriptCount} ad scripts totaling ~${Math.round(adScriptBytes / 1024)}KB`;
      recommendation = 'Consolidate ad scripts through a tag manager and ensure async loading.';
    } else {
      health = 'critical';
      evidence = `Heavy ad script footprint: ${adScriptCount} scripts (~${Math.round(adScriptBytes / 1024)}KB)`;
      recommendation = 'Significant ad script overhead — consolidate via server-side tagging to reduce client-side weight.';
    }

    checkpoints.push(createCheckpoint({ id: 'm06-ad-perf', name: 'Ad Script Performance Impact', weight: 0.4, health, evidence, recommendation }));
  }

  data.pixelCount = pixels.length;
  data.pixelNames = pixels.map(p => p.name);

  return {
    moduleId: 'M06' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

registerModuleExecutor('M06' as ModuleId, execute);
