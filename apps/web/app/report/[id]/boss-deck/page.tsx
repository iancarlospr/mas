'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { PDFProgress } from '@/lib/client-pdf-generator';

/**
 * /report/[id]/boss-deck — Client-side Boss Deck PDF download page.
 *
 * Loads the server-rendered Boss Deck HTML in an iframe (preserves fonts,
 * CSS, SVG filters — everything renders natively). Then uses html2canvas
 * + pdf-lib to capture each .page element from the iframe and assemble
 * a PDF on the client.
 */
export default function BossDeckDownloadPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const scanId = params.id;
  const isDownload = searchParams.get('download') === '1';

  const [progress, setProgress] = useState<PDFProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const downloadStarted = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const startDownload = useCallback(async () => {
    if (downloadStarted.current) return;
    downloadStarted.current = true;

    try {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument) throw new Error('iframe not ready');

      const pages = iframe.contentDocument.querySelectorAll<HTMLElement>('.page');
      if (pages.length === 0) throw new Error('No .page elements found in Boss Deck');

      const { PDFDocument } = await import('pdf-lib');
      const html2canvas = (await import('html2canvas-pro')).default;

      const BD_W = 1344;
      const BD_H = 816;

      // Force exact dimensions inside iframe
      const style = iframe.contentDocument.createElement('style');
      style.textContent = `
        .page {
          width: ${BD_W}px !important;
          height: ${BD_H}px !important;
          overflow: hidden !important;
        }
        .print-banner { display: none !important; }
        body { margin-top: 0 !important; }
      `;
      iframe.contentDocument.head.appendChild(style);

      // Let layout settle
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const pdf = await PDFDocument.create();
      const total = pages.length;

      for (let i = 0; i < total; i++) {
        setProgress({ phase: 'capturing', current: i + 1, total });

        const canvas = await html2canvas(pages[i]!, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#080808',
          windowWidth: BD_W,
          width: BD_W,
          height: BD_H,
          logging: false,
        });

        const isHeroOrTail = i === 0 || i === total - 1;

        if (isHeroOrTail) {
          const blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/png'),
          );
          const img = await pdf.embedPng(await blob.arrayBuffer());
          const page = pdf.addPage([BD_W, BD_H]);
          page.drawImage(img, { x: 0, y: 0, width: BD_W, height: BD_H });
        } else {
          const blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/jpeg', 0.85),
          );
          const img = await pdf.embedJpg(await blob.arrayBuffer());
          const page = pdf.addPage([BD_W, BD_H]);
          page.drawImage(img, { x: 0, y: 0, width: BD_W, height: BD_H });
        }
      }

      style.remove();

      setProgress({ phase: 'assembling', current: total, total });
      const pdfBytes = await pdf.save();
      setProgress({ phase: 'done', current: total, total });

      // Trigger download
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'boss-deck.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[boss-deck-pdf] Client-side generation failed:', err);
      setError((err as Error).message);
      setProgress(null);
      downloadStarted.current = false;
    }
  }, []);

  // When iframe loads and download mode is active, start capture
  const handleIframeLoad = useCallback(() => {
    if (!isDownload) return;

    // Wait for fonts + images inside the iframe to settle
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    iframe.contentDocument.fonts.ready.then(() => {
      setTimeout(() => startDownload(), 1500);
    });
  }, [isDownload, startDownload]);

  if (error) {
    return (
      <div style={{ color: '#FFB2EF', background: '#080808', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        Error: {error}
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

      {/* Loading state before iframe loads */}
      {!progress && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#080808',
            fontFamily: 'monospace',
            color: '#FFB2EF',
            fontSize: 16,
          }}
        >
          Loading Boss Deck...
        </div>
      )}

      {/* Iframe loads the full boss deck HTML with all fonts/CSS/SVG natively */}
      <iframe
        ref={iframeRef}
        src={`/api/reports/${scanId}/boss-deck`}
        onLoad={handleIframeLoad}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1400px',
          height: '900px',
          border: 'none',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
