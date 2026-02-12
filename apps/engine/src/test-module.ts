/**
 * Standalone module test harness.
 * Run from engine root: npx tsx src/test-module.ts M01 https://hubspot.com
 * Saves result to ../../testing-modules/{moduleId}-result.json
 *
 * Supports all module phases:
 *   - Passive: HTTP fetch only
 *   - Browser: Launches Playwright chromium
 *   - GhostScan: Launches Playwright chromium (same as browser)
 *   - External: HTTP only (API modules)
 *   - Synthesis: Loads previousResults from testing-modules/
 */
import { fetchWithRetry } from './utils/http.js';
import { calculateModuleScore } from './utils/scoring.js';
import { NetworkCollector } from './utils/network.js';
import { getRegistrableDomain } from './utils/url.js';
import type { ModuleContext } from './modules/types.js';
import type { ModuleResult, ModuleId } from '@marketing-alpha/types';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', '..', '..', 'testing-modules');

// ─── Module registry with phase info ────────────────────────────────────────
type Phase = 'passive' | 'browser' | 'ghostscan' | 'external' | 'synthesis';

interface ModuleEntry {
  path: string;
  phase: Phase;
}

const moduleMap: Record<string, ModuleEntry> = {
  // Passive
  M01: { path: './modules/passive/m01-dns-security.js', phase: 'passive' },
  M02: { path: './modules/passive/m02-cms-infrastructure.js', phase: 'passive' },
  M04: { path: './modules/passive/m04-page-metadata.js', phase: 'passive' },
  M16: { path: './modules/passive/m16-pr-media.js', phase: 'passive' },
  M17: { path: './modules/passive/m17-careers-hr.js', phase: 'passive' },
  M18: { path: './modules/passive/m18-investor-relations.js', phase: 'passive' },
  M19: { path: './modules/passive/m19-support-success.js', phase: 'passive' },

  // Browser
  M03: { path: './modules/browser/m03-performance.js', phase: 'browser' },
  M05: { path: './modules/browser/m05-analytics.js', phase: 'browser' },
  M06: { path: './modules/browser/m06-paid-media.js', phase: 'browser' },
  M06b: { path: './modules/browser/m06b-ppc-landing-audit.js', phase: 'browser' },
  M07: { path: './modules/browser/m07-martech.js', phase: 'browser' },
  M08: { path: './modules/browser/m08-tag-governance.js', phase: 'browser' },
  M13: { path: './modules/browser/m13-perf-carbon.js', phase: 'browser' },
  M14: { path: './modules/browser/m14-mobile-responsive.js', phase: 'browser' },
  M15: { path: './modules/browser/m15-social-sharing.js', phase: 'browser' },
  M20: { path: './modules/browser/m20-ecommerce-saas.js', phase: 'browser' },

  // GhostScan
  M09: { path: './modules/ghostscan/m09-behavioral.js', phase: 'ghostscan' },
  M10: { path: './modules/ghostscan/m10-accessibility.js', phase: 'ghostscan' },
  M11: { path: './modules/ghostscan/m11-console-errors.js', phase: 'ghostscan' },
  M12: { path: './modules/ghostscan/m12-legal-compliance.js', phase: 'ghostscan' },

  // External (API-based)
  M21: { path: './modules/external/m21-ad-library.js', phase: 'external' },
  M22: { path: './modules/external/m22-news-sentiment.js', phase: 'external' },
  M23: { path: './modules/external/m23-social-sentiment.js', phase: 'external' },
  M24: { path: './modules/external/m24-market-intelligence.js', phase: 'external' },
  M25: { path: './modules/external/m25-monthly-visits.js', phase: 'external' },
  M26: { path: './modules/external/m26-traffic-by-country.js', phase: 'external' },
  M27: { path: './modules/external/m27-rankings.js', phase: 'external' },
  M28: { path: './modules/external/m28-paid-traffic-cost.js', phase: 'external' },
  M29: { path: './modules/external/m29-top-paid-keywords.js', phase: 'external' },
  M30: { path: './modules/external/m30-competitor-overlap.js', phase: 'external' },
  M31: { path: './modules/external/m31-traffic-sources.js', phase: 'external' },
  M32: { path: './modules/external/m32-domain-trust.js', phase: 'external' },
  M33: { path: './modules/external/m33-mobile-desktop.js', phase: 'external' },
  M34: { path: './modules/external/m34-brand-demand.js', phase: 'external' },
  M35: { path: './modules/external/m35-losing-keywords.js', phase: 'external' },
  M36: { path: './modules/external/m36-bounce-rate.js', phase: 'external' },
  M37: { path: './modules/external/m37-google-shopping.js', phase: 'external' },
  M38: { path: './modules/external/m38-review-velocity.js', phase: 'external' },
  M39: { path: './modules/external/m39-local-pack.js', phase: 'external' },
  M40: { path: './modules/external/m40-subdomain-enumeration.js', phase: 'external' },

  // Synthesis (AI)
  M41: { path: './modules/synthesis/m41-module-synthesis.js', phase: 'synthesis' },
  M42: { path: './modules/synthesis/m42-final-synthesis.js', phase: 'synthesis' },
  M43: { path: './modules/synthesis/m43-prd-generation.js', phase: 'synthesis' },
  M44: { path: './modules/synthesis/m44-roi-simulator.js', phase: 'synthesis' },
  M45: { path: './modules/synthesis/m45-cost-cutter.js', phase: 'synthesis' },
  M46: { path: './modules/synthesis/m46-knowledge-base.js', phase: 'synthesis' },
};

