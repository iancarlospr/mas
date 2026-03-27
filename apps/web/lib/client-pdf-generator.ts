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

/** Grain overlay selectors used in boss-deck-html.ts */
const GRAIN_SELECTORS = '.bar-grain, .bar-grain-light, .wins-grain, .results-grain, .closer-grain';

/**
 * Pre-rasterize the closer slide's background image with its CSS filters
 * (blur 30px, saturate 0.4, brightness 0.2) baked in. html2canvas can't
 * render CSS filter on img elements, so we draw the filtered result onto
 * a canvas and replace the img.
 *
 * On iOS/mobile: large data URI images may report complete=true before the
 * bitmap is decoded → drawImage draws nothing. We use img.decode() to
 * guarantee readiness. If ctx.filter is unsupported (older iOS Safari), a
 * pixel-manipulation + scale-down blur fallback kicks in.
 */
function rasterizeCloserBg(container: HTMLElement): Promise<void> {
  const img = container.querySelector<HTMLImageElement>('.closer-bg');
  if (!img) return Promise.resolve();

  return new Promise((resolve) => {
    const apply = async () => {
      // On iOS, data URIs can report complete=true before bitmap is decoded.
      // img.decode() guarantees the bitmap is ready for canvas drawing.
      if (isIOSDevice()) {
        try { await img.decode(); } catch { /* proceed anyway */ }
      }

      const c = document.createElement('canvas');
      // Render at slightly larger size to account for scale(1.15) + blur bleed
      const scale = 1.15;
      c.width = Math.round(BD_W * scale);
      c.height = Math.round(BD_H * scale);
      const ctx = c.getContext('2d');
      if (!ctx) { resolve(); return; }

      // Try native canvas filter (Chrome, Firefox, Safari 17.2+)
      ctx.filter = 'blur(30px) saturate(0.4) brightness(0.2)';
      const nativeFilter = ctx.filter !== 'none' && ctx.filter !== '';

      if (nativeFilter) {
        ctx.drawImage(img, 0, 0, c.width, c.height);
      } else {
        // Fallback for browsers without ctx.filter (older iOS Safari):
        // 1. Draw raw image
        // 2. Apply saturate(0.4) + brightness(0.2) via pixel manipulation
        // 3. Approximate heavy blur via scale-down trick
        ctx.filter = 'none';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let p = 0; p < d.length; p += 4) {
          const r = d[p]!, g = d[p + 1]!, b = d[p + 2]!;
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          d[p]     = (gray + 0.4 * (r - gray)) * 0.2;
          d[p + 1] = (gray + 0.4 * (g - gray)) * 0.2;
          d[p + 2] = (gray + 0.4 * (b - gray)) * 0.2;
        }
        ctx.putImageData(id, 0, 0);
        // 3-pass scale-down blur (approximates heavy Gaussian blur)
        const sw = Math.max(1, c.width >> 3);
        const sh = Math.max(1, c.height >> 3);
        for (let i = 0; i < 3; i++) {
          ctx.drawImage(c, 0, 0, c.width, c.height, 0, 0, sw, sh);
          ctx.drawImage(c, 0, 0, sw, sh, 0, 0, c.width, c.height);
        }
      }

      // Replace img with the pre-filtered canvas
      Object.assign(c.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: '0',
        transform: 'scale(1.15)',
      });
      img.replaceWith(c);
      resolve();
    };

    if (img.complete && img.naturalWidth > 0) apply();
    else {
      img.onload = () => apply();
      // Increased from 3s → 6s for mobile (large data URIs decode slower)
      setTimeout(resolve, 6000);
    }
  });
}

/**
 * Render SVG feTurbulence through the browser's native SVG engine onto a
 * canvas. Produces the EXACT same grain as the web view — same algorithm,
 * same parameters — just rasterized so html2canvas can capture it.
 */
function renderGrainToCanvas(w: number, h: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error('Failed to render grain SVG'));
    img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
}

/**
 * Inject rasterized feTurbulence grain into each grain overlay element.
 * The source canvas was rendered by the browser's native SVG engine,
 * so it's visually identical to the web view's filter: url(#grain).
 */
function injectGrainCanvases(container: HTMLElement, grainSource: HTMLCanvasElement): void {
  const grainEls = container.querySelectorAll<HTMLElement>(GRAIN_SELECTORS);
  for (const el of grainEls) {
    el.style.filter = 'none';
    const clone = grainSource.cloneNode(true) as HTMLCanvasElement;
    // cloneNode doesn't copy canvas pixel data — redraw it
    const srcCtx = grainSource.getContext('2d');
    const dstCtx = clone.getContext('2d');
    if (srcCtx && dstCtx) {
      dstCtx.drawImage(grainSource, 0, 0);
    }
    Object.assign(clone.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    });
    el.appendChild(clone);
  }
}

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
 * DocumentCloner can't find those elements directly, so each page's HTML
 * is copied into a fresh wrapper element.
 *
 * Grain texture: SVG feTurbulence is rendered through the browser's native
 * SVG engine onto a canvas (renderGrainToCanvas), then injected into each
 * grain overlay element. This produces the exact same visual as the web
 * view — same feTurbulence algorithm, same parameters — just rasterized
 * so html2canvas can capture it.
 */
export async function generateBossDeckPDFClientSide(
  onProgress?: (progress: PDFProgress) => void,
): Promise<Uint8Array> {
  const pages = document.querySelectorAll<HTMLElement>('.page');
  const total = pages.length;

  if (total === 0) {
    throw new Error('No pages found on the page');
  }

  // Pre-render the feTurbulence grain to a reusable canvas
  const grainCanvas = await renderGrainToCanvas(BD_W, BD_H);

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

    // Copy page HTML into a fresh wrapper (avoids clone iframe error)
    const wrapper = document.createElement('div');
    wrapper.className = 'bd-capture-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.innerHTML = pages[i]!.outerHTML;
    document.body.appendChild(wrapper);

    const captureTarget = wrapper.querySelector('.page') as HTMLElement;

    // Inject rasterized feTurbulence grain into grain overlays
    injectGrainCanvases(captureTarget, grainCanvas);

    // Pre-rasterize closer slide's filtered background image
    // (html2canvas can't render filter: blur(30px) saturate(0.4) brightness(0.2))
    await rasterizeCloserBg(captureTarget);

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

/** Detect iOS / iPadOS — all browsers on iOS use WebKit and share the blob-download limitation */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return isIOS || isIPadOS;
}

/**
 * Trigger a browser download of the given bytes as a PDF file.
 *
 * iOS Safari (and all iOS browsers) silently ignore the `<a download>` +
 * programmatic `.click()` pattern on blob URLs. On iOS we try the Web Share
 * API first (native "Save to Files" sheet), then fall back to opening the
 * blob URL in a new tab (built-in PDF viewer).
 */
export async function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });

  if (isIOSDevice()) {
    // Try Web Share API — shows native share sheet with "Save to Files"
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {
        // User cancelled or share failed — fall through to window.open
      }
    }

    // Fallback: open blob URL in new tab (iOS PDF viewer with share button)
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Desktop: proven anchor-click approach
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
