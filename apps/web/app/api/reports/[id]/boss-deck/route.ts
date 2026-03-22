import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyShareToken } from '@/lib/report/share';
import { isValidUUID } from '@/lib/utils';
import { getMarketingIQLabel, getTrafficLight } from '@marketing-alpha/types';
import type { ScoreCategory, MarketingIQResult } from '@marketing-alpha/types';
import { GoogleGenAI } from '@google/genai';
import {
  BOSS_DECK_SYSTEM_PROMPT,
  BOSS_DECK_SCHEMA,
  buildBossDeckPrompt,
  type BossDeckAIOutput,
  type BossDeckPromptContext,
} from '@/lib/report/boss-deck-prompt';
import { renderBossDeck, type BossDeckRenderContext } from '@/lib/report/boss-deck-html';
import { captureServerError } from '@/lib/posthog-server';

export const maxDuration = 60;

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
 * Renders a marketer-to-boss pitch deck as a printable HTML document.
 * Uses Gemini Pro to synthesize narrative from M42/M43/M45/DataForSEO data.
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

  // Auth: either logged-in owner OR valid share token
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const shareToken = request.nextUrl.searchParams.get('share');

  const serviceClient = createServiceClient();
  const { data: scan } = await serviceClient
    .from('scans')
    .select('id, user_id, tier, status, domain, marketing_iq, marketing_iq_result, created_at')
    .eq('id', scanId)
    .single();

  if (!scan || scan.tier !== 'paid' || scan.status !== 'complete') {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  // Verify access: owner or valid share token
  const isOwner = user != null && scan.user_id === user.id;
  const isSharedAccess = await verifyShareToken(shareToken, scanId);

  if (!isOwner && !isSharedAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all required modules in parallel
  const moduleIds = ['M42', 'M43', 'M45', 'M25', 'M26', 'M27', 'M28', 'M29', 'M31', 'M33', 'M37'];
  const { data: moduleResults } = await serviceClient
    .from('module_results')
    .select('module_id, data')
    .eq('scan_id', scanId)
    .in('module_id', moduleIds);

  const resultMap = new Map<string, Record<string, unknown>>();
  for (const row of moduleResults ?? []) {
    if (row.data) {
      resultMap.set(row.module_id, row.data as Record<string, unknown>);
    }
  }

  // M42 is required
  const m42Raw = resultMap.get('M42');
  if (!m42Raw) {
    return NextResponse.json(
      { error: 'Executive brief not yet generated' },
      { status: 404 },
    );
  }

  // Extract synthesis data
  const m42Synthesis = (m42Raw['synthesis'] as Record<string, unknown>) ?? null;
  const m43Raw = resultMap.get('M43');
  const m43Markdown = (m43Raw?.['markdown'] as string) ?? null;
  const m43Metadata = (m43Raw?.['metadata'] as Record<string, unknown>) ?? null;
  const m45Raw = resultMap.get('M45');
  const m45StackAnalysis = (m45Raw?.['stackAnalysis'] as Record<string, unknown>) ?? null;

  // Build category scores from marketing_iq_result
  const iqResult = scan.marketing_iq_result as MarketingIQResult | null;
  const categoryScores = ALL_CATEGORIES.map(key => {
    const cat = iqResult?.categories?.find(c => c.category === key);
    const score = cat ? Math.round(cat.score) : 0;
    return {
      category: CATEGORY_META[key],
      score,
      light: getTrafficLight(score),
    };
  });

  // Business name from M43 metadata or M42 or domain
  const businessName = (m43Metadata?.['businessName'] as string)
    ?? (m42Synthesis?.['business_name'] as string)
    ?? scan.domain
    ?? '';

  // Build prompt context
  const promptCtx: BossDeckPromptContext = {
    domain: scan.domain ?? scanId,
    businessName,
    scanDate: scan.created_at ?? new Date().toISOString(),
    marketingIQ: scan.marketing_iq as number | null,
    marketingIQLabel: scan.marketing_iq != null ? getMarketingIQLabel(scan.marketing_iq as number) : null,
    categoryScores,
    m42Synthesis,
    m43Markdown,
    m43Metadata,
    m45StackAnalysis,
    dataForSEO: {
      M25: resultMap.get('M25') ?? null,
      M26: resultMap.get('M26') ?? null,
      M27: resultMap.get('M27') ?? null,
      M28: resultMap.get('M28') ?? null,
      M29: resultMap.get('M29') ?? null,
      M31: resultMap.get('M31') ?? null,
      M33: resultMap.get('M33') ?? null,
      M37: resultMap.get('M37') ?? null,
    },
  };

  // Call Gemini Pro for narrative synthesis
  let aiOutput: BossDeckAIOutput | null = null;
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set');

    const genAI = new GoogleGenAI({ apiKey });
    const prompt = buildBossDeckPrompt(promptCtx);

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-pro-preview-06-05',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: BOSS_DECK_SCHEMA,
        systemInstruction: BOSS_DECK_SYSTEM_PROMPT,
      },
    });

    const text = response.text ?? '';
    if (text) {
      aiOutput = JSON.parse(text) as BossDeckAIOutput;
    }
  } catch (err) {
    console.error('[boss-deck] Gemini synthesis failed, using fallback:', err);
    captureServerError(
      scan.user_id ?? 'anonymous',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'boss-deck-gemini', scanId, domain: scan.domain },
    );
    // aiOutput stays null → fallback rendering
  }

  // Get user email for "Prepared by"
  let userEmail = '';
  if (user?.email) {
    userEmail = user.email;
  } else if (scan.user_id) {
    const { data: scanUser } = await serviceClient.auth.admin.getUserById(scan.user_id);
    userEmail = scanUser?.user?.email ?? '';
  }

  // Build render context
  const renderCtx: BossDeckRenderContext = {
    domain: scan.domain ?? scanId,
    businessName,
    scanDate: scan.created_at ?? new Date().toISOString(),
    userEmail,
    marketingIQ: scan.marketing_iq as number | null,
    marketingIQLabel: scan.marketing_iq != null ? getMarketingIQLabel(scan.marketing_iq as number) : null,
    ai: aiOutput,
    m42Synthesis,
    m45StackAnalysis,
    categoryScores,
    hasM43: m43Markdown != null,
    hasM45: m45StackAnalysis != null,
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
