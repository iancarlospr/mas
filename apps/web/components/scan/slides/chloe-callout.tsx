'use client';

import { analytics } from '@/lib/analytics';

/**
 * ChloeCallout — Mini GhostChat™ widget for module slides
 * ═══════════════════════════════════════════════════════
 *
 * Title, description, and one clickable contextual question
 * derived from the CRIT finding. The question row IS the button.
 * Outer border has animated pink gradient sweep (30s).
 * Question text has platinum shine sweep (8s).
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
      <style>{`
        @keyframes gc-border-sweep {
          0% { background-position: 0% 50%; }
          8% { background-position: 30% 50%; }
          12% { background-position: 25% 50%; }
          50% { background-position: 50% 50%; }
          88% { background-position: 75% 50%; }
          92% { background-position: 70% 50%; }
          95% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes gc-text-shine {
          0% { left: -30%; }
          100% { left: 130%; }
        }
        .gc-glow-border {
          position: relative;
          border-radius: 6px;
          padding: 2px;
          background: linear-gradient(
            90deg,
            rgba(255,178,239,0.06) 0%,
            rgba(255,178,239,0.25) 25%,
            rgba(255,178,239,0.45) 50%,
            rgba(255,178,239,0.25) 75%,
            rgba(255,178,239,0.06) 100%
          );
          background-size: 300% 100%;
          animation: gc-border-sweep 30s linear infinite;
        }
        .gc-question-shine {
          position: relative;
          overflow: hidden;
        }
        .gc-question-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -30%;
          width: 25%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.08) 30%,
            rgba(255,255,255,0.15) 50%,
            rgba(255,255,255,0.08) 70%,
            transparent 100%
          );
          animation: gc-text-shine 8s ease-in-out infinite;
          pointer-events: none;
          border-radius: inherit;
        }
      `}</style>

      {/* Animated border wrapper */}
      <div className="gc-glow-border">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1.5% 2.5%',
            borderRadius: '4px',
            background: 'var(--gs-void)',
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

          {/* Clickable question row — this IS the button, with text shine */}
          <button
            onClick={handleClick}
            className="gc-question-shine"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.4em',
              background: 'rgba(255,178,239,0.08)',
              padding: '0.3em 0.5em',
              borderRadius: '0 3px 3px 0',
              border: 'none',
              borderLeft: '2px solid var(--gs-base)',
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
    </div>
  );
}
