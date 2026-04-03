/**
 * Ghostlab — Capture Baseline
 *
 * Fetches all raw context data for a benchmark site from live sources AND
 * pulls existing module_results from Supabase, saving everything as local
 * JSON fixtures for offline replay.
 *
 * Usage:
 *   cd apps/engine
 *   npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --domain=senzary.com --scan-id=846efd58
 *   npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --domain=ryder.com --scan-id=0d1d9a90
 *   npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --all
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from '../../src/utils/http.js';
import { resolveAllRecords, findSpfRecord, resolveDmarc, probeDkim } from '../../src/utils/dns.js';
import { discoverPathsFromSitemap } from '../../src/utils/sitemap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');

const PASSIVE_MODULES = ['M01', 'M02', 'M04', 'M16', 'M17', 'M18', 'M19'] as const;

const KNOWN_SITES: Record<string, string> = {
  'senzary.com': '846efd58',
  'ryder.com': '0d1d9a90',
};

// Probe paths used by passive modules (M04, M16, M17, M18, M19)
const PROBE_PATHS = [
  // M04
  '/robots.txt', '/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml',
  '/sitemaps/sitemap.xml', '/llms.txt', '/manifest.json', '/ads.txt',
  '/.well-known/security.txt',
  // M16
  '/press', '/press/', '/newsroom', '/newsroom/', '/news', '/news/',
  '/media', '/media/', '/press-releases', '/press-releases/',
  '/media-center', '/media-center/',
  // M17
  '/careers', '/careers/', '/jobs', '/jobs/', '/join-us', '/join-us/',
  '/about/careers', '/about/team',
  // M18
  '/investors', '/investors/', '/investor-relations', '/investor-relations/',
  '/ir', '/ir/', '/shareholders', '/shareholders/',
  '/about/investors', '/corporate/investors',
  // M19
  '/support', '/support/', '/help', '/help/', '/faq', '/faq/',
  '/contact', '/contact/', '/knowledge-base', '/knowledge-base/',
  '/docs', '/docs/', '/documentation', '/documentation/',
];

// Sitemap category keywords (duplicated from runner.ts for standalone operation)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  press: ['press', 'newsroom', 'news', 'media', 'announcement', 'prensa', 'noticias'],
  careers: ['career', 'jobs', 'hiring', 'join', 'talent', 'employment', 'opportunit', 'opening', 'empleo'],
  ir: ['investor', 'shareholder', 'stockholder', 'ir', 'sec-filing', 'annual-report', 'earning', 'financial'],
  support: ['support', 'help', 'knowledge', 'faq', 'contact', 'doc', 'guide', 'tutorial', 'soporte'],
};

function parseArgs(): { domain: string; scanId: string }[] {
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    return Object.entries(KNOWN_SITES).map(([domain, scanId]) => ({ domain, scanId }));
  }

  const domainArg = args.find(a => a.startsWith('--domain='))?.split('=')[1];
  const scanArg = args.find(a => a.startsWith('--scan-id='))?.split('=')[1];

  if (!domainArg) {
    console.error('Usage: npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --domain=<domain> --scan-id=<prefix>');
    console.error('       npx tsx --env-file=.env scripts/ghostlab/capture-baseline.ts --all');
    process.exit(1);
  }

  const scanId = scanArg ?? KNOWN_SITES[domainArg] ?? '';
  // scan-id is optional — Supabase results capture will be skipped if empty
  return [{ domain: domainArg, scanId }];
}

function writeFixture(siteDir: string, filename: string, data: unknown): void {
  const filepath = resolve(siteDir, filename);
  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${filename} (${(JSON.stringify(data).length / 1024).toFixed(1)}KB)`);
}

async function captureContext(domain: string, siteDir: string): Promise<void> {
  console.log('\n── Fetching initial page context ──');
  const url = `https://www.${domain}`;
  let contextUrl = url;
  try {
    // Try www first, fall back to bare domain
    const result = await fetchWithRetry(url, { timeout: 20_000, retries: 2 });
    writeFixture(siteDir, 'context.json', {
      url: contextUrl,
      html: result.body,
      headers: result.headers,
      redirectChain: result.redirectChain,
      finalUrl: result.finalUrl,
      status: result.status,
      capturedAt: new Date().toISOString(),
    });
  } catch {
    contextUrl = `https://${domain}`;
    console.log(`  www failed, trying ${contextUrl}`);
    const result = await fetchWithRetry(contextUrl, { timeout: 20_000, retries: 2 });
    writeFixture(siteDir, 'context.json', {
      url: contextUrl,
      html: result.body,
      headers: result.headers,
      redirectChain: result.redirectChain,
      finalUrl: result.finalUrl,
      status: result.status,
      capturedAt: new Date().toISOString(),
    });
  }
}

async function captureDns(domain: string, siteDir: string): Promise<void> {
  console.log('\n── Resolving DNS records ──');
  const records = await resolveAllRecords(domain);

  // DKIM selectors to try
  const dkimSelectors = ['google', 'selector1', 'selector2', 'default', 'dkim', 'k1', 's1', 's2', 'mail'];
  const dkimResults: Record<string, unknown> = {};
  for (const sel of dkimSelectors) {
    try {
      const result = await probeDkim(domain, sel);
      if (result) dkimResults[sel] = result;
    } catch { /* skip */ }
  }

  let dmarcRecord = null;
  try { dmarcRecord = await resolveDmarc(domain); } catch { /* skip */ }

  let spfRecord = null;
  try { spfRecord = findSpfRecord(records.TXT); } catch { /* skip */ }

  writeFixture(siteDir, 'dns.json', {
    records,
    dkim: dkimResults,
    dmarc: dmarcRecord,
    spf: spfRecord,
    capturedAt: new Date().toISOString(),
  });
}

