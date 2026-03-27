'use client';

import { useEffect, useState, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Mission Control — Beta Tester Tracker

   Grid of 42 ghost dossiers. Redeemed invites glow pink with
   real user data. Pending ones stay dim. Top stats bar shows
   deployment status. CRT scan-line aesthetic.
   ═══════════════════════════════════════════════════════════════ */

interface Dossier {
  code: string;
  name: string;
  tier: string;
  credits: { scans: number; chat: number };
  redeemed: boolean;
  redeemedAt: string | null;
  user: { email: string; name: string; joinedAt: string } | null;
  activity: { scansRun: number; scansCompleted: number; scansPaid: number; domains: string[] } | null;
  chatMessages: number;
  timeOnSiteMin: number | null;
}

interface BetaData {
  stats: { total: number; redeemed: number; pending: number; totalScans: number; totalChats: number };
  dossiers: Dossier[];
}

/** Tiny 16x16 ghost for each card */
function MiniGhost({ active, size = 16 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2C5.2 2 3 4.2 3 7v5l1-1 1 1 1-1 1 1 1-1 1 1 1-1 1 1V7c0-2.8-2.2-5-5-5z"
        fill={active ? 'var(--gs-base)' : 'oklch(0.30 0.03 340)'}
        opacity={active ? 1 : 0.5}
      />
      {active && (
        <>
          <circle cx="6" cy="6.5" r="0.8" fill="var(--gs-void)" />
          <circle cx="10" cy="6.5" r="0.8" fill="var(--gs-void)" />
        </>
      )}
    </svg>
  );
}

/** Animated scan line (CRT effect) */
function ScanLine() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{
        background: 'linear-gradient(transparent 50%, oklch(0.72 0.17 340 / 0.03) 50%)',
        backgroundSize: '100% 4px',
      }}
    >
      <div
        className="absolute left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, transparent, oklch(0.72 0.17 340 / 0.15), transparent)',
          animation: 'scanline 4s linear infinite',
        }}
      />
    </div>
  );
}

