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
 * Scan gating logic:
 *   1. If user has scan_credits → deduct 1, create scan with tier='paid'
 *   2. If user has ZERO completed real scans → free scan, tier='full' (3 MarTech modules)
 *   3. Otherwise → 402 "Purchase a scan to continue"
 *
 * Throws on rate-limit, credit, DB, or engine errors with a descriptive message.
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

  // ---------- Credit check → determine tier ----------
  let tier: 'full' | 'paid' = 'full';
  let usedCredit = false;

  // Check if user has scan credits (from Alpha Brief / Alpha Brief Plus purchase)
  const { data: credits } = await service
    .from('scan_credits')
    .select('remaining')
    .eq('user_id', userId)
    .single();

  if (credits && credits.remaining > 0) {
    // Has credits → deduct 1, scan as paid (all modules)
    const { error: decrError } = await service
      .rpc('decrement_scan_credits', { p_user_id: userId, p_amount: 1 });

    if (!decrError) {
      tier = 'paid';
      usedCredit = true;
    }
    // If decrement fails (race condition — someone else used the last credit),
    // fall through to free tier logic below
  }

  if (!usedCredit) {
    // No credits available — check if user has already used their 1 free scan.
    // Query audit_log (immutable, service-role only) instead of scans table —
    // users can delete scans but can't delete audit entries.
    const { count: auditCount } = await service
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'scan_created');

    if ((auditCount ?? 0) > 0) {
      // Already used free scan, no credits remaining
      throw new ScanError(
        'You\'ve used your free scan. Purchase Alpha Brief to unlock full scans.',
        402,
        { reason: 'no_credits' },
      );
    }
    // First scan ever → free tier (3 MarTech modules)
    tier = 'full';
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

    // Refund credit if engine failed and we deducted one
    if (usedCredit) {
      await service.rpc('add_scan_credits', { p_user_id: userId, p_amount: 1 });
    }

    throw new ScanError('Scan engine unavailable', 503);
  }

  // ---------- Audit log (fire-and-forget) ----------
  supabase.from('audit_log').insert({
    user_id: userId,
    action: 'scan_created',
    resource: scan.id,
    ip_address: ip,
    metadata: { url, domain, tier, cached: false, usedCredit },
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