async function captureSitemapPages(domain: string, siteDir: string): Promise<void> {
  console.log('\n── Discovering sitemap pages ──');
  const baseUrl = `https://www.${domain}`;
  const allKeywords = Object.values(CATEGORY_KEYWORDS).flat();

  let discovery;
  try {
    discovery = await discoverPathsFromSitemap(baseUrl, allKeywords, {
      timeout: 10_000,
      maxMatchedPaths: 50,
      maxChildSitemaps: 5,
    });
  } catch (e) {
    console.log(`  Sitemap discovery failed: ${(e as Error).message}`);
    discovery = { matchedPaths: [], robotsHints: [], sitemapFound: false };
  }

  // Categorize paths
  const categorized: Record<string, string[]> = { press: [], careers: [], ir: [], support: [] };
  for (const path of discovery.matchedPaths) {
    const pathLower = path.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const matched = keywords.some(kw => {
        if (kw.length <= 3) return new RegExp(`\\b${kw}\\b`, 'i').test(pathLower);
        return pathLower.includes(kw);
      });
      if (matched) {
        categorized[category]!.push(path);
        break;
      }
    }
  }

  // Fetch page HTML for each categorized path (cap 5 per category)
  const sitemapPages: Record<string, Array<{ url: string; path: string; html: string }>> = {
    press: [], careers: [], ir: [], support: [],
  };

  for (const [category, paths] of Object.entries(categorized)) {
    for (const path of paths.slice(0, 5)) {
      const fullUrl = `${baseUrl}${path}`;
      try {
        const result = await fetchWithRetry(fullUrl, { timeout: 15_000, retries: 1 });
        if (result.ok) {
          sitemapPages[category]!.push({ url: fullUrl, path, html: result.body });
        }
      } catch {
        console.log(`  Failed to fetch ${fullUrl}`);
      }
    }
  }

  console.log(`  Sitemap found: ${discovery.sitemapFound}, matched: ${discovery.matchedPaths.length}`);
  for (const [cat, pages] of Object.entries(sitemapPages)) {
    if (pages.length > 0) console.log(`  ${cat}: ${pages.length} pages`);
  }

  writeFixture(siteDir, 'sitemap-pages.json', {
    sitemapPages,
    discovery: {
      matchedPaths: discovery.matchedPaths,
      robotsHints: discovery.robotsHints,
      sitemapFound: discovery.sitemapFound,
    },
    capturedAt: new Date().toISOString(),
  });
}

