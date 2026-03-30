import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { GrainOverlay } from './GrainOverlay';

/**
 * Scene 1: "IMAGINE" — Palantir Tactical Terrain Map
 *
 * GPU-accelerated WebGL fragment shader rendering a military-grade
 * terrain visualization inspired by Palantir Gotham / C2 systems.
 *
 * Technical layers:
 *   1. Multi-octave fractal Brownian motion terrain heightmap (8 octaves)
 *   2. Hypsometric tinting (elevation-based coloring)
 *   3. Contour lines with major/minor intervals
 *   4. Hillshade / relief shading (directional light)
 *   5. Military coordinate grid overlay (MGRS-style)
 *   6. Radar sweep with phosphor persistence
 *   7. Animated unit markers (vehicles, aerial assets)
 *   8. Tactical HUD overlay (canvas 2D layer)
 *   9. "IMAGINE" integrated as command prompt text
 *
 * The terrain slowly pans and the camera subtly tilts over time,
 * creating a living C2 display that breathes.
 */

const W = 1920;
const H = 1080;

// ══════════════════════════════════════════════════════════════
// WebGL VERTEX SHADER
// ══════════════════════════════════════════════════════════════
const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// ══════════════════════════════════════════════════════════════
// WebGL FRAGMENT SHADER — Tactical Terrain Renderer
// ══════════════════════════════════════════════════════════════
const FRAGMENT_SHADER = `
#ifdef GL_ES
precision highp float;
#endif

uniform float uTime;
uniform float uProgress;    // 0→1 scene progress
uniform float uFadeIn;      // 0→1 fade-in
uniform float uFadeOut;     // 1→0 fade-out
uniform vec2  uResolution;

// ── Simplex-style noise (hash-based, no textures) ──────────

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// ── Fractal Brownian Motion (8 octaves) ─────────────────────

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  // Domain warping: feed noise into itself for more organic shapes
  float warp = snoise(p * 0.5 + vec3(3.7, 1.2, 0.0)) * 0.3;
  p.xy += warp;

  for (int i = 0; i < 8; i++) {
    value += amplitude * snoise(p * frequency);
    frequency *= 2.04;  // slightly > 2 for less repetition
    amplitude *= 0.48;  // persistence
  }
  return value;
}

// ── Ridge noise for mountain ridges ─────────────────────────

float ridgeNoise(vec3 p) {
  float n = snoise(p);
  n = 1.0 - abs(n);   // fold
  n = n * n;           // sharpen
  return n;
}

float ridgeFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float prev = 1.0;
  for (int i = 0; i < 6; i++) {
    float n = ridgeNoise(p * frequency);
    value += n * amplitude * prev;
    prev = n;
    frequency *= 2.1;
    amplitude *= 0.45;
  }
  return value;
}

// ── Terrain height function ─────────────────────────────────

float terrain(vec2 uv, float time) {
  vec3 p = vec3(uv * 3.5, time * 0.02);

  // Base continental shape
  float h = fbm(p) * 0.6;

  // Mountain ridges
  h += ridgeFbm(p * 1.2 + vec3(10.0, 20.0, 0.0)) * 0.35;

  // Fine detail erosion channels
  float erosion = fbm(p * 4.0 + vec3(50.0, 80.0, time * 0.01)) * 0.08;
  h -= abs(erosion);

  // Valley carving
  float valley = snoise(vec3(uv * 1.5, time * 0.015));
  h -= smoothstep(0.0, 0.15, abs(valley)) * 0.0;
  h += smoothstep(0.15, 0.0, abs(valley)) * (-0.12);

  return h;
}

// ── Compute normal from heightmap (central differences) ─────

vec3 terrainNormal(vec2 uv, float time) {
  float eps = 0.003;
  float hL = terrain(uv - vec2(eps, 0.0), time);
  float hR = terrain(uv + vec2(eps, 0.0), time);
  float hD = terrain(uv - vec2(0.0, eps), time);
  float hU = terrain(uv + vec2(0.0, eps), time);
  return normalize(vec3(hL - hR, hD - hU, 2.0 * eps * 4.0));
}

// ── Hypsometric color palette (elevation → color) ───────────

vec3 elevationColor(float h) {
  // Deep ocean → shallow → coast → lowland → highland → peak
  vec3 deepOcean  = vec3(0.020, 0.035, 0.065);
  vec3 ocean      = vec3(0.025, 0.055, 0.090);
  vec3 shallows   = vec3(0.030, 0.080, 0.110);
  vec3 coast      = vec3(0.040, 0.100, 0.080);
  vec3 lowland    = vec3(0.045, 0.120, 0.065);
  vec3 midland    = vec3(0.060, 0.140, 0.055);
  vec3 highland   = vec3(0.080, 0.160, 0.050);
  vec3 mountain   = vec3(0.090, 0.170, 0.060);
  vec3 peak       = vec3(0.100, 0.200, 0.080);
  vec3 summit     = vec3(0.130, 0.250, 0.110);

  // Normalized height mapping
  float n = clamp((h + 0.6) / 1.2, 0.0, 1.0);

  vec3 col;
  if (n < 0.15) col = mix(deepOcean, ocean, n / 0.15);
  else if (n < 0.25) col = mix(ocean, shallows, (n - 0.15) / 0.10);
  else if (n < 0.35) col = mix(shallows, coast, (n - 0.25) / 0.10);
  else if (n < 0.45) col = mix(coast, lowland, (n - 0.35) / 0.10);
  else if (n < 0.55) col = mix(lowland, midland, (n - 0.45) / 0.10);
  else if (n < 0.65) col = mix(midland, highland, (n - 0.55) / 0.10);
  else if (n < 0.75) col = mix(highland, mountain, (n - 0.65) / 0.10);
  else if (n < 0.85) col = mix(mountain, peak, (n - 0.75) / 0.10);
  else col = mix(peak, summit, (n - 0.85) / 0.15);

  return col;
}

// ── Contour lines ───────────────────────────────────────────

float contourLine(float h, float interval, float thickness) {
  float v = abs(fract(h / interval + 0.5) - 0.5) * interval;
  return 1.0 - smoothstep(0.0, thickness, v);
}

// ── Grid overlay (MGRS-style) ───────────────────────────────

float gridLine(vec2 uv, float spacing, float thickness) {
  vec2 g = abs(fract(uv / spacing + 0.5) - 0.5) * spacing;
  float d = min(g.x, g.y);
  return 1.0 - smoothstep(0.0, thickness, d);
}

// ── Radar sweep ─────────────────────────────────────────────

float radarSweep(vec2 uv, vec2 center, float angle, float width) {
  vec2 d = uv - center;
  float a = atan(d.y, d.x);
  float diff = mod(a - angle + 3.14159, 6.28318) - 3.14159;
  // Sweep trail with exponential falloff
  float sweep = smoothstep(width, 0.0, diff) * smoothstep(-0.05, 0.0, diff);
  // Phosphor persistence (trailing glow)
  float trail = exp(-abs(diff) * 3.0) * step(0.0, diff) * 0.4;
  return sweep + trail;
}

// ── Unit marker (triangle pointing in heading direction) ────

float unitMarker(vec2 uv, vec2 pos, float heading, float size) {
  vec2 d = uv - pos;
  // Rotate into unit's local space
  float c = cos(-heading);
  float s = sin(-heading);
  vec2 r = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  // Triangle SDF
  r /= size;
  float tri = max(abs(r.x) * 1.5 + r.y * 0.5, -r.y * 0.7) - 0.35;
  return 1.0 - smoothstep(0.0, 0.015 / size, tri);
}

// ── Diamond marker (aerial asset) ───────────────────────────

float diamondMarker(vec2 uv, vec2 pos, float size) {
  vec2 d = abs(uv - pos) / size;
  float diamond = d.x + d.y - 0.35;
  return 1.0 - smoothstep(0.0, 0.015 / size, diamond);
}

// ── Heading indicator line ──────────────────────────────────

float headingLine(vec2 uv, vec2 pos, float heading, float len) {
  vec2 dir = vec2(cos(heading), sin(heading));
  vec2 d = uv - pos;
  float proj = dot(d, dir);
  float perp = length(d - dir * proj);
  return smoothstep(0.002, 0.0, perp) *
         smoothstep(0.0, 0.01, proj) *
         smoothstep(len, len - 0.01, proj);
}

// ── Pulsing ring (target designator) ────────────────────────

float pulseRing(vec2 uv, vec2 center, float time, float baseRadius) {
  float dist = length(uv - center);
  float pulse = baseRadius + sin(time * 3.0) * 0.008;
  float ring = abs(dist - pulse);
  return smoothstep(0.003, 0.0, ring);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 uvA = uv * aspect;

  float time = uTime;

  // ── Slow pan/drift ──
  vec2 pan = vec2(time * 0.008, time * 0.005);
  vec2 terrainUV = uvA * 1.8 + pan;

  // ── Terrain height ──
  float h = terrain(terrainUV, time);

  // ── Normal & hillshade ──
  vec3 normal = terrainNormal(terrainUV, time);
  vec3 lightDir = normalize(vec3(0.7, 0.5, 0.9));
  float shade = dot(normal, lightDir) * 0.5 + 0.5;
  shade = pow(shade, 1.4);

  // ── Base color from elevation ──
  vec3 col = elevationColor(h);

  // Apply hillshade
  col *= (0.5 + shade * 0.8);

  // ── Ambient occlusion approximation ──
  float ao = smoothstep(-0.3, 0.3, h) * 0.3 + 0.7;
  col *= ao;

  // ── Contour lines ──
  float minorContour = contourLine(h, 0.05, 0.0015);
  float majorContour = contourLine(h, 0.20, 0.003);

  vec3 contourColorMinor = vec3(0.0, 0.90, 0.65) * 0.2;
  vec3 contourColorMajor = vec3(0.0, 0.95, 0.70) * 0.45;

  col = mix(col, contourColorMinor, minorContour * 0.5);
  col = mix(col, contourColorMajor, majorContour * 0.8);

  // ── Grid overlay ──
  float majorGrid = gridLine(terrainUV, 0.5, 0.003);
  float minorGrid = gridLine(terrainUV, 0.125, 0.001);

  col = mix(col, vec3(0.0, 0.6, 0.5) * 0.15, minorGrid * 0.25);
  col = mix(col, vec3(0.0, 0.7, 0.55) * 0.3, majorGrid * 0.4);

  // ── Radar sweep ──
  vec2 sweepCenter = vec2(0.5 * aspect.x, 0.5);
  float sweepAngle = time * 1.2;
  float sweep = radarSweep(uvA, sweepCenter, sweepAngle, 0.6);

  // Sweep illumination: brightens terrain it passes over
  vec3 sweepColor = vec3(0.0, 0.85, 0.55);
  col += sweepColor * sweep * 0.12;

  // ── Unit markers (ground vehicles) ──
  // 4 ground units on patrol routes
  float markers = 0.0;
  vec3 markerColor = vec3(0.0, 1.0, 0.7);

  // Unit Alpha — circular patrol
  float aHeading = time * 0.4;
  vec2 aPos = vec2(0.35, 0.40) * aspect + vec2(cos(time * 0.15) * 0.12, sin(time * 0.15) * 0.08);
  markers += unitMarker(uvA, aPos, aHeading, 0.015);
  markers += headingLine(uvA, aPos, aHeading, 0.035);
  markers += pulseRing(uvA, aPos, time, 0.025);

  // Unit Bravo — linear advance
  vec2 bPos = vec2(0.6, 0.3) * aspect + vec2(sin(time * 0.12) * 0.15, time * 0.005);
  float bHeading = 0.3 + sin(time * 0.2) * 0.2;
  markers += unitMarker(uvA, bPos, bHeading, 0.013);
  markers += headingLine(uvA, bPos, bHeading, 0.03);

  // Unit Charlie — flanking maneuver
  vec2 cPos = vec2(0.75, 0.65) * aspect + vec2(cos(time * 0.18 + 1.0) * 0.1, sin(time * 0.1) * 0.12);
  float cHeading = time * 0.3 + 1.5;
  markers += unitMarker(uvA, cPos, cHeading, 0.012);
  markers += headingLine(uvA, cPos, cHeading, 0.028);

  // Unit Delta — holding position, rotating turret
  vec2 dPos = vec2(0.45, 0.72) * aspect;
  float dHeading = time * 0.6;
  markers += unitMarker(uvA, dPos, dHeading, 0.014);
  markers += pulseRing(uvA, dPos, time + 1.5, 0.022);

  // ── Aerial assets (diamond markers) ──
  vec3 airColor = vec3(0.2, 0.6, 1.0);
  float airMarkers = 0.0;

  // Drone 1 — wide orbit
  vec2 d1Pos = vec2(0.5, 0.5) * aspect + vec2(cos(time * 0.25) * 0.25, sin(time * 0.25) * 0.18);
  airMarkers += diamondMarker(uvA, d1Pos, 0.011);
  airMarkers += headingLine(uvA, d1Pos, time * 0.25 + 1.5708, 0.04);

  // Drone 2 — fast pass
  vec2 d2Pos = vec2(mod(time * 0.04, 1.8), 0.3 + sin(time * 0.3) * 0.05) * aspect;
  airMarkers += diamondMarker(uvA, d2Pos, 0.009);

  // ── Compose markers ──
  col = mix(col, markerColor, clamp(markers, 0.0, 1.0) * 0.9);
  col = mix(col, airColor, clamp(airMarkers, 0.0, 1.0) * 0.85);

  // ── Vignette ──
  float vig = 1.0 - length((uv - 0.5) * 1.6);
  vig = smoothstep(0.0, 0.7, vig);
  col *= vig * 0.85 + 0.15;

  // ── Scanline effect (subtle CRT) ──
  float scanline = sin(gl_FragCoord.y * 1.5) * 0.015 + 1.0;
  col *= scanline;

  // ── Edge glow (screen border) ──
  float edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float edgeGlow = smoothstep(0.03, 0.0, edgeDist);
  col += vec3(0.0, 0.6, 0.4) * edgeGlow * 0.15;

  // ── Global tint toward cyan/green tactical ──
  col = col * vec3(0.75, 1.1, 1.0);

  // ── Fade in/out ──
  col *= uFadeIn * uFadeOut;

  // ── Gamma ──
  col = pow(col, vec3(0.92));

  gl_FragColor = vec4(col, 1.0);
}
`;

