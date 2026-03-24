/**
 * Client-side PDF generation for Presentation (Audit Deck) and Boss Deck.
 *
 * Uses html2canvas-pro to screenshot each page element in the user's
 * browser, then assembles them into a PDF with pdf-lib.
 * Zero server involvement — all compute happens on the client.
 */

import html2canvas from 'html2canvas-pro';
import { PDFDocument } from 'pdf-lib';

// ── Presentation (Audit Deck) ────────────────────────────────
const PRES_W = 1875;
const PRES_H = 1138;
const HERO_COUNT = 3;
const TAIL_COUNT = 3;

// ── Boss Deck ────────────────────────────────────────────────
const BD_W = 1344;
const BD_H = 816;

export type PDFProgress = {
  phase: 'capturing' | 'assembling' | 'done';
  current: number;
  total: number;
};

/**
 * Convert a canvas element to a JPEG ArrayBuffer at the given quality.
 */
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas toBlob returned null'));
        blob.arrayBuffer().then(resolve, reject);
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Convert a canvas element to a PNG ArrayBuffer.
 */
function canvasToPng(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas toBlob returned null'));
        blob.arrayBuffer().then(resolve, reject);
      },
      'image/png',
    );
  });
}

/**
 * Generate a PDF from all .slide-page elements on the current page.
 * Processes incrementally (one slide at a time) to bound memory usage.
 */
export async function generatePresentationPDFClientSide(
  onProgress?: (progress: PDFProgress) => void,
): Promise<Uint8Array> {
  const slides = document.querySelectorAll<HTMLElement>('.slide-page');
  const total = slides.length;

  if (total === 0) {
    throw new Error('No slides found on the page');
  }

  // Force exact dimensions on all slides + their inner cards (same as engine).
  // The browser window may be narrower than 1875px, so slides render smaller.
  // This CSS override makes them fill the full PDF page before capture.
  const style = document.createElement('style');
  style.textContent = `
    .slide-page {
      width: ${PRES_W}px !important;
      height: ${PRES_H}px !important;
      overflow: hidden !important;
    }
    .slide-page .slide-card {
      width: ${PRES_W}px !important;
      height: ${PRES_H}px !important;
      aspect-ratio: unset !important;
      overflow: hidden !important;
      border-radius: 0 !important;
    }
  `;
  document.head.appendChild(style);

  // Let layout settle after dimension change
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const pdf = await PDFDocument.create();

  for (let i = 0; i < total; i++) {
    onProgress?.({ phase: 'capturing', current: i + 1, total });

    const canvas = await html2canvas(slides[i]!, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#080808',
      windowWidth: PRES_W,
      width: PRES_W,
      height: PRES_H,
      logging: false,
    });

    const isHero = i < HERO_COUNT || i >= total - TAIL_COUNT;
    let img;

    if (isHero) {
      const pngBytes = await canvasToPng(canvas);
      img = await pdf.embedPng(pngBytes);
    } else {
      const jpegBytes = await canvasToJpeg(canvas, 0.85);
      img = await pdf.embedJpg(jpegBytes);
    }

    const page = pdf.addPage([PRES_W, PRES_H]);
    page.drawImage(img, { x: 0, y: 0, width: PRES_W, height: PRES_H });
  }

  // Remove the dimension override
  style.remove();

  onProgress?.({ phase: 'assembling', current: total, total });
  const pdfBytes = await pdf.save();
  onProgress?.({ phase: 'done', current: total, total });

  return pdfBytes;
}

