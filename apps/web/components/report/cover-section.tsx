'use client';

import { ScoreGauge } from '@/components/scan/score-gauge';

/**
 * Cover page — PRD-cont-4 Section 2.
 * Full-viewport on web, exactly 1 Legal page (8.5" × 14") in print.
 */
interface CoverSectionProps {
  domain: string;
  scanDate: string;
  scanId: string;
  marketingIQ: number;
  marketingIQLabel: string;
  userEmail: string;
  isPrintMode: boolean;
}

export function CoverSection({
  domain,
  scanDate,
  scanId,
  marketingIQ,
  marketingIQLabel,
  userEmail,
  isPrintMode,
}: CoverSectionProps) {
  const dateStr = new Date(scanDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section
      className="report-section flex flex-col items-center justify-center text-center text-white rounded-xl print:rounded-none print:break-after-page"
      style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
        minHeight: isPrintMode ? 'auto' : '100vh',
        padding: isPrintMode ? '60px 40px' : '80px 40px',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {/* Logo */}
      <div
        className="mb-12"
        style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontWeight: 800,
          fontSize: '1.5rem',
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        MARKETINGALPHASCAN
      </div>

      {/* Title */}
      <h1
        className="mb-4"
        style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontWeight: 800,
          fontSize: '3.5rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          lineHeight: 1.1,
        }}
      >
        MARKETING TECHNOLOGY
        <br />
        AUDIT REPORT
      </h1>
      <div className="w-64 h-[2px] bg-white/30 mx-auto mb-8" />

      {/* Domain */}
      <p
        className="mb-10"
        style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontWeight: 700,
          fontSize: '2rem',
          color: '#E94560',
        }}
      >
        {domain}
      </p>

      {/* Score Gauge */}
      <div className="mb-10">
        <ScoreGauge
          score={marketingIQ}
          size="xl"
          animate={!isPrintMode}
          label="MarketingIQ"
        />
      </div>

      {/* Metadata */}
      <div className="space-y-1 mb-8">
        <p style={{ fontFamily: '"Inter", sans-serif', fontWeight: 400, fontSize: '0.875rem', color: '#94A3B8' }}>
          Scan Date: {dateStr}
        </p>
        <p style={{ fontFamily: '"Inter", sans-serif', fontWeight: 400, fontSize: '0.875rem', color: '#94A3B8' }}>
          Report ID: {scanId}
        </p>
      </div>

      {/* Confidential */}
      <div className="w-48 h-px bg-white/20 mx-auto mb-4" />
      <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600, fontSize: '0.75rem', color: '#94A3B8' }}>
        CONFIDENTIAL
      </p>
      <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600, fontSize: '0.75rem', color: '#94A3B8' }}>
        Prepared exclusively for {userEmail}
      </p>
    </section>
  );
}
