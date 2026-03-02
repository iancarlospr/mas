'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { cn, normalizeUrl } from '@/lib/utils';
import { analytics } from '@/lib/analytics';
import { soundEffects } from '@/lib/sound-effects';
import { BevelInput } from '@/components/os/bevel-input';

/**
 * GhostScan OS — Scan Input (Win95 Dialog)
 * ═══════════════════════════════════════════
 *
 * WHAT: URL input for starting a new scan, redesigned as a Win95 dialog.
 * WHY:  The scan input is the first functional interaction. It must
 *       immediately establish the GhostScan OS aesthetic and Chloé's
 *       presence (Plan Section 5 — URL Input).
 * HOW:  Uses <Window variant="dialog"> with sunken bevel input,
 *       gradient primary button, and Chloé floating nearby with
 *       a greeting speech bubble. Turnstile widget positioned below.
 *
 * Preserves all existing functionality: URL normalization, validation,
 * Turnstile bot protection, API call to /api/scans, error handling.
 * Visual only — no backend changes.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface ScanInputProps {
  /** Display variant */
  variant?: 'dialog' | 'inline';
  /** Additional CSS classes */
  className?: string;
  /** Delegate scan handling to parent (e.g., HeroScanFlow handles auth) */
  onCapture?: (url: string, turnstileToken: string) => void | Promise<void>;
}

