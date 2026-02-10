/**
 * P2 Alpha Brief Report types — PRD-cont-4 Appendix A.
 */

// ============================================================
// Core Types
// ============================================================

export type TrafficLight = 'green' | 'yellow' | 'red';
export type Severity = 'critical' | 'warning' | 'info' | 'positive';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type Effort = 'S' | 'M' | 'L' | 'XL';
export type Confidence = 'high' | 'medium' | 'low';
export type ToolStatus = 'active' | 'inactive' | 'abandoned';
export type ReportModuleStatus = 'success' | 'partial' | 'error' | 'skipped';

// ============================================================
// Sub-Types
// ============================================================

export interface ReportCategoryScore {
  name: string;
  shortName: string;
  score: number;
  light: TrafficLight;
  weight: number;
}

export interface Finding {
  finding: string;
  severity: Severity;
  impact: string;
  evidence?: string;
  businessImpact?: string;
  modules: string[];
}

export interface Opportunity {
  opportunity: string;
  impact: string;
  effort: Effort;
  modules: string[];
}

export interface TechStackData {
  tools: Array<{
    name: string;
    category: string;
    status: ToolStatus;
    confidence: number;
    sourceModules: string[];
    icon?: string;
  }>;
  stackHealth: {
    total: number;
    active: number;
    inactive: number;
    redundantPairs: number;
  };
  industryComparison?: {
    industry: string;
    averageToolCount: number;
  };
}

export interface CategoryDeepDiveData {
  category: {
    name: string;
    shortName: string;
    weight: number;
    score: number;
    light: TrafficLight;
    description: string;
  };
  moduleScores: Array<{
    moduleId: string;
    moduleName: string;
    score: number;
    status: ReportModuleStatus;
  }>;
  findings: Array<{
    finding: string;
    severity: Severity;
    evidence: string;
    businessImpact: string;
    sourceModules: string[];
  }>;
  recommendations: Array<{
    action: string;
    priority: Priority;
    effort: Effort;
    expectedImpact: string;
  }>;
  visualizationData: Record<string, unknown>;
}

export interface ROIData {
  totalOpportunity: { low: number; high: number };
  impactAreas: Array<{
    id: string;
    title: string;
    icon: string;
    low: number;
    high: number;
    confidence: Confidence;
    calculationSteps: string[];
    assumptions: string[];
    sourceModules: string[];
  }>;
  complianceRisk?: {
    annualRange: string;
    riskFactors: string[];
    regulations: string[];
  };
  scoreImprovement: {
    current: number;
    estimated: number;
    label: string;
  };
}

export interface RoadmapData {
  workstreams: Array<{
    id: string;
    name: string;
    ownerRole: string;
    priority: Priority;
    totalEffort: string;
    businessImpact: string;
    tasks: Array<{
      id: string;
      task: string;
      effort: Effort;
      dependencies: string[];
      successCriteria: string;
    }>;
  }>;
  timeline: {
    week1: string[];
    week2: string[];
    weeks3_4: string[];
    month2: string[];
    month3plus: string[];
  };
  quickWins: Array<{
    task: string;
    workstream: string;
    impact: string;
  }>;
}

// ============================================================
// Main Interface
// ============================================================

export interface ReportData {
  // Metadata
  domain: string;
  scanDate: string;
  scanId: string;
  userEmail: string;

  // Scores
  marketingIQ: number;
  marketingIQLabel: string;
  categoryScores: ReportCategoryScore[];

  // Executive Summary (M42)
  executiveBrief: string;
  criticalFindings: Finding[];
  topOpportunities: Opportunity[];

  // Tech Stack (M02, M05-M09, M20)
  techStack: TechStackData;

  // Category Deep Dives
  categories: {
    analytics: CategoryDeepDiveData;
    paidMedia: CategoryDeepDiveData;
    performance: CategoryDeepDiveData;
    compliance: CategoryDeepDiveData;
    martech: CategoryDeepDiveData;
    seo: CategoryDeepDiveData;
    marketPosition: CategoryDeepDiveData;
    digitalPresence: CategoryDeepDiveData;
  };

  // ROI (M44, M45)
  roi: ROIData;

  // Roadmap (M43)
  roadmap: RoadmapData;

  // Key Metrics
  keyMetrics: {
    monthlyVisits?: number;
    bounceRate?: number;
    techStackCount: number;
    complianceScore: number;
    organicTrafficShare?: number;
    domainRank?: number;
  };

  // Methodology
  methodology: {
    categoryWeights: Array<{ name: string; weight: number }>;
    penaltiesApplied: Array<{ name: string; points: number; reason: string }>;
    bonusesApplied: Array<{ name: string; points: number; reason: string }>;
  };

  // Sources
  sources: Array<{
    moduleId: string;
    moduleName: string;
    dataProvider?: string;
    timestamp: string;
  }>;
}
