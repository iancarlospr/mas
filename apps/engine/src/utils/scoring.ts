import type {
  Checkpoint,
  ModuleResult,
  ModuleId,
  ScoreCategory,
  CategoryScore,
  MarketingIQResult,
  Signal,
  M41Data,
} from '@marketing-alpha/types';
import {
  HEALTH_MULTIPLIERS,
  CATEGORY_WEIGHTS,
  CATEGORY_MODULES,
  getTrafficLight,
  getMarketingIQLabel,
} from '@marketing-alpha/types';

/**
 * Map of module IDs to their score categories.
 */
const MODULE_CATEGORIES: Record<string, ScoreCategory> = {
  M01: 'security_compliance',
  M12: 'security_compliance',
  M40: 'security_compliance',
  M05: 'analytics_measurement',
  M06: 'analytics_measurement',
  M06b: 'analytics_measurement',
  M08: 'analytics_measurement',
  M09: 'analytics_measurement',
  M03: 'performance_experience',
  M10: 'performance_experience',
  M11: 'performance_experience',
  M13: 'performance_experience',
  M14: 'performance_experience',
  M04: 'seo_content',
  M15: 'seo_content',
  M26: 'seo_content',
  M34: 'seo_content',
  M39: 'seo_content',
  M21: 'paid_media',
  M28: 'paid_media',
  M29: 'paid_media',
  M02: 'martech_infrastructure',
  M07: 'martech_infrastructure',
  M20: 'martech_infrastructure',
  M16: 'brand_presence',
  M17: 'brand_presence',
  M18: 'brand_presence',
  M19: 'brand_presence',
  M22: 'brand_presence',
  M23: 'brand_presence',
  M37: 'brand_presence',
  M38: 'brand_presence',
  M24: 'market_intelligence',
  M25: 'market_intelligence',
  M27: 'market_intelligence',
  M30: 'market_intelligence',
  M31: 'market_intelligence',
  M32: 'market_intelligence',
  M33: 'market_intelligence',
  M35: 'market_intelligence',
  M36: 'market_intelligence',
};

/**
 * Calculate a module's score from its checkpoints using HEALTH_MULTIPLIERS.
 *
 * Score = sum(checkpoint.weight * HEALTH_MULTIPLIERS[checkpoint.health]) / sum(checkpoint.weight) * 100
 * Info checkpoints are excluded from scoring (multiplier = 0, weight excluded).
 */
export function calculateModuleScore(checkpoints: Checkpoint[]): number {
  // Filter out info checkpoints
  const scoreable = checkpoints.filter((cp) => cp.health !== 'info');

  if (scoreable.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cp of scoreable) {
    const multiplier = HEALTH_MULTIPLIERS[cp.health];
    weightedSum += cp.weight * multiplier;
    totalWeight += cp.weight;
  }

  if (totalWeight === 0) return 0;

  return Math.round((weightedSum / totalWeight) * 100);
}

/**
 * Calculate scores for each category based on module results.
 */
export function calculateCategoryScores(
  moduleResults: ModuleResult[],
): CategoryScore[] {
  const categories = Object.keys(CATEGORY_WEIGHTS) as ScoreCategory[];
  const resultMap = new Map<string, ModuleResult>();

  for (const result of moduleResults) {
    resultMap.set(result.moduleId, result);
  }

  return categories.map((category) => {
    // Find all modules in this category
    const moduleIds = Object.entries(MODULE_CATEGORIES)
      .filter(([_, cat]) => cat === category)
      .map(([id]) => id as ModuleId);

    const moduleScores: { moduleId: ModuleId; score: number | null }[] = [];
    const validScores: number[] = [];

    for (const moduleId of moduleIds) {
      const result = resultMap.get(moduleId);
      const score = result?.score ?? null;
      moduleScores.push({ moduleId, score });
      if (score !== null) {
        validScores.push(score);
      }
    }

    const categoryScore =
      validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : 0;

    return {
      category,
      score: categoryScore,
      light: getTrafficLight(categoryScore),
      moduleScores,
    };
  });
}

/**
 * Calculate the composite MarketingIQ score with penalties and bonuses.
 *
 * Base score: weighted average of category scores.
 * Penalties: critical findings reduce score.
 * Bonuses: exceptional implementations boost score.
 */
