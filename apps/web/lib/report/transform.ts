/**
 * Transform raw Supabase scan + module_results into the ReportData contract.
 * PRD-cont-4 Section 9.5
 */
import type {
  ModuleResult,
  CategoryScore,
  MarketingIQResult,
  ScoreCategory,
  CATEGORY_WEIGHTS,
  ReportData,
  ReportCategoryScore,
  Finding,
  Opportunity,
  TechStackData,
  CategoryDeepDiveData,
  ROIData,
  RoadmapData,
  TrafficLight,
  Severity,
  Priority,
  Effort,
  Confidence,
  ReportModuleStatus,
} from '@marketing-alpha/types';
import { getMarketingIQLabel, getTrafficLight } from '@marketing-alpha/types';

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

function str(map: ResultMap, moduleId: string, ...path: string[]): string {
  return (field<string>(map, moduleId, ...path) ?? '');
}

function num(map: ResultMap, moduleId: string, ...path: string[]): number {
  const v = field<number>(map, moduleId, ...path);
  return typeof v === 'number' ? v : 0;
}

function arr<T>(map: ResultMap, moduleId: string, ...path: string[]): T[] {
  const v = field<T[]>(map, moduleId, ...path);
  return Array.isArray(v) ? v : [];
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  return 0;
}

// ── Category metadata ────────────────────────────────────────

const CATEGORY_META: Record<ScoreCategory, { name: string; shortName: string; description: string }> = {
  analytics_integrity: {
    name: 'Analytics & Data Integrity',
    shortName: 'Anly',
    description: 'How well analytics tools are configured, tracking accuracy, and data governance.',
  },
  paid_media_attribution: {
    name: 'Paid Media & Attribution',
    shortName: 'Paid',
    description: 'Paid advertising infrastructure, pixel implementation, and attribution setup.',
  },
  performance_ux: {
    name: 'Performance & UX',
    shortName: 'Perf',
    description: 'Page speed, Core Web Vitals, mobile experience, and resource efficiency.',
  },
  compliance_security: {
    name: 'Compliance & Security',
    shortName: 'Comp',
    description: 'Legal compliance, security headers, consent management, and accessibility.',
  },
  martech_efficiency: {
    name: 'MarTech Efficiency',
    shortName: 'MTch',
    description: 'Marketing technology stack health, tool utilization, and integration quality.',
  },
  seo_content: {
    name: 'SEO & Content',
    shortName: 'SEO',
    description: 'Search engine optimization, content structure, and social sharing readiness.',
  },
  market_position: {
    name: 'Market Position',
    shortName: 'Mkt',
    description: 'Traffic metrics, competitive landscape, brand search demand, and authority.',
  },
  digital_presence: {
    name: 'Digital Presence',
    shortName: 'Dgtl',
    description: 'Corporate pages, support infrastructure, and investor relations.',
  },
};

const CATEGORY_MODULES: Record<ScoreCategory, string[]> = {
  analytics_integrity: ['M05', 'M08', 'M09'],
  paid_media_attribution: ['M06', 'M06b', 'M21', 'M28', 'M29'],
  performance_ux: ['M03', 'M13', 'M14'],
  compliance_security: ['M01', 'M10', 'M11', 'M12'],
  martech_efficiency: ['M07', 'M20'],
  seo_content: ['M04', 'M15', 'M16', 'M34', 'M35'],
  market_position: ['M24', 'M25', 'M26', 'M27', 'M30', 'M31', 'M32', 'M33', 'M36'],
  digital_presence: ['M02', 'M17', 'M18', 'M19', 'M22', 'M23', 'M37', 'M38', 'M39'],
};

const MODULE_NAMES: Record<string, string> = {
  M01: 'DNS & Security', M02: 'CMS & Infrastructure', M03: 'Performance',
  M04: 'Page Metadata', M05: 'Analytics Architecture', M06: 'Paid Media Pixels',
  M06b: 'PPC Landing Audit', M07: 'MarTech Stack', M08: 'Tag Governance',
  M09: 'Behavioral Intelligence', M10: 'Accessibility', M11: 'Console Errors',
  M12: 'Compliance & Privacy', M13: 'Performance & Carbon', M14: 'Mobile & Responsive',
  M15: 'Social & Sharing', M16: 'PR & Media', M17: 'Careers & HR',
  M18: 'Investor Relations', M19: 'Support', M20: 'Ecommerce/SaaS',
  M21: 'Ad Library', M22: 'News Sentiment', M23: 'Social Sentiment',
  M24: 'Market Intelligence', M25: 'Monthly Visits', M26: 'Traffic by Country',
  M27: 'Rankings', M28: 'Paid Traffic Cost', M29: 'Top Paid Keywords',
  M30: 'Competitor Overlap', M31: 'Traffic Sources', M32: 'Domain Trust',
  M33: 'Mobile vs Desktop', M34: 'Brand Demand', M35: 'Losing Keywords',
  M36: 'Bounce Rate', M37: 'Google Shopping', M38: 'Review Velocity',
  M39: 'Local Pack', M41: 'Deep Dive Analysis', M42: 'Executive Synthesis',
  M43: 'Remediation PRD', M44: 'ROI Analysis', M45: 'Cost Cutter', M46: 'MarketingIQ',
};

