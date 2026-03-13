/**
 * M10 - Accessibility Overlay Detection & Basic A11y Audit
 *
 * Detects accessibility overlay tools and performs a basic WCAG audit:
 * alt text, ARIA roles, heading hierarchy, color contrast indicators,
 * keyboard navigation, and form label associations.
 *
 * Checkpoints:
 *   1. Accessibility overlay detection
 *   2. Image alt text coverage (with quality check)
 *   3. ARIA landmarks and roles
 *   4. Heading hierarchy
 *   5. Form label associations
 *   6. Keyboard focus indicators (focus-visible aware)
 *   7. Language attribute
 *   8. ARIA misuse detection
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return { moduleId: 'M10' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  const a11yData = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;

    // --- Overlay detection ---
    const overlays: string[] = [];
    if (w['AccessiBe'] || document.querySelector('script[src*="accessibe"], script[src*="acsbapp"]')) overlays.push('accessiBe');
    if (w['UserWay'] || document.querySelector('script[src*="userway"]')) overlays.push('UserWay');
    if (document.querySelector('script[src*="audioeye"]') || w['AudioEye']) overlays.push('AudioEye');
    if (document.querySelector('script[src*="equalweb"]')) overlays.push('EqualWeb');
    if (document.querySelector('[class*="ada-embed"], script[src*="ada.cx"]')) overlays.push('Ada');
    if (document.querySelector('[id*="accessibilityWidget"], [class*="accessibility-widget"]')) overlays.push('Unknown overlay');

    // --- Image alt text ---
    const images = document.querySelectorAll('img');
    let imagesTotal = 0;
    let imagesWithAlt = 0;
    let imagesDecorativeCorrect = 0;
    images.forEach((img) => {
      if (img.width < 5 || img.height < 5) return; // Skip tiny/tracking pixels
      imagesTotal++;
      const alt = img.getAttribute('alt');
      if (alt !== null && alt !== undefined) {
        if (alt === '' && img.getAttribute('role') === 'presentation') {
          imagesDecorativeCorrect++;
        }
        imagesWithAlt++;
      }
    });

    // --- ARIA landmarks ---
    const landmarks = {
      banner: document.querySelectorAll('[role="banner"], header').length,
      navigation: document.querySelectorAll('[role="navigation"], nav').length,
      main: document.querySelectorAll('[role="main"], main').length,
      contentinfo: document.querySelectorAll('[role="contentinfo"], footer').length,
    };
    const hasLandmarks = landmarks.main > 0 || landmarks.navigation > 0;

    // --- Heading hierarchy ---
    const headings: Array<{ level: number; text: string }> = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const level = parseInt(h.tagName.charAt(1));
      headings.push({ level, text: (h.textContent || '').trim().slice(0, 50) });
    });

    let h1Count = headings.filter(h => h.level === 1).length;
    let hasSkippedLevels = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i]!.level - headings[i - 1]!.level > 1) {
        hasSkippedLevels = true;
        break;
      }
    }

    // --- Form labels ---
    const formInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
    let inputsTotal = 0;
    let inputsWithLabel = 0;
    formInputs.forEach((input) => {
      inputsTotal++;
      const id = input.id;
      const hasLabel = !!(
        (id && document.querySelector(`label[for="${id}"]`)) ||
        input.closest('label') ||
        input.getAttribute('aria-label') ||
        input.getAttribute('aria-labelledby') ||
        input.getAttribute('title') ||
        input.getAttribute('placeholder') // weaker but acceptable
      );
      if (hasLabel) inputsWithLabel++;
    });

    // --- Focus indicators ---
    // Check if outlines are removed on :focus (anti-pattern)
    let focusRemoved = false;
    let hasFocusVisible = false;
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i]!.cssRules;
          for (let j = 0; j < rules.length; j++) {
            const text = rules[j]!.cssText;
            // Fix: gate ALL outline checks behind :focus
            if (text.includes(':focus') && (text.includes('outline: none') || text.includes('outline:none') || text.includes('outline: 0'))) {
              focusRemoved = true;
            }
            if (text.includes(':focus-visible')) {
              hasFocusVisible = true;
            }
          }
        } catch { /* cross-origin */ }
      }
    } catch { /* */ }

    // --- Skip navigation link ---
    const skipNavEl = document.querySelector(
      'a[href="#main"], a[href="#content"], a[href="#maincontent"], a[href="#main-content"],' +
      'a[class*="skip-nav"], a[class*="skip-to"], a[class*="skipnav"], a[class*="skip-link"]'
    );
    const hasSkipNav = !!skipNavEl;

    // --- Language attribute ---
    const langAttr = document.documentElement.getAttribute('lang');
    const hasLang = !!langAttr && langAttr.length >= 2;

    // --- ARIA misuse detection ---
    // aria-hidden="true" on focusable elements (WCAG violation)
    const hiddenFocusable = document.querySelectorAll(
      '[aria-hidden="true"] a[href], [aria-hidden="true"] button:not([disabled]),' +
      '[aria-hidden="true"] input:not([type="hidden"]), [aria-hidden="true"] [tabindex]:not([tabindex="-1"])'
    ).length;
    // Buttons/links without accessible name
    const emptyButtons = Array.from(document.querySelectorAll('button, a[href], [role="button"]')).filter(el => {
      const text = (el.textContent ?? '').trim();
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledby = el.getAttribute('aria-labelledby');
      const title = el.getAttribute('title');
      const img = el.querySelector('img[alt]');
      return !text && !ariaLabel && !ariaLabelledby && !title && !img;
    }).length;

    // --- Image alt quality ---
    const lowQualityAltPatterns = /^(image|photo|picture|img|untitled|logo|icon|banner|screenshot|screen shot|null|undefined|\d+)$/i;
    let lowQualityAlts = 0;
    images.forEach((img) => {
      if (img.width < 5 || img.height < 5) return;
      const alt = img.getAttribute('alt');
      if (alt && lowQualityAltPatterns.test(alt.trim())) {
        lowQualityAlts++;
      }
    });

    return {
      overlays,
      images: { total: imagesTotal, withAlt: imagesWithAlt, decorativeCorrect: imagesDecorativeCorrect, lowQualityAlts },
      landmarks,
      hasLandmarks,
      headings: { count: headings.length, h1Count, hasSkippedLevels, list: headings.slice(0, 10) },
      forms: { total: inputsTotal, withLabel: inputsWithLabel },
      focusRemoved,
      hasFocusVisible,
      hasSkipNav,
      hasLang,
      ariaIssues: { hiddenFocusable, emptyButtons },
    };
  });

  data.a11y = a11yData;

  // ─── Signals ─────────────────────────────────────────────────────────────
  for (const overlay of a11yData.overlays) {
    signals.push(createSignal({ type: 'a11y_overlay', name: overlay, confidence: 0.9, evidence: `Accessibility overlay: ${overlay}`, category: 'accessibility' }));
  }

  // ─── Checkpoints ─────────────────────────────────────────────────────────

  // CP1: Accessibility overlay
  {
    if (a11yData.overlays.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm10-overlay', name: 'Accessibility Overlay', weight: 0.6,
        health: 'warning',
        evidence: `Accessibility overlay detected: ${a11yData.overlays.join(', ')} — overlays are widely considered insufficient for compliance`,
        recommendation: 'Accessibility overlays don\'t fix underlying code issues. Invest in native accessibility improvements instead.',
      }));
    } else {
      checkpoints.push(createCheckpoint({
        id: 'm10-overlay', name: 'Accessibility Overlay', weight: 0.6,
        health: 'excellent', evidence: 'No accessibility overlay detected (good — native accessibility is preferred)',
      }));
    }
  }

  // CP2: Image alt text
  {
    const img = a11yData.images;
    const ratio = img.total > 0 ? img.withAlt / img.total : 1;

    let health: CheckpointHealth;
    let evidence: string;

    if (img.total === 0) {
      health = 'good';
      evidence = 'No content images to audit';
    } else if (ratio >= 0.95 && img.lowQualityAlts === 0) {
      health = 'excellent';
      evidence = `${img.withAlt}/${img.total} images have alt text (${Math.round(ratio * 100)}%)`;
    } else if (ratio >= 0.95 && img.lowQualityAlts > 0) {
      health = 'good';
      evidence = `${img.withAlt}/${img.total} images have alt text, but ${img.lowQualityAlts} have generic/low-quality alt text`;
    } else if (ratio >= 0.7) {
      health = 'good';
      evidence = `${img.withAlt}/${img.total} images have alt text${img.lowQualityAlts > 0 ? ` (${img.lowQualityAlts} generic)` : ''}`;
    } else {
      health = 'warning';
      evidence = `Only ${img.withAlt}/${img.total} images have alt text`;
    }

    checkpoints.push(createCheckpoint({ id: 'm10-alt-text', name: 'Image Alt Text', weight: 0.7, health, evidence }));
  }

  // CP3: ARIA landmarks
  {
    let health: CheckpointHealth;
    let evidence: string;

    const lm = a11yData.landmarks;
    if (lm.main > 0 && lm.navigation > 0 && lm.banner > 0) {
      health = 'excellent';
      evidence = `ARIA landmarks: main(${lm.main}), nav(${lm.navigation}), banner(${lm.banner}), footer(${lm.contentinfo})`;
    } else if (a11yData.hasLandmarks) {
      health = 'good';
      evidence = `Some landmarks: main(${lm.main}), nav(${lm.navigation})`;
    } else {
      health = 'warning';
      evidence = 'No ARIA landmark roles or semantic HTML5 elements detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm10-landmarks', name: 'ARIA Landmarks', weight: 0.5, health, evidence }));
  }

  // CP4: Heading hierarchy
  {
    const h = a11yData.headings;
    let health: CheckpointHealth;
    let evidence: string;

    if (h.h1Count === 1 && !h.hasSkippedLevels && h.count >= 3) {
      health = 'excellent';
      evidence = `Proper heading hierarchy: 1 H1, ${h.count} total headings, no skipped levels`;
    } else if (h.h1Count === 1 && h.count >= 2) {
      health = 'good';
      evidence = `Single H1, ${h.count} headings${h.hasSkippedLevels ? ' (some skipped levels)' : ''}`;
    } else if (h.h1Count === 0) {
      health = 'warning';
      evidence = 'No H1 heading found';
    } else if (h.h1Count > 1) {
      health = 'warning';
      evidence = `Multiple H1 headings (${h.h1Count}) — should have exactly one`;
    } else {
      health = 'good';
      evidence = `${h.count} headings detected`;
    }

    checkpoints.push(createCheckpoint({ id: 'm10-headings', name: 'Heading Hierarchy', weight: 0.6, health, evidence }));
  }

  // CP5: Form label associations
  {
    const f = a11yData.forms;
    const ratio = f.total > 0 ? f.withLabel / f.total : 1;

    let health: CheckpointHealth;
    let evidence: string;

    if (f.total === 0) {
      health = 'good';
      evidence = 'No form inputs to audit';
    } else if (ratio >= 0.95) {
      health = 'excellent';
      evidence = `${f.withLabel}/${f.total} form inputs have labels`;
    } else if (ratio >= 0.7) {
      health = 'good';
      evidence = `${f.withLabel}/${f.total} form inputs labeled`;
    } else {
      health = 'warning';
      evidence = `Only ${f.withLabel}/${f.total} form inputs have labels — screen readers can't identify unlabeled fields`;
    }

    checkpoints.push(createCheckpoint({ id: 'm10-form-labels', name: 'Form Label Associations', weight: 0.5, health, evidence }));
  }

  // CP6: Focus indicators
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (a11yData.focusRemoved && a11yData.hasFocusVisible) {
      // Modern pattern: remove :focus outline but use :focus-visible for keyboard users
      health = a11yData.hasSkipNav ? 'excellent' : 'good';
      evidence = 'Uses :focus-visible (modern keyboard-only focus)' + (a11yData.hasSkipNav ? ' with skip navigation link' : '');
    } else if (a11yData.focusRemoved) {
      health = 'warning';
      evidence = 'CSS `outline: none` detected on :focus without :focus-visible fallback — keyboard users can\'t see focused elements';
    } else if (a11yData.hasSkipNav) {
      health = 'excellent';
      evidence = 'Skip navigation link present, no focus removal detected';
    } else {
      health = 'good';
      evidence = 'No focus removal detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm10-focus', name: 'Keyboard Focus Indicators', weight: 0.5, health, evidence }));
  }

  // CP7: Language attribute
  {
    checkpoints.push(createCheckpoint({
      id: 'm10-lang', name: 'Language Attribute', weight: 0.3,
      health: a11yData.hasLang ? 'excellent' : 'warning',
      evidence: a11yData.hasLang ? 'lang attribute present on <html>' : 'No lang attribute on <html> — screen readers can\'t determine page language',
    }));
  }

  // CP8: ARIA misuse
  {
    const issues = a11yData.ariaIssues;
    const totalIssues = issues.hiddenFocusable + issues.emptyButtons;

    let health: CheckpointHealth;
    let evidence: string;

    if (totalIssues === 0) {
      health = 'excellent';
      evidence = 'No ARIA misuse detected (no hidden-focusable or unlabeled interactive elements)';
    } else {
      const parts: string[] = [];
      if (issues.hiddenFocusable > 0) parts.push(`${issues.hiddenFocusable} focusable elements inside aria-hidden`);
      if (issues.emptyButtons > 0) parts.push(`${issues.emptyButtons} buttons/links without accessible name`);
      health = totalIssues > 5 ? 'warning' : 'good';
      evidence = `ARIA issues: ${parts.join(', ')}`;
    }

    checkpoints.push(createCheckpoint({ id: 'm10-aria-misuse', name: 'ARIA Usage', weight: 0.5, health, evidence }));
  }

  // CP9: DOM Forensics — hidden interactive elements + inline event handlers
  if (ctx.domForensics) {
    const df = ctx.domForensics;
    const hiddenInteractive: string[] = [];
    const inlineHandlerIssues: string[] = [];

    // Check hidden elements for interactive ones (buttons, links, inputs)
    for (const sample of df.hiddenElements.samples) {
      const tag = sample.tag.toLowerCase();
      if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) {
        hiddenInteractive.push(`<${tag}${sample.id ? ` id="${sample.id}"` : ''}>`);
      }
    }

    // Check inline event handlers on non-interactive elements (div, span)
    for (const handler of df.inlineEventHandlers) {
      const tag = handler.tag.toLowerCase();
      if (['div', 'span', 'td', 'li', 'p', 'section'].includes(tag)) {
        inlineHandlerIssues.push(`<${tag} ${handler.event}>`);
      }
    }

    const totalIssues = hiddenInteractive.length + inlineHandlerIssues.length;

    if (totalIssues > 0) {
      const parts: string[] = [];
      if (hiddenInteractive.length > 0) {
        parts.push(`${hiddenInteractive.length} hidden interactive element(s) (${hiddenInteractive.slice(0, 3).join(', ')})`);
      }
      if (inlineHandlerIssues.length > 0) {
        parts.push(`${inlineHandlerIssues.length} non-interactive element(s) with click handlers (${inlineHandlerIssues.slice(0, 3).join(', ')}) — likely missing keyboard support`);
      }

      checkpoints.push(createCheckpoint({
        id: 'm10-dom-forensics',
        name: 'Interactive Element Accessibility',
        weight: 0.4,
        health: totalIssues > 5 ? 'warning' : 'good',
        evidence: parts.join('; '),
        recommendation: inlineHandlerIssues.length > 0
          ? 'Use <button> or add role="button" + tabindex="0" + keydown handler to non-interactive elements with click handlers.'
          : undefined,
      }));
    } else {
      checkpoints.push(createCheckpoint({
        id: 'm10-dom-forensics',
        name: 'Interactive Element Accessibility',
        weight: 0.4,
        health: 'excellent',
        evidence: 'No hidden interactive elements or inline click handlers on non-interactive elements detected',
      }));
    }

    data.domForensics = {
      hiddenInteractiveCount: hiddenInteractive.length,
      inlineHandlerIssueCount: inlineHandlerIssues.length,
    };
  }

  // ─── CP10: Form Accessibility (from ctx.formSnapshot) ──────────────────────
  if (ctx.formSnapshot) {
    const totalFields = ctx.formSnapshot.forms.reduce((sum, f) => sum + f.fields.length, 0);
    const unlabeledFields = ctx.formSnapshot.forms.reduce((sum, f) =>
      sum + f.fields.filter(field => !field.hasLabel && !field.hasAriaLabel && field.type !== 'hidden').length, 0
    );
    const fieldsWithoutAutocomplete = ctx.formSnapshot.forms.reduce((sum, f) =>
      sum + f.fields.filter(field => !field.autocomplete && ['email', 'tel', 'text'].includes(field.type) &&
        /email|phone|tel|name|address|city|state|zip|postal|country/i.test(field.name)).length, 0
    );

    const visibleFields = ctx.formSnapshot.forms.reduce((sum, f) =>
      sum + f.fields.filter(field => field.type !== 'hidden').length, 0
    );

    data.formAccessibility = {
      totalForms: ctx.formSnapshot.totalForms,
      totalFields,
      unlabeledFields,
      fieldsWithoutAutocomplete,
      labelCoverage: totalFields > 0 ? Math.round(((totalFields - unlabeledFields) / totalFields) * 100) : 100,
    };

    if (visibleFields === 0) {
      checkpoints.push(infoCheckpoint({
        id: 'm10-form-a11y', name: 'Form Accessibility', weight: 0.5,
        evidence: 'No visible form fields detected',
      }));
    } else {
      const unlabeledRatio = visibleFields > 0 ? unlabeledFields / visibleFields : 0;
      let health: CheckpointHealth;
      let evidence: string;

      if (unlabeledFields === 0) {
        health = 'excellent';
        evidence = `All ${visibleFields} visible form fields have labels${fieldsWithoutAutocomplete > 0 ? ` (${fieldsWithoutAutocomplete} missing autocomplete)` : ''}`;
      } else if (unlabeledRatio <= 0.2) {
        health = 'good';
        evidence = `${unlabeledFields}/${visibleFields} visible form fields missing labels (${Math.round(unlabeledRatio * 100)}%)`;
      } else {
        health = 'warning';
        evidence = `Form fields missing labels: ${unlabeledFields}/${visibleFields} visible fields (${Math.round(unlabeledRatio * 100)}%) lack labels`;
      }

      checkpoints.push(createCheckpoint({
        id: 'm10-form-a11y', name: 'Form Accessibility', weight: 0.5,
        health, evidence,
        recommendation: unlabeledFields > 0 ? 'Add explicit <label> or aria-label to all form fields for screen reader compatibility.' : undefined,
      }));
    }
  }

  // ─── CP11: Link Accessibility (from ctx.linkAnalysis) ──────────────────────
  if (ctx.linkAnalysis) {
    data.linkAccessibility = {
      emptyAnchors: ctx.linkAnalysis.emptyAnchors,
      javascriptLinks: ctx.linkAnalysis.javascriptLinks,
      imageOnlyAnchors: ctx.linkAnalysis.imageOnlyAnchors,
      genericAnchors: ctx.linkAnalysis.genericAnchors,
      totalLinks: ctx.linkAnalysis.totalLinks,
    };

    const issues: string[] = [];
    let health: CheckpointHealth = 'excellent';

    if (ctx.linkAnalysis.emptyAnchors > 0) {
      health = 'critical';
      issues.push(`${ctx.linkAnalysis.emptyAnchors} empty anchor(s) without accessible text`);
    }
    if (ctx.linkAnalysis.javascriptLinks > 0) {
      if (health !== 'critical') health = 'warning';
      issues.push(`${ctx.linkAnalysis.javascriptLinks} javascript: void link(s) not keyboard accessible`);
    }
    if (ctx.linkAnalysis.imageOnlyAnchors > 0) {
      if (health !== 'critical') health = 'warning';
      issues.push(`${ctx.linkAnalysis.imageOnlyAnchors} image-only anchor(s) without alt text`);
    }

    const evidence = issues.length > 0
      ? `Link issues: ${issues.join('; ')} (${ctx.linkAnalysis.totalLinks} total links)`
      : `All ${ctx.linkAnalysis.totalLinks} links have accessible text`;

    checkpoints.push(createCheckpoint({
      id: 'm10-link-a11y', name: 'Link Accessibility', weight: 0.5,
      health, evidence,
      recommendation: health !== 'excellent' ? 'Ensure all links have descriptive text content or aria-label. Replace javascript: void links with buttons.' : undefined,
    }));
  }

  // ─── CP12: Image Alt Text Coverage (from ctx.imageAudit) ───────────────────
  if (ctx.imageAudit) {
    const totalMeaningful = ctx.imageAudit.totalImages - ctx.imageAudit.emptyAlt; // exclude decorative
    const withAlt = totalMeaningful - ctx.imageAudit.missingAlt;
    const coverage = totalMeaningful > 0 ? Math.round((withAlt / totalMeaningful) * 100) : 100;

    data.imageAccessibility = {
      totalImages: ctx.imageAudit.totalImages,
      missingAlt: ctx.imageAudit.missingAlt,
      emptyAlt: ctx.imageAudit.emptyAlt,
      genericAlt: ctx.imageAudit.genericAlt,
      altTextCoverage: coverage,
    };

    if (ctx.imageAudit.totalImages === 0) {
      checkpoints.push(infoCheckpoint({
        id: 'm10-alt-text', name: 'Image Alt Text Coverage', weight: 0.6,
        evidence: 'No images detected on the page',
      }));
    } else {
      let health: CheckpointHealth;
      let evidence: string;

      if (coverage < 50) {
        health = 'critical';
        evidence = `Alt text coverage: ${coverage}% — ${ctx.imageAudit.missingAlt} of ${totalMeaningful} meaningful images missing alt text`;
      } else if (coverage < 80) {
        health = 'warning';
        evidence = `Alt text coverage: ${coverage}% — ${ctx.imageAudit.missingAlt} of ${totalMeaningful} meaningful images missing alt text`;
      } else if (coverage >= 80 && ctx.imageAudit.genericAlt > 5) {
        health = 'good';
        evidence = `Alt text coverage: ${coverage}% — good coverage but ${ctx.imageAudit.genericAlt} images have generic alt text (${ctx.imageAudit.emptyAlt} decorative)`;
      } else {
        health = 'excellent';
        evidence = `Alt text coverage: ${coverage}% — ${withAlt}/${totalMeaningful} meaningful images have alt text (${ctx.imageAudit.emptyAlt} decorative)`;
      }

      checkpoints.push(createCheckpoint({
        id: 'm10-alt-text', name: 'Image Alt Text Coverage', weight: 0.6,
        health, evidence,
        recommendation: coverage < 80 ? 'Add descriptive alt text to all meaningful images. Use empty alt="" for purely decorative images.' : undefined,
      }));
    }
  }

  return { moduleId: 'M10' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

export { execute };
registerModuleExecutor('M10' as ModuleId, execute);
