"use client";

// Walking people — a scene-dressing sibling (like <Traffic> / <Trees>).
// Two behaviours, both in one rig of InstancedMeshes (torso + head + legs
// + arms):
//   • LOOP  — strolls the sidewalk perimeter of one developed tile.
//   • CROSS — walks back and forth across the adjacent road at a corner
//             crossing, holding at the kerb until the conflicting
//             traffic's signal is red (reuses signalStateFor()).
// The rig has an actual alternating-stride gait (legs + arms swing in
// natural cross-body coordination, body double-bounces once per stride)
// instead of a floating box with a sine bob, and freezes to a standing
// pose while held at a kerb. Height/build and shirt/pants colour vary
// per person. Density scales with zone kind × how central the tile is ×
// the live trafficLevel (peak hour ⇒ more people, brisker pace); even the
// smallest (rural) preset gets a handful of people so no tile feels dead.

import { useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, ROAD_GAP, type CellPlacement, type ZoneKind } from "./cityData";
import { signalStateFor } from "./scenery";

const TILE_H = 4;
const ROAD_W = ROAD_GAP - PLOT;
const SHIRTS = ["#e2e8f0", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#a855f7", "#111827", "#14b8a6"];
const SHIRT_COL = SHIRTS.map((h) => new THREE.Color(h));
const PANTS = ["#2b3140", "#1f2937", "#3f4a5c", "#584a3a", "#0f172a"];
const PANTS_COL = PANTS.map((h) => new THREE.Color(h));
const SKIN_COL = "#caa987";

// rig proportions (before per-person scale) — feet at TILE_H
const LEG_LEN = 4.2;
const HIP_Y = TILE_H + LEG_LEN;
const TORSO_H = 3.3;
const SHOULDER_Y = HIP_Y + TORSO_H;
const ARM_LEN = 2.9;
const HEAD_R = 1.15;
const HEAD_Y = SHOULDER_Y + HEAD_R + 0.45;
const GAIT_RATE = 0.78;     // stride phase per world-unit travelled
const SWING_AMP = 0.52;     // leg swing, radians
const ARM_AMP = 0.4;        // arm swing, radians
const BOB_AMP = 0.5;        // vertical bounce

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

// Limb swing: rotate about the LOCAL Z axis (fore/aft, before yaw) then
// yaw to heading — explicit quaternion composition so the swing plane is
// unambiguous (q = qYaw · qSwing applies qSwing in the limb's own frame
// first, then reorients that whole swing to face `heading`), rather than
// relying on Euler `rotation.set(x,y,z)` axis-order semantics.
const _qYaw = new THREE.Quaternion();
const _qSwing = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
function limbQuat(heading: number, swing: number): THREE.Quaternion {
  _qYaw.setFromAxisAngle(_axisY, heading);
  _qSwing.setFromAxisAngle(_axisZ, swing);
  return _qYaw.multiply(_qSwing);
}

function pedCount(kind: ZoneKind, coreness: number, gridSize: number): number {
  const busy = kind === "urban" || kind === "commercial" || kind === "market";
  const mid = kind === "housing" || kind === "community" || kind === "village" || kind === "education";
  // Even a small kampung (rural preset) gets a person or two — an empty
  // sidewalk read as "unfinished", not "quiet".
  if (gridSize <= 6) return busy ? 1 : mid && coreness > 0.45 ? 1 : 0;
  let n = busy ? Math.round(4 + coreness * 5) : mid ? Math.round(2 + coreness * 2) : 1;
  if (gridSize >= 22) n = Math.min(n, 5);
  return n;
}

type Ped = {
  cx: number; cz: number;
  speed: number; phase: number; shirt: number; pants: number; build: number;
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
  placed, gridSize, trafficLevel = 0.5, claimed, avoidCentre,
}: {
  placed: CellPlacement[];
  gridSize: number;
  trafficLevel?: number;
  claimed?: Set<string>;
  /** Central roundabout centre. Its four adjacent plots have no reliable
      pedestrian pavement because the raised ring overlaps their inner edges. */
  avoidCentre?: [number, number] | null;
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
      // The sidewalk route normally follows a tile perimeter. On the four
      // plots beside the central roundabout, that route and its crossing
      // route run under the roundabout deck / landscaped island. Suppress
      // only those four local pedestrian spawners; all outer sidewalks and
      // crossings remain active, so the junction stays free of walkers
      // rather than having people visibly clip through the island or kerb.
      if (avoidCentre && Math.hypot(cx - avoidCentre[0], cz - avoidCentre[1]) < PLOT) continue;
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
          shirt: Math.floor(rnd() * SHIRTS.length),
          pants: Math.floor(rnd() * PANTS.length),
          build: 0.86 + rnd() * 0.28,
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
  }, [placed, gridSize, claimed, avoidCentre, perim]);

  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const legRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Leg/arm geometry pivots at the HIP / SHOULDER end (not centre) so a
  // rotation there swings the foot/hand end like a real limb — box built
  // normally, then re-centred on its top face.
  const legGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1.1, LEG_LEN, 1.1);
    g.translate(0, -LEG_LEN / 2, 0);
    return g;
  }, []);
  const armGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(0.85, ARM_LEN, 0.85);
    g.translate(0, -ARM_LEN / 2, 0);
    return g;
  }, []);
  useEffect(() => () => { legGeo.dispose(); armGeo.dispose(); }, [legGeo, armGeo]);

  useLayoutEffect(() => {
    const torso = torsoRef.current;
    const legs = legRef.current;
    const arms = armRef.current;
    if (!torso || !legs || !arms) return;
    peds.forEach((p, i) => {
      torso.setColorAt(i, SHIRT_COL[p.shirt]);
      for (let n = 0; n < 2; n++) {
        legs.setColorAt(i * 2 + n, PANTS_COL[p.pants]);
        arms.setColorAt(i * 2 + n, SHIRT_COL[p.shirt]);
      }
    });
    if (torso.instanceColor) torso.instanceColor.needsUpdate = true;
    if (legs.instanceColor) legs.instanceColor.needsUpdate = true;
    if (arms.instanceColor) arms.instanceColor.needsUpdate = true;
  }, [peds]);

  useFrame((_, dt) => {
    const torso = torsoRef.current;
    const head = headRef.current;
    const legs = legRef.current;
    const arms = armRef.current;
    if (!torso || !head || !legs || !arms) return;
    const step = Math.min(dt, 0.05);
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const active = Math.max(1, Math.round(peds.length * (0.32 + 0.68 * lv)));
    const paceMul = 0.7 + 0.5 * lv;

    const park = (i: number) => {
      dummy.position.set(0, -1000, 0);
      dummy.scale.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      torso.setMatrixAt(i, dummy.matrix);
      head.setMatrixAt(i, dummy.matrix);
      legs.setMatrixAt(i * 2, dummy.matrix);
      legs.setMatrixAt(i * 2 + 1, dummy.matrix);
      arms.setMatrixAt(i * 2, dummy.matrix);
      arms.setMatrixAt(i * 2 + 1, dummy.matrix);
    };

    for (let i = 0; i < peds.length; i++) {
      if (i >= active) { park(i); continue; }
      const p = peds[i];
      let x: number;
      let z: number;
      let heading: number;
      let travel: number;
      let moving = true;

      if (p.cross) {
        // conflicting traffic runs perpendicular to the ped's walk axis:
        // ped walking X crosses a Z-road (axisIsX = false) and vice versa.
        const now = performance.now() / 1000;
        const clear = signalStateFor(!p.axisX, now) === 2;
        if (p.wait > 0) {
          p.wait -= step;
          moving = false;
        } else if (clear || (p.u > 0.05 && p.u < 0.95)) {
          p.u += (p.dir * p.speed * paceMul * step) / Math.abs(p.span);
          if (p.u >= 1) { p.u = 1; p.dir = -1; p.wait = 1.5 + (p.phase % 2); }
          else if (p.u <= 0) { p.u = 0; p.dir = 1; p.wait = 1.5 + (p.phase % 2); }
        } else {
          moving = false; // held at the kerb, signal not yet clear
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

      // gait: legs/arms swing in cross-body coordination (right arm with
      // left leg), body double-bounces once per full stride — frozen to a
      // neutral standing pose while held at a kerb.
      const gait = p.phase + travel * GAIT_RATE;
      const g = moving ? 1 : 0;
      const legSwingL = Math.sin(gait) * SWING_AMP * g;
      const legSwingR = -legSwingL;
      const armSwingL = -legSwingL * (ARM_AMP / SWING_AMP);
      const armSwingR = -legSwingR * (ARM_AMP / SWING_AMP);
      const bob = Math.abs(Math.sin(gait)) * BOB_AMP * g;
      const b = p.build;

      const cosH = Math.cos(heading), sinH = Math.sin(heading);
      const side = (d: number) => [x - sinH * d, z + cosH * d] as const;

      // torso
      dummy.position.set(x, TILE_H + (HIP_Y - TILE_H + TORSO_H / 2) * b, z);
      dummy.rotation.set(0, heading, 0);
      dummy.scale.set(b, b, b);
      dummy.updateMatrix();
      torso.setMatrixAt(i, dummy.matrix);

      // head
      dummy.position.set(x, TILE_H + (HEAD_Y - TILE_H) * b - bob * 0.3, z);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);

      // legs (pivot at hip — geometry is pre-shifted so it hangs below the
      // origin), swung fore/aft by limbQuat().
      const hipY = TILE_H + (HIP_Y - TILE_H) * b;
      [[-1.1, legSwingL], [1.1, legSwingR]].forEach(([off, swing], n) => {
        const [lx, lz] = side(off * b);
        dummy.position.set(lx, hipY, lz);
        dummy.quaternion.copy(limbQuat(heading, swing));
        dummy.scale.set(b, b, b);
        dummy.updateMatrix();
        legs.setMatrixAt(i * 2 + n, dummy.matrix);
      });

      // arms (pivot at shoulder)
      const shoulderY = TILE_H + (SHOULDER_Y - TILE_H) * b;
      [[-1.55, armSwingL], [1.55, armSwingR]].forEach(([off, swing], n) => {
        const [ax, az] = side(off * b);
        dummy.position.set(ax, shoulderY, az);
        dummy.quaternion.copy(limbQuat(heading, swing));
        dummy.scale.set(b, b, b);
        dummy.updateMatrix();
        arms.setMatrixAt(i * 2 + n, dummy.matrix);
      });
    }
    torso.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    legs.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
  });

  if (!peds.length) return null;
  return (
    <group>
      <instancedMesh ref={torsoRef} args={[undefined, undefined, peds.length]} key={`ped-t-${peds.length}`} castShadow>
        <boxGeometry args={[1.9, TORSO_H, 1.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, peds.length]} key={`ped-h-${peds.length}`} castShadow>
        <sphereGeometry args={[HEAD_R, 7, 6]} />
        <meshStandardMaterial color={SKIN_COL} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={legRef} args={[legGeo, undefined, peds.length * 2]} key={`ped-l-${peds.length}`} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[armGeo, undefined, peds.length * 2]} key={`ped-a-${peds.length}`} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
