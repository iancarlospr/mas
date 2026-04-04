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

  // SPF — M01 stores as data.spf (string or boolean)
  gt.expectedData['spf'] = { match: facts.spf ? 'truthy' : 'falsy', note: facts.spf ? 'SPF record exists' : 'No SPF' };

  // DMARC — M01 stores as data.dmarc (string) and data.dmarcPolicy (string)
  gt.expectedData['dmarc'] = { match: facts.dmarc ? 'truthy' : 'falsy', note: facts.dmarc ? `DMARC p=${facts.dmarcPolicy}` : 'No DMARC' };
  // DMARC policy — use truthy not exact because DNS is live and policies can change between capture and replay
  if (facts.dmarcPolicy) gt.expectedData['dmarcPolicy'] = { match: 'truthy', note: `DMARC policy: ${facts.dmarcPolicy}` };

  // DKIM — M01 stores as data.dkim (array of {selector, record})
  gt.expectedData['dkim'] = { match: facts.dkim ? 'truthy' : 'falsy', note: facts.dkim ? `DKIM selectors: ${(facts.dkimSelectors as string[])?.join(', ')}` : 'No DKIM found' };

  // Email — M01 stores as data.emailProvider (object with .provider field)
  // Only assert when we detected a specific known provider (not null)
  if (facts.emailProvider && facts.emailProvider !== 'Other') {
    gt.expectedData['emailProvider.provider'] = { value: facts.emailProvider as string, match: 'contains', note: 'Email provider from MX' };
  }

  // Security headers
  gt.expectedData['hsts'] = { match: facts.hasHsts ? 'truthy' : 'falsy', note: facts.hasHsts ? 'HSTS present' : 'No HSTS' };
  gt.expectedData['csp'] = { match: facts.hasCsp ? 'truthy' : 'falsy', note: facts.hasCsp ? 'CSP present' : 'No CSP' };
  gt.expectedData['ipv6'] = { match: facts.hasIpv6 ? 'truthy' : 'falsy', note: facts.hasIpv6 ? 'IPv6 AAAA record' : 'No IPv6' };

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

  // CMS
  if (facts.cmsName) {
    gt.expectedData['cms.name'] = { value: facts.cmsName as string, match: 'contains', note: `CMS: ${facts.cmsName}` };
  }

  // Tracking IDs
  if (facts.hasGA4) gt.expectedData['trackingIds'] = { match: 'truthy', note: `GA4: ${facts.ga4Id}` };
  if (facts.hasGTM) gt.expectedData['trackingIds'] = { match: 'truthy', note: `GTM: ${facts.gtmId}` };

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

  // Title
  gt.expectedData['title'] = { match: facts.title ? 'truthy' : 'falsy', note: facts.title ? `Title: "${(facts.title as string).substring(0, 50)}"` : 'No title' };

  // Meta description
  gt.expectedData['metaDescription'] = { match: facts.metaDescription ? 'truthy' : 'falsy', note: facts.metaDescription ? 'Meta description present' : 'No meta description' };

  // Language
  if (facts.htmlLang) gt.expectedData['htmlLang'] = { value: facts.htmlLang as string, match: 'contains', note: `Lang: ${facts.htmlLang}` };

  // Canonical
  gt.expectedData['canonical'] = { match: facts.canonical ? 'truthy' : 'falsy', note: facts.canonical ? 'Canonical URL set' : 'No canonical' };

  // OG tags
  const ogCount = facts.ogTagCount as number ?? 0;
  if (ogCount > 0) gt.expectedData['ogTags'] = { match: 'truthy', note: `${ogCount} OG tags` };

  // JSON-LD
  if ((facts.jsonLdCount as number) > 0) {
    gt.expectedData['jsonLd'] = { match: 'truthy', note: `Schema types: ${(facts.jsonLdTypes as string[])?.join(', ').substring(0, 60)}` };
  }

  // Hreflang
  const hreflangCount = facts.hreflangCount as number ?? 0;
  if (hreflangCount > 0) gt.expectedData['hreflang'] = { match: 'truthy', note: `${hreflangCount} hreflang tags` };

  // robots.txt
  if (facts.hasRobotsTxt) gt.expectedData['robotsTxt'] = { match: 'truthy', note: 'robots.txt exists' };

  // Sitemap
  if (facts.hasSitemap) gt.expectedData['sitemap'] = { match: 'truthy', note: 'sitemap.xml exists' };

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

  gt.expectedData['careers_page_url'] = { match: facts.hasCareersPage ? 'truthy' : 'falsy', note: facts.hasCareersPage ? 'Careers page found' : 'No careers page' };

  if (facts.externalCareersUrl) {
    gt.expectedData['external_careers_links'] = { match: 'truthy', note: `External: ${facts.externalCareersUrl}` };
  }

  const atsProviders = facts.atsProviders as string[] ?? [];
  if (atsProviders.length > 0) {
    gt.expectedData['ats_provider'] = { value: atsProviders[0], match: 'contains', note: `ATS: ${atsProviders.join(', ')}` };
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

  if (facts.externalIrDomain) {
    // Strip query params — tracking params change between captures
    const irDomain = (facts.externalIrDomain as string).split('?')[0]!.replace(/\/$/, '');
    gt.expectedData['external_ir_domain'] = { value: irDomain, match: 'contains', note: 'External IR subdomain' };
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

  gt.expectedData['support_page_url'] = { match: facts.hasSupportPage ? 'truthy' : 'falsy', note: facts.hasSupportPage ? 'Support page found' : 'No support page' };

  if (facts.hasPhone) gt.expectedData['support_channels'] = { match: 'truthy', note: 'Phone support detected' };
  if (facts.hasChat) gt.expectedData['chatbot'] = { match: 'truthy', note: 'Live chat detected' };
  if (facts.hasDeveloperDocs) gt.expectedData['developer_docs'] = { match: 'truthy', note: 'Developer docs found' };

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
