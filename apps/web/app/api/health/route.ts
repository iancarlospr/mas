import { NextResponse } from 'next/server';
import { engineFetch } from '@/lib/engine';

export async function GET() {
  const engineUrl = process.env.ENGINE_URL ?? '(not set)';
  const hmacSet = !!process.env.ENGINE_HMAC_SECRET;

  let engineStatus = 'unknown';
  let engineError = null;
  try {
    const res = await engineFetch('/engine/health');
    engineStatus = `${res.status} ${res.statusText}`;
    if (!res.ok) {
      engineError = await res.text().catch(() => null);
    }
  } catch (err: unknown) {
    engineStatus = 'fetch_failed';
    engineError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    engine: {
      url: engineUrl,
      hmacSecretSet: hmacSet,
      hmacSecretLength: (process.env.ENGINE_HMAC_SECRET ?? '').length,
      status: engineStatus,
      error: engineError,
    },
  });
}
