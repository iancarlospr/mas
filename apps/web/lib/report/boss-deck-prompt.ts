/**
 * Boss Deck — Gemini prompt, system instruction, and JSON schema.
 *
 * Synthesizes existing module data (M42, M43, M45, DataForSEO) into a
 * marketer-to-boss pitch deck narrative. No new engine module needed.
 */

// ── Types ────────────────────────────────────────────────────

export interface BossDeckAIOutput {
  cover_subtitle: string;
  wins_narrative: string;
  wins_highlights: {
    metric_label: string;
    metric_value: string;
    context: string;
  }[];
  top_issues: {
    headline: string;
    explanation: string;
    dollar_impact: string;
    urgency: 'immediate' | 'this_week' | 'this_month';
  }[];
  initiatives: {
    name: string;
    owner: string;
    items: string[];
    effort: string;
    expected_outcome: string;
  }[];
  tool_pitches: {
    tool_name: string;
    why_we_need_it: string;
    what_it_replaces: string;
    capability_gap: string;
  }[];
  business_case_headline: string;
  business_case_narrative: string;
  business_case_metrics: {
    label: string;
    value: string;
    comparison: string;
    insight: string;
  }[];
  implementation_impact_headline: string;
  implementation_outcomes: {
    outcome: string;
    evidence: string;
    source_work: string;
  }[];
  category_projections: {
    category: string;
    current_light: 'green' | 'yellow' | 'red';
    projected_light: 'green' | 'yellow' | 'red';
    explanation: string;
  }[];
  timeline_summary: string;
  timeline_items: {
    phase: string;
    items: string[];
  }[];
  next_steps: string[];
  closing_message: string;
}

// ── System Prompt ────────────────────────────────────────────

