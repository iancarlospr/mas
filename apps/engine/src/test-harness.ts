/**
 * Regression Test Harness
 *
 * Runs all testable modules (passive + browser + ghostscan + optional
 * external + synthesis) against 32 curated URLs for comprehensive
 * web technology coverage.
 *
 * Coverage targets:
 *   CMS:       WordPress, Drupal, AEM, Wix, Shopify, Squarespace, Webflow, Custom
 *   CDN:       Cloudflare, Akamai, Fastly, Vercel, Various
 *   Framework: React, Angular, Next.js, Lightning WC, PHP, Vanilla
 *   Consent:   OneTrust, Cookiebot, TCF, Various, None
 *   Industry:  Finance, Healthcare, Entertainment, News, Tech, Ecommerce, Gov
 *   Region:    Puerto Rico, US, UK, Global, CJK, RTL
 *   DOM:       Standard, Shadow DOM, Heavy iframes, SPA, MPA
 *   Bot:       Akamai, PerimeterX, Cloudflare
 *
 * Usage:
 *   npx tsx src/test-harness.ts                        # All 32 URLs, core modules
 *   npx tsx src/test-harness.ts --resume=8             # Resume from URL #8
 *   npx tsx src/test-harness.ts --limit=3              # First 3 URLs only
 *   npx tsx src/test-harness.ts --only=M01,M02         # Specific modules only
 *   npx tsx src/test-harness.ts --include-external     # Include M21-M39 external modules
 *   npx tsx src/test-harness.ts --include-synthesis    # Include M41-M46 synthesis modules
 *   npx tsx src/test-harness.ts --stability-runs=3     # Run each URL N times for variance
 *   npx tsx src/test-harness.ts --record-fixtures      # Record API responses as fixtures
 *   npx tsx src/test-harness.ts --replay-fixtures      # Replay from recorded fixtures (no API keys needed)
 *
 * Output:
 *   testing-modules/harness/{domain}/             Per-URL module results
 *   testing-modules/harness/summary.json          Cross-URL comparison matrix
 */

import { fetchWithRetry } from './utils/http.js';
import { NetworkCollector } from './utils/network.js';
import { getRegistrableDomain } from './utils/url.js';
import { calculateModuleScore } from './utils/scoring.js';
import type { ModuleContext } from './modules/types.js';
import type { ModuleResult, ModuleId, Checkpoint } from '@marketing-alpha/types';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installRecorder } from './test-harness/fixture-recorder.js';
import { installReplayer } from './test-harness/fixture-replayer.js';
import { BrowserPool } from './ghostscan/browser-pool.js';
import { detectAndHandleBotWall } from './ghostscan/bot-wall-detector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR = join(__dirname, '..', '..', '..', 'testing-modules', 'harness');

// ━━━ CONFIGURATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface TestUrl {
  url: string;
  label: string;
  category: string;
}

const TEST_URLS: TestUrl[] = [
  // ── Banks & Fintech (4) ────────────────────────────────────────────
  { url: 'https://americanriviera.bank', label: 'American Riviera Bank', category: 'Finance/US' },
  { url: 'https://prfedcu.com', label: 'PR Federal Credit Union', category: 'Finance/PR' },
  { url: 'https://nubank.com.br', label: 'Nubank', category: 'Finance/LatAm' },
  { url: 'https://www.navebank.com', label: 'Nave Bank', category: 'Finance/LatAm' },

  // ── LatAm Ecommerce & Retail (3) ──────────────────────────────────
  { url: 'https://www.mercadolibre.com', label: 'Mercado Libre', category: 'Ecommerce/LatAm' },
  { url: 'https://www.mitriples.com', label: 'Mi Triples', category: 'Retail/PR' },
  { url: 'https://tiendascapri.com', label: 'Tiendas Capri', category: 'Retail/PR' },

  // ── US Retail (1) ──────────────────────────────────────────────────
  { url: 'https://www.bhphotovideo.com', label: 'B&H Photo', category: 'Retail/US' },

  // ── SaaS & Tech (2) ───────────────────────────────────────────────
  { url: 'https://datafa.st', label: 'DataFast', category: 'SaaS/Analytics' },
  { url: 'https://insigniapremier.com', label: 'Insignia Premier', category: 'SaaS/Finance' },

  // ── Puerto Rico Services (3) ──────────────────────────────────────
  { url: 'https://www.claropr.com', label: 'Claro PR', category: 'Telecom/PR' },
  { url: 'https://www.viequesairlink.com', label: 'Vieques Air Link', category: 'Travel/PR' },
  { url: 'https://abarcahealth.com', label: 'Abarca Health', category: 'Healthcare/PR' },

  // ── Hospitality/PR (2) ────────────────────────────────────────────
  { url: 'https://www.elsanjuanhotel.com', label: 'El San Juan Hotel', category: 'Hospitality/PR' },
  { url: 'https://www.laconcharesort.com', label: 'La Concha Resort', category: 'Hospitality/PR' },

  // ── Personal Brands & Creators (6) ────────────────────────────────
  { url: 'https://www.joerogan.com', label: 'Joe Rogan', category: 'Creator/US' },
  { url: 'https://garyvaynerchuk.com', label: 'Gary Vaynerchuk', category: 'Creator/US' },
  { url: 'https://www.hubermanlab.com', label: 'Huberman Lab', category: 'Creator/US' },
  { url: 'https://www.smartpassiveincome.com', label: 'Smart Passive Income', category: 'Creator/US' },
  { url: 'https://tim.blog', label: 'Tim Ferriss', category: 'Creator/US' },
  { url: 'https://www.eofire.com', label: 'EOFire', category: 'Creator/US' },

  // ── Small Businesses US (5) ───────────────────────────────────────
  { url: 'https://www.allbirds.com', label: 'Allbirds', category: 'DTC/US' },
  { url: 'https://www.everlane.com', label: 'Everlane', category: 'DTC/US' },
  { url: 'https://www.bluebottlecoffee.com', label: 'Blue Bottle Coffee', category: 'F&B/US' },
  { url: 'https://www.warbyparker.com', label: 'Warby Parker', category: 'DTC/US' },
  { url: 'https://www.sweetgreen.com', label: 'Sweetgreen', category: 'F&B/US' },

  // ── Small Businesses LatAm (4) ────────────────────────────────────
  { url: 'https://www.rappi.com', label: 'Rappi', category: 'Delivery/LatAm' },
  { url: 'https://www.kavak.com', label: 'Kavak', category: 'Auto/LatAm' },
  { url: 'https://www.despegar.com', label: 'Despegar', category: 'Travel/LatAm' },
  { url: 'https://www.notco.com', label: 'NotCo', category: 'F&B/LatAm' },
];

