'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { PDFProgress } from '@/lib/client-pdf-generator';

/**
 * /report/[id]/boss-deck — Client-side Boss Deck PDF download page.
 *
 * Fetches the server-rendered Boss Deck HTML from the API route,
 * injects it into the DOM, then uses html2canvas + pdf-lib to capture
 * each .page element and assemble a PDF on the client.
 */
export default function BossDeckDownloadPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const scanId = params.id;
  const isDownload = searchParams.get('download') === '1';

  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PDFProgress | null>(null);
  const downloadStarted = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch boss deck HTML from API route
  useEffect(() => {
    if (!scanId) return;
    fetch(`/api/reports/${scanId}/boss-deck`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load Boss Deck (${res.status})`);
        return res.text();
      })
      .then(setHtml)
      .catch((err) => setError(err.message));
  }, [scanId]);

  // Extract just the <body> content from the full HTML document
  const bodyContent = html
    ? html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '')
    : null;

  // Extract <style> tags from the <head>
  const headStyles = html
    ? (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join('\n')
    : '';

  const startDownload = useCallback(async () => {
    if (downloadStarted.current) return;
    downloadStarted.current = true;

    try {
      const { generateBossDeckPDFClientSide, downloadPdf } = await import(
        '@/lib/client-pdf-generator'
      );

      const pdfBytes = await generateBossDeckPDFClientSide(setProgress);
      downloadPdf(pdfBytes, `boss-deck.pdf`);
    } catch (err) {
      console.error('[boss-deck-pdf] Client-side generation failed:', err);
      setProgress(null);
      downloadStarted.current = false;
    }
  }, []);

  // Auto-trigger download after HTML is injected and painted
  useEffect(() => {
    if (!bodyContent || !isDownload) return;

    // Wait for fonts + images to settle
    const timer = setTimeout(async () => {
      await document.fonts.ready;
      // Extra settle for base64 images
      await new Promise((r) => setTimeout(r, 1000));
      startDownload();
    }, 500);
    return () => clearTimeout(timer);
  }, [bodyContent, isDownload, startDownload]);

  if (error) {
    return (
      <div style={{ color: '#FFB2EF', background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        {error}
      </div>
    );
  }

  if (!bodyContent) {
    return (
      <div style={{ color: '#FFB2EF', background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        Loading Boss Deck...
      </div>
    );
  }

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
            fontFamily: 'monospace',
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

      {/* Inject the boss deck styles */}
      <div dangerouslySetInnerHTML={{ __html: headStyles }} />

      {/* Inject the boss deck body content */}
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  );
}
