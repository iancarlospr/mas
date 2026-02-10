/**
 * Re-export all types from the shared types package and add
 * engine-specific context types.
 */
export type {
  ModuleId,
  ModulePhase,
  ModuleTier,
  ModuleStatus,
  ModuleDefinition,
  ModuleResult,
  Signal,
  Checkpoint,
  CheckpointHealth,
  ScoreCategory,
  CategoryScore,
  MarketingIQResult,
  AISynthesis,
  Scan,
  ScanStatus,
  ScanHealth,
  ScanWithResults,
  ScanProgressEvent,
} from '@marketing-alpha/types';

export { HEALTH_MULTIPLIERS, CATEGORY_WEIGHTS } from '@marketing-alpha/types';

import type { Page } from 'playwright';
import type { NetworkCollector } from '../utils/network.js';
import type { ModuleId, ModuleTier, ModuleResult } from '@marketing-alpha/types';

/**
 * Context object passed to every module during execution.
 * Contains shared state, page references, and previously collected data.
 */
export interface ModuleContext {
  /** The target URL being scanned. */
  url: string;

  /** The unique scan identifier. */
  scanId: string;

  /** The scan tier (peek, full, paid). */
  tier: ModuleTier;

  /** The raw HTML from the initial fetch (passive phase). */
  html: string | null;

  /** Response headers from the initial fetch. */
  headers: Record<string, string>;

  /** The Playwright page instance (available in browser/ghostscan phases). */
  page: Page | null;

  /** Network request collector (available in browser/ghostscan phases). */
  networkCollector: NetworkCollector | null;

  /** Results from previously completed modules, keyed by module ID. */
  previousResults: Map<ModuleId, ModuleResult>;
}

/**
 * A module execute function signature.
 * Each module implements this interface to perform its analysis.
 */
export type ModuleExecuteFn = (context: ModuleContext) => Promise<ModuleResult>;

/**
 * Registry entry combining the module definition with its execute function.
 */
export interface ModuleRegistryEntry {
  id: ModuleId;
  name: string;
  phase: import('@marketing-alpha/types').ModulePhase;
  minimumTier: ModuleTier;
  dependsOn?: ModuleId[];
  timeout: number;
  retries: number;
  category: import('@marketing-alpha/types').ScoreCategory;
  execute: ModuleExecuteFn;
}
