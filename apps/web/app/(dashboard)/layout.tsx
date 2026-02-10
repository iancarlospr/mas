import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link href="/" className="font-heading text-lg font-800 text-primary">
              MarketingAlpha<span className="text-highlight">Scan</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/history"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                My Scans
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
