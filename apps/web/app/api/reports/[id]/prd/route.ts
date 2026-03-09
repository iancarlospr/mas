import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { isValidUUID } from '@/lib/utils';
import { getMarketingIQLabel } from '@marketing-alpha/types';

// ── Types ────────────────────────────────────────────────────

interface PRDContext {
  domain: string;
  markdown: string;
  businessName: string;
  scanDate: string;
  marketingIQ: number | null;
  marketingIQLabel: string | null;
  totalFindings: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  estimatedTimelineWeeks: number;
  synthesisHeadline: string | null;
}

// ── Route Handler ────────────────────────────────────────────

/**
 * GET /api/reports/[id]/prd
 *
 * Renders M43 Remediation Plan as a McKinsey-tier printable HTML document.
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
    .select('id, user_id, tier, status, domain, marketing_iq, created_at')
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

  // Fetch M43 + M42 in parallel
  const [m43Res, m42Res] = await Promise.all([
    serviceClient
      .from('module_results')
      .select('data')
      .eq('scan_id', scanId)
      .eq('module_id', 'M43')
      .single(),
    serviceClient
      .from('module_results')
      .select('data')
      .eq('scan_id', scanId)
      .eq('module_id', 'M42')
      .single(),
  ]);

  if (!m43Res.data?.data) {
    return NextResponse.json(
      { error: 'Remediation plan not yet generated' },
      { status: 404 },
    );
  }

  const m43Data = m43Res.data.data as Record<string, unknown>;
  const markdown = m43Data['markdown'] as string | undefined;

  if (!markdown) {
    return NextResponse.json(
      { error: 'Remediation plan content not available' },
      { status: 404 },
    );
  }

  // Extract M43 metadata
  const metadata = m43Data['metadata'] as Record<string, unknown> | undefined;
  const businessName = (metadata?.['businessName'] as string | undefined) ?? scan.domain ?? 'Unknown';
  const scanDate = (metadata?.['scanDate'] as string | undefined) ?? scan.created_at ?? new Date().toISOString();
  const totalFindings = (metadata?.['totalFindings'] as number | undefined) ?? 0;
  const p0Count = (metadata?.['p0Count'] as number | undefined) ?? 0;
  const p1Count = (metadata?.['p1Count'] as number | undefined) ?? 0;
  const p2Count = (metadata?.['p2Count'] as number | undefined) ?? 0;
  const p3Count = (metadata?.['p3Count'] as number | undefined) ?? 0;
  const estimatedTimelineWeeks = (metadata?.['estimatedTimelineWeeks'] as number | undefined) ?? 8;

  // Extract M42 synthesis headline
  const m42Data = m42Res.data?.data as Record<string, unknown> | undefined;
  const synthesis = m42Data?.['synthesis'] as Record<string, unknown> | undefined;
  const synthesisHeadline = (synthesis?.['synthesis_headline'] as string | undefined) ?? null;

  // MarketingIQ
  const marketingIQ = (scan.marketing_iq as number | null) ?? null;
  const marketingIQLabel = marketingIQ != null ? getMarketingIQLabel(marketingIQ) : null;

  const ctx: PRDContext = {
    domain: scan.domain ?? scanId,
    markdown,
    businessName,
    scanDate,
    marketingIQ,
    marketingIQLabel,
    totalFindings,
    p0Count,
    p1Count,
    p2Count,
    p3Count,
    estimatedTimelineWeeks,
    synthesisHeadline,
  };

  return renderDocument(ctx);
}

// ── Render ───────────────────────────────────────────────────

function renderDocument(ctx: PRDContext): NextResponse {
  const bodyHtml = markdownToHtml(ctx.markdown);
  const coverHtml = renderCoverPage(ctx);
  const domainSafe = escapeHtml(ctx.domain);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Remediation Plan — ${domainSafe}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@300;400;600&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>
/* ── Page Setup ─────────────────────────────────────── */
@page {
  size: 8.5in 14in;
  margin: 0;
}

/* ── Print Color Preservation ───────────────────────── */
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  color-adjust: exact !important;
}

/* ── Base Typography ────────────────────────────────── */
body {
  font-family: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  font-size: 10.5pt;
  font-weight: 400;
  line-height: 1.65;
  color: #2D3748;
  max-width: 7.3in;
  margin: 0 auto;
  padding: 0.4in 0.5in;
  background: #fff;
}

