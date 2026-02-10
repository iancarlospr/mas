'use client';

import { useState } from 'react';

interface PartialResultsProps {
  errorCount: number;
}

export function PartialResults({ errorCount }: PartialResultsProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-3 flex items-center justify-between">
      <p className="text-sm text-warning">
        This scan completed with partial results. {errorCount} module{errorCount !== 1 ? 's' : ''}{' '}
        encountered issues. MarketingIQ is based on available data.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-warning hover:text-warning/80 text-sm ml-4"
      >
        Dismiss
      </button>
    </div>
  );
}
