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
import { ThirdPartyProfiler } from '../../utils/third-party-profiler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceMetrics {
  // Navigation Timing
  ttfb: number; // Time to First Byte (ms)
  fcp: number | null; // First Contentful Paint (ms)
  domContentLoaded: number;
  loadComplete: number;
  // Core Web Vitals
  lcp: number | null;
  cls: number | null;
  // Connection timing
  dnsTime: number;
  tcpTime: number;
  sslTime: number;
  redirectTime: number;
  redirectCount: number;
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
  modernImageFormats: number; // webp, avif
  totalImageFormats: number;
  // Fonts
  fontCount: number;
  fontBytes: number;
  fontDisplaySwap: number;
  fontDisplayOther: number;
  // Third party
  thirdPartyScripts: number;
  thirdPartyBytes: number;
  thirdPartyDomains: number;
  // Resource hints
  preloadCount: number;
  prefetchCount: number;
  preconnectCount: number;
  dnsPrefetchCount: number;
  modulepreloadCount: number;
  // Long tasks
  longTaskCount: number;
  longestTask: number;
  // Service Worker
  hasServiceWorker: boolean;
  // Protocol
  protocol: string; // h2, h3, http/1.1
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
    const ttfb = nav?.responseStart ? nav.responseStart - nav.requestStart : 0;
    const domContentLoaded = nav?.domContentLoadedEventEnd ?? 0;
    const loadComplete = nav?.loadEventEnd ?? 0;

    // FCP via paint entries
    let fcp: number | null = null;
    const paintEntries = perf.getEntriesByType('paint');
    for (const entry of paintEntries) {
      if (entry.name === 'first-contentful-paint') {
        fcp = entry.startTime;
      }
    }

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

    // Connection timing
    const dnsTime = nav ? (nav.domainLookupEnd - nav.domainLookupStart) : 0;
    const tcpTime = nav ? (nav.connectEnd - nav.connectStart) : 0;
    const sslTime = nav && nav.secureConnectionStart > 0
      ? (nav.connectEnd - nav.secureConnectionStart) : 0;
    const redirectTime = nav ? (nav.redirectEnd - nav.redirectStart) : 0;
    const redirectCount = nav?.redirectCount ?? 0;
    const protocol = nav?.nextHopProtocol ?? 'unknown';

    // Resource breakdown
    const byType: Record<string, { count: number; bytes: number }> = {};
    let totalBytes = 0;

    for (const res of resources) {
      const type = res.initiatorType || 'other';
      if (!byType[type]) byType[type] = { count: 0, bytes: 0 };
      byType[type]!.count++;
      const size = res.transferSize || res.encodedBodySize || 0;
      byType[type]!.bytes += size;
      totalBytes += size;
    }

    // Render-blocking detection
    const scripts = document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])');
    const renderBlockingScripts = scripts.length;
    const styles = document.querySelectorAll('link[rel="stylesheet"]');
    const renderBlockingStyles = styles.length;

    // Image analysis
    const images = document.querySelectorAll('img');
    let imagesWithoutDimensions = 0;
    let imagesWithoutLazy = 0;
    let largeImages = 0;
    let modernImageFormats = 0;
    let totalImageFormats = 0;

    images.forEach((img) => {
      if (!img.width && !img.height && !img.getAttribute('width') && !img.getAttribute('height')) {
        imagesWithoutDimensions++;
      }
      if (img.loading !== 'lazy' && !img.closest('[data-src]')) {
        imagesWithoutLazy++;
      }
      const src = (img.currentSrc || img.src || '').toLowerCase();
      if (src) {
        totalImageFormats++;
        if (/\.webp|\.avif|image\/webp|image\/avif/i.test(src)) {
          modernImageFormats++;
        }
      }
    });

    // Large images from resource timing
    for (const res of resources) {
      if (res.initiatorType === 'img' && (res.transferSize || 0) > 200_000) {
        largeImages++;
      }
    }

    // Font analysis
    let fontCount = 0;
    let fontBytes = 0;
    let fontDisplaySwap = 0;
    let fontDisplayOther = 0;

    for (const res of resources) {
      if (res.initiatorType === 'css' || res.name.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i)) {
        if (res.name.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i)) {
          fontCount++;
          fontBytes += res.transferSize || res.encodedBodySize || 0;
        }
      }
    }

    // Check font-display in stylesheets
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSFontFaceRule) {
              const display = rule.style.getPropertyValue('font-display');
              if (display === 'swap' || display === 'optional') {
                fontDisplaySwap++;
              } else {
                fontDisplayOther++;
              }
            }
          }
        } catch { /* cross-origin stylesheet */ }
      }
    } catch { /* no stylesheets */ }

    // Third-party script analysis
    let thirdPartyScripts = 0;
    let thirdPartyBytes = 0;
    const tpDomainSet = new Set<string>();
    const currentHost = window.location.hostname;
    const apexHost = currentHost.replace(/^www\./, '');
    for (const res of resources) {
      if (res.initiatorType === 'script') {
        try {
          const resHost = new URL(res.name).hostname;
          if (resHost !== currentHost && resHost !== apexHost && !resHost.endsWith('.' + apexHost)) {
            thirdPartyScripts++;
            thirdPartyBytes += res.transferSize || res.encodedBodySize || 0;
            tpDomainSet.add(resHost);
          }
        } catch { /* Invalid URL */ }
      }
    }
    const thirdPartyDomains = tpDomainSet.size;

    // Resource hints (all 5 types)
    const preloadCount = document.querySelectorAll('link[rel="preload"]').length;
    const prefetchCount = document.querySelectorAll('link[rel="prefetch"]').length;
    const preconnectCount = document.querySelectorAll('link[rel="preconnect"]').length;
    const dnsPrefetchCount = document.querySelectorAll('link[rel="dns-prefetch"]').length;
    const modulepreloadCount = document.querySelectorAll('link[rel="modulepreload"]').length;

    // Long tasks
    let longTaskCount = 0;
    let longestTask = 0;
    const longTasks = perf.getEntriesByType('longtask');
    for (const task of longTasks) {
      longTaskCount++;
      if (task.duration > longestTask) longestTask = task.duration;
    }

    // Service Worker
    const hasServiceWorker = 'serviceWorker' in navigator &&
      !!navigator.serviceWorker.controller;

    return {
      ttfb,
      fcp,
      domContentLoaded,
      loadComplete,
      lcp,
      cls,
      dnsTime,
      tcpTime,
      sslTime,
      redirectTime,
      redirectCount,
      totalResources: resources.length,
      totalBytes,
      byType,
      renderBlockingScripts,
      renderBlockingStyles,
      totalImages: images.length,
      imagesWithoutDimensions,
      imagesWithoutLazy,
      largeImages,
      modernImageFormats,
      totalImageFormats,
      fontCount,
      fontBytes,
      fontDisplaySwap,
      fontDisplayOther,
      thirdPartyScripts,
      thirdPartyBytes,
      thirdPartyDomains,
      preloadCount,
      prefetchCount,
      preconnectCount,
      dnsPrefetchCount,
      modulepreloadCount,
      longTaskCount,
      longestTask,
      hasServiceWorker,
      protocol,
    };
  });

  data.metrics = metrics;
  data.hasServiceWorker = metrics.hasServiceWorker;

  // ─── Step 1b: Deep Service Worker inspection ─────────────────────────────
  interface SWRegistration { scope: string; scriptURL: string; state: string }
  interface CacheInfo { name: string; entryCount: number; sampleUrls: string[] }
  interface SWDetails { registrations: SWRegistration[]; caches: CacheInfo[]; hasWorkbox: boolean; totalCachedEntries: number }

  let swDetails: SWDetails | null = null;
  if (metrics.hasServiceWorker) {
    try {
      swDetails = await Promise.race([
        page.evaluate(async (): Promise<SWDetails> => {
          const result: SWDetails = { registrations: [], caches: [], hasWorkbox: false, totalCachedEntries: 0 };

          // Service Worker registrations
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs.slice(0, 5)) {
              const sw = reg.active || reg.waiting || reg.installing;
              result.registrations.push({
                scope: reg.scope,
                scriptURL: sw?.scriptURL ?? 'unknown',
                state: sw?.state ?? 'unknown',
              });
            }
          } catch { /* SW access denied */ }

          // Cache Storage inspection
          try {
            const cacheNames = await caches.keys();
            result.hasWorkbox = cacheNames.some(n => /workbox/i.test(n));
            let totalEntries = 0;

            for (const name of cacheNames.slice(0, 10)) {
              const cache = await caches.open(name);
              const keys = await cache.keys();
              const entryCount = keys.length;
              totalEntries += entryCount;
              result.caches.push({
                name,
                entryCount,
                sampleUrls: keys.slice(0, 5).map(k => {
                  try { return new URL(k.url).pathname; } catch { return k.url; }
                }),
              });
            }
            result.totalCachedEntries = totalEntries;
          } catch { /* Cache API not available */ }

          return result;
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
    } catch {
      // SW inspection failed — non-critical
    }
  }

  if (swDetails) {
    data.serviceWorkerDetails = swDetails;
  }

  // ─── Step 1c: Performance deep dive (custom marks, JS heap, slowest) ─────
  const perfDeep = await page.evaluate(() => {
    const result: {
      customMarks: Array<{ name: string; startTime: number }>;
      customMeasures: Array<{ name: string; duration: number; startTime: number }>;
      jsHeap: { usedMB: number; totalMB: number; limitMB: number; utilization: number } | null;
      slowestResources: Array<{ name: string; duration: number; transferSize: number; initiatorType: string }>;
    } = { customMarks: [], customMeasures: [], jsHeap: null, slowestResources: [] };

    // Custom marks
    try {
      const marks = performance.getEntriesByType('mark');
      result.customMarks = marks.slice(0, 50).map(m => ({
        name: m.name.slice(0, 100),
        startTime: Math.round(m.startTime),
      }));
    } catch { /* */ }

    // Custom measures
    try {
      const measures = performance.getEntriesByType('measure');
      result.customMeasures = measures.slice(0, 50).map(m => ({
        name: m.name.slice(0, 100),
        duration: Math.round(m.duration),
        startTime: Math.round(m.startTime),
      }));
    } catch { /* */ }

    // JS heap (Chrome only)
    try {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (mem) {
        const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024) * 10) / 10;
        const totalMB = Math.round(mem.totalJSHeapSize / (1024 * 1024) * 10) / 10;
        const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024) * 10) / 10;
        result.jsHeap = {
          usedMB, totalMB, limitMB,
          utilization: limitMB > 0 ? Math.round((usedMB / limitMB) * 100) : 0,
        };
      }
    } catch { /* */ }

    // Slowest resources (top 20 by duration)
    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const sorted = resources
        .filter(r => r.duration > 0)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20);

      result.slowestResources = sorted.map(r => ({
        name: (() => { try { return new URL(r.name).pathname.slice(0, 80); } catch { return r.name.slice(0, 80); } })(),
        duration: Math.round(r.duration),
        transferSize: r.transferSize || 0,
        initiatorType: r.initiatorType || 'other',
      }));
    } catch { /* */ }

    return result;
  });

  data.customMarks = perfDeep.customMarks.length > 0 ? perfDeep.customMarks : null;
  data.customMeasures = perfDeep.customMeasures.length > 0 ? perfDeep.customMeasures : null;
  data.jsHeap = perfDeep.jsHeap;
  data.slowestResources = perfDeep.slowestResources.length > 0 ? perfDeep.slowestResources : null;

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
  if (metrics.fcp !== null) {
    signals.push(createSignal({ type: 'performance', name: 'FCP', confidence: 0.9, evidence: `${Math.round(metrics.fcp)}ms`, category: 'performance' }));
  }
  signals.push(createSignal({ type: 'performance', name: 'Page Weight', confidence: 0.95, evidence: `${Math.round(metrics.totalBytes / 1024)}KB`, category: 'performance' }));
  signals.push(createSignal({ type: 'performance', name: 'TTFB', confidence: 0.9, evidence: `${Math.round(metrics.ttfb)}ms`, category: 'performance' }));
  if (metrics.protocol !== 'unknown') {
    signals.push(createSignal({ type: 'infrastructure', name: 'HTTP Protocol', confidence: 0.95, evidence: metrics.protocol, category: 'performance' }));
  }
  if (metrics.hasServiceWorker) {
    signals.push(createSignal({ type: 'infrastructure', name: 'Service Worker', confidence: 0.95, evidence: 'Service worker registered', category: 'performance' }));
  }

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
  // Factor in domain concentration: many scripts from 1-2 CDN domains (likely first-party CDN)
  // is very different from scripts scattered across many third-party services.
  {
    let health: CheckpointHealth;
    let evidence: string;
    const tpScripts = metrics.thirdPartyScripts;
    const tpKB = Math.round(metrics.thirdPartyBytes / 1024);
    const tpDomains = metrics.thirdPartyDomains ?? 0;

    // Use domain count as the primary signal when available
    const effectiveCount = tpDomains > 0 ? tpDomains : tpScripts;

    if (effectiveCount <= 3) {
      health = 'excellent';
      evidence = `${tpScripts} third-party scripts (~${tpKB}KB) from ${tpDomains} domain(s)`;
    } else if (effectiveCount <= 8) {
      health = 'good';
      evidence = `${tpScripts} third-party scripts (~${tpKB}KB) from ${tpDomains} domain(s)`;
    } else if (effectiveCount <= 15) {
      health = 'warning';
      evidence = `${tpScripts} third-party scripts (~${tpKB}KB) from ${tpDomains} domain(s)`;
    } else {
      health = 'critical';
      evidence = `${tpScripts} third-party scripts (~${tpKB}KB) from ${tpDomains} domain(s) — significant performance impact`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-3p-scripts', name: 'Third-Party Script Impact', weight: 0.5, health, evidence }));
  }

  // CP11: TTFB
  {
    const ttfb = metrics.ttfb;
    let health: CheckpointHealth;
    let evidence: string;

    if (ttfb <= 200) {
      health = 'excellent';
      evidence = `TTFB: ${Math.round(ttfb)}ms (fast server response)`;
    } else if (ttfb <= 600) {
      health = 'good';
      evidence = `TTFB: ${Math.round(ttfb)}ms`;
    } else if (ttfb <= 1500) {
      health = 'warning';
      evidence = `TTFB: ${Math.round(ttfb)}ms (slow server response)`;
    } else {
      health = 'critical';
      evidence = `TTFB: ${Math.round(ttfb)}ms (very slow server response)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-ttfb', name: 'Time to First Byte', weight: 0.7, health, evidence }));
  }

  // CP12: FCP
  if (metrics.fcp !== null) {
    const fcp = metrics.fcp;
    let health: CheckpointHealth;
    let evidence: string;

    if (fcp <= 1800) {
      health = 'excellent';
      evidence = `FCP: ${Math.round(fcp)}ms (fast first paint)`;
    } else if (fcp <= 3000) {
      health = 'good';
      evidence = `FCP: ${Math.round(fcp)}ms`;
    } else if (fcp <= 5000) {
      health = 'warning';
      evidence = `FCP: ${Math.round(fcp)}ms (slow first paint)`;
    } else {
      health = 'critical';
      evidence = `FCP: ${Math.round(fcp)}ms (very slow first paint)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-fcp', name: 'First Contentful Paint', weight: 0.6, health, evidence }));
  }

  // CP13: Font loading
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (metrics.fontCount === 0) {
      health = 'excellent';
      evidence = 'No custom fonts — system fonts only';
    } else if (metrics.fontCount <= 4 && metrics.fontDisplaySwap >= metrics.fontDisplayOther) {
      health = 'excellent';
      evidence = `${metrics.fontCount} font file(s) (${Math.round(metrics.fontBytes / 1024)}KB), font-display: swap`;
    } else if (metrics.fontCount <= 6) {
      health = 'good';
      evidence = `${metrics.fontCount} font file(s) (${Math.round(metrics.fontBytes / 1024)}KB)`;
    } else {
      health = 'warning';
      evidence = `${metrics.fontCount} font file(s) (${Math.round(metrics.fontBytes / 1024)}KB) — consider reducing font variants`;
    }

    checkpoints.push(createCheckpoint({ id: 'm03-fonts', name: 'Font Loading', weight: 0.3, health, evidence }));
  }

  // CP14: Resource hints (preload, prefetch, preconnect, dns-prefetch, modulepreload)
  {
    const totalHints = metrics.preloadCount + metrics.prefetchCount + metrics.preconnectCount + metrics.dnsPrefetchCount + metrics.modulepreloadCount;
    let health: CheckpointHealth;
    let evidence: string;

    const hintParts: string[] = [];
    if (metrics.preloadCount > 0) hintParts.push(`${metrics.preloadCount} preload`);
    if (metrics.prefetchCount > 0) hintParts.push(`${metrics.prefetchCount} prefetch`);
    if (metrics.preconnectCount > 0) hintParts.push(`${metrics.preconnectCount} preconnect`);
    if (metrics.dnsPrefetchCount > 0) hintParts.push(`${metrics.dnsPrefetchCount} dns-prefetch`);
    if (metrics.modulepreloadCount > 0) hintParts.push(`${metrics.modulepreloadCount} modulepreload`);

    if (totalHints >= 3) {
      health = 'excellent';
      evidence = `Resource hints: ${hintParts.join(', ')}`;
    } else if (totalHints >= 1) {
      health = 'good';
      evidence = `${totalHints} resource hint(s): ${hintParts.join(', ')}`;
    } else {
      health = 'warning';
      evidence = 'No preload, prefetch, preconnect, dns-prefetch, or modulepreload hints — consider adding them for critical resources';
    }

    checkpoints.push(createCheckpoint({ id: 'm03-resource-hints', name: 'Resource Hints', weight: 0.3, health, evidence }));

    data.resourceHints = {
      preload: metrics.preloadCount,
      prefetch: metrics.prefetchCount,
      preconnect: metrics.preconnectCount,
      dnsPrefetch: metrics.dnsPrefetchCount,
      modulepreload: metrics.modulepreloadCount,
      total: totalHints,
    };
  }

  // CP-DOM: DOM Complexity (from domForensics snapshot)
  if (ctx.domForensics) {
    const df = ctx.domForensics;
    let domHealth: CheckpointHealth;
    let domEvidence: string;
    let domRecommendation: string | undefined;

    if (df.totalNodes > 5000) {
      domHealth = 'critical';
      domEvidence = `DOM: ${df.totalNodes} nodes, max depth ${df.maxDepth} — excessive complexity`;
      domRecommendation = 'Over 5000 DOM nodes degrades rendering performance. Virtualize long lists, use pagination, or lazy-render off-screen sections.';
    } else if (df.totalNodes > 3000) {
      domHealth = 'warning';
      domEvidence = `DOM: ${df.totalNodes} nodes, max depth ${df.maxDepth} — large DOM`;
      domRecommendation = 'Consider reducing DOM size by virtualizing lists or lazy-loading content sections.';
    } else if (df.maxDepth > 15) {
      domHealth = 'warning';
      domEvidence = `DOM: ${df.totalNodes} nodes, max depth ${df.maxDepth} — deep nesting`;
      domRecommendation = 'Deep DOM nesting (>15 levels) can slow style calculations. Flatten component hierarchy where possible.';
    } else {
      domHealth = 'excellent';
      domEvidence = `DOM: ${df.totalNodes} nodes, max depth ${df.maxDepth} — well-structured`;
    }

    checkpoints.push(createCheckpoint({
      id: 'm03-dom-complexity',
      name: 'DOM Complexity',
      weight: 0.4,
      health: domHealth,
      evidence: domEvidence,
      recommendation: domRecommendation,
    }));

    data.domComplexity = {
      totalNodes: df.totalNodes,
      maxDepth: df.maxDepth,
      hasShadowDOM: df.hasShadowDOM,
      customElements: df.customElements.length,
      dynamicContentAreas: df.dynamicContentAreas,
    };
  }

  // CP15: Service Worker & Caching Strategy (scored)
  if (metrics.hasServiceWorker) {
    let swHealth: CheckpointHealth;
    let swEvidence: string;

    if (swDetails && swDetails.totalCachedEntries > 0) {
      const strategy = swDetails.hasWorkbox ? 'Workbox' : 'custom';
      swHealth = swDetails.totalCachedEntries >= 10 ? 'excellent' : 'good';
      swEvidence = `Service Worker active (${strategy} strategy), ${swDetails.caches.length} cache(s) with ${swDetails.totalCachedEntries} entries`;
    } else if (swDetails && swDetails.registrations.length > 0) {
      swHealth = 'good';
      swEvidence = `Service Worker registered (${swDetails.registrations[0]?.state ?? 'active'}) but no Cache Storage entries detected`;
    } else {
      swHealth = 'good';
      swEvidence = 'Service Worker active — caching details could not be inspected';
    }

    checkpoints.push(createCheckpoint({
      id: 'm03-service-worker',
      name: 'Service Worker & Caching Strategy',
      weight: 0.4,
      health: swHealth,
      evidence: swEvidence,
    }));
  }

  // CP16: JavaScript Memory Usage (heap pressure)
  if (perfDeep.jsHeap) {
    const heap = perfDeep.jsHeap;
    let heapHealth: CheckpointHealth;
    let heapEvidence: string;
    let heapRecommendation: string | undefined;

    if (heap.utilization > 80) {
      heapHealth = 'critical';
      heapEvidence = `JS heap: ${heap.usedMB}MB / ${heap.limitMB}MB (${heap.utilization}% utilized) — memory pressure risk`;
      heapRecommendation = 'JavaScript heap usage is dangerously high. Profile memory usage and fix leaks to prevent crashes.';
    } else if (heap.utilization > 50) {
      heapHealth = 'warning';
      heapEvidence = `JS heap: ${heap.usedMB}MB / ${heap.limitMB}MB (${heap.utilization}% utilized)`;
      heapRecommendation = 'Moderate memory usage. Monitor for leaks, especially on long-lived SPAs.';
    } else if (heap.usedMB > 100) {
      heapHealth = 'good';
      heapEvidence = `JS heap: ${heap.usedMB}MB used (${heap.utilization}% of ${heap.limitMB}MB limit)`;
    } else {
      heapHealth = 'excellent';
      heapEvidence = `JS heap: ${heap.usedMB}MB used (${heap.utilization}% of ${heap.limitMB}MB limit) — lean`;
    }

    checkpoints.push(createCheckpoint({
      id: 'm03-js-heap',
      name: 'JavaScript Memory Usage',
      weight: 0.3,
      health: heapHealth,
      evidence: heapEvidence,
      recommendation: heapRecommendation,
    }));
  }

  // ─── Step 5: Navigator Device Context ─────────────────────────────────
  if (ctx.navigatorSnapshot) {
    data.deviceContext = {
      deviceMemory: ctx.navigatorSnapshot.deviceMemory,
      hardwareConcurrency: ctx.navigatorSnapshot.hardwareConcurrency,
      connectionType: ctx.navigatorSnapshot.connection?.effectiveType ?? null,
      pixelRatio: ctx.navigatorSnapshot.pixelRatio,
    };
  }

  // ─── Step 6: Image Optimization (from ctx.imageAudit) ────────────────
  if (ctx.imageAudit) {
    data.imageOptimization = {
      totalImages: ctx.imageAudit.totalImages,
      oversizedCount: ctx.imageAudit.oversizedCount,
      modernFormatCount: ctx.imageAudit.modernFormatCount,
      legacyFormatCount: ctx.imageAudit.legacyFormatCount,
      lazyLoadedCount: ctx.imageAudit.lazyLoadedCount,
      srcsetCount: ctx.imageAudit.srcsetCount,
      imageCDN: ctx.imageAudit.imageCDN,
    };
    data.fontStrategy = {
      totalFonts: ctx.imageAudit.fonts.length,
      fontDisplayValues: ctx.imageAudit.fontDisplayValues,
      preloadedFonts: ctx.imageAudit.preloadedFonts,
    };

    // CP-Image-Opt: Image Optimization (from imageAudit)
    {
      const oversized = ctx.imageAudit.oversizedCount;
      const modern = ctx.imageAudit.modernFormatCount;
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (oversized > 5) {
        health = 'critical';
        evidence = `${oversized} oversized images detected (serving images >2x their display size)`;
        recommendation = 'Resize images to match their display dimensions and use srcset for responsive delivery.';
      } else if (oversized > 0) {
        health = 'warning';
        evidence = `${oversized} oversized image(s) — ${modern} using modern formats (WebP/AVIF)`;
        recommendation = 'Resize oversized images and consider converting remaining legacy formats to WebP or AVIF.';
      } else if (oversized === 0 && modern > 0) {
        health = 'excellent';
        evidence = `No oversized images, ${modern} using modern formats (WebP/AVIF), ${ctx.imageAudit.lazyLoadedCount} lazy-loaded`;
      } else {
        health = 'good';
        evidence = `${ctx.imageAudit.totalImages} images properly sized${ctx.imageAudit.imageCDN ? ` via ${ctx.imageAudit.imageCDN}` : ''}`;
      }

      checkpoints.push(createCheckpoint({ id: 'm03-image-opt', name: 'Image Optimization', weight: 0.4, health, evidence, recommendation }));
    }

    // CP-Font-Loading: Font Loading Strategy (from imageAudit)
    {
      const totalFonts = ctx.imageAudit.fonts.length;
      const fontDisplayVals = ctx.imageAudit.fontDisplayValues;
      const swapCount = (fontDisplayVals['swap'] ?? 0) + (fontDisplayVals['optional'] ?? 0);

      if (totalFonts === 0) {
        checkpoints.push(infoCheckpoint({ id: 'm03-font-loading', name: 'Font Loading Strategy', evidence: 'No web fonts detected — using system fonts' }));
      } else if (swapCount >= totalFonts) {
        checkpoints.push(createCheckpoint({
          id: 'm03-font-loading',
          name: 'Font Loading Strategy',
          weight: 0.3,
          health: 'excellent',
          evidence: `All ${totalFonts} font(s) use font-display: swap/optional — no render-blocking flash`,
        }));
      } else if (swapCount > 0) {
        checkpoints.push(createCheckpoint({
          id: 'm03-font-loading',
          name: 'Font Loading Strategy',
          weight: 0.3,
          health: 'good',
          evidence: `${swapCount}/${totalFonts} font(s) use font-display: swap/optional, ${ctx.imageAudit.preloadedFonts} preloaded`,
        }));
      } else {
        checkpoints.push(createCheckpoint({
          id: 'm03-font-loading',
          name: 'Font Loading Strategy',
          weight: 0.3,
          health: 'warning',
          evidence: `${totalFonts} web font(s) detected but none use font-display: swap — may cause FOIT`,
          recommendation: 'Add font-display: swap or optional to @font-face rules to prevent invisible text during font loading.',
        }));
      }
    }
  }

  // ─── Step 7: Cache-Control Per-Resource Parsing ──────────────────────
  {
    const nc = ctx.networkCollector;
    const allReqs = nc?.getAllRequests() ?? [];
    const allResps = nc?.getAllResponses() ?? [];

    // Build response lookup by URL
    const respByUrl = new Map<string, { headers: Record<string, string> }>();
    for (const resp of allResps) {
      respByUrl.set(resp.requestUrl, resp);
    }

    // Map resourceType to a simplified type
    const simplifyResourceType = (rt: string): string => {
      if (rt === 'script') return 'script';
      if (rt === 'stylesheet') return 'stylesheet';
      if (rt === 'image') return 'image';
      if (rt === 'font') return 'font';
      if (rt === 'document') return 'document';
      return 'other';
    };

    const perResourceType: Record<string, { total: number; cached: number; maxAges: number[] }> = {};
    let hasImmutableAssets = false;
    let noCacheResources = 0;

    for (const req of allReqs) {
      const rType = simplifyResourceType(req.resourceType);
      if (!perResourceType[rType]) {
        perResourceType[rType] = { total: 0, cached: 0, maxAges: [] };
      }
      perResourceType[rType]!.total++;

      const resp = respByUrl.get(req.url);
      if (resp) {
        const cc = resp.headers['cache-control'] ?? '';
        if (cc) {
          const maxAgeMatch = cc.match(/max-age=(\d+)/);
          if (maxAgeMatch) {
            const maxAge = parseInt(maxAgeMatch[1]!, 10);
            perResourceType[rType]!.cached++;
            perResourceType[rType]!.maxAges.push(maxAge);
          }
          if (/immutable/.test(cc)) hasImmutableAssets = true;
          if (/no-cache|no-store/.test(cc) && rType !== 'document') {
            noCacheResources++;
          }
        }
      }
    }

    // Compute avgMaxAge per type
    const perResourceTypeSummary: Record<string, { total: number; cached: number; avgMaxAge: number }> = {};
    for (const [rType, info] of Object.entries(perResourceType)) {
      const avgMaxAge = info.maxAges.length > 0
        ? Math.round(info.maxAges.reduce((a, b) => a + b, 0) / info.maxAges.length)
        : 0;
      perResourceTypeSummary[rType] = { total: info.total, cached: info.cached, avgMaxAge };
    }

    data.cacheStrategy = {
      perResourceType: perResourceTypeSummary,
      hasImmutableAssets,
      noCacheResources,
    };
  }

  // ─── Step 8: Inline vs External Script Audit ─────────────────────────
  try {
    const scriptAudit = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let inlineCount = 0, inlineBytes = 0, externalCount = 0;
      let moduleScripts = 0, classicScripts = 0;

      for (const s of scripts) {
        if ((s as HTMLScriptElement).src) {
          externalCount++;
          if ((s as HTMLScriptElement).type === 'module') moduleScripts++;
          else classicScripts++;
        } else if (s.textContent && (s as HTMLScriptElement).type !== 'application/ld+json' && (s as HTMLScriptElement).type !== 'application/json') {
          inlineCount++;
          inlineBytes += s.textContent.length;
          if ((s as HTMLScriptElement).type === 'module') moduleScripts++;
          else classicScripts++;
        }
      }

      return { inlineCount, inlineBytes, externalCount, moduleScripts, classicScripts };
    });
    data.scriptAudit = scriptAudit;

    // CP-Script: Script Architecture
    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (scriptAudit.inlineBytes > 50000) {
        health = 'warning';
        evidence = `${Math.round(scriptAudit.inlineBytes / 1024)}KB of inline scripts across ${scriptAudit.inlineCount} blocks — should be externalized for caching`;
        recommendation = 'Large inline scripts should be extracted to external files for better caching and reduced HTML payload.';
      } else if (scriptAudit.inlineCount > 20) {
        health = 'warning';
        evidence = `${scriptAudit.inlineCount} inline script blocks (${Math.round(scriptAudit.inlineBytes / 1024)}KB) — excessive fragmentation`;
        recommendation = 'Consolidate inline scripts into fewer external bundles to improve cacheability and reduce parsing overhead.';
      } else if (scriptAudit.moduleScripts > 0 && scriptAudit.inlineBytes <= 10000) {
        health = 'excellent';
        evidence = `Modern JS modules detected (${scriptAudit.moduleScripts} module, ${scriptAudit.classicScripts} classic), ${scriptAudit.externalCount} external, ${scriptAudit.inlineCount} inline (${Math.round(scriptAudit.inlineBytes / 1024)}KB)`;
      } else if (scriptAudit.moduleScripts > 0) {
        health = 'good';
        evidence = `${scriptAudit.moduleScripts} ES module script(s), ${scriptAudit.externalCount} external, ${scriptAudit.inlineCount} inline (${Math.round(scriptAudit.inlineBytes / 1024)}KB)`;
      } else {
        health = 'good';
        evidence = `${scriptAudit.externalCount} external scripts, ${scriptAudit.inlineCount} inline (${Math.round(scriptAudit.inlineBytes / 1024)}KB)`;
      }

      checkpoints.push(createCheckpoint({ id: 'm03-script-audit', name: 'Script Architecture', weight: 0.3, health, evidence, recommendation }));
    }
  } catch {
    data.scriptAudit = null;
  }

  // ─── Step 9: Server-Timing Headers ───────────────────────────────────
  {
    const serverTimingHeader = ctx.headers['server-timing'];
    if (serverTimingHeader) {
      const stMetrics = serverTimingHeader.split(',').map(m => {
        const parts = m.trim().split(';');
        const name = parts[0]?.trim() ?? '';
        let dur: number | null = null;
        let desc: string | null = null;
        for (const p of parts.slice(1)) {
          const eqIdx = p.indexOf('=');
          if (eqIdx === -1) continue;
          const k = p.slice(0, eqIdx).trim();
          const v = p.slice(eqIdx + 1).trim();
          if (k === 'dur') dur = parseFloat(v || '0');
          if (k === 'desc') desc = v?.replace(/^"|"$/g, '') ?? null;
        }
        return { name, duration: dur, description: desc };
      });
      data.serverTiming = { hasServerTiming: true, metrics: stMetrics };
    } else {
      data.serverTiming = { hasServerTiming: false, metrics: [] };
    }
  }

  // ─── Step 10: Third-Party Performance Profiling ──────────────────────
  if (ctx.page && ctx.networkCollector) {
    try {
      const domain = new URL(ctx.url).hostname.replace(/^www\./, '');
      const tpAnalysis = await ThirdPartyProfiler.profile(ctx.page, ctx.networkCollector, domain);
      data.thirdPartyPerformance = {
        renderBlockingCount: tpAnalysis.renderBlockingCount,
        totalThirdPartyBytes: tpAnalysis.totalThirdPartyBytes,
        uniqueDomains: tpAnalysis.uniqueDomains,
        heaviestVendors: tpAnalysis.profiles.slice(0, 5).map(p => ({ domain: p.domain, bytes: p.totalBytes, tool: p.toolName })),
      };
    } catch { /* third-party profiling is non-critical */ }
  }

  // ─── Step 11: CrUX Real-User Field Data ─────────────────────────────
  if (ctx.cruxData) {
    const crux = ctx.cruxData;
    data.cruxFieldData = crux;

    if (crux.source === 'psi-only') {
      checkpoints.push(infoCheckpoint(
        'm03-crux-field',
        'CrUX Real-User Data',
        `No real-user data available (low traffic or new site). Lighthouse score: ${crux.lighthouseScore ?? 'N/A'}`,
      ));
    } else {
      // Count SLOW and FAST metrics — type predicate narrows CruxMetricData | null → CruxMetricData
      const cruxMetrics = [crux.lcp, crux.cls, crux.inp, crux.fcp, crux.ttfb]
        .filter((m): m is NonNullable<typeof m> => m != null);
      const slowCount = cruxMetrics.filter(m => m.category === 'SLOW').length;
      const fastCount = cruxMetrics.filter(m => m.category === 'FAST').length;

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      const parts: string[] = [];
      if (crux.lcp) parts.push(`LCP p75: ${crux.lcp.p75}ms (${crux.lcp.category})`);
      if (crux.cls) parts.push(`CLS p75: ${crux.cls.p75} (${crux.cls.category})`);
      if (crux.inp) parts.push(`INP p75: ${crux.inp.p75}ms (${crux.inp.category})`);
      if (crux.fcp) parts.push(`FCP p75: ${crux.fcp.p75}ms (${crux.fcp.category})`);
      if (crux.ttfb) parts.push(`TTFB p75: ${crux.ttfb.p75}ms (${crux.ttfb.category})`);
      const evidenceStr = parts.join(', ');

      if (slowCount === 0 && fastCount >= 3) {
        health = 'excellent';
        evidence = `CrUX field data: all metrics healthy. ${evidenceStr}`;
      } else if (slowCount === 0) {
        health = 'good';
        evidence = `CrUX field data: no slow metrics. ${evidenceStr}`;
      } else if (slowCount <= 2) {
        health = 'warning';
        evidence = `CrUX field data: ${slowCount} metric(s) rated SLOW. ${evidenceStr}`;
        recommendation = 'Address SLOW field metrics to improve real-user experience. Focus on the slowest metrics first.';
      } else {
        health = 'critical';
        evidence = `CrUX field data: ${slowCount} metrics rated SLOW — poor real-user experience. ${evidenceStr}`;
        recommendation = 'Multiple Core Web Vitals are failing in the field. Prioritize performance optimization based on real-user data.';
      }

      checkpoints.push(createCheckpoint({
        id: 'm03-crux-field', name: 'CrUX Real-User Data', weight: 0.8, health, evidence, recommendation,
      }));

      // Signal: performance drift between lab and field
      if (crux.lcp && metrics.lcp != null) {
        const maxLcp = Math.max(crux.lcp.p75, metrics.lcp);
        // Guard against division by zero when both lab and field LCP are 0
        const drift = maxLcp > 0 ? Math.abs(crux.lcp.p75 - metrics.lcp) / maxLcp : 0;
        if (drift > 0.5) {
          signals.push(createSignal({
            type: 'performance', name: 'performance_drift',
            confidence: 0.8,
            evidence: `Lab LCP: ${Math.round(metrics.lcp)}ms vs Field LCP p75: ${crux.lcp.p75}ms (${Math.round(drift * 100)}% difference)`,
            category: 'performance',
          }));
        }
      }
    }
  }

  // ─── Step 12: Mobile LCP ───────────────────────────────────────────────
  if (ctx.mobileMetrics) {
    const mobile = ctx.mobileMetrics;
    data.mobileMetrics = mobile;

    // CP: Mobile LCP
    {
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      const mobileLcp = mobile.lcp ?? mobile.domContentLoaded;
      const isDclFallback = mobile.lcp == null;
      const lcpLabel = isDclFallback ? 'Mobile LCP (estimated from DCL)' : 'Mobile LCP';

      if (mobileLcp <= 2500) {
        health = 'excellent';
        evidence = `${lcpLabel}: ${Math.round(mobileLcp)}ms (good — under 2.5s threshold)`;
      } else if (mobileLcp <= 4000) {
        health = 'warning';
        evidence = `${lcpLabel}: ${Math.round(mobileLcp)}ms (needs improvement)`;
        recommendation = 'Optimize mobile Largest Contentful Paint — consider reducing image sizes and server response time for mobile.';
      } else {
        health = 'critical';
        evidence = `${lcpLabel}: ${Math.round(mobileLcp)}ms (poor — over 4s)`;
        recommendation = 'Critical mobile LCP issue — optimize hero images, reduce render-blocking resources, and improve server response.';
      }

      // Compare to desktop
      const desktopLcp = metrics.lcp ?? metrics.domContentLoaded;
      if (desktopLcp > 0 && mobileLcp > desktopLcp * 1.5) {
        const pctSlower = Math.round(((mobileLcp / desktopLcp) - 1) * 100);
        evidence += ` — ${pctSlower}% slower than desktop (${Math.round(desktopLcp)}ms)`;
      }

      checkpoints.push(createCheckpoint({
        id: 'm03-mobile-lcp', name: 'Mobile LCP', weight: 0.7, health, evidence, recommendation,
      }));
    }

    // CP: Mobile Page Weight
    // Mobile thresholds differ from desktop: no 'critical' tier because mobile is
    // expected to serve lighter content via responsive design. If a site ships the
    // same heavy payload to mobile, the ≥90%-of-desktop check below catches it as
    // a 'warning' instead, since the root cause is missing responsive optimization
    // rather than an inherently oversized page.
    {
      const mobileKB = mobile.totalBytes / 1024;
      const mobileMB = mobileKB / 1024;
      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (mobileKB < 1024) {
        health = 'excellent';
        evidence = `Mobile page weight: ${Math.round(mobileKB)}KB — lightweight`;
      } else if (mobileMB < 3) {
        health = 'good';
        evidence = `Mobile page weight: ${mobileMB.toFixed(1)}MB`;
      } else {
        health = 'warning';
        evidence = `Mobile page weight: ${mobileMB.toFixed(1)}MB — heavy for mobile networks`;
        recommendation = 'Reduce mobile payload by implementing responsive images, code splitting, and lazy loading.';
      }

      // Check if mobile ≥90% of desktop (no responsive optimization)
      if (metrics.totalBytes > 0 && mobile.totalBytes >= metrics.totalBytes * 0.9 && metrics.totalBytes > 500_000) {
        evidence += ` (${Math.round(mobile.totalBytes / metrics.totalBytes * 100)}% of desktop — no responsive optimization detected)`;
        if (health === 'good') health = 'warning';
        recommendation = recommendation ?? 'Mobile payload is nearly identical to desktop. Implement responsive images and conditional loading for mobile.';
      }

      checkpoints.push(createCheckpoint({
        id: 'm03-mobile-weight', name: 'Mobile Page Weight', weight: 0.5, health, evidence, recommendation,
      }));
    }
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

export { execute };
registerModuleExecutor('M03' as ModuleId, execute);
