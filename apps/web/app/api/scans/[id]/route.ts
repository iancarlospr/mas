import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
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

  // Parallelize auth + scan fetch (independent queries)
  const [authResult, scanResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('scans').select('*').eq('id', id).single(),
  ]);

  const user = authResult.data.user;
  const scan = scanResult.data;

  if (scanResult.error || !scan) {
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

  const responseBody = {
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
  };

  // Completed scans don't change — allow browser caching
  const headers: Record<string, string> = {};
  if (scan.status === 'complete') {
    headers['Cache-Control'] = 'private, max-age=300, stale-while-revalidate=3600';
  }

  return NextResponse.json(responseBody, { headers });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Verify ownership
  const { data: scan } = await supabase
    .from('scans')
    .select('id, user_id, cache_source')
    .eq('id', id)
    .single();

  if (!scan || scan.user_id !== user.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  // Use service client to bypass RLS for delete
  const serviceClient = createServiceClient();

  // Nullify cache_source on any scans that reference this one
  await serviceClient
    .from('scans')
    .update({ cache_source: null })
    .eq('cache_source', id);

  // Delete the scan (module_results cascade automatically)
  const { error } = await serviceClient
    .from('scans')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete scan' }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
