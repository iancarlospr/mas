import { getServiceClient } from './supabase';

/** Rate limit windows by template category */
const LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  verification: { max: 3, windowMinutes: 60 },
  'magic-link': { max: 3, windowMinutes: 60 },
  'scan-started': { max: 5, windowMinutes: 60 },
  'scan-complete': { max: 5, windowMinutes: 60 },
  // Global per-user limit: 10/24h checked separately
};

const GLOBAL_LIMIT = 10;
const GLOBAL_WINDOW_MINUTES = 1440; // 24 hours

export async function checkRateLimit(
  userId: string,
  template: string,
): Promise<boolean> {
  const supabase = getServiceClient();

  // 1. Check global per-user limit (10 / 24h)
  const globalCutoff = new Date(Date.now() - GLOBAL_WINDOW_MINUTES * 60_000).toISOString();
  const { count: globalCount } = await supabase
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', globalCutoff);

  if ((globalCount ?? 0) >= GLOBAL_LIMIT) return true;

  // 2. Check template-specific limit
  const limit = LIMITS[template];
  if (!limit) return false;

  const cutoff = new Date(Date.now() - limit.windowMinutes * 60_000).toISOString();
  const { count } = await supabase
    .from('email_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('template_id', template)
    .gte('created_at', cutoff);

  return (count ?? 0) >= limit.max;
}
