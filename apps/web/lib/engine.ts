import crypto from 'crypto';

const ENGINE_URL = process.env.ENGINE_URL!;
const HMAC_SECRET = process.env.ENGINE_HMAC_SECRET!;

function hashBody(body: string): string {
  if (!body || body.length === 0) {
    return crypto.createHmac('sha256', '').update('').digest('hex');
  }
  return crypto.createHmac('sha256', '').update(body).digest('hex');
}

function signRequest(method: string, url: string, body: string): { signature: string; timestamp: string } {
  const timestamp = Date.now().toString();
  const bodyHash = hashBody(body);
  const payload = `${timestamp}.${method}.${url}.${bodyHash}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return { signature, timestamp };
}

export async function engineFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${ENGINE_URL}${path}`;
  const method = options.method ?? 'GET';
  const body = typeof options.body === 'string' ? options.body : '';
  const { signature, timestamp } = signRequest(method, path, body);

  console.log(`[engineFetch] ${method} ${url} (ENGINE_URL=${ENGINE_URL}, HMAC_SECRET=${HMAC_SECRET ? 'set' : 'MISSING'})`);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'x-engine-signature': signature,
      'x-engine-timestamp': timestamp,
    },
  });
}
