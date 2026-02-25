import Link from 'next/link';

/**
 * GhostScan OS — Marketing Footer
 * ═══════════════════════════════════════
 *
 * WHAT: Footer for marketing pages with retro GhostScan OS styling.
 * WHY:  Consistent brand experience from navbar to footer (Plan Section 14).
 * HOW:  Bevel-raised bar, system font, ghost pixel logo, OS-styled links.
 */

const footerLinks = {
  Product: [
    { href: '/#features', label: 'Features' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/blog', label: 'Blog' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: 'mailto:support@marketingalphascan.com', label: 'Contact' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-gs-chrome bevel-raised border-t-0 mt-gs-8">
      <div className="mx-auto max-w-7xl px-gs-4 py-gs-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gs-6">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-gs-2 mb-gs-2">
              <span className="text-os-lg">👻</span>
              <span className="font-system text-os-base font-bold text-gs-red">
                AlphaScan
              </span>
            </div>
            <p className="font-data text-data-xs text-gs-muted">
              Forensic marketing intelligence. Powered by GhostScan™.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-system text-os-xs text-gs-muted uppercase tracking-wider mb-gs-2">
                {category}
              </h3>
              <ul className="space-y-gs-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-data text-data-xs text-gs-muted hover:text-gs-red transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-gs-8 pt-gs-4 border-t border-gs-chrome-dark">
          <p className="font-data text-data-xs text-gs-muted text-center">
            &copy; {new Date().getFullYear()} MarketingAlphaScan. All rights reserved.
            Built with GhostScan OS v2.0.26.
          </p>
        </div>
      </div>
    </footer>
  );
}