const CATEGORY_WEIGHTS_MAP: Record<ScoreCategory, number> = {
  analytics_integrity: 0.20,
  paid_media_attribution: 0.18,
  performance_ux: 0.15,
  compliance_security: 0.15,
  martech_efficiency: 0.12,
  seo_content: 0.10,
  market_position: 0.06,
  digital_presence: 0.04,
};

const CATEGORY_KEY_MAP: Record<ScoreCategory, keyof ReportData['categories']> = {
  analytics_integrity: 'analytics',
  paid_media_attribution: 'paidMedia',
  performance_ux: 'performance',
  compliance_security: 'compliance',
  martech_efficiency: 'martech',
  seo_content: 'seo',
  market_position: 'marketPosition',
  digital_presence: 'digitalPresence',
};

// ── Build Functions ──────────────────────────────────────────

function buildCategoryScores(
  categories: CategoryScore[],
): ReportCategoryScore[] {
  const allKeys: ScoreCategory[] = [
    'analytics_integrity', 'paid_media_attribution', 'performance_ux',
    'compliance_security', 'martech_efficiency', 'seo_content',
    'market_position', 'digital_presence',
  ];

  const catMap = new Map(categories.map(c => [c.category, c]));

  return allKeys.map(key => {
    const cat = catMap.get(key);
    const score = cat ? Math.round(cat.score) : 0;
    const meta = CATEGORY_META[key];
    return {
      name: meta.name,
      shortName: meta.shortName,
      score,
      light: getTrafficLight(score),
      weight: CATEGORY_WEIGHTS_MAP[key],
    };
  });
}

function buildTechStackData(resultMap: ResultMap): TechStackData {
  const tools: TechStackData['tools'] = [];

  // M02 CMS detection
  const cms = str(resultMap, 'M02', 'cms');
  if (cms) tools.push({ name: cms, category: 'CMS & Hosting', status: 'active', confidence: 0.9, sourceModules: ['M02'] });

  // M05 analytics tools
  const ga4 = field<Record<string, unknown>>(resultMap, 'M05', 'ga4');
  if (ga4) tools.push({ name: 'Google Analytics 4', category: 'Analytics', status: 'active', confidence: 0.95, sourceModules: ['M05'] });

  // M08 tag manager
  const gtm = field<Record<string, unknown>>(resultMap, 'M08', 'gtm');
  if (gtm) tools.push({ name: 'Google Tag Manager', category: 'Tag Management', status: 'active', confidence: 1, sourceModules: ['M08'] });

  // M06 pixels
  const metaPixel = field<Record<string, unknown>>(resultMap, 'M06', 'meta');
  if (metaPixel) tools.push({ name: 'Meta Pixel', category: 'Advertising', status: 'active', confidence: 0.95, sourceModules: ['M06'] });

  const gads = field<Record<string, unknown>>(resultMap, 'M06', 'googleAds');
  if (gads) tools.push({ name: 'Google Ads', category: 'Advertising', status: 'active', confidence: 0.95, sourceModules: ['M06'] });

  // M07 martech tools
  const martechTools = arr<Record<string, unknown>>(resultMap, 'M07', 'tools');
  for (const t of martechTools) {
    tools.push({
      name: (t['name'] as string) ?? 'Unknown',
      category: (t['category'] as string) ?? 'MarTech',
      status: ((t['status'] as string) ?? 'active') as TechStackData['tools'][number]['status'],
      confidence: (t['confidence'] as number) ?? 0.7,
      sourceModules: ['M07'],
    });
  }

  const active = tools.filter(t => t.status === 'active').length;
  const inactive = tools.filter(t => t.status !== 'active').length;

  // M45 redundancy data
  const costAnalysis = field<Record<string, unknown>>(resultMap, 'M45', 'costAnalysis');
  const redundancies = (costAnalysis?.['redundancies'] as unknown[]) ?? [];

  return {
    tools,
    stackHealth: {
      total: tools.length,
      active,
      inactive,
      redundantPairs: redundancies.length,
    },
  };
}

