import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from './connection.js';
import { SCAN_QUEUE_NAME, type ScanJobData, type ScanJobResult } from './scan-queue.js';
import type { ModuleResult } from '@marketing-alpha/types';
import { ModuleRunner } from '../modules/runner.js';
import {
  updateScanStatus,
  updateScanMarketingIQ,
  getModuleResults,
} from '../services/supabase.js';
import { calculateMarketingIQ } from '../utils/scoring.js';
import { clearTrafficCache } from '../services/dataforseo.js';
import pino from 'pino';

const logger = pino({ name: 'scan-worker' });

let worker: Worker<ScanJobData, ScanJobResult> | null = null;

/**
 * Process a scan job through all phases based on tier.
 *
 * Tier phases:
 *   full = passive + browser + ghostscan + external + M41 synthesis
 *   paid = all phases including M42-M45 synthesis
 */
async function processScanJob(
  job: Job<ScanJobData, ScanJobResult>,
): Promise<ScanJobResult> {
  const { scanId, url, tier, synthesisOnly } = job.data;
  const startTime = Date.now();

  logger.info({ scanId, url, tier, synthesisOnly, jobId: job.id }, 'Processing scan job');

  try {
    // Create the module runner
    const runner = new ModuleRunner(scanId, url, tier);

    let results: Map<string, ModuleResult>;
    let modulesCompleted: number;
    let modulesFailed: number;

    if (synthesisOnly) {
      // Load existing module results from DB (M01-M41 already ran)
      const existingResults = await getModuleResults(scanId);
      const existingMap = new Map(existingResults.map(r => [r.moduleId, r]));

      // Run only the synthesis phase with pre-loaded results
      const synthResult = await runner.runSynthesisOnly(existingMap);
      results = synthResult.results;
      modulesCompleted = synthResult.modulesCompleted;
      modulesFailed = synthResult.modulesFailed;
    } else {
      // Full scan: run all phases
      const fullResult = await runner.run();
      results = fullResult.results;
      modulesCompleted = fullResult.modulesCompleted;
      modulesFailed = fullResult.modulesFailed;
    }

    // Calculate MarketingIQ from all module results (skip for free tier — only 3 modules, score meaningless)
    let marketingIqScore: number | null = null;
    if (tier === 'paid') {
      const moduleResults = Array.from(results.values());
      const marketingIqResult = calculateMarketingIQ(moduleResults);
      marketingIqScore = marketingIqResult.final;

      try {
        await updateScanMarketingIQ(
          scanId,
          marketingIqResult.final,
          marketingIqResult as unknown as Record<string, unknown>,
        );
      } catch (error) {
        logger.error(
          { scanId, error: (error as Error).message },
          'Failed to update MarketingIQ',
        );
      }
    }

    // Mark scan as complete
    await updateScanStatus(scanId, 'complete', {
      ...(marketingIqScore != null ? { marketing_iq: marketingIqScore } : {}),
    });

    const duration = Date.now() - startTime;

    logger.info(
      {
        scanId,
        marketingIq: marketingIqScore,
        modulesCompleted,
        modulesFailed,
        duration,
      },
      'Scan job completed successfully',
    );

    return {
      scanId,
      status: 'complete',
      marketingIq: marketingIqScore,
      modulesCompleted,
      modulesFailed,
      duration,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const duration = Date.now() - startTime;

    logger.error(
      { scanId, error: err.message, duration },
      'Scan job failed',
    );

    // Mark scan as failed
    try {
      await updateScanStatus(scanId, 'failed', {
        error: err.message,
      });
    } catch (updateError) {
      logger.error(
        { scanId, error: (updateError as Error).message },
        'Failed to update scan status to failed',
      );
    }

    return {
      scanId,
      status: 'failed',
      marketingIq: null,
      modulesCompleted: 0,
      modulesFailed: 0,
      duration,
    };
  } finally {
    // Clear any cached API responses for this scan
    clearTrafficCache();
  }
}

/**
 * Start the BullMQ scan worker.
 */
export function startScanWorker(): Worker<ScanJobData, ScanJobResult> {
  if (worker) return worker;

  const connection = getRedisConnection();

  worker = new Worker<ScanJobData, ScanJobResult>(
    SCAN_QUEUE_NAME,
    processScanJob,
    {
      connection,
      concurrency: 1,
      stalledInterval: 60_000,    // Check for stalled jobs every 60s
      lockDuration: 600_000,      // Job lock held for 10 minutes
      lockRenewTime: 300_000,     // Renew lock every 5 minutes
      limiter: {
        max: 1,
        duration: 1_000,
      },
    },
  );

  worker.on('completed', (job, result) => {
    logger.info(
      {
        jobId: job?.id,
        scanId: result?.scanId,
        marketingIq: result?.marketingIq,
        duration: result?.duration,
      },
      'Worker: job completed',
    );
  });

  worker.on('failed', (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        scanId: job?.data?.scanId,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      },
      'Worker: job failed',
    );
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Worker: job stalled');
  });

  worker.on('error', (error) => {
    logger.error({ error: error.message }, 'Worker: error');
  });

  logger.info('Scan worker started');
  return worker;
}

/**
 * Gracefully stop the scan worker.
 */
export async function stopScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Scan worker stopped');
  }
}
