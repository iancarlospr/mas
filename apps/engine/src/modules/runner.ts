import type { ModuleDefinition, ModuleId, ModuleResult, ModuleTier, ScanStatus } from '@marketing-alpha/types';
import type { ModuleContext, ModuleExecuteFn } from './types.js';
import type { Page } from 'patchright';
import { getModulesForPhaseAndTier } from './registry.js';
import { NetworkCollector } from '../utils/network.js';
import { ConsoleCollector } from '../utils/console-collector.js';
import { StorageCollector } from '../utils/storage-collector.js';
import { FrameCollector } from '../utils/frame-collector.js';
import { CookieAnalyzer } from '../utils/cookie-analyzer.js';
import { FormCollector } from '../utils/form-collector.js';
import { ImageAuditor } from '../utils/image-auditor.js';
import { LinkAnalyzer } from '../utils/link-analyzer.js';
import { analyzeContent } from '../utils/content-analyzer.js';
import { BrowserPool } from '../ghostscan/browser-pool.js';
import { detectAndHandleBotWall } from '../ghostscan/bot-wall-detector.js';
import { detectMixedContent } from '../utils/mixed-content-detector.js';
import { fetchWithRetry } from '../utils/http.js';
import { getRegistrableDomain } from '../utils/url.js';
import { assertUrlSafe } from '../utils/url-safety.js';
import { updateScanStatus, upsertModuleResult } from '../services/supabase.js';
import { extractDetectedTools } from '../utils/tool-extractor.js';
import { discoverPathsFromSitemap } from '../utils/sitemap.js';
import { fetchRenderedContent, isAvailable as cfRenderAvailable } from '../services/cloudflare-render.js';
import type { DOMForensics, NavigatorSnapshot } from './types.js';
import pino from 'pino';

const logger = pino({ name: 'module-runner' });

// ── Constants ──────────────────────────────────────────────────────────────
const CRUX_TIMEOUT = 20_000;
const MOBILE_NAV_TIMEOUT = 25_000;
const CWV_STABILIZATION_DELAY = 2_000;

/**
 * Modules available on the free tier. Only MarTech & Infrastructure.
 * All other modules require a paid tier.
 */
const FREE_TIER_MODULES: ReadonlySet<string> = new Set(['M02', 'M07', 'M20']);

/**
 * Placeholder module execute function for modules not yet implemented.
 * Returns a skipped result so the scan can proceed.
 */
const placeholderExecute: ModuleExecuteFn = async (ctx: ModuleContext): Promise<ModuleResult> => {
  return {
    moduleId: 'M01' as ModuleId, // overridden at call site
    status: 'skipped',
    data: { reason: 'Module not yet implemented' },
    signals: [],
    score: null,
    checkpoints: [],
    duration: 0,
  };
};

/**
 * Module execute function map.
 * As modules are implemented, they register their execute function here.
 * Unimplemented modules use the placeholder that returns "skipped".
 */
const MODULE_EXECUTORS = new Map<ModuleId, ModuleExecuteFn>();

/**
 * Register a module's execute function.
 */
export function registerModuleExecutor(moduleId: ModuleId, fn: ModuleExecuteFn): void {
  MODULE_EXECUTORS.set(moduleId, fn);
}

/**
 * Get the execute function for a module, or the placeholder if not registered.
 */
function getExecutor(moduleId: ModuleId): ModuleExecuteFn {
  return MODULE_EXECUTORS.get(moduleId) ?? placeholderExecute;
}

/**
 * Phase configuration mapping tiers to which phases they run.
 */
const TIER_PHASES: Record<ModuleTier, ScanStatus[]> = {
  full: ['passive', 'browser'],
  paid: ['passive', 'browser', 'ghostscan', 'external', 'paid-media', 'synthesis'],
};

/**
 * ModuleRunner orchestrates the execution of all scan modules across phases.
 *
 * Phase execution order:
 *   1. Passive    - HTTP fetch + DNS, run modules in parallel
 *   2. Browser    - Playwright page, NetworkCollector, run modules sequentially
 *   3. GhostScan  - Continue on same page, run modules sequentially
 *   4. External   - Third-party API calls, run modules in parallel
 *   4.5 Paid Media - M06/M06b on dedicated browser page targeting M21 CTA URL
 *   5. Synthesis  - M41 parallel, then M42-M45 sequential
 *
 * Each module is:
 *   - Wrapped in a timeout via Promise.race
 *   - Retried per its retry configuration with exponential backoff
 *   - Result upserted to Supabase immediately after completion
 *   - Failures never cascade to other modules
 */
export class ModuleRunner {
  private context: ModuleContext;
  private browserPool: BrowserPool;
  private tier: ModuleTier;

  constructor(
    scanId: string,
    url: string,
    tier: ModuleTier,
  ) {
    this.tier = tier;
    this.browserPool = new BrowserPool();
    this.context = {
      url,
      scanId,
      tier,
      html: null,
      headers: {},
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
      redirectChain: [],
      finalUrl: url,
      browserRedirectChains: [],
      mixedContent: null,
      cruxData: null,
      mobileMetrics: null,
      previousResults: new Map(),
    };
  }

  /**
   * Build a realistic Google Search referrer from the scan URL's hostname.
   * Extracted as a shared helper to avoid duplicating the referer construction
   * across browser, ghostscan, and mobile phases.
   */
  /**
   * Filter modules for free tier — only allow FREE_TIER_MODULES.
   * Paid tier gets all modules unfiltered.
   */
  private filterForTier(modules: ModuleDefinition[]): ModuleDefinition[] {
    if (this.tier !== 'full') return modules;
    return modules.filter((m) => FREE_TIER_MODULES.has(m.id));
  }

  private getGoogleReferer(): string {
    return `https://www.google.com/search?q=${encodeURIComponent(
      new URL(this.context.url).hostname.replace(/^www\./, ''),
    )}`;
  }

