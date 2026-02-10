/**
 * M11 - Console & Error Logging
 *
 * Captures JavaScript errors, console warnings, network failures,
 * mixed content, and detects error monitoring tools.
 *
 * Checkpoints:
 *   1. JavaScript errors on load
 *   2. Network errors (4xx/5xx)
 *   3. Console.log in production
 *   4. Error monitoring tool
 *   5. Mixed content
 *   6. Resource loading failures
 */

import { registerModuleExecutor } from '../runner.js';
import type { ModuleContext } from '../types.js';
import type { ModuleResult, ModuleId, Signal, Checkpoint, CheckpointHealth } from '@marketing-alpha/types';
import { createSignal, createCheckpoint, infoCheckpoint } from '../../utils/signals.js';

interface ConsoleEntry {
  type: string;
  text: string;
  url?: string;
}

const execute = async (ctx: ModuleContext): Promise<ModuleResult> => {
  const signals: Signal[] = [];
  const checkpoints: Checkpoint[] = [];
  const data: Record<string, unknown> = {};

  const page = ctx.page;
  if (!page) {
    return { moduleId: 'M11' as ModuleId, status: 'error', data: {}, signals: [], score: null, checkpoints: [], duration: 0, error: 'No page' };
  }

  // ─── Step 1: Set up listeners ──────────────────────────────────────────
  const consoleMessages: ConsoleEntry[] = [];
  const jsErrors: Array<{ message: string; stack?: string }> = [];
  const failedRequests: Array<{ url: string; failure: string; resourceType: string }> = [];

  const consoleHandler = (msg: { type: () => string; text: () => string; location: () => { url?: string } }) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text().slice(0, 200),
      url: msg.location()?.url,
    });
  };

  const pageErrorHandler = (error: Error) => {
    jsErrors.push({
      message: error.message?.slice(0, 200) ?? 'Unknown error',
      stack: error.stack?.slice(0, 300),
    });
  };

  const requestFailedHandler = (request: { url: () => string; failure: () => { errorText: string } | null; resourceType: () => string }) => {
    const failure = request.failure();
    failedRequests.push({
      url: request.url().slice(0, 200),
      failure: failure?.errorText ?? 'Unknown',
      resourceType: request.resourceType(),
    });
  };

  page.on('console', consoleHandler);
  page.on('pageerror', pageErrorHandler);
  page.on('requestfailed', requestFailedHandler);

  // Wait a moment to catch late-firing errors
  await page.waitForTimeout(3000);

  // ─── Step 2: Detect error monitoring tools ─────────────────────────────
  const errorTools = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const tools: string[] = [];

    if (w['Sentry'] || w['__SENTRY__'] || w['Raven']) tools.push('Sentry');
    if (w['Bugsnag'] || w['bugsnagClient']) tools.push('Bugsnag');
    if (w['DD_RUM'] || w['datadogRum']) tools.push('Datadog RUM');
    if (w['newrelic'] || w['NREUM']) tools.push('New Relic');
    if (w['Rollbar'] || w['_rollbarConfig']) tools.push('Rollbar');
    if (w['LogRocket']) tools.push('LogRocket');
    if (w['TrackJS'] || w['trackJs']) tools.push('TrackJS');
    if (w['Honeybadger']) tools.push('Honeybadger');
    if (w['Raygun']) tools.push('Raygun');
    if (w['atatus']) tools.push('Atatus');

    // Also check scripts
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    for (const s of scripts) {
      const src = (s as HTMLScriptElement).src.toLowerCase();
      if (src.includes('sentry') && !tools.includes('Sentry')) tools.push('Sentry');
      if (src.includes('bugsnag') && !tools.includes('Bugsnag')) tools.push('Bugsnag');
      if (src.includes('datadoghq') && !tools.includes('Datadog RUM')) tools.push('Datadog RUM');
      if (src.includes('newrelic') && !tools.includes('New Relic')) tools.push('New Relic');
      if (src.includes('rollbar') && !tools.includes('Rollbar')) tools.push('Rollbar');
      if (src.includes('logrocket') && !tools.includes('LogRocket')) tools.push('LogRocket');
    }

    return tools;
  });

  // ─── Step 3: Detect mixed content ──────────────────────────────────────
  const mixedContent = await page.evaluate(() => {
    const isHttps = location.protocol === 'https:';
    if (!isHttps) return { isHttps: false, mixed: [] };

    const mixed: Array<{ tag: string; url: string }> = [];
    const selectors: Array<{ sel: string; attr: string }> = [
      { sel: 'script[src^="http://"]', attr: 'src' },
      { sel: 'link[href^="http://"]', attr: 'href' },
      { sel: 'img[src^="http://"]', attr: 'src' },
      { sel: 'iframe[src^="http://"]', attr: 'src' },
      { sel: 'video[src^="http://"]', attr: 'src' },
      { sel: 'audio[src^="http://"]', attr: 'src' },
    ];

    for (const { sel, attr } of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const url = el.getAttribute(attr) ?? '';
        mixed.push({ tag: el.tagName.toLowerCase(), url: url.slice(0, 150) });
      });
    }

    return { isHttps, mixed };
  });

  // ─── Step 4: Check network responses for 4xx/5xx ──────────────────────
  const nc = ctx.networkCollector;
  let networkErrors: Array<{ url: string; status: number }> = [];
  if (nc) {
    const allResponses = nc.getAllResponses();
    networkErrors = allResponses
      .filter(r => r.status >= 400)
      .map(r => ({ url: r.url.slice(0, 150), status: r.status }))
      .slice(0, 20);
  }

  // Clean up listeners
  page.removeListener('console', consoleHandler);
  page.removeListener('pageerror', pageErrorHandler);
  page.removeListener('requestfailed', requestFailedHandler);

  // ─── Classify console messages ─────────────────────────────────────────
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m => m.type === 'warning');
  const logs = consoleMessages.filter(m => m.type === 'log');

  data.console = {
    errors: errors.length,
    warnings: warnings.length,
    logs: logs.length,
    total: consoleMessages.length,
    samples: {
      errors: errors.slice(0, 5),
      warnings: warnings.slice(0, 5),
    },
  };
  data.jsErrors = jsErrors.slice(0, 10);
  data.failedRequests = failedRequests.slice(0, 10);
  data.networkErrors = networkErrors.slice(0, 10);
  data.mixedContent = mixedContent;
  data.errorTools = errorTools;

  // ─── Signals ───────────────────────────────────────────────────────────
  for (const tool of errorTools) {
    signals.push(createSignal({ type: 'error_monitoring', name: tool, confidence: 0.9, evidence: `Error monitoring: ${tool}`, category: 'analytics' }));
  }

  // ─── Checkpoints ───────────────────────────────────────────────────────

  // CP1: JavaScript errors on load
  {
    const totalErrors = jsErrors.length + errors.length;
    let health: CheckpointHealth;
    let evidence: string;

    if (totalErrors === 0) {
      health = 'excellent';
      evidence = 'Zero JavaScript errors on page load';
    } else if (totalErrors <= 2) {
      health = 'good';
      evidence = `${totalErrors} minor JS error(s) on load`;
    } else if (totalErrors <= 5) {
      health = 'warning';
      evidence = `${totalErrors} JS errors detected on load: ${jsErrors.slice(0, 2).map(e => e.message.slice(0, 60)).join('; ')}`;
    } else {
      health = 'critical';
      evidence = `${totalErrors} JS errors on load — indicates significant code quality issues`;
    }

    checkpoints.push(createCheckpoint({ id: 'm11-js-errors', name: 'JavaScript Errors', weight: 0.9, health, evidence }));
  }

  // CP2: Network errors
  {
    const errors4xx = networkErrors.filter(r => r.status >= 400 && r.status < 500);
    const errors5xx = networkErrors.filter(r => r.status >= 500);
    const totalNetErrors = networkErrors.length + failedRequests.length;

    let health: CheckpointHealth;
    let evidence: string;

    if (totalNetErrors === 0) {
      health = 'excellent';
      evidence = 'Zero network errors detected';
    } else if (errors5xx.length > 0) {
      health = 'critical';
      evidence = `${errors5xx.length} server errors (5xx), ${errors4xx.length} client errors (4xx), ${failedRequests.length} failed requests`;
    } else if (totalNetErrors <= 2) {
      health = 'good';
      evidence = `${totalNetErrors} minor network issue(s): ${errors4xx.length} 4xx errors, ${failedRequests.length} failed requests`;
    } else {
      health = 'warning';
      evidence = `${totalNetErrors} network errors: ${errors4xx.length} 4xx, ${failedRequests.length} failed requests`;
    }

    checkpoints.push(createCheckpoint({ id: 'm11-network-errors', name: 'Network Errors', weight: 0.7, health, evidence }));
  }

  // CP3: Console.log in production
  {
    let health: CheckpointHealth;
    let evidence: string;

    if (logs.length === 0) {
      health = 'excellent';
      evidence = 'No console.log statements in production';
    } else if (logs.length <= 3) {
      health = 'good';
      evidence = `${logs.length} console.log statement(s) — minor code hygiene issue`;
    } else if (logs.length <= 10) {
      health = 'warning';
      evidence = `${logs.length} console.log statements — should be removed for production`;
    } else {
      health = 'critical';
      evidence = `${logs.length} console.log statements — excessive debug logging in production`;
    }

    checkpoints.push(createCheckpoint({ id: 'm11-console-logs', name: 'Console.log in Production', weight: 0.4, health, evidence }));
  }

  // CP4: Error monitoring tool
  {
    if (errorTools.length > 0) {
      checkpoints.push(createCheckpoint({
        id: 'm11-error-monitoring', name: 'Error Monitoring', weight: 0.6,
        health: 'excellent',
        evidence: `Error monitoring active: ${errorTools.join(', ')}`,
      }));
    } else {
      checkpoints.push(createCheckpoint({
        id: 'm11-error-monitoring', name: 'Error Monitoring', weight: 0.6,
        health: 'warning',
        evidence: 'No error monitoring tool detected (Sentry, Bugsnag, Datadog, etc.) — errors may go unnoticed',
        recommendation: 'Implement an error monitoring service to catch and track production errors.',
      }));
    }
  }

  // CP5: Mixed content
  {
    if (!mixedContent.isHttps) {
      checkpoints.push(infoCheckpoint('m11-mixed-content', 'Mixed Content', 'Site not on HTTPS — mixed content check not applicable'));
    } else if (mixedContent.mixed.length === 0) {
      checkpoints.push(createCheckpoint({
        id: 'm11-mixed-content', name: 'Mixed Content', weight: 0.7,
        health: 'excellent', evidence: 'No mixed content (HTTP resources on HTTPS page)',
      }));
    } else {
      const hasScripts = mixedContent.mixed.some(m => m.tag === 'script' || m.tag === 'iframe');
      checkpoints.push(createCheckpoint({
        id: 'm11-mixed-content', name: 'Mixed Content', weight: 0.7,
        health: hasScripts ? 'critical' : 'warning',
        evidence: `${mixedContent.mixed.length} HTTP resource(s) on HTTPS page: ${mixedContent.mixed.slice(0, 3).map(m => `${m.tag}(${m.url.slice(0, 50)})`).join(', ')}`,
        recommendation: 'Update all resource URLs to HTTPS to prevent mixed content warnings and security risks.',
      }));
    }
  }

  // CP6: Resource loading failures
  {
    const criticalTypes = ['script', 'stylesheet', 'font'];
    const criticalFailures = failedRequests.filter(r => criticalTypes.includes(r.resourceType));

    let health: CheckpointHealth;
    let evidence: string;

    if (failedRequests.length === 0) {
      health = 'excellent';
      evidence = 'All resources loaded successfully';
    } else if (criticalFailures.length > 0) {
      health = 'critical';
      evidence = `${criticalFailures.length} critical resource failure(s) (${criticalFailures.map(r => r.resourceType).join(', ')}): ${criticalFailures[0]!.url.slice(0, 80)}`;
    } else if (failedRequests.length <= 2) {
      health = 'good';
      evidence = `${failedRequests.length} non-critical resource(s) failed to load`;
    } else {
      health = 'warning';
      evidence = `${failedRequests.length} resource(s) failed to load`;
    }

    checkpoints.push(createCheckpoint({ id: 'm11-resource-failures', name: 'Resource Loading', weight: 0.5, health, evidence }));
  }

  return { moduleId: 'M11' as ModuleId, status: 'success', data, signals, score: null, checkpoints, duration: 0 };
};

registerModuleExecutor('M11' as ModuleId, execute);
