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
              placeholder="https://example.com"
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
            <div ref={turnstileContainerRef} className="mt-gs-3" />
          </>
        )}
      </form>
    );
  }

  /* ── Dialog variant (content only — outer window provided by ManagedWindow) ── */
  return (
    <form onSubmit={handleSubmit} className={cn('p-gs-4 space-y-gs-3', className)}>
      {/* URL Input + Button — same row */}
      <div className="flex items-end gap-gs-2">
        <div className="flex-1 min-w-0">
          <label className="block font-system text-os-base mb-gs-1">
            Target URL:
          </label>
          <BevelInput
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://example.com"
            disabled={loading}
            fullWidth
            autoFocus
            className="!h-[36px] !py-0"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'bevel-button-primary h-[36px] whitespace-nowrap flex-shrink-0',
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

      {/* Turnstile widget */}
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={renderTurnstile}
          />
          <div ref={turnstileContainerRef} />
        </>
      )}
    </form>
  );
}
