'use client';

/**
 * GhostScan OS — Sound Effects Manager
 * ═══════════════════════════════════════════
 *
 * WHAT: Web Audio API manager for retro OS sound effects.
 * WHY:  Audio is OFF by default, opt-in via Radio.exe or menu bar toggle.
 *       When enabled, every interaction gets a retro chiptune feedback
 *       (Plan Section 9).
 * HOW:  Singleton AudioContext with procedurally generated sounds
 *       (no external files needed). Each sound is a short oscillator
 *       pattern with envelope shaping.
 */

type SoundEvent =
  | 'boot'
  | 'windowOpen'
  | 'windowClose'
  | 'scanStart'
  | 'moduleComplete'
  | 'criticalFound'
  | 'scanComplete'
  | 'chatSend'
  | 'chatReceive'
  | 'buttonClick'
  | 'unlock';

let audioCtx: AudioContext | null = null;
let enabled = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.15,
  delay = 0,
) {
  const ctx = getCtx();
  if (!ctx || !enabled) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

const SOUND_MAP: Record<SoundEvent, () => void> = {
  boot: () => {
    playTone(220, 0.15, 'square', 0.1, 0);
    playTone(330, 0.15, 'square', 0.1, 0.15);
    playTone(440, 0.3, 'square', 0.12, 0.3);
  },
  windowOpen: () => {
    playTone(800, 0.08, 'sine', 0.08);
  },
  windowClose: () => {
    playTone(400, 0.08, 'sine', 0.06);
  },
  scanStart: () => {
    playTone(200, 0.1, 'sawtooth', 0.08, 0);
    playTone(400, 0.1, 'sawtooth', 0.08, 0.1);
    playTone(800, 0.2, 'sawtooth', 0.1, 0.2);
  },
  moduleComplete: () => {
    playTone(660, 0.1, 'sine', 0.06);
  },
  criticalFound: () => {
    playTone(150, 0.3, 'square', 0.12);
  },
  scanComplete: () => {
    playTone(523, 0.15, 'square', 0.1, 0);
    playTone(659, 0.15, 'square', 0.1, 0.15);
    playTone(784, 0.3, 'square', 0.12, 0.3);
  },
  chatSend: () => {
    playTone(600, 0.06, 'sine', 0.05);
  },
  chatReceive: () => {
    playTone(1200, 0.03, 'sine', 0.04, 0);
    playTone(1400, 0.03, 'sine', 0.04, 0.04);
    playTone(1600, 0.03, 'sine', 0.04, 0.08);
  },
  buttonClick: () => {
    playTone(1000, 0.03, 'square', 0.04);
  },
  unlock: () => {
    playTone(523, 0.1, 'square', 0.1, 0);
    playTone(659, 0.1, 'square', 0.1, 0.1);
    playTone(784, 0.1, 'square', 0.1, 0.2);
    playTone(1047, 0.3, 'sine', 0.12, 0.3);
  },
};

export const soundEffects = {
  play(event: SoundEvent) {
    if (!enabled) return;
    SOUND_MAP[event]?.();
  },

  enable() {
    enabled = true;
    // Resume context if suspended (autoplay policy)
    const ctx = getCtx();
    if (ctx?.state === 'suspended') {
      ctx.resume();
    }
  },

  disable() {
    enabled = false;
  },

  toggle() {
    if (enabled) {
      this.disable();
    } else {
      this.enable();
    }
    return enabled;
  },

  isEnabled() {
    return enabled;
  },
};
