/**
 * Test script: Boss Deck screenshot-based PDF generation.
 * Matches the exact logic in apps/engine/src/services/pdf-generator.ts
 */
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { writeFileSync } from 'fs';

const SCAN_ID = process.argv[2] || 'cfd34830-1e04-4034-8063-fd39b178cdc1';
const BASE_URL = process.argv[3] || 'https://marketingalphascan.com';

const BD_PAGE_W = 1344;
const BD_PAGE_H = 816;

const url = `${BASE_URL}/api/reports/${SCAN_ID}/boss-deck?print=1`;

console.log(`Generating Boss Deck PDF for scan ${SCAN_ID}`);
console.log(`Page dimensions: ${BD_PAGE_W}×${BD_PAGE_H}px (2x DPI)`);
console.log(`URL: ${url}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: BD_PAGE_W, height: BD_PAGE_H * 3 },
  deviceScaleFactor: 2,
});

console.log('Navigating...');
const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
console.log(`Page loaded: status=${response?.status()}`);

await page.waitForSelector('.page', { timeout: 30_000 });
await page.evaluate(() => document.fonts.ready);

// Force exact dimensions and hide banner
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

await page.waitForTimeout(2000);

const pages = await page.$$('.page');
console.log(`Found ${pages.length} pages, capturing...`);

const pngBuffers = [];
for (let i = 0; i < pages.length; i++) {
  const png = await pages[i].screenshot({ type: 'png' });
  pngBuffers.push(png);
  process.stdout.write(`  ${i + 1}/${pages.length}\r`);
}
console.log(`\nCaptured ${pngBuffers.length} pages.`);

await browser.close();

// Assemble PDF
const pdf = await PDFDocument.create();
const total = pngBuffers.length;

for (let i = 0; i < total; i++) {
  const isHeroOrTail = i === 0 || i === total - 1;
  let img;
  if (isHeroOrTail) {
    img = await pdf.embedPng(pngBuffers[i]);
  } else {
    const jpegBuf = await sharp(pngBuffers[i]).jpeg({ quality: 85 }).toBuffer();
    img = await pdf.embedJpg(jpegBuf);
  }
  const p = pdf.addPage([BD_PAGE_W, BD_PAGE_H]);
  p.drawImage(img, { x: 0, y: 0, width: BD_PAGE_W, height: BD_PAGE_H });
}

const pdfBytes = await pdf.save();
const outFile = `brainhi-boss-deck.pdf`;
writeFileSync(outFile, pdfBytes);

console.log(`Done! ${outFile} — ${total} pages, ${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB`);
