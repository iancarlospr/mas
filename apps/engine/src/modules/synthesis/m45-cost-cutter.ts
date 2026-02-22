/**
 * M45 - Stack Analyzer
 *
 * Analyzes the detected marketing technology stack and produces
 * recommendations: abandoned tool cleanup, redundancy consolidation,
 * a Lean Stack (minimum viable), and an Optimal Stack (best-in-class).
 *
 * No pricing or cost estimates — focuses on tool fitness for the
 * business type and scale.
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

// ─── Output schema ──────────────────────────────────────────────────────

const AbandonedToolSchema = z.object({
  tool: z.string(),
  evidence: z.string(),
  sourceModule: z.string(),
  recommendation: z.string(),
});

const RedundancySchema = z.object({
  tools: z.array(z.string()),
  function: z.string(),
  recommendation: z.string(),
  rationale: z.string(),
  effortToConsolidate: z.enum(['S', 'M', 'L']),
});

const LeanToolSchema = z.object({
  tool: z.string(),
  purpose: z.string(),
  replaces: z.array(z.string()),
  rationale: z.string(),
});

const OptimalToolSchema = z.object({
  tool: z.string(),
  purpose: z.string(),
  isCurrentlyDetected: z.boolean(),
  rationale: z.string(),
});

const ToolAnalyzerSchema = z.object({
  currentStack: z.object({
    totalTools: z.number(),
    activeTools: z.number(),
    abandonedTools: z.number(),
    redundantPairs: z.number(),
    categories: z.array(z.object({
      name: z.string(),
      tools: z.array(z.string()),
    })),
    assessment: z.string(),
  }),
  abandonedTools: z.array(AbandonedToolSchema),
  redundancies: z.array(RedundancySchema),
  leanStack: z.object({
    description: z.string(),
    tools: z.array(LeanToolSchema),
    removals: z.array(z.object({
      tool: z.string(),
      reason: z.string(),
    })),
    totalToolsAfter: z.number(),
    keyBenefit: z.string(),
  }),
  optimalStack: z.object({
    description: z.string(),
    tools: z.array(OptimalToolSchema),
    gaps: z.array(z.object({
      capability: z.string(),
      recommendation: z.string(),
      rationale: z.string(),
    })),
    upgrades: z.array(z.object({
      currentTool: z.string(),
      suggestedTool: z.string(),
      rationale: z.string(),
    })),
    totalToolsAfter: z.number(),
    keyBenefit: z.string(),
  }),
  methodology: z.string(),
});

// ─── System prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a marketing technology stack consultant. Analyze the detected tools for this business and produce stack recommendations.

RULES:
1. ONLY reference tools that are present in the input data. Never invent tools that weren't detected.
2. "Redundant" = two or more tools serving the SAME primary function (e.g., GA4 + Mixpanel for web analytics). Two tools in the same broad category but with different functions are NOT redundant (e.g., GA4 for web analytics + Hotjar for heatmaps).
3. "Abandoned" = tool script loads but shows signs of inactivity: no tracking events fire, misconfigured, or the tool's evidence suggests it was set up and forgotten.
4. Lean Stack: the minimum viable stack for this business. Remove abandoned tools, consolidate redundancies, keep only what's essential. Every tool must earn its place.
5. Optimal Stack: the best-in-class stack for this business type and scale. Fill gaps in capabilities (e.g., missing server-side tracking, no A/B testing, no CDP). Suggest specific tools by name and explain why they're a good fit.
6. When suggesting alternatives or upgrades, explain why: feature parity, better integration ecosystem, or better fit for business size.
7. Never include pricing or cost estimates. Focus on capability, fit, and governance.
8. Base business type/scale on the provided business context (if available). If not available, infer from the detected stack's sophistication.
9. Categories should reflect actual functional groupings: Analytics, Tag Management, Advertising, Marketing Automation, Live Chat & Support, Session Recording, A/B Testing, CDP, Consent & Privacy, etc.
10. methodology should be 2-3 sentences explaining the basis of your analysis.

Respond in valid JSON matching the provided schema.`;

// ─── Main executor ──────────────────────────────────────────────────────

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

  // Get M41 business context if available
  const m41Result = ctx.previousResults.get('M41' as ModuleId);
  const m41Data = (m41Result?.data ?? {}) as Record<string, unknown>;
  const businessContext = m41Data['businessContext'] as Record<string, unknown> | undefined;

  try {
    const prompt = `## Domain: ${ctx.url}
## Company tier: ${companyTier}
${businessContext ? `## Business Context
- Name: ${businessContext['businessName'] ?? 'Unknown'}
- Model: ${businessContext['businessModel'] ?? 'Unknown'}
- Description: ${businessContext['description'] ?? 'N/A'}
${(businessContext['ecommerce'] as Record<string, unknown> | undefined)?.['platform'] ? `- Ecommerce: ${(businessContext['ecommerce'] as Record<string, unknown>)['platform']}` : ''}
${(businessContext['scale'] as Record<string, unknown> | undefined)?.['totalTraffic'] ? `- Monthly traffic: ${(businessContext['scale'] as Record<string, unknown>)['totalTraffic']}` : ''}` : '## Business Context: Not available (infer from stack)'}

### All Detected Tools (from M05, M06, M07, M08, M09, M20)
${JSON.stringify(uniqueToolEntries, null, 2)}

Analyze this stack and produce:
1. currentStack: categorize all tools, count active/abandoned/redundant, write a 1-2 sentence assessment
2. abandonedTools: list tools with evidence of inactivity
3. redundancies: identify tools with overlapping primary functions
4. leanStack: minimum viable stack — what to keep, what to remove, and why
5. optimalStack: best-in-class stack — current tools + gap fills + upgrades

Respond in valid JSON.`;

    const result = await callFlash(prompt, ToolAnalyzerSchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 6144,
    });

    // Post-processing: validate tool names against detected tools
    const detectedNames = new Set(uniqueToolEntries.map(t => t.name.toLowerCase()));

    const validatedRedundancies = result.data.redundancies.filter(r =>
      r.tools.some(t => detectedNames.has(t.toLowerCase())),
    );
    const validatedAbandoned = result.data.abandonedTools.filter(a =>
      detectedNames.has(a.tool.toLowerCase()),
    );

    data.stackAnalysis = {
      ...result.data,
      redundancies: validatedRedundancies,
      abandonedTools: validatedAbandoned,
    };
    data.tokensUsed = result.tokensUsed;

    const totalFindings = validatedRedundancies.length + validatedAbandoned.length + result.data.optimalStack.gaps.length;

    checkpoints.push(createCheckpoint({
      id: 'm45-stack', name: 'Stack Analysis', weight: 0.5,
      health: totalFindings > 0 ? 'excellent' : 'good',
      evidence: `Stack analysis: ${uniqueToolEntries.length} tools detected, ${validatedRedundancies.length} redundancies, ${validatedAbandoned.length} abandoned, lean=${result.data.leanStack.totalToolsAfter} tools, optimal=${result.data.optimalStack.totalToolsAfter} tools`,
    }));
  } catch (error) {
    data.stackAnalysis = buildFallbackAnalysis(uniqueToolEntries);

    checkpoints.push(createCheckpoint({
      id: 'm45-stack', name: 'Stack Analysis', weight: 0.5,
      health: 'warning',
      evidence: `Stack analysis used fallback: ${(error as Error).message.slice(0, 80)}`,
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
  const categories = new Map<string, string[]>();
  for (const t of tools) {
    const cat = t.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(t.name);
  }

  return {
    currentStack: {
      totalTools: tools.length,
      activeTools: tools.length,
      abandonedTools: 0,
      redundantPairs: 0,
      categories: [...categories.entries()].map(([name, toolList]) => ({ name, tools: toolList })),
      assessment: 'AI analysis was unavailable. Tool list shown as detected.',
    },
    abandonedTools: [],
    redundancies: [],
    leanStack: {
      description: 'AI analysis required for lean stack recommendation.',
      tools: [],
      removals: [],
      totalToolsAfter: tools.length,
      keyBenefit: 'N/A',
    },
    optimalStack: {
      description: 'AI analysis required for optimal stack recommendation.',
      tools: tools.map(t => ({ tool: t.name, purpose: t.category, isCurrentlyDetected: true, rationale: 'Currently detected' })),
      gaps: [],
      upgrades: [],
      totalToolsAfter: tools.length,
      keyBenefit: 'N/A',
    },
    methodology: 'Fallback mode — AI generation was unavailable. Only the detected tool inventory is shown.',
  };
}

export { execute };
registerModuleExecutor('M45' as ModuleId, execute);
