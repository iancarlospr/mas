/**
 * Generate the OG share image (1200×630) as a static PNG.
 * - Dark bg with subtle pink glow
 * - Giant slanted smug ghost sprite (faded background)
 * - Pink glowing "ALPHA SCAN" pixel-art logo (from logo-white.png), big & centered
 * - "MarTech breakdown..." tagline at bottom
 *
 * Run: node scripts/generate-og-image.mjs
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = join(__dirname, '..', 'apps', 'web', 'public');
const APP_DIR = join(__dirname, '..', 'apps', 'web', 'app');

const W = 1200;
const H = 630;

/* ── Ghost pixel grid (smug state, 32×42) ── */
const _ = null;
const o = 'outline', b = 'body', s = 'shade', e = 'eyes', h = 'eyeHighlight', l = 'blush';

const ghostGrid = [
  [_,_,_,_,_,_,_,_,_,_,_,o,o,o,o,o,o,o,o,o,o,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,o,o,b,b,b,b,b,b,b,b,b,b,o,o,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_,_],
  [_,_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_,_],
  [_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_],
  [_,_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_,_],
  [_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_],
  [_,_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,e,e,h,e,e,b,b,b,b,b,b,b,e,e,h,e,e,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,e,e,e,e,e,b,b,b,b,b,b,b,e,e,e,e,e,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,e,e,e,b,b,b,b,b,b,b,b,b,e,e,e,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,l,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,l,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,o,o,o,o,o,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,s,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o,_,_],
  [_,_,o,b,b,b,s,b,b,b,b,b,b,s,b,b,b,b,s,b,b,b,b,b,b,s,b,b,b,o,_,_],
  [_,_,o,b,b,s,b,b,b,o,b,b,s,b,b,b,o,s,b,b,b,o,b,b,s,b,b,b,o,_,_,_],
  [_,_,_,o,s,b,b,o,_,_,o,s,b,b,o,_,_,o,b,b,o,_,_,o,b,b,o,o,_,_,_,_],
  [_,_,_,_,o,b,o,_,_,_,_,o,b,o,_,_,_,_,o,o,_,_,_,_,o,o,_,_,_,_,_,_],
  [_,_,_,_,_,o,_,_,_,_,_,_,o,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

const COLORS = {
  body:         [255, 240, 250],
  shade:        [255, 202, 243],
  outline:      [26,  22,  26],
  eyes:         [255, 178, 239],
  eyeHighlight: [255, 255, 255],
  blush:        [255, 212, 232],
};

const BG = [8, 8, 8];

/* ── Render ghost onto a raw RGBA buffer ── */
function renderGhost(buf, bufW, bufH, scale, offsetX, offsetY, alpha) {
  for (let gy = 0; gy < 42; gy++) {
    const row = ghostGrid[gy];
    if (!row) continue;
    for (let gx = 0; gx < 32; gx++) {
      const pixel = row[gx];
      if (!pixel) continue;
      const color = COLORS[pixel];
      if (!color) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = offsetX + gx * scale + dx;
          const py = offsetY + gy * scale + dy;
          if (px >= 0 && px < bufW && py >= 0 && py < bufH) {
            const idx = (py * bufW + px) * 4;
            // Alpha blend
            buf[idx]     = Math.round(buf[idx]     + (color[0] - buf[idx])     * alpha);
            buf[idx + 1] = Math.round(buf[idx + 1] + (color[1] - buf[idx + 1]) * alpha);
            buf[idx + 2] = Math.round(buf[idx + 2] + (color[2] - buf[idx + 2]) * alpha);
          }
        }
      }
    }
  }
}

