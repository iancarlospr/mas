'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — Matrix Rain Effect

   Procedural falling-characters animation inspired by The Matrix.
   Renders on a <canvas> element with full color support.

   Uses Chloé's brand colors:
   - Primary: gs-cyan (phosphorescent cyan)
   - Accent: gs-red (laser pink)
   - Classic: gs-terminal (green, for authenticity)

   Performance: requestAnimationFrame, ~60fps on modern hardware.
   Respects prefers-reduced-motion (shows static frame).
   ═══════════════════════════════════════════════════════════════ */

interface MatrixRainProps {
  /** Characters to use */
  charset?: 'katakana' | 'latin' | 'binary';
  /** Font size in pixels */
  fontSize?: number;
  /** Opacity of the fade trail (0-1, lower = longer trails) */
  fadeOpacity?: number;
  /** Speed multiplier (1 = normal) */
  speed?: number;
  /** Width and height (defaults to container) */
  width?: number;
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

// Character sets
const CHARSETS = {
  katakana: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン',
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=<>{}[]|/\\',
  binary: '01',
};

// Matrix green — the ONLY color for this effect. Authentic.
const MATRIX_COLOR = {
  head: 'rgba(128, 255, 145, 1)',
  trail: 'rgba(0, 200, 100, 0.8)',
  dim: 'rgba(0, 140, 70, 0.4)',
};

export function MatrixRain({
  charset = 'katakana',
  fontSize = 14,
  fadeOpacity = 0.05,
  speed = 1,
  width,
  height,
  className,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dropsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const chars = CHARSETS[charset] ?? CHARSETS.katakana;
    const w = width ?? canvas.parentElement?.clientWidth ?? 800;
    const h = height ?? canvas.parentElement?.clientHeight ?? 600;

    canvas.width = w;
    canvas.height = h;

    const columns = Math.floor(w / fontSize);
    const drops = new Array(columns).fill(1).map(() => Math.random() * -20);
    dropsRef.current = drops;

    let lastTime = 0;
    const interval = 50 / speed; // ms between frames

    function draw(timestamp: number) {
      if (!ctx || !canvas) return;

      if (timestamp - lastTime < interval) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastTime = timestamp;

      // Fade effect (creates trails)
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)]!;
        const x = i * fontSize;
        const y = drops[i]! * fontSize;

        // Head character (brightest green)
        ctx.fillStyle = MATRIX_COLOR.head;
        ctx.shadowBlur = 8;
        ctx.shadowColor = MATRIX_COLOR.head;
        ctx.fillText(char, x, y);

        // Trail character (dimmer green, one row behind)
        ctx.fillStyle = MATRIX_COLOR.trail;
        ctx.shadowBlur = 4;
        ctx.shadowColor = MATRIX_COLOR.trail;
        if (y > fontSize) {
          const prevChar = chars[Math.floor(Math.random() * chars.length)]!;
          ctx.fillText(prevChar, x, y - fontSize);
        }

        // Reset shadow for performance
        ctx.shadowBlur = 0;

        // Move drop down
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]! += 1;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    if (prefersReducedMotion) {
      // Static frame for reduced motion
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = MATRIX_COLOR.trail;
      for (let i = 0; i < columns; i++) {
        const rowCount = Math.floor(Math.random() * 15) + 5;
        for (let j = 0; j < rowCount; j++) {
          const char = chars[Math.floor(Math.random() * chars.length)]!;
          const opacity = 0.1 + Math.random() * 0.5;
          ctx.globalAlpha = opacity;
          ctx.fillText(char, i * fontSize, j * fontSize);
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Fill initial black
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      animRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [charset, fontSize, fadeOpacity, speed, width, height]);

  // Handle resize
  useEffect(() => {
    if (width && height) return; // Fixed size, no resize needed

    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });

    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    return () => observer.disconnect();
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '100%',
      }}
    />
  );
}
