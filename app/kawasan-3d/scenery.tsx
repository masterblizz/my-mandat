"use client";

// Scene dressing: day/dusk/night environment, shadows, street lamps,
// cars, elevated LRT, rain, and zone beacons.
//
// - CityEnvironment: gradient sky + fog + sun/moon + 3 lights + drifting
//   haze, driven by TOD_ENV (the 3D port of .kw-scene[data-tod]); an
//   overcast wash + falling <Rain> when weather === "rain".
// - StreetLamps: instanced pole + head at every road junction; heads glow
//   and 4 point lights switch on at dusk/night (TOD_ENV.lamp × mood).
// - Traffic: instanced cars looping the road lanes.
// - Lrt: straight elevated guideway + one station + a shuttling 3-car
//   train (metro / dense-metro grids only).
// - ZoneBeacon: steady beam over the zone-0 landmark; a bright, auto-
//   expiring gold burst on a project-approved celebration.
//
// Still deferred: the CSS L-shaped LRT route + 2nd line, per-lamp point
// lights, car headlights, boats/river, roadside trees.

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, GradientTexture, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  roadsV, roadsH, worldCentre, worldSize, ROAD_GAP, PLOT,
  TOD_ENV, type Tod,
} from "./cityData";
import { junctionInsideLarge } from "./largeBuildings";
import { roundaboutCentre } from "./roundabout";

const ROAD_W = ROAD_GAP - PLOT;
const DECK_Y = 58; // matches TRACK_DECK_Z in app/kawasan/page.tsx

export type Weather = "clear" | "rain";

// Overcast wash applied on top of any tod when it's raining — mirrors the
// CSS version's --kw-storm tint.
const _c = new THREE.Color();
function overcast(hex: string, amount: number) {
  return "#" + _c.set(hex).lerp(_c.clone().set("#4b5563"), amount).getHexString();
}

// ── environment ─────────────────────────────────────────────────────
export function CityEnvironment({
  tod, span, weather = "clear", shadowMapSize = 2048,
}: {
  tod: Tod; span: number; weather?: Weather;
  /** Phase F quality-tier knob — see quality.ts. */
  shadowMapSize?: number;
}) {
  const env = TOD_ENV[tod];
  const wet = weather === "rain";
  const skyR = Math.min(span * 5, 18000);
  const sunPos = useMemo<[number, number, number]>(
    () => [env.sun[0] * span * 1.4, env.sun[1] * span * 1.4, env.sun[2] * span * 1.4],
    [env.sun, span],
  );

  const skyTop = wet ? overcast(env.skyTop, 0.55) : env.skyTop;
  const skyBottom = wet ? overcast(env.skyBottom, 0.5) : env.skyBottom;
  const fogCol = wet ? overcast(env.fog, 0.55) : env.fog;
  const sunI = wet ? env.sunIntensity * 0.45 : env.sunIntensity;
  const ambI = wet ? env.ambientIntensity * 1.15 : env.ambientIntensity;
  const showStars = env.stars > 0 && !wet;

  return (
    <>
      <color attach="background" args={[skyBottom]} />
      <fog attach="fog" args={[fogCol, span * (wet ? 0.9 : 1.2), span * (wet ? 2.9 : 3.8)]} />

      {/* gradient sky dome — horizon colour at the bottom, zenith at top */}
      <mesh scale={[1, 1, 1]} frustumCulled={false} renderOrder={-1}>
        <sphereGeometry args={[skyR, 32, 16]} />
        <meshBasicMaterial side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false}>
          <GradientTexture stops={[0, 0.55, 1]} colors={[skyBottom, skyBottom, skyTop]} />
        </meshBasicMaterial>
      </mesh>

      {/* sun / moon disc + soft glow (hidden when overcast) */}
      {!wet && (
        <group position={sunPos}>
          <mesh>
            <sphereGeometry args={[span * 0.035, 20, 20]} />
            <meshBasicMaterial color={env.sunColor} fog={false} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[span * 0.09, 20, 20]} />
            <meshBasicMaterial color={env.sunColor} transparent opacity={0.18} fog={false} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* perimeter ground sheet — large enough to fill the lower view so
          the sky dome's sub-horizon half (and its stars) never shows.
          Deliberately NOT receiveShadow: this plane is span*8 across, far
          bigger than the directional light's shadow-camera frustum below
          (+/-span*0.75) — sampling the shadow map beyond that frustum
          clamps to its edge texels, which smears the city's own shadow
          pattern outward into a field of scattered dark blobs all the way
          to the horizon (see docs/webgl-migration-log.md). Nothing that
          casts a shadow exists out here anyway (all buildings sit well
          inside the frustum), so there's no real shadow information this
          plane is supposed to be showing in the first place. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[span * 8, span * 8]} />
        <meshStandardMaterial color={wet ? overcast(env.ground, 0.4) : env.ground} />
      </mesh>

      {showStars && (
        <Stars
          radius={span * 1.6}
          depth={span * 0.5}
          count={env.stars > 0.8 ? 1600 : 450}
          factor={6}
          saturation={0}
          fade
          speed={0}
        />
      )}

      {/* faint drifting dust/haze motes for depth (day/dusk only) */}
      {env.stars < 0.9 && !wet && (
        <Sparkles count={40} scale={[span * 0.9, span * 0.28, span * 0.9]} position={[0, span * 0.14, 0]} size={span * 0.006} speed={0.15} opacity={0.5} color="#dfe9f2" />
      )}

      <ambientLight color={wet ? "#8b96a6" : env.ambientColor} intensity={ambI} />
      <hemisphereLight args={[wet ? "#7d8794" : env.hemiSky, env.hemiGround, env.hemiIntensity]} />
      <directionalLight
        position={sunPos}
        color={wet ? "#c8d0da" : env.sunColor}
        intensity={sunI}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={2}
        shadow-camera-near={span * 0.2}
        shadow-camera-far={span * 4}
        shadow-camera-left={-span * 0.75}
        shadow-camera-right={span * 0.75}
        shadow-camera-top={span * 0.75}
        shadow-camera-bottom={-span * 0.75}
      />

      {wet && <Rain span={span} />}
    </>
  );
}

