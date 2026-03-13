'use client';

/**
 * GhostScan OS — Global Error Boundary
 * ═══════════════════════════════════════════
 *
 * WHAT: Root-level error fallback.
 * WHY:  Even catastrophic failures look intentional (Plan Section 17).
 * HOW:  Inline styles only (CSS may not have loaded). Retro aesthetic
 *       maintained with system colors.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gs-ink relative">
      <div className="noise-grain" aria-hidden="true" />
      <div className="text-center max-w-md px-gs-4">
        <div className="text-[64px] mb-gs-4">👻</div>
        <h1 className="font-system text-[32px] font-bold text-gs-paper mb-gs-4">
          System Crash
        </h1>
        <p className="font-data text-data-lg text-gs-muted mb-gs-2">
          An unexpected error occurred.
        </p>
        {error.digest && (
          <p className="font-data text-data-xs text-gs-muted mb-gs-6">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="bevel-button-primary text-os-sm"
        >
          Reboot
        </button>
      </div>
    </div>
  );
}
