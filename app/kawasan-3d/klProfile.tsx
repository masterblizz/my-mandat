// Item 21 — SILUET KL (from the "City Realism" design canvas, KL variant).
//
// "KL reads as one peak, not an even forest. A supertall pair with ribbed
//  shafts and a skybridge holds the centre, a slender spire sits on a
//  mid-ring plot, and every other vertical building is scaled by
//  klFalloff() — 2.05x at the core down to 0.45x at the edge."
//
// This layer is metro-only (gridSize >= 10, i.e. Metro / Dense) so the
// Rural / Semi presets are untouched. It does two things:
//   1. klHeightMult() — a radial height multiplier the Buildings loop
//      applies to vertical BTypes, so towers taper toward the edge.
//   2. <KLProfile> — the twin supertall + skybridge at grid centre and a
//      telecom spire on a mid-ring plot. Merged shells, glass and trim
//      keep the landmark profile to five draw calls including beacons.
//
// The centre cell + the spire cell are added to `claimed` in CityScene so
// their ordinary per-cell towers step aside.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLOT, plotXY, worldCentre } from "./cityData";
import { getTowerStripTexture, getTowerFacadeTexture } from "./windows";

const KL_MIN_GRID = 10;
const TILE_H = 4;

export const klActive = (gridSize: number): boolean => gridSize >= KL_MIN_GRID;

// Radial height multiplier. 1 (no-op) below the KL grid size. At/above it,
// follows the design's klFalloff: ~1.9x dead centre, ~0.4x at the rim —
// tempered from the literal 2.05/0.45 because kawasan's metro core heights
// are already lifted (cityData zoneBuildings), so stacking the literal
// factor on top spikes.
export function klHeightMult(col: number, row: number, gridSize: number): number {
  if (!klActive(gridSize)) return 1;
  const mid = (gridSize - 1) / 2;
  const t = Math.min(1, Math.hypot(col - mid, row - mid) / (gridSize * 0.42));
  // Gentle enough that the base height variation still shows through and
  // the core skyline stays well below the twin peak (capped in CityScene).
  return 1.42 - 1.05 * t * t;
}

// Grid cells follow the actual broad geography of central Kuala Lumpur:
// Menara KL / Bukit Nanas is north-west of the Bukit Bintang retail spine,
// KLCC sits to its east-north-east, and Merdeka 118 rises to the south-east
// the south-east. The city is intentionally an isometric playable district,
// not a cadastral GIS export, but this relative layout is fixed and visible.
function spireCell(gridSize: number): [number, number] {
  const mid = Math.round((gridSize - 1) / 2);
  return [Math.max(0, mid - 4), Math.max(0, mid - 3)];
}

// Merdeka 118 sits on a different mid-ring tile so the three landmarks read
// as a skyline cluster instead of intersecting at the grid centre.
function merdekaCell(gridSize: number): [number, number] {
  const mid = Math.round((gridSize - 1) / 2);
  return [Math.min(gridSize - 1, mid + 1), Math.min(gridSize - 1, mid + 5)];
}

function twinCell(gridSize: number): [number, number] {
  const mid = Math.round((gridSize - 1) / 2);
  return [Math.min(gridSize - 1, mid + 3), Math.max(0, mid - 1)];
}

export function klClaims(gridSize: number, enabled = false): string[] {
  if (!enabled || !klActive(gridSize)) return [];
  const [tc, tr] = twinCell(gridSize);
  const [sc, sr] = spireCell(gridSize);
  const [mc, mr] = merdekaCell(gridSize);
  return [`${tc},${tr}`, `${sc},${sr}`, `${mc},${mr}`];
}

function tileCentre(index: number, gridSize: number): number {
  return plotXY(gridSize)[index] + PLOT / 2 - worldCentre(gridSize);
}

// ── geometry helpers (unit-agnostic, world scale) ───────────────────
const HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 32);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 10);

function place(
  src: THREE.BufferGeometry, x: number, y: number, z: number,
  sx: number, sy: number, sz: number, rz = 0,
): THREE.BufferGeometry {
  const g = src.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  // keep uv — the night window emissiveMap (getTowerStripTexture) needs it;
  // Cylinder/Box/Cone all generate uv so the set stays consistent for the
  // merge. Everything else (tangents etc.) is dropped.
  for (const attr of Object.keys(g.attributes)) {
    if (!["position", "normal", "uv"].includes(attr)) g.deleteAttribute(attr);
  }
  return g;
}

