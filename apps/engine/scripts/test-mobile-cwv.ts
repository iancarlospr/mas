/**
 * Test mobile CWV collection strategies against a slow gobierno site.
 * Compares: networkidle vs domcontentloaded, with/without PerformanceObserver.
 */
import { chromium } from 'patchright';

const TEST_URL = 'https://desarrollo.pr.gov';
const PIXEL8 = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36',
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
};

// Inject PerformanceObserver BEFORE navigation so LCP/CLS are captured
const OBSERVER_SCRIPT = `
  window.__cwv = { lcp: null, cls: 0, clsEntries: 0 };
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    if (entries.length > 0) window.__cwv.lcp = entries[entries.length - 1].startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.__cwv.cls += entry.value;
        window.__cwv.clsEntries++;
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
`;

async function collectMetrics(page: import('patchright').Page) {
  return page.evaluate(() => {
    const perf = performance;
    const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = perf.getEntriesByType('resource') as PerformanceResourceTiming[];

    // Use observer-captured values if available, fallback to getEntriesByType
    const cwv = (window as any).__cwv as { lcp: number | null; cls: number; clsEntries: number } | undefined;

    let lcp = cwv?.lcp ?? null;
    if (lcp === null) {
      const lcpEntries = perf.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) lcp = lcpEntries[lcpEntries.length - 1]!.startTime;
    }

    let cls = cwv ? cwv.cls : null;
    const clsEntries = cwv?.clsEntries ?? 0;

    let fcp: number | null = null;
    for (const e of perf.getEntriesByType('paint')) if (e.name === 'first-contentful-paint') fcp = e.startTime;

    const ttfb = nav?.responseStart ? nav.responseStart - nav.requestStart : 0;
    let totalBytes = 0;
    for (const r of resources) totalBytes += r.transferSize || r.encodedBodySize || 0;

    return { lcp, cls, clsEntries, fcp, ttfb, totalBytes, resourceCount: resources.length };
  });
}

async function testStrategy(name: string, waitUntil: 'networkidle' | 'domcontentloaded', navTimeout: number, settleMs: number, useObserver: boolean) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(PIXEL8);
  const page = await context.newPage();

  console.log(`\n=== ${name} ===`);
  const t0 = Date.now();

  // Inject observer before navigation
  if (useObserver) {
    await context.addInitScript(OBSERVER_SCRIPT);
  }

  // Navigate
  let navOk = true;
  try {
    await page.goto(TEST_URL, { waitUntil, timeout: navTimeout, referer: 'https://www.google.com/' });
    console.log(`  nav: OK (${Date.now() - t0}ms)`);
  } catch {
    navOk = false;
    console.log(`  nav: TIMED OUT after ${navTimeout}ms (${Date.now() - t0}ms elapsed)`);
    if (waitUntil === 'networkidle') {
      try { await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }); } catch {}
    }
  }

  // Settle
  await page.waitForTimeout(settleMs);
  console.log(`  settle: ${settleMs}ms (${Date.now() - t0}ms total)`);

  // Collect metrics with 10s timeout
  let metrics: Awaited<ReturnType<typeof collectMetrics>> | null = null;
  try {
    metrics = await Promise.race([
      collectMetrics(page),
      new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
    ]);
  } catch (e) {
    console.log(`  evaluate: ERROR — ${(e as Error).message}`);
  }

  const totalMs = Date.now() - t0;

  if (metrics) {
    console.log(`  metrics collected in ${totalMs}ms:`);
    console.log(`    LCP:   ${metrics.lcp !== null ? metrics.lcp.toFixed(0) + 'ms' : 'null'}`);
    console.log(`    CLS:   ${metrics.cls !== null ? metrics.cls.toFixed(4) + ` (${metrics.clsEntries} shifts)` : 'null'}`);
    console.log(`    FCP:   ${metrics.fcp !== null ? metrics.fcp.toFixed(0) + 'ms' : 'null'}`);
    console.log(`    TTFB:  ${metrics.ttfb.toFixed(0)}ms`);
    console.log(`    Bytes: ${(metrics.totalBytes / 1024).toFixed(0)}KB (${metrics.resourceCount} resources)`);
  } else {
    console.log(`  metrics: NULL (evaluate timed out or failed) — ${totalMs}ms total`);
  }

  await page.close();
  await context.close();
  await browser.close();

  return { name, navOk, metrics, totalMs };
}

async function main() {
  console.log(`Testing mobile CWV collection against ${TEST_URL}\n`);

  // Test 1: Current approach (no observer)
  const r1 = await testStrategy(
    'CURRENT: networkidle 25s + 2s settle (no observer)',
    'networkidle', 25_000, 2_000, false
  );

  // Test 2: Current approach WITH observer
  const r2 = await testStrategy(
    'CURRENT + OBSERVER: networkidle 25s + 2s settle',
    'networkidle', 25_000, 2_000, true
  );

  // Test 3: Proposed approach with observer
  const r3 = await testStrategy(
    'PROPOSED: domcontentloaded 15s + 3s settle + observer',
    'domcontentloaded', 15_000, 3_000, true
  );

  // Test 4: Fast approach
  const r4 = await testStrategy(
    'FAST: domcontentloaded 10s + 5s settle + observer',
    'domcontentloaded', 10_000, 5_000, true
  );

  console.log('\n=== SUMMARY ===');
  for (const r of [r1, r2, r3, r4]) {
    const m = r.metrics;
    const status = m
      ? `LCP=${m.lcp?.toFixed(0) ?? 'null'}ms CLS=${m.cls?.toFixed(4) ?? 'null'} FCP=${m.fcp?.toFixed(0) ?? 'null'}ms`
      : 'NO METRICS';
    console.log(`  ${r.totalMs.toString().padStart(6)}ms | ${r.navOk ? 'OK ' : 'TO '} | ${status} | ${r.name}`);
  }
}

main().catch(console.error);