// ── rain ────────────────────────────────────────────────────────────
// Instanced thin streaks in a box above the pivot; they fall and wrap.
function Rain({ span }: { span: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const N = 1400;
  const H = span * 0.8;
  const state = useMemo(() => {
    let s = 7;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const h = span * 0.8;
    return Array.from({ length: N }, () => ({
      x: (rnd() - 0.5) * span * 1.3,
      y: rnd() * h,
      z: (rnd() - 0.5) * span * 1.3,
      v: 600 + rnd() * 500,
    }));
  }, [span]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    state.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [state, dummy]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < state.length; i++) {
      const d = state[i];
      d.y -= d.v * dt;
      if (d.y < 0) d.y += H;
      dummy.position.set(d.x, d.y, d.z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <boxGeometry args={[0.7, 16, 0.7]} />
      <meshBasicMaterial color="#9fb4c8" transparent opacity={0.35} fog={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ── street lamps ────────────────────────────────────────────────────
// A lamp at every road junction PLUS mid-span lamps down each road edge
// (deterministically thinned by the quality tier's `detail`) on
// alternating sides, so a road reads as *lined* with lamps rather than
// only cornered. The head carries a warm emissive the Phase-E bloom
// turns into a glow at night; a tiny bright bulb sphere gives that bloom
// a hot core.
const LAMP_POLE_H = 26;

export function StreetLamps({
  gridSize, lamp, detail = 1, claimed, hideNear,
}: {
  gridSize: number; lamp: number;
  /** quality-tier street-furniture density 0..1 (scales the mid-span lamps) */
  detail?: number;
  /** cells swallowed by a large footprint — suppress lamps at junctions fully inside one */
  claimed?: Set<string>;
  /** world (x,z) of the roundabout centre — suppress lamps that fall on its island/ring */
  hideNear?: [number, number] | null;
}) {
  const centre = worldCentre(gridSize);
  const points = useMemo(() => {
    const xs = roadsV(gridSize).map((x) => x - centre + ROAD_W / 2);
    const zs = roadsH(gridSize).map((z) => z - centre + ROAD_W / 2);
    const out: [number, number][] = [];
    const blocked = (px: number, pz: number, i: number, j: number) =>
      (claimed && junctionInsideLarge(i, j, gridSize, claimed)) ||
      (hideNear && Math.hypot(px - hideNear[0], pz - hideNear[1]) < 130);
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < zs.length; j++) {
        if (!blocked(xs[i], zs[j], i, j)) out.push([xs[i], zs[j]]);
      }
    }
    // one mid-span lamp per road edge, alternating side — `detail` caps
    // the rate well below 100% even at the top tier so this stays a
    // trim, not a doubling.
    const off = ROAD_W * 0.42;
    const rate = detail * 52;
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j + 1 < zs.length; j++) {
        if (((i * 131 + j * 17) % 100) >= rate) continue;
        const px = xs[i] + (j % 2 ? off : -off);
        const pz = (zs[j] + zs[j + 1]) / 2;
        if (!blocked(px, pz, i, j)) out.push([px, pz]);
      }
    }
    for (let j = 0; j < zs.length; j++) {
      for (let i = 0; i + 1 < xs.length; i++) {
        if (((j * 131 + i * 17 + 7) % 100) >= rate) continue;
        const px = (xs[i] + xs[i + 1]) / 2;
        const pz = zs[j] + (i % 2 ? off : -off);
        if (!blocked(px, pz, i, j)) out.push([px, pz]);
      }
    }
    return out;
  }, [gridSize, centre, detail, claimed, hideNear]);

  const poleRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const pole = poleRef.current;
    const head = headRef.current;
    if (!pole || !head) return;
    const m = new THREE.Object3D();
    points.forEach(([x, z], i) => {
      m.position.set(x, LAMP_POLE_H / 2, z);
      m.scale.set(1, LAMP_POLE_H, 1);
      m.updateMatrix();
      pole.setMatrixAt(i, m.matrix);
      m.position.set(x, LAMP_POLE_H, z);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      head.setMatrixAt(i, m.matrix);
    });
    pole.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    pole.computeBoundingSphere();
    head.computeBoundingSphere();
  }, [points]);

  // A few real point lights (not one per lamp) for actual bounce at night.
  const quads = useMemo(() => {
    const q = worldSize(gridSize) * 0.28;
    return [[-q, -q], [q, -q], [-q, q], [q, q]] as [number, number][];
  }, [gridSize]);

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, points.length]} key={`pole-${points.length}`} castShadow>
        <cylinderGeometry args={[1, 1.3, 1, 4]} />
        <meshStandardMaterial color="#2b3340" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, points.length]} key={`head-${points.length}`} frustumCulled={false}>
        <boxGeometry args={[5, 2.4, 5]} />
        <meshStandardMaterial color="#3a4150" emissive="#ffd489" emissiveIntensity={0.15 + lamp * 2.6} toneMapped={false} />
      </instancedMesh>
      {lamp > 0.05 &&
        quads.map(([x, z], i) => (
          <pointLight
            key={i}
            position={[x, 90, z]}
            color="#ffd39a"
            intensity={lamp * worldSize(gridSize) * 0.05}
            distance={worldSize(gridSize) * 0.5}
            decay={1.4}
          />
        ))}
    </group>
  );
}

// ── traffic lights ─────────────────────────────────────────────────
// A signal at every 4-way junction that borders a developed zone (T- and
// edge-junctions skipped, thinned further by the quality tier). Two poles
// per junction on opposite corners running OPPOSITE phases, so cross
// traffic alternates. The red / amber / green lenses are three
// InstancedMeshes; the cycle is driven by throttled `setColorAt` on the
// instanceColor buffer (a first cut animated it with an onBeforeCompile
// shader, which tripped an EffectComposer depth-stencil blit error on the
// medium tier — plain instanced colour has no pipeline risk).
const TL_POLE_H = 20;
const TL_HEAD_Y = TL_POLE_H + 4;
const TL_CYCLE = 9; // seconds for a full green -> amber -> red loop
const TL_LIT = [new THREE.Color("#ff3b30"), new THREE.Color("#ffb020"), new THREE.Color("#2fd15a")];
const TL_DIM = new THREE.Color("#15171c");
// row index in TL_LIT: 0 = red, 1 = amber, 2 = green.

// Single source of truth for the signal phase — both the lit lens (below)
// and the car behaviour (Traffic) read this so what you see and what the
// cars do can never drift. `axisIsX` = the car/approach travels along
// world X (an E-W movement); the crossing Z movement runs the opposite
// half-cycle. Returns 0 green / 1 amber / 2 red. Green ~55% of the cycle,
// amber a short ~7%, red the rest — with a small all-red overlap so
// cross streams never both show green.
export function signalStateFor(axisIsX: boolean, timeSec: number): 0 | 1 | 2 {
  const local = (timeSec / TL_CYCLE + (axisIsX ? 0 : 0.5)) % 1;
  if (local < 0.46) return 0; // green
  if (local < 0.53) return 1; // amber
  return 2;                    // red
}