function StatBadge({ label, value, glow }: { label: string; value: number | string; glow?: boolean }) {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        background: glow ? 'oklch(0.15 0.06 340)' : 'oklch(0.12 0.02 340)',
        border: `1px solid ${glow ? 'oklch(0.30 0.10 340)' : 'oklch(0.22 0.03 340)'}`,
        ...(glow ? { boxShadow: '0 0 16px oklch(0.72 0.17 340 / 0.15)' } : {}),
      }}
    >
      <span
        className="font-data font-bold"
        style={{ fontSize: 20, color: glow ? 'var(--gs-base)' : 'var(--gs-light)', lineHeight: 1.1 }}
      >
        {value}
      </span>
      <span className="font-system" style={{ fontSize: 10, color: 'oklch(0.50 0.04 340)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function DossierCard({ d }: { d: Dossier }) {
  const isGuest = d.name.startsWith('Guest');
  const displayName = d.user?.name || d.name;
  const isActive = d.redeemed;

  return (
    <div
      className="relative transition-all duration-300"
      style={{
        borderRadius: 10,
        padding: '10px 12px',
        background: isActive
          ? 'oklch(0.14 0.04 340 / 0.8)'
          : 'oklch(0.10 0.01 340 / 0.5)',
        border: `1px solid ${isActive ? 'oklch(0.30 0.10 340)' : 'oklch(0.18 0.02 340)'}`,
        backdropFilter: 'blur(8px)',
        ...(isActive
          ? {
              boxShadow: '0 0 20px oklch(0.72 0.17 340 / 0.1), inset 0 1px 0 oklch(0.35 0.08 340 / 0.2)',
            }
          : {}),
        minHeight: 72,
      }}
    >
      {/* Top row: ghost + name + status dot */}
      <div className="flex items-center" style={{ gap: 6, marginBottom: 4 }}>
        <MiniGhost active={isActive} />
        <span
          className="font-system font-bold truncate flex-1"
          style={{
            fontSize: 13,
            color: isActive ? 'var(--gs-light)' : 'oklch(0.40 0.03 340)',
            lineHeight: 1.2,
          }}
        >
          {displayName}
        </span>
        {/* Status indicator */}
        <span
          className="rounded-full flex-shrink-0"
          style={{
            width: 7,
            height: 7,
            background: isActive ? 'var(--gs-terminal)' : 'oklch(0.25 0.02 340)',
            boxShadow: isActive ? '0 0 8px oklch(0.72 0.2 145 / 0.6)' : 'none',
          }}
        />
      </div>

      {/* Active: show user details */}
      {isActive && d.user ? (
        <div style={{ paddingLeft: 22 }}>
          <div className="font-data truncate" style={{ fontSize: 12, color: 'oklch(0.55 0.05 340)' }}>
            {d.user.email}
          </div>
          {/* Stats row: date · scans · chats · time · paid badge */}
          <div className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 4 }}>
            <span className="font-data" style={{ fontSize: 12, color: 'oklch(0.45 0.03 340)' }}>
              {new Date(d.user.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {d.activity && d.activity.scansRun > 0 && (
              <span className="font-data flex items-center" style={{ gap: 3, fontSize: 12, color: 'var(--gs-base)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20"/></svg>
                {d.activity.scansRun}
              </span>
            )}
            {d.chatMessages > 0 && (
              <span className="font-data flex items-center" style={{ gap: 3, fontSize: 12, color: 'oklch(0.65 0.12 340)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {d.chatMessages}
              </span>
            )}
            {d.timeOnSiteMin != null && d.timeOnSiteMin > 0 && (
              <span className="font-data flex items-center" style={{ gap: 3, fontSize: 12, color: 'oklch(0.50 0.04 340)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {d.timeOnSiteMin < 60 ? `${d.timeOnSiteMin}m` : `${Math.floor(d.timeOnSiteMin / 60)}h${d.timeOnSiteMin % 60 > 0 ? `${d.timeOnSiteMin % 60}m` : ''}`}
              </span>
            )}
            {d.activity && d.activity.scansPaid > 0 && (
              <span className="font-system font-bold" style={{ fontSize: 10, color: 'var(--gs-terminal)', letterSpacing: '0.05em' }}>
                PAID
              </span>
            )}
          </div>
          {/* Scanned domains */}
          {d.activity && d.activity.domains.length > 0 && (
            <div className="flex flex-wrap" style={{ gap: 4, marginTop: 5 }}>
              {d.activity.domains.map((domain) => (
                <span
                  key={domain}
                  className="font-data"
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'oklch(0.18 0.04 340)',
                    color: 'oklch(0.60 0.08 340)',
                    border: '1px solid oklch(0.25 0.05 340)',
                  }}
                >
                  {domain}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Pending: show invite type */
        <div style={{ paddingLeft: 22 }}>
          <span
            className="font-system"
            style={{
              fontSize: 10,
              color: 'oklch(0.30 0.03 340)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {isGuest ? 'guest link' : 'invited'}
          </span>
        </div>
      )}
    </div>
  );
}

export default function BetaTrackerWindow() {
  const [data, setData] = useState<BetaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function load() {
      try {
        // Cookie is httpOnly — browser sends it automatically, no client-side read needed
        const res = await fetch('/api/admin/beta');
        if (!res.ok) {
          if (res.status === 401) {
            setError('Access denied — admin token required');
          } else {
            setError(`Failed to load (${res.status})`);
          }
          setLoading(false);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        setError('Network error');
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-system text-os-base text-gs-muted animate-blink">
          Establishing uplink...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <MiniGhost active={false} size={32} />
        <span className="font-system text-os-base text-gs-muted">{error}</span>
      </div>
    );
  }

  if (!data) return null;

  // Sort: redeemed first (by redeem date desc), then pending (named before guests)
  const sorted = [...data.dossiers].sort((a, b) => {
    if (a.redeemed && !b.redeemed) return -1;
    if (!a.redeemed && b.redeemed) return 1;
    if (a.redeemed && b.redeemed) {
      return new Date(b.redeemedAt!).getTime() - new Date(a.redeemedAt!).getTime();
    }
    // Pending: named invites before guest invites
    const aGuest = a.name.startsWith('Guest') ? 1 : 0;
    const bGuest = b.name.startsWith('Guest') ? 1 : 0;
    if (aGuest !== bGuest) return aGuest - bGuest;
    return a.name.localeCompare(b.name);
  });

  const { stats } = data;

  return (
    <div className="relative h-full flex flex-col overflow-hidden" style={{ background: 'oklch(0.08 0.01 340)' }}>
      <ScanLine />

      {/* Header */}
      <div
        style={{
          padding: '14px 18px 12px',
          borderBottom: '1px solid oklch(0.18 0.03 340)',
          background: 'oklch(0.10 0.02 340 / 0.9)',
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span className="font-system font-bold" style={{ fontSize: 14, color: 'var(--gs-light)', letterSpacing: '0.04em' }}>
              MISSION CONTROL
            </span>
            <span
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: 'var(--gs-terminal)',
                boxShadow: '0 0 8px oklch(0.72 0.2 145 / 0.8)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span className="font-data" style={{ fontSize: 12, color: 'oklch(0.40 0.03 340)' }}>
              LIVE
            </span>
          </div>
          <span className="font-data" style={{ fontSize: 12, color: 'oklch(0.35 0.03 340)' }}>
            Beta Program v1
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <StatBadge label="Deployed" value={stats.total} />
          <StatBadge label="Active" value={stats.redeemed} glow={stats.redeemed > 0} />
          <StatBadge label="Pending" value={stats.pending} />
          <StatBadge label="Scans" value={stats.totalScans} glow={stats.totalScans > 0} />
          <StatBadge label="Chats" value={stats.totalChats} glow={stats.totalChats > 0} />
          <div className="flex-1" />
          <div
            className="font-data"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: stats.redeemed > 0 ? 'var(--gs-base)' : 'oklch(0.25 0.03 340)',
              lineHeight: 1,
            }}
          >
            {Math.round((stats.redeemed / stats.total) * 100)}%
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto" style={{ padding: 14 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {sorted.map((d) => (
            <DossierCard key={d.code} d={d} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between font-data"
        style={{
          padding: '6px 18px',
          borderTop: '1px solid oklch(0.15 0.02 340)',
          fontSize: 12,
          color: 'oklch(0.30 0.03 340)',
          background: 'oklch(0.08 0.01 340)',
        }}
      >
        <span>{stats.total} invite codes &middot; {stats.redeemed} redeemed</span>
        <span>AlphaScan Beta Program</span>
      </div>

      {/* Scanline keyframe (inline style tag — no styled-jsx dependency) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
      ` }} />
    </div>
  );
}
