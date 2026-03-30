import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Geo-allowlist (application-level fallback for Cloudflare)
// Only these regions are served. Everything else → 451.
const ALLOWED_COUNTRIES = new Set([
  // US + territories
  'US', 'PR', 'VI', 'GU', 'AS', 'MP',
  // Canada
  'CA',
  // Caribbean (no CU, JM, HT)
  'DO', 'TT', 'BB', 'BS', 'LC', 'GD', 'VC', 'AG', 'DM', 'KN',
  'TC', 'KY', 'VG', 'AW', 'CW', 'SX', 'BQ', 'AI', 'MS',
  'GP', 'MQ', 'BL', 'MF',
  // Western Europe
  'GB', 'IE', 'FR', 'ES', 'PT', 'DE', 'NL', 'BE', 'LU', 'AT',
  'CH', 'IT', 'DK', 'NO', 'SE', 'FI', 'IS', 'MC', 'AD', 'LI',
  'MT', 'SM', 'VA',
  // Latin America (no NI, VE, SV, GY, SR, GF, HN)
  'MX', 'GT', 'BZ', 'CR', 'PA', 'CO', 'EC', 'PE', 'BO', 'CL',
  'AR', 'UY', 'PY', 'BR',
]);

export async function middleware(request: NextRequest) {
  // Application-level geo-allowlist (fallback — primary is Cloudflare firewall)
  const country = request.headers.get('cf-ipcountry')
    ?? request.headers.get('x-vercel-ip-country');
  if (country && !ALLOWED_COUNTRIES.has(country.toUpperCase())) {
    return new NextResponse('Service not available in your region', { status: 451 });
  }

  const { pathname } = request.nextUrl;

  // Capture admin token into httpOnly cookie (Mission Control access)
  const adminParam = request.nextUrl.searchParams.get('admin');
  if (adminParam) {
    const url = new URL(pathname, request.url);
    url.searchParams.delete('admin');
    const response = NextResponse.redirect(url);
    response.cookies.set('__admin_token', adminParam, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  }

  // Capture beta invite code into client-readable cookie
  const inviteParam = request.nextUrl.searchParams.get('invite');
  if (inviteParam && /^[a-z0-9-]+$/.test(inviteParam)) {
    const url = new URL(pathname, request.url);
    url.searchParams.delete('invite');
    const response = NextResponse.redirect(url);
    response.cookies.set('__alphascan_invite', inviteParam, {
      httpOnly: false, // client JS needs to read this for redemption
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  }

  // Skip auth for engine PDF rendering — the slides page handles its own
  // auth via service role when ?print=1 is present
  const isPrintRender = pathname.startsWith('/report/') && pathname.endsWith('/slides')
    && (request.nextUrl.searchParams.get('print') === '1' || request.nextUrl.searchParams.get('print') === 'true');
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