// Grain PNG base64 — tiled as background-image to replace SVG feTurbulence
// which html2canvas cannot render. 50×50px monochrome noise, ~5.8KB.
const GRAIN_B64 = 'iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAIAAACRXR/mAAAQzElEQVR42iXZZbgVVRQG4FFKuhGkW6QklO5OQUQEpBQBQenu7u4GSZWWli5BkJZGlO7ufHwvw4/ruXNm9l7rq7XnGly5cmXp0qX9+/c/fvx4/vz5b9269fLly+7duzds2HD69OknTpyYPXv2vXv34sePv2rVqv/++2/16tUPHz68cOFC3rx5P//885EjR969e/fo0aNp0qSpV6/esGHDrFOoUKHMmTNbyq9ffvnl1KlTf/nlF/dEjRr133//PXLkSNasWd2WO3du306ZMuXcuXPvvfde27ZtY8SIUalSpbhx4wavXr3y+6RJkzxmpwcPHnz00UctW7Y8cOCAaubPn1+0aNGhQ4eOGjXq/fffX7ZsmYJsOXz48EaNGnXo0EGhjx8/Xrx48aVLl3bt2lWjRo127dppsnr16okTJ06ePPm4ceO6det2+vTpGTNmlCpVKmfOnAUKFPBz7dq133777Zs3b5IkSVKmTJkcOXJ8/PHHJUuWnDx58saNG4Mvvvhi8+bN6lV73759r127liBBAstt3749VapUMLBWkSJFRowYAVQ7vXjxYt68ebFixfLI69evy5Yt+9133w0aNOiff/5ZuHDh4cOHM2TIECdOHDDs3LkzZcqUS5YsSZgw4eDBg+fOnatWq23YsOH27dtA+uyzz7Jnz66Ud955ByjRo0dXMQZgEcB5yJAh5cqVO3/+/NOnTz3/119/2aBp06adOnVq1qyZXhGHUNvYbNu2bRpC9KJFi4IggKW9M2bMqKBNmzaBTU0ffvihDz/99BNoMY6g33//XTMWVwF0w73AUadOHT9nzpw5duzYJ0+egMOdWbJkCdxtOQ0Rk76tpYl9+/YRkwow4tvy5ctjuWrVqii7ePEiYKgwWbJke/furVKlCsVUrlz52bNnN27c+OOPP6zeokULIEHik08+QatqYsaMWbFixbRp08JSWUicOHHiyZMnqcVGkSNHphDrr1mzBpueDXr06LF8+XI1tm7dOlKkSN988w21/fbbbwqiLfVRQNeuXeFvrdSpUwOsQYMGIERftmzZrKKU+vXr6xjMmlQT7Inm559/VlZoC75BDQb3799/8OBB7gGEldu3b4/cAQMGMAFcOGzChAkpUqQIqPjl2392XbBgwbFjx2q8/ffu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';

/**
 * Generate a PDF from all .bd-page elements (Boss Deck).
 * First and last pages as lossless PNG, middle as JPEG 85%.
 *
 * Captures directly from the live DOM — Boss Deck pages are rendered
 * as real React components (like the Audit Deck), so html2canvas can
 * clone them without issues.
 */
export async function generateBossDeckPDFClientSide(
  onProgress?: (progress: PDFProgress) => void,
): Promise<Uint8Array> {
  const pages = document.querySelectorAll<HTMLElement>('.bd-page');
  const total = pages.length;

  if (total === 0) {
    throw new Error('No pages found on the page');
  }

  // Force exact dimensions + replace SVG grain with tiled PNG for capture
  const style = document.createElement('style');
  style.textContent = `
    .bd-page {
      width: ${BD_W}px !important;
      height: ${BD_H}px !important;
      overflow: hidden !important;
    }
    /* html2canvas can't render SVG feTurbulence — swap with tiled PNG */
    .bar-grain, .bar-grain-light, .wins-grain, .results-grain, .closer-grain {
      filter: none !important;
      background: url('data:image/png;base64,${GRAIN_B64}') repeat !important;
    }
  `;
  document.head.appendChild(style);

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const pdf = await PDFDocument.create();

  for (let i = 0; i < total; i++) {
    onProgress?.({ phase: 'capturing', current: i + 1, total });

    const canvas = await html2canvas(pages[i]!, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0A0E1A',
      windowWidth: BD_W,
      width: BD_W,
      height: BD_H,
      logging: false,
    });

    const isHeroOrTail = i === 0 || i === total - 1;
    let img;

    if (isHeroOrTail) {
      const pngBytes = await canvasToPng(canvas);
      img = await pdf.embedPng(pngBytes);
    } else {
      const jpegBytes = await canvasToJpeg(canvas, 0.85);
      img = await pdf.embedJpg(jpegBytes);
    }

    const page = pdf.addPage([BD_W, BD_H]);
    page.drawImage(img, { x: 0, y: 0, width: BD_W, height: BD_H });
  }

  // Remove the dimension/grain override
  style.remove();

  onProgress?.({ phase: 'assembling', current: total, total });
  const pdfBytes = await pdf.save();
  onProgress?.({ phase: 'done', current: total, total });

  return pdfBytes;
}

/**
 * Trigger a browser download of the given bytes as a PDF file.
 */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
