import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** GET /auth/confirm — Email verification handler (signup, magiclink, recovery).
 *  Uses the request/response dual-write cookie pattern (same as middleware)
 *  to ensure auth cookies persist on the redirect/HTML response. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'signup' | 'magiclink' | 'recovery' | null;
  const redirectTo = searchParams.get('redirect_to') ?? '/';

  if (!tokenHash || !type) {
    console.error('[auth/confirm] Missing token_hash or type');
    return NextResponse.redirect(new URL('/auth/error?message=invalid_link', origin));
  }

  const redirectUrl = new URL(redirectTo, origin);

  // Pre-construct redirect response so setAll writes cookies directly onto it
  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.redirect(redirectUrl);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    console.error(`[auth/confirm] verifyOtp failed (type=${type}):`, error.message);
    return NextResponse.redirect(new URL('/auth/error?message=verification_failed', origin));
  }

  // Get user for welcome email
  const { data: { user } } = await supabase.auth.getUser();

  // Fire-and-forget welcome email for signups
  if (type === 'signup' && user) {
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

    // Show "go back" page. The original tab's AuthGatePoller detects
    // verification by polling signInWithPassword() every 3s — works
    // cross-browser and cross-device, no localStorage/cookie needed.
    const htmlResponse = new NextResponse(
      `<!DOCTYPE html><html><head><title>Verified!</title>
      <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080808;color:#fff;font-family:system-ui}
      .c{text-align:center;max-width:440px;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem;color:#FFB2EF}p{color:#888;font-size:.9rem;margin-top:.5rem}
      .close{margin-top:1.5rem;color:#FFB2EF;font-size:.85rem;cursor:pointer;text-decoration:underline;background:none;border:none;font-family:inherit}</style></head>
      <body><div class="c"><h1>You&apos;re verified!</h1><p>Now go back to the other tab &mdash; your scan is waiting.</p>
      <button class="close" onclick="window.close()">Close this tab</button>
      <p style="color:#555;font-size:.75rem;margin-top:1rem">If this tab doesn&apos;t close, just switch back manually.</p></div></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    // Copy auth cookies to the HTML response
    response.cookies.getAll().forEach((cookie) => {
      htmlResponse.cookies.set(cookie.name, cookie.value);
    });
    return htmlResponse;
  }

  // Magic link / recovery — redirect with cookies already on response
  return response;
}
