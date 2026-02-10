import Link from 'next/link';

interface RateLimitedProps {
  used: number;
  limit: number;
  isAuthenticated: boolean;
}

export function RateLimited({ used, limit, isAuthenticated }: RateLimitedProps) {
  return (
    <div className="max-w-md mx-auto text-center bg-surface border border-border rounded-xl p-8">
      <h2 className="font-heading text-h4 text-primary mb-2">
        Daily Scan Limit Reached
      </h2>
      <p className="text-sm text-muted mb-4">
        You&apos;ve used {used}/{limit} scans today. Limits reset at midnight UTC.
      </p>
      {!isAuthenticated ? (
        <Link
          href="/register"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-heading font-700"
        >
          Register for more scans
        </Link>
      ) : (
        <p className="text-xs text-muted">
          Paid users have unlimited scans.
        </p>
      )}
    </div>
  );
}
