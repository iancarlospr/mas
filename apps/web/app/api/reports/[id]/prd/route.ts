import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { isValidUUID } from '@/lib/utils';

/**
 * GET /api/reports/[id]/prd
 *
 * Renders M43 Remediation Plan as printable HTML with auto-print trigger.
 * Auth: scan owner OR valid share token. Tier: paid only.
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

  // Fetch M43 module result
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

  return renderMarkdownPage(markdown, scan.domain ?? scanId);
}

/**
 * Render M43 markdown as styled, printable HTML.
 * Auto-triggers browser print dialog on load.
 */
function renderMarkdownPage(markdown: string, domain: string): NextResponse {
  const bodyHtml = markdownToHtml(markdown);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Remediation Plan — ${escapeHtml(domain)}</title>
<style>
  @page { size: 8.5in 14in; margin: 0; }
  @media print { .print-banner { display: none !important; } }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 7in;
    margin: 0 auto;
    padding: 0.5in;
  }
  .print-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #111; color: #FFB2EF; text-align: center;
    padding: 10px; font-family: system-ui; font-size: 14px;
  }
  .print-banner button {
    background: #FFB2EF; color: #111; border: none; padding: 6px 20px;
    font-weight: 700; border-radius: 3px; cursor: pointer; margin-left: 12px;
  }
  h1 { font-size: 20pt; margin-bottom: 4pt; color: #111; }
  h2 { font-size: 16pt; margin-top: 28pt; margin-bottom: 8pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; color: #222; }
  h3 { font-size: 13pt; margin-top: 20pt; margin-bottom: 6pt; color: #333; }
  h4 { font-size: 11pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; }
  p { margin: 6pt 0; }
  code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f5f5f5; padding: 1px 4px; border-radius: 2px; }
  blockquote { border-left: 3px solid #999; margin: 12pt 0; padding: 8px 16px; color: #555; font-style: italic; background: #fafafa; }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f8f8f8; font-weight: bold; }
  hr { border: none; border-top: 1px solid #ccc; margin: 24pt 0; }
  ul, ol { margin-left: 20px; padding-left: 0; }
  li { margin-bottom: 4pt; }
</style>
</head>
<body>
<div class="print-banner">
  Save as PDF using your browser's print dialog
  <button onclick="window.print()">Print / Save PDF</button>
</div>
<div style="margin-top: 48px;">
${bodyHtml}
</div>
<script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 500); });</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;
  let listType = '';
  let inTable = false;

  const closeList = () => { if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; } };
  const closeTable = () => { if (inTable) { html.push('</tbody></table>'); inTable = false; } };

  const fmt = (text: string): string =>
    text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (const line of lines) {
    const t = line.trim();
    if (t === '') { closeList(); closeTable(); continue; }
    if (/^---+$/.test(t) || /^\*\*\*+$/.test(t)) { closeList(); closeTable(); html.push('<hr />'); continue; }

    const hm = t.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { closeList(); closeTable(); html.push(`<h${hm[1]!.length}>${fmt(hm[2]!)}</h${hm[1]!.length}>`); continue; }

    if (t.startsWith('|') && t.endsWith('|')) {
      closeList();
      const cells = t.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) { continue; }
      if (!inTable) { html.push('<table><thead><tr>'); for (const c of cells) html.push(`<th>${fmt(c)}</th>`); html.push('</tr></thead><tbody>'); inTable = true; continue; }
      html.push('<tr>'); for (const c of cells) html.push(`<td>${fmt(c)}</td>`); html.push('</tr>'); continue;
    }
    closeTable();

    if (t.startsWith('>')) { closeList(); html.push(`<blockquote>${fmt(t.replace(/^>\s*/, ''))}</blockquote>`); continue; }

    const cb = t.match(/^- \[([ xX])\]\s+(.+)$/);
    if (cb) { if (!inList || listType !== 'ul') { closeList(); html.push('<ul style="list-style:none;margin-left:0;">'); inList = true; listType = 'ul'; } html.push(`<li>${cb[1] !== ' ' ? '&#9745;' : '&#9744;'} ${fmt(cb[2]!)}</li>`); continue; }

    if (t.startsWith('- ') || t.startsWith('* ')) { if (!inList || listType !== 'ul') { closeList(); html.push('<ul>'); inList = true; listType = 'ul'; } html.push(`<li>${fmt(t.slice(2))}</li>`); continue; }

    const ol = t.match(/^\d+\.\s+(.+)$/);
    if (ol) { if (!inList || listType !== 'ol') { closeList(); html.push('<ol>'); inList = true; listType = 'ol'; } html.push(`<li>${fmt(ol[1]!)}</li>`); continue; }

    closeList();
    html.push(`<p>${fmt(t)}</p>`);
  }
  closeList();
  closeTable();
  return html.join('\n');
}
