import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/** GET /api/auth/check-verified?userId=<uuid>
 *
 *  Lightweight endpoint that checks if a user's email is confirmed.
 *  Used by AuthGatePoller to detect cross-tab/cross-device email verification
 *  without storing passwords or hammering Supabase auth with signInWithPassword.
 *
 *  Security:
 *  - userId is a UUID — not enumerable
 *  - Returns only { confirmed: boolean } — no user data leaked
 *  - Service role used server-side only (never exposed to client)
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ confirmed: false }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !user) {
    return NextResponse.json({ confirmed: false });
  }

  return NextResponse.json({ confirmed: user.email_confirmed_at != null });
}
