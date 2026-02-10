'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ScanProgress } from '@/components/scan/scan-progress';
import { BentoDashboard } from '@/components/scan/bento-dashboard';
import { EmailCapture } from '@/components/scan/email-capture';
import type { ScanWithResults } from '@marketing-alpha/types';
import { analytics } from '@/lib/analytics';

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<ScanWithResults | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchScan = useCallback(async () => {
    const res = await fetch(`/api/scans/${id}`);
    if (res.ok) {
      const data = await res.json();
      setScan(data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-12">
        <div className="h-8 bg-border rounded w-1/3" />
        <div className="h-4 bg-border rounded w-1/2" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-border rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center py-12">
        <h1 className="font-heading text-h3 text-primary mb-2">Scan not found</h1>
        <p className="text-muted">This scan doesn&apos;t exist or you don&apos;t have access.</p>
      </div>
    );
  }

  // If scan is still in progress, show progress view
  if (scan.status !== 'complete' && scan.status !== 'failed' && scan.status !== 'cancelled') {
    return (
      <div>
        <ScanProgress
          scanId={id}
          onComplete={() => {
            fetchScan().then(() => {
              if (scan) analytics.scanCompleted(id, scan.domain, scan.marketingIq);
            });
          }}
        />
        {/* Email capture for anonymous (peek) users during scan */}
        {scan.tier === 'peek' && (
          <EmailCapture scanId={id} className="mt-8 max-w-2xl mx-auto" />
        )}
      </div>
    );
  }

  // If scan failed
  if (scan.status === 'failed') {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="mx-auto w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="font-heading text-h3 text-primary mb-2">Scan Could Not Complete</h1>
        <p className="text-muted text-sm">
          We couldn&apos;t reach {scan.domain}. The site may be blocking automated requests or is temporarily unavailable.
        </p>
        <p className="text-xs text-muted mt-4">Scan ID: {scan.id}</p>
      </div>
    );
  }

  return <BentoDashboard scan={scan} />;
}
