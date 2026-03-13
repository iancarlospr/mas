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

import type { Page } from 'patchright';
import type { NetworkCollector, RedirectChainEntry } from '../utils/network.js';
import type { ConsoleCollector } from '../utils/console-collector.js';
import type { StorageSnapshot } from '../utils/storage-collector.js';
import type { FrameSnapshot } from '../utils/frame-collector.js';
import type { CookieAnalysis } from '../utils/cookie-analyzer.js';
import type { FormSnapshot } from '../utils/form-collector.js';
import type { ContentAnalysis } from '../utils/content-analyzer.js';
import type { ImageAudit } from '../utils/image-auditor.js';
import type { LinkAnalysis } from '../utils/link-analyzer.js';
import type { CrawledPage } from '../services/cloudflare-crawl.js';
import type { ModuleId, ModuleTier, ModuleResult } from '@marketing-alpha/types';
import type { ModuleDataMap } from '@marketing-alpha/types';

// ---------------------------------------------------------------------------
// DOM Forensics snapshot — captured once in runner.ts after navigation
// ---------------------------------------------------------------------------

export interface DOMForensics {
  totalNodes: number;
  maxDepth: number;
  hasShadowDOM: boolean;
  customElements: string[];  // web component tag names, capped at 30
  inlineEventHandlers: Array<{ tag: string; event: string; snippet: string }>;  // capped at 20
  dataAttributes: Array<{ attr: string; count: number; sampleValues: string[] }>;  // top 50 by count
  hiddenElements: {
    displayNone: number;
    visibilityHidden: number;
    opacityZero: number;
    samples: Array<{ tag: string; id: string; class: string }>;  // first 10
  };
  dynamicContentAreas: number;  // elements with data-lazy, data-src, loading="lazy"
}

// ---------------------------------------------------------------------------
// Navigator API snapshot — captured once in runner.ts after navigation
// ---------------------------------------------------------------------------

export interface NavigatorSnapshot {
  connection: { effectiveType: string; downlink: number; rtt: number } | null;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  maxTouchPoints: number;
  language: string;
  languages: string[];
  cookieEnabled: boolean;
  pdfViewerEnabled: boolean;
  webdriver: boolean;
  storageQuota: { usage: number; quota: number } | null;
  colorDepth: number;
  pixelRatio: number;
}

/**
 * Context object passed to every module during execution.
 * Contains shared state, page references, and previously collected data.
 */
export interface ModuleContext {
  /** The target URL being scanned. */
  url: string;

  /** The unique scan identifier. */
  scanId: string;

  /** The scan tier (full, paid). */
  tier: ModuleTier;

  /** The raw HTML from the initial fetch (passive phase). */
  html: string | null;

  /** Response headers from the initial fetch. */
  headers: Record<string, string>;

  /** The Playwright page instance (available in browser/ghostscan phases). */
  page: Page | null;

  /** Network request collector (available in browser/ghostscan phases). */
  networkCollector: NetworkCollector | null;

  /** Console message collector (available in browser/ghostscan phases). */
  consoleCollector: ConsoleCollector | null;

  /** Browser storage snapshot (available after browser navigation). */
  storageSnapshot: StorageSnapshot | null;

  /** Iframe inventory (available after browser navigation). */
  frameSnapshot: FrameSnapshot | null;

  /** DOM forensics snapshot (available after browser navigation). */
  domForensics: DOMForensics | null;

  /** Inline config objects extracted from window globals (available after browser navigation). */
  inlineConfigs: Record<string, unknown> | null;

  /** Per-cookie attribute analysis (available after browser navigation). */
  cookieAnalysis: CookieAnalysis | null;

  /** Form inventory and field analysis (available after browser navigation). */
  formSnapshot: FormSnapshot | null;

  /** Content readability, headings, CTAs, trust signals (available after initial fetch). */
  contentAnalysis: ContentAnalysis | null;

  /** Image alt text, responsive images, fonts, video analysis (available after browser navigation). */
  imageAudit: ImageAudit | null;

