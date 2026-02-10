'use client';

import { useState } from 'react';

interface ReportPaywallProps {
  scanId: string;
}

export function ReportPaywall({ scanId }: ReportPaywallProps) {
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'alpha_brief', scanId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="font-heading text-h2 text-primary mb-4">
        Unlock the Executive Report
      </h1>
      <p className="text-muted mb-2">
        Get a McKinsey-style marketing technology audit report with:
      </p>
      <ul className="text-sm text-muted text-left max-w-xs mx-auto space-y-2 mb-8">
        <li>- Executive summary and MarketingIQ breakdown</li>
        <li>- ROI impact analysis with dollar estimates</li>
        <li>- Prioritized remediation roadmap (PRD)</li>
        <li>- Cost cutter analysis for tool rationalization</li>
        <li>- 50 AI Chat messages to explore findings</li>
      </ul>
      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-lg text-muted line-through">$29.99</span>
        <span className="font-heading text-h2 text-primary">$9.99</span>
        <span className="text-sm text-muted">one-time</span>
      </div>
      <button
        onClick={handleUnlock}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-highlight text-highlight-foreground px-8 py-3 font-heading font-700 hover:bg-highlight/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Redirecting...' : 'Unlock Report'}
      </button>
    </div>
  );
}
