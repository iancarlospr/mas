/**
 * Boss Deck — Tools Page (Page 6)
 * Light page with tool comparison cards (current vs recommended).
 */

import type { BossDeckAIOutput } from '@/lib/report/boss-deck-prompt';
import { BDFooter } from './footer';

export function ToolsPage({
  pitches,
  pageNum,
  totalPages,
  userName,
}: {
  pitches: BossDeckAIOutput['tool_pitches'];
  pageNum: number;
  totalPages: number;
  userName: string;
}) {
  return (
    <>
      <div className="page-inner">
        <div className="section-header-light">
          <div className="section-number">06</div>
          <div className="section-label">TECHNOLOGY</div>
        </div>

        <h2 className="title-light">Technology Investment</h2>

        <div className="tools-grid">
          {pitches.map((p, i) => {
            const isReplace = p.what_it_replaces && p.what_it_replaces !== 'New addition';
            return (
              <div className="tool-card" key={i}>
                <div className="tool-left">
                  <div className="tool-label">{isReplace ? 'CURRENTLY USING' : 'CURRENT GAP'}</div>
                  <div className={`tool-current-name ${isReplace ? '' : 'tool-no-coverage'}`}>
                    {isReplace ? p.what_it_replaces : 'Nothing in place'}
                  </div>
                  {!isReplace && <div className="tool-gap-dot">●</div>}
                </div>
                <div className="tool-arrow">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14m0 0l-4-4m4 4l-4 4" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="tool-right">
                  <div className="tool-label">RECOMMENDED</div>
                  <div className="tool-rec-name">{p.tool_name}</div>
                  <div className="tool-pitch">{p.why_we_need_it}</div>
                </div>
                <div className="tool-gap-row">{p.capability_gap}</div>
              </div>
            );
          })}
        </div>
      </div>
      <BDFooter pageNum={pageNum} totalPages={totalPages} variant="light" userName={userName} />
    </>
  );
}