export function TrafficLights({
  gridSize, developed, detail = 1, claimed,
}: {
  gridSize: number;
  /** "col,row" of developed cells — a junction needs at least one to qualify */
  developed: Set<string>;
  detail?: number;
  claimed?: Set<string>;
}) {
  const centre = worldCentre(gridSize);

  const poles = useMemo(() => {
    const xs = roadsV(gridSize).map((x) => x - centre + ROAD_W / 2);
    const zs = roadsH(gridSize).map((z) => z - centre + ROAD_W / 2);
    const out: { x: number; z: number; phase: number }[] = [];
    const inB = (c: number, r: number) => c >= 0 && c < gridSize && r >= 0 && r < gridSize;
    for (let i = 1; i < xs.length; i++) {
      for (let j = 1; j < zs.length; j++) {
        const quad: [number, number][] = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]];
        if (!quad.every(([c, r]) => inB(c, r))) continue;
        if (!quad.some(([c, r]) => developed.has(`${c},${r}`))) continue;
        if (claimed && quad.every(([c, r]) => claimed.has(`${c},${r}`))) continue;
        if (((i * 97 + j * 41) % 100) >= detail * 100) continue;
        const d = ROAD_W * 0.42;
        out.push({ x: xs[i] - d, z: zs[j] - d, phase: 0 });
        out.push({ x: xs[i] + d, z: zs[j] + d, phase: 0.5 });
      }
    }
    return out;
  }, [gridSize, centre, developed, detail, claimed]);

  const poleRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const lensRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lastState = useRef<Int8Array>(new Int8Array(0));
  const acc = useRef(0);

  useLayoutEffect(() => {
    const pole = poleRef.current;
    const head = headRef.current;
    if (!pole || !head) return;
    const m = new THREE.Object3D();
    poles.forEach((p, i) => {
      m.position.set(p.x, TL_POLE_H / 2, p.z);
      m.scale.set(1, TL_POLE_H, 1);
      m.rotation.set(0, 0, 0);
      m.updateMatrix();
      pole.setMatrixAt(i, m.matrix);
      m.position.set(p.x, TL_HEAD_Y, p.z);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      head.setMatrixAt(i, m.matrix);
    });
    pole.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    pole.computeBoundingSphere();
    head.computeBoundingSphere();
    lensRefs.current.forEach((lens, row) => {
      if (!lens) return;
      const dy = [3.4, 0, -3.4][row];
      poles.forEach((p, i) => {
        m.position.set(p.x, TL_HEAD_Y + dy, p.z + 2.4);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        lens.setMatrixAt(i, m.matrix);
        lens.setColorAt(i, TL_DIM);
      });
      lens.instanceMatrix.needsUpdate = true;
      if (lens.instanceColor) lens.instanceColor.needsUpdate = true;
      lens.computeBoundingSphere();
    });
    lastState.current = new Int8Array(poles.length).fill(-1);
  }, [poles]);

  // Throttled: recolour only the lenses whose lit-row changed. The pole
  // with phase 0 governs E-W (X-axis) movement, phase 0.5 the crossing
  // N-S movement — signalStateFor() encodes the half-cycle offset.
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const now = performance.now() / 1000;
    const dirty = [false, false, false];
    poles.forEach((p, i) => {
      const state = signalStateFor(p.phase === 0, now); // 0 green 1 amber 2 red
      const row = state === 0 ? 2 : state === 1 ? 1 : 0; // -> TL_LIT index
      if (lastState.current[i] === row) return;
      for (let r = 0; r < 3; r++) {
        const lens = lensRefs.current[r];
        if (!lens) continue;
        lens.setColorAt(i, r === row ? TL_LIT[r] : TL_DIM);
        dirty[r] = true;
      }
      lastState.current[i] = row;
    });
    dirty.forEach((d, r) => {
      const lens = lensRefs.current[r];
      if (d && lens?.instanceColor) lens.instanceColor.needsUpdate = true;
    });
  });

  if (!poles.length) return null;
  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, poles.length]} key={`tlp-${poles.length}`} castShadow>
        <cylinderGeometry args={[0.9, 1.1, 1, 4]} />
        <meshStandardMaterial color="#2f333b" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, poles.length]} key={`tlh-${poles.length}`} castShadow frustumCulled={false}>
        <boxGeometry args={[3.4, 10.5, 3]} />
        <meshStandardMaterial color="#23262d" roughness={0.85} />
      </instancedMesh>
      {([0, 1, 2] as const).map((row): ReactNode => (
        <instancedMesh
          key={`tl-lens-${row}-${poles.length}`}
          ref={(r) => { lensRefs.current[row] = r; }}
          args={[undefined, undefined, poles.length]}
          frustumCulled={false}
        >
          <boxGeometry args={[2.4, 2.4, 1.4]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      ))}
    </group>
  );
}

// ── traffic ─────────────────────────────────────────────────────────
// Cars no longer slide along a single infinite lane. Each car is bound to
// a closed LOOP made of straight segments joined by quarter-circle arcs,
// so it actually corners at every junction. The four block loops that
// would cut beneath the central roundabout are deliberately omitted;
// cars at that junction use its dedicated circular loop instead. Every
// loop carries GATES at the
// grid junctions it crosses — a car reads signalStateFor() for the
// direction it is travelling and brakes to the stop line on red, crawls
// on amber, and accelerates on green. Cars also keep a gap to the car
// ahead on the same loop, so they queue at a red instead of stacking.