/**
 * Load previously saved module results for synthesis modules that need them.
 */
function loadPreviousResults(): Map<ModuleId, ModuleResult> {
  const results = new Map<ModuleId, ModuleResult>();

  for (const id of Object.keys(moduleMap)) {
    const filePath = join(outDir, `${id}-result.json`);
    if (existsSync(filePath)) {
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as ModuleResult;
        if (data.status === 'success') {
          results.set(id as ModuleId, data);
        }
      } catch { /* skip corrupt files */ }
    }
  }

  return results;
}

async function main() {
  const moduleId = process.argv[2] ?? 'M01';
  const targetUrl = process.argv[3] ?? 'https://aseguratec.com';

  const entry = moduleMap[moduleId];
  if (!entry) {
    console.error(`Unknown module: ${moduleId}. Available: ${Object.keys(moduleMap).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n=== Testing ${moduleId} against ${targetUrl} ===`);
  console.log(`Phase: ${entry.phase}\n`);

  // Step 1: Initial fetch (same as ModuleRunner.performInitialFetch)
  console.log('1. Performing initial fetch...');
  let html: string | null = null;
  let headers: Record<string, string> = {};

  let redirectChain: string[] = [];
  let finalUrl: string = targetUrl;

  try {
    const response = await fetchWithRetry(targetUrl, {
      timeout: 15_000,
      retries: 2,
    });
    html = response.body;
    headers = response.headers;
    redirectChain = response.redirectChain ?? [];
    finalUrl = response.finalUrl ?? targetUrl;
    console.log(`   Status: ${response.status}, HTML length: ${html.length}, Headers: ${Object.keys(headers).length}`);
    if (redirectChain.length > 0) {
      console.log(`   Redirect chain (${redirectChain.length} hops): ${redirectChain.join(' → ')}`);
    }
  } catch (err) {
    console.log(`   Initial fetch failed: ${(err as Error).message}`);
  }

  // Step 1b: Fetch CrUX data in parallel (non-blocking)
  let cruxData: ModuleContext['cruxData'] = null;
  try {
    const { fetchCruxData } = await import('./services/crux.js');
    console.log('   Fetching CrUX data...');
    cruxData = await fetchCruxData(targetUrl, 'mobile', 25_000);
    if (cruxData) {
      console.log(`   CrUX: source=${cruxData.source}, LCP=${cruxData.lcp?.p75 ?? 'N/A'}ms, Lighthouse=${cruxData.lighthouseScore}`);
    } else {
      console.log('   CrUX: no data (rate limited or unavailable)');
    }
  } catch { console.log('   CrUX fetch skipped'); }

  // Step 2: Build ModuleContext
  const ctx: ModuleContext = {
    url: targetUrl,
    scanId: 'test-' + Date.now(),
    tier: 'full',
    html,
    headers,
    page: null,
    networkCollector: null,
    consoleCollector: null,
    storageSnapshot: null,
    frameSnapshot: null,
    domForensics: null,
    inlineConfigs: null,
    cookieAnalysis: null,
    formSnapshot: null,
    contentAnalysis: null,
    imageAudit: null,
    linkAnalysis: null,
    navigatorSnapshot: null,
    redirectChain,
    finalUrl,
    browserRedirectChains: [],
    mixedContent: null,
    cruxData,
    mobileMetrics: null,
    previousResults: new Map(),
  };

  // Step 2b: For browser/ghostscan modules, launch Playwright
  let browser: import('patchright').Browser | null = null;

  if (entry.phase === 'browser' || entry.phase === 'ghostscan') {
    console.log('2. Launching Playwright browser...');
    const { chromium } = await import('patchright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Attach network collector
    const domain = getRegistrableDomain(targetUrl);
    const collector = new NetworkCollector(domain);
    collector.attach(page);

    // Navigate to target URL
    console.log(`   Navigating to ${targetUrl}...`);
    // Use 'load' + extra wait instead of networkidle,
    // as some sites (banking, enterprise) have continuous background requests
    // that prevent networkidle from ever resolving.
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch {
      // networkidle timed out — fall back to waiting for load event + extra time
      console.log('   networkidle timed out, falling back to load + wait...');
      await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(5_000);
    }
    console.log(`   Page loaded. Network requests: ${collector.getAllRequests().length}`);

    ctx.page = page;
    ctx.networkCollector = collector;

    // Run mixed content detection after browser phase
    try {
      const { detectMixedContent } = await import('./utils/mixed-content-detector.js');
      ctx.mixedContent = detectMixedContent(targetUrl, collector, html);
      if (ctx.mixedContent && (ctx.mixedContent.activeCount > 0 || ctx.mixedContent.passiveCount > 0)) {
        console.log(`   Mixed content: ${ctx.mixedContent.activeCount} active, ${ctx.mixedContent.passiveCount} passive`);
      }
    } catch { /* non-critical */ }
  }

  // Step 2c: For synthesis modules, load previous results
  if (entry.phase === 'synthesis') {
    console.log('2. Loading previous module results...');
    ctx.previousResults = loadPreviousResults();
    console.log(`   Loaded ${ctx.previousResults.size} previous results`);
  }

  // Step 3: Dynamically import the module
  console.log(`${entry.phase === 'browser' || entry.phase === 'ghostscan' ? '3' : '2'}. Loading module ${moduleId}...`);

  const mod = await import(entry.path);
  const execute = mod.default ?? mod.execute;

  if (!execute) {
    console.error(`Module ${moduleId} has no default or named export 'execute'`);
    if (browser) await browser.close();
    process.exit(1);
  }

  // Step 4: Execute
  console.log(`${entry.phase === 'browser' || entry.phase === 'ghostscan' ? '4' : '3'}. Executing ${moduleId}...`);
  const startTime = Date.now();

  let result: ModuleResult;
  try {
    result = await execute(ctx);
    result.duration = Date.now() - startTime;

    if (result.score === null && result.checkpoints.length > 0) {
      result.score = calculateModuleScore(result.checkpoints);
    }
  } catch (err) {
    result = {
      moduleId: moduleId as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: Date.now() - startTime,
      error: (err as Error).message,
    };
  }

  // Step 5: Cleanup browser
  if (browser) {
    await browser.close();
  }

  // Step 6: Save result
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${moduleId}-result.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  // Step 7: Print summary
  console.log(`\n=== ${moduleId} Result Summary ===`);
  console.log(`Status:      ${result.status}`);
  console.log(`Score:       ${result.score}`);
  console.log(`Duration:    ${result.duration}ms`);
  console.log(`Signals:     ${result.signals.length}`);
  console.log(`Checkpoints: ${result.checkpoints.length}`);
  if (result.error) console.log(`Error:       ${result.error}`);

  console.log('\nCheckpoints:');
  for (const cp of result.checkpoints) {
    const icon = cp.health === 'excellent' ? '✅' : cp.health === 'good' ? '🟢' : cp.health === 'warning' ? '🟡' : cp.health === 'critical' ? '🔴' : 'ℹ️';
    console.log(`  ${icon} ${cp.name} [${cp.health}] (w=${cp.weight})`);
    if (cp.evidence) console.log(`     ${cp.evidence.slice(0, 150)}`);
  }

  console.log('\nSignals:');
  for (const sig of result.signals) {
    console.log(`  📡 ${sig.name} (${sig.type}, confidence=${sig.confidence})`);
  }

  console.log(`\nFull result saved to: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
