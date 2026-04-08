import type { Metadata } from 'next';
import BrandBook from '@/components/brand/brand-book';

/**
 * AlphaScan Brand Book
 * ════════════════════════
 *
 * Interactive brand guidelines documenting the complete visual identity:
 * logo system, OKLCH color palette, typography, Chloe mascot,
 * brand voice, atmospheric effects, and media assets.
 */

export const metadata: Metadata = {
  title: 'Brand Book',
  description:
    'The official AlphaScan brand guidelines. Logo system, OKLCH pink monochrome palette, typography, Chloe mascot, brand voice, and visual identity.',
  openGraph: {
    title: 'AlphaScan Brand Book',
    description: 'The official brand guidelines for AlphaScan — forensic marketing intelligence.',
    images: ['/opengraph-image.png'],
  },
};

export default function BrandPage() {
  return <BrandBook />;
}
