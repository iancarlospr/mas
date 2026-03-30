/**
 * Boss Deck — Roadmap Page (Page 4)
 * Light page with initiative cards, timeline track, and actions band.
 */

import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import { ownerColor } from './helpers';
import { BDFooter } from './footer';
import { GrainCanvas } from './grain-canvas';

const PHASE_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#64748B'];

export function RoadmapPage({
  initiatives,
  timelineSummary,
  timelineItems,
  nextSteps,
  pageNum,
  totalPages,
  userName,
}: {
  initiatives: BossDeckAIOutput['initiatives'];
  timelineSummary: string;
  timelineItems: BossDeckAIOutput['timeline_items'];
  nextSteps: string[];
  pageNum: number;
  totalPages: number;
  userName: string;
}) {
  return (
    <>
      <div className="page-inner">
        <div className="section-header-light">
          <div className="section-number">04</div>
          <div className="section-label">ACTION PLAN</div>
        </div>

        <h2 className="title-light">The Roadmap</h2>
        {timelineSummary && <p className="roadmap-summary">{timelineSummary}</p>}

        <div className="initiatives-grid">
          {initiatives.map((init, i) => {
            const oc = ownerColor(init.owner);
            return (
              <div className="initiative-card" key={i}>
                <div className="init-accent" style={{ background: oc }} />
                <div className="init-content">
                  <span className="init-owner" style={{ color: oc }}>{init.owner}</span>
                  <h4 className="init-name">{init.name}</h4>
                  <ul className="init-items">
                    {init.items.map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                  <div className="init-meta">
                    <span className="init-outcome">{init.expected_outcome}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {timelineItems.length > 0 && (
          <div className="timeline-section">
            <div className="timeline-track">
              {timelineItems.map((phase, i) => (
                <div className="timeline-phase" style={{ flex: 1 }} key={i}>
                  <div className="tl-dot" style={{ background: PHASE_COLORS[i] ?? '#64748B' }} />
                  <div className="tl-label" style={{ color: PHASE_COLORS[i] ?? '#64748B' }}>{phase.phase}</div>
                  {phase.items.slice(0, 3).map((item, j) => <div className="tl-item" key={j}>{item}</div>)}
                </div>
              ))}
            </div>
            <div className="timeline-line" />
          </div>
        )}
      </div>

      {nextSteps.length > 0 && (
        <div className="actions-band">
          <GrainCanvas opacity={0.08} />
          <div className="actions-inner">
            <div className="actions-left">
              <div className="actions-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
                </svg>
              </div>
              <div className="actions-title-block">
                <div className="actions-label">READY TO APPROVE</div>
                <div className="actions-subtitle">Three things to greenlight today</div>
              </div>
            </div>
            <div className="actions-list">
              {nextSteps.slice(0, 3).map((s, i) => (
                <div className="action-item" key={i}>
                  <div className="action-num">{i + 1}</div>
                  <div className="action-text">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <BDFooter pageNum={pageNum} totalPages={totalPages} variant="light" userName={userName} />
    </>
  );
}
