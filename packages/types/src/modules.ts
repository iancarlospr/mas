export type ModuleId =
  | 'M01' | 'M02' | 'M03' | 'M04'
  | 'M05' | 'M06' | 'M06b' | 'M07' | 'M08'
  | 'M09' | 'M10' | 'M11' | 'M12'
  | 'M13' | 'M14' | 'M15' | 'M16' | 'M17' | 'M18' | 'M19' | 'M20'
  | 'M21' | 'M22' | 'M23'
  | 'M24' | 'M25' | 'M26' | 'M27' | 'M28' | 'M29' | 'M30'
  | 'M31' | 'M32' | 'M33' | 'M34' | 'M35'
  | 'M36' | 'M37' | 'M38' | 'M39' | 'M40'
  | 'M41' | 'M42' | 'M43' | 'M44' | 'M45';

export type ModulePhase = 'passive' | 'browser' | 'ghostscan' | 'external' | 'paid-media' | 'synthesis';

export type ModuleTier = 'full' | 'paid';

export type ModuleStatus = 'pending' | 'running' | 'success' | 'partial' | 'error' | 'skipped';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  phase: ModulePhase;
  minimumTier: ModuleTier;
  dependsOn?: ModuleId[];
  timeout: number;
  retries: number;
  category: ScoreCategory;
}

export type ScoreCategory =
  | 'security_compliance'
  | 'analytics_measurement'
  | 'performance_experience'
  | 'seo_content'
  | 'paid_media'
  | 'martech_infrastructure'
  | 'brand_presence'
  | 'market_intelligence';

export interface ModuleResult {
  moduleId: ModuleId;
  status: ModuleStatus;
  data: Record<string, unknown>;
  signals: Signal[];
  score: number | null;
  checkpoints: Checkpoint[];
  duration: number;
  error?: string;
}

export interface Signal {
  type: string;
  name: string;
  confidence: number;
  evidence: string;
  category: string;
}

export type CheckpointHealth = 'excellent' | 'good' | 'warning' | 'critical' | 'info';

export interface Checkpoint {
  id: string;
  name: string;
  weight: number;
  health: CheckpointHealth;
  evidence: string;
  recommendation?: string;
}

export const CATEGORY_DISPLAY_NAMES: Record<ScoreCategory, string> = {
  security_compliance: 'Security & Compliance',
  analytics_measurement: 'Analytics & Measurement',
  performance_experience: 'Performance & Experience',
  seo_content: 'SEO & Content',
  paid_media: 'Paid Media',
  martech_infrastructure: 'MarTech & Infrastructure',
  brand_presence: 'Brand & Digital Presence',
  market_intelligence: 'Market Intelligence',
};

/** Maps each category to the module IDs it contains */
export const CATEGORY_MODULES: Record<ScoreCategory, ModuleId[]> = {
  security_compliance: ['M01', 'M12', 'M40'],
  analytics_measurement: ['M05', 'M06', 'M06b', 'M08', 'M09'],
  performance_experience: ['M03', 'M10', 'M11', 'M13', 'M14'],
  seo_content: ['M04', 'M15', 'M26', 'M34', 'M39'],
  paid_media: ['M21', 'M28', 'M29'],
  martech_infrastructure: ['M02', 'M07', 'M20'],
  brand_presence: ['M16', 'M17', 'M18', 'M19', 'M22', 'M23', 'M37', 'M38'],
  market_intelligence: ['M24', 'M25', 'M27', 'M30', 'M31', 'M32', 'M33', 'M35', 'M36'],
};

export interface CategoryScore {
  category: ScoreCategory;
  score: number;
  light: 'green' | 'yellow' | 'red';
  moduleScores: { moduleId: ModuleId; score: number | null }[];
}

export interface MarketingIQResult {
  raw: number;
  penalties: { name: string; points: number; reason: string }[];
  bonuses: { name: string; points: number; reason: string }[];
  final: number;
  label: string;
  categories: CategoryScore[];
}

export interface AISynthesis {
  executiveSummary: string;
  keyFindings: {
    finding: string;
    severity: 'critical' | 'warning' | 'info' | 'positive';
    evidence: string;
    businessImpact: string;
  }[];
  recommendations: {
    action: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    effort: 'S' | 'M' | 'L' | 'XL';
    expectedImpact: string;
  }[];
  scoreRationale: string;
}
