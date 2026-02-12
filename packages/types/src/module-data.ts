/**
 * Module Data Contracts
 *
 * Typed interfaces for every module's `data` object that has downstream
 * consumers. Replaces untyped `Record<string, unknown>` access patterns
 * with compile-time-checked shapes.
 *
 * Usage:
 *   import { getModuleData } from '../modules/types.js';
 *   const m05 = getModuleData(ctx, 'M05');
 *   m05?.toolNames  // string[] — type-checked!
 */

// ── M01: DNS & Security ─────────────────────────────────────────────────

export interface M01Data {
  dmarc: {
    record: string | null;
    policy: string | null;
    rua: string | null;
    ruf: string | null;
  };
  spf: {
    record: string | null;
    includes: string[];
    mechanisms: string[];
  };
  dkim: {
    selectors: string[];
    found: boolean;
  };
  hsts: {
    present: boolean;
    maxAge: number | null;
    includeSubDomains: boolean;
    preload: boolean;
  };
  tls: {
    protocol: string | null;
    grade: string | null;
  };
  securityHeaders: Record<string, string | null>;
  dnssec: boolean;
  caa: string[];
  redirectChain?: {
    hops: number;
    chain: string[];
    httpToHttps: boolean;
    hasWwwRedirect: boolean;
    browserRedirectCount: number;
  };
  mixedContent?: {
    activeCount: number;
    passiveCount: number;
    entries: Array<{ url: string; resourceType: string; severity: 'active' | 'passive' }>;
  };
}

// ── M02: CMS & Infrastructure ───────────────────────────────────────────

export interface M02Data {
  cms: { name: string | null; version: string | null; confidence: number } | null;
  cdn: { name: string | null; evidence: string; confidence: number } | null;
  framework: { name: string | null; version: string | null; confidence: number } | null;
  server: { name: string | null; version: string | null } | null;
  compression: string | null;
  httpVersion: string | null;
  hosting: { provider: string | null; evidence: string | null } | null;
  waf: { name: string | null; evidence: string | null } | null;
}

// ── M04: Page Metadata ──────────────────────────────────────────────────

export interface M04Data {
  title: { content: string | null; length: number };
  metaDescription: { content: string | null; length: number };
  canonical: string | null;
  ogTags: Record<string, string>;
  twitterCards: Record<string, string>;
  jsonLd: {
    raw: unknown[];
    types: string[];
    organizationName: string | null;
    organizationLogo: string | null;
    socialProfiles: string[];
    contactPoints: Array<{ type: string; telephone?: string; email?: string }>;
    websiteName: string | null;
    hasSearchAction: boolean;
  };
  robotsTxt: {
    present: boolean;
    blocked: boolean;
    content?: string;
    sitemapUrls: string[];
    disallowedPaths: string[];
    userAgentCount: number;
  };
  sitemap: {
    present: boolean;
    urlCount?: number;
    source: 'standard' | 'index' | 'robots-txt' | null;
  };
  llmsTxt: { present: boolean; content?: string };
  manifest: { present: boolean; data?: Record<string, unknown> };
  favicon: {
    present: boolean;
    formats: Array<{ rel: string; href: string; sizes?: string; type?: string }>;
  };
  htmlLang: string | null;
  hreflang: Array<{ lang: string; href: string }>;
  preconnectHints: string[];
  metaTags: Record<string, string>;
  robotsDirectives: {
    metaRobots: string | null;
    xRobotsTag: string | null;
    noindex: boolean;
    nofollow: boolean;
  };
  viewport: { content: string | null; hasWidth: boolean; hasInitialScale: boolean };
  charset: { charset: string | null; source: 'meta' | 'header' | null };
  adsTxt: { present: boolean; blocked: boolean; lineCount?: number };
  alternateLinks: Array<{ type: string; href: string; title?: string }>;
  pagination: { next: string | null; prev: string | null };
  openSearch: { present: boolean; title?: string; href?: string };
  isAMP?: boolean;
}

// ── M05: Analytics Architecture ─────────────────────────────────────────

export interface M05Data {
  tools: Array<{
    name: string;
    type: 'analytics' | 'tag_manager' | 'session_replay' | 'heatmap';
    id?: string;
    confidence: number;
    details: Record<string, unknown>;
  }>;
  dataLayer: Array<Record<string, unknown>>;
  consent: {
    hasConsentMode: boolean;
    version: number | null;
    defaultState: Record<string, string>;
    updatedState: Record<string, string>;
    consentPlatform: string | null;
  };
  networkMeasurementIds: string[];
  networkEventNames: string[];
  pixelFires: number;
  analyticsRequestCount: number;
  tagManagerRequestCount: number;
  serverSideTracking: boolean;
  cookies: Array<{
    name: string;
    domain: string;
    tool: string | null;
    secure: boolean;
    sameSite: string;
  }>;
  toolCount: number;
  toolNames: string[];
}

// ── M06: Paid Media ─────────────────────────────────────────────────────

