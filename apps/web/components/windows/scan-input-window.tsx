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
    <div ref={ref} className="font-marker select-none" style={{ marginTop: '24px' }}>
      <span
        style={{
          fontSize: '52px',
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

  return (
    <div
      className="font-data select-none text-center"
      style={{ fontSize: '11px', marginBottom: '6px' }}
    >
      {remaining > 0 ? (
        <span style={{ color: 'var(--gs-mid)' }}>
          ⬡ {remaining} scan{remaining !== 1 ? 's' : ''} remaining
        </span>
      ) : (
        <span style={{ color: 'var(--gs-mid)' }}>
          ⬡ 0 scans remaining —{' '}
          <button
            onClick={() => wm.openWindow('pricing')}
            className="underline hover:text-gs-base transition-colors"
            style={{ color: 'var(--gs-base)' }}
          >
            Upgrade
          </button>
        </span>
      )}
    </div>
  );
}

export default function ScanInputWindow() {
  return (
    <div className="p-gs-4 flex flex-col items-center h-full">
      {/* ASCII Title */}
      <div className="flex justify-center" style={{ marginTop: '16px' }}>
        <pre
          className="font-data leading-none whitespace-pre select-none text-center"
          style={{
            fontSize: '12px',
            lineHeight: '1.05',
            color: 'var(--gs-base)',
            textShadow: '0 0 8px var(--gs-base), 0 0 20px rgba(255,178,239,0.3)',
          }}
        >
          {ASCII_TITLE}
        </pre>
      </div>

      {/* Headline */}
      <div className="text-center select-none" style={{ marginTop: '24px' }}>
        <p
          className="font-display"
          style={{
            fontSize: '26px',
            fontWeight: 300,
            lineHeight: '1.3',
            letterSpacing: '-0.01em',
            color: 'var(--gs-light)',
          }}
        >
          Babe, your website is losing you money.
        </p>
        <p
          className="font-marker"
          style={{
            fontSize: '32px',
            lineHeight: '1.2',
            letterSpacing: '-0.06em',
            color: 'var(--gs-base)',
            marginTop: '6px',
          }}
        >
          Let&apos;s fix that.
        </p>
      </div>

      {/* Spacer between headline and CTA */}
      <div style={{ height: '120px' }} />

      {/* Nudge CTA + Arrow */}
      <div className="flex flex-col items-center select-none" style={{ marginBottom: '8px' }}>
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

      <CreditIndicator />

      <div className="w-full">
        <HeroScanFlow />
      </div>
    </div>
  );
}
