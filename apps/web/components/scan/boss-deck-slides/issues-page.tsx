/**
 * Boss Deck — Issues Page (Page 3)
 * Dark page with 3-column issue cards and urgency tags.
 */

import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import { urgencyColors } from './helpers';
import { BDFooter } from './footer';

export function IssuesPage({
  issues,
  pageNum,
  totalPages,
  userName,
}: {
  issues: BossDeckAIOutput['top_issues'];
  pageNum: number;
  totalPages: number;
  userName: string;
}) {
  return (
    <>
      <div className="page-inner">
        <div className="section-header-dark">
          <div className="section-number-dark">03</div>
          <div className="section-label-dark">CRITICAL FINDINGS</div>
        </div>

        <h2 className="title-dark">Three Things<br />Holding Us Back</h2>

        <div className="issues-grid">
          {issues.map((issue, i) => {
            const uc = urgencyColors(issue.urgency);
            return (
              <div className="issue-card" key={i}>
                <div className="issue-top">
                  <span className="issue-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="urgency-tag" style={{ background: uc.bg, color: uc.text }}>{uc.label}</span>
                </div>
                <h3 className="issue-headline">{issue.headline}</h3>
                <p className="issue-explanation">{issue.explanation}</p>
                <div className="issue-impact">
                  <div className="impact-icon">↗</div>
                  <div className="impact-text">{issue.dollar_impact}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BDFooter pageNum={pageNum} totalPages={totalPages} variant="dark" userName={userName} />
    </>
  );
}
