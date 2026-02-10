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
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { fullScrollProbe, clickElement } from '../../ghostscan/probes.js';

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
  const ctaSelectors = [
    'a[href]:not([href^="#"]):not([href^="javascript"])',
    'button:not([disabled])',
  ];
  let clickTriggeredRequests = 0;
  for (const sel of ctaSelectors) {
    const beforeClick = Date.now();
    const clicked = await clickElement(page, sel, { waitForVisible: true, timeout: 3000, waitAfter: 800 });
    if (clicked) {
      const clickReqs = nc.getRequestsSince(beforeClick);
      clickTriggeredRequests += clickReqs.length;
      break; // One click is enough to check
    }
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
    if (w['convert'] || w['_conv_q']) experiments.push('Convert.com');
    if (w['launchdarkly'] || w['ldclient']) experiments.push('LaunchDarkly');

    // Check for variation cookies
    const cookies = document.cookie;
    if (cookies.includes('_vis_opt_') || cookies.includes('_vwo_')) experiments.push('VWO (cookie)');
    if (cookies.includes('optimizelyEndUserId')) experiments.push('Optimizely (cookie)');

    // Session recording
    if (w['hj'] && typeof w['hj'] === 'function') sessionRecording.push('Hotjar');
    if (w['FS'] || w['_fs_org']) sessionRecording.push('FullStory');
    if (w['posthog'] && (w['posthog'] as Record<string, unknown>)['sessionRecordingStarted']) sessionRecording.push('PostHog');
    if (w['mouseflow'] || w['_mfq']) sessionRecording.push('Mouseflow');
    if (w['LogRocket']) sessionRecording.push('LogRocket');
    if (w['smartlook']) sessionRecording.push('Smartlook');

    // Heatmaps
    if (w['CE2'] || w['CE_SNAPSHOT_NAME']) heatmaps.push('Crazy Egg');
    if (w['hj'] && typeof w['hj'] === 'function') heatmaps.push('Hotjar');
    if (typeof w['clarity'] === 'function') heatmaps.push('Microsoft Clarity');
    if (w['__lo_cs_added']) heatmaps.push('Lucky Orange');

    // Scroll tracking signals
    const hasScrollListener = !!(w['ga'] || w['gtag'] || w['_gaq'] || w['dataLayer']);

    return { experiments, sessionRecording, heatmaps, hasScrollListener };
  });

  data.behavioral = behavioralData;
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

  return { moduleId: 'M09' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M09' as ModuleId, execute);
