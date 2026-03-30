import * as cheerio from 'cheerio';

export type CheerioAPI = ReturnType<typeof cheerio.load>;

/**
 * Load HTML into a Cheerio instance for parsing.
 */
export function parseHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

/**
 * Extract all meta tags from an HTML document.
 */
export function extractMetaTags(
  $: CheerioAPI,
): Array<{ name?: string; property?: string; httpEquiv?: string; content?: string; charset?: string }> {
  const metas: Array<{
    name?: string;
    property?: string;
    httpEquiv?: string;
    content?: string;
    charset?: string;
  }> = [];

  $('meta').each((_, el) => {
    const elem = $(el);
    const meta: Record<string, string | undefined> = {};

    const name = elem.attr('name');
    const property = elem.attr('property');
    const httpEquiv = elem.attr('http-equiv');
    const content = elem.attr('content');
    const charset = elem.attr('charset');

    if (name) meta['name'] = name;
    if (property) meta['property'] = property;
    if (httpEquiv) meta['httpEquiv'] = httpEquiv;
    if (content) meta['content'] = content;
    if (charset) meta['charset'] = charset;

    if (Object.keys(meta).length > 0) {
      metas.push(meta);
    }
  });

  return metas;
}

/**
 * Extract all links (anchor tags) from an HTML document.
 */
export function extractLinks(
  $: CheerioAPI,
): Array<{ href: string; text: string; rel?: string; target?: string }> {
  const links: Array<{ href: string; text: string; rel?: string; target?: string }> = [];

  $('a[href]').each((_, el) => {
    const elem = $(el);
    const href = elem.attr('href');
    if (!href) return;

    const link: { href: string; text: string; rel?: string; target?: string } = {
      href,
      text: elem.text().trim().slice(0, 200),
    };

    const rel = elem.attr('rel');
    const target = elem.attr('target');
    if (rel) link.rel = rel;
    if (target) link.target = target;

    links.push(link);
  });

  return links;
}

/**
 * Extract all script src URLs from an HTML document.
 */
export function extractScriptSrcs($: CheerioAPI): string[] {
  const srcs: string[] = [];

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      srcs.push(src);
    }
  });

  return srcs;
}

/**
 * Extract inline scripts (without src) from an HTML document.
 */
export function extractInlineScripts($: CheerioAPI): string[] {
  const scripts: string[] = [];

  $('script:not([src])').each((_, el) => {
    const content = $(el).html();
    if (content && content.trim().length > 0) {
      scripts.push(content.trim());
    }
  });

  return scripts;
}

/**
 * Extract link[rel=stylesheet] hrefs from an HTML document.
 */
export function extractStylesheetHrefs($: CheerioAPI): string[] {
  const hrefs: string[] = [];

  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      hrefs.push(href);
    }
  });

  return hrefs;
}

/**
 * Extract Open Graph tags.
 */
export function extractOpenGraph($: CheerioAPI): Record<string, string> {
  const og: Record<string, string> = {};

  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    if (property && content) {
      og[property] = content;
    }
  });

  return og;
}

/**
 * Extract Twitter Card tags.
 */
export function extractTwitterCard($: CheerioAPI): Record<string, string> {
  const twitter: Record<string, string> = {};

  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) {
      twitter[name] = content;
    }
  });

  return twitter;
}

/**
 * Extract JSON-LD structured data from script tags.
 */
export function extractJsonLd($: CheerioAPI): unknown[] {
  const data: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content) {
      try {
        data.push(JSON.parse(content));
      } catch {
        // Invalid JSON-LD, skip
      }
    }
  });

  return data;
}

/**
 * Extract the canonical URL from the document.
 */
export function extractCanonical($: CheerioAPI): string | null {
  return $('link[rel="canonical"]').attr('href') ?? null;
}

/**
 * Extract the title from the document.
 */
export function extractTitle($: CheerioAPI): string | null {
  return $('title').first().text().trim() || null;
}

/**
 * Extract the meta description from the document.
 */
export function extractMetaDescription($: CheerioAPI): string | null {
  return $('meta[name="description"]').attr('content')?.trim() ?? null;
}

/**
 * Extract favicon references from the document.
 */
export function extractFavicons($: CheerioAPI): string[] {
  const favicons: string[] = [];

  $('link[rel*="icon"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      favicons.push(href);
    }
  });

  return favicons;
}
