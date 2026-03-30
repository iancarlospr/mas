import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportLayout } from '@/components/report/report-layout';
import { transformToReportData } from '@/lib/report/transform';
import { verifyShareToken } from '@/lib/report/share';
import { getSharedReportPreview } from '@/lib/report/share-preview';
import { ReportPaywall } from './paywall';

export const metadata: Metadata = { title: 'Executive Report' };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}): Promise<Metadata> {
  const { id: scanId } = await params;
  const sp = await searchParams;
  const shareToken = sp.share;
  const preview = await getSharedReportPreview(scanId, shareToken);

  if (!preview || !shareToken) {
    return { title: 'Executive Report' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://marketingalphascan.com';
  const reportUrl = new URL(`/report/${scanId}`, baseUrl);
  reportUrl.searchParams.set('share', shareToken);

  const ogImageUrl = new URL(`/api/reports/${scanId}/og`, baseUrl);
  ogImageUrl.searchParams.set('share', shareToken);

  const title = `${preview.domain} | Executive Report`;
  const description = `Shared Alpha Scan audit for ${preview.domain}. MarketingIQ ${preview.marketingIQ}/100.`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      type: 'article',
      url: reportUrl.toString(),
      siteName: 'Alpha Scan',
      title,
      description,
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${preview.domain} marketing audit preview`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
    },
  };
}

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
