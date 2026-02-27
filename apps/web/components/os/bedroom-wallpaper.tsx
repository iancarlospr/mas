'use client';

/* =================================================================
   Desktop Wallpaper — Cinematic Ambient Lighting

   Void-black base (#080808) with subtle atmospheric light spills.
   Think: dark room with light leaking through blinds + screen glow.
   ================================================================= */

export function BedroomWallpaper() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gs-void" aria-hidden="true">
      {/* Cinematic top-down light — cool bluish wash from above */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 100% 50% at 50% -10%, oklch(0.22 0.04 260 / 0.25) 0%, transparent 70%)',
      }} />

      {/* Warm accent light — bottom-left, like a distant lamp */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 60% 50% at 10% 85%, oklch(0.25 0.08 340 / 0.12) 0%, transparent 70%)',
      }} />

      {/* Cool accent light — top-right, like moonlight through a window */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 50% 60% at 90% 15%, oklch(0.20 0.03 250 / 0.10) 0%, transparent 65%)',
      }} />

      {/* Center screen glow — very faint pink, like a monitor */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 40% 35% at 50% 45%, oklch(0.18 0.05 340 / 0.08) 0%, transparent 70%)',
      }} />

      {/* Vignette — heavy corners, cinematic framing */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 75% 65% at 50% 50%, transparent 30%, oklch(0.05 0 0 / 0.6) 100%)',
      }} />
    </div>
  );
}