export function calculateMarketingIQ(
  moduleResults: ModuleResult[],
): MarketingIQResult {
  const categoryScores = calculateCategoryScores(moduleResults);

  // Calculate weighted raw score
  let weightedSum = 0;
  let totalWeight = 0;

  for (const cs of categoryScores) {
    const weight = CATEGORY_WEIGHTS[cs.category];
    weightedSum += cs.score * weight;
    totalWeight += weight;
  }

  const raw = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Calculate penalties (SC-6: Critical Penalties / Circuit Breakers)
  const penalties: { name: string; points: number; reason: string }[] = [];
  const allSignals: Signal[] = [];
  const allCheckpoints: Checkpoint[] = [];

  for (const result of moduleResults) {
    allSignals.push(...result.signals);
    allCheckpoints.push(...result.checkpoints);
  }

  // Helper to get a module result
  const getModule = (id: string) => moduleResults.find((r) => r.moduleId === id);

  // Penalty: Zero analytics (-15)
  const hasAnalytics = moduleResults.some(
    (r) => r.moduleId === 'M05' && r.score !== null && r.score > 20,
  );
  if (!hasAnalytics) {
    penalties.push({
      name: 'Zero Analytics',
      points: -15,
      reason: 'No analytics tool detected. Marketing is unaccountable.',
    });
  }

  // Penalty: Tracking fires before consent (-12)
  const trackingBeforeConsent = allSignals.some(
    (s) => s.name === 'tracking_before_consent' && s.confidence >= 0.7,
  );
  if (trackingBeforeConsent) {
    penalties.push({
      name: 'Tracking Fires Before Consent',
      points: -12,
      reason: 'Ad/analytics pixels firing before consent banner interaction. Active GDPR/ePrivacy violation.',
    });
  }

  // Penalty: SSL certificate expired (-10)
  const sslExpired = allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('tls') && cp.health === 'critical',
  );
  if (sslExpired) {
    penalties.push({
      name: 'SSL Certificate Expired',
      points: -10,
      reason: 'Expired or absent TLS certificate. Browser warnings kill trust and conversions.',
    });
  }

  // Penalty: No privacy policy (-8)
  const noPrivacyPolicy = allSignals.some(
    (s) => s.name === 'no_privacy_policy' && s.confidence >= 0.7,
  ) || allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('privacy_policy') && cp.health === 'critical',
  );
  if (noPrivacyPolicy) {
    penalties.push({
      name: 'No Privacy Policy',
      points: -8,
      reason: 'No privacy policy page found. Legal requirement in every jurisdiction.',
    });
  }

  // Penalty: No consent mechanism with tracking (-8)
  const hasTracking = moduleResults.some(
    (r) => (r.moduleId === 'M05' || r.moduleId === 'M06') && r.signals.length > 0,
  );
  const hasConsent = allSignals.some(
    (s) => s.type === 'consent_platform' && s.confidence >= 0.7,
  );
  if (hasTracking && !hasConsent) {
    penalties.push({
      name: 'No Consent Mechanism With Tracking',
      points: -8,
      reason: 'Tracking active but no consent banner detected. GDPR Article 7 violation for EU visitors.',
    });
  }

  // Penalty: Critical CSP + HSTS both missing (-5)
  const cspMissing = allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('csp') && cp.health === 'critical',
  );
  const hstsMissing = allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('hsts') && cp.health === 'critical',
  );
  if (cspMissing && hstsMissing) {
    penalties.push({
      name: 'CSP + HSTS Both Missing',
      points: -5,
      reason: 'Neither Content-Security-Policy nor HSTS configured. Basic security hygiene failure.',
    });
  }

  // Penalty: Mixed content on HTTPS page (-5)
  const mixedContent = allSignals.some(
    (s) => s.name === 'mixed_content' && s.confidence >= 0.7,
  ) || allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('mixed_content') && cp.health === 'critical',
  );
  if (mixedContent) {
    penalties.push({
      name: 'Mixed Content',
      points: -5,
      reason: 'HTTP resources loaded on HTTPS page. Browser security warnings, broken padlock.',
    });
  }

  // Penalty: Payment page without SRI (-4)
  const paymentWithoutSri = allSignals.some(
    (s) => s.name === 'payment_without_sri' && s.confidence >= 0.7,
  );
  if (paymentWithoutSri) {
    penalties.push({
      name: 'Payment Page Without SRI',
      points: -4,
      reason: 'Payment/checkout page detected with scripts lacking Subresource Integrity. PCI DSS 4.0 Req 6.4.3 violation.',
    });
  }

  // Calculate bonuses (SC-7: Excellence Bonuses)
  const bonuses: { name: string; points: number; reason: string }[] = [];

  // Bonus: Server-side tracking (+5)
  const serverSideTracking = allSignals.some(
    (s) =>
      (s.name === 'gtm_server_container' || s.name === 'meta_capi' || s.name === 'server_side_tracking') &&
      s.confidence >= 0.7,
  );
  if (serverSideTracking) {
    bonuses.push({
      name: 'Server-Side Tracking',
      points: 5,
      reason: 'GTM Server Container or Conversions API detected. Gold standard for tracking accuracy.',
    });
  }

  // Bonus: Full consent mode v2 (+4)
  const consentModeV2 = allSignals.some(
    (s) =>
      (s.name === 'consent_mode_v2' || s.name === 'google_consent_mode_v2') &&
      s.confidence >= 0.7,
  );
  if (consentModeV2) {
    bonuses.push({
      name: 'Full Consent Mode v2',
      points: 4,
      reason: 'Google Consent Mode v2 active with granular consent states. Privacy-first implementation.',
    });
  }

  // Bonus: All Core Web Vitals passing (+3)
  const cwvPassing = allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('lcp') && (cp.health === 'excellent' || cp.health === 'good'),
  ) && allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('inp') && (cp.health === 'excellent' || cp.health === 'good'),
  ) && allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('cls') && (cp.health === 'excellent' || cp.health === 'good'),
  );
  if (cwvPassing) {
    bonuses.push({
      name: 'All Core Web Vitals Passing',
      points: 3,
      reason: 'LCP < 2.5s, INP < 200ms, CLS < 0.1. Top 28% of sites.',
    });
  }

  // Bonus: SRI coverage > 80% (+2)
  const sriCoverage = allSignals.some(
    (s) => s.name === 'sri_coverage_high' && s.confidence >= 0.7,
  ) || allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('sri') && cp.health === 'excellent',
  );
  if (sriCoverage) {
    bonuses.push({
      name: 'SRI Coverage > 80%',
      points: 2,
      reason: 'Over 80% of third-party scripts have integrity attributes. Security best practice.',
    });
  }

  // Bonus: Zero errors on load (+2)
  const m11 = getModule('M11');
  const zeroErrors = m11?.score !== null && m11?.score !== undefined && m11.score >= 95;
  if (zeroErrors) {
    bonuses.push({
      name: 'Zero Errors on Load',
      points: 2,
      reason: 'No JS errors, no failed network requests, no console.error on page load. Production-grade.',
    });
  }

  // Bonus: Comprehensive structured data (+2)
  const structuredData = allSignals.some(
    (s) => s.name === 'comprehensive_structured_data' && s.confidence >= 0.7,
  ) || allCheckpoints.some(
    (cp) => cp.id.toLowerCase().includes('structured_data') && cp.health === 'excellent',
  );
  if (structuredData) {
    bonuses.push({
      name: 'Comprehensive Structured Data',
      points: 2,
      reason: 'Organization + WebSite + content-specific type with valid JSON-LD. Rich search features, AI-ready.',
    });
  }

  // Apply penalties and bonuses
  const totalPenalties = penalties.reduce((sum, p) => sum + p.points, 0);
  const totalBonuses = bonuses.reduce((sum, b) => sum + b.points, 0);
  const final = Math.max(0, Math.min(100, raw + totalPenalties + totalBonuses));

  return {
    raw,
    penalties,
    bonuses,
    final,
    label: getMarketingIQLabel(final),
    categories: categoryScores,
  };
}

