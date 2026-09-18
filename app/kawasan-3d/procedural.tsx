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
import { getFacadeTexture, getWindowTexture } from "./windows";
import { pickVariantIndex, type BType } from "./cityData";
import { ArchitecturalDetails } from "./buildingDetails";

const GABLE_TYPES = new Set<BType>(["house", "terrace", "kampung"]);
const SETBACK_TYPES = new Set<BType>(["tower", "skyscraper", "shophouse", "hotel"]);
// Everything else that used to render as a bare InstancedBox now gets a
// composed silhouette too: a flat-roof wall + a parapet rim + a small
// rooftop plant unit. `masjid` gets a dome instead. `skyscraper` /
// `antenna` also get a mast tip (see getTemplate). FLAT_TYPES stay ground
// planes; `antenna` still routes through the box path for its footprint
// but picks up the mast via BOXCAP.
const BOXCAP_TYPES = new Set<BType>([
  "shop", "stall", "factory", "warehouse", "school", "clinic",
  "terminal", "mall", "stadium", "antenna",
  // civic facilities — flat-roof institutional shells, told apart by
  // BUILDING_COLOR + height. `fire` also gets a hose/siren mast.
  "police", "fire", "hospital", "library", "museum", "powerplant",
]);
const DOME_TYPES = new Set<BType>(["masjid"]);
const COMMERCIAL_TYPES = new Set<BType>(["shop", "shophouse", "mall"]);
export const PROCEDURAL_TYPES = new Set<BType>([
  ...Array.from(GABLE_TYPES), ...Array.from(SETBACK_TYPES),
  ...Array.from(BOXCAP_TYPES), ...Array.from(DOME_TYPES),
]);

