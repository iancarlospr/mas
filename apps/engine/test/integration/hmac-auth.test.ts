import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { hmacAuthHook } from '../../src/utils/hmac.js';

const SECRET = 'test-hmac-secret-64chars-0000000000000000000000000000000000000000';

function hashBody(body: string): string {
  return createHmac('sha256', '').update(body).digest('hex');
}

function signRequest(
  timestamp: string,
  method: string,
  url: string,
  body: string,
): string {
  const bodyH = hashBody(body);
  const payload = `${timestamp}.${method}.${url}.${bodyH}`;
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

describe('HMAC Authentication Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env['ENGINE_HMAC_SECRET'] = SECRET;

    app = Fastify({ logger: false });
    app.addHook('preHandler', hmacAuthHook);

    app.post('/api/scan', async () => {
      return { status: 'accepted' };
    });

    app.get('/engine/health', async () => {
      return { status: 'ok' };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    delete process.env['ENGINE_HMAC_SECRET'];
  });

  it('should accept valid HMAC signature', async () => {
    const body = JSON.stringify({ url: 'https://example.com' });
    const timestamp = Date.now().toString();
    const signature = signRequest(timestamp, 'POST', '/api/scan', body);

    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: {
        'content-type': 'application/json',
        'x-engine-signature': signature,
        'x-engine-timestamp': timestamp,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'accepted' });
  });

  it('should reject invalid HMAC signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: {
        'content-type': 'application/json',
        'x-engine-signature': 'a'.repeat(64),
        'x-engine-timestamp': Date.now().toString(),
      },
      payload: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject expired timestamps (>30s old)', async () => {
    const body = JSON.stringify({ url: 'https://example.com' });
    const oldTimestamp = (Date.now() - 60_000).toString(); // 60 seconds ago
    const signature = signRequest(oldTimestamp, 'POST', '/api/scan', body);

    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: {
        'content-type': 'application/json',
        'x-engine-signature': signature,
        'x-engine-timestamp': oldTimestamp,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining('Invalid signature'),
    });
  });

  it('should reject requests with missing signature header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/scan',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ url: 'https://example.com' }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining('Missing authentication'),
    });
  });

  it('should skip auth for health check endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/engine/health',
    });

    expect(response.statusCode).toBe(200);
  });
});