interface ModuleEntry {
  id: string;
  path: string;
  phase: 'passive' | 'browser' | 'ghostscan' | 'external' | 'synthesis';
}

const PASSIVE_MODULES: ModuleEntry[] = [
  { id: 'M01', path: './modules/passive/m01-dns-security.js', phase: 'passive' },
  { id: 'M02', path: './modules/passive/m02-cms-infrastructure.js', phase: 'passive' },
  { id: 'M04', path: './modules/passive/m04-page-metadata.js', phase: 'passive' },
  { id: 'M16', path: './modules/passive/m16-pr-media.js', phase: 'passive' },
  { id: 'M17', path: './modules/passive/m17-careers-hr.js', phase: 'passive' },
  { id: 'M18', path: './modules/passive/m18-investor-relations.js', phase: 'passive' },
  { id: 'M19', path: './modules/passive/m19-support-success.js', phase: 'passive' },
];

const BROWSER_MODULES: ModuleEntry[] = [
  { id: 'M03', path: './modules/browser/m03-performance.js', phase: 'browser' },
  { id: 'M05', path: './modules/browser/m05-analytics.js', phase: 'browser' },
  { id: 'M06', path: './modules/browser/m06-paid-media.js', phase: 'browser' },
  { id: 'M06b', path: './modules/browser/m06b-ppc-landing-audit.js', phase: 'browser' },
  { id: 'M07', path: './modules/browser/m07-martech.js', phase: 'browser' },
  { id: 'M08', path: './modules/browser/m08-tag-governance.js', phase: 'browser' },
  { id: 'M13', path: './modules/browser/m13-perf-carbon.js', phase: 'browser' },
  { id: 'M14', path: './modules/browser/m14-mobile-responsive.js', phase: 'browser' },
  { id: 'M15', path: './modules/browser/m15-social-sharing.js', phase: 'browser' },
  { id: 'M20', path: './modules/browser/m20-ecommerce-saas.js', phase: 'browser' },
];

const GHOSTSCAN_MODULES: ModuleEntry[] = [
  { id: 'M09', path: './modules/ghostscan/m09-behavioral.js', phase: 'ghostscan' },
  { id: 'M10', path: './modules/ghostscan/m10-accessibility.js', phase: 'ghostscan' },
  { id: 'M11', path: './modules/ghostscan/m11-console-errors.js', phase: 'ghostscan' },
  { id: 'M12', path: './modules/ghostscan/m12-legal-compliance.js', phase: 'ghostscan' },
];

const EXTERNAL_MODULES: ModuleEntry[] = [
  { id: 'M21', path: './modules/external/m21-ad-library.js', phase: 'external' as const },
  { id: 'M22', path: './modules/external/m22-news-sentiment.js', phase: 'external' as const },
  { id: 'M23', path: './modules/external/m23-social-sentiment.js', phase: 'external' as const },
  { id: 'M24', path: './modules/external/m24-market-intelligence.js', phase: 'external' as const },
  { id: 'M25', path: './modules/external/m25-monthly-visits.js', phase: 'external' as const },
  { id: 'M26', path: './modules/external/m26-traffic-by-country.js', phase: 'external' as const },
  { id: 'M27', path: './modules/external/m27-rankings.js', phase: 'external' as const },
  { id: 'M28', path: './modules/external/m28-paid-traffic-cost.js', phase: 'external' as const },
  { id: 'M29', path: './modules/external/m29-top-paid-keywords.js', phase: 'external' as const },
  { id: 'M30', path: './modules/external/m30-competitor-overlap.js', phase: 'external' as const },
  { id: 'M31', path: './modules/external/m31-traffic-sources.js', phase: 'external' as const },
  { id: 'M32', path: './modules/external/m32-domain-trust.js', phase: 'external' as const },
  { id: 'M33', path: './modules/external/m33-mobile-desktop.js', phase: 'external' as const },
  { id: 'M34', path: './modules/external/m34-brand-demand.js', phase: 'external' as const },
  { id: 'M35', path: './modules/external/m35-losing-keywords.js', phase: 'external' as const },
  { id: 'M36', path: './modules/external/m36-bounce-rate.js', phase: 'external' as const },
  { id: 'M37', path: './modules/external/m37-google-shopping.js', phase: 'external' as const },
  { id: 'M38', path: './modules/external/m38-review-velocity.js', phase: 'external' as const },
  { id: 'M39', path: './modules/external/m39-local-pack.js', phase: 'external' as const },
];

const SYNTHESIS_MODULES: ModuleEntry[] = [
  { id: 'M41', path: './modules/synthesis/m41-module-synthesis.js', phase: 'synthesis' as const },
  { id: 'M42', path: './modules/synthesis/m42-final-synthesis.js', phase: 'synthesis' as const },
  { id: 'M43', path: './modules/synthesis/m43-prd-generation.js', phase: 'synthesis' as const },
  { id: 'M44', path: './modules/synthesis/m44-roi-simulator.js', phase: 'synthesis' as const },
  { id: 'M45', path: './modules/synthesis/m45-cost-cutter.js', phase: 'synthesis' as const },
  { id: 'M46', path: './modules/synthesis/m46-knowledge-base.js', phase: 'synthesis' as const },
];

const ALL_MODULES = [...PASSIVE_MODULES, ...BROWSER_MODULES, ...GHOSTSCAN_MODULES];

const MODULE_TIMEOUT_MS = 90_000;
const NAV_TIMEOUT_MS = 30_000;

// ━━━ TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ModuleOutcome {
  status: string;
  score: number | null;
  duration: number;
  error?: string;
  checkpointSummary: Record<string, number>;
  signalCount: number;
  keyFindings: Record<string, unknown>;
}

interface UrlOutcome {
  url: string;
  label: string;
  category: string;
  navigation: { success: boolean; blocked: boolean; error?: string };
  fetchOk: boolean;
  modules: Record<string, ModuleOutcome>;
  totalDuration: number;
}