function buildCategoryData(
  cat: ScoreCategory,
  categories: CategoryScore[],
  resultMap: ResultMap,
): CategoryDeepDiveData {
  const meta = CATEGORY_META[cat];
  const catScore = categories.find(c => c.category === cat);
  const score = catScore ? Math.round(catScore.score) : 0;
  const moduleIds = CATEGORY_MODULES[cat];

  const moduleScores = moduleIds.map(id => {
    const r = resultMap.get(id);
    return {
      moduleId: id,
      moduleName: MODULE_NAMES[id] ?? id,
      score: r?.score ?? 0,
      status: (r?.status ?? 'skipped') as ReportModuleStatus,
    };
  });

  // Extract findings from M41 deep dive for this category
  const m41 = resultMap.get('M41');
  const m41Data = m41?.data as Record<string, unknown> | undefined;
  const categoryFindings: CategoryDeepDiveData['findings'] = [];
  const categoryRecs: CategoryDeepDiveData['recommendations'] = [];

  // Look in M41 per-module analysis
  for (const modId of moduleIds) {
    const modAnalysis = m41Data?.[modId] as Record<string, unknown> | undefined;
    if (!modAnalysis) continue;

    const findings = (modAnalysis['findings'] as Array<Record<string, unknown>>) ?? [];
    for (const f of findings) {
      categoryFindings.push({
        finding: (f['finding'] as string) ?? '',
        severity: ((f['severity'] as string) ?? 'info') as Severity,
        evidence: (f['evidence'] as string) ?? '',
        businessImpact: (f['business_impact'] as string) ?? '',
        sourceModules: [modId],
      });
    }

    const recs = (modAnalysis['recommendations'] as Array<Record<string, unknown>>) ?? [];
    for (const r of recs) {
      categoryRecs.push({
        action: (r['action'] as string) ?? '',
        priority: ((r['priority'] as string) ?? 'P2') as Priority,
        effort: ((r['effort'] as string) ?? 'M') as Effort,
        expectedImpact: (r['expected_impact'] as string) ?? '',
      });
    }
  }

  return {
    category: {
      name: meta.name,
      shortName: meta.shortName,
      weight: CATEGORY_WEIGHTS_MAP[cat],
      score,
      light: getTrafficLight(score),
      description: meta.description,
    },
    moduleScores,
    findings: categoryFindings,
    recommendations: categoryRecs,
    visualizationData: {},
  };
}

