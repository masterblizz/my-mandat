"use client";

// Two-wheelers — a scene-dressing sibling to <Traffic> / <Pedestrians>.
//   Motorcyclists ride the SAME road network as cars (reusing the loop
//   machinery from scenery.tsx) but on their own lane hugging the kerb,
//   and are only lightly slowed by jam density — motorbikes filtering
//   past queued cars at peak hour is a defining feature of Malaysian
//   traffic, not something to smooth away.
//   Cyclists ride the sidewalk-perimeter loop <Pedestrians> uses, just
//   outside the pedestrian ring — a leisure lap of the block on two
//   wheels, not road traffic, so no signals to obey.

import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  roadsV, roadsH, worldCentre, PLOT, ROAD_GAP, type CellPlacement, type ZoneKind,
} from "./cityData";
import { blockLoop, roundaboutLoop, posAt, signalStateFor, type Loop } from "./scenery";
import { roundaboutCentre } from "./roundabout";

const ROAD_W = ROAD_GAP - PLOT;
const TILE_H = 4;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// ── motorcyclists ───────────────────────────────────────────────────
const MC_COLORS = ["#e2382a", "#1c9dd6", "#1a1c22", "#f2b705", "#e7ecf2", "#22c55e"];
const MC_BASE_SPEED = 84;
const MC_ACCEL = 160;
const MC_BRAKE = 300;
const MC_ARC_SPEED = 30;
const MC_GAP = 10;
const MC_STOP_MARGIN = 8;
const MC_BRAKE_LOOKAHEAD = 100;

type Rider = { loop: number; s: number; speed: number; color: THREE.Color; helmet: THREE.Color };

