/**
 * LinkAnalyzer — Browser-based link structure analysis via page.evaluate().
 *
 * Extracts internal/external links, anchor text quality signals, rel attribute
 * usage, navigation structure (breadcrumbs, pagination), and SEO concerns
 * (broken hash links, javascript: hrefs, empty anchors).
 *
 * Consumers: M04 (page metadata), M03 (performance — link count), M08 (tag governance)
 */

import type { Page } from 'patchright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InternalLink {
  href: string;
  text: string;          // first 50 chars
  rel: string[];
  inNav: boolean;
}

export interface ExternalLink {
  href: string;
  domain: string;
  text: string;          // first 50 chars
  rel: string[];
  newTab: boolean;
}

export interface BreadcrumbInfo {
  items: string[];       // breadcrumb text items
  hasSchema: boolean;    // has BreadcrumbList JSON-LD or itemtype
}

export interface PaginationInfo {
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number | null;
}

export interface LinkAnalysis {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;

  internalLinkDetails: InternalLink[];   // capped at 100
  uniqueInternalPaths: number;

  externalLinkDetails: ExternalLink[];   // capped at 50
  uniqueExternalDomains: number;

  // Anchor text quality
  genericAnchors: number;       // "click here", "read more", "learn more", "here", "link", "this"
  emptyAnchors: number;         // no text, no aria-label, no title
  imageOnlyAnchors: number;     // <a> containing only <img> with no alt text

  // Rel attributes
  nofollowCount: number;
  sponsoredCount: number;
  ugcCount: number;
  noreferrerCount: number;
  noopenerCount: number;
  newTabCount: number;          // target="_blank"

  // Navigation structure
  navLinks: number;             // links inside <nav> elements
  footerLinks: number;          // links inside <footer>
  breadcrumbs: BreadcrumbInfo | null;
  pagination: PaginationInfo | null;

