"use client";

// Bukit-Bintang-style LED billboards / ad screens for the dense presets.
// A scene-dressing sibling (like <Trees> / <StreetLamps>): iterates the
// placed zones, seeds a few billboard sites per eligible zone, and draws
// them as flat unlit ("screen") panels — one InstancedMesh PER COLOUR
// VARIANT, so the whole city's billboards cost ~6 draw calls regardless
// of count. `toneMapped:false` makes the panels read as lit by day and
// bloom hard at night; a throttled colour pulse gives a "playing content"
// feel with no textures or video.

import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, type CellPlacement, type ZoneKind } from "./cityData";

const TILE_H = 4;

// Placeholder screen colours — deliberately varied so a run of billboards
// down a street doesn't read as a repeat.
const VARIANTS = ["#2f6bff", "#ff5a2a", "#eef2ff", "#12e6ff", "#ff3fd0", "#ffd23f"] as const;
const BASE = VARIANTS.map((h) => new THREE.Color(h));

// which tile edge a facade panel hangs on: [dirX, dirZ, yaw-to-face-out]
const EDGES: [number, number, number][] = [
  [0, -1, 0],
  [0, 1, Math.PI],
  [-1, 0, -Math.PI / 2],
  [1, 0, Math.PI / 2],
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function billboardCount(kind: ZoneKind, coreness: number, gridSize: number): number {
  if (gridSize <= 6) return 0; // rural: none
  const urbanish = kind === "urban" || kind === "commercial" || kind === "market";
  if (gridSize <= 8) return urbanish && coreness > 0.35 ? 1 : 0; // semi: a few
  // metro / dense metro
  let n = urbanish
    ? Math.round(1 + coreness * 3.2) // 1..4
    : (kind === "community" || kind === "education") && coreness > 0.55
      ? 1
      : 0;
  if (gridSize >= 22) n = Math.min(n, 2); // keep the 30×30 count sane
  return n;
}

type Panel = {
  x: number; y: number; z: number; yaw: number;
  w: number; h: number; variant: number;
};

export function Billboards({
  placed, gridSize, winLit, claimed,
}: {
  placed: CellPlacement[];
  gridSize: number;
  winLit: number;
  claimed?: Set<string>;
}) {
  const winLitRef = useRef(winLit);
  winLitRef.current = winLit;

  const { panels, poles } = useMemo(() => {
    const panels: Panel[] = [];
    const poles: { x: number; z: number; h: number }[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;

    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = billboardCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:bb`));

      // one panel per distinct edge (shuffled), so they don't stack
      const edges = [0, 1, 2, 3].sort(() => rnd() - 0.5);
      for (let i = 0; i < n; i++) {
        const [dx, dz, yaw] = EDGES[edges[i % 4]];
        const margin = 10;
        // lateral slide along the edge
        const slide = (rnd() - 0.5) * (PLOT - 90);
        const roll = rnd();
        // size class: big Bukit-Bintang screen / medium / low shop strip
        const [w, h, y] =
          roll < 0.22 ? [58 + rnd() * 24, 34 + rnd() * 12, 60 + rnd() * 70]
            : roll < 0.7 ? [30 + rnd() * 14, 17 + rnd() * 9, 30 + rnd() * 60]
              : [18 + rnd() * 8, 8 + rnd() * 4, 9 + rnd() * 6];
        panels.push({
          x: cx + dx * (PLOT / 2 - margin) + (dx === 0 ? slide : 0),
          z: cz + dz * (PLOT / 2 - margin) + (dz === 0 ? slide : 0),
          y: TILE_H + y,
          yaw,
          w,
          h,
          variant: Math.floor(rnd() * VARIANTS.length),
        });
      }

      // occasional freestanding screen tower at a tile corner (a plaza /
      // civic-square feel) in the built-up kinds
      const urbanish = zone.kind === "urban" || zone.kind === "commercial" || zone.kind === "market";
      const civic = zone.kind === "community" || zone.kind === "education";
      if (gridSize >= 10 && ((urbanish && rnd() < 0.18) || (civic && rnd() < 0.1))) {
        const sx = rnd() < 0.5 ? -1 : 1;
        const sz = rnd() < 0.5 ? -1 : 1;
        const px = cx + sx * (PLOT / 2 - 26);
        const pz = cz + sz * (PLOT / 2 - 26);
        const ph = 44 + rnd() * 22;
        poles.push({ x: px, z: pz, h: ph });
        panels.push({
          x: px, z: pz, y: TILE_H + ph + 15, yaw: rnd() * Math.PI * 2,
          w: 34 + rnd() * 14, h: 24 + rnd() * 10,
          variant: Math.floor(rnd() * VARIANTS.length),
        });
      }
    }
    return { panels, poles };
  }, [placed, gridSize, claimed]);

  const byVariant = useMemo(() => {
    const m: Panel[][] = VARIANTS.map(() => []);
    for (const p of panels) m[p.variant].push(p);
    return m;
  }, [panels]);

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const acc = useRef(0);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    byVariant.forEach((list, vi) => {
      const mesh = meshRefs.current[vi];
      if (!mesh) return;
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(p.w, p.h, 2.4);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    const pole = poleRef.current;
    if (pole) {
      poles.forEach((p, i) => {
        dummy.position.set(p.x, TILE_H + p.h / 2, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(2.6, p.h, 2.6);
        dummy.updateMatrix();
        pole.setMatrixAt(i, dummy.matrix);
      });
      pole.instanceMatrix.needsUpdate = true;
      pole.computeBoundingSphere();
    }
  }, [byVariant, poles]);

  // brightness / hue pulse — "screen is playing", plus a big night boost
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.09) return;
    acc.current = 0;
    const now = performance.now() / 1000;
    const night = 1 + winLitRef.current * 1.35;
    for (let vi = 0; vi < VARIANTS.length; vi++) {
      const mat = matRefs.current[vi];
      if (!mat) continue;
      const pulse = 0.68 + 0.32 * Math.sin(now * 0.75 + vi * 1.7);
      mat.color.copy(BASE[vi]).multiplyScalar(pulse * night);
    }
  });

  if (!panels.length) return null;
  return (
    <group>
      {byVariant.map((list, vi) =>
        list.length ? (
          <instancedMesh
            key={`bb-${vi}-${list.length}`}
            ref={(r) => { meshRefs.current[vi] = r; }}
            args={[undefined, undefined, list.length]}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              ref={(r) => { matRefs.current[vi] = r as THREE.MeshBasicMaterial | null; }}
              toneMapped={false}
            />
          </instancedMesh>
        ) : null,
      )}
      {poles.length ? (
        <instancedMesh ref={poleRef} args={[undefined, undefined, poles.length]} castShadow key={`bbp-${poles.length}`}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#2a2f38" roughness={0.8} metalness={0.3} />
        </instancedMesh>
      ) : null}
    </group>
  );
}
