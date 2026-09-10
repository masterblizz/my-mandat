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
//      telecom spire on a mid-ring plot, each merged to ONE mesh so the
//      whole profile costs 3 draw calls.
//
// The centre cell + the spire cell are added to `claimed` in CityScene so
// their ordinary per-cell towers step aside.

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLOT, plotXY, worldCentre } from "./cityData";

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

// Grid cells the KL landmarks occupy — CityScene folds these into
// `claimed`. Twin = the dead-centre cell; spire = a mid-ring cell offset
// off the main axes so it doesn't hide behind the twins.
// Twin = the dead-centre cell; spire = a mid-ring cell in the quadrant
// that faces the default iso camera (−col / +row) so it isn't hidden
// behind the twins.
function spireCell(gridSize: number): [number, number] {
  const mid = Math.round((gridSize - 1) / 2);
  return [Math.max(0, mid - 2), Math.min(gridSize - 1, mid + 2)];
}

export function klClaims(gridSize: number): string[] {
  if (!klActive(gridSize)) return [];
  const mid = Math.round((gridSize - 1) / 2);
  const [sc, sr] = spireCell(gridSize);
  return [`${mid},${mid}`, `${sc},${sr}`];
}

function tileCentre(index: number, gridSize: number): number {
  return plotXY(gridSize)[index] + PLOT / 2 - worldCentre(gridSize);
}

// ── geometry helpers (unit-agnostic, world scale) ───────────────────
const HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
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
  for (const attr of Object.keys(g.attributes)) {
    if (!["position", "normal"].includes(attr)) g.deleteAttribute(attr);
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
  parts.push(place(CYL, 0, TILE_H + 5, 0, 34, 10, 34));
  parts.push(place(CYL, 0, TILE_H + H * 0.36, 0, 13, H * 0.72, 13));
  parts.push(place(CYL, 0, TILE_H + H * 0.72 + 6, 0, 9, 24, 9));
  parts.push(place(CYL, 0, TILE_H + H * 0.78, 0, 30, 30, 30));       // head pod
  parts.push(place(CYL, 0, TILE_H + H * 0.78 + 16, 0, 25, 12, 25));  // pod collar
  parts.push(place(CONE, 0, TILE_H + H * 0.92, 0, 6, 60, 6));
  parts.push(place(CYL, 0, TILE_H + H + 6, 0, 1.3, 90, 1.3));
  return mergeGeometries(parts, false) ?? parts[0];
}

export function KLProfile({ gridSize }: { gridSize: number }) {
  const built = useMemo(() => {
    if (!klActive(gridSize)) return null;
    const twins = buildTwins();
    twins.computeVertexNormals();
    twins.computeBoundingSphere();
    const spire = buildSpire();
    spire.computeVertexNormals();
    spire.computeBoundingSphere();
    const mid = Math.round((gridSize - 1) / 2);
    const [sc, sr] = spireCell(gridSize);
    return {
      twins,
      spire,
      twinAt: [tileCentre(mid, gridSize), tileCentre(mid, gridSize)] as const,
      spireAt: [tileCentre(sc, gridSize), tileCentre(sr, gridSize)] as const,
    };
  }, [gridSize]);

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#b9c1c4", roughness: 0.45, metalness: 0.25, envMapIntensity: 1 }),
    [],
  );
  const steel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#9aa2a6", roughness: 0.4, metalness: 0.45, envMapIntensity: 1 }),
    [],
  );

  if (!built) return null;
  return (
    <group>
      <mesh geometry={built.twins} material={mat} position={[built.twinAt[0], 0, built.twinAt[1]]} castShadow receiveShadow />
      <mesh geometry={built.spire} material={steel} position={[built.spireAt[0], 0, built.spireAt[1]]} castShadow receiveShadow />
    </group>
  );
}
