/**
 * M14 - Mobile & Responsive Design
 *
 * Evaluates mobile-friendliness: viewport meta, touch targets, responsive
 * breakpoints, mobile-specific UX elements, and layout at mobile viewport.
 *
 * Checkpoints:
 *   1. Viewport meta tag
 *   2. Responsive layout at 375px
 *   3. Touch target sizing
 *   4. Text readability on mobile
 *   5. Mobile navigation (hamburger/drawer)
 *   6. Horizontal scroll detection
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint } from '../../utils/signals.js';

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return { moduleId: 'M14' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  // ─── Step 1: Audit at desktop viewport (current) ─────────────────────────
  const desktopAudit = await page.evaluate(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    const viewportContent = viewport?.getAttribute('content') || null;
    return { viewportContent };
  });

  // ─── Step 2: Resize to mobile and audit ──────────────────────────────────
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 375, height: 812 }); // iPhone dimensions
  await page.waitForTimeout(1000); // Allow re-layout

  const mobileAudit = await page.evaluate(() => {
    const body = document.body;
    const docEl = document.documentElement;

    // Horizontal overflow
    const hasHorizontalScroll = docEl.scrollWidth > docEl.clientWidth;

    // Touch targets — find interactive elements smaller than 44x44px
    const interactive = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]');
    let smallTargets = 0;
    let totalTargets = 0;
    interactive.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        totalTargets++;
        if (rect.width < 44 || rect.height < 44) smallTargets++;
      }
    });

    // Text readability
    const paragraphs = document.querySelectorAll('p, li, span, div');
    let smallTextCount = 0;
    let checkedText = 0;
    paragraphs.forEach((el) => {
      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize > 0 && el.textContent && el.textContent.trim().length > 10) {
        checkedText++;
        if (fontSize < 14) smallTextCount++;
      }
    });

    // Mobile navigation
    const hasHamburger = !!(
      document.querySelector('[class*="hamburger"], [class*="menu-toggle"], [aria-label*="menu"], [aria-label*="Menu"]') ||
      document.querySelector('button[class*="mobile"], nav button, header button')
    );
    const hasDrawer = !!document.querySelector('[class*="drawer"], [class*="sidebar"], [class*="mobile-nav"], [class*="offcanvas"]');

    // Media queries in stylesheets
    let hasMediaQueries = false;
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        try {
          const rules = document.styleSheets[i]!.cssRules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j]! instanceof CSSMediaRule) {
              hasMediaQueries = true;
              break;
            }
          }
        } catch { /* cross-origin */ }
        if (hasMediaQueries) break;
      }
    } catch { /* */ }

    return {
      hasHorizontalScroll,
      smallTargets,
      totalTargets,
      smallTextCount,
      checkedText,
      hasHamburger,
      hasDrawer,
      hasMediaQueries,
    };
  });

  data.desktopAudit = desktopAudit;
  data.mobileAudit = mobileAudit;

  // Restore original viewport
  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }

  // ─── Step 3: Build checkpoints ───────────────────────────────────────────

  // CP1: Viewport meta tag
  {
    const vc = desktopAudit.viewportContent;
    let health: CheckpointHealth;
    let evidence: string;

    if (vc && vc.includes('width=device-width') && vc.includes('initial-scale=1')) {
      health = 'excellent';
      evidence = `Viewport meta: ${vc}`;
    } else if (vc && vc.includes('width=device-width')) {
      health = 'good';
      evidence = `Viewport meta present: ${vc}`;
    } else if (vc) {
      health = 'warning';
      evidence = `Viewport meta incomplete: ${vc}`;
    } else {
      health = 'critical';
      evidence = 'No viewport meta tag — page will not render correctly on mobile';
    }

    checkpoints.push(createCheckpoint({ id: 'm14-viewport', name: 'Viewport Meta Tag', weight: 1.0, health, evidence }));
  }

  // CP2: Responsive layout
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (!mobileAudit.hasHorizontalScroll && mobileAudit.hasMediaQueries) {
      health = 'excellent';
      evidence = 'Page adapts to 375px viewport without horizontal scroll, CSS media queries detected';
    } else if (!mobileAudit.hasHorizontalScroll) {
      health = 'good';
      evidence = 'No horizontal scroll at mobile width';
    } else {
      health = 'critical';
      evidence = 'Horizontal scroll detected at 375px — page is not responsive';
    }

    checkpoints.push(createCheckpoint({ id: 'm14-responsive', name: 'Responsive Layout (375px)', weight: 0.8, health, evidence }));
  }

  // CP3: Touch target sizing
  {
    const ratio = mobileAudit.totalTargets > 0
      ? (mobileAudit.totalTargets - mobileAudit.smallTargets) / mobileAudit.totalTargets
      : 1;

    let health: CheckpointHealth;
    let evidence: string;

    if (ratio >= 0.9) {
      health = 'excellent';
      evidence = `${Math.round(ratio * 100)}% of ${mobileAudit.totalTargets} touch targets meet 44px minimum`;
    } else if (ratio >= 0.7) {
      health = 'good';
      evidence = `${mobileAudit.smallTargets}/${mobileAudit.totalTargets} targets below 44px minimum`;
    } else {
      health = 'warning';
      evidence = `${mobileAudit.smallTargets}/${mobileAudit.totalTargets} touch targets too small for comfortable mobile use`;
    }

    checkpoints.push(createCheckpoint({ id: 'm14-touch', name: 'Touch Target Sizing', weight: 0.6, health, evidence }));
  }

  // CP4: Text readability
  {
    const ratio = mobileAudit.checkedText > 0
      ? (mobileAudit.checkedText - mobileAudit.smallTextCount) / mobileAudit.checkedText
      : 1;

    let health: CheckpointHealth;
    let evidence: string;

    if (ratio >= 0.9) {
      health = 'excellent';
      evidence = 'Text is readable at mobile size (>= 14px)';
    } else if (ratio >= 0.7) {
      health = 'good';
      evidence = `Most text readable, ${mobileAudit.smallTextCount} elements below 14px`;
    } else {
      health = 'warning';
      evidence = `${mobileAudit.smallTextCount} text elements too small for mobile (< 14px)`;
    }

    checkpoints.push(createCheckpoint({ id: 'm14-text', name: 'Mobile Text Readability', weight: 0.5, health, evidence }));
  }

  // CP5: Mobile navigation
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (mobileAudit.hasHamburger || mobileAudit.hasDrawer) {
      health = 'excellent';
      evidence = `Mobile navigation detected (${mobileAudit.hasHamburger ? 'hamburger menu' : 'drawer'})`;
    } else {
      health = 'warning';
      evidence = 'No mobile-specific navigation pattern detected';
    }

    checkpoints.push(createCheckpoint({ id: 'm14-nav', name: 'Mobile Navigation', weight: 0.5, health, evidence }));
  }

  // CP6: Horizontal scroll
  {
    checkpoints.push(
      mobileAudit.hasHorizontalScroll
        ? createCheckpoint({ id: 'm14-scroll', name: 'No Horizontal Scroll', weight: 0.7, health: 'critical', evidence: 'Horizontal scroll at 375px — elements overflow viewport', recommendation: 'Fix elements causing horizontal overflow at mobile width.' })
        : createCheckpoint({ id: 'm14-scroll', name: 'No Horizontal Scroll', weight: 0.7, health: 'excellent', evidence: 'No horizontal scroll at mobile viewport' }),
    );
  }

  signals.push(createSignal({
    type: 'mobile',
    name: 'Mobile Responsiveness',
    confidence: 0.9,
    evidence: `Viewport: ${desktopAudit.viewportContent ? 'yes' : 'no'}, H-scroll: ${mobileAudit.hasHorizontalScroll ? 'yes' : 'no'}, Mobile nav: ${mobileAudit.hasHamburger || mobileAudit.hasDrawer ? 'yes' : 'no'}`,
    category: 'mobile',
  }));

  return { moduleId: 'M14' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M14' as ModuleId, execute);
