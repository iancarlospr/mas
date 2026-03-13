import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Dashboard Layout — Pass-through.
 * The Desktop shell (menu bar, taskbar, icons) renders at root layout.
 * Dashboard pages render their content directly.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
