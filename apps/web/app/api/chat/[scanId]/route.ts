import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { rateLimit } from '@/lib/rate-limit';
import { getPostHog, captureServerError } from '@/lib/posthog-server';
import { isValidUUID } from '@/lib/utils';
import { z } from 'zod';

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
});

// ─── Question → Module Routing ───────────────────────────────────────────────

const MODULE_ROUTING: { patterns: RegExp; modules: string[] }[] = [
  { patterns: /\b(analytics?|tracking|ga4|gtm|consent|measurement)\b/i, modules: ['M05', 'M08', 'M09'] },
  { patterns: /\b(ads?|pixel|attribution|roas|paid media|ppc|landing page)\b/i, modules: ['M06', 'M06b', 'M21', 'M28'] },
  { patterns: /\b(performance|speed|lcp|cls|fcp|ttfb|core web vitals?|cwv|carbon)\b/i, modules: ['M03', 'M13', 'M14'] },
  { patterns: /\b(security|https|headers?|dns|ssl|tls|attack surface|subdomains?)\b/i, modules: ['M01', 'M40'] },
  { patterns: /\b(compliance|gdpr|ccpa|cookies?|privacy|consent|legal)\b/i, modules: ['M12', 'M10'] },
  { patterns: /\b(seo|metadata|rankings?|keywords?|sitemap|indexing|organic)\b/i, modules: ['M04', 'M26', 'M34', 'M39'] },
  { patterns: /\b(tools?|stack|martech|redundant|cms|infrastructure|ecommerce|saas)\b/i, modules: ['M07', 'M20', 'M02'] },
  { patterns: /\b(competitors?|traffic|market|visits?|countries|domain trust)\b/i, modules: ['M24', 'M25', 'M29', 'M30', 'M31', 'M33'] },
  { patterns: /\b(social|sentiment|brand|reviews?|local pack|news)\b/i, modules: ['M15', 'M22', 'M23', 'M37', 'M38'] },
  { patterns: /\b(fix|implement|how to|steps?|remediat|roadmap|workstream|prd)\b/i, modules: ['M43'] },
  { patterns: /\b(roi|impact|savings?|cost|budget|spend|redundan)\b/i, modules: ['M44', 'M45'] },
  { patterns: /\b(brief|summary|overview|executive|report)\b/i, modules: ['M42'] },
  { patterns: /\b(mobile|responsive|viewport|android|ios)\b/i, modules: ['M14'] },
  { patterns: /\b(errors?|console|logging|javascript)\b/i, modules: ['M11'] },
  { patterns: /\b(accessibility|a11y|overlay|widget)\b/i, modules: ['M10'] },
  { patterns: /\b(behavio|heatmap|scroll|session|replay|interact)\b/i, modules: ['M09'] },
  { patterns: /\b(pr|media|press|careers?|hiring|investor|support|success)\b/i, modules: ['M16', 'M17', 'M18', 'M19'] },
  { patterns: /\b(shopping|google shopping|product listing)\b/i, modules: ['M36'] },
  { patterns: /\b(sharing|open graph|og:|twitter card)\b/i, modules: ['M15'] },
];

// Always include these synthesis modules for context framing
const ALWAYS_INCLUDE = ['M41', 'M42'];

function routeQuestion(question: string): string[] {
  const matched = new Set<string>();

  for (const route of MODULE_ROUTING) {
    if (route.patterns.test(question)) {
      for (const m of route.modules) {
        matched.add(m);
      }
    }
  }

  // If no specific modules matched, include a broad set
  if (matched.size === 0) {
    // Include M43 for implementation questions and M42 for general
    matched.add('M43');
    matched.add('M44');
    matched.add('M45');
  }

  // Always include synthesis context
  for (const m of ALWAYS_INCLUDE) {
    matched.add(m);
  }

  return [...matched];
}

// ─── Context Assembly ────────────────────────────────────────────────────────

interface ModuleResultRow {
  module_id: string;
  data: Record<string, unknown>;
  score: number | null;
  checkpoints: { id: string; name: string; health: string; evidence: string }[];
}

