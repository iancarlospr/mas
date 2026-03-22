'use client';

import { analytics } from '@/lib/analytics';

/**
 * ChloeCallout — Mini GhostChat™ widget for module slides
 * ═══════════════════════════════════════════════════════
 *
 * Mirrors the M43 closer GhostChat card: title, description,
 * one contextual example question from the CRIT finding, and
 * "Ask Chloé" button. Paid-only. Print-hidden.
 */

// ── Typography scale (cqi) — matches M43 card scale ─────────────────
const T = {
  title:  'clamp(12px, 1.20cqi, 18px)',
  body:   'clamp(12px, 0.90cqi, 14px)',
  bubble: 'clamp(12px, 0.90cqi, 14px)',
  cta:    'clamp(12px, 0.98cqi, 15px)',
} as const;

// ── Component ────────────────────────────────────────────────────────

interface ChloeCalloutProps {
  /** Contextual example question derived from the CRIT finding + recommendation */
  question: string;
  /** Click handler — opens chat launcher */
  onAskChloe: () => void;
  /** Scan ID for analytics */
  scanId?: string;
  /** Slide ID for analytics (e.g., "M03") */
  slideId?: string;
}

export function ChloeCallout({
  question,
  onAskChloe,
  scanId,
  slideId,
}: ChloeCalloutProps) {
  const handleClick = () => {
    if (scanId && slideId) {
      analytics.chloeCalloutClicked(scanId, slideId, 'cta');
    }
    onAskChloe();
  };

  return (
    <div data-no-print style={{ padding: '0.4% 0' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '1.5% 2.5%',
          border: '1px solid rgba(255,178,239,0.08)',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.015)',
        }}
      >
        {/* Title */}
        <p
          className="font-display uppercase"
          style={{
            fontSize: T.title,
            fontWeight: 700,
            color: 'var(--gs-light)',
            letterSpacing: '0.04em',
            marginBottom: '0.2em',
          }}
        >
          GhostChat&trade;
        </p>

        {/* Description */}
        <p
          className="font-data"
          style={{
            fontSize: T.body,
            color: 'var(--gs-mid)',
            lineHeight: 1.55,
            marginBottom: '0.4em',
          }}
        >
          Your AI marketing strategist who memorized every finding
          in your audit. Ask anything &mdash; she&apos;ll walk you through it.
        </p>

        {/* Single contextual example question — highlighted */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.4em',
            background: 'rgba(255,178,239,0.08)',
            borderLeft: '2px solid var(--gs-base)',
            padding: '0.3em 0.5em',
            borderRadius: '0 3px 3px 0',
            marginBottom: '0.5em',
          }}
        >
          <span
            className="font-data"
            style={{
              fontSize: T.bubble,
              color: 'var(--gs-base)',
              opacity: 0.7,
              flexShrink: 0,
            }}
          >
            &rsaquo;
          </span>
          <span
            className="font-data italic"
            style={{
              fontSize: T.bubble,
              color: 'var(--gs-light)',
              opacity: 0.85,
              lineHeight: 1.35,
              fontWeight: 600,
            }}
          >
            &ldquo;{question}&rdquo;
          </span>
        </div>

        {/* CTA button */}
        <button
          onClick={handleClick}
          className="font-display uppercase"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4em',
            padding: '0.4em 1em',
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,178,239,0.06)';
            e.currentTarget.style.borderColor = 'rgba(255,178,239,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,178,239,0.15)';
          }}
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Ask Chlo&eacute;
        </button>
      </div>
    </div>
  );
}
