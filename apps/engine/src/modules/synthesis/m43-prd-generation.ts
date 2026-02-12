/**
 * M43 - PRD Generation (Remediation Roadmap)
 *
 * Uses Gemini Pro to generate a structured remediation roadmap
 * with workstreams, tasks, timeline, and risk register.
 * Follows PRD AI-4 prompt spec.
 *
 * Depends on: M42
 * Tier: paid
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createCheckpoint } from '../../utils/signals.js';
import { callPro } from '../../services/gemini.js';
import { z } from 'zod';

const TaskSchema = z.object({
  id: z.string(),
  task: z.string(),
  rationale: z.string(),
  effort: z.enum(['S', 'M', 'L', 'XL']),
  dependencies: z.array(z.string()).nullable(),
  success_criteria: z.string(),
  tools_needed: z.string(),
});

const WorkstreamSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner_role: z.string(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  estimated_total_effort: z.string(),
  business_impact: z.string(),
  tasks: z.array(TaskSchema),
});

const RiskSchema = z.object({
  risk: z.string(),
  likelihood: z.enum(['high', 'medium', 'low']),
  impact: z.enum(['high', 'medium', 'low']),
  mitigation: z.string(),
});

const TimelinePhaseSchema = z.object({
  focus: z.string(),
  tasks: z.array(z.string()),
});

const PRDSchema = z.object({
  title: z.string(),
  date: z.string(),
  marketing_iq: z.number(),
  current_state_assessment: z.string(),
  target_state: z.string(),
  workstreams: z.array(WorkstreamSchema),
  implementation_timeline: z.object({
    week_1: TimelinePhaseSchema,
    week_2: TimelinePhaseSchema,
    week_3_4: TimelinePhaseSchema,
    month_2: TimelinePhaseSchema,
    month_3_plus: TimelinePhaseSchema,
  }),
  risk_register: z.array(RiskSchema),
  expected_outcomes: z.object({
    marketing_iq_target: z.number(),
    timeline_to_target: z.string(),
    key_metrics_to_track: z.array(z.string()),
  }),
});

const SYSTEM_PROMPT = `You are a Principal Product Manager at McKinsey Digital producing a
remediation roadmap based on a comprehensive marketing technology audit.

This PRD will be downloaded as a PDF by a VP of Marketing and shared with
their engineering and operations teams. It must be immediately actionable —
every task must be specific enough that an engineer or marketer can start
working on it without asking clarifying questions.

RULES:
1. Every task MUST trace back to a specific finding from the audit.
   Include the module ID (e.g., "M05", "M12") as a citation.
2. Tasks are grouped into workstreams. Each workstream targets a
   specific business outcome (not a module or technical area).
3. Effort estimates: S = <2 hours, M = 2-8 hours, L = 1-2 weeks,
   XL = 1+ months. Be realistic, not optimistic.
4. Dependencies must be logical. Never suggest fixing attribution
   before fixing base analytics. Never suggest compliance fixes
   before consent mechanisms are in place.
5. Success criteria must be MEASURABLE. Not "improved performance"
   but "LCP < 2.5s measured via Lighthouse CI on 3 consecutive runs."
6. The implementation timeline is a SUGGESTION, not a mandate.
   Acknowledge resource constraints.
7. ONLY reference data present in the input. Never invent findings.

Respond in JSON.`;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const m42Result = ctx.previousResults.get('M42' as ModuleId);
  if (!m42Result || m42Result.status !== 'success') {
    return { moduleId: 'M43' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'M42 synthesis not available' };
  }

  const m42Data = m42Result.data as Record<string, unknown>;
  const synthesis = m42Data['synthesis'] as Record<string, unknown> ?? {};
  const marketingIQ = m42Data['marketingIQ'] as Record<string, unknown> ?? {};

  // Get M41 summaries for detailed module data
  const m41Result = ctx.previousResults.get('M41' as ModuleId);
  const m41Data = m41Result?.data as Record<string, unknown> | undefined;
  const moduleSummaries = m41Data?.['moduleSummaries'] as Record<string, Record<string, unknown>> ?? {};

  // Extract tech stack signals
  const allSignals = [...ctx.previousResults.values()].flatMap(r => r.signals ?? []);
  const techStackSignals = allSignals
    .filter(s => s.confidence >= 0.6)
    .map(s => ({ name: s.name, type: s.type, category: s.category }));

  try {
    const prompt = `## Domain: ${ctx.url}
## MarketingIQ: ${marketingIQ['final'] ?? 'N/A'}/100 (${marketingIQ['label'] ?? 'N/A'})

### Final Synthesis (M42 output)
${JSON.stringify({
  executive_brief: synthesis['executive_brief'] ?? synthesis['executiveSummary'] ?? '',
  critical_findings: synthesis['critical_findings'] ?? [],
  top_opportunities: synthesis['top_opportunities'] ?? [],
})}

### All Module Analyses (M41 outputs)
${JSON.stringify(
  Object.fromEntries(
    Object.entries(moduleSummaries).slice(0, 30).map(([id, s]) => [id, {
      executive_summary: s['executive_summary'] ?? s['summary'] ?? '',
      recommendations: s['recommendations'] ?? [],
    }]),
  ),
)}

### Detected Tech Stack
${JSON.stringify(techStackSignals.slice(0, 50))}

### Module Dependency Context (for task ordering)
IMPORTANT: Respect these dependencies when ordering workstream tasks:
- Consent/Privacy (M12) fixes MUST come before any tracking/analytics implementations
- Base analytics (M05) must be correct before attribution (M06) or paid media (M06b) optimizations
- Performance (M03) improvements impact conversion rates for ALL revenue-related recommendations
- Security headers (M01) and HTTPS setup are prerequisites for cookie compliance
- Tag governance (M08) improvements should precede individual tool optimizations
- Accessibility (M10) fixes may be legally required before other UX improvements
- CMS/infrastructure (M02) changes may be prerequisites for performance and feature work

### ROI Context (from M44, if available)
${JSON.stringify((() => {
  const m44 = ctx.previousResults.get('M44' as ModuleId);
  if (!m44 || m44.status !== 'success') return 'unavailable';
  const d = m44.data as Record<string, unknown>;
  return { totalAnnualOpportunity: d['totalAnnualOpportunity'], topOpportunities: (d['opportunities'] as Array<Record<string, unknown>> | undefined)?.slice(0, 5) ?? [] };
})())}

### Scan Date
${new Date().toISOString().split('T')[0]}

Produce the PRD as valid JSON with these fields:
- title: "Marketing Technology Remediation PRD — ${ctx.url}"
- date: today's date
- marketing_iq: the score number
- current_state_assessment: 3-4 paragraphs
- target_state: 2-3 paragraphs
- workstreams: array of { id, name, owner_role, priority, estimated_total_effort, business_impact, tasks: [{ id, task, rationale, effort, dependencies, success_criteria, tools_needed }] }
- implementation_timeline: { week_1, week_2, week_3_4, month_2, month_3_plus } each with { focus, tasks (task IDs) }
- risk_register: array of { risk, likelihood, impact, mitigation }
- expected_outcomes: { marketing_iq_target, timeline_to_target, key_metrics_to_track }`;

    const result = await callPro(prompt, PRDSchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 12288,
    });

    data.prd = result.data;
    data.tokensUsed = result.tokensUsed;

    const totalTasks = result.data.workstreams.reduce((sum, ws) => sum + ws.tasks.length, 0);

    checkpoints.push(createCheckpoint({
      id: 'm43-prd', name: 'PRD Generation', weight: 0.5,
      health: 'excellent',
      evidence: `PRD generated: ${result.data.workstreams.length} workstreams, ${totalTasks} tasks, target IQ ${result.data.expected_outcomes.marketing_iq_target}`,
    }));
  } catch (error) {
    // Fallback: minimal PRD structure
    data.prd = {
      title: `Marketing Technology Remediation PRD — ${ctx.url}`,
      date: new Date().toISOString().split('T')[0],
      marketing_iq: (marketingIQ['final'] as number) ?? 0,
      current_state_assessment: `Audit complete for ${ctx.url}. Score: ${marketingIQ['final']}/100 (${marketingIQ['label']}). Full AI-generated PRD unavailable.`,
      target_state: 'Target state assessment requires AI synthesis.',
      workstreams: [],
      implementation_timeline: {
        week_1: { focus: 'Review audit findings', tasks: [] },
        week_2: { focus: 'Address critical issues', tasks: [] },
        week_3_4: { focus: 'Implement improvements', tasks: [] },
        month_2: { focus: 'Optimize and measure', tasks: [] },
        month_3_plus: { focus: 'Long-term initiatives', tasks: [] },
      },
      risk_register: [],
      expected_outcomes: {
        marketing_iq_target: Math.min(100, ((marketingIQ['final'] as number) ?? 50) + 15),
        timeline_to_target: '8-12 weeks',
        key_metrics_to_track: ['MarketingIQ score', 'Core Web Vitals', 'Analytics accuracy'],
      },
    };

    checkpoints.push(createCheckpoint({
      id: 'm43-prd', name: 'PRD Generation', weight: 0.5,
      health: 'warning',
      evidence: `PRD generation used fallback: ${(error as Error).message.slice(0, 80)}`,
    }));
  }

  return { moduleId: 'M43' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M43' as ModuleId, execute);
