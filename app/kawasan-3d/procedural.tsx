"use client";

// Item 4: procedural building detail — the middle tier between a real
// GLTF model and the plain box fallback. Per the migration log, the box
// fallback was "a box stand-in, not full CSS parity"; this is the biggest
// visual gap versus both the CSS version and a real city. Tier order is
// now: real model (Phase A/B) > procedural detail (this file) > plain box
// (InstancedBoxes, now the last-resort fallback — unchanged, still used
// for every BType this file doesn't cover, and as this file's own
// fallback if geometry generation ever produces nothing).
//
// Two shapes, ported from the CSS version's actual technique (not just
// its look):
// - house/terrace/kampung — a real gabled roof. The CSS PitchedRoof
//   component derives its slope from a RISE and a HALF-WIDTH via
//   Math.hypot/Math.atan2 (rise is a fixed pixel amount, e.g. 15, against
//   a variable footprint half-width) — that's the actual trig ported here
//   (see buildGableRoof), not just "make a triangle roof shape". The one
//   deliberate departure: CSS adds that rise as an ABSOLUTE height on top
//   of the wall height per-instance; this file's roof lives inside a UNIT
//   template that gets non-uniformly scaled by each instance's real
//   (w, h, d) — the same convention InstancedBoxes/InstancedModel already
//   use — so the rise has to be a FRACTION of the unit height instead of
//   an absolute pixel amount for the scaling to still produce a sane
//   shape at any instance's actual height. Also fixed to a single ridge
//   axis per type rather than the CSS version's per-instance
//   width-vs-depth check (house/terrace/kampung footprints only vary
//   ~10% around their base aspect ratio via jitterFootprint, so one fixed
//   axis per type is a reasonable simplification, not a materially
//   different building).
// - tower/skyscraper (pronounced) / shophouse (subtle) — a stacked
//   "setback" box: a full-footprint lower block plus a narrower upper
//   block, proportions varied by variant.
//
// Variant selection reuses pickVariantIndex (cityData.ts) — the exact
// same deterministic per-instance-key hash Phase A's GLTF variants use —
// rather than inventing a second jitter mechanism. 3 geometry variants
// per type (roof pitch for the gable types, setback ratio for the
// stacked types), each variant a merged unit-size BufferGeometry shared
// by every instance of that (type, variant) via one InstancedMesh, same
// InstancedMesh-per-(type,variant) pattern Phase A already established
// for GLTF models — this file adds a geometry SOURCE, not a new
// instancing strategy.
//
// Detail pass: each template carries two material groups — windowed wall
// faces + plain roof/caps — so the wall slot can take a seeded
// lit-window emissiveMap (windows.ts, the texture port of the CSS
// route's organic litWindowMap) that replaces the old flat whole-body
// dusk/night glow. Intensity is gated by winLit, so daytime is unchanged
// (emissiveIntensity 0).

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useHeightTween, InstancedBoxes, type BuildingInstance } from "./models";
import { getWindowTexture } from "./windows";
import { pickVariantIndex, type BType } from "./cityData";

const GABLE_TYPES = new Set<BType>(["house", "terrace", "kampung"]);
const SETBACK_TYPES = new Set<BType>(["tower", "skyscraper", "shophouse"]);
// Everything else that used to render as a bare InstancedBox now gets a
// composed silhouette too: a flat-roof wall + a parapet rim + a small
// rooftop plant unit. `masjid` gets a dome instead. `skyscraper` /
// `antenna` also get a mast tip (see getTemplate). FLAT_TYPES stay ground
// planes; `antenna` still routes through the box path for its footprint
// but picks up the mast via BOXCAP.
const BOXCAP_TYPES = new Set<BType>([
  "shop", "stall", "factory", "warehouse", "school", "clinic",
  "terminal", "mall", "stadium", "antenna",
]);
const DOME_TYPES = new Set<BType>(["masjid"]);
export const PROCEDURAL_TYPES = new Set<BType>([
  ...Array.from(GABLE_TYPES), ...Array.from(SETBACK_TYPES),
  ...Array.from(BOXCAP_TYPES), ...Array.from(DOME_TYPES),
]);
// Gable + setback carry 3 shape variants; the flat-roof / dome families
// carry 2 (the variety there is rooftop-unit placement, not proportion).
export function variantCount(type: BType): number {
  return GABLE_TYPES.has(type) || SETBACK_TYPES.has(type) ? 3 : 2;
}
export const PROCEDURAL_VARIANT_COUNT = 3; // kept for callers that want the max

