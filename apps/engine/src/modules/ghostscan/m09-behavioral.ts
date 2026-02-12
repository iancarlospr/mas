/**
 * M09 - Behavioral Intelligence
 *
 * Uses active probing (scroll, click, hover) to detect A/B testing,
 * personalization, scroll-depth tracking, click tracking, and
 * behavioral analytics tools that only fire on user interaction.
 *
 * Checkpoints:
 *   1. A/B testing / experimentation detected
 *   2. Scroll-depth tracking
 *   3. Click tracking active
 *   4. Session recording detected
 *   5. Heatmap tracking detected
 *   6. Personalization engine
 *   7. Modal/Popup overlays
 *   8. Content gating / paywall
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fullScrollProbe } from '../../ghostscan/probes.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const nc = ctx.networkCollector;

  if (!page || !nc) {
    return { moduleId: 'M09' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page/network collector' };
  }

  // ─── Step 1: Snapshot before probing ─────────────────────────────────────
  const beforeTimestamp = Date.now();
  const requestsBefore = nc.getAllRequests().length;

  // ─── Step 2: Active scroll probe ─────────────────────────────────────────
  await fullScrollProbe(page, { steps: 4, stepDelay: 600 });
  const afterScrollTimestamp = Date.now();
  const scrollRequests = nc.getRequestsSince(beforeTimestamp);

  // ─── Step 3: Active click probe (try CTA buttons) ────────────────────────
  // Use a non-navigating synthetic click: dispatches MouseEvent to fire analytics
  // handlers but does NOT follow <a href> links (prevents SPA route changes that
  // break subsequent page.evaluate calls on Discord, Slack, etc.)
  const beforeClick = Date.now();
  let clickTriggeredRequests = 0;
  try {
    const clicked = await page.evaluate(() => {
      const selectors = [
        'a[href]:not([href^="#"]):not([href^="javascript"])',
        'button:not([disabled])',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el instanceof HTMLElement) {
          // Temporarily prevent default to avoid navigation
          const handler = (e: Event) => e.preventDefault();
          el.addEventListener('click', handler, { capture: true, once: true });
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(800);
      const clickReqs = nc.getRequestsSince(beforeClick);
      clickTriggeredRequests = clickReqs.length;
    }
  } catch {
    // Click probe failed — not critical, continue
  }

  // ─── Step 4: Detect experiment/personalization tools ─────────────────────
  const behavioralData = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;

    const experiments: string[] = [];
    const sessionRecording: string[] = [];
    const heatmaps: string[] = [];

    // A/B testing tools
    if (w['optimizely'] || w['optimizelyEdge']) experiments.push('Optimizely');
    if (w['VWO'] || w['_vwo_code']) experiments.push('VWO');
    if (w['_ABTasty'] || w['ABTasty']) experiments.push('AB Tasty');
    if (w['google_optimize'] || w['dataLayer']?.toString().includes('optimize')) experiments.push('Google Optimize');
    if (w['Kameleoon']) experiments.push('Kameleoon');
    if (w['convert'] || w['_conv_q'] || w['_conv_data'] || w['_conv_s']) experiments.push('Convert.com');
    if (w['launchdarkly'] || w['ldclient']) experiments.push('LaunchDarkly');
    if (w['statsig']) experiments.push('Statsig');

    // Check for variation cookies
    const cookies = document.cookie;
    if (cookies.includes('_vis_opt_') || cookies.includes('_vwo_')) experiments.push('VWO (cookie)');
    if (cookies.includes('optimizelyEndUserId')) experiments.push('Optimizely (cookie)');

    // Session recording
    if (w['hj'] || w['_hjSettings']) sessionRecording.push('Hotjar');
    if (w['FS'] || w['_fs_org']) sessionRecording.push('FullStory');
    if (w['posthog'] && (w['posthog'] as Record<string, unknown>)['sessionRecordingStarted']) sessionRecording.push('PostHog');
    if (w['mouseflow'] || w['_mfq']) sessionRecording.push('Mouseflow');
    if (w['LogRocket']) sessionRecording.push('LogRocket');
    if (w['smartlook']) sessionRecording.push('Smartlook');
    if (typeof w['clarity'] === 'function') sessionRecording.push('Microsoft Clarity');

    // Heatmaps
    if (w['CE2'] || w['CE_SNAPSHOT_NAME']) heatmaps.push('Crazy Egg');
    if (w['hj'] && typeof w['hj'] === 'function') heatmaps.push('Hotjar');
    if (typeof w['clarity'] === 'function') heatmaps.push('Microsoft Clarity');
    if (w['__lo_cs_added']) heatmaps.push('Lucky Orange');

    // Scroll tracking signals
    const hasScrollListener = !!(w['ga'] || w['gtag'] || w['_gaq'] || w['dataLayer']);

    return { experiments, sessionRecording, heatmaps, hasScrollListener };
  });

  // ─── Step 4b: Network/script-based detection (catches consent-gated & async tools) ─
  const allNetRequests = nc.getAllRequests();
  const allScriptUrls = allNetRequests
    .filter(r => r.resourceType === 'script' || r.resourceType === 'xhr' || r.resourceType === 'fetch')
    .map(r => r.url.toLowerCase());

  // A/B Testing — network detection
  const experimentNet: Array<[RegExp, string]> = [
    [/convertexperiments\.com|convert\.com\/js/i, 'Convert.com'],
    [/optimizely\.com/i, 'Optimizely'],
    [/vwo\.com|visualwebsiteoptimizer/i, 'VWO'],
    [/abtasty\.com/i, 'AB Tasty'],
    [/kameleoon\.com/i, 'Kameleoon'],
    [/launchdarkly/i, 'LaunchDarkly'],
    [/split\.io/i, 'Split.io'],
    [/statsig/i, 'Statsig'],
    [/flagsmith/i, 'Flagsmith'],
  ];
  for (const [pattern, name] of experimentNet) {
    if (!behavioralData.experiments.includes(name) && allScriptUrls.some(u => pattern.test(u))) {
      behavioralData.experiments.push(name);
    }
  }

  // Session Recording — network detection
  const recordingNet: Array<[RegExp, string]> = [
    [/hotjar\.com/i, 'Hotjar'],
    [/fullstory\.com|edge\.fullstory/i, 'FullStory'],
    [/clarity\.ms/i, 'Microsoft Clarity'],
    [/mouseflow\.com/i, 'Mouseflow'],
    [/logrocket/i, 'LogRocket'],
    [/smartlook/i, 'Smartlook'],
    [/cdn\.heapanalytics\.com|heap-.*\.js/i, 'Heap'],
    [/cdn\.pendo\.io/i, 'Pendo'],
    [/t\.contentsquare\.net/i, 'Contentsquare'],
    [/inspectlet\.com/i, 'Inspectlet'],
  ];
  for (const [pattern, name] of recordingNet) {
    if (!behavioralData.sessionRecording.includes(name) && allScriptUrls.some(u => pattern.test(u))) {
      behavioralData.sessionRecording.push(name);
    }
  }

  // Heatmaps — network detection
  const heatmapNet: Array<[RegExp, string]> = [
    [/hotjar\.com/i, 'Hotjar'],
    [/clarity\.ms/i, 'Microsoft Clarity'],
    [/crazyegg\.com/i, 'Crazy Egg'],
    [/luckyorange\.com/i, 'Lucky Orange'],
    [/t\.contentsquare\.net/i, 'Contentsquare'],
  ];
  for (const [pattern, name] of heatmapNet) {
    if (!behavioralData.heatmaps.includes(name) && allScriptUrls.some(u => pattern.test(u))) {
      behavioralData.heatmaps.push(name);
    }
  }

  // Personalization — window globals + network
  const personalization: string[] = [];
  const personalizationGlobals = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const tools: string[] = [];
    if (w['DY'] || w['DYO']) tools.push('Dynamic Yield');
    if (w['Evergage'] || w['SalesforceInteractions']) tools.push('Salesforce Interaction Studio');
    if (w['_Monetate'] || w['monetate']) tools.push('Monetate');
    if (w['Mutiny']) tools.push('Mutiny');
    if (w['ninetailed']) tools.push('Ninetailed');
    return tools;
  });
  personalization.push(...personalizationGlobals);
  const personalizationNet: Array<[RegExp, string]> = [
    [/dynamicyield\.com|dy-assets/i, 'Dynamic Yield'],
    [/evergage\.com|interaction-studio/i, 'Salesforce Interaction Studio'],
    [/monetate\.net/i, 'Monetate'],
    [/mutinyhq\.com/i, 'Mutiny'],
  ];
  for (const [pattern, name] of personalizationNet) {
    if (!personalization.includes(name) && allScriptUrls.some(u => pattern.test(u))) {
      personalization.push(name);
    }
  }

  // ─── Step 4c: Storage-based experiment detection ─────────────────────────
  const storageExperiments: Array<{ key: string; tool: string; storage: 'localStorage' | 'sessionStorage' }> = [];
  if (ctx.storageSnapshot) {
    const experimentKeyPatterns: Array<{ pattern: RegExp; tool: string }> = [
      { pattern: /^optimizely/i, tool: 'Optimizely' },
      { pattern: /^_vis_opt_/i, tool: 'VWO' },
      { pattern: /^ABTasty/i, tool: 'AB Tasty' },
      { pattern: /^experiment/i, tool: 'Custom Experiment' },
      { pattern: /^variant/i, tool: 'Custom Variant' },
      { pattern: /^__ld_/i, tool: 'LaunchDarkly' },
      { pattern: /^statsig/i, tool: 'Statsig' },
      { pattern: /^split/i, tool: 'Split.io' },
      { pattern: /^flagsmith/i, tool: 'Flagsmith' },
    ];

    for (const entry of ctx.storageSnapshot.localStorage.entries) {
      for (const { pattern, tool } of experimentKeyPatterns) {
        if (pattern.test(entry.key)) {
          storageExperiments.push({ key: entry.key, tool, storage: 'localStorage' });
          if (!behavioralData.experiments.includes(tool) && !behavioralData.experiments.includes(`${tool} (cookie)`)) {
            behavioralData.experiments.push(tool);
          }
          break;
        }
      }
    }

    for (const entry of ctx.storageSnapshot.sessionStorage.entries) {
      for (const { pattern, tool } of experimentKeyPatterns) {
        if (pattern.test(entry.key)) {
          storageExperiments.push({ key: entry.key, tool, storage: 'sessionStorage' });
          if (!behavioralData.experiments.includes(tool) && !behavioralData.experiments.includes(`${tool} (cookie)`)) {
            behavioralData.experiments.push(tool);
          }
          break;
        }
      }
    }
  }
  data.storageExperiments = storageExperiments;

  // ─── Step 4d: DOM data-attribute experiment detection ─────────────────────
  if (ctx.domForensics) {
    const experimentAttrs = ctx.domForensics.dataAttributes.filter(a =>
      /experiment|variant|test[-_]?id|ab[-_]?test|split/i.test(a.attr)
    );
    if (experimentAttrs.length > 0) {
      data.domExperimentAttributes = experimentAttrs;
    }
  }

  // ─── Step 4e: Modal/Popup Overlay Detection ─────────────────────────────
  const overlays: Array<{ type: string; isDismissible: boolean; coversContent: boolean }> = [];
  try {
    const overlayResults = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const viewportArea = vw * vh;
      const results: Array<{ type: string; isDismissible: boolean; coversContent: boolean }> = [];

      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (results.length >= 10) break;
        const style = window.getComputedStyle(el);
        const position = style.position;
        if (position !== 'fixed' && position !== 'absolute') continue;

        const zIndex = parseInt(style.zIndex, 10);
        if (isNaN(zIndex) || zIndex <= 1000) continue;

        const opacity = parseFloat(style.opacity);
        if (isNaN(opacity) || opacity <= 0) continue;

        const rect = el.getBoundingClientRect();
        const elArea = rect.width * rect.height;
        const coversContent = elArea > viewportArea * 0.3;
        if (!coversContent && elArea < viewportArea * 0.05) continue; // skip tiny elements

        // Classify the overlay
        const text = (el.textContent || '').toLowerCase();
        const html = el.innerHTML?.toLowerCase() || '';
        let type = 'other';

        if (html.includes('type="email"') || html.includes('type=\'email\'') || /subscribe|newsletter|sign.?up for/i.test(text)) {
          type = 'newsletter';
        } else if (/discount|offer|sale|promo|coupon|deal|% off/i.test(text)) {
          type = 'promotional';
        } else if (/subscribe to read|member|paywall|premium access|unlock.*content/i.test(text)) {
          type = 'paywall';
        } else if (/log.?in|sign.?in|create.*account/i.test(text) && (html.includes('type="password"') || html.includes('type=\'password\''))) {
          type = 'login-wall';
        } else if (/cookie|consent|gdpr|ccpa/i.test(text)) {
          continue; // skip cookie consent overlays — handled separately
        }

        // Check if dismissible
        const closeSelectors = [
          '[class*="close"]', '[aria-label*="close"]', '[aria-label*="Close"]',
          '[class*="dismiss"]', '[aria-label*="dismiss"]',
        ];
        let isDismissible = false;
        for (const sel of closeSelectors) {
          if (el.querySelector(sel)) { isDismissible = true; break; }
        }
        if (!isDismissible) {
          // Check for buttons containing X or close text
          const buttons = el.querySelectorAll('button, [role="button"]');
          for (const btn of buttons) {
            const btnText = (btn.textContent || '').trim();
            if (btnText === 'X' || btnText === '\u00D7' || btnText === '\u2715' || /^close$/i.test(btnText)) {
              isDismissible = true;
              break;
            }
          }
        }

        results.push({ type, isDismissible, coversContent });
      }
      return results;
    });
    overlays.push(...overlayResults);
  } catch {
    // Overlay detection failed — not critical
  }
  data.overlays = overlays;

  // ─── Step 4f: Push Notification Detection ───────────────────────────────
  let pushNotifications: { permissionState: string; sdkDetected: boolean; sdkName: string | null } = {
    permissionState: 'unknown',
    sdkDetected: false,
    sdkName: null,
  };
  try {
    const pushData = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      let permissionState = 'unknown';
      try {
        if (typeof Notification !== 'undefined') {
          permissionState = Notification.permission; // 'granted' | 'denied' | 'default'
        }
      } catch { /* Notification API not available */ }

      // Check window globals for push notification SDKs
      const sdkChecks: Array<{ check: () => boolean; name: string }> = [
        { check: () => !!(w['OneSignal'] || w['OneSignalDeferred']), name: 'OneSignal' },
        { check: () => !!(w['firebase'] && (w['firebase'] as Record<string, unknown>)['messaging']), name: 'Firebase Cloud Messaging' },
        { check: () => !!(w['PushEngage'] || w['_peq']), name: 'PushEngage' },
        { check: () => !!(w['Pushwoosh'] || w['__pw']), name: 'Pushwoosh' },
        { check: () => !!(w['webpushr']), name: 'WebPushr' },
        { check: () => !!(w['PushAssist']), name: 'PushAssist' },
        { check: () => !!(w['_aimtell']), name: 'Aimtell' },
        { check: () => !!(w['_vwo_push']), name: 'VWO Engage' },
        { check: () => !!(w['pushalert'] || w['PushAlert']), name: 'PushAlert' },
        { check: () => !!(w['izooto'] || w['_izooto']), name: 'iZooto' },
      ];

      for (const { check, name } of sdkChecks) {
        try {
          if (check()) return { permissionState, sdkDetected: true, sdkName: name };
        } catch { /* guard */ }
      }

      return { permissionState, sdkDetected: false, sdkName: null as string | null };
    });
    pushNotifications = pushData;

    // Also check network requests for push SDK patterns if not already detected
    if (!pushNotifications.sdkDetected) {
      const pushNetPatterns: Array<[RegExp, string]> = [
        [/onesignal/i, 'OneSignal'],
        [/firebase-messaging|firebasejs.*messaging/i, 'Firebase Cloud Messaging'],
        [/pushengage/i, 'PushEngage'],
        [/pushwoosh/i, 'Pushwoosh'],
        [/webpushr/i, 'WebPushr'],
        [/pushassist/i, 'PushAssist'],
        [/aimtell/i, 'Aimtell'],
        [/pushalert/i, 'PushAlert'],
        [/izooto/i, 'iZooto'],
      ];
      for (const [pattern, name] of pushNetPatterns) {
        if (allScriptUrls.some(u => pattern.test(u))) {
          pushNotifications = { ...pushNotifications, sdkDetected: true, sdkName: name };
          break;
        }
      }
    }
  } catch {
    // Push notification detection failed — not critical
  }
  data.pushNotifications = pushNotifications;

  if (pushNotifications.sdkDetected && pushNotifications.sdkName) {
    signals.push(createSignal({
      type: 'push-notification',
      name: pushNotifications.sdkName,
      confidence: 0.85,
      evidence: `Push notification SDK: ${pushNotifications.sdkName}`,
      category: 'engagement',
    }));
  }

  // ─── Step 4g: Paywall / Content Gating Detection ────────────────────────
  let contentGating: { isGated: boolean; gatingType: string | null; paywallProvider: string | null } = {
    isGated: false,
    gatingType: null,
    paywallProvider: null,
  };
  try {
    const gatingData = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;

      // Check for paywall/gating CSS classes and selectors
      const gatingSelectors = [
        '[class*="paywall"]', '[class*="content-gate"]', '[class*="subscription-wall"]',
        '[class*="premium-content"]', '[class*="metered"]', '[class*="regwall"]',
        '[id*="paywall"]', '[id*="content-gate"]', '[id*="subscription-wall"]',
        '[data-paywall]', '[data-content-gate]',
      ];

      let gatingType: string | null = null;
      for (const sel of gatingSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const text = (el.textContent || '').toLowerCase();
          if (/subscribe|membership|premium/i.test(text)) {
            gatingType = 'subscription-paywall';
          } else if (/register|sign.?up|create.*account/i.test(text)) {
            gatingType = 'registration-wall';
          } else if (/article|reading|remaining/i.test(text)) {
            gatingType = 'metered-paywall';
          } else {
            gatingType = 'content-gate';
          }
          break;
        }
      }

      // Detect content fade-out / truncation pattern
      if (!gatingType) {
        const articles = document.querySelectorAll('article, [class*="article"], [class*="post-content"], [class*="entry-content"]');
        for (const article of articles) {
          const style = window.getComputedStyle(article);
          if (style.overflow === 'hidden' && article.scrollHeight > article.clientHeight * 1.5) {
            // Check for gradient overlay child
            const children = article.querySelectorAll('*');
            for (const child of children) {
              const childStyle = window.getComputedStyle(child);
              if (childStyle.backgroundImage?.includes('gradient') && childStyle.position === 'absolute') {
                gatingType = 'content-fade-truncation';
                break;
              }
            }
            if (gatingType) break;
          }
        }
      }

      // Detect paywall providers via window globals
      const providerChecks: Array<{ check: () => boolean; name: string }> = [
        { check: () => !!(w['tp'] || w['TPPaywall'] || Object.keys(w).some(k => k.startsWith('tp_'))), name: 'Piano' },
        { check: () => !!(w['tinypass'] || w['TinyPass']), name: 'Tinypass' },
        { check: () => !!(w['leakyPaywall']), name: 'Leaky Paywall' },
        { check: () => !!(w['mepr'] || w['MeproSettings']), name: 'MemberPress' },
        { check: () => !!(w['Pelcro']), name: 'Pelcro' },
        { check: () => !!(w['Zephr'] || w['__zephr']), name: 'Zephr' },
        { check: () => !!(w['Zuora'] || w['zuora']), name: 'Zuora' },
      ];

      let paywallProvider: string | null = null;
      for (const { check, name } of providerChecks) {
        try {
          if (check()) { paywallProvider = name; break; }
        } catch { /* guard */ }
      }

      // Check for noarchive meta tag (common on paywalled content)
      const robotsMeta = document.querySelector('meta[name="robots"]');
      const hasNoArchive = robotsMeta?.getAttribute('content')?.toLowerCase().includes('noarchive') ?? false;

      const isGated = !!(gatingType || paywallProvider || hasNoArchive);
      if (!gatingType && paywallProvider) gatingType = 'provider-detected';
      if (!gatingType && hasNoArchive) gatingType = 'noarchive-meta';

      return { isGated, gatingType, paywallProvider };
    });
    contentGating = gatingData;

    // Also check network requests for paywall provider scripts if not already detected
    if (!contentGating.paywallProvider) {
      const paywallNetPatterns: Array<[RegExp, string]> = [
        [/piano\.io|tinypass\.com|experience\.tinypass/i, 'Piano'],
        [/leakypaywall/i, 'Leaky Paywall'],
        [/memberpress/i, 'MemberPress'],
        [/pelcro/i, 'Pelcro'],
        [/zephr/i, 'Zephr'],
        [/zuora/i, 'Zuora'],
      ];
      for (const [pattern, name] of paywallNetPatterns) {
        if (allScriptUrls.some(u => pattern.test(u))) {
          contentGating = { isGated: true, gatingType: contentGating.gatingType || 'provider-detected', paywallProvider: name };
          break;
        }
      }
    }
  } catch {
    // Content gating detection failed — not critical
  }
  data.contentGating = contentGating;

  data.behavioral = { ...behavioralData, personalization };
  data.scrollTriggeredRequests = scrollRequests.length;
  data.clickTriggeredRequests = clickTriggeredRequests;

  // Analyze scroll-triggered network activity
  const scrollAnalyticsRequests = scrollRequests.filter(r =>
    r.category === 'analytics' || r.category === 'advertising' || r.category === 'martech',
  );
  const hasScrollTracking = scrollAnalyticsRequests.length > 0;
  const hasClickTracking = clickTriggeredRequests > 0;

  data.hasScrollTracking = hasScrollTracking;
  data.hasClickTracking = hasClickTracking;

  // ─── Step 5: Build signals ───────────────────────────────────────────────
  for (const tool of behavioralData.experiments) {
    signals.push(createSignal({ type: 'ab_testing', name: tool, confidence: 0.85, evidence: `A/B testing: ${tool}`, category: 'experimentation' }));
  }
  for (const tool of behavioralData.sessionRecording) {
    signals.push(createSignal({ type: 'session_recording', name: tool, confidence: 0.9, evidence: `Session recording: ${tool}`, category: 'analytics' }));
  }
  for (const tool of personalization) {
    signals.push(createSignal({ type: 'personalization', name: tool, confidence: 0.85, evidence: `Personalization: ${tool}`, category: 'experimentation' }));
  }

  // ─── Step 6: Build checkpoints ───────────────────────────────────────────

  // CP1: A/B testing
  {
    if (behavioralData.experiments.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm09-experiments', name: 'A/B Testing / Experimentation', weight: 0.6,
        health: 'excellent',
        evidence: `Experimentation tools: ${behavioralData.experiments.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m09-experiments', 'A/B Testing / Experimentation', 'No A/B testing tools detected'));
    }
  }

  // CP2: Scroll-depth tracking
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (hasScrollTracking && scrollAnalyticsRequests.length >= 2) {
      health = 'excellent';
      evidence = `Scroll tracking active: ${scrollAnalyticsRequests.length} analytics requests triggered by scrolling`;
    } else if (hasScrollTracking) {
      health = 'good';
      evidence = `Some scroll tracking detected (${scrollAnalyticsRequests.length} requests)`;
    } else {
      health = 'good';
      evidence = 'No scroll-depth tracking detected (may not be needed)';
    }

    checkpoints.push(createCheckpoint({ id: 'm09-scroll', name: 'Scroll-Depth Tracking', weight: 0.4, health, evidence }));
  }

  // CP3: Click tracking
  {
    checkpoints.push(
      hasClickTracking
        ? createCheckpoint({ id: 'm09-click', name: 'Click Tracking', weight: 0.4, health: 'excellent', evidence: `Click tracking active: ${clickTriggeredRequests} requests triggered by click interaction` })
        : createCheckpoint({ id: 'm09-click', name: 'Click Tracking', weight: 0.4, health: 'good', evidence: 'No click-triggered analytics requests detected' }),
    );
  }

  // CP4: Session recording
  {
    if (behavioralData.sessionRecording.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm09-session-rec', name: 'Session Recording', weight: 0.5,
        health: 'excellent',
        evidence: `Session recording: ${behavioralData.sessionRecording.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m09-session-rec', 'Session Recording', 'No session recording tools detected'));
    }
  }

  // CP5: Heatmap tracking
  {
    if (behavioralData.heatmaps.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm09-heatmaps', name: 'Heatmap Tracking', weight: 0.4,
        health: 'excellent',
        evidence: `Heatmap tools: ${behavioralData.heatmaps.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m09-heatmaps', 'Heatmap Tracking', 'No heatmap tools detected'));
    }
  }

  // CP6: Personalization
  {
    if (personalization.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm09-personalization', name: 'Personalization Engine', weight: 0.5,
        health: 'excellent',
        evidence: `Personalization active: ${personalization.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m09-personalization', 'Personalization Engine', 'No personalization engine detected'));
    }
  }

  // CP7: Modal/Popup Overlays
  {
    if (overlays.length > 0) {
      const overlayTypes = overlays.map(o => o.type);
      const uniqueTypes = [...new Set(overlayTypes)];
      const contentBlockers = overlays.filter(o => o.coversContent && !o.isDismissible);
      const health: CheckpointHealth = contentBlockers.length > 0 ? 'critical' : 'warning';
      checkpoints.push(createCheckpoint({
        id: 'm09-overlays', name: 'Modal/Popup Overlays', weight: 0.4,
        health,
        evidence: `${overlays.length} overlay(s) detected: ${uniqueTypes.join(', ')}${contentBlockers.length > 0 ? ` (${contentBlockers.length} non-dismissible content-blocking)` : ''}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m09-overlays', 'Modal/Popup Overlays', 'No modal or popup overlays detected'));
    }
  }

  // CP8: Content Gating
  {
    if (contentGating.isGated) {
      const details: string[] = [];
      if (contentGating.gatingType) details.push(`type: ${contentGating.gatingType}`);
      if (contentGating.paywallProvider) details.push(`provider: ${contentGating.paywallProvider}`);
      checkpoints.push(createCheckpoint({
        id: 'm09-content-gating', name: 'Content Gating', weight: 0.4,
        health: 'warning',
        evidence: `Content gating detected — ${details.join(', ')}`,
      }));
    } else {
      checkpoints.push(infoCheckpoint('m09-content-gating', 'Content Gating', 'No content gating or paywall detected'));
    }
  }

  return { moduleId: 'M09' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M09' as ModuleId, execute);
