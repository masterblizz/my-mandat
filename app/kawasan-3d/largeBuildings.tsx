// Item 7 (task part B): multi-cell building footprints — a few large
// "anchor" buildings that occupy an N×M block of grid cells instead of a
// single cell.
//
// Placement model this plugs into (confirmed by reading cityData.ts /
// CityScene.tsx): buildings are placed strictly per developed zone cell —
// `zoneBuildings(zone)` returns slot-indexed BSpecs inside that one
// 240×240 tile, there is no pre-existing multi-cell concept. Roads are
// NOT per-cell-boundary segments either: `Grid()` draws one full-span
// plane per grid line (`vRoads` / `hRoads`). So "route roads around a
// merged footprint" can't be done by dropping a segment — instead the
// large building carries a tall opaque podium slab spanning its whole
// combined footprint, which occludes the road/sidewalk/ground (and any
// car) passing underneath from every camera angle this scene allows. A
// true strip-segmentation is noted as a follow-up in the migration log.
//
// Deterministic: candidates come from `placed` (already centre-outward)
// filtered by zone kind, gated by a stable hash of the zone id, capped at
// MAX_LARGE — no per-render randomness. Central candidates win the cap so
// a large building reads as an intentional core landmark.

import { useMemo } from "react";
import * as THREE from "three";
import {
  PLOT, ROAD_GAP, plotXY, worldCentre, buildingHeight, BUILDING_COLOR,
  type CellPlacement, type BType, type ZoneKind,
} from "./cityData";

const ROAD_W = ROAD_GAP - PLOT;
const MAX_LARGE = 3;

const TILE_H = 4; // must match CityScene.tsx GROUND_Y / TILE_H
// Podium spans y=0 .. GROUND_Y+2 so it also fully occludes a traversing
// car (box centred at y=3, ~6 tall) — traffic paths are straight lines
// (scenery.tsx) and are not rerouted; the podium just hides the pass.
const PODIUM_TOP = TILE_H + 2;
const PODIUM_COLOR = "#4a515c";     // plaza-concrete base, reads as a skirt
const ROOF_DECK_COLOR = "#7f8792";  // light rooftop plant, NOT a dark cap

// A landmark should have real mass — the raw buildingHeight() for these
// types (stadium 16, mall ~40) reads as a flat lid on a 2-cell footprint
// from this camera. Bump to a per-type minimum.
const BODY_MIN: Partial<Record<BType, number>> = { mall: 62, stadium: 40, factory: 44 };

// Anchor type + footprint (in cells) per candidate zone kind.
const LARGE_BY_KIND: Partial<Record<ZoneKind, { type: BType; cols: number; rows: number }>> = {
  commercial: { type: "mall", cols: 2, rows: 2 },
  education: { type: "stadium", cols: 2, rows: 2 },
  industry: { type: "factory", cols: 2, rows: 1 },
};

export type LargePlacement = {
  zoneId: string;
  type: BType;
  anchorCol: number;
  anchorRow: number;
  cols: number;
  rows: number;
  /** world-space centre of the combined footprint */
  cx: number;
  cz: number;
  /** world-space size of the combined footprint (tiles + swallowed road gaps) */
  w: number;
  d: number;
  h: number;
};

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

// tile centre (world space) for a grid column/row, matching placeZones().
function tileCentre(index: number, gridSize: number): number {
  return plotXY(gridSize)[index] + PLOT / 2 - worldCentre(gridSize);
}