// Gable templates carry two geometry groups so the sloped roof can take a
// plain material while the walls take the lit-window emissiveMap — a
// glowing gable slope reads wrong, and it's the one clearly-wrong surface
// (the box's own top face is hidden under the roof). Kept to exactly two
// contiguous groups (box, then roof) so three emits 2 draws per mesh, not
// one per face. Setback templates stay single-material: a window grid on
// a tower roof-deck reads acceptably as rooftop lights, and one material
// = one draw, so the tall-building path adds zero draw calls.
const MAT_WALL = 0;
const MAT_ROOF = 1;

function stripToPositionNormalUv(g: THREE.BufferGeometry) {
  for (const attr of Object.keys(g.attributes)) {
    if (!["position", "normal", "uv"].includes(attr)) g.deleteAttribute(attr);
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  // mergeGeometries needs every input to agree on index state, and the two
  // geometry sources here disagree by construction — BoxGeometry (walls,
  // setback blocks) is indexed, ExtrudeGeometry (the gable roof) is not.
  // Flatten everything to non-indexed so any pair merges; without this the
  // gable merge fails and buildGableTemplate falls back to a roofless box.
  const flat = g.index ? g.toNonIndexed() : g;
  if (!flat.getAttribute("normal")) flat.computeVertexNormals();
  return flat;
}

// Gabled roof on a box wall, all in unit space (footprint -0.5..0.5 on X
// and Z, total height 0..1) — ridge runs along local X, slopes down along
// Z. `riseFrac` is the CSS version's RIDGE_RISE, expressed as a fraction
// of unit height instead of a pixel amount (see file header).
function buildGableTemplate(riseFrac: number, wallFrac: number): THREE.BufferGeometry {
  const wall = new THREE.BoxGeometry(1, wallFrac, 1);
  wall.translate(0, wallFrac / 2, 0);

  // The actual ported trig: PitchedRoof derives a slope from a rise and a
  // half-width via `slant = Math.hypot(half, RIDGE_RISE)` / `angle =
  // atan2(RIDGE_RISE, half)`, then rotates a flat CSS face by that angle.
  // Building the roof as real 3D geometry instead of a rotated flat plane
  // means the same rise/half-width relationship is expressed directly as
  // the apex vertex position (half, wallFrac + riseFrac) rather than a
  // separate rotation — the ridge line the CSS version reaches via
  // rotateX(angle)/rotateY(angle) is the same line this shape's apex
  // traces, just arrived at by placing the vertex instead of rotating a
  // face to meet it.
  const half = 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-half, wallFrac);
  shape.lineTo(0, wallFrac + riseFrac);
  shape.lineTo(half, wallFrac);
  shape.lineTo(-half, wallFrac);
  const roof = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  roof.translate(0, 0, -0.5);

  // Merge WITHOUT groups, then add exactly two contiguous groups by known
  // vertex count — the wall box first, the extruded roof second — rather
  // than trusting mergeGeometries' own group handling (its per-input
  // materialIndex remap has changed between three versions).
  const wallFlat = stripToPositionNormalUv(wall);
  const roofFlat = stripToPositionNormalUv(roof);
  const merged = mergeGeometries([wallFlat, roofFlat], false);
  if (!merged) { wall.clearGroups(); return wall; }
  const wallVerts = wallFlat.getAttribute("position").count;
  merged.clearGroups();
  merged.addGroup(0, wallVerts, MAT_WALL);
  merged.addGroup(wallVerts, roofFlat.getAttribute("position").count, MAT_ROOF);
  return merged;
}

