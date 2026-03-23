import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { isValidUUID } from '@/lib/utils';
import { getMarketingIQLabel, getTrafficLight } from '@marketing-alpha/types';
import type { ScoreCategory, MarketingIQResult } from '@marketing-alpha/types';
import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import { renderBossDeck, type BossDeckRenderContext } from '@/lib/report/boss-deck-html';

// ── Embed images as base64 data URIs (public/ not reliably served in standalone mode) ──

function loadImageAsDataUri(relativePath: string, mime: string): string | undefined {
  try {
    const filePath = join(process.cwd(), 'public', relativePath);
    const buf = readFileSync(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

// ── Category metadata ────────────────────────────────────────

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

// ── Route Handler ────────────────────────────────────────────

/**
 * GET /api/reports/[id]/boss-deck
 *
 * Renders the Boss Deck as a printable HTML document.
 * Reads pre-computed M46 data (generated during synthesis phase) and renders HTML.
 * Same pattern as the PRD route reading M43.
 *
 * Auth: scan owner OR valid share token. Tier: paid only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  if (!isValidUUID(scanId)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }

  // Engine calls with ?print=1 for server-side PDF generation (already HMAC-authenticated)
  const isPrintMode = request.nextUrl.searchParams.get('print') === '1';

  const serviceClient = createServiceClient();
  const { data: scan } = await serviceClient
    .from('scans')
    .select('id, user_id, tier, status, domain, marketing_iq, marketing_iq_result, created_at')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid' || scan.status !== 'complete') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Auth: engine print mode bypasses user auth, otherwise require owner or share token
  let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
  if (!isPrintMode) {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;
    const shareToken = request.nextUrl.searchParams.get('share');

    const isOwner = user != null && scan.user_id === user.id;
    const isSharedAccess = await verifyShareToken(shareToken, scanId);

    if (!isOwner && !isSharedAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Fetch M46 (Boss Deck) + M42 (for fallback data)
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

  // M46 is the primary data source
  const m46Raw = resultMap.get('M46');
  if (!m46Raw) {
    return NextResponse.json(
      { error: 'Boss Deck not yet generated. Please wait for the scan to complete.' },
      { status: 404 },
    );
  }

  const aiOutput = (m46Raw['bossDeck'] as BossDeckAIOutput) ?? null;
  const m46CategoryScores = m46Raw['categoryScores'] as { category: string; score: number; light: string }[] | undefined;

  // Fallback category scores from scan.marketing_iq_result
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

  // M42 for fallback rendering data
  const m42Raw = resultMap.get('M42');
  const m42Synthesis = (m42Raw?.['synthesis'] as Record<string, unknown>) ?? null;
  const m45Raw = resultMap.get('M45');
  const m45StackAnalysis = (m45Raw?.['stackAnalysis'] as Record<string, unknown>) ?? null;
  const m43Raw = resultMap.get('M43');

  // Business name
  const m43Metadata = (m43Raw?.['metadata'] as Record<string, unknown>) ?? null;
  const businessName = (m43Metadata?.['businessName'] as string)
    ?? (m42Synthesis?.['business_name'] as string)
    ?? scan.domain
    ?? '';

  // Get user display name for "Prepared by"
  let userName = '';
  if (user) {
    userName = user.user_metadata?.['full_name'] as string
      ?? user.user_metadata?.['name'] as string
      ?? user.email ?? '';
  } else if (scan.user_id) {
    const { data: scanUser } = await serviceClient.auth.admin.getUserById(scan.user_id);
    userName = scanUser?.user?.user_metadata?.['full_name'] as string
      ?? scanUser?.user?.user_metadata?.['name'] as string
      ?? scanUser?.user?.email ?? '';
  }

  // Build render context
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

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  });
}