  // SEO concerns
  brokenHashLinks: number;      // href="#something" where #something doesn't exist as an id
  javascriptLinks: number;      // href="javascript:..."
  telephoneLinks: number;       // href="tel:..."
  emailLinks: number;           // href="mailto:..."
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_INTERNAL = 100;
const MAX_EXTERNAL = 50;

const GENERIC_ANCHOR_RE = /^(click here|read more|learn more|here|link|this|more|go|continue|details|info)$/i;

// ---------------------------------------------------------------------------
// LinkAnalyzer
// ---------------------------------------------------------------------------

export class LinkAnalyzer {
  /**
   * Analyze link structure of the current page via a single page.evaluate().
   * @param page       Patchright/Playwright Page instance (already navigated)
   * @param targetDomain  The domain being audited (e.g. "example.com")
   */
  static async analyze(page: Page, targetDomain: string): Promise<LinkAnalysis> {
    return page.evaluate(
      ({
        domain,
        maxInternal,
        maxExternal,
        genericPattern,
      }: {
        domain: string;
        maxInternal: number;
        maxExternal: number;
        genericPattern: string;
      }) => {
        // ---------------------------------------------------------------
        // Helpers (inside browser context)
        // ---------------------------------------------------------------

        /**
         * Normalize a domain for comparison: strip "www.", lowercase.
         * Returns the registrable domain (last two segments, or last three
         * if the second-to-last is a known ccTLD part like "co.uk").
         */
        function normalizeDomain(d: string): string {
          let clean = d.toLowerCase().replace(/^www\./, '');
          // Handle common multi-part TLDs
          const parts = clean.split('.');
          if (parts.length > 2) {
            const sld = parts[parts.length - 2];
            const knownSLDs = ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'];
            if (sld && knownSLDs.includes(sld) && parts[parts.length - 1]!.length === 2) {
              // e.g. example.co.uk → keep last 3
              clean = parts.slice(-3).join('.');
            } else {
              clean = parts.slice(-2).join('.');
            }
          }
          return clean;
        }

        function isInternalDomain(linkDomain: string, target: string): boolean {
          const normalizedLink = normalizeDomain(linkDomain);
          const normalizedTarget = normalizeDomain(target);
          return normalizedLink === normalizedTarget ||
            normalizedLink.endsWith('.' + normalizedTarget);
        }

        function parseRel(relAttr: string | null): string[] {
          if (!relAttr) return [];
          return relAttr.trim().split(/\s+/).filter(Boolean).map(r => r.toLowerCase());
        }

        function getLinkText(anchor: HTMLAnchorElement): string {
          const text = (anchor.textContent ?? '').trim();
          if (text) return text.slice(0, 50);

          // Fall back to img alt text
          const img = anchor.querySelector('img');
          if (img) {
            const alt = (img.getAttribute('alt') ?? '').trim();
            if (alt) return alt.slice(0, 50);
          }

          // Fall back to aria-label or title
          const ariaLabel = (anchor.getAttribute('aria-label') ?? '').trim();
          if (ariaLabel) return ariaLabel.slice(0, 50);

          const title = (anchor.getAttribute('title') ?? '').trim();
          if (title) return title.slice(0, 50);

          return '';
        }

        // ---------------------------------------------------------------
        // Main analysis
        // ---------------------------------------------------------------

        const genericRe = new RegExp(genericPattern, 'i');

        const allAnchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));

        const internalDetails: Array<{
          href: string;
          text: string;
          rel: string[];
          inNav: boolean;
        }> = [];
        const externalDetails: Array<{
          href: string;
          domain: string;
          text: string;
          rel: string[];
          newTab: boolean;
        }> = [];

        const internalPathSet = new Set<string>();
        const externalDomainSet = new Set<string>();

        let totalLinks = 0;
        let internalCount = 0;
        let externalCount = 0;
        let genericAnchors = 0;
        let emptyAnchors = 0;
        let imageOnlyAnchors = 0;
        let nofollowCount = 0;
        let sponsoredCount = 0;
        let ugcCount = 0;
        let noreferrerCount = 0;
        let noopenerCount = 0;
        let newTabCount = 0;
        let navLinks = 0;
        let footerLinks = 0;
        let brokenHashLinks = 0;
        let javascriptLinks = 0;
        let telephoneLinks = 0;
        let emailLinks = 0;

        for (const anchor of allAnchors) {
          const rawHref = anchor.getAttribute('href') ?? '';
          if (!rawHref) continue;

          totalLinks++;

          // Count special href types
          const hrefLower = rawHref.toLowerCase().trim();
          if (hrefLower.startsWith('javascript:')) {
            javascriptLinks++;
            continue; // skip further classification
          }
          if (hrefLower.startsWith('tel:')) {
            telephoneLinks++;
            continue;
          }
          if (hrefLower.startsWith('mailto:')) {
            emailLinks++;
            continue;
          }

          // Hash-only links
          if (rawHref === '#') {
            // skip — don't count "#" alone as broken
            continue;
          }
          if (rawHref.startsWith('#')) {
            const id = rawHref.slice(1);
            if (id && !document.getElementById(id)) {
              brokenHashLinks++;
            }
            continue;
          }

          // Parse into URL
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(rawHref, document.baseURI);
          } catch {
            continue; // malformed href
          }

          // Determine internal vs external
          const linkDomain = parsedUrl.hostname;
          const rel = parseRel(anchor.getAttribute('rel'));
          const text = getLinkText(anchor);
          const isNav = anchor.closest('nav') !== null;
          const isFooter = anchor.closest('footer') !== null;
          const isBlank = anchor.getAttribute('target') === '_blank';

          // Rel attribute counts
          if (rel.includes('nofollow')) nofollowCount++;
          if (rel.includes('sponsored')) sponsoredCount++;
          if (rel.includes('ugc')) ugcCount++;
          if (rel.includes('noreferrer')) noreferrerCount++;
          if (rel.includes('noopener')) noopenerCount++;
          if (isBlank) newTabCount++;
          if (isNav) navLinks++;
          if (isFooter) footerLinks++;

          // Anchor text quality checks
          const rawText = (anchor.textContent ?? '').trim();
          if (genericRe.test(rawText)) {
            genericAnchors++;
          }

          // Empty anchor check
          const hasText = rawText.length > 0;
          const hasAriaLabel = !!anchor.getAttribute('aria-label')?.trim();
          const hasTitle = !!anchor.getAttribute('title')?.trim();
          const imgChild = anchor.querySelector('img');
          const hasImgAlt = imgChild ? !!(imgChild.getAttribute('alt') ?? '').trim() : false;
          if (!hasText && !hasAriaLabel && !hasTitle && (!imgChild || !hasImgAlt)) {
            emptyAnchors++;
          }

          // Image-only anchor: has <img> but no text content, and img has no alt
          if (imgChild && !hasText) {
            const imgAlt = (imgChild.getAttribute('alt') ?? '').trim();
            if (!imgAlt) {
              imageOnlyAnchors++;
            }
          }

          // Classify internal vs external
          if (isInternalDomain(linkDomain, domain)) {
            internalCount++;
            internalPathSet.add(parsedUrl.pathname);
            if (internalDetails.length < maxInternal) {
              internalDetails.push({
                href: parsedUrl.href,
                text,
                rel,
                inNav: isNav,
              });
            }
          } else {
            externalCount++;
            externalDomainSet.add(normalizeDomain(linkDomain));
            if (externalDetails.length < maxExternal) {
              externalDetails.push({
                href: parsedUrl.href,
                domain: linkDomain,
                text,
                rel,
                newTab: isBlank,
              });
            }
          }
        }

        // ---------------------------------------------------------------
        // Breadcrumb detection
        // ---------------------------------------------------------------

        let breadcrumbs: { items: string[]; hasSchema: boolean } | null = null;

