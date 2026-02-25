import type { Metadata } from 'next';
import { Instrument_Serif, Pixelify_Sans, JetBrains_Mono, Permanent_Marker } from 'next/font/google';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import { EasterEggs } from '@/components/os/easter-eggs';
import { DesktopRoot } from '@/components/os/desktop-root';
import './globals.css';

/**
 * GhostScan OS — Root Layout
 *
 * The entire app is one persistent Desktop shell.
 * WindowManagerProvider wraps everything for window state.
 * DesktopShell renders at root — persists across all navigations.
 */

const displayFont = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: '400',
});

const systemFont = Pixelify_Sans({
  subsets: ['latin'],
  variable: '--font-system',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const dataFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-data',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const personalityFont = Permanent_Marker({
  subsets: ['latin'],
  variable: '--font-personality',
  display: 'swap',
  weight: '400',
});

export const metadata: Metadata = {
  title: {
    default: 'AlphaScan — Forensic Marketing Intelligence',
    template: '%s | AlphaScan',
  },
  description:
    'Your MarTech stack is a landfill. Let\'s run the forensics. AlphaScan reverse-engineers any URL to extract the ground truth about marketing infrastructure, tracking, and performance.',
  metadataBase: new URL('https://marketingalphascan.com'),
  openGraph: {
    type: 'website',
    siteName: 'AlphaScan',
    title: 'AlphaScan — Forensic Marketing Intelligence',
    description:
      'Serve an unclockable audit in 90 seconds. Extract the ground truth from any marketing stack.',
    url: 'https://marketingalphascan.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AlphaScan',
    description: 'Your MarTech stack is a landfill. Let Chloe run the forensics.',
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${systemFont.variable} ${dataFont.variable} ${personalityFont.variable}`}
    >
      <body>
        <PostHogProvider>
          <DesktopRoot>
            {children}
          </DesktopRoot>
          <EasterEggs />
        </PostHogProvider>
      </body>
    </html>
  );
}
