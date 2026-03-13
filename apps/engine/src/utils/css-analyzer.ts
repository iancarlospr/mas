/**
 * CSS Analyzer — shared utility for CSS-based technology detection and analysis.
 *
 * Two entry points:
 *   1. `analyzeCSSFromHTML(html)` — Passive: scan raw HTML for CSS class fingerprints (M02)
 *   2. `analyzeCSSInPage()` — Browser: extract breakpoints, custom properties, font faces (M14)
 */

// ---------------------------------------------------------------------------
// CSS class fingerprints for passive HTML scanning (M02)
// ---------------------------------------------------------------------------

interface CSSClassMatch {
  className: string;
  tech: string;
  category: 'cms' | 'framework' | 'marketing' | 'ecommerce' | 'builder';
}

/** Pattern → technology mapping. Each regex tests class attributes in HTML. */
const CSS_CLASS_FINGERPRINTS: { pattern: RegExp; tech: string; category: CSSClassMatch['category'] }[] = [
  // CMS
  { pattern: /class="[^"]*\bwp-block-[a-z]/i, tech: 'WordPress', category: 'cms' },
  { pattern: /class="[^"]*\bwp-element-[a-z]/i, tech: 'WordPress', category: 'cms' },
  { pattern: /class="[^"]*\bwp-image-\d/i, tech: 'WordPress', category: 'cms' },
  { pattern: /class="[^"]*\bentry-content\b/i, tech: 'WordPress', category: 'cms' },
  { pattern: /class="[^"]*\bdrupal-/i, tech: 'Drupal', category: 'cms' },
  { pattern: /class="[^"]*\bnode--type-/i, tech: 'Drupal', category: 'cms' },
  { pattern: /class="[^"]*\bfield--name-/i, tech: 'Drupal', category: 'cms' },
  { pattern: /class="[^"]*\bjoomla-/i, tech: 'Joomla', category: 'cms' },

  // Ecommerce
  { pattern: /class="[^"]*\bshopify-section\b/i, tech: 'Shopify', category: 'ecommerce' },
  { pattern: /class="[^"]*\bshopify-/i, tech: 'Shopify', category: 'ecommerce' },
  { pattern: /class="[^"]*\bwoocommerce\b/i, tech: 'WooCommerce', category: 'ecommerce' },
  { pattern: /class="[^"]*\bwc-block-/i, tech: 'WooCommerce', category: 'ecommerce' },
  { pattern: /class="[^"]*\bbigcommerce-/i, tech: 'BigCommerce', category: 'ecommerce' },
  { pattern: /class="[^"]*\bmagento-/i, tech: 'Magento', category: 'ecommerce' },

  // Page builders
  { pattern: /class="[^"]*\belementor-/i, tech: 'Elementor', category: 'builder' },
  { pattern: /class="[^"]*\be-con\b/i, tech: 'Elementor', category: 'builder' },
  { pattern: /class="[^"]*\bdivi_/i, tech: 'Divi', category: 'builder' },
  { pattern: /class="[^"]*\bet_pb_/i, tech: 'Divi', category: 'builder' },

  // Website builders / frameworks
  { pattern: /class="[^"]*\bsquarespace-/i, tech: 'Squarespace', category: 'builder' },
  { pattern: /class="[^"]*\bsqs-/i, tech: 'Squarespace', category: 'builder' },
  { pattern: /class="[^"]*\bwebflow-/i, tech: 'Webflow', category: 'builder' },
  { pattern: /class="[^"]*\bw-/i, tech: 'Webflow', category: 'builder' }, // w-nav, w-container, etc. - common but check with care
  { pattern: /class="[^"]*\bframer-/i, tech: 'Framer', category: 'builder' },
  { pattern: /class="[^"]*\bwix-/i, tech: 'Wix', category: 'builder' },
  { pattern: /class="[^"]*\bunbounce-/i, tech: 'Unbounce', category: 'builder' },

  // Marketing tools (DOM class presence)
  { pattern: /class="[^"]*\bhs-form/i, tech: 'HubSpot', category: 'marketing' },
  { pattern: /class="[^"]*\bhs-cta-/i, tech: 'HubSpot', category: 'marketing' },
  { pattern: /id="intercom-container"/i, tech: 'Intercom', category: 'marketing' },
  { pattern: /class="[^"]*\bintercom-/i, tech: 'Intercom', category: 'marketing' },
  { pattern: /class="[^"]*\bdrift-/i, tech: 'Drift', category: 'marketing' },
  { pattern: /id="drift-widget"/i, tech: 'Drift', category: 'marketing' },
  { pattern: /class="[^"]*\bcrisp-/i, tech: 'Crisp', category: 'marketing' },
  { pattern: /class="[^"]*\bzendesk-/i, tech: 'Zendesk', category: 'marketing' },
];

