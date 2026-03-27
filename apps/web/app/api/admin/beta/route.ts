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

  // Fetch all invites + redemptions + user info + scan counts + chat counts in parallel
  const [invitesRes, redemptionsRes, scansRes, chatRes] = await Promise.all([
    supabase
      .from('beta_invites')
      .select('code, name, tier, scan_credits, chat_credits, max_uses, times_used, created_at')
      .order('name'),
    supabase
      .from('beta_invite_redemptions')
      .select('invite_code, user_id, redeemed_at'),
    supabase
      .from('scans')
      .select('user_id, status, tier, marketing_iq, created_at, url, domain'),
    supabase
      .from('chat_messages')
      .select('user_id, role, created_at'),
  ]);

  const invites = invitesRes.data ?? [];
  const redemptions = redemptionsRes.data ?? [];
  const scans = scansRes.data ?? [];
  const chatMessages = chatRes.data ?? [];

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

  // Build scan stats per user (with domains list)
  const userScans: Record<string, { total: number; completed: number; paid: number; domains: string[] }> = {};
  for (const s of scans) {
    if (!s.user_id) continue;
    if (!userScans[s.user_id]) {
      userScans[s.user_id] = { total: 0, completed: 0, paid: 0, domains: [] };
    }
    const stats = userScans[s.user_id]!;
    stats.total++;
    if (s.status === 'complete') stats.completed++;
    if (s.tier === 'paid') stats.paid++;
    const domain = s.domain || (() => { try { return new URL(s.url).hostname; } catch { return ''; } })();
    if (domain && !stats.domains.includes(domain)) stats.domains.push(domain);
  }

  // Build chat message counts per user
  const userChats: Record<string, number> = {};
  for (const m of chatMessages) {
    if (!m.user_id || m.role !== 'user') continue;
    userChats[m.user_id] = (userChats[m.user_id] ?? 0) + 1;
  }

  // Calculate time on site per user (time between first and last scan/chat activity)
  const userTimeline: Record<string, { first: string; last: string }> = {};
  for (const s of scans) {
    if (!s.user_id || !userIds.includes(s.user_id)) continue;
    if (!userTimeline[s.user_id]) {
      userTimeline[s.user_id] = { first: s.created_at, last: s.created_at };
    }
    if (s.created_at < userTimeline[s.user_id]!.first) userTimeline[s.user_id]!.first = s.created_at;
    if (s.created_at > userTimeline[s.user_id]!.last) userTimeline[s.user_id]!.last = s.created_at;
  }
  for (const m of chatMessages) {
    if (!m.user_id || !userIds.includes(m.user_id)) continue;
    if (!userTimeline[m.user_id]) {
      userTimeline[m.user_id] = { first: m.created_at, last: m.created_at };
    }
    if (m.created_at < userTimeline[m.user_id]!.first) userTimeline[m.user_id]!.first = m.created_at;
    if (m.created_at > userTimeline[m.user_id]!.last) userTimeline[m.user_id]!.last = m.created_at;
  }

  // Assemble invite dossiers
  const dossiers = invites.map((inv) => {
    const redemption = redemptions.find((r) => r.invite_code === inv.code);
    const userId = redemption?.user_id;
    const user = userId ? users[userId] : null;
    const scanStats = userId ? userScans[userId] ?? null : null;
    const chatCount = userId ? userChats[userId] ?? 0 : 0;
    const timeline = userId ? userTimeline[userId] : null;

    // Time on site: difference between first and last activity
    let timeOnSiteMin: number | null = null;
    if (timeline) {
      const diffMs = new Date(timeline.last).getTime() - new Date(timeline.first).getTime();
      timeOnSiteMin = Math.round(diffMs / 60_000);
    }

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
            domains: scanStats.domains,
          }
        : null,
      chatMessages: chatCount,
      timeOnSiteMin,
    };
  });

  const totalChatMessages = Object.values(userChats).reduce((sum, c) => sum + c, 0);

  const stats = {
    total: invites.length,
    redeemed: dossiers.filter((d) => d.redeemed).length,
    pending: dossiers.filter((d) => !d.redeemed).length,
    totalScans: scans.filter((s) => userIds.includes(s.user_id)).length,
    totalChats: totalChatMessages,
  };

  return NextResponse.json({ stats, dossiers });
}
