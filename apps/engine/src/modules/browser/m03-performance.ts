/**
 * M03 - Page Load & Resource Performance
 *
 * Collects Core Web Vitals (LCP, CLS, INP approximation), page load timing,
 * resource breakdown, and performance optimization signals using the
 * Performance API via Playwright.
 *
 * Checkpoints:
 *   1. Largest Contentful Paint (LCP)
 *   2. Cumulative Layout Shift (CLS)
 *   3. Time to Interactive approximation
 *   4. Total page weight
 *   5. Resource count
 *   6. Render-blocking resources
 *   7. Image optimization
 *   8. Caching headers
 *   9. Compression enabled
 *  10. Third-party script impact
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceMetrics {
  // Navigation Timing
  ttfb: number; // Time to First Byte (ms)
  domContentLoaded: number;
  loadComplete: number;
  // Core Web Vitals
  lcp: number | null;
  cls: number | null;
  // Resource counts
  totalResources: number;
  totalBytes: number;
  byType: Record<string, { count: number; bytes: number }>;
  // Render blocking
  renderBlockingScripts: number;
  renderBlockingStyles: number;
  // Images
  totalImages: number;
  imagesWithoutDimensions: number;
  imagesWithoutLazy: number;
  largeImages: number;
  // Third party
  thirdPartyScripts: number;
  thirdPartyBytes: number;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;

  if (!page) {
    return {
      moduleId: 'M03' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M03',
    };
  }

  // Wait a bit for late-loading resources and CLS to stabilize
  await page.waitForTimeout(2000);

  // ─── Step 1: Collect performance metrics ─────────────────────────────────
  const metrics = await page.evaluate((): PerformanceMetrics => {
    const perf = performance;
    const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = perf.getEntriesByType('resource') as PerformanceResourceTiming[];

    // Navigation timing
    const ttfb = nav?.responseStart ?? 0;
    const domContentLoaded = nav?.domContentLoadedEventEnd ?? 0;
    const loadComplete = nav?.loadEventEnd ?? 0;

    // LCP via PerformanceObserver data (if available)
    let lcp: number | null = null;
    const lcpEntries = perf.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1]!.startTime;
    }

    // CLS via layout-shift entries
    let cls: number | null = null;
    const layoutShifts = perf.getEntriesByType('layout-shift');
    if (layoutShifts.length > 0) {
      cls = 0;
      for (const entry of layoutShifts) {
        if (!(entry as unknown as { hadRecentInput: boolean }).hadRecentInput) {
          cls += (entry as unknown as { value: number }).value;
        }
      }
    }

    // Resource breakdown
    const byType: Record<string, { count: number; bytes: number }> = {};
    let totalBytes = 0;

    for (const res of resources) {
      const type = res.initiatorType || 'other';
      if (!byType[type]) byType[type] = { count: 0, bytes: 0 };
      byType[type].count++;
      const size = res.transferSize || res.encodedBodySize || 0;
      byType[type].bytes += size;
      totalBytes += size;
    }

    // Render-blocking detection
    let renderBlockingScripts = 0;
    let renderBlockingStyles = 0;
    const scripts = document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])');
    renderBlockingScripts = scripts.length;
    const styles = document.querySelectorAll('link[rel="stylesheet"]');
    renderBlockingStyles = styles.length; // All CSS in head is potentially render-blocking

    // Image analysis
    const images = document.querySelectorAll('img');
    let imagesWithoutDimensions = 0;
    let imagesWithoutLazy = 0;
    let largeImages = 0;

    images.forEach((img) => {
      if (!img.width && !img.height && !img.getAttribute('width') && !img.getAttribute('height')) {
        imagesWithoutDimensions++;
      }
      if (img.loading !== 'lazy' && !img.closest('[data-src]')) {
        imagesWithoutLazy++;
      }
    });

    // Large images from resource timing
    for (const res of resources) {
      if (res.initiatorType === 'img' && (res.transferSize || 0) > 200_000) {
        largeImages++;
      }
    }

    // Third-party script analysis
    let thirdPartyScripts = 0;
    let thirdPartyBytes = 0;
    const currentHost = window.location.hostname;
    for (const res of resources) {
      if (res.initiatorType === 'script') {
        try {
          const resHost = new URL(res.name).hostname;
          if (resHost !== currentHost && !resHost.endsWith(`.${currentHost}`)) {
            thirdPartyScripts++;
            thirdPartyBytes += res.transferSize || res.encodedBodySize || 0;
          }
        } catch {
          // Invalid URL
        }
      }
    }

    return {
      ttfb,
      domContentLoaded,
      loadComplete,
      lcp,
      cls,
      totalResources: resources.length,
      totalBytes,
      byType,
      renderBlockingScripts,
      renderBlockingStyles,
      totalImages: images.length,
      imagesWithoutDimensions,
      imagesWithoutLazy,
      largeImages,
      thirdPartyScripts,
      thirdPartyBytes,
    };
  });

  data.metrics = metrics;

  // ─── Step 2: Check compression and caching from network ──────────────────
  const responses = ctx.networkCollector?.getAllResponses() ?? [];
  let compressedCount = 0;
  let cachedCount = 0;
  let totalResponses = 0;

  for (const resp of responses) {
    totalResponses++;
    const encoding = resp.headers['content-encoding'];
    if (encoding && /gzip|br|deflate|zstd/.test(encoding)) compressedCount++;
    const cacheControl = resp.headers['cache-control'];
    if (cacheControl && /max-age=[1-9]/.test(cacheControl)) cachedCount++;
  }

  data.compressionRatio = totalResponses > 0 ? compressedCount / totalResponses : 0;
  data.cacheRatio = totalResponses > 0 ? cachedCount / totalResponses : 0;

  // ─── Step 3: Build signals ───────────────────────────────────────────────
  if (metrics.lcp !== null) {
    signals.push(createSignal({ type: 'performance', name: 'LCP', confidence: 0.9, evidence: `${Math.round(metrics.lcp)}ms`, category: 'performance' }));
  }
  if (metrics.cls !== null) {
    signals.push(createSignal({ type: 'performance', name: 'CLS', confidence: 0.9, evidence: metrics.cls.toFixed(3), category: 'performance' }));
  }
  signals.push(createSignal({ type: 'performance', name: 'Page Weight', confidence: 0.95, evidence: `${Math.round(metrics.totalBytes / 1024)}KB`, category: 'performance' }));

  // ─── Step 4: Build checkpoints ───────────────────────────────────────────

  // CP1: LCP
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;
    const lcp = metrics.lcp ?? metrics.domContentLoaded;

    if (lcp <= 2500) {
      health = 'excellent';
      evidence = `LCP: ${Math.round(lcp)}ms (good — under 2.5s threshold)`;
    } else if (lcp <= 4000) {
      health = 'warning';
      evidence = `LCP: ${Math.round(lcp)}ms (needs improvement — over 2.5s)`;
      recommendation = 'Optimize largest contentful paint by preloading hero images and reducing render-blocking resources.';
    } else {
      health = 'critical';
      evidence = `LCP: ${Math.round(lcp)}ms (poor — over 4s)`;
      recommendation = 'Critical LCP issue — optimize images, reduce server response time, and eliminate render-blocking resources.';
    }

    checkpoints.push(createCheckpoint({ id: 'm03-lcp', name: 'Largest Contentful Paint', weight: 1.0, health, evidence, recommendation }));
  }

  // CP2: CLS
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;
    const cls = metrics.cls ?? 0;

    if (cls <= 0.1) {
      health = 'excellent';
      evidence = `CLS: ${cls.toFixed(3)} (good — under 0.1 threshold)`;
    } else if (cls <= 0.25) {
      health = 'warning';
      evidence = `CLS: ${cls.toFixed(3)} (needs improvement — over 0.1)`;
      recommendation = 'Reduce layout shift by setting explicit dimensions on images and embeds.';
    } else {
      health = 'critical';
      evidence = `CLS: ${cls.toFixed(3)} (poor — over 0.25)`;
      recommendation = 'Major layout shift issues — add width/height to all images and avoid dynamically injecting content above the fold.';
    }

    checkpoints.push(createCheckpoint({ id: 'm03-cls', name: 'Cumulative Layout Shift', weight: 0.8, health, evidence, recommendation }));
  }

  // CP3: Time to Interactive (approximation via domContentLoaded)
  {
    const tti = metrics.domContentLoaded;
    let health: CheckpointHealth;
    let evidence: string;

    if (tti <= 3000) {
      health = 'excellent';
      evidence = `DOM Content Loaded: ${Math.round(tti)}ms`;
    } else if (tti <= 5000) {
      health = 'good';
      evidence = `DOM Content Loaded: ${Math.round(tti)}ms`;
    } else if (tti <= 8000) {
      health = 'warning';
      evidence = `DOM Content Loaded: ${Math.round(tti)}ms (slow)`;
    } else {
      health = 'critical';
      evidence = `DOM Content Loaded: ${Math.round(tti)}ms (very slow)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-tti', name: 'Time to Interactive', weight: 0.7, health, evidence }));
  }

  // CP4: Total page weight
  {
    const totalKB = metrics.totalBytes / 1024;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (totalKB < 1024) {
      health = 'excellent';
      evidence = `Page weight: ${Math.round(totalKB)}KB — lightweight`;
    } else if (totalKB < 3072) {
      health = 'good';
      evidence = `Page weight: ${(totalKB / 1024).toFixed(1)}MB`;
    } else if (totalKB < 5120) {
      health = 'warning';
      evidence = `Page weight: ${(totalKB / 1024).toFixed(1)}MB — heavy`;
      recommendation = 'Reduce page weight by compressing images, code-splitting JavaScript, and lazy-loading non-critical resources.';
    } else {
      health = 'critical';
      evidence = `Page weight: ${(totalKB / 1024).toFixed(1)}MB — very heavy`;
      recommendation = 'Critical page weight issue — audit all resources and remove unnecessary assets.';
    }

    checkpoints.push(createCheckpoint({ id: 'm03-weight', name: 'Total Page Weight', weight: 0.6, health, evidence, recommendation }));
  }

  // CP5: Resource count
  {
    const count = metrics.totalResources;
    let health: CheckpointHealth;
    let evidence: string;

    if (count < 50) {
      health = 'excellent';
      evidence = `${count} resources — lean page`;
    } else if (count < 100) {
      health = 'good';
      evidence = `${count} resources`;
    } else if (count < 200) {
      health = 'warning';
      evidence = `${count} resources — high request count`;
    } else {
      health = 'critical';
      evidence = `${count} resources — excessive request count`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-resources', name: 'Resource Count', weight: 0.5, health, evidence }));
  }

  // CP6: Render-blocking resources
  {
    const blocking = metrics.renderBlockingScripts + metrics.renderBlockingStyles;
    let health: CheckpointHealth;
    let evidence: string;

    if (blocking <= 2) {
      health = 'excellent';
      evidence = `${blocking} render-blocking resources`;
    } else if (blocking <= 5) {
      health = 'good';
      evidence = `${blocking} render-blocking resources (${metrics.renderBlockingScripts} scripts, ${metrics.renderBlockingStyles} stylesheets)`;
    } else if (blocking <= 10) {
      health = 'warning';
      evidence = `${blocking} render-blocking resources`;
    } else {
      health = 'critical';
      evidence = `${blocking} render-blocking resources (${metrics.renderBlockingScripts} scripts, ${metrics.renderBlockingStyles} stylesheets)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-blocking', name: 'Render-Blocking Resources', weight: 0.6, health, evidence }));
  }

  // CP7: Image optimization
  {
    const total = metrics.totalImages;
    const issues = metrics.imagesWithoutDimensions + metrics.largeImages;

    let health: CheckpointHealth;
    let evidence: string;

    if (total === 0) {
      health = 'good';
      evidence = 'No images on page';
    } else if (issues === 0) {
      health = 'excellent';
      evidence = `${total} images — all properly sized and dimensioned`;
    } else if (issues <= 3) {
      health = 'good';
      evidence = `${total} images, ${issues} minor issue(s) (${metrics.imagesWithoutDimensions} missing dimensions, ${metrics.largeImages} oversized)`;
    } else {
      health = 'warning';
      evidence = `${total} images with ${issues} issues (${metrics.imagesWithoutDimensions} missing dimensions, ${metrics.largeImages} oversized)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-images', name: 'Image Optimization', weight: 0.5, health, evidence }));
  }

  // CP8: Caching headers
  {
    const ratio = totalResponses > 0 ? cachedCount / totalResponses : 0;
    let health: CheckpointHealth;
    let evidence: string;

    if (ratio >= 0.7) {
      health = 'excellent';
      evidence = `${Math.round(ratio * 100)}% of resources have cache headers`;
    } else if (ratio >= 0.4) {
      health = 'good';
      evidence = `${Math.round(ratio * 100)}% of resources cached`;
    } else if (totalResponses > 0) {
      health = 'warning';
      evidence = `Only ${Math.round(ratio * 100)}% of resources have cache headers`;
    } else {
      health = 'good';
      evidence = 'No response data available for cache analysis';
    }

    checkpoints.push(createCheckpoint({ id: 'm03-caching', name: 'Caching Headers', weight: 0.4, health, evidence }));
  }

  // CP9: Compression enabled
  {
    const ratio = totalResponses > 0 ? compressedCount / totalResponses : 0;
    let health: CheckpointHealth;
    let evidence: string;

    if (ratio >= 0.6) {
      health = 'excellent';
      evidence = `${Math.round(ratio * 100)}% of responses compressed (gzip/br)`;
    } else if (ratio >= 0.3) {
      health = 'good';
      evidence = `${Math.round(ratio * 100)}% of responses compressed`;
    } else if (totalResponses > 0) {
      health = 'warning';
      evidence = `Only ${Math.round(ratio * 100)}% of responses use compression`;
    } else {
      health = 'good';
      evidence = 'No response data for compression check';
    }

    checkpoints.push(createCheckpoint({ id: 'm03-compression', name: 'Compression Enabled', weight: 0.4, health, evidence }));
  }

  // CP10: Third-party script impact
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (metrics.thirdPartyScripts <= 3) {
      health = 'excellent';
      evidence = `${metrics.thirdPartyScripts} third-party scripts (~${Math.round(metrics.thirdPartyBytes / 1024)}KB)`;
    } else if (metrics.thirdPartyScripts <= 8) {
      health = 'good';
      evidence = `${metrics.thirdPartyScripts} third-party scripts (~${Math.round(metrics.thirdPartyBytes / 1024)}KB)`;
    } else if (metrics.thirdPartyScripts <= 15) {
      health = 'warning';
      evidence = `${metrics.thirdPartyScripts} third-party scripts (~${Math.round(metrics.thirdPartyBytes / 1024)}KB)`;
    } else {
      health = 'critical';
      evidence = `${metrics.thirdPartyScripts} third-party scripts (~${Math.round(metrics.thirdPartyBytes / 1024)}KB) — significant performance impact`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-3p-scripts', name: 'Third-Party Script Impact', weight: 0.5, health, evidence }));
  }

  return {
    moduleId: 'M03' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

registerModuleExecutor('M03' as ModuleId, execute);
