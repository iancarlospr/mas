import React, { useRef, useEffect, useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GrainOverlay } from './GrainOverlay';

/**
 * Scene 2: "WHAT I CAN BUILD" — 3D Particle Constellation
 *
 * Leverages @remotion/three + React Three Fiber:
 *   - 3000 particles scattered in 3D space
 *   - Converge to form "WHAT I CAN BUILD" text
 *   - Text target positions sampled from offscreen canvas
 *   - 300+ connection lines between nearby particles
 *   - Additive blending for natural bloom glow
 *   - Custom vertex/fragment shaders (soft circles + glow halos)
 *   - Background dust field (800 dim particles)
 *   - Cinematic camera drift with parallax
 *   - Canvas 2D text overlay (crisp)
 *   - All animation driven by useCurrentFrame() (deterministic)
 */

// ── Constants ───────────────────────────────────────────────

const MAIN_PARTICLES = 12000;
const DUST_PARTICLES = 2500;
const TOTAL_PARTICLES = MAIN_PARTICLES + DUST_PARTICLES;
const MAX_CONNECTIONS = 600;

// ── Deterministic hash ──────────────────────────────────────

const hash = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ── Generate text target positions from canvas ──────────────

const sampleTextPositions = (): number[][] => {
  const cw = 480;
  const ch = 200;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Line 1
  ctx.font = '700 46px "Arial Black", "Impact", sans-serif';
  ctx.fillText('WHAT I CAN', cw / 2, ch * 0.38);

  // Line 2
  ctx.font = '700 56px "Arial Black", "Impact", sans-serif';
  ctx.fillText('BUILD', cw / 2, ch * 0.68);

  const img = ctx.getImageData(0, 0, cw, ch);
  const pts: number[][] = [];

  // Sample every pixel for maximum text definition
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (img.data[(y * cw + x) * 4]! > 128) {
        // Map to 3D — 1.3x scale: x ∈ [-9.1, 9.1], y ∈ [-3.9, 3.9]
        pts.push([
          (x / cw - 0.5) * 18.2,
          -(y / ch - 0.5) * 7.8,
        ]);
      }
    }
  }
  return pts;
};

// ── Build all particle data ─────────────────────────────────

interface ParticleData {
  startPositions: Float32Array;
  targetPositions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  connectionPairs: number[]; // indices of connected particle pairs
}