/* ── Render rotated ghost (simplified: pre-render then composite with rotation via sharp) ── */
async function createRotatedGhost(scale, alpha) {
  const gw = 32 * scale;
  const gh = 42 * scale;
  const buf = Buffer.alloc(gw * gh * 4, 0); // transparent

  for (let gy = 0; gy < 42; gy++) {
    const row = ghostGrid[gy];
    if (!row) continue;
    for (let gx = 0; gx < 32; gx++) {
      const pixel = row[gx];
      if (!pixel) continue;
      const color = COLORS[pixel];
      if (!color) continue;
      const a = Math.round(alpha * 255);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = gx * scale + dx;
          const py = gy * scale + dy;
          const idx = (py * gw + px) * 4;
          buf[idx]     = color[0];
          buf[idx + 1] = color[1];
          buf[idx + 2] = color[2];
          buf[idx + 3] = a;
        }
      }
    }
  }

  return sharp(buf, { raw: { width: gw, height: gh, channels: 4 } })
    .png()
    .toBuffer();
}

/* ── Radial glow helper ── */
function addRadialGlow(buf, bufW, bufH, cx, cy, rx, ry, color, intensity) {
  for (let y = 0; y < bufH; y++) {
    for (let x = 0; x < bufW; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) {
        const t = 1 - dist;
        const alpha = t * t * intensity;
        const idx = (y * bufW + x) * 4;
        buf[idx]     = Math.round(buf[idx]     + (color[0] - buf[idx])     * alpha);
        buf[idx + 1] = Math.round(buf[idx + 1] + (color[1] - buf[idx + 1]) * alpha);
        buf[idx + 2] = Math.round(buf[idx + 2] + (color[2] - buf[idx + 2]) * alpha);
      }
    }
  }
}

