/**
 * M45 - Cost Cutter Analysis
 *
 * Uses Gemini Flash to identify redundant tools, abandoned scripts,
 * and cheaper alternatives. Includes tool pricing knowledge base.
 * Follows PRD AI-6 prompt spec.
 *
 * Depends on: M41
 * Tier: paid
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createCheckpoint } from '../../utils/signals.js';
import { callFlash } from '../../services/gemini.js';
import { z } from 'zod';

const RedundancySchema = z.object({
  tools: z.array(z.string()),
  function: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  estimated_monthly_savings: z.string(),
  effort_to_consolidate: z.enum(['S', 'M', 'L']),
});

const AbandonedToolSchema = z.object({
  tool: z.string(),
  evidence: z.string(),
  estimated_monthly_cost: z.string(),
  recommendation: z.string(),
});

const AlternativeSchema = z.object({
  current_tool: z.string(),
  alternative: z.string(),
  current_estimated_cost: z.string(),
  alternative_cost: z.string(),
  savings: z.string(),
  tradeoffs: z.string(),
  recommendation_strength: z.enum(['strong', 'moderate', 'weak']),
});

const CostCutterSchema = z.object({
  redundancies: z.array(RedundancySchema),
  abandoned_tools: z.array(AbandonedToolSchema),
  cheaper_alternatives: z.array(AlternativeSchema),
  stack_health_summary: z.object({
    total_tools_detected: z.number(),
    active_tools: z.number(),
    inactive_or_abandoned: z.number(),
    redundant_pairs: z.number(),
    estimated_total_monthly_spend: z.string(),
    estimated_monthly_savings: z.string(),
    estimated_annual_savings: z.string(),
  }),
});

const PRICING_KB = `
GA4: free | GA360: ~$50K+/yr
Adobe Analytics: ~$100K+/yr
Mixpanel: $0-$1K/mo
Amplitude: $0-$2K/mo
Heap: $0-$1K/mo
Segment: $0-$1.2K/mo
HubSpot Marketing: $800-$3.6K/mo
Marketo: $1K-$4K/mo
Pardot: $1.25K-$4K/mo
Intercom: $74-$999/mo
Drift: $2.5K+/mo
Zendesk: $19-$115/agent/mo
Hotjar: $0-$171/mo
FullStory: $0-$849/mo
Optimizely: $36K+/yr
VWO: $357-$1.7K/mo
OneTrust: $1K+/mo
Cookiebot: $0-$40/mo
Sentry: $0-$80/mo
Datadog RUM: $0-$15/1K sessions
New Relic: $0-$0.30/GB
Lucky Orange: $0-$39/mo
Crazy Egg: $29-$249/mo
Mailchimp: $0-$350/mo
Klaviyo: $0-$1K/mo
ActiveCampaign: $29-$259/mo
Salesforce Marketing Cloud: $1.25K+/mo
Unbounce: $99-$625/mo
Instapage: $199-$599/mo
Chatbot/Tidio: $0-$39/mo
LiveChat: $20-$59/agent/mo
Freshdesk: $0-$79/agent/mo
`;

const SYSTEM_PROMPT = `You are a marketing technology auditor specializing in stack
rationalization. Analyze the detected tools and identify cost reduction opportunities.

RULES:
1. "Redundant" = two tools serving the same primary function
   (e.g., GA4 + Adobe Analytics = redundant analytics).
2. "Abandoned" = tool script loads but no active tracking fires,
   OR tool is detected but misconfigured/inactive.
3. "Cheaper alternative" = only suggest when the alternative provides
   equivalent functionality. Don't suggest Plausible to replace GA4
   for an enterprise with 50 custom dimensions.
4. Every recommendation includes estimated savings with source.
5. ONLY reference tools that are present in the input data. Never
   invent or assume tools that weren't detected.

Respond in JSON.`;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  // Collect all tool signals across modules
  const allSignals = [...ctx.previousResults.values()].flatMap(r => r.signals ?? []);
  const toolSignals = allSignals.filter(s => s.confidence >= 0.5);

  // Determine company tier from tech stack sophistication
  const uniqueTools = new Set(toolSignals.map(s => s.name));
  const companyTier = uniqueTools.size > 15 ? 'enterprise' : uniqueTools.size > 7 ? 'mid-market' : 'startup';

  // Build tool activity status from module data
  const toolsDetected = toolSignals.map(s => ({
    name: s.name,
    type: s.type,
    category: s.category,
    confidence: s.confidence,
    evidence: s.evidence,
    sourceModule: findSourceModule(s, ctx),
  }));

  // Deduplicate by name
  const uniqueToolEntries = Object.values(
    toolsDetected.reduce<Record<string, typeof toolsDetected[number]>>((acc, t) => {
      if (!acc[t.name] || t.confidence > acc[t.name]!.confidence) {
        acc[t.name] = t;
      }
      return acc;
    }, {}),
  );

  try {
    const prompt = `## Domain: ${ctx.url}
## Company tier: ${companyTier}

### All Detected Tools (from M05, M06, M07, M08, M09, M20)
${JSON.stringify(uniqueToolEntries)}

### Tool Pricing Knowledge Base
${PRICING_KB}

Produce the analysis as valid JSON with these fields:
- redundancies: array of { tools, function, recommendation, rationale, estimated_monthly_savings, effort_to_consolidate }
- abandoned_tools: array of { tool, evidence, estimated_monthly_cost, recommendation }
- cheaper_alternatives: array of { current_tool, alternative, current_estimated_cost, alternative_cost, savings, tradeoffs, recommendation_strength }
- stack_health_summary: { total_tools_detected, active_tools, inactive_or_abandoned, redundant_pairs, estimated_total_monthly_spend, estimated_monthly_savings, estimated_annual_savings }`;

    const result = await callFlash(prompt, CostCutterSchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 4096,
    });

    // Post-processing: validate tool names against detected tools
    const detectedNames = new Set(uniqueToolEntries.map(t => t.name.toLowerCase()));
    const validatedRedundancies = result.data.redundancies.filter(r =>
      r.tools.some(t => detectedNames.has(t.toLowerCase())),
    );
    const validatedAbandoned = result.data.abandoned_tools.filter(a =>
      detectedNames.has(a.tool.toLowerCase()),
    );

    data.costAnalysis = {
      ...result.data,
      redundancies: validatedRedundancies,
      abandoned_tools: validatedAbandoned,
    };
    data.tokensUsed = result.tokensUsed;

    const totalSavings = validatedRedundancies.length + validatedAbandoned.length + result.data.cheaper_alternatives.length;

    checkpoints.push(createCheckpoint({
      id: 'm45-cost', name: 'Cost Optimization', weight: 0.5,
      health: totalSavings > 0 ? 'excellent' : 'good',
      evidence: `Cost analysis: ${validatedRedundancies.length} redundancies, ${validatedAbandoned.length} abandoned tools, ${result.data.cheaper_alternatives.length} alternatives. Est. savings: ${result.data.stack_health_summary.estimated_annual_savings}/yr`,
    }));
  } catch (error) {
    // Fallback: rule-based analysis
    data.costAnalysis = buildFallbackAnalysis(uniqueToolEntries);

    checkpoints.push(createCheckpoint({
      id: 'm45-cost', name: 'Cost Optimization', weight: 0.5,
      health: 'warning',
      evidence: `Cost analysis used fallback: ${(error as Error).message.slice(0, 80)}`,
    }));
  }

  return { moduleId: 'M45' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

function findSourceModule(signal: Signal, ctx: ModuleContext): string {
  for (const [id, result] of ctx.previousResults) {
    if (result.signals.some(s => s.name === signal.name && s.type === signal.type)) {
      return id;
    }
  }
  return 'unknown';
}

function buildFallbackAnalysis(tools: Array<{ name: string; type: string; category: string }>) {
  return {
    redundancies: [],
    abandoned_tools: [],
    cheaper_alternatives: [],
    stack_health_summary: {
      total_tools_detected: tools.length,
      active_tools: tools.length,
      inactive_or_abandoned: 0,
      redundant_pairs: 0,
      estimated_total_monthly_spend: 'N/A',
      estimated_monthly_savings: 'N/A',
      estimated_annual_savings: 'N/A',
    },
  };
}

registerModuleExecutor('M45' as ModuleId, execute);
