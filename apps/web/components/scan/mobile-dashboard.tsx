'use client';

import { useState, useMemo } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { useOrientation } from '@/hooks/use-orientation';
import { CATEGORY_META } from './slide-sidebar';
import { MobilePortraitSummary } from './mobile-portrait-summary';
import { MobileLandscapeDetail } from './mobile-landscape-detail';

/**
 * GhostScan Mobile — Dashboard Orchestrator
 * ═══════════════════════════════════════════
 *
 * Top-level mobile component that replaces BentoDashboard on small screens.
 * Same props, same data — different rendering.
 *
 * Portrait: text-first executive summary (scores, headlines, traffic lights)
 * Landscape: full chart detail view for selected module (swipe between modules)
 *
 * The user controls which view they see by rotating their phone.
 */

const PAID_MODULES = new Set(['M42', 'M43', 'M44', 'M45']);
const HIDDEN_MODULES = new Set(['M41']);

interface MobileDashboardProps {
  scan: ScanWithResults;
}

export function MobileDashboard({ scan }: MobileDashboardProps) {
  const orientation = useOrientation();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const isPaid = scan.tier === 'paid';

  /* ── Build result lookup map (same as BentoDashboard) ──── */
  const resultMap = useMemo(
    () => new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r])),
    [scan.moduleResults],
  );

  /* ── Gather visible module IDs in category order ─────────── */
  const moduleSlideIds = useMemo(() => {
    const ids: string[] = [];
    for (const cat of CATEGORY_META) {
      if (cat.paidOnly) continue;
      for (const mId of cat.modules) {
        if (mId === 'overview') continue;
        if (HIDDEN_MODULES.has(mId)) continue;
        const r = resultMap.get(mId);
        if (r && r.status !== 'skipped') {
          ids.push(mId);
        }
      }
    }
    return ids;
  }, [resultMap]);

  /* ── Filter by active category ──────────────────────────── */
  const filteredModuleIds = useMemo(() => {
    if (!activeCategory) return moduleSlideIds;
    const cat = CATEGORY_META.find((c) => c.key === activeCategory);
    if (!cat) return moduleSlideIds;
    const catModules = new Set(cat.modules);
    return moduleSlideIds.filter((id) => catModules.has(id));
  }, [activeCategory, moduleSlideIds]);

  /* ── View switching ─────────────────────────────────────── */

  // Landscape + module selected → full chart detail
  if (selectedModuleId != null && orientation === 'landscape') {
    return (
      <MobileLandscapeDetail
        scan={scan}
        resultMap={resultMap}
        moduleIds={filteredModuleIds}
        activeModuleId={selectedModuleId}
        onBack={() => setSelectedModuleId(null)}
        onNavigate={setSelectedModuleId}
        isPaid={isPaid}
      />
    );
  }

  // Portrait (or landscape without selection) → summary view
  return (
    <MobilePortraitSummary
      scan={scan}
      resultMap={resultMap}
      moduleIds={filteredModuleIds}
      isPaid={isPaid}
      activeCategory={activeCategory}
      onCategoryChange={setActiveCategory}
      onModuleSelect={setSelectedModuleId}
      selectedModuleId={selectedModuleId}
    />
  );
}