// ━━━ UTILITIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseArgs(): { resume: number; limit: number; only: string[] | null; includeExternal: boolean; includeSynthesis: boolean; stabilityRuns: number; recordFixtures: boolean; replayFixtures: boolean } {
  const args = process.argv.slice(2);
  let resume = 0;
  let limit = TEST_URLS.length;
  let only: string[] | null = null;
  let includeExternal = false;
  let includeSynthesis = false;
  let stabilityRuns = 1;
  let recordFixtures = false;
  let replayFixtures = false;

  for (const arg of args) {
    if (arg.startsWith('--resume=')) resume = parseInt(arg.split('=')[1]!, 10);
    else if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1]!, 10);
    else if (arg.startsWith('--only=')) only = arg.split('=')[1]!.split(',');
    else if (arg === '--include-external') includeExternal = true;
    else if (arg === '--include-synthesis') includeSynthesis = true;
    else if (arg.startsWith('--stability-runs=')) stabilityRuns = Math.max(1, parseInt(arg.split('=')[1]!, 10));
    else if (arg === '--record-fixtures') recordFixtures = true;
    else if (arg === '--replay-fixtures') replayFixtures = true;
  }

  return { resume, limit, only, includeExternal, includeSynthesis, stabilityRuns, recordFixtures, replayFixtures };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getMemoryMb(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

function summarizeCheckpoints(checkpoints: Checkpoint[]): Record<string, number> {
  const s: Record<string, number> = { excellent: 0, good: 0, warning: 0, critical: 0, info: 0 };
  for (const cp of checkpoints) {
    s[cp.health] = (s[cp.health] ?? 0) + 1;
  }
  return s;
}

function extractKeyFindings(moduleId: string, data: Record<string, unknown>): Record<string, unknown> {
  const d = data as Record<string, any>;
  switch (moduleId) {
    case 'M01': return {
      dmarc: d.dmarc?.policy ?? d.dmarc?.record ? 'present' : 'missing',
      spf: d.spf?.record ? 'present' : 'missing',
      hsts: d.hsts ? 'present' : 'missing',
    };
    case 'M02': return {
      cms: d.cms?.name ?? null,
      cdn: d.cdn?.name ?? null,
      framework: d.framework?.name ?? null,
      server: d.server?.name ?? null,
      compression: d.compression ?? null,
    };
    case 'M05': return {
      tools: d.toolNames ?? d.tools?.map((t: any) => t.name) ?? [],
      consentPlatform: d.consent?.consentPlatform ?? null,
      consentMode: d.consent?.hasConsentMode ?? false,
    };
    case 'M07': return { tools: d.tools?.map((t: any) => t.name) ?? [] };
    case 'M11': return { errorTools: d.errorTools ?? [], jsErrors: Array.isArray(d.jsErrors) ? d.jsErrors.length : 0 };
    case 'M12': return {
      privacyPolicy: d.privacyPolicy?.found ?? null,
      consentBanner: d.consentBanner?.found ?? null,
      ccpa: d.ccpa?.found ?? null,
    };
    default: return {};
  }
}

function pad(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '\u2026' : str.padEnd(len);
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ━━━ CORE EXECUTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeModuleWithTimeout(
  mod: ModuleEntry,
  ctx: ModuleContext,
): Promise<ModuleResult> {
  const start = Date.now();

  try {
    const imported = await import(mod.path);
    const execute = imported.default ?? imported.execute;

    if (!execute) {
      return {
        moduleId: mod.id as ModuleId, status: 'error', data: {}, signals: [],
        score: null, checkpoints: [], duration: Date.now() - start,
        error: `Module ${mod.id} has no execute function`,
      };
    }

    const result = await Promise.race<ModuleResult>([
      execute(ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${MODULE_TIMEOUT_MS}ms`)), MODULE_TIMEOUT_MS)
      ),
    ]);

    result.moduleId = mod.id as ModuleId;
    result.duration = Date.now() - start;

    if (result.score === null && result.checkpoints.length > 0) {
      result.score = calculateModuleScore(result.checkpoints);
    }

    return result;
  } catch (err) {
    return {
      moduleId: mod.id as ModuleId, status: 'error', data: {}, signals: [],
      score: null, checkpoints: [], duration: Date.now() - start,
      error: (err as Error).message?.slice(0, 300),
    };
  }
}

/**
 * Human-like random delay before navigation.
 * Bot managers flag instant programmatic navigation — real users have
 * 500-2000ms of jitter from typing, tab switching, etc.
 */
function humanDelay(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 1500);
  return new Promise(r => setTimeout(r, ms));
}

/** Pick a realistic Google search referrer for organic-looking traffic */
function googleReferrer(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return `https://www.google.com/search?q=${encodeURIComponent(domain)}`;
  } catch {
    return 'https://www.google.com/';
  }
}

async function navigateRobustly(
  page: import('patchright').Page,
  url: string,
): Promise<{ success: boolean; blocked: boolean; provider?: string; error?: string }> {
  // Human-like delay before navigation — bots navigate instantly
  await humanDelay();

  const referer = googleReferrer(url);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS, referer });
  } catch (err) {
    const msg = (err as Error).message.toLowerCase();

    // Hard network failures — not recoverable (DNS, connection refused)
    // BUT: HTTP/2 protocol errors are often recoverable — content may have loaded
    const isHttp2Error = msg.includes('err_http2');
    if (!isHttp2Error && (msg.includes('net::err_') || msg.includes('dns') || msg.includes('refused'))) {
      return { success: false, blocked: false, error: (err as Error).message };
    }

    // HTTP/2 errors: retry with domcontentloaded (less strict, no network idle requirement)
    if (isHttp2Error) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS, referer });
        await page.waitForTimeout(5_000);
        return { success: true, blocked: false };
      } catch {
        // fall through to load-state fallback chain
      }
    }

    // Timeout — page is still loading (common for enterprise sites with persistent connections)
    try {
      await page.waitForLoadState('load', { timeout: 15_000 });
    } catch {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
      } catch {
        return { success: false, blocked: false, error: 'All load states timed out' };
      }
    }
    await page.waitForTimeout(5_000);
  }

  // Use the full bot-wall-detector with auto-wait and retry logic.
  // This handles Cloudflare Turnstile, Akamai, PerimeterX, DataDome, etc.
  // with provider-specific wait times and retry navigation strategies.
  try {
    const botResult = await detectAndHandleBotWall(page, url);
    if (botResult.blocked) {
      return { success: false, blocked: true, provider: botResult.provider ?? 'unknown', error: `Bot blocked (${botResult.provider ?? 'unknown'}): auto-resolve failed` };
    }
  } catch {
    return { success: false, blocked: false, error: 'Unable to read page content' };
  }

  return { success: true, blocked: false };
}

