'use client';

import { useState, useCallback } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * Desktop Bridge Card — nudges mobile users to view the full
 * interactive report on desktop. Includes a copy-URL button.
 */

interface DesktopBridgeCardProps {
  scanId: string;
}

export function DesktopBridgeCard({ scanId }: DesktopBridgeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = `${window.location.origin}/scan/${scanId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [scanId]);

  return (
    <div className="bevel-raised bg-gs-ink/50 p-gs-4 border border-gs-red/15 mt-gs-2">
      <div className="flex items-start gap-gs-3">
        <ChloeSprite state="idle" size={32} className="flex-shrink-0 mt-[2px]" />
        <div className="flex-1 space-y-gs-2">
          <p className="font-data italic text-data-sm text-gs-red leading-relaxed">
            want the full interactive report with 48 visual slides?
          </p>
          <p className="font-data text-data-xs text-gs-muted leading-relaxed">
            open on desktop — it hits different. full OS experience, drag windows around,
            mini-games, the whole vibe.
          </p>
          <button
            onClick={handleCopy}
            className="bevel-button px-gs-3 py-gs-1 font-data text-data-xs"
          >
            {copied ? 'Copied!' : 'Copy link to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
