import './styles.css';
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { MarketingReel } from './MarketingReel';
import { WIDTH, HEIGHT, FPS, TOTAL_DURATION, SCENE } from './lib/constants';
import { P_WIDTH, P_HEIGHT, P_FPS, P_TOTAL } from './lib/progression';

// Marketing Reel scenes
import { HookScene } from './scenes/HookScene';
import { ScanInputScene } from './scenes/ScanInputScene';
import { ScanSequenceScene } from './scenes/ScanSequenceScene';
import { ReportRevealScene } from './scenes/ReportRevealScene';
import { PaidUnlockScene } from './scenes/PaidUnlockScene';
import { CTAScene } from './scenes/CTAScene';

// Progression Reel
import { ProgressionReel } from './ProgressionReel';
import { ProgressionThumbnail } from './components/ProgressionThumbnail';

// Builder Reel
import { BuilderReel } from './BuilderReel';
import { B_WIDTH, B_HEIGHT, B_FPS, B_TOTAL } from './lib/builder-reel';

// App Demo
import { AppDemo, AD_WIDTH, AD_HEIGHT, AD_FPS, AD_TOTAL } from './AppDemo';

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── Marketing Reel (1080×1920 vertical) ── */}
      <Composition
        id="MarketingReel"
        component={MarketingReel}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition id="Hook" component={HookScene} durationInFrames={SCENE.hook} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="ScanInput" component={ScanInputScene} durationInFrames={SCENE.scanInput} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="ScanSequence" component={ScanSequenceScene} durationInFrames={SCENE.scanSequence} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="ReportReveal" component={ReportRevealScene} durationInFrames={SCENE.reportReveal} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="PaidUnlock" component={PaidUnlockScene} durationInFrames={SCENE.paidUnlock} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="CTA" component={CTAScene} durationInFrames={SCENE.cta} fps={FPS} width={WIDTH} height={HEIGHT} />

      {/* ── Progression Reel (1920×1080 landscape) ── */}
      <Composition
        id="ProgressionReel"
        component={ProgressionReel}
        durationInFrames={P_TOTAL}
        fps={P_FPS}
        width={P_WIDTH}
        height={P_HEIGHT}
      />

      {/* ── Builder Reel (1920×1080 landscape) ── */}
      <Composition
        id="BuilderReel"
        component={BuilderReel}
        durationInFrames={B_TOTAL}
        fps={B_FPS}
        width={B_WIDTH}
        height={B_HEIGHT}
      />

      {/* ── App Demo (1832×1552 native, ~56s) ── */}
      <Composition
        id="AppDemo"
        component={AppDemo}
        durationInFrames={AD_TOTAL}
        fps={AD_FPS}
        width={AD_WIDTH}
        height={AD_HEIGHT}
      />

      {/* ── Progression Thumbnail (1920×1080 still) ── */}
      <Composition
        id="ProgressionThumbnail"
        component={ProgressionThumbnail}
        durationInFrames={1}
        fps={P_FPS}
        width={P_WIDTH}
        height={P_HEIGHT}
      />
    </>
  );
};

registerRoot(RemotionRoot);
