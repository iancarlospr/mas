import Link from 'next/link';

export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
      <div className="mx-auto max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
        <h1 className="mb-4 text-2xl font-extrabold text-[#1A1A2E]">
          Unsubscribed
        </h1>
        <p className="mb-6 text-[#64748B]">
          You&apos;ve been unsubscribed from marketing emails. You&apos;ll still
          receive essential account and scan notifications.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-[#0F3460] px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
