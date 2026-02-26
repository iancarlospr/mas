'use client';

/* =================================================================
   Chloe's Bedroom OS — Bedroom Wallpaper

   Multi-layer CSS/SVG illustrated bedroom background.
   - Radial gradient warmth (ambient light feel)
   - Fairy/string lights with randomized glow intensities
   - Furniture silhouettes: bed, window, poster, lamp, rug edge
   - Subtle stars/particles
   Everything VERY subtle — atmospheric, not focal.
   ================================================================= */

export function BedroomWallpaper() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Layer 1: Ambient warmth — multiple overlapping radial gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 45% 35%, oklch(0.17 0.04 340) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 80% 65%, oklch(0.14 0.03 340) 0%, transparent 55%),
            radial-gradient(ellipse 30% 40% at 15% 80%, oklch(0.13 0.025 340) 0%, transparent 50%),
            var(--gs-void)
          `,
        }}
      />

      {/* Layer 2: Fairy / string lights with varied glow */}
      <svg className="absolute top-0 left-0 w-full h-[140px]" viewBox="0 0 1400 130" preserveAspectRatio="none">
        <defs>
          <filter id="fairy-glow-sm"><feGaussianBlur stdDeviation="3" /></filter>
          <filter id="fairy-glow-md"><feGaussianBlur stdDeviation="6" /></filter>
          <filter id="fairy-glow-lg"><feGaussianBlur stdDeviation="10" /></filter>
        </defs>
        {/* String wire — catenary curve */}
        <path
          d="M-10 20 Q100 50 220 28 Q340 8 480 38 Q600 58 740 25 Q880 -5 1020 32 Q1140 55 1280 22 Q1350 10 1410 30"
          fill="none"
          stroke="oklch(0.30 0.04 340)"
          strokeWidth="0.6"
          opacity="0.25"
        />
        {/* Lights — varied sizes, opacities, warmth */}
        {[
          { x: 60,   y: 32, r: 6,  op: 0.04, warm: false },
          { x: 160,  y: 38, r: 8,  op: 0.05, warm: true },
          { x: 280,  y: 22, r: 5,  op: 0.03, warm: false },
          { x: 380,  y: 30, r: 10, op: 0.06, warm: true },
          { x: 500,  y: 45, r: 7,  op: 0.04, warm: false },
          { x: 620,  y: 40, r: 9,  op: 0.05, warm: true },
          { x: 740,  y: 20, r: 6,  op: 0.035, warm: false },
          { x: 860,  y: 12, r: 11, op: 0.06, warm: true },
          { x: 980,  y: 35, r: 7,  op: 0.04, warm: false },
          { x: 1100, y: 42, r: 8,  op: 0.05, warm: true },
          { x: 1220, y: 25, r: 6,  op: 0.035, warm: false },
          { x: 1340, y: 18, r: 9,  op: 0.045, warm: true },
        ].map((light, i) => (
          <g key={i}>
            {/* Outer glow */}
            <circle
              cx={light.x} cy={light.y} r={light.r * 2.5}
              fill={light.warm ? 'oklch(0.88 0.14 340)' : 'oklch(0.85 0.10 340)'}
              opacity={light.op}
              filter={light.r > 8 ? 'url(#fairy-glow-lg)' : 'url(#fairy-glow-md)'}
            />
            {/* Inner dot */}
            <circle
              cx={light.x} cy={light.y} r={1.2}
              fill={light.warm ? 'oklch(0.92 0.15 340)' : 'oklch(0.88 0.12 340)'}
              opacity={light.op * 4}
            />
          </g>
        ))}
      </svg>

      {/* Layer 3: Window with moonlight (upper-right) */}
      <svg className="absolute top-[6%] right-[10%] w-[130px] h-[170px]" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet">
        {/* Window frame */}
        <rect x="8" y="8" width="84" height="114" rx="2" fill="none" stroke="oklch(0.20 0.04 340)" strokeWidth="2" opacity="0.12" />
        {/* Cross panes */}
        <line x1="50" y1="8" x2="50" y2="122" stroke="oklch(0.20 0.04 340)" strokeWidth="1.5" opacity="0.10" />
        <line x1="8" y1="65" x2="92" y2="65" stroke="oklch(0.20 0.04 340)" strokeWidth="1.5" opacity="0.10" />
        {/* Moonlight spill — soft glow through window */}
        <circle cx="50" cy="45" r="30" fill="oklch(0.88 0.06 340)" opacity="0.015" />
        <circle cx="50" cy="45" r="18" fill="oklch(0.90 0.08 340)" opacity="0.02" />
        {/* Curtain hints */}
        <path d="M8 8c3 20 -2 50 5 80" stroke="oklch(0.22 0.04 340)" strokeWidth="1" opacity="0.06" fill="none" />
        <path d="M92 8c-3 20 2 50 -5 80" stroke="oklch(0.22 0.04 340)" strokeWidth="1" opacity="0.06" fill="none" />
      </svg>

      {/* Layer 4: Bed silhouette (bottom-right) */}
      <svg className="absolute bottom-0 right-0 w-[55%] h-[40%]" viewBox="0 0 600 350" preserveAspectRatio="xMaxYMax meet">
        {/* Bed frame */}
        <path
          d="M80 350 L80 270 Q80 250 100 250 L560 250 Q580 250 580 270 L580 350"
          fill="none"
          stroke="oklch(0.19 0.035 340)"
          strokeWidth="2"
          opacity="0.12"
        />
        {/* Headboard — ornate */}
        <path
          d="M530 250 L530 180 Q530 150 500 150 Q460 150 440 170 Q420 150 380 150 Q360 150 340 170 Q320 150 280 150 Q260 150 240 170 Q220 150 180 150 Q150 150 140 180 L140 250"
          fill="none"
          stroke="oklch(0.19 0.035 340)"
          strokeWidth="1.5"
          opacity="0.10"
        />
        {/* Pillows */}
        <ellipse cx="200" cy="240" rx="50" ry="14" fill="none" stroke="oklch(0.21 0.04 340)" strokeWidth="1" opacity="0.08" />
        <ellipse cx="360" cy="238" rx="55" ry="15" fill="none" stroke="oklch(0.21 0.04 340)" strokeWidth="1" opacity="0.07" />
        {/* Blanket fold line */}
        <path d="M100 280 Q200 260 350 275 Q500 290 560 270" fill="none" stroke="oklch(0.20 0.035 340)" strokeWidth="1" opacity="0.06" />
      </svg>

      {/* Layer 5: Wall poster (upper-left) */}
      <svg className="absolute top-[12%] left-[6%] w-[90px] h-[110px]" viewBox="0 0 80 100" preserveAspectRatio="xMidYMid meet">
        <rect x="5" y="8" width="70" height="87" rx="1" fill="none" stroke="oklch(0.19 0.035 340)" strokeWidth="1.5" opacity="0.08" />
        {/* Pin */}
        <circle cx="40" cy="7" r="2.5" fill="oklch(0.25 0.05 340)" opacity="0.10" />
        {/* Abstract art suggestion */}
        <circle cx="40" cy="50" r="15" fill="none" stroke="oklch(0.22 0.04 340)" strokeWidth="0.75" opacity="0.05" />
        <path d="M25 65h30" stroke="oklch(0.22 0.04 340)" strokeWidth="0.75" opacity="0.04" />
      </svg>

      {/* Layer 6: Bedside lamp (left of bed) */}
      <svg className="absolute bottom-[25%] left-[30%] w-[50px] h-[80px]" viewBox="0 0 40 70" preserveAspectRatio="xMidYMax meet">
        {/* Lampshade */}
        <path d="M10 10 L5 35 h30 L30 10 z" fill="none" stroke="oklch(0.20 0.035 340)" strokeWidth="1" opacity="0.07" />
        {/* Stand */}
        <line x1="20" y1="35" x2="20" y2="60" stroke="oklch(0.20 0.035 340)" strokeWidth="1.5" opacity="0.06" />
        {/* Base */}
        <ellipse cx="20" cy="62" rx="8" ry="2" fill="none" stroke="oklch(0.20 0.035 340)" strokeWidth="1" opacity="0.06" />
        {/* Light glow */}
        <circle cx="20" cy="25" r="12" fill="oklch(0.85 0.10 340)" opacity="0.012" />
      </svg>

      {/* Layer 7: Rug edge (bottom, spanning width) */}
      <div
        className="absolute bottom-0 left-[15%] right-[15%] h-[3px]"
        style={{
          background: 'linear-gradient(90deg, transparent, oklch(0.22 0.04 340 / 0.08) 20%, oklch(0.22 0.04 340 / 0.10) 50%, oklch(0.22 0.04 340 / 0.08) 80%, transparent)',
          borderRadius: '50%',
        }}
      />

      {/* Layer 8: Ambient dust particles — very sparse */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
        {[
          { x: 150, y: 120, r: 0.8, op: 0.04 },
          { x: 450, y: 200, r: 0.6, op: 0.03 },
          { x: 700, y: 80,  r: 0.9, op: 0.035 },
          { x: 300, y: 400, r: 0.7, op: 0.025 },
          { x: 850, y: 350, r: 0.5, op: 0.03 },
          { x: 550, y: 500, r: 0.6, op: 0.02 },
        ].map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="oklch(0.85 0.08 340)" opacity={p.op} />
        ))}
      </svg>
    </div>
  );
}
