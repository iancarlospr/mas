/**
 * Server-side PDF generation using Playwright.
 * PRD-cont-4 Section 8.2 — Legal size paper (8.5" × 14").
 */
import { chromium } from 'patchright';
import { getSupabaseAdmin } from './supabase.js';

export async function generateReportPDF(
  scanId: string,
  reportBaseUrl: string,
): Promise<Buffer> {
  const reportUrl = `${reportBaseUrl}/report/${scanId}?print=true`;
  console.log(`[pdf-generator] Generating PDF for ${scanId}: ${reportUrl}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    await page.goto(reportUrl, { waitUntil: 'networkidle' });

    // Wait for all charts to signal completion
    await page.waitForSelector('[data-charts-loaded="true"]', { timeout: 30_000 });

    const pdf = await page.pdf({
      // Legal size: 8.5" × 14"
      width: '8.5in',
      height: '14in',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '20mm',
        bottom: '25mm',
        left: '15mm',
        right: '15mm',
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:8px;width:100%;text-align:left;padding-left:15mm;">
          <span style="color:#94A3B8;">MarketingAlphaScan</span>
        </div>`,
      footerTemplate: `
        <div style="font-size:8px;width:100%;text-align:right;padding-right:15mm;">
          <span style="color:#94A3B8;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </span>
        </div>`,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Markdown to HTML converter ─────────────────────────────────────────
// Lightweight converter for M43 PRD markdown → print-optimized HTML.
// Handles: headings, bold, italic, lists, tables, blockquotes, checkboxes,
// horizontal rules, inline code, and paragraphs.

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;
  let listType = '';
  let inTable = false;
  let tableHeaderDone = false;

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
      tableHeaderDone = false;
    }
  };

  const inlineFormat = (text: string): string => {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Empty line
    if (trimmed === '') {
      closeList();
      closeTable();
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      closeList();
      closeTable();
      html.push('<hr />');
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      closeTable();
      const level = headingMatch[1]!.length;
      html.push(`<h${level}>${inlineFormat(headingMatch[2]!)}</h${level}>`);
      continue;
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());

      // Skip separator row (|---|---|)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        tableHeaderDone = true;
        continue;
      }

      if (!inTable) {
        html.push('<table><thead><tr>');
        for (const cell of cells) {
          html.push(`<th>${inlineFormat(cell)}</th>`);
        }
        html.push('</tr></thead><tbody>');
        inTable = true;
        continue;
      }

      html.push('<tr>');
      for (const cell of cells) {
        html.push(`<td>${inlineFormat(cell)}</td>`);
      }
      html.push('</tr>');
      continue;
    }

    // Close table if we hit a non-table line
    closeTable();

    // Blockquote
    if (trimmed.startsWith('>')) {
      closeList();
      const content = trimmed.replace(/^>\s*/, '');
      html.push(`<blockquote>${inlineFormat(content)}</blockquote>`);
      continue;
    }

    // Checkbox list item
    const checkboxMatch = trimmed.match(/^- \[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        html.push('<ul style="list-style:none;margin-left:0;">');
        inList = true;
        listType = 'ul';
      }
      const checked = checkboxMatch[1] !== ' ';
      const checkbox = checked ? '&#9745;' : '&#9744;';
      html.push(`<li>${checkbox} ${inlineFormat(checkboxMatch[2]!)}</li>`);
      continue;
    }

    // Unordered list item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        closeList();
        html.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      html.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        html.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      html.push(`<li>${inlineFormat(olMatch[1]!)}</li>`);
      continue;
    }

    // Paragraph
    closeList();
    html.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeList();
  closeTable();
  return html.join('\n');
}

// ─── PRD PDF generation ─────────────────────────────────────────────────

export async function generatePrdPDF(scanId: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();

  // Fetch M43 markdown from module_results
  const { data: m43Row, error: fetchError } = await supabase
    .from('module_results')
    .select('data')
    .eq('scan_id', scanId)
    .eq('module_id', 'M43')
    .single();

  if (fetchError || !m43Row?.data) {
    throw new Error(`M43 data not found for scan ${scanId}`);
  }

  const m43Data = m43Row.data as Record<string, unknown>;
  const markdown = m43Data['markdown'] as string | undefined;
  const metadata = (m43Data['metadata'] ?? {}) as Record<string, unknown>;

  if (!markdown) {
    throw new Error(`M43 markdown content is empty for scan ${scanId}`);
  }

  // Convert markdown to styled HTML
  const bodyHtml = markdownToHtml(markdown);
  const title = (metadata['title'] as string | undefined) ?? 'Remediation Plan';

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 8.5in 14in; margin: 1in; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 100%;
  }
  h1 { font-size: 20pt; margin-bottom: 4pt; color: #111; }
  h2 { font-size: 16pt; margin-top: 28pt; margin-bottom: 8pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; color: #222; }
  h3 { font-size: 13pt; margin-top: 20pt; margin-bottom: 6pt; color: #333; }
  h4 { font-size: 11pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; }
  p { margin: 6pt 0; }
  code { font-family: 'Courier New', Courier, monospace; font-size: 10pt; background: #f5f5f5; padding: 1px 4px; border-radius: 2px; }
  blockquote {
    border-left: 3px solid #999;
    margin: 12pt 0;
    padding: 8px 16px;
    color: #555;
    font-style: italic;
    background: #fafafa;
  }
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f8f8f8; font-weight: bold; }
  hr { border: none; border-top: 1px solid #ccc; margin: 24pt 0; }
  ul, ol { margin-left: 20px; padding-left: 0; }
  li { margin-bottom: 4pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  // Render to PDF with Patchright
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle' });

    const pdf = await page.pdf({
      width: '8.5in',
      height: '14in',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:8px;width:100%;text-align:left;padding-left:25mm;">
          <span style="color:#94A3B8;">${title.replace(/"/g, '&quot;')}</span>
        </div>`,
      footerTemplate: `
        <div style="font-size:8px;width:100%;text-align:right;padding-right:25mm;">
          <span style="color:#94A3B8;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </span>
        </div>`,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function uploadPrdPDF(
  scanId: string,
  pdf: Buffer,
): Promise<string> {
  const filename = `reports/${scanId}/remediation-plan.pdf`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from('reports')
    .upload(filename, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  const { data } = await getSupabaseAdmin().storage
    .from('reports')
    .createSignedUrl(filename, 60 * 60 * 24); // 24h expiry

  if (!data) throw new Error('Failed to create signed URL for PRD PDF');
  return data.signedUrl;
}

// ─── Report PDF ─────────────────────────────────────────────────────────

export async function uploadReportPDF(
  scanId: string,
  pdf: Buffer,
): Promise<string> {
  const filename = `reports/${scanId}/MarketingAlphaScan-Report.pdf`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from('reports')
    .upload(filename, pdf, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  const { data } = await getSupabaseAdmin().storage
    .from('reports')
    .createSignedUrl(filename, 60 * 60 * 24); // 24h expiry

  if (!data) throw new Error('Failed to create signed URL');
  return data.signedUrl;
}
