import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createScan } from '@/lib/scan-service';

/** GET /auth/confirm — Email verification handler (signup, magiclink, recovery).
 *  Mirrors /auth/callback/route.ts — cookies WORK in Route Handlers
 *  (unlike Server Components where cookieStore.set() is silently ignored). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'signup' | 'magiclink' | 'recovery' | null;
  const redirectTo = searchParams.get('redirect_to') ?? '/';

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/auth/error?message=invalid_link', origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(new URL('/auth/error?message=verification_failed', origin));
  }

  // Get user once — needed for welcome email and auto-scan
  const { data: { user } } = await supabase.auth.getUser();

  // For signup: fire-and-forget welcome email
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
  }

  // --- Auto-scan: create scan server-side and redirect to /scan/{id} ---
  const redirectUrl = new URL(redirectTo, origin);
  const autoScanUrl = redirectUrl.searchParams.get('auto_scan');

  if (autoScanUrl && user) {
    try {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
      const countryCode = request.headers.get('cf-ipcountry')
        ?? request.headers.get('x-vercel-ip-country')
        ?? null;

      const { scanId } = await createScan({
        supabase,
        userId: user.id,
        url: autoScanUrl,
        ip,
        countryCode,
      });

      return NextResponse.redirect(new URL(`/scan/${scanId}`, origin));
    } catch (err) {
      // Scan creation failed — fall through to original redirect
      console.error('[auth/confirm] Auto-scan creation failed, falling back:', err);
    }
  }

  // Scan gate: user verified in a new tab — show "go back" page
  const finalUrl = new URL(redirectTo, origin);
  if (finalUrl.searchParams.get('scan_gate') === 'true') {
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Verified!</title>
      <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#080808;color:#fff;font-family:system-ui}
      .c{text-align:center;max-width:440px;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem;color:#FFB2EF}p{color:#888;font-size:.9rem;margin-top:.5rem}
      .close{margin-top:1.5rem;color:#FFB2EF;font-size:.85rem;cursor:pointer;text-decoration:underline;background:none;border:none;font-family:inherit}</style></head>
      <body><div class="c"><h1>You&apos;re verified, babe!</h1><p>Now go back to the other tab &mdash; your scan is waiting.</p>
      <button class="close" onclick="window.close()">Close this tab</button>
      <p style="color:#555;font-size:.75rem;margin-top:1rem">If this tab doesn&apos;t close, just switch back manually.</p></div>
      <script>try{localStorage.setItem('alphascan_email_verified','true')}catch(e){}</script></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
