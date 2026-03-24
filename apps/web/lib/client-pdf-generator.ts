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

/**
 * Generate a PDF from all .page elements (Boss Deck).
 * First and last pages as lossless PNG, middle as JPEG 85%.
 *
 * Renders the full HTML in a hidden iframe to avoid the
 * dangerouslySetInnerHTML cloning bug in html2canvas
 * ("Unable to find element in cloned iframe").
 */
export async function generateBossDeckPDFClientSide(
  fullHtml: string,
  onProgress?: (progress: PDFProgress) => void,
): Promise<Uint8Array> {
  // Create a hidden same-origin iframe and render the boss deck HTML
  // as a proper document. This ensures html2canvas can clone the DOM
  // correctly (the main page uses dangerouslySetInnerHTML which breaks
  // html2canvas's element-to-clone mapping).
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${BD_W}px`,
    height: `${BD_H * 8}px`,
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
    border: 'none',
  });
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!iDoc) throw new Error('Failed to access iframe document');

    iDoc.open();
    iDoc.write(fullHtml);
    iDoc.close();

    // Wait for document to finish loading
    await new Promise<void>((resolve) => {
      if (iDoc.readyState === 'complete') return resolve();
      iframe.addEventListener('load', () => resolve(), { once: true });
    });

    // Wait for Google Fonts to load inside the iframe
    try { await iDoc.fonts.ready; } catch { /* fallback below */ }
    await new Promise((r) => setTimeout(r, 1500));

    // Inject capture overrides into the iframe's <head>
    const captureStyle = iDoc.createElement('style');
    captureStyle.textContent = `
      .page {
        width: ${BD_W}px !important;
        height: ${BD_H}px !important;
        overflow: hidden !important;
      }
      .print-banner { display: none !important; }
      html, body {
        margin: 0 !important;
        margin-top: 0 !important;
        overflow: auto !important;
        height: auto !important;
      }
      /* Neutralise SVG grain overlays — keep elements in DOM to preserve
         tree structure, but make them invisible + strip the filter ref
         that html2canvas can't render. */
      .bar-grain, .bar-grain-light, .wins-grain, .results-grain, .closer-grain {
        opacity: 0 !important;
        filter: none !important;
      }
      .closer-bg { filter: brightness(0.2) !important; }
    `;
    iDoc.head.appendChild(captureStyle);

    // Let layout settle inside the iframe
    const iWin = iframe.contentWindow ?? window;
    await new Promise<void>((r) =>
      iWin.requestAnimationFrame(() => iWin.requestAnimationFrame(() => r())),
    );

    const pages = iDoc.querySelectorAll<HTMLElement>('.page');
    const total = pages.length;
    if (total === 0) throw new Error('No pages found in Boss Deck');

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

    onProgress?.({ phase: 'assembling', current: total, total });
    const pdfBytes = await pdf.save();
    onProgress?.({ phase: 'done', current: total, total });

    return pdfBytes;
  } finally {
    iframe.remove();
  }
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