export function Motorcyclists({ gridSize, trafficLevel = 0.5 }: { gridSize: number; trafficLevel?: number }) {
  const centre = worldCentre(gridSize);
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  const { loops, riders } = useMemo(() => {
    let seed = gridSize * 733 + 19;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const xs = roadsV(gridSize).map((x) => x - centre + ROAD_W / 2);
    const zs = roadsH(gridSize).map((z) => z - centre + ROAD_W / 2);
    const laneOff = ROAD_W * 0.06; // hugs the kerb — a distinct lane from cars' 0.2
    const turnR = ROAD_W * 0.42;

    const loops: Loop[] = [];
    const riders: Rider[] = [];
    const addTo = (loopIdx: number, n: number) => {
      const L = loops[loopIdx].L;
      for (let k = 0; k < n; k++) {
        riders.push({
          loop: loopIdx,
          s: ((k + rnd()) / n) * L,
          speed: MC_BASE_SPEED * (0.75 + rnd() * 0.3),
          color: new THREE.Color(MC_COLORS[Math.floor(rnd() * MC_COLORS.length)]),
          helmet: new THREE.Color(MC_COLORS[Math.floor(rnd() * MC_COLORS.length)]),
        });
      }
    };

    const maxLoops = gridSize >= 22 ? 140 : gridSize >= 14 ? 180 : 9999;
    const perLoop = gridSize >= 22 ? 5 : gridSize >= 14 ? 4 : gridSize <= 6 ? 2 : 4;
    const mid = (xs.length - 1) / 2;
    const order: [number, number][] = [];
    for (let a = 0; a < xs.length - 1; a++)
      for (let b = 0; b < zs.length - 1; b++) order.push([a, b]);
    order.sort((p, q) => (Math.hypot(p[0] - mid, p[1] - mid) - Math.hypot(q[0] - mid, q[1] - mid)));
    for (const [a, b] of order) {
      if (loops.length >= maxLoops) break;
      // a different coverage roll from <Traffic>'s cars, same central-
      // junction exclusion (those quarter-turns sit inside the roundabout
      // island).
      if (((a * 41 + b * 67 + gridSize) % 100) >= 60) continue;
      const h = gridSize / 2;
      if ((a === h - 1 || a === h) && (b === h - 1 || b === h)) continue;
      loops.push(blockLoop(xs[a], xs[a + 1], zs[b], zs[b + 1], laneOff, turnR));
      addTo(loops.length - 1, perLoop);
    }
    if (gridSize >= 6) {
      const [rcx, rcz] = roundaboutCentre(gridSize);
      loops.push(roundaboutLoop(rcx, rcz, 100));
      addTo(loops.length - 1, 6);
    }
    return { loops, riders };
  }, [gridSize, centre]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const riderRef = useRef<THREE.InstancedMesh>(null);
  const helmetRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const perLoopIdx = useMemo(() => {
    const g: number[][] = loops.map(() => []);
    riders.forEach((c, i) => g[c.loop].push(i));
    g.forEach((arr) => arr.sort((p, q) => riders[p].s - riders[q].s));
    return g;
  }, [loops, riders]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const rider = riderRef.current;
    const helmet = helmetRef.current;
    const lights = lightRef.current;
    if (!body || !rider || !helmet || !lights) return;
    riders.forEach((c, i) => {
      body.setColorAt(i, c.color);
      rider.setColorAt(i, new THREE.Color("#33363f"));
      helmet.setColorAt(i, c.helmet);
      lights.setColorAt(i * 2, new THREE.Color("#fff3c4"));
      lights.setColorAt(i * 2 + 1, new THREE.Color("#ff3b30"));
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (rider.instanceColor) rider.instanceColor.needsUpdate = true;
    if (helmet.instanceColor) helmet.instanceColor.needsUpdate = true;
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  }, [riders]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const wheels = wheelRef.current;
    const rider = riderRef.current;
    const helmet = helmetRef.current;
    const lights = lightRef.current;
    if (!body || !wheels || !rider || !helmet || !lights) return;
    const step = Math.min(dt, 0.05);
    const now = performance.now() / 1000;
    const lv = Math.max(0, Math.min(1, levelRef.current));
    // Bikes filter through traffic — only a gentle slowdown at peak,
    // nothing like the near-gridlock cars endure.
    const baseSpeed = MC_BASE_SPEED * (1 - 0.22 * lv);
    const activeFrac = 0.55 + 0.45 * lv;

    const park = (ci: number) => {
      dummy.position.set(0, -1000, 0);
      dummy.scale.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      body.setMatrixAt(ci, dummy.matrix);
      rider.setMatrixAt(ci, dummy.matrix);
      helmet.setMatrixAt(ci, dummy.matrix);
      for (let n = 0; n < 2; n++) { wheels.setMatrixAt(ci * 2 + n, dummy.matrix); lights.setMatrixAt(ci * 2 + n, dummy.matrix); }
    };

    for (let li = 0; li < loops.length; li++) {
      const loop = loops[li];
      const ring = perLoopIdx[li];
      const nActive = Math.max(1, Math.min(ring.length, Math.round(ring.length * activeFrac)));
      const activeIdx: number[] = [];
      const used = new Set<number>();
      for (let j = 0; j < nActive; j++) {
        const ki = Math.min(ring.length - 1, Math.floor((j * ring.length) / nActive));
        activeIdx.push(ki);
        used.add(ki);
      }
      for (let k = 0; k < ring.length; k++) if (!used.has(k)) park(ring[k]);

      for (let ai = activeIdx.length - 1; ai >= 0; ai--) {
        const k = activeIdx[ai];
        const ci = ring[k];
        const c = riders[ci];

        let target = baseSpeed;
        let sMod = c.s % loop.L; if (sMod < 0) sMod += loop.L;
        for (const p of loop.pieces) {
          if (sMod >= p.s0 && sMod < p.s0 + p.len) { if (p.kind === "arc") target = Math.min(target, MC_ARC_SPEED); break; }
        }
        let gateHold = Infinity;
        for (const gate of loop.gates) {
          let d = gate.s - sMod;
          if (d < -4) d += loop.L;
          if (d < 0) d = 0;
          if (d > MC_BRAKE_LOOKAHEAD) continue;
          const st = signalStateFor(gate.axisIsX, now);
          if (st === 2) { gateHold = Math.min(gateHold, c.s + d - MC_STOP_MARGIN); target = Math.min(target, 0); }
          else if (st === 1) target = Math.min(target, d > 30 ? baseSpeed * 0.4 : 0);
        }

        const ahead = nActive > 1 ? riders[ring[activeIdx[(ai + 1) % nActive]]] : null;
        let gapHold = Infinity;
        if (ahead) {
          let as = ahead.s;
          while (as <= c.s) as += loop.L;
          gapHold = as - MC_GAP;
        }

        const accel = target >= c.speed ? MC_ACCEL : MC_BRAKE;
        c.speed += Math.sign(target - c.speed) * accel * step;
        if (c.speed < 0) c.speed = 0;
        if (c.speed > baseSpeed) c.speed = baseSpeed;
        let ns = c.s + c.speed * step;
        if (ns > gapHold) { ns = Math.max(c.s, gapHold); c.speed = 0; }
        if (ns > gateHold) { ns = Math.max(c.s, gateHold); c.speed = 0; }
        c.s = ns;

        const [x, z] = posAt(loop, c.s);
        const [x2, z2] = posAt(loop, c.s + 2);
        const heading = Math.atan2(z2 - z, x2 - x);
        const cos = Math.cos(heading), sin = Math.sin(heading);
        const local = (fwd: number, side: number) => [x + cos * fwd - sin * side, z + sin * fwd + cos * side] as const;

        dummy.position.set(x, 3.1, z);
        dummy.rotation.set(0, heading, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(ci, dummy.matrix);

        dummy.position.set(x, 5.6, z);
        dummy.updateMatrix();
        rider.setMatrixAt(ci, dummy.matrix);

        dummy.position.set(x, 7.6, z);
        dummy.updateMatrix();
        helmet.setMatrixAt(ci, dummy.matrix);

        [-3.4, 3.4].forEach((f, n) => {
          const [wx, wz] = local(f, 0);
          dummy.position.set(wx, 1.6, wz);
          dummy.rotation.set(Math.PI / 2, heading, 0);
          dummy.updateMatrix();
          wheels.setMatrixAt(ci * 2 + n, dummy.matrix);
        });
        dummy.rotation.set(0, heading, 0);
        const [hx, hz] = local(4.6, 0);
        dummy.position.set(hx, 3.4, hz);
        dummy.updateMatrix();
        lights.setMatrixAt(ci * 2, dummy.matrix);
        const [tx, tz] = local(-4.6, 0);
        dummy.position.set(tx, 3.4, tz);
        dummy.updateMatrix();
        lights.setMatrixAt(ci * 2 + 1, dummy.matrix);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    rider.instanceMatrix.needsUpdate = true;
    helmet.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
  });

  if (!riders.length) return null;
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, riders.length]} key={`mc-body-${riders.length}`} castShadow>
        <boxGeometry args={[7.5, 3.2, 2.6]} />
        <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={wheelRef} args={[undefined, undefined, riders.length * 2]} key={`mc-wheel-${riders.length}`} castShadow>
        <cylinderGeometry args={[1.6, 1.6, 0.9, 8]} />
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={riderRef} args={[undefined, undefined, riders.length]} key={`mc-rider-${riders.length}`} castShadow>
        <boxGeometry args={[2.6, 4.2, 3.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={helmetRef} args={[undefined, undefined, riders.length]} key={`mc-helmet-${riders.length}`} castShadow>
        <sphereGeometry args={[1.15, 7, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, riders.length * 2]} key={`mc-light-${riders.length}`}>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ── cyclists ────────────────────────────────────────────────────────
const CYC_COLORS = ["#e2382a", "#1c9dd6", "#22c55e", "#f2b705", "#a855f7", "#111827"];

function cycCount(kind: ZoneKind, coreness: number, gridSize: number): number {
  const busy = kind === "urban" || kind === "commercial" || kind === "market"
    || kind === "education" || kind === "community" || kind === "village" || kind === "housing";
  if (!busy) return 0;
  if (gridSize <= 6) return coreness > 0.5 ? 1 : 0;
  let n = Math.round(coreness * 1.6);
  if (gridSize >= 22) n = Math.min(n, 1);
  return n;
}

type CycRider = { cx: number; cz: number; s: number; speed: number; phase: number; color: THREE.Color };

export function Cyclists({
  placed, gridSize, trafficLevel = 0.5, claimed, avoidCentre,
}: {
  placed: CellPlacement[];
  gridSize: number;
  trafficLevel?: number;
  claimed?: Set<string>;
  /** Central roundabout centre — see <Pedestrians>'s note; same fix applies
      to the cyclists' outer ring. */
  avoidCentre?: [number, number] | null;
}) {
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  const R = PLOT / 2 + 9; // just outside <Pedestrians>' sidewalk ring
  const segLen = 2 * R;
  const perim = 8 * R;

  const riders = useMemo(() => {
    const out: CycRider[] = [];
    const mid = (gridSize - 1) / 2;
    const maxD = Math.hypot(mid, mid) || 1;
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      if (avoidCentre && Math.hypot(cx - avoidCentre[0], cz - avoidCentre[1]) < PLOT) continue;
      const coreness = 1 - Math.hypot(col - mid, row - mid) / maxD;
      const n = cycCount(zone.kind, coreness, gridSize);
      if (!n) continue;
      const rnd = rng(hashSeed(`${zone.id}:cyc`));
      for (let i = 0; i < n; i++) {
        out.push({
          cx, cz,
          s: rnd() * perim,
          speed: 16 + rnd() * 10,
          phase: rnd() * Math.PI * 2,
          color: new THREE.Color(CYC_COLORS[Math.floor(rnd() * CYC_COLORS.length)]),
        });
      }
    }
    return out;
  }, [placed, gridSize, claimed, avoidCentre, perim]);

  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const riderRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const rider = riderRef.current;
    if (!rider) return;
    riders.forEach((p, i) => rider.setColorAt(i, p.color));
    if (rider.instanceColor) rider.instanceColor.needsUpdate = true;
  }, [riders]);

  useFrame((_, dt) => {
    const wheels = wheelRef.current;
    const frame = frameRef.current;
    const rider = riderRef.current;
    const head = headRef.current;
    if (!wheels || !frame || !rider || !head) return;
    const step = Math.min(dt, 0.05);
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const active = Math.max(1, Math.round(riders.length * (0.4 + 0.6 * lv)));
    const paceMul = 0.8 + 0.4 * lv;

    for (let i = 0; i < riders.length; i++) {
      if (i >= active) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        for (let n = 0; n < 2; n++) wheels.setMatrixAt(i * 2 + n, dummy.matrix);
        frame.setMatrixAt(i, dummy.matrix);
        rider.setMatrixAt(i, dummy.matrix);
        head.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const p = riders[i];
      p.s = (p.s + p.speed * paceMul * step) % perim;
      const seg = Math.floor(p.s / segLen);
      const t = (p.s - seg * segLen) / segLen;
      let x: number, z: number, heading: number;
      if (seg === 0) { x = p.cx - R + t * segLen; z = p.cz - R; heading = 0; }
      else if (seg === 1) { x = p.cx + R; z = p.cz - R + t * segLen; heading = Math.PI / 2; }
      else if (seg === 2) { x = p.cx + R - t * segLen; z = p.cz + R; heading = Math.PI; }
      else { x = p.cx - R; z = p.cz + R - t * segLen; heading = -Math.PI / 2; }

      const cos = Math.cos(heading), sin = Math.sin(heading);
      const local = (fwd: number) => [x + cos * fwd, z + sin * fwd] as const;
      const bob = Math.sin(p.phase + p.s * 0.4) * 0.15;

      [-2.6, 2.6].forEach((f, n) => {
        const [wx, wz] = local(f);
        dummy.position.set(wx, TILE_H + 1.5, wz);
        dummy.rotation.set(Math.PI / 2, heading, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        wheels.setMatrixAt(i * 2 + n, dummy.matrix);
      });

      dummy.position.set(x, TILE_H + 2.2, z);
      dummy.rotation.set(0, heading, 0);
      dummy.updateMatrix();
      frame.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, TILE_H + 4.4 + bob, z);
      dummy.updateMatrix();
      rider.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, TILE_H + 6.6 + bob, z);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
    }
    wheels.instanceMatrix.needsUpdate = true;
    frame.instanceMatrix.needsUpdate = true;
    rider.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
  });

  if (!riders.length) return null;
  return (
    <group>
      <instancedMesh ref={wheelRef} args={[undefined, undefined, riders.length * 2]} key={`cyc-wheel-${riders.length}`} castShadow>
        <cylinderGeometry args={[1.3, 1.3, 0.35, 10]} />
        <meshStandardMaterial color="#1a1d22" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={frameRef} args={[undefined, undefined, riders.length]} key={`cyc-frame-${riders.length}`} castShadow>
        <boxGeometry args={[5.4, 0.5, 0.5]} />
        <meshStandardMaterial color="#8a8f98" roughness={0.5} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={riderRef} args={[undefined, undefined, riders.length]} key={`cyc-rider-${riders.length}`} castShadow>
        <boxGeometry args={[1.6, 3.4, 1.3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, riders.length]} key={`cyc-head-${riders.length}`} castShadow>
        <sphereGeometry args={[1.0, 7, 6]} />
        <meshStandardMaterial color="#caa987" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
