import { Queue, type QueueOptions } from 'bullmq';
import { getRedisConnection } from './connection.js';
import type { ModuleTier } from '@marketing-alpha/types';
import pino from 'pino';

const logger = pino({ name: 'scan-queue' });

export const SCAN_QUEUE_NAME = 'scans';

export interface ScanJobData {
  scanId: string;
  url: string;
  domain: string;
  tier: ModuleTier;
  userId: string | null;
  ipAddress: string | null;
  countryCode: string | null;
  createdAt: string;
  synthesisOnly: boolean;
}

export interface ScanJobResult {
  scanId: string;
  status: 'complete' | 'failed';
  marketingIq: number | null;
  modulesCompleted: number;
  modulesFailed: number;
  duration: number;
}

let scanQueue: Queue<ScanJobData, ScanJobResult> | null = null;

/**
 * Get or create the scan BullMQ queue.
 */
export function getScanQueue(): Queue<ScanJobData, ScanJobResult> {
  if (scanQueue) return scanQueue;

  const connection = getRedisConnection();

  const queueOptions: QueueOptions = {
    connection: connection as QueueOptions['connection'],
    defaultJobOptions: {
      removeOnComplete: {
        age: 86_400, // 24 hours
      },
      removeOnFail: {
        age: 604_800, // 7 days
      },
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 30_000, // 30 seconds
      },
    },
  };

  scanQueue = new Queue<ScanJobData, ScanJobResult>(SCAN_QUEUE_NAME, queueOptions);

  logger.info('Scan queue initialized');
  return scanQueue;
}

/**
 * Enqueue a new scan job.
 */
export async function enqueueScanJob(data: ScanJobData): Promise<string> {
  const queue = getScanQueue();

  const jobId = data.synthesisOnly
    ? `${data.scanId}:synth:${Date.now()}`
    : data.scanId;

  const job = await queue.add(`scan:${data.scanId}`, data, {
    jobId,
    priority: data.tier === 'paid' ? 1 : data.tier === 'full' ? 2 : 3,
  });

  logger.info(
    { scanId: data.scanId, jobId: job.id, tier: data.tier },
    'Scan job enqueued',
  );

  return job.id!;
}

/**
 * Get the current depth (waiting + active) of the scan queue.
 */
export async function getQueueDepth(): Promise<number> {
  const queue = getScanQueue();
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
  return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
}

/**
 * Get job state from the queue.
 */
export async function getJobState(
  jobId: string,
): Promise<{
  state: string;
  progress: number;
  data: ScanJobData | null;
  result: ScanJobResult | null;
  failedReason: string | null;
} | null> {
  const queue = getScanQueue();
  const job = await queue.getJob(jobId);

  if (!job) return null;

  const state = await job.getState();

  return {
    state,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    data: job.data,
    result: job.returnvalue ?? null,
    failedReason: job.failedReason ?? null,
  };
}
