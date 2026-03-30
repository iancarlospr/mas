'use client';

import { useState, useEffect, useRef } from 'react';
import { ChloeSprite } from './chloe-sprite';
import { LaserBeams } from './laser-beams';

/**
 * Mobile Chloé with one-shot laser eyes.
 *
 * 3 seconds after mount → fires rainbow laser at the URL input field,
 * sweeps across it, then stops. No roaming, no repeat.
 */

interface MobileChloeLaserProps {
  size?: 32 | 64 | 128 | 256;
}

export function MobileChloeLaser({ size = 64 }: MobileChloeLaserProps) {
  const ghostRef = useRef<HTMLDivElement>(null);
  const zapTargetRef = useRef<{ x: number; y: number } | null>(null);
  const [laserTarget, setLaserTarget] = useState<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const [animFrame, setAnimFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setAnimFrame(f => (f + 1) % 8), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (firedRef.current) return;

    const timer = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;

      const inputEl = document.querySelector('.mobile-scan-input-stack input[type="text"]');
      if (!inputEl) return;

      const rect = inputEl.getBoundingClientRect();
      const startX = rect.left;
      const startY = rect.top + rect.height / 2;

      // Set initial target to trigger LaserBeams rendering
      setLaserTarget({ x: rect.left + rect.width / 2, y: startY });

      // After 500ms hold, start sweep animation (same pattern as desktop)
      setTimeout(() => {
        const sweepDuration = 1200;
        const sweepStart = Date.now();
        const sweepWidth = rect.width * 0.9;

        const animate = () => {
          const elapsed = Date.now() - sweepStart;
          const t = Math.min(elapsed / sweepDuration, 1);

          if (t < 0.7) {
            // Phase 1: horizontal sweep across input
            const p = t / 0.7;
            const eased = p * (2 - p);
            zapTargetRef.current = { x: startX + eased * sweepWidth, y: startY };
          } else if (t < 1) {
            // Phase 2: curve upward and away
            const p = (t - 0.7) / 0.3;
            const eased = p * p;
            zapTargetRef.current = {
              x: startX + sweepWidth + eased * 30,
              y: startY - eased * 50,
            };
          } else {
            // Done — clear everything
            zapTargetRef.current = null;
            setLaserTarget(null);
            return;
          }
          requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
      }, 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={ghostRef} className="flex-shrink-0 mt-[4px]">
      <ChloeSprite
        state={laserTarget ? 'scanning' : 'idle'}
        size={size}
        frame={laserTarget ? 0 : animFrame}
      />
      {laserTarget && (
        <LaserBeams
          ghostRef={ghostRef}
          targetPos={laserTarget}
          zapTargetRef={zapTargetRef}
        />
      )}
    </div>
  );
}
