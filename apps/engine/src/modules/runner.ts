import type { ModuleDefinition, ModuleId, ModuleResult, ModuleTier, ScanStatus } from '@marketing-alpha/types';
import type { ModuleContext, ModuleExecuteFn } from './types.js';
import type { Page } from 'playwright';
import { getModulesForPhaseAndTier } from './registry.js';
import { NetworkCollector } from '../utils/network.js';
import { BrowserPool } from '../ghostscan/browser-pool.js';
import { fetchWithRetry } from '../utils/http.js';
import { getRegistrableDomain } from '../utils/url.js';
import { updateScanStatus, upsertModuleResult } from '../services/supabase.js';
import { calculateModuleScore } from '../utils/scoring.js';
import pino from 'pino';

const logger = pino({ name: 'module-runner' });

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
  peek: ['passive'],
  full: ['passive', 'browser', 'ghostscan', 'external', 'synthesis'],
  paid: ['passive', 'browser', 'ghostscan', 'external', 'synthesis'],
};

/**
 * ModuleRunner orchestrates the execution of all scan modules across phases.
 *
 * Phase execution order:
 *   1. Passive  - HTTP fetch + DNS, run modules in parallel
 *   2. Browser  - Playwright page, NetworkCollector, run modules sequentially
 *   3. GhostScan - Continue on same page, run modules sequentially
 *   4. External - Third-party API calls, run modules in parallel
 *   5. Synthesis - M41 parallel, then M42-M46 sequential
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
      previousResults: new Map(),
    };
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
      // Perform initial fetch for passive phase HTML
      await this.performInitialFetch();

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
            break;
          case 'ghostscan':
            await this.runGhostScanPhase();
            break;
          case 'external':
            await this.runExternalPhase();
            break;
          case 'synthesis':
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
   */
  private async performInitialFetch(): Promise<void> {
    try {
      const response = await fetchWithRetry(this.context.url, {
        timeout: 15_000,
        retries: 2,
      });
      this.context.html = response.body;
      this.context.headers = response.headers;

      logger.info(
        { scanId: this.context.scanId, status: response.status, finalUrl: response.finalUrl },
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
   * Phase 1: Passive modules run in parallel with Promise.allSettled.
   */
  private async runPassivePhase(): Promise<void> {
    const modules = getModulesForPhaseAndTier('passive', this.tier);
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
    const modules = getModulesForPhaseAndTier('browser', this.tier);
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running browser phase');

    // Launch browser and create page
    const page = await this.browserPool.createPage();
    const domain = getRegistrableDomain(this.context.url);
    const networkCollector = new NetworkCollector(domain);
    networkCollector.attach(page);

    // Navigate to the target URL
    try {
      await page.goto(this.context.url, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });
    } catch (error) {
      logger.warn(
        { error: (error as Error).message },
        'Page navigation did not reach networkidle, continuing',
      );
    }

    // Update context with browser references
    this.context.page = page;
    this.context.networkCollector = networkCollector;

    // Run browser modules sequentially (shared page state)
    for (const mod of modules) {
      await this.executeModule(mod);
    }
  }

  /**
   * Phase 3: GhostScan modules continue on the same page, run sequentially.
   */
  private async runGhostScanPhase(): Promise<void> {
    const modules = getModulesForPhaseAndTier('ghostscan', this.tier);
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running ghostscan phase');

    // Ensure we have a page (created in browser phase)
    if (!this.context.page) {
      logger.warn('No page available for ghostscan phase, creating new page');
      const page = await this.browserPool.createPage();
      const domain = getRegistrableDomain(this.context.url);
      const networkCollector = new NetworkCollector(domain);
      networkCollector.attach(page);

      try {
        await page.goto(this.context.url, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
      } catch (error) {
        logger.warn(
          { error: (error as Error).message },
          'GhostScan page navigation incomplete, continuing',
        );
      }

      this.context.page = page;
      this.context.networkCollector = networkCollector;
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
    const modules = getModulesForPhaseAndTier('external', this.tier);
    if (modules.length === 0) return;

    logger.info({ moduleCount: modules.length }, 'Running external phase');

    const promises = modules.map((mod) =>
      this.executeModule(mod),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Phase 5: Synthesis modules.
   * M41 runs first (parallel individual synthesis),
   * then M42-M46 run sequentially (each depends on prior results).
   */
  private async runSynthesisPhase(): Promise<void> {
    const allSynthesis = getModulesForPhaseAndTier('synthesis', this.tier);
    if (allSynthesis.length === 0) return;

    logger.info({ moduleCount: allSynthesis.length }, 'Running synthesis phase');

    // M41 runs first (independent synthesis of each scored module)
    const m41 = allSynthesis.find((m) => m.id === 'M41');
    if (m41) {
      await this.executeModule(m41);
    }

    // M42-M46 run sequentially (dependency chain)
    const sequentialModules = allSynthesis
      .filter((m) => m.id !== 'M41')
      .sort((a, b) => {
        const order: Record<string, number> = {
          M42: 0,
          M43: 1,
          M44: 2,
          M45: 3,
          M46: 4,
        };
        return (order[a.id] ?? 99) - (order[b.id] ?? 99);
      });

    for (const mod of sequentialModules) {
      // Check dependencies
      if (mod.dependsOn) {
        const missingDeps = mod.dependsOn.filter(
          (depId) => !this.context.previousResults.has(depId),
        );
        if (missingDeps.length > 0) {
          logger.warn(
            { moduleId: mod.id, missingDeps },
            'Skipping synthesis module due to missing dependencies',
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

      try {
        // Execute with timeout via Promise.race
        result = await Promise.race([
          this.safeExecute(executor, mod.id),
          this.createTimeout(mod.timeout, mod.id),
        ]);

        // Calculate score from checkpoints if not already set
        if (result.score === null && result.checkpoints.length > 0) {
          result.score = calculateModuleScore(result.checkpoints);
        }

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
   */
  private createTimeout(ms: number, moduleId: ModuleId): Promise<ModuleResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Module ${moduleId} timed out after ${ms}ms`));
      }, ms);
    });
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
   * Run only the synthesis phase with pre-loaded results (for paid tier upgrade).
   * Loads existing M01-M41 results into context, then runs M42-M46.
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