async function runUrl(testUrl: TestUrl, modulesToRun: ModuleEntry[]): Promise<UrlOutcome> {
  const domain = getDomain(testUrl.url);
  const urlStart = Date.now();

  const outcome: UrlOutcome = {
    url: testUrl.url, label: testUrl.label, category: testUrl.category,
    navigation: { success: false, blocked: false },
    fetchOk: false, modules: {}, totalDuration: 0,
  };

  const resultDir = join(HARNESS_DIR, domain);
  mkdirSync(resultDir, { recursive: true });

  // ── Step 1: HTTP fetch (passive modules need this) ────────────────────
  let html: string | null = null;
  let headers: Record<string, string> = {};

  try {
    log(`  Fetching ${testUrl.url}...`);
    const response = await fetchWithRetry(testUrl.url, { timeout: 15_000, retries: 2 });
    html = response.body;
    headers = response.headers;
    outcome.fetchOk = true;
    log(`  Fetch OK: ${html.length} bytes, ${Object.keys(headers).length} headers`);
  } catch (err) {
    log(`  Fetch FAILED: ${(err as Error).message}`);
  }

  // ── Step 2: Base context ──────────────────────────────────────────────
  const ctx: ModuleContext = {
    url: testUrl.url,
    scanId: `harness-${domain}-${Date.now()}`,
    tier: 'full',
    html, headers,
    page: null, networkCollector: null,
    consoleCollector: null, storageSnapshot: null,
    frameSnapshot: null, domForensics: null, inlineConfigs: null,
    cookieAnalysis: null, formSnapshot: null, contentAnalysis: null,
    imageAudit: null, linkAnalysis: null, navigatorSnapshot: null,
    redirectChain: [], finalUrl: testUrl.url, browserRedirectChains: [],
    mixedContent: null, cruxData: null, mobileMetrics: null,
    previousResults: new Map(),
  };

  // ── Step 3: Passive modules (parallel) ────────────────────────────────
  const passiveList = modulesToRun.filter(m => m.phase === 'passive');
  if (passiveList.length > 0) {
    log(`  Running ${passiveList.length} passive modules...`);
    const settled = await Promise.allSettled(
      passiveList.map(async (mod) => {
        const result = await executeModuleWithTimeout(mod, ctx);
        writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(result, null, 2));
        ctx.previousResults.set(mod.id as ModuleId, result);
        return { id: mod.id, result };
      })
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { id, result } = s.value;
        outcome.modules[id] = {
          status: result.status, score: result.score, duration: result.duration,
          error: result.error,
          checkpointSummary: summarizeCheckpoints(result.checkpoints),
          signalCount: result.signals.length,
          keyFindings: extractKeyFindings(id, result.data as Record<string, unknown>),
        };
        const icon = result.status === 'success' ? '\u2713' : '\u2717';
        log(`    ${icon} ${id}: ${result.status} (score=${result.score ?? 'null'}, ${result.duration}ms)`);
      }
    }
  }

  // ── Step 4: Browser + GhostScan modules ───────────────────────────────
  const browserList = modulesToRun.filter(m => m.phase === 'browser');
  const ghostList = modulesToRun.filter(m => m.phase === 'ghostscan');

  if (browserList.length > 0 || ghostList.length > 0) {
    const pool = new BrowserPool();

    try {
      log(`  Launching browser (stealth mode)...`);
      let page = await pool.createPage(testUrl.url);

      const registrableDomain = getRegistrableDomain(testUrl.url);
      let collector = new NetworkCollector(registrableDomain);
      collector.attach(page);

      log(`  Navigating to ${testUrl.url}...`);
      let navResult = await navigateRobustly(page, testUrl.url);
      outcome.navigation = navResult;

      // ── Context rotation retry for bot blocks ──────────────────────
      // If bot-blocked on first attempt, close context and retry with a
      // fresh stealth profile. PerimeterX/DataDome blocks are stochastic —
      // a new fingerprint + fresh cookies + random delay often passes.
      if (!navResult.success && navResult.blocked) {
        log(`  Bot blocked (${navResult.provider ?? 'unknown'}), rotating context for retry...`);

        // Close current context — browser will be relaunched
        try { await pool.close(); } catch { /* swallow */ }

        // Random backoff 3-8s to avoid rate-limit patterns
        const backoffMs = 3000 + Math.floor(Math.random() * 5000);
        log(`  Waiting ${backoffMs}ms before retry...`);
        await new Promise(r => setTimeout(r, backoffMs));

        // Fresh page with new stealth profile
        const retryPage = await pool.createPage(testUrl.url);
        const retryRegistrableDomain = getRegistrableDomain(testUrl.url);
        const retryCollector = new NetworkCollector(retryRegistrableDomain);
        retryCollector.attach(retryPage);

        // Warm-up: two-stage approach for bot protection bypass:
        //
        // Stage 1: Visit the target's robots.txt — this is a static resource
        // that most bot managers don't protect, but it DOES establish session
        // cookies on the target domain. DataDome, Akamai, and PerimeterX all
        // track session continuity — a request with existing cookies gets a
        // lower risk score than a cold first visit.
        //
        // Stage 2: Visit Google search to establish browsing context.
        // Bot managers track navigation history — a browser that has visited
        // other sites first looks more organic than a fresh browser going
        // straight to the target.
        try {
          const origin = new URL(testUrl.url).origin;
          log(`  Warm-up stage 1: visiting ${origin}/robots.txt to establish session cookies...`);
          await retryPage.goto(`${origin}/robots.txt`, {
            waitUntil: 'domcontentloaded',
            timeout: 8_000,
          });
          await retryPage.waitForTimeout(500 + Math.floor(Math.random() * 500));
        } catch {
          // robots.txt warmup failed — not critical
        }

        try {
          log(`  Warm-up stage 2: visiting Google to establish browsing context...`);
          await retryPage.goto('https://www.google.com/search?q=' + encodeURIComponent(new URL(testUrl.url).hostname.replace(/^www\./, '')), {
            waitUntil: 'domcontentloaded',
            timeout: 10_000,
          });
          await retryPage.waitForTimeout(1500 + Math.floor(Math.random() * 1500));
        } catch {
          // Google warmup failed — not critical
        }

        log(`  Retry navigation to ${testUrl.url} (fresh profile + warm-up)...`);
        const retryNav = await navigateRobustly(retryPage, testUrl.url);

        if (retryNav.success) {
          log(`  Retry navigation SUCCEEDED! Continuing with modules...`);
          navResult = retryNav;
          outcome.navigation = retryNav;
          // Replace page + collector for the rest of this URL's run
          page = retryPage;
          collector = retryCollector;
        } else {
          // Still blocked after retry — update navResult for the failure path
          navResult = retryNav;
          outcome.navigation = retryNav;
          log(`  Retry ALSO FAILED: ${retryNav.error ?? 'Bot blocked again'}`);
        }
      }

      if (!navResult.success) {
        log(`  Navigation FAILED: ${navResult.error ?? (navResult.blocked ? 'Bot blocked' : 'Unknown')}`);

        // Mark all browser/ghostscan modules as failed
        for (const mod of [...browserList, ...ghostList]) {
          const errMsg = navResult.blocked
            ? `Bot blocked: ${navResult.error}`
            : `Navigation failed: ${navResult.error}`;
          const errResult: ModuleResult = {
            moduleId: mod.id as ModuleId, status: 'error', data: {}, signals: [],
            score: null, checkpoints: [], duration: 0, error: errMsg,
          };
          writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(errResult, null, 2));
          outcome.modules[mod.id] = {
            status: 'error', score: null, duration: 0, error: errMsg,
            checkpointSummary: {}, signalCount: 0, keyFindings: {},
          };
        }
      } else {
        log(`  Navigation OK: ${collector.getAllRequests().length} network requests`);
        ctx.page = page;
        ctx.networkCollector = collector;

        // Browser modules — sequential (shared page state)
        for (const mod of browserList) {
          const result = await executeModuleWithTimeout(mod, ctx);
          writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(result, null, 2));
          ctx.previousResults.set(mod.id as ModuleId, result);
          outcome.modules[mod.id] = {
            status: result.status, score: result.score, duration: result.duration,
            error: result.error,
            checkpointSummary: summarizeCheckpoints(result.checkpoints),
            signalCount: result.signals.length,
            keyFindings: extractKeyFindings(mod.id, result.data as Record<string, unknown>),
          };
          const icon = result.status === 'success' ? '\u2713' : '\u2717';
          log(`    ${icon} ${mod.id}: ${result.status} (score=${result.score ?? 'null'}, ${result.duration}ms)`);
        }

        // Passive retry — re-run failed/incomplete passive modules with browser HTML
        const hadInitialHtml = ctx.html != null && ctx.html.length > 500;
        const failedPassive = passiveList.filter(m => {
          const mod = outcome.modules[m.id];
          // Always retry modules that errored
          if (mod?.status === 'error') return true;
          // If initial fetch had no usable HTML, retry HTML-dependent modules
          // (M01 is DNS-only — no benefit from HTML retry)
          if (!hadInitialHtml && m.id !== 'M01') return true;
          return false;
        });
        if (failedPassive.length > 0 && page) {
          const browserHtml = await page.content();
          if (browserHtml && browserHtml.length > 500) {
            ctx.html = browserHtml;
            // Also capture response headers from the document request if initial fetch had none
            if (!hadInitialHtml && collector) {
              const docResponses = collector.getAllResponses()
                .filter(r => r.status >= 200 && r.status < 400)
                .sort((a, b) => a.timestamp - b.timestamp);
              // Find the document response (first successful HTML response matching the scan URL's domain)
              const scanHost = new URL(testUrl.url).hostname;
              const docResponse = docResponses.find(r => {
                try { return new URL(r.url).hostname.endsWith(scanHost.replace(/^www\./, '')); } catch { return false; }
              });
              if (docResponse?.headers && Object.keys(docResponse.headers).length > 0) {
                ctx.headers = docResponse.headers;
                log(`  Captured ${Object.keys(docResponse.headers).length} response headers from browser navigation`);
              }
            }
            log(`  Retrying ${failedPassive.length} failed passive modules with browser HTML (${browserHtml.length} bytes)...`);
            for (const mod of failedPassive) {
              const result = await executeModuleWithTimeout(mod, ctx);
              writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(result, null, 2));
              ctx.previousResults.set(mod.id as ModuleId, result);
              outcome.modules[mod.id] = {
                status: result.status, score: result.score, duration: result.duration,
                error: result.error,
                checkpointSummary: summarizeCheckpoints(result.checkpoints),
                signalCount: result.signals.length,
                keyFindings: extractKeyFindings(mod.id, result.data as Record<string, unknown>),
              };
              const icon = result.status === 'success' ? '\u2713' : '\u2717';
              log(`    ${icon} ${mod.id} (retry): ${result.status} (score=${result.score ?? 'null'}, ${result.duration}ms)`);
            }
          }
        }

        // GhostScan modules — sequential (same page)
        // Guard: check page is still alive before each module to avoid cascading failures
        for (const mod of ghostList) {
          let pageAlive = true;
          try { await page.evaluate(() => document.readyState); } catch { pageAlive = false; }
          if (!pageAlive) {
            const errResult: ModuleResult = {
              moduleId: mod.id as ModuleId, status: 'error', data: {}, signals: [],
              score: null, checkpoints: [], duration: 0, error: 'Page closed before ghostscan module could run',
            };
            writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(errResult, null, 2));
            outcome.modules[mod.id] = {
              status: 'error', score: null, duration: 0, error: errResult.error!,
              checkpointSummary: {}, signalCount: 0, keyFindings: {},
            };
            log(`    \u2717 ${mod.id}: error (page closed)`);
            continue;
          }

          const result = await executeModuleWithTimeout(mod, ctx);
          writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(result, null, 2));
          ctx.previousResults.set(mod.id as ModuleId, result);
          outcome.modules[mod.id] = {
            status: result.status, score: result.score, duration: result.duration,
            error: result.error,
            checkpointSummary: summarizeCheckpoints(result.checkpoints),
            signalCount: result.signals.length,
            keyFindings: extractKeyFindings(mod.id, result.data as Record<string, unknown>),
          };
          const icon = result.status === 'success' ? '\u2713' : '\u2717';
          log(`    ${icon} ${mod.id}: ${result.status} (score=${result.score ?? 'null'}, ${result.duration}ms)`);
        }
      }
    } catch (err) {
      log(`  Browser phase ERROR: ${(err as Error).message}`);

      for (const mod of [...browserList, ...ghostList]) {
        if (!outcome.modules[mod.id]) {
          outcome.modules[mod.id] = {
            status: 'error', score: null, duration: 0,
            error: `Browser phase: ${(err as Error).message}`,
            checkpointSummary: {}, signalCount: 0, keyFindings: {},
          };
        }
      }
    } finally {
      try { await pool.close(); } catch { /* swallow */ }
      ctx.page = null;
      ctx.networkCollector = null;
    }
  }

  // ── Step 5: External modules (parallel) ─────────────────────────────
  const externalList = modulesToRun.filter(m => m.phase === 'external');
  if (externalList.length > 0) {
    log(`  Running ${externalList.length} external modules...`);
    const settled = await Promise.allSettled(
      externalList.map(async (mod) => {
        const result = await executeModuleWithTimeout(mod, ctx);
        writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(result, null, 2));
        ctx.previousResults.set(mod.id as ModuleId, result);
        return { id: mod.id, result };
      })
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { id, result } = s.value;
        outcome.modules[id] = {
          status: result.status, score: result.score, duration: result.duration,
          error: result.error,
          checkpointSummary: summarizeCheckpoints(result.checkpoints),
          signalCount: result.signals.length,
          keyFindings: extractKeyFindings(id, result.data as Record<string, unknown>),
        };
        const icon = result.status === 'success' ? '\u2713' : '\u2717';
        log(`    ${icon} ${id}: ${result.status} (score=${result.score ?? 'null'}, ${result.duration}ms)`);
      }
    }
  }

  // ── Step 6: Synthesis modules (sequential chain) ────────────────────
  const synthesisList = modulesToRun.filter(m => m.phase === 'synthesis');
  if (synthesisList.length > 0) {
    // M41 first, then M42-M46 sequentially
    const m41 = synthesisList.find(m => m.id === 'M41');
    const rest = synthesisList.filter(m => m.id !== 'M41').sort((a, b) => a.id.localeCompare(b.id));

    log(`  Running ${synthesisList.length} synthesis modules...`);
    const ordered = m41 ? [m41, ...rest] : rest;

    for (const mod of ordered) {
      const result = await executeModuleWithTimeout(mod, ctx);
      writeFileSync(join(resultDir, `${mod.id}.json`), JSON.stringify(result, null, 2));
      ctx.previousResults.set(mod.id as ModuleId, result);
      outcome.modules[mod.id] = {
        status: result.status, score: result.score, duration: result.duration,
        error: result.error,
        checkpointSummary: summarizeCheckpoints(result.checkpoints),
        signalCount: result.signals.length,
        keyFindings: extractKeyFindings(mod.id, result.data as Record<string, unknown>),
      };
      const icon = result.status === 'success' ? '\u2713' : '\u2717';
      log(`    ${icon} ${mod.id}: ${result.status} (score=${result.score ?? 'null'}, ${result.duration}ms)`);
    }
  }

  outcome.totalDuration = Date.now() - urlStart;
  return outcome;
}

