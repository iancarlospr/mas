'use client';

import { analytics } from '@/lib/analytics';

/**
 * ChloeCallout — Mini GhostChat™ widget for module slides
 * ═══════════════════════════════════════════════════════
 *
 * Title, description, and one clickable contextual question
 * derived from the CRIT finding. The question row IS the button.
 * Paid-only. Print-hidden.
 */

// ── Typography scale (cqi) ───────────────────────────────────────────
const T = {
  title:  'clamp(12px, 1.20cqi, 18px)',
  body:   'clamp(12px, 0.90cqi, 14px)',
  bubble: 'clamp(12px, 0.90cqi, 14px)',
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

        {/* Clickable question row — this IS the button */}
        <button
          onClick={handleClick}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.4em',
            background: 'rgba(255,178,239,0.08)',
            borderLeft: '2px solid var(--gs-base)',
            padding: '0.3em 0.5em',
            borderRadius: '0 3px 3px 0',
            border: 'none',
            borderLeftWidth: '2px',
            borderLeftStyle: 'solid',
            borderLeftColor: 'var(--gs-base)',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,178,239,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,178,239,0.08)';
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
        </button>
      </div>
    </div>
  );
}
