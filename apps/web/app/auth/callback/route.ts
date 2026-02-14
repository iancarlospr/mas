import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** GET /auth/callback — OAuth callback handler.
 *  After OAuth success, Supabase redirects here with a code. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect_to') ?? '/history';

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?message=invalid_link', origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/auth/error?message=verification_failed', origin));
  }

  // Check if this is a new user (OAuth) — send welcome email
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;
    // Fire-and-forget welcome email for new OAuth users
    fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({
        template: 'welcome',
        userId: user.id,
        data: { email: user.email },
      }),
    }).catch(() => {});
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
