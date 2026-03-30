/**
 * Generate presentation PDF by screenshotting each slide at the exact
 * frontend dimensions (1875px wide, screen media — NOT print media).
 *
 * Using page.pdf() triggers print media which forces 14in (1344px @96dpi),
 * shrinking cqi units and breaking layouts. Instead we screenshot each
 * .slide-page element in screen mode and assemble a PDF from the PNGs.
 */

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'fs';
import sharp from 'sharp';

const SCAN_ID = process.argv[2] || '42ba6dbc-1e28-4efa-9762-c7dbad83af82';
const BASE_URL = process.argv[3] || 'https://marketingalphascan.com';

// Frontend slide dimensions — matches scan-dashboard-content.tsx (1875px design width, 14:8.5 aspect)
const SLIDE_W = 1875;
const SLIDE_H = Math.round(SLIDE_W * (8.5 / 14)); // 1138px

const url = `${BASE_URL}/report/${SCAN_ID}/slides?print=1`;

console.log(`Generating PDF for scan ${SCAN_ID}`);
console.log(`Slide dimensions: ${SLIDE_W}×${SLIDE_H}px`);
console.log(`URL: ${url}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: SLIDE_W, height: SLIDE_H * 3 }, // tall viewport so slides aren't clipped
  deviceScaleFactor: 2, // 2x for crisp text in the PDF
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForSelector('[data-slides-loaded="true"]', { timeout: 30_000 });
await page.waitForTimeout(1500); // settle for fonts + paint

// Force every slide-card to render at exact frontend size (screen mode, no print shrink)
await page.addStyleTag({
  content: `
    .slide-page {
      width: ${SLIDE_W}px !important;
      height: ${SLIDE_H}px !important;
      overflow: hidden !important;
    }
    .slide-page .slide-card {
      width: ${SLIDE_W}px !important;
      height: ${SLIDE_H}px !important;
      aspect-ratio: unset !important;
      overflow: hidden !important;
      border-radius: 0 !important;
    }
  `,
});
await page.waitForTimeout(500);

// Screenshot every slide
const slides = await page.$$('.slide-page');
console.log(`Found ${slides.length} slides, capturing...`);

const pngBuffers = [];
for (let i = 0; i < slides.length; i++) {
  const png = await slides[i].screenshot({ type: 'png' });
  pngBuffers.push(png);
  process.stdout.write(`  ${i + 1}/${slides.length}\r`);
}
console.log(`\nCaptured ${pngBuffers.length} slides.`);

await browser.close();

// Assemble PDF — each page = one slide at 1875×1138 pts (1:1 with pixels at 72 DPI)
const pdf = await PDFDocument.create();
const PAGE_W = SLIDE_W; // points
const PAGE_H = SLIDE_H; // points

const HERO_COUNT = 3;  // first 3 slides: lossless PNG (full quality)
const TAIL_COUNT = 3;  // last 3 slides: lossless PNG (full quality)
const total = pngBuffers.length;

for (let i = 0; i < total; i++) {
  const isHero = i < HERO_COUNT || i >= total - TAIL_COUNT;
  let img;
  if (isHero) {
    // Lossless PNG for hero/tail slides (gradients, plasma, dithers)
    img = await pdf.embedPng(pngBuffers[i]);
  } else {
    // JPEG 85% quality for the bulk slides
    const jpegBuf = await sharp(pngBuffers[i]).jpeg({ quality: 85 }).toBuffer();
    img = await pdf.embedJpg(jpegBuf);
  }
  const p = pdf.addPage([PAGE_W, PAGE_H]);
  p.drawImage(img, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
}

const pdfBytes = await pdf.save();
const domainSlug = SCAN_ID.replace(/[^a-z0-9]/gi, '-');
const outFile = `${domainSlug}-presentation.pdf`;
writeFileSync(outFile, pdfBytes);

console.log(`Done! ${outFile} — ${pngBuffers.length} pages, ${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB`);
