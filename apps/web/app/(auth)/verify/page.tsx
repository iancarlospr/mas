import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Verify Email',
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

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
      <p className="text-muted text-sm mt-2">
        Click the link to verify your account and start scanning.
      </p>
      <Link
        href="/login"
        className="inline-block mt-6 text-sm text-accent hover:underline"
      >
        Back to login
      </Link>
    </div>
  );
}
