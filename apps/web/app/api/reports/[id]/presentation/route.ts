import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { engineFetch } from '@/lib/engine';
import { isValidUUID } from '@/lib/utils';

/**
 * GET /api/reports/[id]/presentation
 *
 * Downloads the full slide deck as a landscape PDF.
 * Auth: scan owner OR valid share token. Tier: paid only.
 *
 * Flow: Check Supabase Storage for cached PDF → if missing, delegate
 * to engine for Patchright rendering → redirect to signed URL.
 * Fallback: styled HTML page with link to slides view + print button.
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

  // Check for cached PDF in Supabase Storage
  const pdfPath = `reports/${scanId}/presentation.pdf`;
  const { data: existing } = await serviceClient.storage
    .from('reports')
    .createSignedUrl(pdfPath, 60 * 60); // 1h signed URL

  if (existing?.signedUrl) {
    return NextResponse.redirect(existing.signedUrl);
  }

  // Generate PDF via engine
  try {
    const res = await engineFetch(`/engine/reports/${scanId}/presentation-pdf`, {
      method: 'POST',
    });

    if (!res.ok) {
      console.error(`[presentation-pdf] Engine returned ${res.status} for scan ${scanId}`);
      return renderFallback(scanId, scan.domain ?? scanId);
    }

    const { signedUrl } = await res.json();
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    console.error(`[presentation-pdf] Engine unreachable, falling back to HTML:`, err);
    return renderFallback(scanId, scan.domain ?? scanId);
  }
}

/**
 * Fallback: styled HTML page linking to the slides view with a print button.
 */
function renderFallback(scanId: string, domain: string): NextResponse {
  const slidesUrl = `/report/${scanId}/slides`;
  const escapedDomain = domain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Presentation — ${escapedDomain}</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #080808;
    color: #f0e8f4;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
  }
  .card {
    text-align: center;
    padding: 48px;
    border: 1px solid rgba(255,178,239,0.15);
    border-radius: 8px;
    background: rgba(255,178,239,0.03);
    max-width: 480px;
  }
  h1 { font-size: 20px; margin-bottom: 8px; }
  p { color: rgba(240,232,244,0.6); font-size: 14px; line-height: 1.6; }
  .btn {
    display: inline-block;
    margin-top: 24px;
    padding: 12px 32px;
    background: #FFB2EF;
    color: #080808;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }
  .btn:hover { filter: brightness(1.1); }
  .alt {
    display: inline-block;
    margin-top: 12px;
    color: #FFB2EF;
    font-size: 13px;
    cursor: pointer;
    border: none;
    background: none;
  }
</style>
</head>
<body>
<div class="card">
  <h1>Presentation PDF</h1>
  <p>
    The PDF engine is temporarily unavailable.<br />
    You can view the slides directly and use your browser&rsquo;s print dialog to save as PDF.
  </p>
  <a href="${slidesUrl}" class="btn">View Slides</a>
  <br />
  <button class="alt" onclick="window.open('${slidesUrl}','_blank');setTimeout(()=>window.close(),500)">
    Open in new tab &amp; close this page
  </button>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