function buildROIData(resultMap: ResultMap): ROIData {
  const roi = field<Record<string, unknown>>(resultMap, 'M44', 'roi');
  const summary = (roi?.['summary'] as Record<string, unknown>) ?? {};

  const impactAreas: ROIData['impactAreas'] = [];

  const trackingGap = roi?.['tracking_gap_cost'] as Record<string, unknown> | undefined;
  if (trackingGap) {
    impactAreas.push({
      id: 'tracking',
      title: 'Tracking Gaps',
      icon: 'BarChart3',
      low: parseAmount(trackingGap['monthly_untracked_revenue']) * 0.5,
      high: parseAmount(trackingGap['monthly_untracked_revenue']),
      confidence: 'medium',
      calculationSteps: (trackingGap['calculation_steps'] as string[]) ?? [],
      assumptions: (trackingGap['assumptions'] as string[]) ?? [],
      sourceModules: ['M05', 'M08'],
    });
  }

  const attributionWaste = roi?.['attribution_waste'] as Record<string, unknown> | undefined;
  if (attributionWaste) {
    impactAreas.push({
      id: 'attribution',
      title: 'Attribution Waste',
      icon: 'Target',
      low: parseAmount(attributionWaste['wasted_monthly_spend']) * 0.7,
      high: parseAmount(attributionWaste['wasted_monthly_spend']),
      confidence: 'high',
      calculationSteps: (attributionWaste['calculation_steps'] as string[]) ?? [],
      assumptions: (attributionWaste['assumptions'] as string[]) ?? [],
      sourceModules: ['M06', 'M28'],
    });
  }

  const perfImpact = roi?.['performance_impact'] as Record<string, unknown> | undefined;
  if (perfImpact) {
    impactAreas.push({
      id: 'performance',
      title: 'Performance Impact',
      icon: 'Zap',
      low: parseAmount(perfImpact['estimated_monthly_revenue_loss']) * 0.5,
      high: parseAmount(perfImpact['estimated_monthly_revenue_loss']),
      confidence: 'medium',
      calculationSteps: (perfImpact['calculation_steps'] as string[]) ?? [],
      assumptions: (perfImpact['assumptions'] as string[]) ?? [],
      sourceModules: ['M03', 'M13'],
    });
  }

  const complianceRisk = roi?.['compliance_risk'] as Record<string, unknown> | undefined;
  if (complianceRisk) {
    impactAreas.push({
      id: 'compliance',
      title: 'Compliance Risk',
      icon: 'Shield',
      low: 0,
      high: 0,
      confidence: 'low',
      calculationSteps: [],
      assumptions: [],
      sourceModules: ['M01', 'M12'],
    });
  }

  const toolRedundancy = roi?.['tool_redundancy_waste'] as Record<string, unknown> | undefined;
  if (toolRedundancy) {
    impactAreas.push({
      id: 'redundancy',
      title: 'Tool Redundancy',
      icon: 'Layers',
      low: parseAmount(toolRedundancy['monthly_waste']) * 0.5,
      high: parseAmount(toolRedundancy['monthly_waste']),
      confidence: 'medium',
      calculationSteps: (toolRedundancy['calculation_steps'] as string[]) ?? [],
      assumptions: (toolRedundancy['assumptions'] as string[]) ?? [],
      sourceModules: ['M07', 'M45'],
    });
  }

  const totalLow = impactAreas.reduce((s, a) => s + a.low, 0);
  const totalHigh = impactAreas.reduce((s, a) => s + a.high, 0);

  const currentScore = num(resultMap, 'M44', 'roi', 'score_improvement', 'current');
  const estimatedScore = num(resultMap, 'M44', 'roi', 'score_improvement', 'estimated');

  return {
    totalOpportunity: { low: Math.round(totalLow), high: Math.round(totalHigh) },
    impactAreas,
    complianceRisk: complianceRisk ? {
      annualRange: (complianceRisk['estimated_exposure'] as string) ?? '',
      riskFactors: (complianceRisk['risk_factors'] as string[]) ?? [],
      regulations: (complianceRisk['regulations'] as string[]) ?? [],
    } : undefined,
    scoreImprovement: {
      current: currentScore,
      estimated: estimatedScore || currentScore + 15,
      label: 'If you fix all P0 issues',
    },
  };
}

function buildRoadmapData(resultMap: ResultMap): RoadmapData {
  const prd = field<Record<string, unknown>>(resultMap, 'M43', 'prd');
  const workstreams = (prd?.['workstreams'] as Array<Record<string, unknown>>) ?? [];
  const timeline = (prd?.['implementation_timeline'] as Record<string, unknown>) ?? {};

  const mappedWorkstreams: RoadmapData['workstreams'] = workstreams.map(ws => ({
    id: (ws['id'] as string) ?? '',
    name: (ws['name'] as string) ?? '',
    ownerRole: (ws['owner_role'] as string) ?? (ws['owner'] as string) ?? '',
    priority: ((ws['priority'] as string) ?? 'P2') as Priority,
    totalEffort: (ws['total_effort'] as string) ?? '',
    businessImpact: (ws['objective'] as string) ?? (ws['business_impact'] as string) ?? '',
    tasks: ((ws['tasks'] as Array<Record<string, unknown>>) ?? []).map(t => ({
      id: (t['id'] as string) ?? '',
      task: (t['action'] as string) ?? (t['task'] as string) ?? '',
      effort: ((t['effort'] as string) ?? 'M') as Effort,
      dependencies: (t['dependencies'] as string[]) ?? [],
      successCriteria: (t['success_criteria'] as string) ?? '',
    })),
  }));

  // Derive quick wins: small effort + high priority tasks
  const quickWins: RoadmapData['quickWins'] = [];
  for (const ws of mappedWorkstreams) {
    for (const t of ws.tasks) {
      if (t.effort === 'S' && (ws.priority === 'P0' || ws.priority === 'P1')) {
        quickWins.push({ task: t.task, workstream: ws.name, impact: ws.businessImpact });
      }
    }
  }

  return {
    workstreams: mappedWorkstreams,
    timeline: {
      week1: (timeline['week_1'] as string[]) ?? [],
      week2: (timeline['week_2'] as string[]) ?? [],
      weeks3_4: (timeline['weeks_3_4'] as string[]) ?? [],
      month2: (timeline['month_2'] as string[]) ?? [],
      month3plus: (timeline['month_3_plus'] as string[]) ?? [],
    },
    quickWins: quickWins.slice(0, 5),
  };
}

// ── Main Transform ───────────────────────────────────────────

