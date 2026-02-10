import { getServiceClient } from './supabase';

/** Dedup windows by template (in minutes) */
const DEDUP_WINDOWS: Record<string, number> = {
  welcome: Infinity,          // 1/lifetime
  're-engagement': Infinity,  // 1/lifetime
  'account-deletion': Infinity,
  'scan-complete': 1440,      // 1/scan (24h window)
  'scan-failed': 1440,
  'report-ready': 1440,
};

export async function checkDedup(
  userId: string,
  template: string,
  referenceId: string,
): Promise<boolean> {
  const supabase = getServiceClient();

  const window = DEDUP_WINDOWS[template];
  if (window == null) return false;

  let query = supabase
    .from('email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('template_id', template)
    .eq('reference_id', referenceId);

  // For non-infinite windows, scope to the time window
  if (window !== Infinity) {
    const cutoff = new Date(Date.now() - window * 60_000).toISOString();
    query = query.gte('created_at', cutoff);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}
