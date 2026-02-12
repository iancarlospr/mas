/**
 * M14 — Mobile & Responsive Design
 *
 * Evaluates mobile-friendliness: viewport meta, zoom accessibility, touch targets,
 * responsive breakpoints, mobile-specific UX elements, and layout at mobile viewport.
 *
 * Checkpoints (7):
 *   1. Viewport meta tag (including zoom restriction check)
 *   2. Responsive layout at 375px
 *   3. Touch target sizing (visible elements only)
 *   4. Text readability on mobile
 *   5. Mobile navigation (hamburger/drawer)
 *   6. Mobile content optimization
 *   7. AMP / alternate mobile version
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type {
  ModuleResult,
  ModuleId,
  Signal,
  Checkpoint,
  CheckpointHealth,
} from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';
import { getInPageCSSAnalyzer } from '../../utils/css-analyzer.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return {
      moduleId: 'M14' as ModuleId,
      status: 'error',
      data: {},
      signals: [],
      score: null,
      checkpoints: [],
      duration: 0,
      error: 'Browser page not available for M14',
    };
  }

  // ─── Step 1: Audit at desktop viewport ──────────────────────────────────
  const desktopAudit = await page.evaluate(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    const viewportContent = viewport?.getAttribute('content') || null;

    // Check for zoom-blocking (accessibility violation)
    let zoomBlocked = false;
    if (viewportContent) {
      const lower = viewportContent.toLowerCase().replace(/\s/g, '');
      if (lower.includes('user-scalable=no') || lower.includes('user-scalable=0')) {
        zoomBlocked = true;
      }
      const maxScaleMatch = lower.match(/maximum-scale=([0-9.]+)/);
      if (maxScaleMatch && parseFloat(maxScaleMatch[1]!) <= 1) {
        zoomBlocked = true;
      }
    }

    // AMP detection
    const ampLink = document.querySelector('link[rel="amphtml"]');
    const hasAmp = !!ampLink;
    const ampUrl = ampLink ? (ampLink as HTMLLinkElement).href : null;

    // Mobile alternate detection
    const mobileAlternate = document.querySelector('link[rel="alternate"][media*="handheld"], link[rel="alternate"][media*="mobile"]');
    const hasMobileAlternate = !!mobileAlternate;

    return { viewportContent, zoomBlocked, hasAmp, ampUrl, hasMobileAlternate };
  });

  // ─── Step 2: Resize to mobile and audit ─────────────────────────────────
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 }); // iPhone SE dimensions
  await page.waitForTimeout(1000); // Allow re-layout

  const mobileAudit = await page.evaluate(() => {
    const docEl = document.documentElement;

    // Horizontal overflow
    const hasHorizontalScroll = docEl.scrollWidth > docEl.clientWidth;

    // Touch targets — only count elements that are VISIBLE and in viewport
    const interactive = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [onclick]',
    );
    let smallTargets = 0;
    let totalTargets = 0;

    interactive.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();

      // Skip elements that aren't visible
      if (rect.width <= 0 || rect.height <= 0) return;

      // Skip off-screen elements
      if (rect.bottom < 0 || rect.top > window.innerHeight * 3) return;
      if (rect.right < 0 || rect.left > window.innerWidth) return;

      // Skip hidden elements
      const style = window.getComputedStyle(htmlEl);
      if (style.visibility === 'hidden' || style.opacity === '0') return;
      if (style.pointerEvents === 'none') return;

      totalTargets++;
      if (rect.width < 44 || rect.height < 44) smallTargets++;
    });

    // Text readability
    const textElements = document.querySelectorAll('p, li, span, td, th');
    let smallTextCount = 0;
    let checkedText = 0;

    textElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      // Skip invisible/off-screen
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight * 3) return;

      const text = el.textContent || '';
      if (text.trim().length < 10) return;

      checkedText++;
      const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
      if (fontSize > 0 && fontSize < 14) smallTextCount++;
    });

    // Mobile navigation
    const hasHamburger = !!(
      document.querySelector(
        '[class*="hamburger"], [class*="menu-toggle"], [class*="mobile-menu"], [aria-label*="menu" i], [aria-label*="navigation" i]',
      ) ||
      document.querySelector('button[class*="mobile"], nav button, header button')
    );
    const hasDrawer = !!document.querySelector(
      '[class*="drawer"], [class*="sidebar"], [class*="mobile-nav"], [class*="offcanvas"], [class*="slide-menu"]',
    );

    // Media queries in accessible stylesheets + inline <style> (CSS-in-JS)
    let hasMediaQueries = false;
    let mediaQueryCount = 0;
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i]!.cssRules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j]! instanceof CSSMediaRule) {
              hasMediaQueries = true;
              mediaQueryCount++;
            }
          }
        } catch {
          /* cross-origin stylesheets — expected for CDN-served CSS */
        }
      }
    } catch {
      /* */
    }

    // Fallback: check inline <style> elements (always same-origin, works with CSS-in-JS)
    if (!hasMediaQueries) {
      try {
        const styleEls = document.querySelectorAll('style');
        styleEls.forEach(styleEl => {
          try {
            if (styleEl.sheet) {
              const rules = styleEl.sheet.cssRules;
              for (let j = 0; j < rules.length; j++) {
                if (rules[j] instanceof CSSMediaRule) {
                  hasMediaQueries = true;
                  mediaQueryCount++;
                }
              }
            }
          } catch { /* */ }
        });
      } catch { /* */ }
    }

    // Mobile content: check for elements hidden on mobile
    let hiddenOnMobile = 0;
    document.querySelectorAll('[class*="desktop-only"], [class*="d-none-mobile"], [class*="hidden-mobile"], [class*="hide-mobile"]').forEach(() => {
      hiddenOnMobile++;
    });

    // Also count display:none elements that have substantial content
    // (This catches responsive hiding via CSS classes)
    document.querySelectorAll('section, div[class], aside').forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none') {
        const text = el.textContent || '';
        if (text.trim().length > 100) hiddenOnMobile++;
      }
    });

    return {
      hasHorizontalScroll,
      smallTargets,
      totalTargets,
      smallTextCount,
      checkedText,
      hasHamburger,
      hasDrawer,
      hasMediaQueries,
      mediaQueryCount,
      hiddenOnMobile,
    };
  });

  data.desktopAudit = desktopAudit;
  data.mobileAudit = mobileAudit;

  // Restore original viewport
  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }

  // ─── Step 2b: CSS deep analysis (breakpoints, custom properties, fonts) ──
  let cssAnalysis: { breakpoints: number[]; customPropertyCount: number; fontFaces: Array<{ family: string; display: string }> } | null = null;
  try {
    cssAnalysis = await Promise.race([
      page.evaluate(getInPageCSSAnalyzer()),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch {
    // CSS analysis failed — non-critical, continue
  }

  if (cssAnalysis) {
    data.breakpoints = cssAnalysis.breakpoints;
    data.customPropertyCount = cssAnalysis.customPropertyCount;
    data.fontFaces = cssAnalysis.fontFaces;
  }

  // ─── Step 2c: DOM Forensics integration ──────────────────────────────────
  const domForensics = ctx.domForensics;
  if (domForensics) {
    data.domComplexity = {
      totalNodes: domForensics.totalNodes,
      maxDepth: domForensics.maxDepth,
      hasShadowDOM: domForensics.hasShadowDOM,
      customElementCount: domForensics.customElements.length,
      dynamicContentAreas: domForensics.dynamicContentAreas,
    };
  }

  // ─── Step 3: Build checkpoints ──────────────────────────────────────────

  // CP1: Viewport meta tag (includes zoom accessibility check)
  {
    const vc = desktopAudit.viewportContent;
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (vc && vc.includes('width=device-width') && vc.includes('initial-scale=1') && !desktopAudit.zoomBlocked) {
      health = 'excellent';
      evidence = `Viewport meta: ${vc}`;
    } else if (vc && vc.includes('width=device-width') && desktopAudit.zoomBlocked) {
      health = 'warning';
      evidence = `Viewport meta present but zoom is restricted (${vc})`;
      recommendation = 'Remove user-scalable=no and maximum-scale=1 to allow pinch-to-zoom (WCAG 1.4.4 accessibility requirement).';
    } else if (vc && vc.includes('width=device-width')) {
      health = 'good';
      evidence = `Viewport meta present: ${vc}`;
    } else if (vc) {
      health = 'warning';
      evidence = `Viewport meta incomplete: ${vc}`;
      recommendation = 'Set viewport to width=device-width, initial-scale=1 for proper mobile rendering.';
    } else {
      health = 'critical';
      evidence = 'No viewport meta tag — page will not render correctly on mobile';
      recommendation = 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm14-viewport', name: 'Viewport Meta Tag', weight: 1.0, health, evidence, recommendation }),
    );
  }

  // CP2: Responsive layout (combines h-scroll + media queries — single checkpoint)
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (!mobileAudit.hasHorizontalScroll && mobileAudit.hasMediaQueries) {
      health = 'excellent';
      const bpInfo = cssAnalysis?.breakpoints.length
        ? ` at breakpoints: ${cssAnalysis.breakpoints.slice(0, 6).join(', ')}px`
        : '';
      evidence = `Page adapts to 375px viewport, ${mobileAudit.mediaQueryCount} CSS media queries${bpInfo}, no horizontal overflow`;
    } else if (!mobileAudit.hasHorizontalScroll && mobileAudit.hasHamburger) {
      // No h-scroll + mobile nav detected = responsive even if media queries aren't accessible (cross-origin CSS / CSS-in-JS)
      health = 'excellent';
      evidence = 'Page adapts to 375px viewport with mobile navigation, no horizontal overflow';
    } else if (!mobileAudit.hasHorizontalScroll) {
      health = 'good';
      evidence = 'No horizontal scroll at mobile width (media queries not detected in accessible stylesheets)';
    } else {
      health = 'critical';
      evidence = 'Horizontal scroll detected at 375px — page is not fully responsive';
      recommendation = 'Fix elements causing horizontal overflow at mobile width. Check for fixed-width containers or large images.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm14-responsive', name: 'Responsive Layout (375px)', weight: 0.8, health, evidence, recommendation }),
    );
  }

  // CP3: Touch target sizing (now only visible elements)
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (mobileAudit.totalTargets === 0) {
      health = 'good';
      evidence = 'No interactive elements detected at mobile viewport';
    } else {
      const goodPct = Math.round(
        ((mobileAudit.totalTargets - mobileAudit.smallTargets) / mobileAudit.totalTargets) * 100,
      );

      if (goodPct >= 90) {
        health = 'excellent';
        evidence = `${goodPct}% of ${mobileAudit.totalTargets} visible touch targets meet 44px minimum`;
      } else if (goodPct >= 70) {
        health = 'good';
        evidence = `${mobileAudit.smallTargets}/${mobileAudit.totalTargets} visible targets below 44px minimum (${goodPct}% pass)`;
      } else {
        health = 'warning';
        evidence = `${mobileAudit.smallTargets}/${mobileAudit.totalTargets} visible touch targets below 44px minimum`;
        recommendation = 'Increase touch target sizes to at least 44x44px for comfortable mobile interaction (WCAG 2.5.5).';
      }
    }

    checkpoints.push(
      createCheckpoint({ id: 'm14-touch', name: 'Touch Target Sizing', weight: 0.6, health, evidence, recommendation }),
    );
  }

  // CP4: Text readability
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (mobileAudit.checkedText === 0) {
      health = 'good';
      evidence = 'No substantial text elements to check';
    } else {
      const goodPct = Math.round(
        ((mobileAudit.checkedText - mobileAudit.smallTextCount) / mobileAudit.checkedText) * 100,
      );

      if (goodPct >= 95) {
        health = 'excellent';
        evidence = `Text is readable at mobile size — ${goodPct}% of ${mobileAudit.checkedText} elements >= 14px`;
      } else if (goodPct >= 80) {
        health = 'good';
        evidence = `Most text readable, ${mobileAudit.smallTextCount}/${mobileAudit.checkedText} elements below 14px`;
      } else {
        health = 'warning';
        evidence = `${mobileAudit.smallTextCount}/${mobileAudit.checkedText} text elements too small for mobile (< 14px)`;
        recommendation = 'Increase base font size to at least 14px on mobile for comfortable reading.';
      }
    }

    checkpoints.push(
      createCheckpoint({ id: 'm14-text', name: 'Mobile Text Readability', weight: 0.5, health, evidence, recommendation }),
    );
  }

  // CP5: Mobile navigation
  {
    let health: CheckpointHealth;
    let evidence: string;
    let recommendation: string | undefined;

    if (mobileAudit.hasHamburger && mobileAudit.hasDrawer) {
      health = 'excellent';
      evidence = 'Mobile navigation detected (hamburger menu + drawer)';
    } else if (mobileAudit.hasHamburger || mobileAudit.hasDrawer) {
      health = 'excellent';
      evidence = `Mobile navigation detected (${mobileAudit.hasHamburger ? 'hamburger menu' : 'drawer navigation'})`;
    } else {
      health = 'warning';
      evidence = 'No mobile-specific navigation pattern detected';
      recommendation = 'Add a hamburger menu or drawer navigation for mobile users to easily navigate the site.';
    }

    checkpoints.push(
      createCheckpoint({ id: 'm14-nav', name: 'Mobile Navigation', weight: 0.5, health, evidence, recommendation }),
    );
  }

  // CP6: Mobile content optimization
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (mobileAudit.hiddenOnMobile === 0) {
      health = 'excellent';
      evidence = 'No significant content hidden on mobile — full content parity';
    } else if (mobileAudit.hiddenOnMobile <= 3) {
      health = 'good';
      evidence = `${mobileAudit.hiddenOnMobile} content section(s) hidden on mobile (may be intentional)`;
    } else {
      health = 'warning';
      evidence = `${mobileAudit.hiddenOnMobile} content sections hidden on mobile — users may miss important information`;
    }

    checkpoints.push(
      createCheckpoint({ id: 'm14-content', name: 'Mobile Content Optimization', weight: 0.3, health, evidence }),
    );
  }

  // CP7: AMP / alternate mobile version
  {
    if (desktopAudit.hasAmp) {
      checkpoints.push(
        createCheckpoint({
          id: 'm14-amp',
          name: 'AMP / Mobile Alternate',
          weight: 0.2,
          health: 'excellent',
          evidence: `AMP version available: ${desktopAudit.ampUrl}`,
        }),
      );
    } else if (desktopAudit.hasMobileAlternate) {
      checkpoints.push(
        createCheckpoint({
          id: 'm14-amp',
          name: 'AMP / Mobile Alternate',
          weight: 0.2,
          health: 'good',
          evidence: 'Alternate mobile version linked',
        }),
      );
    } else {
      checkpoints.push(
        infoCheckpoint({
          id: 'm14-amp',
          name: 'AMP / Mobile Alternate',
          weight: 0.2,
          evidence: 'No AMP or alternate mobile version (responsive design is the primary approach)',
        }),
      );
    }
  }

  // ─── Step 3b: Responsive Images (from ImageAuditor) ────────────────────
  if (ctx.imageAudit) {
    data.responsiveImages = {
      srcsetCount: ctx.imageAudit.srcsetCount,
      pictureElementCount: ctx.imageAudit.pictureElementCount,
      hasResponsiveImages: ctx.imageAudit.hasResponsiveImages,
      modernFormatPct: ctx.imageAudit.totalImages > 0 ? Math.round((ctx.imageAudit.modernFormatCount / ctx.imageAudit.totalImages) * 100) : 0,
      oversizedCount: ctx.imageAudit.oversizedCount,
    };
    data.fontLoading = {
      totalFonts: ctx.imageAudit.fonts.length,
      fontDisplayValues: ctx.imageAudit.fontDisplayValues,
      preloadedFonts: ctx.imageAudit.preloadedFonts,
      googleFonts: ctx.imageAudit.fonts.filter(f => f.source === 'google').length,
      selfHostedFonts: ctx.imageAudit.fonts.filter(f => f.source === 'self-hosted').length,
    };
  }

  // CP8: Responsive Images
  {
    if (ctx.imageAudit) {
      const { srcsetCount, pictureElementCount, totalImages, oversizedCount } = ctx.imageAudit;

      if (totalImages === 0) {
        checkpoints.push(infoCheckpoint({ id: 'm14-responsive-images', name: 'Responsive Images', weight: 0.4, evidence: 'No images detected on this page' }));
      } else {
        let health: CheckpointHealth;
        let evidence: string;
        let recommendation: string | undefined;

        if (srcsetCount > 0 && pictureElementCount > 0) {
          health = 'excellent';
          evidence = `${srcsetCount} images with srcset, ${pictureElementCount} <picture> elements — responsive image strategy in place`;
        } else if (srcsetCount > 0) {
          health = 'good';
          evidence = `${srcsetCount} images with srcset attribute (no <picture> elements)`;
        } else if (srcsetCount === 0 && totalImages > 5) {
          health = 'warning';
          evidence = `${totalImages} images but none use srcset — serving same size to all viewports`;
          recommendation = 'Add srcset attributes to img elements to serve appropriately sized images on mobile.';
        } else {
          health = 'good';
          evidence = `${totalImages} images without srcset (few images, low impact)`;
        }

        if (oversizedCount > 3 && health !== 'warning') {
          health = 'warning';
          evidence += `, ${oversizedCount} oversized images detected`;
          recommendation = 'Resize images to match their display dimensions to reduce bandwidth on mobile.';
        }

        checkpoints.push(createCheckpoint({ id: 'm14-responsive-images', name: 'Responsive Images', weight: 0.4, health, evidence, recommendation }));
      }
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm14-responsive-images', name: 'Responsive Images', weight: 0.4, evidence: 'Image audit data not available' }));
    }
  }

  // CP9: Font Loading
  {
    if (ctx.imageAudit && ctx.imageAudit.fonts.length > 0) {
      const fontDisplayValues = ctx.imageAudit.fontDisplayValues;
      const swapCount = fontDisplayValues['swap'] ?? 0;
      const totalFontFaces = Object.values(fontDisplayValues).reduce((a, b) => a + b, 0);

      let health: CheckpointHealth;
      let evidence: string;
      let recommendation: string | undefined;

      if (totalFontFaces > 0 && swapCount === totalFontFaces) {
        health = 'excellent';
        evidence = `All ${totalFontFaces} @font-face declarations use font-display: swap`;
      } else if (swapCount > 0) {
        health = 'good';
        evidence = `${swapCount}/${totalFontFaces} @font-face declarations use font-display: swap`;
      } else {
        health = 'warning';
        evidence = `${totalFontFaces} @font-face declarations but none use font-display: swap — text may be invisible during font load`;
        recommendation = 'Add font-display: swap to @font-face rules to prevent invisible text during font loading (FOIT).';
      }

      checkpoints.push(createCheckpoint({ id: 'm14-font-loading', name: 'Font Loading', weight: 0.3, health, evidence, recommendation }));
    } else if (ctx.imageAudit && ctx.imageAudit.fonts.length === 0) {
      checkpoints.push(infoCheckpoint({ id: 'm14-font-loading', name: 'Font Loading', weight: 0.3, evidence: 'No web fonts detected — using system fonts' }));
    } else {
      checkpoints.push(infoCheckpoint({ id: 'm14-font-loading', name: 'Font Loading', weight: 0.3, evidence: 'Image audit data not available' }));
    }
  }

  // ─── Step 3c: Modern CSS Features Detection ───────────────────────────
  try {
    const modernCSS = await page.evaluate(() => {
      let hasDarkMode = false;
      let hasReducedMotion = false;
      let hasHighContrast = false;

      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              const text = rule.cssText;
              if (text.includes('prefers-color-scheme')) hasDarkMode = true;
              if (text.includes('prefers-reduced-motion')) hasReducedMotion = true;
              if (text.includes('prefers-contrast')) hasHighContrast = true;
            }
          } catch { /* CORS stylesheet */ }
        }
      } catch { /* no stylesheets */ }

      return { hasDarkMode, hasReducedMotion, hasHighContrast };
    });
    data.modernCSSFeatures = modernCSS;

    // CP10: Modern CSS Features
    {
      let health: CheckpointHealth;
      let evidence: string;

      if (modernCSS.hasDarkMode && modernCSS.hasReducedMotion) {
        health = 'excellent';
        evidence = `Dark mode (prefers-color-scheme) and reduced-motion (prefers-reduced-motion) CSS detected${modernCSS.hasHighContrast ? ', plus high-contrast support' : ''}`;
      } else if (modernCSS.hasDarkMode || modernCSS.hasReducedMotion) {
        health = 'good';
        evidence = `${modernCSS.hasDarkMode ? 'Dark mode (prefers-color-scheme)' : 'Reduced-motion (prefers-reduced-motion)'} CSS detected`;
      } else {
        health = 'info';
        evidence = 'No dark mode or reduced-motion CSS detected';
      }

      if (health === 'info') {
        checkpoints.push(infoCheckpoint({ id: 'm14-modern-css', name: 'Modern CSS Features', weight: 0.2, evidence }));
      } else {
        checkpoints.push(createCheckpoint({ id: 'm14-modern-css', name: 'Modern CSS Features', weight: 0.2, health, evidence }));
      }
    }
  } catch { /* non-critical */ }

  // ─── Step 4: Build signals ──────────────────────────────────────────────
  signals.push(
    createSignal({
      type: 'mobile',
      name: 'Mobile Responsiveness',
      confidence: 0.9,
      evidence: `Viewport: ${desktopAudit.viewportContent ? 'yes' : 'no'}, H-scroll: ${mobileAudit.hasHorizontalScroll ? 'yes' : 'no'}, Mobile nav: ${mobileAudit.hasHamburger || mobileAudit.hasDrawer ? 'yes' : 'no'}`,
      category: 'mobile',
    }),
  );

  // Component architecture signal from DOM forensics
  if (domForensics && domForensics.customElements.length > 0 && domForensics.hasShadowDOM) {
    signals.push(
      createSignal({
        type: 'architecture',
        name: 'Web Components',
        confidence: 0.85,
        evidence: `${domForensics.customElements.length} custom elements with Shadow DOM detected — modern component architecture`,
        category: 'technology',
      }),
    );
  } else if (domForensics && domForensics.customElements.length > 0) {
    signals.push(
      createSignal({
        type: 'architecture',
        name: 'Custom Elements',
        confidence: 0.75,
        evidence: `${domForensics.customElements.length} custom elements detected (${domForensics.customElements.slice(0, 5).join(', ')})`,
        category: 'technology',
      }),
    );
  }

  return {
    moduleId: 'M14' as ModuleId,
    status: 'success',
    data,
    signals,
    score: null,
    checkpoints,
    duration: 0,
  };
};

export { execute };
registerModuleExecutor('M14' as ModuleId, execute);
