/**
 * M42 - Final AI Synthesis & MarketingIQ Validation
 *
 * Uses Gemini Pro to create executive-level synthesis from all M41
 * module analyses. Validates the algorithmic MarketingIQ score.
 * Follows PRD AI-3 prompt spec.
 *
 * Depends on: M41
 * Tier: paid
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { CATEGORY_WEIGHTS } from '@marketing-alpha/types';
import { createCheckpoint } from '../../utils/signals.js';
import { callPro } from '../../services/gemini.js';
import { calculateMarketingIQ } from '../../utils/scoring.js';
import { z } from 'zod';

const CategoryLightSchema = z.object({
  score: z.number().min(0).max(100),
  light: z.enum(['green', 'yellow', 'red']),
  one_liner: z.string(),
});

const CriticalFindingSchema = z.object({
  rank: z.number(),
  finding: z.string(),
  modules: z.array(z.string()),
  business_impact: z.string(),
  urgency: z.enum(['immediate', 'this_week', 'this_month', 'this_quarter']),
});

const OpportunitySchema = z.object({
  rank: z.number(),
  opportunity: z.string(),
  modules: z.array(z.string()),
  estimated_impact: z.string(),
  effort: z.enum(['S', 'M', 'L', 'XL']),
});

const FinalSynthesisSchema = z.object({
  marketing_iq_validation: z.object({
    algorithmic_score: z.number(),
    ai_assessment: z.string(),
    suggested_adjustment: z.number(),
    adjustment_rationale: z.string(),
  }),
  category_traffic_lights: z.record(CategoryLightSchema),
  executive_brief: z.string(),
  critical_findings: z.array(CriticalFindingSchema),
  top_opportunities: z.array(OpportunitySchema),
  tech_stack_summary: z.object({
    analytics: z.array(z.string()),
    advertising: z.array(z.string()),
    automation: z.array(z.string()),
    cms_hosting: z.array(z.string()),
    security: z.array(z.string()),
    other: z.array(z.string()),
  }),
  competitive_context: z.string(),
});

type FinalSynthesis = z.infer<typeof FinalSynthesisSchema>;

const SYSTEM_PROMPT = `You are the Chief Marketing Technology Officer presenting the final
executive brief for a forensic audit of a website.

You have the complete output from 40+ individual module analyses. Your job
is to synthesize these into a unified strategic assessment that a CEO, CMO,
or board member can act on in 60 seconds.

RULES:
1. The MarketingIQ score has already been calculated algorithmically. Your job
   is to VALIDATE it — if the score feels wrong given the evidence, flag the
   discrepancy and explain why.
2. Do not repeat module-level findings verbatim. Synthesize across modules
   to identify THEMES and PATTERNS.
3. Critical findings must be ranked by BUSINESS IMPACT, not technical
   severity. A missing privacy policy (legal risk) outranks a slow LCP
   (performance opportunity).
4. The executive brief is for someone with 60 seconds. Lead with the
   single most important sentence about this brand's marketing technology.
5. Do not soften language. If the stack is broken, say it's broken.
   If it's excellent, say it's excellent.
6. ONLY reference data present in the input. Never invent findings or tools.

Respond in JSON.`;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const m41Result = ctx.previousResults.get('M41' as ModuleId);
  if (!m41Result || m41Result.status !== 'success') {
    return { moduleId: 'M42' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'M41 synthesis not available' };
  }

  // Calculate the algorithmic MarketingIQ
  const allModuleResults = [...ctx.previousResults.values()].filter(
    r => r.moduleId !== 'M41' && r.moduleId !== 'M42',
  );
  const marketingIQ = calculateMarketingIQ(allModuleResults);

  const m41Data = m41Result.data as Record<string, unknown>;
  const moduleSummaries = m41Data['moduleSummaries'] as Record<string, Record<string, unknown>> ?? {};

  // Get traffic data from M24 if available
  const m24Result = ctx.previousResults.get('M24' as ModuleId);
  const m24Data = m24Result?.data as Record<string, unknown> | undefined;
  const monthlyVisits = m24Data?.['totalTraffic'] as number | undefined;
  const bounceRate = m24Data?.['bounceRate'] as number | undefined;
  const trafficSources = m24Data?.['trafficSources'] as Record<string, unknown> | undefined;

  // Build module scores summary
  const moduleScores: Record<string, number | null> = {};
  for (const [id, result] of ctx.previousResults) {
    if (id !== 'M41' && id !== 'M42') {
      moduleScores[id] = result.score;
    }
  }

  try {
    const allM41OutputsJson = JSON.stringify(
      Object.fromEntries(
        Object.entries(moduleSummaries).map(([id, summary]) => [id, {
          executive_summary: summary['executive_summary'] ?? summary['summary'] ?? '',
          key_findings: summary['key_findings'] ?? summary['keyFindings'] ?? [],
          score_rationale: summary['score_rationale'] ?? '',
        }]),
      ),
    );

    const prompt = `## Domain: ${ctx.url}
## Calculated MarketingIQ: ${marketingIQ.final}/100
## Label: ${marketingIQ.label}

### Category Scores
${JSON.stringify(marketingIQ.categories.map(c => ({
  category: c.category,
  score: c.score,
  light: c.light,
})))}

### All Module Syntheses (M41 outputs)
${allM41OutputsJson}

### Raw Module Scores
${JSON.stringify(moduleScores)}

### Traffic Data (from M24, if available)
Monthly visits: ${monthlyVisits ?? 'unavailable'}
Bounce rate: ${bounceRate ?? 'unavailable'}
Traffic sources: ${trafficSources ? JSON.stringify(trafficSources) : 'unavailable'}

### Category Weights Applied
${JSON.stringify(CATEGORY_WEIGHTS)}

### Penalties Applied
${JSON.stringify(marketingIQ.penalties)}

### Bonuses Applied
${JSON.stringify(marketingIQ.bonuses)}

Produce your synthesis as valid JSON matching the schema with these fields:
- marketing_iq_validation: { algorithmic_score, ai_assessment, suggested_adjustment, adjustment_rationale }
- category_traffic_lights: record of category -> { score, light ("green"|"yellow"|"red"), one_liner }
- executive_brief: 150-200 words. Paragraph 1: The verdict. Paragraph 2: The biggest risk. Paragraph 3: The biggest opportunity.
- critical_findings: array of { rank, finding, modules, business_impact, urgency }
- top_opportunities: array of { rank, opportunity, modules, estimated_impact, effort }
- tech_stack_summary: { analytics, advertising, automation, cms_hosting, security, other } — arrays of tool names
- competitive_context: 3-4 sentences positioning this domain's stack`;

    const result = await callPro(prompt, FinalSynthesisSchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 8192,
    });

    // Post-processing: validate that cited modules actually exist and ran
    const validatedFindings = result.data.critical_findings.filter(f =>
      f.modules.every(m => ctx.previousResults.has(m as ModuleId)),
    );
    const validatedOpps = result.data.top_opportunities.filter(o =>
      o.modules.every(m => ctx.previousResults.has(m as ModuleId)),
    );

    const synthesis: FinalSynthesis = {
      ...result.data,
      critical_findings: validatedFindings,
      top_opportunities: validatedOpps,
    };

    data.synthesis = synthesis;
    data.marketingIQ = marketingIQ;
    data.tokensUsed = result.tokensUsed;

    checkpoints.push(createCheckpoint({
      id: 'm42-synthesis', name: 'Final Synthesis', weight: 0.5,
      health: 'excellent',
      evidence: `Final synthesis complete: MarketingIQ ${marketingIQ.final}/100 (${marketingIQ.label}), ${validatedFindings.length} critical findings, ${validatedOpps.length} opportunities`,
    }));

    return {
      moduleId: 'M42' as ModuleId,
      status: 'success',
      data,
      signals,
      score: marketingIQ.final,
      checkpoints,
      duration: 0,
    };
  } catch (error) {
    // Fallback without AI
    data.synthesis = buildFallbackSynthesis(ctx.url, marketingIQ, moduleSummaries);
    data.marketingIQ = marketingIQ;

    checkpoints.push(createCheckpoint({
      id: 'm42-synthesis', name: 'Final Synthesis', weight: 0.5,
      health: 'warning',
      evidence: `Synthesis used fallback (AI unavailable): MarketingIQ ${marketingIQ.final}/100`,
    }));

    return { moduleId: 'M42' as ModuleId, status: 'success', data, signals, score: marketingIQ.final, checkpoints, duration: 0 };
  }
};

function buildFallbackSynthesis(
  url: string,
  marketingIQ: ReturnType<typeof calculateMarketingIQ>,
  moduleSummaries: Record<string, Record<string, unknown>>,
): FinalSynthesis {
  const categoryLights: Record<string, z.infer<typeof CategoryLightSchema>> = {};
  for (const cat of marketingIQ.categories) {
    categoryLights[cat.category] = {
      score: cat.score,
      light: cat.light,
      one_liner: `${cat.category}: ${cat.score}/100`,
    };
  }

  return {
    marketing_iq_validation: {
      algorithmic_score: marketingIQ.final,
      ai_assessment: 'AI validation unavailable. Using algorithmic score.',
      suggested_adjustment: 0,
      adjustment_rationale: 'Score accurately reflects findings.',
    },
    category_traffic_lights: categoryLights,
    executive_brief: `Marketing technology audit complete for ${url}. MarketingIQ score: ${marketingIQ.final}/100 (${marketingIQ.label}). ${marketingIQ.penalties.length} penalties and ${marketingIQ.bonuses.length} bonuses applied. Review individual module results for detailed findings.`,
    critical_findings: [],
    top_opportunities: [],
    tech_stack_summary: {
      analytics: [], advertising: [], automation: [],
      cms_hosting: [], security: [], other: [],
    },
    competitive_context: 'Competitive context unavailable without AI synthesis.',
  };
}

registerModuleExecutor('M42' as ModuleId, execute);
