/**
 * BDFooter — shared footer bar for Boss Deck pages.
 * Includes grain overlay (with per-page unique filter ID).
 */

import { GrainCanvas } from './grain-canvas';

export function BDFooter({
  pageNum,
  totalPages,
  variant,
  userName,
}: {
  pageNum: number;
  totalPages: number;
  variant: 'dark' | 'light' | 'image';
  userName?: string;
}) {
  const color = variant === 'light' ? '#94A3B8' : 'rgba(255,255,255,0.4)';
  const left = userName ? `Prepared by ${userName}` : 'Powered by AlphaScan';
  const cls = variant === 'light' ? 'slide-footer footer-light' : 'slide-footer footer-dark';

  return (
    <div className={cls} style={{ color }}>
      <GrainCanvas opacity={0.08} />
      <span style={{ flex: 1, textAlign: 'left', position: 'relative', zIndex: 1 }}>{left}</span>
      <span style={{ position: 'relative', zIndex: 1 }}>{pageNum} / {totalPages}</span>
    </div>
  );
}
