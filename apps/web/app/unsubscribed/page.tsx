import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { Window } from '@/components/os/window';

export default function UnsubscribedPage() {
  return (
    <div className="fixed inset-0 bg-gs-black flex items-center justify-center">
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      <div className="relative text-center px-gs-4">
        <ChloeSprite state="idle" size={64} glowing className="mx-auto mb-gs-8" />

        <Window id="unsubscribed" title="📧 Unsubscribed" variant="dialog" isActive width={400}>
          <div className="p-gs-6 text-center">
            <h1 className="font-system font-bold text-gs-black text-lg mb-gs-4">
              Unsubscribed
            </h1>
            <p className="font-data text-data-sm text-gs-mid mb-gs-6">
              You&apos;ve been unsubscribed from marketing emails. You&apos;ll still
              receive essential account and scan notifications.
            </p>
            <Link href="/" className="bevel-button-primary text-os-sm">
              Go Home
            </Link>
          </div>
        </Window>
      </div>
    </div>
  );
}
