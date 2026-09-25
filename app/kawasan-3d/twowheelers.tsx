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

import { useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  roadsV, roadsH, worldCentre, PLOT, ROAD_GAP, type CellPlacement, type ZoneKind,
} from "./cityData";
import { blockLoop, roundaboutLoop, posAt, signalStateFor, type Loop } from "./scenery";
import { roundaboutCentre } from "./roundabout";

const ROAD_W = ROAD_GAP - PLOT;
const TILE_H = 4;

function approach(value: number, target: number, amount: number) {
  return value + THREE.MathUtils.clamp(target - value, -amount, amount);
}

function tangent(loop: Loop, s: number) {
  const a = posAt(loop, s - 0.5), b = posAt(loop, s + 0.5);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

function cornerLean(loop: Loop, s: number, speed: number, limit: number) {
  const turn = tangent(loop, s + 4) - tangent(loop, s - 4);
  const curvature = Math.atan2(Math.sin(turn), Math.cos(turn)) / 8;
  return THREE.MathUtils.clamp(Math.atan(speed * speed * curvature / 180), -limit, limit);
}

function useWheelGeometry(radius: number, width: number) {
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius, radius, width, 10);
    g.rotateX(Math.PI / 2); // axle along local Z; local X is forward
    return g;
  }, [radius, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

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

type Rider = { loop: number; s: number; speed: number; lean: number; spin: number; color: THREE.Color; helmet: THREE.Color };

export function Motorcyclists({
  gridSize, trafficLevel = 0.5, riverRoadIndex = null, roadIndices,
}: {
  gridSize: number;
  trafficLevel?: number;
  riverRoadIndex?: number | null;
  /** Road indexes that remain asphalt after internal lanes become superblocks. */
  roadIndices?: { vertical: number[]; horizontal: number[] };
}) {
  const centre = worldCentre(gridSize);
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  const { loops, riders } = useMemo(() => {
    let seed = gridSize * 733 + 19;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const xs = (roadIndices?.vertical ?? roadsV(gridSize).map((_, index) => index))
      .map((index) => index * ROAD_GAP - centre + ROAD_W / 2);
    const zs = (roadIndices?.horizontal ?? roadsH(gridSize).map((_, index) => index))
      .map((index) => index * ROAD_GAP - centre + ROAD_W / 2);
    // Motorcycles filter on the kerb-side strip of Malaysia's left lane.
    // The arc consumes the remaining asphalt up to the plot corner, keeping
    // riders clear of both the car lane and the centre of the junction.
    const laneOff = ROAD_W * 0.35;
    const turnR = ROAD_W / 2 - laneOff;

    const loops: Loop[] = [];
    const riders: Rider[] = [];
    const addTo = (loopIdx: number, n: number) => {
      const L = loops[loopIdx].L;
      for (let k = 0; k < n; k++) {
        riders.push({
          loop: loopIdx,
          s: ((k + rnd()) / n) * L,
          speed: MC_BASE_SPEED * (0.75 + rnd() * 0.3),
          lean: 0, spin: 0,
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
      const leftRoad = roadIndices?.vertical?.[a] ?? a;
      const rightRoad = roadIndices?.vertical?.[a + 1] ?? a + 1;
      if (riverRoadIndex !== null && (leftRoad === riverRoadIndex || rightRoad === riverRoadIndex)) continue;
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
  }, [gridSize, centre, riverRoadIndex, roadIndices]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const spokeRef = useRef<THREE.InstancedMesh>(null);
  const riderRef = useRef<THREE.InstancedMesh>(null);
  const helmetRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const wheelGeometry = useWheelGeometry(1.6, 0.9);

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
    const spokes = spokeRef.current;
    const rider = riderRef.current;
    const helmet = helmetRef.current;
    const lights = lightRef.current;
    if (!body || !wheels || !spokes || !rider || !helmet || !lights) return;
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
      for (let n = 0; n < 2; n++) { wheels.setMatrixAt(ci * 2 + n, dummy.matrix); spokes.setMatrixAt(ci * 2 + n, dummy.matrix); lights.setMatrixAt(ci * 2 + n, dummy.matrix); }
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
          if (p.kind !== "arc") continue;
          const inside = sMod >= p.s0 && sMod < p.s0 + p.len;
          const distance = inside ? 0 : (p.s0 - sMod + loop.L) % loop.L;
          target = Math.min(target, Math.sqrt(MC_ARC_SPEED ** 2 + 2 * MC_BRAKE * distance));
        }
        let gateHold = Infinity;
        for (const gate of loop.gates) {
          let d = gate.s - sMod;
          if (d < -4) d += loop.L;
          if (d < 0) d = 0;
          if (d > MC_BRAKE_LOOKAHEAD) continue;
          const st = signalStateFor(gate.axisIsX, now);
          if (st === 2 || (st === 1 && d > MC_STOP_MARGIN + c.speed * c.speed / (2 * MC_BRAKE))) {
            gateHold = Math.min(gateHold, c.s + d - MC_STOP_MARGIN);
            target = Math.min(target, Math.sqrt(2 * MC_BRAKE * Math.max(0, d - MC_STOP_MARGIN)));
          }
        }

        const ahead = nActive > 1 ? riders[ring[activeIdx[(ai + 1) % nActive]]] : null;
        let gapHold = Infinity;
        if (ahead) {
          let as = ahead.s;
          while (as <= c.s) as += loop.L;
          gapHold = as - MC_GAP;
          target = Math.min(target, Math.sqrt(ahead.speed ** 2 + 2 * MC_BRAKE * Math.max(0, gapHold - c.s)));
        }

        const accel = target >= c.speed ? MC_ACCEL : MC_BRAKE;
        c.speed = approach(c.speed, target, accel * step);
        if (c.speed < 0) c.speed = 0;
        if (c.speed > baseSpeed) c.speed = baseSpeed;
        let ns = c.s + c.speed * step;
        if (ns > gapHold) { ns = Math.max(c.s, gapHold); c.speed = 0; }
        if (ns > gateHold) { ns = Math.max(c.s, gateHold); c.speed = 0; }
        c.spin = (c.spin + (ns - c.s) / 1.6) % (Math.PI * 2);
        c.s = ns;
        c.lean = THREE.MathUtils.lerp(c.lean, cornerLean(loop, c.s, c.speed, 0.32), 1 - Math.exp(-8 * step));

        const [x, z] = posAt(loop, c.s);
        const heading = tangent(loop, c.s);
        const cos = Math.cos(heading), sin = Math.sin(heading);
        const local = (fwd: number, side: number) => [x + cos * fwd - sin * side, z + sin * fwd + cos * side] as const;

        const roadY = loop.gates.length === 0 ? TILE_H + 0.4 : 0.8;
        const leanPosition = (height: number, fwd = 0) => {
          const side = Math.sin(c.lean) * (height - 1.6);
          dummy.position.set(x + cos * fwd - sin * side,
            roadY + 1.6 + Math.cos(c.lean) * (height - 1.6), z + sin * fwd + cos * side);
        };
        leanPosition(3.1);
        dummy.rotation.set(c.lean, -heading, 0, "YXZ");
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(ci, dummy.matrix);

        leanPosition(5.6, 0.3);
        dummy.rotation.set(c.lean, -heading, -0.12, "YXZ");
        dummy.updateMatrix();
        rider.setMatrixAt(ci, dummy.matrix);

        leanPosition(7.6, 0.6);
        dummy.updateMatrix();
        helmet.setMatrixAt(ci, dummy.matrix);

        [-3.4, 3.4].forEach((f, n) => {
          const [wx, wz] = local(f, 0);
          dummy.position.set(wx, roadY + 1.6, wz);
          dummy.rotation.set(c.lean, -heading, -c.spin, "YXZ");
          dummy.updateMatrix();
          wheels.setMatrixAt(ci * 2 + n, dummy.matrix);
          spokes.setMatrixAt(ci * 2 + n, dummy.matrix);
        });
        dummy.rotation.set(c.lean, -heading, 0, "YXZ");
        leanPosition(3.4, 4.6);
        dummy.updateMatrix();
        lights.setMatrixAt(ci * 2, dummy.matrix);
        leanPosition(3.4, -4.6);
        dummy.updateMatrix();
        lights.setMatrixAt(ci * 2 + 1, dummy.matrix);
      }
    }
    body.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    spokes.instanceMatrix.needsUpdate = true;
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
      <instancedMesh ref={wheelRef} geometry={wheelGeometry} args={[undefined, undefined, riders.length * 2]} key={`mc-wheel-${riders.length}`} castShadow>
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={riderRef} args={[undefined, undefined, riders.length]} key={`mc-rider-${riders.length}`} castShadow>
        <boxGeometry args={[2.6, 4.2, 3.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={spokeRef} args={[undefined, undefined, riders.length * 2]} key={`mc-spoke-${riders.length}`} frustumCulled={false}>
        <boxGeometry args={[2.3, 0.2, 0.94]} />
        <meshStandardMaterial color="#9aa7b4" metalness={0.6} roughness={0.4} />
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

type CycRider = { cx: number; cz: number; s: number; speed: number; phase: number; lean: number; spin: number; color: THREE.Color };

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
  const cycleLoop = useMemo(() => blockLoop(-R, R, -R, R, 0, 12), [R]);
  const perim = cycleLoop.L;

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
          lean: 0, spin: 0,
          color: new THREE.Color(CYC_COLORS[Math.floor(rnd() * CYC_COLORS.length)]),
        });
      }
    }
    return out;
  }, [placed, gridSize, claimed, avoidCentre, perim]);

  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const spokeRef = useRef<THREE.InstancedMesh>(null);
  const riderRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const wheelGeometry = useWheelGeometry(1.3, 0.35);
  const limbStart = useMemo(() => new THREE.Vector3(), []);
  const limbEnd = useMemo(() => new THREE.Vector3(), []);
  const limbDirection = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useLayoutEffect(() => {
    const rider = riderRef.current;
    if (!rider) return;
    riders.forEach((p, i) => rider.setColorAt(i, p.color));
    if (rider.instanceColor) rider.instanceColor.needsUpdate = true;
  }, [riders]);

  useFrame((_, dt) => {
    const wheels = wheelRef.current;
    const frame = frameRef.current;
    const spokes = spokeRef.current;
    const rider = riderRef.current;
    const head = headRef.current;
    const legs = legRef.current;
    if (!wheels || !frame || !spokes || !rider || !head || !legs) return;
    const step = Math.min(dt, 0.05);
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const active = Math.max(1, Math.round(riders.length * (0.4 + 0.6 * lv)));
    const paceMul = 0.8 + 0.4 * lv;

    for (let i = 0; i < riders.length; i++) {
      if (i >= active) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        for (let n = 0; n < 2; n++) {
          wheels.setMatrixAt(i * 2 + n, dummy.matrix);
          spokes.setMatrixAt(i * 2 + n, dummy.matrix);
        }
        frame.setMatrixAt(i, dummy.matrix);
        rider.setMatrixAt(i, dummy.matrix);
        head.setMatrixAt(i, dummy.matrix);
        for (let n = 0; n < 4; n++) legs.setMatrixAt(i * 4 + n, dummy.matrix);
        continue;
      }
      const p = riders[i];
      const speed = p.speed * paceMul;
      const travel = speed * step;
      p.s = (p.s + travel) % perim;
      p.spin = (p.spin + travel / 1.3) % (Math.PI * 2);
      p.phase = (p.phase + travel * 0.24) % (Math.PI * 2);
      p.lean = THREE.MathUtils.lerp(p.lean, cornerLean(cycleLoop, p.s, speed, 0.22), 1 - Math.exp(-7 * step));
      const [px, pz] = posAt(cycleLoop, p.s);
      const x = p.cx + px, z = p.cz + pz;
      const heading = tangent(cycleLoop, p.s);

      const cos = Math.cos(heading), sin = Math.sin(heading);
      const local = (fwd: number) => [x + cos * fwd, z + sin * fwd] as const;
      const bob = Math.sin(p.phase * 2) * 0.09;
      const bodyPosition = (fwd: number, height: number, side = 0) => {
        const lateral = side * Math.cos(p.lean) + (height - 1.5) * Math.sin(p.lean);
        return [x + cos * fwd - sin * lateral,
          TILE_H + 1.5 + (height - 1.5) * Math.cos(p.lean) - side * Math.sin(p.lean),
          z + sin * fwd + cos * lateral] as const;
      };

      [-2.6, 2.6].forEach((f, n) => {
        const [wx, wz] = local(f);
        dummy.position.set(wx, TILE_H + 1.5, wz);
        dummy.rotation.set(p.lean, -heading, -p.spin, "YXZ");
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        wheels.setMatrixAt(i * 2 + n, dummy.matrix);
        spokes.setMatrixAt(i * 2 + n, dummy.matrix);
      });

      dummy.position.set(...bodyPosition(0, 2.2));
      dummy.rotation.set(p.lean, -heading, 0, "YXZ");
      dummy.updateMatrix();
      frame.setMatrixAt(i, dummy.matrix);

      dummy.position.set(...bodyPosition(0.25, 4.4 + bob));
      dummy.rotation.set(p.lean, -heading, -0.22, "YXZ");
      dummy.updateMatrix();
      rider.setMatrixAt(i, dummy.matrix);

      dummy.position.set(...bodyPosition(0.8, 6.6 + bob));
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
      for (let side = 0; side < 2; side++) {
        const phase = p.phase + side * Math.PI;
        const lateral = side === 0 ? -0.65 : 0.65;
        const hip = bodyPosition(-0.3, 3.5 + bob, lateral);
        const knee = bodyPosition(0.75 + Math.cos(phase) * 0.4, 2.75 + Math.sin(phase) * 0.4, lateral);
        const foot = bodyPosition(Math.cos(phase) * 0.7, 1.55 + Math.sin(phase) * 0.7, lateral);
        for (let part = 0; part < 2; part++) {
          limbStart.set(...(part === 0 ? hip : knee));
          limbEnd.set(...(part === 0 ? knee : foot));
          limbDirection.subVectors(limbEnd, limbStart);
          dummy.position.copy(limbStart).add(limbEnd).multiplyScalar(0.5);
          dummy.scale.set(0.42, limbDirection.length(), 0.42);
          dummy.quaternion.setFromUnitVectors(up, limbDirection.normalize());
          dummy.updateMatrix();
          legs.setMatrixAt(i * 4 + side * 2 + part, dummy.matrix);
        }
      }
    }
    wheels.instanceMatrix.needsUpdate = true;
    frame.instanceMatrix.needsUpdate = true;
    spokes.instanceMatrix.needsUpdate = true;
    rider.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
  });

  if (!riders.length) return null;
  return (
    <group>
      <instancedMesh ref={wheelRef} geometry={wheelGeometry} args={[undefined, undefined, riders.length * 2]} key={`cyc-wheel-${riders.length}`} castShadow>
        <meshStandardMaterial color="#1a1d22" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={frameRef} args={[undefined, undefined, riders.length]} key={`cyc-frame-${riders.length}`} castShadow>
        <boxGeometry args={[5.4, 0.5, 0.5]} />
        <meshStandardMaterial color="#8a8f98" roughness={0.5} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={spokeRef} args={[undefined, undefined, riders.length * 2]} key={`cyc-spoke-${riders.length}`} frustumCulled={false}>
        <boxGeometry args={[2, 0.12, 0.39]} />
        <meshStandardMaterial color="#c3cbd2" metalness={0.5} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={riderRef} args={[undefined, undefined, riders.length]} key={`cyc-rider-${riders.length}`} castShadow>
        <boxGeometry args={[1.6, 3.4, 1.3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, riders.length]} key={`cyc-head-${riders.length}`} castShadow>
        <sphereGeometry args={[1.0, 7, 6]} />
        <meshStandardMaterial color="#caa987" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={legRef} args={[undefined, undefined, riders.length * 4]} key={`cyc-legs-${riders.length}`} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#344052" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
