'use client';

import type { ScanWithResults } from '@marketing-alpha/types';
import {
  SlideShell,
  getM41Summary,
  getModuleResult,
  scoreColor,
  StatBlock,
  Pill,
  CheckItem,
  SkippedSlide,
} from './module-slide-template';

/**
 * M11 Slide — Console Errors
 * ══════════════════════════
 *
 * Layout C: SlideShell with StatBlock hero (error/warning counts),
 * monospace error messages section, and failed requests table.
 */

interface JSError {
  message?: string;
  source?: string;
  line?: number;
}

interface FailedRequest {
  url?: string;
  status?: number;
  statusText?: string;
  resourceType?: string;
}

interface NetworkError {
  url?: string;
  status?: number;
}

export function M11Slide({ scan }: { scan: ScanWithResults }) {
  const syn = getM41Summary(scan, 'M11');
  const mod = getModuleResult(scan, 'M11');
  const raw = (mod?.data as Record<string, unknown> | undefined) ?? null;

  if (!syn && (!mod || mod.status === 'skipped' || mod.status === 'error')) {
    return <SkippedSlide moduleName="Console Errors" scan={scan} sourceLabel="Source: Browser console capture, error classification" />;
  }

  const findings = syn?.key_findings ?? [];
  const recs = syn?.recommendations ?? [];
  const scores = syn?.score_breakdown ?? [];
  const modScore = syn?.module_score ?? mod?.score ?? null;
  const headline = findings.length > 0 ? findings[0]!.finding : 'JavaScript error and console health analysis';
  const execSummary = syn?.executive_summary ?? syn?.analysis ?? '';

  // ── Extract raw data ──
  const consoleData = (raw?.['console'] as Record<string, unknown> | undefined) ?? null;
  const errorCount = typeof consoleData?.['errors'] === 'number' ? consoleData['errors'] as number : 0;
  const warningCount = typeof consoleData?.['warnings'] === 'number' ? consoleData['warnings'] as number : 0;
  const logCount = typeof consoleData?.['logs'] === 'number' ? consoleData['logs'] as number : 0;
  const totalMessages = typeof consoleData?.['total'] === 'number' ? consoleData['total'] as number : 0;

  // Error samples
  const consoleSamples = (consoleData?.['samples'] as Record<string, unknown> | undefined) ?? null;
  const errorSamples = (consoleSamples?.['errors'] as Array<Record<string, unknown>> | undefined) ?? [];

  const jsErrors = (raw?.['jsErrors'] as JSError[] | undefined) ?? [];
  const failedRequests = (raw?.['failedRequests'] as FailedRequest[] | undefined) ?? [];
  const networkErrors = (raw?.['networkErrors'] as NetworkError[] | undefined) ?? [];
  const errorTools = (raw?.['errorTools'] as string[] | undefined) ?? [];
  const mixedContent = (raw?.['mixedContent'] as Record<string, unknown> | undefined) ?? null;
  const mixedCount = Array.isArray(mixedContent?.['mixed']) ? (mixedContent['mixed'] as unknown[]).length : 0;

  // Combine all error messages for display
  const allErrors: string[] = [];
  for (const err of jsErrors) {
    if (typeof err.message === 'string') {
      allErrors.push(err.message);
    }
  }
  for (const sample of errorSamples) {
    const text = typeof sample['text'] === 'string' ? sample['text'] as string : null;
    if (text && !allErrors.includes(text)) {
      allErrors.push(text);
    }
  }

  // Combine failed requests + network errors
  const allFailedRequests: Array<{ url: string; status: number | string }> = [];
  for (const req of failedRequests) {
    if (typeof req.url === 'string') {
      allFailedRequests.push({
        url: req.url,
        status: typeof req.status === 'number' ? req.status : typeof req.resourceType === 'string' ? req.resourceType : '—',
      });
    }
  }
  for (const ne of networkErrors) {
    if (typeof ne.url === 'string' && typeof ne.status === 'number' && !allFailedRequests.some(r => r.url === ne.url)) {
      allFailedRequests.push({ url: ne.url, status: ne.status });
    }
  }

  return (
    <SlideShell
      moduleName="Console Errors"
      score={modScore}
      headline={headline}
      execSummary={execSummary}
      scan={scan}
      sourceLabel="Source: Browser console capture, error classification"
      findings={findings}
      recommendations={recs}
      scoreBreakdown={scores}
    >
      {/* ═══ Hero Stats + Error Messages + Failed Requests ═══ */}
      <div style={{
        marginBottom: '0.6em', flexShrink: 0,
        padding: '0.5em 0',
        borderTop: '1px solid rgba(255,178,239,0.06)',
        borderBottom: '1px solid rgba(255,178,239,0.06)',
      }}>
        {/* Stats in cards */}
        <div style={{ display: 'flex', gap: '0.6em', marginBottom: '0.5em' }}>
          {[
            { value: errorCount + jsErrors.length, label: 'JS Errors', color: errorCount + jsErrors.length > 0 ? 'var(--gs-critical)' : 'var(--gs-terminal)', show: true },
            { value: warningCount, label: 'Warnings', color: warningCount > 5 ? 'var(--gs-warning)' : 'var(--gs-light)', show: true },
            { value: allFailedRequests.length, label: 'Failed Requests', color: allFailedRequests.length > 0 ? 'var(--gs-critical)' : 'var(--gs-terminal)', show: true },
            { value: logCount, label: 'Console Logs', color: logCount > 10 ? 'var(--gs-warning)' : 'var(--gs-light)', show: true },
            { value: mixedCount, label: 'Mixed Content', color: 'var(--gs-critical)', show: mixedCount > 0 },
          ].filter(s => s.show).map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '0.6em 0.8em', borderRadius: '4px', textAlign: 'center',
              background: 'rgba(255,178,239,0.04)',
              border: '1px solid rgba(255,178,239,0.08)',
            }}>
              <p className="font-data tabular-nums" style={{
                fontSize: 'clamp(10px, 2.2cqi, 26px)', fontWeight: 700, lineHeight: 1, color: s.color,
              }}>
                {s.value}
              </p>
              <p className="font-data uppercase" style={{
                fontSize: 'clamp(7px, 1cqi, 12px)', color: 'var(--gs-base)',
                letterSpacing: '0.08em', marginTop: '0.3em',
              }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '3%' }}>
          {/* Left: Error messages (monospace) */}
          <div style={{ flex: '1 1 55%', overflow: 'hidden' }}>
            {allErrors.length > 0 && (
              <>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.25em' }}>
                  Error Messages
                </h4>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '0.2em',
                  background: 'rgba(239,68,68,0.04)',
                  padding: '0.4em', borderRadius: '3px',
                  border: '1px solid rgba(239,68,68,0.08)',
                  maxHeight: '8em', overflow: 'hidden',
                }}>
                  {allErrors.slice(0, 6).map((msg, i) => (
                    <p key={i} style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 'clamp(7px, 1.05cqi, 13px)',
                      color: 'var(--gs-critical)',
                      lineHeight: 1.3,
                      wordBreak: 'break-all',
                      opacity: 0.9,
                    }}>
                      {msg}
                    </p>
                  ))}
                </div>
              </>
            )}
            {allErrors.length === 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1em', borderRadius: '3px',
                background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.08)',
              }}>
                <span className="font-display" style={{ fontSize: 'clamp(10px, 2cqi, 24px)', color: 'var(--gs-terminal)', fontWeight: 700 }}>
                  {'\u2713'}
                </span>
                <span className="font-data" style={{ fontSize: 'clamp(7px, 1.3cqi, 15px)', color: 'var(--gs-terminal)', marginLeft: '0.5em' }}>
                  Zero JavaScript errors
                </span>
              </div>
            )}
          </div>

          {/* Right: Failed requests table */}
          <div style={{ flex: '1 1 40%', overflow: 'hidden' }}>
            {allFailedRequests.length > 0 ? (
              <>
                <h4 className="font-display uppercase" style={{ fontSize: 'clamp(7px, 1.2cqi, 13px)', letterSpacing: '0.18em', color: 'var(--gs-base)', marginBottom: '0.25em' }}>
                  Failed Requests
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15em' }}>
                  {allFailedRequests.slice(0, 6).map((req, i) => {
                    // Shorten URL for display
                    let shortUrl = req.url;
                    try {
                      const parsed = new URL(req.url);
                      shortUrl = parsed.pathname + (parsed.search ? '?' + parsed.search.slice(1, 20) : '');
                      if (shortUrl.length > 40) shortUrl = shortUrl.slice(0, 37) + '...';
                    } catch {
                      if (shortUrl.length > 40) shortUrl = shortUrl.slice(0, 37) + '...';
                    }
                    const statusColor = typeof req.status === 'number' && req.status >= 500
                      ? 'var(--gs-critical)'
                      : typeof req.status === 'number' && req.status >= 400
                        ? 'var(--gs-warning)'
                        : 'var(--gs-mid)';

                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '0.3em' }}>
                        <span className="font-data tabular-nums" style={{
                          fontSize: 'clamp(7px, 1.1cqi, 13px)', fontWeight: 700,
                          color: statusColor, minWidth: '2.2em', flexShrink: 0,
                        }}>
                          {req.status}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 'clamp(7px, 1cqi, 12px)',
                          color: 'var(--gs-light)', opacity: 0.7,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {shortUrl}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <CheckItem status="pass" label="All requests successful" />
            )}
          </div>
        </div>

        {/* Error monitoring tools */}
        {errorTools.length > 0 && (
          <div style={{ display: 'flex', gap: '0.3em', flexWrap: 'wrap', marginTop: '0.4em', alignItems: 'center' }}>
            <span className="font-data uppercase" style={{ fontSize: 'clamp(7px, 1cqi, 12px)', color: 'var(--gs-mid)', letterSpacing: '0.05em' }}>
              Monitoring:
            </span>
            {errorTools.map((tool, i) => (
              <Pill key={i} text={tool} color="var(--gs-terminal)" />
            ))}
          </div>
        )}
      </div>
    </SlideShell>
  );
}