  /** Link structure, anchor text quality, navigation structure (available after browser navigation). */
  linkAnalysis: LinkAnalysis | null;

  /** Navigator API snapshot — connection, device, capabilities (available after browser navigation). */
  navigatorSnapshot: NavigatorSnapshot | null;

  /** HTTP redirect chain from the initial fetch (URLs visited before final resolution). */
  redirectChain: string[];

  /** Final URL after all redirects from the initial fetch. */
  finalUrl: string;

  /** Browser-observed redirect chains from the network collector. */
  browserRedirectChains: RedirectChainEntry[];

  /** Mixed content report — HTTP resources loaded on HTTPS pages. */
  mixedContent: MixedContentReport | null;

  /** CrUX / PageSpeed Insights real-user field data. */
  cruxData: CruxFieldData | null;

  /** Mobile rendering performance metrics from a separate mobile browser context. */
  mobileMetrics: MobilePerformanceMetrics | null;

  /** Results from previously completed modules, keyed by module ID. */
  previousResults: Map<ModuleId, ModuleResult>;

  /** True when initial fetch returned a SPA shell (empty body, mount div only). */
  spaDetected?: boolean;

  /** The paid media landing page URL (from M21 CTA), set during paid-media phase. */
  paidMediaUrl?: string;

  /** Optional proxy configuration for this scan. */
  proxy?: { server: string };

  /** Cloudflare crawl results — discovered and rendered pages. */
  crawlPages?: Map<string, CrawledPage>;

  /** Source of ctx.html for diagnostics. */
  htmlSource?: 'raw' | 'cloudflare' | 'browser';
}

// ---------------------------------------------------------------------------
// Mixed Content types
// ---------------------------------------------------------------------------

export interface MixedContentEntry {
  url: string;
  resourceType: string;  // 'script' | 'stylesheet' | 'image' | 'media' | 'font' | 'other'
  source: 'network' | 'html';
  severity: 'active' | 'passive';  // active = scripts/styles, passive = images/media
}

export interface MixedContentReport {
  isHttps: boolean;
  activeCount: number;
  passiveCount: number;
  entries: MixedContentEntry[];  // capped at 50
}

// ---------------------------------------------------------------------------
// CrUX / PageSpeed Insights types
// ---------------------------------------------------------------------------

export interface CruxMetricData {
  p75: number;
  category: 'FAST' | 'AVERAGE' | 'SLOW' | null;
}

export interface CruxFieldData {
  origin: string;
  lcp: CruxMetricData | null;
  cls: CruxMetricData | null;
  inp: CruxMetricData | null;
  fcp: CruxMetricData | null;
  ttfb: CruxMetricData | null;
  formFactor: 'PHONE' | 'DESKTOP' | 'ALL_FORM_FACTORS';
  collectionPeriod: { firstDate: string; lastDate: string } | null;
  lighthouseScore: number | null;
  source: 'crux' | 'psi-only';
}

// ---------------------------------------------------------------------------
// Mobile Performance types
// ---------------------------------------------------------------------------

export interface MobilePerformanceMetrics {
  lcp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number;
  totalBytes: number;
  resourceCount: number;
  domContentLoaded: number;
  loadComplete: number;
  viewportWidth: number;
  viewportHeight: number;
  userAgent: string;
}

/**
 * A module execute function signature.
 * Each module implements this interface to perform its analysis.
 */
export type ModuleExecuteFn = (context: ModuleContext) => Promise<ModuleResult>;

/**
 * Type-safe accessor for upstream module data.
 * Replaces untyped `ctx.previousResults.get('M05' as ModuleId)?.data['toolNames']`
 * with `getModuleData(ctx, 'M05')?.toolNames`.
 */
export function getModuleData<K extends keyof ModuleDataMap>(
  ctx: ModuleContext,
  moduleId: K,
): ModuleDataMap[K] | undefined {
  const result = ctx.previousResults.get(moduleId as ModuleId);
  if (!result || result.status === 'error' || result.status === 'skipped') return undefined;
  return result.data as unknown as ModuleDataMap[K];
}

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
