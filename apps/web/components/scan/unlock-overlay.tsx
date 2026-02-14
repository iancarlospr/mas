'use client';

import Link from 'next/link';

interface UnlockOverlayProps {
  scanId: string;
  /** Number of hidden data points to show in the CTA copy */
  hiddenCount?: number;
  /** Print mode replaces blur with text */
  printFallback?: boolean;
}

export function UnlockOverlay({ scanId, hiddenCount, printFallback }: UnlockOverlayProps) {
  return (
    <>
      {/* Screen overlay */}
      <div className="unlock-overlay absolute inset-x-0 bottom-0 h-[38%] z-10 print:hidden">
        <div className="absolute inset-0 backdrop-blur-md bg-white/60 rounded-b-xl" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
          <p className="text-sm text-muted font-body">
            {hiddenCount != null
              ? `Detailed evidence, recommendations, and ${hiddenCount} additional data points available`
              : 'Detailed evidence and recommendations available'}
          </p>
          <Link
            href={`/report/${scanId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-highlight text-highlight-foreground px-5 py-2.5 text-sm font-heading font-700 hover:bg-highlight/90 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Unlock — $9.99
          </Link>
        </div>
      </div>

      {/* Print fallback */}
      <div className="hidden print:flex absolute inset-x-0 bottom-0 h-[38%] items-center justify-center border-t border-border/30">
        <p className="text-xs text-muted italic">
          Full version at marketingalphascan.com
        </p>
      </div>
    </>
  );
}
