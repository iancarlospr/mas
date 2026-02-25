import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';

/**
 * GhostScan OS — 404 Page
 * ═══════════════════════════════
 *
 * WHAT: Custom 404 page with Chloe personality.
 * WHY:  "This page ghosted you harder than your last agency."
 *       Every edge case is a brand moment (Plan Section 17).
 * HOW:  Full-screen dark CRT background, Chloe confused, retro dialog.
 */

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gs-black flex items-center justify-center relative">
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      <div className="relative text-center px-gs-4">
        <ChloeSprite state="mischief" size={128} glowing className="mx-auto mb-gs-8" />

        <div className="bevel-raised bg-gs-light p-gs-8 max-w-md mx-auto">
          <h1 className="font-data text-[64px] font-bold text-gs-fuchsia leading-none mb-gs-4">
            404
          </h1>
          <p className="font-data text-data-lg text-gs-mid-dark mb-gs-2">
            This page ghosted you harder than your last agency.
          </p>
          <p className="font-data text-data-sm text-gs-mid mb-gs-6">
            Nothing here. Not even a redirect. Just void.
          </p>
          <Link
            href="/"
            className="bevel-button-primary text-os-sm"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
