import { SupabaseClient } from '@supabase/supabase-js';
import { engineFetch } from '@/lib/engine';

interface CreateScanOpts {
  supabase: SupabaseClient;
  userId: string;
  url: string;
  ip: string;
  countryCode: string | null;
}

export interface CreateScanResult {
  scanId: string;
  cached: boolean;
}

/**
 * Shared scan creation logic used by both the POST /api/scans route
 * and the /auth/confirm route (auto-scan after email verification).
 *
 * Throws on rate-limit, DB, or engine errors with a descriptive message.
 */
export async function createScan(opts: CreateScanOpts): Promise<CreateScanResult> {
  const { supabase, userId, url, ip, countryCode } = opts;

  const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  const tier = 'full';

  // ---------- Rate limit (4/day) ----------
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString());

  const limit = 4;
  if ((count ?? 0) >= limit) {
    throw new ScanError('Daily scan limit reached', 429, { limit, used: count });
  }

  // ---------- Cache check (24h same domain) ----------
  const { data: cached } = await supabase
    .from('scans')
    .select('id, status, marketing_iq, created_at')
    .eq('domain', domain)
    .eq('status', 'complete')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    const { data: newScan } = await supabase
      .from('scans')
      .insert({
        user_id: userId,
        url,
        domain,
        tier,
        status: 'complete',
        marketing_iq: cached.marketing_iq,
        cache_source: cached.id,
        ip_address: ip,
        country_code: countryCode,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return { scanId: newScan?.id ?? cached.id, cached: true };
  }

  // ---------- Create scan record ----------
  const { data: scan, error } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      url,
      domain,
      tier,
      status: 'queued',
      ip_address: ip,
      country_code: countryCode,
    })
    .select('id')
    .single();

  if (error || !scan) {
    throw new ScanError('Failed to create scan', 500);
  }

  // ---------- Forward to engine ----------
  const engineRes = await engineFetch('/engine/scans', {
    method: 'POST',
    body: JSON.stringify({ scanId: scan.id, url, domain, tier }),
  });

  if (!engineRes.ok) {
    const errBody = await engineRes.text().catch(() => '(no body)');
    console.error(`[scan-service] Engine returned ${engineRes.status}: ${errBody}`);
    console.error(`[scan-service] ENGINE_URL=${process.env.ENGINE_URL}, HMAC_SECRET set=${!!process.env.ENGINE_HMAC_SECRET}`);
    await supabase
      .from('scans')
      .update({ status: 'failed' })
      .eq('id', scan.id);
    throw new ScanError('Scan engine unavailable', 503);
  }

  // ---------- Audit log (fire-and-forget) ----------
  supabase.from('audit_log').insert({
    user_id: userId,
    action: 'scan_created',
    resource: scan.id,
    ip_address: ip,
    metadata: { url, domain, tier, cached: false },
  }).then(({ error: auditErr }) => {
    if (auditErr) console.error('[scan-service] Audit log failed:', auditErr);
  });

  return { scanId: scan.id, cached: false };
}

export class ScanError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ScanError';
  }
}