// Stacked setback: a full-footprint lower block + a narrower upper block.
function buildSetbackTemplate(lowerFrac: number, setbackFrac: number): THREE.BufferGeometry {
  const lower = new THREE.BoxGeometry(1, lowerFrac, 1);
  lower.translate(0, lowerFrac / 2, 0);
  const upperH = 1 - lowerFrac;
  const upper = new THREE.BoxGeometry(setbackFrac, upperH, setbackFrac);
  upper.translate(0, lowerFrac + upperH / 2, 0);
  const merged = mergeGeometries(
    [stripToPositionNormalUv(lower), stripToPositionNormalUv(upper)],
    false,
  );
  if (!merged) return lower;
  // Single material for the whole shell — see the MAT_WALL/MAT_ROOF note.
  merged.clearGroups();
  return merged;
}

// Flat-roof shell + an overhanging parapet cornice — the minimum
// silhouette detail so no BType ships as a bare box. Deliberately just
// two boxes (24 tris): the cornice is what reads at the scene's camera
// distance; a rooftop-unit box was tried and only shows on close zoom
// while costing +50% triangles across every civic/retail instance.
// `variant` nudges the wall height and cornice depth.
function buildBoxCapTemplate(variant: number): THREE.BufferGeometry {
  const wallFrac = [0.92, 0.88][variant] ?? 0.9;
  const capH = 1 - wallFrac;
  const wall = new THREE.BoxGeometry(1, wallFrac, 1);
  wall.translate(0, wallFrac / 2, 0);
  const cornice = new THREE.BoxGeometry(1.04, capH, 1.04);
  cornice.translate(0, wallFrac + capH / 2, 0);
  const merged = mergeGeometries(
    [wall, cornice].map(stripToPositionNormalUv), false,
  );
  if (!merged) return wall;
  merged.clearGroups();
  return merged;
}

// Domed building (masjid): low wall + a squashed half-sphere + a finial.
// Low-poly sphere (10×6) — the dome is small and there are only a
// handful of masjid per grid.
function buildDomeTemplate(variant: number): THREE.BufferGeometry {
  const wallFrac = 0.6;
  const wall = new THREE.BoxGeometry(1, wallFrac, 1);
  wall.translate(0, wallFrac / 2, 0);
  const r = [0.42, 0.36][variant] ?? 0.4;
  const squash = [0.85, 1.05][variant] ?? 0.95;
  const dome = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, squash, 1);
  dome.translate(0, wallFrac, 0);
  const finial = new THREE.BoxGeometry(0.04, 0.16, 0.04);
  finial.translate(0, wallFrac + r * squash + 0.05, 0);
  const merged = mergeGeometries(
    [wall, dome, finial].map(stripToPositionNormalUv), false,
  );
  if (!merged) return wall;
  merged.clearGroups();
  return merged;
}

// A thin mast merged onto an already-built template (skyscraper / antenna).
function withMast(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const mast = new THREE.BoxGeometry(0.05, 0.24, 0.05);
  mast.translate(0, 1.06, 0);
  const merged = mergeGeometries([geo, stripToPositionNormalUv(mast)], false);
  return merged ?? geo;
}

// variant 0/1/2 -> shallow/medium/steep pitch (gable) or subtle/medium/
// pronounced setback — cached so switching density presets (which
// re-mounts Buildings but reuses the same BType set) doesn't rebuild.
const templateCache = new Map<string, THREE.BufferGeometry>();
function getTemplate(type: BType, variant: number): THREE.BufferGeometry {
  const key = `${type}:${variant}`;
  const cached = templateCache.get(key);
  if (cached) return cached;

  let geo: THREE.BufferGeometry;
  if (GABLE_TYPES.has(type)) {
    const rise = [0.16, 0.24, 0.34][variant] ?? 0.24;
    const wall = [0.8, 0.76, 0.7][variant] ?? 0.76;
    geo = buildGableTemplate(rise, wall);
  } else if (DOME_TYPES.has(type)) {
    geo = buildDomeTemplate(variant);
  } else if (BOXCAP_TYPES.has(type)) {
    geo = buildBoxCapTemplate(variant);
    if (type === "antenna") geo = withMast(geo);
  } else {
    // tower/skyscraper: pronounced setback; shophouse: barely recessed
    // upper floor, matching its real-world low-rise proportions.
    const pronounced = type === "shophouse"
      ? { lower: [0.72, 0.76, 0.8], setback: [0.9, 0.86, 0.82] }
      : { lower: [0.55, 0.62, 0.68], setback: [0.44, 0.58, 0.7] };
    geo = buildSetbackTemplate(pronounced.lower[variant] ?? 0.6, pronounced.setback[variant] ?? 0.6);
    if (type === "skyscraper") geo = withMast(geo);
  }
  templateCache.set(key, geo);
  return geo;
}

