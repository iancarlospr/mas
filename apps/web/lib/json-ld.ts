/**
 * JSON-LD Structured Data Helpers
 *
 * Schema.org markup for SEO rich results.
 * Injected via <script type="application/ld+json"> in page/layout components.
 */

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Alpha Scan',
    legalName: 'Marketing Alpha Scan',
    url: 'https://marketingalphascan.com',
    logo: 'https://marketingalphascan.com/apple-icon',
    description:
      'Forensic marketing intelligence platform. Reverse-engineer any marketing stack in 90 seconds.',
  };
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Alpha Scan',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Forensic marketing intelligence platform that reverse-engineers any marketing stack in 90 seconds. 45 modules, GhostScan™ detection, AI synthesis, MarketingIQ™ scoring.',
    url: 'https://marketingalphascan.com',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free MarTech scan with 45 forensic modules',
    },
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  excerpt: string;
  date: string;
  slug: string;
  author?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      '@type': 'Organization',
      name: post.author ?? 'Alpha Scan Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Alpha Scan',
      url: 'https://marketingalphascan.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://marketingalphascan.com/blog/${post.slug}`,
    },
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
