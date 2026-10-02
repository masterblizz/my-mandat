"use client";

// Scene dressing: day/dusk/night environment, shadows, street lamps,
// cars, elevated LRT, rain, and zone beacons.
//
// - CityEnvironment: gradient sky + fog + sun/moon + 3 lights + drifting
//   haze, driven by TOD_ENV (the 3D port of .kw-scene[data-tod]); an
//   overcast wash + falling <Rain> when weather === "rain".
// - StreetLamps: instanced pole + head at every road junction; heads glow
//   and camera-following point lights switch on at dusk/night (TOD_ENV.lamp × mood).
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
import { Stars, GradientTexture, Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  roadsV, roadsH, worldCentre, worldSize, ROAD_GAP, PLOT,
  TOD_ENV, type Tod,
} from "./cityData";
import { junctionInsideLarge } from "./largeBuildings";
import { vehicleBox, makePaintMaterial, makeGlassMaterial, makeTyreMaterial } from "./vehicleLook";
import { R_IN as RB_R_IN, R_OUT as RB_R_OUT, roundaboutLift } from "./roundabout";
import {
  signalStateFor, createTrafficSim, stepTraffic, V_SPEC, type VKind, type Junction,
} from "./trafficSim";
// Loop geometry moved to trafficSim.ts; re-exported for twowheelers.tsx.
export {
  signalStateFor, blockLoop, detourRoundabout, gridRoadCentres, pointOnGridAsphalt, posAt,
  type Loop, type GridRoadCentres,
} from "./trafficSim";

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
        shadow-radius={3}
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
// Instanced wind-driven streaks and expanding ground splashes. Both effects
// keep a fixed instance budget and only update matrices, so rain density does
// not create or destroy objects while the camera is moving.
function Rain({ span }: { span: number }) {
  const dropRef = useRef<THREE.InstancedMesh>(null);
  const splashRef = useRef<THREE.InstancedMesh>(null);
  const N = 1400;
  const SPLASH_N = 220;
  const H = span * 0.8;
  const drops = useMemo(() => {
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
  const splashes = useMemo(() => {
    let s = 71;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    return Array.from({ length: SPLASH_N }, () => ({
      x: (rnd() - 0.5) * span * 1.25,
      z: (rnd() - 0.5) * span * 1.25,
      life: rnd(),
      rate: 0.75 + rnd() * 1.3,
    }));
  }, [span]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const rainTilt = useMemo(() => {
    const downwind = new THREE.Vector3(-0.2, -1, 0.065).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), downwind);
  }, []);

  useLayoutEffect(() => {
    const dropMesh = dropRef.current;
    const splashMesh = splashRef.current;
    if (!dropMesh || !splashMesh) return;
    drops.forEach((d, i) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.quaternion.copy(rainTilt);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dropMesh.setMatrixAt(i, dummy.matrix);
    });
    splashes.forEach((s, i) => {
      const scale = 0.4 + s.life * 4.2;
      dummy.position.set(s.x, 1.05, s.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      splashMesh.setMatrixAt(i, dummy.matrix);
    });
    dropMesh.instanceMatrix.needsUpdate = true;
    splashMesh.instanceMatrix.needsUpdate = true;
  }, [drops, splashes, dummy, rainTilt]);

  useFrame((_, dt) => {
    const dropMesh = dropRef.current;
    const splashMesh = splashRef.current;
    if (!dropMesh || !splashMesh) return;
    const step = Math.min(dt, 0.05);
    const half = span * 0.65;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.x -= d.v * 0.2 * step;
      d.z += d.v * 0.065 * step;
      d.y -= d.v * step;
      if (d.y < 0) d.y += H;
      if (d.x < -half) d.x += half * 2;
      if (d.z > half) d.z -= half * 2;
      dummy.position.set(d.x, d.y, d.z);
      dummy.quaternion.copy(rainTilt);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dropMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < splashes.length; i++) {
      const splash = splashes[i];
      splash.life += splash.rate * step;
      if (splash.life >= 1) splash.life -= 1;
      const scale = 0.4 + splash.life * 4.2;
      dummy.position.set(splash.x, 1.05, splash.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      splashMesh.setMatrixAt(i, dummy.matrix);
    }
    dropMesh.instanceMatrix.needsUpdate = true;
    splashMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={dropRef} args={[undefined, undefined, N]} frustumCulled={false}>
        <boxGeometry args={[0.7, 16, 0.7]} />
        <meshBasicMaterial color="#b7cbdb" transparent opacity={0.38} fog={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={splashRef} args={[undefined, undefined, SPLASH_N]} frustumCulled={false}>
        <ringGeometry args={[0.32, 0.48, 8]} />
        <meshBasicMaterial color="#d6e8f2" transparent opacity={0.24} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
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
// Lamps stand on the road verge, this far in from the plot edge.
const LAMP_KERB_IN = 2.5;
// How many real point lights follow the camera through the lamp field.
const LAMP_LIGHT_COUNT = 12;

// Soft radial falloff for the light pool under each lamp head: bright
// centre fading to nothing at the rim, so it reads as cast light rather
// than a painted disc. Built once and shared.
let lampPoolTex: THREE.Texture | null = null;
function lampPoolTexture(): THREE.Texture {
  if (lampPoolTex) return lampPoolTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.42)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  lampPoolTex = new THREE.CanvasTexture(c);
  lampPoolTex.colorSpace = THREE.SRGBColorSpace;
  return lampPoolTex;
}

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
    // [x, z, yaw]: yaw points the outreach arm (local +X) over the road.
    // Arm direction is (cos yaw, -sin yaw) in world XZ.
    const out: [number, number, number][] = [];
    const blocked = (px: number, pz: number, i: number, j: number) =>
      (claimed && junctionInsideLarge(i, j, gridSize, claimed)) ||
      (hideNear && Math.hypot(px - hideNear[0], pz - hideNear[1]) < 130);
    const yawToward = (dx: number, dz: number) => Math.atan2(-dz, dx);
    // Junction lamps stand on one kerb corner (not in the middle of the
    // intersection) and reach diagonally over the box junction.
    const corner = ROAD_W / 2 - LAMP_KERB_IN;
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < zs.length; j++) {
        // Signal heads stand just behind every corner (ROAD_W/2 + 2); the
        // lamp sits on the kerb line in front of one of them.
        const sx = (i + j) % 2 ? 1 : -1;
        const sz = -sx;
        const px = xs[i] + sx * corner, pz = zs[j] + sz * corner;
        if (!blocked(xs[i], zs[j], i, j)) out.push([px, pz, yawToward(-sx, -sz)]);
      }
    }
    // one mid-span lamp per road edge, alternating side — `detail` caps
    // the rate well below 100% even at the top tier so this stays a
    // trim, not a doubling.
    const off = ROAD_W / 2 - LAMP_KERB_IN;
    const rate = detail * 52;
    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j + 1 < zs.length; j++) {
        if (((i * 131 + j * 17) % 100) >= rate) continue;
        const side = j % 2 ? 1 : -1;
        const px = xs[i] + side * off;
        const pz = (zs[j] + zs[j + 1]) / 2;
        if (!blocked(px, pz, i, j)) out.push([px, pz, yawToward(-side, 0)]);
      }
    }
    for (let j = 0; j < zs.length; j++) {
      for (let i = 0; i + 1 < xs.length; i++) {
        if (((j * 131 + i * 17 + 7) % 100) >= rate) continue;
        const side = i % 2 ? 1 : -1;
        const px = (xs[i] + xs[i + 1]) / 2;
        const pz = zs[j] + side * off;
        if (!blocked(px, pz, i, j)) out.push([px, pz, yawToward(0, -side)]);
      }
    }
    return out;
  }, [gridSize, centre, detail, claimed, hideNear]);

  const poleRef = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const poolRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const pole = poleRef.current;
    const base = baseRef.current;
    const arm = armRef.current;
    const head = headRef.current;
    const glow = glowRef.current;
    const pool = poolRef.current;
    if (!pole || !base || !arm || !head || !glow || !pool) return;
    const m = new THREE.Object3D();
    points.forEach(([x, z, yaw], i) => {
      // One Object3D is reused for every part, so reset its rotation per
      // lamp: the light pool's lie-flat rotation used to leak into the next
      // lamp's pole and base, knocking every pole over onto the road.
      m.rotation.set(0, 0, 0);
      m.position.set(x, LAMP_POLE_H / 2, z);
      m.scale.set(1, LAMP_POLE_H, 1);
      m.updateMatrix();
      pole.setMatrixAt(i, m.matrix);
      m.position.set(x, 0.8, z);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      base.setMatrixAt(i, m.matrix);

      // Outreach arm over the carriageway; the head sits at its tip.
      const dx = Math.cos(yaw), dz = -Math.sin(yaw);
      m.position.set(x + dx * 3.4, LAMP_POLE_H - 1.2, z + dz * 3.4);
      m.rotation.set(0, yaw, 0);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      arm.setMatrixAt(i, m.matrix);

      m.position.set(x + dx * 7.1, LAMP_POLE_H - 1.25, z + dz * 7.1);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      head.setMatrixAt(i, m.matrix);
      m.position.set(x + dx * 7.1, LAMP_POLE_H - 2.0, z + dz * 7.1);
      m.updateMatrix();
      glow.setMatrixAt(i, m.matrix);
      // A soft emissive pool guarantees each lit fixture visibly reaches
      // the pavement even when real point lights are culled at city scale.
      m.position.set(x + dx * 7.1, 1.15, z + dz * 7.1); // clear of the road slab (0.8) so it never z-fights at range
      m.rotation.set(-Math.PI / 2, 0, 0);
      m.scale.set(20, 20, 1);
      m.updateMatrix();
      pool.setMatrixAt(i, m.matrix);
    });
    pole.instanceMatrix.needsUpdate = true;
    base.instanceMatrix.needsUpdate = true;
    arm.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
    pool.instanceMatrix.needsUpdate = true;
    pole.computeBoundingSphere();
    base.computeBoundingSphere();
    arm.computeBoundingSphere();
    head.computeBoundingSphere();
    glow.computeBoundingSphere();
    pool.computeBoundingSphere();
  }, [points]);

  // Real light pools: a fixed-size set of point lights that follows the
  // camera — every ~0.25s they jump to the lamps nearest the spot the camera
  // is looking at, so whatever is on screen gets genuine diffuse/specular
  // bounce on asphalt, pavements, cars and facades. The count never changes
  // (no shader recompiles); the emissive pools above still cover the rest.
  const heads = useMemo(
    () => points.map(([x, z, yaw]) => [x + Math.cos(yaw) * 7.1, z - Math.sin(yaw) * 7.1] as [number, number]),
    [points],
  );
  const lightCount = Math.min(LAMP_LIGHT_COUNT, heads.length);
  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const lightTick = useRef(-1);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const lookDir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }) => {
    if (lamp <= 0.05 || !lightCount) return;
    const t = clock.elapsedTime;
    if (lightTick.current >= 0 && t - lightTick.current < 0.25) return;
    lightTick.current = t;
    // Where the view ray meets the ground (fallback: below the camera).
    camera.getWorldDirection(lookDir);
    focus.copy(camera.position);
    if (lookDir.y < -0.05) focus.addScaledVector(lookDir, -camera.position.y / lookDir.y);
    const fx = focus.x, fz = focus.z;
    const order = heads
      .map(([x, z], i) => [(x - fx) ** 2 + (z - fz) ** 2, i] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < lightCount; k++) {
      const l = lightRefs.current[k];
      if (!l) continue;
      const [x, z] = heads[order[k][1]];
      l.position.set(x, LAMP_POLE_H - 2.2, z);
    }
  });

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, points.length]} key={`pole-${points.length}`} castShadow>
        <cylinderGeometry args={[0.62, 0.95, 1, 10]} />
        <meshStandardMaterial color="#32404f" roughness={0.44} metalness={0.56} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[undefined, undefined, points.length]} key={`lamp-base-${points.length}`} castShadow>
        <cylinderGeometry args={[1.55, 2.1, 1.6, 10]} />
        <meshStandardMaterial color="#465667" roughness={0.62} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[undefined, undefined, points.length]} key={`lamp-arm-${points.length}`} castShadow>
        <boxGeometry args={[7.2, 0.9, 0.9]} />
        <meshStandardMaterial color="#3a4b5c" roughness={0.4} metalness={0.62} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, points.length]} key={`head-${points.length}`} frustumCulled={false}>
        <boxGeometry args={[6.2, 1.35, 3.4]} />
        <meshStandardMaterial color="#526578" roughness={0.32} metalness={0.65} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, points.length]} key={`lamp-led-${points.length}`} frustumCulled={false}>
        <boxGeometry args={[5.25, 0.22, 2.45]} />
        <meshStandardMaterial color="#fff6d8" emissive="#ffd08a" emissiveIntensity={0.08 + lamp * 8} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={poolRef} args={[undefined, undefined, points.length]} key={`lamp-pool-${points.length}`} frustumCulled={false} renderOrder={1}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#ffc27a" map={lampPoolTexture()} transparent opacity={Math.min(1, lamp * 1.1)} depthWrite={false} fog={false} toneMapped={false} blending={THREE.AdditiveBlending} polygonOffset polygonOffsetFactor={-4} />
      </instancedMesh>
      {lamp > 0.05 &&
        Array.from({ length: lightCount }, (_, i) => (
          <pointLight
            key={i}
            ref={(l) => { lightRefs.current[i] = l; }}
            position={[heads[i][0], LAMP_POLE_H - 2.2, heads[i][1]]}
            color="#ffc98a"
            // physically-based falloff: ~4–5 lux under the head on the road,
            // fading out across the carriageway and onto the kerb.
            intensity={lamp * 2600}
            distance={95}
            decay={2}
          />
        ))}
    </group>
  );
}

