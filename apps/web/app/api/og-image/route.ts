import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/og-image?url=...
 * Proxies an og:image URL server-side to avoid CORS/hotlink blocking.
 * Caches aggressively (1 day) since og:images rarely change.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlphaScan/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 });

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 400 });
    }

    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
