import type { Metadata } from 'next';
import Link from 'next/link';
import { ResendVerificationButton } from './resend-button';

export const metadata: Metadata = {
  title: 'Verify Email',
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
    <div className="text-center">
      <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </div>
      <h1 className="font-heading text-h3 text-primary mb-2">Check your email</h1>
      <p className="text-muted text-sm">
        We sent a verification link to{' '}
        {email ? <strong>{email}</strong> : 'your email address'}.
      </p>
      {scanDomain ? (
        <p className="text-muted text-sm mt-2">
          Your scan of <strong className="text-primary">{scanDomain}</strong> will start automatically after you verify.
        </p>
      ) : (
        <p className="text-muted text-sm mt-2">
          Click the link to verify your account and start scanning.
        </p>
      )}

      {email && (
        <div className="mt-5">
          <ResendVerificationButton email={email} />
        </div>
      )}

      <Link
        href="/login"
        className="inline-block mt-4 text-sm text-accent hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}
