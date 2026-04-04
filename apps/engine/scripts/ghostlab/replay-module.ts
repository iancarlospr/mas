/**
 * Ghostlab — Module Replay Harness
 *
 * Runs a single passive module against captured fixtures. HTTP probes are
 * intercepted by MSW so no live network calls are made for fetch-based modules.
 * DNS calls (M01 only) still hit the network in this version.
 *
 * Usage:
 *   cd apps/engine
 *   npx tsx scripts/ghostlab/replay-module.ts --module=M16 --site=senzary.com
 *   npx tsx scripts/ghostlab/replay-module.ts --module=M16 --site=senzary.com --save
 *   npx tsx scripts/ghostlab/replay-module.ts --module=M16 --all-sites
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ModuleId, ModuleResult } from '@marketing-alpha/types';
import type { ModuleContext } from '../../src/modules/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');

// Module executor imports — passive phase only
// Each module exports { execute } as named export
const MODULE_EXECUTORS: Record<string, () => Promise<{ execute: (ctx: ModuleContext) => Promise<ModuleResult> }>> = {
  M01: () => import('../../src/modules/passive/m01-dns-security.js'),
  M02: () => import('../../src/modules/passive/m02-cms-infrastructure.js'),
  M04: () => import('../../src/modules/passive/m04-page-metadata.js'),
  M16: () => import('../../src/modules/passive/m16-pr-media.js'),
  M17: () => import('../../src/modules/passive/m17-careers-hr.js'),
  M18: () => import('../../src/modules/passive/m18-investor-relations.js'),
  M19: () => import('../../src/modules/passive/m19-support-success.js'),
};

// Auto-discover sites from fixtures directory
import { readdirSync } from 'node:fs';
const KNOWN_SITES = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(FIXTURES_DIR, d.name, 'context.json')))
  .map(d => d.name);

// ── Args ──────────────────────────────────────────────────────────────────────

interface ReplayArgs {
  moduleId: string;
  sites: string[];
  save: boolean;
}

function parseArgs(): ReplayArgs {
  const args = process.argv.slice(2);
  const moduleId = args.find(a => a.startsWith('--module='))?.split('=')[1];
  const site = args.find(a => a.startsWith('--site='))?.split('=')[1];
  const allSites = args.includes('--all-sites');
  const save = args.includes('--save');

  if (!moduleId || (!site && !allSites)) {
    console.error('Usage: npx tsx scripts/ghostlab/replay-module.ts --module=M16 --site=senzary.com [--save]');
    console.error('       npx tsx scripts/ghostlab/replay-module.ts --module=M16 --all-sites [--save]');
    process.exit(1);
  }

  if (!MODULE_EXECUTORS[moduleId]) {
    console.error(`Unknown module: ${moduleId}. Available: ${Object.keys(MODULE_EXECUTORS).join(', ')}`);
    process.exit(1);
  }

  return {
    moduleId,
    sites: allSites ? KNOWN_SITES : [site!],
    save,
  };
}

// ── Fixture Loading ───────────────────────────────────────────────────────────

interface ContextFixture {
  url: string;
  html: string;
  headers: Record<string, string>;
  redirectChain: string[];
  finalUrl: string;
}

interface SitemapPagesFixture {
  sitemapPages: {
    press: Array<{ url: string; path: string; html: string }>;
    careers: Array<{ url: string; path: string; html: string }>;
    ir: Array<{ url: string; path: string; html: string }>;
    support: Array<{ url: string; path: string; html: string }>;
  };
}

interface HttpProbesFixture {
  probes: Record<string, { status: number; headers: Record<string, string>; body: string; ok: boolean }>;
  baseUrl: string;
}

function loadFixture<T>(site: string, filename: string): T {
  const filepath = resolve(FIXTURES_DIR, site, filename);
  if (!existsSync(filepath)) {
    console.error(`Fixture not found: ${filepath}`);
    console.error('Run capture-baseline.ts first');
    process.exit(1);
  }
  return JSON.parse(readFileSync(filepath, 'utf-8')) as T;
}

// ── MSW Handlers ──────────────────────────────────────────────────────────────

function stripEncodingHeaders(headers: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    // Strip encoding headers — MSW serves the body already decoded
    if (lower === 'content-encoding' || lower === 'transfer-encoding') continue;
    cleaned[key] = value;
  }
  return cleaned;
}

function createProbeHandlers(probesFixture: HttpProbesFixture) {
  const handlers = [];
  const { baseUrl, probes } = probesFixture;

  // Build a lookup map for probe responses, keyed by full URL (with query params)
  const probeLookup = new Map<string, typeof probes[string]>();
  for (const [path, data] of Object.entries(probes)) {
    const url = `${baseUrl}${path}`;
    probeLookup.set(url, data);
  }

  // Single handler that matches all requests to the base URL domain
  // and looks up the full URL (including query params) in the probe map
  const baseHost = new URL(baseUrl).hostname;
  handlers.push(
    http.get(`https://${baseHost}/*`, ({ request }) => {
      const fullUrl = request.url;
      let data = probeLookup.get(fullUrl);
      // Try without trailing slash
      if (!data) data = probeLookup.get(fullUrl.replace(/\/$/, ''));
      // Try with trailing slash
      if (!data) data = probeLookup.get(fullUrl + '/');
      // Try path-only match (strip query params)
      if (!data) {
        const urlObj = new URL(fullUrl);
        data = probeLookup.get(`${urlObj.origin}${urlObj.pathname}`);
        if (!data) data = probeLookup.get(`${urlObj.origin}${urlObj.pathname.replace(/\/$/, '')}`);
      }

      if (data) {
        const cleanHeaders = stripEncodingHeaders(data.headers);
        return new HttpResponse(data.body || '', {
          status: data.status || 200,
          headers: cleanHeaders,
        });
      }
      // Not in fixtures — return 404
      console.log(`  [MSW] No fixture for: ${fullUrl}`);
      return new HttpResponse('Not Found', { status: 404 });
    }),
  );

  // Load external newsroom fixtures if they exist
  for (const siteName of ['senzary.com', 'ryder.com']) {
    const extPath = resolve(FIXTURES_DIR, siteName, 'external-newsroom.json');
    if (existsSync(extPath)) {
      const extFixture = JSON.parse(readFileSync(extPath, 'utf-8')) as {
        origin: string;
        pages: Record<string, { status: number; headers: Record<string, string>; body: string; ok: boolean }>;
      };
      // Handler for the root origin (e.g., https://newsroom.ryder.com)
      const rootPage = extFixture.pages['/'];
      if (rootPage) {
        handlers.push(
          http.get(extFixture.origin, () => {
            return new HttpResponse(rootPage.body, {
              status: rootPage.status,
              headers: stripEncodingHeaders(rootPage.headers),
            });
          }),
        );
      }
      // Handlers for API endpoints — use wildcard URL matching
      for (const [pagePath, pageData] of Object.entries(extFixture.pages)) {
        if (pagePath === '/') continue;
        const fullUrl = `${extFixture.origin}${pagePath}`;
        handlers.push(
          http.get(fullUrl + '*', () => {
            return new HttpResponse(pageData.body, {
              status: pageData.status,
              headers: stripEncodingHeaders(pageData.headers),
            });
          }),
        );
      }
    }
  }

  // Catch-all for any URL not in fixtures — return 404
  handlers.push(
    http.get('*', ({ request }) => {
      const url = new URL(request.url);
      // Allow DNS-related requests and non-HTTP schemes to pass through
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
      }
      console.log(`  [MSW] Unmatched request: ${request.url} → 404`);
      return new HttpResponse('Not Found', { status: 404 });
    }),
  );

  return handlers;
}

// ── Context Building ──────────────────────────────────────────────────────────

function buildModuleContext(
  contextFixture: ContextFixture,
  sitemapFixture: SitemapPagesFixture,
): ModuleContext {
  return {
    url: contextFixture.finalUrl || contextFixture.url,
    scanId: 'ghostlab-replay',
    tier: 'paid',
    html: contextFixture.html,
    headers: contextFixture.headers,
    redirectChain: contextFixture.redirectChain,
    finalUrl: contextFixture.finalUrl || contextFixture.url,
    browserRedirectChains: [],
    mixedContent: null,
    sitemapPages: sitemapFixture.sitemapPages,
    previousResults: new Map<ModuleId, ModuleResult>(),
    contentAnalysis: null,
    cruxData: null,
    mobileMetrics: null,
    page: null as any,
    networkCollector: null as any,
    consoleCollector: null as any,
    storageSnapshot: null as any,
    frameSnapshot: null as any,
    domForensics: null as any,
    inlineConfigs: null as any,
    cookieAnalysis: null as any,
    formSnapshot: null as any,
    imageAudit: null as any,
    linkAnalysis: null as any,
    navigatorSnapshot: null as any,
    spaDetected: false,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function replayModule(moduleId: string, site: string, save: boolean): Promise<ModuleResult> {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`REPLAY: ${moduleId} @ ${site}`);
  console.log(`${'─'.repeat(50)}`);

  // Load fixtures
  const contextFixture = loadFixture<ContextFixture>(site, 'context.json');
  const sitemapFixture = loadFixture<SitemapPagesFixture>(site, 'sitemap-pages.json');
  const probesFixture = loadFixture<HttpProbesFixture>(site, 'http-probes.json');

  // Set up MSW to intercept HTTP calls
  const mswHandlers = createProbeHandlers(probesFixture);
  const mswServer = setupServer(...mswHandlers);
  mswServer.listen({ onUnhandledRequest: 'bypass' });

  try {
    // Build context
    const ctx = buildModuleContext(contextFixture, sitemapFixture);

    // Load and run executor
    const loader = MODULE_EXECUTORS[moduleId]!;
    const { execute } = await loader();

    console.log(`  Context: url=${ctx.url}`);
    console.log(`  HTML: ${ctx.html ? `${(ctx.html.length / 1024).toFixed(1)}KB` : 'null'}`);
    console.log(`  Headers: ${Object.keys(ctx.headers).length} keys`);
    console.log(`  SitemapPages: press=${ctx.sitemapPages?.press.length ?? 0}, careers=${ctx.sitemapPages?.careers.length ?? 0}, ir=${ctx.sitemapPages?.ir.length ?? 0}, support=${ctx.sitemapPages?.support.length ?? 0}`);

    const start = Date.now();
    const result = await execute(ctx);
    const elapsed = Date.now() - start;

    console.log(`\n  Status: ${result.status}`);
    console.log(`  Checkpoints: ${result.checkpoints.length}`);
    console.log(`  Signals: ${result.signals.length}`);
    console.log(`  Data keys: ${Object.keys(result.data).length}`);
    console.log(`  Duration: ${elapsed}ms`);

    if (result.status === 'error') {
      console.error(`  Error: ${result.error}`);
    }

    // Save result
    if (save) {
      const outDir = resolve(FIXTURES_DIR, site, 'replay-results');
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(outDir, `${moduleId}.json`);
      writeFileSync(outPath, JSON.stringify({
        ...result,
        _replay: {
          site,
          moduleId,
          elapsed,
          replayedAt: new Date().toISOString(),
        },
      }, null, 2));
      console.log(`  Saved: ${outPath}`);
    }

    return result;
  } finally {
    mswServer.close();
  }
}

async function main() {
  const { moduleId, sites, save } = parseArgs();

  for (const site of sites) {
    await replayModule(moduleId, site, save);
  }

  // Print summary if multiple sites
  if (sites.length > 1) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`Replay complete: ${moduleId} across ${sites.length} sites`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
