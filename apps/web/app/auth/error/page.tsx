import Link from 'next/link';

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
    <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
      <div className="mx-auto max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
        <h1 className="mb-4 text-2xl font-extrabold text-[#1A1A2E]">
          Something went wrong
        </h1>
        <p className="mb-6 text-[#64748B]">{message}</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-[#E94560] px-6 py-3 text-sm font-bold text-white hover:bg-[#D63651] transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
