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

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useHeightTween, InstancedBoxes, type BuildingInstance } from "./models";
import { pickVariantIndex, type BType } from "./cityData";

const GABLE_TYPES = new Set<BType>(["house", "terrace", "kampung"]);
const SETBACK_TYPES = new Set<BType>(["tower", "skyscraper", "shophouse"]);
export const PROCEDURAL_TYPES = new Set<BType>([...Array.from(GABLE_TYPES), ...Array.from(SETBACK_TYPES)]);
export const PROCEDURAL_VARIANT_COUNT = 3;

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

  const merged = mergeGeometries([stripToPositionNormalUv(wall), stripToPositionNormalUv(roof)], false);
  return merged ?? wall;
}

// Stacked setback: a full-footprint lower block + a narrower upper block.
function buildSetbackTemplate(lowerFrac: number, setbackFrac: number): THREE.BufferGeometry {
  const lower = new THREE.BoxGeometry(1, lowerFrac, 1);
  lower.translate(0, lowerFrac / 2, 0);
  const upperH = 1 - lowerFrac;
  const upper = new THREE.BoxGeometry(setbackFrac, upperH, setbackFrac);
  upper.translate(0, lowerFrac + upperH / 2, 0);
  const merged = mergeGeometries([stripToPositionNormalUv(lower), stripToPositionNormalUv(upper)], false);
  return merged ?? lower;
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
  } else {
    // tower/skyscraper: pronounced setback; shophouse: barely recessed
    // upper floor, matching its real-world low-rise proportions.
    const pronounced = type === "shophouse"
      ? { lower: [0.72, 0.76, 0.8], setback: [0.9, 0.86, 0.82] }
      : { lower: [0.55, 0.62, 0.68], setback: [0.44, 0.58, 0.7] };
    geo = buildSetbackTemplate(pronounced.lower[variant] ?? 0.6, pronounced.setback[variant] ?? 0.6);
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
    const m = new Map<number, BuildingInstance[]>();
    for (const it of items) {
      const vi = pickVariantIndex(it.key, PROCEDURAL_VARIANT_COUNT);
      const arr = m.get(vi);
      if (arr) arr.push(it);
      else m.set(vi, [it]);
    }
    return Array.from(m.entries());
  }, [items]);

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
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} emissive="#ffb066" emissiveIntensity={winLit * 0.06} />
    </instancedMesh>
  );
}
