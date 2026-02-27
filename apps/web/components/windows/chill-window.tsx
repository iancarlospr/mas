'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AsciiPlayer } from '@/components/scan/ascii-player';
import { GhostAnimation } from '@/components/os/ghost-animation';
import { A22Animation } from '@/components/os/a22-animation';
import { MeanGirlsAnimation } from '@/components/os/meangirls-animation';
import { RickRollAnimation } from '@/components/os/rickroll-animation';

/* =================================================================
   chill.mov — ASCII Theater / Retro TV

   4-channel retro TV. Auto-plays sequentially:
   A22 → Mean Girls → Chloe TV → Rick Roll → loop.
   Manual channel switching with ◀ ▶ or 1-4.
   ================================================================= */

interface Channel {
  number: number;
  name: string;
  path: string | null;
  loop: boolean;
  description: string;
  live?: boolean;
  duration: number; // seconds before auto-advancing
}

const CHANNELS: Channel[] = [
  {
    number: 1,
    name: 'A22',
    path: null,
    loop: true,
    live: true,
    description: 'A22 Films — a ghostscan film',
    duration: 32,
  },
  {
    number: 2,
    name: 'MEAN GIRLS',
    path: null,
    loop: true,
    live: true,
    description: 'On Wednesdays we wear pink.',
    duration: 55,
  },
  {
    number: 3,
    name: 'CHLOE TV',
    path: null,
    loop: true,
    live: true,
    description: 'Chloe does her thing — live animation',
    duration: 40,
  },
  {
    number: 4,
    name: 'RICK FM',
    path: null,
    loop: true,
    live: true,
    description: 'You know what this is.',
    duration: 90,
  },
];

function StaticNoise() {
  const chars = '░▒▓█▀▄▐▌═║╬╠╣╦╩⠿⣿⠇⠋';
  const lines = Array.from({ length: 55 }, () =>
    Array.from({ length: 200 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  ).join('\n');

  return (
    <pre
      className="font-data leading-none whitespace-pre overflow-hidden select-none"
      style={{
        fontSize: '6.5px',
        color: '#39FF14',
        textShadow: '0 0 6px #39FF14, 0 0 20px rgba(57,255,20,0.4)',
        lineHeight: '1.1',
      }}
    >
      {lines}
    </pre>
  );
}

export default function ChillWindow() {
  const [channelIndex, setChannelIndex] = useState(0);
  const [isChanging, setIsChanging] = useState(false);
  const [channelKey, setChannelKey] = useState(0); // forces remount on change
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualRef = useRef(false); // tracks if user manually switched

  const channel = CHANNELS[channelIndex]!;

  const changeChannel = useCallback((direction: 'next' | 'prev' | number, auto = false) => {
    if (isChanging) return;
    setIsChanging(true);
    if (!auto) manualRef.current = true;

    const nextIndex = typeof direction === 'number'
      ? direction
      : direction === 'next'
        ? (channelIndex + 1) % CHANNELS.length
        : (channelIndex - 1 + CHANNELS.length) % CHANNELS.length;

    // Brief static noise between channels
    setTimeout(() => {
      setChannelIndex(nextIndex);
      setChannelKey(k => k + 1);
      setIsChanging(false);
      manualRef.current = false;
    }, 400);
  }, [channelIndex, isChanging]);

  // Auto-advance timer — starts when channel changes
  useEffect(() => {
    if (isChanging) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      changeChannel('next', true);
    }, channel.duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [channelIndex, isChanging, channel.duration, changeChannel]);

  // Keyboard channel switching
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      changeChannel('next');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      changeChannel('prev');
    } else if (e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      changeChannel(parseInt(e.key) - 1);
    }
  }, [changeChannel]);

  return (
    <div
      className="h-full bg-[#0A0A0A] flex flex-col overflow-hidden focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Screen area */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center">
        {/* CRT curve overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10 rounded-lg"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 65%, rgba(0,0,0,0.3) 100%)',
          }}
        />

        {/* Channel indicator — appears briefly on change */}
        {isChanging && (
          <div className="absolute top-3 right-3 z-20 font-data text-data-sm text-gs-base">
            CH {CHANNELS[(channelIndex + 1) % CHANNELS.length]?.number ?? 1}
          </div>
        )}

        {/* Content: static noise during change, player otherwise */}
        {isChanging ? (
          <StaticNoise />
        ) : channel.name === 'A22' ? (
          <A22Animation key={`a22-${channelKey}`} />
        ) : channel.name === 'MEAN GIRLS' ? (
          <MeanGirlsAnimation key={`mg-${channelKey}`} />
        ) : channel.name === 'CHLOE TV' ? (
          <GhostAnimation key={`ghost-${channelKey}`} />
        ) : channel.name === 'RICK FM' ? (
          <RickRollAnimation key={`rick-${channelKey}`} />
        ) : (
          <div className="p-gs-4 font-data text-data-sm text-gs-mid">No signal</div>
        )}
      </div>

      {/* Channel bar — glowing pill tabs */}
      <div
        className="flex-shrink-0 bg-[#0A0A0A] grid place-items-center"
        style={{ height: '45px', paddingTop: '10px', boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-center gap-2">
          {CHANNELS.map((ch, i) => {
            const isActive = i === channelIndex;
            return (
              <button
                key={ch.number}
                onClick={() => changeChannel(i)}
                className="font-data transition-all duration-200"
                style={{
                  padding: '6px 16px',
                  lineHeight: '1',
                  borderRadius: '100px',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '0.03em',
                  background: isActive
                    ? 'var(--gs-base)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid var(--gs-base)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: isActive
                    ? 'var(--gs-void)'
                    : 'var(--gs-mid)',
                  boxShadow: isActive
                    ? '0 0 10px var(--gs-base), 0 0 20px rgba(255,178,239,0.15)'
                    : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title={ch.description}
              >
                {ch.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