const CAR_COLORS = ["#e2e8f0", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#111827"];

// Vehicle variety. Every kind rides the same loops / signal / gap logic;
// they differ only in how the shared body+cabin+wheel+light instances are
// scaled and offset per car. `body` + `cabin` are reinterpreted per kind:
//   car   — hull + greenhouse (unchanged)
//   van   — one tall boxy hull + a short glassy nose section
//   lorry — `body` is the tall cargo box (shifted back), `cabin` the cab up front
//   bus   — one long tall hull + a thin dark window band for `cabin`
type VKind = "car" | "van" | "lorry" | "bus";
const V_MIX: { k: VKind; p: number }[] = [
  { k: "car", p: 0.66 }, { k: "van", p: 0.13 }, { k: "lorry", p: 0.12 }, { k: "bus", p: 0.09 },
];
function pickKind(r: number): VKind {
  let a = 0;
  for (const m of V_MIX) { a += m.p; if (r < a) return m.k; }
  return "car";
}
const V_SPEC: Record<VKind, {
  bodyS: [number, number, number]; bodyDX: number; bodyY: number;
  cabS: [number, number, number]; cabDX: number; cabY: number;
  half: number; wheel: number; tint: number;
}> = {
  car:   { bodyS: [1, 1, 1],          bodyDX: 0,    bodyY: 4,
           cabS: [1, 1, 1],           cabDX: 0,     cabY: 7.4,  half: 9,    wheel: 1,    tint: 0.64 },
  van:   { bodyS: [1.18, 1.7, 1.02],  bodyDX: -0.5, bodyY: 5.7,
           cabS: [0.62, 0.62, 0.98],  cabDX: 6.4,   cabY: 7.6,  half: 10.5, wheel: 1,    tint: 0.72 },
  lorry: { bodyS: [1.3, 1.45, 1.0],   bodyDX: -3.4, bodyY: 5.3,
           cabS: [0.72, 1.42, 1.0],   cabDX: 9.2,   cabY: 4.6,  half: 13,   wheel: 1.16, tint: 0.5  },
  bus:   { bodyS: [1.95, 2.02, 1.05], bodyDX: 0,    bodyY: 6.8,
           cabS: [1.86, 0.5, 1.06],   cabDX: 0,     cabY: 10.6, half: 16,   wheel: 1.12, tint: 0.82 },
};

const CAR_BASE_SPEED = 78;   // world units / sec on a clear straight
const CAR_ACCEL = 130;
const CAR_BRAKE = 240;
const CAR_ARC_SPEED = 34;     // cornering / roundabout speed cap
const CAR_GAP = 26;           // bumper gap kept to the car ahead
const STOP_MARGIN = 12;       // how far back from the junction to hold on red
const BRAKE_LOOKAHEAD = 150;  // start reacting to a gate this far out
// The roundabout's own carriageway deck sits this far above the tile-top
// ground level every other car position is calibrated against (see
// roundabout.tsx's DECK_Y = TILE_H + 0.4, "clears z-fighting" against the
// tile tops) — without adding it back here, a car circling the roundabout
// rendered at ordinary road height was sitting slightly *below* the
// actual roundabout surface, reading as sunk into the kerb/deck.
const ROUNDABOUT_Y_LIFT = 0.4;

type Piece = {
  kind: "line" | "arc";
  s0: number;
  len: number;
  // line
  ax?: number; az?: number; bx?: number; bz?: number;
  // arc
  cx?: number; cz?: number; r?: number; a0?: number; a1?: number;
  // gate at the END of this piece (a grid junction the loop crosses)
  gateAxisIsX?: boolean;
};
export type Loop = { pieces: Piece[]; L: number; gates: { s: number; axisIsX: boolean }[] };
type Car = {
  loop: number;
  s: number;        // arc-length position around the loop
  speed: number;
  color: THREE.Color;
  kind: VKind;
};

function lineP(ax: number, az: number, bx: number, bz: number, gateAxisIsX?: boolean): Piece {
  return { kind: "line", s0: 0, len: Math.hypot(bx - ax, bz - az), ax, az, bx, bz, gateAxisIsX };
}
function arcP(cx: number, cz: number, r: number, a0: number, a1: number): Piece {
  return { kind: "arc", s0: 0, len: Math.abs(a1 - a0) * r, cx, cz, r, a0, a1 };
}
function finishLoop(pieces: Piece[]): Loop {
  let acc = 0;
  const gates: { s: number; axisIsX: boolean }[] = [];
  for (const p of pieces) {
    p.s0 = acc;
    acc += p.len;
    if (p.kind === "line" && p.gateAxisIsX !== undefined) {
      gates.push({ s: acc, axisIsX: p.gateAxisIsX }); // gate sits at the piece end
    }
  }
  return { pieces, L: acc, gates };
}
export function posAt(loop: Loop, s: number): [number, number] {
  let ss = s % loop.L;
  if (ss < 0) ss += loop.L;
  const pcs = loop.pieces;
  let p = pcs[pcs.length - 1];
  for (const q of pcs) { if (ss < q.s0 + q.len || q === pcs[pcs.length - 1]) { p = q; break; } }
  const t = p.len > 0 ? (ss - p.s0) / p.len : 0;
  if (p.kind === "line") {
    return [p.ax! + (p.bx! - p.ax!) * t, p.az! + (p.bz! - p.az!) * t];
  }
  const a = p.a0! + (p.a1! - p.a0!) * t;
  return [p.cx! + Math.cos(a) * p.r!, p.cz! + Math.sin(a) * p.r!];
}

// One clockwise loop around the single plot bounded by x0<x1, z0<z1. The
// lane is set OUT from the block edges by laneOff (so a counter-loop on a
// shared road sits on the other side), corners are quarter arcs of turnR,
// and each straight ends with a gate for the junction it feeds.
export function blockLoop(x0: number, x1: number, z0: number, z1: number, laneOff: number, turnR: number): Loop {
  const L = laneOff, R = turnR;
  const tx0 = x0 - L, tx1 = x1 + L, tz0 = z0 - L, tz1 = z1 + L; // lane centreline box
  const pieces: Piece[] = [
    // top edge, travelling +x -> gate for the NE junction (E-W movement)
    lineP(tx0 + R, tz0, tx1 - R, tz0, true),
    arcP(tx1 - R, tz0 + R, R, -Math.PI / 2, 0),
    // right edge, travelling +z -> gate for the SE junction (N-S movement)
    lineP(tx1, tz0 + R, tx1, tz1 - R, false),
    arcP(tx1 - R, tz1 - R, R, 0, Math.PI / 2),
    // bottom edge, travelling -x
    lineP(tx1 - R, tz1, tx0 + R, tz1, true),
    arcP(tx0 + R, tz1 - R, R, Math.PI / 2, Math.PI),
    // left edge, travelling -z
    lineP(tx0, tz1 - R, tx0, tz0 + R, false),
    arcP(tx0 + R, tz0 + R, R, Math.PI, Math.PI * 1.5),
  ];
  return finishLoop(pieces);
}

// A full circle around the central roundabout — no gates (roundabouts run
// free), capped to the cornering speed.
export function roundaboutLoop(cx: number, cz: number, r: number): Loop {
  return finishLoop([arcP(cx, cz, r, 0, -Math.PI * 2)]); // clockwise
}

export function Traffic({
  gridSize, trafficLevel = 0.5, riverRoadIndex = null,
}: {
  gridSize: number;
  trafficLevel?: number;
  /** Vertical road replaced by the urban river; adjacent block loops cannot use it. */
  riverRoadIndex?: number | null;
}) {
  const centre = worldCentre(gridSize);

  // read the live density in useFrame without re-rendering / rebuilding
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  const { loops, cars, roundaboutLoopIdx } = useMemo(() => {
    let seed = gridSize * 911 + 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const xs = roadsV(gridSize).map((x) => x - centre + ROAD_W / 2);
    const zs = roadsH(gridSize).map((z) => z - centre + ROAD_W / 2);
    const laneOff = ROAD_W * 0.2;
    const turnR = ROAD_W * 0.55;

    const loops: Loop[] = [];
    const cars: Car[] = [];
    const addCarsTo = (loopIdx: number, n: number, forceKind?: VKind) => {
      const L = loops[loopIdx].L;
      for (let k = 0; k < n; k++) {
        cars.push({
          loop: loopIdx,
          s: ((k + rnd()) / n) * L,
          speed: CAR_BASE_SPEED * (0.7 + rnd() * 0.3),
          color: new THREE.Color(CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]),
          kind: forceKind ?? pickKind(rnd()),
        });
      }
    };

    // One loop per plot, ~55% of plots. Each loop is stocked to its
    // PEAK-HOUR (bumper-to-bumper) capacity; <Traffic>'s useFrame then
    // activates a `trafficLevel` fraction of each loop's cars + a fraction
    // of the (centre-outward) loops, and slows / packs them — so off-peak
    // is far cheaper while PEAK genuinely gridlocks. A block loop is
    // ~730 world units; at jam spacing (~30 u/car) that's ~24 cars, so
    // these caps fill most of the ring.
    const maxLoops = gridSize >= 22 ? 175 : gridSize >= 14 ? 230 : 9999;
    const peakPerLoop = gridSize >= 22 ? 16 : gridSize >= 14 ? 12 : gridSize <= 6 ? 9 : 16;
    const mid = (xs.length - 1) / 2;
    const order: [number, number][] = [];
    for (let a = 0; a < xs.length - 1; a++)
      for (let b = 0; b < zs.length - 1; b++) order.push([a, b]);
    order.sort((p, q) => (Math.hypot(p[0] - mid, p[1] - mid) - Math.hypot(q[0] - mid, q[1] - mid)));
    for (const [a, b] of order) {
      if (loops.length >= maxLoops) break;
      if (riverRoadIndex !== null && (a === riverRoadIndex || a + 1 === riverRoadIndex)) continue;
      if (((a * 73 + b * 31 + gridSize) % 100) >= 55) continue;
      // These four blocks meet at the centre junction. Their normal
      // quarter-turn sits inside the raised roundabout island, so keeping
      // them would make cars visibly drive through the kerb / landscaping.
      // The separate roundaboutLoop below is the only traffic route that
      // occupies this junction.
      const h = gridSize / 2;
      if ((a === h - 1 || a === h) && (b === h - 1 || b === h)) continue;
      loops.push(blockLoop(xs[a], xs[a + 1], zs[b], zs[b + 1], laneOff, turnR));
      addCarsTo(loops.length - 1, peakPerLoop);
    }
    // Circular flow around the central roundabout. It runs at r=120,
    // safely inside the ring's 84..156 road band and outside the island.
    // Kept to compact "car" kind only — the van/lorry/bus body/cabin
    // offsets (V_SPEC) are placed via a single heading sampled at the
    // vehicle's centre, a fine approximation on a straight or a brief
    // corner arc but visibly "bent" on a long vehicle riding a tight,
    // *sustained* curve, which the roundabout — unlike the rest of the
    // network — actually is.
    let roundaboutLoopIdx = -1;
    if (gridSize >= 6) {
      const [rcx, rcz] = roundaboutCentre(gridSize);
      roundaboutLoopIdx = loops.length;
      loops.push(roundaboutLoop(rcx, rcz, 120));
      addCarsTo(loops.length - 1, 20, "car");
    }
    return { loops, cars, roundaboutLoopIdx };
  }, [gridSize, centre, riverRoadIndex]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const headlightRef = useRef<THREE.InstancedMesh>(null);
  const taillightRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Car indices grouped per loop and ordered by position, so each frame a
  // car only has to look at the single car immediately ahead of it.
  const perLoop = useMemo(() => {
    const g: number[][] = loops.map(() => []);
    cars.forEach((c, i) => g[c.loop].push(i));
    g.forEach((arr) => arr.sort((p, q) => cars[p].s - cars[q].s));
    return g;
  }, [loops, cars]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    if (!body || !cabin) return;
    cars.forEach((c, i) => {
      body.setColorAt(i, c.color);
      cabin.setColorAt(i, c.color.clone().lerp(new THREE.Color("#172033"), V_SPEC[c.kind].tint));
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    const wheels = wheelRef.current;
    const headlights = headlightRef.current;
    const taillights = taillightRef.current;
    if (!body || !cabin || !wheels || !headlights || !taillights) return;
    const step = Math.min(dt, 0.05); // clamp a hitched frame so nobody jumps a red
    const now = performance.now() / 1000;

    // time-of-day density: activate a fraction of the (centre-outward)
    // loops, and at peak slow every car right down + pack the bumper gaps
    // so the queues at the lights read as a jam, not just "more cars".
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const activeLoops = Math.max(1, Math.ceil(loops.length * (0.32 + 0.68 * lv)));
    const perLoopFrac = 0.16 + 0.84 * lv;               // how full each active loop is
    const baseSpeed = CAR_BASE_SPEED * (1 - 0.62 * lv); // 78 → ~30 at full jam
    const gap = CAR_GAP * (1 - 0.62 * lv);              // 26 → ~10 at full jam

    const parkOne = (ci: number) => {
      dummy.position.set(0, -1000, 0);
      dummy.scale.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      body.setMatrixAt(ci, dummy.matrix);
      cabin.setMatrixAt(ci, dummy.matrix);
      for (let n = 0; n < 4; n++) wheels.setMatrixAt(ci * 4 + n, dummy.matrix);
      for (let n = 0; n < 2; n++) { headlights.setMatrixAt(ci * 2 + n, dummy.matrix); taillights.setMatrixAt(ci * 2 + n, dummy.matrix); }
    };

    for (let li = 0; li < loops.length; li++) {
      const loop = loops[li];
      const ring = perLoop[li];
      const yLift = li === roundaboutLoopIdx ? ROUNDABOUT_Y_LIFT : 0;
      if (li >= activeLoops) {
        for (const ci of ring) parkOne(ci);
        continue;
      }
      // `nActive` of the ring's cars run this frame — EVENLY SAMPLED
      // around the ring (not the first N, which would bunch on one arc),
      // the rest parked. nActive == ring.length at PEAK → bumper-to-bumper.
      const nActive = Math.max(1, Math.min(ring.length, Math.round(ring.length * perLoopFrac)));
      const activeIdx: number[] = [];
      const used = new Set<number>();
      for (let j = 0; j < nActive; j++) {
        const ki = Math.min(ring.length - 1, Math.floor((j * ring.length) / nActive));
        activeIdx.push(ki);
        used.add(ki);
      }
      for (let k = 0; k < ring.length; k++) if (!used.has(k)) parkOne(ring[k]);

      // process lead car first so followers clamp against an updated gap
      for (let ai = activeIdx.length - 1; ai >= 0; ai--) {
        const k = activeIdx[ai];
        const ci = ring[k];
        const c = cars[ci];

        // desired speed from the road + the next signal
        let target = baseSpeed;
        // which piece are we on? (arcs are slow)
        let sMod = c.s % loop.L; if (sMod < 0) sMod += loop.L;
        for (const p of loop.pieces) {
          if (sMod >= p.s0 && sMod < p.s0 + p.len) { if (p.kind === "arc") target = Math.min(target, CAR_ARC_SPEED); break; }
        }
        // nearest gate ahead
        let gateHold = Infinity;
        for (const gate of loop.gates) {
          let d = gate.s - sMod;
          if (d < -4) d += loop.L;              // wrapped round
          if (d < 0) d = 0;
          if (d > BRAKE_LOOKAHEAD) continue;
          const st = signalStateFor(gate.axisIsX, now); // 0 green 1 amber 2 red
          if (st === 2) { gateHold = Math.min(gateHold, c.s + d - STOP_MARGIN); target = Math.min(target, 0); }
          else if (st === 1) target = Math.min(target, d > 40 ? baseSpeed * 0.32 : 0); // amber: slow, stop if too close to clear
        }

        // gap to the car immediately ahead among the ACTIVE cars — longer
        // vehicles need more room so a bus doesn't telescope into the car ahead
        const ahead = nActive > 1 ? cars[ring[activeIdx[(ai + 1) % nActive]]] : null;
        let gapHold = Infinity;
        if (ahead) {
          let as = ahead.s;
          while (as <= c.s) as += loop.L;
          gapHold = as - gap - (V_SPEC[ahead.kind].half - 9) * 1.1;
        }

        // integrate speed toward target, then advance, then clamp to holds
        const accel = target >= c.speed ? CAR_ACCEL : CAR_BRAKE;
        c.speed += Math.sign(target - c.speed) * accel * step;
        if (c.speed < 0) c.speed = 0;
        if (c.speed > baseSpeed) c.speed = baseSpeed;
        let ns = c.s + c.speed * step;
        if (ns > gapHold) { ns = Math.max(c.s, gapHold); c.speed = 0; }
        if (ns > gateHold) { ns = Math.max(c.s, gateHold); c.speed = 0; }
        c.s = ns;

        // write transforms
        const [x, z] = posAt(loop, c.s);
        const [x2, z2] = posAt(loop, c.s + 3);
        const heading = Math.atan2(z2 - z, x2 - x);
        const cos = Math.cos(heading), sin = Math.sin(heading);
        const local = (fwd: number, side: number) =>
          [x + cos * fwd - sin * side, z + sin * fwd + cos * side] as const;
        const spec = V_SPEC[c.kind];

        const [bx, bz] = local(spec.bodyDX, 0);
        dummy.position.set(bx, spec.bodyY + yLift, bz);
        dummy.rotation.set(0, heading, 0);
        dummy.scale.set(spec.bodyS[0], spec.bodyS[1], spec.bodyS[2]);
        dummy.updateMatrix();
        body.setMatrixAt(ci, dummy.matrix);

        const [cbx, cbz] = local(spec.cabDX, 0);
        dummy.position.set(cbx, spec.cabY + yLift, cbz);
        dummy.scale.set(spec.cabS[0], spec.cabS[1], spec.cabS[2]);
        dummy.updateMatrix();
        cabin.setMatrixAt(ci, dummy.matrix);

        const wf = spec.half * 0.62;
        const wy = 2.25 + (spec.wheel - 1) * 2.05 + yLift;
        [[-wf, -4.1], [-wf, 4.1], [wf, -4.1], [wf, 4.1]].forEach(([f, s], n) => {
          const [wx, wz] = local(f, s);
          dummy.position.set(wx, wy, wz);
          dummy.rotation.set(Math.PI / 2, heading, 0);
          dummy.scale.set(spec.wheel, spec.wheel, spec.wheel);
          dummy.updateMatrix();
          wheels.setMatrixAt(ci * 4 + n, dummy.matrix);
        });
        dummy.rotation.set(0, heading, 0);
        dummy.scale.set(1, 1, 1);
        const lf = spec.half * 1.02;
        const ly = 2.4 + spec.bodyY * 0.4 + yLift;
        [-2.6, 2.6].forEach((side, n) => {
          const [hx, hz] = local(lf, side);
          dummy.position.set(hx, ly, hz);
          dummy.updateMatrix();
          headlights.setMatrixAt(ci * 2 + n, dummy.matrix);
          const [tx, tz] = local(-lf, side);
          dummy.position.set(tx, ly, tz);
          dummy.updateMatrix();
          taillights.setMatrixAt(ci * 2 + n, dummy.matrix);
        });
      }
    }
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    headlights.instanceMatrix.needsUpdate = true;
    taillights.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, cars.length]} key={`car-body-${cars.length}`} castShadow>
        <boxGeometry args={[18, 5.5, 8]} />
        <meshStandardMaterial color="#ffffff" metalness={0.18} roughness={0.42} />
      </instancedMesh>
      <instancedMesh ref={cabinRef} args={[undefined, undefined, cars.length]} key={`car-cabin-${cars.length}`} castShadow>
        <boxGeometry args={[9.5, 3.4, 6.7]} />
        <meshStandardMaterial color="#ffffff" metalness={0.35} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={wheelRef} args={[undefined, undefined, cars.length * 4]} key={`car-wheels-${cars.length}`} castShadow>
        <cylinderGeometry args={[2.05, 2.05, 1.3, 8]} />
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={headlightRef} args={[undefined, undefined, cars.length * 2]} key={`car-headlights-${cars.length}`}>
        <boxGeometry args={[0.7, 1.2, 1.55]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={taillightRef} args={[undefined, undefined, cars.length * 2]} key={`car-taillights-${cars.length}`}>
        <boxGeometry args={[0.7, 1.2, 1.55]} />
        <meshBasicMaterial color="#ff3b30" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ── elevated LRT ────────────────────────────────────────────────────
// One elevated line through world centre. `axis` "z" = runs N-S (long in
// Z); "x" = runs E-W. Geometry is authored along +Z then the whole
// <group> is yaw-rotated for the E-W line, so there is one code path.
//
// SERVICE FREQUENCY tracks `trafficLevel` (levelRef): a second train
// enters service above ~0.5 (peak), and both run faster — so at rush hour
// a train passes the interchange roughly 3× as often as off-peak.
const TRAIN_CARS = [-30, 0, 30];
const CAR_LEN = 26;
function LrtTrain({ tref, livery = "#177fc5", liveryDark = "#0e5d9a" }: {
  tref: RefObject<THREE.Group>;
  /** Line-coded livery accent (see LrtLine — each crossing line gets its
   * own colour, same idea as KL's real multi-line rail network). */
  livery?: string;
  liveryDark?: string;
}) {
  // Bidirectional service (LRT sets don't turn around at the terminus) —
  // a small headlight at each outermost end, whichever is currently
  // leading.
  const frontZ = TRAIN_CARS[TRAIN_CARS.length - 1] + CAR_LEN / 2 + 0.4;
  const backZ = TRAIN_CARS[0] - CAR_LEN / 2 - 0.4;
  const side = [-1, 1] as const;
  return (
    <group ref={tref} position={[0, DECK_Y + 8, 0]}>
      {TRAIN_CARS.map((z) => (
        <group key={z} position={[0, 0, z]}>
          {/* Brushed-metal car shell. The window band is intentionally
              composed from side panes below, rather than one blue box
              around the whole car, so it reads as a train at any orbit. */}
          <mesh castShadow>
            <boxGeometry args={[12, 10, CAR_LEN]} />
            <meshStandardMaterial color="#d9e1e8" roughness={0.32} metalness={0.42} />
          </mesh>
          {side.map((xSide) => (
            <group key={xSide}>
              {/* Dark individual panes make the passenger saloon visible
                  from the street, with a restrained cyan glow at night. */}
              {[-8.4, -3.1, 3.1, 8.4].map((paneZ) => (
                <mesh key={paneZ} position={[xSide * 6.08, 1.15, paneZ]}>
                  <boxGeometry args={[0.22, 3.55, 4.15]} />
                  <meshStandardMaterial color="#102235" emissive="#4fa9d8" emissiveIntensity={0.32} roughness={0.14} metalness={0.5} />
                </mesh>
              ))}
              {/* Twin passenger doors and a clean blue lower livery line. */}
              {[-5.7, 5.7].map((doorZ) => (
                <mesh key={doorZ} position={[xSide * 6.12, -0.45, doorZ]}>
                  <boxGeometry args={[0.18, 5.6, 4.8]} />
                  <meshStandardMaterial color="#aab8c6" roughness={0.5} metalness={0.28} />
                </mesh>
              ))}
              <mesh position={[xSide * 6.14, -3.55, 0]}>
                <boxGeometry args={[0.2, 1.05, CAR_LEN - 1]} />
                <meshStandardMaterial color={livery} emissive={liveryDark} emissiveIntensity={0.18} roughness={0.3} metalness={0.2} />
              </mesh>
            </group>
          ))}
          {/* Roof equipment gives the three-car set a believable service
              profile instead of a row of plain rectangular blocks. */}
          {/* roof-mounted AC pod */}
          <mesh position={[0, 5.7, 0]}>
            <boxGeometry args={[7.5, 1.4, 18]} />
            <meshStandardMaterial color="#9daab8" roughness={0.52} metalness={0.25} />
          </mesh>
          <mesh position={[0, 6.5, 0]}>
            <boxGeometry args={[5.6, 0.24, 16]} />
            <meshStandardMaterial color="#66788b" roughness={0.7} />
          </mesh>
          {/* bogies, near each end */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, -5.6, s * (CAR_LEN / 2 - 4)]}>
              <boxGeometry args={[10.4, 2.2, 5]} />
              <meshStandardMaterial color="#12161c" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Distinct glazed cab faces at both ends. The set can reverse at a
          terminus without looking like it is travelling backwards. */}
      {[{ z: frontZ, dir: 1 }, { z: backZ, dir: -1 }].map(({ z, dir }) => (
        <group key={dir}>
          {/* destination / route LED strip above the windshield */}
          <mesh position={[0, 3.85, z + dir * 0.12]}>
            <boxGeometry args={[6.4, 0.8, 0.28]} />
            <meshBasicMaterial color="#ffcf6b" toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.2, z + dir * 0.1]}>
            <boxGeometry args={[8.5, 4.5, 0.3]} />
            <meshStandardMaterial color="#0c263b" emissive="#3c90bd" emissiveIntensity={0.38} roughness={0.12} metalness={0.62} />
          </mesh>
          <mesh position={[0, -3.25, z + dir * 0.18]}>
            <boxGeometry args={[11.2, 1.2, 0.38]} />
            <meshStandardMaterial color={livery} emissive={liveryDark} emissiveIntensity={0.18} roughness={0.3} />
          </mesh>
          {[-3.2, 3.2].map((x) => (
            <mesh key={x} position={[x, -1.05, z + dir * 0.35]}>
              <boxGeometry args={[1.25, 1.25, 0.45]} />
              <meshBasicMaterial color={dir === 1 ? "#fff4c2" : "#f04444"} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Flexible gangway couplers between the car shells. */}
      {[-15, 15].map((z) => (
        <mesh key={z} position={[0, -2.1, z]}>
          <boxGeometry args={[7.8, 5.4, 4.2]} />
          <meshStandardMaterial color="#1d2a35" roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}
// Half-width of the central interchange's own crossed platforms (see
// Lrt's ±19 platform-edge strips) — each line's raw track stops this far
// short of centre on both sides so the two lines never overlap there.
const INTERCHANGE_GAP = 19;

function LrtLine({ axis, span, levelRef }: { axis: "x" | "z"; span: number; levelRef: MutableRefObject<number> }) {
  // Line-coded livery — the N-S and E-W lines read as two distinct
  // services where they cross at the interchange, the same way KL's
  // real multi-line rail network colour-codes each line.
  const livery = axis === "z" ? "#177fc5" : "#e8792a";
  const liveryDark = axis === "z" ? "#0e5d9a" : "#a85a1a";
  const t1 = useRef<THREE.Group>(null);
  const t2 = useRef<THREE.Group>(null);
  const d1 = useRef(axis === "x" ? -1 : 1);
  const d2 = useRef(axis === "x" ? 1 : -1);
  const piers = useMemo(() => {
    const out: number[] = [];
    for (let z = -span / 2 + ROAD_GAP; z <= span / 2 - ROAD_GAP; z += ROAD_GAP * 2) {
      if (Math.abs(z) < INTERCHANGE_GAP) continue; // the interchange stands on its own 4 columns
      out.push(z);
    }
    return out;
  }, [span]);
  useFrame((_, dt) => {
    const lv = Math.max(0, Math.min(1, levelRef.current));
    const speed = 58 + 78 * lv;      // 58 off-peak → 136 at peak
    const twoTrains = lv >= 0.5;
    const lim = span / 2 - 60;
    const advance = (g: THREE.Group | null, dr: MutableRefObject<number>) => {
      if (!g) return;
      g.position.z += dr.current * speed * dt;
      if (g.position.z > lim) { g.position.z = lim; dr.current = -1; g.rotation.y = Math.PI; }
      else if (g.position.z < -lim) { g.position.z = -lim; dr.current = 1; g.rotation.y = 0; }
    };
    advance(t1.current, d1);
    if (twoTrains) advance(t2.current, d2);
    if (t2.current) t2.current.visible = twoTrains;
  });
  // The N-S and E-W lines both pass through world origin at the same
  // DECK_Y — rendered as one continuous span each, their deck/rail/
  // parapet boxes physically overlapped (and z-fought) in the crossing
  // square, on top of the interchange's own crossed platforms occupying
  // that same footprint. Each line's raw track now stops INTERCHANGE_GAP
  // short of centre on both sides — matching the interchange platform's
  // own half-width (see Lrt's ±19 platform-edge strips) — so the
  // interchange alone provides the surface through the crossing instead
  // of three overlapping slabs fighting for it.
  const segLen = span / 2 - INTERCHANGE_GAP;
  const segCentre = INTERCHANGE_GAP + segLen / 2;
  return (
    <group rotation={[0, axis === "x" ? Math.PI / 2 : 0, 0]}>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[0, DECK_Y, side * segCentre]} castShadow receiveShadow>
            <boxGeometry args={[14, 4, segLen]} />
            <meshStandardMaterial color="#3b4557" />
          </mesh>
          {/* running rails on top of the deck */}
          {[-3.2, 3.2].map((x) => (
            <mesh key={`rail${x}`} position={[x, DECK_Y + 2.3, side * segCentre]}>
              <boxGeometry args={[0.6, 0.7, segLen]} />
              <meshStandardMaterial color="#8b97aa" roughness={0.35} metalness={0.65} />
            </mesh>
          ))}
          {[-7.4, 7.4].map((x) => (
            <mesh key={x} position={[x, DECK_Y + 3, side * segCentre]}>
              <boxGeometry args={[1.6, 3, segLen]} />
              <meshStandardMaterial color="#5b6a80" emissive="#7dd3fc" emissiveIntensity={0.12} />
            </mesh>
          ))}
        </group>
      ))}
      {piers.map((z, i) => (
        <group key={i}>
          <mesh position={[0, DECK_Y / 2, z]} castShadow>
            <boxGeometry args={[8, DECK_Y, 8]} />
            <meshStandardMaterial color="#2f3846" />
          </mesh>
          {/* hammerhead cap, widened under the deck like a real viaduct pier */}
          <mesh position={[0, DECK_Y - 3, z]} castShadow>
            <boxGeometry args={[16, 4, 10]} />
            <meshStandardMaterial color="#2f3846" />
          </mesh>
        </group>
      ))}
      <LrtTrain tref={t1} livery={livery} liveryDark={liveryDark} />
      <LrtTrain tref={t2} livery={livery} liveryDark={liveryDark} />
    </group>
  );
}

// Elevated LRT — a CROSS through the middle of the city: an N-S line and
// an E-W line meeting at a raised interchange station dead centre. Metro
// and dense-metro grids only. `trafficLevel` drives train frequency.
export function Lrt({ gridSize, trafficLevel = 0.5 }: { gridSize: number; trafficLevel?: number }) {
  const show = gridSize >= 10;
  const span = worldSize(gridSize);
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;
  if (!show) return null;
  return (
    <group>
      <LrtLine axis="z" span={span} levelRef={levelRef} />
      <LrtLine axis="x" span={span} levelRef={levelRef} />
      {/* central interchange: two crossed platforms + a vaulted canopy on columns */}
      <group position={[0, DECK_Y + 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[38, 3, 150]} />
          <meshStandardMaterial color="#46536a" />
        </mesh>
        <mesh receiveShadow>
          <boxGeometry args={[150, 3, 38]} />
          <meshStandardMaterial color="#46536a" />
        </mesh>
        {/* platform-edge safety strip, both crossed platforms */}
        {[-19, 19].map((x) => (
          <mesh key={`edgex${x}`} position={[x, 1.6, 0]}>
            <boxGeometry args={[1.2, 0.3, 150]} />
            <meshBasicMaterial color="#ffc93f" toneMapped={false} />
          </mesh>
        ))}
        {[-19, 19].map((z) => (
          <mesh key={`edgez${z}`} position={[0, 1.6, z]}>
            <boxGeometry args={[150, 0.3, 1.2]} />
            <meshBasicMaterial color="#ffc93f" toneMapped={false} />
          </mesh>
        ))}
        {/* shallow vaulted canopy — two tilted halves meeting at a ridge,
            not a flat slab */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 21.5, s * 8]} rotation={[s * -0.14, 0, 0]} castShadow>
            <boxGeometry args={[64, 1.6, 34]} />
            <meshStandardMaterial color="#cdd6e2" roughness={0.5} metalness={0.2} />
          </mesh>
        ))}
        {/* illuminated interchange signage */}
        <mesh position={[0, 15, 32]}>
          <boxGeometry args={[16, 4, 1]} />
          <meshBasicMaterial color="#2f6bff" toneMapped={false} />
        </mesh>
        {[-26, 26].flatMap((x) => [-26, 26].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, 10, z]}>
            <boxGeometry args={[2.4, 20, 2.4]} />
            <meshStandardMaterial color="#8b97aa" />
          </mesh>
        )))}
      </group>
    </group>
  );
}

// ── landmark / celebration markers ─────────────────────────────────
// Vertical beam + a slow-pulsing ground ring over a zone tile. Used for
// the town-centre landmark (steady) and a project-approved celebration
// (bright, auto-expires via the `until` timestamp).
export function ZoneBeacon({
  position, color = "#7dd3fc", height = 260, celebrate = false, until = 0,
}: {
  position: [number, number, number];
  color?: string;
  height?: number;
  celebrate?: boolean;
  until?: number;
}) {
  const beam = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [x, y, z] = position;

  useFrame(({ clock }) => {
    const now = Date.now();
    const live = !celebrate || now < until;
    const t = clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * (celebrate ? 6 : 1.6));
    if (beam.current) {
      const mat = beam.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (celebrate ? 0.7 : 0.14) * (0.6 + 0.4 * pulse) * (live ? 1 : 0);
      beam.current.visible = live;
    }
    if (ring.current) {
      const s = 1 + (celebrate ? pulse * 2.4 : pulse * 0.25);
      ring.current.scale.set(s, s, s);
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (celebrate ? 0.7 : 0.3) * (1 - (celebrate ? pulse : 0)) * (live ? 1 : 0);
      ring.current.visible = live;
    }
  });

  return (
    <group position={[x, y, z]}>
      <mesh ref={beam} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[6, 10, height, 12, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
        <ringGeometry args={[70, 84, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      {celebrate && (
        <Sparkles count={70} scale={[180, 220, 180]} position={[0, 110, 0]} size={11} speed={2} color={color} />
      )}
    </group>
  );
}
