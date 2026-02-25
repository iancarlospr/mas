'use client';

import { useState } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

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
    <div className="max-w-lg mx-auto text-center py-gs-12">
      <ChloeSprite state="smug" size={64} glowing className="mx-auto mb-gs-6" />

      <h1 className="font-system text-[clamp(20px,3vw,32px)] font-bold text-gs-black mb-gs-4">
        Declassify the Executive Report
      </h1>
      <p className="font-data text-data-sm text-gs-mid mb-gs-2">
        The full intelligence dossier with:
      </p>
      <ul className="font-data text-data-sm text-gs-mid text-left max-w-xs mx-auto space-y-gs-2 mb-gs-6">
        <li className="flex items-start gap-gs-2">
          <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
          <span>Executive summary and MarketingIQ breakdown</span>
        </li>
        <li className="flex items-start gap-gs-2">
          <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
          <span>ROI impact analysis with dollar estimates</span>
        </li>
        <li className="flex items-start gap-gs-2">
          <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
          <span>Prioritized remediation roadmap (PRD)</span>
        </li>
        <li className="flex items-start gap-gs-2">
          <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
          <span>Cost cutter analysis for tool rationalization</span>
        </li>
        <li className="flex items-start gap-gs-2">
          <span className="text-gs-terminal font-bold flex-shrink-0">☑</span>
          <span>15 Chloe chat questions</span>
        </li>
      </ul>
      <div className="flex items-center justify-center gap-gs-2 mb-gs-6">
        <span className="font-data text-data-sm text-gs-mid-light line-through">$29.99</span>
        <span className="font-data text-data-hero text-gs-black">$9.99</span>
        <span className="font-data text-data-xs text-gs-mid">one-time</span>
      </div>
      <button
        onClick={handleUnlock}
        disabled={loading}
        className="bevel-button-primary text-os-base px-gs-8 disabled:opacity-50"
      >
        {loading ? '⏳ Redirecting...' : 'Declassify — $9.99'}
      </button>
    </div>
  );
}