export const BOSS_DECK_SYSTEM_PROMPT = `You are a marketing team member preparing a brief internal pitch deck to present to your boss or leadership team. You have just received the results of a comprehensive marketing technology audit of your company's website.

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
Rewrite the M42 key_findings in boss-friendly language. Connect each to tangible business impact.
- NEVER use module IDs, technical acronyms, or marketing jargon
- Each "explanation" should be 2-3 sentences in first person explaining what's happening and why it matters
- "dollar_impact" should reference real DataForSEO data where available (traffic value at risk, competitor gap, etc.)
- If no direct dollar figure applies, describe the business risk plainly: "We're invisible to X% of potential customers"

### initiatives
Group the M43 PRD findings by WHO does the work, not by technical category.
Example groups: "Content Team: Update key website pages" (bundling related content/copy items), "Dev Team: Fix tracking infrastructure" (bundling technical P0-P1 items), "Marketing Ops: Tool setup" (new tool deployments).
- Each initiative should have 3-5 concrete items max — summarize if there are more
- "effort" should be a plain time estimate: "2-3 weeks" or "1 sprint"
- "expected_outcome" should describe what changes for the business, not technical output

### tool_pitches
For each tool gap or upgrade from M45, write a 2-sentence business case.
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

// ── JSON Schema for Structured Output ────────────────────────

export const BOSS_DECK_SCHEMA = {
  type: 'object' as const,
  properties: {
    cover_subtitle: { type: 'string' as const, description: 'Deck subtitle e.g. "Marketing Technology Assessment — March 2026"' },
    wins_narrative: { type: 'string' as const, description: '2-3 sentences connecting the best metrics to business value' },
    wins_highlights: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          metric_label: { type: 'string' as const },
          metric_value: { type: 'string' as const },
          context: { type: 'string' as const },
        },
        required: ['metric_label', 'metric_value', 'context'] as const,
      },
      minItems: 3,
      maxItems: 4,
    },
    top_issues: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          headline: { type: 'string' as const },
          explanation: { type: 'string' as const },
          dollar_impact: { type: 'string' as const },
          urgency: { type: 'string' as const, enum: ['immediate', 'this_week', 'this_month'] },
        },
        required: ['headline', 'explanation', 'dollar_impact', 'urgency'] as const,
      },
      minItems: 3,
      maxItems: 3,
    },
    initiatives: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          owner: { type: 'string' as const },
          items: { type: 'array' as const, items: { type: 'string' as const } },
          effort: { type: 'string' as const },
          expected_outcome: { type: 'string' as const },
        },
        required: ['name', 'owner', 'items', 'effort', 'expected_outcome'] as const,
      },
    },
    tool_pitches: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          tool_name: { type: 'string' as const },
          why_we_need_it: { type: 'string' as const },
          what_it_replaces: { type: 'string' as const },
          capability_gap: { type: 'string' as const },
        },
        required: ['tool_name', 'why_we_need_it', 'what_it_replaces', 'capability_gap'] as const,
      },
    },
    business_case_headline: { type: 'string' as const },
    business_case_narrative: { type: 'string' as const },
    business_case_metrics: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          label: { type: 'string' as const },
          value: { type: 'string' as const },
          comparison: { type: 'string' as const },
          insight: { type: 'string' as const },
        },
        required: ['label', 'value', 'comparison', 'insight'] as const,
      },
      minItems: 3,
      maxItems: 4,
    },
    implementation_impact_headline: { type: 'string' as const },
    implementation_outcomes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          outcome: { type: 'string' as const },
          evidence: { type: 'string' as const },
          source_work: { type: 'string' as const },
        },
        required: ['outcome', 'evidence', 'source_work'] as const,
      },
      minItems: 3,
      maxItems: 5,
    },
    category_projections: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          category: { type: 'string' as const },
          current_light: { type: 'string' as const, enum: ['green', 'yellow', 'red'] },
          projected_light: { type: 'string' as const, enum: ['green', 'yellow', 'red'] },
          explanation: { type: 'string' as const },
        },
        required: ['category', 'current_light', 'projected_light', 'explanation'] as const,
      },
      minItems: 8,
      maxItems: 8,
    },
    timeline_summary: { type: 'string' as const },
    timeline_items: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          phase: { type: 'string' as const },
          items: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['phase', 'items'] as const,
      },
      minItems: 3,
      maxItems: 4,
    },
    next_steps: { type: 'array' as const, items: { type: 'string' as const }, minItems: 3, maxItems: 5 },
    closing_message: { type: 'string' as const },
  },
  required: [
    'cover_subtitle', 'wins_narrative', 'wins_highlights',
    'top_issues', 'initiatives', 'tool_pitches',
    'business_case_headline', 'business_case_narrative', 'business_case_metrics',
    'implementation_impact_headline', 'implementation_outcomes', 'category_projections',
    'timeline_summary', 'timeline_items', 'next_steps', 'closing_message',
  ] as const,
};

// ── Prompt Builder ───────────────────────────────────────────

export interface BossDeckPromptContext {
  domain: string;
  businessName: string;
  scanDate: string;
  marketingIQ: number | null;
  marketingIQLabel: string | null;
  categoryScores: { category: string; score: number; light: string }[];
  // M42
  m42Synthesis: Record<string, unknown> | null;
  // M43
  m43Markdown: string | null;
  m43Metadata: Record<string, unknown> | null;
  // M45
  m45StackAnalysis: Record<string, unknown> | null;
  // DataForSEO raw data (select modules)
  dataForSEO: Record<string, Record<string, unknown> | null>;
}

export function buildBossDeckPrompt(ctx: BossDeckPromptContext): string {
  const sections: string[] = [];

  sections.push(`# SCAN DATA FOR: ${ctx.domain}
Business: ${ctx.businessName}
Scan Date: ${ctx.scanDate}
MarketingIQ Score: ${ctx.marketingIQ ?? 'N/A'} / 100 (${ctx.marketingIQLabel ?? 'Unknown'})

Category Scores:
${ctx.categoryScores.map(c => `  - ${c.category}: ${c.score}/100 (${c.light})`).join('\n')}`);

  // ── M42 Executive Brief ──
  if (ctx.m42Synthesis) {
    const s = ctx.m42Synthesis;
    sections.push(`## EXECUTIVE BRIEF (M42)
Synthesis Headline: ${s['synthesis_headline'] ?? ''}
Verdict Headline: ${s['verdict_headline'] ?? ''}

Executive Brief:
${s['executive_brief'] ?? ''}