/**
 * Calculate MarketingIQ from M41 AI synthesis scores.
 *
 * Flat average of all per-module AI scores (school-test style).
 * Category scores are averages of their member modules' AI scores.
 * No penalties, no bonuses — the AI already contextualizes its scoring.
 */
export function calculateMarketingIQFromSynthesis(
  m41Data: M41Data,
): MarketingIQResult {
  const summaries = m41Data.moduleSummaries;

  // Collect all AI module scores
  const allScores: number[] = [];
  for (const synthesis of Object.values(summaries)) {
    if (synthesis.module_score != null) {
      allScores.push(synthesis.module_score);
    }
  }

  const raw = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // Category scores from M41's per-module AI scores
  const categories = (Object.keys(CATEGORY_MODULES) as ScoreCategory[]).map(
    (category) => {
      const moduleIds = CATEGORY_MODULES[category];
      const moduleScores: { moduleId: ModuleId; score: number | null }[] = [];
      const validScores: number[] = [];

      for (const moduleId of moduleIds) {
        const synthesis = summaries[moduleId];
        const score = synthesis?.module_score ?? null;
        moduleScores.push({ moduleId, score });
        if (score != null) {
          validScores.push(score);
        }
      }

      const categoryScore = validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : 0;

      return {
        category,
        score: categoryScore,
        light: getTrafficLight(categoryScore),
        moduleScores,
      } satisfies CategoryScore;
    },
  );

  return {
    raw,
    penalties: [],
    bonuses: [],
    final: raw,
    label: getMarketingIQLabel(raw),
    categories,
  };
}