// ━━━ ANALYSIS & OUTPUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateSummary(outcomes: UrlOutcome[], moduleList: ModuleEntry[] = ALL_MODULES): Record<string, unknown> {
  let totalSuccess = 0;
  let totalErrors = 0;

  const urls: Record<string, UrlOutcome> = {};
  for (const o of outcomes) {
    urls[getDomain(o.url)] = o;
    for (const m of Object.values(o.modules)) {
      if (m.status === 'success' || m.status === 'partial') totalSuccess++;
      else if (m.status === 'error') totalErrors++;
    }
  }

  // Per-module stats across all URLs
  const moduleStats: Record<string, Record<string, unknown>> = {};
  for (const mod of moduleList) {
    const scores: Array<{ score: number; domain: string }> = [];
    const errors: string[] = [];

    for (const o of outcomes) {
      const domain = getDomain(o.url);
      const m = o.modules[mod.id];
      if (!m) continue;
      if (m.status === 'error') errors.push(domain);
      if (m.score !== null) scores.push({ score: m.score, domain });
    }

    const sorted = scores.sort((a, b) => a.score - b.score);
    moduleStats[mod.id] = {
      avgScore: scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length) : 0,
      minScore: sorted[0]?.score ?? 0,
      maxScore: sorted[sorted.length - 1]?.score ?? 0,
      minUrl: sorted[0]?.domain ?? '',
      maxUrl: sorted[sorted.length - 1]?.domain ?? '',
      errorCount: errors.length,
      errorUrls: errors,
    };
  }

  return {
    meta: {
      startedAt: new Date().toISOString(),
      urlCount: outcomes.length,
      moduleCount: moduleList.length,
      totalExecutions: outcomes.reduce((s, o) => s + Object.keys(o.modules).length, 0),
      successCount: totalSuccess,
      errorCount: totalErrors,
      totalDurationMs: outcomes.reduce((s, o) => s + o.totalDuration, 0),
    },
    urls,
    moduleStats,
  };
}