// Colour polish: every building of a given BType used to share exactly
// one flat BUILDING_COLOR — realistic for institutional/uniform types
// (a school, a mall, a police station really are one corporate/govt
// colour), but real terrace houses, kampung homes and shophouses are
// individually owned and painted, and a whole street of them in one
// identical hue reads flat. These few residential/small-commercial
// types get a small per-instance pastel palette instead — real streets
// of these types (a kampung, a row of heritage shophouses) show exactly
// this kind of muted, varied-but-harmonious palette, not a rainbow.
const PASTEL_PALETTES: Partial<Record<BType, readonly string[]>> = {
  // Tall-building tones are linked to their geometry variant below so
  // variety costs one bucket per silhouette, not a variant × colour grid.
  tower: ["#8ea5ad", "#9cabb0", "#849aa5", "#91a2a7", "#a2acad"],
  skyscraper: ["#728b97", "#8297a1", "#6d8792", "#8c9ca2", "#788e96"],
  hotel: ["#b08b70", "#99867b", "#87979f", "#a69379", "#81929a"],
  kampung: ["#b89a7c", "#c9ac8c", "#a9c2a0", "#b6c6d2", "#d2b6a4"],
  house: ["#e0d3b6", "#d8c4a8", "#c9d4c0", "#d2c8d8", "#e0c8b8"],
  terrace: ["#c9b79c", "#bfa98c", "#a9b8a0", "#b2b9c8", "#c9b0a0"],
  shophouse: ["#d8bfae", "#c9a882", "#a9bfa0", "#b2c4d0", "#d4a8a0", "#e0d0a0"],
  shop: ["#dcd2be", "#d2c8a8", "#c8d4c8", "#d8c8d0"],
  stall: ["#ded7c6", "#d4c8a8", "#c8d0c0"],
};
const VARIANT_LINKED_PALETTES = new Set<BType>(["tower", "skyscraper", "hotel"]);
// Same well-tested hash as pickVariantIndex, keyed with a suffix so the
// colour pick doesn't correlate 1:1 with the geometry-variant pick.
function pickColorIndex(key: string, count: number): number {
  return pickVariantIndex(`${key}:hue`, count);
}
// High-rises carry five skyline profiles; gables and low-rise setbacks use
// three, while flat-roof / dome families carry two.
export function variantCount(type: BType): number {
  if (type === "tower" || type === "skyscraper" || type === "hotel") return 5;
  return GABLE_TYPES.has(type) || SETBACK_TYPES.has(type) ? 3 : 2;
}
export const PROCEDURAL_VARIANT_COUNT = 5; // kept for callers that want the max

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
function buildGableTemplate(riseFrac: number, wallFrac: number, stilted = false): THREE.BufferGeometry {
  // Rumah panggung — the design canvas's BENTUK card asks for stilts on
  // kampung. Lift the wall box by a floor gap and stand it on four
  // corner posts; posts live in the wall (MAT_WALL) group.
  const gap = stilted ? 0.12 : 0;
  const wall = new THREE.BoxGeometry(1, wallFrac, 1);
  wall.translate(0, gap + wallFrac / 2, 0);
  const stilts: THREE.BufferGeometry[] = [];
  if (stilted) {
    for (const sx of [-0.4, 0.4]) {
      for (const sz of [-0.4, 0.4]) {
        const post = new THREE.BoxGeometry(0.08, gap, 0.08);
        post.translate(sx, gap / 2, sz);
        stilts.push(post);
      }
    }
  }

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
  const base = gap + wallFrac;
  const shape = new THREE.Shape();
  shape.moveTo(-half, base);
  shape.lineTo(0, base + riseFrac);
  shape.lineTo(half, base);
  shape.lineTo(-half, base);
  const roof = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  roof.translate(0, 0, -0.5);

  // Merge WITHOUT groups, then add exactly two contiguous groups by known
  // vertex count — the wall box (+ any stilts) first, the extruded roof
  // second — rather than trusting mergeGeometries' own group handling
  // (its per-input materialIndex remap has changed between three versions).
  const wallFlat = mergeGeometries(
    [wall, ...stilts].map(stripToPositionNormalUv), false,
  ) ?? stripToPositionNormalUv(wall);
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
// `bands` (>0) adds that many thin proud floor-line rings around the
// lower block — the horizontal banding the design canvas's BENTUK card
// asks for on the office towers. `awning` (>0) adds a thin slab
// projecting from the front (+Z) face near ground level — the shophouse
// five-foot-way. Both are axis-aligned boxes in the single shell
// material (see the MAT_WALL/MAT_ROOF note).
function buildSetbackTemplate(
  lowerFrac: number, setbackFrac: number, bands = 0, awning = 0,
): THREE.BufferGeometry {
  const lower = new THREE.BoxGeometry(1, lowerFrac, 1);
  lower.translate(0, lowerFrac / 2, 0);
  const upperH = 1 - lowerFrac;
  const upper = new THREE.BoxGeometry(setbackFrac, upperH, setbackFrac);
  upper.translate(0, lowerFrac + upperH / 2, 0);

  const extras: THREE.BufferGeometry[] = [];
  for (let i = 1; i <= bands; i++) {
    const ring = new THREE.BoxGeometry(1.03, 0.014, 1.03);
    ring.translate(0, (lowerFrac / (bands + 1)) * i, 0);
    extras.push(ring);
  }
  if (awning > 0) {
    const slab = new THREE.BoxGeometry(0.98, 0.03, awning);
    slab.translate(0, lowerFrac * 0.32, 0.5 + awning / 2 - 0.02);
    extras.push(slab);
  }

  const merged = mergeGeometries(
    [lower, upper, ...extras].map(stripToPositionNormalUv),
    false,
  );
  if (!merged) return lower;
  // Single material for the whole shell — see the MAT_WALL/MAT_ROOF note.
  merged.clearGroups();
  return merged;
}

// Four offset volumes form a terraced slab. The stepped centre of gravity
// breaks up a skyline dominated by symmetric two-box setbacks while staying
// inside the same unit footprint and instancing contract.
function buildTerracedTowerTemplate(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (w: number, h: number, d: number, y: number, x = 0, z = 0) => {
    const box = new THREE.BoxGeometry(w, h, d);
    box.translate(x, y, z);
    parts.push(box);
  };
  add(1, 0.18, 1, 0.09);
  add(0.84, 0.32, 0.86, 0.34, -0.05, 0.02);
  add(0.68, 0.28, 0.7, 0.64, 0.06, -0.04);
  add(0.46, 0.22, 0.5, 0.89, 0.12, -0.07);
  for (const y of [0.5, 0.78]) add(0.88 - y * 0.25, 0.014, 0.9 - y * 0.25, y, 0.03, -0.02);
  const merged = mergeGeometries(parts.map(stripToPositionNormalUv), false);
  if (!merged) return parts[0];
  merged.clearGroups();
  return merged;
}

// An octagonal glass shaft gives the fifth profile a different highlight
// roll-off from the box families. Low-poly rings keep its floors legible.
function buildOctagonalTowerTemplate(): THREE.BufferGeometry {
  const podium = new THREE.BoxGeometry(1, 0.2, 1);
  podium.translate(0, 0.1, 0);
  const shaft = new THREE.CylinderGeometry(0.42, 0.5, 0.66, 8, 1, false);
  shaft.translate(0, 0.53, 0);
  const crown = new THREE.CylinderGeometry(0.25, 0.36, 0.14, 8, 1, false);
  crown.translate(0, 0.93, 0);
  const rings = [0.36, 0.56, 0.76].map((y) => {
    const ring = new THREE.CylinderGeometry(0.48 - y * 0.08, 0.48 - y * 0.08, 0.014, 8);
    ring.translate(0, y, 0);
    return ring;
  });
  const merged = mergeGeometries(
    [podium, shaft, crown, ...rings].map(stripToPositionNormalUv), false,
  );
  if (!merged) return podium;
  merged.clearGroups();
  return merged;
}

// A sawtooth (north-light) roof strip sitting on y=wallFrac — the
// design canvas's BENTUK cue for the factory / warehouse. One extruded
// polygon: `teeth` asymmetric ridges across local X (vertical riser
// facing -X, sloped pane facing +X), extruded the full Z depth.
function buildSawtoothStrip(wallFrac: number, teeth: number, toothH: number): THREE.BufferGeometry {
  // Solid profile: a base edge at y=wallFrac plus a zigzag top. The
  // valleys stay a hair ABOVE wallFrac (`valley`) so no top vertex lands
  // on the closing base line — a self-touching polygon makes
  // ExtrudeGeometry's triangulator emit degenerate/NaN faces (that blanked
  // Semi + Metro on the first cut).
  const valley = toothH * 0.18;
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, wallFrac);
  shape.lineTo(-0.5, wallFrac + valley);
  for (let k = 0; k < teeth; k++) {
    const x1 = -0.5 + (k + 1) / teeth;
    shape.lineTo(-0.5 + k / teeth, wallFrac + valley + toothH); // riser up
    shape.lineTo(x1, wallFrac + valley);                        // slope down to next valley
  }
  shape.lineTo(0.5, wallFrac);  // drop to the base at the right edge
  shape.lineTo(-0.5, wallFrac); // close along the base
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -0.5);
  return geo;
}

