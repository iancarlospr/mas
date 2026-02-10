/**
 * M05 - Analytics Architecture
 *
 * Detects and validates analytics tools, measurement IDs, event tracking,
 * consent integration, data layer configuration, and cookie compliance
 * using Playwright page evaluation and network interception.
 *
 * Checkpoints:
 *   1. Primary analytics tool
 *   2. Measurement ID accuracy
 *   3. Event tracking depth
 *   4. Cross-domain tracking
 *   5. Consent mode integration
 *   6. Server-side tracking
 *   7. User ID implementation
 *   8. Debug mode disabled
 *   9. Data layer present
 *  10. Cookie compliance
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Types for page.evaluate() return values
// ---------------------------------------------------------------------------

interface AnalyticsTool {
  name: string;
  type: 'analytics' | 'tag_manager' | 'session_replay' | 'heatmap';
  id?: string;
  confidence: number;
  details: Record<string, unknown>;
}

interface DataLayerEntry {
  event?: string;
  [key: string]: unknown;
}

interface ConsentState {
  hasConsentMode: boolean;
  version: number | null;
  defaultState: Record<string, string>;
  updatedState: Record<string, string>;
  consentPlatform: string | null;
}

interface CookieInfo {
  name: string;
  domain: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  tool: string | null;
}

interface BrowserEvalResult {
  tools: AnalyticsTool[];
  dataLayer: DataLayerEntry[];
  dataLayerKeys: string[];
  consent: ConsentState;
  debugMode: boolean;
  userId: { detected: boolean; tools: string[] };
  crossDomain: { hasLinker: boolean; subdomains: string[] };
}

// ---------------------------------------------------------------------------
// Known analytics cookie patterns
// ---------------------------------------------------------------------------

const COOKIE_ATTRIBUTION: Array<{ pattern: RegExp; tool: string }> = [
  { pattern: /^_ga($|_)/, tool: 'Google Analytics' },
  { pattern: /^_gid$/, tool: 'Google Analytics' },
  { pattern: /^_gat/, tool: 'Google Analytics' },
  { pattern: /^_gcl_/, tool: 'Google Ads' },
  { pattern: /^_fbp$/, tool: 'Meta Pixel' },
  { pattern: /^_fbc$/, tool: 'Meta Pixel' },
  { pattern: /^mp_/, tool: 'Mixpanel' },
  { pattern: /^amplitude_id/, tool: 'Amplitude' },
  { pattern: /^_hp2_/, tool: 'Heap' },
  { pattern: /^ajs_/, tool: 'Segment' },
  { pattern: /^ph_/, tool: 'PostHog' },
  { pattern: /^_pendo_/, tool: 'Pendo' },
  { pattern: /^fs_uid/, tool: 'FullStory' },
  { pattern: /^_hj/, tool: 'Hotjar' },
  { pattern: /^_clck$|^_clsk$/, tool: 'Microsoft Clarity' },
  { pattern: /^_pk_/, tool: 'Matomo' },
  { pattern: /^__hstc$|^hubspotutk$/, tool: 'HubSpot' },
  { pattern: /^_ttp$/, tool: 'TikTok Pixel' },
  { pattern: /^_uet/, tool: 'Microsoft Ads' },
];

function attributeCookie(name: string): string | null {
  for (const { pattern, tool } of COOKIE_ATTRIBUTION) {
    if (pattern.test(name)) return tool;
  }
  return null;
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
      moduleId: 'M05' as ModuleId,
      status: 'error',
      data: { error: 'No Playwright page available' },
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M05',
    };
  }

  // ─── Step 1: Detect analytics tools via window globals ───────────────────
  const evalResult = await page.evaluate((): BrowserEvalResult => {
    const tools: AnalyticsTool[] = [];
    const w = window as unknown as Record<string, unknown>;

    // --- GA4 / gtag ---
    if (typeof w['gtag'] === 'function' || w['google_tag_data']) {
      const gtagData = w['google_tag_data'] as Record<string, unknown> | undefined;
      const measurementIds: string[] = [];
      if (gtagData?.['aw']) measurementIds.push(...Object.keys(gtagData['aw'] as object));
      // Extract G- IDs from dataLayer
      const dl = (w['dataLayer'] as Array<Record<string, unknown>>) || [];
      for (const entry of dl) {
        const config = entry as Record<string, unknown>;
        if (config[0] === 'config' && typeof config[1] === 'string' && (config[1] as string).startsWith('G-')) {
          measurementIds.push(config[1] as string);
        }
      }
      // Also check google_tag_manager for GA4
      const gtm = w['google_tag_manager'] as Record<string, unknown> | undefined;
      if (gtm) {
        for (const key of Object.keys(gtm)) {
          if (key.startsWith('G-')) measurementIds.push(key);
        }
      }
      tools.push({
        name: 'Google Analytics 4',
        type: 'analytics',
        id: measurementIds.find(id => id.startsWith('G-')) || undefined,
        confidence: 0.95,
        details: { measurementIds: [...new Set(measurementIds)] },
      });
    }

    // --- Google Tag Manager ---
    const gtmContainers: string[] = [];
    const gtmObj = w['google_tag_manager'] as Record<string, unknown> | undefined;
    if (gtmObj) {
      for (const key of Object.keys(gtmObj)) {
        if (key.startsWith('GTM-')) gtmContainers.push(key);
      }
    }
    if (gtmContainers.length > 0) {
      tools.push({
        name: 'Google Tag Manager',
        type: 'tag_manager',
        id: gtmContainers[0],
        confidence: 0.99,
        details: { containers: gtmContainers },
      });
    }

    // --- Segment ---
    const analytics = w['analytics'] as Record<string, unknown> | undefined;
    if (analytics && typeof analytics['identify'] === 'function') {
      tools.push({
        name: 'Segment',
        type: 'analytics',
        id: (analytics['_writeKey'] as string) || undefined,
        confidence: 0.9,
        details: {},
      });
    }

    // --- Mixpanel ---
    const mp = w['mixpanel'] as Record<string, unknown> | undefined;
    if (mp && typeof mp['track'] === 'function') {
      tools.push({
        name: 'Mixpanel',
        type: 'analytics',
        id: (mp['config'] as Record<string, unknown>)?.['token'] as string || undefined,
        confidence: 0.9,
        details: {},
      });
    }

    // --- Amplitude ---
    const amp = w['amplitude'] as Record<string, unknown> | undefined;
    if (amp && typeof amp['getInstance'] === 'function') {
      tools.push({
        name: 'Amplitude',
        type: 'analytics',
        confidence: 0.9,
        details: {},
      });
    }

    // --- Heap ---
    const heap = w['heap'] as Record<string, unknown> | undefined;
    if (heap && typeof heap['track'] === 'function') {
      tools.push({
        name: 'Heap',
        type: 'analytics',
        id: (heap['appid'] as string) || undefined,
        confidence: 0.9,
        details: {},
      });
    }

    // --- PostHog ---
    const ph = w['posthog'] as Record<string, unknown> | undefined;
    if (ph && typeof ph['capture'] === 'function') {
      tools.push({
        name: 'PostHog',
        type: 'analytics',
        id: ((ph['config'] || ph['_i']) as Record<string, unknown>)?.['token'] as string || undefined,
        confidence: 0.9,
        details: { sessionRecording: !!(ph['sessionRecordingStarted'] || ph['__loaded']) },
      });
    }

    // --- Hotjar ---
    if (w['hj'] && typeof w['hj'] === 'function') {
      tools.push({
        name: 'Hotjar',
        type: 'session_replay',
        id: (w['_hjSettings'] as Record<string, unknown>)?.['hjid']?.toString() || undefined,
        confidence: 0.9,
        details: {},
      });
    }

    // --- Microsoft Clarity ---
    if (typeof w['clarity'] === 'function') {
      tools.push({
        name: 'Microsoft Clarity',
        type: 'heatmap',
        confidence: 0.9,
        details: {},
      });
    }

    // --- FullStory ---
    if (w['_fs_org'] || w['FS']) {
      tools.push({
        name: 'FullStory',
        type: 'session_replay',
        id: (w['_fs_org'] as string) || undefined,
        confidence: 0.9,
        details: {},
      });
    }

    // --- Pendo ---
    const pendo = w['pendo'] as Record<string, unknown> | undefined;
    if (pendo && typeof pendo['initialize'] === 'function') {
      tools.push({
        name: 'Pendo',
        type: 'analytics',
        confidence: 0.85,
        details: {},
      });
    }

    // --- Plausible ---
    const plausibleScript = document.querySelector('script[data-domain][src*="plausible"]');
    if (plausibleScript) {
      tools.push({
        name: 'Plausible',
        type: 'analytics',
        id: plausibleScript.getAttribute('data-domain') || undefined,
        confidence: 0.95,
        details: {},
      });
    }

    // --- Fathom ---
    const fathomScript = document.querySelector('script[data-site][src*="fathom"]');
    if (fathomScript) {
      tools.push({
        name: 'Fathom',
        type: 'analytics',
        id: fathomScript.getAttribute('data-site') || undefined,
        confidence: 0.95,
        details: {},
      });
    }

    // --- Matomo ---
    if (w['_paq'] || w['Matomo'] || w['Piwik']) {
      tools.push({
        name: 'Matomo',
        type: 'analytics',
        confidence: 0.9,
        details: {},
      });
    }

    // --- Adobe Analytics ---
    if (w['s_account'] || w['AppMeasurement'] || (w['s'] && typeof (w['s'] as Record<string, unknown>)['t'] === 'function')) {
      const s = w['s'] as Record<string, unknown> | undefined;
      tools.push({
        name: 'Adobe Analytics',
        type: 'analytics',
        id: (w['s_account'] as string) || (s?.['account'] as string) || undefined,
        confidence: 0.9,
        details: {
          pageName: s?.['pageName'],
          version: (w['AppMeasurement'] as Record<string, unknown>)?.['version'],
        },
      });
    }

    // --- CrazyEgg ---
    if (w['CE2'] || w['CE_SNAPSHOT_NAME']) {
      tools.push({ name: 'Crazy Egg', type: 'heatmap', confidence: 0.85, details: {} });
    }

    // --- Lucky Orange ---
    if (w['_loq'] || w['__lo_cs_added']) {
      tools.push({ name: 'Lucky Orange', type: 'session_replay', confidence: 0.85, details: {} });
    }

    // --- Mouseflow ---
    if (w['mouseflow'] || w['_mfq']) {
      tools.push({ name: 'Mouseflow', type: 'session_replay', confidence: 0.85, details: {} });
    }

    // --- DataLayer snapshot ---
    const rawDl = (w['dataLayer'] as DataLayerEntry[]) || [];
    const dlSnapshot = rawDl.slice(0, 50); // cap for size
    const dlKeys = new Set<string>();
    for (const entry of rawDl) {
      if (entry && typeof entry === 'object') {
        for (const key of Object.keys(entry)) dlKeys.add(key);
      }
    }

    // --- Consent Mode ---
    const consent: ConsentState = {
      hasConsentMode: false,
      version: null,
      defaultState: {},
      updatedState: {},
      consentPlatform: null,
    };

    // Check Google Consent Mode
    for (const entry of rawDl) {
      if (entry && Array.isArray(entry) && entry[0] === 'consent') {
        consent.hasConsentMode = true;
        if (entry[1] === 'default') {
          consent.defaultState = entry[2] as Record<string, string>;
          if ((entry[2] as Record<string, string>)?.['wait_for_update']) consent.version = 2;
          else consent.version = 1;
        }
        if (entry[1] === 'update') consent.updatedState = entry[2] as Record<string, string>;
      }
    }

    // Detect consent platform
    if (w['OneTrust'] || w['OptanonWrapper']) consent.consentPlatform = 'OneTrust';
    else if (w['Cookiebot'] || w['CookieConsent']) consent.consentPlatform = 'Cookiebot';
    else if (w['__tcfapi']) consent.consentPlatform = 'TCF-compliant CMP';
    else if (w['CookieInformation']) consent.consentPlatform = 'Cookie Information';
    else if (w['_iub']) consent.consentPlatform = 'iubenda';
    else if (w['complianz']) consent.consentPlatform = 'Complianz';

    // --- Debug Mode ---
    let debugMode = false;
    if (w['google_tag_data']) {
      const gtd = w['google_tag_data'] as Record<string, unknown>;
      if (gtd['ics']?.toString().includes('debug') || gtd['td']?.toString().includes('debug_mode')) {
        debugMode = true;
      }
    }
    // Check URL for debug flags
    const url = window.location.search;
    if (url.includes('gtm_debug') || url.includes('debug_mode=true')) debugMode = true;

    // --- User ID detection ---
    const userIdTools: string[] = [];
    // GA4 user_id
    for (const entry of rawDl) {
      if (entry && typeof entry === 'object' && 'user_id' in entry && entry['user_id']) {
        userIdTools.push('GA4');
        break;
      }
    }
    if (analytics && (analytics as Record<string, unknown>)['_user']?.toString()) userIdTools.push('Segment');
    if (ph && (ph as Record<string, unknown>)['_person_properties']) userIdTools.push('PostHog');

    // --- Cross-domain tracking ---
    const crossDomain = { hasLinker: false, subdomains: [] as string[] };
    for (const entry of rawDl) {
      if (entry && typeof entry === 'object') {
        const config = entry as Record<string, unknown>;
        if (config['linker']?.toString()) crossDomain.hasLinker = true;
      }
    }

    return {
      tools,
      dataLayer: dlSnapshot,
      dataLayerKeys: Array.from(dlKeys),
      consent,
      debugMode,
      userId: { detected: userIdTools.length > 0, tools: userIdTools },
      crossDomain,
    };
  });

  data.tools = evalResult.tools;
  data.dataLayer = evalResult.dataLayer;
  data.consent = evalResult.consent;

  // ─── Step 2: Enrich with network requests ────────────────────────────────
  const analyticsRequests = nc?.getAnalyticsRequests() ?? [];
  const tagManagerRequests = nc?.getTagManagerRequests() ?? [];
  const allRequests = nc?.getAllRequests() ?? [];

  // Detect additional tools from network that page.evaluate might miss
  const networkToolPatterns: Array<{ pattern: RegExp; name: string; type: AnalyticsTool['type'] }> = [
    { pattern: /google-analytics\.com.*collect/, name: 'Google Analytics 4', type: 'analytics' },
    { pattern: /analytics\.google\.com.*collect/, name: 'Google Analytics 4', type: 'analytics' },
    { pattern: /segment\.(com|io).*\/v1\//, name: 'Segment', type: 'analytics' },
    { pattern: /api\.mixpanel\.com/, name: 'Mixpanel', type: 'analytics' },
    { pattern: /api2?\.amplitude\.com/, name: 'Amplitude', type: 'analytics' },
    { pattern: /heapanalytics\.com/, name: 'Heap', type: 'analytics' },
    { pattern: /rs\.fullstory\.com/, name: 'FullStory', type: 'session_replay' },
    { pattern: /script\.hotjar\.com/, name: 'Hotjar', type: 'session_replay' },
    { pattern: /clarity\.ms/, name: 'Microsoft Clarity', type: 'heatmap' },
    { pattern: /us\.posthog\.com|eu\.posthog\.com|app\.posthog\.com/, name: 'PostHog', type: 'analytics' },
  ];

  const existingToolNames = new Set(evalResult.tools.map(t => t.name));
  for (const req of [...analyticsRequests, ...tagManagerRequests]) {
    for (const { pattern, name, type } of networkToolPatterns) {
      if (pattern.test(req.url) && !existingToolNames.has(name)) {
        existingToolNames.add(name);
        evalResult.tools.push({ name, type, confidence: 0.8, details: { source: 'network' } });
      }
    }
  }

  // Count analytics pixel fires
  const pixelFires = analyticsRequests.length;
  data.pixelFires = pixelFires;
  data.analyticsRequestCount = analyticsRequests.length;
  data.tagManagerRequestCount = tagManagerRequests.length;

  // Server-side tracking indicators
  let serverSideDetected = false;
  for (const req of allRequests) {
    // Custom collect endpoints, non-standard analytics domains
    if (/\/g\/collect|\/j\/collect|sgtm\.|server-side-tagging/.test(req.url)) {
      serverSideDetected = true;
      break;
    }
  }
  data.serverSideTracking = serverSideDetected;

  // ─── Step 3: Cookie analysis ─────────────────────────────────────────────
  let cookies: CookieInfo[] = [];
  try {
    const browserContext = page.context();
    const rawCookies = await browserContext.cookies();
    cookies = rawCookies.map(c => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      tool: attributeCookie(c.name),
    }));
    data.cookies = cookies.map(c => ({ name: c.name, domain: c.domain, tool: c.tool, secure: c.secure, sameSite: c.sameSite }));
  } catch {
    // Cookie access may fail in some contexts
  }

  const analyticsCookies = cookies.filter(c => c.tool !== null);
  const nonCompliantCookies = analyticsCookies.filter(c => !c.secure || c.sameSite === 'None');

  // ─── Step 4: Build signals ───────────────────────────────────────────────
  for (const tool of evalResult.tools) {
    signals.push(
      createSignal({
        type: `analytics_tool_${tool.type}`,
        name: tool.name,
        confidence: tool.confidence,
        evidence: tool.id ? `${tool.name} (${tool.id})` : `${tool.name} detected`,
        category: 'analytics',
      }),
    );
  }

  // ─── Step 5: Build checkpoints ───────────────────────────────────────────
  const analyticsTools = evalResult.tools.filter(t => t.type === 'analytics');
  const hasPrimaryAnalytics = analyticsTools.length > 0;
  const primaryTool = analyticsTools[0];

  // CP1: Primary analytics tool
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (primaryTool && ['Google Analytics 4', 'Adobe Analytics'].includes(primaryTool.name) && pixelFires > 0) {
      health = 'excellent';
      evidence = `${primaryTool.name}${primaryTool.id ? ` (${primaryTool.id})` : ''} properly configured and firing`;
    } else if (hasPrimaryAnalytics && pixelFires > 0) {
      health = 'good';
      evidence = `${primaryTool!.name} detected and firing`;
    } else if (hasPrimaryAnalytics) {
      health = 'warning';
      evidence = `Analytics script loads but no pixel fires detected`;
      recommendation = 'Verify analytics implementation is properly initialized and sending data.';
    } else {
      health = 'critical';
      evidence = 'No analytics tools detected on this page';
      recommendation = 'Implement GA4 or another analytics platform to measure website performance.';
    }

    checkpoints.push(createCheckpoint({ id: 'm05-primary-analytics', name: 'Primary Analytics Tool', weight: 1.0, health, evidence, recommendation }));
  }

  // CP2: Measurement ID accuracy
  {
    const ga4Tool = evalResult.tools.find(t => t.name === 'Google Analytics 4');
    const ga4Ids = (ga4Tool?.details?.['measurementIds'] as string[]) ?? [];
    const uniqueIds = [...new Set(ga4Ids.filter(id => id.startsWith('G-')))];

    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (uniqueIds.length === 1) {
      health = 'excellent';
      evidence = `Single GA4 measurement ID: ${uniqueIds[0]}`;
    } else if (uniqueIds.length > 1) {
      health = 'warning';
      evidence = `Multiple GA4 measurement IDs detected: ${uniqueIds.join(', ')}`;
      recommendation = 'Consolidate to a single GA4 property to avoid duplicate data collection.';
    } else if (ga4Tool) {
      health = 'good';
      evidence = 'GA4 present but measurement ID could not be extracted';
    } else if (hasPrimaryAnalytics) {
      health = 'good';
      evidence = `Using ${primaryTool!.name} (non-GA4) — measurement ID check N/A`;
    } else {
      health = 'critical';
      evidence = 'No measurement ID found — no analytics configured';
      recommendation = 'Set up GA4 with a valid measurement ID.';
    }

    checkpoints.push(createCheckpoint({ id: 'm05-measurement-id', name: 'Measurement ID Accuracy', weight: 0.8, health, evidence, recommendation }));
  }

  // CP3: Event tracking depth
  {
    const hasEnhancedMeasurement = evalResult.dataLayerKeys.some(k =>
      ['page_view', 'scroll', 'click', 'view_search_results', 'file_download', 'form_start', 'form_submit'].includes(k),
    );
    const hasCustomEvents = evalResult.dataLayer.some(e =>
      e?.event && !['gtm.js', 'gtm.dom', 'gtm.load', 'gtm.click', 'gtm.scrollDepth'].includes(e.event),
    );

    let health: CheckpointHealth;
    let evidence: string;

    if (hasEnhancedMeasurement && hasCustomEvents) {
      health = 'excellent';
      evidence = 'Enhanced measurement + custom events firing';
    } else if (hasEnhancedMeasurement || hasCustomEvents) {
      health = 'good';
      evidence = hasEnhancedMeasurement ? 'Enhanced measurement enabled' : 'Custom events detected';
    } else if (pixelFires > 0) {
      health = 'warning';
      evidence = 'Pageview tracking only — no enhanced measurement or custom events detected';
    } else {
      health = 'critical';
      evidence = 'No event tracking detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm05-event-depth', name: 'Event Tracking Depth', weight: 0.7, health, evidence }));
  }

  // CP4: Cross-domain tracking
  {
    const hasLinker = evalResult.crossDomain.hasLinker;

    checkpoints.push(
      hasLinker
        ? createCheckpoint({ id: 'm05-cross-domain', name: 'Cross-Domain Tracking', weight: 0.5, health: 'excellent', evidence: 'Cross-domain linker configured' })
        : infoCheckpoint({ id: 'm05-cross-domain', name: 'Cross-Domain Tracking', weight: 0.5, evidence: 'No cross-domain linker detected (may not be needed for single domain)' }),
    );
  }

  // CP5: Consent mode integration
  {
    const cm = evalResult.consent;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (cm.hasConsentMode && cm.version === 2 && cm.consentPlatform) {
      health = 'excellent';
      evidence = `Google Consent Mode v2 active via ${cm.consentPlatform}, default state: ${JSON.stringify(cm.defaultState)}`;
    } else if (cm.hasConsentMode && cm.consentPlatform) {
      health = 'good';
      evidence = `Consent Mode v${cm.version ?? '?'} with ${cm.consentPlatform}`;
      recommendation = 'Upgrade to Consent Mode v2 for full compliance.';
    } else if (cm.consentPlatform) {
      health = 'warning';
      evidence = `Consent platform (${cm.consentPlatform}) detected but Google Consent Mode not configured`;
      recommendation = 'Integrate your consent platform with Google Consent Mode for proper analytics gating.';
    } else {
      health = 'critical';
      evidence = 'No consent management detected — tracking may fire without user consent';
      recommendation = 'Implement a consent management platform (OneTrust, Cookiebot) with Google Consent Mode.';
    }

    checkpoints.push(createCheckpoint({ id: 'm05-consent-mode', name: 'Consent Mode Integration', weight: 0.8, health, evidence, recommendation }));
  }

  // CP6: Server-side tracking
  {
    checkpoints.push(
      serverSideDetected
        ? createCheckpoint({ id: 'm05-server-side', name: 'Server-Side Tracking', weight: 0.6, health: 'excellent', evidence: 'Server-side tracking endpoint detected (sGTM or custom collect)' })
        : infoCheckpoint({ id: 'm05-server-side', name: 'Server-Side Tracking', weight: 0.6, evidence: 'Client-side tracking only (server-side is a nice-to-have)' }),
    );
  }

  // CP7: User ID implementation
  {
    const uid = evalResult.userId;
    checkpoints.push(
      uid.detected
        ? createCheckpoint({ id: 'm05-user-id', name: 'User ID Implementation', weight: 0.4, health: 'excellent', evidence: `User ID set in: ${uid.tools.join(', ')}` })
        : infoCheckpoint({ id: 'm05-user-id', name: 'User ID Implementation', weight: 0.4, evidence: 'No user_id detected (may require authenticated page)' }),
    );
  }

  // CP8: Debug mode disabled
  {
    checkpoints.push(
      evalResult.debugMode
        ? createCheckpoint({ id: 'm05-debug-mode', name: 'Debug Mode Disabled', weight: 0.5, health: 'critical', evidence: 'Debug mode is active in production — this inflates data and exposes internals', recommendation: 'Disable debug mode in production GTM/GA4 configuration.' })
        : createCheckpoint({ id: 'm05-debug-mode', name: 'Debug Mode Disabled', weight: 0.5, health: 'excellent', evidence: 'No debug mode detected in production' }),
    );
  }

  // CP9: Data layer present
  {
    const dlLen = evalResult.dataLayer.length;
    const hasEcommerce = evalResult.dataLayerKeys.some(k => k === 'ecommerce' || k === 'transactionId');
    const hasUserData = evalResult.dataLayerKeys.some(k => k === 'user' || k === 'userId' || k === 'user_id' || k === 'userType');

    let health: CheckpointHealth;
    let evidence: string;

    if (dlLen > 3 && (hasEcommerce || hasUserData)) {
      health = 'excellent';
      evidence = `Rich dataLayer (${dlLen} entries, ${evalResult.dataLayerKeys.length} unique keys)${hasEcommerce ? ' with ecommerce data' : ''}${hasUserData ? ' with user data' : ''}`;
    } else if (dlLen > 0) {
      health = 'good';
      evidence = `dataLayer present (${dlLen} entries, ${evalResult.dataLayerKeys.length} unique keys)`;
    } else if (evalResult.tools.some(t => t.name === 'Google Tag Manager')) {
      health = 'warning';
      evidence = 'GTM detected but dataLayer is empty or missing';
    } else {
      health = 'good';
      evidence = 'No dataLayer (not using GTM)';
    }

    checkpoints.push(createCheckpoint({ id: 'm05-data-layer', name: 'Data Layer Present', weight: 0.6, health, evidence }));
  }

  // CP10: Cookie compliance
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (analyticsCookies.length === 0) {
      health = 'good';
      evidence = 'No analytics cookies set (may use cookieless tracking)';
    } else if (nonCompliantCookies.length === 0) {
      health = 'excellent';
      evidence = `All ${analyticsCookies.length} analytics cookies are Secure and have proper SameSite`;
    } else if (nonCompliantCookies.length <= analyticsCookies.length * 0.3) {
      health = 'good';
      evidence = `${analyticsCookies.length - nonCompliantCookies.length}/${analyticsCookies.length} analytics cookies compliant`;
    } else {
      health = 'warning';
      evidence = `${nonCompliantCookies.length}/${analyticsCookies.length} analytics cookies missing Secure flag or have improper SameSite`;
    }

    checkpoints.push(createCheckpoint({ id: 'm05-cookie-compliance', name: 'Cookie Compliance', weight: 0.6, health, evidence }));
  }

  // Info: Multiple analytics tools
  if (evalResult.tools.length > 1) {
    checkpoints.push(
      infoCheckpoint({
        id: 'm05-multi-tools',
        name: 'Analytics Tool Count',
        weight: 0.3,
        evidence: `${evalResult.tools.length} analytics/tracking tools detected: ${evalResult.tools.map(t => t.name).join(', ')}`,
      }),
    );
  }

  data.toolCount = evalResult.tools.length;
  data.toolNames = evalResult.tools.map(t => t.name);

  return {
    moduleId: 'M05' as ModuleId,
    status: checkpoints.length > 0 ? 'success' : 'partial',
    data,
    signals,
    score: null, // calculated by runner from checkpoints
    checkpoints,
    duration: 0, // set by runner
  };
};

registerModuleExecutor('M05' as ModuleId, execute);
