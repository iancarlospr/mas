import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Alpha Scan — Forensic Marketing Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const png = await readFile(join(process.cwd(), 'public', 'og-image.png'));
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}
