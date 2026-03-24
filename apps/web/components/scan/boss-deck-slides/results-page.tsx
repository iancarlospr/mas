/**
 * Boss Deck — Results Page (Page 5)
 * Dark page with projection table, outcome cards, plasma/glow layers.
 */

import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import { lightColor } from './helpers';
import { BDFooter } from './footer';
import { GrainCanvas } from './grain-canvas';

export function ResultsPage({
  headline,
  outcomes,
  projections,
  pageNum,
  totalPages,
  userName,
}: {
  headline: string;
  outcomes: BossDeckAIOutput['implementation_outcomes'];
  projections: BossDeckAIOutput['category_projections'];
  pageNum: number;
  totalPages: number;
  userName: string;
}) {
  return (
    <>
      <div className="results-plasma" />
      <div className="results-glow-1" />
      <div className="results-glow-2" />
      <div className="results-glow-3" />
      <GrainCanvas opacity={0.10} className="results-grain" />
      <div className="results-vignette" />
      <div className="results-gold-line" />

      <div className="page-inner results-inner">
        <div className="section-header-dark">
          <div className="section-number-dark">05</div>
          <div className="section-label-dark">PROJECTED IMPACT</div>
        </div>

        <h2 className="title-dark">{headline}</h2>

        {projections.length > 0 && (
          <div className="projection-table">
            <div className="proj-header">
              <span className="proj-h-cat">Category</span>
              <span className="proj-h-now">Current</span>
              <span className="proj-h-after">Projected</span>
              <span className="proj-h-note">What Changes</span>
            </div>
            {projections.map((p, i) => (
              <div className="proj-row" key={i}>
                <span className="proj-cat">{p.category}</span>
                <span className="proj-light">
                  <span className="proj-dot-ring" style={{ borderColor: `${lightColor(p.current_light)}30` }}>
                    <span className="proj-dot" style={{ background: lightColor(p.current_light), boxShadow: `0 0 10px ${lightColor(p.current_light)}50` }} />
                  </span>
                </span>
                <span className="proj-light">
                  <span className="proj-dot-ring" style={{ borderColor: `${lightColor(p.projected_light)}30` }}>
                    <span className="proj-dot" style={{ background: lightColor(p.projected_light), boxShadow: `0 0 10px ${lightColor(p.projected_light)}50` }} />
                  </span>
                </span>
                <span className="proj-note">{p.explanation}</span>
              </div>
            ))}
          </div>
        )}

        {outcomes.length > 0 && (
          <div className="outcomes-grid">
            {outcomes.map((o, i) => (
              <div className="outcome-card" key={i}>
                <div className="outcome-accent" />
                <div className="outcome-body">
                  <div className="outcome-text">{o.outcome}</div>
                  <div className="outcome-evidence">{o.evidence}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BDFooter pageNum={pageNum} totalPages={totalPages} variant="image" userName={userName} />
    </>
  );
}
