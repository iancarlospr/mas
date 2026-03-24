/**
 * Generate a combined markdown document from audit deck, boss deck, and PRD data.
 * Optimized for Google NotebookLM audio generation.
 */
import type {
  ScanWithResults,
  ModuleResult,
  ScoreCategory,
  M41ModuleSynthesis,
} from '@marketing-alpha/types';
import { getMarketingIQLabel } from '@marketing-alpha/types';
import { CATEGORY_META, CATEGORY_MODULES, MODULE_NAMES } from './transform';

// ── Helpers ──────────────────────────────────────────────────

type ResultMap = Map<string, ModuleResult>;

function field<T>(map: ResultMap, moduleId: string, ...path: string[]): T | undefined {
  const r = map.get(moduleId);
  if (!r) return undefined;
  let obj: unknown = r.data;
  for (const key of path) {
    if (obj == null || typeof obj !== 'object') return undefined;
    obj = (obj as Record<string, unknown>)[key];
  }
  return obj as T;
}

function fmtCurrency(n: number): string {
  return n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
    : `$${n.toLocaleString()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Section Builders ─────────────────────────────────────────

function buildHeader(scan: ScanWithResults): string {
  const score = scan.marketingIq ?? 0;
  const label = getMarketingIQLabel(score);
  const moduleCount = scan.moduleResults.filter(
    (r) => r.status === 'success' || r.status === 'partial',
  ).length;

  return [
    `# ${scan.domain} — Marketing Technology Audit`,
    '',
    `**Date:** ${fmtDate(scan.createdAt)}`,
    `**MarketingIQ Score:** ${score}/100 (${label})`,
    `**Modules Analyzed:** ${moduleCount}`,
    `**URL:** ${scan.url}`,
    '',
    '---',
    '',
  ].join('\n');
}

function buildExecutiveSummary(map: ResultMap): string {
  const brief = field<string>(map, 'M42', 'synthesis', 'executive_brief');
  if (!brief) return '';

  return [
    '## Executive Summary',
    '',
    brief,
    '',
  ].join('\n');
}

function buildVerdict(map: ResultMap): string {
  const verdict = field<string>(map, 'M42', 'synthesis', 'verdict_headline')
    ?? field<string>(map, 'M42', 'synthesis', 'synthesis_headline');
  if (!verdict) return '';

  return [
    `### Verdict`,
    '',
    `> ${verdict}`,
    '',
  ].join('\n');
}

