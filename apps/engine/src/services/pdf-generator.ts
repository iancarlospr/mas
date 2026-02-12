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
