import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getPostHog } from '@/lib/posthog-server';
import { z } from 'zod';

const RedeemSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});


export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invite code format' }, { status: 400 });
  }

  const { code } = parsed.data;
  const service = createServiceClient();

  // Check if user already redeemed ANY invite code (one invite per account)
  const { data: existingRedemption } = await service
    .from('beta_invite_redemptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (existingRedemption) {
    return NextResponse.json({ error: 'already_redeemed', message: 'Invite already redeemed' }, { status: 409 });
  }

  // Fetch invite and validate
  const { data: invite } = await service
    .from('beta_invites')
    .select('*')
    .eq('code', code)
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'invalid_code', message: 'Invalid invite code' }, { status: 404 });
  }

  if (invite.times_used >= invite.max_uses) {
    return NextResponse.json({ error: 'code_exhausted', message: 'This invite has been fully used' }, { status: 410 });
  }

  // Atomic redemption: insert + UNIQUE(invite_code, user_id) prevents double-redeem
  const { error: insertError } = await service
    .from('beta_invite_redemptions')
    .insert({ invite_code: code, user_id: user.id });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'already_redeemed' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Redemption failed' }, { status: 500 });
  }

  // Increment usage counter
  await service
    .from('beta_invites')
    .update({ times_used: invite.times_used + 1 })
    .eq('code', code);

  // Grant ADDITIONAL credits (signup trigger already gave 1 scan credit)
  const bonusScanCredits = invite.scan_credits - 1;
  const bonusChatCredits = invite.chat_credits;

  await Promise.all([
    bonusScanCredits > 0
      ? service.rpc('add_scan_credits', { p_user_id: user.id, p_amount: bonusScanCredits })
      : Promise.resolve(),
    bonusChatCredits > 0
      ? service.rpc('add_chat_credits', { p_user_id: user.id, p_amount: bonusChatCredits })
      : Promise.resolve(),
  ]);

  // Audit log (fire-and-forget)
  service.from('audit_log').insert({
    user_id: user.id,
    action: 'beta_invite_redeemed',
    metadata: {
      invite_code: code,
      invite_name: invite.name,
      tier: invite.tier,
      scan_credits_granted: bonusScanCredits,
      chat_credits_granted: bonusChatCredits,
    },
  }).then(() => {});

  // PostHog server-side tracking
  const ph = getPostHog();
  if (ph) {
    ph.capture({
      distinctId: user.id,
      event: 'beta_invite_redeemed',
      properties: {
        invite_code: code,
        invite_name: invite.name,
        invite_tier: invite.tier,
        scan_credits_granted: bonusScanCredits,
        chat_credits_granted: bonusChatCredits,
        $set: {
          invite_code: code,
          invite_tier: invite.tier,
          invite_name: invite.name,
          beta_invitee: true,
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    tier: invite.tier,
    name: invite.name,
    scan_credits: invite.scan_credits,
    chat_credits: invite.chat_credits,
  });
}
