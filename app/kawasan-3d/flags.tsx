"use client";

// Jalur Gemilang flagpoles — a scene-dressing sibling (like <Billboards> /
// <Pedestrians>): a tall "hero" flag at the seat's own landmark zone
// (Pusat Bandar), plus a scattering of smaller ones at civic anchors
// (government/urban core, police/fire/hospital "community" zones,
// schools) so Malaysia's presence in the city isn't just implied by
// building types. The flag itself is a real Jalur Gemilang — 14
// alternating red/white stripes, the blue canton, a yellow crescent and
// 14-point star — drawn once to a shared CanvasTexture (same technique as
// the billboard ad textures) rather than a flat colour swatch.
//
// The "wave" is a cheap vertex-shader sine displacement (amplitude grows
// from zero at the pole to full at the free edge) rather than per-vertex
// CPU animation, so flag count is effectively free; a per-flag phase
// uniform keeps a whole city of them from fluttering in lockstep.

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, type CellPlacement, type ZoneKind } from "./cityData";

const TILE_H = 4;

// Built once, client-side only (canvas isn't available during SSR) and
// shared by every flag instance.
let sharedFlagTexture: THREE.CanvasTexture | null = null;
export function getFlagTexture(): THREE.CanvasTexture {
  if (sharedFlagTexture) return sharedFlagTexture;
  const W = 300, H = 150; // official 1:2 ratio
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;

  // 14 alternating stripes, red first
  const stripeH = H / 14;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 === 0 ? "#cc0001" : "#ffffff";
    g.fillRect(0, i * stripeH, W, stripeH);
  }
  // canton: 8/14 width, half height (spans the top 7 stripes)
  const cantonW = (8 / 14) * W;
  const cantonH = H / 2;
  g.fillStyle = "#010066";
  g.fillRect(0, 0, cantonW, cantonH);

  // crescent
  g.fillStyle = "#ffcc00";
  const ccx = cantonW * 0.36, ccy = cantonH * 0.5, cr = cantonH * 0.4;
  g.beginPath(); g.arc(ccx, ccy, cr, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#010066";
  g.beginPath(); g.arc(ccx + cr * 0.4, ccy, cr * 0.82, 0, Math.PI * 2); g.fill();

  // 14-point star
  g.fillStyle = "#ffcc00";
  const scx = cantonW * 0.72, scy = cantonH * 0.5;
  const outerR = cantonH * 0.42, innerR = outerR * 0.42;
  g.beginPath();
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = scx + Math.cos(ang) * r;
    const py = scy + Math.sin(ang) * r;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  sharedFlagTexture = tex;
  return tex;
}

const FLAG_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uFlagW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // pinned at the pole (local x=0), full amplitude at the free edge
    float t = clamp(pos.x / uFlagW, 0.0, 1.0);
    float amp = 0.55 * smoothstep(0.0, 1.0, t);
    pos.z += sin(pos.x * 0.9 + uTime * 3.1 + uPhase) * amp;
    pos.y += sin(pos.x * 0.55 + uTime * 2.3 + uPhase) * amp * 0.35;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const FLAG_FRAG = /* glsl */ `
  precision mediump float;
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(uMap, vUv).rgb, 1.0); }
`;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// Civic-feeling zone kinds: the government/urban core, the
// police/fire/hospital "community" cluster, and schools.
function flagWorthy(kind: ZoneKind): boolean {
  return kind === "urban" || kind === "community" || kind === "education";
}

type FlagSpec = { x: number; z: number; yaw: number; scale: number; phase: number };

function Flag({ spec, tex }: { spec: FlagSpec; tex: THREE.CanvasTexture }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const poleH = 42 * spec.scale;
  const flagW = 15 * spec.scale;
  const flagH = 7.5 * spec.scale;
  // pivot at the pole edge (local x=0) so the wave shader's amplitude
  // ramp reads correctly regardless of this flag's own scale
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(flagW, flagH, 7, 1);
    g.translate(flagW / 2, 0, 0);
    return g;
  }, [flagW, flagH]);
  useEffect(() => () => geo.dispose(), [geo]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPhase: { value: spec.phase }, uFlagW: { value: flagW }, uMap: { value: tex } }),
    [spec.phase, flagW, tex],
  );
  useFrame((_, dt) => { if (matRef.current) (matRef.current.uniforms.uTime.value as number) += dt; });

  return (
    <group position={[spec.x, TILE_H, spec.z]} rotation={[0, spec.yaw, 0]}>
      <mesh position={[0, poleH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.9 * spec.scale, 1.1 * spec.scale, poleH, 8]} />
        <meshStandardMaterial color="#c7ccd2" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[1.0 * spec.scale, poleH - flagH * 0.6, 0]} geometry={geo} castShadow>
        <shaderMaterial
          ref={matRef}
          vertexShader={FLAG_VERT}
          fragmentShader={FLAG_FRAG}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function Flags({
  placed, gridSize, landmarkZoneId, claimed,
}: {
  placed: CellPlacement[];
  gridSize: number;
  landmarkZoneId?: string;
  claimed?: Set<string>;
}) {
  // canvas isn't available during SSR — build the shared texture once
  // mounted, client-side.
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => { setTex(getFlagTexture()); }, []);

  const specs = useMemo(() => {
    const out: FlagSpec[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const isLandmark = zone.id === landmarkZoneId;
      if (!isLandmark && !flagWorthy(zone.kind)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const rnd = rng(hashSeed(`${zone.id}:flag`));
      if (!isLandmark) {
        // Civic zone kinds recur often once the base archetypes cycle
        // (see cityData.ts's makeZones note) — thin these out so it
        // reads as "flags at civic buildings here and there", not a
        // flag on every third rooftop at Dense Metro.
        const chance = gridSize >= 22 ? 0.1 : gridSize >= 14 ? 0.18 : 0.32;
        if (rnd() > chance + coreness * 0.15) continue;
      }
      const corner = rnd() < 0.5 ? -1 : 1;
      const side = rnd() < 0.5 ? -1 : 1;
      out.push({
        x: cx + corner * (PLOT / 2 - 26),
        z: cz + side * (PLOT / 2 - 26),
        yaw: rnd() * Math.PI * 2,
        scale: isLandmark ? 1.7 : 0.85 + rnd() * 0.3,
        phase: rnd() * Math.PI * 2,
      });
    }
    return out;
  }, [placed, gridSize, landmarkZoneId, claimed]);

  if (!tex || !specs.length) return null;
  return (
    <group>
      {specs.map((s, i) => <Flag key={i} spec={s} tex={tex} />)}
    </group>
  );
}
