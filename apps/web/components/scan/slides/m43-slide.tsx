'use client';

import { useRef, useEffect } from 'react';
import type { ScanWithResults, ModuleResult } from '@marketing-alpha/types';
import { useWindowManager } from '@/lib/window-manager';
import { analytics } from '@/lib/analytics';

/**
 * M43 Slide — The Closer
 * ═══════════════════════
 *
 * This is the LAST slide. After 40+ module analyses, this converts.
 * Two paths: download the remediation PDF, or get live AI help via GhostChat.
 *
 * GhostChat is the revenue hero — prominently featured with breathing glow,
 * personalized example questions, and a bold CTA.
 *
 * Layout:
 *   Top center: ASCII brand (large, triple-layer pink glow)
 *   Middle: Bold headline + priority stat row
 *   Dither divider
 *   Bottom: Two CTA cards — PDF (35%, secondary) | GhostChat (60%, hero)
 *
 * Paid module — only renders for paid scans with M43 data.
 */

const ASCII_BRAND = `
 █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗
██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`.trim();

const BAYER8 = [
  [ 0,32, 8,40, 2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],
  [60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],
  [51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],
  [63,31,55,23,61,29,53,21],
];

// ── Typography scale (cqi) — 12px minimum ───────────────────────────
const T = {
  brand:     'clamp(1px, 0.45cqi, 7px)',
  overline:  'clamp(1px, 0.98cqi, 14px)',
  headline:  'clamp(1px, 2.40cqi, 42px)',
  sub:       'clamp(1px, 1.01cqi, 15px)',
  stat:      'clamp(1px, 2.85cqi, 46px)',
  statLabel: 'clamp(1px, 0.90cqi, 14px)',
  cardTitle: 'clamp(1px, 1.50cqi, 22px)',
  cardBody:  'clamp(1px, 1.01cqi, 15px)',
  cta:       'clamp(1px, 1.12cqi, 17px)',
  bubble:    'clamp(1px, 1.01cqi, 15px)',
};

