/**
 * Generate the OG share image (1200x630) as a static PNG.
 * Uses Playwright to render the ASCII art with Geist Mono (exact browser rendering),
 * then composites it onto the psychedelic background with a dark vignette.
 *
 * Run: node scripts/generate-og-image.mjs
 */
import sharp from 'sharp';
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEB_PUBLIC = join(ROOT, 'apps', 'web', 'public');
const APP_DIR = join(ROOT, 'apps', 'web', 'app');

const W = 1200;
const H = 630;

const ASCII_TITLE = ` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function generate() {
  // Load Geist Mono font as base64 for embedding in HTML
  const fontPath = join(ROOT, 'node_modules/geist/dist/fonts/geist-mono/GeistMono-Bold.ttf');
  const fontBase64 = (await readFile(fontPath)).toString('base64');

  // 1. Render ASCII art in a real browser
  const html = `<!DOCTYPE html>
<html><head><style>
  @font-face {
    font-family: 'GeistMono';
    font-weight: 700;
    src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
  }
  * { margin: 0; padding: 0; }
  body {
    width: ${W}px;
    height: ${H}px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  pre {
    font-family: 'GeistMono', monospace;
    font-weight: 700;
    font-size: 14px;
    line-height: 1.15;
    color: #FFB2EF;
    white-space: pre;
    text-shadow: 0 0 30px rgba(255, 178, 239, 0.5), 0 0 60px rgba(255, 178, 239, 0.2);
  }
  .tagline {
    font-family: 'GeistMono', monospace;
    font-weight: 700;
    font-size: 15px;
    color: rgba(255, 178, 239, 0.5);
    letter-spacing: 1.5px;
    margin-top: 24px;
  }
</style></head><body>
  <pre>${escapeHtml(ASCII_TITLE)}</pre>
  <div class="tagline">MarTech breakdown. Strategic insights. Actionable recommendations.</div>
</body></html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  // Wait for font to load
  await page.waitForTimeout(500);
  const textOverlay = await page.screenshot({ type: 'png', omitBackground: true });
  await browser.close();

  // 2. Load and resize background
  const bg = await sharp(join(WEB_PUBLIC, 'og-background.jpg'))
    .resize(W, H, { fit: 'cover' })
    .png()
    .toBuffer();

  // 3. Dark radial vignette as SVG
  const vignetteSvg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="v" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="black" stop-opacity="0.82"/>
        <stop offset="55%" stop-color="black" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.18"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#v)"/>
  </svg>`);

  // 4. Composite: background → vignette → text overlay
  const result = await sharp(bg)
    .composite([
      { input: vignetteSvg, top: 0, left: 0 },
      { input: textOverlay, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  // 5. Save
  await sharp(result).toFile(join(APP_DIR, 'opengraph-image.png'));
  await sharp(result).toFile(join(WEB_PUBLIC, 'og-image.png'));

  console.log('Done — opengraph-image.png (1200x630)');
}

generate().catch(console.error);
