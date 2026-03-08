'use client';

import { useEffect, useState } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import { WindowManagerProvider } from '@/lib/window-manager';
import { TitleSlide } from './slides/title-slide';
import { VerdictSlide } from './slides/verdict-slide';
import { OverviewExecSlide } from './slides/overview-exec-slide';
import { M45Slide } from './slides/m45-slide';
import { FindingsSlide } from './slides/findings-slide';
import { CategoryIntroSlide } from './slides/category-intro-slide';
import { M01Slide } from './slides/m01-slide';
import { M12Slide } from './slides/m12-slide';
import { M40Slide } from './slides/m40-slide';
import { M05Slide } from './slides/m05-slide';
import { M06Slide } from './slides/m06-slide';
import { M06bSlide } from './slides/m06b-slide';
import { M08Slide } from './slides/m08-slide';
import { M09Slide } from './slides/m09-slide';
import { M03Slide } from './slides/m03-slide';
import { M10Slide } from './slides/m10-slide';
import { M11Slide } from './slides/m11-slide';
import { M13Slide } from './slides/m13-slide';
import { M14Slide } from './slides/m14-slide';
import { M04Slide } from './slides/m04-slide';
import { M15Slide } from './slides/m15-slide';
import { M26Slide } from './slides/m26-slide';
import { M34Slide } from './slides/m34-slide';
import { M39Slide } from './slides/m39-slide';
import { M21Slide } from './slides/m21-slide';
import { M28Slide } from './slides/m28-slide';
import { M29Slide } from './slides/m29-slide';
import { M02Slide } from './slides/m02-slide';
import { M07Slide } from './slides/m07-slide';
import { M20Slide } from './slides/m20-slide';
import { M16Slide } from './slides/m16-slide';
import { M17Slide } from './slides/m17-slide';
import { M18M19Slide } from './slides/m18-m19-slide';
import { M22M23Slide } from './slides/m22-m23-slide';
import { M37Slide } from './slides/m37-slide';
import { M38Slide } from './slides/m38-slide';
import { M24Slide } from './slides/m24-slide';
import { M25Slide } from './slides/m25-slide';
import { M27Slide } from './slides/m27-slide';
import { M30Slide } from './slides/m30-slide';
import { M31Slide } from './slides/m31-slide';
import { M33Slide } from './slides/m33-slide';
import { M36Slide } from './slides/m36-slide';
import { M43Slide } from './slides/m43-slide';
import { ClosingSlide } from './slides/closing-slide';

/**
 * Presentation Slides View — for PDF capture
 * ════════════════════════════════════════════
 *
 * Renders ALL slides in sequence at a fixed 1344px width so cqi units
 * calculate correctly. Each slide is wrapped in a page-break container.
 *
 * Wrapped in WindowManagerProvider so M43's useWindowManager() doesn't crash.
 * Sets data-slides-loaded="true" after fonts are ready + 300ms settle.
 */

