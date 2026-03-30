import React from 'react';
import { COLOR } from '../lib/constants';

/**
 * Win95-style window chrome — simplified for video render.
 * Matches the managed-window.tsx titlebar dots + dark content area.
 */

interface Props {
  title: string;
  width: number;
  height: number;
  children: React.ReactNode;
  active?: boolean;
  style?: React.CSSProperties;
  showDither?: boolean;
}

export const WindowChrome: React.FC<Props> = ({
  title,
  width,
  height,
  children,
  active = true,
  style,
  showDither = false,
}) => {
  const borderColor = active ? COLOR.base : COLOR.mid;

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        boxShadow: active
          ? `0 0 0 1px rgba(255,178,239,0.15), 0 4px 24px rgba(8,8,8,0.5), 0 0 32px rgba(255,178,239,0.08)`
          : `0 4px 24px rgba(8,8,8,0.4)`,
        ...style,
      }}
    >
      {/* Titlebar */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          background: active ? COLOR.base : COLOR.mid,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF6058' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27CA40' }} />
        </div>
        {/* Title */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'Geist Mono, monospace',
            fontSize: 12,
            fontWeight: 500,
            color: COLOR.void,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
      </div>

      {/* Dither strip (optional, for scan.exe) */}
      {showDither && (
        <div
          style={{
            height: 40,
            background: `linear-gradient(to bottom, ${COLOR.base}33, transparent)`,
            flexShrink: 0,
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          background: `${COLOR.deep}ee`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};
