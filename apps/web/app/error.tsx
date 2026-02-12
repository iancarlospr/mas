'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
      <div className="text-center max-w-md px-6">
        <h1 className="font-heading font-700 text-4xl text-[#1A1A2E]">
          Something went wrong
        </h1>
        <p className="mt-4 text-[#64748B]">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-[#94A3B8] font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-8 bg-[#0F3460] text-white rounded-lg px-6 py-3 font-heading font-700 hover:bg-[#0F3460]/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
