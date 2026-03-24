'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { BossDeckRenderContext } from '@/lib/report/boss-deck-html';
import type { PDFProgress } from '@/lib/client-pdf-generator';
import { BOSS_DECK_CSS } from './boss-deck-slides/boss-deck-css';
import { CoverPage, WinsPage, IssuesPage, RoadmapPage, ResultsPage, ToolsPage, CloserPage } from './boss-deck-slides';

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Source+Code+Pro:wght@400;600;700&family=Permanent+Marker&display=swap';

/**
 * BossDeckSlidesView — React component renderer for Boss Deck PDF capture.
 *
 * Renders ALL pages as real React components (not dangerouslySetInnerHTML),
 * matching the PresentationSlidesView pattern. html2canvas can clone these
 * elements without issues.
 */
export function BossDeckSlidesView({
  ctx,
  domain,
  autoDownload = false,
}: {
  ctx: BossDeckRenderContext;
  domain: string;
  autoDownload?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<PDFProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadStarted = useRef(false);

  // ── Font loading ──────────────────────────────────
  useEffect(() => {
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = GOOGLE_FONTS_URL;
    document.head.appendChild(fontLink);

    fontLink.onload = () => {
      document.fonts.ready.then(() => {
        setTimeout(() => setReady(true), 500);
      });
    };

    const fallback = setTimeout(() => setReady(true), 3000);

    return () => {
      clearTimeout(fallback);
      preconnect1.remove();
      preconnect2.remove();
      fontLink.remove();
    };
  }, []);

  // ── PDF download ──────────────────────────────────
  const startDownload = useCallback(async () => {
    if (downloadStarted.current) return;
    downloadStarted.current = true;

    try {
      const { generateBossDeckPDFClientSide, downloadPdf } = await import(
        '@/lib/client-pdf-generator'
      );

      const pdfBytes = await generateBossDeckPDFClientSide(setProgress);
      downloadPdf(pdfBytes, `${domain}-boss-deck.pdf`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[boss-deck-pdf] Client-side generation failed:', err);
      setError(msg);
      setProgress(null);
      downloadStarted.current = false;
    }
  }, [domain]);

  useEffect(() => {
    if (ready && autoDownload) {
      const timer = setTimeout(() => startDownload(), 500);
      return () => clearTimeout(timer);
    }
  }, [ready, autoDownload, startDownload]);

  // ── Determine which pages to render ───────────────
  const ai = ctx.ai;
  const winsHighlights = ai?.wins_highlights ?? [];
  const topIssues = ai?.top_issues ?? [];
  const initiatives = ai?.initiatives ?? [];
  const timelineItems = ai?.timeline_items ?? [];
  const projections = ai?.category_projections ?? [];
  const outcomes = ai?.implementation_outcomes ?? [];
  const toolPitches = ai?.tool_pitches ?? [];

  const showWins = winsHighlights.length > 0;
  const showIssues = topIssues.length > 0;
  const showRoadmap = initiatives.length > 0 || timelineItems.length > 0;
  const showResults = projections.length > 0 || outcomes.length > 0;
  const showTools = toolPitches.length > 0 && ctx.hasM45;

  // Build ordered page list for sequential numbering
  const pages: string[] = ['cover'];
  if (showWins) pages.push('wins');
  if (showIssues) pages.push('issues');
  if (showRoadmap) pages.push('roadmap');
  if (showResults) pages.push('results');
  if (showTools) pages.push('tools');
  pages.push('closer');

  const totalPages = pages.length;
  const pn = (name: string) => pages.indexOf(name) + 1;

  return (
    <>
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
                ? `Capturing page ${progress.current} of ${progress.total}...`
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

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(8, 8, 8, 0.92)',
            fontFamily: 'var(--font-geist-mono), monospace',
            color: '#FFB2EF',
            padding: 40,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 500 }}>
            <div style={{ fontSize: 16, marginBottom: 16 }}>PDF generation failed</div>
            <div style={{ fontSize: 12, color: '#f87171', wordBreak: 'break-all' }}>{error}</div>
            <button
              onClick={() => { setError(null); downloadStarted.current = false; startDownload(); }}
              style={{
                marginTop: 20, padding: '8px 24px', background: '#FFB2EF',
                color: '#080808', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Override globals.css body { overflow: hidden } */}
      <style>{`
        html, body {
          overflow: auto !important;
          height: auto !important;
          min-height: 100vh;
          background: #0A0E1A !important;
        }
      `}</style>

      {/* Boss Deck CSS */}
      <style>{BOSS_DECK_CSS}</style>

      {/* ── Pages ─────────────────────────────────── */}

      {/* Cover */}
      <div className="bd-page dark-page cover-page">
        <CoverPage ctx={ctx} subtitle={ai?.cover_subtitle ?? ''} />
      </div>

      {/* Wins */}
      {showWins && (
        <div className={`bd-page ${winsHighlights.length > 0 ? 'dark-page wins-page-dark' : 'light-page'}`}>
          <WinsPage
            narrative={ai?.wins_narrative ?? ''}
            highlights={winsHighlights}
            ctx={ctx}
            pageNum={pn('wins')}
            totalPages={totalPages}
          />
        </div>
      )}

      {/* Issues */}
      {showIssues && (
        <div className="bd-page dark-page">
          <IssuesPage
            issues={topIssues}
            pageNum={pn('issues')}
            totalPages={totalPages}
            userName={ctx.userEmail}
          />
        </div>
      )}

      {/* Roadmap */}
      {showRoadmap && (
        <div className="bd-page light-page">
          <RoadmapPage
            initiatives={initiatives}
            timelineSummary={ai?.timeline_summary ?? ''}
            timelineItems={timelineItems}
            nextSteps={ai?.next_steps ?? []}
            pageNum={pn('roadmap')}
            totalPages={totalPages}
            userName={ctx.userEmail}
          />
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="bd-page dark-page results-page">
          <ResultsPage
            headline={ai?.implementation_impact_headline ?? 'Expected Impact'}
            outcomes={outcomes}
            projections={projections}
            pageNum={pn('results')}
            totalPages={totalPages}
            userName={ctx.userEmail}
          />
        </div>
      )}

      {/* Tools */}
      {showTools && (
        <div className="bd-page light-page">
          <ToolsPage
            pitches={toolPitches}
            pageNum={pn('tools')}
            totalPages={totalPages}
            userName={ctx.userEmail}
          />
        </div>
      )}

      {/* Closer */}
      <div className="bd-page dark-page closer-page">
        <CloserPage ctx={ctx} />
      </div>
    </>
  );
}
