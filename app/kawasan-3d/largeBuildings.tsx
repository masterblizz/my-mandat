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

import { useMemo, type ReactNode } from "react";
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
const ANTENNA_COLOR = "#9aa4b2";
const CHIMNEY_COLOR = "#8a8f98";

// A landmark on a 2-cell (≈520-wide) footprint reads as a flat platform
// unless it carries real vertical mass. `buildingHeight()` for these
// types is 16-49 — a ~1:11 pancake — so each gets a composed massing
// below (wide low podium + tall slab(s) / bowl / chimneys), with a
// per-type minimum for the tall part.
const TALL_MIN: Partial<Record<BType, number>> = { mall: 205, stadium: 104, factory: 150 };

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
// Per large building (≤ MAX_LARGE): a podium skirt + a composed,
// per-type massing so the silhouette reads as a building, not a slab —
//   mall     : wide retail podium + two office slabs + an antenna
//   stadium  : wide bowl + an inset upper tier + a light roof rim
//   factory  : long shed + two chimneys
// Ordinary meshes — the count is tiny and every size differs, so
// instancing would only add complexity. Clicking any part selects the
// anchor zone, same as its ZoneTile would.
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
        const color = BUILDING_COLOR[l.type];
        const box = (
          key: string, x: number, y: number, z: number,
          sx: number, sy: number, sz: number, c: string, rough = 0.82, shadow = true,
        ) => (
          <mesh key={key} geometry={geo} position={[x, y, z]} scale={[sx, sy, sz]} castShadow={shadow} receiveShadow>
            <meshStandardMaterial color={c} roughness={rough} />
          </mesh>
        );
        const parts: ReactNode[] = [
          // podium skirt: masks road / sidewalk / ground / cars under the
          // whole combined footprint (see PODIUM_TOP note)
          box("skirt", 0, PODIUM_TOP / 2, 0, l.w, PODIUM_TOP, l.d, PODIUM_COLOR, 0.9),
        ];
        const tall = Math.max(l.h * 2.6, TALL_MIN[l.type] ?? 100);

        if (l.type === "mall") {
          const baseH = 42;
          parts.push(box("base", 0, TILE_H + baseH / 2, 0, l.w * 0.96, baseH, l.d * 0.96, color));
          // two office slabs rising from the podium, offset apart
          parts.push(box("t1", l.w * 0.13, TILE_H + baseH + tall / 2, -l.d * 0.06, l.w * 0.4, tall, l.d * 0.32, color));
          const t2 = tall * 0.62;
          parts.push(box("t2", -l.w * 0.24, TILE_H + baseH + t2 / 2, l.d * 0.16, l.w * 0.3, t2, l.d * 0.26, color));
          parts.push(box("deck", l.w * 0.13, TILE_H + baseH + tall + 1.6, -l.d * 0.06, l.w * 0.22, 3, l.d * 0.18, ROOF_DECK_COLOR, 0.85));
          parts.push(box("ant", l.w * 0.13, TILE_H + baseH + tall + 21, -l.d * 0.06, 3, 40, 3, ANTENNA_COLOR, 0.6, false));
        } else if (l.type === "stadium") {
          // stepped green bowl — two inset tiers, no full-footprint grey
          // lid (that read as a giant tabletop hiding the bowl).
          const bowlH = tall * 0.6;
          const upperH = tall - bowlH;
          parts.push(box("bowl", 0, TILE_H + bowlH / 2, 0, l.w * 0.97, bowlH, l.d * 0.97, color));
          parts.push(box("upper", 0, TILE_H + bowlH + upperH / 2, 0, l.w * 0.74, upperH, l.d * 0.74, color));
          // thin light cap only over the inset upper tier
          parts.push(box("cap", 0, TILE_H + tall + 1.5, 0, l.w * 0.66, 3, l.d * 0.66, ROOF_DECK_COLOR, 0.85));
          // four short floodlight masts at the corners
          ([[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]] as const).forEach(([fx, fz], i) => {
            parts.push(box(`mast${i}`, l.w * fx, TILE_H + tall + 12, l.d * fz, 3, 26, 3, ANTENNA_COLOR, 0.6, false));
          });
        } else {
          // factory: long shed + a rooftop plant box + three fat chimneys
          const shedH = Math.max(l.h * 2.2, 84);
          parts.push(box("shed", 0, TILE_H + shedH / 2, 0, l.w * 0.95, shedH, l.d * 0.95, color));
          parts.push(box("plant", -l.w * 0.18, TILE_H + shedH + 9, 0, l.w * 0.3, 18, l.d * 0.55, CHIMNEY_COLOR, 0.85));
          ([[0.14, 0.24], [0.3, -0.05], [0.14, -0.28]] as const).forEach(([fx, fz], i) => {
            parts.push(box(`ch${i}`, l.w * fx, TILE_H + shedH + (tall - shedH) / 2, l.d * fz, 13, tall - shedH, 13, CHIMNEY_COLOR, 0.85));
          });
        }

        return (
          <group
            key={l.zoneId}
            position={[l.cx, 0, l.cz]}
            onClick={(e) => { e.stopPropagation(); onSelect(l.zoneId); }}
          >
            {parts}
          </group>
        );
      })}
    </group>
  );
}
