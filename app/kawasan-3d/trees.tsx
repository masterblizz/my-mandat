"use client";

// Item 2: real freestanding trees — trunk + canopy geometry, not just the
// Phase D grass blades on flat field tiles. Confirmed from the migration
// log + a code read of scenery.tsx/models.tsx before starting: no
// standalone tree geometry existed anywhere in the WebGL route (grass/
// paddy blades are the only foliage), so this is a genuine gap versus the
// CSS version's Tree/Palm/Conifer components, not a regression.
//
// Placement is a deliberate departure from the CSS version's technique
// (ported the SPIRIT, not the literal positions — see the migration log):
// the CSS Tree/Palm/Conifer placement is a fixed list of pixel positions
// around a fixed-size world div, which doesn't translate to this route's
// variable-gridSize, per-zone-grid architecture. Instead: a small number
// of trees per DEVELOPED zone tile (count driven by zone.kind — village/
// housing/education/community/river get some, the concrete-core kinds
// don't), positioned in the tile-edge margin outside the building slot
// grid, plus a tree or two on every UNDEVELOPED (empty) cell so those
// otherwise-bare dark tiles read as unbuilt land rather than voids.
// Species selection reuses the CSS's coastal->palm / hilly->conifer bias
// (SeatTraits, already threaded through Buildings()) — inert in the demo
// harness (DEFAULT_TRAITS is all-false, same as Phase C's pond traits
// note) but wired correctly for whenever the live route feeds real traits.
//
// Cost shape matches every other decoration in this file set: however
// many trees exist, they live in a FIXED small number of InstancedMeshes.
// One trunk mesh (all 3 species share the same cylinder geometry — a
// palm's trunk is just a taller/thinner instance of the same shape) plus
// one canopy mesh per species (round/conifer/palm need genuinely
// different geometry) = 4 draw calls total, regardless of tree count.
// Canopies keep sway.ts's shader for its base->tip colour gradient, but
// are FROZEN — the `uTime` uniform is never advanced (no useFrame), so
// there is no per-frame work and no motion; see TreeCanopy.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SWAY_VERT, SWAY_FRAG } from "./sway";
import { PLOT, type CellPlacement, type SeatTraits, type ZoneKind } from "./cityData";

type TreeSpecies = "round" | "conifer" | "palm";
type TreeSpot = { x: number; z: number; groundY: number; species: TreeSpecies; scale: number };

const CANOPY_COLORS: Record<TreeSpecies, { base: string; tip: string }> = {
  round: { base: "#14532d", tip: "#86efac" }, // deciduous: deep green -> light green
  conifer: { base: "#0f3d24", tip: "#4d7c0f" }, // pine: near-black green -> olive
  palm: { base: "#065f46", tip: "#6ee7b7" }, // tropical: teal-green -> bright frond
};

// Zone kinds worth dressing with trees, and roughly how many — the
// concrete-core kinds (urban/commercial/market/industry) are left at 0 so
// the skyline still reads as a dense core, not a park.
const TREES_PER_ZONE_KIND: Partial<Record<ZoneKind, number>> = {
  village: 2, housing: 1, education: 1, community: 1, river: 2,
};
const TREES_PER_EMPTY_CELL = 1;

const TILE_H = 4; // must match CityScene.tsx's TILE_H (zone-tile top surface)
const EMPTY_CELL_Y = 0.4; // must match Grid()'s empty-cell ground plane height

