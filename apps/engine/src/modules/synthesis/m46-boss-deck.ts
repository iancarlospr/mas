/**
 * M46 - Boss Deck Synthesis
 *
 * Synthesizes M42 (executive brief), M43 (PRD), M45 (stack analyzer),
 * and DataForSEO module data into a marketer-to-boss pitch deck narrative.
 *
 * Output is pre-computed structured JSON that the web route reads and
 * renders as HTML — exactly like M43 markdown feeds the PRD route.
 *
 * Depends on: M42, M43, M45
 * Tier: paid
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createCheckpoint } from '../../utils/signals.js';
import { callPro } from '../../services/gemini.js';
import { z } from 'zod';

// ─── Output schema ──────────────────────────────────────────────────────

const WinHighlightSchema = z.object({
  metric_label: z.string(),
  metric_value: z.string(),
  context: z.string(),
});

const TopIssueSchema = z.object({
  headline: z.string(),
  explanation: z.string(),
  dollar_impact: z.string(),
  urgency: z.enum(['immediate', 'this_week', 'this_month']),
});

const InitiativeSchema = z.object({
  name: z.string(),
  owner: z.string(),
  items: z.array(z.string()),
  effort: z.string(),
  expected_outcome: z.string(),
});

const ToolPitchSchema = z.object({
  tool_name: z.string(),
  why_we_need_it: z.string(),
  what_it_replaces: z.string(),
  capability_gap: z.string(),
});

const BusinessMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  comparison: z.string(),
  insight: z.string(),
});

const ImplementationOutcomeSchema = z.object({
  outcome: z.string(),
  evidence: z.string(),
  source_work: z.string(),
});

const CategoryProjectionSchema = z.object({
  category: z.string(),
  current_light: z.enum(['green', 'yellow', 'red']),
  projected_light: z.enum(['green', 'yellow', 'red']),
  explanation: z.string(),
});

const TimelinePhaseSchema = z.object({
  phase: z.string(),
  items: z.array(z.string()),
});

const BossDeckOutputSchema = z.object({
  cover_subtitle: z.string(),
  wins_narrative: z.string(),
  wins_highlights: z.array(WinHighlightSchema),
  top_issues: z.array(TopIssueSchema),
  initiatives: z.array(InitiativeSchema),
  tool_pitches: z.array(ToolPitchSchema),
  business_case_headline: z.string(),
  business_case_narrative: z.string(),
  business_case_metrics: z.array(BusinessMetricSchema),
  implementation_impact_headline: z.string(),
  implementation_outcomes: z.array(ImplementationOutcomeSchema),
  category_projections: z.array(CategoryProjectionSchema),
  timeline_summary: z.string(),
  timeline_items: z.array(TimelinePhaseSchema),
  next_steps: z.array(z.string()),
  closing_message: z.string(),
});

// ─── System prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a marketing team member preparing a brief internal pitch deck to present to your boss or leadership team. You have just received the results of a comprehensive marketing technology audit of your company's website.

Your job is to rewrite the audit findings as an internal business pitch — confident, clear, and focused on outcomes that matter to leadership.

## VOICE RULES
- First person plural: "we", "our", "us" — never "the company" or "the client" or "the website"
- Confident but not arrogant — you're bringing solutions, not just problems
- Dollar amounts and competitive data matter more than technical details
- Keep sentences short. Bosses skim. Maximum 2-3 sentences per field unless specified otherwise.
- NEVER use module IDs (M05, M42, etc.), technical acronyms (LCP, CLS, TTFB, GTM, GA4, ROAS), or marketing jargon
- Translate everything into plain business English: "Our checkout page takes 8 seconds to load" NOT "LCP exceeds 2.5s threshold per Core Web Vitals"
- Lead with what's working before what's broken — bosses need to know things aren't on fire

## STRUCTURE RULES

### wins_highlights
Pick 3-4 of the most impressive DataForSEO metrics provided. Big numbers impress bosses.
- If organic traffic value (ETV) is meaningful, lead with that: "Our organic traffic is worth $X/mo in equivalent ad spend"
- If domain rank is strong, use it. If keyword count is high, use it. If review rating is high, use it.
- Each highlight needs a one-sentence "context" explaining WHY this number matters to the business.

### top_issues
Rewrite the key_findings in boss-friendly language. Connect each to tangible business impact.
- NEVER use module IDs, technical acronyms, or marketing jargon
- Each "explanation" should be 2-3 sentences in first person explaining what's happening and why it matters
- "dollar_impact" should reference real DataForSEO data where available (traffic value at risk, competitor gap, etc.)
- If no direct dollar figure applies, describe the business risk plainly: "We're invisible to X% of potential customers"

### initiatives
Group the PRD findings by WHO does the work, not by technical category.
Example groups: "Content Team: Update key website pages" (bundling related content/copy items), "Dev Team: Fix tracking infrastructure" (bundling technical P0-P1 items), "Marketing Ops: Tool setup" (new tool deployments).
- Each initiative should have 3-5 concrete items max — summarize if there are more
- "effort" should be a plain time estimate: "2-3 weeks" or "1 sprint"
- "expected_outcome" should describe what changes for the business, not technical output

### tool_pitches
For each tool gap or upgrade from the stack analysis, write a 2-sentence business case.
Example: "HotJar would let us see exactly where visitors drop off on our pricing page. Right now we're flying blind — we know people leave but not why."
- "what_it_replaces": if replacing an existing tool, name it. Otherwise "New addition"
- "capability_gap": the specific thing we can't do without this tool
- Only include tools with clear business justification. Skip minor utilities.

### business_case_metrics
Pick 3-4 DataForSEO metrics that make the strongest business case for investment.
- "comparison" should contextualize: "vs. top competitor's 45K keywords" or "equivalent to $X/mo in Google Ads"
- "insight" is the one-sentence so-what for the boss

### implementation_outcomes
3-5 concrete statements about what changes IF we execute the full remediation plan.
- Each tied to specific work items from the PRD
- "evidence" cites real scan data (numbers, competitor names, specific findings)
- "source_work" names the initiative or work category this outcome depends on
- These must be fact-based, grounded in the audit data. No hypothetical projections.

### category_projections
For each of the 8 audit categories, project what happens after full implementation.
- "current_light": the actual traffic light from the scan (green/yellow/red)
- "projected_light": realistic projection after fixes (don't promise all green — be credible)
- "explanation": one sentence on what moves the needle in this category

### timeline_items
Map the PRD priority items into 4 time phases:
- "Week 1" (P0 immediate items), "Week 2" (P1 items), "Weeks 3-4" (P2 items), "Month 2+" (P3 backlog)
- 3-5 items per phase, summarized in plain language

### next_steps
3-5 actionable items the boss can approve TODAY. Be specific:
- "Approve HotJar subscription ($X/mo)" not "Consider analytics tools"
- "Schedule content team sprint to update 5 key pages"
- "Brief dev team on tracking fixes (est. 1 week)"`;

// ─── Prompt builder ─────────────────────────────────────────────────────

function buildPrompt(
  domain: string,
  m42Synthesis: Record<string, unknown>,
  m43Data: Record<string, unknown>,
  m45Data: Record<string, unknown> | null,
  dataForSEOModules: Record<string, Record<string, unknown>>,
  categoryScores: { category: string; score: number; light: string }[],
  marketingIQ: { score: number; label: string } | null,
): string {
  const sections: string[] = [];

  sections.push(`# SCAN DATA FOR: ${domain}
MarketingIQ Score: ${marketingIQ?.score ?? 'N/A'} / 100 (${marketingIQ?.label ?? 'Unknown'})

Category Scores:
${categoryScores.map(c => `  - ${c.category}: ${c.score}/100 (${c.light})`).join('\n')}`);

  // M42 Executive Brief
  sections.push(`## EXECUTIVE BRIEF
Synthesis Headline: ${m42Synthesis['synthesis_headline'] ?? ''}
Verdict Headline: ${m42Synthesis['verdict_headline'] ?? ''}

Executive Brief:
${m42Synthesis['executive_brief'] ?? ''}

Key Findings:
${JSON.stringify(m42Synthesis['key_findings'] ?? [], null, 2)}

Category Assessments:
${JSON.stringify(m42Synthesis['category_assessments'] ?? {}, null, 2)}

Competitive Context:
${m42Synthesis['competitive_context'] ?? ''}

Tech Stack Summary:
${JSON.stringify(m42Synthesis['tech_stack_summary'] ?? {}, null, 2)}`);

  // M43 PRD
  const meta = m43Data['metadata'] as Record<string, unknown> | undefined;
  const markdown = (m43Data['markdown'] as string) ?? '';
  sections.push(`## REMEDIATION PLAN
Priority Counts: P0=${meta?.['p0Count'] ?? 0}, P1=${meta?.['p1Count'] ?? 0}, P2=${meta?.['p2Count'] ?? 0}, P3=${meta?.['p3Count'] ?? 0}
Total Findings: ${meta?.['totalFindings'] ?? 0}
Estimated Timeline: ${meta?.['estimatedTimelineWeeks'] ?? '?'} weeks

PRD Content (first 6000 chars):
${markdown.slice(0, 6000)}`);

  // M45 Stack Analyzer
  if (m45Data) {
    sections.push(`## STACK ANALYSIS
${JSON.stringify(m45Data, null, 2)}`);
  }

  // DataForSEO Modules
  const dfseoSections: string[] = [];
  for (const [moduleId, data] of Object.entries(dataForSEOModules)) {
    if (data && Object.keys(data).length > 0) {
      dfseoSections.push(`### ${moduleId}\n${JSON.stringify(data, null, 2)}`);
    }
  }
  if (dfseoSections.length > 0) {
    sections.push(`## DATAFORSEO METRICS\n${dfseoSections.join('\n\n')}`);
  }

  sections.push(`## INSTRUCTIONS
Generate the Boss Deck content. Remember:
- Write as a marketing team member pitching to your boss
- Use first person ("we", "our") throughout
- Lead with wins, then issues, then solutions
- Group PRD items by team/owner (Content Team, Dev Team, Marketing Ops), NOT by module
- Frame tool recommendations as internal pitches
- All dollar figures and competitor names must come from the actual scan data — do NOT invent numbers
- For category_projections, use the actual current_light values from the Category Scores above`);

  return sections.join('\n\n');
}

// ─── Executor ───────────────────────────────────────────────────────────

const CATEGORY_NAMES: Record<string, string> = {
  security_compliance: 'Security & Compliance',
  analytics_measurement: 'Analytics & Measurement',
  performance_experience: 'Performance & Experience',
  seo_content: 'SEO & Content',
  paid_media: 'Paid Media',
  martech_infrastructure: 'MarTech & Infrastructure',
  brand_presence: 'Brand & Digital Presence',
  market_intelligence: 'Market Intelligence',
};

function getTrafficLight(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  // ── Validate dependencies ──
  const m42Result = ctx.previousResults.get('M42' as ModuleId);
  if (!m42Result?.data) {
    return {
      moduleId: 'M46' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'M42 data unavailable',
    };
  }

  const m42Data = m42Result.data as Record<string, unknown>;
  const m42Synthesis = (m42Data['synthesis'] as Record<string, unknown>) ?? {};

  const m43Result = ctx.previousResults.get('M43' as ModuleId);
  const m43Data = (m43Result?.data ?? {}) as Record<string, unknown>;

  const m45Result = ctx.previousResults.get('M45' as ModuleId);
  const m45Data = m45Result?.status === 'success'
    ? (m45Result.data as Record<string, unknown>)?.['stackAnalysis'] as Record<string, unknown> | null
    : null;

  // ── Collect DataForSEO data from previous results ──
  const dataForSEOIds = ['M25', 'M26', 'M27', 'M28', 'M29', 'M31', 'M33', 'M37'];
  const dataForSEOModules: Record<string, Record<string, unknown>> = {};
  for (const id of dataForSEOIds) {
    const result = ctx.previousResults.get(id as ModuleId);
    if (result?.data && Object.keys(result.data).length > 0) {
      dataForSEOModules[id] = result.data as Record<string, unknown>;
    }
  }

  // ── Build category scores from M42 ──
  const m42CategoryScores = m42Data['categoryScores'] as Array<Record<string, unknown>> | undefined;
  const categoryScores = m42CategoryScores
    ? m42CategoryScores.map(c => ({
        category: CATEGORY_NAMES[c['category'] as string] ?? (c['category'] as string),
        score: Math.round(c['score'] as number),
        light: getTrafficLight(Math.round(c['score'] as number)),
      }))
    : Object.keys(CATEGORY_NAMES).map(key => ({ category: CATEGORY_NAMES[key]!, score: 0, light: 'red' as const }));

  const marketingIQ = m42Data['marketingIQ'] as Record<string, unknown> | undefined;
  const iqInfo = marketingIQ
    ? { score: (marketingIQ['final'] as number) ?? 0, label: (marketingIQ['label'] as string) ?? '' }
    : null;

  // ── Call Gemini Pro ──
  try {
    const prompt = buildPrompt(
      ctx.url,
      m42Synthesis,
      m43Data,
      m45Data,
      dataForSEOModules,
      categoryScores,
      iqInfo,
    );

    const result = await callPro(prompt, BossDeckOutputSchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 8192,
    });

    data.bossDeck = result.data;
    data.categoryScores = categoryScores;
    data.marketingIQ = iqInfo;
    data.tokensUsed = result.tokensUsed;

    checkpoints.push(createCheckpoint({
      id: 'm46-synthesis',
      name: 'Boss Deck Synthesis',
      weight: 1.0,
      health: 'excellent',
      evidence: `Generated boss deck: ${result.data.wins_highlights.length} wins, ${result.data.top_issues.length} issues, ${result.data.initiatives.length} initiatives, ${result.data.tool_pitches.length} tool pitches`,
    }));

  } catch (error) {
    checkpoints.push(createCheckpoint({
      id: 'm46-synthesis',
      name: 'Boss Deck Synthesis',
      weight: 1.0,
      health: 'critical',
      evidence: `Gemini generation failed: ${(error as Error).message.slice(0, 120)}`,
    }));

    return {
      moduleId: 'M46' as ModuleId,
      status: 'error',
      data,
      signals,
      score: null,
      checkpoints,
      duration: 0,
      error: (error as Error).message,
    };
  }

  return {
    moduleId: 'M46' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

export { execute };
registerModuleExecutor('M46' as ModuleId, execute);