function printMatrix(outcomes: UrlOutcome[], moduleList: ModuleEntry[] = ALL_MODULES): void {
  const ids = moduleList.map(m => m.id);

  console.log('\n' + '='.repeat(130));
  console.log('  REGRESSION TEST MATRIX');
  console.log('='.repeat(130));

  // Header
  let header = pad('URL', 22);
  for (const id of ids) header += pad(id, 6);
  console.log(header);
  console.log('-'.repeat(130));

  // Rows
  for (const o of outcomes) {
    let row = pad(getDomain(o.url), 22);
    for (const id of ids) {
      const m = o.modules[id];
      if (!m) row += pad('--', 6);
      else if (m.status === 'error') row += pad('ERR', 6);
      else if (m.score !== null) row += pad(String(m.score), 6);
      else row += pad('n/a', 6);
    }
    console.log(row);
  }

  console.log('-'.repeat(130));

  // Averages
  let avgRow = pad('AVG', 22);
  for (const id of ids) {
    const scores = outcomes.map(o => o.modules[id]?.score).filter((s): s is number => s != null);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    avgRow += pad(String(avg), 6);
  }
  console.log(avgRow);

  // Errors
  let errRow = pad('ERRORS', 22);
  for (const id of ids) {
    const n = outcomes.filter(o => o.modules[id]?.status === 'error').length;
    errRow += pad(n > 0 ? String(n) : '.', 6);
  }
  console.log(errRow);
  console.log('='.repeat(130));
}

