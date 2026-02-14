'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ScanInput } from '@/components/scan/scan-input';
import { FakeScanProgress } from '@/components/scan/fake-scan-progress';
import { SignupWall } from '@/components/scan/signup-wall';
import { analytics } from '@/lib/analytics';

type FlowState = 'idle' | 'fakeLoading' | 'gated';

export function HeroScanFlow() {
  const [state, setState] = useState<FlowState>('idle');
  const [capturedUrl, setCapturedUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  const handleCapture = useCallback(
    async (url: string, turnstileToken: string) => {
      if (isAuthenticated) {
        // Authenticated user — start real scan immediately
        try {
          const res = await fetch('/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, turnstileToken }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? 'Failed to start scan');
          }

          const { scanId } = await res.json();
          analytics.scanStarted(new URL(url).hostname, 'full');
          router.push(`/scan/${scanId}`);
        } catch (err) {
          // Fall through — ScanInput will show its own error via the default path
          throw err;
        }
      } else {
        // Anonymous user — fake loading → signup wall
        setCapturedUrl(url);
        setState('fakeLoading');
        analytics.signupWallShown(new URL(url).hostname);
      }
    },
    [isAuthenticated, router],
  );

  const domain = capturedUrl ? new URL(capturedUrl).hostname.replace(/^www\./, '') : '';

  if (state === 'fakeLoading') {
    return (
      <div className="w-full">
        <FakeScanProgress
          url={capturedUrl}
          onGateReached={() => setState('gated')}
        />
      </div>
    );
  }

  if (state === 'gated') {
    return (
      <div className="w-full relative">
        <FakeScanProgress url={capturedUrl} onGateReached={() => {}} />
        <SignupWall domain={domain} scanUrl={capturedUrl} />
      </div>
    );
  }

  // Idle — show normal scan input
  // Wait for auth check before rendering to avoid flash
  return (
    <ScanInput
      size="large"
      onCapture={isAuthenticated != null ? handleCapture : undefined}
    />
  );
}
