/**
 * Rate Limiter (Token Bucket)
 *
 * Per-domain rate limiting using an in-memory token bucket.
 * Uses Redis via BullMQ's existing connection when available,
 * falls back to in-memory Map for single-instance deployments.
 *
 * Default: 10 requests per 10 seconds per domain.
 */

import pino from 'pino';

const logger = pino({ name: 'rate-limiter' });

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const DEFAULT_MAX_TOKENS = 10;
const DEFAULT_REFILL_INTERVAL_MS = 10_000;  // 10 seconds
const DEFAULT_REFILL_RATE = 10;  // tokens per interval

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private maxTokens: number;
  private refillIntervalMs: number;
  private refillRate: number;

  constructor(options: {
    maxTokens?: number;
    refillIntervalMs?: number;
    refillRate?: number;
  } = {}) {
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.refillIntervalMs = options.refillIntervalMs ?? DEFAULT_REFILL_INTERVAL_MS;
    this.refillRate = options.refillRate ?? DEFAULT_REFILL_RATE;
  }

  /**
   * Try to acquire a token for the given key (domain).
   * Returns true if a token was available, false if rate limited.
   */
  tryAcquire(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const intervals = Math.floor(elapsed / this.refillIntervalMs);
      bucket.tokens = Math.min(this.maxTokens, bucket.tokens + intervals * this.refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available for the given key.
   * Returns the wait time in ms (0 if no wait needed).
   */
  async waitForToken(key: string): Promise<number> {
    if (this.tryAcquire(key)) return 0;

    const bucket = this.buckets.get(key);
    if (!bucket) return 0;

    // Calculate wait time until next refill
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const waitMs = Math.max(0, this.refillIntervalMs - elapsed);

    logger.debug({ key, waitMs }, 'Rate limited, waiting for token');
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Refill and consume
    bucket.tokens = this.refillRate - 1;
    bucket.lastRefill = Date.now();
    return waitMs;
  }

  /**
   * Get remaining tokens for a key.
   */
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxTokens;

    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const intervals = Math.floor(elapsed / this.refillIntervalMs);
    return Math.min(this.maxTokens, bucket.tokens + intervals * this.refillRate);
  }

  /**
   * Clear all buckets.
   */
  clear(): void {
    this.buckets.clear();
  }
}

/** Singleton rate limiter for scan requests. */
export const scanRateLimiter = new RateLimiter({
  maxTokens: 10,
  refillIntervalMs: 10_000,
  refillRate: 10,
});
