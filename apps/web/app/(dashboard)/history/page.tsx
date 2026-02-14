import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ScanInput } from '@/components/scan/scan-input';
import { AutoScanTrigger } from '@/components/scan/auto-scan-trigger';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Scans' };

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="font-heading text-h3 text-primary mb-4">Sign in to view your scans</h1>
        <Link href="/login" className="text-accent hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  const { data: scans } = await supabase
    .from('scans')
    .select('id, domain, tier, status, marketing_iq, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!scans || scans.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <Suspense><AutoScanTrigger /></Suspense>
        <h1 className="font-heading text-h3 text-primary mb-2">No scans yet</h1>
        <p className="text-muted text-sm mb-8">
          Enter a URL to run your first marketing technology audit.
        </p>
        <ScanInput />
      </div>
    );
  }

  return (
    <div>
      <Suspense><AutoScanTrigger /></Suspense>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-h2 text-primary">My Scans</h1>
      </div>
      <div className="space-y-3">
        {scans.map((scan) => (
          <Link
            key={scan.id}
            href={`/scan/${scan.id}`}
            className="flex items-center justify-between bg-surface border border-border rounded-xl p-5 hover:shadow-lg hover:border-accent/20 transition-all"
          >
            <div>
              <span className="font-heading text-base font-700 text-primary">
                {scan.domain}
              </span>
              <span className="ml-3 text-xs text-muted capitalize">
                {scan.status}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {scan.marketing_iq != null && (
                <span className="font-heading text-lg font-800 text-accent">
                  {scan.marketing_iq}
                </span>
              )}
              <span className="text-xs text-muted">
                {new Date(scan.created_at).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
