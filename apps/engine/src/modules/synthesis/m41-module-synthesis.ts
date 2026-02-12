/**
 * M41 - Module AI Synthesis
 *
 * Uses Gemini Flash to synthesize each scored module's results
 * into concise human-readable summaries with key findings and
 * recommendations. Follows PRD AI-2 prompt spec.
 *
 * Runs after ALL other modules complete (M01-M39).
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint } from '@marketing-alpha/types';
import { createCheckpoint } from '../../utils/signals.js';
import { callFlash } from '../../services/gemini.js';
import { getScoredModuleIds } from '../registry.js';
import { z } from 'zod';

const MODULE_CATEGORIES: Record<string, string> = {
  M01: 'Compliance & Security', M02: 'Digital Presence', M03: 'Performance & UX',
  M04: 'SEO & Content', M05: 'Analytics & Data Integrity', M06: 'Paid Media & Attribution',
  M06b: 'Paid Media & Attribution', M07: 'MarTech Efficiency', M08: 'Analytics & Data Integrity',
  M09: 'Analytics & Data Integrity', M10: 'Compliance & Security', M11: 'Compliance & Security',
  M12: 'Compliance & Security', M13: 'Performance & UX', M14: 'Performance & UX',
  M15: 'SEO & Content', M16: 'SEO & Content', M17: 'Digital Presence',
  M18: 'Digital Presence', M19: 'Digital Presence', M20: 'MarTech Efficiency',
  M21: 'Paid Media & Attribution', M22: 'Digital Presence', M23: 'Digital Presence',
  M24: 'Market Position', M25: 'Market Position', M26: 'Market Position',
  M27: 'Market Position', M28: 'Paid Media & Attribution', M29: 'Paid Media & Attribution',
  M30: 'Market Position', M31: 'Market Position', M32: 'Market Position',
  M33: 'Market Position', M34: 'SEO & Content', M35: 'SEO & Content',
  M36: 'Market Position', M37: 'Digital Presence', M38: 'Digital Presence',
  M39: 'Digital Presence',
};

const MODULE_NAMES: Record<string, string> = {
  M01: 'DNS & Security Baseline', M02: 'CMS & Infrastructure', M03: 'Performance & Core Web Vitals',
  M04: 'Page Metadata & SEO', M05: 'Analytics Architecture', M06: 'Paid Media Pixel Audit',
  M06b: 'PPC Landing Page Audit', M07: 'MarTech Stack Inventory', M08: 'Tag Governance',
  M09: 'Behavioral Intelligence', M10: 'Accessibility Audit', M11: 'Console Error Scan',
  M12: 'Compliance & Privacy', M13: 'Performance & Carbon', M14: 'Mobile & Responsive',
  M15: 'Social & Sharing', M16: 'PR & Media', M17: 'Careers & HR',
  M18: 'Investor Relations', M19: 'Support Infrastructure', M20: 'Ecommerce/SaaS Signals',
  M21: 'Ad Library Intelligence', M22: 'News Sentiment', M23: 'Social Sentiment',
  M24: 'Monthly Traffic', M25: 'Traffic by Country', M26: 'Keyword Rankings',
  M27: 'Paid Traffic Cost', M28: 'Top Paid Keywords', M29: 'Competitor Landscape',
  M30: 'Traffic Sources', M31: 'Domain Trust', M32: 'Mobile vs Desktop',
  M33: 'Brand Search', M34: 'Losing Keywords', M35: 'Bounce Rate',
  M36: 'Google Shopping', M37: 'Review Velocity', M38: 'Local Pack',
  M39: 'Business Profile',
};

const KeyFindingSchema = z.object({
  finding: z.string(),
  severity: z.enum(['critical', 'warning', 'info', 'positive']),
  evidence: z.string(),
  business_impact: z.string(),
});

const RecommendationSchema = z.object({
  action: z.string(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  effort: z.enum(['S', 'M', 'L', 'XL']),
  expected_impact: z.string(),
});

const ModuleSynthesisSchema = z.object({
  executive_summary: z.string(),
  key_findings: z.array(KeyFindingSchema),
  recommendations: z.array(RecommendationSchema),
  score_rationale: z.string(),
});

type ModuleSynthesis = z.infer<typeof ModuleSynthesisSchema>;

const SYSTEM_PROMPT = `You are a senior marketing technology analyst at a forensic auditing firm.
You are analyzing a single module from a comprehensive scan of a website.
Your analysis will be read by a VP of Marketing or CMO. Be direct, specific,
and authoritative. Never soften findings or use hedging language.

RULES — YOU MUST FOLLOW ALL OF THESE:
1. ONLY reference data present in the input below. Never invent findings,
   tools, configurations, or statistics that are not in the data.
2. Every finding MUST cite specific evidence from the scan data
   (e.g., "Detected GA4 property G-XXXXXXXX with debug_mode enabled").
3. Severity calibration:
   - critical: Immediate revenue loss, compliance violation, or security risk
   - warning: Optimization opportunity with measurable impact
   - info: Contextual observation, no immediate action needed
   - positive: Something done well — acknowledge it
4. Recommendations must be SPECIFIC and ACTIONABLE:
   BAD: "Improve your tracking setup"
   GOOD: "Add enhanced conversions to Google Ads tag AW-12345 by enabling
   user-provided data collection in GTM, which improves attribution accuracy
   by 15-30% based on Google's published benchmarks"
5. If the module errored or returned limited data, state this explicitly.
   Do not attempt to fill gaps with assumptions.

Priority definitions:
- P0: Do today. Active compliance violation, revenue leak, or security hole.
- P1: Do this week. Significant optimization with clear ROI.
- P2: Do this month. Improvement opportunity, not urgent.
- P3: Backlog. Nice-to-have, low impact relative to effort.

Effort definitions:
- S: < 2 hours, single person, no approval needed
- M: 2-8 hours, single person, may need access/approval
- L: 1-2 weeks, may need multiple people or vendor coordination
- XL: 1+ months, significant project, budget/resources required

Respond in JSON.`;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const scoredModuleIds = getScoredModuleIds();
  const moduleSummaries: Record<string, ModuleSynthesis> = {};
  let synthesizedCount = 0;
  let failedCount = 0;

  for (const moduleId of scoredModuleIds) {
    const moduleResult = ctx.previousResults.get(moduleId);
    if (!moduleResult || moduleResult.status === 'skipped' || moduleResult.status === 'error') {
      continue;
    }

    try {
      const checkpointsJson = JSON.stringify(
        moduleResult.checkpoints.map(cp => ({
          id: cp.id,
          name: cp.name,
          health: cp.health,
          evidence: cp.evidence,
          recommendation: cp.recommendation ?? null,
        })),
      );

      const signalsJson = JSON.stringify(
        moduleResult.signals.slice(0, 30).map(s => ({
          type: s.type,
          name: s.name,
          evidence: s.evidence,
          confidence: s.confidence,
          category: s.category,
        })),
      );

      // Extract raw numeric metrics for modules that have them
      const rawMetrics: Record<string, unknown> = {};
      const md = moduleResult.data as Record<string, unknown>;
      if (moduleId === 'M03') {
        const perf = md['metrics'] as Record<string, unknown> | undefined;
        if (perf) {
          rawMetrics.lcpMs = perf['lcp']; rawMetrics.clsValue = perf['cls'];
          rawMetrics.domNodes = (md['domForensics'] as Record<string, unknown> | undefined)?.['totalNodes'];
          rawMetrics.renderBlockingScripts = perf['renderBlockingScripts'];
        }
      } else if (moduleId === 'M04') {
        rawMetrics.readabilityScore = (md['contentAnalysis'] as Record<string, unknown> | undefined)?.['readabilityScore'];
        rawMetrics.h1Count = (md['contentAnalysis'] as Record<string, unknown> | undefined)?.['h1Count'];
        rawMetrics.wordCount = (md['contentAnalysis'] as Record<string, unknown> | undefined)?.['wordCount'];
        rawMetrics.internalLinks = (md['linkStructure'] as Record<string, unknown> | undefined)?.['internalLinks'];
      } else if (moduleId === 'M05') {
        const tools = md['tools'] as Array<Record<string, unknown>> | undefined;
        rawMetrics.totalTools = tools?.length ?? 0;
        rawMetrics.cookieCount = (md['cookieSummary'] as Record<string, unknown> | undefined)?.['totalCookies'];
        rawMetrics.thirdPartyCookies = (md['cookieSummary'] as Record<string, unknown> | undefined)?.['thirdPartyCount'];
        rawMetrics.firstPartyCookies = (md['cookieSummary'] as Record<string, unknown> | undefined)?.['firstPartyCount'];
      } else if (moduleId === 'M10') {
        rawMetrics.altTextCoverage = (md['imageAccessibility'] as Record<string, unknown> | undefined)?.['altTextCoverage'];
        rawMetrics.formLabelCoverage = (md['formAccessibility'] as Record<string, unknown> | undefined)?.['labelCoverage'];
        rawMetrics.emptyAnchors = (md['linkAccessibility'] as Record<string, unknown> | undefined)?.['emptyAnchors'];
      } else if (moduleId === 'M14') {
        rawMetrics.responsiveImagePct = (md['responsiveImages'] as Record<string, unknown> | undefined)?.['modernFormatPct'];
        rawMetrics.oversizedImages = (md['responsiveImages'] as Record<string, unknown> | undefined)?.['oversizedCount'];
        rawMetrics.hasDarkMode = (md['modernCSSFeatures'] as Record<string, unknown> | undefined)?.['hasDarkMode'];
      }
      const rawMetricsJson = Object.keys(rawMetrics).length > 0 ? `\n\n### Raw Metrics\n${JSON.stringify(rawMetrics)}` : '';

      const moduleName = MODULE_NAMES[moduleId] ?? moduleId;
      const categoryName = MODULE_CATEGORIES[moduleId] ?? 'Other';

      const prompt = `## Module: ${moduleName} (${moduleId})
## Category: ${categoryName}
## Domain: ${ctx.url}
## Module Score: ${moduleResult.score ?? 'N/A'}/100

### Checkpoint Results
${checkpointsJson}

### Detected Signals
${signalsJson}${rawMetricsJson}

Produce your analysis as valid JSON matching this exact schema:

{
  "executive_summary": "string — 3-5 sentences. Lead with the most important finding. Reference specific tools, configurations, and scores. End with the single most impactful recommendation.",
  "key_findings": [
    {
      "finding": "string — What was found, stated as a fact",
      "severity": "critical | warning | info | positive",
      "evidence": "string — Exact data point from the scan (quote it)",
      "business_impact": "string — Why this matters in dollars, risk, or competitive terms"
    }
  ],
  "recommendations": [
    {
      "action": "string — Specific, implementable instruction. Include tool names, setting names, code changes, or vendor actions.",
      "priority": "P0 | P1 | P2 | P3",
      "effort": "S | M | L | XL",
      "expected_impact": "string — Quantified where possible. Use industry benchmarks when scan data is insufficient."
    }
  ],
  "score_rationale": "string — 2-3 sentences explaining why this module scored ${moduleResult.score ?? 'N/A'}/100. Reference the specific checkpoints that drove the score up or down."
}`;

      const result = await callFlash(prompt, ModuleSynthesisSchema, {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 2048,
      });

      moduleSummaries[moduleId] = result.data;
      synthesizedCount++;
    } catch {
      failedCount++;
      // Fallback: basic summary without AI
      moduleSummaries[moduleId] = buildFallbackSynthesis(moduleId, moduleResult, ctx.url);
      synthesizedCount++;
    }
  }

  data.moduleSummaries = moduleSummaries;
  data.synthesizedCount = synthesizedCount;
  data.failedCount = failedCount;

  checkpoints.push(createCheckpoint({
    id: 'm41-synthesis', name: 'Module Synthesis', weight: 0.5,
    health: synthesizedCount > 0 ? 'excellent' : 'warning',
    evidence: `Synthesized ${synthesizedCount} module results (${failedCount} used fallback)`,
  }));

  return {
    moduleId: 'M41' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

function buildFallbackSynthesis(moduleId: string, result: ModuleResult, url: string): ModuleSynthesis {
  const criticalCps = result.checkpoints.filter(cp => cp.health === 'critical');
  const warningCps = result.checkpoints.filter(cp => cp.health === 'warning');
  const positiveCps = result.checkpoints.filter(cp => cp.health === 'excellent' || cp.health === 'good');

  const findings = [
    ...criticalCps.slice(0, 3).map(cp => ({
      finding: `${cp.name}: ${cp.evidence}`,
      severity: 'critical' as const,
      evidence: cp.evidence,
      business_impact: 'Requires immediate attention.',
    })),
    ...warningCps.slice(0, 2).map(cp => ({
      finding: `${cp.name}: ${cp.evidence}`,
      severity: 'warning' as const,
      evidence: cp.evidence,
      business_impact: 'Optimization opportunity.',
    })),
    ...positiveCps.slice(0, 1).map(cp => ({
      finding: `${cp.name}: ${cp.evidence}`,
      severity: 'positive' as const,
      evidence: cp.evidence,
      business_impact: 'Well implemented.',
    })),
  ];

  const recs = result.checkpoints
    .filter(cp => cp.recommendation)
    .slice(0, 3)
    .map(cp => ({
      action: cp.recommendation!,
      priority: cp.health === 'critical' ? 'P0' as const : 'P1' as const,
      effort: 'M' as const,
      expected_impact: 'Improved module score.',
    }));

  return {
    executive_summary: `${moduleId} analysis for ${url}: ${result.checkpoints.length} checkpoints analyzed, ${result.signals.length} signals detected. Score: ${result.score ?? 'N/A'}/100. ${criticalCps.length} critical issues found.`,
    key_findings: findings,
    recommendations: recs,
    score_rationale: `Module scored ${result.score ?? 'N/A'}/100 based on ${positiveCps.length} healthy, ${warningCps.length} warning, and ${criticalCps.length} critical checkpoints.`,
  };
}

export { execute };
registerModuleExecutor('M41' as ModuleId, execute);
