/**
 * Schema.org Structured Data Parser
 *
 * Extracts and validates JSON-LD (enhanced), Microdata, and RDFa from raw HTML.
 * Assesses rich snippet eligibility for Google Search features.
 */

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StructuredDataResult {
  /** JSON-LD blocks (already extracted in M04, this provides type-level analysis) */
  jsonLdTypes: string[];
  /** Microdata items extracted from [itemscope] elements */
  microdata: MicrodataItem[];
  /** RDFa items extracted from [typeof] elements */
  rdfa: RDFaItem[];
  /** Rich snippet feature eligibility */
  richSnippetEligibility: RichSnippetAssessment[];
  /** Validation errors: missing required properties per schema type */
  validationErrors: ValidationError[];
  /** Total structured data items across all formats */
  totalItems: number;
}

export interface MicrodataItem {
  type: string;
  properties: Record<string, string>;
}

export interface RDFaItem {
  type: string;
  properties: Record<string, string>;
}

export interface RichSnippetAssessment {
  feature: string;
  eligible: boolean;
  format: 'json-ld' | 'microdata' | 'rdfa';
  missingRequired: string[];
}

export interface ValidationError {
  type: string;
  format: 'json-ld' | 'microdata' | 'rdfa';
  missing: string[];
}

// ---------------------------------------------------------------------------
// Required properties per schema type (for Google rich results)
// ---------------------------------------------------------------------------

const RICH_RESULT_REQUIREMENTS: Record<string, { feature: string; required: string[] }> = {
  'Product': { feature: 'Product', required: ['name', 'image'] },
  'Review': { feature: 'Review', required: ['author', 'reviewRating', 'itemReviewed'] },
  'AggregateRating': { feature: 'Review Snippet', required: ['ratingValue', 'reviewCount'] },
  'FAQPage': { feature: 'FAQ', required: ['mainEntity'] },
  'HowTo': { feature: 'How-To', required: ['name', 'step'] },
  'Recipe': { feature: 'Recipe', required: ['name', 'image'] },
  'Article': { feature: 'Article', required: ['headline', 'image', 'datePublished', 'author'] },
  'NewsArticle': { feature: 'News Article', required: ['headline', 'image', 'datePublished'] },
  'BreadcrumbList': { feature: 'Breadcrumb', required: ['itemListElement'] },
  'Event': { feature: 'Event', required: ['name', 'startDate', 'location'] },
  'LocalBusiness': { feature: 'Local Business', required: ['name', 'address'] },
  'JobPosting': { feature: 'Job Posting', required: ['title', 'description', 'datePosted', 'hiringOrganization'] },
  'VideoObject': { feature: 'Video', required: ['name', 'uploadDate', 'thumbnailUrl'] },
  'Course': { feature: 'Course', required: ['name', 'provider'] },
  'SoftwareApplication': { feature: 'Software App', required: ['name', 'operatingSystem'] },
};

// ---------------------------------------------------------------------------
// JSON-LD analysis (enhanced beyond basic type extraction)
// ---------------------------------------------------------------------------

function analyzeJsonLd(html: string): { types: string[]; items: Array<{ type: string; properties: string[] }> } {
  const $ = cheerio.load(html);
  const types: string[] = [];
  const items: Array<{ type: string; properties: string[] }> = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      extractJsonLdItems(parsed, types, items);
    } catch { /* invalid JSON-LD */ }
  });

  return { types, items };
}

function extractJsonLdItems(
  data: unknown,
  types: string[],
  items: Array<{ type: string; properties: string[] }>,
): void {
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    for (const item of data) extractJsonLdItems(item, types, items);
    return;
  }

  const obj = data as Record<string, unknown>;

  // Handle @graph
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) extractJsonLdItems(item, types, items);
  }

  const rawType = obj['@type'];
  const typeList = Array.isArray(rawType) ? rawType : rawType ? [rawType] : [];

  for (const t of typeList) {
    if (typeof t === 'string') {
      const cleanType = t.replace(/^https?:\/\/schema\.org\//, '');
      if (!types.includes(cleanType)) types.push(cleanType);

      const props = Object.keys(obj).filter(k => !k.startsWith('@'));
      items.push({ type: cleanType, properties: props });
    }
  }
}

// ---------------------------------------------------------------------------
// Microdata extraction
// ---------------------------------------------------------------------------

