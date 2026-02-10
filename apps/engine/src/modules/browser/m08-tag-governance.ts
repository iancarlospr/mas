/**
 * M08 - Tag Governance
 *
 * Audits tag management system configuration, dataLayer structure,
 * tag firing patterns, consent compliance, server-side tagging,
 * and identifies governance issues (duplicate TMS, piggyback chains, etc.).
 *
 * Checkpoints:
 *   1. TMS present
 *   2. Multiple TMS conflict
 *   3. dataLayer structure
 *   4. Tag firing on page load
 *   5. Consent-aware tag firing
 *   6. Tag load performance
 *   7. Server-side tagging
 *   8. Custom HTML tag security
 *   9. Piggyback tag detection
 *  10. Container ID count
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TMSInfo {
  name: string;
  containers: string[];
  confidence: number;
}

interface DataLayerAnalysis {
  length: number;
  keys: string[];
  hasEcommerce: boolean;
  hasUserData: boolean;
  hasPageData: boolean;
  events: string[];
}

interface TagFiringAudit {
  totalTagRequests: number;
  failedRequests: number;
  byCategory: Record<string, number>;
  preConsentFires: number;
  blockingScripts: number;
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
      moduleId: 'M08' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M08',
    };
  }

  // ─── Step 1: Detect TMS providers and container IDs ──────────────────────
  const evalResult = await page.evaluate((): {
    tms: TMSInfo[];
    dataLayer: DataLayerAnalysis;
    customHtmlTags: number;
    serverSideIndicators: boolean;
    consentMode: { active: boolean; platform: string | null };
  } => {
    const tms: TMSInfo[] = [];
    const w = window as unknown as Record<string, unknown>;

    // --- GTM ---
    const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
    const gtmContainers: string[] = [];
    if (gtmObj) {
      for (const key of Object.keys(gtmObj)) {
        if (key.startsWith('GTM-')) gtmContainers.push(key);
      }
    }
    // Also check for GTM scripts in DOM
    const gtmScripts = document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]');
    gtmScripts.forEach((script) => {
      const src = (script as HTMLScriptElement).src;
      const match = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (match?.[1] && !gtmContainers.includes(match[1])) gtmContainers.push(match[1]);
    });
    // Also check noscript iframes
    const noscriptIframes = document.querySelectorAll('noscript iframe[src*="googletagmanager"]');
    noscriptIframes.forEach((iframe) => {
      const src = (iframe as HTMLIFrameElement).src;
      const match = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (match?.[1] && !gtmContainers.includes(match[1])) gtmContainers.push(match[1]);
    });
    if (gtmContainers.length > 0) {
      tms.push({ name: 'Google Tag Manager', containers: [...new Set(gtmContainers)], confidence: 0.99 });
    }

    // --- Tealium ---
    if (w['utag'] || w['utag_data']) {
      const profile = (w['utag'] as Record<string, unknown>)?.['cfg']?.toString() || 'unknown';
      tms.push({ name: 'Tealium iQ', containers: [profile], confidence: 0.9 });
    }

    // --- Adobe Launch ---
    if (w['_satellite']) {
      const container = ((w['_satellite'] as Record<string, unknown>)?.['property'] as Record<string, unknown>)?.['name']?.toString() || 'unknown';
      tms.push({ name: 'Adobe Launch', containers: [container], confidence: 0.9 });
    }

    // --- Ensighten ---
    if (w['Bootstrapper'] && document.querySelector('script[src*="ensighten"]')) {
      tms.push({ name: 'Ensighten', containers: ['default'], confidence: 0.8 });
    }

    // --- dataLayer analysis ---
    const rawDl = (w['dataLayer'] as Array<Record<string, unknown>>) || [];
    const dlKeys = new Set<string>();
    const dlEvents: string[] = [];
    let hasEcommerce = false;
    let hasUserData = false;
    let hasPageData = false;

    for (const entry of rawDl) {
      if (!entry || typeof entry !== 'object') continue;
      for (const key of Object.keys(entry)) {
        dlKeys.add(key);
        if (key === 'event' && typeof entry[key] === 'string') dlEvents.push(entry[key] as string);
        if (key === 'ecommerce' || key === 'transactionId') hasEcommerce = true;
        if (key === 'user' || key === 'userId' || key === 'user_id' || key === 'userType') hasUserData = true;
        if (key === 'page' || key === 'pageName' || key === 'pageType' || key === 'pageCategory') hasPageData = true;
      }
    }

    const dlAnalysis: DataLayerAnalysis = {
      length: rawDl.length,
      keys: Array.from(dlKeys),
      hasEcommerce,
      hasUserData,
      hasPageData,
      events: [...new Set(dlEvents)],
    };

    // --- Custom HTML tags ---
    let customHtmlTags = 0;
    const inlineScripts = document.querySelectorAll('script:not([src])');
    inlineScripts.forEach((script) => {
      const text = (script as HTMLScriptElement).textContent || '';
      // Heuristic: inline scripts injected by TMS often have markers
      if (text.includes('customTask') || text.includes('__TAG_ASSISTANT') || text.length > 500) {
        customHtmlTags++;
      }
    });

    // --- Server-side indicators ---
    let serverSideIndicators = false;
    // Check for transport_url in GTM config (sGTM indicator)
    for (const entry of rawDl) {
      if (entry && typeof entry === 'object') {
        const flat = JSON.stringify(entry);
        if (flat.includes('transport_url') || flat.includes('server_container_url')) {
          serverSideIndicators = true;
          break;
        }
      }
    }

    // --- Consent mode ---
    let consentActive = false;
    let consentPlatform: string | null = null;
    for (const entry of rawDl) {
      if (Array.isArray(entry) && entry[0] === 'consent') {
        consentActive = true;
        break;
      }
    }
    if (w['OneTrust'] || w['OptanonWrapper']) consentPlatform = 'OneTrust';
    else if (w['Cookiebot'] || w['CookieConsent']) consentPlatform = 'Cookiebot';
    else if (w['__tcfapi']) consentPlatform = 'TCF CMP';

    return {
      tms,
      dataLayer: dlAnalysis,
      customHtmlTags,
      serverSideIndicators,
      consentMode: { active: consentActive, platform: consentPlatform },
    };
  });

  data.tms = evalResult.tms;
  data.dataLayer = evalResult.dataLayer;
  data.serverSideIndicators = evalResult.serverSideIndicators;

  // ─── Step 2: Tag firing audit from network ───────────────────────────────
  const tagRequests = nc?.getTagManagerRequests() ?? [];
  const analyticsRequests = nc?.getAnalyticsRequests() ?? [];
  const adRequests = nc?.getAdvertisingRequests() ?? [];
  const allRequests = nc?.getAllRequests() ?? [];

  const totalTagRequests = tagRequests.length + analyticsRequests.length + adRequests.length;
  const failedResponses = nc?.getAllResponses().filter(r => r.status >= 400) ?? [];
  const tagFailures = failedResponses.filter(r =>
    /googletagmanager|analytics|facebook\.com\/tr|doubleclick|tealium|ensighten/.test(r.url),
  ).length;

  // Count blocking scripts
  const blockingScripts = allRequests.filter(r =>
    r.resourceType === 'script' && r.category !== 'first_party',
  ).length;

  const audit: TagFiringAudit = {
    totalTagRequests,
    failedRequests: tagFailures,
    byCategory: {
      tag_manager: tagRequests.length,
      analytics: analyticsRequests.length,
      advertising: adRequests.length,
    },
    preConsentFires: 0, // Would need pre/post consent comparison
    blockingScripts,
  };
  data.tagAudit = audit;

  // Detect piggyback chains (tags that load other tags)
  const thirdPartyDomains = nc?.getThirdPartyDomains() ?? [];
  // Simple heuristic: if we see many unique third-party domains, it suggests piggyback loading
  const piggybackEstimate = Math.max(0, thirdPartyDomains.length - 10);
  data.thirdPartyDomains = thirdPartyDomains;
  data.piggybackEstimate = piggybackEstimate;

  // ─── Step 3: Build signals ───────────────────────────────────────────────
  for (const tmsInfo of evalResult.tms) {
    signals.push(
      createSignal({
        type: 'tag_manager',
        name: tmsInfo.name,
        confidence: tmsInfo.confidence,
        evidence: `${tmsInfo.name} (${tmsInfo.containers.join(', ')})`,
        category: 'tag_governance',
      }),
    );
  }

  // ─── Step 4: Build checkpoints ───────────────────────────────────────────
  const allTms = evalResult.tms;
  const totalContainers = allTms.reduce((sum, t) => sum + t.containers.length, 0);

  // CP1: TMS present
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const hasHardcodedTags = allRequests.filter(r =>
      r.category !== 'first_party' && r.category !== 'cdn' && r.category !== 'font' &&
      r.resourceType === 'script',
    ).length;

    if (allTms.length === 1 && hasHardcodedTags < 3) {
      health = 'excellent';
      evidence = `Single TMS (${allTms[0]!.name}) managing most tags`;
    } else if (allTms.length >= 1) {
      health = 'good';
      evidence = `TMS present: ${allTms.map(t => t.name).join(', ')}${hasHardcodedTags > 5 ? ` (but ${hasHardcodedTags} hard-coded third-party scripts)` : ''}`;
    } else if (hasHardcodedTags > 0) {
      health = 'warning';
      evidence = `No TMS detected — ${hasHardcodedTags} third-party scripts loaded directly`;
      recommendation = 'Implement a tag manager (GTM) to centralize and govern all third-party tags.';
    } else {
      health = 'good';
      evidence = 'No TMS needed (minimal third-party scripts)';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-tms-present', name: 'Tag Management System', weight: 0.7, health, evidence, recommendation }));
  }

  // CP2: Multiple TMS conflict
  {
    if (allTms.length > 1) {
      checkpoints.push(
        createCheckpoint({
          id: 'm08-multi-tms',
          name: 'Multiple TMS Conflict',
          weight: 0.6,
          health: 'critical',
          evidence: `Multiple TMS detected: ${allTms.map(t => t.name).join(' + ')} — this creates governance, performance, and data consistency issues`,
          recommendation: 'Consolidate to a single tag manager. Running multiple TMS causes race conditions and duplicated tags.',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({ id: 'm08-multi-tms', name: 'Multiple TMS Conflict', weight: 0.6, health: 'excellent', evidence: allTms.length === 1 ? 'Single TMS only' : 'No TMS conflicts (0 or 1 TMS)' }),
      );
    }
  }

  // CP3: dataLayer structure
  {
    const dl = evalResult.dataLayer;
    let health: CheckpointHealth;
    let evidence: string;

    if (dl.length > 3 && (dl.hasEcommerce || dl.hasUserData) && dl.hasPageData) {
      health = 'excellent';
      evidence = `Rich dataLayer: ${dl.length} entries, ${dl.keys.length} keys${dl.hasEcommerce ? ', ecommerce' : ''}${dl.hasUserData ? ', user data' : ''}`;
    } else if (dl.length > 0 && dl.keys.length > 3) {
      health = 'good';
      evidence = `dataLayer present: ${dl.length} entries, ${dl.keys.length} keys`;
    } else if (dl.length > 0) {
      health = 'warning';
      evidence = `dataLayer exists but minimal (${dl.length} entries, ${dl.keys.length} keys)`;
    } else if (allTms.some(t => t.name === 'Google Tag Manager')) {
      health = 'warning';
      evidence = 'GTM detected but no dataLayer found';
    } else {
      health = 'good';
      evidence = 'No dataLayer (not using GTM)';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-datalayer', name: 'dataLayer Structure', weight: 0.7, health, evidence }));
  }

  // CP4: Tag firing on page load
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (totalTagRequests > 0 && tagFailures === 0) {
      health = 'excellent';
      evidence = `${totalTagRequests} tag requests, all successful`;
    } else if (totalTagRequests > 0 && tagFailures <= totalTagRequests * 0.1) {
      health = 'good';
      evidence = `${totalTagRequests} tag requests, ${tagFailures} failed (${Math.round(tagFailures / totalTagRequests * 100)}%)`;
    } else if (totalTagRequests > 0) {
      health = 'warning';
      evidence = `${totalTagRequests} tag requests, ${tagFailures} failed (${Math.round(tagFailures / totalTagRequests * 100)}%)`;
    } else {
      health = 'good';
      evidence = 'No tag-related network requests detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-tag-firing', name: 'Tag Firing on Page Load', weight: 0.5, health, evidence }));
  }

  // CP5: Consent-aware tag firing
  {
    const cm = evalResult.consentMode;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (cm.active && cm.platform) {
      health = 'excellent';
      evidence = `Consent Mode active via ${cm.platform} — tags respect consent state`;
    } else if (cm.active) {
      health = 'good';
      evidence = 'Consent Mode active (no CMP platform identified)';
    } else if (cm.platform) {
      health = 'warning';
      evidence = `CMP (${cm.platform}) present but Google Consent Mode not configured`;
      recommendation = 'Connect your CMP to Google Consent Mode for proper tag gating.';
    } else if (totalTagRequests > 5) {
      health = 'warning';
      evidence = `${totalTagRequests} tag requests fire without consent management`;
      recommendation = 'Implement consent-aware tag firing to comply with GDPR/CCPA.';
    } else {
      health = 'good';
      evidence = 'Minimal tags — consent management may not be required';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-consent-tags', name: 'Consent-Aware Tag Firing', weight: 0.8, health, evidence, recommendation }));
  }

  // CP6: Tag load performance
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (blockingScripts <= 2) {
      health = 'excellent';
      evidence = `Minimal blocking: ${blockingScripts} third-party scripts`;
    } else if (blockingScripts <= 5) {
      health = 'good';
      evidence = `${blockingScripts} third-party scripts loaded`;
    } else if (blockingScripts <= 10) {
      health = 'warning';
      evidence = `${blockingScripts} third-party scripts — may impact page load`;
      recommendation = 'Move non-essential tags to fire after page load or use async loading.';
    } else {
      health = 'critical';
      evidence = `Heavy tag load: ${blockingScripts} third-party scripts`;
      recommendation = 'Significant tag bloat — audit and remove unnecessary tags, consolidate via server-side tagging.';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-tag-perf', name: 'Tag Load Performance', weight: 0.5, health, evidence, recommendation }));
  }

  // CP7: Server-side tagging
  {
    checkpoints.push(
      evalResult.serverSideIndicators
        ? createCheckpoint({ id: 'm08-sst', name: 'Server-Side Tagging', weight: 0.4, health: 'excellent', evidence: 'Server-side tagging indicators detected (transport_url or server container)' })
        : infoCheckpoint({ id: 'm08-sst', name: 'Server-Side Tagging', weight: 0.4, evidence: 'Client-side tagging only — server-side tagging improves data quality and performance' }),
    );
  }

  // CP8: Custom HTML tag security
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (evalResult.customHtmlTags === 0) {
      health = 'excellent';
      evidence = 'No suspicious custom HTML tags detected';
    } else if (evalResult.customHtmlTags <= 3) {
      health = 'good';
      evidence = `${evalResult.customHtmlTags} custom HTML tag(s) — review for security`;
    } else {
      health = 'warning';
      evidence = `${evalResult.customHtmlTags} custom HTML tags detected (potential security risk)`;
      recommendation = 'Audit all custom HTML tags in your TMS for credential exposure and XSS vulnerabilities.';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-custom-html', name: 'Custom HTML Tag Security', weight: 0.5, health, evidence, recommendation }));
  }

  // CP9: Piggyback tag detection
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (piggybackEstimate <= 2) {
      health = 'excellent';
      evidence = `No significant piggyback chains detected (${thirdPartyDomains.length} third-party domains)`;
    } else if (piggybackEstimate <= 5) {
      health = 'good';
      evidence = `${thirdPartyDomains.length} third-party domains — some piggyback loading likely`;
    } else {
      health = 'warning';
      evidence = `${thirdPartyDomains.length} third-party domains — likely piggyback tag chains`;
    }

    checkpoints.push(createCheckpoint({ id: 'm08-piggyback', name: 'Piggyback Tag Detection', weight: 0.4, health, evidence }));
  }

  // CP10: Container ID count
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (totalContainers === 1) {
      health = 'excellent';
      evidence = '1 container — clean governance';
    } else if (totalContainers === 2) {
      health = 'good';
      evidence = '2 containers (likely staging + production)';
    } else if (totalContainers >= 3) {
      health = 'warning';
      evidence = `${totalContainers} containers detected — potential governance issue`;
      recommendation = 'Review containers for orphaned or test containers that should be removed.';
    } else {
      health = 'good';
      evidence = 'No TMS containers (no TMS detected)';
    }

    checkpoints.push(createCheckpoint({ id: 'm08-container-count', name: 'Container ID Count', weight: 0.3, health, evidence, recommendation }));
  }

  data.tmsCount = allTms.length;
  data.containerCount = totalContainers;

  return {
    moduleId: 'M08' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

registerModuleExecutor('M08' as ModuleId, execute);
