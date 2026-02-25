'use client';

import { useState, useEffect } from 'react';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { BevelInput } from '@/components/os/bevel-input';

/**
 * GhostScan OS — Mobile Gate
 * ═══════════════════════════════
 *
 * WHAT: Full-screen Chloe prompt telling mobile users to use desktop.
 * WHY:  The desktop OS metaphor is a large-screen experience. On mobile
 *       we don't compromise — we redirect the energy (Plan Section 10).
 * HOW:  Viewport check (< 768px), full-screen Chloe with speech bubble,
 *       "send yourself a link" email input, dismiss option for persistent
 *       users who scroll below the gate.
 */

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Don't gate on desktop
  if (!isMobile || dismissed) {
    return <>{children}</>;
  }

  const handleSendLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // In production, this would send an email via API
    // For now, just show confirmation
    setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-gs-black z-[9999] flex flex-col items-center justify-center p-gs-6">
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      <div className="relative text-center space-y-gs-6 max-w-sm">
        <ChloeSprite state="smug" size={128} glowing className="mx-auto" />

        <div className="bevel-raised bg-gs-light p-gs-6">
          <h1 className="font-system text-os-lg font-bold text-gs-black mb-gs-3">
            Desktop Required
          </h1>
          <p className="font-data text-data-sm text-gs-mid mb-gs-4">
            This forensic lab requires a desktop. I don&apos;t do small screens.
          </p>

          {/* Send link form */}
          {!sent ? (
            <form onSubmit={handleSendLink} className="space-y-gs-2">
              <BevelInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                fullWidth
              />
              <button type="submit" className="bevel-button-primary text-os-sm w-full">
                Send me a link
              </button>
            </form>
          ) : (
            <div className="bevel-sunken bg-gs-near-white p-gs-3">
              <p className="font-data text-data-sm text-gs-terminal">
                Link sent to {email}
              </p>
            </div>
          )}
        </div>

        {/* Dismiss option */}
        <button
          onClick={() => setDismissed(true)}
          className="font-data text-data-xs text-gs-mid-light hover:text-gs-fuchsia"
        >
          I insist on using mobile anyway
        </button>
      </div>
    </div>
  );
}
