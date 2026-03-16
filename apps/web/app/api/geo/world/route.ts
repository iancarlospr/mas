import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    cached = readFileSync(join(process.cwd(), 'public', 'world-110m.json'), 'utf-8');
  }
  return new NextResponse(cached, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