async function captureHttpProbes(domain: string, siteDir: string): Promise<void> {
  console.log('\n── Probing HTTP paths ──');
  const baseUrl = `https://www.${domain}`;
  const probes: Record<string, { status: number; headers: Record<string, string>; body: string; ok: boolean }> = {};

  const batchSize = 5;
  for (let i = 0; i < PROBE_PATHS.length; i += batchSize) {
    const batch = PROBE_PATHS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (path) => {
        const url = `${baseUrl}${path}`;
        try {
          const result = await fetchWithRetry(url, { timeout: 10_000, retries: 0 });
          return { path, status: result.status, headers: result.headers, body: result.body, ok: result.ok };
        } catch {
          return { path, status: 0, headers: {}, body: '', ok: false };
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { path, ...data } = r.value;
        probes[path] = data;
      }
    }
  }

  const found = Object.entries(probes).filter(([, v]) => v.ok).length;
  console.log(`  ${found}/${PROBE_PATHS.length} paths returned OK`);

  writeFixture(siteDir, 'http-probes.json', {
    probes,
    baseUrl,
    capturedAt: new Date().toISOString(),
  });
}

async function captureSupabaseResults(scanIdPrefix: string, siteDir: string): Promise<void> {
  console.log('\n── Pulling module results from Supabase ──');
  const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);

  // Find scan by prefix
  const { data: scans } = await sb
    .from('scans')
    .select('id, url, domain, tier, status, marketing_iq, cache_source')
    .ilike('id', `${scanIdPrefix}%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!scans?.length) {
    console.error(`  No scan found with prefix: ${scanIdPrefix}`);
    return;
  }

  const scan = scans[0]!;
  const sourceId = scan.cache_source ?? scan.id;
  console.log(`  Scan: ${scan.domain} (${scan.id}), tier: ${scan.tier}, MIQ: ${scan.marketing_iq}`);

  const { data: results } = await sb
    .from('module_results')
    .select('module_id, status, data, checkpoints, signals, score, duration_ms, error')
    .eq('scan_id', sourceId)
    .order('module_id');

  if (!results?.length) {
    console.error('  No module results found');
    return;
  }

  // Save each passive module result
  let saved = 0;
  for (const moduleId of PASSIVE_MODULES) {
    const result = results.find(r => r.module_id === moduleId);
    if (result) {
      writeFixture(siteDir, `baseline-results/${moduleId}.json`, {
        ...result,
        scanId: scan.id,
        domain: scan.domain,
        capturedAt: new Date().toISOString(),
      });
      saved++;
    }
  }

  // Also save scan metadata
  writeFixture(siteDir, 'scan-metadata.json', {
    ...scan,
    sourceId,
    totalModules: results.length,
    capturedAt: new Date().toISOString(),
  });

  console.log(`  Saved ${saved}/${PASSIVE_MODULES.length} passive module baselines`);
}

async function captureSite(domain: string, scanId: string): Promise<void> {
  const siteDir = resolve(FIXTURES_DIR, domain);
  mkdirSync(siteDir, { recursive: true });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`GHOSTLAB CAPTURE: ${domain}`);
  console.log(`${'═'.repeat(60)}`);

  await captureContext(domain, siteDir);
  await captureDns(domain, siteDir);
  await captureSitemapPages(domain, siteDir);
  await captureHttpProbes(domain, siteDir);
  await captureSupabaseResults(scanId, siteDir);

  console.log(`\n✓ Capture complete for ${domain}`);
}

async function main() {
  const sites = parseArgs();
  for (const { domain, scanId } of sites) {
    await captureSite(domain, scanId);
  }
  console.log('\n✓ All captures complete');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
