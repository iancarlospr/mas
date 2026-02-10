/**
 * M10 - Accessibility Overlay Detection & Basic A11y Audit
 *
 * Detects accessibility overlay tools and performs a basic WCAG audit:
 * alt text, ARIA roles, heading hierarchy, color contrast indicators,
 * keyboard navigation, and form label associations.
 *
 * Checkpoints:
 *   1. Accessibility overlay detection
 *   2. Image alt text coverage
 *   3. ARIA landmarks and roles
 *   4. Heading hierarchy
 *   5. Form label associations
 *   6. Keyboard focus indicators
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
    // Check if outlines are removed (anti-pattern)
    let focusRemoved = false;
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i]!.cssRules;
          for (let j = 0; j < rules.length; j++) {
            const text = rules[j]!.cssText;
            if (text.includes(':focus') && text.includes('outline: none') || text.includes('outline:none') || text.includes('outline: 0')) {
              focusRemoved = true;
              break;
            }
          }
        } catch { /* cross-origin */ }
        if (focusRemoved) break;
      }
    } catch { /* */ }

    // --- Skip navigation link ---
    const hasSkipNav = !!document.querySelector('a[href="#main"], a[href="#content"], a[class*="skip-nav"], a[class*="skip-to"]');

    // --- Language attribute ---
    const hasLang = !!document.documentElement.getAttribute('lang');

    return {
      overlays,
      images: { total: imagesTotal, withAlt: imagesWithAlt, decorativeCorrect: imagesDecorativeCorrect },
      landmarks,
      hasLandmarks,
      headings: { count: headings.length, h1Count, hasSkippedLevels, list: headings.slice(0, 10) },
      forms: { total: inputsTotal, withLabel: inputsWithLabel },
      focusRemoved,
      hasSkipNav,
      hasLang,
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
    } else if (ratio >= 0.95) {
      health = 'excellent';
      evidence = `${img.withAlt}/${img.total} images have alt text (${Math.round(ratio * 100)}%)`;
    } else if (ratio >= 0.7) {
      health = 'good';
      evidence = `${img.withAlt}/${img.total} images have alt text`;
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

    if (a11yData.focusRemoved) {
      health = 'warning';
      evidence = 'CSS `outline: none` detected on :focus — keyboard users can\'t see focused elements';
    } else if (a11yData.hasSkipNav) {
      health = 'excellent';
      evidence = 'Skip navigation link present, no focus removal detected';
    } else {
      health = 'good';
      evidence = 'No focus removal detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm10-focus', name: 'Keyboard Focus Indicators', weight: 0.5, health, evidence }));
  }

  // Bonus: language attribute
  if (!a11yData.hasLang) {
    checkpoints.push(createCheckpoint({
      id: 'm10-lang', name: 'Language Attribute', weight: 0.3,
      health: 'warning', evidence: 'No lang attribute on <html> — screen readers can\'t determine page language',
    }));
  }

  return { moduleId: 'M10' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M10' as ModuleId, execute);
