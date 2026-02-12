/**
 * M44 - ROI Simulator
 *
 * Uses Gemini Flash to estimate financial impact of marketing technology
 * issues. Shows all math, cites sources, and is conservative.
 * Follows PRD AI-5 prompt spec.
 *
 * Depends on: M42
 * Tier: paid
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createCheckpoint } from '../../utils/signals.js';
import { callFlash } from '../../services/gemini.js';
import { z } from 'zod';

const CostCategorySchema = z.object({
  title: z.string(),
  monthly_estimate_low: z.string(),
  monthly_estimate_high: z.string(),
  calculation_steps: z.array(z.string()),
  assumptions: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  source_modules: z.array(z.string()),
});

const ComplianceRiskSchema = z.object({
  title: z.string(),
  annual_estimate_range: z.string(),
  risk_factors: z.array(z.string()),
  applicable_regulations: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  source_modules: z.array(z.string()),
});

const ToolRedundancySchema = z.object({
  title: z.string(),
  monthly_estimate: z.string(),
  tools_identified: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  source_modules: z.array(z.string()),
});

const ROISchema = z.object({
  tracking_gap_cost: CostCategorySchema,
  attribution_waste: CostCategorySchema,
  performance_impact: CostCategorySchema,
  compliance_risk: ComplianceRiskSchema,
  tool_redundancy_waste: ToolRedundancySchema,
  summary: z.object({
    total_monthly_opportunity_low: z.string(),
    total_monthly_opportunity_high: z.string(),
    total_annual_opportunity_low: z.string(),
    total_annual_opportunity_high: z.string(),
    headline: z.string(),
  }),
});

const SYSTEM_PROMPT = `You are a marketing finance analyst. Calculate the estimated financial
impact of the marketing technology issues found in a forensic audit.

RULES:
1. Be CONSERVATIVE. Underestimate rather than overestimate. Mark
   confidence levels honestly.
2. Show ALL math. Every number must have a documented source or a
   clearly stated assumption.
3. Use these industry benchmarks (cite them):
   - Average ecommerce conversion rate: 2.5-3.0%
   - Every 100ms page speed improvement: +8.4% conversion (Deloitte)
   - Server-side tracking recovers 15-30% of lost conversions (Google)
   - Enhanced conversions improve attribution accuracy by 15-30% (Google)
   - Average bounce rate: 41-55% (Semrush)
   - Average CPC (search): $1.50-3.00 depending on industry
   - GDPR average fine: €2.8M (2024)
   - CCPA per-violation penalty: $2,663-$7,988
4. When data is insufficient, say "insufficient data" with confidence: low.
   Never fabricate numbers.
5. If traffic data is not available, use conservative estimates
   based on the site's detected tech stack sophistication.

Respond in JSON.`;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const m42Result = ctx.previousResults.get('M42' as ModuleId);
  if (!m42Result || m42Result.status !== 'success') {
    return { moduleId: 'M44' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'M42 synthesis not available' };
  }

  const m42Data = m42Result.data as Record<string, unknown>;
  const synthesis = m42Data['synthesis'] as Record<string, unknown> ?? {};

  // Get traffic data from M24
  const m24Result = ctx.previousResults.get('M24' as ModuleId);
  const m24Data = m24Result?.data as Record<string, unknown> | undefined;
  const monthlyVisits = m24Data?.['totalTraffic'] as number | undefined;
  const bounceRate = m24Data?.['bounceRate'] as number | undefined;
  const trafficSources = m24Data?.['trafficSources'];

  // Get M27 for ad spend estimate
  const m27Result = ctx.previousResults.get('M27' as ModuleId);
  const m27Data = m27Result?.data as Record<string, unknown> | undefined;
  const adSpendEstimate = m27Data?.['estimatedMonthlySpend'] as number | undefined;

  // Get M28 for top keywords
  const m28Result = ctx.previousResults.get('M28' as ModuleId);
  const m28Data = m28Result?.data as Record<string, unknown> | undefined;
  const topKeywords = m28Data?.['topKeywords'];

  // Get M03 performance data
  const m03Result = ctx.previousResults.get('M03' as ModuleId);
  const m03Data = m03Result?.data as Record<string, unknown> | undefined;
  const lcpValue = m03Data?.['lcp'] as number | undefined;
  const inpValue = m03Data?.['inp'] as number | undefined;
  const clsValue = m03Data?.['cls'] as number | undefined;

  // Get module findings for specific categories
  const getModuleFindings = (moduleId: string) => {
    const result = ctx.previousResults.get(moduleId as ModuleId);
    if (!result) return 'Module not available';
    return JSON.stringify({
      score: result.score,
      checkpoints: result.checkpoints.filter(cp => cp.health === 'warning' || cp.health === 'critical').map(cp => ({
        name: cp.name, health: cp.health, evidence: cp.evidence,
      })),
      signalCount: result.signals.length,
    });
  };

  try {
    const prompt = `## Domain: ${ctx.url}

### Traffic Intelligence
Monthly visits: ${monthlyVisits ?? 'unavailable'}
Bounce rate: ${bounceRate ?? 'unavailable'}
Traffic sources: ${trafficSources ? JSON.stringify(trafficSources) : 'unavailable'}
Estimated monthly ad spend: ${adSpendEstimate ? `$${adSpendEstimate}` : 'unavailable'}
Top paid keywords: ${topKeywords ? JSON.stringify(topKeywords) : 'unavailable'}

### Performance Data (M03)
LCP: ${lcpValue ?? 'unavailable'}ms
INP: ${inpValue ?? 'unavailable'}ms
CLS: ${clsValue ?? 'unavailable'}

### Analytics Issues (M05)
${getModuleFindings('M05')}

### Attribution Issues (M06)
${getModuleFindings('M06')}

### Tag Governance Issues (M08)
${getModuleFindings('M08')}

### Compliance Issues (M12)
${getModuleFindings('M12')}

### Critical Findings (from M42)
${JSON.stringify(synthesis['critical_findings'] ?? [])}

Produce the ROI simulation as valid JSON with these fields:
- tracking_gap_cost: { title, monthly_estimate_low, monthly_estimate_high, calculation_steps, assumptions, confidence, source_modules }
- attribution_waste: same structure
- performance_impact: same structure
- compliance_risk: { title, annual_estimate_range, risk_factors, applicable_regulations, confidence, source_modules }
- tool_redundancy_waste: { title, monthly_estimate, tools_identified, confidence, source_modules }
- summary: { total_monthly_opportunity_low, total_monthly_opportunity_high, total_annual_opportunity_low, total_annual_opportunity_high, headline }`;

    const result = await callFlash(prompt, ROISchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 4096,
    });

    data.roi = result.data;
    data.tokensUsed = result.tokensUsed;

    checkpoints.push(createCheckpoint({
      id: 'm44-roi', name: 'ROI Simulation', weight: 0.5,
      health: 'excellent',
      evidence: `ROI simulation complete: ${result.data.summary.headline}`,
    }));
  } catch (error) {
    // Fallback: basic ROI estimate
    data.roi = buildFallbackROI(ctx.url, monthlyVisits);

    checkpoints.push(createCheckpoint({
      id: 'm44-roi', name: 'ROI Simulation', weight: 0.5,
      health: 'warning',
      evidence: `ROI simulation used fallback: ${(error as Error).message.slice(0, 80)}`,
    }));
  }

  return { moduleId: 'M44' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

function buildFallbackROI(url: string, monthlyVisits?: number) {
  const visits = monthlyVisits ?? 5000;
  const na = { title: '', monthly_estimate_low: 'N/A', monthly_estimate_high: 'N/A', calculation_steps: ['Insufficient data for AI calculation'], assumptions: [], confidence: 'low' as const, source_modules: [] };

  return {
    tracking_gap_cost: { ...na, title: 'Revenue Invisible Due to Broken/Missing Tracking' },
    attribution_waste: { ...na, title: 'Ad Spend Wasted Due to Attribution Errors' },
    performance_impact: { ...na, title: 'Revenue Lost from Slow Page Performance' },
    compliance_risk: { title: 'Potential Regulatory Fine Exposure', annual_estimate_range: 'N/A', risk_factors: [], applicable_regulations: [], confidence: 'low' as const, source_modules: [] },
    tool_redundancy_waste: { title: 'Monthly Spend on Redundant/Unused Tools', monthly_estimate: 'N/A', tools_identified: [], confidence: 'low' as const, source_modules: [] },
    summary: {
      total_monthly_opportunity_low: 'N/A',
      total_monthly_opportunity_high: 'N/A',
      total_annual_opportunity_low: 'N/A',
      total_annual_opportunity_high: 'N/A',
      headline: `ROI simulation for ${url} requires AI synthesis. Estimated ${visits.toLocaleString()} monthly visits.`,
    },
  };
}

export { execute };
registerModuleExecutor('M44' as ModuleId, execute);
