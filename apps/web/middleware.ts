import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Geo-blocked countries (application-level fallback for Cloudflare)
// Sanctioned nations + active war zones with no customer base (March 2026)
const BLOCKED_COUNTRIES = new Set([
  // Original list
  'IN', 'PK', 'CN', 'RU', 'PH', 'NG', 'BD', 'VN', 'KP', 'IR', 'MM', 'KH', 'LA',
  // Sanctioned + active conflict zones
  'AF', // Afghanistan (Taliban, sanctioned)
  'BY', // Belarus (sanctioned, proxy for RU)
  'CF', // Central African Republic (civil war)
  'CU', // Cuba (sanctioned)
  'LY', // Libya (civil war)
  'SD', // Sudan (civil war)
  'SO', // Somalia (Al-Shabaab insurgency)
  'SS', // South Sudan (civil war)
  'SY', // Syria (active conflict, sanctioned)
  'YE', // Yemen (active war)
]);

// Staging gate — remove when ready to launch publicly
const STAGING_SECRET = process.env.STAGING_SECRET ?? 'alphascan2026';
const STAGING_COOKIE = '__alphascan_access';

export async function middleware(request: NextRequest) {
  // Application-level geo-blocking (fallback — primary is Cloudflare firewall)
  const country = request.headers.get('cf-ipcountry')
    ?? request.headers.get('x-vercel-ip-country');
  if (country && BLOCKED_COUNTRIES.has(country.toUpperCase())) {
    return new NextResponse('Service not available in your region', { status: 451 });
  }

  // Staging gate: skip for API routes, webhooks, engine PDF rendering, and SEO/crawler routes
  const { pathname } = request.nextUrl;
  const isPrintRender = pathname.startsWith('/report/') && pathname.endsWith('/slides')
    && (request.nextUrl.searchParams.get('print') === '1' || request.nextUrl.searchParams.get('print') === 'true');
  const isSeoRoute = pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || pathname === '/manifest.webmanifest'
    || pathname.startsWith('/icon-')
    || pathname === '/apple-icon'
    || pathname === '/icon.svg'
    || pathname.endsWith('/opengraph-image')
    || pathname.includes('/opengraph-image');
  const isStaticAsset = /\.(json|png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|ttf|css|js|map|txt|xml|webmanifest)$/i.test(pathname);
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/auth/') && !isPrintRender && !isSeoRoute && !isStaticAsset) {
    const hasAccess = request.cookies.get(STAGING_COOKIE)?.value === 'granted';

    // Grant access via ?access=<secret>
    const accessParam = request.nextUrl.searchParams.get('access');
    if (accessParam === STAGING_SECRET) {
      const url = new URL(pathname, request.url);
      // Strip access and invite params from redirect URL
      url.searchParams.delete('access');
      url.searchParams.delete('invite');
      const response = NextResponse.redirect(url);
      response.cookies.set(STAGING_COOKIE, 'granted', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      // Capture beta invite code into client-readable cookie
      const inviteParam = request.nextUrl.searchParams.get('invite');
      if (inviteParam && /^[a-z0-9-]+$/.test(inviteParam)) {
        response.cookies.set('__alphascan_invite', inviteParam, {
          httpOnly: false, // client JS needs to read this for redemption
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }
      return response;
    }

    if (!hasAccess) {
      const ogImageUrl = `${request.nextUrl.origin}/opengraph-image`;
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Alpha Scan — Forensic Marketing Intelligence</title>
        <meta name="description" content="Your MarTech stack is a landfill. Alpha Scan reverse-engineers any URL in minutes — infrastructure, tracking, performance, compliance.">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="Alpha Scan">
        <meta property="og:title" content="Alpha Scan — Forensic Marketing Intelligence">
        <meta property="og:description" content="Serve an unclockable audit in minutes. Extract the ground truth from any marketing stack.">
        <meta property="og:url" content="https://marketingalphascan.com">
        <meta property="og:image" content="${ogImageUrl}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="Alpha Scan">
        <meta name="twitter:description" content="Your MarTech stack is a landfill. Let Chloé run the forensics.">
        <meta name="twitter:image" content="${ogImageUrl}">
        <meta name="theme-color" content="#080808">
        <link rel="apple-touch-icon" href="/apple-icon" sizes="180x180">
        <link rel="manifest" href="/manifest.webmanifest">
        <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#fff;font-family:system-ui}
        .c{text-align:center;max-width:400px;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#888;font-size:.9rem}</style></head>
        <body><div class="c"><h1>Alpha Scan</h1><p>Private beta. Access by invitation only.</p></div></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } }
      );
    }
  }

  // Skip auth for engine PDF rendering — the slides page handles its own
  // auth via service role when ?print=1 is present
  if (isPrintRender) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|woff2?|ttf|ico|css|js|map|xml|txt|webmanifest)$).*)',
  ],
};
