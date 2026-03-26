import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createScan, ScanError } from '@/lib/scan-service';
import { getPostHog } from '@/lib/posthog-server';
import { z } from 'zod';

const CreateScanSchema = z.object({
  url: z.string().url(),
  turnstileToken: z.string(),
  /** Auto-scan after email verification — skips Turnstile (verified server-side via recent sign-in) */
  autoScan: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = CreateScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { url, turnstileToken, autoScan } = parsed.data;

  // SSRF protection: reject private IPs, cloud metadata, reserved hostnames
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const isPrivateIP = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(hostname)
      || hostname === '::1' || hostname === 'localhost';
    const isReservedHost = hostname.endsWith('.local') || hostname.endsWith('.internal')
      || hostname.endsWith('.test') || hostname.endsWith('.invalid');
    if (isPrivateIP || isReservedHost) {
      return NextResponse.json({ error: 'Invalid URL — private or reserved addresses are not allowed' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Get user session first (needed for auto-scan verification)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Feature flag kill switch — disable all scans without deploy
  const ph = getPostHog();
  if (ph) {
    const killScans = await ph.isFeatureEnabled('kill-switch-scans', user.id);
    if (killScans) {
      return NextResponse.json({ error: 'Scans are temporarily disabled' }, { status: 503 });
    }
  }

  if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
    console.error('[scans] TURNSTILE_SECRET_KEY not set in production');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Auto-scan bypass: only allowed if user signed in within last 60 seconds
  // (post-email-verification flow). This is the user's free scan.
  let skipTurnstile = false;
  if (autoScan && user.last_sign_in_at) {
    const signInAge = Date.now() - new Date(user.last_sign_in_at).getTime();
    skipTurnstile = signInAge < 60_000;
  }

  // Verify Turnstile token (required unless auto-scan bypass)
  if (!skipTurnstile && process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return NextResponse.json({ error: 'Security verification required' }, { status: 403 });
    }
    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
      }),
    });
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      return NextResponse.json({ error: 'Security verification failed' }, { status: 403 });
    }
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const countryCode = request.headers.get('cf-ipcountry')
    ?? request.headers.get('x-vercel-ip-country')
    ?? null;

  try {
    const result = await createScan({
      supabase,
      userId: user.id,
      url,
      ip,
      countryCode,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScanError) {
      return NextResponse.json(
        { error: err.message, ...err.details },
        { status: err.status },
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
