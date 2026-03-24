'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { PDFProgress } from '@/lib/client-pdf-generator';

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Source+Code+Pro:wght@400;600;700&family=Permanent+Marker&display=swap';

/**
 * BossDeckView — client wrapper for Boss Deck PDF capture.
 *
 * Receives the pre-rendered boss deck HTML from the server component,
 * injects fonts + CSS, renders the content, and optionally triggers
 * client-side PDF generation.
 */
export function BossDeckView({
  html,
  domain,
  autoDownload = false,
}: {
  html: string;
  domain: string;
  autoDownload?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<PDFProgress | null>(null);
  const downloadStarted = useRef(false);

  // Extract <style> content from the HTML <head>
  const headStyles = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join('\n');

  // Extract <body> content
  const bodyContent = html
    .replace(/^[\s\S]*<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '');

  // Inject Google Fonts link into <head>
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

    // Wait for fonts to load, then mark ready
    fontLink.onload = () => {
      document.fonts.ready.then(() => {
        setTimeout(() => setReady(true), 500);
      });
    };

    // Fallback if onload doesn't fire
    const fallback = setTimeout(() => setReady(true), 3000);

    return () => {
      clearTimeout(fallback);
      preconnect1.remove();
      preconnect2.remove();
      fontLink.remove();
    };
  }, []);

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
      console.error('[boss-deck-pdf] Client-side generation failed:', err);
      setProgress(null);
      downloadStarted.current = false;
    }
  }, [domain]);

  // Auto-trigger download when ready
  useEffect(() => {
    if (ready && autoDownload) {
      const timer = setTimeout(() => startDownload(), 500);
      return () => clearTimeout(timer);
    }
  }, [ready, autoDownload, startDownload]);

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

      {/* Override globals.css body { overflow: hidden } — pages must be visible for html2canvas */}
      <style>{`
        html, body {
          overflow: auto !important;
          height: auto !important;
          min-height: 100vh;
          background: #0A0E1A !important;
        }
      `}</style>

      {/* Boss deck styles extracted from the HTML <head> */}
      <div dangerouslySetInnerHTML={{ __html: headStyles }} />

      {/* Boss deck body content (pages, SVG defs, print banner) */}
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  );
}