// Webflow "w-" prefix is too generic. Only match if accompanied by specific Webflow classes.
const WEBFLOW_CONFIRM_PATTERN = /class="[^"]*\bw-(nav|container|section|layout|embed|richtext|dropdown|slider)\b/i;

export interface CSSFromHTMLResult {
  platformClasses: CSSClassMatch[];
}

/**
 * Scan raw HTML for CSS class fingerprints indicating CMS/platform/tool usage.
 * Runs in the passive phase — no browser needed.
 */
export function analyzeCSSFromHTML(html: string): CSSFromHTMLResult {
  const seen = new Set<string>();
  const platformClasses: CSSClassMatch[] = [];

  for (const fp of CSS_CLASS_FINGERPRINTS) {
    if (fp.tech === 'Webflow' && fp.pattern.source.includes('\\bw-')) {
      // Only match generic "w-" if accompanied by specific Webflow patterns
      if (!WEBFLOW_CONFIRM_PATTERN.test(html)) continue;
    }
    if (fp.pattern.test(html)) {
      const key = fp.tech;
      if (!seen.has(key)) {
        seen.add(key);
        const match = html.match(fp.pattern);
        platformClasses.push({
          className: match ? match[0].slice(0, 80) : fp.tech,
          tech: fp.tech,
          category: fp.category,
        });
      }
    }
  }

  return { platformClasses };
}

// ---------------------------------------------------------------------------
// In-page CSS analysis (M14) — returns serializable result from page.evaluate()
// ---------------------------------------------------------------------------

export interface CSSInPageResult {
  breakpoints: number[];
  customPropertyCount: number;
  fontFaces: Array<{ family: string; display: string }>;
}

/**
 * Returns a function body string for use inside `page.evaluate()`.
 * Extracts media query breakpoints, CSS custom property count, and @font-face declarations.
 */
export function getInPageCSSAnalyzer(): () => CSSInPageResult {
  return () => {
    const breakpointSet = new Set<number>();
    let customPropertyCount = 0;
    const fontFaceMap = new Map<string, string>();

    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        let rules: CSSRuleList;
        try {
          rules = document.styleSheets[i]!.cssRules;
        } catch {
          continue; // cross-origin stylesheet
        }

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j]!;

          // Media queries → extract breakpoint values
          if (rule instanceof CSSMediaRule) {
            const text = rule.conditionText || (rule as CSSMediaRule).media.mediaText;
            const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*px/g);
            for (const m of matches) {
              const bp = Math.round(parseFloat(m[1]!));
              if (bp >= 200 && bp <= 3000) breakpointSet.add(bp);
            }
          }

          // Custom properties from :root or * selectors
          if (rule instanceof CSSStyleRule) {
            const sel = rule.selectorText;
            if (sel === ':root' || sel === '*' || sel === 'html' || sel === ':host') {
              for (let k = 0; k < rule.style.length; k++) {
                if (rule.style[k]!.startsWith('--')) customPropertyCount++;
              }
            }
          }

          // @font-face declarations
          if (rule instanceof CSSFontFaceRule) {
            const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
            const display = rule.style.getPropertyValue('font-display') || 'auto';
            if (family && !fontFaceMap.has(family)) {
              fontFaceMap.set(family, display);
            }
          }
        }
      }
    } catch {
      // Fallback: also scan <style> tags (CSS-in-JS)
    }

    // Also scan inline <style> elements
    try {
      const styleEls = document.querySelectorAll('style');
      styleEls.forEach(styleEl => {
        try {
          if (styleEl.sheet) {
            const rules = styleEl.sheet.cssRules;
            for (let j = 0; j < rules.length; j++) {
              const rule = rules[j]!;
              if (rule instanceof CSSMediaRule) {
                const text = rule.conditionText || (rule as CSSMediaRule).media.mediaText;
                const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*px/g);
                for (const m of matches) {
                  const bp = Math.round(parseFloat(m[1]!));
                  if (bp >= 200 && bp <= 3000) breakpointSet.add(bp);
                }
              }
              if (rule instanceof CSSStyleRule) {
                const sel = rule.selectorText;
                if (sel === ':root' || sel === '*' || sel === 'html' || sel === ':host') {
                  for (let k = 0; k < rule.style.length; k++) {
                    if (rule.style[k]!.startsWith('--')) customPropertyCount++;
                  }
                }
              }
              if (rule instanceof CSSFontFaceRule) {
                const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
                const display = rule.style.getPropertyValue('font-display') || 'auto';
                if (family && !fontFaceMap.has(family)) {
                  fontFaceMap.set(family, display);
                }
              }
            }
          }
        } catch { /* cross-origin */ }
      });
    } catch { /* */ }

    const breakpoints = Array.from(breakpointSet).sort((a, b) => a - b);
    const fontFaces = Array.from(fontFaceMap.entries())
      .slice(0, 30)
      .map(([family, display]) => ({ family, display }));

    return { breakpoints, customPropertyCount, fontFaces };
  };
}
