import { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
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

/** Absolute daily rate limit — abuse protection, applies to ALL tiers. */
const DAILY_ABUSE_LIMIT = 10;

/**
 * Shared scan creation logic used by both the POST /api/scans route
 * and the /auth/confirm route (auto-scan after email verification).
 *
 * Single code path — every scan deducts 1 from scan_credits:
 *   - New users start with 1 credit (DB trigger on signup)
 *   - Purchasing Alpha Brief / Plus adds more credits
 *   - remaining > 0 after deduction → paid scan (all modules)
 *   - remaining = 0 after deduction → free scan (MarTech only)
 *   - Deduction fails → 402 "no credits"
 *
 * Atomic: decrement_scan_credits RPC prevents race conditions.
 * Immune to scan deletion: credits are separate from scan records.
 * Immune to audit_log state: audit_log is observability only.
 */
export async function createScan(opts: CreateScanOpts): Promise<CreateScanResult> {
  const { supabase, userId, url, ip, countryCode } = opts;
  const service = createServiceClient();

  const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();

  // ---------- Abuse protection (10/day absolute) ----------
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count: dailyCount } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString());

  if ((dailyCount ?? 0) >= DAILY_ABUSE_LIMIT) {
    throw new ScanError('Daily scan limit reached. Try again tomorrow.', 429, {
      limit: DAILY_ABUSE_LIMIT,
      used: dailyCount,
    });
  }

  // ---------- Deduct 1 scan credit (atomic) ----------
  const { data: newRemaining, error: decrError } = await service
    .rpc('decrement_scan_credits', { p_user_id: userId, p_amount: 1 });

  if (decrError) {
    throw new ScanError(
      'You\'ve used your free scan. Purchase Alpha Brief to unlock full scans.',
      402,
      { reason: 'no_credits' },
    );
  }

  // Determine tier from remaining credits AFTER deduction:
  // - remaining > 0 → user had 2+ credits (purchased), scan as paid (all modules)
  // - remaining = 0 → user had exactly 1 credit (free scan), scan as free (MarTech only)
  const tier: 'full' | 'paid' = (newRemaining as number) > 0 ? 'paid' : 'full';

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

    // Audit log — observability only, never used for authorization
    service.from('audit_log').insert({
      user_id: userId,
      action: 'scan_created',
      resource: newScan?.id ?? cached.id,
      ip_address: ip,
      metadata: { url, domain, tier, cached: true },
    }).then(({ error: auditErr }) => {
      if (auditErr) console.error('[scan-service] Audit log failed:', auditErr);
    });

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
    // Refund the credit we just deducted
    await service.rpc('add_scan_credits', { p_user_id: userId, p_amount: 1 });
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

    // Refund the credit
    await service.rpc('add_scan_credits', { p_user_id: userId, p_amount: 1 });
    throw new ScanError('Scan engine unavailable', 503);
  }

  // ---------- Audit log — observability only ----------
  service.from('audit_log').insert({
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
