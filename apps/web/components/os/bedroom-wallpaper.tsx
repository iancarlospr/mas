'use client';

/* =================================================================
   Chloe's Bedroom OS — Bedroom Wallpaper

   A stylized bedroom scene in forced perspective.
   The desktop IS the room — floor, walls, ceiling visible.
   Pink monochrome palette with depth through value contrast.
   Objects (icons) sit in this space contextually.

   Layers:
   1. Back wall (lighter deep pink)
   2. Floor plane (darker, perspective gradient)
   3. Ceiling (subtle)
   4. Wall details: window with moonlight, posters, string lights
   5. Furniture silhouettes that frame the space
   ================================================================= */

export function BedroomWallpaper() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Layer 1: Room structure — wall + floor split */}
      <div className="absolute inset-0" style={{
        background: `
          linear-gradient(
            180deg,
            oklch(0.16 0.04 340) 0%,
            oklch(0.18 0.045 340) 45%,
            oklch(0.14 0.035 340) 45.5%,
            oklch(0.11 0.03 340) 100%
          )
        `,
      }} />

      {/* Layer 2: Wall texture — subtle vertical stripes (wallpaper) */}
      <div className="absolute inset-0" style={{
        backgroundImage: `repeating-linear-gradient(
          90deg,
          oklch(0.19 0.045 340) 0px,
          oklch(0.19 0.045 340) 1px,
          transparent 1px,
          transparent 40px
        )`,
        opacity: 0.08,
        height: '45%',
      }} />

      {/* Layer 3: Floor — wood plank lines */}
      <div className="absolute left-0 right-0 bottom-0" style={{
        top: '45%',
        backgroundImage: `repeating-linear-gradient(
          90deg,
          oklch(0.13 0.03 340) 0px,
          oklch(0.13 0.03 340) 1px,
          transparent 1px,
          transparent 80px
        )`,
        opacity: 0.12,
      }} />

      {/* Layer 4: Baseboard line where wall meets floor */}
      <div className="absolute left-0 right-0 h-[2px]" style={{
        top: '45%',
        background: 'oklch(0.22 0.05 340)',
        opacity: 0.3,
      }} />

      {/* Layer 5: Window with moonlight (upper right) */}
      <svg className="absolute" style={{ top: '5%', right: '15%', width: '120px', height: '160px' }} viewBox="0 0 120 160">
        {/* Window frame */}
        <rect x="5" y="5" width="110" height="150" rx="2" fill="none" stroke="oklch(0.25 0.05 340)" strokeWidth="3" opacity="0.25" />
        {/* Cross panes */}
        <line x1="60" y1="5" x2="60" y2="155" stroke="oklch(0.25 0.05 340)" strokeWidth="2" opacity="0.20" />
        <line x1="5" y1="80" x2="115" y2="80" stroke="oklch(0.25 0.05 340)" strokeWidth="2" opacity="0.20" />
        {/* Night sky through window — slightly lighter */}
        <rect x="8" y="8" width="49" height="69" rx="1" fill="oklch(0.14 0.03 340)" opacity="0.5" />
        <rect x="63" y="8" width="49" height="69" rx="1" fill="oklch(0.14 0.03 340)" opacity="0.5" />
        <rect x="8" y="83" width="49" height="69" rx="1" fill="oklch(0.14 0.03 340)" opacity="0.4" />
        <rect x="63" y="83" width="49" height="69" rx="1" fill="oklch(0.14 0.03 340)" opacity="0.4" />
        {/* Moon visible through upper-right pane */}
        <circle cx="85" cy="35" r="12" fill="oklch(0.85 0.06 340)" opacity="0.06" />
        <circle cx="85" cy="35" r="6" fill="oklch(0.90 0.08 340)" opacity="0.08" />
        {/* Stars through window */}
        <circle cx="25" cy="25" r="0.8" fill="oklch(0.80 0.06 340)" opacity="0.15" />
        <circle cx="40" cy="45" r="0.6" fill="oklch(0.80 0.06 340)" opacity="0.12" />
        <circle cx="75" cy="55" r="0.7" fill="oklch(0.80 0.06 340)" opacity="0.10" />
        {/* Moonlight spill on floor */}
        <defs>
          <linearGradient id="moonspill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.06 340)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(0.85 0.06 340)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
      </svg>

      {/* Moonlight spill on floor from window */}
      <div className="absolute" style={{
        top: '45%',
        right: '10%',
        width: '180px',
        height: '200px',
        background: 'linear-gradient(180deg, oklch(0.85 0.06 340 / 0.03) 0%, transparent 80%)',
        transform: 'perspective(400px) rotateX(60deg)',
        transformOrigin: 'top center',
      }} />

      {/* Layer 6: String lights along top of back wall */}
      <svg className="absolute top-[2%] left-0 w-full h-[60px]" viewBox="0 0 1400 50" preserveAspectRatio="none">
        {/* Wire */}
        <path
          d="M0 20 Q70 30 140 22 Q210 14 280 24 Q350 34 420 20 Q490 10 560 25 Q630 35 700 18 Q770 8 840 22 Q910 32 980 20 Q1050 12 1120 26 Q1190 36 1260 18 Q1330 10 1400 24"
          fill="none" stroke="oklch(0.25 0.04 340)" strokeWidth="0.8" opacity="0.20"
        />
        {/* Light bulbs */}
        {[70, 210, 350, 490, 630, 770, 910, 1050, 1190, 1330].map((x, i) => {
          const y = 20 + Math.sin(x * 0.007) * 10;
          const warmth = i % 2 === 0;
          return (
            <g key={i}>
              <line x1={x} y1={y} x2={x} y2={y + 4} stroke="oklch(0.25 0.04 340)" strokeWidth="0.5" opacity="0.15" />
              <circle cx={x} cy={y + 7} r="3" fill={warmth ? 'oklch(0.85 0.12 340)' : 'oklch(0.80 0.08 340)'} opacity={warmth ? 0.06 : 0.04} />
              <circle cx={x} cy={y + 7} r="1" fill={warmth ? 'oklch(0.92 0.15 340)' : 'oklch(0.88 0.10 340)'} opacity={warmth ? 0.10 : 0.07} />
            </g>
          );
        })}
      </svg>

      {/* Layer 7: Bed frame silhouette — bottom right, large */}
      <svg className="absolute" style={{ bottom: '0', right: '2%', width: '45%', height: '50%' }} viewBox="0 0 500 350" preserveAspectRatio="xMaxYMax meet">
        {/* Headboard */}
        <path d="M380 120 L380 50 Q380 20 350 20 L180 20 Q150 20 150 50 L150 120"
          fill="oklch(0.13 0.03 340)" stroke="oklch(0.20 0.04 340)" strokeWidth="2" opacity="0.18" />
        {/* Mattress */}
        <rect x="130" y="120" width="270" height="180" rx="8"
          fill="oklch(0.12 0.028 340)" stroke="oklch(0.20 0.04 340)" strokeWidth="1.5" opacity="0.15" />
        {/* Pillow */}
        <ellipse cx="200" cy="145" rx="45" ry="18"
          fill="oklch(0.15 0.035 340)" stroke="oklch(0.22 0.045 340)" strokeWidth="1" opacity="0.12" />
        <ellipse cx="310" cy="148" rx="40" ry="16"
          fill="oklch(0.15 0.035 340)" stroke="oklch(0.22 0.045 340)" strokeWidth="1" opacity="0.10" />
        {/* Blanket fold */}
        <path d="M140 200 Q200 180 270 195 Q340 210 390 190"
          fill="none" stroke="oklch(0.20 0.04 340)" strokeWidth="1" opacity="0.10" />
      </svg>

      {/* Layer 8: Nightstand — left of bed */}
      <svg className="absolute" style={{ bottom: '8%', right: '46%', width: '60px', height: '80px' }} viewBox="0 0 60 80">
        <rect x="5" y="10" width="50" height="65" rx="3"
          fill="oklch(0.14 0.03 340)" stroke="oklch(0.22 0.045 340)" strokeWidth="1.5" opacity="0.18" />
        <line x1="5" y1="40" x2="55" y2="40" stroke="oklch(0.22 0.045 340)" strokeWidth="1" opacity="0.12" />
        {/* Lamp on nightstand */}
        <path d="M22 10 L18 0 h24 L38 10" fill="oklch(0.16 0.035 340)" stroke="oklch(0.24 0.05 340)" strokeWidth="1" opacity="0.15" />
        <line x1="30" y1="0" x2="30" y2="-8" stroke="oklch(0.24 0.05 340)" strokeWidth="1" opacity="0.12" />
        {/* Lamp glow */}
        <circle cx="30" cy="-5" r="15" fill="oklch(0.85 0.10 340)" opacity="0.015" />
      </svg>

      {/* Layer 9: Rug on floor */}
      <ellipse
        className="absolute"
        style={{
          bottom: '5%',
          left: '25%',
          width: '35%',
          height: '18%',
          background: 'radial-gradient(ellipse, oklch(0.16 0.045 340 / 0.15) 0%, oklch(0.14 0.035 340 / 0.08) 60%, transparent 100%)',
          borderRadius: '50%',
          border: '1px solid oklch(0.20 0.04 340 / 0.08)',
        } as React.CSSProperties}
      />
      <div className="absolute" style={{
        bottom: '5%',
        left: '25%',
        width: '35%',
        height: '18%',
        background: 'radial-gradient(ellipse, oklch(0.16 0.045 340 / 0.12) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Layer 10: Poster on wall (upper left) */}
      <svg className="absolute" style={{ top: '8%', left: '5%', width: '80px', height: '100px' }} viewBox="0 0 80 100">
        <rect x="5" y="8" width="70" height="87" rx="1"
          fill="oklch(0.15 0.035 340)" stroke="oklch(0.22 0.045 340)" strokeWidth="1.5" opacity="0.15" />
        {/* Pin */}
        <circle cx="40" cy="6" r="2" fill="oklch(0.30 0.06 340)" opacity="0.20" />
        {/* Poster content — abstract */}
        <rect x="12" y="20" width="56" height="3" rx="1" fill="oklch(0.20 0.04 340)" opacity="0.08" />
        <rect x="12" y="30" width="40" height="2" rx="1" fill="oklch(0.20 0.04 340)" opacity="0.06" />
        <rect x="12" y="38" width="50" height="2" rx="1" fill="oklch(0.20 0.04 340)" opacity="0.06" />
      </svg>

      {/* Layer 11: Second poster on wall */}
      <svg className="absolute" style={{ top: '6%', left: '18%', width: '60px', height: '80px' }} viewBox="0 0 60 80">
        <rect x="5" y="5" width="50" height="70" rx="1"
          fill="oklch(0.15 0.035 340)" stroke="oklch(0.22 0.045 340)" strokeWidth="1" opacity="0.12" />
        <circle cx="30" cy="5" r="1.5" fill="oklch(0.30 0.06 340)" opacity="0.15" />
      </svg>

      {/* Layer 12: Shelf on wall (left side) */}
      <svg className="absolute" style={{ top: '25%', left: '3%', width: '100px', height: '12px' }} viewBox="0 0 100 12">
        <rect x="0" y="0" width="100" height="4" rx="1"
          fill="oklch(0.18 0.04 340)" stroke="oklch(0.22 0.045 340)" strokeWidth="1" opacity="0.15" />
        {/* Brackets */}
        <path d="M15 4 L15 12" stroke="oklch(0.22 0.045 340)" strokeWidth="1.5" opacity="0.12" />
        <path d="M85 4 L85 12" stroke="oklch(0.22 0.045 340)" strokeWidth="1.5" opacity="0.12" />
      </svg>

      {/* Layer 13: Ambient corner shadow — vignette feel */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, oklch(0.08 0.02 340 / 0.4) 100%)',
      }} />
    </div>
  );
}
