"use client";

// Walking people — a scene-dressing sibling (like <Traffic> / <Trees>).
// Each pedestrian loops the sidewalk perimeter of one developed tile at a
// stroll; density scales with zone kind × how central the tile is × the
// live trafficLevel (peak hour = more people out). Two InstancedMeshes
// (body + head) for the whole city, so the cost is a per-frame matrix
// write per active pedestrian and nothing else.

import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, type CellPlacement, type ZoneKind } from "./cityData";

const TILE_H = 4;
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

type Ped = { cx: number; cz: number; s: number; speed: number; phase: number; color: number };

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

  const peds = useMemo(() => {
    const out: Ped[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    const R = PLOT / 2 + 5; // sidewalk line, just outside the plot
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = pedCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:ped`));
      for (let i = 0; i < n; i++) {
        out.push({
          cx, cz,
          s: rnd() * (8 * R),
          speed: 7 + rnd() * 5,
          phase: rnd() * Math.PI * 2,
          color: Math.floor(rnd() * SHIRTS.length),
        });
      }
    }
    return out;
  }, [placed, gridSize, claimed]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const R = PLOT / 2 + 5;
  const segLen = 2 * R;
  const perim = 8 * R;

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
    const spd = 0.7 + 0.5 * lv; // brisker at peak

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
      p.s = (p.s + p.speed * spd * step) % perim;
      const seg = Math.floor(p.s / segLen);
      const t = (p.s - seg * segLen) / segLen;
      let x = p.cx;
      let z = p.cz;
      let heading = 0;
      if (seg === 0) { x = p.cx - R + t * segLen; z = p.cz - R; heading = 0; }
      else if (seg === 1) { x = p.cx + R; z = p.cz - R + t * segLen; heading = Math.PI / 2; }
      else if (seg === 2) { x = p.cx + R - t * segLen; z = p.cz + R; heading = Math.PI; }
      else { x = p.cx - R; z = p.cz + R - t * segLen; heading = -Math.PI / 2; }

      const bob = Math.sin(p.phase + p.s * 0.5) * 0.6;
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
