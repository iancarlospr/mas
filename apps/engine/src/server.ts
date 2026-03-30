import Fastify from 'fastify';
import cors from '@fastify/cors';
import { hmacAuthHook } from './utils/hmac.js';
import { healthRoutes } from './routes/health.js';
import { scanRoutes } from './routes/scans.js';
import { startScanWorker, stopScanWorker } from './queue/scan-worker.js';
import { closeRedisConnection } from './queue/connection.js';
import { shutdownPostHog } from './utils/posthog.js';
import { isAvailable as cfRenderAvailable } from './services/cloudflare-render.js';
import pino from 'pino';

// Register all module executors (side-effect imports)
import './modules/passive/index.js';
import './modules/browser/index.js';
import './modules/ghostscan/index.js';
import './modules/external/index.js';
import './modules/synthesis/index.js';

const logger = pino({ name: 'engine-server' });

/**
 * Validate that all required environment variables are present.
 * Fails fast at startup instead of failing silently per-scan.
 */
function validateRequiredEnvVars(): void {
  const required = [
    'GOOGLE_AI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ENGINE_HMAC_SECRET',
    'REDIS_URL',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.fatal({ missing }, 'Missing required environment variables — engine cannot start');
    process.exit(1);
  }
}

/**
 * Create and configure the Fastify server.
 */
export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
    requestTimeout: 30_000,
    bodyLimit: 1_048_576, // 1MB
  });

  // Register CORS
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN']
      ? process.env['CORS_ORIGIN'].split(',')
      : process.env['NODE_ENV'] === 'production'
        ? ['https://marketingalphascan.com', 'https://www.marketingalphascan.com']
        : true,
    methods: ['GET', 'POST'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Engine-Signature',
      'X-Engine-Timestamp',
    ],
    maxAge: 86400,
  });

  // Register HMAC auth hook on all routes (skips /engine/health)
  fastify.addHook('preHandler', hmacAuthHook);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(scanRoutes);

  // Global error handler
  fastify.setErrorHandler((_error, request, reply) => {
    const error = _error as Error & { statusCode?: number };
    request.log.error({ error: error.message, stack: error.stack }, 'Unhandled error');

    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      statusCode,
    });
  });

  // Not found handler
  fastify.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Not Found', statusCode: 404 });
  });

  return fastify;
}

/**
 * Start the server and scan worker.
 */
async function start(): Promise<void> {
  // Fail fast if critical env vars are missing
  validateRequiredEnvVars();

  const port = parseInt(process.env['PORT'] ?? '3001', 10);
  const host = process.env['HOST'] ?? '0.0.0.0';

  const fastify = await buildServer();

  // Start the BullMQ scan worker
  startScanWorker();
  logger.info('Scan worker started');

  // Log Cloudflare Browser Rendering availability
  logger.info({ cloudflare_render: cfRenderAvailable() }, 'Cloudflare Browser Rendering status');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    try {
      // Stop accepting new connections
      await fastify.close();
      logger.info('HTTP server closed');

      // Stop the scan worker (wait for current job to finish)
      await stopScanWorker();
      logger.info('Scan worker stopped');

      // Flush PostHog events
      await shutdownPostHog();
      logger.info('PostHog flushed');

      // Close Redis connection
      await closeRedisConnection();
      logger.info('Redis connection closed');

      process.exit(0);
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal(
      { reason: reason instanceof Error ? reason.message : String(reason) },
      'Unhandled rejection',
    );
    process.exit(1);
  });

  try {
    await fastify.listen({ port, host });
    logger.info({ port, host }, 'Engine server started');
  } catch (error) {
    logger.fatal({ error: (error as Error).message }, 'Failed to start server');
    process.exit(1);
  }
}

start();
// deploy trigger
