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
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  roadsV, roadsH, worldCentre, PLOT, ROAD_GAP, type CellPlacement, type ZoneKind,
} from "./cityData";
import { blockLoop, detourRoundabout, gridRoadCentres, pointOnGridAsphalt, posAt, signalStateFor, type Loop } from "./scenery";
import { R_IN as RB_R_IN, R_OUT as RB_R_OUT, roundaboutLift } from "./roundabout";

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
const MC_COLORS = ["#e2382a", "#1c9dd6", "#7c3aed", "#f2b705", "#e7ecf2", "#22c55e"];
const MC_BASE_SPEED = 84;
const MC_ACCEL = 160;
const MC_BRAKE = 300;
const MC_ARC_SPEED = 30;
const MC_GAP = 10;
const MC_STOP_MARGIN = 8;
const MC_BRAKE_LOOKAHEAD = 100;

type Rider = { loop: number; s: number; speed: number; lean: number; spin: number; color: THREE.Color; helmet: THREE.Color };

export function Motorcyclists({
  gridSize, trafficLevel = 0.5, riverRoadIndex = null, roadIndices, roundabout = null,
}: {
  gridSize: number;
  trafficLevel?: number;
  riverRoadIndex?: number | null;
  /** Road indexes that remain asphalt after internal lanes become superblocks. */
  roadIndices?: { vertical: number[]; horizontal: number[] };
  /** Central roundabout (world x, z); loops crossing it are routed around the ring. */
  roundabout?: [number, number] | null;
}) {
  const centre = worldCentre(gridSize);
  const rbX = roundabout?.[0] ?? null, rbZ = roundabout?.[1] ?? null;
  const asphaltRoads = useMemo(() => gridRoadCentres(gridSize, roadIndices), [gridSize, roadIndices]);
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
      // a different coverage roll from <Traffic>'s cars
      if (((a * 41 + b * 67 + gridSize) % 100) >= 60) continue;
      // Riders crossing the central junction go round the roundabout on
      // the kerb-side (outer) part of the ring, like the cars.
      let loop = blockLoop(xs[a], xs[a + 1], zs[b], zs[b + 1], laneOff, turnR);
      if (rbX !== null && rbZ !== null) loop = detourRoundabout(loop, rbX, rbZ, RB_R_IN + (RB_R_OUT - RB_R_IN) * 0.8);
      loops.push(loop);
      addTo(loops.length - 1, perLoop);
    }
    return { loops, riders };
  }, [gridSize, centre, riverRoadIndex, roadIndices, rbX, rbZ]);

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
    [body, rider, helmet, lights].forEach((mesh) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.vertexColors = false;
      material.color.set("#ffffff");
      material.needsUpdate = true;
    });
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
        // A motorcycle is small enough that an off-road transform is very
        // noticeable. Hide it rather than letting it cross a green block
        // whenever a future route/roundabout configuration is inconsistent.
        if (!pointOnGridAsphalt(x, z, asphaltRoads, 1.5)) {
          park(ci);
          continue;
        }
        const heading = tangent(loop, c.s);
        const cos = Math.cos(heading), sin = Math.sin(heading);
        const local = (fwd: number, side: number) => [x + cos * fwd - sin * side, z + sin * fwd + cos * side] as const;

        const roadY = rbX !== null && rbZ !== null ? roundaboutLift(x, z, rbX, rbZ, 0.8) : 0.8;
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
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={wheelRef} geometry={wheelGeometry} args={[undefined, undefined, riders.length * 2]} key={`mc-wheel-${riders.length}`} castShadow>
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={riderRef} args={[undefined, undefined, riders.length]} key={`mc-rider-${riders.length}`} castShadow>
        <boxGeometry args={[2.6, 4.2, 3.2]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={spokeRef} args={[undefined, undefined, riders.length * 2]} key={`mc-spoke-${riders.length}`} frustumCulled={false}>
        <boxGeometry args={[2.3, 0.2, 0.94]} />
        <meshStandardMaterial color="#9aa7b4" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={helmetRef} args={[undefined, undefined, riders.length]} key={`mc-helmet-${riders.length}`} castShadow>
        <sphereGeometry args={[1.15, 7, 6]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
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

// ── bicycle frame ──────────────────────────────────────────────────
// Points in bike-local (forward, height) units, height measured from the
// tile top like bodyPosition() below. Wheels sit at ±2.6 with a 1.3
// radius, so hubs are at height 1.5. The rider's hip / grip / pedal
// positions come from the same points, so the body stays on the bike.
const CYC_HUB_R: [number, number] = [-2.6, 1.5];
const CYC_HUB_F: [number, number] = [2.6, 1.5];
const CYC_BB: [number, number] = [-0.2, 1.35];        // bottom bracket (pedal axle)
const CYC_SEAT_TOP: [number, number] = [-0.75, 3.35]; // seat-tube top
const CYC_HEAD_TOP: [number, number] = [1.85, 3.5];
const CYC_HEAD_BOT: [number, number] = [2.0, 2.85];
const CYC_SADDLE: [number, number] = [-0.85, 3.75];
const CYC_BAR: [number, number] = [1.75, 3.95];        // handlebar centre
const CYC_CRANK = 0.7;

function tube(a: [number, number, number], b: [number, number, number], r: number) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), 6, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  return g;
}