export function M43Slide({ scan, printMode }: { scan: ScanWithResults; printMode?: boolean }) {
  const wm = useWindowManager();
  const ditherRef = useRef<HTMLCanvasElement>(null);
  const ditherContainerRef = useRef<HTMLDivElement>(null);

  // Bayer dither divider — canvas renders once on mount
  useEffect(() => {
    const canvas = ditherRef.current;
    const container = ditherContainerRef.current;
    if (!canvas || !container) return;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;

    const px = 2;
    const cols = Math.ceil(w / px);
    const rows = Math.ceil(h / px);

    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.imageRendering = 'pixelated';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(cols, rows);
    const d = imageData.data;
    const pr = 255, pg = 178, pb = 239;

    for (let y = 0; y < rows; y++) {
      const yRatio = y / rows;
      const vIntensity = 1 - Math.abs(yRatio - 0.5) * 2;
      for (let x = 0; x < cols; x++) {
        const xRatio = x / cols;
        const hIntensity = Math.sin(xRatio * Math.PI);
        const intensity = vIntensity * hIntensity * 0.3;
        const threshold = (BAYER8[y % 8]![x % 8]!) / 64;
        const idx = (y * cols + x) * 4;
        if (intensity > threshold) {
          d[idx] = pr;
          d[idx + 1] = pg;
          d[idx + 2] = pb;
          d[idx + 3] = Math.round(intensity * 255 * 0.7);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // ── Data extraction ──────────────────────────────────────────────
  const rm = new Map<string, ModuleResult>(scan.moduleResults.map((r) => [r.moduleId, r]));
  const m43 = rm.get('M43');
  if (!m43 || m43.status !== 'success') return null;

  const data = m43.data as Record<string, unknown>;
  const metadata = data['metadata'] as Record<string, unknown> | undefined;
  if (!metadata) return null;

  const p0 = (metadata['p0Count'] as number) ?? 0;
  const p1 = (metadata['p1Count'] as number) ?? 0;
  const p2 = (metadata['p2Count'] as number) ?? 0;
  const p3 = (metadata['p3Count'] as number) ?? 0;
  const total = (metadata['totalFindings'] as number) ?? (p0 + p1 + p2 + p3);
  const weeks = (metadata['estimatedTimelineWeeks'] as number) ?? 0;

  const pdfUrl = `/api/reports/${scan.id}/prd`;
  const handleAskChloe = () => {
    const chatId = `chat-${scan.id}`;
    if (wm.windows[chatId]?.isOpen) {
      wm.focusWindow(chatId);
      return;
    }
    wm.registerWindow(chatId, {
      title: `Ask Chloé — ${scan.domain ?? ''}`,
      width: 380,
      height: 480,
      minWidth: 340,
      minHeight: 400,
      componentType: 'ghost-chat',
    });
    wm.openWindow(chatId, { scanId: scan.id, domain: scan.domain });
  };

  const priorities = [
    { key: 'P0', count: p0, color: 'var(--gs-critical)', label: 'Critical' },
    { key: 'P1', count: p1, color: 'var(--gs-warning)', label: 'This Week' },
    { key: 'P2', count: p2, color: 'var(--gs-base)', label: 'This Month' },
    { key: 'P3', count: p3, color: 'var(--gs-mid)', label: 'Backlog' },
  ].filter(p => p.count > 0);

  const exampleQuestions = [
    'What quick wins can I show my boss by Friday?',
    p0 > 0
      ? `Which of these ${p0} critical findings should my dev team tackle first?`
      : 'What should my dev team prioritize first?',
    'Walk me through setting up server-side tracking on our stack',
    'Is our current analytics setup actually losing us conversion data?',
    'Can we cut our $2k/mo tool stack without losing functionality?',
    'Write me a Slack message to send my agency about these findings',
  ];

  return (
    <div
      className="slide-card relative overflow-hidden select-none"
      data-slide-id="Remediation Roadmap"
      style={{
        aspectRatio: '14 / 8.5',
        background: 'var(--gs-void)',
        borderRadius: '2px',
        containerType: 'inline-size',
      }}
    >
      {/* Scoped animation */}
      <style>{`
        @keyframes m43-breathe {
          0%, 100% {
            box-shadow: 0 0 24px rgba(255,178,239,0.12), 0 0 60px rgba(255,178,239,0.06), inset 0 0 20px rgba(255,178,239,0.03);
            border-color: rgba(255,178,239,0.2);
          }
          50% {
            box-shadow: 0 0 40px rgba(255,178,239,0.24), 0 0 80px rgba(255,178,239,0.1), inset 0 0 30px rgba(255,178,239,0.05);
            border-color: rgba(255,178,239,0.38);
          }
        }
        .m43-cta-primary:hover {
          filter: brightness(1.1);
          box-shadow: 0 0 30px rgba(255,178,239,0.4), 0 6px 16px rgba(0,0,0,0.4) !important;
        }
        .m43-cta-secondary:hover {
          background: rgba(255,178,239,0.06) !important;
          border-color: rgba(255,178,239,0.3) !important;
        }
        @keyframes m43-text-bloom {
          0% { background-position: 200% center; }
          100% { background-position: -100% center; }
        }
        @keyframes m43-text-glow {
          0% { text-shadow: none; }
          35% { text-shadow: none; }
          50% { text-shadow: 0 0 6px rgba(230,225,240,0.5), 0 0 14px rgba(230,225,240,0.2); }
          65% { text-shadow: none; }
          100% { text-shadow: none; }
        }
        .m43-text-bloom {
          background: linear-gradient(90deg,
            rgba(220,215,230,0.85) 0%,
            rgba(220,215,230,0.85) 40%,
            #fff 49%, rgba(240,238,245,1) 50%, #fff 51%,
            rgba(220,215,230,0.85) 60%,
            rgba(220,215,230,0.85) 100%
          );
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: m43-text-bloom 6s linear infinite, m43-text-glow 6s linear infinite;
        }
      `}</style>

      {/* Atmospheric radial glow — top center behind logo */}
      <div className="absolute pointer-events-none" style={{
        top: '-5%', left: '50%', transform: 'translateX(-50%)',
        width: '70%', height: '50%',
        background: 'radial-gradient(ellipse at center, rgba(255,178,239,0.06) 0%, transparent 65%)',
      }} />

      {/* Secondary glow — bottom right behind PRD card */}
      <div className="absolute pointer-events-none" style={{
        bottom: '-10%', right: '8%',
        width: '50%', height: '55%',
        background: 'radial-gradient(ellipse at center, rgba(255,178,239,0.07) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 h-full flex flex-col" style={{ padding: '1.2% 3.5% 1.5%' }}>

        {/* ═══ ASCII Brand — centered, triple-layer glow ═══ */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <pre
            className="font-data leading-none whitespace-pre select-none"
            style={{
              fontSize: T.brand,
              lineHeight: '1.1',
              color: 'var(--gs-base)',
              textShadow: '0 0 18px rgba(255,178,239,0.3), 0 0 40px rgba(255,178,239,0.12), 0 0 80px rgba(255,178,239,0.06)',
              display: 'inline-block',
            }}
          >
            {ASCII_BRAND}
          </pre>
          <div className="font-display uppercase" style={{
            fontSize: T.overline,
            letterSpacing: '0.3em',
            color: 'var(--gs-base)',
            opacity: 0.7,
            marginTop: '0.5em',
          }}>
            Remediation Plan
          </div>
        </div>

        {/* ═══ Headline ═══ */}
        <div style={{ textAlign: 'center', margin: '0.5em 0 0.4em', flexShrink: 0 }}>
          <h2 className="font-display" style={{
            fontSize: T.headline,
            fontWeight: 700,
            lineHeight: 1.15,
            color: 'var(--gs-light)',
          }}>
            {total} problems. Every fix. Your move.
          </h2>
        </div>

        {/* ═══ Priority stat row ═══ */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4%',
          flexShrink: 0,
        }}>
          {priorities.map(p => (
            <div key={p.key} style={{ textAlign: 'center' }}>
              <p className="font-data tabular-nums" style={{
                fontSize: T.stat, fontWeight: 700, color: p.color, lineHeight: 1,
              }}>
                {p.count}
              </p>
              <p className="font-data uppercase" style={{
                fontSize: T.statLabel, color: p.color, opacity: 0.6,
                letterSpacing: '0.08em', marginTop: '0.1em',
              }}>
                {p.key} &middot; {p.label}
              </p>
            </div>
          ))}
          {weeks > 0 && (
            <div style={{ textAlign: 'center' }}>
              <p className="font-data tabular-nums" style={{
                fontSize: T.stat, fontWeight: 700, color: 'var(--gs-light)', lineHeight: 1,
              }}>
                ~{weeks}w
              </p>
              <p className="font-data" style={{
                fontSize: T.statLabel, color: 'var(--gs-mid)', marginTop: '0.1em',
              }}>
                Timeline
              </p>
            </div>
          )}
        </div>

        {/* ═══ Bayer dither divider ═══ */}
        <div
          ref={ditherContainerRef}
          style={{ height: '8px', margin: '0.6em 8%', flexShrink: 0 }}
        >
          <canvas ref={ditherRef} />
        </div>

        {/* ═══ CTA Cards ═══ */}
        <div style={{
          display: 'flex',
          flex: '1 1 0',
          minHeight: 0,
          gap: '3%',
        }}>

          {/* ── GhostChat Card (small left) ── */}
          <div style={{
            flex: '1 1 35%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '2.5% 3.5%',
            border: '1px solid rgba(255,178,239,0.08)',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <p className="font-display uppercase" style={{
              fontSize: T.cardTitle, fontWeight: 700,
              color: 'var(--gs-light)', letterSpacing: '0.04em',
              marginBottom: '0.3em',
            }}>
              GhostChat&trade;
            </p>

            <p className="font-data" style={{
              fontSize: T.cardBody, color: 'var(--gs-mid)',
              lineHeight: 1.55, marginBottom: '0.5em',
            }}>
              Your AI marketing strategist who memorized every finding
              in your audit. Ask anything &mdash; she&apos;ll walk you through it.
            </p>

            {/* Example questions — personalized */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              gap: '0.25em', marginBottom: '0.7em',
            }}>
              {exampleQuestions.map((q, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: i === 0 ? 'center' : 'baseline', gap: '0.4em',
                  ...(i === 0 ? {
                    background: 'rgba(255,178,239,0.08)',
                    borderLeft: '2px solid var(--gs-base)',
                    padding: '0.3em 0.5em',
                    borderRadius: '0 3px 3px 0',
                    marginLeft: '-0.5em',
                  } : {}),
                }}>
                  {i === 0 ? (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--gs-base)" style={{ flexShrink: 0, opacity: 0.7 }}>
                      <path d="M8 1C5.2 1 3 3.2 3 6v6l1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5 1-1.5 1 1.5V6c0-2.8-2.2-5-5-5z"/>
                      <circle cx="6" cy="5.5" r="1" fill="var(--gs-void)"/>
                      <circle cx="10" cy="5.5" r="1" fill="var(--gs-void)"/>
                    </svg>
                  ) : (
                    <span className="font-data" style={{
                      fontSize: T.bubble, color: 'var(--gs-base)', opacity: 0.4, flexShrink: 0,
                    }}>
                      &rsaquo;
                    </span>
                  )}
                  <span className={`font-data italic${i === 0 ? ' m43-text-bloom' : ''}`} style={{
                    fontSize: T.bubble,
                    ...(i === 0 ? {} : { color: 'var(--gs-light)', opacity: 0.55 }),
                    lineHeight: 1.35,
                    fontWeight: i === 0 ? 600 : 400,
                  }}>
                    &ldquo;{q}&rdquo;
                  </span>
                </div>
              ))}
            </div>

            {printMode ? (
              <span
                className="font-display uppercase"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4em',
                  padding: '0.45em 1.2em',
                  border: '1px solid rgba(255,178,239,0.15)',
                  color: 'var(--gs-light)',
                  fontSize: T.cta,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  borderRadius: '3px',
                  background: 'transparent',
                  width: 'fit-content',
                }}
              >
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Ask Chlo&eacute;
              </span>
            ) : (
              <button
                onClick={handleAskChloe}
                className="font-display uppercase m43-cta-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4em',
                  padding: '0.45em 1.2em',
                  border: '1px solid rgba(255,178,239,0.15)',
                  color: 'var(--gs-light)',
                  fontSize: T.cta,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  borderRadius: '3px',
                  background: 'transparent',
                  cursor: 'pointer',
                  width: 'fit-content',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Ask Chlo&eacute;
              </button>
            )}
          </div>

          {/* ── PRD Card (HERO, big right) — breathing glow ── */}
          <div style={{
            flex: '1 1 60%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '2.5% 4%',
            border: '1px solid rgba(255,178,239,0.2)',
            borderRadius: '4px',
            background: 'linear-gradient(145deg, rgba(255,178,239,0.05) 0%, rgba(255,178,239,0.015) 50%, rgba(255,178,239,0.04) 100%)',
            animation: printMode ? 'none' : 'm43-breathe 4s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Internal glow orb */}
            <div className="absolute pointer-events-none" style={{
              top: '-25%', right: '-15%',
              width: '55%', height: '70%',
              background: 'radial-gradient(circle, rgba(255,178,239,0.08) 0%, transparent 55%)',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Icon */}
              <svg width="1.8em" height="1.8em" viewBox="0 0 24 24" fill="none" stroke="var(--gs-base)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ fontSize: T.cardTitle, marginBottom: '0.4em' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>

              {/* Title */}
              <p className="font-display uppercase" style={{
                fontSize: T.cardTitle, fontWeight: 700,
                color: 'var(--gs-base)', letterSpacing: '0.04em',
                marginBottom: '0.3em',
              }}>
                PRD (Product Requirements Document) &mdash; The Receipts
              </p>

              {/* Value prop */}
              <p className="font-data" style={{
                fontSize: T.cardBody, color: 'var(--gs-light)',
                lineHeight: 1.55, marginBottom: '0.5em', opacity: 0.9,
              }}>
                A consulting&#8209;grade PRD with every finding prioritized
                and step&#8209;by&#8209;step implementation instructions.
                Hand it to your manager &mdash; walk into the next
                meeting with the receipts they can&apos;t ignore.
              </p>

              {/* What's inside — compact list */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                gap: '0.2em', marginBottom: '0.7em',
              }}>
                {[
                  'Executive summary with critical themes',
                  'Prioritized findings (P0\u2009\u2192\u2009P3) with implementation steps',
                  'Phased timeline \u2014 Week 1 through Month 3+',
                  'Verification checklist & risk register',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.4em' }}>
                    <span className="font-data" style={{
                      fontSize: T.bubble, color: 'var(--gs-base)', opacity: 0.4, flexShrink: 0,
                    }}>
                      &bull;
                    </span>
                    <span className="font-data" style={{
                      fontSize: T.bubble, color: 'var(--gs-light)',
                      opacity: 0.6, lineHeight: 1.35,
                    }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.4em' }}>
                {printMode ? (
                  <span
                    className="font-display uppercase"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4em',
                      padding: '0.55em 2em',
                      background: 'var(--gs-base)',
                      color: '#080808',
                      fontSize: T.cta,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      borderRadius: '3px',
                      boxShadow: '0 0 20px rgba(255,178,239,0.25), 0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                    Download PRD
                  </span>
                ) : (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analytics.pdfDownloaded(scan.id, scan.domain ?? '', 'm43_slide')}
                    className="font-display uppercase m43-cta-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4em',
                      padding: '0.55em 2em',
                      background: 'var(--gs-base)',
                      color: '#080808',
                      fontSize: T.cta,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      borderRadius: '3px',
                      textDecoration: 'none',
                      boxShadow: '0 0 20px rgba(255,178,239,0.25), 0 4px 12px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                    Download PRD
                  </a>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
