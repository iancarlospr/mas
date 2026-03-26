/**
 * Generate email header logo with glow effect baked in using sharp.
 *
 * Usage: node packages/email-service/scripts/generate-email-logo.mjs
 * Output: prints the base64 string to stdout
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../../apps/web/public/logo-white.png');

const SCALE = 2;             // nearest-neighbor upscale — bigger logo
const PAD_X = 20;            // minimal padding (glow bleeds into transparency)
const PAD_Y = 14;

async function main() {
  const meta = await sharp(SRC).metadata();
  const scaledW = Math.round(meta.width * SCALE);
  const scaledH = Math.round(meta.height * SCALE);
  const w = scaledW + PAD_X * 2;
  const h = scaledH + PAD_Y * 2;

  // Upscale source with nearest-neighbor to preserve pixel art edges
  const upscaled = await sharp(SRC)
    .resize(scaledW, scaledH, { kernel: 'nearest' })
    .toBuffer();

  const pad = { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X, background: { r: 0, g: 0, b: 0, alpha: 0 } };

  // Wide ambient glow — heavily blurred so letter shapes fully dissolve
  const glow1 = await sharp(upscaled)
    .extend(pad)
    .blur(40)
    .toBuffer();

  // Tight glow — blurred enough to lose letter edges but still bright
  const glow2 = await sharp(upscaled)
    .extend(pad)
    .blur(22)
    .toBuffer();

  // Logo with padding (crisp)
  const crispLogo = await sharp(upscaled)
    .extend(pad)
    .toBuffer();

  // Composite on TRANSPARENT bg — works on any email header color (light or dark theme)
  const result = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: glow1, blend: 'over' },
      { input: glow2, blend: 'over' },
      { input: crispLogo, blend: 'over' },
    ])
    .png()
    .toBuffer();

  const b64 = result.toString('base64');
  console.log(b64);
  console.error(`Generated: ${w}x${h}, ${result.length} bytes, ${b64.length} chars base64`);
}

main();