export interface ScanRecord {
  id: string;
  domain: string;
  created_at: string;
  marketing_iq: number | null;
  marketing_iq_result: unknown;
  user_email?: string;
}

export interface ModuleResultRecord {
  module_id: string;
  status: string;
  data: unknown;
  signals: unknown;
  checkpoints: unknown;
  score: number | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

export function transformToReportData(
  scan: ScanRecord,
  rawModuleResults: ModuleResultRecord[],
  userEmail: string,
): ReportData {
  const moduleResults: ModuleResult[] = rawModuleResults.map(r => ({
    moduleId: r.module_id as ModuleResult['moduleId'],
    status: r.status as ModuleResult['status'],
    data: (r.data as Record<string, unknown>) ?? {},
    signals: (r.signals as ModuleResult['signals']) ?? [],
    checkpoints: (r.checkpoints as ModuleResult['checkpoints']) ?? [],
    score: r.score,
    duration: r.duration_ms ?? 0,
    error: r.error ?? undefined,
  }));

  const resultMap: ResultMap = new Map(moduleResults.map(r => [r.moduleId, r]));
  const iqResult = scan.marketing_iq_result as MarketingIQResult | null;
  const categories = iqResult?.categories ?? [];
  const score = scan.marketing_iq ?? 0;

  // M42 synthesis data
  const m42Data = resultMap.get('M42')?.data as Record<string, unknown> | undefined;
  const synthesis = m42Data?.['synthesis'] as Record<string, unknown> | undefined;

  const executiveBrief = (synthesis?.['executive_brief'] as string) ?? '';
  const rawFindings = (synthesis?.['critical_findings'] as Array<Record<string, unknown>>) ?? [];
  const rawOpps = (synthesis?.['top_opportunities'] as Array<Record<string, unknown>>) ?? [];

  const criticalFindings: Finding[] = rawFindings.map(f => ({
    finding: (f['finding'] as string) ?? '',
    severity: ((f['severity'] as string) ?? 'critical') as Severity,
    impact: (f['business_impact'] as string) ?? '',
    modules: [(f['source_module'] as string) ?? ''].filter(Boolean),
  }));

  const topOpportunities: Opportunity[] = rawOpps.map(o => ({
    opportunity: (o['opportunity'] as string) ?? '',
    impact: (o['estimated_impact'] as string) ?? '',
    effort: ((o['effort'] as string) ?? 'M') as Effort,
    modules: [(o['source_module'] as string) ?? ''].filter(Boolean),
  }));

  // Build all 8 categories
  const allCatKeys: ScoreCategory[] = [
    'analytics_integrity', 'paid_media_attribution', 'performance_ux',
    'compliance_security', 'martech_efficiency', 'seo_content',
    'market_position', 'digital_presence',
  ];

  const catEntries = Object.fromEntries(
    allCatKeys.map(key => [CATEGORY_KEY_MAP[key], buildCategoryData(key, categories, resultMap)])
  ) as ReportData['categories'];

  // Key metrics
  const monthlyVisits = num(resultMap, 'M25', 'monthly_visits') || undefined;
  const bounceRate = num(resultMap, 'M36', 'bounce_rate') || undefined;
  const domainRank = num(resultMap, 'M32', 'domain_rank') || undefined;

  const techStack = buildTechStackData(resultMap);
  const complianceScore = catEntries.compliance.category.score;

  return {
    domain: scan.domain,
    scanDate: scan.created_at,
    scanId: scan.id,
    userEmail,

    marketingIQ: score,
    marketingIQLabel: getMarketingIQLabel(score),
    categoryScores: buildCategoryScores(categories),

    executiveBrief,
    criticalFindings,
    topOpportunities,

    techStack,
    categories: catEntries,
    roi: buildROIData(resultMap),
    roadmap: buildRoadmapData(resultMap),

    keyMetrics: {
      monthlyVisits,
      bounceRate,
      techStackCount: techStack.stackHealth.total,
      complianceScore,
      domainRank,
    },

    methodology: {
      categoryWeights: allCatKeys.map(key => ({
        name: CATEGORY_META[key].name,
        weight: CATEGORY_WEIGHTS_MAP[key],
      })),
      penaltiesApplied: iqResult?.penalties ?? [],
      bonusesApplied: iqResult?.bonuses ?? [],
    },

    sources: rawModuleResults
      .filter(r => r.status === 'success' || r.status === 'partial')
      .map(r => ({
        moduleId: r.module_id,
        moduleName: MODULE_NAMES[r.module_id] ?? r.module_id,
        timestamp: r.created_at,
      })),
  };
}