// ── traffic lights ─────────────────────────────────────────────────
// One signal head per approach, standing on the driver's near-left kerb
// corner and facing the oncoming queue. The red / amber / green lenses are
// three InstancedMeshes; the cycle is driven by throttled `setColorAt` on
// the instanceColor buffer (a first cut animated it with an onBeforeCompile
// shader, which tripped an EffectComposer depth-stencil blit error on the
// medium tier — plain instanced colour has no pipeline risk).
const TL_POLE_H = 20;
const TL_HEAD_Y = TL_POLE_H + 4;
const TL_LIT = [new THREE.Color("#ff3b30"), new THREE.Color("#ffb020"), new THREE.Color("#2fd15a")];
const TL_DIM = new THREE.Color("#15171c");
// row index in TL_LIT: 0 = red, 1 = amber, 2 = green.

export type SignalPole = {
  x: number; z: number;
  /** unit direction the lenses face (toward the approaching traffic) */
  fx: number; fz: number;
  /** 0 green / 1 amber / 2 red at time t (seconds) */
  state: (t: number) => 0 | 1 | 2;
};

export function SignalPoles({ poles, scale = 1 }: { poles: SignalPole[]; scale?: number }) {
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
      // Local +Z of the head faces the approach: Ry(θ) maps +Z to (sinθ, cosθ).
      const yaw = Math.atan2(p.fx, p.fz);
      m.rotation.set(0, yaw, 0);
      m.position.set(p.x, (TL_POLE_H / 2) * scale, p.z);
      m.scale.set(scale, TL_POLE_H * scale, scale);
      m.updateMatrix();
      pole.setMatrixAt(i, m.matrix);
      m.position.set(p.x, TL_HEAD_Y * scale, p.z);
      m.scale.set(scale, scale, scale);
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
        m.rotation.set(0, Math.atan2(p.fx, p.fz), 0);
        m.position.set(p.x + p.fx * 2.4 * scale, (TL_HEAD_Y + dy) * scale, p.z + p.fz * 2.4 * scale);
        m.scale.set(scale, scale, scale);
        m.updateMatrix();
        lens.setMatrixAt(i, m.matrix);
        lens.setColorAt(i, TL_DIM);
      });
      lens.instanceMatrix.needsUpdate = true;
      if (lens.instanceColor) lens.instanceColor.needsUpdate = true;
      lens.computeBoundingSphere();
    });
    lastState.current = new Int8Array(poles.length).fill(-1);
  }, [poles, scale]);

  // Throttled: recolour only the lenses whose lit row changed.
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const now = performance.now() / 1000;
    const dirty = [false, false, false];
    poles.forEach((p, i) => {
      const state = p.state(now); // 0 green 1 amber 2 red
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

// Every signalised 4-way junction (trafficSim.signalJunctions — the same
// list the cars obey) gets four heads, one per approach, on the near-left
// kerb corner (left-hand traffic):
//   (+,+) westbound  · (−,−) eastbound  → E-W phase
//   (−,+) northbound · (+,−) southbound → N-S phase
const isX = (t: number) => signalStateFor(true, t);
const isZ = (t: number) => signalStateFor(false, t);
export function TrafficLights({ junctions }: { junctions: Junction[] }) {
  const poles = useMemo(() => {
    const d = ROAD_W / 2 + 2;
    return junctions.flatMap(({ x, z }): SignalPole[] => [
      { x: x + d, z: z + d, fx: 1, fz: 0, state: isX },
      { x: x - d, z: z - d, fx: -1, fz: 0, state: isX },
      { x: x - d, z: z + d, fx: 0, fz: 1, state: isZ },
      { x: x + d, z: z - d, fx: 0, fz: -1, state: isZ },
    ]);
  }, [junctions]);
  return <SignalPoles poles={poles} />;
}

// ── traffic ─────────────────────────────────────────────────────────
// The simulation (loops, signals, junction-box mutex, following distance)
// lives in trafficSim.ts so its no-collision guarantee is testable without
// a GPU; this component only renders the poses it writes onto each car.

const CAR_COLORS = ["#f8fafc", "#e53935", "#1677d2", "#f5b21a", "#16a36a", "#8b5cf6", "#ec6c20", "#ef5da8"];
const TAIL_RUNNING = new THREE.Color("#791014");
const TAIL_BRAKING = new THREE.Color("#ff332e");

const emergencyVehicle = (kind: VKind) => kind === "police" || kind === "ambulance" || kind === "fire";
function vehicleColor(kind: VKind, rnd: () => number) {
  if (kind === "police" || kind === "ambulance") return new THREE.Color("#f8fafc");
  if (kind === "fire") return new THREE.Color("#d9272e");
  return new THREE.Color(CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]);
}

export function Traffic({
  gridSize, trafficLevel = 0.5, riverRoadIndex = null, roadIndices, roundabout = null, signals,
}: {
  gridSize: number;
  trafficLevel?: number;
  /** Vertical road replaced by the urban river; adjacent block loops cannot use it. */
  riverRoadIndex?: number | null;
  /** Road indexes that stay visible after internal lanes become superblocks. */
  roadIndices?: { vertical: number[]; horizontal: number[] };
  /** Central roundabout (world x, z); loops crossing it are routed around the ring. */
  roundabout?: [number, number] | null;
  /** Signalised junctions — must be the list <TrafficLights> draws. */
  signals: Junction[];
}) {
  const rbX = roundabout?.[0] ?? null, rbZ = roundabout?.[1] ?? null;

  // read the live density in useFrame without re-rendering / rebuilding
  const levelRef = useRef(trafficLevel);
  levelRef.current = trafficLevel;

  const sim = useMemo(() => createTrafficSim({
    gridSize, roadIndices, riverRoadIndex,
    roundabout: rbX !== null && rbZ !== null ? [rbX, rbZ] : null,
    roundaboutLaneR: RB_R_IN + (RB_R_OUT - RB_R_IN) * 0.42,
    signals,
  }), [gridSize, roadIndices, riverRoadIndex, rbX, rbZ, signals]);
  const cars = sim.cars;
  const colors = useMemo(() => {
    let seed = gridSize * 577 + 3;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    return cars.map((c) => vehicleColor(c.kind, rnd));
  }, [cars, gridSize]);
  const tailBraking = useRef<boolean[]>([]);

  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const windscreenRef = useRef<THREE.InstancedMesh>(null);
  const bumperRef = useRef<THREE.InstancedMesh>(null);
  const shadowRef = useRef<THREE.InstancedMesh>(null);
  const wheelRef = useRef<THREE.InstancedMesh>(null);
  const headlightRef = useRef<THREE.InstancedMesh>(null);
  const taillightRef = useRef<THREE.InstancedMesh>(null);
  const indicatorRef = useRef<THREE.InstancedMesh>(null);
  const emergencyLightRef = useRef<THREE.InstancedMesh>(null);
  const paint = useMemo(() => makePaintMaterial(), []);
  const glass = useMemo(() => makeGlassMaterial(), []);
  const tyre = useMemo(() => makeTyreMaterial(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const wheelYaw = useMemo(() => new THREE.Quaternion(), []);
  const wheelMount = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), []);
  const wheelRoll = useMemo(() => new THREE.Quaternion(), []);
  const wheelAxisY = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    const windscreens = windscreenRef.current;
    const taillights = taillightRef.current;
    const emergencyLights = emergencyLightRef.current;
    if (!body || !cabin || !windscreens || !taillights || !emergencyLights) return;
    // Per-instance paint comes from instanceColor alone. vertexColors must
    // stay OFF: these box geometries have no `color` attribute, so enabling
    // it multiplies every car by (0,0,0) and the whole fleet renders black.
    // needsUpdate forces a recompile so the instance-colour path is active.
    [body, cabin, windscreens, taillights, emergencyLights].forEach((mesh) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.vertexColors = false;
      material.color.set("#ffffff");
      material.needsUpdate = true;
    });
    cars.forEach((c, i) => {
      body.setColorAt(i, colors[i]);
      // Keep the greenhouse noticeably darker than the paint. This makes a
      // proper roof/window silhouette from the overhead city camera instead
      // of reading as one flat coloured brick.
      cabin.setColorAt(i, new THREE.Color("#315d73"));
      windscreens.setColorAt(i, new THREE.Color("#9bd8ed"));
      taillights.setColorAt(i * 2, TAIL_RUNNING);
      taillights.setColorAt(i * 2 + 1, TAIL_RUNNING);
      const fire = c.kind === "fire";
      emergencyLights.setColorAt(i * 2, fire ? new THREE.Color("#ff3b30") : new THREE.Color("#248cff"));
      emergencyLights.setColorAt(i * 2 + 1, fire ? new THREE.Color("#ffbd2e") : new THREE.Color("#ff3b30"));
    });
    tailBraking.current = cars.map(() => false);
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
    if (windscreens.instanceColor) windscreens.instanceColor.needsUpdate = true;
    if (taillights.instanceColor) taillights.instanceColor.needsUpdate = true;
    if (emergencyLights.instanceColor) emergencyLights.instanceColor.needsUpdate = true;
  }, [cars, colors]);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    const windscreens = windscreenRef.current;
    const bumpers = bumperRef.current;
    const shadows = shadowRef.current;
    const wheels = wheelRef.current;
    const headlights = headlightRef.current;
    const taillights = taillightRef.current;
    const indicators = indicatorRef.current;
    const emergencyLights = emergencyLightRef.current;
    if (!body || !cabin || !windscreens || !bumpers || !shadows || !wheels || !headlights || !taillights || !indicators || !emergencyLights) return;
    const now = performance.now() / 1000;
    // clamp a hitched frame so nobody jumps a red
    stepTraffic(sim, Math.min(dt, 0.05), now, levelRef.current);
    let tailColorDirty = false;

    cars.forEach((c, ci) => {
      if (!c.visible) {
        dummy.position.set(0, -1000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        body.setMatrixAt(ci, dummy.matrix);
        cabin.setMatrixAt(ci, dummy.matrix);
        windscreens.setMatrixAt(ci, dummy.matrix);
        shadows.setMatrixAt(ci, dummy.matrix);
        for (let n = 0; n < 2; n++) {
          bumpers.setMatrixAt(ci * 2 + n, dummy.matrix);
          headlights.setMatrixAt(ci * 2 + n, dummy.matrix);
          taillights.setMatrixAt(ci * 2 + n, dummy.matrix);
          indicators.setMatrixAt(ci * 2 + n, dummy.matrix);
          emergencyLights.setMatrixAt(ci * 2 + n, dummy.matrix);
        }
        for (let n = 0; n < 4; n++) wheels.setMatrixAt(ci * 4 + n, dummy.matrix);
        return;
      }
      if (c.braking !== tailBraking.current[ci]) {
        tailBraking.current[ci] = c.braking;
        const tailColor = c.braking ? TAIL_BRAKING : TAIL_RUNNING;
        taillights.setColorAt(ci * 2, tailColor);
        taillights.setColorAt(ci * 2 + 1, tailColor);
        tailColorDirty = true;
      }

      const { x, z, heading } = c;
      const yLift = rbX !== null && rbZ !== null ? roundaboutLift(x, z, rbX, rbZ) : 0;
      const spec = V_SPEC[c.kind];
      const cos = Math.cos(heading), sin = Math.sin(heading);
      const local = (fwd: number, side: number) =>
        [x + cos * fwd - sin * side, z + sin * fwd + cos * side] as const;

      const [bx, bz] = local(spec.bodyDX, 0);
      dummy.position.set(bx, spec.bodyY + yLift, bz);
      // Three.js positive Y rotation turns local +X toward -Z, while our
      // path heading uses atan2(+Z, +X). Negate it so the rendered nose,
      // cabin and lights point along the direction of travel on a turn.
      dummy.rotation.set(0, -heading, 0);
      dummy.scale.set(spec.bodyS[0], spec.bodyS[1], spec.bodyS[2]);
      dummy.updateMatrix();
      body.setMatrixAt(ci, dummy.matrix);

      const [cbx, cbz] = local(spec.cabDX, 0);
      dummy.position.set(cbx, spec.cabY + yLift, cbz);
      dummy.scale.set(spec.cabS[0], spec.cabS[1], spec.cabS[2]);
      dummy.updateMatrix();
      cabin.setMatrixAt(ci, dummy.matrix);

      // A pale windscreen inset gives every vehicle a readable front
      // face, while the dark greenhouse remains visible around it.
      const cabFront = spec.cabDX + spec.cabS[0] * 4.72;
      const [wsx, wsz] = local(cabFront, 0);
      dummy.position.set(wsx, spec.cabY + 0.1 + yLift, wsz);
      dummy.rotation.set(0, -heading, 0);
      dummy.scale.set(Math.max(0.58, spec.cabS[0] * 0.72), spec.cabS[1] * 0.68, spec.cabS[2] * 0.78);
      dummy.updateMatrix();
      windscreens.setMatrixAt(ci, dummy.matrix);

      // Soft ground contact and slim bumpers stop the cars from looking
      // like floating toy blocks, especially on the pale daytime roads.
      dummy.position.set(x, 0.24 + yLift, z);
      dummy.rotation.set(-Math.PI / 2, 0, heading);
      dummy.scale.set(spec.half * 0.96, 4.25 * spec.bodyS[2], 1);
      dummy.updateMatrix();
      shadows.setMatrixAt(ci, dummy.matrix);
      [-1, 1].forEach((end, n) => {
        const [px, pz] = local(end * spec.half * 1.04, 0);
        dummy.position.set(px, 2.65 + yLift, pz);
        dummy.rotation.set(0, -heading, 0);
        dummy.scale.set(1, 1, spec.bodyS[2]);
        dummy.updateMatrix();
        bumpers.setMatrixAt(ci * 2 + n, dummy.matrix);
      });

      const wf = spec.half * 0.62;
      const wy = 2.25 + (spec.wheel - 1) * 2.05 + yLift;
      [[-wf, -4.1], [-wf, 4.1], [wf, -4.1], [wf, 4.1]].forEach(([f, s], n) => {
        const [wx, wz] = local(f, s);
        dummy.position.set(wx, wy, wz);
        // Cylinder geometry rolls around its original local Y axis. Mount
        // that axle across the car, apply the travelled-distance roll, then
        // yaw the complete wheel to match the current road tangent.
        wheelYaw.setFromAxisAngle(wheelAxisY, -heading);
        wheelRoll.setFromAxisAngle(wheelAxisY, c.wheelSpin);
        dummy.quaternion.copy(wheelYaw).multiply(wheelMount).multiply(wheelRoll);
        dummy.scale.set(spec.wheel, spec.wheel, spec.wheel);
        dummy.updateMatrix();
        wheels.setMatrixAt(ci * 4 + n, dummy.matrix);
      });
      dummy.rotation.set(0, -heading, 0);
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

      // Every block route uses protected left turns. Signal intent before
      // reaching the arc and through the manoeuvre; roundabout circulation
      // stays unlit because these loops do not model an exit choice.
      const indicatorOn = c.turnDistance < 62 && Math.floor(now * 2.2) % 2 === 0;
      dummy.scale.set(indicatorOn ? 1 : 0, indicatorOn ? 1 : 0, indicatorOn ? 1 : 0);
      const indicatorSide = -3.45 * spec.bodyS[2];
      [lf, -lf].forEach((fwd, n) => {
        const [ix, iz] = local(fwd, indicatorSide);
        dummy.position.set(ix, ly + 0.45, iz);
        dummy.updateMatrix();
        indicators.setMatrixAt(ci * 2 + n, dummy.matrix);
      });

      const emergencyOn = emergencyVehicle(c.kind) && Math.floor(now * 5.5 + ci) % 2 === 0;
      const roofY = spec.bodyY + spec.bodyS[1] * 3.4 + yLift;
      [-2.25, 2.25].forEach((side, n) => {
        const [lx, lz] = local(spec.cabDX, side);
        dummy.position.set(lx, roofY, lz);
        dummy.scale.set(emergencyOn ? 1 : 0, emergencyOn ? 1 : 0, emergencyOn ? 1 : 0);
        dummy.updateMatrix();
        emergencyLights.setMatrixAt(ci * 2 + n, dummy.matrix);
      });
    });
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
    windscreens.instanceMatrix.needsUpdate = true;
    bumpers.instanceMatrix.needsUpdate = true;
    shadows.instanceMatrix.needsUpdate = true;
    wheels.instanceMatrix.needsUpdate = true;
    headlights.instanceMatrix.needsUpdate = true;
    taillights.instanceMatrix.needsUpdate = true;
    indicators.instanceMatrix.needsUpdate = true;
    emergencyLights.instanceMatrix.needsUpdate = true;
    if (tailColorDirty && taillights.instanceColor) taillights.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, cars.length]} key={`car-body-${cars.length}`} castShadow>
        {/* Chamfered hull + lit paint (see vehicleLook.ts): faces shade
            differently and catch a highlight, so a car reads as a solid
            body rather than a flat coloured sticker. */}
        <primitive object={vehicleBox(18, 5.5, 8, 1.6)} attach="geometry" />
        <primitive object={paint} attach="material" />
      </instancedMesh>
      <instancedMesh ref={cabinRef} args={[undefined, undefined, cars.length]} key={`car-cabin-${cars.length}`} castShadow>
        <primitive object={vehicleBox(9.5, 3.4, 6.7, 1.3)} attach="geometry" />
        <primitive object={glass} attach="material" />
      </instancedMesh>
      <instancedMesh ref={windscreenRef} args={[undefined, undefined, cars.length]} key={`car-windscreen-${cars.length}`}>
        <boxGeometry args={[0.7, 2.3, 5.25]} />
        <primitive object={glass} attach="material" />
      </instancedMesh>
      <instancedMesh ref={bumperRef} args={[undefined, undefined, cars.length * 2]} key={`car-bumpers-${cars.length}`}>
        <boxGeometry args={[0.8, 1, 6.9]} />
        <meshBasicMaterial color="#1d2b35" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={shadowRef} args={[undefined, undefined, cars.length]} key={`car-shadows-${cars.length}`} renderOrder={-1}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#071018" transparent opacity={0.34} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={wheelRef} args={[undefined, undefined, cars.length * 4]} key={`car-wheels-${cars.length}`} castShadow>
        <cylinderGeometry args={[2.05, 2.05, 1.3, 10]} />
        <primitive object={tyre} attach="material" />
      </instancedMesh>
      <instancedMesh ref={headlightRef} args={[undefined, undefined, cars.length * 2]} key={`car-headlights-${cars.length}`}>
        <boxGeometry args={[0.7, 1.2, 1.55]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={taillightRef} args={[undefined, undefined, cars.length * 2]} key={`car-taillights-${cars.length}`}>
        <boxGeometry args={[0.7, 1.2, 1.55]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={indicatorRef} args={[undefined, undefined, cars.length * 2]} key={`car-indicators-${cars.length}`}>
        <boxGeometry args={[0.8, 1, 0.9]} />
        <meshBasicMaterial color="#ff9f1c" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={emergencyLightRef} args={[undefined, undefined, cars.length * 2]} key={`car-emergency-lights-${cars.length}`}>
        <boxGeometry args={[1.5, 0.9, 1.2]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
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

function LrtTerminus({ z, livery }: { z: number; livery: string }) {
  const end = Math.sign(z) || 1;
  return (
    <group position={[0, DECK_Y + 2, z]}>
      {/* A real end station prevents the viaduct from reading as a beam that
          simply stops in mid-air at the city boundary. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[36, 3, 58]} />
        <meshStandardMaterial color="#46536a" />
      </mesh>
      <mesh position={[0, 14, 0]} castShadow>
        <boxGeometry args={[34, 1.8, 52]} />
        <meshStandardMaterial color="#d5dee8" roughness={0.48} metalness={0.22} />
      </mesh>
      {[-12, 12].flatMap((x) => [-17, 17].map((dz) => (
        <mesh key={`${x}:${dz}`} position={[x, 6.5, dz]} castShadow>
          <boxGeometry args={[2.8, 13, 2.8]} />
          <meshStandardMaterial color="#69788c" roughness={0.72} />
        </mesh>
      )))}
      {/* End-wall, buffer block and line-coloured station band make the
          terminus legible even when seen from high above. */}
      <mesh position={[0, 5.6, end * 27]}>
        <boxGeometry args={[30, 8, 2.2]} />
        <meshStandardMaterial color="#344155" roughness={0.58} />
      </mesh>
      <mesh position={[0, 9.1, end * 28.3]}>
        <boxGeometry args={[16, 2.1, 0.7]} />
        <meshBasicMaterial color={livery} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.7, end * 21]}>
        <boxGeometry args={[13, 1.8, 2.8]} />
        <meshStandardMaterial color="#202b38" roughness={0.8} />
      </mesh>
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} position={[x, 1.8, end * 22]}>
          <boxGeometry args={[0.8, 1.2, 7]} />
          <meshStandardMaterial color="#8796a8" metalness={0.7} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

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
    // 280 units is one city block: support every block rather than leaving
    // the edge sections as a long unsupported cantilever.
    for (let z = -span / 2 + 96; z <= span / 2 - 96; z += ROAD_GAP) {
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
      <LrtTerminus z={-span / 2 + 29} livery={livery} />
      <LrtTerminus z={span / 2 - 29} livery={livery} />
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
        {/* Named station marker makes this a recognisable destination rather
            than an anonymous centre-platform when viewed at city scale. */}
        <Text position={[0, 14.15, 32.62]} fontSize={1.55} maxWidth={14.2}
          anchorX="center" anchorY="middle" color="#f8fbff" letterSpacing={0.06}
          outlineWidth={0.035} outlineColor="#102036">
          LRT BUKIT BINTANG
        </Text>
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

// A compact, screen-legible marker for the currently selected zone.  This
// deliberately stays smaller than ZoneBeacon (which communicates a city-wide
// landmark or a completed project) so selecting a building does not obscure
// its neighbours in a dense block.
export function SelectionPin({ position }: { position: [number, number, number] }) {
  const pin = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  // Metro towers top out just below 300 world units (CityScene's building
  // clamp), so this stays visible above both a small town and the dense core.
  const baseY = 310;

  useFrame(({ clock }) => {
    if (!pin.current) return;
    const t = clock.elapsedTime;
    pin.current.position.y = baseY + Math.sin(t * 2.2) * 5;
    pin.current.rotation.y = clock.elapsedTime * 0.65;
    if (orbit.current) orbit.current.rotation.z = -t * 1.6;
    if (halo.current) {
      const s = 0.92 + Math.sin(t * 2.2) * 0.12;
      halo.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={pin} position={[position[0], baseY, position[2]]}>
      {/* Soft beacon makes the selected location readable against a dark
          tower, while depthWrite=false prevents it becoming a black slab
          when another facade sits directly behind it. */}
      <mesh ref={halo} position={[0, 0, 0]}>
        <sphereGeometry args={[22, 16, 12]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.12} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[14, 0]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.96} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh scale={[0.52, 0.52, 0.52]}>
        <octahedronGeometry args={[14, 0]} />
        <meshBasicMaterial color="#fef3c7" toneMapped={false} />
      </mesh>
      <mesh ref={orbit} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[20, 1.2, 6, 28]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.86} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -62, 0]}>
        <cylinderGeometry args={[2.2, 6.5, 96, 12, 1, true]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, -110, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[8, 14, 4]} />
        <meshBasicMaterial color="#facc15" toneMapped={false} />
      </mesh>
      <pointLight color="#67e8f9" intensity={1.6} distance={95} decay={2} />
    </group>
  );
}
