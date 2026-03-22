/**
 * GhostScan OS — Module Unavailable State
 * ═══════════════════════════════════════════════
 *
 * WHAT: Placeholder for individual modules that couldn't complete analysis.
 * WHY:  Graceful per-module degradation with retro styling (Plan Section 17).
 * HOW:  Semi-transparent bevel-raised card with Chloé personality copy.
 */

interface ModuleUnavailableProps {
  moduleName: string;
  error?: string;
}

export function ModuleUnavailable({ moduleName, error }: ModuleUnavailableProps) {
  return (
    <div className="bevel-raised bg-gs-chrome p-gs-6 opacity-60">
      <div className="flex items-center justify-between mb-gs-2">
        <h3 className="font-system text-os-sm font-bold text-gs-ink">{moduleName}</h3>
        <span className="bevel-sunken bg-gs-warning/20 px-gs-2 py-gs-1 font-data text-data-xs text-gs-warning font-bold">
          Unavailable
        </span>
      </div>
      <p className="font-data text-data-xs text-gs-muted">
        This module couldn&apos;t extract data. The site might be blocking us.
        {error && <> Reason: {error}</>}
      </p>
      <p className="font-data text-data-xs text-gs-muted mt-gs-1">
        Other modules are not affected.
      </p>
    </div>
  );
}
