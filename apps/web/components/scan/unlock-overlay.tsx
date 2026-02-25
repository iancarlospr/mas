'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/sound-effects';

/**
 * GhostScan OS — Redaction Overlay (Unlock Gate)
 * ═══════════════════════════════════════════════════
 *
 * WHAT: Replaces the old frosted glass blur with a classified document
 *       redaction aesthetic — black bars over data, CLASSIFIED stamp,
 *       and a "Declassify — $9.99" bevel button.
 * WHY:  The frosted glass was generic SaaS. The redaction aesthetic
 *       matches the dossier/intelligence brand and creates urgency
 *       through concealment rather than blur (Plan Sections 6, 19).
 * HOW:  Black horizontal bars (CSS repeating-linear-gradient) + rotated
 *       CLASSIFIED stamp + lock icon in parent title bar. The button
 *       triggers the Stripe checkout flow via /api/checkout.
 *
 * Visual metaphor: You're looking at a classified document.
 * You can see the SHAPE of the data but not the details.
 * That's what makes you need it.
 */

interface UnlockOverlayProps {
  /** Scan ID for checkout flow */
  scanId: string;
  /** Number of hidden data points */
  hiddenCount?: number;
  /** Overlay mode: 'inline' covers bottom of a module, 'full' covers entire panel */
  mode?: 'inline' | 'full';
  /** Additional CSS classes */
  className?: string;
}

export function UnlockOverlay({
  scanId,
  hiddenCount,
  mode = 'inline',
  className,
}: UnlockOverlayProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  /** Trigger Stripe checkout */
  const handleDeclassify = useCallback(async () => {
    setLoading(true);
    soundEffects.play('buttonClick');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'alpha_brief', scanId }),
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const { url } = await res.json();
      if (url) {
        soundEffects.play('unlock');
        router.push(url);
      }
    } catch {
      setLoading(false);
    }
  }, [scanId, router]);

  return (
    <>
      {/* ── Screen Overlay (Redaction) ───────────────────── */}
      <div
        className={cn(
          'absolute z-10 print:hidden',
          mode === 'inline'
            ? 'inset-x-0 bottom-0 h-[42%]'
            : 'inset-0',
          className,
        )}
      >
        {/* Black bar redaction pattern */}
        <div
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              var(--gs-ink) 0px,
              var(--gs-ink) 12px,
              transparent 12px,
              transparent 16px
            )`,
            opacity: 0.82,
          }}
        />

        {/* CLASSIFIED stamp */}
        <div className="redacted-stamp" aria-hidden="true">
          CLASSIFIED
        </div>

        {/* CTA content */}
        <div className="relative z-20 flex flex-col items-center justify-center h-full gap-gs-3 px-gs-4">
          {/* Descriptor text */}
          <p className="font-data text-data-sm text-gs-paper text-center max-w-[300px]">
            {hiddenCount != null
              ? `${hiddenCount} data points redacted. Full evidence & recommendations classified.`
              : 'Evidence & recommendations classified.'}
          </p>

          {/* Declassify button */}
          <button
            onClick={handleDeclassify}
            disabled={loading}
            className={cn(
              'bevel-button-primary min-w-[180px] whitespace-nowrap text-os-xs md:text-os-sm',
              loading && 'cursor-wait opacity-70',
            )}
          >
            {loading ? (
              <span className="flex items-center gap-gs-2">
                <span className="animate-blink">⏳</span>
                Connecting...
              </span>
            ) : (
              <>🔓 Declassify — $9.99</>
            )}
          </button>
        </div>
      </div>

      {/* ── Print Fallback ───────────────────────────────── */}
      <div className="hidden print:flex absolute inset-x-0 bottom-0 h-[38%] items-center justify-center border-t" style={{ borderColor: 'var(--gs-chrome-dark)' }}>
        <p className="font-data text-data-xs text-gs-muted italic">
          Full dossier at marketingalphascan.com
        </p>
      </div>
    </>
  );
}