function buildContextString(
  results: ModuleResultRow[],
  domain: string,
  question: string,
): string {
  const resultMap = new Map(results.map(r => [r.module_id, r]));

  // ─── Layer 1: Briefing ───
  const m41 = resultMap.get('M41');
  const m41Data = m41?.data as Record<string, unknown> | undefined;
  const businessProfile = m41Data?.['businessProfile'] as Record<string, unknown> | undefined;
  const moduleSummaries = m41Data?.['moduleSummaries'] as Record<string, unknown> | undefined;

  const m42 = resultMap.get('M42');
  const m42Data = m42?.data as Record<string, unknown> | undefined;
  const synthesis = m42Data?.['synthesis'] as Record<string, unknown> | undefined;
  const marketingIQ = m42Data?.['marketingIQ'] as Record<string, unknown> | undefined;
  const categoryScores = m42Data?.['categoryScores'] as Record<string, unknown>[] | undefined;

  const sections: string[] = [];

  sections.push(`## LAYER 1: SCAN BRIEFING
Domain: ${domain}
MarketingIQ Score: ${marketingIQ?.['final'] ?? 'N/A'} / 100 (${marketingIQ?.['label'] ?? ''})
Business: ${businessProfile?.['businessName'] ?? domain} | Model: ${businessProfile?.['businessModel'] ?? 'Unknown'} | Scale: ${businessProfile?.['scale'] ?? 'Unknown'}
${categoryScores ? `Category Scores:\n${categoryScores.map((c: Record<string, unknown>) => `  - ${c['category']}: ${c['score']}/100`).join('\n')}` : ''}`);

  // ─── Layer 2: Relevant Module Data ───
  const moduleDataSections: string[] = [];
  for (const [moduleId, result] of resultMap) {
    if (['M41', 'M42'].includes(moduleId)) continue; // Handled in other layers

    const summary = moduleSummaries?.[moduleId] as Record<string, unknown> | undefined;
    const aiScore = (summary?.['module_score'] as number | undefined) ?? null;

    moduleDataSections.push(`### ${moduleId} (Score: ${aiScore ?? 'N/A'}/100)
${summary?.['executive_summary'] ?? summary?.['summary'] ?? ''}
${result.checkpoints?.length ? `Key Findings:\n${result.checkpoints.map(cp => `  - [${cp.health.toUpperCase()}] ${cp.name}: ${cp.evidence}`).join('\n')}` : ''}
Data: ${JSON.stringify(result.data)}`);
  }

  if (moduleDataSections.length > 0) {
    sections.push(`## LAYER 2: MODULE DATA (matched to question)\n${moduleDataSections.join('\n\n')}`);
  }

  // ─── Layer 3: Synthesis References ───
  const synthesisSections: string[] = [];

  if (synthesis) {
    synthesisSections.push(`### Executive Brief (M42)
${JSON.stringify(synthesis)}`);
  }

  const m43 = resultMap.get('M43');
  if (m43?.data) {
    synthesisSections.push(`### Remediation Roadmap (M43)
${JSON.stringify(m43.data)}`);
  }

  const m44 = resultMap.get('M44');
  if (m44?.data) {
    synthesisSections.push(`### ROI Impact Scenarios (M44)
${JSON.stringify(m44.data)}`);
  }

  const m45 = resultMap.get('M45');
  if (m45?.data) {
    synthesisSections.push(`### Stack & Cost Analysis (M45)
${JSON.stringify(m45.data)}`);
  }

  if (synthesisSections.length > 0) {
    sections.push(`## LAYER 3: SYNTHESIS REFERENCES\n${synthesisSections.join('\n\n')}`);
  }

  return sections.join('\n\n');
}

async function assembleContext(
  scanId: string,
  question: string,
  domain: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const relevantModules = routeQuestion(question);

  // Always include M43, M44, M45 if they exist (synthesis references)
  const moduleIds = [...new Set([...relevantModules, 'M43', 'M44', 'M45'])];

  const { data: results } = await supabase
    .from('module_results')
    .select('module_id, data, score, checkpoints')
    .eq('scan_id', scanId)
    .in('module_id', moduleIds);

  return buildContextString(
    (results ?? []) as ModuleResultRow[],
    domain,
    question,
  );
}

// ─── System Prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(domain: string, context: string): string {
  return `You are the AlphaScan AI Consultant for ${domain}. You have access to
the complete results of a forensic marketing technology audit — raw module
data, AI synthesis, remediation roadmap, ROI projections, and cost analysis.

RULES:
1. Always cite your sources using [Source: MXX] notation.
   Example: "Your site uses GA4 (G-XXXXXXXX) with enhanced measurement
   enabled [Source: M05]."
2. If asked about something not covered by the scan, say:
   "That wasn't covered in this scan. The audit analyzed [list relevant
   modules]. For that specific question, I'd recommend [actionable
   alternative]."
3. When giving implementation guidance, reference the PRD workstreams:
   "This is addressed in Workstream WS-02, Task WS-02-T03 [Source: M43]."
4. Be specific. Use actual tool names, configuration values, and
   numbers from the scan data. Never invent data — only cite what's
   in the context below.
5. Keep responses concise unless the user asks for detail.
   Default to 2-3 paragraphs max.
6. Use ROI data to quantify impact when relevant:
   "Fixing this attribution gap could recover an estimated $X-$Y/month
   in trackable conversions [Source: M44]."
7. When referencing costs or savings, cite the stack analysis:
   "Your current spend on [tool] is estimated at $X/yr [Source: M45]."

SCAN DATA:
${context}`;
}

// ─── Gemini Client ───────────────────────────────────────────────────────────

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_AI_API_KEY');
  }
  return new GoogleGenAI({ apiKey });
}

