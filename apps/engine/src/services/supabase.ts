import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ModuleResult, ModuleId, ScanStatus } from '@marketing-alpha/types';
import pino from 'pino';

const logger = pino({ name: 'supabase-service' });

let client: SupabaseClient | null = null;

/**
 * Get the Supabase admin client using service_role key.
 * Lazily initializes on first call.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables',
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  logger.info('Supabase admin client initialized');
  return client;
}

/**
 * Update the status of a scan in the scans table.
 */
export async function updateScanStatus(
  scanId: string,
  status: ScanStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };

  // Set started_at when transitioning from queued
  if (status === 'passive') {
    updateData['started_at'] = new Date().toISOString();
  }

  // Set completed_at on terminal states
  if (status === 'complete' || status === 'failed' || status === 'cancelled') {
    updateData['completed_at'] = new Date().toISOString();
  }

  const { error } = await supabase
    .from('scans')
    .update(updateData)
    .eq('id', scanId);

  if (error) {
    logger.error({ scanId, status, error: error.message }, 'Failed to update scan status');
    throw new Error(`Failed to update scan status: ${error.message}`);
  }

  logger.info({ scanId, status }, 'Scan status updated');
}

/**
 * Upsert a module result into the module_results table.
 * Uses the (scan_id, module_id) composite key for upsert.
 */
export async function upsertModuleResult(
  scanId: string,
  result: ModuleResult,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Sanitize data: strip invalid Unicode escape sequences that PostgreSQL rejects
  const sanitizedData = JSON.parse(JSON.stringify(result.data).replace(/\\u0000/g, ''));

  const row = {
    scan_id: scanId,
    module_id: result.moduleId,
    status: result.status,
    data: sanitizedData,
    signals: result.signals,
    score: result.score,
    checkpoints: result.checkpoints,
    duration_ms: result.duration,
    error: result.error ?? null,
  };

  const { error } = await supabase
    .from('module_results')
    .upsert(row, {
      onConflict: 'scan_id,module_id',
    });

  if (error) {
    logger.error(
      { scanId, moduleId: result.moduleId, error: error.message },
      'Failed to upsert module result',
    );
    throw new Error(`Failed to upsert module result: ${error.message}`);
  }

  logger.debug({ scanId, moduleId: result.moduleId, status: result.status }, 'Module result upserted');
}

/**
 * Get a scan by ID.
 */
export async function getScanById(scanId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    logger.error({ scanId, error: error.message }, 'Failed to get scan');
    throw new Error(`Failed to get scan: ${error.message}`);
  }

  return data;
}

/**
 * Get all module results for a scan.
 */
export async function getModuleResults(
  scanId: string,
): Promise<ModuleResult[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('module_results')
    .select('*')
    .eq('scan_id', scanId)
    .order('module_id');

  if (error) {
    logger.error({ scanId, error: error.message }, 'Failed to get module results');
    throw new Error(`Failed to get module results: ${error.message}`);
  }

  if (!data) return [];

  return data.map((row) => ({
    moduleId: row['module_id'] as ModuleId,
    status: row['status'],
    data: row['data'] ?? {},
    signals: row['signals'] ?? [],
    score: row['score'] ?? null,
    checkpoints: row['checkpoints'] ?? [],
    duration: row['duration_ms'] ?? 0,
    error: row['error'] ?? undefined,
  }));
}

/**
 * Update the marketing_iq field on a scan.
 */
export async function updateScanMarketingIQ(
  scanId: string,
  marketingIq: number,
  marketingIqResult: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('scans')
    .update({
      marketing_iq: marketingIq,
      marketing_iq_result: marketingIqResult,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scanId);

  if (error) {
    logger.error({ scanId, error: error.message }, 'Failed to update marketing IQ');
    throw new Error(`Failed to update marketing IQ: ${error.message}`);
  }

  logger.info({ scanId, marketingIq }, 'Marketing IQ updated');
}

/**
 * Check if the Supabase connection is healthy.
 */
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('scans').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
