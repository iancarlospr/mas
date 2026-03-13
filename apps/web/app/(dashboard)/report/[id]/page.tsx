import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportLayout } from '@/components/report/report-layout';
import { transformToReportData } from '@/lib/report/transform';
import { verifyShareToken } from '@/lib/report/share';
import { ReportPaywall } from './paywall';

export const metadata: Metadata = { title: 'Executive Report' };

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; share?: string }>;
}) {
  const { id: scanId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  // Auth: signed-in user or valid share token
  const { data: { user } } = await supabase.auth.getUser();
  const isShareAccess = await verifyShareToken(sp.share, scanId);

  if (!user && !isShareAccess) redirect('/login');

  // Fetch scan
  const { data: scan } = await supabase
    .from('scans')
    .select('*')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return (
      <div className="text-center py-12">
        <h1 className="font-system text-h3 text-gs-ink">Scan not found</h1>
      </div>
    );
  }

  // Check paid tier (or valid share token)
  if (scan.tier !== 'paid' && !isShareAccess) {
    return <ReportPaywall scanId={scanId} />;
  }

  // Fetch all module results
  const { data: rawResults } = await supabase
    .from('module_results')
    .select('*')
    .eq('scan_id', scanId)
    .order('module_id');

  // Transform to report data contract
  const reportData = transformToReportData(
    scan,
    rawResults ?? [],
    user?.email ?? 'Shared Access',
  );

  return (
    <ReportLayout
      data={reportData}
      isPrintMode={sp.print === 'true'}
      isShared={!!sp.share}
    />
  );
}
