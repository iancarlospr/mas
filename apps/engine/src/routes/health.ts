import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkRedisHealth } from '../queue/connection.js';
import { getQueueDepth } from '../queue/scan-queue.js';
import { BrowserPool } from '../ghostscan/browser-pool.js';

// Shared browser pool reference for health checks
const healthCheckBrowserPool = new BrowserPool();

interface HealthResponse {
  engine: 'ok' | 'error';
  redis: 'ok' | 'error';
  browser: 'ok' | 'idle' | 'error';
  memory_rss_mb: number;
  memory_heap_mb: number;
  uptime_seconds: number;
  queue_depth: number;
  config: {
    gemini: boolean;
    supabase: boolean;
    redis: boolean;
  };
}

/**
 * Register the health check route.
 * GET /engine/health -- returns engine status, redis status, browser status,
 * memory usage, uptime, and queue depth.
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/engine/health',
    async (_request: FastifyRequest, reply: FastifyReply): Promise<HealthResponse> => {
      const memory = process.memoryUsage();
      const rssMb = Math.round((memory.rss / 1024 / 1024) * 100) / 100;
      const heapMb = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;
      const uptimeSeconds = Math.round(process.uptime());

      // Check Redis
      let redisStatus: 'ok' | 'error' = 'error';
      try {
        const isHealthy = await checkRedisHealth();
        redisStatus = isHealthy ? 'ok' : 'error';
      } catch {
        redisStatus = 'error';
      }

      // Check browser pool status
      let browserStatus: 'ok' | 'idle' | 'error' = 'idle';
      try {
        if (healthCheckBrowserPool.isHealthy()) {
          browserStatus = 'ok';
        }
      } catch {
        browserStatus = 'error';
      }

      // Get queue depth
      let queueDepth = 0;
      try {
        queueDepth = await getQueueDepth();
      } catch {
        // Queue might not be initialized yet
      }

      const response: HealthResponse = {
        engine: 'ok',
        redis: redisStatus,
        browser: browserStatus,
        memory_rss_mb: rssMb,
        memory_heap_mb: heapMb,
        uptime_seconds: uptimeSeconds,
        queue_depth: queueDepth,
        config: {
          gemini: !!process.env['GOOGLE_AI_API_KEY'],
          supabase: !!process.env['SUPABASE_URL'],
          redis: !!process.env['REDIS_URL'],
        },
      };

      // Return 503 if Redis is down
      if (redisStatus === 'error') {
        reply.code(503);
      }

      return response;
    },
  );

  // Admin health check (detailed, requires API key)
  fastify.get(
    '/engine/admin/health',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = request.headers['x-api-key'];
      if (apiKey !== process.env['ENGINE_API_KEY'] && apiKey !== process.env['ADMIN_TOKEN']) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const memory = process.memoryUsage();
      let queueDepth = 0;
      try {
        queueDepth = await getQueueDepth();
      } catch {
        // Queue might not be initialized
      }

      return {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        node: process.version,
        memory: {
          rss: Math.round(memory.rss / 1024 / 1024),
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
          external: Math.round(memory.external / 1024 / 1024),
          unit: 'MB',
        },
        queue: { depth: queueDepth },
      };
    },
  );
}
