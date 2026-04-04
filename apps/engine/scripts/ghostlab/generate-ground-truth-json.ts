/**
 * Ghostlab — Generate Ground Truth JSON
 *
 * Converts browser-captured facts (from capture-ground-truth.ts) into the
 * structured ground-truth.json format used by compare-results.ts.
 *
 * This bridges the gap between "what the browser saw" and "what the module
 * should produce" — making the comparison fully automated.
 *
 * Usage:
 *   cd apps/engine
 *   npx tsx scripts/ghostlab/generate-ground-truth-json.ts --site=brainhi.com
 *   npx tsx scripts/ghostlab/generate-ground-truth-json.ts --all
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../test/fixtures/ghostlab');

// Auto-discover sites from fixtures directory
import { readdirSync } from 'node:fs';
const KNOWN_SITES = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(FIXTURES_DIR, d.name, 'browser-ground-truth.json')))
  .map(d => d.name);

interface BrowserFacts {
  site: string;
  capturedAt: string;
  modules: Record<string, Record<string, unknown>>;
}

interface GroundTruthModule {
  expectedData: Record<string, { value?: unknown; match: string; note?: string }>;
  expectedCheckpoints: Array<{ id: string; expectedHealth: string; note?: string }>;
  negativeAssertions: Array<{ path: string; mustNotContain?: string; mustNotEqual?: unknown; note: string }>;
  fixedBugs: Array<{ description: string; assertion: string; path?: string; mustNotContain?: string; mustNotEqual?: unknown }>;
}

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return KNOWN_SITES;
  const site = args.find(a => a.startsWith('--site='))?.split('=')[1];
  if (!site) {
    console.error('Usage: npx tsx scripts/ghostlab/generate-ground-truth-json.ts --site=example.com');
    process.exit(1);
  }
  return [site];
}

// ── M01 Ground Truth ──────────────────────────────────────────────────────────

function generateM01(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  if (facts.spf) {
    gt.expectedData['spf'] = { match: 'truthy', note: 'SPF record exists' };
    gt.expectedCheckpoints.push({ id: 'm01-spf', expectedHealth: 'excellent', note: 'SPF present' });
  }
  if (facts.dmarc) {
    gt.expectedData['dmarc'] = { match: 'truthy', note: 'DMARC record exists' };
    const policy = facts.dmarcPolicy as string;
    const health = policy === 'reject' ? 'excellent' : policy === 'quarantine' ? 'good' : 'warning';
    gt.expectedCheckpoints.push({ id: 'm01-dmarc', expectedHealth: health, note: `DMARC p=${policy}` });
  }
  if (facts.hasHsts) {
    gt.expectedData['hsts'] = { match: 'truthy', note: 'HSTS header present' };
  }
  if (facts.hasCsp) {
    gt.expectedData['csp'] = { match: 'truthy', note: 'CSP header present' };
  }
  gt.expectedCheckpoints.push({ id: 'm01-tls', expectedHealth: 'excellent', note: 'HTTPS site' });

  return gt;
}

// ── M02 Ground Truth ──────────────────────────────────────────────────────────

function generateM02(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  gt.expectedData['detectedTechnologies'] = { match: 'truthy', note: 'Should detect technologies' };

  if (facts.generator) {
    const gen = facts.generator as string;
    if (gen.toLowerCase().includes('wordpress')) {
      gt.expectedData['cms.name'] = { value: 'WordPress', match: 'contains', note: `Generator: ${gen}` };
    }
  }
  // NOTE: CDN detection excluded from auto ground truth — depends on which
  // edge server responds (Varnish vs CloudFront vs Cloudflare can vary).
  // NOTE: compression excluded — M02 normalizes "br" to "brotli" which
  // creates false mismatches with raw header values from browser capture.

  gt.expectedCheckpoints.push({ id: 'm02-https-enforced', expectedHealth: 'excellent', note: 'HTTPS site' });

  return gt;
}

// ── M04 Ground Truth ──────────────────────────────────────────────────────────

function generateM04(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  if (facts.title) gt.expectedData['title'] = { match: 'truthy', note: 'Page title exists' };
  if (facts.metaDescription) gt.expectedData['metaDescription'] = { match: 'truthy', note: 'Meta description exists' };
  if (facts.htmlLang) gt.expectedData['htmlLang'] = { match: 'truthy', note: `Lang: ${facts.htmlLang}` };
  if (facts.viewport) gt.expectedCheckpoints.push({ id: 'M04-VIEWPORT', expectedHealth: 'excellent', note: 'Viewport meta present' });
  if ((facts.jsonLdCount as number) > 0) gt.expectedData['jsonLd'] = { match: 'truthy', note: `${facts.jsonLdCount} JSON-LD blocks` };
  if (facts.hasRobotsTxt) gt.expectedCheckpoints.push({ id: 'M04-ROBOTS', expectedHealth: 'excellent', note: 'robots.txt exists' });

  return gt;
}

// ── M16 Ground Truth ──────────────────────────────────────────────────────────

function generateM16(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  if (facts.pressPageUrl) {
    gt.expectedData['press_page_url'] = { match: 'truthy', note: `Press page at ${facts.pressPageUrl}` };

    // Article count — use the best available source
    const wpCount = facts.wpVerifiedCount as number | undefined;
    const paginatedCount = facts.paginatedArticleCount as number | undefined;
    const visibleCount = facts.visibleArticleCount as number | undefined;
    const articleCount = wpCount ?? paginatedCount ?? visibleCount ?? 0;

    // NOTE: article_count excluded from auto ground truth — browser counts are
    // unreliable. Only manually verified ground truth should have article counts.

    // Press page health
    gt.expectedCheckpoints.push({ id: 'm16-press-page', expectedHealth: 'excellent', note: 'Press page found' });
  } else {
    gt.expectedData['press_page_url'] = { match: 'falsy', note: 'No press page found' };
    gt.expectedCheckpoints.push({ id: 'm16-press-page', expectedHealth: 'info', note: 'No press page' });
  }

  if (facts.mediaContactEmail) {
    gt.expectedData['press_contact_email'] = {
      value: facts.mediaContactEmail as string,
      match: 'exact',
      note: 'Media contact email',
    };
    gt.expectedCheckpoints.push({ id: 'm16-media-contact', expectedHealth: 'excellent', note: 'Has media email' });
  } else {
    gt.expectedCheckpoints.push({ id: 'm16-media-contact', expectedHealth: 'info', note: 'No media contact' });
  }

  if (facts.rssFeed) {
    gt.expectedCheckpoints.push({ id: 'm16-rss-feed', expectedHealth: 'good', note: 'RSS feed detected' });
  } else {
    gt.expectedCheckpoints.push({ id: 'm16-rss-feed', expectedHealth: 'info', note: 'No RSS feed' });
  }

  if (facts.hasMediaLogos) {
    gt.expectedCheckpoints.push({ id: 'm16-media-logos', expectedHealth: 'excellent', note: 'Media logos detected' });
  } else {
    gt.expectedCheckpoints.push({ id: 'm16-media-logos', expectedHealth: 'info', note: 'No media logos' });
  }

  return gt;
}

// ── M17 Ground Truth ──────────────────────────────────────────────────────────

function generateM17(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  if (facts.hasCareersPage) {
    gt.expectedData['careers_page_url'] = { match: 'truthy', note: 'Careers page found' };
    gt.expectedCheckpoints.push({ id: 'm17-careers-page', expectedHealth: 'good', note: 'Careers page exists' });
  } else {
    gt.expectedData['careers_page_url'] = { match: 'falsy', note: 'No careers page' };
    gt.expectedCheckpoints.push({ id: 'm17-careers-page', expectedHealth: 'info', note: 'No careers page' });
  }

  return gt;
}

// ── M18 Ground Truth ──────────────────────────────────────────────────────────

function generateM18(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  if (facts.hasIrPage) {
    gt.expectedCheckpoints.push({ id: 'm18-ir-portal', expectedHealth: 'good', note: 'IR page found' });
  } else {
    gt.expectedCheckpoints.push({ id: 'm18-ir-portal', expectedHealth: 'info', note: 'No IR page' });
  }

  const ticker = facts.ticker as { exchange: string; symbol: string } | null;
  if (ticker) {
    gt.expectedData['ticker_symbol'] = { value: ticker.symbol, match: 'exact', note: `${ticker.exchange}: ${ticker.symbol}` };
    gt.expectedData['stock_exchange'] = { value: ticker.exchange, match: 'contains', note: ticker.exchange };
  }

  return gt;
}

// ── M19 Ground Truth ──────────────────────────────────────────────────────────

function generateM19(facts: Record<string, unknown>): GroundTruthModule {
  const gt: GroundTruthModule = {
    expectedData: {},
    expectedCheckpoints: [],
    negativeAssertions: [],
    fixedBugs: [],
  };

  if (facts.hasSupportPage) {
    gt.expectedData['support_page_url'] = { match: 'truthy', note: 'Support/contact page found' };
  }

  return gt;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function generateForSite(site: string): void {
  const browserFactsPath = resolve(FIXTURES_DIR, site, 'browser-ground-truth.json');
  if (!existsSync(browserFactsPath)) {
    console.error(`No browser facts found for ${site}. Run capture-ground-truth.ts first.`);
    return;
  }

  const browserFacts: BrowserFacts = JSON.parse(readFileSync(browserFactsPath, 'utf-8'));

  console.log(`\nGenerating ground truth for ${site}...`);

  const groundTruth: Record<string, unknown> = {
    site,
    verifiedAt: browserFacts.capturedAt,
    generatedBy: 'generate-ground-truth-json.ts (from browser-ground-truth.json)',
    notes: `Auto-generated from browser-verified facts captured on ${browserFacts.capturedAt}`,
    modules: {} as Record<string, GroundTruthModule>,
  };

  const modules = groundTruth.modules as Record<string, GroundTruthModule>;
  const bm = browserFacts.modules;

  if (bm.M01) modules.M01 = generateM01(bm.M01);
  if (bm.M02) modules.M02 = generateM02(bm.M02);
  if (bm.M04) modules.M04 = generateM04(bm.M04);
  if (bm.M16) modules.M16 = generateM16(bm.M16);
  if (bm.M17) modules.M17 = generateM17(bm.M17);
  if (bm.M18) modules.M18 = generateM18(bm.M18);
  if (bm.M19) modules.M19 = generateM19(bm.M19);

  // Write — DON'T overwrite manually curated ground truth, write to a separate file
  const outPath = resolve(FIXTURES_DIR, site, 'auto-ground-truth.json');
  writeFileSync(outPath, JSON.stringify(groundTruth, null, 2));

  // Print summary
  for (const [modId, gt] of Object.entries(modules)) {
    const dataCount = Object.keys(gt.expectedData).length;
    const cpCount = gt.expectedCheckpoints.length;
    console.log(`  ${modId}: ${dataCount} data assertions, ${cpCount} checkpoint assertions`);
  }

  console.log(`  ✓ Saved: ${outPath}`);
}

function main() {
  const sites = parseArgs();
  for (const site of sites) {
    generateForSite(site);
  }
}

main();
