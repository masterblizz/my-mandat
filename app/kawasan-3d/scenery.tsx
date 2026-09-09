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
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, GradientTexture, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  roadsV, roadsH, worldCentre, worldSize, ROAD_GAP, PLOT,
  TOD_ENV, type Tod,
} from "./cityData";
import { junctionInsideLarge } from "./largeBuildings";

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
// row 0 = red (top), 1 = amber, 2 = green (bottom): fraction-of-cycle each is lit
const TL_ROW_WINDOW: [number, number][] = [[0.52, 1.0], [0.46, 0.54], [0.02, 0.46]];

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

  // Throttled: recolour only the lenses whose lit-row changed.
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const t = (performance.now() / 1000 / TL_CYCLE);
    const dirty = [false, false, false];
    poles.forEach((p, i) => {
      const local = (t + p.phase) % 1;
      const row = TL_ROW_WINDOW.findIndex(([a, b]) => local >= a && local < b);
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
type Car = {
  axis: "x" | "z";
  lane: number;
  t: number;       // 0..len along the lane
  speed: number;
  color: THREE.Color;
};
const CAR_COLORS = ["#e2e8f0", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#111827"];

export function Traffic({ gridSize }: { gridSize: number }) {
  const centre = worldCentre(gridSize);
  const span = worldSize(gridSize);
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const cars = useMemo<Car[]>(() => {
    const out: Car[] = [];
    let seed = gridSize * 911;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const laneOff = ROAD_W * 0.25;
    roadsH(gridSize).forEach((z, i) => {
      const lz = z - centre + ROAD_W / 2;
      for (let k = 0; k < 2; k++)
        out.push({ axis: "x", lane: lz + (k ? laneOff : -laneOff), t: rnd() * span, speed: 40 + rnd() * 40, color: new THREE.Color(CAR_COLORS[(i + k) % CAR_COLORS.length]) });
    });
    roadsV(gridSize).forEach((x, i) => {
      const lx = x - centre + ROAD_W / 2;
      for (let k = 0; k < 2; k++)
        out.push({ axis: "z", lane: lx + (k ? laneOff : -laneOff), t: rnd() * span, speed: 40 + rnd() * 40, color: new THREE.Color(CAR_COLORS[(i + k + 3) % CAR_COLORS.length]) });
    });
    return out;
  }, [gridSize, centre, span]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    cars.forEach((c, i) => mesh.setColorAt(i, c.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const half = span / 2;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      c.t = (c.t + c.speed * dt) % span;
      const p = -half + c.t;
      if (c.axis === "x") {
        dummy.position.set(p, 3, c.lane);
        dummy.rotation.set(0, 0, 0);
      } else {
        dummy.position.set(c.lane, 3, p);
        dummy.rotation.set(0, Math.PI / 2, 0);
      }
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cars.length]} key={`cars-${cars.length}`} castShadow>
      <boxGeometry args={[18, 6, 8]} />
      {/* white base so per-instance setColorAt() shows the true car colour */}
      <meshStandardMaterial color="#ffffff" />
    </instancedMesh>
  );
}

// ── elevated LRT ────────────────────────────────────────────────────
export function Lrt({ gridSize }: { gridSize: number }) {
  const show = gridSize >= 10; // metro / dense-metro only (density >= 0.62)
  const centre = worldCentre(gridSize);
  const span = worldSize(gridSize);
  const trainRef = useRef<THREE.Group>(null);
  const dir = useRef(1);

  const guideX = useMemo(() => {
    const v = roadsV(gridSize);
    return (v[1] ?? v[0]) - centre + ROAD_W / 2;
  }, [gridSize, centre]);

  const piers = useMemo(() => {
    const out: number[] = [];
    for (let z = -span / 2; z <= span / 2; z += ROAD_GAP * 2) out.push(z);
    return out;
  }, [span]);

  useFrame((_, dt) => {
    const g = trainRef.current;
    if (!g) return;
    const lim = span / 2 - 60;
    g.position.z += dir.current * 70 * dt;
    if (g.position.z > lim) { g.position.z = lim; dir.current = -1; g.rotation.y = Math.PI; }
    else if (g.position.z < -lim) { g.position.z = -lim; dir.current = 1; g.rotation.y = 0; }
  });

  if (!show) return null;
  return (
    <group position={[guideX, 0, 0]}>
      {/* deck + a bright parapet edge so the viaduct reads at distance */}
      <mesh position={[0, DECK_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 4, span]} />
        <meshStandardMaterial color="#3b4557" />
      </mesh>
      {[-7.4, 7.4].map((x) => (
        <mesh key={x} position={[x, DECK_Y + 3, 0]}>
          <boxGeometry args={[1.6, 3, span]} />
          <meshStandardMaterial color="#5b6a80" emissive="#7dd3fc" emissiveIntensity={0.12} />
        </mesh>
      ))}
      {/* piers */}
      {piers.map((z, i) => (
        <mesh key={i} position={[0, DECK_Y / 2, z]} castShadow>
          <boxGeometry args={[8, DECK_Y, 8]} />
          <meshStandardMaterial color="#2f3846" />
        </mesh>
      ))}
      {/* one mid-span station: platform slab + canopy */}
      <group position={[0, DECK_Y + 2, 0]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[34, 3, 120]} />
          <meshStandardMaterial color="#46536a" />
        </mesh>
        <mesh position={[0, 16, 0]} castShadow>
          <boxGeometry args={[38, 2, 128]} />
          <meshStandardMaterial color="#cdd6e2" />
        </mesh>
        {[-58, 58].map((z) =>
          [-15, 15].map((x) => (
            <mesh key={`${x}_${z}`} position={[x, 8, z]}>
              <boxGeometry args={[2, 16, 2]} />
              <meshStandardMaterial color="#8b97aa" />
            </mesh>
          )),
        )}
      </group>
      {/* 3-car train */}
      <group ref={trainRef} position={[0, DECK_Y + 8, 0]}>
        {[-30, 0, 30].map((z) => (
          <mesh key={z} position={[0, 0, z]} castShadow>
            <boxGeometry args={[12, 10, 26]} />
            <meshStandardMaterial color="#dfe6ee" emissive="#8fd3ff" emissiveIntensity={0.2} />
          </mesh>
        ))}
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