Key Findings (cross-module themes):
${JSON.stringify(s['key_findings'] ?? [], null, 2)}

Category Assessments:
${JSON.stringify(s['category_assessments'] ?? {}, null, 2)}

Competitive Context:
${s['competitive_context'] ?? ''}

Tech Stack Summary:
${JSON.stringify(s['tech_stack_summary'] ?? {}, null, 2)}`);
  }

  // ── M43 Remediation Plan ──
  if (ctx.m43Metadata || ctx.m43Markdown) {
    const meta = ctx.m43Metadata;
    sections.push(`## REMEDIATION PLAN (M43)
Priority Counts: P0=${meta?.['p0Count'] ?? 0}, P1=${meta?.['p1Count'] ?? 0}, P2=${meta?.['p2Count'] ?? 0}, P3=${meta?.['p3Count'] ?? 0}
Total Findings: ${meta?.['totalFindings'] ?? 0}
Estimated Timeline: ${meta?.['estimatedTimelineWeeks'] ?? '?'} weeks

PRD Content (first 6000 chars for initiative grouping):
${(ctx.m43Markdown ?? '').slice(0, 6000)}`);
  }

  // ── M45 Stack Analyzer ──
  if (ctx.m45StackAnalysis) {
    const stack = ctx.m45StackAnalysis;
    sections.push(`## STACK ANALYSIS (M45)
${JSON.stringify(stack, null, 2)}`);
  }

  // ── DataForSEO Modules ──
  const dfseoSections: string[] = [];

  const m27 = ctx.dataForSEO['M27'];
  if (m27) {
    dfseoSections.push(`### Rankings (M27)
Total Keywords: ${m27['totalKeywords'] ?? m27['total_keywords'] ?? 'N/A'}
Organic ETV: $${m27['organicEtv'] ?? m27['organic_etv'] ?? m27['etv'] ?? 'N/A'}/mo
Position Distribution: ${JSON.stringify(m27['positionDistribution'] ?? m27['position_distribution'] ?? m27['positions'] ?? {})}`);
  }

  const m25 = ctx.dataForSEO['M25'];
  if (m25) {
    dfseoSections.push(`### Traffic by Country (M25)
${JSON.stringify(m25, null, 2)}`);
  }

  const m26 = ctx.dataForSEO['M26'];
  if (m26) {
    dfseoSections.push(`### Top Organic Keywords (M26)
${JSON.stringify(m26, null, 2)}`);
  }

  const m28 = ctx.dataForSEO['M28'];
  if (m28) {
    dfseoSections.push(`### Paid Traffic Cost (M28)
${JSON.stringify(m28, null, 2)}`);
  }

  const m29 = ctx.dataForSEO['M29'];
  if (m29) {
    dfseoSections.push(`### Competitors (M29)
${JSON.stringify(m29, null, 2)}`);
  }

  const m31 = ctx.dataForSEO['M31'];
  if (m31) {
    dfseoSections.push(`### Domain Trust & Authority (M31)
${JSON.stringify(m31, null, 2)}`);
  }

  const m33 = ctx.dataForSEO['M33'];
  if (m33) {
    dfseoSections.push(`### Brand Search (M33)
${JSON.stringify(m33, null, 2)}`);
  }

  const m37 = ctx.dataForSEO['M37'];
  if (m37) {
    dfseoSections.push(`### Reviews (M37)
${JSON.stringify(m37, null, 2)}`);
  }

  if (dfseoSections.length > 0) {
    sections.push(`## DATAFORSEO METRICS\n${dfseoSections.join('\n\n')}`);
  }

  sections.push(`## INSTRUCTIONS
Using the data above, generate the Boss Deck content. Remember:
- Write as a marketing team member pitching to your boss
- Use first person ("we", "our") throughout
- Lead with wins, then issues, then solutions
- Group PRD items by team/owner (Content Team, Dev Team, Marketing Ops), NOT by module
- Frame tool recommendations as internal pitches
- All dollar figures and competitor names must come from the actual scan data above — do NOT invent numbers
- Make the implementation_outcomes page connect specific PRD work to concrete business results using real data from the scan
- For category_projections, use the actual current_light values from the Category Scores above`);

  return sections.join('\n\n');
}