function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}
function rngFrom(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
function pickSpecies(rnd: () => number, traits: SeatTraits, kind?: ZoneKind): TreeSpecies {
  const r = rnd();
  if (traits.coastal && (kind === "river" || kind === "village") && r < 0.55) return "palm";
  if (traits.hilly && r < 0.6) return "conifer";
  if (r < 0.2) return "conifer";
  if (r < 0.35) return "palm";
  return "round";
}

export function Trees({
  placed, empties, traits, claimed,
}: {
  placed: CellPlacement[];
  empties: { col: number; row: number; cx: number; cz: number }[];
  traits: SeatTraits;
  /** cells under a large footprint — no trees there, the podium covers them */
  claimed?: Set<string>;
}) {
  const spots = useMemo(() => {
    const out: TreeSpot[] = [];
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const n = TREES_PER_ZONE_KIND[zone.kind] ?? 0;
      if (!n) continue;
      const rnd = rngFrom(hashSeed(`${zone.id}:tree`));
      // Corner-ish spots in the tile-edge margin, outside the 3x3
      // building-slot grid (slots span roughly the whole 240x240 tile —
      // see slotPos()/footprint() in cityData.ts) and just inside the
      // sidewalk curb added in roadDetail.tsx.
      const corner = PLOT / 2 - 16;
      const candidates: [number, number][] = [
        [-corner, -corner], [corner, -corner], [-corner, corner], [corner, corner],
      ];
      for (let i = 0; i < Math.min(n, candidates.length); i++) {
        const idx = Math.floor(rnd() * candidates.length);
        const [ox, oz] = candidates.splice(idx, 1)[0];
        out.push({
          x: cx + ox + (rnd() - 0.5) * 10,
          z: cz + oz + (rnd() - 0.5) * 10,
          groundY: TILE_H,
          species: pickSpecies(rnd, traits, zone.kind),
          scale: 0.8 + rnd() * 0.5,
        });
      }
    }
    for (const { col, row, cx, cz } of empties) {
      if (claimed?.has(`${col},${row}`)) continue;
      const rnd = rngFrom(hashSeed(`${col},${row}:tree`));
      for (let i = 0; i < TREES_PER_EMPTY_CELL; i++) {
        out.push({
          x: cx + (rnd() - 0.5) * (PLOT - 40),
          z: cz + (rnd() - 0.5) * (PLOT - 40),
          groundY: EMPTY_CELL_Y,
          species: pickSpecies(rnd, traits),
          scale: 0.7 + rnd() * 0.5,
        });
      }
    }
    return out;
  }, [placed, empties, traits, claimed]);

  const bySpecies = useMemo(() => {
    const m: Record<TreeSpecies, TreeSpot[]> = { round: [], conifer: [], palm: [] };
    for (const s of spots) m[s.species].push(s);
    return m;
  }, [spots]);

  if (!spots.length) return null;
  return (
    <group>
      <TreeTrunks spots={spots} />
      <TreeCanopy species="round" spots={bySpecies.round} geometry="sphere" />
      <TreeCanopy species="conifer" spots={bySpecies.conifer} geometry="cone" />
      <TreeCanopy species="palm" spots={bySpecies.palm} geometry="flat" />
    </group>
  );
}

const TRUNK_H = 22;

function TreeTrunks({ spots }: { spots: TreeSpot[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const h = TRUNK_H * s.scale;
      // Palms read taller/thinner than round/conifer trunks — same shared
      // geometry, just a different per-instance scale.
      const thinness = s.species === "palm" ? 0.7 : 1;
      dummy.position.set(s.x, s.groundY + h / 2, s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(thinness, h, thinness);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, dummy]);

  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} key={`trunks-${spots.length}`} args={[undefined, undefined, spots.length]} castShadow>
      <cylinderGeometry args={[1.4, 1.9, 1, 6]} />
      <meshStandardMaterial color="#6b4423" />
    </instancedMesh>
  );
}

function TreeCanopy({
  species, spots, geometry,
}: {
  species: TreeSpecies;
  spots: TreeSpot[];
  geometry: "sphere" | "cone" | "flat";
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = CANOPY_COLORS[species];

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      // Trees sway more slowly and, relative to their own size, more
      // subtly than grass (vegetation.tsx uses uAmp 0.5 / uFreq 2.0 for
      // blades a few world-units tall — canopies here are ~12-14 units
      // across, so a much larger absolute uAmp still reads as "gentle").
      uAmp: { value: 1.6 },
      uFreq: { value: 1.1 },
      uColorBase: { value: new THREE.Color(colors.base) },
      uColorTip: { value: new THREE.Color(colors.tip) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const trunkTop = s.groundY + TRUNK_H * s.scale;
      if (geometry === "sphere") {
        const r = 13 * s.scale;
        dummy.position.set(s.x, trunkTop - r * 0.35, s.z);
        dummy.scale.set(r, r, r);
      } else if (geometry === "cone") {
        const r = 11 * s.scale;
        const h = 28 * s.scale;
        dummy.position.set(s.x, trunkTop + h * 0.32, s.z);
        dummy.scale.set(r, h, r);
      } else {
        const r = 14 * s.scale;
        dummy.position.set(s.x, trunkTop + r * 0.12, s.z);
        dummy.scale.set(r, r * 0.32, r);
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, geometry, dummy]);

  // Trees are FROZEN — no per-frame sway. The instance matrices are set
  // once above and never touched again; `uTime` stays 0, so SWAY_VERT
  // resolves to a fixed per-instance lean (sin(phase)·uAmp·vT) — a static
  // "caught mid-breeze" pose rather than an upright one, keeping the
  // canopies from looking rigidly identical. `sway.ts` is unchanged (grass
  // in vegetation.tsx still uses it live).

  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} key={`canopy-${species}-${spots.length}`} args={[undefined, undefined, spots.length]} castShadow frustumCulled={false}>
      {geometry === "sphere" && <sphereGeometry args={[1, 8, 6]} />}
      {geometry === "cone" && <coneGeometry args={[1, 1, 7]} />}
      {geometry === "flat" && <sphereGeometry args={[1, 8, 5]} />}
      <shaderMaterial vertexShader={SWAY_VERT} fragmentShader={SWAY_FRAG} uniforms={uniforms} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