// One Petronas-style shaft: four tapered tiers, proud setback rings, a
// stepped pinnacle and a mast. Returns geometry centred on (x, 0, z).
function shaft(x: number, z: number): THREE.BufferGeometry[] {
  const H = 430;
  const R = 30;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(CYL, x, TILE_H + 9, z, R + 14, 18, R + 14)); // podium drum
  const tiers: [number, number][] = [[1, 0.42], [0.86, 0.26], [0.7, 0.17], [0.52, 0.11]];
  let base = TILE_H + 18;
  for (let i = 0; i < tiers.length; i++) {
    const [sc, frac] = tiers[i];
    const sh = H * frac;
    parts.push(place(HEX, x, base + sh / 2, z, R * sc, sh, R * sc));
    // proud floor rings
    const rings = Math.max(1, Math.round(sh / 44));
    for (let r = 1; r <= rings; r++) {
      parts.push(place(HEX, x, base + (sh / rings) * r, z, R * sc + 1.6, 2.2, R * sc + 1.6));
    }
    // vertical pilaster strips hugging the hex perimeter — real relief so
    // the facade detail holds when the camera is close, matching the
    // banding the procedural towers carry.
    const pr = R * sc + 1;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(place(BOX, x + Math.cos(a) * pr, base + sh / 2, z + Math.sin(a) * pr, 2.6, sh * 0.99, 2.6));
    }
    base += sh;
  }
  // stepped pinnacle + mast
  for (let i = 0; i < 4; i++) {
    parts.push(place(CYL, x, base + i * 8, z, R * 0.36 * (1 - i * 0.18), 8, R * 0.36 * (1 - i * 0.18)));
  }
  parts.push(place(CYL, x, base + 52, z, 1.6, 90, 1.6));
  return parts;
}

function buildTwins(): THREE.BufferGeometry {
  const GAP = 110;
  const H = 430;
  const parts = [...shaft(-GAP / 2, 0), ...shaft(GAP / 2, 0)];
  // skybridge deck + rail + two raking legs
  const bY = TILE_H + H * 0.45;
  parts.push(place(BOX, 0, bY, 0, GAP - 40, 7, 14));
  parts.push(place(BOX, 0, bY + 9, 0, GAP - 40, 2.4, 16));
  for (const s of [-1, 1]) {
    parts.push(place(BOX, s * GAP * 0.22, bY - 46, 0, 3.6, 100, 3.6, s * 0.32));
  }
  return mergeGeometries(parts, false) ?? parts[0];
}

// KL-Tower-style telecom spire, centred on (0,0) — caller positions it.
function buildSpire(): THREE.BufferGeometry {
  const H = 340;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(CYL, 0, TILE_H + 2, 0, 48, 4, 48));
  parts.push(place(CYL, 0, TILE_H + 6, 0, 40, 4, 40));
  parts.push(place(CYL, 0, TILE_H + 11, 0, 31, 6, 31));
  parts.push(place(CYL, 0, TILE_H + H * 0.36, 0, 13, H * 0.72, 13));
  parts.push(place(CYL, 0, TILE_H + H * 0.72 + 6, 0, 9, 24, 9));
  // Flared underside and shallow roof frame a panoramic observation deck.
  const bowl = new THREE.CylinderGeometry(33, 12, 18, 32);
  parts.push(place(bowl, 0, 252, 0, 1, 1, 1));
  bowl.dispose();
  parts.push(place(CYL, 0, 263, 0, 34, 4, 34));
  parts.push(place(CYL, 0, 280, 0, 35, 4, 35));
  parts.push(place(CYL, 0, 284, 0, 30, 4, 30));
  parts.push(place(CYL, 0, 289, 0, 23, 6, 23));
  parts.push(place(CONE, 0, TILE_H + H * 0.92, 0, 6, 60, 6));
  parts.push(place(CYL, 0, TILE_H + H + 6, 0, 1.3, 90, 1.3));
  return mergeGeometries(parts, false) ?? parts[0];
}

function buildSpireDetails(glass: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (glass) {
    parts.push(place(CYL, 0, 271.5, 0, 32.5, 13, 32.5));
    parts.push(place(CYL, 0, 19, 0, 26, 10, 26));
  } else {
    // Recessed shaft ribs, deck mullions and thin champagne light rings.
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      parts.push(place(CYL, Math.sin(a) * 32.5, 271.5, Math.cos(a) * 32.5, 0.45, 13, 0.45));
      if (i % 2 === 0) parts.push(place(CYL, Math.sin(a) * 13, 130, Math.cos(a) * 13, 0.55, 218, 0.55));
    }
    for (const [y, r] of [[261, 33.5], [278, 35.2], [286.5, 29], [24.5, 27]] as const) {
      parts.push(place(CYL, 0, y, 0, r, 0.9, r));
    }
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  return merged;
}

