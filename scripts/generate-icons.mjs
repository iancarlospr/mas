/**
 * Generate pixel-perfect PWA/homescreen icons from Chloé ghost sprite.
 * Uses the exact 32x42 idle grid from chloe-sprite.tsx.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'apps', 'web', 'public');

/* ── Pixel grid (idle, frame 0) ── */
const _ = null;
const o = 'outline';
const b = 'body';
const s = 'shade';
const e = 'eyes';
const h = 'eyeHighlight';
const l = 'blush';

const GRID_W = 32;
const GRID_H = 42;

const grid = [
  /* 00 */ [_,_,_,_,_,_,_,_,_,_,_,o,o,o,o,o,o,o,o,o,o,_,_,_,_,_,_,_,_,_,_,_],
  /* 01 */ [_,_,_,_,_,_,_,_,_,o,o,b,b,b,b,b,b,b,b,b,b,o,o,_,_,_,_,_,_,_,_,_],
  /* 02 */ [_,_,_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_,_,_],
  /* 03 */ [_,_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_,_],
  /* 04 */ [_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_],
  /* 05 */ [_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_],
  /* 06 */ [_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_],
  /* 07 */ [_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_],
  /* 08 */ [_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_],
  /* 09 */ [_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_],
  /* 10 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 11 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 12 */ [_,_,o,b,b,b,b,b,e,e,e,b,b,b,b,b,b,b,b,b,e,e,e,b,b,b,b,b,b,o,_,_],
  /* 13 */ [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
  /* 14 */ [_,_,o,b,b,b,b,e,e,h,e,e,b,b,b,b,b,b,b,e,e,h,e,e,b,b,b,b,b,o,_,_],
  /* 15 */ [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
  /* 16 */ [_,_,o,b,b,b,b,b,e,e,e,b,b,b,b,b,b,b,b,b,e,e,e,b,b,b,b,b,b,o,_,_],
  /* 17 */ [_,_,o,b,b,b,l,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,l,b,b,b,b,o,_,_],
  /* 18 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 19 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,o,o,o,o,o,o,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 20 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 21 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 22 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 23 */ [_,_,o,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,o,_,_],
  /* 24 */ [_,_,o,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,o,_,_],
  /* 25 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 26 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 27 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 28 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 29 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 30 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 31 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 32 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 33 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 34 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 35 */ [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  /* 36 */ [_,_,o,b,b,b,s,b,b,b,b,b,b,s,b,b,b,b,s,b,b,b,b,b,b,s,b,b,b,o,_,_],
  /* 37 */ [_,_,o,b,b,s,b,b,b,o,b,b,s,b,b,b,o,s,b,b,b,o,b,b,s,b,b,b,o,_,_,_],
  /* 38 */ [_,_,_,o,s,b,b,o,_,_,o,s,b,b,o,_,_,o,b,b,o,_,_,o,b,b,o,o,_,_,_,_],
  /* 39 */ [_,_,_,_,o,b,o,_,_,_,_,o,b,o,_,_,_,_,o,o,_,_,_,_,o,o,_,_,_,_,_,_],
  /* 40 */ [_,_,_,_,_,o,_,_,_,_,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  /* 41 */ [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

/* ── Colors (RGBA) ── */
const COLORS = {
  body:         [255, 240, 250, 255],
  shade:        [255, 202, 243, 255],
  outline:      [26,  22,  26,  255],
  eyes:         [255, 178, 239, 255],
  eyeHighlight: [255, 255, 255, 255],
  blush:        [255, 212, 232, 255],
};

const BG = [8, 8, 8, 255];

/* ── Radial glow (subtle pink halo behind ghost) ── */
function addGlow(buf, size, cx, cy, radius) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const t = 1 - dist / radius;
        const alpha = t * t * 0.12; // subtle
        const idx = (y * size + x) * 4;
        // Blend pink glow (#FFB2EF) onto existing bg
        buf[idx]     = Math.round(buf[idx]     + (255 - buf[idx])     * alpha);
        buf[idx + 1] = Math.round(buf[idx + 1] + (178 - buf[idx + 1]) * alpha);
        buf[idx + 2] = Math.round(buf[idx + 2] + (239 - buf[idx + 2]) * alpha);
      }
    }
  }
}

/* ── Render icon at target size ── */
function createIconBuffer(size) {
  // Scale: ghost occupies ~80% of height
  const scale = Math.floor((size * 0.80) / GRID_H);
  const ghostW = GRID_W * scale;
  const ghostH = GRID_H * scale;
  const offsetX = Math.floor((size - ghostW) / 2);
  const offsetY = Math.floor((size - ghostH) / 2);

  const buf = Buffer.alloc(size * size * 4);

  // Fill background
  for (let i = 0; i < size * size; i++) {
    buf[i * 4]     = BG[0];
    buf[i * 4 + 1] = BG[1];
    buf[i * 4 + 2] = BG[2];
    buf[i * 4 + 3] = BG[3];
  }

  // Add subtle glow behind ghost
  addGlow(buf, size, Math.floor(size / 2), Math.floor(size * 0.45), Math.floor(size * 0.4));

  // Draw ghost pixels (nearest-neighbor upscale)
  for (let gy = 0; gy < GRID_H; gy++) {
    const row = grid[gy];
    if (!row) continue;
    for (let gx = 0; gx < GRID_W; gx++) {
      const pixel = row[gx];
      if (!pixel) continue;
      const color = COLORS[pixel];
      if (!color) continue;

      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = offsetX + gx * scale + dx;
          const py = offsetY + gy * scale + dy;
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4;
            buf[idx]     = color[0];
            buf[idx + 1] = color[1];
            buf[idx + 2] = color[2];
            buf[idx + 3] = color[3];
          }
        }
      }
    }
  }

  return buf;
}

/* ── Generate all sizes ── */
const SIZES = [
  { name: 'apple-icon.png', size: 180 },
  { name: 'icon-192.png',   size: 192 },
  { name: 'icon-512.png',   size: 512 },
];

for (const { name, size } of SIZES) {
  const buf = createIconBuffer(size);
  const outPath = join(OUT_DIR, name);
  await sharp(buf, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log(`✓ ${name} (${size}×${size})`);
}

console.log('\nDone! Icons saved to apps/web/public/');
