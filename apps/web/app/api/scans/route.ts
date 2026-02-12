import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { engineFetch } from '@/lib/engine';
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

  // Verify Turnstile token
  if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
    console.error('[scans] TURNSTILE_SECRET_KEY not set in production');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (process.env.TURNSTILE_SECRET_KEY) {
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

  // Get user session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Extract domain
  const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  const tier = user ? 'full' : 'peek';

  // Get IP and country
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const countryCode = request.headers.get('cf-ipcountry')
    ?? request.headers.get('x-vercel-ip-country')
    ?? null;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  // Count ALL scans (cached and fresh) to prevent abuse
  const { count } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq(user ? 'user_id' : 'ip_address', user ? user.id : ip)
    .gte('created_at', dayStart.toISOString());

  const limit = user ? 4 : 2;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: 'Daily scan limit reached', limit, used: count },
      { status: 429 },
    );
  }

  // Check cache
  const { data: cached } = await supabase
    .from('scans')
    .select('id, tier, status, marketing_iq, created_at')
    .eq('domain', domain)
    .gte('tier', tier)
    .eq('status', 'complete')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    // Return cached scan
    const { data: newScan } = await supabase
      .from('scans')
      .insert({
        user_id: user?.id ?? null,
        url,
        domain,
        tier,
        status: 'complete',
        marketing_iq: cached.marketing_iq,
        cache_source: cached.id,
        ip_address: ip,
        country_code: countryCode,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return NextResponse.json({ scanId: newScan?.id ?? cached.id, cached: true });
  }

  // Create scan record
  const { data: scan, error } = await supabase
    .from('scans')
    .insert({
      user_id: user?.id ?? null,
      url,
      domain,
      tier,
      status: 'queued',
      ip_address: ip,
      country_code: countryCode,
    })
    .select('id')
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 });
  }

  // Forward to engine
  const engineRes = await engineFetch('/engine/scans', {
    method: 'POST',
    body: JSON.stringify({ scanId: scan.id, url, domain, tier }),
  });

  if (!engineRes.ok) {
    await supabase
      .from('scans')
      .update({ status: 'failed' })
      .eq('id', scan.id);
    return NextResponse.json({ error: 'Scan engine unavailable' }, { status: 503 });
  }

  // Audit log (non-critical)
  supabase.from('audit_log').insert({
    user_id: user?.id ?? null,
    action: 'scan_created',
    resource: scan.id,
    ip_address: ip,
    metadata: { url, domain, tier, cached: false },
  }).then(({ error: auditErr }) => {
    if (auditErr) console.error('[scans] Audit log failed:', auditErr);
  });

  return NextResponse.json({ scanId: scan.id, cached: false });
}
