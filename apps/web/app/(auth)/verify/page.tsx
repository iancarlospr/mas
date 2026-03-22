import type { Metadata } from 'next';
import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { Window } from '@/components/os/window';
import { ResendVerificationButton } from './resend-button';

/**
 * GhostScan OS — Email Verification Page
 * ═══════════════════════════════════════════
 *
 * WHAT: "Awaiting Verification" screen after registration.
 * WHY:  Auth pages live outside the OS — dark CRT background, you're
 *       trying to get in. Chloé waits impatiently (Plan Section 15).
 * HOW:  Full-screen dark bg, Window dialog, Chloé idle sprite,
 *       verification instructions, resend button.
 */

export const metadata: Metadata = {
  title: 'Verify Email — GhostScan OS',
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; scan_url?: string }>;
}) {
  const { email, scan_url } = await searchParams;

  const scanDomain = (() => {
    if (!scan_url) return null;
    try { return new URL(scan_url).hostname.replace(/^www\./, ''); } catch { return null; }
  })();

  return (
    <div className="fixed inset-0 bg-gs-ink flex items-center justify-center">
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      <div className="relative">
        {/* Chloé waiting */}
        <div className="absolute -top-[80px] left-1/2 -translate-x-1/2 flex flex-col items-center">
          <ChloeSprite state="idle" size={64} glowing />
        </div>

        <Window
          id="verify-email"
          title="Awaiting Verification"
          variant="dialog"
          isActive
          width={400}
        >
          <div className="p-gs-6 text-center space-y-gs-4">
            {/* Mail icon */}
            <div className="bevel-sunken bg-gs-paper w-[64px] h-[64px] mx-auto flex items-center justify-center">
              <span className="text-[32px]">📧</span>
            </div>

            <div>
              <h1 className="font-system text-os-lg font-bold text-gs-ink mb-gs-2">
                Check your email
              </h1>
              <p className="font-data text-data-sm text-gs-muted">
                Verification link sent to{' '}
                {email ? (
                  <strong className="text-gs-ink">{email}</strong>
                ) : (
                  'your email address'
                )}
                .
              </p>
            </div>

            {scanDomain ? (
              <div className="bevel-sunken bg-gs-paper px-gs-3 py-gs-2">
                <p className="font-data text-data-xs text-gs-muted">
                  Your scan of{' '}
                  <strong className="text-gs-red">{scanDomain}</strong>{' '}
                  will start automatically after you verify.
                </p>
              </div>
            ) : (
              <p className="font-data text-data-xs text-gs-muted">
                Click the link to verify your account and start scanning.
              </p>
            )}

            {email && (
              <div>
                <ResendVerificationButton email={email} />
              </div>
            )}

            <Link
              href="/login"
              className="inline-block font-data text-data-xs text-gs-red hover:underline font-bold"
            >
              Back to login
            </Link>
          </div>
        </Window>
      </div>
    </div>
  );
}
