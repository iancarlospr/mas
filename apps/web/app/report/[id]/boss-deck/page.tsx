import { notFound } from 'next/navigation';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';
import { getMarketingIQLabel, getTrafficLight } from '@marketing-alpha/types';
import type { ScoreCategory, MarketingIQResult } from '@marketing-alpha/types';
import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import { renderBossDeck, type BossDeckRenderContext } from '@/lib/report/boss-deck-html';
import { BossDeckView } from '@/components/scan/boss-deck-view';

// ── Embed images as base64 data URIs ──

function loadImageAsDataUri(relativePath: string, mime: string): string | undefined {
  try {
    const filePath = join(process.cwd(), 'public', relativePath);
    const buf = readFileSync(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

// ── Category metadata ──

const CATEGORY_META: Record<ScoreCategory, string> = {
  security_compliance: 'Security & Compliance',
  analytics_measurement: 'Analytics & Measurement',
  performance_experience: 'Performance & Experience',
  seo_content: 'SEO & Content',
  paid_media: 'Paid Media',
  martech_infrastructure: 'MarTech & Infrastructure',
  brand_presence: 'Brand & Digital Presence',
  market_intelligence: 'Market Intelligence',
};

const ALL_CATEGORIES: ScoreCategory[] = [
  'security_compliance', 'analytics_measurement', 'performance_experience',
  'seo_content', 'paid_media', 'martech_infrastructure',
  'brand_presence', 'market_intelligence',
];

/**
 * /report/[id]/boss-deck — Boss Deck download page (server component)
 *
 * Same pattern as /report/[id]/slides:
 *   - Data fetched server-side (fast, single request)
 *   - HTML rendered server-side via renderBossDeck()
 *   - Passed to BossDeckView client component for PDF capture
 *
 * Auth: user ownership + paid tier.
 */
export default async function BossDeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ download?: string }>;
}) {
  const { id: scanId } = await params;
  const { download } = await searchParams;

  if (!isValidUUID(scanId)) notFound();

  const isDownloadMode = download === '1' || download === 'true';

  // Auth — user must own the scan and it must be paid + complete
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const serviceClient = createServiceClient();
  const { data: scan } = await serviceClient
    .from('scans')
    .select('id, user_id, tier, status, domain, marketing_iq, marketing_iq_result, created_at')
    .eq('id', scanId)
    .single();

  if (!scan || scan.user_id !== user.id || scan.tier !== 'paid' || scan.status !== 'complete') {
    notFound();
  }

  // Fetch module data (same as /api/reports/[id]/boss-deck)
  const { data: moduleResults } = await serviceClient
    .from('module_results')
    .select('module_id, data')
    .eq('scan_id', scanId)
    .in('module_id', ['M46', 'M42', 'M43', 'M45', 'M03', 'M06', 'M21', 'M22', 'M24', 'M25', 'M26']);

  const resultMap = new Map<string, Record<string, unknown>>();
  for (const row of moduleResults ?? []) {
    if (row.data) {
      resultMap.set(row.module_id, row.data as Record<string, unknown>);
    }
  }

  const m46Raw = resultMap.get('M46');
  if (!m46Raw) notFound();

  const aiOutput = (m46Raw['bossDeck'] as BossDeckAIOutput) ?? null;
  const m46CategoryScores = m46Raw['categoryScores'] as { category: string; score: number; light: string }[] | undefined;

  const iqResult = scan.marketing_iq_result as MarketingIQResult | null;
  const categoryScores = m46CategoryScores ?? ALL_CATEGORIES.map(key => {
    const cat = iqResult?.categories?.find(c => c.category === key);
    const score = cat ? Math.round(cat.score) : 0;
    return {
      category: CATEGORY_META[key],
      score,
      light: getTrafficLight(score),
    };
  });

  const m42Raw = resultMap.get('M42');
  const m42Synthesis = (m42Raw?.['synthesis'] as Record<string, unknown>) ?? null;
  const m45Raw = resultMap.get('M45');
  const m45StackAnalysis = (m45Raw?.['stackAnalysis'] as Record<string, unknown>) ?? null;
  const m43Raw = resultMap.get('M43');

  const m43Metadata = (m43Raw?.['metadata'] as Record<string, unknown>) ?? null;
  const businessName = (m43Metadata?.['businessName'] as string)
    ?? (m42Synthesis?.['business_name'] as string)
    ?? scan.domain
    ?? '';

  const userName = user.user_metadata?.['full_name'] as string
    ?? user.user_metadata?.['name'] as string
    ?? user.email ?? '';

  const renderCtx: BossDeckRenderContext = {
    domain: scan.domain ?? scanId,
    businessName,
    scanDate: scan.created_at ?? new Date().toISOString(),
    userEmail: userName,
    marketingIQ: scan.marketing_iq as number | null,
    marketingIQLabel: scan.marketing_iq != null ? getMarketingIQLabel(scan.marketing_iq as number) : null,
    ai: aiOutput,
    m42Synthesis,
    m45StackAnalysis,
    categoryScores,
    hasM43: m43Raw != null,
    hasM45: m45StackAnalysis != null,
    coverImageDataUri: loadImageAsDataUri('boss-deck/hero-cover.jpg', 'image/jpeg'),
    closerImageDataUri: loadImageAsDataUri('boss-deck/hero-horizon.jpg', 'image/jpeg'),
    m03Data: resultMap.get('M03') ?? null,
    m06Data: resultMap.get('M06') ?? null,
    m21Data: resultMap.get('M21') ?? null,
    m22Data: resultMap.get('M22') ?? null,
    m24Data: resultMap.get('M24') ?? null,
    m25Data: resultMap.get('M25') ?? null,
    m26Data: resultMap.get('M26') ?? null,
    scanId,
  };

  const html = renderBossDeck(renderCtx);

  return <BossDeckView html={html} domain={scan.domain ?? 'report'} autoDownload={isDownloadMode} />;
}