export function ScanInput({
  variant = 'dialog',
  className,
  onCapture,
}: ScanInputProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  /* ── Turnstile integration ─────── */

  const renderTurnstile = useCallback(() => {
    if (!siteKey || !window.turnstile || !turnstileContainerRef.current) return;
    if (turnstileWidgetRef.current) return;

    turnstileWidgetRef.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey: siteKey,
        callback: (token: string) => {
          turnstileTokenRef.current = token;
        },
        'expired-callback': () => {
          turnstileTokenRef.current = null;
        },
        'error-callback': () => {
          turnstileTokenRef.current = null;
        },
        theme: 'dark',
        size: 'normal',
      },
    );
  }, [siteKey]);

  useEffect(() => {
    if (window.turnstile && siteKey) {
      renderTurnstile();
    }
  }, [renderTurnstile, siteKey]);

  /* ── Submit handler (preserved from original) ────────────── */

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = url.trim();
      if (!trimmed) {
        setError('Enter a URL, operative.');
        return;
      }

      const normalized = normalizeUrl(trimmed);
      try {
        new URL(normalized);
      } catch {
        setError("That's not a valid URL. Try again.");
        return;
      }

      setLoading(true);
      soundEffects.play('buttonClick');
      const token = turnstileTokenRef.current ?? '';

      try {
        if (onCapture) {
          await onCapture(normalized, token);
          return;
        }

        const res = await fetch('/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: normalized,
            turnstileToken: token,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? 'Scan failed to initialize.');
          setLoading(false);
          if (window.turnstile && turnstileWidgetRef.current) {
            window.turnstile.reset(turnstileWidgetRef.current);
            turnstileTokenRef.current = null;
          }
          return;
        }

        const { scanId } = await res.json();
        analytics.scanStarted(new URL(normalized).hostname, 'full');
        router.push(`/scan/${scanId}`);
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Network error. Try again.';
        setError(message);
        setLoading(false);
        if (window.turnstile && turnstileWidgetRef.current) {
          window.turnstile.reset(turnstileWidgetRef.current);
          turnstileTokenRef.current = null;
        }
      }
    },
    [url, router, onCapture],
  );

  /* ── Inline variant (for embedding in other layouts) ─────── */
  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className={cn('w-full', className)}>
        <div className="flex items-end gap-gs-2">
          <div className="flex-1">
            <BevelInput
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter URL (nike.com)"
              disabled={loading}
              fullWidth
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'bevel-button-primary',
              loading && 'cursor-wait opacity-70',
            )}
          >
            {loading ? 'Scanning...' : 'Execute Scan'}
          </button>
        </div>
        {error && (
          <p className="mt-gs-2 font-data text-data-sm text-gs-critical">{error}</p>
        )}
        {siteKey && (
          <>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="afterInteractive"
              onLoad={renderTurnstile}
            />
            <div
              className="mt-gs-3 flex justify-center"
              style={{
                opacity: 0.5,
                transform: 'scale(0.85)',
                transformOrigin: 'center',
                filter: 'grayscale(0.3) brightness(0.8)',
                borderRadius: '10px',
                overflow: 'hidden',
                transition: 'opacity 300ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
            >
              <div ref={turnstileContainerRef} />
            </div>
          </>
        )}
      </form>
    );
  }

  /* ── Dialog variant (content only — outer window provided by ManagedWindow) ── */
  return (
    <form onSubmit={handleSubmit} className={cn('p-gs-4 space-y-gs-3', className)}>
      <style>{`
        @keyframes border-sweep {
          0% { background-position: 0% 50%; }
          8% { background-position: 30% 50%; }
          12% { background-position: 25% 50%; }
          16% { background-position: 35% 50%; }
          20% { background-position: 28% 50%; }
          35% { background-position: 55% 50%; }
          40% { background-position: 50% 50%; }
          44% { background-position: 58% 50%; }
          48% { background-position: 52% 50%; }
          55% { background-position: 60% 50%; }
          65% { background-position: 80% 50%; }
          70% { background-position: 75% 50%; }
          74% { background-position: 82% 50%; }
          85% { background-position: 100% 50%; }
          90% { background-position: 95% 50%; }
          95% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes input-shine {
          0% { left: -30%; }
          100% { left: 130%; }
        }
        .scan-input-glow {
          position: relative;
          border-radius: 10px;
          padding: 3px;
          background: linear-gradient(
            90deg,
            rgba(255,178,239,0.3) 0%,
            rgba(255,178,239,0.3) 40%,
            var(--gs-base) 50%,
            rgba(255,178,239,0.3) 60%,
            rgba(255,178,239,0.3) 100%
          );
          background-size: 300% 100%;
          animation: border-sweep 30s linear infinite;
        }
        .scan-input-shine {
          position: relative;
          overflow: hidden;
        }
        .scan-input-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -30%;
          width: 15%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.12) 30%,
            rgba(255,255,255,0.22) 50%,
            rgba(255,255,255,0.12) 70%,
            transparent 100%
          );
          animation: input-shine 8s ease-in-out infinite;
          pointer-events: none;
          border-radius: inherit;
        }
      `}</style>

      {/* URL Input + Button */}
      <div className="flex items-end gap-gs-2">
        <div className="flex-1 min-w-0">
          <label className="block font-system text-os-base mb-gs-1">
            Target URL:
          </label>
          <div className="scan-input-glow scan-input-shine rounded-lg">
            <BevelInput
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter URL (nike.com)"
              disabled={loading}
              fullWidth
              autoFocus
              className="!h-[36px] !py-0 !text-gs-void !bg-gs-light/90 !placeholder:text-gs-mid !border-0 !ring-0 !rounded-[7px]"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'bevel-button-primary h-[42px] whitespace-nowrap flex-shrink-0 text-[14px]',
            loading && 'cursor-wait',
          )}
          style={{ padding: '0 18px' }}
        >
          {loading ? (
            <span className="flex items-center gap-gs-2">
              <span className="animate-blink">...</span>
              Scanning...
            </span>
          ) : (
            '▶ Execute Scan'
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bevel-sunken bg-gs-paper px-gs-3 py-gs-2">
          <p className="font-data text-data-sm text-gs-critical">
            {error}
          </p>
        </div>
      )}

      {/* Turnstile widget — styled to blend with OS theme */}
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={renderTurnstile}
          />
          <div
            className="flex justify-center"
            style={{
              opacity: 0.5,
              transform: 'scale(0.85)',
              transformOrigin: 'center',
              filter: 'grayscale(0.3) brightness(0.8)',
              borderRadius: '10px',
              overflow: 'hidden',
              transition: 'opacity 300ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
          >
            <div ref={turnstileContainerRef} />
          </div>
        </>
      )}
    </form>
  );
}