function printAnomalies(outcomes: UrlOutcome[], moduleList: ModuleEntry[] = ALL_MODULES): void {
  console.log('\n' + '='.repeat(80));
  console.log('  ANOMALIES & POTENTIAL GAPS');
  console.log('='.repeat(80));

  let count = 0;

  // Navigation failures
  for (const o of outcomes) {
    if (!o.navigation.success && (o.modules['M03'] !== undefined)) {
      count++;
      const d = getDomain(o.url);
      console.log(`  [NAV]   ${pad(d, 22)} ${o.navigation.blocked ? 'BOT BLOCKED' : o.navigation.error?.slice(0, 80)}`);
    }
  }

  // Module errors
  for (const o of outcomes) {
    const d = getDomain(o.url);
    for (const [id, m] of Object.entries(o.modules)) {
      if (m.status === 'error' && !o.navigation.error) {
        count++;
        console.log(`  [ERROR] ${pad(id, 5)} on ${pad(d, 18)} ${m.error?.slice(0, 60)}`);
      }
    }
  }

  // Very low scores (< 35)
  for (const o of outcomes) {
    const d = getDomain(o.url);
    for (const [id, m] of Object.entries(o.modules)) {
      if (m.score !== null && m.score < 35) {
        count++;
        console.log(`  [LOW]   ${pad(id, 5)} on ${pad(d, 18)} score=${m.score}`);
      }
    }
  }

  // Many critical checkpoints (> 2)
  for (const o of outcomes) {
    const d = getDomain(o.url);
    for (const [id, m] of Object.entries(o.modules)) {
      if ((m.checkpointSummary.critical ?? 0) > 2) {
        count++;
        console.log(`  [CRIT]  ${pad(id, 5)} on ${pad(d, 18)} ${m.checkpointSummary.critical} critical checkpoints`);
      }
    }
  }

  // Modules consistently scoring 0 across all URLs (likely broken)
  for (const mod of moduleList) {
    const scores = outcomes
      .map(o => o.modules[mod.id]?.score)
      .filter((s): s is number => s != null);
    if (scores.length >= 3 && scores.every(s => s === 0)) {
      count++;
      console.log(`  [ZERO]  ${pad(mod.id, 5)} scores 0 on all ${scores.length} URLs — likely broken`);
    }
  }

  // Duration > 2x average across all URLs (performance regression)
  for (const mod of moduleList) {
    const durations = outcomes
      .map(o => o.modules[mod.id]?.duration)
      .filter((d): d is number => d != null && d > 0);
    if (durations.length < 2) continue;
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    for (const o of outcomes) {
      const m = o.modules[mod.id];
      if (m && m.duration > avg * 2 && m.duration > 5000) {
        count++;
        const d = getDomain(o.url);
        console.log(`  [SLOW]  ${pad(mod.id, 5)} on ${pad(d, 18)} ${m.duration}ms (avg=${Math.round(avg)}ms, 2x+ regression)`);
      }
    }
  }

  // M05 finding zero analytics on commercial sites (should be near-universal)
  const commercialCategories = ['Finance', 'Healthcare', 'Ecommerce', 'Retail', 'Enterprise', 'Media', 'CMS'];
  for (const o of outcomes) {
    const isCommercial = commercialCategories.some(cat => o.category.includes(cat));
    if (!isCommercial) continue;
    const m05 = o.modules['M05'];
    if (!m05) continue;
    const findings = m05.keyFindings as Record<string, unknown>;
    const tools = findings.tools as unknown[] | undefined;
    if (tools && tools.length === 0) {
      count++;
      const d = getDomain(o.url);
      console.log(`  [ANOM]  M05   on ${pad(d, 18)} zero analytics detected on commercial site`);
    }
  }

  if (count === 0) console.log('  No anomalies detected.');
  console.log('='.repeat(80));
}