export function ProceduralBuildings({
  type, items, groundY, color, winLit,
}: {
  type: BType;
  items: BuildingInstance[];
  groundY: number;
  color: string;
  winLit: number;
}) {
  const buckets = useMemo(() => {
    const vc = variantCount(type);
    const m = new Map<number, BuildingInstance[]>();
    for (const it of items) {
      const vi = pickVariantIndex(it.key, vc);
      const arr = m.get(vi);
      if (arr) arr.push(it);
      else m.set(vi, [it]);
    }
    return Array.from(m.entries());
  }, [items, type]);

  return (
    <group>
      {buckets.map(([variant, vItems]) => (
        <ProceduralVariant
          key={`${type}-${variant}`}
          type={type}
          variant={variant}
          items={vItems}
          groundY={groundY}
          color={color}
          winLit={winLit}
        />
      ))}
    </group>
  );
}

function ProceduralVariant({
  type, variant, items, groundY, color, winLit,
}: {
  type: BType;
  variant: number;
  items: BuildingInstance[];
  groundY: number;
  color: string;
  winLit: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    try {
      return getTemplate(type, variant);
    } catch {
      return null; // falls back to InstancedBoxes below — model > procedural > box holds even on a generation failure
    }
  }, [type, variant]);

  // Wall material carries the lit-window emissiveMap (windows.ts);
  // emissiveIntensity starts at 0 and is driven by the winLit effect
  // below so a time-of-day change doesn't rebuild materials. Gable
  // templates have two groups (MAT_WALL, MAT_ROOF) and get a material
  // array; setback templates are single-material.
  const isGable = GABLE_TYPES.has(type);
  const materials = useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      emissive: new THREE.Color("#fff1d8"),
      emissiveMap: getWindowTexture(type, variant),
      emissiveIntensity: 0,
    });
    if (!isGable) return wall;
    const roof = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(0.8),
      roughness: 0.92,
    });
    const arr: THREE.Material[] = [];
    arr[MAT_WALL] = wall;
    arr[MAT_ROOF] = roof;
    return arr;
  }, [type, variant, color, isGable]);

  useEffect(() => {
    // Towers read best with windows clearly brighter than the wall; the
    // domestic gable types want a gentler, lived-in glow.
    const gain = isGable ? 0.75 : 1.3;
    const wall = (Array.isArray(materials) ? materials[MAT_WALL] : materials) as THREE.MeshStandardMaterial;
    wall.emissiveIntensity = winLit * gain;
  }, [materials, winLit, isGable]);

  useEffect(
    () => () => (Array.isArray(materials) ? materials : [materials]).forEach((m) => m.dispose()),
    [materials],
  );

  const writeMatrix = (i: number, h: number) => {
    const mesh = ref.current;
    if (!mesh) return;
    const it = items[i];
    const hh = Math.max(h, 1);
    dummy.position.set(it.x, groundY, it.z);
    dummy.scale.set(it.w, hh, it.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  const commit = () => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  useHeightTween(items, writeMatrix, commit);

  useEffect(() => {
    if (!ref.current) return;
    for (let i = 0; i < items.length; i++) writeMatrix(i, items[i].h);
    commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (!geometry) return <InstancedBoxes items={items} groundY={groundY} color={color} winLit={winLit} />;
  return (
    <instancedMesh
      ref={ref}
      key={`proc-${type}-${variant}-${items.length}`}
      args={[geometry, undefined, items.length]}
      material={materials}
      castShadow
      receiveShadow
    />
  );
}