  /**
   * Run all applicable phases for the scan's tier.
   */
  async run(): Promise<{
    results: Map<ModuleId, ModuleResult>;
    modulesCompleted: number;
    modulesFailed: number;
  }> {
    const phases = TIER_PHASES[this.tier];
    let modulesCompleted = 0;
    let modulesFailed = 0;

    logger.info(
      { scanId: this.context.scanId, tier: this.tier, phases },
      'Starting module runner',
    );

    try {
      // Initial fetch + CrUX in parallel, then sitemap (needs ctx.html for fallback)
      await Promise.all([
        this.performInitialFetch(),
        this.fetchCruxData(),
      ]);
      await this.fetchSitemapAndCategorize();

      for (const phase of phases) {
        logger.info(
          { scanId: this.context.scanId, phase },
          'Starting phase',
        );

        // Update scan status for phase transition
        await updateScanStatus(this.context.scanId, phase as ScanStatus);

        switch (phase) {
          case 'passive':
            await this.runPassivePhase();
            break;
          case 'browser':
            await this.runBrowserPhase();
            if (this.tier !== 'full') await this.runMobilePass();
            break;
          case 'ghostscan':
            await this.runGhostScanPhase();
            break;
          case 'external':
            await this.runExternalPhase();
            break;
          case 'paid-media':
            await this.runPaidMediaPhase();
            break;
          case 'synthesis':
            // Cooldown before synthesis — let Gemini rate limit window reset
            // after M22/M23 Flash calls in external phase
            await sleep(3_000);
            await this.runSynthesisPhase();
            break;
        }

        logger.info(
          { scanId: this.context.scanId, phase, resultCount: this.context.previousResults.size },
          'Phase completed',
        );
      }
    } finally {
      // Clean up browser resources
      await this.cleanup();
    }

    // Count successes and failures
    for (const result of this.context.previousResults.values()) {
      if (result.status === 'success' || result.status === 'partial') {
        modulesCompleted++;
      } else if (result.status === 'error') {
        modulesFailed++;
      }
    }

    return {
      results: this.context.previousResults,
      modulesCompleted,
      modulesFailed,
    };
  }

  /**
   * Perform the initial HTTP fetch to get HTML and headers.
   * Also detects SPA shell pages that need browser rendering.
   */
  private async performInitialFetch(): Promise<void> {
    try {
      const response = await fetchWithRetry(this.context.url, {
        timeout: 15_000,
        retries: 2,
      });
      this.context.html = response.body;
      this.context.headers = response.headers;
      this.context.redirectChain = response.redirectChain;
      this.context.finalUrl = response.finalUrl;

      // Run content analysis on raw HTML (passive — no browser needed)
      if (response.body) {
        try {
          this.context.contentAnalysis = analyzeContent(response.body, response.headers);
        } catch (error) {
          logger.debug({ error: (error as Error).message }, 'Content analysis failed');
        }
      }

      // Detect SPA shell pages — empty HTML that needs browser rendering
      if (response.body && isSPAShell(response.body)) {
        this.context.spaDetected = true;
        logger.info(
          { scanId: this.context.scanId },
          'SPA shell detected — passive modules will receive degraded HTML',
        );
      }

      logger.info(
        { scanId: this.context.scanId, status: response.status, finalUrl: response.finalUrl, spaDetected: this.context.spaDetected },
        'Initial fetch completed',
      );
    } catch (error) {
      logger.error(
        { scanId: this.context.scanId, error: (error as Error).message },
        'Initial fetch failed, continuing with null HTML',
      );
      this.context.html = null;
      this.context.headers = {};
    }
  }

  /**
   * Fetch sitemap, categorize matched URLs by module category, and render
   * each via Cloudflare /content. Stores pre-rendered pages on ctx.sitemapPages.
   *
   * Also falls back to parsing ctx.html for nav/footer links when sitemap
   * has no matches for a category (zero extra API calls).
   */
  private async fetchSitemapAndCategorize(): Promise<void> {
    const start = Date.now();

    // Root keywords only — matching is substring-based, so 'news' catches
    // /latest-news, /corporate-news, /company-news; 'prensa' catches
    // /sala-de-prensa, /comunicados-de-prensa, etc. No compounds needed.
    // Keywords ≤3 chars use word-boundary matching to avoid false positives.
    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      press: [
        'press', 'newsroom', 'news', 'media', 'announcement',
        // es
        'prensa', 'noticias', 'comunicado', 'medios', 'anuncio', 'boletin',
        // fr / de / pt
        'actualite', 'presse', 'nachrichten', 'imprensa', 'nouvelle',
      ],
      careers: [
        'career', 'jobs', 'hiring', 'join', 'talent', 'employment',
        'opportunit', 'opening', 'vacanc', 'position', 'recruit',
        'culture', 'life-at', 'team', 'people', 'apply',
        // es
        'empleo', 'carrera', 'trabaja', 'unete', 'oportunidad',
        'vacante', 'oferta', 'talento', 'reclutamiento', 'contratacion',
        'convocatoria', 'bolsa-de-trabajo',
        // fr / de / pt
        'carriere', 'emploi', 'recrutement', 'stellenangebot', 'karriere',
        'vaga', 'trabalhe',
      ],
      ir: [
        'investor', 'shareholder', 'stockholder', 'ir',
        'sec-filing', 'annual-report', 'earning', 'financial',
        'governance', 'proxy', 'stock', 'dividend', 'esg', 'sustainab',
        // es
        'inversionista', 'inversor', 'accionista', 'financier',
        'informe-anual', 'gobierno-corporativo', 'gobernanza',
        'dividendo', 'cotizacion', 'sostenibilidad', 'bursatil',
        // fr / de / pt
        'investisseur', 'investoren', 'investidor', 'aktionaer', 'acionista',
      ],
      support: [
        'support', 'help', 'knowledge', 'faq', 'contact',
        'doc', 'guide', 'tutorial', 'troubleshoot', 'how-to',
        'communit', 'forum', 'discussion', 'resource',
        'learn', 'academy', 'training', 'getting-started', 'quickstart',
        'developer', 'api', 'status', 'kb',
        // es
        'soporte', 'ayuda', 'conocimiento', 'pregunta', 'contacto',
        'documentacion', 'guia', 'comunidad', 'foro', 'recurso',
        'capacitacion', 'formacion', 'academia', 'desarrollador',
        'atencion', 'servicio-al-cliente',
        // fr / de / pt
        'aide', 'hilfe', 'suporte', 'ajuda', 'kontakt',
      ],
    };

