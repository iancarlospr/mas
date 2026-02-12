import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { engineFetch } from '@/lib/engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;

  // Auth: either logged-in owner OR valid share token
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const shareToken = request.nextUrl.searchParams.get('share');

  const serviceClient = createServiceClient();
  const { data: scan } = await serviceClient
    .from('scans')
    .select('id, user_id, tier, status, domain')
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

  // Check for cached PDF in Supabase Storage
  const pdfPath = `reports/${scanId}/MarketingAlphaScan-Report.pdf`;
  const { data: existing } = await serviceClient.storage
    .from('reports')
    .createSignedUrl(pdfPath, 60 * 60); // 1h

  if (existing?.signedUrl) {
    return NextResponse.redirect(existing.signedUrl);
  }

  // Generate via engine
  try {
    const res = await engineFetch(`/engine/reports/${scanId}/pdf`, {
      method: 'POST',
    });

    if (!res.ok) {
      console.error(`[pdf] Engine returned ${res.status} for scan ${scanId}`);
      return NextResponse.json(
        { error: 'PDF generation failed' },
        { status: 502 },
      );
    }

    const { signedUrl } = await res.json();
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    console.error(`[pdf] Engine error for scan ${scanId}:`, err);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 502 },
    );
  }
}
