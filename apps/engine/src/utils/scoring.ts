import type {
  ModuleId,
  ScoreCategory,
  CategoryScore,
  MarketingIQResult,
  M41Data,
} from '@marketing-alpha/types';
import {
  CATEGORY_MODULES,
  getTrafficLight,
  getMarketingIQLabel,
} from '@marketing-alpha/types';

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
