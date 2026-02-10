/**
 * M46 - AI Knowledge Base
 *
 * Uses Gemini Flash to restructure all scan data into a queryable
 * knowledge base for the AI chat feature. Organized by topics
 * and entities for topic-based retrieval.
 * Follows PRD AI-7 prompt spec.
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

const TopicSchema = z.object({
  summary: z.string(),
  tools_detected: z.array(z.string()),
  findings: z.array(z.string()),
  recommendations: z.array(z.string()),
  source_modules: z.array(z.string()),
});

const ToolEntitySchema = z.object({
  category: z.string(),
  status: z.string(),
  configuration: z.record(z.unknown()).optional(),
  issues: z.array(z.string()),
  source_modules: z.array(z.string()),
});

const KnowledgeBaseSchema = z.object({
  domain: z.string(),
  scan_date: z.string(),
  marketing_iq: z.number(),
  topics: z.record(TopicSchema),
  entities: z.object({
    tools: z.record(ToolEntitySchema),
  }),
});

const SYSTEM_PROMPT = `You are a data architect. Restructure the complete audit data into
a queryable knowledge base that an AI chat assistant can use to answer
ANY question about this scan.

The knowledge base must be organized so that:
1. A question about "analytics" retrieves all analytics-related data
   from every module that detected analytics signals
2. A question about "what cookies does this site use" retrieves the
   consolidated cookie inventory
3. A question about "how can I improve performance" retrieves performance
   findings, recommendations, and workstreams

RULES:
1. DO NOT summarize or interpret. Restructure the raw data into
   topics with cross-references.
2. Preserve all numerical data, tool names, and specific findings.
3. Every entry must reference its source module(s).
4. The output will be stored as a JSONB column and queried by the
   chat system with topic-based retrieval.
5. ONLY use data present in the input. Never invent findings or tools.

Respond in JSON.`;

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const m42Result = ctx.previousResults.get('M42' as ModuleId);
  const m42Data = m42Result?.data as Record<string, unknown> | undefined;
  const synthesis = m42Data?.['synthesis'] as Record<string, unknown> | undefined;
  const marketingIQ = m42Data?.['marketingIQ'] as Record<string, unknown> | undefined;

  // Get M41 summaries
  const m41Result = ctx.previousResults.get('M41' as ModuleId);
  const m41Data = m41Result?.data as Record<string, unknown> | undefined;
  const moduleSummaries = m41Data?.['moduleSummaries'] as Record<string, Record<string, unknown>> ?? {};

  // Get M43 (PRD), M44 (ROI), M45 (Cost Cutter) data
  const m43Result = ctx.previousResults.get('M43' as ModuleId);
  const m44Result = ctx.previousResults.get('M44' as ModuleId);
  const m45Result = ctx.previousResults.get('M45' as ModuleId);

  // Collect all module data in condensed form
  const allModuleData: Record<string, { score: number | null; checkpointCount: number; signalCount: number; topFindings: string[] }> = {};
  for (const [id, result] of ctx.previousResults) {
    if (id.startsWith('M4')) continue; // Skip synthesis modules
    allModuleData[id] = {
      score: result.score,
      checkpointCount: result.checkpoints.length,
      signalCount: result.signals.length,
      topFindings: result.checkpoints
        .filter(cp => cp.health === 'warning' || cp.health === 'critical')
        .slice(0, 5)
        .map(cp => `${cp.name}: ${cp.evidence}`),
    };
  }

  try {
    const prompt = `## All Module Data (condensed)
${JSON.stringify(allModuleData)}

## All AI Syntheses (M41 outputs)
${JSON.stringify(
  Object.fromEntries(
    Object.entries(moduleSummaries).slice(0, 30).map(([id, s]) => [id, {
      executive_summary: s['executive_summary'] ?? s['summary'] ?? '',
      key_findings: (s['key_findings'] as unknown[])?.slice(0, 5) ?? [],
      recommendations: (s['recommendations'] as unknown[])?.slice(0, 3) ?? [],
    }]),
  ),
)}

## Final Synthesis (M42)
${JSON.stringify({
  executive_brief: synthesis?.['executive_brief'] ?? '',
  critical_findings: synthesis?.['critical_findings'] ?? [],
  top_opportunities: synthesis?.['top_opportunities'] ?? [],
  tech_stack_summary: synthesis?.['tech_stack_summary'] ?? {},
})}

## PRD (M43)
${JSON.stringify(m43Result?.data ? { available: true, workstreamCount: ((m43Result.data as Record<string, unknown>)['prd'] as Record<string, unknown>)?.['workstreams'] ? 'yes' : 'no' } : { available: false })}

## ROI Simulator (M44)
${JSON.stringify(m44Result?.data ? { roi: (m44Result.data as Record<string, unknown>)['roi'] ?? {} } : { available: false })}

## Cost Cutter (M45)
${JSON.stringify(m45Result?.data ? { costAnalysis: (m45Result.data as Record<string, unknown>)['costAnalysis'] ?? {} } : { available: false })}

## Domain: ${ctx.url}
## Scan Date: ${new Date().toISOString().split('T')[0]}
## MarketingIQ: ${marketingIQ?.['final'] ?? 0}

Produce the knowledge base as valid JSON with:
- domain, scan_date, marketing_iq
- topics: record of topic name -> { summary, tools_detected, findings, recommendations, source_modules }
  Include at minimum: analytics, advertising, performance, security, compliance, seo, martech, ecommerce, mobile, social, content, competitors, costs
- entities.tools: record of tool name -> { category, status, issues, source_modules }`;

    const result = await callFlash(prompt, KnowledgeBaseSchema, {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 16384,
    });

    data.knowledgeBase = result.data;
    data.tokensUsed = result.tokensUsed;

    const topicCount = Object.keys(result.data.topics).length;
    const toolCount = Object.keys(result.data.entities.tools).length;

    checkpoints.push(createCheckpoint({
      id: 'm46-kb', name: 'Knowledge Base', weight: 0.5,
      health: 'excellent',
      evidence: `Knowledge base built: ${topicCount} topics, ${toolCount} tool entities indexed`,
    }));
  } catch (error) {
    // Fallback: build structured KB without AI
    data.knowledgeBase = buildFallbackKB(ctx, moduleSummaries, marketingIQ);

    const fb = data.knowledgeBase as Record<string, unknown>;
    const topicCount = Object.keys((fb['topics'] as Record<string, unknown>) ?? {}).length;

    checkpoints.push(createCheckpoint({
      id: 'm46-kb', name: 'Knowledge Base', weight: 0.5,
      health: 'warning',
      evidence: `Knowledge base used fallback: ${topicCount} topics. ${(error as Error).message.slice(0, 60)}`,
    }));
  }

  return { moduleId: 'M46' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

function buildFallbackKB(
  ctx: ModuleContext,
  moduleSummaries: Record<string, Record<string, unknown>>,
  marketingIQ: Record<string, unknown> | undefined,
) {
  const topicModuleMap: Record<string, { modules: string[]; label: string }> = {
    analytics: { modules: ['M05', 'M08', 'M09'], label: 'Analytics & Tracking' },
    advertising: { modules: ['M06', 'M06b', 'M21', 'M28', 'M29'], label: 'Advertising & Paid Media' },
    performance: { modules: ['M03', 'M13', 'M14'], label: 'Performance & UX' },
    security: { modules: ['M01'], label: 'Security' },
    compliance: { modules: ['M10', 'M11', 'M12'], label: 'Compliance' },
    seo: { modules: ['M04', 'M15', 'M16', 'M34', 'M35'], label: 'SEO & Content' },
    martech: { modules: ['M07', 'M20'], label: 'MarTech Stack' },
    mobile: { modules: ['M14', 'M32'], label: 'Mobile Experience' },
    social: { modules: ['M15', 'M22', 'M23'], label: 'Social & Sentiment' },
    competitors: { modules: ['M29', 'M26', 'M33'], label: 'Competitive Landscape' },
    costs: { modules: ['M27'], label: 'Cost & Budget' },
  };

  const topics: Record<string, { summary: string; tools_detected: string[]; findings: string[]; recommendations: string[]; source_modules: string[] }> = {};

  for (const [key, config] of Object.entries(topicModuleMap)) {
    const findings: string[] = [];
    const recommendations: string[] = [];
    const tools: string[] = [];

    for (const moduleId of config.modules) {
      const summary = moduleSummaries[moduleId];
      if (summary) {
        const kf = summary['key_findings'] as Array<Record<string, string>> | string[] | undefined;
        if (Array.isArray(kf)) {
          for (const f of kf.slice(0, 3)) {
            findings.push(typeof f === 'string' ? f : f['finding'] ?? JSON.stringify(f));
          }
        }
        const recs = summary['recommendations'] as Array<Record<string, string>> | string[] | undefined;
        if (Array.isArray(recs)) {
          for (const r of recs.slice(0, 2)) {
            recommendations.push(typeof r === 'string' ? r : r['action'] ?? JSON.stringify(r));
          }
        }
      }

      const result = ctx.previousResults.get(moduleId as ModuleId);
      if (result) {
        for (const s of result.signals.filter(s => s.confidence >= 0.6).slice(0, 5)) {
          if (!tools.includes(s.name)) tools.push(s.name);
        }
      }
    }

    topics[key] = {
      summary: config.label,
      tools_detected: tools,
      findings: [...new Set(findings)].slice(0, 10),
      recommendations: [...new Set(recommendations)].slice(0, 5),
      source_modules: config.modules,
    };
  }

  // Build tool entities
  const toolEntities: Record<string, { category: string; status: string; issues: string[]; source_modules: string[] }> = {};
  for (const [id, result] of ctx.previousResults) {
    for (const s of result.signals.filter(s => s.confidence >= 0.6)) {
      if (!toolEntities[s.name]) {
        toolEntities[s.name] = {
          category: s.category ?? 'other',
          status: 'active',
          issues: [],
          source_modules: [id],
        };
      } else if (!toolEntities[s.name]!.source_modules.includes(id)) {
        toolEntities[s.name]!.source_modules.push(id);
      }
    }
  }

  return {
    domain: ctx.url,
    scan_date: new Date().toISOString().split('T')[0],
    marketing_iq: (marketingIQ?.['final'] as number) ?? 0,
    topics,
    entities: { tools: toolEntities },
  };
}

registerModuleExecutor('M46' as ModuleId, execute);