// Flat-roof shell + an overhanging parapet cornice — the minimum
// silhouette detail so no BType ships as a bare box. Deliberately just
// two boxes (24 tris): the cornice is what reads at the scene's camera
// distance; a rooftop-unit box was tried and only shows on close zoom
// while costing +50% triangles across every civic/retail instance.
// `variant` nudges the wall height and cornice depth. `sawtooth` swaps
// the parapet for a north-light roof (factory / warehouse).
function buildBoxCapTemplate(variant: number, sawtooth = false): THREE.BufferGeometry {
  const wallFrac = [0.92, 0.88][variant] ?? 0.9;
  const capH = 1 - wallFrac;
  const wall = new THREE.BoxGeometry(1, wallFrac, 1);
  wall.translate(0, wallFrac / 2, 0);
  const cap = sawtooth
    ? buildSawtoothStrip(wallFrac, 4, Math.min(capH * 2.2, 0.16))
    : (() => {
        const cornice = new THREE.BoxGeometry(1.04, capH, 1.04);
        cornice.translate(0, wallFrac + capH / 2, 0);
        return cornice;
      })();
  const merged = mergeGeometries(
    [wall, cap].map(stripToPositionNormalUv), false,
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
    geo = buildGableTemplate(rise, wall, type === "kampung");
  } else if (DOME_TYPES.has(type)) {
    geo = buildDomeTemplate(variant);
  } else if (BOXCAP_TYPES.has(type)) {
    geo = buildBoxCapTemplate(variant, type === "factory" || type === "warehouse");
    if (type === "antenna" || type === "fire") geo = withMast(geo);
  } else {
    // tower/skyscraper: pronounced setback + horizontal floor banding;
    // shophouse: barely recessed upper floor (real low-rise proportions)
    // + a five-foot-way awning along its front.
    const isShop = type === "shophouse";
    if (!isShop && variant === 3) {
      geo = buildTerracedTowerTemplate();
    } else if (!isShop && variant === 4) {
      geo = buildOctagonalTowerTemplate();
    } else {
      const pronounced = isShop
        ? { lower: [0.72, 0.76, 0.8], setback: [0.9, 0.86, 0.82] }
        : { lower: [0.55, 0.62, 0.68], setback: [0.44, 0.58, 0.7] };
      geo = buildSetbackTemplate(
        pronounced.lower[variant] ?? 0.6,
        pronounced.setback[variant] ?? 0.6,
        isShop ? 0 : 4,
        isShop ? 0.16 : 0,
      );
    }
    if (type === "skyscraper") geo = withMast(geo);
  }
  if (COMMERCIAL_TYPES.has(type)) {
    // Keep horizontal roof/canopy faces free of windows. Reorder triangles
    // into two contiguous groups to retain just two draws per instance batch.
    const flat = stripToPositionNormalUv(geo);
    const normals = flat.getAttribute("normal");
    const walls: number[] = [];
    const caps: number[] = [];
    for (let i = 0; i < normals.count; i += 3) {
      (Math.abs(normals.getY(i)) > 0.5 ? caps : walls).push(i, i + 1, i + 2);
    }
    flat.setIndex([...walls, ...caps]);
    flat.clearGroups();
    flat.addGroup(0, walls.length, MAT_WALL);
    flat.addGroup(walls.length, caps.length, MAT_ROOF);
    geo = flat;
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
  const palette = PASTEL_PALETTES[type];
  const buckets = useMemo(() => {
    const vc = variantCount(type);
    const m = new Map<string, { variant: number; colorIdx: number; items: BuildingInstance[] }>();
    for (const it of items) {
      const vi = pickVariantIndex(it.key, vc);
      const ci = palette
        ? VARIANT_LINKED_PALETTES.has(type) ? vi % palette.length : pickColorIndex(it.key, palette.length)
        : 0;
      const bk = `${vi}:${ci}`;
      const bucket = m.get(bk);
      if (bucket) bucket.items.push(it);
      else m.set(bk, { variant: vi, colorIdx: ci, items: [it] });
    }
    return Array.from(m.values());
  }, [items, type, palette]);

  return (
    <group>
      <ArchitecturalDetails type={type} items={items} groundY={groundY} winLit={winLit} />
      {buckets.map(({ variant, colorIdx, items: vItems }) => (
        <ProceduralVariant
          key={`${type}-${variant}-${colorIdx}`}
          type={type}
          variant={variant}
          items={vItems}
          groundY={groundY}
          color={palette ? palette[colorIdx] : color}
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
  //
  // Reflectivity: the office types (setback) are near-glass — high
  // metalness, low roughness — so they mirror the shared sky env map
  // (environment.tsx, one PMREM for the whole scene). Domestic gable
  // types get almost none; the flat-roof civic/retail (BOXCAP) get a
  // middling sheen. envMapIntensity is bumped on the glassy ones.
  const isGable = GABLE_TYPES.has(type);
  const isCommercial = COMMERCIAL_TYPES.has(type);
  const materials = useMemo(() => {
    // Kept moderate: enough metalness/low-roughness for a clear sky
    // reflection on the office types, but not so much that the material
    // loses its diffuse body (pure-metal towers went to a blown-out gold
    // mass at night once the window emissive + bloom stacked on top).
    const refl = isCommercial
      ? { metalness: 0.08, roughness: 0.72, envMapIntensity: 0.65 }
      : SETBACK_TYPES.has(type)
      ? { metalness: 0.5, roughness: 0.22, envMapIntensity: 1.15 }
      : GABLE_TYPES.has(type)
        ? { metalness: 0.08, roughness: 0.6, envMapIntensity: 0.5 }
        : { metalness: 0.22, roughness: 0.45, envMapIntensity: 0.9 }; // boxcap / dome
    const wall = new THREE.MeshStandardMaterial({
      color,
      map: getFacadeTexture(type, variant),
      // near-white so the palette baked into the window map (windows.ts)
      // comes through instead of being pushed warm
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: getWindowTexture(type, variant),
      emissiveIntensity: 0,
      ...refl,
    });
    wall.userData.baseMetalness = refl.metalness;
    wall.userData.baseEnvMapIntensity = refl.envMapIntensity;
    if (!isGable && !isCommercial) return wall;
    // Terracotta clay tile — the design canvas's one warm accent on an
    // otherwise near-greyscale palette. kampung leans a shade browner.
    const roof = new THREE.MeshStandardMaterial({
      color: new THREE.Color(isCommercial ? "#626a70" : type === "kampung" ? "#8c4634" : "#a4573f"),
      roughness: 0.92,
      metalness: 0.05,
    });
    const arr: THREE.Material[] = [];
    arr[MAT_WALL] = wall;
    arr[MAT_ROOF] = roof;
    return arr;
  }, [type, variant, color, isGable, isCommercial]);

  useEffect(() => {
    // Window brightness by family stays below the façade's body lighting.
    // Sparse office grids get a little more energy; domestic windows remain
    // a soft lived-in glow. This preserves mass and shadow at skyline range.
    const gain = isCommercial ? 0.55 : isGable ? 0.4 : SETBACK_TYPES.has(type) ? 0.85 : 0.62;
    const wall = (Array.isArray(materials) ? materials[MAT_WALL] : materials) as THREE.MeshStandardMaterial;
    wall.emissiveIntensity = winLit * gain;
    // At night, drop the metalness / sky-reflection on the glassy setbacks
    // so the diffuse body still catches the ambient + hemi fill and the
    // tower keeps a visible SHAPE instead of a black mirror of a dark sky.
    const baseM = (wall.userData.baseMetalness as number | undefined) ?? wall.metalness;
    const baseE = (wall.userData.baseEnvMapIntensity as number | undefined) ?? wall.envMapIntensity;
    if (SETBACK_TYPES.has(type)) {
      wall.metalness = baseM * (1 - winLit * 0.62);
      wall.envMapIntensity = baseE * (1 - winLit * 0.55);
    }
  }, [materials, winLit, isGable, isCommercial, type]);

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
