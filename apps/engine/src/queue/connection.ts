import IORedis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'redis-connection' });

let connection: IORedis | null = null;

/**
 * Get or create the shared Redis/IORedis connection for BullMQ.
 * Uses REDIS_URL from environment.
 */
export function getRedisConnection(): IORedis {
  if (connection) return connection;

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      logger.warn({ times, delay }, 'Redis connection retry');
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  connection.on('connect', () => {
    logger.info('Redis connected');
  });

  connection.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis connection error');
  });

  connection.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return connection;
}

/**
 * Check if the Redis connection is healthy.
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
    logger.info('Redis connection closed gracefully');
  }
}