/* ── Main ── */
async function generate() {
  // 1. Create base image with dark bg
  const baseBuf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    baseBuf[i * 4]     = BG[0];
    baseBuf[i * 4 + 1] = BG[1];
    baseBuf[i * 4 + 2] = BG[2];
    baseBuf[i * 4 + 3] = 255;
  }

  // 2. Add subtle pink radial glow behind center
  addRadialGlow(baseBuf, W, H, W / 2, H * 0.42, 500, 350, [255, 178, 239], 0.10);

  // 3. Top and bottom accent lines (pink gradient)
  for (let x = 0; x < W; x++) {
    const t = Math.abs(x - W / 2) / (W / 2);
    const lineAlpha = Math.max(0, 1 - t) * 0.8;
    const pink = [255, 178, 239];
    // Top line (3px)
    for (let y = 0; y < 3; y++) {
      const idx = (y * W + x) * 4;
      baseBuf[idx]     = Math.round(baseBuf[idx]     + (pink[0] - baseBuf[idx])     * lineAlpha);
      baseBuf[idx + 1] = Math.round(baseBuf[idx + 1] + (pink[1] - baseBuf[idx + 1]) * lineAlpha);
      baseBuf[idx + 2] = Math.round(baseBuf[idx + 2] + (pink[2] - baseBuf[idx + 2]) * lineAlpha);
    }
    // Bottom line (3px)
    for (let y = H - 3; y < H; y++) {
      const idx = (y * W + x) * 4;
      baseBuf[idx]     = Math.round(baseBuf[idx]     + (pink[0] - baseBuf[idx])     * lineAlpha);
      baseBuf[idx + 1] = Math.round(baseBuf[idx + 1] + (pink[1] - baseBuf[idx + 1]) * lineAlpha);
      baseBuf[idx + 2] = Math.round(baseBuf[idx + 2] + (pink[2] - baseBuf[idx + 2]) * lineAlpha);
    }
  }

  // Divider line (1px, centered, ~500px wide, at y=390)
  const divY = 390;
  const divHalfW = 280;
  for (let x = W / 2 - divHalfW; x < W / 2 + divHalfW; x++) {
    const t = Math.abs(x - W / 2) / divHalfW;
    const lineAlpha = Math.max(0, 1 - t) * 0.5;
    const idx = (divY * W + Math.round(x)) * 4;
    baseBuf[idx]     = Math.round(baseBuf[idx]     + (255 - baseBuf[idx])     * lineAlpha);
    baseBuf[idx + 1] = Math.round(baseBuf[idx + 1] + (178 - baseBuf[idx + 1]) * lineAlpha);
    baseBuf[idx + 2] = Math.round(baseBuf[idx + 2] + (239 - baseBuf[idx + 2]) * lineAlpha);
  }

  // 4. Render rotated ghosts directly onto base buffer
  function renderRotatedGhost(cx, cy, scale, angle, alpha) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const gpw = 32 * scale;
    const gph = 42 * scale;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const sx = dx * cosA + dy * sinA + gpw / 2;
        const sy = -dx * sinA + dy * cosA + gph / 2;
        if (sx < 0 || sx >= gpw || sy < 0 || sy >= gph) continue;
        const gx = Math.floor(sx / scale);
        const gy = Math.floor(sy / scale);
        if (gx < 0 || gx >= 32 || gy < 0 || gy >= 42) continue;
        const cell = ghostGrid[gy]?.[gx];
        if (!cell) continue;
        const color = COLORS[cell];
        if (!color) continue;
        const idx = (py * W + px) * 4;
        baseBuf[idx]     = Math.round(baseBuf[idx]     + (color[0] - baseBuf[idx])     * alpha);
        baseBuf[idx + 1] = Math.round(baseBuf[idx + 1] + (color[1] - baseBuf[idx + 1]) * alpha);
        baseBuf[idx + 2] = Math.round(baseBuf[idx + 2] + (color[2] - baseBuf[idx + 2]) * alpha);
      }
    }
  }

  // Ghost 1 — main, right side, -35deg, brighter
  renderRotatedGhost(W * 0.68, H * 0.50, 20, -35 * Math.PI / 180, 0.12);
  // Ghost 2 — echo, left side, +20deg, fainter
  renderRotatedGhost(W * 0.18, H * 0.35, 14, 20 * Math.PI / 180, 0.06);

  const baseImg2 = sharp(baseBuf, { raw: { width: W, height: H, channels: 4 } }).png();

  // 5. Load and process the pixel-art logo
  const logoScale = 3; // 328*3 = 984px wide, 42*3 = 126px tall
  const logoPink = await sharp(join(WEB_PUBLIC, 'logo-white.png'))
    .tint({ r: 255, g: 178, b: 239 })
    .resize(328 * logoScale, 42 * logoScale, { kernel: 'nearest' })
    .png()
    .toBuffer();

  // 6. Create tagline as SVG text
  const tagline = 'MarTech breakdown.  Strategic insights.  Actionable recommendations.';
  const tagSvg = Buffer.from(`<svg width="${W}" height="60" xmlns="http://www.w3.org/2000/svg">
    <text x="${W / 2}" y="40" text-anchor="middle"
      font-family="monospace" font-size="20" letter-spacing="1.5"
      fill="rgba(255,240,250,0.45)">${tagline}</text>
  </svg>`);

  // 7. Composite logo + tagline onto base (ghost already rendered in buffer)
  const result = await sharp(await baseImg2.toBuffer())
    .composite([
      // Logo — centered, slightly above middle
      {
        input: logoPink,
        left: Math.round((W - 328 * logoScale) / 2),
        top: Math.round(H * 0.35 - (42 * logoScale) / 2),
        blend: 'over',
      },
      // Tagline — below divider
      {
        input: tagSvg,
        left: 0,
        top: 420,
        blend: 'over',
      },
    ])
    .png()
    .toBuffer();

  // Save as static OG image in app/ (Next.js file convention)
  await sharp(result).toFile(join(APP_DIR, 'opengraph-image.png'));
  // Also save to public for direct access
  await sharp(result).toFile(join(WEB_PUBLIC, 'og-image.png'));

  console.log('✓ opengraph-image.png (1200×630)');
}

generate().catch(console.error);
