/**
 * M13 — Performance & Carbon Footprint
 *
 * Estimates page carbon footprint using the Sustainable Web Design (SWD) model,
 * audits page weight breakdown by resource type, and assesses sustainability
 * indicators (image formats, compression, lazy loading, fonts).
 *
 * Checkpoints (9):
 *   1. Estimated CO2 per page view
 *   2. Page weight efficiency (with breakdown)
 *   3. Green hosting detection (DRY with M02)
 *   4. Image format optimization
 *   5. Font loading strategy
 *   6. Compression adoption
 *   7. Lazy loading adoption
 *   8. Third-party weight impact
 *   9. Request count efficiency
 *
 * DRY with M02 (CDN/hosting info).
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
// Sustainable Web Design Model — CO2 estimate
// Energy intensity: 0.81 kWh/GB (SWD model v3)
// Global avg grid carbon intensity: ~494g CO2/kWh (IEA 2023)
// Combined: ~400g CO2 per GB transferred
// ---------------------------------------------------------------------------
const CO2_GRAMS_PER_GB = 400;

// Known green-committed CDN/hosting providers
const GREEN_PROVIDERS = /cloudflare|vercel|netlify|google cloud|cloudfront|akamai|fastly|azure cdn|aws|digitalocean|sucuri/i;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  const nc = ctx.networkCollector;

  if (!page) {
    return {
      moduleId: 'M13' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M13',
    };
  }

  // ─── Step 1: Browser-side resource analysis ─────────────────────────────
  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const host = location.hostname;
    const apexHost = host.replace(/^www\./, '');

    let totalBytes = 0;
    let imageBytes = 0;
    let scriptBytes = 0;
    let styleBytes = 0;
    let fontBytes = 0;
    let otherBytes = 0;
    let firstPartyBytes = 0;
    let thirdPartyBytes = 0;
    const tpDomainSet = new Set<string>();

    let modernImageCount = 0;
    let legacyImageCount = 0;
    let compressedCount = 0;
    let uncompressedCount = 0;
    let lazyImageCount = 0;
    let eagerImageCount = 0;

    for (const res of resources) {
      const size = res.transferSize || res.encodedBodySize || 0;
      totalBytes += size;
      const url = res.name;

      // First-party vs third-party
      try {
        const resHost = new URL(url).hostname;
        if (resHost === host || resHost === apexHost || resHost.endsWith('.' + apexHost)) {
          firstPartyBytes += size;
        } else {
          thirdPartyBytes += size;
          tpDomainSet.add(resHost);
        }
      } catch {
        otherBytes += size;
        continue;
      }

      // Compression: if transferSize < decodedBodySize, it's compressed
      if (res.decodedBodySize > 0 && size > 0) {
        if (size < res.decodedBodySize * 0.95) {
          compressedCount++;
        } else {
          uncompressedCount++;
        }
      }

      // Categorize by actual resource type using URL extension, not just initiatorType
      // (initiatorType 'link' catches ALL <link> elements — fonts, preloads, css)
      const urlLower = url.toLowerCase();
      if (/\.(woff2?|ttf|otf|eot)(\?|$)/.test(urlLower)) {
        fontBytes += size;
      } else if (/\.(css)(\?|$)/.test(urlLower) || res.initiatorType === 'css') {
        styleBytes += size;
      } else if (res.initiatorType === 'script' || /\.(js|mjs)(\?|$)/.test(urlLower)) {
        scriptBytes += size;
      } else if (
        res.initiatorType === 'img' ||
        res.initiatorType === 'image' ||
        /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)(\?|$)/.test(urlLower)
      ) {
        imageBytes += size;
        // Image format analysis — includes CDN auto-format (Cloudinary f_auto, imgix auto=format)
        if (/\.(webp|avif|svg)(\?|$)/i.test(url)) modernImageCount++;
        else if (/[?&,/]f_auto|auto=format|format=auto/i.test(url)) modernImageCount++;
        else if (/\.(png|jpe?g|gif|bmp)(\?|$)/i.test(url)) legacyImageCount++;
      } else {
        otherBytes += size;
      }
    }

    // Lazy loading analysis from DOM
    document.querySelectorAll('img').forEach((img) => {
      if (img.loading === 'lazy') lazyImageCount++;
      else eagerImageCount++;
    });

    // Font analysis
    const fontPreloadLinks = document.querySelectorAll(
      'link[rel="preload"][as="font"], link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]',
    );
    const fontPreloaded = fontPreloadLinks.length > 0;

    // Check for font-display usage in accessible stylesheets
    let hasFontDisplay = false;
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i]!.cssRules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j]!.cssText?.includes('font-display')) {
              hasFontDisplay = true;
              break;
            }
          }
        } catch {
          /* cross-origin stylesheet */
        }
        if (hasFontDisplay) break;
      }
    } catch {
      /* */
    }

    return {
      totalBytes,
      imageBytes,
      scriptBytes,
      styleBytes,
      fontBytes,
      otherBytes,
      firstPartyBytes,
      thirdPartyBytes,
      thirdPartyDomainCount: tpDomainSet.size,
      modernImageCount,
      legacyImageCount,
      compressedCount,
      uncompressedCount,
      lazyImageCount,
      eagerImageCount,
      fontPreloaded,
      hasFontDisplay,
      resourceCount: resources.length,
      totalImages: document.querySelectorAll('img').length,
    };
  });

  data.metrics = metrics;

  // ─── Service Worker detection ──────────────────────────────────────────
  const hasServiceWorker = await page.evaluate(() =>
    'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
  );
  data.hasServiceWorker = hasServiceWorker;

  // ─── Step 2: CO2 estimate (SWD model) ──────────────────────────────────
  const totalGB = metrics.totalBytes / (1024 * 1024 * 1024);
  const co2Grams = totalGB * CO2_GRAMS_PER_GB;
  data.co2Grams = co2Grams;
  data.co2PerView = `${co2Grams.toFixed(2)}g`;

  // ─── Step 3: Green hosting (DRY with M02) ──────────────────────────────
  let greenHosting = false;
  let greenProvider: string | null = null;

  // Check M02 for CDN info
  try {
    const m02 = ctx.previousResults?.get('M02' as ModuleId);
    if (m02?.data) {
      const m02Data = m02.data as Record<string, unknown>;
      const cdnRaw = m02Data['cdn'];
      // M02 cdn field can be an object {id, name, ...} or a string
      const cdnName = typeof cdnRaw === 'string' ? cdnRaw
        : (cdnRaw && typeof cdnRaw === 'object') ? ((cdnRaw as Record<string, unknown>)['name'] as string ?? (cdnRaw as Record<string, unknown>)['id'] as string ?? '') : '';
      if (cdnName && GREEN_PROVIDERS.test(cdnName)) {
        greenHosting = true;
        greenProvider = cdnName;
      }
    }
  } catch {
    /* standalone test */
  }

  // Fallback: check response headers for CDN signatures
  if (!greenHosting) {
    const serverHeader = (ctx.headers['server'] || '').toLowerCase();
    const viaHeader = (ctx.headers['via'] || '').toLowerCase();
    const cdnHeaders = `${serverHeader} ${viaHeader} ${ctx.headers['x-served-by'] || ''} ${ctx.headers['cf-ray'] || ''}`;

    if (cdnHeaders.includes('cloudflare') || ctx.headers['cf-ray']) {
      greenHosting = true;
      greenProvider = 'Cloudflare';
    } else if (cdnHeaders.includes('vercel')) {
      greenHosting = true;
      greenProvider = 'Vercel';
    } else if (cdnHeaders.includes('netlify')) {
      greenHosting = true;
      greenProvider = 'Netlify';
    } else if (cdnHeaders.includes('cloudfront') || cdnHeaders.includes('amazons3')) {
      greenHosting = true;
      greenProvider = 'CloudFront/AWS';
    } else if (cdnHeaders.includes('fastly')) {
      greenHosting = true;
      greenProvider = 'Fastly';
    } else if (cdnHeaders.includes('akamai')) {
      greenHosting = true;
      greenProvider = 'Akamai';
    } else if (cdnHeaders.includes('sucuri')) {
      greenHosting = true;
      greenProvider = 'Sucuri';
    }
  }
  data.greenHosting = greenHosting;
  data.greenProvider = greenProvider;

  // ─── Step 4: Third-party weight from NetworkCollector ───────────────────
  let thirdPartyRequestCount = 0;
  if (nc) {
    const allReqs = nc.getAllRequests();
    thirdPartyRequestCount = allReqs.filter(
      (r) => r.category !== 'first_party' && r.category !== 'cdn',
    ).length;
  }
  data.thirdPartyRequestCount = thirdPartyRequestCount;

  // ─── Step 5: Build signals ──────────────────────────────────────────────
  signals.push(
    createSignal({
      type: 'carbon',
      name: 'Page Carbon',
      confidence: 0.7,
      evidence: `~${co2Grams.toFixed(2)}g CO2 per page view (${(metrics.totalBytes / 1024).toFixed(0)}KB transferred)`,
      category: 'sustainability',
    }),
  );

  // ─── Step 6: Build checkpoints ──────────────────────────────────────────

  // CP1: CO2 per page view (SWD model)
  // Median webpage is ~2.2MB → ~0.82g CO2. Below 0.5g is excellent.
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (co2Grams < 0.5) {
      health = 'excellent';
      evidence = `~${co2Grams.toFixed(2)}g CO2/view — cleaner than ${Math.round(((2.2 - metrics.totalBytes / (1024 * 1024)) / 2.2) * 100)}% of web pages`;
    } else if (co2Grams < 1.0) {
      health = 'good';
      evidence = `~${co2Grams.toFixed(2)}g CO2/view — below the ${(0.82).toFixed(2)}g average`;
    } else if (co2Grams < 2.0) {
      health = 'warning';
      evidence = `~${co2Grams.toFixed(2)}g CO2/view — above average`;
      recommendation = 'Reduce page weight to lower carbon footprint. Focus on images, unused scripts, and heavy CSS.';
    } else {
      health = 'critical';
      evidence = `~${co2Grams.toFixed(2)}g CO2/view — heavy carbon footprint`;
      recommendation =
        'Page has significant carbon impact. Optimize images (WebP/AVIF), remove unused code, and enable compression.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-co2', name: 'Carbon per Page View', weight: 0.6, health, evidence, recommendation }),
    );
  }

  // CP2: Page weight efficiency (with breakdown)
  {
    const totalKB = metrics.totalBytes / 1024;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const breakdown = `images: ${Math.round(metrics.imageBytes / 1024)}KB, scripts: ${Math.round(metrics.scriptBytes / 1024)}KB, CSS: ${Math.round(metrics.styleBytes / 1024)}KB, fonts: ${Math.round(metrics.fontBytes / 1024)}KB`;

    if (totalKB < 1024) {
      health = 'excellent';
      evidence = `${Math.round(totalKB)}KB total — lightweight (${breakdown})`;
    } else if (totalKB < 2500) {
      health = 'good';
      evidence = `${(totalKB / 1024).toFixed(1)}MB total (${breakdown})`;
    } else if (totalKB < 5000) {
      health = 'warning';
      evidence = `${(totalKB / 1024).toFixed(1)}MB — heavy page (${breakdown})`;
      recommendation = 'Page exceeds 2.5MB. Audit the largest resource categories for optimization opportunities.';
    } else {
      health = 'critical';
      evidence = `${(totalKB / 1024).toFixed(1)}MB — very heavy page (${breakdown})`;
      recommendation = 'Page exceeds 5MB. Immediate optimization needed — focus on the largest resource type.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-weight', name: 'Page Weight Efficiency', weight: 0.7, health, evidence, recommendation }),
    );
  }

  // CP3: Green hosting
  {
    checkpoints.push(
      greenHosting
        ? createCheckpoint({
            id: 'm13-green',
            name: 'Green Hosting',
            weight: 0.3,
            health: 'excellent',
            evidence: `Hosted on sustainability-committed provider: ${greenProvider}`,
          })
        : infoCheckpoint({
            id: 'm13-green',
            name: 'Green Hosting',
            weight: 0.3,
            evidence: 'Green hosting not detected — check thegreenwebfoundation.org for your host',
          }),
    );
  }

  // CP4: Image format optimization (includes SVG as modern)
  {
    const total = metrics.modernImageCount + metrics.legacyImageCount;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (total === 0) {
      health = 'good';
      evidence = 'No raster images detected on page';
    } else if (metrics.legacyImageCount === 0) {
      health = 'excellent';
      evidence = `All ${total} images use modern formats (WebP/AVIF/SVG)`;
    } else if (metrics.modernImageCount >= metrics.legacyImageCount) {
      health = 'good';
      evidence = `${metrics.modernImageCount}/${total} images use modern formats, ${metrics.legacyImageCount} legacy (PNG/JPG)`;
    } else {
      health = 'warning';
      evidence = `${metrics.legacyImageCount}/${total} images use legacy formats (PNG/JPG) — ${Math.round(metrics.imageBytes / 1024)}KB total image weight`;
      recommendation = 'Convert PNG/JPG images to WebP or AVIF for 25-50% size reduction.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-image-format', name: 'Image Format Optimization', weight: 0.5, health, evidence, recommendation }),
    );
  }

  // CP5: Font loading strategy
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    const fontKB = Math.round(metrics.fontBytes / 1024);

    if (metrics.fontPreloaded && metrics.hasFontDisplay) {
      health = 'excellent';
      evidence = `Fonts preloaded with font-display strategy (${fontKB}KB)`;
    } else if (metrics.fontPreloaded || metrics.hasFontDisplay) {
      health = 'good';
      evidence = metrics.fontPreloaded
        ? `Fonts preloaded (${fontKB}KB) but no font-display detected`
        : `font-display CSS used (${fontKB}KB) but no font preloading`;
    } else if (metrics.fontBytes === 0) {
      health = 'good';
      evidence = 'No custom web fonts loaded (system fonts or inline)';
    } else {
      health = 'warning';
      evidence = `${fontKB}KB of fonts loaded without preloading or font-display`;
      recommendation = 'Add rel="preload" for critical fonts and use font-display: swap to prevent FOIT.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-fonts', name: 'Font Loading Strategy', weight: 0.4, health, evidence, recommendation }),
    );
  }

  // CP6: Compression adoption
  {
    const total = metrics.compressedCount + metrics.uncompressedCount;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (total === 0) {
      health = 'good';
      evidence = 'No compressible resources detected';
    } else {
      const pct = Math.round((metrics.compressedCount / total) * 100);
      if (pct >= 90) {
        health = 'excellent';
        evidence = `${pct}% of resources compressed (${metrics.compressedCount}/${total})`;
      } else if (pct >= 70) {
        health = 'good';
        evidence = `${pct}% of resources compressed (${metrics.compressedCount}/${total})`;
      } else {
        health = 'warning';
        evidence = `Only ${pct}% of resources compressed (${metrics.compressedCount}/${total})`;
        recommendation = 'Enable gzip or Brotli compression on your server for text-based resources.';
      }
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-compression', name: 'Resource Compression', weight: 0.5, health, evidence, recommendation }),
    );
  }

  // CP7: Lazy loading adoption
  {
    const totalImgs = metrics.totalImages;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (totalImgs === 0) {
      health = 'good';
      evidence = 'No <img> elements on page';
    } else if (totalImgs <= 3) {
      // Few images — lazy loading not critical
      health = 'good';
      evidence = `${totalImgs} images — lazy loading not critical with few images`;
    } else if (metrics.lazyImageCount > 0) {
      const pct = Math.round((metrics.lazyImageCount / totalImgs) * 100);
      health = pct >= 50 ? 'excellent' : 'good';
      evidence = `${metrics.lazyImageCount}/${totalImgs} images use loading="lazy" (${pct}%)`;
    } else {
      health = 'warning';
      evidence = `${totalImgs} images, none use loading="lazy"`;
      recommendation = 'Add loading="lazy" to below-the-fold images to reduce initial page weight.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-lazy', name: 'Lazy Loading Adoption', weight: 0.4, health, evidence, recommendation }),
    );
  }

  // CP8: Third-party weight impact
  // Use domain count to distinguish CDN-hosted first-party assets (1-2 domains)
  // from actual third-party service sprawl (many domains).
  {
    const tpPct =
      metrics.totalBytes > 0
        ? Math.round((metrics.thirdPartyBytes / metrics.totalBytes) * 100)
        : 0;
    const tpKB = Math.round(metrics.thirdPartyBytes / 1024);
    const tpDomains = (metrics as Record<string, unknown>).thirdPartyDomainCount as number ?? 0;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    // If high byte % but only 1-2 domains, it's likely CDN hosting — downgrade severity
    const isCdnConcentrated = tpDomains > 0 && tpDomains <= 2 && tpPct > 40;

    if (tpPct <= 20 || isCdnConcentrated) {
      health = isCdnConcentrated ? 'good' : 'excellent';
      evidence = isCdnConcentrated
        ? `Third-party resources: ${tpKB}KB (${tpPct}% of total) from ${tpDomains} domain(s) — likely CDN-hosted first-party assets`
        : `Third-party resources: ${tpKB}KB (${tpPct}% of total)`;
    } else if (tpPct <= 40) {
      health = 'good';
      evidence = `Third-party resources: ${tpKB}KB (${tpPct}% of total)`;
    } else if (tpPct <= 60) {
      health = 'warning';
      evidence = `Third-party resources: ${tpKB}KB (${tpPct}% of total page weight) from ${tpDomains} domain(s)`;
      recommendation = 'Over 40% of page weight comes from third parties. Audit and remove unnecessary scripts.';
    } else {
      health = 'critical';
      evidence = `Third-party resources dominate: ${tpKB}KB (${tpPct}% of total page weight) from ${tpDomains} domain(s)`;
      recommendation = 'Third-party scripts account for most of the page weight. Consolidate via server-side tagging or remove unused tags.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-third-party', name: 'Third-Party Weight Impact', weight: 0.5, health, evidence, recommendation }),
    );
  }

  // CP9: Request count efficiency
  {
    const count = metrics.resourceCount;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (count <= 50) {
      health = 'excellent';
      evidence = `${count} HTTP requests — efficient`;
    } else if (count <= 100) {
      health = 'good';
      evidence = `${count} HTTP requests`;
    } else if (count <= 200) {
      health = 'warning';
      evidence = `${count} HTTP requests — high request count`;
      recommendation = 'Reduce HTTP requests by bundling scripts, using CSS sprites, or consolidating third-party tags.';
    } else {
      health = 'critical';
      evidence = `${count} HTTP requests — excessive`;
      recommendation = 'Over 200 requests significantly impacts load time. Aggressive consolidation needed.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm13-requests', name: 'Request Count Efficiency', weight: 0.4, health, evidence, recommendation }),
    );
  }

  // CP10: Service Worker Cache Efficiency — scored based on M03 SW details
  if (hasServiceWorker) {
    let swHealth: CheckpointHealth = 'good';
    let swEvidence = 'Service Worker active — cached responses reduce actual transfer sizes';
    let swRecommendation: string | undefined;

    // Try to read M03 SW details for deeper analysis
    try {
      const m03 = ctx.previousResults?.get('M03' as ModuleId);
      if (m03?.data) {
        const m03Data = m03.data as Record<string, unknown>;
        const swDetails = m03Data['serviceWorkerDetails'] as { totalCachedEntries?: number; hasWorkbox?: boolean; caches?: Array<{ entryCount: number }> } | undefined;
        if (swDetails && swDetails.totalCachedEntries != null) {
          const totalCached = swDetails.totalCachedEntries;
          data.swCacheEfficiency = {
            totalCachedEntries: totalCached,
            hasWorkbox: swDetails.hasWorkbox ?? false,
            estimatedSavingsPercent: Math.min(40, Math.round(totalCached * 0.5)),
          };

          if (totalCached >= 20) {
            swHealth = 'excellent';
            swEvidence = `Service Worker caches ${totalCached} assets${swDetails.hasWorkbox ? ' (Workbox strategy)' : ''} — estimated ${Math.min(40, Math.round(totalCached * 0.5))}% transfer savings for repeat visitors`;
          } else if (totalCached > 0) {
            swHealth = 'good';
            swEvidence = `Service Worker caches ${totalCached} assets — moderate caching coverage`;
            swRecommendation = 'Consider caching more static assets (CSS, JS, images) for better repeat visit performance.';
          } else {
            swHealth = 'warning';
            swEvidence = 'Service Worker registered but no assets cached — caching strategy not implemented';
            swRecommendation = 'Service Worker is active but not caching assets. Implement a cache-first or stale-while-revalidate strategy.';
          }
        }
      }
    } catch {
      /* M03 data not available — use basic info */
    }

    checkpoints.push(createCheckpoint({
      id: 'm13-service-worker',
      name: 'Service Worker Cache Efficiency',
      weight: 0.3,
      health: swHealth,
      evidence: swEvidence,
      recommendation: swRecommendation,
    }));
  }

  // ─── Third-Party Transfer Size Breakdown ─────────────────────────────────
  if (ctx.page && ctx.networkCollector) {
    try {
      const domain = new URL(ctx.url).hostname.replace(/^www\./, '');
      const tpAnalysis = await ThirdPartyProfiler.profile(ctx.page, ctx.networkCollector, domain);

      data.thirdPartyBreakdown = tpAnalysis.profiles
        .slice(0, 10)
        .map(p => ({
          domain: p.domain,
          category: p.category,
          totalBytes: p.totalBytes,
          requestCount: p.requestCount,
          toolName: p.toolName,
        }));

      data.thirdPartyTotalBytes = tpAnalysis.totalThirdPartyBytes;
    } catch { /* third-party breakdown is non-critical */ }
  }

  return {
    moduleId: 'M13' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

export { execute };
registerModuleExecutor('M13' as ModuleId, execute);
