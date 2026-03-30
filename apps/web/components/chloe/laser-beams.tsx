'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Rainbow tapered laser beams from Chloé's eyes to a target position.
 *
 * Renders a fullscreen canvas portaled to document.body at z-9999.
 * Tracks the ghost sprite canvas position in real-time via getBoundingClientRect
 * to capture CSS float animation.
 *
 * Used by both ChloeScreenmate (desktop) and MobileChloeLaser (mobile).
 */
export function LaserBeams({ ghostRef, targetPos, zapTargetRef }: {
  ghostRef: React.RefObject<HTMLDivElement | null>;
  targetPos: { x: number; y: number } | null;
  zapTargetRef: React.RefObject<{ x: number; y: number } | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const hueRef = useRef(0);
  const targetRef = useRef(targetPos);
  targetRef.current = targetPos;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const target = zapTargetRef.current ?? targetRef.current;
      if (!target || !ghostRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Get the actual canvas inside the sprite — it moves with the float animation
      const spriteCanvas = ghostRef.current.querySelector('canvas');
      if (!spriteCanvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const ghostRect = spriteCanvas.getBoundingClientRect();
      const eyeLX = ghostRect.left + (18 / 64) * ghostRect.width;
      const eyeRX = ghostRect.left + (42 / 64) * ghostRect.width;
      const eyeY = ghostRect.top + (26 / 84) * ghostRect.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hueRef.current = (hueRef.current + 2) % 360;
      const orbPulse = 1 + Math.sin(hueRef.current * 0.1) * 0.25;

      // Draw tapered beams FIRST (behind eyes) — wide at eye, narrow at target
      for (const eyeX of [eyeLX, eyeRX]) {
        const dx = target.x - eyeX;
        const dy = target.y - eyeY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;

        // Perpendicular direction for beam width
        const px = -dy / len;
        const py = dx / len;

        // Pulsing girth
        const pulse = 1 + Math.sin(hueRef.current * 0.08) * 0.3;
        const widthAtEye = 7 * pulse;
        const widthAtTarget = 1.5;

        // Rainbow gradient — flows FROM the ghost (reversed)
        const gradient = ctx.createLinearGradient(eyeX, eyeY, target.x, target.y);
        for (let i = 0; i <= 6; i++) {
          gradient.addColorStop(i / 6, `hsl(${(hueRef.current - i * 50 + 360) % 360}, 100%, 65%)`);
        }

        // Outer glow (wider taper)
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(eyeX + px * (widthAtEye + 3), eyeY + py * (widthAtEye + 3));
        ctx.lineTo(eyeX - px * (widthAtEye + 3), eyeY - py * (widthAtEye + 3));
        ctx.lineTo(target.x - px * (widthAtTarget + 2), target.y - py * (widthAtTarget + 2));
        ctx.lineTo(target.x + px * (widthAtTarget + 2), target.y + py * (widthAtTarget + 2));
        ctx.closePath();
        ctx.fill();

        // Core beam (tapered polygon)
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(eyeX + px * widthAtEye, eyeY + py * widthAtEye);
        ctx.lineTo(eyeX - px * widthAtEye, eyeY - py * widthAtEye);
        ctx.lineTo(target.x - px * widthAtTarget, target.y - py * widthAtTarget);
        ctx.lineTo(target.x + px * widthAtTarget, target.y + py * widthAtTarget);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1;
      }

      // Draw eye orbs ON TOP of beams
      for (const eyeX of [eyeLX, eyeRX]) {
        // Large outer halo
        const halo = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 16 * orbPulse);
        halo.addColorStop(0, `hsla(${hueRef.current}, 100%, 85%, 0.6)`);
        halo.addColorStop(0.3, `hsla(${(hueRef.current + 60) % 360}, 100%, 70%, 0.3)`);
        halo.addColorStop(0.6, `hsla(${(hueRef.current + 120) % 360}, 100%, 60%, 0.1)`);
        halo.addColorStop(1, 'transparent');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 16 * orbPulse, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        const core = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 6 * orbPulse);
        core.addColorStop(0, `hsla(${hueRef.current}, 100%, 95%, 1)`);
        core.addColorStop(0.5, `hsla(${hueRef.current}, 100%, 80%, 0.9)`);
        core.addColorStop(1, `hsla(${(hueRef.current + 40) % 360}, 100%, 65%, 0.4)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 6 * orbPulse, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostRef]);

  return createPortal(
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
    />,
    document.body,
  );
}
