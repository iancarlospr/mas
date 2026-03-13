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
  type: 'analytics' | 'tag_manager' | 'session_replay' | 'heatmap' | 'advertising' | 'marketing';
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
  { pattern: /^_li_fat_id$/, tool: 'LinkedIn Insight' },
  { pattern: /^_pin_unauth$|^_epik$/, tool: 'Pinterest Tag' },
  { pattern: /^_scid$/, tool: 'Snapchat Pixel' },
  { pattern: /^_rdt_uuid$/, tool: 'Reddit Pixel' },
  { pattern: /^cto_bundle$/, tool: 'Criteo' },
  { pattern: /^__kla_id$/, tool: 'Klaviyo' },
  { pattern: /^ai_session$|^ai_user$/, tool: 'Application Insights' },
  { pattern: /^_twq$/, tool: 'Twitter/X Pixel' },
  { pattern: /^km_/, tool: 'Kissmetrics' },
  { pattern: /^_sp_/, tool: 'Snowplow' },
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

  // ─── Step 0: Wait for analytics scripts to initialize ──────────────────
  // Consent-gated sites (OneTrust, Cookiebot) may take 2-5s to load analytics.
  // Use Promise.race with a hard wall-clock fallback to prevent hanging on
  // bot-protected pages where page.waitForFunction polls can stall.
  await Promise.race([
    page.waitForFunction(() => {
      const w = window as unknown as Record<string, unknown>;
      return w['gtag'] || w['google_tag_data'] || (Array.isArray(w['dataLayer']) && (w['dataLayer'] as unknown[]).length > 0) ||
             w['_satellite'] || w['analytics'] || w['mixpanel'] || w['amplitude'] ||
             w['OneTrust'] || w['__tcfapi'] || w['Cookiebot'] ||
             w['zaraz'] || w['fbq'] || w['appInsights'] || w['_hsq'] || w['ttq'] || w['lintrk'];
    }, { timeout: 5_000 }).catch(() => { /* timeout OK */ }),
    new Promise(resolve => setTimeout(resolve, 6_000)), // Hard 6s wall-clock fallback
  ]);

  // ─── Step 1: Detect analytics tools via window globals ───────────────────
  // Wrap in a race to prevent hanging on bot-protected pages
  const EVAL_TIMEOUT = 10_000;
  const emptyResult: BrowserEvalResult = {
    tools: [], dataLayer: [], dataLayerKeys: [], consent: {
      hasConsentMode: false, version: null, defaultState: {}, updatedState: {}, consentPlatform: null,
    }, debugMode: false, userId: { detected: false, tools: [] }, crossDomain: { hasLinker: false, subdomains: [] },
  };
  const evalResult = await Promise.race([
    page.evaluate((): BrowserEvalResult => {
    const tools: AnalyticsTool[] = [];
    const w = window as unknown as Record<string, unknown>;

    // --- GA4 / gtag ---
    if (typeof w['gtag'] === 'function' || w['google_tag_data']) {
      const gtagData = w['google_tag_data'] as Record<string, unknown> | undefined;
      const measurementIds: string[] = [];
      const uaIds: string[] = [];
      if (gtagData?.['aw']) measurementIds.push(...Object.keys(gtagData['aw'] as object));
      // Extract G- and UA- IDs from dataLayer
      const dl = (w['dataLayer'] as Array<Record<string, unknown>>) || [];
      for (const entry of dl) {
        const config = entry as Record<string, unknown>;
        if (config[0] === 'config' && typeof config[1] === 'string') {
          const id = config[1] as string;
          if (id.startsWith('G-')) measurementIds.push(id);
          else if (id.startsWith('UA-')) uaIds.push(id);
        }
      }
      // Also check google_tag_manager for GA4
      const gtm = w['google_tag_manager'] as Record<string, unknown> | undefined;
      if (gtm) {
        for (const key of Object.keys(gtm)) {
          if (key.startsWith('G-')) measurementIds.push(key);
          else if (key.startsWith('UA-')) uaIds.push(key);
        }
      }
      // Check google_tag_data for UA properties
      if (gtagData) {
        for (const key of Object.keys(gtagData)) {
          if (key.startsWith('UA-')) uaIds.push(key);
        }
      }

      const hasGA4 = measurementIds.some(id => id.startsWith('G-'));
      if (hasGA4) {
        tools.push({
          name: 'Google Analytics 4',
          type: 'analytics',
          id: measurementIds.find(id => id.startsWith('G-')) || undefined,
          confidence: 0.95,
          details: { measurementIds: [...new Set(measurementIds)] },
        });
      }
      if (uaIds.length > 0) {
        tools.push({
          name: 'Google Analytics',
          type: 'analytics',
          id: uaIds[0],
          confidence: 0.9,
          details: { measurementIds: [...new Set(uaIds)] },
        });
      }
      // If gtag/google_tag_data exists but no specific IDs found, still report GA4
      if (!hasGA4 && uaIds.length === 0) {
        tools.push({
          name: 'Google Analytics 4',
          type: 'analytics',
          confidence: 0.7,
          details: { measurementIds: [] },
        });
      }
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

    // --- Adobe Experience Platform Web SDK (Alloy) ---
    if (w['alloy'] || w['__alloyNS'] || w['adobeDataLayer']) {
      const existingAdobe = tools.find(t => t.name === 'Adobe Analytics');
      if (!existingAdobe) {
        tools.push({
          name: 'Adobe Analytics',
          type: 'analytics',
          confidence: 0.85,
          details: { sdk: 'AEP Web SDK (Alloy)', adobeDataLayer: !!w['adobeDataLayer'] },
        });
      } else {
        existingAdobe.details['sdk'] = 'AEP Web SDK (Alloy)';
      }
    }

    // --- Adobe Launch (Tag Manager) ---
    if (w['_satellite'] && typeof (w['_satellite'] as Record<string, unknown>)['track'] === 'function') {
      tools.push({
        name: 'Adobe Launch',
        type: 'tag_manager',
        confidence: 0.9,
        details: {
          buildInfo: (w['_satellite'] as Record<string, unknown>)['buildInfo'],
        },
      });
    }

    // --- Tealium ---
    if (w['utag'] || w['utag_data']) {
      tools.push({
        name: 'Tealium',
        type: 'tag_manager',
        confidence: 0.9,
        details: { hasDataLayer: !!w['utag_data'] },
      });
    }

    // --- Vercel Analytics ---
    const vercelScript = document.querySelector(
      'script[src*="/_vercel/insights"], script[data-sdkn="@vercel/analytics"], script[src*="vitals.vercel-insights"]'
    );
    if (w['va'] || w['vercel'] || vercelScript) {
      tools.push({
        name: 'Vercel Analytics',
        type: 'analytics',
        confidence: 0.9,
        details: { cookieless: true },
      });
    }

    // --- Vercel Speed Insights ---
    const vercelSpeedScript = document.querySelector('script[src*="/_vercel/speed-insights"]');
    if (vercelSpeedScript) {
      tools.push({
        name: 'Vercel Speed Insights',
        type: 'analytics',
        confidence: 0.9,
        details: {},
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

    // --- Table-driven additional tool detection ---
    // Covers advertising pixels, marketing automation, chat, and niche analytics
    // from tech_signatures.json that aren't handled by the individual blocks above.
    const toolNameSet = new Set(tools.map(t => t.name));
    const ADDITIONAL_TOOLS: Array<[string[], string, AnalyticsTool['type']]> = [
      // Advertising pixels
      [['fbq', '_fbq'], 'Meta Pixel', 'advertising'],
      [['ttq', 'TiktokAnalyticsObject'], 'TikTok Pixel', 'advertising'],
      [['lintrk', '_linkedin_data_partner_ids'], 'LinkedIn Insight', 'advertising'],
      [['twq'], 'Twitter/X Pixel', 'advertising'],
      [['pintrk'], 'Pinterest Tag', 'advertising'],
      [['snaptr'], 'Snapchat Pixel', 'advertising'],
      [['uetq', 'UET'], 'Microsoft Ads', 'advertising'],
      [['criteo_q'], 'Criteo', 'advertising'],
      [['_taboola'], 'Taboola', 'advertising'],
      [['OBR', 'OB_ADV_ID'], 'Outbrain', 'advertising'],
      [['adroll_adv_id', '__adroll'], 'AdRoll', 'advertising'],
      [['rdt'], 'Reddit Pixel', 'advertising'],
      [['qp'], 'Quora Pixel', 'advertising'],
      [['Demandbase'], 'Demandbase', 'advertising'],
      [['_6si'], '6sense', 'advertising'],
      [['saq'], 'StackAdapt', 'advertising'],
      [['ire'], 'Impact', 'advertising'],
      // Marketing automation & CRM
      [['_hsq', 'HubSpotConversations'], 'HubSpot', 'marketing'],
      [['Munchkin', 'mktoForms2', 'MktoForms2'], 'Marketo', 'marketing'],
      [['piAId', 'piCId'], 'Salesforce Pardot', 'marketing'],
      [['_learnq', 'klaviyo'], 'Klaviyo', 'marketing'],
      [['_ac'], 'ActiveCampaign', 'marketing'],
      [['_dcq', '_dcs'], 'Drip', 'marketing'],
      [['sib', 'sendinblue'], 'Brevo', 'marketing'],
      // Chat & support
      [['Intercom', 'intercomSettings'], 'Intercom', 'marketing'],
      [['drift', 'driftt'], 'Drift', 'marketing'],
      [['zE', 'Zopim'], 'Zendesk', 'marketing'],
      [['CRISP_WEBSITE_ID', '$crisp'], 'Crisp', 'marketing'],
      [['LiveChatWidget', '__lc'], 'LiveChat', 'marketing'],
      [['tidioChatApi'], 'Tidio', 'marketing'],
      [['FreshworksWidget', 'fcWidget'], 'Freshdesk', 'marketing'],
      [['olark'], 'Olark', 'marketing'],
      // Tag managers & analytics not covered above
      [['zaraz'], 'Cloudflare Zaraz', 'tag_manager'],
      [['appInsights'], 'Application Insights', 'analytics'],
      [['_kmq', 'KM'], 'Kissmetrics', 'analytics'],
      [['clicky', 'clicky_site_ids'], 'Clicky', 'analytics'],
      [['woopra'], 'Woopra', 'analytics'],
      [['_sf_async_config'], 'Chartbeat', 'analytics'],
      [['snowplow', 'GlobalSnowplowNamespace'], 'Snowplow', 'analytics'],
      [['mParticle'], 'mParticle', 'analytics'],
      [['rudderanalytics'], 'RudderStack', 'analytics'],
      [['Countly'], 'Countly', 'analytics'],
      [['_gs', 'GoSquared'], 'GoSquared', 'analytics'],
      [['freshpaint'], 'Freshpaint', 'analytics'],
      [['umami'], 'Umami', 'analytics'],
      [['pirsch'], 'Pirsch', 'analytics'],
      [['COMSCORE', '_comscore'], 'Comscore', 'analytics'],
      [['sc_project'], 'StatCounter', 'analytics'],
      [['ym'], 'Yandex Metrica', 'analytics'],
      [['_hmt'], 'Baidu Tongji', 'analytics'],
      [['ko'], 'Koala', 'analytics'],
      [['AppsFlyer'], 'AppsFlyer', 'analytics'],
    ];
    for (const [globals, name, type] of ADDITIONAL_TOOLS) {
      if (!toolNameSet.has(name) && globals.some(g => w[g])) {
        toolNameSet.add(name);
        tools.push({ name, type, confidence: 0.85, details: {} });
      }
    }

    // --- Script-src fallback detection ---
    // Catches tools whose <script> tags are in the DOM but JS hasn't executed yet
    // (slow load, CSP issues, or consent-blocked without type="text/plain").
    const allScriptSrcs = Array.from(document.querySelectorAll('script[src]')).map(s => (s as HTMLScriptElement).src);
    const SCRIPT_TOOLS: Array<[RegExp, string, AnalyticsTool['type']]> = [
      [/googletagmanager\.com\/gtm\.js/, 'Google Tag Manager', 'tag_manager'],
      [/connect\.facebook\.net.*fbevents/, 'Meta Pixel', 'advertising'],
      [/analytics\.tiktok\.com/, 'TikTok Pixel', 'advertising'],
      [/snap\.licdn\.com/, 'LinkedIn Insight', 'advertising'],
      [/static\.ads-twitter\.com/, 'Twitter/X Pixel', 'advertising'],
      [/s\.pinimg\.com\/ct/, 'Pinterest Tag', 'advertising'],
      [/sc-static\.net\/scevent/, 'Snapchat Pixel', 'advertising'],
      [/bat\.bing\.com/, 'Microsoft Ads', 'advertising'],
      [/static\.criteo\.net/, 'Criteo', 'advertising'],
      [/cdn\.taboola\.com/, 'Taboola', 'advertising'],
      [/cloudflareinsights\.com\/beacon/, 'Cloudflare Web Analytics', 'analytics'],
      [/cdn-cgi\/zaraz/, 'Cloudflare Zaraz', 'tag_manager'],
      [/simpleanalytics(?:cdn)?\.com/, 'Simple Analytics', 'analytics'],
      [/datafa\.st\/js/, 'DataFast', 'analytics'],
      [/static\.klaviyo\.com/, 'Klaviyo', 'marketing'],
      [/js\.hs-scripts\.com|js\.hs-analytics\.net/, 'HubSpot', 'marketing'],
      [/munchkin\.marketo\.net/, 'Marketo', 'marketing'],
      [/widget\.intercom\.io|js\.intercomcdn\.com/, 'Intercom', 'marketing'],
      [/js\.driftt\.com/, 'Drift', 'marketing'],
      [/static\.zdassets\.com/, 'Zendesk', 'marketing'],
      [/client\.crisp\.chat/, 'Crisp', 'marketing'],
      [/cdn\.livechatinc\.com/, 'LiveChat', 'marketing'],
      [/code\.tidio\.co/, 'Tidio', 'marketing'],
      [/tag\.getdrip\.com/, 'Drip', 'marketing'],
      [/f\.convertkit\.com/, 'ConvertKit', 'marketing'],
      [/dc\.services\.visualstudio\.com|az416426\.vo\.msecnd\.net|\/ai\.0\.js/, 'Application Insights', 'analytics'],
      [/cdn\.segment\.com/, 'Segment', 'analytics'],
      [/cdn\.rudderlabs\.com/, 'RudderStack', 'analytics'],
      [/cdn\.amplitude\.com/, 'Amplitude', 'analytics'],
      [/cdn\.heapanalytics\.com/, 'Heap', 'analytics'],
      [/cdn\.pendo\.io/, 'Pendo', 'analytics'],
      [/sibautomation\.com/, 'Brevo', 'marketing'],
      [/trackcmp\.net|activehosted\.com/, 'ActiveCampaign', 'marketing'],
    ];
    for (const [pattern, name, type] of SCRIPT_TOOLS) {
      if (!toolNameSet.has(name) && allScriptSrcs.some(src => pattern.test(src))) {
        toolNameSet.add(name);
        tools.push({ name, type, confidence: 0.8, details: { source: 'script_tag' } });
      }
    }

    // --- Privacy-focused analytics via data attributes ---
    if (!toolNameSet.has('Umami')) {
      const umamiScript = document.querySelector('script[data-website-id][src*="umami"]');
      if (umamiScript) { toolNameSet.add('Umami'); tools.push({ name: 'Umami', type: 'analytics', confidence: 0.9, id: umamiScript.getAttribute('data-website-id') || undefined, details: {} }); }
    }
    if (!toolNameSet.has('Pirsch')) {
      const pirschScript = document.querySelector('script[data-code][src*="pirsch"]');
      if (pirschScript) { toolNameSet.add('Pirsch'); tools.push({ name: 'Pirsch', type: 'analytics', confidence: 0.9, id: pirschScript.getAttribute('data-code') || undefined, details: {} }); }
    }
    if (!toolNameSet.has('Cloudflare Web Analytics')) {
      const cfScript = document.querySelector('script[data-cf-beacon]');
      if (cfScript) { toolNameSet.add('Cloudflare Web Analytics'); tools.push({ name: 'Cloudflare Web Analytics', type: 'analytics', confidence: 0.9, details: {} }); }
    }

    // --- Consent-gated script detection (OneTrust, Cookiebot, etc.) ---
    // When a CMP blocks analytics scripts, they remain in the DOM as
    // <script type="text/plain" class="optanon-category-C0002"> (OneTrust)
    // or <script type="text/plain" data-cookieconsent="statistics"> (Cookiebot)
    const consentGatedScripts = document.querySelectorAll(
      'script[type="text/plain"][class*="optanon-category"],' +
      'script[type="text/plain"][data-cookieconsent],' +
      'script[type="text/plain"][data-consent],' +
      'script[type="text/plain"][data-categories]'
    );
    const CONSENT_GATED_TOOL_PATTERNS: Array<[RegExp, string, AnalyticsTool['type']]> = [
      [/googletagmanager\.com\/gtm\.js/, 'Google Tag Manager', 'tag_manager'],
      [/google-analytics\.com|googletagmanager\.com.*\/g\/collect/, 'Google Analytics 4', 'analytics'],
      [/assets\.adobedtm\.com|launch-.*\.min\.js/, 'Adobe Launch', 'tag_manager'],
      [/cdn\.segment\.com/, 'Segment', 'analytics'],
      [/tealiumiq\.com|tiqcdn\.com/, 'Tealium', 'tag_manager'],
      [/hotjar\.com/, 'Hotjar', 'session_replay'],
      [/clarity\.ms/, 'Microsoft Clarity', 'heatmap'],
      [/connect\.facebook\.net.*fbevents/, 'Meta Pixel', 'analytics'],
      [/snap\.licdn\.com/, 'LinkedIn Insight', 'analytics'],
    ];
    for (const script of consentGatedScripts) {
      const src = script.getAttribute('data-src') || script.getAttribute('src') || script.textContent || '';
      for (const [pattern, name, type] of CONSENT_GATED_TOOL_PATTERNS) {
        if (pattern.test(src) && !toolNameSet.has(name)) {
          toolNameSet.add(name);
          tools.push({ name, type, confidence: 0.7, details: { consentGated: true, source: 'dom_blocked_script' } });
        }
      }
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

    // ── Consent platform detection (table-driven) ──
    // Tier 1: Window globals — fast, high confidence
    const CMP_GLOBALS: Array<[string | string[], string]> = [
      [['OneTrust', 'OptanonWrapper'], 'OneTrust'],
      [['Cookiebot', 'CookieConsent'], 'Cookiebot'],
      ['__tcfapi', 'TCF-compliant CMP'],
      ['CookieInformation', 'Cookie Information'],
      ['_iub', 'iubenda'],
      ['complianz', 'Complianz'],
      ['CassieWidgetLoader', 'Cassie'],
      ['Didomi', 'Didomi'],
      ['UC_UI', 'Usercentrics'],
      [['__cmp', 'quantserve'], 'Quantcast Choice'],
      ['Osano', 'Osano'],
      ['klaro', 'Klaro'],
      ['CookieYes', 'CookieYes'],
      ['termly', 'Termly'],
    ];
    for (const [globals, name] of CMP_GLOBALS) {
      const keys = Array.isArray(globals) ? globals : [globals];
      if (keys.some(k => w[k])) { consent.consentPlatform = name; break; }
    }

    // Tier 2: Script src patterns — catches lazy-loaded CMPs
    if (!consent.consentPlatform) {
      const CMP_SCRIPTS: Array<[RegExp, string]> = [
        [/cassiecloud\.com|cassie-loader/i, 'Cassie'],
        [/cdn\.cookielaw\.org|optanon/i, 'OneTrust'],
        [/consent\.cookiebot\.com/i, 'Cookiebot'],
        [/consentmanager\.net/i, 'consentmanager'],
        [/secureprivacy\.ai/i, 'Secure Privacy'],
        [/didomi\.io/i, 'Didomi'],
        [/usercentrics\.eu|app\.usercentrics\.eu/i, 'Usercentrics'],
        [/quantcast\.com.*choice/i, 'Quantcast Choice'],
        [/osano\.com/i, 'Osano'],
        [/cdn\.klaro\.org|klaro\.js/i, 'Klaro'],
      ];
      const scripts = document.querySelectorAll('script[src]');
      outer: for (const script of scripts) {
        const src = (script as HTMLScriptElement).src;
        for (const [pattern, name] of CMP_SCRIPTS) {
          if (pattern.test(src)) { consent.consentPlatform = name; break outer; }
        }
      }
    }

    // ── Consent Mode v2 deep detection ──
    // Check Google's internal consent state (google_tag_data.ics)
    if (!consent.hasConsentMode) {
      const gtd = w['google_tag_data'] as Record<string, unknown> | undefined;
      if (gtd?.['ics']) {
        const ics = gtd['ics'] as Record<string, unknown>;
        if (ics['entries'] || ics['default'] || ics['wasSetLate'] != null) {
          consent.hasConsentMode = true;
          consent.version = 2;
        }
      }
    }
    // Check for Consent Mode v2 state cookies (exact name match, not substring)
    if (!consent.hasConsentMode) {
      const CONSENT_MODE_COOKIES = new Set([
        'ad_storage', 'analytics_storage', 'personalization_storage',
        'functionality_storage', 'security_storage',
        'ad_user_data', 'ad_personalization',
      ]);
      let cookieStr = '';
      try { cookieStr = document.cookie; } catch { /* SecurityError on strict CSP sites */ }
      const cookieNames = cookieStr.split(';').map(c => c.trim().split('=')[0]!);
      if (cookieNames.some(name => CONSENT_MODE_COOKIES.has(name))) {
        consent.hasConsentMode = true;
        consent.version = 2;
      }
    }

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
  }),
    new Promise<BrowserEvalResult>(resolve => setTimeout(() => resolve(emptyResult), EVAL_TIMEOUT)),
  ]);

  data.tools = evalResult.tools;
  data.dataLayer = evalResult.dataLayer;
  data.consent = evalResult.consent;

  // ─── Step 2: Enrich with network requests ────────────────────────────────
  const analyticsRequests = nc?.getAnalyticsRequests() ?? [];
  const tagManagerRequests = nc?.getTagManagerRequests() ?? [];
  const allRequests = nc?.getAllRequests() ?? [];

  // Detect additional tools from network that page.evaluate might miss
  const networkToolPatterns: Array<{ pattern: RegExp; name: string; type: AnalyticsTool['type'] }> = [
    // Core analytics
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
    { pattern: /adobedc\.net|omtrdc\.net|2o7\.net/, name: 'Adobe Analytics', type: 'analytics' },
    { pattern: /assets\.adobedtm\.com|launch-.*\.min\.js/, name: 'Adobe Launch', type: 'tag_manager' },
    { pattern: /tealiumiq\.com|tiqcdn\.com|tags\.tiqcdn\.com/, name: 'Tealium', type: 'tag_manager' },
    { pattern: /vitals\.vercel-insights\.com|_vercel\/insights/, name: 'Vercel Analytics', type: 'analytics' },
    { pattern: /newrelic\.com|nr-data\.net|bam\.nr-data\.net/, name: 'New Relic', type: 'analytics' },
    // Cloudflare
    { pattern: /cdn-cgi\/zaraz/, name: 'Cloudflare Zaraz', type: 'tag_manager' },
    { pattern: /static\.cloudflareinsights\.com/, name: 'Cloudflare Web Analytics', type: 'analytics' },
    // Microsoft Application Insights
    { pattern: /dc\.services\.visualstudio\.com|az416426\.vo\.msecnd\.net/, name: 'Application Insights', type: 'analytics' },
    // Advertising pixels
    { pattern: /connect\.facebook\.net|pixel\.facebook\.com/, name: 'Meta Pixel', type: 'advertising' },
    { pattern: /analytics\.tiktok\.com/, name: 'TikTok Pixel', type: 'advertising' },
    { pattern: /snap\.licdn\.com|px\.ads\.linkedin\.com/, name: 'LinkedIn Insight', type: 'advertising' },
    { pattern: /static\.ads-twitter\.com|analytics\.twitter\.com/, name: 'Twitter/X Pixel', type: 'advertising' },
    { pattern: /ct\.pinterest\.com|s\.pinimg\.com\/ct/, name: 'Pinterest Tag', type: 'advertising' },
    { pattern: /tr\.snapchat\.com|sc-static\.net/, name: 'Snapchat Pixel', type: 'advertising' },
    { pattern: /bat\.bing\.com/, name: 'Microsoft Ads', type: 'advertising' },
    { pattern: /static\.criteo\.net|dis\.criteo\.com/, name: 'Criteo', type: 'advertising' },
    { pattern: /cdn\.taboola\.com|trc\.taboola\.com/, name: 'Taboola', type: 'advertising' },
    { pattern: /widgets\.outbrain\.com/, name: 'Outbrain', type: 'advertising' },
    { pattern: /d\.adroll\.com/, name: 'AdRoll', type: 'advertising' },
    { pattern: /alb\.reddit\.com/, name: 'Reddit Pixel', type: 'advertising' },
    // Marketing automation
    { pattern: /js\.hs-scripts\.com|js\.hs-analytics\.net/, name: 'HubSpot', type: 'marketing' },
    { pattern: /static\.klaviyo\.com|a\.klaviyo\.com/, name: 'Klaviyo', type: 'marketing' },
    { pattern: /munchkin\.marketo\.net/, name: 'Marketo', type: 'marketing' },
    { pattern: /widget\.intercom\.io|js\.intercomcdn\.com/, name: 'Intercom', type: 'marketing' },
    { pattern: /js\.driftt\.com/, name: 'Drift', type: 'marketing' },
    // Privacy-focused analytics
    { pattern: /plausible\.io\/api/, name: 'Plausible', type: 'analytics' },
    { pattern: /simpleanalytics\.com|simpleanalyticscdn\.com/, name: 'Simple Analytics', type: 'analytics' },
    { pattern: /cdn\.rudderlabs\.com/, name: 'RudderStack', type: 'analytics' },
  ];

  const existingToolNames = new Set(evalResult.tools.map(t => t.name));
  // Scan all requests (not just pre-categorized analytics) to catch tools whose domains
  // may not have been in the NetworkCollector's category list at collection time
  for (const req of allRequests) {
    for (const { pattern, name, type } of networkToolPatterns) {
      if (pattern.test(req.url) && !existingToolNames.has(name)) {
        existingToolNames.add(name);
        evalResult.tools.push({ name, type, confidence: 0.8, details: { source: 'network' } });
      }
    }
  }

  // Extract GA4 measurement IDs and event names from network collect requests
  const networkMeasurementIds = new Set<string>();
  const networkEventNames = new Set<string>();
  for (const req of [...analyticsRequests, ...allRequests]) {
    // GA4 / UA collect URLs contain tid=G-XXXX or tid=UA-XXXX and en=event_name
    const tidMatch = req.url.match(/[?&]tid=((?:G|UA)-[A-Z0-9-]+)/i);
    if (tidMatch) networkMeasurementIds.add(tidMatch[1]!);
    const enMatch = req.url.match(/[?&]en=([^&]+)/);
    if (enMatch) {
      try { networkEventNames.add(decodeURIComponent(enMatch[1]!)); } catch { /* ignore bad encoding */ }
    }
  }
  // Merge network measurement IDs into the GA4 tool details
  const ga4Tool = evalResult.tools.find(t => t.name === 'Google Analytics 4');
  if (ga4Tool && networkMeasurementIds.size > 0) {
    const existing = (ga4Tool.details?.['measurementIds'] as string[]) ?? [];
    const merged = [...new Set([...existing, ...networkMeasurementIds])];
    ga4Tool.details['measurementIds'] = merged;
    if (!ga4Tool.id && merged.find(id => id.startsWith('G-'))) {
      ga4Tool.id = merged.find(id => id.startsWith('G-'));
    }
  }
  data.networkMeasurementIds = [...networkMeasurementIds];
  data.networkEventNames = [...networkEventNames];

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

  // ─── Cookie Deep Analysis (from CookieAnalyzer) ─────────────────────────
  if (ctx.cookieAnalysis) {
    data.cookieDetails = ctx.cookieAnalysis.cookies;
    data.cookieSummary = ctx.cookieAnalysis.summary;
  }

  const analyticsCookies = cookies.filter(c => c.tool !== null);
  // Non-compliant = missing Secure flag, or SameSite=None without Secure (browsers already block this)
  const nonCompliantCookies = analyticsCookies.filter(c => !c.secure);
  const crossSiteCookies = analyticsCookies.filter(c => c.sameSite === 'None' && c.secure);

  // Promote cookie-detected tools into the tools array if not already present.
  // Cookie detection catches Meta Pixel, TikTok, Microsoft Ads, Hotjar, etc.
  // that may not have been detected via window globals or network patterns.
  const cookieToolNames = new Set(analyticsCookies.map(c => c.tool).filter(Boolean));
  const existingToolSet = new Set(evalResult.tools.map(t => t.name));
  const COOKIE_TOOL_TYPE: Record<string, string> = {
    'Google Analytics': 'analytics', 'Google Ads': 'advertising',
    'Meta Pixel': 'advertising', 'TikTok Pixel': 'advertising',
    'Microsoft Ads': 'advertising', 'Mixpanel': 'analytics',
    'Amplitude': 'analytics', 'Heap': 'analytics', 'Segment': 'analytics',
    'PostHog': 'analytics', 'Pendo': 'analytics', 'FullStory': 'session_replay',
    'Hotjar': 'session_replay', 'Microsoft Clarity': 'heatmap',
    'Matomo': 'analytics', 'HubSpot': 'marketing', 'Pinterest Tag': 'advertising',
    'LinkedIn Insight': 'advertising', 'Snapchat Pixel': 'advertising',
    'Reddit Pixel': 'advertising', 'Criteo': 'advertising',
    'Klaviyo': 'marketing', 'Application Insights': 'analytics',
    'Twitter/X Pixel': 'advertising', 'Kissmetrics': 'analytics',
    'Snowplow': 'analytics',
  };
  for (const toolName of cookieToolNames) {
    if (toolName && !existingToolSet.has(toolName)) {
      // Don't add "Google Analytics" if "Google Analytics 4" already present
      if (toolName === 'Google Analytics' && existingToolSet.has('Google Analytics 4')) continue;
      existingToolSet.add(toolName);
      evalResult.tools.push({
        name: toolName,
        type: (COOKIE_TOOL_TYPE[toolName] ?? 'analytics') as AnalyticsTool['type'],
        confidence: 0.7,
        details: { source: 'cookies' },
      });
    }
  }

  // ─── Step 3b: Enrich with console, storage, and frame data ──────────────
  // Console SDK logs → confirm tools detected by globals, add new tools with confidence 0.6
  const sdkLogs = ctx.consoleCollector?.getSDKLogs() ?? [];
  const consoleSDKLogs: Array<{ tool: string; text: string }> = [];
  for (const log of sdkLogs) {
    if (log.sdkMatch && !existingToolSet.has(log.sdkMatch)) {
      existingToolSet.add(log.sdkMatch);
      evalResult.tools.push({
        name: log.sdkMatch,
        type: 'analytics',
        confidence: 0.6,
        details: { source: 'console_log' },
      });
    }
    if (log.sdkMatch) {
      consoleSDKLogs.push({ tool: log.sdkMatch, text: log.text.slice(0, 100) });
    }
  }
  data.consoleSDKLogs = consoleSDKLogs.slice(0, 20);

  // Storage SDK matches → promote to tools with confidence 0.65
  const storageData: Record<string, unknown> = {};
  if (ctx.storageSnapshot) {
    const lsMatches = ctx.storageSnapshot.localStorage.sdkMatches;
    const ssMatches = ctx.storageSnapshot.sessionStorage.sdkMatches;
    const allStorageMatches = [...lsMatches, ...ssMatches];

    for (const match of allStorageMatches) {
      if (!existingToolSet.has(match.tool)) {
        existingToolSet.add(match.tool);
        evalResult.tools.push({
          name: match.tool,
          type: 'analytics',
          confidence: 0.65,
          details: { source: 'storage' },
        });
      }
    }

    storageData.localStorageKeys = ctx.storageSnapshot.localStorage.totalKeys;
    storageData.sessionStorageKeys = ctx.storageSnapshot.sessionStorage.totalKeys;
    storageData.localStorageBytes = ctx.storageSnapshot.localStorage.totalBytes;
    storageData.sdkMatches = allStorageMatches;
  }
  data.storage = storageData;

  // Frame-detected tools → add with confidence 0.7
  const iframeTools: Array<{ tool: string; src: string }> = [];
  if (ctx.frameSnapshot) {
    for (const frame of ctx.frameSnapshot.toolFrames) {
      if (!existingToolSet.has(frame.tool)) {
        existingToolSet.add(frame.tool);
        evalResult.tools.push({
          name: frame.tool,
          type: 'analytics',
          confidence: 0.7,
          details: { source: 'iframe' },
        });
      }
      iframeTools.push(frame);
    }
  }
  data.iframeTools = iframeTools;

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

  // Check for consent-gated tools
  const consentGatedTools = evalResult.tools.filter(t => (t.details as Record<string, unknown>)?.['consentGated'] === true);
  const hasConsentGated = consentGatedTools.length > 0;

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
    } else if (hasConsentGated) {
      // Analytics scripts exist but are consent-gated — this is correct behavior
      health = 'good';
      const gatedNames = consentGatedTools.map(t => t.name).join(', ');
      evidence = `Analytics configured but consent-gated (${gatedNames}) — scripts load after user consent`;
    } else {
      health = 'critical';
      evidence = 'No analytics tools detected on this page';
      recommendation = 'Implement GA4 or another analytics platform to measure website performance.';
    }

    checkpoints.push(createCheckpoint({ id: 'm05-primary-analytics', name: 'Primary Analytics Tool', weight: 1.0, health, evidence, recommendation }));
  }

  // CP2: Measurement ID accuracy (checks window globals + network requests)
  {
    const ga4ToolCp = evalResult.tools.find(t => t.name === 'Google Analytics 4');
    const ga4Ids = (ga4ToolCp?.details?.['measurementIds'] as string[]) ?? [];
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
    } else if (ga4ToolCp) {
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

  // CP3: Event tracking depth (dataLayer + network event names)
  {
    const ENHANCED_EVENTS = new Set(['page_view', 'scroll', 'click', 'view_search_results', 'file_download', 'form_start', 'form_submit', 'user_engagement', 'first_visit', 'session_start']);
    const SYSTEM_EVENTS = new Set(['gtm.js', 'gtm.dom', 'gtm.load', 'gtm.click', 'gtm.scrollDepth', 'gtm.formSubmit', 'page_view']);

    // Check dataLayer (GTM-based sites)
    const hasEnhancedFromDL = evalResult.dataLayerKeys.some(k => ENHANCED_EVENTS.has(k));
    const hasCustomFromDL = evalResult.dataLayer.some(e => e?.event && !SYSTEM_EVENTS.has(e.event));

    // Check network collect request event names (gtag-based sites like Stripe)
    const hasEnhancedFromNetwork = networkEventNames.size > 0 && [...networkEventNames].some(ev => ENHANCED_EVENTS.has(ev));
    const hasCustomFromNetwork = networkEventNames.size > 0 && [...networkEventNames].some(ev => !ENHANCED_EVENTS.has(ev) && !SYSTEM_EVENTS.has(ev));

    const hasEnhanced = hasEnhancedFromDL || hasEnhancedFromNetwork;
    const hasCustom = hasCustomFromDL || hasCustomFromNetwork;

    let health: CheckpointHealth;
    let evidence: string;

    if (hasEnhanced && hasCustom) {
      health = 'excellent';
      const customEvts = [...networkEventNames].filter(ev => !ENHANCED_EVENTS.has(ev) && !SYSTEM_EVENTS.has(ev));
      evidence = `Enhanced measurement + custom events firing${customEvts.length > 0 ? ` (${customEvts.slice(0, 5).join(', ')})` : ''}`;
    } else if (hasEnhanced || hasCustom) {
      health = 'good';
      const evtList = [...networkEventNames].slice(0, 5).join(', ');
      evidence = hasEnhanced ? `Enhanced measurement enabled (${evtList})` : `Custom events detected (${evtList})`;
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
    } else if (hasConsentGated) {
      // Scripts are consent-gated (type="text/plain") which proves a CMP is active
      // even if the CMP global wasn't detected
      health = 'good';
      evidence = 'Consent gating detected on analytics scripts (scripts blocked pre-consent)';
      recommendation = 'Verify Google Consent Mode v2 is integrated with your consent platform.';
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
      const crossSiteNote = crossSiteCookies.length > 0 ? ` (${crossSiteCookies.length} use SameSite=None for cross-domain)` : '';
      health = 'excellent';
      evidence = `All ${analyticsCookies.length} analytics cookies have Secure flag${crossSiteNote}`;
    } else if (nonCompliantCookies.length <= analyticsCookies.length * 0.3) {
      health = 'good';
      evidence = `${analyticsCookies.length - nonCompliantCookies.length}/${analyticsCookies.length} analytics cookies have Secure flag`;
    } else {
      health = 'warning';
      evidence = `${nonCompliantCookies.length}/${analyticsCookies.length} analytics cookies missing Secure flag`;
    }

    checkpoints.push(createCheckpoint({ id: 'm05-cookie-compliance', name: 'Cookie Compliance', weight: 0.6, health, evidence }));
  }

  // CP11: Cookie Security (from CookieAnalyzer)
  {
    if (ctx.cookieAnalysis) {
      const insecureCount = ctx.cookieAnalysis.cookies.filter(c => !c.secure).length;
      const totalCount = ctx.cookieAnalysis.cookies.length;
      let health: CheckpointHealth;
      let evidence: string;

      if (insecureCount > 5) {
        health = 'warning';
        evidence = `${insecureCount} of ${totalCount} cookies missing Secure flag`;
      } else if (insecureCount > 0) {
        health = 'good';
        evidence = `${insecureCount} of ${totalCount} cookies missing Secure flag`;
      } else {
        health = 'excellent';
        evidence = `All ${totalCount} cookies have Secure flag`;
      }

      checkpoints.push(createCheckpoint({ id: 'm05-cookie-security', name: 'Cookie Security', weight: 0.3, health, evidence }));
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm05-cookie-security', name: 'Cookie Security', weight: 0.3, evidence: 'Cookie deep analysis not available' }));
    }
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

export { execute };
registerModuleExecutor('M05' as ModuleId, execute);
