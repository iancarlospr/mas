import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createScan, ScanError } from '@/lib/scan-service';
import { z } from 'zod';

const CreateScanSchema = z.object({
  url: z.string().url(),
  turnstileToken: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = CreateScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { url, turnstileToken } = parsed.data;

  if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
    console.error('[scans] TURNSTILE_SECRET_KEY not set in production');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Verify Turnstile token (skip for auto-scan after email verification —
  // the user is already authenticated and rate-limited to 4/day)
  if (process.env.TURNSTILE_SECRET_KEY && turnstileToken) {
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

  // Get user session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