    // Combined keywords across all categories for a single sitemap fetch
    const ALL_KEYWORDS = Object.values(CATEGORY_KEYWORDS).flat();

    const baseUrl = this.context.url.replace(/\/$/, '');

    try {
      // 1. Fetch sitemap with combined keywords
      const discovery = await discoverPathsFromSitemap(baseUrl, ALL_KEYWORDS, {
        timeout: 8000,
        maxMatchedPaths: 50,
        maxChildSitemaps: 5,
      });

      // 2. Categorize matched paths into buckets
      const categorized: Record<string, string[]> = {
        press: [], careers: [], ir: [], support: [],
      };

      for (const path of discovery.matchedPaths) {
        const pathLower = path.toLowerCase();
        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          // For short keywords (≤3 chars like "ir"), use word boundary matching
          const matched = keywords.some(kw => {
            if (kw.length <= 3) {
              return new RegExp(`\\b${kw}\\b`, 'i').test(pathLower);
            }
            return pathLower.includes(kw);
          });
          if (matched) {
            categorized[category]!.push(path);
            break; // Each path goes to first matching category
          }
        }
      }

      // 3. Fall back to parsing main page HTML for nav/footer links when a category has no sitemap match
      // Stores full URLs for cross-domain links (e.g. careers.bestbuy.com)
      // and relative paths for same-domain links.
      const categorizedUrls: Record<string, string[]> = {
        press: [], careers: [], ir: [], support: [],
      };

