/**
 * Server-side PDF generation using page.pdf().
 *
 * The presentation-slides-view.tsx has print CSS that forces each
 * .slide-page to exactly 14in × 8.5in with overflow:hidden, so
 * page.pdf() produces clean page breaks without content bleed.
 */
import { chromium } from 'patchright';
import { getSupabaseAdmin } from './supabase.js';

// ─── Presentation PDF (slide deck) ──────────────────────────────────────

export async function generatePresentationPDF(
  scanId: string,
  reportBaseUrl: string,
): Promise<Buffer> {
  const url = `${reportBaseUrl}/report/${scanId}/slides?print=1`;
  console.log(`[pdf-generator] Generating presentation PDF for ${scanId}: ${url}`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1165 },
    });

    // Capture page errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[pdf-generator] Page console error: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`[pdf-generator] Page JS error: ${err.message}`);
    });

    console.log(`[pdf-generator] Navigating to ${url}`);
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    console.log(`[pdf-generator] Page loaded: status=${response?.status()}, url=${page.url()}`);

    // Wait for slide cards to render
    await page.waitForSelector('.slide-card', { timeout: 30_000 });
    const cardCount = await page.evaluate(() => document.querySelectorAll('.slide-card').length);
    console.log(`[pdf-generator] Found ${cardCount} slide cards`);

    if (cardCount === 0) {
      throw new Error('No slides rendered on the page');
    }

    // Wait for rendering to settle (canvas animations, fonts, layout)
    await page.waitForTimeout(3500);

    // Generate PDF directly — print CSS in presentation-slides-view.tsx
    // handles page dimensions (14in × 8.5in), overflow:hidden, and breaks
    console.log(`[pdf-generator] Generating PDF via page.pdf()`);
    const pdf = await page.pdf({
      width: '14in',
      height: '8.5in',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      displayHeaderFooter: false,
    });

    console.log(`[pdf-generator] PDF generated: ${pdf.length} bytes, ${cardCount} slides`);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function uploadPresentationPDF(
  scanId: string,
  pdf: Buffer,
): Promise<string> {
  const filename = `reports/${scanId}/presentation.pdf`;

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

  if (!data) throw new Error('Failed to create signed URL for presentation PDF');
  return data.signedUrl;
}