const buildParticleData = (): ParticleData => {
  const textPts = sampleTextPositions();

  const startPositions = new Float32Array(TOTAL_PARTICLES * 3);
  const targetPositions = new Float32Array(TOTAL_PARTICLES * 3);
  const sizes = new Float32Array(TOTAL_PARTICLES);
  const colors = new Float32Array(TOTAL_PARTICLES * 3);
  const alphas = new Float32Array(TOTAL_PARTICLES);

  // ── Main particles: scatter → text ──
  for (let i = 0; i < MAIN_PARTICLES; i++) {
    // Start: spherical scatter
    const theta = hash(i, 0) * Math.PI * 2;
    const phi = Math.acos(hash(i, 1) * 2 - 1);
    const r = 4 + hash(i, 2) * 10;

    startPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    startPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    startPositions[i * 3 + 2] = r * Math.cos(phi);

    // Target: text position
    const tIdx = Math.floor(hash(i, 3) * textPts.length);
    const tp = textPts[tIdx % textPts.length]!;
    targetPositions[i * 3] = tp[0]! + (hash(i, 4) - 0.5) * 0.06;
    targetPositions[i * 3 + 1] = tp[1]! + (hash(i, 5) - 0.5) * 0.06;
    targetPositions[i * 3 + 2] = (hash(i, 6) - 0.5) * 0.15;

    // ── Particle class variation ──
    // 4 classes: sparkle (55%), standard (28%), bright (12%), leader (5%)
    const classSeed = hash(i, 50);

    if (classSeed < 0.55) {
      // Sparkle — tiny, dim, volume filler
      sizes[i] = 0.3 + hash(i, 7) * 0.5;
      alphas[i] = 0.15 + hash(i, 12) * 0.2;
    } else if (classSeed < 0.83) {
      // Standard — medium, the workhorse
      sizes[i] = 0.6 + hash(i, 7) * 1.0;
      alphas[i] = 0.3 + hash(i, 12) * 0.25;
    } else if (classSeed < 0.95) {
      // Bright — larger, stands out
      sizes[i] = 1.0 + hash(i, 7) * 1.2;
      alphas[i] = 0.45 + hash(i, 12) * 0.25;
    } else {
      // Leader — rare, large, bright anchor points
      sizes[i] = 1.8 + hash(i, 7) * 1.5;
      alphas[i] = 0.55 + hash(i, 12) * 0.3;
    }

    // Color: neutral masculine — steel blue / silver / ice white
    const colorSeed = hash(i, 8);
    if (colorSeed < 0.35) {
      // Steel blue
      colors[i * 3] = 0.08 + hash(i, 9) * 0.06;
      colors[i * 3 + 1] = 0.14 + hash(i, 10) * 0.1;
      colors[i * 3 + 2] = 0.28 + hash(i, 11) * 0.12;
    } else if (colorSeed < 0.58) {
      // Cool silver/grey
      const base = 0.15 + hash(i, 9) * 0.1;
      colors[i * 3] = base;
      colors[i * 3 + 1] = base + 0.02;
      colors[i * 3 + 2] = base + 0.06;
    } else if (colorSeed < 0.76) {
      // Ice blue
      colors[i * 3] = 0.10 + hash(i, 9) * 0.08;
      colors[i * 3 + 1] = 0.18 + hash(i, 10) * 0.12;
      colors[i * 3 + 2] = 0.30 + hash(i, 11) * 0.12;
    } else if (colorSeed < 0.90) {
      // Slate
      colors[i * 3] = 0.10 + hash(i, 9) * 0.06;
      colors[i * 3 + 1] = 0.11 + hash(i, 10) * 0.06;
      colors[i * 3 + 2] = 0.16 + hash(i, 11) * 0.08;
    } else {
      // Bright ice accent (highlight particles)
      const boost = classSeed > 0.95 ? 1.4 : 1.0;
      colors[i * 3] = (0.28 + hash(i, 9) * 0.15) * boost;
      colors[i * 3 + 1] = (0.32 + hash(i, 10) * 0.15) * boost;
      colors[i * 3 + 2] = (0.42 + hash(i, 11) * 0.15) * boost;
    }
  }

  // ── Background dust: stays scattered ──
  for (let i = MAIN_PARTICLES; i < TOTAL_PARTICLES; i++) {
    const di = i - MAIN_PARTICLES;
    const theta = hash(di, 20) * Math.PI * 2;
    const phi = Math.acos(hash(di, 21) * 2 - 1);
    const r = 3 + hash(di, 22) * 18;

    const px = r * Math.sin(phi) * Math.cos(theta);
    const py = r * Math.sin(phi) * Math.sin(theta);
    const pz = r * Math.cos(phi);

    startPositions[i * 3] = px;
    startPositions[i * 3 + 1] = py;
    startPositions[i * 3 + 2] = pz;

    // Dust doesn't converge — target = start with slight drift
    targetPositions[i * 3] = px;
    targetPositions[i * 3 + 1] = py;
    targetPositions[i * 3 + 2] = pz;

    sizes[i] = 0.3 + hash(di, 23) * 0.8;

    // Very dim steel/slate dust
    colors[i * 3] = 0.03 + hash(di, 24) * 0.04;
    colors[i * 3 + 1] = 0.04 + hash(di, 25) * 0.05;
    colors[i * 3 + 2] = 0.07 + hash(di, 26) * 0.06;

    alphas[i] = 0.06 + hash(di, 27) * 0.12;
  }

  // ── Connection pairs (nearby target particles) ──
  const connectionPairs: number[] = [];
  const threshold = 0.8;

  for (let i = 0; i < MAIN_PARTICLES && connectionPairs.length < MAX_CONNECTIONS * 2; i += 3) {
    for (let j = i + 1; j < Math.min(i + 40, MAIN_PARTICLES); j++) {
      const dx = targetPositions[i * 3]! - targetPositions[j * 3]!;
      const dy = targetPositions[i * 3 + 1]! - targetPositions[j * 3 + 1]!;
      const dz = targetPositions[i * 3 + 2]! - targetPositions[j * 3 + 2]!;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < threshold && dist > 0.05) {
        connectionPairs.push(i, j);
        if (connectionPairs.length >= MAX_CONNECTIONS * 2) break;
      }
    }
  }

  return { startPositions, targetPositions, sizes, colors, alphas, connectionPairs };
};

// ── Particle shaders ────────────────────────────────────────

const PARTICLE_VERT = `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (120.0 / -mvPos.z);
  gl_Position = projectionMatrix * mvPos;
}
`;

