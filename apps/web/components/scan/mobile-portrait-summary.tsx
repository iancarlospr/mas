'use client';

import { useState, useCallback } from 'react';
import type { ModuleResult } from '@marketing-alpha/types';
import { getTrafficLight } from '@marketing-alpha/types';
import type { ScanWithResults } from '@marketing-alpha/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { CATEGORY_META, MODULE_NAMES } from './slide-sidebar';
import { MobileScoreHero } from './mobile-score-hero';
import { MobileBottomBar } from './mobile-bottom-bar';
import { DesktopBridgeCard } from './desktop-bridge-card';

/**
 * GhostScan Mobile — Portrait Summary View
 * ═══════════════════════════════════════════
 *
 * Text-first executive summary. Scores, headlines, traffic lights.
 * No OS chrome. Vertical card stack with accordion modules.
 */

const PAID_MODULES = new Set(['M42', 'M43', 'M44', 'M45']);
const HIDDEN_MODULES = new Set(['M41']);

interface MobilePortraitSummaryProps {
  scan: ScanWithResults;
  resultMap: Map<string, ModuleResult>;
  moduleIds: string[];
  isPaid: boolean;
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  onModuleSelect: (moduleId: string) => void;
  selectedModuleId: string | null;
}

export function MobilePortraitSummary({
  scan,
  resultMap,
  moduleIds,
  isPaid,
  activeCategory,
  onCategoryChange,
  onModuleSelect,
}: MobilePortraitSummaryProps) {
  return (
    <div className="fixed inset-0 bg-gs-paper flex flex-col overflow-hidden">
      {/* Atmospheric overlays (subtle on mobile) */}
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      {/* ── Top Bar ────────────────────────────────────── */}
      <header className="h-[44px] flex items-center px-gs-3 bg-gs-chrome bevel-raised flex-shrink-0 z-10 relative">
        <div className="flex items-center gap-gs-1">
          <span className="font-display text-os-base text-gs-red">A</span>
          <span className="font-system text-os-sm font-bold text-gs-red">AlphaScan</span>
        </div>
        <span className="flex-1 text-center font-data text-data-xs text-gs-muted truncate px-gs-2">
          {scan.domain}
        </span>
        <Link href="/history" className="font-data text-data-xs text-gs-red">
          My Scans
        </Link>
      </header>

      {/* ── Scrollable Content ─────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-contain relative">
        {/* Hero score */}
        <MobileScoreHero scan={scan} />

        {/* Category chips */}
        <CategoryChips
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          resultMap={resultMap}
        />

        {/* Category breakdown bars (when "All") */}
        {!activeCategory && scan.marketingIqResult?.categories && (
          <div className="px-gs-3 pb-gs-2 space-y-gs-1">
            {scan.marketingIqResult.categories.map((cat) => (
              <div key={cat.category} className="flex items-center gap-gs-2">
                <span className="font-data text-data-xs text-gs-muted w-[100px] text-right truncate">
                  {CATEGORY_META.find((c) => c.key === cat.category)?.label ?? cat.category}
                </span>
                <div className="flex-1 bevel-sunken bg-gs-paper h-[12px] overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${cat.score}%`,
                      backgroundColor:
                        cat.light === 'green'
                          ? 'var(--gs-terminal)'
                          : cat.light === 'yellow'
                            ? 'var(--gs-warning)'
                            : 'var(--gs-critical)',
                    }}
                  />
                </div>
                <span className="font-data text-data-xs font-bold text-gs-ink w-[28px] text-right">
                  {cat.score}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Module cards */}
        <div className="px-gs-3 pb-gs-16 space-y-gs-1">
          {moduleIds.map((mId) => (
            <MobileModuleCard
              key={mId}
              moduleId={mId}
              result={resultMap.get(mId) ?? null}
              onSelect={() => onModuleSelect(mId)}
              isLocked={!isPaid && PAID_MODULES.has(mId)}
            />
          ))}

          {/* Unlock banner for free tier */}
          {!activeCategory && !isPaid && (
            <div className="bevel-raised bg-gs-ink p-gs-4 text-center">
              <ChloeSprite state="smug" size={32} className="mx-auto mb-gs-2" />
              <p className="font-data text-data-xs text-gs-paper mb-gs-1">
                4 premium analyses classified
              </p>
              <p className="font-data text-data-xs text-gs-muted">
                Executive Brief, Roadmap, ROI, Stack Analyzer
              </p>
            </div>
          )}

          {/* Desktop bridge card */}
          <DesktopBridgeCard scanId={scan.id} />
        </div>
      </main>

      {/* ── Bottom Bar ─────────────────────────────────── */}
      <MobileBottomBar scanId={scan.id} isPaid={isPaid} />
    </div>
  );
}

/* ── Category Chips ──────────────────────────────────────── */

function CategoryChips({
  activeCategory,
  onCategoryChange,
  resultMap,
}: {
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  resultMap: Map<string, ModuleResult>;
}) {
  const categories = CATEGORY_META.filter((c) => c.key !== 'overview' && !c.paidOnly);

  return (
    <nav className="overflow-x-auto flex gap-gs-1 px-gs-3 py-gs-2 flex-shrink-0">
      <button
        onClick={() => onCategoryChange(null)}
        className={cn(
          'whitespace-nowrap text-os-xs px-gs-3 py-gs-1 flex-shrink-0',
          !activeCategory ? 'bevel-sunken bg-gs-ink text-gs-paper' : 'bevel-button',
        )}
      >
        All
      </button>
      {categories.map((cat) => {
        const catModuleResults = cat.modules
          .map((mId) => resultMap.get(mId))
          .filter((r): r is ModuleResult => r != null && r.score != null);
        const avgScore =
          catModuleResults.length > 0
            ? Math.round(catModuleResults.reduce((s, r) => s + (r.score ?? 0), 0) / catModuleResults.length)
            : null;
        const light = avgScore != null ? getTrafficLight(avgScore) : null;

        return (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(cat.key)}
            className={cn(
              'whitespace-nowrap text-os-xs px-gs-3 py-gs-1 flex-shrink-0 flex items-center gap-gs-1',
              activeCategory === cat.key
                ? 'bevel-sunken bg-gs-ink text-gs-paper'
                : 'bevel-button',
            )}
          >
            {cat.label}
            {avgScore != null && (
              <span className="font-data text-data-xs">{avgScore}</span>
            )}
            {light && (
              <span
                className={cn(
                  'w-[6px] h-[6px] rounded-full inline-block',
                  light === 'green' && 'bg-gs-terminal',
                  light === 'yellow' && 'bg-gs-warning',
                  light === 'red' && 'bg-gs-critical',
                )}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ── Module Card (Accordion) ─────────────────────────────── */

function MobileModuleCard({
  moduleId,
  result,
  onSelect,
  isLocked,
}: {
  moduleId: string;
  result: ModuleResult | null;
  onSelect: () => void;
  isLocked: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = result?.score ?? null;
  const light = score != null ? getTrafficLight(score) : null;
  const name = MODULE_NAMES[moduleId] ?? moduleId;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="bevel-raised bg-gs-chrome">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-gs-2 px-gs-3 py-gs-2 text-left"
        onClick={handleToggle}
      >
        {/* Traffic dot */}
        <span
          className={cn(
            'w-[8px] h-[8px] rounded-full flex-shrink-0',
            light === 'green' && 'bg-gs-terminal',
            light === 'yellow' && 'bg-gs-warning',
            light === 'red' && 'bg-gs-critical',
            !light && 'bg-gs-muted',
          )}
        />

        {/* Module info */}
        <div className="flex-1 min-w-0">
          <span className="font-data text-data-xs text-gs-muted">{moduleId}</span>
          <span className="font-data text-data-sm font-bold text-gs-ink truncate block">
            {isLocked ? `[Locked] ${name}` : name}
          </span>
        </div>

        {/* Score */}
        <span
          className={cn(
            'font-data text-data-lg font-bold flex-shrink-0',
            light === 'green' && 'text-gs-terminal',
            light === 'yellow' && 'text-gs-warning',
            light === 'red' && 'text-gs-critical',
            !light && 'text-gs-muted',
          )}
        >
          {score ?? '--'}
        </span>

        {/* Chevron */}
        <span
          className={cn(
            'text-os-xs text-gs-muted transition-transform flex-shrink-0',
            expanded && 'rotate-180',
          )}
        >
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-gs-3 pb-gs-3 border-t border-gs-chrome/50">
          {isLocked ? (
            <p className="font-data text-data-xs text-gs-muted py-gs-2">
              This analysis is classified. Declassify to view findings.
            </p>
          ) : result?.checkpoints && result.checkpoints.length > 0 ? (
            <div className="space-y-gs-1 pt-gs-2">
              {result.checkpoints.slice(0, 3).map((cp) => (
                <div key={cp.id} className="flex justify-between items-center">
                  <span className="font-data text-data-xs text-gs-muted truncate flex-1 mr-gs-2">
                    {cp.name}
                  </span>
                  <span
                    className={cn(
                      'font-data text-data-xs font-bold flex-shrink-0',
                      cp.health === 'excellent' && 'text-gs-terminal',
                      cp.health === 'good' && 'text-gs-terminal',
                      cp.health === 'warning' && 'text-gs-warning',
                      cp.health === 'critical' && 'text-gs-critical',
                      cp.health === 'info' && 'text-gs-red',
                    )}
                  >
                    {cp.health}
                  </span>
                </div>
              ))}
              {result.checkpoints.length > 3 && (
                <p className="font-data text-data-xs text-gs-muted">
                  +{result.checkpoints.length - 3} more checkpoints
                </p>
              )}
            </div>
          ) : (
            <p className="font-data text-data-xs text-gs-muted py-gs-2">
              No checkpoint data available.
            </p>
          )}

          {/* View full detail button */}
          {!isLocked && (
            <button
              onClick={onSelect}
              className="bevel-button-primary w-full text-os-xs mt-gs-2"
            >
              View Full Detail ↻
            </button>
          )}
        </div>
      )}
    </div>
  );
}
