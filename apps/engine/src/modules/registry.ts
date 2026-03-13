import type { ModuleDefinition, ModuleId } from '@marketing-alpha/types';

/**
 * Complete MODULE_REGISTRY containing all 45 module definitions.
 *
 * Organized by phase:
 *   Phase 1 - Passive (full tier): M01, M02, M04, M16, M17, M18, M19
 *   Phase 2 - Browser (full tier): M03, M05, M07, M08, M13, M14, M15, M20
 *   Phase 3 - GhostScan (full tier): M09, M10, M11, M12
 *   Phase 4 - External (full tier): M21, M22, M23, M24-M39
 *   Phase 4.5 - Paid Media (full tier): M06, M06b (runs on M21 CTA URL)
 *   Phase 5 - Synthesis: M41 (full), M42-M45 (paid)
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  // ─── Phase 1: Passive (full tier) ──────────────────────────────────────────
  {
    id: 'M01',
    name: 'DNS & Security Baseline',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'security_compliance',
  },
  {
    id: 'M02',
    name: 'CMS & Infrastructure',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'martech_infrastructure',
  },
  {
    id: 'M04',
    name: 'Page Metadata',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'seo_content',
  },
  {
    id: 'M16',
    name: 'PR & Media',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'brand_presence',
  },
  {
    id: 'M17',
    name: 'Careers & HR',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'brand_presence',
  },
  {
    id: 'M18',
    name: 'Investor Relations',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'brand_presence',
  },
  {
    id: 'M19',
    name: 'Support & Success',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 4,
    category: 'brand_presence',
  },

  // ─── Phase 2: Browser (full tier) ──────────────────────────────────────────
  {
    id: 'M03',
    name: 'Page Load & Resource Performance',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_experience',
  },
  {
    id: 'M05',
    name: 'Analytics Architecture',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_measurement',
  },
  {
    id: 'M06',
    name: 'Paid Media Infrastructure',
    phase: 'paid-media',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_measurement',
  },
  {
    id: 'M06b',
    name: 'PPC Landing Page Analysis',
    phase: 'paid-media',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 3,
    category: 'analytics_measurement',
  },
  {
    id: 'M07',
    name: 'MarTech Orchestration',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'martech_infrastructure',
  },
  {
    id: 'M08',
    name: 'Tag Governance',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_measurement',
  },
  {
    id: 'M13',
    name: 'Performance & Carbon',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_experience',
  },
  {
    id: 'M14',
    name: 'Mobile & Responsive',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_experience',
  },
  {
    id: 'M15',
    name: 'Social & Sharing',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'seo_content',
  },
  {
    id: 'M20',
    name: 'Ecommerce/SaaS Detection',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'martech_infrastructure',
  },

  // ─── Phase 3: GhostScan (full tier) ───────────────────────────────────────
  {
    id: 'M09',
    name: 'Behavioral Intelligence',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_measurement',
  },
  {
    id: 'M10',
    name: 'Accessibility Overlay Detection',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_experience',
  },
  {
    id: 'M11',
    name: 'Console & Error Logging',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_experience',
  },
  {
    id: 'M12',
    name: 'Legal, Security & Compliance',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'security_compliance',
  },

  // ─── Phase 4: External (full tier) ─────────────────────────────────────────
  {
    id: 'M21',
    name: 'Ad Library Recon',
    phase: 'external',
    minimumTier: 'full',
    timeout: 180_000,
    retries: 2,
    category: 'paid_media',
  },
  {
    id: 'M22',
    name: 'News Sentiment Scanner',
    phase: 'external',
    minimumTier: 'full',
    timeout: 60_000,
    retries: 5,
    category: 'brand_presence',
  },
  {
    id: 'M23',
    name: 'Social Sentiment Scanner',
    phase: 'external',
    minimumTier: 'full',
    timeout: 60_000,
    retries: 5,
    category: 'brand_presence',
  },
  {
    id: 'M24',
    name: 'Monthly Visits',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M25',
    name: 'Traffic by Country',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M26',
    name: 'Rankings',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'seo_content',
  },
  {
    id: 'M27',
    name: 'Paid Traffic Cost',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M28',
    name: 'Top Paid Keywords',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'paid_media',
  },
  {
    id: 'M29',
    name: 'Competitors',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'paid_media',
  },
  {
    id: 'M30',
    name: 'Traffic Sources',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M31',
    name: 'Domain Trust',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M33',
    name: 'Brand Search',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M34',
    name: 'Losing Keywords',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'seo_content',
  },
  {
    id: 'M36',
    name: 'Google Shopping',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_intelligence',
  },
  {
    id: 'M37',
    name: 'Review Velocity',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'brand_presence',
  },
  {
    id: 'M38',
    name: 'Local Pack',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'brand_presence',
  },
  {
    id: 'M39',
    name: 'Sitemap & Indexing',
    phase: 'passive',
    minimumTier: 'full',
    timeout: 15_000,
    retries: 3,
    category: 'seo_content',
  },
  {
    id: 'M40',
    name: 'Subdomain & Attack Surface',
    phase: 'external',
    minimumTier: 'full',
    timeout: 45_000,
    retries: 3,
    category: 'security_compliance',
  },

  // ─── Phase 5: Synthesis ────────────────────────────────────────────────────
  {
    id: 'M41',
    name: 'Module AI Synthesis',
    phase: 'synthesis',
    minimumTier: 'full',
    timeout: 180_000,
    retries: 4,
    category: 'market_intelligence',
    dependsOn: [
      'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M06b', 'M07', 'M08',
      'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17',
      'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26',
      'M27', 'M28', 'M29', 'M30', 'M31', 'M33', 'M34',
      'M36', 'M37', 'M38', 'M39', 'M40',
    ],
  },
  {
    id: 'M42',
    name: 'Executive Brief',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 120_000,
    retries: 4,
    category: 'market_intelligence',
    dependsOn: ['M41'],
  },
  {
    id: 'M43',
    name: 'PRD Generation',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 180_000,
    retries: 4,
    category: 'market_intelligence',
    dependsOn: ['M42', 'M45'],
  },
  // M44 (Impact Scenarios / ROI Simulator) — DISABLED. Not part of the scan.
  // {
  //   id: 'M44',
  //   name: 'Impact Scenarios',
  //   phase: 'synthesis',
  //   minimumTier: 'paid',
  //   timeout: 30_000,
  //   retries: 4,
  //   category: 'market_intelligence',
  //   dependsOn: ['M42'],
  // },
  {
    id: 'M45',
    name: 'Stack Analyzer',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 30_000,
    retries: 4,
    category: 'market_intelligence',
    dependsOn: ['M41'],
  },
];

/**
 * Get a module definition by ID.
 */
