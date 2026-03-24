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
 * Boss Deck pages are rendered via dangerouslySetInnerHTML. html2canvas's
 * DocumentCloner can't find those elements directly ("Unable to find element
 * in cloned iframe"), so each page's HTML is copied into a fresh wrapper.
 *
 * Grain texture: uses html2canvas's `onclone` callback to inject the SVG
 * feTurbulence filter definition and inline filter styles into the CLONED
 * document — same pattern as the verdict slide (verdict-slide.tsx).
 * This ensures the filter renders in html2canvas's internal iframe.
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
  const fontLinks: { el: HTMLElement; parent: Node }[] = [];
  document.querySelectorAll<HTMLElement>(
    'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]',
  ).forEach((el) => {
    if (el.parentNode) {
      fontLinks.push({ el, parent: el.parentNode });
      el.remove();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .bd-capture-wrapper .page {
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

  for (let i = 0; i < total; i++) {
    onProgress?.({ phase: 'capturing', current: i + 1, total });

    // Copy page HTML into a fresh wrapper (avoids "Unable to find element" error)
    const wrapper = document.createElement('div');
    wrapper.className = 'bd-capture-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.innerHTML = pages[i]!.outerHTML;
    document.body.appendChild(wrapper);

    const captureTarget = wrapper.querySelector('.page') as HTMLElement;

    await new Promise((r) => requestAnimationFrame(r));

    const canvas = await html2canvas(captureTarget, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0A0E1A',
      windowWidth: BD_W,
      width: BD_W,
      height: BD_H,
      logging: false,
      // Inject SVG feTurbulence filter + inline styles into the CLONED
      // document before html2canvas renders it — same pattern as the
      // verdict slide where the filter is inside the captured element.
      onclone: (clonedDoc: Document) => {
        // Find the .page inside html2canvas's clone
        const clonedPage = clonedDoc.querySelector('.bd-capture-wrapper .page');
        if (!clonedPage) return;

        // Inject SVG filter def inside the cloned .page
        const svgContainer = clonedDoc.createElement('div');
        svgContainer.innerHTML = GRAIN_SVG;
        const svg = svgContainer.firstElementChild;
        if (svg) clonedPage.insertBefore(svg, clonedPage.firstChild);

        // Apply filter as inline style on grain overlays in the clone
        const grainEls = clonedPage.querySelectorAll<HTMLElement>(GRAIN_SELECTORS);
        for (const el of grainEls) {
          el.style.filter = 'url(#bd-grain)';
        }
      },
    });

    wrapper.remove();

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
