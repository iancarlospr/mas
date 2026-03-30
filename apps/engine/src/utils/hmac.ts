import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

const MAX_AGE_MS = 30_000; // 30 seconds

/**
 * Computes HMAC-SHA256 signature for request authentication.
 * Payload format: `${timestamp}.${method}.${url}.${bodyHash}`
 */
export function computeHmac(
  secret: string,
  timestamp: string,
  method: string,
  url: string,
  bodyHash: string,
): string {
  const payload = `${timestamp}.${method}.${url}.${bodyHash}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Computes SHA-256 hash of the request body.
 */
export function hashBody(body: string | Buffer | undefined): string {
  if (!body || (typeof body === 'string' && body.length === 0)) {
    return createHmac('sha256', '').update('').digest('hex');
  }
  const data = typeof body === 'string' ? body : body.toString('utf-8');
  return createHmac('sha256', '').update(data).digest('hex');
}

/**
 * Validates HMAC-SHA256 signature on an incoming request.
 * Returns true if the signature is valid and within the time window.
 */
export function validateHmac(
  secret: string,
  signature: string,
  timestamp: string,
  method: string,
  url: string,
  bodyHash: string,
): boolean {
  // Reject requests older than MAX_AGE_MS
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) return false;

  const now = Date.now();
  if (Math.abs(now - requestTime) > MAX_AGE_MS) {
    return false;
  }

  const expected = computeHmac(secret, timestamp, method, url, bodyHash);

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Fastify preHandler hook that validates HMAC authentication on all
 * routes except the health check endpoint.
 */
export async function hmacAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip auth for health check
  if (request.url === '/engine/health') {
    return;
  }

  const secret = process.env['ENGINE_HMAC_SECRET'];
  if (!secret) {
    request.log.error('ENGINE_HMAC_SECRET not configured');
    reply.code(500).send({ error: 'Server misconfiguration' });
    return;
  }

  const signature = request.headers['x-engine-signature'] as string | undefined;
  const timestamp = request.headers['x-engine-timestamp'] as string | undefined;

  if (!signature || !timestamp) {
    reply.code(401).send({ error: 'Missing authentication headers' });
    return;
  }

  const rawBody = request.body
    ? JSON.stringify(request.body)
    : '';
  const bodyHash = hashBody(rawBody);

  const isValid = validateHmac(
    secret,
    signature,
    timestamp,
    request.method,
    request.url,
    bodyHash,
  );

  if (!isValid) {
    reply.code(401).send({ error: 'Invalid signature or expired request' });
    return;
  }
}