// ─── POST: Send message ──────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await params;
  if (!isValidUUID(scanId)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Feature flag kill switch — disable chat without deploy
  const ph = getPostHog();
  if (ph) {
    const killChat = await ph.isFeatureEnabled('kill-switch-chat', user.id);
    if (killChat) {
      return NextResponse.json({ error: 'Chat is temporarily disabled' }, { status: 503 });
    }
  }

  // Rate limit: 10 messages per minute per user
  const rl = rateLimit(`chat:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    getPostHog()?.capture({ distinctId: user.id, event: 'rate_limit_hit', properties: { endpoint: 'chat' } });
    return NextResponse.json(
      { error: 'Too many messages. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  const body = await request.json();
  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  // Check credits — distinguish "never had" vs "used all"
  // Beta users with unlimited chat flag bypass credit checks
  const hasUnlimitedChat = ph ? await ph.isFeatureEnabled('beta-chat-unlimited', user.id) : false;

  const { data: credits } = await supabase
    .from('chat_credits')
    .select('remaining')
    .eq('user_id', user.id)
    .single();

  if (!hasUnlimitedChat) {
    if (!credits) {
      return NextResponse.json(
        { error: 'chat_activation_required' },
        { status: 402 },
      );
    }

    if (credits.remaining <= 0) {
      return NextResponse.json(
        { error: 'no_credits_remaining' },
        { status: 402 },
      );
    }
  }

  // Verify scan exists and user has access
  const { data: scan } = await supabase
    .from('scans')
    .select('id, tier, domain, user_id')
    .eq('id', scanId)
    .single();

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.user_id !== user.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  if (scan.tier !== 'paid') {
    return NextResponse.json({ error: 'Alpha Brief required for chat' }, { status: 403 });
  }

  // Assemble context from raw module data (replaces M46 knowledge base)
  const context = await assembleContext(scanId, parsed.data.message, scan.domain, supabase);

  // Get chat history (existing messages only — don't save user msg yet)
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('scan_id', scanId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(20);

  let assistantResponse: string;

  try {
    const genAI = getGeminiClient();

    // Build conversation history for context
    const chatHistory = (history ?? [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }],
      }));

    const chat = genAI.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: buildSystemPrompt(scan.domain, context),
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
      history: chatHistory,
    });

    const result = await chat.sendMessage({ message: parsed.data.message });
    assistantResponse = result.text ?? '';
  } catch (err) {
    console.error(`[chat/${scanId}] Gemini error:`, err);
    captureServerError(user.id, err, { route: 'chat', scan_id: scanId });
    return NextResponse.json(
      { error: 'AI service temporarily unavailable. No credit was charged.' },
      { status: 503 },
    );
  }

  // Save messages sequentially — guarantees created_at ordering
  const userInsert = await supabase.from('chat_messages').insert({
    scan_id: scanId,
    user_id: user.id,
    role: 'user',
    content: parsed.data.message,
  });
  if (userInsert.error) console.error(`[chat/${scanId}] user msg insert failed:`, userInsert.error);

  const assistantInsert = await supabase.from('chat_messages').insert({
    scan_id: scanId,
    user_id: user.id,
    role: 'assistant',
    content: assistantResponse,
  });
  if (assistantInsert.error) console.error(`[chat/${scanId}] assistant msg insert failed:`, assistantInsert.error);

  // Track the full chat exchange server-side
  if (ph) {
    ph.capture({
      distinctId: user.id,
      event: 'chat_exchange',
      properties: {
        scan_id: scanId,
        domain: scan.domain,
        user_message_length: parsed.data.message.length,
        response_length: assistantResponse.length,
        credits_remaining: hasUnlimitedChat ? 999 : Math.max(0, (credits?.remaining ?? 0) - 1),
      },
    });
  }

  // Decrement credit separately — skip if beta-chat-unlimited flag is on
  if (!hasUnlimitedChat) {
    const { error: creditError } = await supabase.rpc('decrement_chat_credits', {
      p_user_id: user.id,
      p_amount: 1,
    });
    if (creditError) {
      console.error(`[chat/${scanId}] credit decrement failed:`, creditError);
      captureServerError(user.id, creditError, { route: 'chat/credits', scan_id: scanId });
    }
  }

  return NextResponse.json({
    message: assistantResponse,
    creditsRemaining: hasUnlimitedChat ? 999 : Math.max(0, (credits?.remaining ?? 0) - 1),
  });
}

// ─── GET: Fetch chat history ─────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await params;
  if (!isValidUUID(scanId)) {
    return NextResponse.json({ error: 'Invalid scan ID' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Parallelize scan ownership, messages, and credits (all independent after auth)
  const [scanResult, messagesResult, creditsResult] = await Promise.all([
    supabase.from('scans').select('id, user_id').eq('id', scanId).single(),
    supabase.from('chat_messages').select('id, role, content, created_at')
      .eq('scan_id', scanId).eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('chat_credits').select('remaining').eq('user_id', user.id).single(),
  ]);

  if (!scanResult.data || scanResult.data.user_id !== user.id) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
  }

  return NextResponse.json({
    messages: messagesResult.data ?? [],
    creditsRemaining: creditsResult.data?.remaining ?? 0,
  });
}
