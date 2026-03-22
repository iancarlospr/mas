'use client';

import { analytics } from '@/lib/analytics';

/**
 * ChloeCallout — In-slide "Ask Chloé" prompt
 * ════════════════════════════════════════════
 *
 * Two variants:
 *   margin-note: Sassy Chloé personality quip (for critical/warning findings)
 *   cta:         Polished professional CTA (for neutral/good or category intros)
 *
 * Paid-only. Print-hidden via data-no-print.
 */

// ── Chat bubble SVG (shared) ─────────────────────────────────────────
function ChatBubbleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
  );
}

// ── Arrow chevron SVG ────────────────────────────────────────────────
function ArrowIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Typography scale (cqi) ───────────────────────────────────────────
const T = {
  quip:    'clamp(12px, 1.12cqi, 17px)',
  link:    'clamp(12px, 0.90cqi, 14px)',
  ctaText: 'clamp(12px, 0.98cqi, 15px)',
} as const;

// ── Component ────────────────────────────────────────────────────────

interface ChloeCalloutProps {
  /** 'margin-note' = sassy Chloé personality, 'cta' = polished professional */
  variant: 'margin-note' | 'cta';
  /** Chloé's sassy comment (only used in margin-note variant) */
  quip?: string;
  /** Pre-filled question text (shown in CTA, used for analytics context) */
  question: string;
  /** Topic label for the CTA variant (e.g., "your SEO score") */
  topic?: string;
  /** Click handler — opens chat launcher */
  onAskChloe: () => void;
  /** Scan ID for analytics */
  scanId?: string;
  /** Slide ID for analytics (e.g., "Findings", "M03") */
  slideId?: string;
}

export function ChloeCallout({
  variant,
  quip,
  question,
  topic,
  onAskChloe,
  scanId,
  slideId,
}: ChloeCalloutProps) {
  const handleClick = () => {
    if (scanId && slideId) {
      analytics.chloeCalloutClicked(scanId, slideId, variant);
    }
    onAskChloe();
  };

  if (variant === 'margin-note') {
    return (
      <div data-no-print style={{ padding: '0.6% 0' }}>
        <div
          style={{
            borderLeft: '3px solid var(--gs-base)',
            paddingLeft: '0.8em',
            paddingTop: '0.3em',
            paddingBottom: '0.3em',
          }}
        >
          {/* Chloé quip */}
          {quip && (
            <p
              className="font-marker"
              style={{
                fontSize: T.quip,
                color: 'var(--gs-base)',
                lineHeight: 1.4,
                marginBottom: '0.3em',
              }}
            >
              &ldquo;{quip}&rdquo;
            </p>
          )}

          {/* Clickable link */}
          <button
            onClick={handleClick}
            className="font-data"
            style={{
              fontSize: T.link,
              color: 'var(--gs-base)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4em',
              opacity: 0.7,
              transition: 'opacity 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.color = 'var(--gs-bright)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.color = 'var(--gs-base)';
            }}
          >
            <ChatBubbleIcon size={12} />
            ask chloé about this &rarr;
          </button>
        </div>
      </div>
    );
  }

  // ── CTA variant ──────────────────────────────────────────────────
  return (
    <div data-no-print style={{ padding: '0.6% 0' }}>
      <button
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6em',
          padding: '0.5em 1em',
          background: 'rgba(255,178,239,0.04)',
          border: '1px solid rgba(255,178,239,0.08)',
          borderRadius: '3px',
          cursor: 'pointer',
          transition: 'background 0.2s, border-color 0.2s',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,178,239,0.08)';
          e.currentTarget.style.borderColor = 'rgba(255,178,239,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,178,239,0.04)';
          e.currentTarget.style.borderColor = 'rgba(255,178,239,0.08)';
        }}
      >
        <ChatBubbleIcon size={14} />
        <span
          className="font-data"
          style={{
            fontSize: T.ctaText,
            color: 'var(--gs-light)',
            flex: 1,
            textAlign: 'left',
            lineHeight: 1.4,
          }}
        >
          Ask Chloé about{' '}
          <span style={{ color: 'var(--gs-base)' }}>
            {topic ?? question}
          </span>
        </span>
        <ArrowIcon />
      </button>
    </div>
  );
}
