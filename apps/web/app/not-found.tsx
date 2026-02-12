import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
      <div className="text-center max-w-md px-6">
        <h1 className="font-heading font-700 text-6xl text-[#1A1A2E]">404</h1>
        <p className="mt-4 text-lg text-[#64748B]">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block bg-[#0F3460] text-white rounded-lg px-6 py-3 font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
