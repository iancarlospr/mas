'use client';

import { useState, useCallback } from 'react';
import { AsciiPlayer } from '@/components/scan/ascii-player';
import { GhostAnimation } from '@/components/os/ghost-animation';
import { A22Animation } from '@/components/os/a22-animation';

/* =================================================================
   chill.mov — ASCII Theater / Retro TV

   4-channel retro TV experience. Flip channels with ◀ ▶ buttons
   or number keys 1-4. Static noise between channel changes.
   ================================================================= */

interface Channel {
  number: number;
  name: string;
  path: string | null;
  loop: boolean;
  description: string;
  live?: boolean;
}

const CHANNELS: Channel[] = [
  {
    number: 1,
    name: 'CHLOE TV',
    path: null,
    loop: true,
    live: true,
    description: 'Chloe does her thing — live animation',
  },
  {
    number: 2,
    name: 'A22',
    path: null,
    loop: true,
    live: true,
    description: 'A22 Films — a ghostscan film',
  },
  {
    number: 3,
    name: 'MEAN GIRLS',
    path: '/ascii/moonlight.json',
    loop: true,
    description: 'On Wednesdays we wear pink.',
  },
  {
    number: 4,
    name: 'RICK FM',
    path: '/ascii/rick_roll.json',
    loop: true,
    description: 'You know what this is.',
  },
];

function StaticNoise() {
  // Generate a block of random static characters
  const chars = '░▒▓█ ·.,:;!|/\\─═╔╗╚╝';
  const lines = Array.from({ length: 13 }, () =>
    Array.from({ length: 52 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  ).join('\n');

  return (
    <pre
      className="font-data text-data-xs leading-none whitespace-pre overflow-hidden select-none"
      style={{
        color: 'oklch(0.35 0.05 340)',
        minHeight: '13em',
        opacity: 0.6,
      }}
    >
      {lines}
    </pre>
  );
}

export default function ChillWindow() {
  const [channelIndex, setChannelIndex] = useState(0);
  const [isChanging, setIsChanging] = useState(false);
  const channel = CHANNELS[channelIndex]!;

  const changeChannel = useCallback((direction: 'next' | 'prev' | number) => {
    setIsChanging(true);

    const nextIndex = typeof direction === 'number'
      ? direction
      : direction === 'next'
        ? (channelIndex + 1) % CHANNELS.length
        : (channelIndex - 1 + CHANNELS.length) % CHANNELS.length;

    // Brief static noise between channels
    setTimeout(() => {
      setChannelIndex(nextIndex);
      setIsChanging(false);
    }, 400);
  }, [channelIndex]);

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
      <div className="flex-1 overflow-hidden relative p-gs-2">
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
        ) : channel.number === 1 ? (
          <GhostAnimation key="ghost-live" />
        ) : channel.number === 2 ? (
          <A22Animation key="a22-live" />
        ) : (
          <AsciiPlayer
            key={channel.path}
            moviePath={channel.path!}
            autoPlay
            loop={channel.loop}
            showSshHint={false}
          />
        )}
      </div>

      {/* Channel bar — bottom control strip */}
      <div className="flex-shrink-0 border-t border-gs-mid/30 bg-gs-deep/60 px-gs-3 py-gs-2">
        <div className="flex items-center justify-between">
          {/* Channel info */}
          <div className="flex items-center gap-gs-2 min-w-0">
            <span className="font-data text-data-xs text-gs-base font-bold flex-shrink-0">
              CH {channel.number}
            </span>
            <span className="font-data text-data-xs text-gs-mid truncate">
              {channel.name}
            </span>
            <span className="font-data text-data-xs text-gs-mid/50 truncate hidden sm:block">
              — {channel.description}
            </span>
          </div>

          {/* Channel controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => changeChannel('prev')}
              className="w-7 h-7 flex items-center justify-center rounded text-gs-mid hover:text-gs-base hover:bg-gs-base/10 transition-colors font-data text-data-sm"
              title="Previous channel"
            >
              ◀
            </button>

            {/* Channel dots */}
            <div className="flex items-center gap-1 mx-1">
              {CHANNELS.map((ch, i) => (
                <button
                  key={ch.number}
                  onClick={() => changeChannel(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === channelIndex
                      ? 'bg-gs-base scale-125'
                      : 'bg-gs-mid/40 hover:bg-gs-mid'
                  }`}
                  title={`CH ${ch.number}: ${ch.name}`}
                />
              ))}
            </div>

            <button
              onClick={() => changeChannel('next')}
              className="w-7 h-7 flex items-center justify-center rounded text-gs-mid hover:text-gs-base hover:bg-gs-base/10 transition-colors font-data text-data-sm"
              title="Next channel"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
