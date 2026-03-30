import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import pino from 'pino';
import { getSupabaseAdmin } from './supabase.js';

const logger = pino({ name: 'resilient-writer' });
const FALLBACK_DIR = '/tmp/failed-writes';

/**
 * Resilient result writer that falls back to local file if Supabase is down.
 * A background job should retry these periodically.
 */
export async function writeResultsResilient(
  scanId: string,
  table: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(table).upsert(data);
    if (error) throw error;
  } catch (err) {
    logger.warn(
      { scanId, table, error: String(err) },
      'Supabase write failed, saving to fallback file',
    );

    await mkdir(FALLBACK_DIR, { recursive: true });
    const fallbackPath = join(FALLBACK_DIR, `${scanId}_${table}_${Date.now()}.json`);
    await writeFile(fallbackPath, JSON.stringify({ scanId, table, data }));
    logger.info({ fallbackPath }, 'Fallback file written');
  }
}
