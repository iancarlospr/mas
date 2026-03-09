import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { isValidUUID } from '@/lib/utils';
import { engineFetch } from '@/lib/engine';

/**
 * GET /api/reports/[id]/presentation
 *
 * Generate presentation slide deck PDF via the engine (element screenshots).
 * Returns a redirect to the signed Supabase Storage URL.
 *
 * Auth: scan owner OR valid share token. Tier: paid only.
 *
 * Fallback: if engine is unavailable, redirects to the slides page with
 * ?print=1 for client-side browser print.
 */
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

  // Generate via engine (always regenerate — engine uploads with upsert)
  try {
    const response = await engineFetch(`/engine/reports/${scanId}/presentation-pdf`, {
      method: 'POST',
      body: JSON.stringify({ scanId }),
    });

    if (response.ok) {
      const { url } = (await response.json()) as { url: string };
      return NextResponse.redirect(url);
    }

    console.error(`[presentation] Engine returned ${response.status}: ${await response.text()}`);
  } catch (error) {
    console.error('[presentation] Engine unavailable:', (error as Error).message);
  }

  // Fallback: client-side print
  const slidesUrl = new URL(`/report/${scanId}/slides`, request.url);
  slidesUrl.searchParams.set('print', '1');
  if (shareToken) {
    slidesUrl.searchParams.set('share', shareToken);
  }
  return NextResponse.redirect(slidesUrl.toString());
}