export function reserveLargeFootprints(
  placed: CellPlacement[],
  gridSize: number,
): { larges: LargePlacement[]; claimed: Set<string> } {
  const claimed = new Set<string>();
  const larges: LargePlacement[] = [];
  const developed = new Set(placed.map((p) => `${p.col},${p.row}`));

  for (const p of placed) {
    if (larges.length >= MAX_LARGE) break;
    const spec = LARGE_BY_KIND[p.zone.kind];
    if (!spec) continue;
    // Stable per-zone gate so only some qualifying zones upgrade.
    if (hash(p.zone.id + ":large") % 2 !== 0) continue;

    const { cols, rows } = spec;
    // Required block = anchor cell + (cols-1, rows-1) toward +col/+row.
    const cells: string[] = [];
    let ok = p.col + cols <= gridSize && p.row + rows <= gridSize;
    for (let dc = 0; ok && dc < cols; dc++) {
      for (let dr = 0; dr < rows; dr++) {
        const key = `${p.col + dc},${p.row + dr}`;
        if (claimed.has(key)) { ok = false; break; }
        cells.push(key);
      }
    }
    if (!ok) continue;

    cells.forEach((k) => claimed.add(k));
    const cxA = tileCentre(p.col, gridSize);
    const cxB = tileCentre(p.col + cols - 1, gridSize);
    const czA = tileCentre(p.row, gridSize);
    const czB = tileCentre(p.row + rows - 1, gridSize);
    larges.push({
      zoneId: p.zone.id,
      type: spec.type,
      anchorCol: p.col,
      anchorRow: p.row,
      cols,
      rows,
      cx: (cxA + cxB) / 2,
      cz: (czA + czB) / 2,
      w: cols * PLOT + (cols - 1) * ROAD_W,
      d: rows * PLOT + (rows - 1) * ROAD_W,
      h: buildingHeight(spec.type, p.zone),
    });
  }

  // Guard: `developed` is only used to keep the intent explicit (anchors
  // are always developed cells, since `placed` holds only those). Kept as
  // a named check so a future change to `placed` can't silently anchor a
  // large building on nothing.
  return { larges: larges.filter((l) => developed.has(`${l.anchorCol},${l.anchorRow}`)), claimed };
}

// A grid junction (between grid lines i and j) is interior to a merged
// footprint when all four cells touching it are claimed — those junctions'
// street lamps must be suppressed so a 26-unit pole doesn't spear up
// through the podium.
export function junctionInsideLarge(i: number, j: number, gridSize: number, claimed: Set<string>): boolean {
  const quad = [
    [i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j],
  ];
  const inb = quad.filter(([c, r]) => c >= 0 && c < gridSize && r >= 0 && r < gridSize);
  return inb.length === 4 && inb.every(([c, r]) => claimed.has(`${c},${r}`));
}

// ── render ──────────────────────────────────────────────────────────
// Per large building (≤ MAX_LARGE): a podium skirt + a massed body
// (two-tier for mall/stadium so the silhouette isn't a plain lid) + a
// small LIGHT rooftop deck. Ordinary meshes — the count is tiny and the
// sizes all differ, so instancing would only add complexity. Clicking any
// part selects the anchor zone, same as its ZoneTile would.
export function LargeBuildings({
  larges, onSelect,
}: {
  larges: LargePlacement[];
  onSelect: (id: string) => void;
}) {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  if (!larges.length) return null;
  return (
    <group>
      {larges.map((l) => {
        const bodyH = Math.max(l.h * 1.5, BODY_MIN[l.type] ?? 40);
        const color = BUILDING_COLOR[l.type];
        const tiered = l.type === "mall" || l.type === "stadium";
        const lowerH = tiered ? bodyH * 0.55 : bodyH;
        const upperH = bodyH - lowerH;
        return (
          <group
            key={l.zoneId}
            position={[l.cx, 0, l.cz]}
            onClick={(e) => { e.stopPropagation(); onSelect(l.zoneId); }}
          >
            {/* podium skirt: masks road / sidewalk / ground / cars under
                the whole combined footprint (see PODIUM_TOP note) */}
            <mesh geometry={geo} position={[0, PODIUM_TOP / 2, 0]} scale={[l.w, PODIUM_TOP, l.d]} receiveShadow castShadow>
              <meshStandardMaterial color={PODIUM_COLOR} roughness={0.9} />
            </mesh>
            {/* lower mass — full footprint */}
            <mesh geometry={geo} position={[0, TILE_H + lowerH / 2, 0]} scale={[l.w * 0.95, lowerH, l.d * 0.95]} castShadow receiveShadow>
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
            {/* upper mass — narrower, only for the tiered types */}
            {tiered && upperH > 1 && (
              <mesh geometry={geo} position={[0, TILE_H + lowerH + upperH / 2, 0]} scale={[l.w * 0.66, upperH, l.d * 0.66]} castShadow receiveShadow>
                <meshStandardMaterial color={color} roughness={0.8} />
              </mesh>
            )}
            {/* rooftop deck — light, small, so the roofline has plant
                detail instead of reading as a black lid from above */}
            <mesh geometry={geo} position={[0, TILE_H + bodyH + 1.5, 0]} scale={[l.w * (tiered ? 0.5 : 0.72), 3, l.d * (tiered ? 0.5 : 0.72)]} castShadow>
              <meshStandardMaterial color={ROOF_DECK_COLOR} roughness={0.85} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
