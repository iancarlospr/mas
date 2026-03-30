import { createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';

export interface SharedReportPreview {
  scanId: string;
  domain: string;
  marketingIQ: number;
  createdAt: string;
}

/**
 * Resolve the minimal public-safe preview data needed for shared report metadata.
 * Returns null unless the caller presents a valid share token for a paid scan.
 */
export async function getSharedReportPreview(
  scanId: string,
  shareToken: string | null | undefined,
): Promise<SharedReportPreview | null> {
  const isSharedAccess = await verifyShareToken(shareToken, scanId);
  if (!isSharedAccess) return null;

  const service = createServiceClient();
  const { data: scan } = await service
    .from('scans')
    .select('id, domain, marketing_iq, created_at, tier')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid') {
    return null;
  }

  return {
    scanId: scan.id,
    domain: scan.domain,
    marketingIQ: scan.marketing_iq ?? 0,
    createdAt: scan.created_at,
  };
}
