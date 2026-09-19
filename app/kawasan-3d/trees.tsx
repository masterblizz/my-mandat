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
// different geometry) = 4 draw calls total, regardless of tree count. A
// species' canopy may stack several lobes/fronds — those are extra
// INSTANCES in the same mesh, not extra draws.
//
// Tree transforms remain static: the instance matrices are written once in
// a useLayoutEffect. Canopy movement is applied in the standard-material
// vertex shader, so thousands of leaves share three time uniforms rather
// than rebuilding instance matrices on the CPU every frame.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLOT, type CellPlacement, type SeatTraits, type ZoneKind } from "./cityData";

type TreeSpecies = "round" | "conifer" | "palm";
// `rotY` = a per-tree yaw (radians). Applied to the canopy meshes only —
// the foliage is always UNIFORMLY scaled, so a yaw can never distort it,
// it just stops every instance of a species being an identical silhouette.
type TreeSpot = { x: number; z: number; groundY: number; species: TreeSpecies; scale: number; rotY: number };

// Zone kinds worth dressing with trees, and roughly how many — the
// concrete-core kinds (urban/commercial/market/industry) are left at 0 so
// the skyline still reads as a dense core, not a park.
const TREES_PER_ZONE_KIND: Partial<Record<ZoneKind, number>> = {
  village: 2, housing: 1, education: 1, community: 1, river: 2,
};
// SUNGAI & HIJAU (item 22): KL "reads green from the air" — ~1.6× denser,
// and even the concrete-core kinds get a couple of verge trees.
const TREES_PER_ZONE_KIND_LUSH: Partial<Record<ZoneKind, number>> = {
  village: 4, housing: 3, education: 3, community: 3, river: 4,
  urban: 2, commercial: 2, market: 2, industry: 1,
};
const TREES_PER_EMPTY_CELL = 1;
const TREES_PER_EMPTY_CELL_LUSH = 6; // undeveloped plots are jungle, not bare fill

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
function pickSpecies(rnd: () => number, traits: SeatTraits, kind?: ZoneKind, lush = false): TreeSpecies {
  const r = rnd();
  if (traits.coastal && (kind === "river" || kind === "village") && r < 0.55) return "palm";
  if (traits.hilly && r < 0.6) return "conifer";
  // KL canopy: palms mixed in heavily, almost no conifer.
  if (lush) return r < 0.42 ? "palm" : "round";
  if (r < 0.2) return "conifer";
  if (r < 0.35) return "palm";
  return "round";
}

export function Trees({
  placed, empties, traits, claimed, lush = false, weather = "clear",
}: {
  placed: CellPlacement[];
  empties: { col: number; row: number; cx: number; cz: number }[];
  traits: SeatTraits;
  /** cells under a large footprint — no trees there, the podium covers them */
  claimed?: Set<string>;
  /** SUNGAI & HIJAU: denser canopy + palms + jungle empties (KL variant). */
  lush?: boolean;
  /** Rain drives a faster, wider gust while clear weather stays gentle. */
  weather?: "clear" | "rain";
}) {
  const spots = useMemo(() => {
    const out: TreeSpot[] = [];
    const perKind = lush ? TREES_PER_ZONE_KIND_LUSH : TREES_PER_ZONE_KIND;
    const perEmpty = lush ? TREES_PER_EMPTY_CELL_LUSH : TREES_PER_EMPTY_CELL;
    for (const { zone, col, row, cx, cz } of placed) {
      if (claimed?.has(`${col},${row}`)) continue;
      const n = perKind[zone.kind] ?? 0;
      if (!n) continue;
      const rnd = rngFrom(hashSeed(`${zone.id}:tree`));
      // Corner + edge-midpoint spots in the tile-edge margin, outside the
      // 3x3 building-slot grid (slots span roughly the whole 240x240 tile
      // — see slotPos()/footprint() in cityData.ts) and just inside the
      // sidewalk curb added in roadDetail.tsx.
      const corner = PLOT / 2 - 16;
      const edge = PLOT / 2 - 14;
      const candidates: [number, number][] = [
        [-corner, -corner], [corner, -corner], [-corner, corner], [corner, corner],
        [0, -edge], [0, edge], [-edge, 0], [edge, 0],
      ];
      for (let i = 0; i < Math.min(n, candidates.length); i++) {
        const idx = Math.floor(rnd() * candidates.length);
        const [ox, oz] = candidates.splice(idx, 1)[0];
        out.push({
          x: cx + ox + (rnd() - 0.5) * 10,
          z: cz + oz + (rnd() - 0.5) * 10,
          groundY: TILE_H,
          species: pickSpecies(rnd, traits, zone.kind, lush),
          scale: 0.82 + rnd() * 0.46,
          rotY: rnd() * Math.PI * 2,
        });
      }
    }
    for (const { col, row, cx, cz } of empties) {
      if (claimed?.has(`${col},${row}`)) continue;
      const rnd = rngFrom(hashSeed(`${col},${row}:tree`));
      for (let i = 0; i < perEmpty; i++) {
        out.push({
          x: cx + (rnd() - 0.5) * (PLOT - 40),
          z: cz + (rnd() - 0.5) * (PLOT - 40),
          groundY: EMPTY_CELL_Y,
          species: pickSpecies(rnd, traits, undefined, lush),
          scale: 0.74 + rnd() * 0.46,
          rotY: rnd() * Math.PI * 2,
        });
      }
    }
    return out;
  }, [placed, empties, traits, claimed, lush]);

  const bySpecies = useMemo(() => {
    const m: Record<TreeSpecies, TreeSpot[]> = { round: [], conifer: [], palm: [] };
    for (const s of spots) m[s.species].push(s);
    return m;
  }, [spots]);

  if (!spots.length) return null;
  return (
    <group>
      <TreeTrunks spots={spots} />
      <RoundCanopy spots={bySpecies.round} weather={weather} />
      <ConiferCanopy spots={bySpecies.conifer} weather={weather} />
      <PalmCanopy spots={bySpecies.palm} weather={weather} />
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
      // Small tonal variation keeps a line of instanced trunks from
      // reading like identical plastic poles.
      const tint = s.species === "palm" ? "#78512b" : s.species === "conifer" ? "#5a4026" : "#69482c";
      mesh.setColorAt(i, new THREE.Color(tint).offsetHSL((i % 5 - 2) * 0.008, 0, (i % 3 - 1) * 0.035));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, dummy]);

  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} key={`trunks-${spots.length}`} args={[undefined, undefined, spots.length]} castShadow>
      <cylinderGeometry args={[1.4, 1.9, 1, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.95} />
    </instancedMesh>
  );
}

