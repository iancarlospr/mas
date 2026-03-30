'use client';

import { useRef, useEffect } from 'react';

/**
 * GrainCanvas — canvas-rendered noise texture that html2canvas can capture.
 *
 * Replaces the SVG feTurbulence filter approach which html2canvas cannot render.
 * Draws greyscale noise pixels directly onto a canvas element, matching the
 * visual appearance of: feTurbulence baseFrequency=0.6 numOctaves=3 + desaturate.
 *
 * At 8-12% opacity the result is visually identical to the SVG filter version.
 */
export function GrainCanvas({ opacity = 0.08, className }: { opacity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Match parent size — use a reasonable resolution for grain
    // (full res would be wasteful for subtle noise at low opacity)
    const w = 256;
    const h = 256;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;     // R
      data[i + 1] = v; // G
      data[i + 2] = v; // B
      data[i + 3] = 255; // A (opacity handled by CSS)
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity,
        imageRendering: 'pixelated',
      }}
    />
  );
}
