import { NextRequest, NextResponse } from 'next/server';
import { engineFetch } from '@/lib/engine';

export async function GET(request: NextRequest) {
  let engineOk = false;
  let engineError: string | null = null;
  try {
    const res = await engineFetch('/engine/health');
    engineOk = res.ok;
    if (!res.ok) {
      engineError = await res.text().catch(() => null);
    }
  } catch (err: unknown) {
    engineError = err instanceof Error ? err.message : String(err);
  }

  // Public: minimal status (no internal architecture details)
  const isAdmin = request.headers.get('x-admin-token') === process.env.ADMIN_TOKEN;

  if (!isAdmin) {
    return NextResponse.json({
      status: 'ok',
      engine: engineOk ? 'ok' : 'degraded',
    });
  }

  // Admin: full diagnostics
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    engine: {
      url: process.env.ENGINE_URL ?? '(not set)',
      hmacSecretSet: !!process.env.ENGINE_HMAC_SECRET,
      status: engineOk ? 'ok' : 'error',
      error: engineError,
    },
  });
}
