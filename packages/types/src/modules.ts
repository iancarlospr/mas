export type ModuleId =
  | 'M01' | 'M02' | 'M03' | 'M04'
  | 'M05' | 'M06' | 'M06b' | 'M07' | 'M08'
  | 'M09' | 'M10' | 'M11' | 'M12'
  | 'M13' | 'M14' | 'M15' | 'M16' | 'M17' | 'M18' | 'M19' | 'M20'
  | 'M21' | 'M22' | 'M23'
  | 'M24' | 'M25' | 'M26' | 'M27' | 'M28' | 'M29' | 'M30'
  | 'M31' | 'M32' | 'M33' | 'M34' | 'M35'
  | 'M36' | 'M37' | 'M38' | 'M39' | 'M40'
  | 'M41' | 'M42' | 'M43' | 'M44' | 'M45' | 'M46';

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
  | 'analytics_integrity'
  | 'paid_media_attribution'
  | 'performance_ux'
  | 'compliance_security'
  | 'martech_efficiency'
  | 'seo_content'
  | 'market_position'
  | 'digital_presence';

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

export const HEALTH_MULTIPLIERS: Record<CheckpointHealth, number> = {
  excellent: 1.0,
  good: 0.75,
  warning: 0.35,
  critical: 0.0,
  info: 0, // excluded from scoring
};

export const CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
  analytics_integrity: 0.20,
  paid_media_attribution: 0.18,
  performance_ux: 0.15,
  compliance_security: 0.15,
  martech_efficiency: 0.12,
  seo_content: 0.10,
  market_position: 0.06,
  digital_presence: 0.04,
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
