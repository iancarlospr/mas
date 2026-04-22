'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useWindowManager } from '@/lib/window-manager';
import { HeroScanFlow } from '@/components/scan/hero-scan-flow';

/* ═══════════════════════════════════════════════════════════════
   Scan.exe — URL Input Dialog Window

   ASCII banner title + scan URL input.
   ═══════════════════════════════════════════════════════════════ */

const ASCII_TITLE = `
 █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`.trim();

function CurvedArrow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      if (!ref.current) return;
      frame++;
      const y = Math.sin(frame * 0.08) * 6;
      ref.current.style.transform = `translateY(${y}px)`;
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      ref={ref}
      className="font-marker select-none"
      style={{ marginTop: 'clamp(8px, 2.4vh, 24px)' }}
    >
      <span
        style={{
          fontSize: 'clamp(32px, 5.5vh, 52px)',
          color: 'var(--gs-base)',
          display: 'block',
          lineHeight: '0.7',
        }}
      >
        &#8595;
      </span>
    </div>
  );
}

function CreditIndicator() {
  const { user, isAuthenticated } = useAuth();
  const wm = useWindowManager();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [scanCount, setScanCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    async function load() {
      const supabase = createClient();
      const [creditsRes, scansRes] = await Promise.all([
        supabase.from('scan_credits').select('remaining').eq('user_id', user!.id).maybeSingle(),
        supabase.from('scans').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);
      setRemaining(creditsRes.data?.remaining ?? 0);
      setScanCount(scansRes.count ?? 0);
    }

    load();
  }, [isAuthenticated, user]);

  // Not authenticated or still loading
  if (!isAuthenticated || remaining == null || scanCount == null) return null;

  // First visit: 1 credit, never scanned — don't confuse new users
  if (remaining === 1 && scanCount === 0) return null;

  const hasCredits = remaining > 0;

  const content = hasCredits ? (
    <span><span style={{ color: 'var(--gs-base)', fontWeight: 600 }}>{remaining}</span> scan{remaining !== 1 ? 's' : ''} remaining</span>
  ) : (
    <span>0 scans remaining — <span style={{ color: 'var(--gs-base)', fontWeight: 600 }}>Upgrade</span></span>
  );

  const pillClass = "font-data inline-flex items-center rounded-full";
  const pillStyle = {
    fontSize: '11px',
    padding: '3px 10px',
    background: 'rgba(255,178,239,0.08)',
    border: '1px solid rgba(255,178,239,0.15)',
    color: 'var(--gs-mid)',
  };

  return (
    <div className="flex justify-center select-none" style={{ marginBottom: '2px' }}>
      {hasCredits ? (
        <div className={pillClass} style={pillStyle}>{content}</div>
      ) : (
        <button
          onClick={() => wm.openWindow('pricing')}
          className={`${pillClass} transition-opacity hover:opacity-80`}
          style={{ ...pillStyle, cursor: 'pointer' }}
        >
          {content}
        </button>
      )}
    </div>
  );
}

export default function ScanInputWindow() {
  // Cap root at the same height the parent window uses: 85vh - 44 (taskbar)
  // - 32 (titlebar) - 42 (dither strip + borders) = 85vh - 118.
  // Below this the flex spacer absorbs the leftover, then collapses to keep
  // everything inside without a .window-content scrollbar.
  return (
    <div
      className="p-gs-4 flex flex-col items-center overflow-hidden"
      style={{ maxHeight: 'calc(85vh - 118px)' }}
    >
      {/* ASCII Title */}
      <div
        className="flex justify-center"
        style={{ marginTop: 'clamp(4px, 1.6vh, 16px)', flexShrink: 0 }}
      >
        <pre
          className="font-data leading-none whitespace-pre select-none text-center"
          style={{
            fontSize: 'clamp(7px, 1.4vh, 12px)',
            lineHeight: '1.05',
            color: 'var(--gs-base)',
            textShadow: '0 0 8px var(--gs-base), 0 0 20px rgba(255,178,239,0.3)',
          }}
        >
          {ASCII_TITLE}
        </pre>
      </div>

      {/* Headline */}
      <div
        className="text-center select-none"
        style={{ marginTop: 'clamp(8px, 2.5vh, 24px)', flexShrink: 0 }}
      >
        <p
          className="font-display"
          style={{
            fontSize: 'clamp(18px, 3vh, 26px)',
            fontWeight: 300,
            lineHeight: '1.3',
            letterSpacing: '-0.01em',
            color: 'var(--gs-light)',
          }}
        >
          Your website is losing you money.
        </p>
        <p
          className="font-marker"
          style={{
            fontSize: 'clamp(22px, 3.8vh, 32px)',
            lineHeight: '1.2',
            letterSpacing: '-0.06em',
            color: 'var(--gs-base)',
            marginTop: 'clamp(2px, 0.7vh, 6px)',
          }}
        >
          Let&apos;s fix that.
        </p>
      </div>

      {/* Flex spacer: up to 120px on tall viewports, shrinks to 0 when tight */}
      <div style={{ flex: '0 1 120px', minHeight: 0 }} />

      {/* Nudge CTA + Arrow */}
      <div
        className="flex flex-col items-center select-none"
        style={{ marginBottom: 'clamp(4px, 1.6vh, 16px)', flexShrink: 0 }}
      >
        <p
          className="font-data"
          style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--gs-mid)',
          }}
        >
          MarTech breakdown. Strategic insights. Actionable recommendations.
        </p>
        <CurvedArrow />
      </div>

      <div className="w-full" style={{ flexShrink: 0 }}>
        <CreditIndicator />
        <HeroScanFlow />
      </div>
    </div>
  );
}