      if (this.context.html) {
        const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
        let linkMatch: RegExpExecArray | null;
        while ((linkMatch = linkRegex.exec(this.context.html)) !== null) {
          const href = linkMatch[1]!;
          try {
            const resolved = new URL(href, baseUrl);
            const resolvedHost = resolved.hostname.replace(/^www\./, '');
            if (!resolvedHost.endsWith(baseHost)) continue;

            // Match against both hostname and path
            const matchTarget = (resolvedHost + resolved.pathname).toLowerCase();
            for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
              const matched = keywords.some(kw => {
                if (kw.length <= 3) {
                  return new RegExp(`\\b${kw}\\b`, 'i').test(matchTarget);
                }
                return matchTarget.includes(kw);
              });
              if (matched) {
                const fullUrl = resolved.origin + resolved.pathname.replace(/\/$/, '');
                if (!categorizedUrls[category]!.includes(fullUrl)) {
                  categorizedUrls[category]!.push(fullUrl);
                }
                break;
              }
            }
          } catch { /* skip malformed */ }
        }
      }

      // Merge: sitemap paths (as full URLs) + HTML-discovered URLs
      const mergedUrls: Record<string, string[]> = {
        press: [], careers: [], ir: [], support: [],
      };
      for (const [category, paths] of Object.entries(categorized)) {
        // Sitemap paths are relative — convert to full URLs
        for (const path of paths) {
          mergedUrls[category]!.push(`${baseUrl}${path}`);
        }
        // Add HTML-discovered URLs that aren't already in the list
        for (const url of categorizedUrls[category]!) {
          if (!mergedUrls[category]!.includes(url)) {
            mergedUrls[category]!.push(url);
          }
        }
      }

      // 4. Render each matched URL via CF /content (cap at 5 per category)
      const sitemapPages: NonNullable<typeof this.context.sitemapPages> = {
        press: [], careers: [], ir: [], support: [],
      };

      const renderPromises: Promise<void>[] = [];
      for (const [category, urls] of Object.entries(mergedUrls)) {
        for (const fullUrl of urls.slice(0, 5)) {
          const path = new URL(fullUrl).pathname;
          renderPromises.push(
            (async () => {
              const html = await fetchRenderedContent(fullUrl);
              if (html) {
                sitemapPages[category as keyof typeof sitemapPages].push({
                  url: fullUrl,
                  path,
                  html,
                });
              }
            })(),
          );
        }
      }

      await Promise.allSettled(renderPromises);
      this.context.sitemapPages = sitemapPages;

      logger.info(
        {
          scanId: this.context.scanId,
          sitemapFound: discovery.sitemapFound,
          sitemapMatched: discovery.matchedPaths.length,
          htmlLinks: { press: categorizedUrls.press!.length, careers: categorizedUrls.careers!.length, ir: categorizedUrls.ir!.length, support: categorizedUrls.support!.length },
          press: sitemapPages.press.length,
          careers: sitemapPages.careers.length,
          ir: sitemapPages.ir.length,
          support: sitemapPages.support.length,
          totalRendered: sitemapPages.press.length + sitemapPages.careers.length +
            sitemapPages.ir.length + sitemapPages.support.length,
          mergedUrls: { press: mergedUrls.press!.slice(0, 3), careers: mergedUrls.careers!.slice(0, 3), ir: mergedUrls.ir!.slice(0, 3), support: mergedUrls.support!.slice(0, 3) },
          durationMs: Date.now() - start,
        },
        'Sitemap discovery and rendering complete',
      );
    } catch (error) {
      logger.warn(
        { scanId: this.context.scanId, error: (error as Error).message },
        'Sitemap discovery failed — modules will use raw HTTP fallback',
      );
    }
  }

  /**
   * Phase 1: Passive modules run in parallel with Promise.allSettled.
   */
  private async runPassivePhase(): Promise<void> {
    const modules = this.filterForTier(getModulesForPhaseAndTier('passive', this.tier));
    if (modules.length === 0) return;
    logger.info({ moduleCount: modules.length }, 'Running passive phase');

    const promises = modules.map((mod) =>
      this.executeModule(mod),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Phase 2: Browser modules run sequentially on a shared Playwright page.
   */
  private async runBrowserPhase(): Promise<void> {
    const modules = this.filterForTier(getModulesForPhaseAndTier('browser', this.tier));
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running browser phase');

    // Launch browser and create page with URL-aware stealth profile
    const page = await this.browserPool.createPage(this.context.url);
    const domain = getRegistrableDomain(this.context.url);
    const networkCollector = new NetworkCollector(domain);
    networkCollector.attach(page);

    // Attach ConsoleCollector BEFORE navigation to capture SDK init logs
    const consoleCollector = new ConsoleCollector();
    consoleCollector.attach(page);

    // Navigate with a realistic Google referrer — bots with empty referrer are flagged
    const referer = this.getGoogleReferer();

    try {
      await page.goto(this.context.url, {
        waitUntil: 'networkidle',
        timeout: 30_000,
        referer,
      });
    } catch (error) {
      logger.warn(
        { error: (error as Error).message },
        'Page navigation did not reach networkidle, continuing',
      );
      // Fallback: wait for at least domcontentloaded
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
      } catch {
        // Best effort
      }
    }

    // Check for bot wall and attempt auto-resolution (with timeout guard)
    const botWall = await Promise.race([
      detectAndHandleBotWall(page, this.context.url),
      new Promise<{ detected: false; blocked: false; provider: null }>((resolve) =>
        setTimeout(() => {
          logger.warn('Bot wall detection timed out after 45s');
          resolve({ detected: false, blocked: false, provider: null });
        }, 45_000),
      ),
    ]);
    if (botWall.blocked) {
      logger.warn(
        { provider: botWall.provider, scanId: this.context.scanId },
        'Bot wall detected and could not be resolved',
      );
    } else if (botWall.provider) {
      logger.info(
        { provider: botWall.provider, autoResolved: botWall.autoResolved, retrySucceeded: botWall.retrySucceeded },
        'Bot wall detected and resolved',
      );
    }

    // Update context with browser references
    this.context.page = page;
    this.context.networkCollector = networkCollector;
    this.context.consoleCollector = consoleCollector;

    // ── Collect data layer snapshots (5s timeout each) ──────────────────
    await this.collectBrowserSnapshots(page, domain ?? new URL(this.context.url).hostname);

    // Collect browser-observed redirect chains
    this.context.browserRedirectChains = networkCollector.getRedirectChains();

    // Detect mixed content (HTTP resources on HTTPS pages)
    try {
      this.context.mixedContent = detectMixedContent(this.context.url, networkCollector, this.context.html);
    } catch (error) {
      logger.debug({ scanId: this.context.scanId, error: (error as Error).message }, 'Mixed content detection failed');
    }

    // Run browser modules sequentially (shared page state)
    for (const mod of modules) {
      await this.executeModule(mod);
    }

    // ── Passive module retry ─────────────────────────────────────────────
    // If the initial HTTP fetch failed (e.g., Etsy-style 403 to non-browser
    // User-Agent), the passive phase ran with ctx.html = null, causing M04
    // and other HTML-dependent passive modules to error or produce degraded
    // results. Now that the browser has successfully navigated, extract the
    // rendered HTML and re-run those failed modules.
    await this.retryFailedPassiveModules(page);
  }

  /**
   * Collect all browser data layer snapshots after navigation.
   * Each snapshot is wrapped in a 5s timeout to prevent slow pages from blocking.
   */
  private async collectBrowserSnapshots(page: Page, domain: string): Promise<void> {
    const SNAPSHOT_TIMEOUT = 5_000;

    // Storage snapshot
    try {
      this.context.storageSnapshot = await Promise.race([
        StorageCollector.snapshot(page),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Storage snapshot failed');
    }

    // Frame snapshot
    try {
      this.context.frameSnapshot = await Promise.race([
        FrameCollector.snapshot(page, domain),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Frame snapshot failed');
    }

    // DOM Forensics snapshot
    try {
      this.context.domForensics = await Promise.race([
        page.evaluate((): DOMForensics => {
          // Total nodes
          const allNodes = document.querySelectorAll('*');
          const totalNodes = allNodes.length;

          // Max depth
          let maxDepth = 0;
          function getDepth(el: Element, depth: number): void {
            if (depth > maxDepth) maxDepth = depth;
            if (depth > 30) return; // safety cap
            for (const child of el.children) {
              getDepth(child, depth + 1);
            }
          }
          getDepth(document.documentElement, 0);

          // Shadow DOM & custom elements
          let hasShadowDOM = false;
          const customElements: string[] = [];
          const customSet = new Set<string>();
          for (const el of allNodes) {
            if (el.shadowRoot) hasShadowDOM = true;
            const tag = el.tagName.toLowerCase();
            if (tag.includes('-') && !customSet.has(tag) && customSet.size < 30) {
              customSet.add(tag);
              customElements.push(tag);
            }
          }

          // Inline event handlers
          const inlineHandlers: Array<{ tag: string; event: string; snippet: string }> = [];
          const eventAttrs = ['onclick', 'onsubmit', 'onchange', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onkeydown', 'onkeyup'];
          for (const el of allNodes) {
            if (inlineHandlers.length >= 20) break;
            for (const attr of eventAttrs) {
              const val = el.getAttribute(attr);
              if (val) {
                inlineHandlers.push({
                  tag: el.tagName.toLowerCase(),
                  event: attr,
                  snippet: val.slice(0, 100),
                });
                break; // one per element
              }
            }
          }

          // Data attributes — top 50 by count
          const dataAttrCounts = new Map<string, { count: number; samples: string[] }>();
          for (const el of allNodes) {
            for (const attr of el.getAttributeNames()) {
              if (!attr.startsWith('data-')) continue;
              const entry = dataAttrCounts.get(attr);
              if (entry) {
                entry.count++;
                if (entry.samples.length < 5) {
                  const val = el.getAttribute(attr) ?? '';
                  if (val && !entry.samples.includes(val)) entry.samples.push(val.slice(0, 80));
                }
              } else {
                const val = el.getAttribute(attr) ?? '';
                dataAttrCounts.set(attr, { count: 1, samples: val ? [val.slice(0, 80)] : [] });
              }
            }
          }
          const dataAttributes = [...dataAttrCounts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 50)
            .map(([attr, { count, samples }]) => ({ attr, count, sampleValues: samples }));

          // Hidden elements
          let displayNone = 0;
          let visibilityHidden = 0;
          let opacityZero = 0;
          const hiddenSamples: Array<{ tag: string; id: string; class: string }> = [];

          // Only sample first 2000 elements for performance
          const sampleLimit = Math.min(allNodes.length, 2000);
          for (let i = 0; i < sampleLimit; i++) {
            const el = allNodes[i]! as HTMLElement;
            try {
              const style = window.getComputedStyle(el);
              if (style.display === 'none') {
                displayNone++;
                if (hiddenSamples.length < 10) {
                  hiddenSamples.push({ tag: el.tagName.toLowerCase(), id: el.id || '', class: (el.className || '').toString().slice(0, 80) });
                }
              }
              if (style.visibility === 'hidden') visibilityHidden++;
              if (style.opacity === '0') opacityZero++;
            } catch { /* computed style may fail */ }
          }

          // Dynamic content areas
          const dynamicContentAreas = document.querySelectorAll('[data-lazy], [data-src], [loading="lazy"]').length;

          return {
            totalNodes,
            maxDepth,
            hasShadowDOM,
            customElements,
            inlineEventHandlers: inlineHandlers,
            dataAttributes,
            hiddenElements: { displayNone, visibilityHidden, opacityZero, samples: hiddenSamples },
            dynamicContentAreas,
          };
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'DOM forensics snapshot failed');
    }

    // Inline config extraction
    try {
      this.context.inlineConfigs = await Promise.race([
        page.evaluate(() => {
          const w = window as unknown as Record<string, unknown>;
          const configs: Record<string, unknown> = {};
          const MAX_SIZE = 50_000; // 50KB per config

          const CONFIG_KEYS = [
            '__CONFIG__', '__INITIAL_STATE__', '__NEXT_DATA__', '__NUXT__',
            '__PRELOADED_STATE__', '__APP_DATA__', '__REDUX_STATE__',
            '__REMIX_CONTEXT__', '__APOLLO_STATE__', 'gon',
          ];

          for (const key of CONFIG_KEYS) {
            const val = w[key];
            if (val != null) {
              try {
                const json = JSON.stringify(val);
                if (json && json.length <= MAX_SIZE) {
                  configs[key] = JSON.parse(json); // deep clone via JSON round-trip
                } else if (json) {
                  configs[key] = { _truncated: true, _size: json.length };
                }
              } catch {
                configs[key] = { _error: 'Could not serialize' };
              }
            }
          }

          return Object.keys(configs).length > 0 ? configs : null;
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Inline config extraction failed');
    }

    // Cookie analysis
    try {
      this.context.cookieAnalysis = await Promise.race([
        CookieAnalyzer.analyze(page, domain),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Cookie analysis failed');
    }

    // Form snapshot
    try {
      this.context.formSnapshot = await Promise.race([
        FormCollector.snapshot(page),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Form snapshot failed');
    }

    // Image/media audit
    try {
      this.context.imageAudit = await Promise.race([
        ImageAuditor.audit(page),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Image audit failed');
    }

    // Link structure analysis
    try {
      this.context.linkAnalysis = await Promise.race([
        LinkAnalyzer.analyze(page, domain),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Link analysis failed');
    }

    // Navigator snapshot
    try {
      this.context.navigatorSnapshot = await Promise.race([
        page.evaluate((): NavigatorSnapshot => {
          const nav = navigator as unknown as Record<string, unknown>;
          const conn = (nav['connection'] ?? nav['mozConnection'] ?? nav['webkitConnection']) as Record<string, unknown> | undefined;

          let storageQuota: { usage: number; quota: number } | null = null;
          // StorageManager.estimate() is async — we skip it in sync evaluate

          return {
            connection: conn ? {
              effectiveType: String(conn['effectiveType'] ?? ''),
              downlink: Number(conn['downlink'] ?? 0),
              rtt: Number(conn['rtt'] ?? 0),
            } : null,
            deviceMemory: typeof nav['deviceMemory'] === 'number' ? nav['deviceMemory'] as number : null,
            hardwareConcurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
            maxTouchPoints: navigator.maxTouchPoints ?? 0,
            language: navigator.language,
            languages: [...navigator.languages],
            cookieEnabled: navigator.cookieEnabled,
            pdfViewerEnabled: typeof nav['pdfViewerEnabled'] === 'boolean' ? nav['pdfViewerEnabled'] as boolean : false,
            webdriver: !!(nav['webdriver']),
            storageQuota,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
          };
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT)),
      ]);
    } catch (error) {
      logger.debug({ error: (error as Error).message }, 'Navigator snapshot failed');
    }

    logger.info(
      {
        hasStorage: !!this.context.storageSnapshot,
        hasFrames: !!this.context.frameSnapshot,
        hasDomForensics: !!this.context.domForensics,
        hasInlineConfigs: !!this.context.inlineConfigs,
        hasCookies: !!this.context.cookieAnalysis,
        hasForms: !!this.context.formSnapshot,
        hasImages: !!this.context.imageAudit,
        hasLinks: !!this.context.linkAnalysis,
        hasNavigator: !!this.context.navigatorSnapshot,
        consoleMessages: this.context.consoleCollector?.getAllMessages().length ?? 0,
      },
      'Browser snapshots collected',
    );
  }

  /**
   * Re-run passive modules that failed or ran on degraded HTML.
   *
   * Handles two scenarios:
   * 1. Initial fetch failed (403, timeout) — passive modules got null HTML
   * 2. SPA shell — passive modules got an empty shell, need rendered HTML
   * 3. Module crashed on malformed HTML but browser-rendered HTML is clean
   *
   * After the browser phase navigates successfully, we extract the
   * rendered DOM and re-execute any errored passive modules.
   */
  private async retryFailedPassiveModules(page: Page): Promise<void> {
    const passiveModules = this.filterForTier(getModulesForPhaseAndTier('passive', this.tier));
    const failedPassive = passiveModules.filter(mod => {
      const result = this.context.previousResults.get(mod.id);
      return result?.status === 'error';
    });

    if (failedPassive.length === 0) return;

    // Extract rendered HTML from the browser page
    try {
      const browserHtml = await page.content();
      if (!browserHtml || browserHtml.length < 100) return; // sanity check

      logger.info(
        { failedCount: failedPassive.length, modules: failedPassive.map(m => m.id), spaDetected: this.context.spaDetected },
        'Retrying failed passive modules with browser HTML',
      );

      // Always update context with browser HTML for retries
      // Browser-rendered HTML is more complete than initial fetch HTML
      this.context.html = browserHtml;

      // Re-run failed passive modules
      const retryPromises = failedPassive.map(mod => this.executeModule(mod));
      await Promise.allSettled(retryPromises);
    } catch (error) {
      logger.warn(
        { error: (error as Error).message },
        'Failed to extract browser HTML for passive retry',
      );
    }
  }

  /**
   * Phase 3: GhostScan modules continue on the same page, run sequentially.
   */
  private async runGhostScanPhase(): Promise<void> {
    const modules = this.filterForTier(getModulesForPhaseAndTier('ghostscan', this.tier));
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running ghostscan phase');

    // Ensure we have a page (created in browser phase)
    if (!this.context.page) {
      logger.warn('No page available for ghostscan phase, creating new page');
      const page = await this.browserPool.createPage(this.context.url);
      const domain = getRegistrableDomain(this.context.url);
      const networkCollector = new NetworkCollector(domain);
      networkCollector.attach(page);
      const consoleCollector = new ConsoleCollector();
      consoleCollector.attach(page);

      try {
        await page.goto(this.context.url, {
          waitUntil: 'networkidle',
          timeout: 30_000,
          referer: this.getGoogleReferer(),
        });
      } catch (error) {
        logger.warn(
          { error: (error as Error).message },
          'GhostScan page navigation incomplete, continuing',
        );
      }

      this.context.page = page;
      this.context.networkCollector = networkCollector;
      this.context.consoleCollector = consoleCollector;
    }

    // Run ghostscan modules sequentially
    for (const mod of modules) {
      await this.executeModule(mod);
    }
  }

  /**
   * Phase 4: External modules run in parallel.
   */
  private async runExternalPhase(): Promise<void> {
    const modules = this.filterForTier(getModulesForPhaseAndTier('external', this.tier));
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running external phase');

    const promises = modules.map((mod) =>
      this.executeModule(mod),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Phase 4.5: Paid Media modules (M06, M06b) run on a dedicated browser page
   * targeting the real paid landing page URL extracted from M21 Facebook ad CTA URLs.
   * This gives M06/M06b a clean network signal and real paid-page data.
   */
  private async runPaidMediaPhase(): Promise<void> {
    const modules = this.filterForTier(getModulesForPhaseAndTier('paid-media', this.tier));
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running paid-media phase');

    // Extract best paid URL from M21 results (Facebook ad CTA URLs)
    let paidUrl = this.context.url; // fallback to homepage
    try {
      const m21Result = this.context.previousResults.get('M21' as ModuleId);
      if (m21Result?.data) {
        const m21Data = m21Result.data as Record<string, unknown>;
        const fb = m21Data['facebook'] as { ads?: Array<{ ctaUrl: string | null }> } | undefined;
        if (fb?.ads) {
          const ctaUrl = fb.ads.find(
            a => a.ctaUrl &&
              !a.ctaUrl.includes('facebook.com') &&
              !a.ctaUrl.includes('meta.com') &&
              !a.ctaUrl.includes('instagram.com'),
          )?.ctaUrl;
          if (ctaUrl) paidUrl = ctaUrl;
        }
      }
    } catch {
      // Fall back to ctx.url
    }

    logger.info(
      { scanId: this.context.scanId, paidUrl, isCtaUrl: paidUrl !== this.context.url },
      'Paid media target URL resolved',
    );

    // Store paid URL in context so M06/M06b know which URL they're scanning
    this.context.paidMediaUrl = paidUrl;

    // Save reference to old page so we can restore after
    const previousPage = this.context.page;
    const previousNetworkCollector = this.context.networkCollector;
    const previousConsoleCollector = this.context.consoleCollector;

    // Create a fresh browser page for the paid media phase
    let page: Page | null = null;
    try {
      page = await this.browserPool.createPage(paidUrl);
      const domain = getRegistrableDomain(paidUrl);
      const networkCollector = new NetworkCollector(domain);
      networkCollector.attach(page);
      const consoleCollector = new ConsoleCollector();
      consoleCollector.attach(page);

      // SSRF protection: paidUrl comes from M21 ad extraction (untrusted)
      assertUrlSafe(paidUrl);

      // Navigate with Google referrer
      const referer = `https://www.google.com/search?q=${encodeURIComponent(
        new URL(paidUrl).hostname.replace(/^www\./, ''),
      )}`;

      try {
        await page.goto(paidUrl, {
          waitUntil: 'networkidle',
          timeout: 30_000,
          referer,
        });
      } catch (error) {
        logger.warn(
          { error: (error as Error).message },
          'Paid media page navigation did not reach networkidle, continuing',
        );
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
        } catch {
          // Best effort
        }
      }

      // Detect and resolve bot walls (with timeout guard to prevent indefinite hang)
      const botWall = await Promise.race([
        detectAndHandleBotWall(page, paidUrl),
        new Promise<{ detected: false; blocked: false; provider: null }>((resolve) =>
          setTimeout(() => {
            logger.warn('Paid media bot wall detection timed out after 45s');
            resolve({ detected: false, blocked: false, provider: null });
          }, 45_000),
        ),
      ]);
      if (botWall.blocked) {
        logger.warn(
          { provider: botWall.provider, scanId: this.context.scanId },
          'Paid media page blocked by bot wall',
        );
      }

      // Update context with fresh page and collectors
      this.context.page = page;
      this.context.networkCollector = networkCollector;
      this.context.consoleCollector = consoleCollector;

      // Collect data layer snapshots on the paid page
      await this.collectBrowserSnapshots(page, domain ?? new URL(paidUrl).hostname);

      // Run M06 then M06b sequentially
      for (const mod of modules) {
        await this.executeModule(mod);
      }
    } catch (error) {
      logger.error(
        { scanId: this.context.scanId, error: (error as Error).message },
        'Paid media phase failed',
      );
    } finally {
      // Close the paid media page
      if (page) {
        await page.close().catch(() => {});
      }
      // Restore previous context (null out page for synthesis phase)
      this.context.page = previousPage;
      this.context.networkCollector = previousNetworkCollector;
      this.context.consoleCollector = previousConsoleCollector;
    }
  }

  /**
   * Phase 5: Synthesis modules.
   * M41 runs first (parallel individual synthesis),
   * then M42-M45 run sequentially (each depends on prior results).
   */
  private async runSynthesisPhase(): Promise<void> {
    const allSynthesis = this.filterForTier(getModulesForPhaseAndTier('synthesis', this.tier));
    if (allSynthesis.length === 0) return;

    logger.info({ moduleCount: allSynthesis.length }, 'Running synthesis phase');

    // M41 runs first (independent synthesis of each scored module)
    const m41 = allSynthesis.find((m) => m.id === 'M41');
    if (m41) {
      await this.executeModule(m41);
    }

    // M42-M46 run sequentially (topological order: M42 → M45 → M43 → M46)
    // M43 depends on M42+M45, M46 depends on M42+M43+M45.
    const sequentialModules = allSynthesis
      .filter((m) => m.id !== 'M41')
      .sort((a, b) => {
        const order: Record<string, number> = {
          M42: 0,
          M45: 1,
          M43: 2,
          M46: 3,
        };
        return (order[a.id] ?? 99) - (order[b.id] ?? 99);
      });

    for (const mod of sequentialModules) {
      // Check dependencies — must exist AND have succeeded (not error/skipped)
      if (mod.dependsOn) {
        const missingDeps = mod.dependsOn.filter((depId) => {
          const result = this.context.previousResults.get(depId);
          return !result || result.status === 'error' || result.status === 'skipped';
        });
        if (missingDeps.length > 0) {
          logger.warn(
            { moduleId: mod.id, missingDeps },
            'Skipping synthesis module due to missing or failed dependencies',
          );
          const skipResult: ModuleResult = {
            moduleId: mod.id,
            status: 'skipped',
            data: { reason: `Missing dependencies: ${missingDeps.join(', ')}` },
            signals: [],
            score: null,
            checkpoints: [],
            duration: 0,
          };
          this.context.previousResults.set(mod.id, skipResult);
          await this.safeUpsertResult(skipResult);
          continue;
        }
      }

      await this.executeModule(mod);
    }
  }

  /**
   * Execute a single module with timeout and retry logic.
   * Module failures never cascade -- errors are caught and stored.
   */
  private async executeModule(mod: ModuleDefinition): Promise<void> {
    const startTime = Date.now();
    const executor = getExecutor(mod.id);

    logger.debug({ moduleId: mod.id, name: mod.name }, 'Executing module');

    let result: ModuleResult | null = null;
    let lastError: Error | null = null;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= mod.retries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 15_000);
        logger.debug(
          { moduleId: mod.id, attempt, backoffMs },
          'Retrying module',
        );
        await sleep(backoffMs);
      }

      const timeout = this.createTimeout(mod.timeout, mod.id);
      try {
        // Execute with timeout via Promise.race
        result = await Promise.race([
          this.safeExecute(executor, mod.id),
          timeout.promise,
        ]);

        // Success -- break retry loop
        if (result.status === 'success' || result.status === 'partial') {
          break;
        }

        // Module returned error status, save it but try again
        lastError = new Error(result.error ?? 'Module returned error status');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { moduleId: mod.id, attempt, error: lastError.message },
          'Module execution failed',
        );
      } finally {
        timeout.cancel();
      }

      // Don't retry configuration errors (missing env vars) — they won't self-resolve
      if (lastError?.message.includes('Missing') && lastError.message.includes('environment variable')) {
        logger.error({ moduleId: mod.id }, 'Configuration error — skipping retries');
        break;
      }
    }

    // If no successful result, create an error result
    if (!result || result.status === 'error') {
      const duration = Date.now() - startTime;
      result = {
        moduleId: mod.id,
        status: 'error',
        data: {},
        signals: [],
        score: null,
        checkpoints: [],
        duration,
        error: lastError?.message ?? 'Unknown error',
      };
    }

    // Ensure duration is set
    result.duration = Date.now() - startTime;

    // Enrich result with standardized detected tools
    const detectedTools = extractDetectedTools(mod.id, result.data);
    if (detectedTools.length > 0) {
      result.data.detectedTools = detectedTools;
    }

    // Store result in context for downstream modules
    this.context.previousResults.set(mod.id, result);

    // Upsert to Supabase immediately
    await this.safeUpsertResult(result);

    logger.info(
      {
        moduleId: mod.id,
        status: result.status,
        score: result.score,
        duration: result.duration,
      },
      'Module execution completed',
    );
  }

  /**
   * Safely execute a module, catching all errors.
   */
  private async safeExecute(
    executor: ModuleExecuteFn,
    moduleId: ModuleId,
  ): Promise<ModuleResult> {
    try {
      const result = await executor(this.context);
      // Ensure the moduleId is correct
      result.moduleId = moduleId;
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        moduleId,
        status: 'error',
        data: {},
        signals: [],
        score: null,
        checkpoints: [],
        duration: 0,
        error: err.message,
      };
    }
  }

  /**
   * Create a timeout promise that rejects after the specified duration.
   * Returns both the promise and a cancel function to clear the timer.
   */
  private createTimeout(ms: number, moduleId: ModuleId): { promise: Promise<ModuleResult>; cancel: () => void } {
    let timerId: NodeJS.Timeout;
    const promise = new Promise<ModuleResult>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(`Module ${moduleId} timed out after ${ms}ms`));
      }, ms);
    });
    return { promise, cancel: () => clearTimeout(timerId!) };
  }

  /**
   * Safely upsert a module result to Supabase, catching errors.
   */
  private async safeUpsertResult(result: ModuleResult): Promise<void> {
    try {
      await upsertModuleResult(this.context.scanId, result);
    } catch (error) {
      logger.error(
        {
          moduleId: result.moduleId,
          error: (error as Error).message,
        },
        'Failed to upsert module result to Supabase',
      );
    }
  }

  /**
   * Fetch CrUX / PageSpeed Insights data in parallel with the initial fetch.
   * Non-blocking — returns null on any failure.
   */
  private async fetchCruxData(): Promise<void> {
    try {
      const { fetchCruxData } = await import('../services/crux.js');
      this.context.cruxData = await fetchCruxData(this.context.url, 'mobile', CRUX_TIMEOUT);
    } catch (error) {
      logger.debug({ scanId: this.context.scanId, error: (error as Error).message }, 'CrUX data fetch failed');
    }
  }

  /**
   * Run a mobile rendering pass to collect mobile-specific CWV metrics.
   * Uses a separate BrowserContext with mobile UA, viewport, and touch support.
   */
  private async runMobilePass(): Promise<void> {
    let mobilePage: import('patchright').Page | null = null;
    let mobileContext: import('patchright').BrowserContext | null = null;

    try {
      const result = await this.browserPool.createMobilePage(this.context.url);
      mobilePage = result.page;
      mobileContext = result.context;

      // Navigate with the same Google referrer used in the desktop phase
      try {
        await mobilePage.goto(this.context.url, {
          waitUntil: 'networkidle',
          timeout: MOBILE_NAV_TIMEOUT,
          referer: this.getGoogleReferer(),
        });
      } catch {
        try {
          await mobilePage.waitForLoadState('domcontentloaded', { timeout: 10_000 });
        } catch { /* best effort */ }
      }

      // Check for bot wall on mobile — mobile UAs may get different treatment (with timeout guard)
      const botWall = await Promise.race([
        detectAndHandleBotWall(mobilePage, this.context.url),
        new Promise<{ detected: false; blocked: false; provider: null }>((resolve) =>
          setTimeout(() => {
            logger.warn('Mobile bot wall detection timed out after 45s');
            resolve({ detected: false, blocked: false, provider: null });
          }, 45_000),
        ),
      ]);
      if (botWall.blocked) {
        logger.debug(
          { scanId: this.context.scanId, provider: botWall.provider },
          'Mobile pass blocked by bot wall, skipping metrics',
        );
        return;
      }

      // Wait for CWV to stabilize after page load
      await mobilePage.waitForTimeout(CWV_STABILIZATION_DELAY);

      // Collect mobile performance metrics via Performance API
      const metrics = await mobilePage.evaluate(() => {
        const perf = performance;
        const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const resources = perf.getEntriesByType('resource') as PerformanceResourceTiming[];

        // LCP — last entry is the final (largest) paint
        let lcp: number | null = null;
        const lcpEntries = perf.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          lcp = lcpEntries[lcpEntries.length - 1]!.startTime;
        }

        // CLS — sum of layout shift values excluding user-input-triggered shifts
        // PerformanceEntry doesn't expose hadRecentInput/value, but the LayoutShift
        // performance entry does. Use typed interface for clarity.
        interface LayoutShiftEntry extends PerformanceEntry {
          hadRecentInput: boolean;
          value: number;
        }
        let cls: number | null = null;
        const layoutShifts = perf.getEntriesByType('layout-shift') as LayoutShiftEntry[];
        if (layoutShifts.length > 0) {
          cls = 0;
          for (const entry of layoutShifts) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          }
        }

        // FCP — first-contentful-paint from paint timing entries
        let fcp: number | null = null;
        const paintEntries = perf.getEntriesByType('paint');
        for (const entry of paintEntries) {
          if (entry.name === 'first-contentful-paint') fcp = entry.startTime;
        }

        // TTFB — time from request start to first response byte
        const ttfb = nav?.responseStart ? nav.responseStart - nav.requestStart : 0;

        // Total transferred bytes across all resources
        let totalBytes = 0;
        for (const res of resources) {
          totalBytes += res.transferSize || res.encodedBodySize || 0;
        }

        return {
          lcp,
          cls,
          fcp,
          ttfb,
          totalBytes,
          resourceCount: resources.length,
          domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
          loadComplete: nav?.loadEventEnd ?? 0,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          userAgent: navigator.userAgent,
        };
      });

      this.context.mobileMetrics = metrics;
      logger.info(
        { scanId: this.context.scanId, lcp: metrics.lcp, cls: metrics.cls, totalBytes: metrics.totalBytes },
        'Mobile pass metrics collected',
      );
    } catch (error) {
      logger.debug(
        { scanId: this.context.scanId, error: (error as Error).message },
        'Mobile pass failed — non-critical',
      );
    } finally {
      if (mobilePage) await mobilePage.close().catch(() => {});
      if (mobileContext) await mobileContext.close().catch(() => {});
    }
  }

  /**
   * Run only the synthesis phase with pre-loaded results (for paid tier upgrade).
   * Loads existing M01-M41 results into context, then runs M42-M45.
   */
  async runSynthesisOnly(existingResults: Map<ModuleId, ModuleResult>): Promise<{
    results: Map<ModuleId, ModuleResult>;
    modulesCompleted: number;
    modulesFailed: number;
  }> {
    // Load all existing results into context
    for (const [id, result] of existingResults) {
      this.context.previousResults.set(id, result);
    }

    logger.info(
      { scanId: this.context.scanId, existingCount: existingResults.size },
      'Running synthesis-only with pre-loaded results',
    );

    // Override tier to paid for synthesis
    this.tier = 'paid';
    this.context.tier = 'paid';

    await updateScanStatus(this.context.scanId, 'synthesis' as ScanStatus);
    await this.runSynthesisPhase();

    let modulesCompleted = 0;
    let modulesFailed = 0;
    for (const result of this.context.previousResults.values()) {
      if (result.status === 'success' || result.status === 'partial') {
        modulesCompleted++;
      } else if (result.status === 'error') {
        modulesFailed++;
      }
    }

    return {
      results: this.context.previousResults,
      modulesCompleted,
      modulesFailed,
    };
  }

  /**
   * Clean up all resources (browser, pages).
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.context.page) {
        await this.context.page.close().catch(() => {});
        this.context.page = null;
      }
      await this.browserPool.close();
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        'Error during cleanup',
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect if HTML is a SPA shell (empty body with just a mount div).
 * Pure SPAs like Discord, Slack, etc. return empty HTML that needs
 * browser rendering for any content to appear.
 */
function isSPAShell(html: string): boolean {
  if (html.length < 2000) return true;

  // Check for SPA mount point patterns with no real content
  const hasMountDiv = /<body[^>]*>\s*<div\s+id="(root|app|__next|__nuxt|svelte)"/.test(html);
  const hasRealContent = /<(p|h[1-6]|article|section|main|table|ul|ol)\b/.test(html);

  return hasMountDiv && !hasRealContent;
}
