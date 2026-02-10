import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Geo-blocked countries (application-level fallback for Cloudflare)
const BLOCKED_COUNTRIES = new Set([
  'IN', 'PK', 'CN', 'RU', 'PH', 'NG', 'BD', 'VN', 'KP', 'IR', 'MM', 'KH', 'LA',
]);

export async function middleware(request: NextRequest) {
  // Application-level geo-blocking (fallback — primary is Cloudflare firewall)
  const country = request.headers.get('cf-ipcountry')
    ?? request.headers.get('x-vercel-ip-country');
  if (country && BLOCKED_COUNTRIES.has(country.toUpperCase())) {
    return new NextResponse('Service not available in your region', { status: 451 });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
