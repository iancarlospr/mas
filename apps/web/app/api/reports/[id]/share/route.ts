import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateShareToken } from '@/lib/report/share';
import { getPostHog } from '@/lib/posthog-server';
import { rateLimit } from '@/lib/rate-limit';
import { isValidUUID } from '@/lib/utils';

/** POST /api/reports/:id/share — generate a shareable report URL */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  if (!isValidUUID(scanId)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`share:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    getPostHog()?.capture({ distinctId: user.id, event: 'rate_limit_hit', properties: { endpoint: 'share' } });
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // Verify scan exists and is paid
  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const token = await generateShareToken(scanId);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';
  const url = `${baseUrl}/report/${scanId}?share=${token}`;

  return NextResponse.json({ url, token });
}
