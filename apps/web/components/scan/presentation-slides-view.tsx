'use client';

import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import type { ScanWithResults } from '@marketing-alpha/types';
import { WindowManagerProvider } from '@/lib/window-manager';
import type { PDFProgress } from '@/lib/client-pdf-generator';
import { TitleSlide } from './slides/title-slide';
import { RoastSlide } from './slides/verdict-slide';
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
 * Two rendering modes:
 *
 * 1. **Normal** (viewing / print): all slides in DOM at once.
 * 2. **Single-slide capture** (mobile PDF download): only ONE slide is
 *    mounted at a time. The generator calls `renderSlide(i)` which sets
 *    state → React unmounts the previous slide, mounts the new one →
 *    resolves the promise so the generator can capture. Memory stays flat
 *    at ~20MB instead of 300MB+ for 50 slides.
 *
 * Desktop PDF uses mode 1 (pre-rendered). Mobile PDF uses mode 2.
 */

export function PresentationSlidesView({
  scan,
  autoPrint = false,
  autoDownload = false,
}: {
  scan: ScanWithResults;
  autoPrint?: boolean;
  autoDownload?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<PDFProgress | null>(null);
  const downloadStarted = useRef(false);
  const isPaid = scan.tier === 'paid';
  const [iosPdfBytes, setIosPdfBytes] = useState<{ bytes: Uint8Array; filename: string } | null>(null);

  // ── Single-slide capture state ──
  // -1 = normal mode (all slides rendered). 0+ = only that slide is rendered.
  const [captureIndex, setCaptureIndex] = useState(-1);
  // Ref that the generator awaits — resolved when React has painted the slide
  const captureResolveRef = useRef<(() => void) | null>(null);

  // Build the ordered slide list
  const slideList: ReactNode[] = useMemo(() => {
    const s = scan;
    const list: ReactNode[] = [
      <TitleSlide key="title" scan={s} />,
      <RoastSlide key="roast" scan={s} />,
      <OverviewExecSlide key="overview" scan={s} />,
    ];
    if (isPaid) list.push(<M45Slide key="m45" scan={s} />);
    list.push(
      <FindingsSlide key="findings" scan={s} />,
      <CategoryIntroSlide key="cat-sec" scan={s} category="security_compliance" />,
      <M01Slide key="m01" scan={s} />,
      <M12Slide key="m12" scan={s} />,
      <M40Slide key="m40" scan={s} />,
      <CategoryIntroSlide key="cat-analytics" scan={s} category="analytics_measurement" />,
      <M05Slide key="m05" scan={s} />,
      <M06Slide key="m06" scan={s} />,
      <M06bSlide key="m06b" scan={s} />,
      <M08Slide key="m08" scan={s} />,
      <M09Slide key="m09" scan={s} />,
      <CategoryIntroSlide key="cat-perf" scan={s} category="performance_experience" />,
      <M03Slide key="m03" scan={s} />,
      <M13Slide key="m13" scan={s} />,
      <M14Slide key="m14" scan={s} />,
      <M10Slide key="m10" scan={s} />,
      <M11Slide key="m11" scan={s} />,
      <CategoryIntroSlide key="cat-seo" scan={s} category="seo_content" />,
      <M04Slide key="m04" scan={s} />,
      <M15Slide key="m15" scan={s} />,
      <M26Slide key="m26" scan={s} />,
      <M34Slide key="m34" scan={s} />,
      <M39Slide key="m39" scan={s} />,
      <CategoryIntroSlide key="cat-paid" scan={s} category="paid_media" />,
      <M21Slide key="m21" scan={s} />,
      <M28Slide key="m28" scan={s} />,
      <M29Slide key="m29" scan={s} />,
      <CategoryIntroSlide key="cat-martech" scan={s} category="martech_infrastructure" />,
      <M02Slide key="m02" scan={s} />,
      <M07Slide key="m07" scan={s} />,
      <M20Slide key="m20" scan={s} />,
      <CategoryIntroSlide key="cat-brand" scan={s} category="brand_presence" />,
      <M16Slide key="m16" scan={s} />,
      <M17Slide key="m17" scan={s} />,
      <M18M19Slide key="m18m19" scan={s} />,
      <M22M23Slide key="m22m23" scan={s} />,
      <M37Slide key="m37" scan={s} />,
      <M38Slide key="m38" scan={s} />,
      <CategoryIntroSlide key="cat-market" scan={s} category="market_intelligence" />,
      <M24Slide key="m24" scan={s} />,
      <M25Slide key="m25" scan={s} />,
      <M27Slide key="m27" scan={s} />,
      <M30Slide key="m30" scan={s} />,
      <M31Slide key="m31" scan={s} />,
      <M33Slide key="m33" scan={s} />,
      <M36Slide key="m36" scan={s} />,
    );
    if (isPaid) list.push(<M43Slide key="m43" scan={s} printMode />);
    list.push(<ClosingSlide key="closing" scan={s} />);
    return list;
  }, [scan, isPaid]);

  // When captureIndex changes and the slide paints, resolve the generator's promise
  useEffect(() => {
    if (captureIndex >= 0 && captureResolveRef.current) {
      const resolve = captureResolveRef.current;
      // Double-rAF: first rAF = React committed to DOM, second rAF = browser painted
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
          captureResolveRef.current = null;
        });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [captureIndex]);

  // Callback for the generator: mount slide `index`, resolve when painted
  const renderSlide = useCallback((index: number): Promise<void> => {
    return new Promise((resolve) => {
      captureResolveRef.current = resolve;
      setCaptureIndex(index);
    });
  }, []);

  useEffect(() => {
    document.fonts.ready.then(() => {
      setTimeout(() => setReady(true), 300);
    });
  }, []);

  // Auto-trigger print dialog
  useEffect(() => {
    if (ready && autoPrint) {
      const timer = setTimeout(() => window.print(), 200);
      return () => clearTimeout(timer);
    }
  }, [ready, autoPrint]);

  // Client-side PDF generation
  const startDownload = useCallback(async () => {
    if (downloadStarted.current) return;
    downloadStarted.current = true;

    try {
      const { generatePresentationPDFClientSide, downloadPdf, isIOSDevice } = await import(
        '@/lib/client-pdf-generator'
      );

      const mobile = isIOSDevice() || (navigator.maxTouchPoints > 0 && window.innerWidth < 768);

      const pdfBytes = await generatePresentationPDFClientSide(
        mobile
          ? {
              onProgress: setProgress,
              renderSlide,
              totalSlides: slideList.length,
            }
          : {
              onProgress: setProgress,
            },
      );

      // Reset capture state so slides render normally again (if user stays on page)
      setCaptureIndex(-1);

      const domain = scan.domain ?? 'report';
      const filename = `${domain}-audit-deck.pdf`;

      if (isIOSDevice()) {
        setIosPdfBytes({ bytes: pdfBytes, filename });
      } else {
        await downloadPdf(pdfBytes, filename);
      }
    } catch (err) {
      console.error('[presentation-pdf] Client-side generation failed:', err);
      setProgress(null);
      setCaptureIndex(-1);
      downloadStarted.current = false;
    }
  }, [scan.domain, renderSlide, slideList.length]);

  // iOS: user taps "Save" button
  const handleIOSSave = useCallback(async () => {
    if (!iosPdfBytes) return;
    const { downloadPdf } = await import('@/lib/client-pdf-generator');
    await downloadPdf(iosPdfBytes.bytes, iosPdfBytes.filename);
    setIosPdfBytes(null);
  }, [iosPdfBytes]);

  // Auto-trigger download when ready
  useEffect(() => {
    if (ready && autoDownload) {
      const timer = setTimeout(() => startDownload(), 500);
      return () => clearTimeout(timer);
    }
  }, [ready, autoDownload, startDownload]);

  const inCaptureMode = captureIndex >= 0;

  return (
    <WindowManagerProvider>
      {/* Progress overlay */}
      {progress && progress.phase !== 'done' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8, 8, 8, 0.92)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'var(--font-geist-mono), monospace',
            color: '#FFB2EF',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 12, letterSpacing: '0.05em' }}>
              {progress.phase === 'capturing'
                ? `Capturing slide ${progress.current} of ${progress.total}...`
                : 'Assembling PDF...'}
            </div>
            <div
              style={{
                width: 320,
                height: 6,
                background: 'rgba(255,178,239,0.15)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round((progress.current / progress.total) * 100)}%`,
                  height: '100%',
                  background: '#FFB2EF',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* iOS: "Tap to Save" overlay */}
      {iosPdfBytes && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8, 8, 8, 0.92)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'var(--font-geist-mono), monospace',
            color: '#FFB2EF',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 16, letterSpacing: '0.05em' }}>
              PDF ready
            </div>
            <button
              onClick={handleIOSSave}
              style={{
                padding: '14px 40px',
                background: '#FFB2EF',
                color: '#080808',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: '0.03em',
              }}
            >
              Tap to Save PDF
            </button>
          </div>
        </div>
      )}
      <div
        data-slides-loaded={ready ? 'true' : 'false'}
        style={{
          width: '100%',
          maxWidth: '1920px',
          margin: '0 auto',
          background: '#080808',
        }}
      >
        <style>{`
          html, body {
            overflow: auto !important;
            height: auto !important;
            min-height: 100vh;
            background: #080808 !important;
          }

          @page { size: 14in 8.5in; margin: 0; }

          @media print {
            [data-slides-loaded] *,
            [data-slides-loaded] *::before,
            [data-slides-loaded] *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }

            html, body {
              background: #080808 !important;
              color: var(--gs-light) !important;
              font-size: 16px !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              width: 14in !important;
            }

            [data-slides-loaded] {
              max-width: none !important;
              width: 14in !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .slide-page {
              width: 14in !important;
              height: 8.5in !important;
              overflow: hidden !important;
              break-before: page;
              break-inside: avoid;
              break-after: auto;
              position: relative;
            }
            .slide-page:first-child {
              break-before: auto;
            }

            .slide-page .slide-card {
              width: 14in !important;
              height: 8.5in !important;
              aspect-ratio: unset !important;
              overflow: hidden !important;
              border-radius: 0 !important;
              position: relative;
            }
          }

          .slide-page { break-before: page; break-inside: avoid; }
          .slide-page:first-child { break-before: auto; }
        `}</style>

        {inCaptureMode ? (
          /* Single-slide mode: only the current slide is in the DOM */
          <div className="slide-page">{slideList[captureIndex]}</div>
        ) : (
          /* Normal mode: all slides rendered */
          slideList.map((slide, i) => (
            <div key={i} className="slide-page">{slide}</div>
          ))
        )}
      </div>
    </WindowManagerProvider>
  );
}
