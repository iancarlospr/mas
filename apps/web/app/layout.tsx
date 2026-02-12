import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from 'next/font/google';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import './globals.css';

const heading = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'MarketingAlphaScan — Reverse-Engineer Any Marketing Stack',
    template: '%s | MarketingAlphaScan',
  },
  description:
    'Forensic marketing intelligence platform that analyzes any URL to reverse-engineer a brand\'s marketing technology stack, strategy, and performance.',
  metadataBase: new URL('https://marketingalphascan.com'),
  openGraph: {
    type: 'website',
    siteName: 'MarketingAlphaScan',
    title: 'MarketingAlphaScan — Reverse-Engineer Any Marketing Stack',
    description:
      'Analyze any URL to uncover the complete marketing technology stack, tracking setup, compliance gaps, and performance issues.',
    url: 'https://marketingalphascan.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MarketingAlphaScan',
    description: 'Forensic marketing intelligence for any URL.',
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
      className={`${heading.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-background antialiased">
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
