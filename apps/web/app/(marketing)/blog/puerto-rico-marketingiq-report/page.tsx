import type { Metadata } from 'next';
import { blogPostingJsonLd } from '@/lib/json-ld';
import ReportContent from './report-content';

const post = {
  title: 'I Audited 50 Puerto Rico Websites. Here\'s What the Data Says.',
  excerpt: 'A comprehensive MarketingIQ audit across Banking, Healthcare, Auto, Tech, Events, Media, CPG, and Startups. 8 categories. 45 modules. 50 sites.',
  date: '2026-04-09',
  slug: 'puerto-rico-marketingiq-report',
  author: 'Ian C. Ramírez Rivera',
};

export const metadata: Metadata = {
  title: post.title,
  description: post.excerpt,
  openGraph: {
    type: 'article',
    url: `https://marketingalphascan.com/blog/${post.slug}`,
    siteName: 'Alpha Scan',
    title: post.title,
    description: post.excerpt,
    publishedTime: post.date,
    authors: [post.author],
    images: [
      {
        url: 'https://marketingalphascan.com/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: `${post.title} | Alpha Scan`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: post.title,
    description: post.excerpt,
    images: ['https://marketingalphascan.com/opengraph-image.png'],
  },
};

export default function PuertoRicoReportPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd(post)) }}
      />
      <ReportContent />
    </>
  );
}