function buildKeyFindings(map: ResultMap): string {
  const findings = field<Array<{
    finding: string;
    modules: string[];
    detail: string;
    business_impact: string;
    urgency: string;
  }>>(map, 'M42', 'synthesis', 'key_findings');
  if (!findings?.length) return '';

  const lines = ['## Key Findings', ''];
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i]!;
    lines.push(`### ${i + 1}. ${f.finding}`);
    lines.push('');
    lines.push(`- **Urgency:** ${f.urgency}`);
    if (f.modules?.length) {
      lines.push(`- **Affected Areas:** ${f.modules.map((m) => MODULE_NAMES[m] ?? m).join(', ')}`);
    }
    lines.push(`- **Detail:** ${f.detail}`);
    lines.push(`- **Business Impact:** ${f.business_impact}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildCompetitiveContext(map: ResultMap): string {
  const ctx = field<string>(map, 'M42', 'synthesis', 'competitive_context');
  if (!ctx) return '';

  return [
    '### Competitive Context',
    '',
    ctx,
    '',
  ].join('\n');
}

function buildCategoryBreakdown(scan: ScanWithResults, map: ResultMap): string {
  const categories = scan.marketingIqResult?.categories;
  if (!categories?.length) return '';

  const assessments = field<Record<string, {
    category_name: string;
    assessment: string;
    top_issues: string[];
    strengths: string[];
  }>>(map, 'M42', 'synthesis', 'category_assessments');

  const lines = [
    '## Category Scores',
    '',
    '| Category | Score | Rating |',
    '|----------|-------|--------|',
  ];

  for (const cat of categories) {
    const meta = CATEGORY_META[cat.category as ScoreCategory];
    const name = meta?.name ?? cat.category;
    const rating = cat.light === 'green' ? 'Good' : cat.light === 'yellow' ? 'Needs Work' : 'Critical';
    lines.push(`| ${name} | ${cat.score}/100 | ${rating} |`);
  }
  lines.push('');

  // Add M42 category assessments
  if (assessments) {
    for (const cat of categories) {
      const assessment = assessments[cat.category];
      if (!assessment) continue;
      const meta = CATEGORY_META[cat.category as ScoreCategory];
      lines.push(`### ${meta?.name ?? cat.category}`);
      lines.push('');
      lines.push(assessment.assessment);
      lines.push('');
      if (assessment.strengths?.length) {
        lines.push('**Strengths:**');
        for (const s of assessment.strengths) {
          lines.push(`- ${s}`);
        }
        lines.push('');
      }
      if (assessment.top_issues?.length) {
        lines.push('**Issues:**');
        for (const issue of assessment.top_issues) {
          lines.push(`- ${issue}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function buildModuleReports(scan: ScanWithResults, map: ResultMap): string {
  const summaries = field<Record<string, M41ModuleSynthesis>>(map, 'M41', 'moduleSummaries');
  if (!summaries) return '';

  const lines = ['## Module-by-Module Analysis', ''];

  const categoryOrder: ScoreCategory[] = [
    'security_compliance', 'analytics_measurement', 'performance_experience',
    'seo_content', 'paid_media', 'martech_infrastructure',
    'brand_presence', 'market_intelligence',
  ];

  // Build a score map from moduleResults
  const scoreMap = new Map<string, number | null>();
  for (const r of scan.moduleResults) {
    scoreMap.set(r.moduleId, r.score);
  }

  for (const catKey of categoryOrder) {
    const catMeta = CATEGORY_META[catKey];
    const moduleIds = CATEGORY_MODULES[catKey];
    if (!catMeta || !moduleIds) continue;

    // Check if any module in this category has a summary
    const hasData = moduleIds.some((id) => summaries[id] != null);
    if (!hasData) continue;

    lines.push(`### ${catMeta.name}`);
    lines.push('');

    for (const modId of moduleIds) {
      const summary = summaries[modId];
      if (!summary) continue;

      const modName = MODULE_NAMES[modId] ?? modId;
      const score = scoreMap.get(modId);
      const scoreStr = score != null ? `${score}/100` : 'N/A';

      lines.push(`#### ${modName} (Score: ${scoreStr})`);
      lines.push('');

      // Executive summary or analysis
      const text = summary.executive_summary || summary.analysis;
      if (text) {
        lines.push(text);
        lines.push('');
      }

      // Key findings
      if (summary.key_findings?.length) {
        lines.push('**Key Findings:**');
        for (const f of summary.key_findings) {
          const sev = f.severity.toUpperCase();
          lines.push(`- **[${sev}]** ${f.finding} — ${f.evidence}. ${f.business_impact}`);
        }
        lines.push('');
      }

      // Recommendations
      if (summary.recommendations?.length) {
        lines.push('**Recommendations:**');
        for (const r of summary.recommendations) {
          lines.push(`- **[${r.priority}] [${r.effort}]** ${r.action} — ${r.expected_impact}`);
        }
        lines.push('');
      }

      // Score breakdown as table
      if (summary.score_breakdown?.length) {
        lines.push('**Score Breakdown:**');
        lines.push('');
        lines.push('| Criterion | Score | Weight |');
        lines.push('|-----------|-------|--------|');
        for (const entry of summary.score_breakdown) {
          lines.push(`| ${entry.criterion} | ${entry.score} | ${entry.weight} |`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function buildRemediationPlan(map: ResultMap): string {
  const markdown = field<string>(map, 'M43', 'markdown');
  if (!markdown) return '';

  return [
    '## Remediation Plan',
    '',
    '> The following remediation plan is generated as a comprehensive action document.',
    '',
    markdown,
    '',
  ].join('\n');
}

function buildStackAnalysis(map: ResultMap): string {
  const stack = field<{
    currentStack: {
      totalTools: number;
      activeTools: number;
      abandonedTools: number;
      redundantPairs: number;
      categories: Array<{ name: string; tools: string[] }>;
      assessment: string;
    };
    abandonedTools: Array<{ tool: string; evidence: string; recommendation: string }>;
    redundancies: Array<{ tools: string[]; function: string; recommendation: string; effortToConsolidate: string }>;
    leanStack: { description: string; removals: Array<{ tool: string; reason: string }>; keyBenefit: string };
    optimalStack: {
      description: string;
      gaps: Array<{ capability: string; recommendation: string }>;
      upgrades: Array<{ currentTool: string; suggestedTool: string; rationale: string }>;
      keyBenefit: string;
    };
    methodology: string;
  }>(map, 'M45', 'stackAnalysis');
  if (!stack) return '';

  const lines = ['## Stack Analysis', ''];

  // Assessment
  lines.push(`### Current Stack`);
  lines.push('');
  lines.push(stack.currentStack.assessment);
  lines.push('');
  lines.push(
    `**${stack.currentStack.totalTools} tools detected** ` +
    `(${stack.currentStack.activeTools} active, ` +
    `${stack.currentStack.abandonedTools} abandoned, ` +
    `${stack.currentStack.redundantPairs} redundant pairs)`,
  );
  lines.push('');

  // Categories table
  if (stack.currentStack.categories?.length) {
    lines.push('| Category | Tools |');
    lines.push('|----------|-------|');
    for (const cat of stack.currentStack.categories) {
      lines.push(`| ${cat.name} | ${cat.tools.join(', ')} |`);
    }
    lines.push('');
  }

  // Abandoned tools
  if (stack.abandonedTools?.length) {
    lines.push('### Abandoned Tools');
    lines.push('');
    for (const t of stack.abandonedTools) {
      lines.push(`- **${t.tool}**: ${t.evidence}. ${t.recommendation}`);
    }
    lines.push('');
  }

  // Redundancies
  if (stack.redundancies?.length) {
    lines.push('### Redundancies');
    lines.push('');
    for (const r of stack.redundancies) {
      lines.push(`- **${r.tools.join(' & ')}** overlap on ${r.function}. ${r.recommendation} (${r.effortToConsolidate} effort)`);
    }
    lines.push('');
  }

  // Lean stack
  if (stack.leanStack) {
    lines.push('### Lean Stack Recommendation');
    lines.push('');
    lines.push(stack.leanStack.description);
    lines.push('');
    if (stack.leanStack.removals?.length) {
      lines.push('**Removals:**');
      for (const r of stack.leanStack.removals) {
        lines.push(`- ${r.tool}: ${r.reason}`);
      }
      lines.push('');
    }
    lines.push(`**Key Benefit:** ${stack.leanStack.keyBenefit}`);
    lines.push('');
  }

  // Optimal stack
  if (stack.optimalStack) {
    lines.push('### Optimal Stack Recommendation');
    lines.push('');
    lines.push(stack.optimalStack.description);
    lines.push('');
    if (stack.optimalStack.gaps?.length) {
      lines.push('**Capability Gaps:**');
      for (const g of stack.optimalStack.gaps) {
        lines.push(`- ${g.capability}: ${g.recommendation}`);
      }
      lines.push('');
    }
    if (stack.optimalStack.upgrades?.length) {
      lines.push('**Suggested Upgrades:**');
      for (const u of stack.optimalStack.upgrades) {
        lines.push(`- ${u.currentTool} → ${u.suggestedTool}: ${u.rationale}`);
      }
      lines.push('');
    }
    lines.push(`**Key Benefit:** ${stack.optimalStack.keyBenefit}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildFooter(scan: ScanWithResults): string {
  return [
    '---',
    '',
    `*Generated by AlphaScan on ${fmtDate(scan.createdAt)}. Scan ID: ${scan.id}.*`,
    '',
  ].join('\n');
}

// ── Public API ───────────────────────────────────────────────

export function generateAuditMarkdown(scan: ScanWithResults): string {
  const map: ResultMap = new Map();
  for (const r of scan.moduleResults) {
    map.set(r.moduleId, r);
  }

  const sections = [
    buildHeader(scan),
    buildExecutiveSummary(map),
    buildVerdict(map),
    buildCompetitiveContext(map),
    buildKeyFindings(map),
    buildCategoryBreakdown(scan, map),
    buildModuleReports(scan, map),
    buildRemediationPlan(map),
    buildStackAnalysis(map),
    buildFooter(scan),
  ];

  return sections.filter(Boolean).join('\n');
}
