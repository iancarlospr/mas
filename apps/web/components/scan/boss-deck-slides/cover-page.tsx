/**
 * Boss Deck — Cover Page (Page 1)
 * Full-bleed hero image with gradient overlay, business name, subtitle.
 */

import type { BossDeckRenderContext } from '@/lib/report/boss-deck-html';
import { formatDate } from './helpers';
import { GrainCanvas } from './grain-canvas';

export function CoverPage({
  ctx,
  subtitle,
}: {
  ctx: BossDeckRenderContext;
  subtitle: string;
}) {
  const dateFmt = formatDate(ctx.scanDate);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cover-bg" src={ctx.coverImageDataUri ?? '/boss-deck/hero-cover.jpg'} alt="" />
      <div className="cover-gradient" />
      <div className="cover-accent-line" />

      <div className="cover-content">
        <div className="cover-left">
          <div className="cover-type-label">MARKETING AUDIT BRIEFING</div>
          <h1 className="cover-business-name">{ctx.businessName || ctx.domain}</h1>
          <div className="cover-divider" />
          <p className="cover-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="cover-bottom-bar">
        <GrainCanvas opacity={0.08} />
        <span>Prepared by {ctx.userEmail}</span>
        <span>{dateFmt}</span>
        <span className="cover-powered">Powered by AlphaScan</span>
      </div>
    </>
  );
}