// Merdeka 118-inspired tower: one continuous, faceted taper above a low
// podium, followed by an off-axis blade crown. This avoids the old stack of
// rectangular blocks and better matches its distinctive crystalline profile.
function buildMerdeka118(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Square frusta catch light as four tall, angled glass planes. Cylinder
  // radii are corner radii, hence the values are slightly lower than a box
  // width would be for the same footprint.
  const tiers: [number, number, number, number][] = [
    [47, 39, 145, 20], [39, 30, 165, 165], [30, 21, 165, 330], [21, 12, 130, 495], [12, 6, 80, 625],
  ];
  parts.push(place(BOX, 0, TILE_H + 10, 0, 86, 20, 64));
  for (const [bottom, top, height, base] of tiers) {
    const frustum = new THREE.CylinderGeometry(top, bottom, height, 4, 1, false, Math.PI / 4);
    parts.push(place(frustum, 0, TILE_H + base + height / 2, 0, 1, 1, 1));
    frustum.dispose();
  }
  // The real tower's crown leans into a slender asymmetric blade rather
  // than ending in a symmetric cone. A restrained tilt makes that legible
  // from the isometric camera without creating a fragile separate mesh.
  parts.push(place(CONE, 5, TILE_H + 760, 0, 8, 110, 8, -0.09));
  parts.push(place(CYL, 13, TILE_H + 840, 0, 1.25, 80, 1.25, -0.09));
  return mergeGeometries(parts, false) ?? parts[0];
}

// apex heights (world units) — see shaft() / buildSpire() massing above.
const TWIN_APEX_Y = 535;
const SPIRE_APEX_Y = 400;
const MERDEKA_APEX_Y = 880;
const TWIN_GAP = 110;

