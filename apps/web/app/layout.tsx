import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { Barlow_Condensed, JetBrains_Mono, Permanent_Marker } from 'next/font/google';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import { EasterEggs } from '@/components/os/easter-eggs';
import { DesktopRoot } from '@/components/os/desktop-root';
import { organizationJsonLd } from '@/lib/json-ld';
import './globals.css';

/**
 * Chloé's Bedroom OS — Root Layout
 *
 * The entire app is one persistent Desktop shell.
 * WindowManagerProvider wraps everything for window state.
 * DesktopShell renders at root — persists across all navigations.
 */

const displayFont = Barlow_Condensed({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
  weight: ['700', '800'],
});

const terminalFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-terminal',
  display: 'swap',
  weight: ['400', '500', '700'],
});

const personalityFont = Permanent_Marker({
  subsets: ['latin'],
  variable: '--font-personality-face',
  display: 'swap',
  weight: '400',
});

export const metadata: Metadata = {
  title: {
    default: 'Alpha Scan — Forensic Marketing Intelligence',
    template: '%s | Alpha Scan',
  },
  description:
    'Your MarTech stack is a landfill. Let\'s run the forensics. Alpha Scan reverse-engineers any URL to extract the ground truth about marketing infrastructure, tracking, and performance.',
  metadataBase: new URL('https://marketingalphascan.com'),
  openGraph: {
    type: 'website',
    siteName: 'Alpha Scan',
    title: 'Alpha Scan — Forensic Marketing Intelligence',
    description:
      'Serve an unclockable audit in minutes. Extract the ground truth from any marketing stack.',
    url: 'https://marketingalphascan.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alpha Scan',
    description: 'Your MarTech stack is a landfill. Let Chloé run the forensics.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#080808' },
    { media: '(prefers-color-scheme: light)', color: '#FFB2EF' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistMono.variable} ${displayFont.variable} ${terminalFont.variable} ${personalityFont.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script dangerouslySetInnerHTML={{ __html:
          `if(window.innerWidth<1024)document.documentElement.dataset.device="mobile"`
        }} />
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
