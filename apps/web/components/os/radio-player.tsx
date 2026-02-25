'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Window } from '@/components/os/window';
import { soundEffects } from '@/lib/sound-effects';

/**
 * GhostScan OS — Radio.exe (Music Player)
 * ═══════════════════════════════════════════════
 *
 * WHAT: A small retro music player window as a desktop "program".
 * WHY:  Radio.exe is an easter egg that creates ambient atmosphere.
 *       "lofi beats to audit to" — it's a vibe (Plan Section 8/9).
 * HOW:  Window component with pixel equalizer bars, station buttons,
 *       volume slider, play/pause. Uses Web Audio API for visualizer.
 *       Streams from free public radio URLs.
 */

const STATIONS = [
  {
    name: 'lofi beats to audit to',
    url: 'https://streams.fluxfm.de/Chillhop/mp3-128/audio/',
    color: 'bg-gs-cyan',
  },
  {
    name: 'synthwave radio',
    url: 'https://streams.fluxfm.de/80s/mp3-128/audio/',
    color: 'bg-gs-fuchsia',
  },
  {
    name: 'the void',
    url: 'https://ice1.somafm.com/dronezone-128-mp3',
    color: 'bg-gs-terminal',
  },
];

interface RadioPlayerProps {
  onClose?: () => void;
}

export function RadioPlayer({ onClose }: RadioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [stationIndex, setStationIndex] = useState(0);
  const [volume, setVolume] = useState(70);
  const [eqBars, setEqBars] = useState([3, 5, 7, 4, 6, 3, 5, 4]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animRef = useRef<number>(0);

  const station = STATIONS[stationIndex]!;

  // Equalizer animation
  useEffect(() => {
    if (!playing) return;

    const animate = () => {
      setEqBars((prev) =>
        prev.map(() => Math.floor(Math.random() * 8) + 1),
      );
      animRef.current = window.setTimeout(animate, 200) as unknown as number;
    };
    animate();

    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, [playing]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(station.url);
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.volume = volume / 100;
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = station.url;
      audioRef.current.volume = volume / 100;
      audioRef.current.play().catch(() => {
        // Autoplay blocked — user interaction needed
      });
      setPlaying(true);
      soundEffects.enable();
    }
  }, [playing, station.url, volume]);

  const changeStation = (idx: number) => {
    setStationIndex(idx);
    if (audioRef.current && playing) {
      audioRef.current.src = STATIONS[idx]!.url;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return (
    <Window
      id="radio"
      title="Radio.exe"
      variant="default"
      isActive
      width={280}
      onClose={onClose}
    >
      <div className="p-gs-4 bg-gs-black space-y-gs-3">
        {/* Equalizer */}
        <div className="flex items-end justify-center gap-[3px] h-[40px]">
          {eqBars.map((height, i) => (
            <div
              key={i}
              className={`w-[6px] transition-all duration-150 ${playing ? station.color : 'bg-gs-mid-dark'}`}
              style={{ height: `${playing ? height * 5 : 4}px` }}
            />
          ))}
        </div>

        {/* Station name */}
        <div className="bevel-sunken bg-gs-dark p-gs-2 text-center">
          <span className="font-data text-data-xs text-gs-terminal">
            {playing ? station.name : 'Radio.exe — Idle'}
          </span>
        </div>

        {/* Station buttons */}
        <div className="flex gap-gs-1">
          {STATIONS.map((s, i) => (
            <button
              key={s.name}
              onClick={() => changeStation(i)}
              className={`flex-1 text-os-xs py-gs-1 ${
                i === stationIndex ? 'bevel-sunken bg-gs-mid-dark text-gs-near-white' : 'bevel-button'
              }`}
              title={s.name}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-gs-2">
          <button
            onClick={togglePlay}
            className="bevel-button text-os-sm px-gs-3 py-gs-1"
          >
            {playing ? '⏸' : '▶'}
          </button>

          {/* Volume */}
          <div className="flex-1 flex items-center gap-gs-2">
            <span className="font-data text-data-xs text-gs-mid">🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolume}
              className="flex-1 h-[4px] appearance-none bg-gs-mid-dark cursor-pointer accent-gs-cyan"
            />
          </div>
        </div>
      </div>
    </Window>
  );
}