export interface M06Data {
  pixels: Array<{
    name: string;
    id: string | null;
    events: string[];
    hasEnhancedConversions: boolean;
    serverSide: boolean;
    confidence: number;
    networkFires: number;
    loadMethod: 'direct' | 'gtm' | 'unknown';
  }>;
  adRequestCount: number;
  adScriptBytes: number;
  adScriptCount: number;
  adBytesByPlatform: Record<string, number>;
  clickIds: Record<string, string | null>;
  utmParams: Record<string, string | null>;
  attributionCookies: Array<{ name: string; domain: string; platform: string }>;
  cookiesByPlatform: Record<string, string[]>;
  googleAdsCookieFallback: boolean;
  capiDetected: boolean;
  capiSource: string | null;
  pixelCount: number;
  pixelNames: string[];
  totalNetworkFires: number;
}

// ── M07: MarTech Orchestration ──────────────────────────────────────────

export interface M07Data {
  tools: Array<{
    name: string;
    category: string;
    confidence: number;
    details: Record<string, unknown>;
    source: 'globals' | 'dom' | 'network' | 'cookie';
  }>;
  forms: Array<{
    action: string;
    method: string;
    hasEmail: boolean;
    hasPhone: boolean;
    hasName: boolean;
    hiddenFields: string[];
    formBuilder: string | null;
    inputCount: number;
  }>;
  martechNetworkHits: number;
  martechCookies: Array<{ name: string; tool: string; domain: string }>;
  martechBytes: number;
  toolCount: number;
  toolNames: string[];
  formCount: number;
  emailFormCount: number;
  categories: string[];
  extractedIds: Record<string, string>;
  m05ServerSide?: boolean;
}

// ── M08: Tag Governance ─────────────────────────────────────────────────

export interface M08Data {
  tms: Array<{ name: string; containers: string[]; confidence: number }>;
  ga4MeasurementIds: string[];
  dataLayer: {
    length: number;
    keys: string[];
    hasEcommerce: boolean;
    hasUserData: boolean;
    hasPageData: boolean;
    events: string[];
  };
  dataLayerSystemEvents: string[];
  dataLayerCustomEvents: string[];
  tagAudit: {
    totalTagRequests: number;
    failedRequests: number;
    byCategory: Record<string, number>;
    blockingScripts: number;
    asyncScripts: number;
  };
  serverSideIndicators: boolean;
  thirdPartyScriptCount: number;
  thirdPartyDomains: string[];
  unknownDomains: string[];
  piggybackEstimate: number;
  sstSources: string[];
  tmsCount: number;
  containerCount: number;
}

// ── M12: Legal Compliance ───────────────────────────────────────────────

export interface M12Data {
  privacyPolicy: { found: boolean; url: string | null; wordCount: number };
  termsOfService: { found: boolean; url: string | null };
  consentBanner: {
    found: boolean;
    platform: string | null;
    hasReject: boolean;
    hasPreferences: boolean;
  };
  ccpa: { found: boolean; mechanism: string | null };
  cookiePolicy: { found: boolean; url: string | null };
  jurisdiction: string | null;
  gdprRequired: boolean;
  trackingPreConsent: string[];
}

// ── M24: Market Intelligence ────────────────────────────────────────────

export interface M24Data {
  overview: Record<string, unknown>;
  organicTraffic: number;
  paidTraffic: number;
  organicKeywords: number;
  paidKeywords: number;
  totalTraffic: number;
}

// ── M41: Module Synthesis ───────────────────────────────────────────────

export interface M41ModuleSynthesis {
  executive_summary: string;
  key_findings: Array<{
    finding: string;
    severity: 'critical' | 'warning' | 'info' | 'positive';
    evidence: string;
    business_impact: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    effort: 'S' | 'M' | 'L' | 'XL';
    expected_impact: string;
  }>;
  score_rationale: string;
}

export interface M41Data {
  moduleSummaries: Record<string, M41ModuleSynthesis>;
  synthesizedCount: number;
  failedCount: number;
}

// ── M32: Domain Trust & Authority ───────────────────────────────────────

export interface M32Data {
  authority: {
    rank: number;
    backlinks: number;
    referringDomains: number;
    brokenBacklinks: number;
    referringDomainsNofollow: number;
  };
  referringDomains?: Array<{
    domain: string;
    rank: number;
    backlinks: number;
    firstSeen: string | null;
  }>;
  anchors?: Array<{
    anchor: string;
    backlinks: number;
    referringDomains: number;
    percentage: number;
  }>;
  anchorDiversity?: 'diverse' | 'moderate' | 'concentrated';
}

// ── M40: Subdomain & Attack Surface ────────────────────────────────────

export interface M40SubdomainEntry {
  subdomain: string;
  ips: string[];
  isAlive: boolean;
  classification: string;
  securitySeverity: 'critical' | 'warning' | 'info';
}

export interface M40Data {
  totalDiscovered: number;
  subdomains: M40SubdomainEntry[];
  wildcardDetected: boolean;
  wildcardIp: string | null;
}

// ── Module Data Map ─────────────────────────────────────────────────────
// Maps module IDs to their data shapes for type-safe access

export interface ModuleDataMap {
  M01: M01Data;
  M02: M02Data;
  M04: M04Data;
  M05: M05Data;
  M06: M06Data;
  M07: M07Data;
  M08: M08Data;
  M12: M12Data;
  M24: M24Data;
  M32: M32Data;
  M40: M40Data;
  M41: M41Data;
}
