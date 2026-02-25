import Link from 'next/link';
import { ChloeSprite } from '@/components/chloe/chloe-sprite';
import { Window } from '@/components/os/window';

interface ErrorPageProps {
  searchParams: Promise<{ message?: string }>;
}

const messages: Record<string, string> = {
  verification_failed: 'Email verification failed. The link may have expired.',
  invalid_link: 'Invalid confirmation link.',
  invalid_token: 'Invalid or expired token.',
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const message = messages[params.message ?? ''] ?? 'An unexpected error occurred.';

  return (
    <div className="fixed inset-0 bg-gs-black flex items-center justify-center">
      <div className="noise-grain" aria-hidden="true" />
      <div className="crt-scanlines" aria-hidden="true" />

      <div className="relative text-center px-gs-4">
        <ChloeSprite state="critical" size={64} glowing className="mx-auto mb-gs-8" />

        <Window id="auth-error" title="⚠ Error" variant="dialog" isActive width={400}>
          <div className="p-gs-6 text-center">
            <h1 className="font-system font-bold text-gs-black text-lg mb-gs-4">
              Something went wrong
            </h1>
            <p className="font-data text-data-sm text-gs-mid mb-gs-6">{message}</p>
            <Link href="/" className="bevel-button-primary text-os-sm">
              Go Home
            </Link>
          </div>
        </Window>
      </div>
    </div>
  );
}
