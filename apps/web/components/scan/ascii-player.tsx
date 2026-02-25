'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   GhostScan OS — ASCII Movie Player

   Plays ASCII art animations frame-by-frame in a terminal window.
   Frame format: { d: duration_multiplier, f: frame_text }
   Duration = d × frameRate (default 67ms)

   Used during scan loading sequence.
   Inspired by ascii.theater / towel.blinkenlights.nl

   Also shows the real SSH command for users who want
   the authentic terminal experience.
   ═══════════════════════════════════════════════════════════════ */

interface AsciiFrame {
  /** Duration multiplier (multiply by frameRate) */
  d: number;
  /** Frame content (13 lines of ASCII art) */
  f: string;
}

interface AsciiMovie {
  title: string;
  frameRate: number; // ms per duration unit
  frameCount: number;
  frames: AsciiFrame[];
}

interface AsciiPlayerProps {
  /** Path to JSON movie file in /public/ascii/ */
  moviePath: string;
  /** Whether to start playing immediately */
  autoPlay?: boolean;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Callback when movie ends */
  onEnd?: () => void;
  /** Show the SSH command hint below */
  showSshHint?: boolean;
  /** Additional CSS classes for the pre element */
  className?: string;
}

export function AsciiPlayer({
  moviePath,
  autoPlay = true,
  loop = false,
  onEnd,
  showSshHint = true,
  className,
}: AsciiPlayerProps) {
  const [movie, setMovie] = useState<AsciiMovie | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef(0);

  // Load movie JSON
  useEffect(() => {
    fetch(moviePath)
      .then((res) => res.json())
      .then((data: AsciiMovie) => {
        setMovie(data);
        if (autoPlay) setIsPlaying(true);
      })
      .catch(console.error);
  }, [moviePath, autoPlay]);

  // Frame advancement
  const advanceFrame = useCallback(() => {
    if (!movie) return;

    const nextFrame = frameRef.current + 1;

    if (nextFrame >= movie.frames.length) {
      if (loop) {
        frameRef.current = 0;
        setCurrentFrame(0);
      } else {
        setIsPlaying(false);
        onEnd?.();
        return;
      }
    } else {
      frameRef.current = nextFrame;
      setCurrentFrame(nextFrame);
    }

    // Schedule next frame
    const frame = movie.frames[frameRef.current];
    if (frame) {
      const delay = frame.d * movie.frameRate;
      timerRef.current = setTimeout(advanceFrame, delay);
    }
  }, [movie, loop, onEnd]);

  // Start/stop playback
  useEffect(() => {
    if (isPlaying && movie && movie.frames.length > 0) {
      const frame = movie.frames[frameRef.current];
      if (frame) {
        const delay = frame.d * movie.frameRate;
        timerRef.current = setTimeout(advanceFrame, delay);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, movie, advanceFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const frameContent = movie?.frames[currentFrame]?.f ?? '';

  return (
    <div className={className}>
      {/* ASCII art display */}
      <pre
        className="font-data text-data-xs text-gs-terminal leading-none whitespace-pre overflow-hidden select-none"
        style={{
          textShadow: '0 0 4px var(--gs-terminal), 0 0 8px oklch(0.80 0.15 145 / 0.3)',
          minHeight: '13em', // 13 lines
        }}
      >
        {frameContent}
      </pre>

      {/* Movie info bar */}
      <div className="flex items-center justify-between mt-gs-2 font-data text-data-xs text-gs-mid">
        <span>
          {movie?.title ?? 'Loading...'} — Frame {currentFrame + 1}/{movie?.frameCount ?? '?'}
        </span>
        <button
          className="text-gs-terminal hover:text-gs-cyan"
          onClick={() => setIsPlaying((p) => !p)}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
      </div>

      {/* SSH command hint */}
      {showSshHint && (
        <div className="mt-gs-4 border-t border-gs-mid-dark pt-gs-2">
          <p className="font-data text-data-xs text-gs-mid mb-gs-1">
            Or watch in your real terminal:
          </p>
          <button
            className="font-data text-data-xs text-gs-cyan hover:text-gs-fuchsia cursor-pointer bg-transparent border-none"
            onClick={() => {
              navigator.clipboard.writeText(
                'ssh -o StrictHostKeyChecking=no watch.ascii.theater',
              );
            }}
            title="Click to copy"
          >
            $ ssh -o StrictHostKeyChecking=no watch.ascii.theater
            <span className="text-gs-mid ml-gs-2">[click to copy]</span>
          </button>
        </div>
      )}
    </div>
  );
}