/* ── Screen Banner ──────────────────────────────────── */
.print-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 9999;
  background: #0B1F3F;
  color: #E2E8F0;
  text-align: center;
  padding: 11px 20px;
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 13.5px;
  font-weight: 400;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(11, 31, 63, 0.3);
}
.print-banner button {
  background: #B8860B;
  color: #fff;
  border: none;
  padding: 7px 24px;
  font-weight: 600;
  font-size: 13px;
  border-radius: 3px;
  cursor: pointer;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.15s;
}
.print-banner button:hover {
  background: #D4A017;
}


/* ═══════════════════════════════════════════════════════
   COVER PAGE
   ═══════════════════════════════════════════════════════ */
.cover-page {
  width: 8.5in;
  min-height: 14in;
  margin: 0 auto;
  padding: 0;
  page-break-after: always;
  position: relative;
  background: #FAFBFD;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Geometric accent — top navy band */
.cover-band-top {
  height: 0.4in;
  background: #0B1F3F;
  flex-shrink: 0;
}

/* Main cover content */
.cover-content {
  flex: 1;
  padding: 0.9in 0.85in 0;
  display: flex;
  flex-direction: column;
}

/* Document type label */
.cover-label {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 9pt;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #718096;
  margin-bottom: 0.22in;
}

/* Main title */
.cover-title {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 36pt;
  font-weight: 600;
  line-height: 1.15;
  color: #0B1F3F;
  margin: 0 0 0.15in 0;
  letter-spacing: -0.01em;
}

/* Gold divider */
.cover-divider {
  width: 2.8in;
  height: 2.5pt;
  background: linear-gradient(90deg, #B8860B 0%, #D4A017 60%, transparent 100%);
  margin: 0.18in 0 0.32in 0;
  border-radius: 1px;
}

/* Business name + domain */
.cover-business {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 18pt;
  font-weight: 500;
  color: #1B3A5C;
  margin-bottom: 0.06in;
}
.cover-domain {
  font-family: 'Source Code Pro', 'Courier New', monospace;
  font-size: 10pt;
  color: #718096;
  letter-spacing: 0.02em;
}

/* Synthesis headline */
.cover-headline {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 13pt;
  font-weight: 500;
  font-style: italic;
  color: #4A5568;
  line-height: 1.5;
  margin-top: 0.4in;
  padding-left: 0.18in;
  border-left: 2.5pt solid #B8860B;
  max-width: 5in;
}

/* Score + Metrics row */
.cover-metrics {
  margin-top: auto;
  padding-bottom: 0.5in;
  display: flex;
  align-items: flex-end;
  gap: 0.4in;
  flex-wrap: wrap;
}

/* MarketingIQ score box */
.cover-score-box {
  text-align: center;
  padding: 0.2in 0.35in;
  border: 1.5pt solid #B8860B;
  border-radius: 4pt;
  background: #fff;
}
.cover-score-value {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 42pt;
  font-weight: 700;
  color: #B8860B;
  line-height: 1;
}
.cover-score-label {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #718096;
  margin-top: 4pt;
}
.cover-score-tier {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 9pt;
  font-weight: 600;
  color: #1B3A5C;
  margin-top: 2pt;
}

/* Priority metric boxes */
.cover-priority-grid {
  display: flex;
  gap: 0.18in;
  flex-wrap: wrap;
}
.cover-priority-box {
  padding: 0.1in 0.16in;
  background: #fff;
  border: 0.75pt solid #CBD5E0;
  border-top: 3pt solid #718096;
  border-radius: 2pt;
  min-width: 0.7in;
  text-align: center;
  flex-shrink: 1;
}
.cover-priority-box.p0 { border-top-color: #C53030; }
.cover-priority-box.p1 { border-top-color: #C05621; }
.cover-priority-box.p2 { border-top-color: #2B6CB0; }
.cover-priority-box.p3 { border-top-color: #718096; }
.cover-priority-count {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 22pt;
  font-weight: 700;
  line-height: 1;
}
.cover-priority-box.p0 .cover-priority-count { color: #C53030; }
.cover-priority-box.p1 .cover-priority-count { color: #C05621; }
.cover-priority-box.p2 .cover-priority-count { color: #2B6CB0; }
.cover-priority-box.p3 .cover-priority-count { color: #718096; }
.cover-priority-label {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #4A5568;
  margin-top: 3pt;
}

/* Cover footer */
.cover-footer {
  padding: 0.2in 0.85in;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 0.75pt solid #CBD5E0;
  flex-shrink: 0;
}
.cover-date {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 8.5pt;
  color: #718096;
}
.cover-timeline {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 8.5pt;
  color: #718096;
}
.cover-confidential {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #1B3A5C;
  border: 1pt solid #CBD5E0;
  padding: 3pt 10pt;
  border-radius: 2pt;
}

/* Cover bottom band */
.cover-band-bottom {
  height: 0.15in;
  background: linear-gradient(90deg, #0B1F3F 0%, #1B3A5C 50%, #B8860B 100%);
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════════
   DOCUMENT BODY — HEADINGS
   ═══════════════════════════════════════════════════════ */
.document-body {
  margin-top: 52px;
}

.document-body h1 {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 22pt;
  font-weight: 700;
  color: #0B1F3F;
  margin: 0 0 6pt 0;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.document-body h2 {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 16pt;
  font-weight: 600;
  color: #1B3A5C;
  margin: 32pt 0 10pt 0;
  padding-bottom: 6pt;
  border-bottom: 1.5pt solid #CBD5E0;
  line-height: 1.25;
  page-break-after: avoid;
}
.section-number {
  color: #B8860B;
  font-weight: 700;
  margin-right: 6pt;
}

/* Priority-specific H2 styles */
.priority-h2-p0 { border-bottom-color: #C53030; }
.priority-h2-p1 { border-bottom-color: #C05621; }
.priority-h2-p2 { border-bottom-color: #2B6CB0; }
.priority-h2-p3 { border-bottom-color: #718096; }

.document-body h3 {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 12.5pt;
  font-weight: 600;
  color: #0B1F3F;
  margin: 22pt 0 6pt 0;
  line-height: 1.3;
  page-break-after: avoid;
}

.document-body h4 {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 10.5pt;
  font-weight: 600;
  color: #1B3A5C;
  margin: 14pt 0 4pt 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Paragraphs & Inline ────────────────────────────── */
.document-body p {
  margin: 6pt 0;
  orphans: 3;
  widows: 3;
}

.document-body code {
  font-family: 'Source Code Pro', 'Courier New', monospace;
  font-size: 9pt;
  background: #EDF2F7;
  color: #1B3A5C;
  padding: 1pt 4pt;
  border-radius: 2pt;
  border: 0.5pt solid #E2E8F0;
}

.document-body pre {
  font-family: 'Source Code Pro', 'Courier New', monospace;
  font-size: 9pt;
  line-height: 1.5;
  background: #F7FAFC;
  border: 0.75pt solid #E2E8F0;
  border-radius: 3pt;
  padding: 12pt 16pt;
  margin: 10pt 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  page-break-inside: avoid;
}
.document-body pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  color: #1B3A5C;
}

.document-body strong {
  font-weight: 600;
  color: #1A202C;
}

/* Field labels: **Context:** etc */
.field-label {
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1B3A5C;
}

/* ── Finding Cards ──────────────────────────────────── */
.finding-card {
  border: 0.75pt solid #E2E8F0;
  border-left: 3.5pt solid #718096;
  border-radius: 3pt;
  padding: 14pt 16pt;
  margin: 16pt 0;
  background: #FAFBFD;
  page-break-inside: avoid;
  break-inside: avoid;
  padding-top: 18pt;
}
.finding-card.p0 { border-left-color: #C53030; }
.finding-card.p1 { border-left-color: #C05621; }
.finding-card.p2 { border-left-color: #2B6CB0; }
.finding-card.p3 { border-left-color: #718096; }

.finding-card h3 {
  margin-top: 0 !important;
  padding-top: 0;
}

/* ── Tables ─────────────────────────────────────────── */
.document-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 14pt 0;
  font-size: 9.5pt;
  page-break-inside: auto;
}
.document-body thead {
  background: #0B1F3F;
}
.document-body th {
  color: #fff;
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-weight: 600;
  font-size: 8.5pt;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 7pt 10pt;
  text-align: left;
  border: none;
  border-bottom: 1.5pt solid #0B1F3F;
}
.document-body td {
  padding: 6pt 10pt;
  border-bottom: 0.5pt solid #E2E8F0;
  color: #2D3748;
  vertical-align: top;
}
.document-body tr:nth-child(even) td {
  background: #F7FAFC;
}
.document-body tr {
  page-break-inside: avoid;
}

/* ── Blockquotes ────────────────────────────────────── */
.document-body blockquote {
  border-left: 3pt solid #1B3A5C;
  margin: 14pt 0;
  padding: 10pt 18pt;
  color: #4A5568;
  font-style: italic;
  background: #F7FAFC;
  border-radius: 0 3pt 3pt 0;
  page-break-inside: avoid;
}

/* Chat teaser blockquotes */
.chat-teaser {
  border-left-color: #B8860B;
  background: #FFFBF0;
  font-style: normal;
  color: #4A5568;
  font-size: 9.5pt;
}
.chat-teaser::before {
  content: "AI ASSISTANT";
  display: block;
  font-family: 'Source Sans 3', system-ui, sans-serif;
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #B8860B;
  margin-bottom: 4pt;
}

/* ── Lists ──────────────────────────────────────────── */
.document-body ul, .document-body ol {
  margin: 6pt 0 6pt 22pt;
  padding-left: 0;
}
.document-body li {
  margin-bottom: 3pt;
  line-height: 1.55;
}
.document-body li::marker {
  color: #718096;
}

/* Checkbox lists */
.checkbox-list {
  list-style: none;
  margin-left: 0 !important;
  padding-left: 0 !important;
}
.checkbox-list li {
  padding: 3pt 0;
}
.cb-checked {
  color: #276749;
  text-decoration: line-through;
  text-decoration-color: #9AE6B4;
}
.cb-unchecked {
  color: #2D3748;
}
.cb-icon {
  display: inline-block;
  width: 11pt;
  height: 11pt;
  border: 1pt solid #CBD5E0;
  border-radius: 2pt;
  text-align: center;
  line-height: 11pt;
  font-size: 8pt;
  margin-right: 6pt;
  vertical-align: middle;
}
.cb-icon.checked {
  background: #276749;
  border-color: #276749;
  color: #fff;
}

/* ── HR / Section Divider ───────────────────────────── */
.document-body hr {
  border: none;
  height: 1pt;
  background: linear-gradient(90deg, transparent 0%, #CBD5E0 15%, #CBD5E0 85%, transparent 100%);
  margin: 28pt 0;
}

/* ── Priority Section Wrappers ──────────────────────── */
.priority-section {
  margin-top: 8pt;
}

/* ═══════════════════════════════════════════════════════
   RESPONSIVE — screen reading comfort
   ═══════════════════════════════════════════════════════ */
@media screen and (max-width: 900px) {
  body { padding: 0.3in; }
  .cover-page { width: 100%; min-height: auto; }
  .cover-content { padding: 0.5in 0.6in 0; }
  .cover-footer { padding: 0.2in 0.6in; }
  .cover-title { font-size: 26pt; }
  .cover-metrics { flex-direction: column; gap: 0.3in; align-items: flex-start; }
}

/* ═══════════════════════════════════════════════════════
   PRINT — must be LAST to override base styles
   ═══════════════════════════════════════════════════════ */
@media print {
  .print-banner { display: none !important; }
  body {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .cover-page {
    width: 100% !important;
    margin: 0 !important;
  }
  .document-body {
    margin-top: 0 !important;
    padding: 0.6in 0.75in;
  }
  .finding-card {
    margin-top: 20pt;
  }
  h2, h3 {
    margin-top: 28pt;
  }
}
</style>
</head>
<body>

<!-- Screen-only banner -->
<div class="print-banner">
  <span>Remediation Plan — ${domainSafe}</span>
  <button onclick="window.print()">Save as PDF</button>
</div>

<!-- Cover Page -->
${coverHtml}

<!-- Document Body -->
<div class="document-body">
${bodyHtml}
</div>

<script>
window.addEventListener('load', function() {
  setTimeout(function() { window.print(); }, 800);
});
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ── Cover Page ───────────────────────────────────────────────

function renderCoverPage(ctx: PRDContext): string {
  const domainSafe = escapeHtml(ctx.domain);
  const businessSafe = escapeHtml(ctx.businessName);
  const dateFmt = formatDate(ctx.scanDate);

  const scoreHtml = ctx.marketingIQ != null ? `
    <div class="cover-score-box">
      <div class="cover-score-value">${ctx.marketingIQ}</div>
      <div class="cover-score-label">MarketingIQ</div>
      ${ctx.marketingIQLabel ? `<div class="cover-score-tier">${escapeHtml(ctx.marketingIQLabel)}</div>` : ''}
    </div>` : '';

  const headlineHtml = ctx.synthesisHeadline
    ? `<div class="cover-headline">${escapeHtml(ctx.synthesisHeadline)}</div>`
    : '';

  return `
<div class="cover-page">
  <div class="cover-band-top"></div>
  <div class="cover-content">
    <div class="cover-label">Marketing Technology Audit</div>
    <h1 class="cover-title">Remediation<br>Plan</h1>
    <div class="cover-divider"></div>
    <div class="cover-business">${businessSafe}</div>
    <div class="cover-domain">${domainSafe}</div>
    ${headlineHtml}
    <div class="cover-metrics">
      ${scoreHtml}
      <div class="cover-priority-grid">
        <div class="cover-priority-box p0">
          <div class="cover-priority-count">${ctx.p0Count}</div>
          <div class="cover-priority-label">Immediate</div>
        </div>
        <div class="cover-priority-box p1">
          <div class="cover-priority-count">${ctx.p1Count}</div>
          <div class="cover-priority-label">This Week</div>
        </div>
        <div class="cover-priority-box p2">
          <div class="cover-priority-count">${ctx.p2Count}</div>
          <div class="cover-priority-label">This Month</div>
        </div>
        <div class="cover-priority-box p3">
          <div class="cover-priority-count">${ctx.p3Count}</div>
          <div class="cover-priority-label">Backlog</div>
        </div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-date">${dateFmt} &nbsp;·&nbsp; Est. ${ctx.estimatedTimelineWeeks}-week timeline</div>
    <div class="cover-confidential">Marketing Alpha Scan</div>
  </div>
  <div class="cover-band-bottom"></div>
</div>`;
}

// ── Markdown → HTML Parser ───────────────────────────────────

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;
  let listType = '';
  let inTable = false;
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let inFindingCard = false;
  let currentPriority: string | null = null;
  let sectionNumber = 0;
  let preambleSkipped = false;
  let preamblePhase = 0; // 0=looking for H1, 1=H1 seen, 2=H2 seen, 3=H3 seen, 4=HR seen (done)

  const closeList = () => {
    if (inList) {
      html.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      html.push('</tbody></table>');
      inTable = false;
    }
  };
  const closeFindingCard = () => {
    if (inFindingCard) {
      html.push('</div>');
      inFindingCard = false;
    }
  };

  const fmt = (text: string): string =>
    text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, (_, inner: string) => {
        // Field label detection: **Context:** **Implementation:** etc
        if (/^[A-Z][a-z]+(\s[a-z]+)?:$/.test(inner)) {
          return `<strong class="field-label">${inner}</strong>`;
        }
        return `<strong>${inner}</strong>`;
      })
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (const line of lines) {
    const t = line.trim();

    // ── Preamble skip: first H1, H2, H3, then first HR ──
    if (!preambleSkipped) {
      if (preamblePhase === 0 && /^#\s+/.test(t)) { preamblePhase = 1; continue; }
      if (preamblePhase === 1 && /^##\s+/.test(t)) { preamblePhase = 2; continue; }
      if (preamblePhase === 2 && /^###\s+/.test(t)) { preamblePhase = 3; continue; }
      if (preamblePhase >= 1 && (/^---+$/.test(t) || /^\*\*\*+$/.test(t))) {
        preambleSkipped = true;
        continue;
      }
      // If we see non-preamble content, stop trying to skip
      if (preamblePhase >= 1 && t !== '' && !/^#{1,3}\s+/.test(t)) {
        preambleSkipped = true;
        // Fall through to process this line
      }
      if (preamblePhase === 0 && t === '') continue;
      if (!preambleSkipped && preamblePhase < 1) continue;
    }

    // ── Fenced code blocks ──
    if (/^```/.test(t)) {
      if (!inCodeBlock) {
        closeList(); closeTable();
        inCodeBlock = true;
        codeBlockLang = t.slice(3).trim();
        codeBlockLines = [];
        continue;
      } else {
        const escaped = codeBlockLines.map(l => escapeHtml(l)).join('\n');
        const langAttr = codeBlockLang ? ` data-lang="${escapeHtml(codeBlockLang)}"` : '';
        html.push(`<pre${langAttr}><code>${escaped}</code></pre>`);
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockLines = [];
        continue;
      }
    }
    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (t === '') { closeList(); closeTable(); continue; }

    // ── HR → section divider ──
    if (/^---+$/.test(t) || /^\*\*\*+$/.test(t)) {
      closeList(); closeTable(); closeFindingCard();
      html.push('<hr />');
      continue;
    }

    // ── Headings ──
    const hm = t.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      const level = hm[1]!.length;
      const text = hm[2]!;
      closeList(); closeTable();

      if (level === 2) {
        closeFindingCard();

        // Priority section detection
        const prevPriority = currentPriority;
        if (/P0|Immediate/i.test(text)) currentPriority = 'p0';
        else if (/P1|This\s*Week/i.test(text)) currentPriority = 'p1';
        else if (/P2|This\s*Month/i.test(text)) currentPriority = 'p2';
        else if (/P3|Backlog/i.test(text)) currentPriority = 'p3';
        else currentPriority = null;

        // Close previous priority section
        if (prevPriority != null) {
          html.push('</div>');
        }

        sectionNumber++;
        const priorityClass = currentPriority ? ` priority-h2-${currentPriority}` : '';
        html.push(`<h2 class="${priorityClass}"><span class="section-number">${sectionNumber}.</span>${fmt(text)}</h2>`);

        // Open priority section wrapper
        if (currentPriority) {
          html.push(`<div class="priority-section">`);
        }
        continue;
      }

      if (level === 3 && currentPriority) {
        // Finding card: close previous, open new
        closeFindingCard();
        inFindingCard = true;
        html.push(`<div class="finding-card ${currentPriority}">`);
        html.push(`<h3>${fmt(text)}</h3>`);
        continue;
      }

      html.push(`<h${level}>${fmt(text)}</h${level}>`);
      continue;
    }

    // ── Tables ──
    if (t.startsWith('|') && t.endsWith('|')) {
      closeList();
      const cells = t.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      if (!inTable) {
        html.push('<table><thead><tr>');
        for (const c of cells) html.push(`<th>${fmt(c)}</th>`);
        html.push('</tr></thead><tbody>');
        inTable = true;
        continue;
      }
      html.push('<tr>');
      for (const c of cells) html.push(`<td>${fmt(c)}</td>`);
      html.push('</tr>');
      continue;
    }
    closeTable();

    // ── Blockquotes ──
    if (t.startsWith('>')) {
      closeList();
      const content = t.replace(/^>\s*/, '');
      // Chat teaser detection
      if (content.startsWith('💬') || content.startsWith('\\ud83d')) {
        const cleaned = content.replace(/^💬\s*/, '');
        html.push(`<blockquote class="chat-teaser">${fmt(cleaned)}</blockquote>`);
      } else {
        html.push(`<blockquote>${fmt(content)}</blockquote>`);
      }
      continue;
    }

    // ── Checkboxes ──
    const cb = t.match(/^- \[([ xX])\]\s+(.+)$/);
    if (cb) {
      const isChecked = cb[1] !== ' ';
      if (!inList || listType !== 'cb') {
        closeList();
        html.push('<ul class="checkbox-list">');
        inList = true;
        listType = 'cb';
      }
      const stateClass = isChecked ? 'cb-checked' : 'cb-unchecked';
      const iconClass = isChecked ? 'cb-icon checked' : 'cb-icon';
      const iconContent = isChecked ? '✓' : '';
      html.push(`<li class="${stateClass}"><span class="${iconClass}">${iconContent}</span>${fmt(cb[2]!)}</li>`);
      continue;
    }

    // ── Unordered lists ──
    if (t.startsWith('- ') || t.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        closeList();
        html.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      html.push(`<li>${fmt(t.slice(2))}</li>`);
      continue;
    }

    // ── Ordered lists ──
    const ol = t.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (!inList || listType !== 'ol') {
        closeList();
        html.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      html.push(`<li>${fmt(ol[1]!)}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${fmt(t)}</p>`);
  }

  closeList();
  closeTable();
  closeFindingCard();

  // Close any open priority section
  if (currentPriority != null) {
    html.push('</div>');
  }

  return html.join('\n');
}

// ── Utilities ────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}
