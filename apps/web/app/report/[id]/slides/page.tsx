import { notFound } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';
import { PresentationSlidesView } from '@/components/scan/presentation-slides-view';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';

/**
 * /report/[id]/slides — Presentation Slides (server component)
 *
 * Two access modes:
 *   ?print=true  → service role (engine navigates here for PDF capture)
 *   otherwise    → user auth + ownership + paid tier
 *
 * Bypasses the desktop OS shell (standalone route in desktop-root.tsx).
 */

export default async function PresentationSlidesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id: scanId } = await params;
  const { print } = await searchParams;

  if (!isValidUUID(scanId)) notFound();

  const isPrintMode = print === 'true';

  let scanRow: Record<string, unknown> | null = null;
  let moduleRows: Record<string, unknown>[] = [];

  if (isPrintMode) {
    // Engine PDF capture — service role, no auth needed
    const service = createServiceClient();

    const { data: scan } = await service
      .from('scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (!scan) notFound();
    scanRow = scan;

    const sourceId = (scan.cache_source as string | null) ?? scan.id;
    const { data: results } = await service
      .from('module_results')
      .select('*')
      .eq('scan_id', sourceId)
      .order('module_id');

    moduleRows = results ?? [];
  } else {
    // User access — auth + ownership + paid tier
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) notFound();

    const { data: scan } = await supabase
      .from('scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (!scan || scan.user_id !== user.id || scan.tier !== 'paid') notFound();
    scanRow = scan;

    const sourceId = (scan.cache_source as string | null) ?? scan.id;
    const { data: results } = await supabase
      .from('module_results')
      .select('*')
      .eq('scan_id', sourceId)
      .order('module_id');

    moduleRows = results ?? [];
  }

  // Assemble ScanWithResults (same mapping as /api/scans/[id]/route.ts)
  const scan: ScanWithResults = {
    id: scanRow!.id as string,
    userId: scanRow!.user_id as string | null,
    url: scanRow!.url as string,
    domain: scanRow!.domain as string,
    tier: scanRow!.tier as 'full' | 'paid',
    status: scanRow!.status as string as ScanWithResults['status'],
    marketingIq: scanRow!.marketing_iq as number | null,
    startedAt: scanRow!.started_at as string | null,
    completedAt: scanRow!.completed_at as string | null,
    createdAt: scanRow!.created_at as string,
    cacheSource: scanRow!.cache_source as string | null,
    ipAddress: (scanRow!.ip_address as string | null) ?? null,
    countryCode: (scanRow!.country_code as string | null) ?? null,
    moduleResults: moduleRows.map((r): ModuleResult => ({
      moduleId: r.module_id as string as ModuleResult['moduleId'],
      status: r.status as string as ModuleResult['status'],
      data: (r.data as Record<string, unknown>) ?? {},
      signals: (r.signals as ModuleResult['signals']) ?? [],
      checkpoints: (r.checkpoints as ModuleResult['checkpoints']) ?? [],
      score: r.score as number | null,
      duration: (r.duration_ms as number) ?? 0,
      error: r.error as string | undefined,
    })),
    marketingIqResult: scanRow!.marketing_iq_result as ScanWithResults['marketingIqResult'],
  };

  return <PresentationSlidesView scan={scan} />;
}
