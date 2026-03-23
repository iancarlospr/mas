import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { isValidUUID } from '@/lib/utils';
import { engineFetch } from '@/lib/engine';

/**
 * GET /api/reports/[id]/boss-deck-pdf
 *
 * Generate Boss Deck PDF via the engine (element screenshots in screen mode).
 * Returns a redirect to the signed Supabase Storage URL.
 *
 * Auth: scan owner OR valid share token. Tier: paid only.
 */

export const maxDuration = 120; // Vercel function timeout: 2 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  if (!isValidUUID(scanId)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }

  // Auth: either logged-in owner OR valid share token
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const shareToken = request.nextUrl.searchParams.get('share');

  const serviceClient = createServiceClient();
  const { data: scan } = await serviceClient
    .from('scans')
    .select('id, user_id, tier, status')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid' || scan.status !== 'complete') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Verify access: owner or valid share token
  const isOwner = user != null && scan.user_id === user.id;
  const isSharedAccess = await verifyShareToken(shareToken, scanId);

  if (!isOwner && !isSharedAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check cache: if PDF already exists in Supabase Storage, return signed URL instantly
  const storagePath = `reports/${scanId}/boss-deck.pdf`;
  const { data: cached } = await serviceClient.storage
    .from('reports')
    .createSignedUrl(storagePath, 60 * 60 * 24); // 24h

  if (cached?.signedUrl) {
    return NextResponse.redirect(cached.signedUrl);
  }

  // Generate via engine (7 pages takes ~30-60s on first request)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110_000); // 110s

    const response = await engineFetch(`/engine/reports/${scanId}/boss-deck-pdf`, {
      method: 'POST',
      body: JSON.stringify({ scanId }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const { url } = (await response.json()) as { url: string };
      return NextResponse.redirect(url);
    }

    console.error(`[boss-deck-pdf] Engine returned ${response.status}: ${await response.text()}`);
  } catch (error) {
    console.error('[boss-deck-pdf] Engine error:', (error as Error).message);
  }

  return NextResponse.json(
    { error: 'PDF generation failed. Please try again in a moment.' },
    { status: 503 },
  );
}
