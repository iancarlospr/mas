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

/** SVG grain filter markup — same as verdict slide's inline SVG pattern. */
const GRAIN_SVG = `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs><filter id="bd-grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs></svg>`;

/** Grain overlay selectors used in boss-deck-html.ts */
const GRAIN_SELECTORS = '.bar-grain, .bar-grain-light, .wins-grain, .results-grain, .closer-grain';

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
 * Uses the same direct-capture approach as the Audit Deck: capture live
 * DOM elements, not innerHTML copies. The verdict slide proves that SVG
 * feTurbulence grain renders correctly when html2canvas captures live
 * elements with inline filter styles.
 *
 * Before capture: inject SVG filter def inside each .page + set inline
 * filter styles on grain overlays (same pattern as verdict-slide.tsx).
 * After capture: clean up injected elements.
 */
export async function generateBossDeckPDFClientSide(
  onProgress?: (progress: PDFProgress) => void,
): Promise<Uint8Array> {
  const pages = document.querySelectorAll<HTMLElement>('.page');
  const total = pages.length;

  if (total === 0) {
    throw new Error('No pages found on the page');
  }

  // Temporarily remove external Google Fonts <link> elements from <head>.
  // html2canvas clones the document into an iframe whose CSP blocks external
  // stylesheets — the fonts are already loaded and cached in memory.
  const fontLinks: { el: HTMLElement; parent: Node }[] = [];
  document.querySelectorAll<HTMLElement>(
    'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]',
  ).forEach((el) => {
    if (el.parentNode) {
      fontLinks.push({ el, parent: el.parentNode });
      el.remove();
    }
  });

  // Force exact dimensions on all pages (same approach as Audit Deck)
  const style = document.createElement('style');
  style.textContent = `
    .page {
      width: ${BD_W}px !important;
      height: ${BD_H}px !important;
      overflow: hidden !important;
      position: relative !important;
    }
    .print-banner { display: none !important; }
    body { margin-top: 0 !important; }
  `;
  document.head.appendChild(style);

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const pdf = await PDFDocument.create();

  // Track injected elements for cleanup
  const injectedSvgs: Element[] = [];
  const grainStyleBackups: { el: HTMLElement; original: string }[] = [];

  // Pre-capture: inject SVG filter inside each .page + set inline styles
  // on grain overlays (same pattern as verdict slide)
  for (let i = 0; i < total; i++) {
    const page = pages[i]!;

    // Inject SVG filter def inside .page (verdict slide has it inside .slide-card)
    const svgWrapper = document.createElement('div');
    svgWrapper.innerHTML = GRAIN_SVG;
    const svg = svgWrapper.firstElementChild!;
    page.insertBefore(svg, page.firstChild);
    injectedSvgs.push(svg);

    // Apply filter as inline style (verdict slide uses inline style, not CSS class)
    const grainEls = page.querySelectorAll<HTMLElement>(GRAIN_SELECTORS);
    for (const el of grainEls) {
      grainStyleBackups.push({ el, original: el.style.filter });
      el.style.filter = 'url(#bd-grain)';
    }
  }

  // Let layout settle after injections
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Capture each page directly from the live DOM (same as Audit Deck)
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

  // Cleanup: remove injected SVGs, restore original filter styles, restore fonts
  for (const svg of injectedSvgs) svg.remove();
  for (const { el, original } of grainStyleBackups) el.style.filter = original;
  fontLinks.forEach(({ el, parent }) => parent.appendChild(el));
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
