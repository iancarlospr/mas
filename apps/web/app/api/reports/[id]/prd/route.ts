import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { engineFetch } from '@/lib/engine';
import { isValidUUID } from '@/lib/utils';

/**
 * GET /api/reports/[id]/prd
 *
 * Downloads the M43 Remediation Plan as a legal-size PDF.
 * Auth: scan owner OR valid share token. Tier: paid only.
 *
 * Flow: Check Supabase Storage for cached PDF → if missing, delegate
 * to engine for rendering → redirect to signed URL.
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

  // Check M43 module result exists
  const { data: m43Result } = await serviceClient
    .from('module_results')
    .select('data')
    .eq('scan_id', scanId)
    .eq('module_id', 'M43')
    .single();

  if (!m43Result?.data) {
    return NextResponse.json(
      { error: 'Remediation plan not yet generated' },
      { status: 404 },
    );
  }

  const m43Data = m43Result.data as Record<string, unknown>;
  const markdown = m43Data['markdown'] as string | undefined;

  if (!markdown) {
    return NextResponse.json(
      { error: 'Remediation plan content not available' },
      { status: 404 },
    );
  }

  // Check for cached PDF in Supabase Storage
  const pdfPath = `reports/${scanId}/remediation-plan.pdf`;
  const { data: existing } = await serviceClient.storage
    .from('reports')
    .createSignedUrl(pdfPath, 60 * 60); // 1h signed URL

  if (existing?.signedUrl) {
    return NextResponse.redirect(existing.signedUrl);
  }

  // Generate PDF via engine (same pattern as the main report PDF)
  try {
    const res = await engineFetch(`/engine/reports/${scanId}/prd-pdf`, {
      method: 'POST',
    });

    if (!res.ok) {
      console.error(`[prd-pdf] Engine returned ${res.status} for scan ${scanId}`);
      return NextResponse.json(
        { error: 'PDF generation failed' },
        { status: 502 },
      );
    }

    const { signedUrl } = await res.json();
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    console.error(`[prd-pdf] Engine error for scan ${scanId}:`, err);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 502 },
    );
  }
}
