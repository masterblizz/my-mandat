"use client";

// Crosswalk decals + sidewalk curb strips — the two road-adjacent details
// from the CSS version (app/kawasan/page.tsx: the zebra-crossing block and
// each ZonePlot's own south/east sidewalk strip) ported to WebGL. Both are
// small, fixed-count-per-map InstancedMeshes: 1 draw call for crosswalks
// (all qualifying junctions, both stripe orientations, one shared quad +
// texture), 2 draw calls for sidewalks (one for every tile's south edge,
// one for every tile's east edge) — cost never scales with individual
// segments, matching the road texture's own O(1) draw-call shape.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getCrosswalkTexture } from "./roadTexture";
import { PLOT, type CellPlacement, type ZoneKind } from "./cityData";

const TILE_H = 4; // must match CityScene.tsx's TILE_H (zone-tile box height)

// ── crosswalks ──────────────────────────────────────────────────────
// Only at junctions bordering an education/community-kind zone (school or
// clinic), same restraint as the CSS version — crosswalks read as a
// deliberate safety marking tied to those zones, not blanket decoration.
export function Crosswalks({
  placed, gridSize, vRoads, hRoads,
}: {
  placed: CellPlacement[];
  gridSize: number;
  /** Recentred world-space positions, same arrays Grid() builds for the road planes. */
  vRoads: number[];
  hRoads: number[];
}) {
  const zoneKindByCell = useMemo(() => {
    const m = new Map<string, ZoneKind>();
    placed.forEach(({ zone, col, row }) => m.set(`${col},${row}`, zone.kind));
    return m;
  }, [placed]);

  const junctions = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < vRoads.length; i++) {
      const cols = [i - 1, i].filter((c) => c >= 0 && c < gridSize);
      for (let j = 0; j < hRoads.length; j++) {
        const rows = [j - 1, j].filter((r) => r >= 0 && r < gridSize);
        const qualifies = rows.some((row) => cols.some((col) => {
          const kind = zoneKindByCell.get(`${col},${row}`);
          return kind === "education" || kind === "community";
        }));
        if (qualifies) out.push({ x: vRoads[i], z: hRoads[j] });
      }
    }
    return out;
  }, [vRoads, hRoads, gridSize, zoneKindByCell]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const texture = useMemo(() => getCrosswalkTexture(), []);
  const count = junctions.length * 2;
  const ROAD_W_LOCAL = 40; // matches ROAD_GAP - PLOT in cityData.ts

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    let idx = 0;
    const long = ROAD_W_LOCAL * 1.4;
    const short = ROAD_W_LOCAL * 0.7;
    for (const { x, z } of junctions) {
      // Both decals only differ by which local axis carries the "long"
      // (walking-direction) scale — no extra rotation needed beyond the
      // shared flattening below, since a flattened plane's local X/Y map
      // straight onto world X/Z (see water.tsx's WaterPatches for the
      // same convention).
      dummy.position.set(x, 0.85, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(short, long, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx++, dummy.matrix);

      dummy.scale.set(long, short, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx++, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [junctions, dummy]);

  if (!count) return null;
  return (
    <instancedMesh ref={ref} key={`crosswalk-${count}`} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </instancedMesh>
  );
}

// ── sidewalks ───────────────────────────────────────────────────────
// A thin raised curb strip along each DEVELOPED zone tile's own south and
// east edges — ported from the CSS version's ZonePlot sidewalk strips,
// which are similarly inset within each tile's own footprint rather than
// stealing width from the road: ROAD_GAP (280) - PLOT (240) leaves exactly
// ROAD_W (40) for the road itself, zero spare to add a strip on that side.
export function Sidewalks({ placed }: { placed: CellPlacement[] }) {
  const southRef = useRef<THREE.InstancedMesh>(null);
  const eastRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const CURB_H = 2;
  const CURB_W = 7;

  useLayoutEffect(() => {
    const south = southRef.current;
    const east = eastRef.current;
    if (!south || !east) return;
    placed.forEach(({ cx, cz }, i) => {
      dummy.position.set(cx, TILE_H + CURB_H / 2, cz + PLOT / 2 - CURB_W / 2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(PLOT, CURB_H, CURB_W);
      dummy.updateMatrix();
      south.setMatrixAt(i, dummy.matrix);

      dummy.position.set(cx + PLOT / 2 - CURB_W / 2, TILE_H + CURB_H / 2, cz);
      dummy.scale.set(CURB_W, CURB_H, PLOT);
      dummy.updateMatrix();
      east.setMatrixAt(i, dummy.matrix);
    });
    south.instanceMatrix.needsUpdate = true;
    east.instanceMatrix.needsUpdate = true;
    // Per-instance scaling on a unit box means the default bounding
    // sphere (computed from the unscaled geometry) is far too small for
    // the actual world-space extent — without this, frustum culling hides
    // the whole mesh. Every other InstancedMesh in this codebase that
    // scales a unit primitive per-instance does this same recompute
    // (models.tsx, water.tsx, vegetation.tsx); missed it here initially.
    south.computeBoundingSphere();
    east.computeBoundingSphere();
  }, [placed, dummy]);

  if (!placed.length) return null;
  return (
    <>
      <instancedMesh ref={southRef} key={`sw-s-${placed.length}`} args={[undefined, undefined, placed.length]} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c7ced9" />
      </instancedMesh>
      <instancedMesh ref={eastRef} key={`sw-e-${placed.length}`} args={[undefined, undefined, placed.length]} receiveShadow castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c7ced9" />
      </instancedMesh>
    </>
  );
}
