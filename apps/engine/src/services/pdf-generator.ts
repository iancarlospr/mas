/**
 * Server-side PDF generation.
 *
 * Two strategies:
 *   1. page.pdf() — Presentation slides (uses print CSS for page breaks)
 *   2. Screenshot → pdf-lib assembly — Boss Deck (captures screen mode
 *      exactly, bypassing Chrome's print renderer which breaks shadows,
 *      filters, text-shadow, and backdrop-filter)
 */
import { chromium } from 'patchright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { getSupabaseAdmin } from './supabase.js';

// ─── Presentation PDF (screenshot-based, pixel-perfect) ─────────────────

// Presentation slides are 14:8.5 aspect ratio. Use 1875px design width (matches frontend).
const PRES_PAGE_W = 1875;
const PRES_PAGE_H = Math.round(PRES_PAGE_W * (8.5 / 14)); // 1138

export async function generatePresentationPDF(
  scanId: string,
  reportBaseUrl: string,
): Promise<Buffer> {
  const url = `${reportBaseUrl}/report/${scanId}/slides?print=1`;
  console.log(`[presentation-pdf] Generating for ${scanId}: ${url}`);

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
      viewport: { width: PRES_PAGE_W, height: PRES_PAGE_H * 3 },
      deviceScaleFactor: 2, // 2x for crisp text
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[presentation-pdf] Page console error: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`[presentation-pdf] Page JS error: ${err.message}`);
    });

    console.log(`[presentation-pdf] Navigating to ${url}`);
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    console.log(`[presentation-pdf] Page loaded: status=${response?.status()}, url=${page.url()}`);

    // Wait for slides to render
    await page.waitForSelector('[data-slides-loaded="true"]', { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);

    // Force exact dimensions in screen mode (bypass print CSS entirely)
    await page.addStyleTag({
      content: `
        .slide-page {
          width: ${PRES_PAGE_W}px !important;
          height: ${PRES_PAGE_H}px !important;
          overflow: hidden !important;
        }
        .slide-page .slide-card {
          width: ${PRES_PAGE_W}px !important;
          height: ${PRES_PAGE_H}px !important;
          aspect-ratio: unset !important;
          overflow: hidden !important;
          border-radius: 0 !important;
        }
      `,
    });

    // Settle for fonts + canvas paint
    await page.waitForTimeout(2000);

    // Screenshot every slide in screen mode
    const slides = await page.$$('.slide-page');
    console.log(`[presentation-pdf] Found ${slides.length} slides, capturing...`);

    if (slides.length === 0) {
      throw new Error('No slides rendered on the page');
    }

    const pngBuffers: Buffer[] = [];
    for (let i = 0; i < slides.length; i++) {
      const png = await slides[i]!.screenshot({ type: 'png' });
      pngBuffers.push(Buffer.from(png));
    }
    console.log(`[presentation-pdf] Captured ${pngBuffers.length} slides`);

    // Assemble PDF — hero/tail as PNG, bulk as JPEG
    const pdf = await PDFDocument.create();
    const total = pngBuffers.length;
    const HERO_COUNT = 3;
    const TAIL_COUNT = 3;

    for (let i = 0; i < total; i++) {
      const isHero = i < HERO_COUNT || i >= total - TAIL_COUNT;
      let img;

      if (isHero) {
        img = await pdf.embedPng(pngBuffers[i]!);
      } else {
        const jpegBuf = await sharp(pngBuffers[i]!).jpeg({ quality: 85 }).toBuffer();
        img = await pdf.embedJpg(jpegBuf);
      }

      const p = pdf.addPage([PRES_PAGE_W, PRES_PAGE_H]);
      p.drawImage(img, { x: 0, y: 0, width: PRES_PAGE_W, height: PRES_PAGE_H });
    }

    const pdfBytes = await pdf.save();
    console.log(`[presentation-pdf] PDF assembled: ${pdfBytes.length} bytes, ${total} slides`);

    return Buffer.from(pdfBytes);
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

// ─── Boss Deck PDF (screenshot-based, pixel-perfect) ────────────────────

// Boss Deck pages are 14in × 8.5in. At 96 DPI that's 1344 × 816 px.
const BD_PAGE_W = 1344;
const BD_PAGE_H = 816;

export async function generateBossDeckPDF(
  scanId: string,
  reportBaseUrl: string,
): Promise<Buffer> {
  const url = `${reportBaseUrl}/api/reports/${scanId}/boss-deck?print=1`;
  console.log(`[boss-deck-pdf] Generating for ${scanId}: ${url}`);

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
      viewport: { width: BD_PAGE_W, height: BD_PAGE_H * 3 },
      deviceScaleFactor: 2, // 2x for crisp text
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[boss-deck-pdf] Page console error: ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`[boss-deck-pdf] Page JS error: ${err.message}`);
    });

    console.log(`[boss-deck-pdf] Navigating to ${url}`);
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    console.log(`[boss-deck-pdf] Page loaded: status=${response?.status()}, url=${page.url()}`);

    // Wait for pages to render
    await page.waitForSelector('.page', { timeout: 30_000 });

    // Wait for Google Fonts to finish loading
    await page.evaluate(() => document.fonts.ready);

    // Force exact page dimensions and hide print banner
    await page.addStyleTag({
      content: `
        .page {
          width: ${BD_PAGE_W}px !important;
          height: ${BD_PAGE_H}px !important;
          overflow: hidden !important;
        }
        .print-banner { display: none !important; }
        body { margin-top: 0 !important; }
      `,
    });

    // Settle for fonts + SVG grain paint + base64 images
    await page.waitForTimeout(2000);

    // Screenshot every .page element in screen mode
    const pages = await page.$$('.page');
    console.log(`[boss-deck-pdf] Found ${pages.length} pages, capturing...`);

    if (pages.length === 0) {
      throw new Error('No pages rendered on the Boss Deck');
    }

    const pngBuffers: Buffer[] = [];
    for (let i = 0; i < pages.length; i++) {
      const png = await pages[i]!.screenshot({ type: 'png' });
      pngBuffers.push(Buffer.from(png));
    }
    console.log(`[boss-deck-pdf] Captured ${pngBuffers.length} pages`);

    // Assemble PDF — each page = one screenshot
    const pdf = await PDFDocument.create();
    const total = pngBuffers.length;

    for (let i = 0; i < total; i++) {
      // First and last pages: lossless PNG (cover + closer have gradients, plasma, dithers)
      // Middle pages: JPEG 85% (text-heavy slides compress well)
      const isHeroOrTail = i === 0 || i === total - 1;
      let img;

      if (isHeroOrTail) {
        img = await pdf.embedPng(pngBuffers[i]!);
      } else {
        const jpegBuf = await sharp(pngBuffers[i]!).jpeg({ quality: 85 }).toBuffer();
        img = await pdf.embedJpg(jpegBuf);
      }

      const p = pdf.addPage([BD_PAGE_W, BD_PAGE_H]);
      p.drawImage(img, { x: 0, y: 0, width: BD_PAGE_W, height: BD_PAGE_H });
    }

    const pdfBytes = await pdf.save();
    console.log(`[boss-deck-pdf] PDF assembled: ${pdfBytes.length} bytes, ${total} pages`);

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

export async function uploadBossDeckPDF(
  scanId: string,
  pdf: Buffer,
): Promise<string> {
  const filename = `reports/${scanId}/boss-deck.pdf`;

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

  if (!data) throw new Error('Failed to create signed URL for Boss Deck PDF');
  return data.signedUrl;
}