        const bcSelectors = [
          '[itemtype*="BreadcrumbList"]',
          'nav[aria-label*="breadcrumb" i]',
          'nav[aria-label*="Breadcrumb" i]',
          '.breadcrumb',
          '[class*="breadcrumb"]',
        ];

        let bcElement: Element | null = null;
        for (const sel of bcSelectors) {
          try {
            bcElement = document.querySelector(sel);
            if (bcElement) break;
          } catch {
            // invalid selector fallback
          }
        }

        if (bcElement) {
          const items: string[] = [];
          // Extract from li > a or li text, or direct a children
          const listItems = bcElement.querySelectorAll('li');
          if (listItems.length > 0) {
            listItems.forEach(li => {
              const t = (li.textContent ?? '').trim().replace(/\s+/g, ' ');
              if (t) items.push(t.slice(0, 100));
            });
          } else {
            const links = bcElement.querySelectorAll('a');
            links.forEach(a => {
              const t = (a.textContent ?? '').trim();
              if (t) items.push(t.slice(0, 100));
            });
          }

          // Check for schema markup
          let hasSchema = false;
          // JSON-LD check
          const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
          jsonLdScripts.forEach(script => {
            try {
              const data = JSON.parse(script.textContent ?? '');
              const checkType = (obj: unknown): boolean => {
                if (!obj || typeof obj !== 'object') return false;
                const o = obj as Record<string, unknown>;
                if (o['@type'] === 'BreadcrumbList') return true;
                if (Array.isArray(o['@graph'])) {
                  return (o['@graph'] as unknown[]).some(checkType);
                }
                return false;
              };
              if (checkType(data)) hasSchema = true;
            } catch { /* invalid JSON */ }
          });

          // Microdata itemtype check
          if (!hasSchema && document.querySelector('[itemtype*="BreadcrumbList"]')) {
            hasSchema = true;
          }

          if (items.length > 0) {
            breadcrumbs = { items, hasSchema };
          }
        }

        // ---------------------------------------------------------------
        // Pagination detection
        // ---------------------------------------------------------------

        let pagination: { hasNext: boolean; hasPrev: boolean; totalPages: number | null } | null = null;

        const linkNext = document.querySelector('link[rel="next"]') ||
          document.querySelector('a[rel="next"]');
        const linkPrev = document.querySelector('link[rel="prev"]') ||
          document.querySelector('a[rel="prev"]') ||
          document.querySelector('link[rel="previous"]') ||
          document.querySelector('a[rel="previous"]');

        const paginationSelectors = [
          '.pagination',
          '[class*="pagination"]',
          'nav[aria-label*="pagination" i]',
          'nav[aria-label*="Pagination" i]',
        ];

        let paginationElement: Element | null = null;
        for (const sel of paginationSelectors) {
          try {
            paginationElement = document.querySelector(sel);
            if (paginationElement) break;
          } catch {
            // invalid selector fallback
          }
        }

        const hasNext = !!linkNext;
        const hasPrev = !!linkPrev;

        if (hasNext || hasPrev || paginationElement) {
          let totalPages: number | null = null;

          if (paginationElement) {
            // Try to extract total pages from the last numbered link
            const pageLinks = paginationElement.querySelectorAll('a');
            let maxPage = 0;
            pageLinks.forEach(a => {
              const text = (a.textContent ?? '').trim();
              const num = parseInt(text, 10);
              if (!isNaN(num) && num > maxPage && num < 100000) {
                maxPage = num;
              }
            });
            // Also check for a "last" page indicator
            const allText = (paginationElement.textContent ?? '').trim();
            const pageMatch = allText.match(/(?:of|\/)\s*(\d+)/);
            if (pageMatch) {
              const extracted = parseInt(pageMatch[1]!, 10);
              if (!isNaN(extracted) && extracted > maxPage && extracted < 100000) {
                maxPage = extracted;
              }
            }
            if (maxPage > 0) totalPages = maxPage;
          }

          pagination = { hasNext, hasPrev, totalPages };
        }

        // ---------------------------------------------------------------
        // Assemble result
        // ---------------------------------------------------------------

        return {
          totalLinks,
          internalLinks: internalCount,
          externalLinks: externalCount,

          internalLinkDetails: internalDetails,
          uniqueInternalPaths: internalPathSet.size,

          externalLinkDetails: externalDetails,
          uniqueExternalDomains: externalDomainSet.size,

          genericAnchors,
          emptyAnchors,
          imageOnlyAnchors,

          nofollowCount,
          sponsoredCount,
          ugcCount,
          noreferrerCount,
          noopenerCount,
          newTabCount,

          navLinks,
          footerLinks,
          breadcrumbs,
          pagination,

          brokenHashLinks,
          javascriptLinks,
          telephoneLinks,
          emailLinks,
        };
      },
      {
        domain: targetDomain,
        maxInternal: MAX_INTERNAL,
        maxExternal: MAX_EXTERNAL,
        genericPattern: GENERIC_ANCHOR_RE.source,
      },
    );
  }
}