export function getModuleDefinition(id: ModuleId): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id);
}

/**
 * Get all modules for a given phase.
 */
export function getModulesByPhase(
  phase: ModuleDefinition['phase'],
): ModuleDefinition[] {
  return MODULE_REGISTRY.filter((m) => m.phase === phase);
}

/**
 * Get all modules available for a given tier.
 * Tier hierarchy: full < paid.
 */
export function getModulesForTier(
  tier: ModuleDefinition['minimumTier'],
): ModuleDefinition[] {
  const tierOrder = { full: 0, paid: 1 };
  const maxTier = tierOrder[tier];
  return MODULE_REGISTRY.filter((m) => tierOrder[m.minimumTier] <= maxTier);
}

/**
 * Get modules for a specific phase and tier combination.
 */
export function getModulesForPhaseAndTier(
  phase: ModuleDefinition['phase'],
  tier: ModuleDefinition['minimumTier'],
): ModuleDefinition[] {
  const tierOrder = { full: 0, paid: 1 };
  const maxTier = tierOrder[tier];
  return MODULE_REGISTRY.filter(
    (m) => m.phase === phase && tierOrder[m.minimumTier] <= maxTier,
  );
}

/**
 * Get all scored module IDs (excludes synthesis modules).
 */
export function getScoredModuleIds(): ModuleId[] {
  return MODULE_REGISTRY
    .filter((m) => m.phase !== 'synthesis')
    .map((m) => m.id);
}
