'use client';

import { useState } from 'react';
import { Download, Share2, Check, Copy } from 'lucide-react';

/** Sticky top bar — PRD-cont-4 Section 1.3 */
interface ReportTopBarProps {
  domain: string;
  marketingIQ: number;
  scanId: string;
  isShared: boolean;
}

export function ReportTopBar({ domain, marketingIQ, scanId, isShared }: ReportTopBarProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      const res = await fetch(`/api/reports/${scanId}/share`, { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        setShareUrl(data.url);
        await navigator.clipboard.writeText(data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback: copy current URL
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <header className="report-topbar fixed top-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-sm border-b border-border z-50 flex items-center justify-between px-6 print:hidden">
      <div className="flex items-center gap-4">
        <a
          href={`/scan/${scanId}`}
          className="text-sm text-[#0F3460] hover:text-[#0F3460]/80 transition-colors"
        >
          &larr; Dashboard
        </a>
        <span className="text-[#E2E8F0]">|</span>
        <span className="font-heading font-700 text-[#1A1A2E]">{domain}</span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold"
          style={{
            background: marketingIQ >= 70 ? '#06D6A0' : marketingIQ >= 40 ? '#FFD166' : '#EF476F',
            color: marketingIQ >= 40 && marketingIQ < 70 ? '#1A1A2E' : '#FFFFFF',
          }}
        >
          {marketingIQ}
        </span>
        {isShared && (
          <span className="text-xs text-[#94A3B8] border border-[#E2E8F0] px-2 py-0.5 rounded">
            Shared Report
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!isShared && (
          <button
            onClick={handleShare}
            className="share-button inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1A1A2E] transition-colors"
          >
            {copied ? <Check size={16} /> : shareUrl ? <Copy size={16} /> : <Share2 size={16} />}
            {copied ? 'Copied!' : 'Share'}
          </button>
        )}
        <a
          href={`/api/reports/${scanId}/pdf${isShared ? `?share=${new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('share') ?? ''}` : ''}`}
          download
          className="download-button inline-flex items-center gap-2 bg-[#0F3460] text-white rounded-lg px-4 py-2 text-sm font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
        >
          <Download size={16} />
          Download PDF
        </a>
      </div>
    </header>
  );
}
