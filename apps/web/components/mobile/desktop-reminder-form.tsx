'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Script from 'next/script';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function DesktopReminderForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (status === 'sending') return;

      const token = turnstileTokenRef.current ?? '';
      if (!token && siteKey) {
        setErrorMsg('security check loading — try again in a sec');
        setStatus('error');
        return;
      }

      setStatus('sending');
      setErrorMsg(null);

      try {
        const res = await fetch('/api/desktop-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, turnstileToken: token }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'something went wrong');
        }

        setStatus('sent');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'something went wrong');
        setStatus('error');
        if (window.turnstile && turnstileWidgetRef.current) {
          window.turnstile.reset(turnstileWidgetRef.current);
          turnstileTokenRef.current = null;
        }
      }
    },
    [email, status, siteKey],
  );

  if (status === 'sent') {
    return (
      <p className="font-data text-data-xs text-gs-base italic">
        sent! check your inbox.
      </p>
    );
  }

  /* Turnstile normal widget = 300px wide. Lock the entire block to that width. */
  return (
    <div style={{ width: 300, maxWidth: '100%' }}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Input — top, rounded top corners only */}
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'sending'}
          className="w-full h-[38px] px-gs-3 font-data text-[13px]
                     border border-gs-mid/30 bg-gs-light/10 text-gs-light
                     placeholder:text-gs-mid/50 focus:border-gs-base/60
                     focus:outline-none transition-colors select-text"
          style={{
            caretColor: 'var(--gs-base)',
            borderRadius: '7px 7px 0 0',
            borderBottom: 'none',
          }}
        />
        {/* Button — middle, no rounded corners */}
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full h-[38px] font-data text-[13px] font-bold transition-colors
                     border border-transparent"
          style={{
            background: 'var(--gs-base)',
            color: 'var(--gs-void)',
            borderRadius: siteKey ? '0' : '0 0 7px 7px',
          }}
        >
          {status === 'sending' ? '...' : 'Send link'}
        </button>
      </form>
      {/* Turnstile — bottom, rounded bottom corners */}
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={renderTurnstile}
          />
          <div
            style={{
              borderRadius: '0 0 7px 7px',
              overflow: 'hidden',
              opacity: 0.6,
              filter: 'grayscale(0.3) brightness(0.8)',
            }}
          >
            <div ref={turnstileContainerRef} />
          </div>
        </>
      )}
      {errorMsg && (
        <p className="font-data text-data-xs text-gs-critical mt-gs-2">{errorMsg}</p>
      )}
    </div>
  );
}
