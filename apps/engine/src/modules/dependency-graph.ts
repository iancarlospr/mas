/**
 * Module Dependency Graph
 *
 * Documents all implicit data dependencies between modules —
 * not just phase ordering, but which modules read which other
 * modules' data via previousResults.
 *
 * Used by:
 * - Contract tests (validate nothing is missing)
 * - Runner (dependency checks for synthesis)
 * - Documentation
 */

import type { ModuleId } from '@marketing-alpha/types';

export interface ModuleDependency {
  /** The downstream module that reads data */
  consumer: ModuleId;
  /** The upstream module whose data is read */
  producer: ModuleId;
  /** Which fields are accessed from the producer's data */
  fields: string[];
  /** Whether the dependency is required (error if missing) or optional */
  required: boolean;
}

/**
 * Complete dependency graph for all modules with cross-module data access.
 *
 * Each entry documents: which module reads what data from which other module.
 * This is the single source of truth for data contract relationships.
 */
export const MODULE_DEPENDENCIES: ModuleDependency[] = [
  // M06 reads M05 analytics data
  {
    consumer: 'M06' as ModuleId,
    producer: 'M05' as ModuleId,
    fields: ['serverSideTracking', 'consent', 'toolNames'],
    required: false,
  },
  // M06 reads M08 tag governance data
  {
    consumer: 'M06' as ModuleId,
    producer: 'M08' as ModuleId,
    fields: ['dataLayer', 'tagAudit', 'serverSideIndicators'],
    required: false,
  },
  // M06 reads M21 Facebook ad CTA URLs (real paid landing page)
  {
    consumer: 'M06' as ModuleId,
    producer: 'M21' as ModuleId,
    fields: ['facebook.ads[].ctaUrl'],
    required: false,
  },
  // M06b reads M05 analytics data
  {
    consumer: 'M06b' as ModuleId,
    producer: 'M05' as ModuleId,
    fields: ['toolNames', 'consent'],
    required: false,
  },
  // M06b reads M06 paid media data
  {
    consumer: 'M06b' as ModuleId,
    producer: 'M06' as ModuleId,
    fields: ['pixels', 'pixelNames'],
    required: false,
  },
  // M06b reads M21 Facebook ad CTA URLs (real paid landing page)
  {
    consumer: 'M06b' as ModuleId,
    producer: 'M21' as ModuleId,
    fields: ['facebook.ads[].ctaUrl'],
    required: false,
  },
  // M07 reads M05 analytics data
  {
    consumer: 'M07' as ModuleId,
    producer: 'M05' as ModuleId,
    fields: ['serverSideTracking'],
    required: false,
  },
  // M08 reads M05 analytics data
  {
    consumer: 'M08' as ModuleId,
    producer: 'M05' as ModuleId,
    fields: ['serverSideTracking'],
    required: false,
  },
  // M12 reads M04 metadata for hreflang (jurisdiction detection)
  {
    consumer: 'M12' as ModuleId,
    producer: 'M04' as ModuleId,
    fields: ['hreflang', 'htmlLang'],
    required: false,
  },
  // M12 reads M05 for consent info
  {
    consumer: 'M12' as ModuleId,
    producer: 'M05' as ModuleId,
    fields: ['consent', 'cookies', 'toolNames'],
    required: false,
  },
  // M17 reads M04 for hreflang (multilingual page detection)
  {
    consumer: 'M17' as ModuleId,
    producer: 'M04' as ModuleId,
    fields: ['hreflang', 'htmlLang'],
    required: false,
  },
  // M21 reads M15 social data for Facebook page identification
  {
    consumer: 'M21' as ModuleId,
    producer: 'M15' as ModuleId,
    fields: ['socialData.sameAsLinks'],
    required: false,
  },
  // M21 reads M04 jsonLd for Facebook page identification
  {
    consumer: 'M21' as ModuleId,
    producer: 'M04' as ModuleId,
    fields: ['jsonLd.socialProfiles'],
    required: false,
  },
  // M41 reads ALL scored modules (M01-M39) - checkpoints, signals, score
  {
    consumer: 'M41' as ModuleId,
    producer: 'M01' as ModuleId,
    fields: ['checkpoints', 'signals', 'score'],
    required: false,
  },
  // M42 reads M41 module summaries
  {
    consumer: 'M42' as ModuleId,
    producer: 'M41' as ModuleId,
    fields: ['moduleSummaries', 'synthesizedCount'],
    required: true,
  },
  // M42 reads M24 traffic data
  {
    consumer: 'M42' as ModuleId,
    producer: 'M24' as ModuleId,
    fields: ['organicTraffic', 'paidTraffic', 'totalTraffic'],
    required: false,
  },
  // M43 reads M42 final synthesis
  {
    consumer: 'M43' as ModuleId,
    producer: 'M42' as ModuleId,
    fields: ['*'],
    required: true,
  },
  // M44 reads M42 and traffic data
  {
    consumer: 'M44' as ModuleId,
    producer: 'M42' as ModuleId,
    fields: ['*'],
    required: true,
  },
  {
    consumer: 'M44' as ModuleId,
    producer: 'M24' as ModuleId,
    fields: ['organicTraffic', 'paidTraffic', 'totalTraffic'],
    required: false,
  },
  // M45 reads M42 and M06 for cost analysis
  {
    consumer: 'M45' as ModuleId,
    producer: 'M42' as ModuleId,
    fields: ['*'],
    required: true,
  },
  {
    consumer: 'M45' as ModuleId,
    producer: 'M06' as ModuleId,
    fields: ['adScriptBytes', 'pixelCount', 'totalNetworkFires'],
    required: false,
  },
  // M46 reads M42 for knowledge base
  {
    consumer: 'M46' as ModuleId,
    producer: 'M42' as ModuleId,
    fields: ['*'],
    required: true,
  },
];

/**
 * Get all dependencies for a given consumer module.
 */
export function getDependenciesFor(moduleId: ModuleId): ModuleDependency[] {
  return MODULE_DEPENDENCIES.filter(d => d.consumer === moduleId);
}

/**
 * Get all modules that depend on a given producer module.
 */
export function getDependentsOf(moduleId: ModuleId): ModuleDependency[] {
  return MODULE_DEPENDENCIES.filter(d => d.producer === moduleId);
}

/**
 * Get all required dependencies for a module (must be present for it to run).
 */
export function getRequiredDependencies(moduleId: ModuleId): ModuleId[] {
  return MODULE_DEPENDENCIES
    .filter(d => d.consumer === moduleId && d.required)
    .map(d => d.producer);
}
