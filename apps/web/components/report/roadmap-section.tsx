'use client';

import { useEffect, useState } from 'react';
import type { RoadmapData, Priority, Effort } from '@marketing-alpha/types';
import { SectionHeader } from './section-header';
import { cn } from '@/lib/utils';

/** Remediation Roadmap — PRD-cont-4 Section 7. */
interface RoadmapSectionProps {
  data: RoadmapData;
  sectionNumber: number;
  isPrintMode: boolean;
  onChartReady: () => void;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: '#EF476F',
  P1: '#FFD166',
  P2: '#0F3460',
  P3: '#94A3B8',
};

const EFFORT_NUMERIC: Record<Effort, number> = { S: 1, M: 2, L: 3, XL: 4 };

export function RoadmapSection({ data, sectionNumber, isPrintMode, onChartReady }: RoadmapSectionProps) {
  useEffect(() => { onChartReady(); }, [onChartReady]);

  return (
    <section className="report-section py-12 print:py-6 print:break-before-page">
      <SectionHeader number={sectionNumber} title="Remediation Roadmap" />

      {/* Impact × Effort Quadrant */}
      <div className="mb-8 bg-surface border border-border rounded-xl p-6 print:border-0 print:p-4">
        <h3 className="font-heading text-sm font-700 text-[#64748B] uppercase tracking-wider mb-4">
          Impact × Effort Quadrant
        </h3>
        <QuadrantChart workstreams={data.workstreams} />
      </div>

      {/* Gantt Timeline */}
      <div className="mb-8 bg-surface border border-border rounded-xl p-6 print:border-0 print:p-4">
        <h3 className="font-heading text-sm font-700 text-[#64748B] uppercase tracking-wider mb-4">
          Implementation Timeline
        </h3>
        <GanttTimeline workstreams={data.workstreams} />
      </div>

      {/* Quick Wins Box */}
      {data.quickWins.length > 0 && (
        <div
          className="rounded-xl p-6 mb-8"
          style={{ background: '#F0FFF4', borderLeft: '4px solid #06D6A0' }}
        >
          <h3
            className="font-heading font-700 mb-3"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', color: '#06D6A0' }}
          >
            Quick Wins — Start This Week
          </h3>
          <ol className="space-y-2">
            {data.quickWins.map((qw, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="font-mono text-xs text-[#94A3B8] mt-0.5">{i + 1}.</span>
                <div>
                  <span className="text-[#1A1A2E] font-medium">{qw.task}</span>
                  <span className="text-xs text-[#64748B] ml-2">— {qw.workstream}</span>
                  {qw.impact && (
                    <span className="text-xs text-[#06D6A0] ml-2">{qw.impact}</span>
                  )}
                  <span className="inline-block ml-2 text-[10px] px-1.5 py-0.5 bg-[#06D6A0]/10 text-[#06D6A0] rounded font-medium">
                    S effort
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Workstream Cards */}
      <div className="space-y-4">
        {data.workstreams.map(ws => (
          <WorkstreamCard key={ws.id} workstream={ws} isPrintMode={isPrintMode} />
        ))}
      </div>
    </section>
  );
}

/** SVG Quadrant Chart — PRD-cont-4 Section 7.3 */
function QuadrantChart({ workstreams }: { workstreams: RoadmapData['workstreams'] }) {
  const W = 500;
  const H = 300;
  const PAD = 40;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px] mx-auto" role="img" aria-label="Impact versus effort quadrant chart">
      {/* Axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#E2E8F0" strokeWidth="1" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#E2E8F0" strokeWidth="1" />

      {/* Quadrant dividers */}
      <line x1={(W) / 2} y1={PAD} x2={(W) / 2} y2={H - PAD} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 2" />
      <line x1={PAD} y1={(H) / 2} x2={W - PAD} y2={(H) / 2} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 2" />

      {/* Quadrant labels */}
      <text x={PAD + 20} y={PAD + 20} fontSize="10" fill="#06D6A0" fontWeight="600">QUICK WINS</text>
      <text x={W / 2 + 20} y={PAD + 20} fontSize="10" fill="#FFD166" fontWeight="600">MAJOR PROJECTS</text>
      <text x={PAD + 20} y={H - PAD - 10} fontSize="10" fill="#0F3460" fontWeight="600">FILL-INS</text>
      <text x={W / 2 + 20} y={H - PAD - 10} fontSize="10" fill="#94A3B8" fontWeight="600">THANKLESS TASKS</text>

      {/* Axis labels */}
      <text x={W / 2} y={H - 5} textAnchor="middle" fontSize="9" fill="#94A3B8">EFFORT →</text>
      <text x={8} y={H / 2} textAnchor="middle" fontSize="9" fill="#94A3B8" transform={`rotate(-90 8 ${H / 2})`}>IMPACT →</text>

      {/* Workstream dots */}
      {workstreams.map((ws, i) => {
        const avgEffort = ws.tasks.length > 0
          ? ws.tasks.reduce((sum, t) => sum + EFFORT_NUMERIC[t.effort], 0) / ws.tasks.length
          : 2;
        const priorityImpact: Record<Priority, number> = { P0: 4, P1: 3, P2: 2, P3: 1 };
        const impact = priorityImpact[ws.priority] ?? 2;

        const xScale = (W - 2 * PAD) / 4;
        const yScale = (H - 2 * PAD) / 4;
        const cx = PAD + avgEffort * xScale;
        const cy = H - PAD - impact * yScale;

        const dotSizes: Record<Priority, number> = { P0: 12, P1: 10, P2: 8, P3: 6 };

        return (
          <g key={ws.id}>
            <circle
              cx={cx}
              cy={cy}
              r={dotSizes[ws.priority]}
              fill={PRIORITY_COLORS[ws.priority]}
              opacity={0.9}
            />
            <text
              x={cx}
              y={cy + dotSizes[ws.priority] + 12}
              textAnchor="middle"
              fontSize="8"
              fill="#64748B"
            >
              {ws.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** SVG Gantt Timeline — PRD-cont-4 Section 7.4 */
function GanttTimeline({ workstreams }: { workstreams: RoadmapData['workstreams'] }) {
  const COL_LABELS = ['Week 1', 'Week 2', 'Wk 3-4', 'Month 2', 'Month 3+'];
  const COL_COUNT = COL_LABELS.length;
  const W = 600;
  const ROW_H = 32;
  const GAP = 8;
  const HEADER_H = 30;
  const LEFT_PAD = 70;
  const colW = (W - LEFT_PAD) / COL_COUNT;
  const H = HEADER_H + (ROW_H + GAP) * workstreams.length + GAP;

  // Simple heuristic: P0 starts week 1, P1 week 2, P2 weeks 3-4, P3 month 2+
  const startCol: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const durationCols: Record<Priority, number> = { P0: 2, P1: 2, P2: 2, P3: 2 };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[700px] mx-auto" role="img" aria-label="Implementation timeline gantt chart">
      {/* Column headers */}
      {COL_LABELS.map((label, i) => (
        <text key={i} x={LEFT_PAD + i * colW + colW / 2} y={18} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="500">
          {label}
        </text>
      ))}
      <line x1={LEFT_PAD} y1={HEADER_H} x2={W} y2={HEADER_H} stroke="#E2E8F0" strokeWidth="1" />

      {/* Workstream bars */}
      {workstreams.map((ws, i) => {
        const y = HEADER_H + GAP + i * (ROW_H + GAP);
        const start = startCol[ws.priority] ?? 0;
        const dur = durationCols[ws.priority] ?? 2;
        const barX = LEFT_PAD + start * colW + 4;
        const barW = dur * colW - 8;

        return (
          <g key={ws.id}>
            <text x={LEFT_PAD - 8} y={y + ROW_H / 2 + 3} textAnchor="end" fontSize="9" fill="#64748B" fontWeight="500">
              {ws.id}
            </text>
            <rect
              x={barX}
              y={y + 4}
              width={barW}
              height={ROW_H - 8}
              rx={4}
              fill={PRIORITY_COLORS[ws.priority]}
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Expandable workstream card — PRD-cont-4 Section 7.6 */
function WorkstreamCard({ workstream: ws, isPrintMode }: {
  workstream: RoadmapData['workstreams'][number];
  isPrintMode: boolean;
}) {
  const [expanded, setExpanded] = useState(isPrintMode);

  return (
    <div
      className="bg-surface border border-border rounded-xl overflow-hidden"
      style={{ breakInside: 'avoid' }}
    >
      {/* Header */}
      <button
        onClick={() => !isPrintMode && setExpanded(!expanded)}
        className={cn(
          'w-full text-left px-6 py-4 flex items-center gap-3 flex-wrap',
          !isPrintMode && 'hover:bg-[#F8FAFC] transition-colors',
        )}
        data-interactive
      >
        <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-bold text-white bg-[#1A1A2E]">
          {ws.id}
        </span>
        <span className="font-heading font-700 text-sm text-[#1A1A2E]">{ws.name}</span>
        <span
          className="inline-flex px-2 py-0.5 rounded text-xs font-bold text-white"
          style={{ background: PRIORITY_COLORS[ws.priority] }}
        >
          {ws.priority}
        </span>
        {ws.totalEffort && (
          <span className="text-xs text-[#94A3B8]">{ws.totalEffort}</span>
        )}
        <span className="text-xs text-[#94A3B8]">{ws.tasks.length} tasks</span>
        {!isPrintMode && (
          <span className="ml-auto text-xs text-[#94A3B8] expand-button">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-6 pb-4" data-expandable>
          {ws.ownerRole && (
            <p className="text-xs text-[#64748B] mb-1">Owner: {ws.ownerRole}</p>
          )}
          {ws.businessImpact && (
            <p className="text-xs text-[#06D6A0] mb-3">Impact: {ws.businessImpact}</p>
          )}
          <div className="space-y-2">
            {ws.tasks.map(task => (
              <div key={task.id} className="flex items-start gap-2 ml-2">
                <span className="inline-flex w-4 h-4 border border-[#E2E8F0] rounded flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[#94A3B8]">{task.id}</span>
                    <span className="text-xs text-[#1A1A2E]">{task.task}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: task.effort === 'S' ? '#06D6A020' : task.effort === 'M' ? '#FFD16620' : '#EF476F20',
                        color: task.effort === 'S' ? '#06D6A0' : task.effort === 'M' ? '#FFD166' : '#EF476F',
                      }}
                    >
                      {task.effort}
                    </span>
                  </div>
                  {task.successCriteria && (
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">Success: {task.successCriteria}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
