import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/account/delete
 *
 * Permanently delete the authenticated user's account.
 * Uses service role client for admin.deleteUser().
 * Nullifies user_id on scans (preserves cache_source references).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { confirmation: "DELETE" }.' },
        { status: 400 },
      );
    }

    // Verify authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rl = rateLimit(`delete:${user.id}`, 2, 300_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    const userId = user.id;
    const admin = createServiceClient();

    // Nullify user_id on scans (don't delete — preserves cache_source references)
    await admin
      .from('scans')
      .update({ user_id: null })
      .eq('user_id', userId);

    // Delete user-owned records
    await Promise.all([
      admin.from('chat_messages').delete().eq('user_id', userId),
      admin.from('chat_credits').delete().eq('user_id', userId),
      admin.from('payments').delete().eq('user_id', userId),
    ]);

    // Delete the auth user (cascades nothing — we already cleaned up)
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
