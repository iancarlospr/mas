'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { cn, normalizeUrl } from '@/lib/utils';
import { analytics } from '@/lib/analytics';

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
  size?: 'default' | 'large';
  className?: string;
  onCapture?: (url: string, turnstileToken: string) => void | Promise<void>;
}

export function ScanInput({ size = 'default', className, onCapture }: ScanInputProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderTurnstile = useCallback(() => {
    if (!siteKey || !window.turnstile || !turnstileContainerRef.current) return;
    if (turnstileWidgetRef.current) return; // already rendered

    turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, {
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
      theme: 'auto',
      size: 'normal',
    });
  }, [siteKey]);

  useEffect(() => {
    // If turnstile script already loaded, render immediately
    if (window.turnstile && siteKey) {
      renderTurnstile();
    }
  }, [renderTurnstile, siteKey]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = url.trim();
      if (!trimmed) {
        setError('Please enter a URL');
        return;
      }

      const normalized = normalizeUrl(trimmed);
      try {
        new URL(normalized);
      } catch {
        setError('Please enter a valid URL');
        return;
      }

      setLoading(true);
      const token = turnstileTokenRef.current ?? '';

      try {
        if (onCapture) {
          // Delegate to parent (e.g., HeroScanFlow handles auth check)
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
          setError(data.error ?? 'Failed to start scan');
          setLoading(false);
          // Reset turnstile for retry
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
        const message = err instanceof Error && err.message
          ? err.message
          : 'Network error. Please try again.';
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

  const isLarge = size === 'large';

  return (
    <form onSubmit={handleSubmit} className={cn('w-full max-w-2xl', className)}>
      <div
        className={cn(
          'flex items-center bg-surface border border-border rounded-xl shadow-lg transition-shadow focus-within:shadow-xl focus-within:border-accent/30',
          isLarge ? 'p-2' : 'p-1.5',
        )}
      >
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter any URL to scan..."
          className={cn(
            'flex-1 bg-transparent border-none outline-none font-body text-primary placeholder:text-muted',
            isLarge ? 'px-4 py-3 text-lg' : 'px-3 py-2 text-base',
          )}
          disabled={loading}
          autoFocus={isLarge}
        />
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'inline-flex items-center justify-center rounded-lg bg-highlight text-highlight-foreground font-heading font-700 transition-all hover:bg-highlight/90 disabled:opacity-50 disabled:cursor-not-allowed',
            isLarge ? 'px-8 py-3 text-base' : 'px-5 py-2 text-sm',
          )}
        >
          {loading ? (
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            'Scan'
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-error font-medium">{error}</p>
      )}

      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={renderTurnstile}
          />
          <div ref={turnstileContainerRef} className="mt-3" />
        </>
      )}
    </form>
  );
}
