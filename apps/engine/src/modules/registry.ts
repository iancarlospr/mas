import type { ModuleDefinition, ModuleId } from '@marketing-alpha/types';

/**
 * Complete MODULE_REGISTRY containing all 45 module definitions.
 *
 * Organized by phase:
 *   Phase 1 - Passive (peek tier): M01, M02, M04, M16, M17, M18, M19
 *   Phase 2 - Browser (full tier): M03, M05, M06, M06b, M07, M08, M13, M14, M15, M20
 *   Phase 3 - GhostScan (full tier): M09, M10, M11, M12
 *   Phase 4 - External (full tier): M21, M22, M23, M24-M39
 *   Phase 5 - Synthesis: M41 (full), M42-M46 (paid)
 */
export const MODULE_REGISTRY: ModuleDefinition[] = [
  // ─── Phase 1: Passive (peek tier) ──────────────────────────────────────────
  {
    id: 'M01',
    name: 'DNS & Security Baseline',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'compliance_security',
  },
  {
    id: 'M02',
    name: 'CMS & Infrastructure',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'digital_presence',
  },
  {
    id: 'M04',
    name: 'Page Metadata',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'seo_content',
  },
  {
    id: 'M16',
    name: 'PR & Media',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'seo_content',
  },
  {
    id: 'M17',
    name: 'Careers & HR',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'digital_presence',
  },
  {
    id: 'M18',
    name: 'Investor Relations',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'digital_presence',
  },
  {
    id: 'M19',
    name: 'Support & Success',
    phase: 'passive',
    minimumTier: 'peek',
    timeout: 15_000,
    retries: 4,
    category: 'digital_presence',
  },

  // ─── Phase 2: Browser (full tier) ──────────────────────────────────────────
  {
    id: 'M03',
    name: 'Page Load & Resource Performance',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_ux',
  },
  {
    id: 'M05',
    name: 'Analytics Architecture',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_integrity',
  },
  {
    id: 'M06',
    name: 'Paid Media Infrastructure',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'paid_media_attribution',
  },
  {
    id: 'M06b',
    name: 'PPC Landing Page Analysis',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 45_000,
    retries: 3,
    category: 'paid_media_attribution',
  },
  {
    id: 'M07',
    name: 'MarTech Orchestration',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'martech_efficiency',
  },
  {
    id: 'M08',
    name: 'Tag Governance',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_integrity',
  },
  {
    id: 'M13',
    name: 'Performance & Carbon',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_ux',
  },
  {
    id: 'M14',
    name: 'Mobile & Responsive',
    phase: 'browser',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'performance_ux',
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
    category: 'martech_efficiency',
  },

  // ─── Phase 3: GhostScan (full tier) ───────────────────────────────────────
  {
    id: 'M09',
    name: 'Behavioral Intelligence',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'analytics_integrity',
  },
  {
    id: 'M10',
    name: 'Accessibility Overlay Detection',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'compliance_security',
  },
  {
    id: 'M11',
    name: 'Console & Error Logging',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'compliance_security',
  },
  {
    id: 'M12',
    name: 'Legal, Security & Compliance',
    phase: 'ghostscan',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 3,
    category: 'compliance_security',
  },

  // ─── Phase 4: External (full tier) ─────────────────────────────────────────
  {
    id: 'M21',
    name: 'Ad Library Recon',
    phase: 'external',
    minimumTier: 'full',
    timeout: 60_000,
    retries: 5,
    category: 'paid_media_attribution',
  },
  {
    id: 'M22',
    name: 'News Sentiment Scanner',
    phase: 'external',
    minimumTier: 'full',
    timeout: 60_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M23',
    name: 'Social Sentiment Scanner',
    phase: 'external',
    minimumTier: 'full',
    timeout: 60_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M24',
    name: 'Market Intelligence Overview',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M25',
    name: 'Monthly Visits & Top Pages',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M26',
    name: 'Traffic by Country',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M27',
    name: 'Global, Country & Category Rank',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M28',
    name: 'Paid Traffic Cost Estimate',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'paid_media_attribution',
  },
  {
    id: 'M29',
    name: 'Top Paid Keywords',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'paid_media_attribution',
  },
  {
    id: 'M30',
    name: 'Paid Competitor Overlap',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M31',
    name: 'Traffic Sources Breakdown',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M32',
    name: 'Domain Trust & Authority',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M33',
    name: 'Mobile vs Desktop Traffic',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M34',
    name: 'Search Volume & Brand Demand',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M35',
    name: 'Top Losing Organic Keywords',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M36',
    name: 'Bounce Rate Estimate',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M37',
    name: 'Google Shopping Landscape',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M38',
    name: 'Review Velocity & Sentiment',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M39',
    name: 'Local Pack Visibility',
    phase: 'external',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 5,
    category: 'market_position',
  },
  {
    id: 'M40',
    name: 'Subdomain & Attack Surface',
    phase: 'external',
    minimumTier: 'full',
    timeout: 45_000,
    retries: 3,
    category: 'compliance_security',
  },

  // ─── Phase 5: Synthesis ────────────────────────────────────────────────────
  {
    id: 'M41',
    name: 'Module AI Synthesis',
    phase: 'synthesis',
    minimumTier: 'full',
    timeout: 30_000,
    retries: 4,
    category: 'market_position',
    dependsOn: [
      'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M06b', 'M07', 'M08',
      'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17',
      'M18', 'M19', 'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26',
      'M27', 'M28', 'M29', 'M30', 'M31', 'M32', 'M33', 'M34', 'M35',
      'M36', 'M37', 'M38', 'M39', 'M40',
    ],
  },
  {
    id: 'M42',
    name: 'Final AI Synthesis & Scoring',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 60_000,
    retries: 4,
    category: 'market_position',
    dependsOn: ['M41'],
  },
  {
    id: 'M43',
    name: 'PRD Generation',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 60_000,
    retries: 4,
    category: 'market_position',
    dependsOn: ['M42'],
  },
  {
    id: 'M44',
    name: 'ROI Simulator',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 30_000,
    retries: 4,
    category: 'market_position',
    dependsOn: ['M42'],
  },
  {
    id: 'M45',
    name: 'Cost Cutter Analysis',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 30_000,
    retries: 4,
    category: 'market_position',
    dependsOn: ['M41'],
  },
  {
    id: 'M46',
    name: 'AI Knowledge Base',
    phase: 'synthesis',
    minimumTier: 'paid',
    timeout: 30_000,
    retries: 4,
    category: 'market_position',
    dependsOn: ['M42'],
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
 * Tier hierarchy: peek < full < paid.
 */
export function getModulesForTier(
  tier: ModuleDefinition['minimumTier'],
): ModuleDefinition[] {
  const tierOrder = { peek: 0, full: 1, paid: 2 };
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
  const tierOrder = { peek: 0, full: 1, paid: 2 };
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
