/**
 * Content Analyzer — passive HTML content analysis utility.
 *
 * Extracts text metrics (word count, readability), heading structure,
 * call-to-action elements, trust signals, and content freshness indicators
 * from raw HTML. No browser needed — uses cheerio for parsing.
 *
 * Consumers: M04 (page metadata), M09 (behavioral), landing page audits
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeadingInfo {
  tag: string;       // h1, h2, h3, etc.
  text: string;      // first 100 chars
  level: number;     // 1-6
  order: number;     // position in document
}

export interface CTAInfo {
  text: string;      // first 60 chars
  tag: string;       // a, button, input
  isAboveFold: boolean;
  href: string | null;
}

export interface TrustSignal {
  type: 'testimonial' | 'review-widget' | 'security-badge' | 'certification' | 'customer-logo' | 'guarantee' | 'money-back';
  evidence: string;  // first 100 chars describing what was found
}

export interface ContentAnalysis {
  // Text metrics
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  readabilityScore: number;        // Flesch Reading Ease (0-100)
  readingGradeLevel: number;       // Flesch-Kincaid Grade Level

  // Heading structure
  headings: HeadingInfo[];         // capped at 50
  h1Count: number;
  hasProperHierarchy: boolean;     // no skipped levels (H1->H3 without H2)
  duplicateH1: boolean;

  // CTAs
  ctas: CTAInfo[];                 // capped at 20
  ctaAboveFold: number;

  // Trust signals
  trustSignals: TrustSignal[];    // capped at 20

  // Content freshness
  publishedDate: string | null;
  modifiedDate: string | null;
  copyrightYear: number | null;
  lastModifiedHeader: string | null;

  // Lists & tables
  listCount: number;
  tableCount: number;

  // Paragraphs
  paragraphCount: number;
  avgWordsPerParagraph: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HEADINGS = 50;
const MAX_CTAS = 20;
const MAX_TRUST_SIGNALS = 20;

/** Action verb patterns for CTA detection (case-insensitive). */
const CTA_VERB_PATTERN =
  /\b(buy|sign\s*up|get\s+started|try\s+free|subscribe|download|contact|request|schedule|book|start|join|explore|learn\s+more|see\s+pricing|add\s+to\s+cart|shop\s+now|order\s+now|register|apply|claim|unlock|access|begin|enroll|donate|submit|view\s+demo|watch\s+demo|free\s+trial|request\s+demo|talk\s+to|speak\s+with|chat\s+with)\b/i;

/** CSS class patterns indicating a CTA element. */
const CTA_CLASS_PATTERN = /\b(cta|btn-primary|btn-cta|action-button)\b/i;

/** Above-fold ancestor selectors. */
const ABOVE_FOLD_SELECTORS = 'header, nav, [class*="hero"], [class*="banner"]';

// ---------------------------------------------------------------------------
// Syllable counting (simplified English heuristic)
// ---------------------------------------------------------------------------

/**
 * Count syllables in a single word using a simplified English heuristic.
 * Counts vowel groups (a,e,i,o,u,y), subtracts 1 for silent-e at end,
 * minimum 1 syllable per word. Words shorter than 3 chars = 1 syllable.
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 3) return 1;

  // Count vowel groups
  const vowelGroups = w.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Subtract 1 for silent-e at end (only if there would still be at least 1 syllable)
  if (w.endsWith('e') && count > 1) {
    count--;
  }

  return Math.max(1, count);
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

type CheerioAPI = ReturnType<typeof cheerio.load>;

/**
 * Extract visible text from the body, stripping script/style/noscript tags.
 */
