import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch scan
  const { data: scan, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Ownership check: require auth and matching user
  if (!user || scan.user_id !== user.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // If cache_source, fetch module results from source scan
  const sourceId = scan.cache_source ?? scan.id;

  // Fetch module results
  const { data: moduleResults } = await supabase
    .from('module_results')
    .select('*')
    .eq('scan_id', sourceId)
    .order('module_id');

  return NextResponse.json({
    id: scan.id,
    userId: scan.user_id,
    url: scan.url,
    domain: scan.domain,
    tier: scan.tier,
    status: scan.status,
    marketingIq: scan.marketing_iq,
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
    createdAt: scan.created_at,
    cacheSource: scan.cache_source,
    moduleResults: (moduleResults ?? []).map((r: Record<string, unknown>) => ({
      moduleId: r.module_id,
      status: r.status,
      data: r.data,
      signals: r.signals,
      checkpoints: r.checkpoints,
      score: r.score,
      duration: r.duration_ms,
      error: r.error,
    })),
    marketingIqResult: scan.marketing_iq_result,
  });
}