// ══════════════════════════════════════════════════════════════
// HUD Overlay — Canvas 2D (rendered on top of WebGL terrain)
// ══════════════════════════════════════════════════════════════

const drawHUD = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  totalFrames: number,
  w: number,
  h: number,
) => {
  ctx.clearRect(0, 0, w, h);

  const progress = frame / totalFrames;
  const fadeIn = Math.min(frame / 20, 1);
  const fadeOut = Math.max(0, Math.min(1, (totalFrames - frame) / 25));
  const alpha = fadeIn * fadeOut;

  ctx.globalAlpha = alpha;
  const cyan = 'rgba(0, 220, 160, ';
  const cyanDim = 'rgba(0, 180, 130, ';
  const cyanBright = 'rgba(0, 255, 190, ';

  // ── Corner brackets ──
  const bracketSize = 60;
  const bracketThick = 2;
  const margin = 40;
  ctx.strokeStyle = cyan + '0.5)';
  ctx.lineWidth = bracketThick;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(margin, margin + bracketSize);
  ctx.lineTo(margin, margin);
  ctx.lineTo(margin + bracketSize, margin);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - margin - bracketSize, margin);
  ctx.lineTo(w - margin, margin);
  ctx.lineTo(w - margin, margin + bracketSize);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(margin, h - margin - bracketSize);
  ctx.lineTo(margin, h - margin);
  ctx.lineTo(margin + bracketSize, h - margin);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - margin - bracketSize, h - margin);
  ctx.lineTo(w - margin, h - margin);
  ctx.lineTo(w - margin, h - margin - bracketSize);
  ctx.stroke();

  // ── Top-left data block ──
  const mono = '13px "Geist Mono", "JetBrains Mono", monospace';
  const monoSm = '11px "Geist Mono", "JetBrains Mono", monospace';
  ctx.font = mono;
  ctx.textBaseline = 'top';

  const tlX = margin + 16;
  const tlY = margin + 16;

  const lat = (34.0522 + Math.sin(frame * 0.005) * 0.003).toFixed(6);
  const lng = (-118.2437 + Math.cos(frame * 0.004) * 0.004).toFixed(6);

  ctx.fillStyle = cyanDim + '0.6)';
  ctx.fillText('COORD', tlX, tlY);
  ctx.fillStyle = cyan + '0.85)';
  ctx.fillText(`${lat}°N  ${lng}°W`, tlX, tlY + 18);

  ctx.fillStyle = cyanDim + '0.6)';
  ctx.fillText('ALT RANGE', tlX, tlY + 42);
  ctx.fillStyle = cyan + '0.85)';
  ctx.fillText('0m — 4,280m MSL', tlX, tlY + 60);

  ctx.fillStyle = cyanDim + '0.6)';
  ctx.fillText('GRID', tlX, tlY + 84);
  ctx.fillStyle = cyan + '0.85)';
  ctx.fillText('MGRS 11S MT 8410 0632', tlX, tlY + 102);

  // ── Top-right status block ──
  const trX = w - margin - 16;
  ctx.textAlign = 'right';

  ctx.fillStyle = cyanDim + '0.6)';
  ctx.fillText('SYS STATUS', trX, tlY);
  ctx.fillStyle = cyanBright + '0.9)';
  ctx.fillText('● OPERATIONAL', trX, tlY + 18);

  ctx.fillStyle = cyanDim + '0.6)';
  ctx.fillText('TERRAIN FEED', trX, tlY + 42);
  ctx.fillStyle = cyan + '0.85)';
  ctx.fillText('LIVE — 30 FPS', trX, tlY + 60);

  ctx.fillStyle = cyanDim + '0.6)';
  ctx.fillText('UNITS TRACKED', trX, tlY + 84);
  ctx.fillStyle = cyan + '0.85)';
  ctx.fillText('GND: 4  AIR: 2  TOTAL: 6', trX, tlY + 102);

  ctx.textAlign = 'left';

  // ── Bottom-left elevation legend ──
  const legendX = margin + 16;
  const legendY = h - margin - 160;
  const legendW = 16;
  const legendH = 140;

  ctx.fillStyle = cyanDim + '0.5)';
  ctx.font = monoSm;
  ctx.fillText('ELEV (m)', legendX, legendY - 8);

  // Gradient bar
  const grad = ctx.createLinearGradient(legendX, legendY + legendH, legendX, legendY);
  grad.addColorStop(0, 'rgba(10, 18, 33, 0.8)');
  grad.addColorStop(0.3, 'rgba(15, 40, 45, 0.8)');
  grad.addColorStop(0.5, 'rgba(20, 60, 35, 0.8)');
  grad.addColorStop(0.7, 'rgba(30, 80, 30, 0.8)');
  grad.addColorStop(1, 'rgba(50, 100, 45, 0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(legendX, legendY, legendW, legendH);

  ctx.strokeStyle = cyan + '0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY, legendW, legendH);

  // Tick marks
  const elevLabels = ['4280', '3200', '2100', '1000', '0'];
  ctx.fillStyle = cyan + '0.6)';
  ctx.font = monoSm;
  for (let i = 0; i < elevLabels.length; i++) {
    const y = legendY + (i / (elevLabels.length - 1)) * legendH;
    ctx.fillText(elevLabels[i]!, legendX + legendW + 6, y + 3);
    ctx.beginPath();
    ctx.moveTo(legendX + legendW, y);
    ctx.lineTo(legendX + legendW + 3, y);
    ctx.stroke();
  }

  // ── Bottom-right — timestamp + classification ──
  ctx.textAlign = 'right';
  const brX = w - margin - 16;
  const brY = h - margin - 60;

  const elapsed = (frame / 30).toFixed(1);
  const timestamp = `T+${elapsed}s`;

  ctx.font = mono;
  ctx.fillStyle = cyan + '0.7)';
  ctx.fillText(timestamp, brX, brY);

  ctx.font = monoSm;
  ctx.fillStyle = cyanDim + '0.4)';
  ctx.fillText('PALANTIR GOTHAM // TERRAIN INTELLIGENCE', brX, brY + 20);

  // ── Classification banner ──
  ctx.fillStyle = 'rgba(0, 180, 130, 0.06)';
  ctx.fillRect(0, h - 28, w, 28);
  ctx.font = '11px "Geist Mono", monospace';
  ctx.fillStyle = cyanDim + '0.35)';
  ctx.textAlign = 'center';
  ctx.fillText(
    'TOP SECRET // SI // NOFORN // TERRAIN ANALYSIS SYSTEM v4.2.1',
    w / 2,
    h - 12,
  );

  // ── Center reticle (subtle) ──
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = cyan + '0.2)';
  ctx.lineWidth = 1;

  // Crosshair
  const reticleGap = 18;
  const reticleLen = 35;
  ctx.beginPath();
  ctx.moveTo(cx - reticleGap - reticleLen, cy);
  ctx.lineTo(cx - reticleGap, cy);
  ctx.moveTo(cx + reticleGap, cy);
  ctx.lineTo(cx + reticleGap + reticleLen, cy);
  ctx.moveTo(cx, cy - reticleGap - reticleLen);
  ctx.lineTo(cx, cy - reticleGap);
  ctx.moveTo(cx, cy + reticleGap);
  ctx.lineTo(cx, cy + reticleGap + reticleLen);
  ctx.stroke();

  // Rotating range ring
  const ringRadius = 55 + Math.sin(frame * 0.08) * 5;
  ctx.beginPath();
  const ringStart = frame * 0.03;
  ctx.arc(cx, cy, ringRadius, ringStart, ringStart + Math.PI * 1.2);
  ctx.strokeStyle = cyan + '0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── "IMAGINE" command text ──
  const imagineAlpha = interpolate(frame, [35, 60], [0, 1], {
    extrapolateLeft: 'clamp' as const,
    extrapolateRight: 'clamp' as const,
  });
  const imagineScale = interpolate(frame, [35, 65], [0.92, 1], {
    extrapolateLeft: 'clamp' as const,
    extrapolateRight: 'clamp' as const,
  });
  const imagineFadeOut = interpolate(
    frame,
    [totalFrames - 30, totalFrames - 10],
    [1, 0],
    { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const },
  );

  if (imagineAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * imagineAlpha * imagineFadeOut;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Command prompt prefix
    ctx.font = '18px "Geist Mono", monospace';
    ctx.fillStyle = 'rgba(0, 180, 130, 0.6)';
    ctx.fillText('GOTHAM://CMD >', cx, cy - 55);

    // Main text
    ctx.translate(cx, cy);
    ctx.scale(imagineScale, imagineScale);

    // Glow layer
    ctx.shadowColor = 'rgba(0, 255, 190, 0.4)';
    ctx.shadowBlur = 30;
    ctx.font = '700 88px "Barlow Condensed", sans-serif';
    ctx.fillStyle = 'rgba(0, 255, 200, 0.9)';
    ctx.letterSpacing = '0.18em';
    ctx.fillText('IMAGINE', 0, 0);

    // Crisp layer on top
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(220, 255, 245, 0.95)';
    ctx.fillText('IMAGINE', 0, 0);

    ctx.restore();

    // Blinking cursor after text
    ctx.save();
    ctx.globalAlpha = alpha * imagineAlpha * imagineFadeOut;
    const cursorBlink = Math.sin(frame * 0.2) > 0 ? 1 : 0;
    ctx.fillStyle = `rgba(0, 255, 190, ${0.7 * cursorBlink})`;
    ctx.font = '700 88px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left';
    const textWidth = ctx.measureText('IMAGINE').width;
    ctx.fillRect(cx + textWidth / 2 + 14, cy - 32, 3, 64);
    ctx.restore();
  }

  // ── Scanning data ticker (bottom, scrolling) ──
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.font = monoSm;
  ctx.fillStyle = cyan + '0.5)';
  ctx.textAlign = 'left';
  const tickerY = h - margin - 100;
  const tickerTexts = [
    'ANALYZING TERRAIN TOPOLOGY...',
    'UNIT ALPHA: PATROL ROUTE NOMINAL',
    'DRONE-1: ORBIT STABLE AT FL120',
    'CONTOUR MAPPING: 50m INTERVALS',
    'ELEVATION MODEL: SRTM 30m',
    'THREAT ASSESSMENT: LOW',
    'SIGNAL INTERCEPT: NONE',
    'WEATHER: CLEAR, VIS 10KM+',
  ];
  const tickerOffset = (frame * 2) % (tickerTexts.length * 280);
  for (let i = 0; i < tickerTexts.length; i++) {
    const x = margin + 16 + i * 280 - tickerOffset;
    if (x > -300 && x < w) {
      ctx.fillText(tickerTexts[i]!, x, tickerY);
    }
  }
  ctx.restore();

  ctx.globalAlpha = 1;
};

