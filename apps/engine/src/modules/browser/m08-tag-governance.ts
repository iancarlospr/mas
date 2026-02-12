/**
 * M08 — Tag Governance
 *
 * Audits tag management system configuration, dataLayer structure,
 * tag firing patterns, consent compliance, server-side tagging,
 * and identifies governance issues (duplicate TMS, piggyback chains, etc.).
 *
 * Checkpoints (11):
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
 *  11. Tag firing verification (console SDK logs)
 *
 * DRY with M05 (sGTM), M06 (consent events).
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type {
  ModuleResult,
  ModuleId,
  Signal,
  Checkpoint,
  CheckpointHealth,
} from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { ThirdPartyProfiler } from '../../utils/third-party-profiler.js';

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
  customEvents: string[];
  systemEvents: string[];
}

interface TagFiringAudit {
  totalTagRequests: number;
  failedRequests: number;
  byCategory: Record<string, number>;
  blockingScripts: number;
  asyncScripts: number;
}

// Known ad/tracker domains that are intentionally loaded (not piggyback)
const KNOWN_INTENTIONAL_DOMAINS = new Set([
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'googleads.g.doubleclick.net',
  'doubleclick.net',
  'googleadservices.com',
  'facebook.net',
  'facebook.com',
  'linkedin.com',
  'licdn.com',
  'twitter.com',
  'ads-twitter.com',
  't.co',
  'tiktok.com',
  'tiktokw.us',
  'bing.com',
  'bing.net',
  'amazon-adsystem.com',
  'googleapis.com',
  'google.com',
  'gstatic.com',
  'cloudflare.com',
  'cloudflareinsights.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
]);

// GTM system events (not custom)
const GTM_SYSTEM_EVENTS = new Set([
  'gtm.js',
  'gtm.dom',
  'gtm.load',
  'gtm.init',
  'gtm.init_consent',
  'gtm.historyChange',
  'gtm.timer',
  'gtm.scrollDepth',
  'gtm.click',
  'gtm.linkClick',
  'gtm.formSubmit',
  'gtm.video',
]);

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

  // ─── Step 1: Browser-side detection ────────────────────────────────────
  const evalResult = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const d = document;

    // --- TMS detection ---
    const tms: Array<{ name: string; containers: string[]; confidence: number }> = [];

    // GTM — separate real GTM containers (GTM-XXXX) from GA4 measurement IDs (G-XXXXXXXXXX)
    const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
    const gtmContainers: string[] = [];
    const ga4MeasurementIds: string[] = [];
    if (gtmObj) {
      for (const key of Object.keys(gtmObj)) {
        if (key.startsWith('GTM-')) {
          gtmContainers.push(key);
        } else if (/^G-[A-Z0-9]{6,}$/.test(key)) {
          // Valid GA4 measurement IDs (min 6 chars after G-), not containers
          ga4MeasurementIds.push(key);
        }
        // Skip fragments like "G-X", internal keys, etc.
      }
    }
    d.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]').forEach((script) => {
      const m = (script as HTMLScriptElement).src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (m?.[1] && !gtmContainers.includes(m[1])) gtmContainers.push(m[1]);
    });
    d.querySelectorAll('noscript iframe[src*="googletagmanager"]').forEach((iframe) => {
      const m = (iframe as HTMLIFrameElement).src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (m?.[1] && !gtmContainers.includes(m[1])) gtmContainers.push(m[1]);
    });
    if (gtmContainers.length > 0 || ga4MeasurementIds.length > 0) {
      tms.push({
        name: 'Google Tag Manager',
        containers: [...new Set(gtmContainers)],
        confidence: 0.99,
      });
    }

    // Tealium
    if (w['utag'] != null || w['utag_data'] != null) {
      const cfg = (w['utag'] as Record<string, unknown>)?.['cfg']?.toString() || 'unknown';
      tms.push({ name: 'Tealium iQ', containers: [cfg], confidence: 0.9 });
    }

    // Adobe Launch
    if (w['_satellite'] != null) {
      const propName = ((w['_satellite'] as Record<string, unknown>)?.['property'] as Record<string, unknown>)?.['name']?.toString() || 'unknown';
      tms.push({ name: 'Adobe Launch', containers: [propName], confidence: 0.9 });
    }

    // Ensighten
    if (w['Bootstrapper'] != null && d.querySelector('script[src*="ensighten"]')) {
      tms.push({ name: 'Ensighten', containers: ['default'], confidence: 0.8 });
    }

    // Matomo Tag Manager
    if (w['MatomoTagManager'] != null) {
      tms.push({ name: 'Matomo Tag Manager', containers: ['default'], confidence: 0.85 });
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

    // --- Consent detection (comprehensive) ---
    let consentActive = false;
    let consentPlatform: string | null = null;

    // Check gtag consent pattern: ['consent', 'default', {...}]
    for (const entry of rawDl) {
      if (Array.isArray(entry) && entry[0] === 'consent') {
        consentActive = true;
        break;
      }
    }

    // Check for consent-related dataLayer events
    const consentEvents = dlEvents.filter(
      (e) =>
        e.includes('consent') ||
        e === 'update_consent_state' ||
        e === 'gtm_consent_update' ||
        e === 'cookie_consent_update' ||
        e === 'consent_update',
    );
    if (consentEvents.length > 0) consentActive = true;

    // Check for consent-related dataLayer keys
    if (dlKeys.has('ad_storage') || dlKeys.has('analytics_storage') || dlKeys.has('necessary')) {
      consentActive = true;
    }

    // CMP platform detection — expanded
    if (w['OneTrust'] != null || w['OptanonWrapper'] != null) consentPlatform = 'OneTrust';
    else if (w['Cookiebot'] != null) consentPlatform = 'Cookiebot';
    else if (w['__tcfapi'] != null) consentPlatform = 'TCF CMP';
    else if (w['CookieConsent'] != null) consentPlatform = 'CookieConsent';
    else if (d.querySelector('[class*="hs-cookie"], [id*="hs-cookie"], .hs-banner, script[src*="hs-banner.com"]'))
      consentPlatform = 'HubSpot Cookie Banner';
    else if (d.querySelector('#onetrust-consent-sdk')) consentPlatform = 'OneTrust';
    else if (d.querySelector('#CookiebotWidget, #CybotCookiebotDialog')) consentPlatform = 'Cookiebot';
    else if (d.querySelector('[class*="cc-banner"], [class*="cookie-consent"]')) consentPlatform = 'Cookie Consent Banner';
    else if (d.querySelector('.iubenda-cs-container, script[src*="iubenda"]')) consentPlatform = 'iubenda';
    else if (d.querySelector('.osano-cm-widget, script[src*="osano"]')) consentPlatform = 'Osano';
    else if (d.querySelector('#usercentrics-root, script[src*="usercentrics"]')) consentPlatform = 'Usercentrics';

    // If we have consent events but no identified platform, check DOM for any banner
    if (consentActive && !consentPlatform) {
      if (d.querySelector('[class*="cookie-banner"], [id*="cookie-banner"], [role="dialog"][class*="cookie"], [class*="consent-banner"]'))
        consentPlatform = 'Custom Cookie Banner';
    }

    // --- Custom HTML tag detection (improved) ---
    let customHtmlTags = 0;
    d.querySelectorAll('script:not([src])').forEach((script) => {
      const el = script as HTMLScriptElement;
      // Skip non-JS scripts (JSON-LD, config, data)
      if (el.type && el.type !== 'text/javascript' && el.type !== '') return;
      const text = el.textContent || '';
      if (text.length < 50) return; // Skip tiny scripts

      // Heuristic: TMS-injected custom HTML tags
      if (
        text.includes('customTask') ||
        text.includes('__TAG_ASSISTANT') ||
        text.includes('document.write') ||
        text.includes('.innerHTML') ||
        (text.includes('createElement') && text.includes('appendChild') && text.length > 300) ||
        (text.match(/https?:\/\/[a-z0-9.-]+\.(js|php|aspx)/gi)?.length ?? 0) >= 2
      ) {
        customHtmlTags++;
      }
    });

    // --- Server-side tagging indicators ---
    let serverSideIndicators = false;
    for (const entry of rawDl) {
      if (entry && typeof entry === 'object') {
        const flat = JSON.stringify(entry);
        if (flat.includes('transport_url') || flat.includes('server_container_url')) {
          serverSideIndicators = true;
          break;
        }
      }
    }

    // --- Script loading analysis ---
    let asyncScriptCount = 0;
    let syncScriptCount = 0;
    d.querySelectorAll('script[src]').forEach((script) => {
      const el = script as HTMLScriptElement;
      const src = el.src || '';
      // Skip first-party and CDN
      if (!src || src.includes(location.hostname)) return;
      if (el.async || el.defer) {
        asyncScriptCount++;
      } else {
        syncScriptCount++;
      }
    });

    return {
      tms,
      ga4MeasurementIds,
      dataLayer: {
        length: rawDl.length,
        keys: Array.from(dlKeys),
        hasEcommerce,
        hasUserData,
        hasPageData,
        events: [...new Set(dlEvents)],
      },
      customHtmlTags,
      serverSideIndicators,
      consentMode: { active: consentActive, platform: consentPlatform },
      consentEvents,
      asyncScriptCount,
      syncScriptCount,
    };
  });

  data.tms = evalResult.tms;
  data.ga4MeasurementIds = evalResult.ga4MeasurementIds;
  data.dataLayer = evalResult.dataLayer;
  data.serverSideIndicators = evalResult.serverSideIndicators;

  // Classify dataLayer events into system vs custom
  const systemEvents = evalResult.dataLayer.events.filter((e) =>
    GTM_SYSTEM_EVENTS.has(e) || e.startsWith('gtm.'),
  );
  const customEvents = evalResult.dataLayer.events.filter(
    (e) => !GTM_SYSTEM_EVENTS.has(e) && !e.startsWith('gtm.'),
  );
  data.dataLayerSystemEvents = systemEvents;
  data.dataLayerCustomEvents = customEvents;

  // ─── Step 2: Tag firing audit from network ─────────────────────────────
  const tagRequests = nc?.getTagManagerRequests() ?? [];
  const analyticsRequests = nc?.getAnalyticsRequests() ?? [];
  const adRequests = nc?.getAdvertisingRequests() ?? [];
  const allRequests = nc?.getAllRequests() ?? [];

  const totalTagRequests = tagRequests.length + analyticsRequests.length + adRequests.length;
  const failedResponses = nc?.getAllResponses().filter((r) => r.status >= 400) ?? [];
  const tagFailures = failedResponses.filter((r) =>
    /googletagmanager|analytics|facebook\.com\/tr|doubleclick|tealium|ensighten/.test(r.url),
  ).length;

  // Count third-party scripts (not "blocking" — that's misleading)
  const tpScriptRequests = allRequests.filter(
    (r) =>
      r.resourceType === 'script' &&
      r.category !== 'first_party' &&
      r.category !== 'cdn' &&
      r.category !== 'font',
  );
  const thirdPartyScripts = tpScriptRequests.length;
  const thirdPartyScriptDomains = new Set(tpScriptRequests.map(r => r.domain).filter(Boolean)).size;

  const audit: TagFiringAudit = {
    totalTagRequests,
    failedRequests: tagFailures,
    byCategory: {
      tag_manager: tagRequests.length,
      analytics: analyticsRequests.length,
      advertising: adRequests.length,
    },
    blockingScripts: evalResult.syncScriptCount,
    asyncScripts: evalResult.asyncScriptCount,
  };
  data.tagAudit = audit;
  data.thirdPartyScriptCount = thirdPartyScripts;

  // Detect piggyback chains — smarter heuristic
  const thirdPartyDomains = nc?.getThirdPartyDomains() ?? [];
  const unknownDomains = thirdPartyDomains.filter(
    (d) => !KNOWN_INTENTIONAL_DOMAINS.has(d),
  );
  // Piggyback estimate: domains that aren't known intentional platforms
  // and subtract a baseline for the site's own subdomains (typically 5-8)
  const siteHostname = new URL(ctx.url).hostname;
  const siteDomainParts = siteHostname.replace(/^www\./, '').split('.').slice(-2).join('.');
  const siteOwnDomains = thirdPartyDomains.filter((d) => d.includes(siteDomainParts));
  const piggybackEstimate = Math.max(
    0,
    unknownDomains.length - siteOwnDomains.length - 3, // 3 = baseline for common CDNs
  );
  data.thirdPartyDomains = thirdPartyDomains;
  data.unknownDomains = unknownDomains;
  data.piggybackEstimate = piggybackEstimate;

  // ─── Step 3: DRY with M05 — check sGTM and consent from previous ──────
  let m05sGTM = false;
  try {
    const m05 = ctx.previousResults?.get('M05' as ModuleId);
    if (m05?.data) {
      m05sGTM = !!(m05.data as Record<string, unknown>)['serverSideTracking'];
    }
  } catch {
    /* standalone test */
  }

  // sGTM: combine M08's own detection with M05 cross-reference
  // Track which detection method found it for clear evidence
  const sstSources: string[] = [];
  if (evalResult.serverSideIndicators) sstSources.push('transport_url in dataLayer');
  if (m05sGTM) sstSources.push('confirmed by analytics module (M05)');

  // Also check network for sGTM patterns (first-party /collect endpoint)
  if (nc) {
    const collectRequests = nc.getByUrlPattern(/\/collect\?.*tid=G-|\/g\/collect\?/);
    for (const req of collectRequests) {
      try {
        const url = new URL(req.url);
        const targetDomain = siteHostname.replace(/^www\./, '');
        if (url.hostname.endsWith(targetDomain) || url.hostname === targetDomain) {
          sstSources.push(`first-party collect endpoint (${url.hostname})`);
          break;
        }
      } catch {
        /* invalid URL */
      }
    }
  }

  const hasSST = sstSources.length > 0;
  data.serverSideIndicators = hasSST;
  data.sstSources = sstSources;

  // ─── Step 4: Build signals ─────────────────────────────────────────────
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

  // ─── Step 5: Build checkpoints ─────────────────────────────────────────
  const allTms = evalResult.tms;
  const totalContainers = allTms.reduce((sum, t) => sum + t.containers.length, 0);

  // CP1: TMS present
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (allTms.length === 1 && thirdPartyScripts < 5) {
      health = 'excellent';
      evidence = `Single TMS (${allTms[0]!.name}) managing most tags`;
    } else if (allTms.length >= 1) {
      health = thirdPartyScripts > 20 ? 'good' : 'excellent';
      evidence = `TMS present: ${allTms.map((t) => t.name).join(', ')}${thirdPartyScripts > 10 ? ` (${thirdPartyScripts} third-party scripts still loaded outside TMS)` : ''}`;
    } else if (thirdPartyScripts > 0) {
      health = 'warning';
      evidence = `No TMS detected — ${thirdPartyScripts} third-party scripts loaded directly`;
      recommendation =
        'Implement a tag manager (GTM) to centralize and govern all third-party tags.';
    } else {
      health = 'good';
      evidence = 'No TMS needed (minimal third-party scripts)';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-tms-present',
        name: 'Tag Management System',
        weight: 0.7,
        health,
        evidence,
        recommendation,
      }),
    );
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
          evidence: `Multiple TMS detected: ${allTms.map((t) => t.name).join(' + ')} — governance, performance, and data consistency issues`,
          recommendation:
            'Consolidate to a single tag manager. Running multiple TMS causes race conditions and duplicated tags.',
        }),
      );
    } else {
      checkpoints.push(
        createCheckpoint({
          id: 'm08-multi-tms',
          name: 'Multiple TMS Conflict',
          weight: 0.6,
          health: 'excellent',
          evidence: allTms.length === 1 ? 'Single TMS only' : 'No TMS conflicts (0 or 1 TMS)',
        }),
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
    } else if (dl.length > 0 && dl.keys.length > 5) {
      health = 'good';
      evidence = `dataLayer present: ${dl.length} entries, ${dl.keys.length} keys (${customEvents.length} custom events: ${customEvents.join(', ')})`;
    } else if (dl.length > 0) {
      health = 'good';
      evidence = `dataLayer present: ${dl.length} entries, ${dl.keys.length} keys`;
    } else if (allTms.some((t) => t.name === 'Google Tag Manager')) {
      health = 'warning';
      evidence = 'GTM detected but no dataLayer found';
    } else {
      health = 'good';
      evidence = 'No dataLayer (not using GTM)';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-datalayer',
        name: 'dataLayer Structure',
        weight: 0.7,
        health,
        evidence,
      }),
    );
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
      evidence = `${totalTagRequests} tag requests, ${tagFailures} failed (${Math.round((tagFailures / totalTagRequests) * 100)}%)`;
    } else if (totalTagRequests > 0) {
      health = 'warning';
      evidence = `${totalTagRequests} tag requests, ${tagFailures} failed (${Math.round((tagFailures / totalTagRequests) * 100)}%)`;
    } else {
      health = 'good';
      evidence = 'No tag-related network requests detected';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-tag-firing',
        name: 'Tag Firing on Page Load',
        weight: 0.5,
        health,
        evidence,
      }),
    );
  }

  // CP5: Consent-aware tag firing (FIXED — now detects HubSpot CMP, consent events)
  {
    const cm = evalResult.consentMode;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (cm.active && cm.platform) {
      health = 'excellent';
      evidence = `Consent management active via ${cm.platform}${evalResult.consentEvents.length > 0 ? ` (events: ${evalResult.consentEvents.join(', ')})` : ''}`;
    } else if (cm.active) {
      health = 'good';
      evidence = `Consent Mode events detected (${evalResult.consentEvents.join(', ')}) — no CMP platform identified`;
    } else if (cm.platform) {
      health = 'warning';
      evidence = `CMP (${cm.platform}) present but Google Consent Mode not configured`;
      recommendation =
        'Connect your CMP to Google Consent Mode for proper tag gating.';
    } else if (totalTagRequests > 5) {
      health = 'warning';
      evidence = `${totalTagRequests} tag requests fire without consent management`;
      recommendation =
        'Implement consent-aware tag firing to comply with GDPR/CCPA.';
    } else {
      health = 'good';
      evidence = 'Minimal tags — consent management may not be required';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-consent-tags',
        name: 'Consent-Aware Tag Firing',
        weight: 0.8,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP6: Tag load performance (improved — distinguishes sync vs async)
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const syncCount = evalResult.syncScriptCount;
    const totalScripts = thirdPartyScripts;
    // Use unique domain count as primary signal — many scripts from 1-2 CDN domains
    // is fundamentally different from scripts scattered across many third-party services.
    const effectiveCount = thirdPartyScriptDomains > 0 ? thirdPartyScriptDomains : totalScripts;

    if (effectiveCount <= 5) {
      health = 'excellent';
      evidence = `Minimal tag footprint: ${totalScripts} third-party scripts from ${thirdPartyScriptDomains} domain(s)`;
    } else if (syncCount <= 3 && effectiveCount <= 20) {
      health = 'good';
      evidence = `${totalScripts} third-party scripts from ${thirdPartyScriptDomains} domain(s) (${syncCount} sync, ${evalResult.asyncScriptCount} async)`;
    } else if (effectiveCount <= 40) {
      health = 'warning';
      evidence = `${totalScripts} third-party scripts from ${thirdPartyScriptDomains} domain(s)${syncCount > 5 ? ` (${syncCount} render-blocking!)` : ''}`;
      recommendation = syncCount > 5
        ? 'Move blocking scripts to async/defer loading or fire them after page load.'
        : 'Consider auditing and removing unnecessary tags.';
    } else {
      health = 'critical';
      evidence = `Heavy tag load: ${totalScripts} third-party scripts from ${thirdPartyScriptDomains} domain(s)${syncCount > 5 ? ` (${syncCount} render-blocking)` : ''}`;
      recommendation =
        'Significant tag bloat — audit and remove unnecessary tags, consolidate via server-side tagging.';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-tag-perf',
        name: 'Tag Load Performance',
        weight: 0.5,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP7: Server-side tagging (enhanced with M05 DRY and network detection)
  {
    checkpoints.push(
      hasSST
        ? createCheckpoint({
            id: 'm08-sst',
            name: 'Server-Side Tagging',
            weight: 0.4,
            health: 'excellent',
            evidence: `Server-side tagging detected: ${sstSources.join(', ')}`,
          })
        : infoCheckpoint({
            id: 'm08-sst',
            name: 'Server-Side Tagging',
            weight: 0.4,
            evidence:
              'Client-side tagging only — server-side tagging improves data quality and performance',
          }),
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
      recommendation =
        'Audit all custom HTML tags in your TMS for credential exposure and XSS vulnerabilities.';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-custom-html',
        name: 'Custom HTML Tag Security',
        weight: 0.5,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP9: Piggyback tag detection (improved — excludes known platforms)
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (piggybackEstimate <= 2) {
      health = 'excellent';
      evidence = `${thirdPartyDomains.length} third-party domains, ${unknownDomains.length} unknown (minimal piggyback risk)`;
    } else if (piggybackEstimate <= 8) {
      health = 'good';
      evidence = `${thirdPartyDomains.length} third-party domains, ${unknownDomains.length} unknown — some piggyback loading possible`;
    } else {
      health = 'warning';
      evidence = `${thirdPartyDomains.length} third-party domains, ${unknownDomains.length} unknown — likely piggyback tag chains`;
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-piggyback',
        name: 'Piggyback Tag Detection',
        weight: 0.4,
        health,
        evidence,
      }),
    );
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
      recommendation =
        'Review containers for orphaned or test containers that should be removed.';
    } else {
      health = 'good';
      evidence = 'No TMS containers (no TMS detected)';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-container-count',
        name: 'Container ID Count',
        weight: 0.3,
        health,
        evidence,
        recommendation,
      }),
    );
  }

  // CP11: Tag Firing Verification (Console SDK logs)
  {
    const sdkLogs = ctx.consoleCollector?.getSDKLogs() ?? [];
    const sdkToolNames = [...new Set(sdkLogs.map(l => l.sdkMatch).filter(Boolean))] as string[];
    const hasTMS = allTms.length > 0;

    let health: CheckpointHealth;
    let evidence: string;

    if (hasTMS && sdkToolNames.length >= 3) {
      health = 'excellent';
      evidence = `TMS loading confirmed: ${sdkToolNames.length} SDK init logs detected (${sdkToolNames.slice(0, 5).join(', ')})`;
    } else if (hasTMS && sdkToolNames.length > 0) {
      health = 'good';
      evidence = `TMS active: ${sdkToolNames.length} SDK init log(s) (${sdkToolNames.join(', ')})`;
    } else if (hasTMS && sdkToolNames.length === 0) {
      health = 'good';
      evidence = 'TMS present but no SDK initialization logs captured (tools may initialize silently)';
    } else {
      health = 'good';
      evidence = 'No TMS — SDK initialization logging check not applicable';
    }

    checkpoints.push(
      createCheckpoint({
        id: 'm08-tag-firing-verify',
        name: 'Tag Firing Verification',
        weight: 0.3,
        health,
        evidence,
      }),
    );
  }

  data.tmsCount = allTms.length;
  data.containerCount = totalContainers;

  // ─── Third-Party Performance Profiling ───────────────────────────────────
  if (ctx.page && ctx.networkCollector) {
    try {
      const domain = new URL(ctx.url).hostname.replace(/^www\./, '');
      const tpAnalysis = await ThirdPartyProfiler.profile(ctx.page, ctx.networkCollector, domain);

      data.thirdPartyProfiles = tpAnalysis.profiles.slice(0, 30);
      data.thirdPartySummary = {
        totalRequests: tpAnalysis.totalThirdPartyRequests,
        totalBytes: tpAnalysis.totalThirdPartyBytes,
        renderBlockingCount: tpAnalysis.renderBlockingCount,
        uniqueDomains: tpAnalysis.uniqueDomains,
      };
    } catch { /* third-party profiling is non-critical */ }
  }

  // CP12: Third-Party Performance Impact
  {
    const summary = data.thirdPartySummary as { totalRequests: number; totalBytes: number; renderBlockingCount: number; uniqueDomains: number } | undefined;
    if (summary) {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (summary.renderBlockingCount > 5) {
        health = 'critical';
        evidence = `${summary.renderBlockingCount} render-blocking third-party resources`;
        recommendation = 'Defer or async-load render-blocking third-party scripts to improve page load speed.';
      } else if (summary.renderBlockingCount > 2) {
        health = 'warning';
        evidence = `${summary.renderBlockingCount} render-blocking third-party resources (${summary.uniqueDomains} domains, ${Math.round(summary.totalBytes / 1024)}KB)`;
        recommendation = 'Consider deferring render-blocking third-party scripts.';
      } else if (summary.totalBytes < 500000) {
        health = 'excellent';
        evidence = `${summary.renderBlockingCount} render-blocking third-party resources, ${Math.round(summary.totalBytes / 1024)}KB total from ${summary.uniqueDomains} domain(s)`;
      } else {
        health = 'good';
        evidence = `${summary.renderBlockingCount} render-blocking third-party resources, ${Math.round(summary.totalBytes / 1024)}KB total from ${summary.uniqueDomains} domain(s)`;
      }

      checkpoints.push(
        createCheckpoint({
          id: 'm08-3p-performance',
          name: 'Third-Party Performance Impact',
          weight: 0.5,
          health,
          evidence,
          recommendation,
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint({
          id: 'm08-3p-performance',
          name: 'Third-Party Performance Impact',
          weight: 0.5,
          evidence: 'Third-party performance profiling data not available',
        }),
      );
    }
  }

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

export { execute };
registerModuleExecutor('M08' as ModuleId, execute);
