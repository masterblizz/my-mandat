"use client";

// Walking people — a scene-dressing sibling (like <Traffic> / <Trees>).
// Two behaviours, both in one pair of InstancedMeshes (body + head):
//   • LOOP  — strolls the sidewalk perimeter of one developed tile.
//   • CROSS — walks back and forth across the adjacent road at a corner
//             crossing, holding at the kerb until the conflicting
//             traffic's signal is red (reuses signalStateFor()).
// Density scales with zone kind × how central the tile is × the live
// trafficLevel (peak hour ⇒ more people, brisker pace).

import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, ROAD_GAP, type CellPlacement, type ZoneKind } from "./cityData";
import { signalStateFor } from "./scenery";

const TILE_H = 4;
const ROAD_W = ROAD_GAP - PLOT;
const SHIRTS = ["#e2e8f0", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#111827", "#14b8a6"];
const SHIRT_COL = SHIRTS.map((h) => new THREE.Color(h));

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function pedCount(kind: ZoneKind, coreness: number, gridSize: number): number {
  if (gridSize <= 6) return 0;
  const busy = kind === "urban" || kind === "commercial" || kind === "market";
  const mid = kind === "housing" || kind === "community" || kind === "village" || kind === "education";
  let n = busy ? Math.round(4 + coreness * 5) : mid ? Math.round(2 + coreness * 2) : 1;
  if (gridSize >= 22) n = Math.min(n, 5);
  return n;
}

type Ped = {
  cx: number; cz: number;
  speed: number; phase: number; color: number;
  cross: boolean;
  // LOOP
  s: number;
  // CROSS
  axisX: boolean;   // walking along world X (true) or Z (false)
  from: number;     // start coord on the walk axis (at the near kerb)
  span: number;     // signed length across the road
  lat: number;      // fixed coord on the other axis
  u: number;        // 0..1 progress across
  dir: 1 | -1;
  wait: number;     // kerb hold timer
};

export function Pedestrians({
  placed, gridSize, trafficLevel = 0.5, claimed,
}: {
  placed: CellPlacement[];
  gridSize: number;
  trafficLevel?: number;
  claimed?: Set<string>;
}) {
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  const R = PLOT / 2 + 5;   // sidewalk perimeter line, just outside the plot
  const segLen = 2 * R;
  const perim = 8 * R;

  const peds = useMemo(() => {
    const out: Ped[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = pedCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:ped`));
      for (let i = 0; i < n; i++) {
        const cross = rnd() < 0.34;
        const axisX = rnd() < 0.5;
        const edgeSign = rnd() < 0.5 ? -1 : 1;
        const latSign = rnd() < 0.5 ? -1 : 1;
        const nearKerb = PLOT / 2 + 3;
        out.push({
          cx, cz,
          speed: 7 + rnd() * 5,
          phase: rnd() * Math.PI * 2,
          color: Math.floor(rnd() * SHIRTS.length),
          cross,
          s: rnd() * perim,
          axisX,
          from: edgeSign * nearKerb,           // relative to cx or cz
          span: edgeSign * (ROAD_W - 6),        // signed distance across the road
          lat: latSign * (PLOT / 2 - 22),       // near a corner crosswalk
          u: rnd(),
          dir: rnd() < 0.5 ? 1 : -1,
          wait: 0,
        });
      }
    }
    return out;
  }, [placed, gridSize, claimed, perim]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    peds.forEach((p, i) => body.setColorAt(i, SHIRT_COL[p.color]));
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  }, [peds]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const step = Math.min(dt, 0.05);
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const active = Math.max(1, Math.round(peds.length * (0.32 + 0.68 * lv)));
    const paceMul = 0.7 + 0.5 * lv;
    const now = performance.now() / 1000;

    for (let i = 0; i < peds.length; i++) {
      if (i >= active) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        head.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const p = peds[i];
      let x: number;
      let z: number;
      let heading: number;
      let travel: number;

      if (p.cross) {
        // conflicting traffic runs perpendicular to the ped's walk axis:
        // ped walking X crosses a Z-road (axisIsX = false) and vice versa.
        const clear = signalStateFor(!p.axisX, now) === 2;
        if (p.wait > 0) {
          p.wait -= step;
        } else if (clear || (p.u > 0.05 && p.u < 0.95)) {
          p.u += (p.dir * p.speed * paceMul * step) / Math.abs(p.span);
          if (p.u >= 1) { p.u = 1; p.dir = -1; p.wait = 1.5 + (p.phase % 2); }
          else if (p.u <= 0) { p.u = 0; p.dir = 1; p.wait = 1.5 + (p.phase % 2); }
        }
        travel = p.from + p.span * p.u;
        if (p.axisX) { x = p.cx + travel; z = p.cz + p.lat; heading = p.span > 0 ? 0 : Math.PI; }
        else { x = p.cx + p.lat; z = p.cz + travel; heading = p.span > 0 ? Math.PI / 2 : -Math.PI / 2; }
      } else {
        p.s = (p.s + p.speed * paceMul * step) % perim;
        const seg = Math.floor(p.s / segLen);
        const t = (p.s - seg * segLen) / segLen;
        if (seg === 0) { x = p.cx - R + t * segLen; z = p.cz - R; heading = 0; }
        else if (seg === 1) { x = p.cx + R; z = p.cz - R + t * segLen; heading = Math.PI / 2; }
        else if (seg === 2) { x = p.cx + R - t * segLen; z = p.cz + R; heading = Math.PI; }
        else { x = p.cx - R; z = p.cz + R - t * segLen; heading = -Math.PI / 2; }
        travel = p.s;
      }

      const bob = Math.sin(p.phase + travel * 0.5) * 0.6;
      dummy.rotation.set(0, heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, TILE_H + 4.4 + bob, z);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, TILE_H + 8.6 + bob, z);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  if (!peds.length) return null;
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, peds.length]} key={`ped-b-${peds.length}`} castShadow>
        <boxGeometry args={[1.8, 5.6, 1.6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, peds.length]} key={`ped-h-${peds.length}`} castShadow>
        <sphereGeometry args={[1.35, 6, 5]} />
        <meshStandardMaterial color="#caa987" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
