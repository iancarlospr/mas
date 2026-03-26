import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? process.env.ENGINE_HMAC_SECRET;

export async function GET(request: NextRequest) {
  // Simple token auth — not meant for public access
  const token = request.headers.get('x-admin-token')
    ?? request.nextUrl.searchParams.get('token');
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all invites + redemptions + user info + scan counts in parallel
  const [invitesRes, redemptionsRes, scansRes] = await Promise.all([
    supabase
      .from('beta_invites')
      .select('code, name, tier, scan_credits, chat_credits, max_uses, times_used, created_at')
      .order('name'),
    supabase
      .from('beta_invite_redemptions')
      .select('invite_code, user_id, redeemed_at'),
    supabase
      .from('scans')
      .select('user_id, status, tier, marketing_iq, created_at'),
  ]);

  const invites = invitesRes.data ?? [];
  const redemptions = redemptionsRes.data ?? [];
  const scans = scansRes.data ?? [];

  // Build user lookup from redemptions
  const userIds = [...new Set(redemptions.map((r) => r.user_id))];

  // Fetch user details from auth.users via admin API
  let users: Record<string, { email: string; name: string; created_at: string }> = {};
  if (userIds.length > 0) {
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 100 });
    if (authData?.users) {
      for (const u of authData.users) {
        if (userIds.includes(u.id)) {
          users[u.id] = {
            email: u.email ?? '',
            name: u.user_metadata?.name ?? u.user_metadata?.full_name ?? '',
            created_at: u.created_at,
          };
        }
      }
    }
  }

  // Build scan stats per user
  const userScans: Record<string, { total: number; completed: number; paid: number; avgIq: number | null }> = {};
  for (const s of scans) {
    if (!s.user_id) continue;
    if (!userScans[s.user_id]) {
      userScans[s.user_id] = { total: 0, completed: 0, paid: 0, avgIq: null };
    }
    const stats = userScans[s.user_id]!;
    stats.total++;
    if (s.status === 'complete') stats.completed++;
    if (s.tier === 'paid') stats.paid++;
  }

  // Assemble invite dossiers
  const dossiers = invites.map((inv) => {
    const redemption = redemptions.find((r) => r.invite_code === inv.code);
    const user = redemption ? users[redemption.user_id] : null;
    const scanStats = redemption ? userScans[redemption.user_id] ?? null : null;

    return {
      code: inv.code,
      name: inv.name,
      tier: inv.tier,
      credits: { scans: inv.scan_credits, chat: inv.chat_credits },
      redeemed: !!redemption,
      redeemedAt: redemption?.redeemed_at ?? null,
      user: user
        ? {
            email: user.email,
            name: user.name,
            joinedAt: user.created_at,
          }
        : null,
      activity: scanStats
        ? {
            scansRun: scanStats.total,
            scansCompleted: scanStats.completed,
            scansPaid: scanStats.paid,
          }
        : null,
    };
  });

  const stats = {
    total: invites.length,
    redeemed: dossiers.filter((d) => d.redeemed).length,
    pending: dossiers.filter((d) => !d.redeemed).length,
    totalScans: scans.filter((s) => userIds.includes(s.user_id)).length,
  };

  return NextResponse.json({ stats, dossiers });
}
