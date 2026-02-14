'use client';

import type { ModuleResult } from '@marketing-alpha/types';
import { UnlockOverlay } from './unlock-overlay';

interface PaidSlidesProps {
  scanId: string;
  isPaid: boolean;
  resultMap: Map<string, ModuleResult>;
}

const SYNTHESIS_SLIDES = [
  { moduleId: 'M42', label: 'Executive Brief', icon: '📋' },
  { moduleId: 'M44', label: 'ROI Analysis', icon: '💰' },
  { moduleId: 'M43', label: 'Remediation Roadmap', icon: '🗺️' },
  { moduleId: 'M45', label: 'Cost Cutter', icon: '✂️' },
] as const;

export function PaidSlides({ scanId, isPaid, resultMap }: PaidSlidesProps) {
  return (
    <>
      {SYNTHESIS_SLIDES.map(({ moduleId, label, icon }) => {
        const result = resultMap.get(moduleId);
        return (
          <div
            key={moduleId}
            id={`slide-${moduleId}`}
            className="slide-card relative w-full bg-white border border-border/60 rounded-xl shadow-sm overflow-hidden"
            style={{ aspectRatio: '16 / 9' }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted">{moduleId}</span>
                <span className="font-heading text-sm font-600 text-primary">{label}</span>
              </div>
              {!isPaid && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Paid
                </span>
              )}
            </div>

            {/* Content */}
            <div className="p-6 h-[calc(100%-48px)] overflow-hidden">
              {isPaid && result ? (
                <SynthesisContent moduleId={moduleId} result={result} />
              ) : (
                <LockedPlaceholder icon={icon} label={label} />
              )}
            </div>

            {/* Unlock overlay for free tier */}
            {!isPaid && <UnlockOverlay scanId={scanId} />}
          </div>
        );
      })}
    </>
  );
}

function SynthesisContent({ moduleId, result }: { moduleId: string; result: ModuleResult }) {
  const data = result.data as Record<string, unknown>;

  if (moduleId === 'M42') return <ExecutiveBriefContent data={data} />;
  if (moduleId === 'M44') return <ROIContent data={data} />;
  if (moduleId === 'M43') return <RoadmapContent data={data} />;
  if (moduleId === 'M45') return <CostCutterContent data={data} />;
  return null;
}

function ExecutiveBriefContent({ data }: { data: Record<string, unknown> }) {
  const summary = (data.executiveSummary as string) ?? '';
  const findings = (data.keyFindings as Array<{ finding: string; severity: string }>) ?? [];

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {summary && (
        <div>
          <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
            Executive Summary
          </h4>
          <p className="text-sm text-primary/80 leading-relaxed">{summary}</p>
        </div>
      )}
      {findings.length > 0 && (
        <div>
          <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide mb-2">
            Key Findings
          </h4>
          <div className="space-y-2">
            {findings.slice(0, 6).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <SeverityDot severity={f.severity} />
                <span className="text-primary/80">{f.finding}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ROIContent({ data }: { data: Record<string, unknown> }) {
  const areas = (data.costAreas as Array<{ area: string; current: number; optimized: number; savings: number }>) ?? [];
  const totalSavings = (data.totalAnnualSavings as number) ?? 0;

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {totalSavings > 0 && (
        <div className="text-center py-2">
          <p className="text-xs font-heading font-700 text-muted uppercase tracking-wide">
            Estimated Annual Savings
          </p>
          <p className="text-3xl font-mono font-800 text-success mt-1">
            ${totalSavings.toLocaleString()}
          </p>
        </div>
      )}
      {areas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {areas.map((a, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-heading font-600 text-primary">{a.area}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xs text-muted">Current: ${a.current?.toLocaleString()}</span>
                <span className="text-xs text-success font-medium">
                  Save ${a.savings?.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoadmapContent({ data }: { data: Record<string, unknown> }) {
  const workstreams = (data.workstreams as Array<{ name: string; priority: string; effort: string; items: string[] }>) ?? [];

  return (
    <div className="space-y-3 h-full overflow-y-auto">
      <h4 className="text-xs font-heading font-700 text-muted uppercase tracking-wide">
        Prioritized Workstreams
      </h4>
      {workstreams.slice(0, 5).map((ws, i) => (
        <div key={i} className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-heading font-600 text-primary">{ws.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted bg-white px-1.5 py-0.5 rounded">
                {ws.priority}
              </span>
              <span className="text-[10px] font-mono text-muted bg-white px-1.5 py-0.5 rounded">
                {ws.effort}
              </span>
            </div>
          </div>
          {ws.items && (
            <ul className="space-y-0.5 mt-1">
              {ws.items.slice(0, 3).map((item, j) => (
                <li key={j} className="text-[11px] text-muted">
                  • {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function CostCutterContent({ data }: { data: Record<string, unknown> }) {
  const redundancies = (data.redundancies as Array<{ tool: string; alternative: string; annualCost: number }>) ?? [];
  const totalWaste = (data.totalAnnualWaste as number) ?? 0;

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {totalWaste > 0 && (
        <div className="text-center py-2">
          <p className="text-xs font-heading font-700 text-muted uppercase tracking-wide">
            Tool Redundancy Waste
          </p>
          <p className="text-3xl font-mono font-800 text-error mt-1">
            ${totalWaste.toLocaleString()}/yr
          </p>
        </div>
      )}
      {redundancies.length > 0 && (
        <div className="space-y-2">
          {redundancies.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
              <div>
                <span className="text-xs font-heading font-600 text-primary">{r.tool}</span>
                {r.alternative && (
                  <span className="text-[11px] text-muted ml-2">→ {r.alternative}</span>
                )}
              </div>
              <span className="text-xs font-mono font-600 text-error">
                ${r.annualCost?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LockedPlaceholder({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-40">
      <span className="text-5xl">{icon}</span>
      <p className="text-sm font-heading font-600 text-primary">{label}</p>
      <p className="text-xs text-muted">Available in the paid report</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === 'critical' ? 'bg-error' :
    severity === 'warning' ? 'bg-warning' :
    severity === 'positive' ? 'bg-success' : 'bg-muted';
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${color}`} />;
}