// ━━━ MAIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main(): Promise<void> {
  const { resume, limit, only, includeExternal, includeSynthesis, stabilityRuns, recordFixtures, replayFixtures } = parseArgs();

  let allModules = [...PASSIVE_MODULES, ...BROWSER_MODULES, ...GHOSTSCAN_MODULES];
  if (includeExternal) allModules = [...allModules, ...EXTERNAL_MODULES];
  if (includeSynthesis) allModules = [...allModules, ...SYNTHESIS_MODULES];

  let modulesToRun = allModules;
  if (only) {
    modulesToRun = allModules.filter(m => only.includes(m.id));
    log(`Module filter: ${modulesToRun.map(m => m.id).join(', ')}`);
  }

  const urls = TEST_URLS.slice(resume, resume + limit);

  const phases = ['passive', 'browser', 'ghostscan'];
  if (includeExternal) phases.push('external');
  if (includeSynthesis) phases.push('synthesis');

  console.log('');
  console.log('+--------------------------------------------------------------+');
  console.log('|       MarketingAlphaScan - Regression Test Harness           |');
  console.log('+--------------------------------------------------------------+');
  console.log(`|  URLs:    ${String(urls.length).padStart(3)} / ${TEST_URLS.length}                                        |`);
  console.log(`|  Modules: ${String(modulesToRun.length).padStart(3)} / ${allModules.length}                                        |`);
  console.log(`|  Phases:  ${phases.join(', ').padEnd(40)}|`);
  console.log(`|  Total:   ${String(urls.length * modulesToRun.length * stabilityRuns).padStart(5)} module executions                         |`);
  console.log(`|  Resume:  ${resume > 0 ? `from #${resume}` : 'fresh start'}${' '.repeat(Math.max(0, 40 - (resume > 0 ? `from #${resume}` : 'fresh start').length))}|`);
  if (stabilityRuns > 1) {
    console.log(`|  Stability: ${stabilityRuns} runs per URL                                  |`);
  }
  if (recordFixtures) {
    console.log(`|  Fixtures:  RECORDING (saving API responses)                 |`);
  } else if (replayFixtures) {
    console.log(`|  Fixtures:  REPLAYING (no API keys needed)                   |`);
  }
  console.log('+--------------------------------------------------------------+');
  console.log('');

  mkdirSync(HARNESS_DIR, { recursive: true });

  const outcomes: UrlOutcome[] = [];
  let interrupted = false;

  // Graceful shutdown — save partial results on Ctrl+C
  const shutdown = () => {
    if (interrupted) return;
    interrupted = true;
    log('SIGINT — saving partial results...');
    if (outcomes.length > 0) {
      const summary = generateSummary(outcomes, modulesToRun);
      writeFileSync(join(HARNESS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
      printMatrix(outcomes, modulesToRun);
      log(`Partial results saved for ${outcomes.length}/${urls.length} URLs`);
    }
    process.exit(1);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ── Execute each URL ──────────────────────────────────────────────────
  for (let i = 0; i < urls.length; i++) {
    if (interrupted) break;

    const testUrl = urls[i]!;
    const domain = getDomain(testUrl.url);

    console.log('');
    log(`=== [${i + 1}/${urls.length}] ${testUrl.label} (${domain}) - ${testUrl.category} ===`);
    log(`  Memory: ${getMemoryMb()}MB`);

    // Install fixture recorder/replayer for this domain
    let fixtureCleanup: (() => void) | null = null;
    if (recordFixtures) {
      const recorder = installRecorder(domain);
      fixtureCleanup = () => {
        recorder.restore();
        if (recorder.fixtureCount > 0) {
          log(`  Recorded ${recorder.fixtureCount} API fixtures for ${domain}`);
        }
      };
    } else if (replayFixtures) {
      const replayer = installReplayer(domain);
      fixtureCleanup = () => {
        replayer.restore();
        log(`  Fixtures: ${replayer.stats.hits} hits, ${replayer.stats.misses} misses, ${replayer.stats.passthrough} passthrough`);
      };
    }

    try {
      const outcome = await runUrl(testUrl, modulesToRun);
      outcomes.push(outcome);

      // Save incrementally after each URL
      writeFileSync(
        join(HARNESS_DIR, 'summary.json'),
        JSON.stringify(generateSummary(outcomes, modulesToRun), null, 2),
      );

      const ok = Object.values(outcome.modules).filter(m => m.status === 'success').length;
      const err = Object.values(outcome.modules).filter(m => m.status === 'error').length;
      log(`  Done: ${ok} success, ${err} errors, ${Math.round(outcome.totalDuration / 1000)}s`);
    } catch (err) {
      log(`  URL-level ERROR: ${(err as Error).message}`);
      outcomes.push({
        url: testUrl.url, label: testUrl.label, category: testUrl.category,
        navigation: { success: false, blocked: false, error: (err as Error).message },
        fetchOk: false, modules: {}, totalDuration: 0,
      });
    } finally {
      fixtureCleanup?.();
    }
  }

  // ── Stability analysis (multi-run variance detection) ─────────────────
  if (stabilityRuns > 1) {
    console.log('');
    log(`=== STABILITY TEST: ${stabilityRuns} additional runs per URL ===`);

    // scoresByUrlModule[domain][moduleId] = number[]
    const scoresByUrlModule: Record<string, Record<string, number[]>> = {};

    // Collect scores from the first run
    for (const o of outcomes) {
      const domain = getDomain(o.url);
      scoresByUrlModule[domain] = {};
      for (const [id, m] of Object.entries(o.modules)) {
        if (m.score != null) {
          scoresByUrlModule[domain]![id] = [m.score];
        }
      }
    }

    // Run additional passes (stabilityRuns - 1 more times since we already ran once)
    for (let run = 2; run <= stabilityRuns; run++) {
      log(`--- Stability run ${run}/${stabilityRuns} ---`);
      for (let i = 0; i < urls.length; i++) {
        if (interrupted) break;
        const testUrl = urls[i]!;
        const domain = getDomain(testUrl.url);
        log(`  [${run}x] ${testUrl.label} (${domain})`);

        try {
          const outcome = await runUrl(testUrl, modulesToRun);
          for (const [id, m] of Object.entries(outcome.modules)) {
            if (m.score != null) {
              if (!scoresByUrlModule[domain]![id]) scoresByUrlModule[domain]![id] = [];
              scoresByUrlModule[domain]![id]!.push(m.score);
            }
          }
        } catch (err) {
          log(`  [${run}x] ERROR: ${(err as Error).message}`);
        }
      }
    }

    // Compute and report variance
    console.log('\n' + '='.repeat(80));
    console.log('  STABILITY REPORT (stddev > 5 points flagged)');
    console.log('='.repeat(80));

    let unstableCount = 0;
    for (const [domain, modules] of Object.entries(scoresByUrlModule)) {
      for (const [modId, scores] of Object.entries(modules)) {
        if (scores.length < 2) continue;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
        const stddev = Math.sqrt(variance);
        if (stddev > 5) {
          unstableCount++;
          console.log(`  [UNSTABLE] ${pad(modId, 5)} on ${pad(domain, 18)} stddev=${stddev.toFixed(1)} scores=[${scores.join(',')}]`);
        }
      }
    }

    if (unstableCount === 0) {
      console.log('  All modules stable (stddev <= 5 points).');
    } else {
      console.log(`  ${unstableCount} unstable module/URL combinations detected.`);
    }
    console.log('='.repeat(80));
  }

  // ── Final output ──────────────────────────────────────────────────────
  const summary = generateSummary(outcomes, modulesToRun);
  writeFileSync(join(HARNESS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  printMatrix(outcomes, modulesToRun);
  printAnomalies(outcomes, modulesToRun);

  const meta = summary.meta as Record<string, unknown>;
  console.log('');
  log(`Complete: ${meta.successCount} successes, ${meta.errorCount} errors across ${meta.urlCount} URLs`);
  log(`Total duration: ${Math.round((meta.totalDurationMs as number) / 1000)}s`);
  log(`Results saved to: ${HARNESS_DIR}`);
  log(`Memory: ${getMemoryMb()}MB`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