function extractVisibleText($: CheerioAPI): string {
  // Clone body to avoid mutating the original
  const $body = $('body').clone();

  // Remove non-visible elements
  $body.find('script, style, noscript, svg, [hidden], [aria-hidden="true"]').remove();

  return $body.text().replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Text metrics & readability
// ---------------------------------------------------------------------------

interface TextMetrics {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  readabilityScore: number;
  readingGradeLevel: number;
}

/**
 * Compute word count, sentence count, and readability scores from plain text.
 */
function computeTextMetrics(text: string): TextMetrics {
  if (!text || text.length === 0) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      readabilityScore: 0,
      readingGradeLevel: 0,
    };
  }

  // Split into words (sequences of word characters, hyphens, or apostrophes)
  const words = text.match(/[\w'-]+/g) ?? [];
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      readabilityScore: 0,
      readingGradeLevel: 0,
    };
  }

  // Split into sentences (delimited by . ? ! followed by space or end)
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);

  const avgWordsPerSentence = wordCount / sentenceCount;

  // Count total syllables
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const syllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const readabilityScore = Math.max(
    0,
    Math.min(100, Math.round(
      206.835 - 1.015 * avgWordsPerSentence - 84.6 * syllablesPerWord,
    )),
  );

  // Flesch-Kincaid Grade Level = 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
  const readingGradeLevel = Math.max(
    0,
    Math.round(
      (0.39 * avgWordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10,
    ) / 10,
  );

  return {
    wordCount,
    sentenceCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    readabilityScore,
    readingGradeLevel,
  };
}

// ---------------------------------------------------------------------------
// Heading analysis
// ---------------------------------------------------------------------------

interface HeadingAnalysis {
  headings: HeadingInfo[];
  h1Count: number;
  hasProperHierarchy: boolean;
  duplicateH1: boolean;
}

/**
 * Extract heading structure and validate hierarchy.
 */
function analyzeHeadings($: CheerioAPI): HeadingAnalysis {
  const headings: HeadingInfo[] = [];
  let order = 0;

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    if (headings.length >= MAX_HEADINGS) return;

    const $el = $(el);
    const tag = ($el.prop('tagName') as string | undefined)?.toLowerCase() ?? 'h1';
    const level = parseInt(tag.charAt(1) ?? '1', 10);
    const text = $el.text().replace(/\s+/g, ' ').trim().slice(0, 100);

    headings.push({ tag, text, level, order: order++ });
  });

  const h1Count = headings.filter(h => h.level === 1).length;
  const duplicateH1 = h1Count > 1;

  // Check hierarchy: no skipped levels
  let hasProperHierarchy = true;
  const seenLevels = new Set<number>();

  for (const heading of headings) {
    seenLevels.add(heading.level);

    // For each heading, ensure all levels between 1 and this level exist
    // (either already seen or will be the current one)
    for (let l = 1; l < heading.level; l++) {
      if (!seenLevels.has(l)) {
        hasProperHierarchy = false;
        break;
      }
    }
    if (!hasProperHierarchy) break;
  }

  return { headings, h1Count, hasProperHierarchy, duplicateH1 };
}

// ---------------------------------------------------------------------------
// CTA detection
// ---------------------------------------------------------------------------

/**
 * Detect call-to-action elements in the document.
 */
