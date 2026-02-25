import Link from 'next/link';

/**
 * GhostScan OS — Dashboard Layout
 * ═══════════════════════════════════════
 *
 * WHAT: Layout wrapper for all dashboard pages (scan, history, chat, report).
 * WHY:  The dashboard lives inside the GhostScan OS environment. This layout
 *       provides a minimal header bar — the Desktop component within individual
 *       pages handles the full OS chrome (Plan Section 6).
 *       Mobile viewport handling moved to scan page itself (viewport hook
 *       conditionally renders MobileDashboard vs BentoDashboard).
 * HOW:  Bevel-raised top bar → children.
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gs-near-white">
      {/* Dashboard header */}
      <header className="sticky top-0 z-50 bg-gs-light bevel-raised border-b-0">
        <div className="mx-auto max-w-7xl px-gs-2 md:px-gs-4">
          <div className="flex h-[44px] items-center justify-between">
            <Link href="/" className="flex items-center gap-gs-2">
              <span className="text-os-lg">👻</span>
              <span className="font-system text-os-base font-bold text-ghost-gradient">
                AlphaScan
              </span>
            </Link>
            <nav className="flex items-center gap-gs-2">
              <Link
                href="/history"
                className="bevel-button text-os-sm"
              >
                My Scans
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-gs-2 py-gs-3 md:px-gs-4 md:py-gs-6">
        {children}
      </main>
    </div>
  );
}
