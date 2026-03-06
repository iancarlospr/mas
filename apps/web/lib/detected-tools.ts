/**
 * Frontend utility to aggregate DetectedTool[] from all module results.
 * Deduplicates by name (case-insensitive), keeps highest confidence entry.
 */

import type { DetectedTool } from '@marketing-alpha/types';

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
