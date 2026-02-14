import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** GET /auth/confirm — Email verification handler (signup, magiclink, recovery).
 *  Mirrors /auth/callback/route.ts — cookies WORK in Route Handlers
 *  (unlike Server Components where cookieStore.set() is silently ignored). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'signup' | 'magiclink' | 'recovery' | null;
  const redirectTo = searchParams.get('redirect_to') ?? '/history';

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/auth/error?message=invalid_link', origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(new URL('/auth/error?message=verification_failed', origin));
  }

  // For signup: fire-and-forget welcome email
  if (type === 'signup') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;
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
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