// ══════════════════════════════════════════════════════════════
// React Component
// ══════════════════════════════════════════════════════════════

interface GlState {
  gl: WebGLRenderingContext;
  timeLoc: WebGLUniformLocation;
  progressLoc: WebGLUniformLocation;
  fadeInLoc: WebGLUniformLocation;
  fadeOutLoc: WebGLUniformLocation;
  resLoc: WebGLUniformLocation;
}

export const OutroParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);

  // ── Initialize WebGL ──
  const initGl = useCallback((canvas: HTMLCanvasElement): GlState | null => {
    const gl = canvas.getContext('webgl', {
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return null;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const pos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    return {
      gl,
      timeLoc: gl.getUniformLocation(program, 'uTime')!,
      progressLoc: gl.getUniformLocation(program, 'uProgress')!,
      fadeInLoc: gl.getUniformLocation(program, 'uFadeIn')!,
      fadeOutLoc: gl.getUniformLocation(program, 'uFadeOut')!,
      resLoc: gl.getUniformLocation(program, 'uResolution')!,
    };
  }, []);

  // ── Init on mount ──
  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas || glRef.current) return;
    glRef.current = initGl(canvas);
  }, [initGl]);

  // ── Render each frame ──
  const progress = frame / durationInFrames;
  const time = frame / fps;
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // WebGL terrain render
  useEffect(() => {
    const ctx = glRef.current;
    if (!ctx) return;
    const { gl, timeLoc, progressLoc, fadeInLoc, fadeOutLoc, resLoc } = ctx;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(timeLoc, time);
    gl.uniform1f(progressLoc, progress);
    gl.uniform1f(fadeInLoc, fadeIn);
    gl.uniform1f(fadeOutLoc, fadeOut);
    gl.uniform2f(resLoc, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [frame, time, progress, fadeIn, fadeOut]);

  // HUD canvas render
  useEffect(() => {
    const canvas = hudCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawHUD(ctx, frame, durationInFrames, W, H);
  }, [frame, durationInFrames]);

  return (
    <AbsoluteFill style={{ background: '#050808' }}>
      {/* WebGL terrain layer */}
      <canvas
        ref={glCanvasRef}
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* HUD overlay layer */}
      <canvas
        ref={hudCanvasRef}
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      <GrainOverlay opacity={0.04} />
    </AbsoluteFill>
  );
};