// ── canopies ────────────────────────────────────────────────────────
// Shared rules for every foliage mesh below, so nothing ever reads as a
// stretched oval blob again:
//   • the geometry is scaled UNIFORMLY in X and Z (spheres are (r,r,r);
//     cones are (r,H,r) where H is the cone's real height — a cone is
//     meant to be taller than wide, that is its shape, not a distortion);
//   • per-tree variety comes ONLY from `s.scale` (uniform size) and
//     `s.rotY` (a yaw) plus a small tonal jitter — never an axis stretch;
//   • flat-shaded low-poly primitives to match the faceted buildings;
//   • one InstancedMesh per species (multiple lobes → more instances in
//     the same mesh, not more draw calls).
const TRUNK_TOP = (s: TreeSpot) => s.groundY + TRUNK_H * s.scale;

type WindProfile = {
  clearAmp: number;
  rainAmp: number;
  clearFreq: number;
  rainFreq: number;
  roughness: number;
  side?: THREE.Side;
  cacheKey: string;
};

// Preserve MeshStandardMaterial's light, fog, tone-mapping and per-instance
// colours; only displace its local vertex before the instance transform.
// The two sine bands keep motion from reading as a metronomic pendulum, and
// the world-position phase makes a gust travel across the city canopy.
function useWindFoliageMaterial(weather: "clear" | "rain", profile: WindProfile) {
  const wind = useMemo(() => ({
    time: { value: 0 },
    amp: { value: profile.clearAmp },
    freq: { value: profile.clearFreq },
  }), [profile.clearAmp, profile.clearFreq]);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: profile.roughness,
      side: profile.side ?? THREE.FrontSide,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = wind.time;
      shader.uniforms.uWindAmp = wind.amp;
      shader.uniforms.uWindFreq = wind.freq;
      shader.vertexShader = `
        uniform float uWindTime;
        uniform float uWindAmp;
        uniform float uWindFreq;
      ` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = dot(instanceMatrix[3].xz, vec2(0.037, 0.051));
          float windWeight = smoothstep(-0.8, 0.8, position.y);
          float windMain = sin(uWindTime * uWindFreq + windPhase);
          float windGust = sin(uWindTime * uWindFreq * 0.43 + windPhase * 1.71);
          transformed.x += (windMain + windGust * 0.34) * uWindAmp * windWeight;
          transformed.z += cos(uWindTime * uWindFreq * 0.71 + windPhase * 0.83)
            * uWindAmp * 0.32 * windWeight;
        #endif
      `);
    };
    m.customProgramCacheKey = () => profile.cacheKey;
    return m;
  }, [profile.cacheKey, profile.roughness, profile.side, wind]);

  useEffect(() => {
    wind.amp.value = weather === "rain" ? profile.rainAmp : profile.clearAmp;
    wind.freq.value = weather === "rain" ? profile.rainFreq : profile.clearFreq;
  }, [weather, profile.clearAmp, profile.clearFreq, profile.rainAmp, profile.rainFreq, wind]);
  useFrame((_, dt) => { wind.time.value += Math.min(dt, 0.05); });
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

// Broadleaf: a big lower sphere + a smaller upper lobe nudged off-axis,
// both perfectly round.
function RoundCanopy({ spots, weather }: { spots: TreeSpot[]; weather: "clear" | "rain" }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const material = useWindFoliageMaterial(weather, {
    clearAmp: 0.045, rainAmp: 0.09, clearFreq: 0.72, rainFreq: 1.3,
    roughness: 0.9, cacheKey: "tree-wind-round-v1",
  });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const top = TRUNK_TOP(s);
      const R = 12 * s.scale;
      // lower lobe — sits just above the trunk, dead-centred, uniform
      dummy.position.set(s.x, top + R * 0.5, s.z);
      dummy.scale.set(R, R, R);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i * 2, dummy.matrix);
      // upper lobe — smaller, offset by a translation (never a stretch)
      const r2 = R * 0.66;
      dummy.position.set(
        s.x + Math.cos(s.rotY) * R * 0.26,
        top + R * 1.12,
        s.z + Math.sin(s.rotY) * R * 0.26,
      );
      dummy.scale.set(r2, r2, r2);
      dummy.rotation.set(0, s.rotY * 1.7, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i * 2 + 1, dummy.matrix);
      const l = ((i % 5) - 2) * 0.03;
      const h = ((i % 3) - 1) * 0.02;
      mesh.setColorAt(i * 2, col.set("#4f8a45").offsetHSL(h, 0, l));
      mesh.setColorAt(i * 2 + 1, col.set("#5c9a50").offsetHSL(h, 0, l));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, dummy, col]);
  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} key={`round-${spots.length}`} args={[undefined, undefined, spots.length * 2]} castShadow frustumCulled={false}>
      <sphereGeometry args={[1, 9, 7]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

// Conifer: two stacked cones (wide skirt + narrow top), each uniform in
// X/Z, height ≈ 2.3× radius.
function ConiferCanopy({ spots, weather }: { spots: TreeSpot[]; weather: "clear" | "rain" }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const material = useWindFoliageMaterial(weather, {
    clearAmp: 0.032, rainAmp: 0.065, clearFreq: 0.62, rainFreq: 1.12,
    roughness: 0.92, cacheKey: "tree-wind-conifer-v1",
  });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const top = TRUNK_TOP(s);
      const R = 9 * s.scale;
      const H = 21 * s.scale;
      dummy.position.set(s.x, top + H * 0.28, s.z);
      dummy.scale.set(R, H, R);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i * 2, dummy.matrix);
      const R2 = R * 0.6;
      const H2 = H * 0.72;
      dummy.position.set(s.x, top + H * 0.6 + H2 * 0.32, s.z);
      dummy.scale.set(R2, H2, R2);
      dummy.rotation.set(0, s.rotY + 0.6, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i * 2 + 1, dummy.matrix);
      const l = ((i % 4) - 1.5) * 0.03;
      mesh.setColorAt(i * 2, col.set("#2f5d38").offsetHSL(0, 0, l));
      mesh.setColorAt(i * 2 + 1, col.set("#387046").offsetHSL(0, 0, l));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, dummy, col]);
  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} key={`conifer-${spots.length}`} args={[undefined, undefined, spots.length * 2]} castShadow frustumCulled={false}>
      <coneGeometry args={[1, 1, 8]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

// Palm: a small round crown core + 7 elongated fronds fanned out
// radially. The fronds ARE blades (long on their own axis) — a
// deliberate shape, arranged as a spiky star, not a flattened canopy.
const PALM_FRONDS = 7;
function PalmCanopy({ spots, weather }: { spots: TreeSpot[]; weather: "clear" | "rain" }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const per = PALM_FRONDS + 1;
  const material = useWindFoliageMaterial(weather, {
    clearAmp: 0.065, rainAmp: 0.13, clearFreq: 0.86, rainFreq: 1.55,
    roughness: 0.82, side: THREE.DoubleSide, cacheKey: "tree-wind-palm-v1",
  });
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    spots.forEach((s, i) => {
      const top = TRUNK_TOP(s);
      const R = 11 * s.scale;
      // crown core — uniform, low-poly
      const cr = 3.2 * s.scale;
      dummy.position.set(s.x, top + 1.5 * s.scale, s.z);
      dummy.scale.set(cr, cr, cr);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i * per, dummy.matrix);
      mesh.setColorAt(i * per, col.set("#3f7a58"));
      for (let f = 0; f < PALM_FRONDS; f++) {
        const a = (f / PALM_FRONDS) * Math.PI * 2 + s.rotY;
        dummy.position.set(
          s.x + Math.cos(a) * R * 0.44,
          top + 1 * s.scale - 1.4 * s.scale,
          s.z + Math.sin(a) * R * 0.44,
        );
        // long on local Z (the blade), thin on X/Y
        dummy.scale.set(2.3 * s.scale, 1.1 * s.scale, R);
        dummy.rotation.set(-0.34, Math.PI / 2 - a, 0); // droop + point outward
        dummy.updateMatrix();
        mesh.setMatrixAt(i * per + 1 + f, dummy.matrix);
        mesh.setColorAt(i * per + 1 + f, col.set("#4c8f5e").offsetHSL(0, 0, ((f % 3) - 1) * 0.03));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spots, dummy, col, per]);
  if (!spots.length) return null;
  return (
    <instancedMesh ref={ref} key={`palm-${spots.length}`} args={[undefined, undefined, spots.length * per]} castShadow frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}
