import React from 'react';
import { AbsoluteFill } from 'remotion';
import { ChloeSprite, type ChloeState } from './components/ChloeSprite';
import { COLOR } from './lib/constants';

/**
 * ChloeStill — Single-frame Chloe sprite for still image export.
 *
 * Usage:
 *   npx remotion still ChloeStill out/chloe-idle.png --props='{"state":"idle","glowing":true}'
 *   npx remotion still ChloeStill out/chloe-smug.png --props='{"state":"smug","glowing":true}'
 */

interface Props {
  state?: ChloeState;
  glowing?: boolean;
}

export const ChloeStill: React.FC<Props> = ({ state = 'idle', glowing = true }) => {
  return (
    <AbsoluteFill
      style={{
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Optional glow backdrop */}
      {glowing && (
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${COLOR.base}22 0%, transparent 70%)`,
          }}
        />
      )}

      <ChloeSprite
        state={state}
        size={384}
        glowing={glowing}
        frame={0}
      />
    </AbsoluteFill>
  );
};