// One merged diamond frame + fork + saddle + handlebar, origin at hub
// height so the lean pivot matches the wheels'.
function useBicycleFrameGeometry() {
  const geometry = useMemo(() => {
    const at = (p: [number, number], z = 0): [number, number, number] => [p[0], p[1] - 1.5, z];
    const r = 0.13;
    const parts: THREE.BufferGeometry[] = [];
    for (const z of [-0.22, 0.22]) {
      parts.push(tube(at(CYC_BB, z), at(CYC_HUB_R, z), r * 0.8));            // chain stays
      parts.push(tube(at(CYC_SEAT_TOP, z * 0.5), at(CYC_HUB_R, z), r * 0.8)); // seat stays
      parts.push(tube(at(CYC_HEAD_BOT, z * 0.5), at(CYC_HUB_F, z), r * 0.9)); // fork blades
    }
    parts.push(tube(at(CYC_BB), at(CYC_SEAT_TOP), r));              // seat tube
    parts.push(tube(at(CYC_SEAT_TOP), at(CYC_HEAD_TOP), r));        // top tube
    parts.push(tube(at(CYC_BB), at(CYC_HEAD_BOT), r * 1.15));       // down tube
    parts.push(tube(at(CYC_HEAD_BOT), at(CYC_HEAD_TOP), r * 1.3));  // head tube
    parts.push(tube(at(CYC_SEAT_TOP), at(CYC_SADDLE), r * 0.8));    // seat post
    parts.push(tube(at(CYC_HEAD_TOP), at(CYC_BAR), r * 0.9));       // stem
    parts.push(tube(at(CYC_BAR, -0.9), at(CYC_BAR, 0.9), r * 0.9)); // handlebar
    const saddle = new THREE.BoxGeometry(1.2, 0.25, 0.55);
    saddle.translate(CYC_SADDLE[0] + 0.05, CYC_SADDLE[1] - 1.5 + 0.12, 0);
    parts.push(saddle);
    const ring = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10);
    ring.rotateX(Math.PI / 2);
    ring.translate(CYC_BB[0], CYC_BB[1] - 1.5, 0.3);
    parts.push(ring); // chainring
    const flat = parts.map((g) => {
      const f = g.index ? g.toNonIndexed() : g;
      f.deleteAttribute("uv");
      return f;
    });
    return mergeGeometries(flat, false) ?? new THREE.BoxGeometry(5.4, 0.5, 0.5);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

// Open bicycle wheel: a tyre ring (axle along local Z, like
// useWheelGeometry) plus a hub and six thin spokes, so the frame shows
// through instead of being hidden behind a solid disc.
function useCycleWheelGeometry() {
  const geometry = useMemo(() => {
    const tyre = new THREE.TorusGeometry(1.15, 0.16, 6, 18);
    const hub = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8);
    hub.rotateX(Math.PI / 2);
    const parts: THREE.BufferGeometry[] = [tyre, hub];
    for (let k = 0; k < 3; k++) {
      const spoke = new THREE.BoxGeometry(2.2, 0.05, 0.05);
      spoke.rotateZ((k * Math.PI) / 3);
      parts.push(spoke);
    }
    const flat = parts.map((g) => {
      const f = g.index ? g.toNonIndexed() : g;
      f.deleteAttribute("uv");
      return f;
    });
    return mergeGeometries(flat, false) ?? tyre;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

// Two-bone leg IK in the bike's side plane; the knee bends forward.
function kneeFor(hip: [number, number], foot: [number, number], seg: number): [number, number] {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const n = Math.hypot(dx, dy) || 1;
  const L = Math.min(n, seg * 2 - 0.01);
  const h = Math.sqrt(Math.max(0, seg * seg - (L / 2) ** 2));
  return [hip[0] + dx / 2 - (dy / n) * h, hip[1] + dy / 2 + (dx / n) * h];
}

const CYC_FRAME_COLORS = ["#c0392b", "#1f6fb2", "#2e8b57", "#d4a017", "#e5e7eb", "#2b2f36"];

type CycRider = { cx: number; cz: number; s: number; speed: number; phase: number; lean: number; spin: number; color: THREE.Color; frame: THREE.Color };

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
          frame: new THREE.Color(CYC_FRAME_COLORS[Math.floor(rnd() * CYC_FRAME_COLORS.length)]),
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
  const armRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const wheelGeometry = useCycleWheelGeometry();
  const frameGeometry = useBicycleFrameGeometry();
  const limbStart = useMemo(() => new THREE.Vector3(), []);
  const limbEnd = useMemo(() => new THREE.Vector3(), []);
  const limbDirection = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useLayoutEffect(() => {
    const rider = riderRef.current;
    const frame = frameRef.current;
    if (!rider || !frame) return;
    riders.forEach((p, i) => { rider.setColorAt(i, p.color); frame.setColorAt(i, p.frame); });
    if (rider.instanceColor) rider.instanceColor.needsUpdate = true;
    if (frame.instanceColor) frame.instanceColor.needsUpdate = true;
  }, [riders]);

  useFrame((_, dt) => {
    const wheels = wheelRef.current;
    const frame = frameRef.current;
    const spokes = spokeRef.current;
    const rider = riderRef.current;
    const head = headRef.current;
    const legs = legRef.current;
    const arms = armRef.current;
    if (!wheels || !frame || !spokes || !rider || !head || !legs || !arms) return;
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
        for (let n = 0; n < 2; n++) arms.setMatrixAt(i * 2 + n, dummy.matrix);
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

      dummy.position.set(...bodyPosition(0, 1.5));
      dummy.rotation.set(p.lean, -heading, 0, "YXZ");
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      frame.setMatrixAt(i, dummy.matrix);

      // Torso / limb as a unit box stretched between two body-space points.
      const segment = (mesh: THREE.InstancedMesh, idx: number, a: readonly [number, number, number], b: readonly [number, number, number], thick: number, depth = thick) => {
        limbStart.set(...a);
        limbEnd.set(...b);
        limbDirection.subVectors(limbEnd, limbStart);
        dummy.position.copy(limbStart).add(limbEnd).multiplyScalar(0.5);
        dummy.scale.set(thick, limbDirection.length(), depth);
        dummy.quaternion.setFromUnitVectors(up, limbDirection.normalize());
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };

      // Seated on the saddle, leaning forward to the bars.
      const hipF = CYC_SADDLE[0] + 0.05, hipH = CYC_SADDLE[1] + 0.35 + bob;
      const shF = hipF + 1.3, shH = hipH + 1.6;
      segment(rider, i, bodyPosition(hipF, hipH), bodyPosition(shF, shH), 1.35, 1.0);
      dummy.rotation.set(p.lean, -heading, 0, "YXZ");
      dummy.position.set(...bodyPosition(shF + 0.35, shH + 0.75));
      dummy.scale.set(0.78, 0.78, 0.78);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
      for (let side = 0; side < 2; side++) {
        const lateral = side === 0 ? -0.6 : 0.6;
        // arm: shoulder -> grip on the handlebar
        segment(arms, i * 2 + side, bodyPosition(shF, shH - 0.2, lateral), bodyPosition(CYC_BAR[0], CYC_BAR[1], lateral * 1.25), 0.36);
        // leg: hip -> knee -> pedal; pedals sit 180 degrees apart on the crank
        const phase = p.phase + side * Math.PI;
        const foot: [number, number] = [CYC_BB[0] + Math.cos(phase) * CYC_CRANK, CYC_BB[1] + Math.sin(phase) * CYC_CRANK];
        const hip: [number, number] = [hipF, hipH - 0.15];
        const knee = kneeFor(hip, foot, 1.55);
        const legSide = lateral * 0.75;
        segment(legs, i * 4 + side * 2, bodyPosition(hip[0], hip[1], legSide), bodyPosition(knee[0], knee[1], legSide), 0.42);
        segment(legs, i * 4 + side * 2 + 1, bodyPosition(knee[0], knee[1], legSide), bodyPosition(foot[0], foot[1], legSide), 0.38);
      }
    }
    wheels.instanceMatrix.needsUpdate = true;
    frame.instanceMatrix.needsUpdate = true;
    spokes.instanceMatrix.needsUpdate = true;
    rider.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
  });

  if (!riders.length) return null;
  return (
    <group>
      <instancedMesh ref={wheelRef} geometry={wheelGeometry} args={[undefined, undefined, riders.length * 2]} key={`cyc-wheel-${riders.length}`} castShadow>
        <meshStandardMaterial color="#1a1d22" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={frameRef} geometry={frameGeometry} args={[undefined, undefined, riders.length]} key={`cyc-frame-${riders.length}`} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.45} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={spokeRef} args={[undefined, undefined, riders.length * 2]} key={`cyc-spoke-${riders.length}`} frustumCulled={false}>
        <boxGeometry args={[2.2, 0.07, 0.07]} />
        <meshStandardMaterial color="#c3cbd2" metalness={0.5} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={riderRef} args={[undefined, undefined, riders.length]} key={`cyc-rider-${riders.length}`} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
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
      <instancedMesh ref={armRef} args={[undefined, undefined, riders.length * 2]} key={`cyc-arms-${riders.length}`} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#caa987" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
