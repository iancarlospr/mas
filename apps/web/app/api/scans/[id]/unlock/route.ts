import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { engineFetch } from '@/lib/engine';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/scans/[id]/unlock
 *
 * Deducts 1 scan credit from the user's balance and upgrades the scan
 * to paid tier, triggering a full scan on the engine.
 *
 * Used when user already has scan credits (from a previous purchase).
 * If no credits available, frontend should redirect to Stripe checkout instead.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const rl = rateLimit(`unlock:${user.id}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // Verify scan ownership
  const { data: scan } = await supabase
    .from('scans')
    .select('id, user_id, tier, status')
    .eq('id', scanId)
    .single();

  if (!scan || (scan.user_id && scan.user_id !== user.id)) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.tier === 'paid') {
    return NextResponse.json({ error: 'Scan is already upgraded' }, { status: 400 });
  }

  if (scan.status === 'failed' || scan.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot unlock a failed scan' }, { status: 400 });
  }

  // Use service client for credit operations (bypasses RLS)
  const service = createServiceClient();

  // Atomically deduct 1 scan credit (prevents double-spend race condition)
  const { data: creditResult, error: creditError } = await service
    .rpc('decrement_scan_credits', { p_user_id: user.id, p_amount: 1 });

  if (creditError) {
    // "Insufficient scan credits" or no row — user has 0 credits
    return NextResponse.json({ error: 'No scan credits available' }, { status: 402 });
  }

  const creditsRemaining = creditResult as number;

  // Upgrade scan tier
  await service
    .from('scans')
    .update({ tier: 'paid' })
    .eq('id', scanId);

  // Trigger full scan on engine
  await engineFetch('/engine/scans', {
    method: 'POST',
    body: JSON.stringify({
      scanId,
      url: '',
      domain: '',
      tier: 'paid',
      synthesisOnly: false,
    }),
  });

  // Audit log (fire-and-forget)
  service.from('audit_log').insert({
    user_id: user.id,
    action: 'scan_credit_used',
    resource: scanId,
    metadata: { credits_remaining: creditsRemaining },
  }).then(({ error: auditErr }) => {
    if (auditErr) console.error('[unlock] Audit log failed:', auditErr);
  });

  return NextResponse.json({
    unlocked: true,
    creditsRemaining,
  });
}