export function PresentationSlidesView({ scan, autoPrint = false }: { scan: ScanWithResults; autoPrint?: boolean }) {
  const [ready, setReady] = useState(false);
  const isPaid = scan.tier === 'paid';

  useEffect(() => {
    document.fonts.ready.then(() => {
      setTimeout(() => setReady(true), 300);
    });
  }, []);

  // Auto-trigger print dialog when slides are ready and autoPrint is requested
  useEffect(() => {
    if (ready && autoPrint) {
      // Small delay to ensure paint is complete
      const timer = setTimeout(() => window.print(), 200);
      return () => clearTimeout(timer);
    }
  }, [ready, autoPrint]);

  return (
    <WindowManagerProvider>
      <div
        data-slides-loaded={ready ? 'true' : 'false'}
        style={{
          width: '1344px',
          margin: '0 auto',
          background: '#080808',
        }}
      >
        {/* Override desktop OS body styles for standalone slides page */}
        <style>{`
          html, body {
            overflow: auto !important;
            height: auto !important;
            min-height: 100vh;
            background: #080808 !important;
          }

          @page { size: 14in 8.5in; margin: 0; }

          @media print {
            /* Beat globals.css "* { box-shadow/text-shadow: none !important }"
               by using a more specific selector + revert to restore inline styles */
            [data-slides-loaded] *,
            [data-slides-loaded] *::before,
            [data-slides-loaded] *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              box-shadow: revert !important;
              text-shadow: revert !important;
            }
            html, body {
              background: #080808 !important;
              color: var(--gs-light) !important;
              font-size: 16px !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            /* Force slide containers to clip overflow in print — matches scan window behavior */
            [data-slides-loaded] .slide-card {
              overflow: hidden !important;
            }
            .slide-page { break-before: page; break-inside: avoid; }
            .slide-page:first-child { break-before: auto; }
          }

          .slide-page { break-before: page; break-inside: avoid; }
          .slide-page:first-child { break-before: auto; }
        `}</style>

        {/* ── Title ── */}
        <div className="slide-page"><TitleSlide scan={scan} /></div>

        {/* ── Verdict ── */}
        <div className="slide-page"><VerdictSlide scan={scan} /></div>

        {/* ── Executive Overview ── */}
        <div className="slide-page"><OverviewExecSlide scan={scan} /></div>

        {/* ── M45: Stack Analyzer (paid only) ── */}
        {isPaid && <div className="slide-page"><M45Slide scan={scan} /></div>}

        {/* ── Findings ── */}
        <div className="slide-page"><FindingsSlide scan={scan} /></div>

        {/* ── Category 1: Security & Compliance ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="security_compliance" /></div>
        <div className="slide-page"><M01Slide scan={scan} /></div>
        <div className="slide-page"><M12Slide scan={scan} /></div>
        <div className="slide-page"><M40Slide scan={scan} /></div>

        {/* ── Category 2: Analytics & Measurement ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="analytics_measurement" /></div>
        <div className="slide-page"><M05Slide scan={scan} /></div>
        <div className="slide-page"><M06Slide scan={scan} /></div>
        <div className="slide-page"><M06bSlide scan={scan} /></div>
        <div className="slide-page"><M08Slide scan={scan} /></div>
        <div className="slide-page"><M09Slide scan={scan} /></div>

        {/* ── Category 3: Performance & Experience ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="performance_experience" /></div>
        <div className="slide-page"><M03Slide scan={scan} /></div>
        <div className="slide-page"><M13Slide scan={scan} /></div>
        <div className="slide-page"><M14Slide scan={scan} /></div>
        <div className="slide-page"><M10Slide scan={scan} /></div>
        <div className="slide-page"><M11Slide scan={scan} /></div>

        {/* ── Category 4: SEO & Content ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="seo_content" /></div>
        <div className="slide-page"><M04Slide scan={scan} /></div>
        <div className="slide-page"><M15Slide scan={scan} /></div>
        <div className="slide-page"><M26Slide scan={scan} /></div>
        <div className="slide-page"><M34Slide scan={scan} /></div>
        <div className="slide-page"><M39Slide scan={scan} /></div>

        {/* ── Category 5: Paid Media ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="paid_media" /></div>
        <div className="slide-page"><M21Slide scan={scan} /></div>
        <div className="slide-page"><M28Slide scan={scan} /></div>
        <div className="slide-page"><M29Slide scan={scan} /></div>

        {/* ── Category 6: MarTech & Infrastructure ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="martech_infrastructure" /></div>
        <div className="slide-page"><M02Slide scan={scan} /></div>
        <div className="slide-page"><M07Slide scan={scan} /></div>
        <div className="slide-page"><M20Slide scan={scan} /></div>

        {/* ── Category 7: Brand & Digital Presence ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="brand_presence" /></div>
        <div className="slide-page"><M16Slide scan={scan} /></div>
        <div className="slide-page"><M17Slide scan={scan} /></div>
        <div className="slide-page"><M18M19Slide scan={scan} /></div>
        <div className="slide-page"><M22M23Slide scan={scan} /></div>
        <div className="slide-page"><M37Slide scan={scan} /></div>
        <div className="slide-page"><M38Slide scan={scan} /></div>

        {/* ── Category 8: Market Intelligence ── */}
        <div className="slide-page"><CategoryIntroSlide scan={scan} category="market_intelligence" /></div>
        <div className="slide-page"><M24Slide scan={scan} /></div>
        <div className="slide-page"><M25Slide scan={scan} /></div>
        <div className="slide-page"><M27Slide scan={scan} /></div>
        <div className="slide-page"><M30Slide scan={scan} /></div>
        <div className="slide-page"><M31Slide scan={scan} /></div>
        <div className="slide-page"><M33Slide scan={scan} /></div>
        <div className="slide-page"><M36Slide scan={scan} /></div>

        {/* ── M43: Remediation Roadmap (paid only) ── */}
        {isPaid && <div className="slide-page"><M43Slide scan={scan} printMode /></div>}

        {/* ── Closing ── */}
        <div className="slide-page"><ClosingSlide scan={scan} /></div>
      </div>
    </WindowManagerProvider>
  );
}