export function KLProfile({ gridSize, enabled = false, winLit = 0, nationalLighting = false }: {
  gridSize: number; enabled?: boolean; winLit?: number; nationalLighting?: boolean;
}) {
  const built = useMemo(() => {
    if (!enabled || !klActive(gridSize)) return null;
    const twins = buildTwins();
    twins.computeVertexNormals();
    twins.computeBoundingSphere();
    const spire = buildSpire();
    spire.computeVertexNormals();
    spire.computeBoundingSphere();
    const merdeka = buildMerdeka118();
    merdeka.computeVertexNormals();
    merdeka.computeBoundingSphere();
    const [tc, tr] = twinCell(gridSize);
    const [sc, sr] = spireCell(gridSize);
    const [mc, mr] = merdekaCell(gridSize);
    return {
      twins, spire, merdeka,
      spireGlass: buildSpireDetails(true),
      spireTrim: buildSpireDetails(false),
      twinAt: [tileCentre(tc, gridSize), tileCentre(tr, gridSize)] as const,
      spireAt: [tileCentre(sc, gridSize), tileCentre(sr, gridSize)] as const,
      merdekaAt: [tileCentre(mc, gridSize), tileCentre(mr, gridSize)] as const,
    };
  }, [gridSize, enabled]);

  useEffect(() => () => {
    if (built) [built.twins, built.spire, built.merdeka, built.spireGlass, built.spireTrim].forEach(g => g.dispose());
  }, [built]);

  // Gridded curtain-wall by day (getTowerFacadeTexture — vertical
  // mullions + floor bands + inset glass, so the twins match the
  // procedural skyscrapers' level of detail); at night the window
  // emissiveMap lights the whole shaft. Metalness / sky reflection are
  // dialled back after dusk so the silhouette holds. `color` is left near-
  // white so the facade map's own tones read true.
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#eef2f6", map: getTowerFacadeTexture(),
      roughness: 0.32, metalness: 0.42, envMapIntensity: 1.15,
      emissive: new THREE.Color("#dfe9ff"), emissiveMap: getTowerStripTexture(), emissiveIntensity: 0,
    });
    m.userData.baseMetalness = 0.42;
    m.userData.baseEnv = 1.15;
    // Height-based architectural accents, independent of the repeating
    // window UVs: narrow red/white rings, a blue crown and a gold tip.
    // They add to the occupied-window map rather than replacing it.
    const national = { value: 0 };
    m.userData.national = national;
    m.onBeforeCompile = shader => {
      shader.uniforms.nationalLighting = national;
      shader.vertexShader = 'varying float towerHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntowerHeight = position.y;');
      shader.fragmentShader = 'uniform float nationalLighting;\nvarying float towerHeight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        float nationalH = clamp(towerHeight / ${TWIN_APEX_Y.toFixed(1)}, 0.0, 1.0);
        float ringPhase = fract(nationalH * 10.0);
        float ringMask = smoothstep(0.38, 0.46, ringPhase) * (1.0 - smoothstep(0.58, 0.66, ringPhase));
        float stripe = mod(floor(nationalH * 10.0), 2.0);
        vec3 nationalColor = mix(vec3(0.72, 0.018, 0.028), vec3(0.92, 0.88, 0.78), stripe);
        float accentStrength = ringMask * 0.30;
        if (nationalH > 0.72) {
          nationalColor = vec3(0.025, 0.10, 0.72);
          accentStrength = 0.22;
        }
        if (nationalH > 0.94) {
          nationalColor = vec3(0.95, 0.55, 0.025);
          accentStrength = 0.28;
        }
        totalEmissiveRadiance += nationalColor * accentStrength * nationalLighting;
      `);
    };
    m.customProgramCacheKey = () => 'klcc-national-lighting-v2';
    return m;
  }, []);
  const steel = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#e5ded0",
      roughness: 0.62, metalness: 0.18, envMapIntensity: 1.05,
      emissive: new THREE.Color("#9b805b"), emissiveIntensity: 0,
    });
    m.userData.baseMetalness = 0.18;
    m.userData.baseEnv = 1.05;
    return m;
  }, []);

  useEffect(() => {
    mat.userData.national.value = nationalLighting ? 1 : 0;
    for (const m of [mat, steel]) {
      m.emissiveIntensity = winLit * 0.82;
      m.metalness = (m.userData.baseMetalness as number) * (1 - winLit * 0.72);
      m.envMapIntensity = (m.userData.baseEnv as number) * (1 - winLit * 0.5);
    }
    steel.emissiveIntensity = winLit * 0.18;
  }, [mat, steel, winLit, nationalLighting]);

  useEffect(
    () => () => { mat.dispose(); steel.dispose(); },
    [mat, steel],
  );

  // aviation warning lights: blink red at the tops (dusk + night only)
  const beaconRef = useRef<THREE.InstancedMesh>(null);
  const blinkAcc = useRef(0);
  const blinkOn = useRef(true);
  useFrame((_, dt) => {
    const mesh = beaconRef.current;
    if (!mesh || !built) return;
    const active = winLit > 0.25;
    blinkAcc.current += dt;
    if (blinkAcc.current >= 0.55) {
      blinkAcc.current = 0;
      blinkOn.current = !blinkOn.current;
    }
    const show = active && blinkOn.current ? 1 : 0.0001;
    const o = new THREE.Object3D();
    const beacons: [number, number, number][] = [
      [built.twinAt[0] - TWIN_GAP / 2, TWIN_APEX_Y, built.twinAt[1]],
      [built.twinAt[0] + TWIN_GAP / 2, TWIN_APEX_Y, built.twinAt[1]],
      [built.spireAt[0], SPIRE_APEX_Y, built.spireAt[1]],
      [built.merdekaAt[0], MERDEKA_APEX_Y, built.merdekaAt[1]],
    ];
    beacons.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2]);
      o.scale.setScalar(show);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!built) return null;
  return (
    <group>
      <mesh geometry={built.twins} material={mat} position={[built.twinAt[0], 0, built.twinAt[1]]} castShadow receiveShadow />
      <mesh geometry={built.spire} material={steel} position={[built.spireAt[0], 0, built.spireAt[1]]} castShadow receiveShadow />
      <mesh geometry={built.merdeka} material={mat} position={[built.merdekaAt[0], 0, built.merdekaAt[1]]} castShadow receiveShadow />
      <group position={[built.spireAt[0], 0, built.spireAt[1]]}>
        <mesh geometry={built.spireGlass}>
          <meshStandardMaterial color="#396775" metalness={0.48} roughness={0.2}
            emissive="#b7ddd8" emissiveIntensity={winLit * 0.28} />
        </mesh>
        <mesh geometry={built.spireTrim}>
          <meshStandardMaterial color="#d5ba83" metalness={0.65} roughness={0.3}
            emissive="#ffcf83" emissiveIntensity={winLit * 0.55} />
        </mesh>
      </group>
      <instancedMesh ref={beaconRef} args={[undefined, undefined, 4]} frustumCulled={false}>
        <sphereGeometry args={[3.2, 8, 6]} />
        <meshBasicMaterial color="#ff2b2b" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