function extractMicrodata(html: string): MicrodataItem[] {
  const $ = cheerio.load(html);
  const items: MicrodataItem[] = [];

  $('[itemscope]').each((_, el) => {
    if (items.length >= 30) return;
    const $el = $(el);
    const rawType = $el.attr('itemtype') ?? '';
    const type = rawType.replace(/^https?:\/\/schema\.org\//, '');
    if (!type) return;

    const properties: Record<string, string> = {};
    $el.find('[itemprop]').each((__, propEl) => {
      const $prop = $(propEl);
      const propName = $prop.attr('itemprop');
      if (!propName) return;

      // Don't recurse into nested itemscopes (they're separate items)
      const closestScope = $prop.closest('[itemscope]');
      if (closestScope[0] !== el) return;

      const value =
        $prop.attr('content') ??
        $prop.attr('href') ??
        $prop.attr('src') ??
        $prop.attr('datetime') ??
        $prop.text().trim().slice(0, 200);

      if (value) properties[propName] = value;
    });

    items.push({ type, properties });
  });

  return items;
}

// ---------------------------------------------------------------------------
// RDFa extraction
// ---------------------------------------------------------------------------

function extractRDFa(html: string): RDFaItem[] {
  const $ = cheerio.load(html);
  const items: RDFaItem[] = [];

  $('[typeof]').each((_, el) => {
    if (items.length >= 30) return;
    const $el = $(el);
    const rawType = $el.attr('typeof') ?? '';
    const type = rawType.replace(/^schema:/, '').replace(/^https?:\/\/schema\.org\//, '');
    if (!type) return;

    const properties: Record<string, string> = {};
    $el.find('[property]').each((__, propEl) => {
      const $prop = $(propEl);
      const propName = ($prop.attr('property') ?? '').replace(/^schema:/, '');
      if (!propName) return;

      const value =
        $prop.attr('content') ??
        $prop.attr('href') ??
        $prop.attr('src') ??
        $prop.text().trim().slice(0, 200);

      if (value) properties[propName] = value;
    });

    items.push({ type, properties });
  });

  return items;
}

// ---------------------------------------------------------------------------
// Rich snippet eligibility assessment
// ---------------------------------------------------------------------------

function assessRichSnippets(
  jsonLdItems: Array<{ type: string; properties: string[] }>,
  microdata: MicrodataItem[],
  rdfa: RDFaItem[],
): { assessments: RichSnippetAssessment[]; errors: ValidationError[] } {
  const assessments: RichSnippetAssessment[] = [];
  const errors: ValidationError[] = [];

  // Check JSON-LD items
  for (const item of jsonLdItems) {
    const req = RICH_RESULT_REQUIREMENTS[item.type];
    if (!req) continue;

    const missing = req.required.filter(r => !item.properties.includes(r));
    assessments.push({
      feature: req.feature,
      eligible: missing.length === 0,
      format: 'json-ld',
      missingRequired: missing,
    });
    if (missing.length > 0) {
      errors.push({ type: item.type, format: 'json-ld', missing });
    }
  }

  // Check microdata items
  for (const item of microdata) {
    const req = RICH_RESULT_REQUIREMENTS[item.type];
    if (!req) continue;

    const props = Object.keys(item.properties);
    const missing = req.required.filter(r => !props.includes(r));
    assessments.push({
      feature: req.feature,
      eligible: missing.length === 0,
      format: 'microdata',
      missingRequired: missing,
    });
    if (missing.length > 0) {
      errors.push({ type: item.type, format: 'microdata', missing });
    }
  }

  // Check RDFa items
  for (const item of rdfa) {
    const req = RICH_RESULT_REQUIREMENTS[item.type];
    if (!req) continue;

    const props = Object.keys(item.properties);
    const missing = req.required.filter(r => !props.includes(r));
    assessments.push({
      feature: req.feature,
      eligible: missing.length === 0,
      format: 'rdfa',
      missingRequired: missing,
    });
    if (missing.length > 0) {
      errors.push({ type: item.type, format: 'rdfa', missing });
    }
  }

  return { assessments, errors };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extract all structured data from HTML and assess rich snippet eligibility.
 */
export function extractStructuredData(html: string): StructuredDataResult {
  const jsonLd = analyzeJsonLd(html);
  const microdata = extractMicrodata(html);
  const rdfa = extractRDFa(html);

  const { assessments, errors } = assessRichSnippets(jsonLd.items, microdata, rdfa);

  return {
    jsonLdTypes: jsonLd.types,
    microdata,
    rdfa,
    richSnippetEligibility: assessments,
    validationErrors: errors,
    totalItems: jsonLd.items.length + microdata.length + rdfa.length,
  };
}
