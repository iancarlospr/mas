import type { Metadata } from 'next';
import { softwareApplicationJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'Alpha Scan | Forensic Marketing Intelligence',
  description:
    'Your MarTech stack is a landfill. Alpha Scan reverse-engineers any URL in minutes: infrastructure, tracking, performance, compliance. Free preview, no card required.',
  openGraph: {
    type: 'website',
    url: 'https://marketingalphascan.com/',
    siteName: 'Alpha Scan',
    title: 'Alpha Scan | Forensic Marketing Intelligence',
    description:
      'Serve an unclockable audit in minutes. Extract the ground truth from any marketing stack.',
    images: [
      {
        url: 'https://marketingalphascan.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Alpha Scan — Forensic Marketing Intelligence',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alpha Scan',
    description: 'Your MarTech stack is a landfill. Let Chloé run the forensics.',
    images: ['https://marketingalphascan.com/og-image.png'],
  },
};

/**
 * Root page — Empty desktop.
 * Marketing content is now in desktop icon windows.
 * The DesktopShell (menu bar, icons, taskbar) renders at root layout.
 */
export default function HomePage() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
    />
  );
}