function detectCTAs($: CheerioAPI): CTAInfo[] {
  const ctas: CTAInfo[] = [];
  const seen = new Set<string>();

  // Pre-compute: total direct children of body for above-fold 1/3 heuristic
  const $bodyChildren = $('body').children();
  const totalBodyChildren = $bodyChildren.length;
  const aboveFoldThreshold = Math.ceil(totalBodyChildren / 3);

  // Build a set of above-fold element indices (first 1/3 of body children)
  const aboveFoldIndices = new Set<number>();
  $bodyChildren.each((i, _el) => {
    if (i < aboveFoldThreshold) {
      aboveFoldIndices.add(i);
    }
  });

  /**
   * Check if an element is above the fold:
   * - Inside <header>, <nav>, [class*="hero"], [class*="banner"]
   * - Or among the first 1/3 of body's direct children
   */
  function isAboveFold(el: Element): boolean {
    const $el = $(el);

    // Check if inside above-fold containers
    if ($el.closest(ABOVE_FOLD_SELECTORS).length > 0) {
      return true;
    }

    // Check if the element's closest body-child ancestor is in the first 1/3
    let $current = $el;
    while ($current.length > 0 && $current.parent().length > 0) {
      const parent = $current.parent();
      if (parent.is('body')) {
        const idx = $current.index();
        return idx < aboveFoldThreshold;
      }
      $current = parent;
    }

    return false;
  }

  // Search buttons and links
  $('a, button, input[type="submit"], input[type="button"]').each((_, el) => {
    if (ctas.length >= MAX_CTAS) return;

    const $el = $(el);
    const tag = ($el.prop('tagName') as string | undefined)?.toLowerCase() ?? 'a';

    // Get the text content
    let text = '';
    if (tag === 'input') {
      text = ($el.attr('value') ?? '').trim();
    } else {
      text = $el.text().replace(/\s+/g, ' ').trim();
    }

    if (!text) return;

    // Check if this is a CTA by verb pattern or class pattern
    const classAttr = $el.attr('class') ?? '';
    const isCTA = CTA_VERB_PATTERN.test(text) || CTA_CLASS_PATTERN.test(classAttr);
    if (!isCTA) return;

    // Deduplicate by text + tag
    const key = `${tag}:${text.toLowerCase().slice(0, 60)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const href = tag === 'a' ? ($el.attr('href') ?? null) : null;

    ctas.push({
      text: text.slice(0, 60),
      tag,
      isAboveFold: isAboveFold(el),
      href,
    });
  });

  return ctas;
}

// ---------------------------------------------------------------------------
// Trust signal detection
// ---------------------------------------------------------------------------

/**
 * Detect trust signals in the document (testimonials, badges, logos, etc.).
 */
function detectTrustSignals($: CheerioAPI): TrustSignal[] {
  const signals: TrustSignal[] = [];

  function addSignal(type: TrustSignal['type'], evidence: string): void {
    if (signals.length >= MAX_TRUST_SIGNALS) return;
    signals.push({ type, evidence: evidence.slice(0, 100) });
  }

  // ── Testimonials ──────────────────────────────────────────────────────────
  $(
    '.testimonial, .review, .quote, [data-testimonial], ' +
    '.testimonials, .reviews, .customer-review',
  ).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 10) {
      addSignal('testimonial', `Element with class/attr: ${$(el).attr('class') ?? 'testimonial'}`);
    }
  });

  // blockquote with attribution (cite or footer inside)
  $('blockquote').each((_, el) => {
    const $el = $(el);
    const hasCite = $el.find('cite, footer, .author, .attribution').length > 0;
    if (hasCite) {
      addSignal('testimonial', `Blockquote with attribution: "${$el.text().replace(/\s+/g, ' ').trim().slice(0, 60)}"`);
    }
  });

  // ── Review widgets ────────────────────────────────────────────────────────
  const reviewWidgetSelectors = [
    '.trustpilot-widget', '[data-trustpilot]', '#trustpilot',
    '.yotpo', '[data-yotpo]',
    '.stamped-reviews', '[data-stamped]',
    '.judge-me', '.jdgm-widget',
  ];
  $(reviewWidgetSelectors.join(', ')).each((_, el) => {
    addSignal('review-widget', `Review widget: ${$(el).attr('class') ?? $(el).prop('tagName')}`);
  });

  // iframes from review platforms
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (/trustpilot|google.*reviews|yelp/i.test(src)) {
      addSignal('review-widget', `Review iframe: ${src.slice(0, 80)}`);
    }
  });

  // ── Security badges ───────────────────────────────────────────────────────
  const securityBadgePattern = /norton|mcafee|trustpilot|bbb|better\s*business|ssl|sectigo|digicert|truste|soc\b/i;

  $('img').each((_, el) => {
    const $el = $(el);
    const alt = $el.attr('alt') ?? '';
    const src = $el.attr('src') ?? '';
    if (securityBadgePattern.test(alt) || securityBadgePattern.test(src)) {
      addSignal('security-badge', `Security badge image: ${alt || src.slice(0, 80)}`);
    }
  });

  // ── Certifications ────────────────────────────────────────────────────────
  const certPattern = /\b(SOC\s*2|ISO\s*27001|HIPAA|GDPR|PCI\s*DSS|HITRUST|FedRAMP)\b/i;

  // Search in badges, images, and visible text
  $('img').each((_, el) => {
    const alt = $(el).attr('alt') ?? '';
    const src = $(el).attr('src') ?? '';
    if (certPattern.test(alt) || certPattern.test(src)) {
      addSignal('certification', `Certification badge: ${alt || src.slice(0, 80)}`);
    }
  });

  // Search in text content of badge-like containers
  $(
    '.badge, .certification, .compliance, .cert, ' +
    '[class*="badge"], [class*="cert"], [class*="compliance"]',
  ).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (certPattern.test(text)) {
      addSignal('certification', `Certification text: "${text.slice(0, 80)}"`);
    }
  });

  // Also search body text for certifications mentioned in paragraphs
  $('p, li, span, div').each((_, el) => {
    if (signals.filter(s => s.type === 'certification').length >= 5) return;
    const $el = $(el);
    // Only check leaf-ish elements to avoid duplicates from parent containers
    if ($el.children().length > 3) return;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text.length > 200) return; // skip large blocks
    if (certPattern.test(text)) {
      addSignal('certification', `Certification mentioned: "${text.slice(0, 80)}"`);
    }
  });

  // ── Customer logos ────────────────────────────────────────────────────────
  const logoContainerPattern = /\b(logos?|clients?|partners?|customers?|trusted|companies)\b/i;

  $(
    '.logos, .clients, .partners, .customers, .logo-strip, .logo-wall, ' +
    '.client-logos, .partner-logos, .customer-logos, ' +
    '[class*="logo-strip"], [class*="logo-wall"], [class*="client-logo"], [class*="partner-logo"]',
  ).each((_, el) => {
    const classAttr = $(el).attr('class') ?? '';
    addSignal('customer-logo', `Logo container: class="${classAttr.slice(0, 60)}"`);
  });

  // Text patterns: "trusted by", "as seen in", "used by"
  const trustedByPattern = /\b(trusted\s+by|as\s+seen\s+in|used\s+by|chosen\s+by|powering|loved\s+by)\b/i;
  $('h2, h3, h4, h5, h6, p, span, div').each((_, el) => {
    if (signals.filter(s => s.type === 'customer-logo').length >= 5) return;
    const $el = $(el);
    if ($el.children().length > 5) return;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text.length > 150) return;
    if (trustedByPattern.test(text)) {
      addSignal('customer-logo', `"${text.slice(0, 80)}"`);
    }
  });

  // Also match sections with the class pattern that contain images
  $('section, div').each((_, el) => {
    if (signals.filter(s => s.type === 'customer-logo').length >= 5) return;
    const $el = $(el);
    const classAttr = $el.attr('class') ?? '';
    const id = $el.attr('id') ?? '';
    if (logoContainerPattern.test(classAttr) || logoContainerPattern.test(id)) {
      const imgCount = $el.find('img').length;
      if (imgCount >= 3) {
        addSignal('customer-logo', `Logo section (${imgCount} images): class="${classAttr.slice(0, 50)}"`);
      }
    }
  });

  // ── Guarantee ─────────────────────────────────────────────────────────────
  const guaranteePattern = /\b(money\s*back|satisfaction\s+guaranteed|risk[- ]free|free\s+trial|30[- ]day\s+guarantee|no\s+risk|60[- ]day\s+guarantee|90[- ]day\s+guarantee)\b/i;

  $('p, li, span, div, h2, h3, h4, h5, h6, a, button').each((_, el) => {
    if (signals.filter(s => s.type === 'guarantee').length >= 3) return;
    const $el = $(el);
    if ($el.children().length > 5) return;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text.length > 200) return;
    if (guaranteePattern.test(text)) {
      addSignal('guarantee', `Guarantee: "${text.slice(0, 80)}"`);
    }
  });

  // ── Money-back ────────────────────────────────────────────────────────────
  const moneyBackPattern = /\b(money[- ]?back\s+guarantee|refund|100%\s+satisfaction)\b/i;

  $('p, li, span, div, h2, h3, h4, h5, h6, a, button').each((_, el) => {
    if (signals.filter(s => s.type === 'money-back').length >= 3) return;
    const $el = $(el);
    if ($el.children().length > 5) return;
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (text.length > 200) return;
    if (moneyBackPattern.test(text)) {
      addSignal('money-back', `Money-back: "${text.slice(0, 80)}"`);
    }
  });

  return signals;
}

// ---------------------------------------------------------------------------
// Content freshness
// ---------------------------------------------------------------------------

interface FreshnessInfo {
  publishedDate: string | null;
  modifiedDate: string | null;
  copyrightYear: number | null;
  lastModifiedHeader: string | null;
}

/**
 * Extract content freshness indicators from meta tags, JSON-LD, visible text,
 * and response headers.
 */
function extractFreshness($: CheerioAPI, headers?: Record<string, string>): FreshnessInfo {
  let publishedDate: string | null = null;
  let modifiedDate: string | null = null;
  let copyrightYear: number | null = null;
  const lastModifiedHeader: string | null = headers?.['last-modified'] ?? null;

  // ── Meta tags ─────────────────────────────────────────────────────────────
  const articlePublished = $('meta[property="article:published_time"]').attr('content')?.trim();
  if (articlePublished) publishedDate = articlePublished;

  const articleModified = $('meta[property="article:modified_time"]').attr('content')?.trim();
  if (articleModified) modifiedDate = articleModified;

  // Fallback: <meta name="date">
  if (!publishedDate) {
    const metaDate = $('meta[name="date"]').attr('content')?.trim();
    if (metaDate) publishedDate = metaDate;
  }

  // Fallback: <time datetime="...">
  if (!publishedDate) {
    const $time = $('time[datetime]').first();
    const datetime = $time.attr('datetime');
    if (datetime) publishedDate = datetime;
  }

  // ── JSON-LD ───────────────────────────────────────────────────────────────
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (!content) return;
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      extractJsonLdDates(parsed);
    } catch { /* invalid JSON-LD */ }
  });

  function extractJsonLdDates(data: unknown): void {
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data)) {
      for (const item of data) extractJsonLdDates(item);
      return;
    }

    const obj = data as Record<string, unknown>;

    // Handle @graph
    if (Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph']) extractJsonLdDates(item);
    }

    if (!publishedDate && typeof obj['datePublished'] === 'string') {
      publishedDate = obj['datePublished'];
    }
    if (!modifiedDate && typeof obj['dateModified'] === 'string') {
      modifiedDate = obj['dateModified'];
    }
  }

  // ── Copyright year ────────────────────────────────────────────────────────
  // Extract the LATEST year from copyright strings (e.g. "© 1996 — 2025" → 2025)
  const bodyText = $('body').text();
  const copyrightMatch = bodyText.match(/(?:\u00A9|&copy;|copyright)\s*(\d{4})(?:\s*[\u2013\u2014\-–—]\s*(\d{4}))?/i);
  if (copyrightMatch) {
    // Prefer the end year of a range, fall back to the single year
    const yearStr = copyrightMatch[2] ?? copyrightMatch[1];
    if (yearStr) {
      const year = parseInt(yearStr, 10);
      if (year >= 1990 && year <= 2100) {
        copyrightYear = year;
      }
    }
  }

  // Also try the raw © character
  if (copyrightYear === null) {
    const rawCopyright = bodyText.match(/\u00A9\s*(\d{4})(?:\s*[\u2013\u2014\-–—]\s*(\d{4}))?/);
    if (rawCopyright) {
      const yearStr = rawCopyright[2] ?? rawCopyright[1];
      if (yearStr) {
        const year = parseInt(yearStr, 10);
        if (year >= 1990 && year <= 2100) {
          copyrightYear = year;
        }
      }
    }
  }

  return { publishedDate, modifiedDate, copyrightYear, lastModifiedHeader };
}

// ---------------------------------------------------------------------------
// Paragraph analysis
// ---------------------------------------------------------------------------

interface ParagraphMetrics {
  paragraphCount: number;
  avgWordsPerParagraph: number;
}

/**
 * Analyze paragraph count and average words per paragraph.
 */
function analyzeParagraphs($: CheerioAPI): ParagraphMetrics {
  let totalWords = 0;
  let paragraphCount = 0;

  $('p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length === 0) return;

    paragraphCount++;
    const words = text.match(/[\w'-]+/g);
    totalWords += words ? words.length : 0;
  });

  return {
    paragraphCount,
    avgWordsPerParagraph: paragraphCount > 0
      ? Math.round((totalWords / paragraphCount) * 10) / 10
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Perform a comprehensive passive content analysis on raw HTML.
 *
 * @param html - Raw HTML string to analyze
 * @param headers - Optional HTTP response headers (used for Last-Modified)
 * @returns Full content analysis result
 */
export function analyzeContent(html: string, headers?: Record<string, string>): ContentAnalysis {
  const $ = cheerio.load(html);

  // ── Text metrics & readability ────────────────────────────────────────────
  const visibleText = extractVisibleText($);
  const textMetrics = computeTextMetrics(visibleText);

  // ── Headings ──────────────────────────────────────────────────────────────
  const headingAnalysis = analyzeHeadings($);

  // ── CTAs ───────────────────────────────────────────────────────────────────
  const ctas = detectCTAs($);
  const ctaAboveFold = ctas.filter(c => c.isAboveFold).length;

  // ── Trust signals ─────────────────────────────────────────────────────────
  const trustSignals = detectTrustSignals($);

  // ── Freshness ─────────────────────────────────────────────────────────────
  const freshness = extractFreshness($, headers);

  // ── Lists & tables ────────────────────────────────────────────────────────
  const listCount = $('ul, ol').length;
  const tableCount = $('table').length;

  // ── Paragraphs ────────────────────────────────────────────────────────────
  const paragraphMetrics = analyzeParagraphs($);

  return {
    // Text metrics
    wordCount: textMetrics.wordCount,
    sentenceCount: textMetrics.sentenceCount,
    avgWordsPerSentence: textMetrics.avgWordsPerSentence,
    readabilityScore: textMetrics.readabilityScore,
    readingGradeLevel: textMetrics.readingGradeLevel,

    // Headings
    headings: headingAnalysis.headings,
    h1Count: headingAnalysis.h1Count,
    hasProperHierarchy: headingAnalysis.hasProperHierarchy,
    duplicateH1: headingAnalysis.duplicateH1,

    // CTAs
    ctas,
    ctaAboveFold,

    // Trust signals
    trustSignals,

    // Freshness
    publishedDate: freshness.publishedDate,
    modifiedDate: freshness.modifiedDate,
    copyrightYear: freshness.copyrightYear,
    lastModifiedHeader: freshness.lastModifiedHeader,

    // Lists & tables
    listCount,
    tableCount,

    // Paragraphs
    paragraphCount: paragraphMetrics.paragraphCount,
    avgWordsPerParagraph: paragraphMetrics.avgWordsPerParagraph,
  };
}
