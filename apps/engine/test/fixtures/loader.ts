import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;

export async function readFixture(...segments: string[]): Promise<unknown> {
  const path = join(FIXTURES_DIR, ...segments) + '.json';
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

export async function readHtmlFixture(...segments: string[]): Promise<string> {
  const path = join(FIXTURES_DIR, ...segments) + '.html';
  return readFile(path, 'utf-8');
}
