import { ScanInput } from '@/components/scan/scan-input';

export function EmptyState() {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="mx-auto w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>
      <h2 className="font-heading text-h3 text-primary mb-2">No scans yet</h2>
      <p className="text-muted text-sm mb-8">
        Enter a URL to run your first marketing technology audit.
      </p>
      <ScanInput />
    </div>
  );
}
