/**
 * Frontend utility to aggregate DetectedTool[] from all module results,
 * then merge in AI-identified tools from M42's tech_stack_summary.
 *
 * Two layers:
 *   1. Deterministic — detectedTools[] from each module (concrete evidence)
 *   2. AI-enriched — M42's tech_stack_summary (inferred from analysis)
 *
 * Deduplicates by name (case-insensitive), deterministic wins on conflict.
 */

import type { DetectedTool, DetectedToolCategory } from '@marketing-alpha/types';

/** M42 tech_stack_summary category → DetectedToolCategory */
const AI_CATEGORY_MAP: Record<string, DetectedToolCategory> = {
  analytics: 'analytics',
  advertising: 'advertising',
  automation: 'crm_marketing_automation',
  cms_hosting: 'hosting',
  security: 'security',
  other: 'other',
};

/**
 * Aggregate deterministic detectedTools from all module results.
 */
export function aggregateDetectedTools(
  moduleResults: Array<{ data: Record<string, unknown> }>,
): DetectedTool[] {
  const best = new Map<string, DetectedTool>();

  for (const result of moduleResults) {
    const tools = result.data?.['detectedTools'] as DetectedTool[] | undefined;
    if (!tools || !Array.isArray(tools)) continue;

    for (const t of tools) {
      if (!t.name) continue;
      const key = t.name.toLowerCase();
      const existing = best.get(key);
      if (!existing || t.confidence > existing.confidence) {
        best.set(key, t);
      }
    }
  }

  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Merge deterministic detectedTools with AI-identified tools from M42.
 * Deterministic entries take priority — AI tools only fill gaps.
 */
export function mergeWithAITools(
  deterministic: DetectedTool[],
  m42Data: Record<string, unknown> | undefined,
): DetectedTool[] {
  const merged = new Map<string, DetectedTool>();

  // Deterministic first (higher trust)
  for (const t of deterministic) {
    merged.set(t.name.toLowerCase(), t);
  }

  // Layer in AI tools from tech_stack_summary
  const synthesis = m42Data?.['synthesis'] as Record<string, unknown> | undefined;
  const techStack = synthesis?.['tech_stack_summary'] as Record<string, string[]> | undefined;
  if (techStack) {
    for (const [aiCategory, tools] of Object.entries(techStack)) {
      if (!Array.isArray(tools)) continue;
      for (const name of tools) {
        if (!name) continue;
        const key = name.toLowerCase();
        if (!merged.has(key)) {
          merged.set(key, {
            name,
            category: AI_CATEGORY_MAP[aiCategory] ?? 'other',
            confidence: 0.6,
            source: 'M42',
            evidenceType: 'api',
          });
        }
      }
    }
  }

  return [...merged.values()].sort((a, b) => b.confidence - a.confidence);
}
