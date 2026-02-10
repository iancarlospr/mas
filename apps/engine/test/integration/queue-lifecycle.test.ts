import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Queue, Worker, QueueEvents } from 'bullmq';

/**
 * BullMQ Queue Lifecycle Integration Tests
 *
 * These tests require a running Redis instance.
 * In CI: GitHub Actions Redis service on localhost:6379
 * Locally: docker-compose.dev.yml or `docker run -p 6379:6379 redis:7-alpine`
 *
 * Set REDIS_URL env var to override connection.
 */
describe('BullMQ Scan Queue Lifecycle', () => {
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
  };

  let queue: Queue;
  let queueEvents: QueueEvents;

  beforeAll(async () => {
    queue = new Queue('scan-test', { connection });
    queueEvents = new QueueEvents('scan-test', { connection });
  }, 30_000);

  afterAll(async () => {
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  beforeEach(async () => {
    await queue.drain();
  });

  it('should enqueue a scan job and process it', async () => {
    const worker = new Worker(
      'scan-test',
      async (job) => {
        expect(job.data).toMatchObject({ url: 'https://example.com' });
        await job.updateProgress({ phase: 1, module: 'M01', status: 'running' });
        await job.updateProgress({ phase: 1, module: 'M01', status: 'complete' });
        return { scanId: 'test-123', status: 'complete' };
      },
      { connection },
    );

    const job = await queue.add('scan', {
      url: 'https://example.com',
      userId: 'user-123',
      scanId: 'test-123',
    });

    const result = await job.waitUntilFinished(queueEvents, 10_000);

    expect(result).toMatchObject({
      scanId: 'test-123',
      status: 'complete',
    });

    await worker.close();
  });

  it('should handle job failure and retry', async () => {
    let attempts = 0;

    const worker = new Worker(
      'scan-test',
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return { status: 'complete' };
      },
      { connection },
    );

    const job = await queue.add(
      'scan',
      { url: 'https://example.com' },
      { attempts: 3, backoff: { type: 'fixed', delay: 100 } },
    );

    const result = await job.waitUntilFinished(queueEvents, 15_000);
    expect(result).toMatchObject({ status: 'complete' });
    expect(attempts).toBe(3);

    await worker.close();
  });

  it('should emit progress events for SSE streaming', async () => {
    const progressUpdates: any[] = [];

    const worker = new Worker(
      'scan-test',
      async (job) => {
        for (const phase of [1, 2, 3, 4, 5]) {
          await job.updateProgress({ phase, status: 'running' });
          await new Promise((r) => setTimeout(r, 10));
          await job.updateProgress({ phase, status: 'complete' });
        }
        return { status: 'complete' };
      },
      { connection },
    );

    const job = await queue.add('scan', { url: 'https://example.com' });

    queueEvents.on('progress', ({ jobId, data }) => {
      if (jobId === job.id) {
        progressUpdates.push(data);
      }
    });

    await job.waitUntilFinished(queueEvents, 10_000);

    expect(progressUpdates.length).toBeGreaterThanOrEqual(10);
    expect(progressUpdates[0]).toMatchObject({ phase: 1, status: 'running' });

    await worker.close();
  });
});
