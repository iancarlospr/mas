'use client';

import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="font-heading font-700 text-3xl text-primary">
        Something went wrong
      </h1>
      <p className="mt-4 text-muted-foreground max-w-md text-center">
        An error occurred while loading this page. Please try again or go back to your scans.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground/60 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8 flex gap-4">
        <button
          onClick={reset}
          className="bg-[#0F3460] text-white rounded-lg px-6 py-3 font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/history"
          className="border border-border rounded-lg px-6 py-3 font-heading font-700 text-primary hover:bg-muted transition-colors"
        >
          My Scans
        </Link>
      </div>
    </div>
  );
}
