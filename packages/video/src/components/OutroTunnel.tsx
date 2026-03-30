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

/**
 * Scene 3: "FOR YOUR TEAM." — Caribbean Product Stage
 *
 * Procedural Caribbean sky with sun + clouds.
 * Floating glass/chrome/stone geometric shapes catching real sky
 * reflections — like an Apple product shoot against blue sky.
 * Clean reflective ground plane.
 * No literal architecture — the shapes themselves are the showcase.
 * Camera slowly orbits the composition.
 */

const W = 1920;
const H = 1080;

// ══════════════════════════════════════════════════════════════
// Sky Dome
// ══════════════════════════════════════════════════════════════

const SKY_VERT = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = `
uniform float uTime;
varying vec3 vWorldPos;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float fbmCloud(vec2 p, float t) {
  float v = 0.0;
  v += snoise(vec3(p * 0.7, t)) * 0.5;
  v += snoise(vec3(p * 1.4 + 10.0, t * 1.1)) * 0.25;
  v += snoise(vec3(p * 2.8 + 20.0, t * 0.9)) * 0.125;
  v += snoise(vec3(p * 5.6 + 40.0, t * 1.2)) * 0.0625;
  return v;
}

void main() {
  vec3 dir = normalize(vWorldPos);
  float elev = dir.y;

  // Sky gradient
  vec3 zenith   = vec3(0.28, 0.55, 0.95);
  vec3 horizon  = vec3(0.65, 0.82, 0.96);
  vec3 horizonW = vec3(0.88, 0.92, 0.96);

  float t = clamp(elev, 0.0, 1.0);
  vec3 sky = mix(horizonW, horizon, smoothstep(0.0, 0.06, t));
  sky = mix(sky, zenith, smoothstep(0.06, 0.6, t));

  // Sun
  vec3 sunDir = normalize(vec3(0.3, 0.55, -0.4));
  float sunDot = max(dot(dir, sunDir), 0.0);
  sky += vec3(1.0, 0.95, 0.85) * smoothstep(0.997, 0.999, sunDot) * 2.0;
  sky += vec3(1.0, 0.90, 0.70) * pow(sunDot, 32.0) * 0.35;
  sky += vec3(1.0, 0.85, 0.65) * pow(sunDot, 6.0) * 0.12;

  // Clouds
  if (elev > 0.01) {
    vec2 cuv = dir.xz / max(dir.y, 0.04) * 0.12;
    cuv += vec2(uTime * 0.003, uTime * 0.001);
    float cloud = fbmCloud(cuv, uTime * 0.007);
    cloud = smoothstep(0.02, 0.32, cloud);
    vec3 cc = mix(vec3(0.96, 0.96, 0.97), vec3(1.0, 0.98, 0.93), pow(sunDot, 4.0) * 0.5);
    float fade = smoothstep(0.01, 0.1, elev) * smoothstep(0.65, 0.28, elev);
    sky = mix(sky, cc, cloud * fade * 0.88);
  }

  // Below horizon — invisible, ground plane handles it
  if (elev < 0.0) {
    sky = horizonW;
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

const SkyDome: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.SphereGeometry(400, 64, 32);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uTime: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    material.uniforms.uTime!.value = frame / fps;
  }, [frame, fps, material]);

  return <mesh geometry={geometry} material={material} />;
};

// ══════════════════════════════════════════════════════════════
// Ground Plane — clean light surface
// ══════════════════════════════════════════════════════════════

const Ground: React.FC = () => {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.82, 0.75, 0.65),
    metalness: 0.0,
    roughness: 0.7,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
  }), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} material={mat}>
      <planeGeometry args={[80, 80]} />
    </mesh>
  );
};

// ══════════════════════════════════════════════════════════════
// Floating Shapes — the hero objects
// ══════════════════════════════════════════════════════════════

interface ShapeConfig {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  pos: [number, number, number];
  rotSpd: [number, number, number];
  floatAmp: number;
  floatSpd: number;
  phase: number;
  scale: number;
  delay: number;
}

const FloatingShape: React.FC<{ config: ShapeConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const ref = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const entrance = Math.min(1, Math.max(0, (frame - config.delay) / 35));
    const e = 1 - Math.pow(1 - entrance, 3);

    ref.current.rotation.set(
      frame * config.rotSpd[0],
      frame * config.rotSpd[1],
      frame * config.rotSpd[2],
    );
    ref.current.position.set(
      config.pos[0],
      config.pos[1] + Math.sin(frame * config.floatSpd + config.phase) * config.floatAmp,
      config.pos[2],
    );
    const s = config.scale * e;
    ref.current.scale.set(s, s, s);
  }, [frame, config]);

  return <mesh ref={ref} geometry={config.geo} material={config.mat} />;
};

// ══════════════════════════════════════════════════════════════
// Camera
// ══════════════════════════════════════════════════════════════

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();

  const p = frame / durationInFrames;

  // Slow orbit around the shapes
  // Phase 1 (0-65%): gentle establishing orbit
  // Phase 2 (65-100%): aggressive rush INTO the shapes — screen takeover
  const angle = interpolate(p, [0, 0.65, 1], [0.15, -0.15, -0.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const dist = interpolate(p, [0, 0.6, 0.85, 1], [14, 10, 5.5, 4.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cy = interpolate(p, [0, 0.6, 1], [2.5, 1.8, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) + Math.sin(frame * 0.004) * 0.08;

  camera.position.set(
    Math.sin(angle) * dist,
    cy,
    Math.cos(angle) * dist,
  );
  camera.lookAt(0, 0.8, 0);

  return null;
};

// ══════════════════════════════════════════════════════════════
// Main Scene
// ══════════════════════════════════════════════════════════════

const ProductScene: React.FC = () => {
  // Generate procedural sky environment map for PBR reflections
  const { scene, gl } = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);

    // High-contrast environment for realistic PBR reflections
    const envScene = new THREE.Scene();

    // Sky dome with strong contrast
    const skyGeo = new THREE.SphereGeometry(100, 64, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          vec3 n = normalize(vPos);
          float y = n.y;

          // Sky gradient with more range
          vec3 top = vec3(0.3, 0.55, 0.95);
          vec3 mid = vec3(0.7, 0.80, 0.92);
          vec3 bot = vec3(0.15, 0.13, 0.10); // dark ground for contrast
          vec3 col = y > 0.0
            ? mix(mid, top, smoothstep(0.0, 0.6, y))
            : mix(mid, bot, smoothstep(0.0, -0.2, y));

          // BRIGHT sun — the key to metallic reflections
          vec3 sunDir = normalize(vec3(0.3, 0.55, -0.4));
          float sunDot = max(dot(n, sunDir), 0.0);
          col += vec3(4.0, 3.6, 2.8) * pow(sunDot, 256.0);  // hard bright disc
          col += vec3(2.0, 1.8, 1.4) * pow(sunDot, 32.0);   // medium glow
          col += vec3(0.6, 0.5, 0.35) * pow(sunDot, 4.0);    // wide halo

          // Secondary fill light opposite side
          vec3 fillDir = normalize(vec3(-0.5, 0.3, 0.6));
          float fillDot = max(dot(n, fillDir), 0.0);
          col += vec3(0.8, 0.9, 1.2) * pow(fillDot, 64.0);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    const envMap = pmrem.fromScene(envScene, 0, 0.1, 200).texture;
    scene.environment = envMap;
    pmrem.dispose();
    skyGeo.dispose();
    skyMat.dispose();
  }, [scene, gl]);

  const geos = useMemo(() => ({
    ico: new THREE.SphereGeometry(1.2, 128, 128),         // perfectly smooth glass orb
    torusKnot: new THREE.TorusKnotGeometry(0.8, 0.25, 128, 32, 2, 3),
    octa: new THREE.OctahedronGeometry(0.9, 0),
    dodeca: new THREE.DodecahedronGeometry(0.7, 1),
    sphere: new THREE.SphereGeometry(0.6, 64, 64),      // perfect sphere
    torus: new THREE.TorusGeometry(0.7, 0.25, 32, 64),
  }), []);

  const mats = useMemo(() => ({
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.85, 0.90, 0.95),
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.88,
      thickness: 3.0,
      ior: 1.6,
      transparent: true,
      opacity: 0.90,
      envMapIntensity: 2.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      specularIntensity: 1.5,
      specularColor: new THREE.Color(1.0, 1.0, 1.0),
    }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.75, 0.78, 0.82),
      metalness: 1.0,
      roughness: 0.04,
      envMapIntensity: 2.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    }),
    goldChrome: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.83, 0.61, 0.12),
      metalness: 0.65,
      roughness: 0.12,
      emissive: new THREE.Color(0.25, 0.16, 0.02),
      emissiveIntensity: 0.6,
    }),
    matte: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.35, 0.42, 0.50),
      metalness: 0.0,
      roughness: 0.55,
      envMapIntensity: 0.4,
    }),
    darkMatte: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.10, 0.10, 0.12),
      metalness: 0.15,
      roughness: 0.3,
      envMapIntensity: 0.6,
    }),
    rosegold: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.72, 0.38, 0.30),
      metalness: 1.0,
      roughness: 0.10,
      envMapIntensity: 2.0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.08,
    }),
  }), []);

  const shapes: ShapeConfig[] = useMemo(() => [
    // Center hero — large glass icosahedron
    { geo: geos.ico, mat: mats.glass, pos: [0, 1.5, 0], rotSpd: [0.002, 0.004, 0.001], floatAmp: 0.2, floatSpd: 0.02, phase: 0, scale: 1.4, delay: 5 },
    // Right — chrome torus knot
    { geo: geos.torusKnot, mat: mats.chrome, pos: [3.8, 2.2, -1.5], rotSpd: [0.003, 0.005, 0.001], floatAmp: 0.25, floatSpd: 0.018, phase: 1.2, scale: 1.1, delay: 12 },
    // Left — gold chrome octahedron
    { geo: geos.octa, mat: mats.goldChrome, pos: [-3.2, 2.8, -0.8], rotSpd: [0.004, 0.002, 0.003], floatAmp: 0.18, floatSpd: 0.022, phase: 2.5, scale: 1.2, delay: 20 },
    // Far back — dark matte dodecahedron
    { geo: geos.dodeca, mat: mats.darkMatte, pos: [1.8, 1.0, -5], rotSpd: [0.002, 0.003, 0.002], floatAmp: 0.1, floatSpd: 0.015, phase: 4.0, scale: 1.0, delay: 28 },
    // Small left — rose gold perfect sphere
    { geo: geos.sphere, mat: mats.rosegold, pos: [-1.5, 0.8, 2.5], rotSpd: [0.001, 0.001, 0.001], floatAmp: 0.15, floatSpd: 0.025, phase: 5.5, scale: 0.8, delay: 15 },
    // Right front — matte torus
    { geo: geos.torus, mat: mats.matte, pos: [2.2, 0.5, 3], rotSpd: [0.005, 0.002, 0.003], floatAmp: 0.12, floatSpd: 0.02, phase: 3.2, scale: 0.9, delay: 25 },
  ], [geos, mats]);

  return (
    <>
      <CameraRig />
      <SkyDome />
      <Ground />

      {/* Warm sunlight */}
      <ambientLight intensity={0.55} color={new THREE.Color(0.96, 0.94, 0.90)} />
      <directionalLight position={[6, 12, 4]} intensity={2.0} color={new THREE.Color(1.0, 0.96, 0.88)} />
      <directionalLight position={[-4, 5, 6]} intensity={0.5} color={new THREE.Color(0.88, 0.92, 1.0)} />
      {/* Ground bounce */}
      <directionalLight position={[0, -3, 0]} intensity={0.15} color={new THREE.Color(0.95, 0.90, 0.85)} />

      {/* Shapes */}
      {shapes.map((s, i) => (
        <FloatingShape key={i} config={s} />
      ))}
    </>
  );
};

// ══════════════════════════════════════════════════════════════
// HUD
// ══════════════════════════════════════════════════════════════

const drawHUD = (ctx: CanvasRenderingContext2D, frame: number, total: number, w: number, h: number) => {
  ctx.clearRect(0, 0, w, h);
  const p = frame / total;
  const fadeIn = Math.min(frame / 20, 1);
  const fadeOut = Math.max(0, Math.min(1, (total - frame) / 25));
  const a = fadeIn * fadeOut;

  // "FOR YOUR TEAM."
  const hr = interpolate(p, [0.15, 0.35], [0, 1], { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const });
  if (hr > 0.02) {
    const ha = hr * a;
    const sc = interpolate(hr, [0, 1], [0.95, 1], { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const });

    ctx.save();
    ctx.globalAlpha = ha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(w / 2, h * 0.16);
    ctx.scale(sc, sc);

    ctx.font = '700 120px "Barlow Condensed", sans-serif';
    ctx.fillStyle = `rgba(18, 16, 14, ${0.88 * ha})`;
    ctx.fillText('FOR YOUR TEAM.', 0, 0);
    ctx.restore();
  }

  // Contact
  const cr = interpolate(p, [0.52, 0.68], [0, 1], { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const });
  if (cr > 0.02) {
    const ca = cr * a;
    const sy = interpolate(cr, [0, 1], [12, 0], { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const });
    ctx.save();
    ctx.globalAlpha = ca;
    ctx.textAlign = 'center';
    ctx.font = '400 20px "Geist Mono", "JetBrains Mono", monospace';
    ctx.fillStyle = `rgba(30, 28, 24, ${0.6 * ca})`;
    ctx.fillText('iancarlospr1@gmail.com  ·  linkedin.com/in/iancarlospr', w / 2, h * 0.90 + sy);
    ctx.restore();
  }

  // Label
  if (p > 0.65) {
    const la = interpolate(p, [0.65, 0.78], [0, 0.18], { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const }) * fadeOut;
    ctx.save();
    ctx.globalAlpha = la;
    ctx.font = '11px "Geist Mono", "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(60, 55, 48, 0.30)';
    ctx.textAlign = 'center';
    ctx.fillText('PBR MATERIALS  //  PROCEDURAL SKY  //  REACT THREE FIBER  //  REMOTION 4', w / 2, h - 32);
    ctx.restore();
  }
};

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

export const OutroTunnel: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const hudRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = hudRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawHUD(ctx, frame, durationInFrames, W, H);
  }, [frame, durationInFrames]);

  return (
    <AbsoluteFill style={{ background: '#c0d8ea' }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, position: [0, 2.5, 14], near: 0.1, far: 600 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ProductScene />
      </ThreeCanvas>

      <canvas
        ref={hudRef}
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </AbsoluteFill>
  );
};
