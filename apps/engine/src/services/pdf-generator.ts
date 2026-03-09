/**
 * Server-side PDF generation using Patchright element screenshots.
 *
 * Chrome's print renderer (page.pdf()) ignores overflow:hidden at page
 * boundaries, causing slide content to bleed across pages. Instead, we:
 *   1. Navigate to the slides page in a real browser
 *   2. Screenshot each .slide-card element (respects overflow:hidden)
 *   3. Compose screenshots into a PDF via an image-only HTML page
 *
 * This guarantees pixel-perfect output — what you see on screen is what
 * you get in the PDF.
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
    // Use a wider viewport so slides have more vertical space (14:8.5 aspect ratio).
    // At 1344px width, cards are only 816px tall and content overflows.
    // At 1920px width, cards are 1165px tall — matching typical browser view.
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
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    console.log(`[pdf-generator] Page loaded: status=${response?.status()}, url=${page.url()}`);

    // Log what we see on the page
    const pageTitle = await page.title();
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || 'empty');
    const slidesAttr = await page.evaluate(() => document.querySelector('[data-slides-loaded]')?.getAttribute('data-slides-loaded') ?? 'NOT FOUND');
    const cardCount = await page.evaluate(() => document.querySelectorAll('.slide-card').length);
    console.log(`[pdf-generator] Page state: title="${pageTitle}", slidesLoaded="${slidesAttr}", cards=${cardCount}, body="${bodyText.substring(0, 100)}"`);

    // Wait for slides — try data-slides-loaded first, fall back to .slide-card
    if (slidesAttr !== 'true') {
      console.log(`[pdf-generator] Waiting for slides to load...`);
      try {
        await page.waitForSelector('[data-slides-loaded="true"]', { timeout: 30_000 });
      } catch {
        // Fallback: wait for slide cards to appear
        console.log(`[pdf-generator] data-slides-loaded timeout, checking for .slide-card elements...`);
        const finalCardCount = await page.evaluate(() => document.querySelectorAll('.slide-card').length);
        console.log(`[pdf-generator] Found ${finalCardCount} slide cards`);
        if (finalCardCount === 0) {
          throw new Error('No slides rendered on the page');
        }
        // Give extra time for rendering
        await page.waitForTimeout(2000);
      }
    }

    // Extra settle time for canvas animations (plasma, dithering)
    await page.waitForTimeout(500);

    // Step 1: Screenshot each slide card — element screenshots
    // always respect overflow:hidden, unlike page.pdf()
    const cards = await page.$$('.slide-card');
    console.log(`[pdf-generator] Screenshotting ${cards.length} slides`);

    const dataUrls: string[] = [];
    for (const card of cards) {
      const buf = await card.screenshot({ type: 'png' });
      dataUrls.push('data:image/png;base64,' + buf.toString('base64'));
    }

    // Step 2: Compose into PDF via image-only HTML page
    // Since the content is flat raster images, Chrome's print renderer
    // cannot break layout — images just fill each page exactly.
    const compositionHtml = `<!DOCTYPE html>
<html><head><style>
  @page { size: 14in 8.5in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #080808; }
  .pg { width: 14in; height: 8.5in; page-break-after: always; overflow: hidden; }
  .pg:last-child { page-break-after: auto; }
  .pg img { width: 100%; height: 100%; display: block; object-fit: fill; }
</style></head><body>
${dataUrls.map((src) => `<div class="pg"><img src="${src}"></div>`).join('\n')}
</body></html>`;

    const pdfPage = await browser.newPage();
    await pdfPage.setContent(compositionHtml, { waitUntil: 'load' });

    // Wait for all images to render
    await pdfPage.waitForTimeout(300);

    const pdf = await pdfPage.pdf({
      width: '14in',
      height: '8.5in',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      displayHeaderFooter: false,
    });

    console.log(`[pdf-generator] PDF generated: ${pdf.length} bytes, ${dataUrls.length} pages`);
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
