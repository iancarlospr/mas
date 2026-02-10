/**
 * M13 - Performance & Carbon Footprint
 *
 * Estimates page carbon footprint based on transfer size and hosting,
 * audits page weight breakdown, and assesses sustainability indicators.
 *
 * Checkpoints:
 *   1. Estimated CO2 per page view
 *   2. Page weight efficiency
 *   3. Green hosting detection
 *   4. Image format optimization
 *   5. Font loading strategy
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// Average CO2 per GB transferred: ~0.6g (varies by hosting, grid mix)
const CO2_PER_GB = 0.6;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return { moduleId: 'M13' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let totalBytes = 0;
    let imageBytes = 0;
    let scriptBytes = 0;
    let styleBytes = 0;
    let fontBytes = 0;
    let otherBytes = 0;
    let modernImageCount = 0;
    let legacyImageCount = 0;

    for (const res of resources) {
      const size = res.transferSize || res.encodedBodySize || 0;
      totalBytes += size;
      const type = res.initiatorType;
      if (type === 'img' || type === 'image') {
        imageBytes += size;
        if (/\.(webp|avif)(\?|$)/i.test(res.name)) modernImageCount++;
        else if (/\.(png|jpg|jpeg|gif)(\?|$)/i.test(res.name)) legacyImageCount++;
      } else if (type === 'script') { scriptBytes += size; }
      else if (type === 'css' || type === 'link') { styleBytes += size; }
      else { otherBytes += size; }
    }

    // Font analysis
    const fontLinks = document.querySelectorAll('link[rel="preload"][as="font"], link[href*="fonts.googleapis"]');
    const fontPreloaded = fontLinks.length > 0;
    const fontDisplay = document.querySelectorAll('style').length > 0; // simplified

    // Check for font-display usage
    let hasFontDisplay = false;
    const styleSheets = document.styleSheets;
    try {
      for (let i = 0; i < styleSheets.length; i++) {
        try {
          const rules = styleSheets[i]!.cssRules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j]!.cssText?.includes('font-display')) {
              hasFontDisplay = true;
              break;
            }
          }
        } catch { /* cross-origin */ }
        if (hasFontDisplay) break;
      }
    } catch { /* */ }

    return {
      totalBytes, imageBytes, scriptBytes, styleBytes, fontBytes, otherBytes,
      modernImageCount, legacyImageCount,
      fontPreloaded, hasFontDisplay,
      resourceCount: resources.length,
    };
  });

  data.metrics = metrics;

  // Carbon estimate
  const totalGB = metrics.totalBytes / (1024 * 1024 * 1024);
  const co2Grams = totalGB * CO2_PER_GB;
  data.co2Grams = co2Grams;
  data.co2PerThousandViews = co2Grams * 1000;

  // Green hosting check (simplified — check headers for known green hosts)
  let greenHosting = false;
  const m02Data = (ctx.previousResults.get('M02' as ModuleId)?.data ?? {}) as Record<string, unknown>;
  const cdn = m02Data['cdn'] as string | undefined;
  if (cdn && /cloudflare|vercel|netlify|google cloud|cloudfront/i.test(cdn)) {
    greenHosting = true; // Major CDNs have sustainability commitments
  }
  data.greenHosting = greenHosting;

  // Signals
  signals.push(createSignal({ type: 'carbon', name: 'Page Carbon', confidence: 0.7, evidence: `~${(co2Grams * 1000).toFixed(2)}mg CO2 per page view`, category: 'sustainability' }));

  // CP1: CO2 per page view
  {
    const co2mg = co2Grams * 1000;
    let health: CheckpointHealth;
    let evidence: string;

    if (co2mg < 0.5) {
      health = 'excellent';
      evidence = `~${co2mg.toFixed(2)}mg CO2/view — very clean`;
    } else if (co2mg < 1.0) {
      health = 'good';
      evidence = `~${co2mg.toFixed(2)}mg CO2/view — below average`;
    } else if (co2mg < 2.0) {
      health = 'warning';
      evidence = `~${co2mg.toFixed(2)}mg CO2/view — above average`;
    } else {
      health = 'critical';
      evidence = `~${co2mg.toFixed(2)}mg CO2/view — heavy carbon footprint`;
    }

    checkpoints.push(createCheckpoint({ id: 'm13-co2', name: 'Carbon per Page View', weight: 0.6, health, evidence }));
  }

  // CP2: Page weight efficiency
  {
    const totalKB = metrics.totalBytes / 1024;
    const ratio = metrics.resourceCount > 0 ? totalKB / metrics.resourceCount : 0;

    let health: CheckpointHealth;
    let evidence: string;

    if (totalKB < 1024) {
      health = 'excellent';
      evidence = `${Math.round(totalKB)}KB total — lightweight page`;
    } else if (totalKB < 2048) {
      health = 'good';
      evidence = `${(totalKB / 1024).toFixed(1)}MB — reasonable weight`;
    } else {
      health = 'warning';
      evidence = `${(totalKB / 1024).toFixed(1)}MB — heavy (images: ${Math.round(metrics.imageBytes / 1024)}KB, scripts: ${Math.round(metrics.scriptBytes / 1024)}KB)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm13-weight', name: 'Page Weight Efficiency', weight: 0.7, health, evidence }));
  }

  // CP3: Green hosting
  {
    checkpoints.push(
      greenHosting
        ? createCheckpoint({ id: 'm13-green', name: 'Green Hosting', weight: 0.3, health: 'excellent', evidence: `Hosted on sustainability-committed CDN/provider${cdn ? ` (${cdn})` : ''}` })
        : infoCheckpoint({ id: 'm13-green', name: 'Green Hosting', weight: 0.3, evidence: 'Green hosting status unknown' }),
    );
  }

  // CP4: Image format optimization
  {
    const total = metrics.modernImageCount + metrics.legacyImageCount;
    let health: CheckpointHealth;
    let evidence: string;

    if (total === 0) {
      health = 'good';
      evidence = 'No images to optimize';
    } else if (metrics.legacyImageCount === 0) {
      health = 'excellent';
      evidence = `All ${total} images use modern formats (WebP/AVIF)`;
    } else if (metrics.modernImageCount > metrics.legacyImageCount) {
      health = 'good';
      evidence = `${metrics.modernImageCount}/${total} images use modern formats`;
    } else {
      health = 'warning';
      evidence = `${metrics.legacyImageCount}/${total} images use legacy formats (PNG/JPG)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm13-image-format', name: 'Image Format Optimization', weight: 0.5, health, evidence }));
  }

  // CP5: Font loading strategy
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (metrics.fontPreloaded && metrics.hasFontDisplay) {
      health = 'excellent';
      evidence = 'Fonts preloaded with font-display strategy';
    } else if (metrics.fontPreloaded || metrics.hasFontDisplay) {
      health = 'good';
      evidence = metrics.fontPreloaded ? 'Fonts preloaded' : 'font-display CSS property used';
    } else {
      health = 'warning';
      evidence = 'No font preloading or font-display strategy detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm13-fonts', name: 'Font Loading Strategy', weight: 0.4, health, evidence }));
  }

  return { moduleId: 'M13' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M13' as ModuleId, execute);
