'use client';

import { useRef, useEffect } from 'react';

/* =================================================================
   Desktop Wallpaper — Cinematic Ambient Lighting (Canvas)

   Void-black base (#080808) with subtle atmospheric light spills.
   Think: dark room with light leaking through blinds + screen glow.
   Rendered as canvas with per-pixel dithering to eliminate banding.
   ================================================================= */

// Light spill definitions — matches the original CSS radial gradients
// Each: center [cx,cy as 0-1], radii [rx,ry as 0-1], color [r,g,b], alpha, falloff end (0-1)
const LIGHTS: { cx: number; cy: number; rx: number; ry: number; r: number; g: number; b: number; a: number; end: number }[] = [
  // Cool bluish wash from above — oklch(0.22 0.04 260) ≈ rgb(38,43,60)
  { cx: 0.5, cy: -0.1, rx: 1.0, ry: 0.5, r: 38, g: 43, b: 60, a: 0.25, end: 0.7 },
  // Warm accent — bottom-left — oklch(0.25 0.08 340) ≈ rgb(62,35,50)
  { cx: 0.1, cy: 0.85, rx: 0.6, ry: 0.5, r: 62, g: 35, b: 50, a: 0.12, end: 0.7 },
  // Cool accent — top-right — oklch(0.20 0.03 250) ≈ rgb(32,37,52)
  { cx: 0.9, cy: 0.15, rx: 0.5, ry: 0.6, r: 32, g: 37, b: 52, a: 0.10, end: 0.65 },
  // Center screen glow — oklch(0.18 0.05 340) ≈ rgb(48,28,40)
  { cx: 0.5, cy: 0.45, rx: 0.4, ry: 0.35, r: 48, g: 28, b: 40, a: 0.08, end: 0.7 },
];

export function BedroomWallpaper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let prevW = 0;
    let prevH = 0;

    function render() {
      const w = container!.offsetWidth;
      const h = container!.offsetHeight;
      if (w === 0 || h === 0 || (w === prevW && h === prevH)) return;
      prevW = w;
      prevH = h;

      canvas!.width = w;
      canvas!.height = h;

      const imageData = ctx!.createImageData(w, h);
      const buf = imageData.data;

      // Base color: #080808
      const baseR = 8, baseG = 8, baseB = 8;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const idx = (y * w + x) * 4;

          let rr = baseR, gg = baseG, bb = baseB;

          // Additive light spills
          for (const l of LIGHTS) {
            const dx = (nx - l.cx) / l.rx;
            const dy = (ny - l.cy) / l.ry;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < l.end) {
              const t = 1 - dist / l.end; // 1 at center, 0 at edge
              const intensity = t * t * l.a; // quadratic falloff
              rr += l.r * intensity;
              gg += l.g * intensity;
              bb += l.b * intensity;
            }
          }

          // Vignette — darken corners
          const vx = (nx - 0.5) / 0.75;
          const vy = (ny - 0.5) / 0.65;
          const vDist = Math.sqrt(vx * vx + vy * vy);
          if (vDist > 0.3) {
            const vFade = Math.min(1, (vDist - 0.3) / 0.7);
            const darken = 1 - vFade * 0.6;
            rr *= darken;
            gg *= darken;
            bb *= darken;
          }

          // Dither: ±1.5 random noise per channel to break 8-bit banding
          const d = () => (Math.random() - 0.5) * 3;
          buf[idx]     = Math.max(0, Math.min(255, Math.round(rr + d())));
          buf[idx + 1] = Math.max(0, Math.min(255, Math.round(gg + d())));
          buf[idx + 2] = Math.max(0, Math.min(255, Math.round(bb + d())));
          buf[idx + 3] = 255;
        }
      }

      ctx!.putImageData(imageData, 0, 0);
    }

    render();

    const ro = new ResizeObserver(() => render());
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden bg-gs-void" aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
