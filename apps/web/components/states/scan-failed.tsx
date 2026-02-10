import Link from 'next/link';

interface ScanFailedProps {
  domain: string;
  error?: string;
  scanId: string;
}

export function ScanFailed({ domain, error, scanId }: ScanFailedProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="mx-auto w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="font-heading text-h3 text-primary mb-2">Scan Could Not Complete</h2>
      <p className="text-muted text-sm">
        We couldn&apos;t reach {domain}. This usually means the site is
        blocking automated requests or is temporarily unavailable.
      </p>
      <div className="flex justify-center gap-4 mt-6">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-heading font-700"
        >
          Scan Different URL
        </Link>
      </div>
      {error && (
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted">Error: {error}</p>
          <p className="text-xs text-muted">Scan ID: {scanId}</p>
        </div>
      )}
    </div>
  );
}
