/**
 * Generate email header logo + footer icon with glow effect baked in.
 *
 * Header: ASCII "ALPHA SCAN" block art rendered via SVG → PNG → glow composite
 * Footer: Chloé ghost sprite rendered as a simple pixel-art PNG
 *
 * Usage: node packages/email-service/scripts/generate-email-logo.mjs
 * Output: prints HEADER then FOOTER base64 strings separated by a line
 */

import sharp from 'sharp';

/* ── ASCII brand banner ────────────────────────────────────────── */

const ASCII_BRAND = ` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

const PINK = '#FFB2EF';

/* ── Header: ASCII art → SVG → PNG with glow ───────────────────── */

async function generateHeader() {
  const lines = ASCII_BRAND.split('\n');
  const fontSize = 11;
  const lineHeight = fontSize * 1.05;
  const charWidth = fontSize * 0.6; // monospace approximate

  // Calculate SVG dimensions
  const maxChars = Math.max(...lines.map((l) => l.length));
  const textW = Math.ceil(maxChars * charWidth);
  const textH = Math.ceil(lines.length * lineHeight);

  const PAD_X = 60;
  const PAD_Y = 40;
  const svgW = textW + PAD_X * 2;
  const svgH = textH + PAD_Y * 2;

  // Escape XML entities
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Build SVG with the ASCII art as monospace text
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="${PAD_X}" dy="${i === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono&amp;display=swap');
    text { font-family: 'Geist Mono', 'SF Mono', 'Menlo', 'Consolas', monospace; }
  </style>
  <text
    fill="${PINK}"
    font-size="${fontSize}"
    y="${PAD_Y + fontSize}"
    xml:space="preserve"
  >${tspans}</text>
</svg>`;

  // Render SVG to PNG
  const crisp = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(crisp).metadata();
  const w = meta.width;
  const h = meta.height;

  // Wide ambient glow
  const glow1 = await sharp(crisp).blur(14).toBuffer();

  // Tight glow
  const glow2 = await sharp(crisp).blur(7).toBuffer();

  // Composite: glow layers + crisp text on transparent
  const result = await sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: glow1, blend: 'over' },
      { input: glow2, blend: 'over' },
      { input: crisp, blend: 'over' },
    ])
    .png()
    .toBuffer();

  return { b64: result.toString('base64'), w, h, bytes: result.length };
}

/* ── Footer: Chloé ghost pixel art → PNG ───────────────────────── */

async function generateFooter() {
  // Render the ghost as a simple pixel grid SVG
  // 32x32 simplified ghost, scaled to 64x64 output
  // Colors from chloe-sprite.tsx CANVAS_COLORS
  const BODY = '#FFF0FA';
  const SHADE = '#FFCAF3';
  const OUTLINE = '#1A161A';
  const EYES = '#FFB2EF';
  const EYE_HL = '#FFFFFF';
  const BLUSH = '#FFD4E8';
  const _ = null;
  const o = OUTLINE, b = BODY, s = SHADE, e = EYES, h = EYE_HL, l = BLUSH;

  // Simplified 16x20 ghost grid (will be rendered at 4x = 64px wide)
  const grid = [
    [_,_,_,_,_,o,o,o,o,o,o,_,_,_,_,_],
    [_,_,_,o,o,b,b,b,b,b,b,o,o,_,_,_],
    [_,_,o,b,b,b,b,b,b,b,b,b,b,o,_,_],
    [_,o,b,b,b,b,b,b,b,b,b,b,b,b,o,_],
    [_,o,b,b,b,b,b,b,b,b,b,b,b,b,o,_],
    [o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o],
    [o,b,b,b,e,e,e,b,b,b,e,e,e,b,b,o],
    [o,b,b,e,e,h,e,b,b,b,e,h,e,e,b,o],
    [o,b,b,b,e,e,e,b,b,b,e,e,e,b,b,o],
    [o,b,b,l,b,b,b,b,b,b,b,b,b,l,b,o],
    [o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o],
    [o,b,b,b,b,b,o,o,o,o,b,b,b,b,b,o],
    [o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o],
    [o,b,b,b,b,s,b,b,b,b,s,b,b,b,b,o],
    [o,b,b,b,b,b,s,b,b,s,b,b,b,b,b,o],
    [o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o],
    [o,b,b,b,b,b,b,b,b,b,b,b,b,b,b,o],
    [o,b,b,o,b,b,b,o,o,b,b,b,o,b,b,o],
    [o,b,o,_,o,b,o,_,_,o,b,o,_,o,b,o],
    [o,o,_,_,_,o,_,_,_,_,o,_,_,_,o,o],
  ];

  const PX = 4; // Each grid cell = 4x4 pixels → 64x80 output
  const gridW = grid[0].length;
  const gridH = grid.length;
  const imgW = gridW * PX;
  const imgH = gridH * PX;

  // Build SVG pixel grid
  let rects = '';
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const c = grid[y][x];
      if (c) {
        rects += `<rect x="${x * PX}" y="${y * PX}" width="${PX}" height="${PX}" fill="${c}"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgW}" height="${imgH}">${rects}</svg>`;

  const result = await sharp(Buffer.from(svg)).png().toBuffer();
  return { b64: result.toString('base64'), w: imgW, h: imgH, bytes: result.length };
}

/* ── Main ──────────────────────────────────────────────────────── */

async function main() {
  const header = await generateHeader();
  const footer = await generateFooter();

  // Output header base64 first, then footer, separated by newline
  console.log(header.b64);
  console.log('---SEPARATOR---');
  console.log(footer.b64);

  console.error(`Header: ${header.w}x${header.h}, ${header.bytes} bytes, ${header.b64.length} chars b64`);
  console.error(`Footer: ${footer.w}x${footer.h}, ${footer.bytes} bytes, ${footer.b64.length} chars b64`);
}

main();