const PARTICLE_FRAG = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float dist = length(gl_PointCoord - 0.5);

  // Crisp circle with tight falloff — no bloated halo
  float core = smoothstep(0.48, 0.15, dist);
  float bright = smoothstep(0.3, 0.0, dist);  // bright center
  float alpha = core * vAlpha;

  // Color: bright center, color at edges
  vec3 col = vColor * (0.8 + bright * 0.6);

  if (alpha < 0.01) discard;

  gl_FragColor = vec4(col, alpha);
}
`;

// ── Camera controller ───────────────────────────────────────

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();

  const p = frame / durationInFrames;

  // Start at an angle, settle to front-facing
  const cx = interpolate(p, [0, 0.35, 1], [4, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) + Math.sin(frame * 0.006) * 0.4;

  const cy = interpolate(p, [0, 0.35, 1], [2.5, 0.3, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) + Math.cos(frame * 0.005) * 0.25;

  const cz = 16;

  camera.position.set(cx, cy, cz);
  camera.lookAt(0, 0, 0);

  return null;
};

// ── Main 3D scene (inside ThreeCanvas) ──────────────────────

const ParticleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  // Build all data once
  const data = useMemo(() => buildParticleData(), []);

  // Convergence progress
  const progress = frame / durationInFrames;

  // Staggered convergence: starts at 25%, completes at 60%
  const converge = interpolate(progress, [0.22, 0.58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Cubic ease-out for satisfying settle
  const convergeEased = 1 - Math.pow(1 - converge, 3);

  // Connection line opacity
  const lineOpacity = interpolate(progress, [0.35, 0.55, 0.85, 1.0], [0, 0.25, 0.25, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade in/out
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneAlpha = fadeIn * fadeOut;

  // ── Create geometry ──
  const { geometry, lineGeometry, uniforms } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(
      new Float32Array(data.startPositions), 3
    ));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(
      new Float32Array(data.sizes), 1
    ));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(
      new Float32Array(data.colors), 3
    ));
    geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(
      new Float32Array(data.alphas), 1
    ));

    // Line geometry
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(data.connectionPairs.length * 3);
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    const u = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    return { geometry: geo, lineGeometry: lineGeo, uniforms: u };
  }, [data]);

  // ── Update positions each frame ──
  useEffect(() => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const alphaAttr = pointsRef.current.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const alphaArr = alphaAttr.array as Float32Array;

    const time = frame / fps;

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3;

      if (i < MAIN_PARTICLES) {
        // ── Main particles: lerp to target ──
        // Stagger: particles closer to center converge faster
        const distFromCenter = Math.sqrt(
          data.targetPositions[i3]! * data.targetPositions[i3]! +
          data.targetPositions[i3 + 1]! * data.targetPositions[i3 + 1]!
        );
        const stagger = hash(i, 30) * 0.15;
        const localConverge = Math.min(1, Math.max(0,
          convergeEased * (1.3 - distFromCenter * 0.04) - stagger
        ));

        // Overshoot then settle (spring-like)
        let spring = localConverge;
        if (localConverge > 0.7 && localConverge < 1) {
          spring = localConverge + Math.sin(localConverge * Math.PI * 3) * 0.02 * (1 - localConverge);
        }

        const sx = data.startPositions[i3]!;
        const sy = data.startPositions[i3 + 1]!;
        const sz = data.startPositions[i3 + 2]!;
        const tx = data.targetPositions[i3]!;
        const ty = data.targetPositions[i3 + 1]!;
        const tz = data.targetPositions[i3 + 2]!;

        let px = sx + (tx - sx) * spring;
        let py = sy + (ty - sy) * spring;
        let pz = sz + (tz - sz) * spring;

        // Breathing after formation
        if (converge > 0.8) {
          const breathAmount = (converge - 0.8) * 5; // 0→1
          const phase = hash(i, 31) * Math.PI * 2;
          px += Math.sin(time * 1.2 + phase) * 0.04 * breathAmount;
          py += Math.cos(time * 1.0 + phase * 1.3) * 0.03 * breathAmount;
          pz += Math.sin(time * 0.8 + phase * 0.7) * 0.06 * breathAmount;
        }

        // Pre-convergence drift
        if (converge < 0.3) {
          const drift = (0.3 - converge) / 0.3;
          px += Math.sin(time * 0.3 + hash(i, 32) * 10) * 0.3 * drift;
          py += Math.cos(time * 0.25 + hash(i, 33) * 10) * 0.2 * drift;
          pz += Math.sin(time * 0.2 + hash(i, 34) * 10) * 0.25 * drift;
        }

        arr[i3] = px;
        arr[i3 + 1] = py;
        arr[i3 + 2] = pz;

        // Alpha: fade in, hold, fade out with scene
        alphaArr[i] = data.alphas[i]! * sceneAlpha;

      } else {
        // ── Dust: gentle drift ──
        const di = i - MAIN_PARTICLES;
        const phase = hash(di, 40) * Math.PI * 2;
        arr[i3] = data.startPositions[i3]! + Math.sin(time * 0.1 + phase) * 0.5;
        arr[i3 + 1] = data.startPositions[i3 + 1]! + Math.cos(time * 0.08 + phase) * 0.4;
        arr[i3 + 2] = data.startPositions[i3 + 2]! + Math.sin(time * 0.12 + phase * 1.5) * 0.3;

        alphaArr[i] = data.alphas[i]! * sceneAlpha;
      }
    }

    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    // ── Update connection line positions ──
    if (linesRef.current) {
      const lineAttr = linesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const lineArr = lineAttr.array as Float32Array;

      for (let c = 0; c < data.connectionPairs.length; c += 2) {
        const a = data.connectionPairs[c]!;
        const b = data.connectionPairs[c + 1]!;

        const ci = c * 3; // 2 vertices per line, 3 components
        lineArr[ci] = arr[a * 3]!;
        lineArr[ci + 1] = arr[a * 3 + 1]!;
        lineArr[ci + 2] = arr[a * 3 + 2]!;
        lineArr[ci + 3] = arr[b * 3]!;
        lineArr[ci + 4] = arr[b * 3 + 1]!;
        lineArr[ci + 5] = arr[b * 3 + 2]!;
      }

      lineAttr.needsUpdate = true;
    }
  }, [frame, converge, convergeEased, sceneAlpha, data, fps]);

  // ── Shader material ──
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // ── Line material ──
  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(0.08, 0.12, 0.22),
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Update line opacity
  useEffect(() => {
    lineMaterial.opacity = lineOpacity * sceneAlpha;
  }, [lineOpacity, sceneAlpha, lineMaterial]);

  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.05} />

      {/* Main particle field */}
      <points ref={pointsRef} geometry={geometry} material={shaderMaterial} />

      {/* Connection lines */}
      <lineSegments ref={linesRef} geometry={lineGeometry} material={lineMaterial} />
    </>
  );
};

// ── HUD Text overlay ────────────────────────────────────────

const drawHUD = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  total: number,
  w: number,
  h: number,
) => {
  ctx.clearRect(0, 0, w, h);

  const progress = frame / total;
  const fadeIn = Math.min(frame / 15, 1);
  const fadeOut = Math.max(0, Math.min(1, (total - frame) / 20));
  const alpha = fadeIn * fadeOut;

  // Text reveals when particles have converged
  const textReveal = interpolate(progress, [0.55, 0.72], [0, 1], {
    extrapolateLeft: 'clamp' as const,
    extrapolateRight: 'clamp' as const,
  });

  // Particles ARE the text — no overlay needed

  // ── Bottom label ──
  if (progress > 0.6) {
    const la = interpolate(progress, [0.6, 0.75], [0, 0.28], {
      extrapolateLeft: 'clamp' as const,
      extrapolateRight: 'clamp' as const,
    }) * fadeOut;

    ctx.save();
    ctx.globalAlpha = la;
    ctx.font = '11px "Geist Mono", "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(140, 160, 200, 0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${TOTAL_PARTICLES.toLocaleString()} PARTICLES  //  ${MAX_CONNECTIONS} CONNECTIONS  //  REACT THREE FIBER  //  GPU INSTANCED`,
      w / 2,
      h - 40,
    );
    ctx.restore();
  }
};

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

const W = 1920;
const H = 1080;

export const OutroSignature: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const hudRef = useRef<HTMLCanvasElement>(null);

  // HUD render
  useEffect(() => {
    const canvas = hudRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawHUD(ctx, frame, durationInFrames, W, H);
  }, [frame, durationInFrames]);

  return (
    <AbsoluteFill style={{ background: '#060610' }}>
      {/* 3D scene */}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 55, position: [0, 0, 16], near: 0.1, far: 100 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ParticleScene />
      </ThreeCanvas>

      {/* Text overlay */}
      <canvas
        ref={hudRef}
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      <GrainOverlay opacity={0.03} />
    </AbsoluteFill>
  );
};
