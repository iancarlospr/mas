/**
 * Test script: Presentation screenshot-based PDF generation.
 * Matches the updated logic in apps/engine/src/services/pdf-generator.ts
 */
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const SCAN_ID = process.argv[2] || 'cfd34830-1e04-4034-8063-fd39b178cdc1';
const BASE_URL = process.argv[3] || 'https://marketingalphascan.com';

const PRES_PAGE_W = 1875;
const PRES_PAGE_H = Math.round(PRES_PAGE_W * (8.5 / 14)); // 1138

const url = `${BASE_URL}/report/${SCAN_ID}/slides?print=1`;

console.log(`Generating Presentation PDF for scan ${SCAN_ID}`);
console.log(`Slide dimensions: ${PRES_PAGE_W}×${PRES_PAGE_H}px (2x DPI)`);
console.log(`URL: ${url}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: PRES_PAGE_W, height: PRES_PAGE_H * 3 },
  deviceScaleFactor: 2,
});

console.log('Navigating...');
const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
console.log(`Page loaded: status=${response?.status()}`);

await page.waitForSelector('[data-slides-loaded="true"]', { timeout: 30_000 });
await page.evaluate(() => document.fonts.ready);

// Force exact dimensions in screen mode
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

await page.waitForTimeout(2000);

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

// Assemble PDF
const pdf = await PDFDocument.create();
const total = pngBuffers.length;
const HERO_COUNT = 3;
const TAIL_COUNT = 3;

for (let i = 0; i < total; i++) {
  const isHero = i < HERO_COUNT || i >= total - TAIL_COUNT;
  let img;
  if (isHero) {
    img = await pdf.embedPng(pngBuffers[i]);
  } else {
    const jpegBuf = await sharp(pngBuffers[i]).jpeg({ quality: 85 }).toBuffer();
    img = await pdf.embedJpg(jpegBuf);
  }
  const p = pdf.addPage([PRES_PAGE_W, PRES_PAGE_H]);
  p.drawImage(img, { x: 0, y: 0, width: PRES_PAGE_W, height: PRES_PAGE_H });
}

const pdfBytes = await pdf.save();
const outFile = `brainhi-presentation.pdf`;
writeFileSync(outFile, pdfBytes);

console.log(`Done! ${outFile} — ${total} slides, ${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB`);
