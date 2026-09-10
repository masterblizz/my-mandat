// Item 7 (task part B), revised in item 17 (MERCU TANDA card): a few
// large "anchor" landmarks — a mall, a stadium, a factory — that replace
// the ordinary building set on one developed cell and carry composed,
// per-type massing so they read as a real complex.
//
// Item 7 originally gave these a 2×2 / 2×1 grid-cell footprint. The
// "City Realism" design canvas flagged that as wrong ("in main a mall is
// 58×48 on a 240 plot — smaller than the plateau in your screenshot"):
// a ~520-wide slab spanning multiple blocks, swallowing the roads
// between them, reads as a coloured plateau, not a building. Item 17
// pulls them back to a single 240 cell (`cols:1, rows:1`); the massing
// math below is all relative to `l.w` / `l.d` so it scaled down with no
// other change, and the roads/sidewalks around the cell are visible
// again. `junctionInsideLarge` is now always false (no 4-cell block) and
// kept only as a guard.
//
// Deterministic: candidates come from `placed` (already centre-outward)
// filtered by zone kind, gated by a stable hash of the zone id, capped at
// MAX_LARGE — no per-render randomness. Central candidates win the cap so
// a landmark reads as an intentional core feature.

import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import {
  PLOT, ROAD_GAP, plotXY, worldCentre, buildingHeight, BUILDING_COLOR,
  type CellPlacement, type BType, type ZoneKind,
} from "./cityData";

const ROAD_W = ROAD_GAP - PLOT;
const MAX_LARGE = 3;

const TILE_H = 4; // must match CityScene.tsx GROUND_Y / TILE_H
// Landscaped apron — a thin paved skirt seating the complex on its plot.
// (Item 7's tall podium spanned merged cells to mask swallowed roads;
// with a single-cell footprint there is nothing to mask, so it is now
// just a low ground apron.)
const PODIUM_TOP = TILE_H + 1;
const PODIUM_COLOR = "#6b6c66";     // paved apron, reads as a forecourt
const ROOF_DECK_COLOR = "#8b9199";  // light rooftop plant, NOT a dark cap
const ANTENNA_COLOR = "#9aa4b2";
const CHIMNEY_COLOR = "#8a8f98";
const GLASS_COLOR = "#8fb0bd";      // atrium curtain-wall
const PIN_COLOR = "#ffd27a";        // floating PROJECT_ICON pin (emissive)

// `buildingHeight()` for these types is 16-49 on a 240 plot — a pancake —
// so each gets a composed massing (podium / bowl + a taller element),
// with a per-type minimum for the tall part. Tuned for the single-cell
// footprint (item 17): a mall tower here is ~110-130, not 205.
const TALL_MIN: Partial<Record<BType, number>> = { mall: 118, stadium: 60, factory: 82 };

// Anchor type + footprint (in cells) per candidate zone kind. Single-cell
// since item 17 — see file header.
const LARGE_BY_KIND: Partial<Record<ZoneKind, { type: BType; cols: number; rows: number }>> = {
  commercial: { type: "mall", cols: 1, rows: 1 },
  education: { type: "stadium", cols: 1, rows: 1 },
  industry: { type: "factory", cols: 1, rows: 1 },
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
// Per landmark (≤ MAX_LARGE): a paved apron + a composed, per-type
// massing on a single 240 cell (item 17) so the silhouette reads as a
// real complex, not a coloured slab —
//   mall     : banded retail base + glazed atrium front + entrance
//              canopy + a setback office slab + roof plant
//   stadium  : stepped bowl + inset upper tier + light roof rim + masts
//   factory  : long shed + rooftop plant + three chimneys
// plus a floating icon pin marking it from across the map.
// Ordinary meshes — the count is tiny and every size differs, so
// instancing would only add complexity. Clicking any part selects the
// anchor zone, same as its ZoneTile would.
export function LargeBuildings({
  larges, onSelect, winLit = 0,
}: {
  larges: LargePlacement[];
  onSelect: (id: string) => void;
  winLit?: number;
}) {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  if (!larges.length) return null;
  return (
    <group>
      {larges.map((l) => {
        const color = BUILDING_COLOR[l.type];
        // The mall's office slab + atrium glass are reflective (they pick
        // up the shared sky env map, environment.tsx); everything else
        // here stays matte. `emis` gives the tall body parts a
        // winLit-gated window glow so the landmark isn't a black cut-out
        // at night like the rest of the skyline.
        const box = (
          key: string, x: number, y: number, z: number,
          sx: number, sy: number, sz: number, c: string,
          rough = 0.82, shadow = true, metal = 0.06, emis?: string,
        ) => (
          <mesh key={key} geometry={geo} position={[x, y, z]} scale={[sx, sy, sz]} castShadow={shadow} receiveShadow>
            <meshStandardMaterial
              color={c} roughness={rough} metalness={metal} envMapIntensity={1}
              emissive={emis ?? "#000000"} emissiveIntensity={emis ? winLit * 1.5 : 0}
            />
          </mesh>
        );
        // Working footprint: ~70% of the plot, so road + sidewalk + a
        // strip of ground stay visible around the complex.
        const fw = l.w * 0.7;
        const fd = l.d * 0.7;
        const apronH = PODIUM_TOP - TILE_H; // thin paved forecourt slab
        const parts: ReactNode[] = [
          box("apron", 0, TILE_H + apronH / 2, 0, l.w * 0.9, apronH, l.d * 0.9, PODIUM_COLOR, 0.92),
        ];
        const tall = Math.max(l.h * 2.2, TALL_MIN[l.type] ?? 90);

        if (l.type === "mall") {
          const baseH = 40;
          parts.push(box("base", 0, TILE_H + baseH / 2, 0, fw, baseH, fd, color, 0.8, true, 0.06, "#4c5878"));
          // banded façade: three thin proud rings at quarter heights
          for (let f = 1; f <= 3; f++) {
            parts.push(box(`band${f}`, 0, TILE_H + (baseH / 4) * f, 0, fw + 3, 2.4, fd + 3, "#9b9182", 0.84));
          }
          // glazed atrium on the front (+z) face + a mullion strip
          parts.push(box("atrium", 0, TILE_H + baseH * 0.52, fd / 2 + 1, fw * 0.5, baseH * 0.82, 3, GLASS_COLOR, 0.18, true, 0.45, "#d8c193"));
          parts.push(box("mull", 0, TILE_H + baseH * 0.52, fd / 2 + 2.6, fw * 0.52, 1.6, 1.6, "#6b7278", 0.7, false, 0.2));
          // flat entrance canopy on two columns
          parts.push(box("canopy", 0, TILE_H + 13, fd / 2 + 9, fw * 0.6, 1.8, 17, ANTENNA_COLOR, 0.55, true, 0.4));
          ([-0.24, 0.24] as const).forEach((cx, i) => {
            parts.push(box(`col${i}`, fw * cx, TILE_H + 6.5, fd / 2 + 15, 2.6, 13, 2.6, ANTENNA_COLOR, 0.55, false, 0.4));
          });
          // one setback office slab rising off the base — glassy
          parts.push(box("tower", fw * 0.12, TILE_H + baseH + tall / 2, -fd * 0.05, fw * 0.44, tall, fd * 0.34, color, 0.26, true, 0.5, "#4c5772"));
          parts.push(box("deck", fw * 0.12, TILE_H + baseH + tall + 1.6, -fd * 0.05, fw * 0.3, 3, fd * 0.24, ROOF_DECK_COLOR, 0.85));
        } else if (l.type === "stadium") {
          // stepped bowl — two inset tiers, no full-footprint grey lid.
          const bowlH = tall * 0.6;
          const upperH = tall - bowlH;
          parts.push(box("bowl", 0, TILE_H + bowlH / 2, 0, fw + 20, bowlH, fd + 20, color, 0.86, true, 0.06, "#7e8f5c"));
          parts.push(box("upper", 0, TILE_H + bowlH + upperH / 2, 0, fw * 0.78, upperH, fd * 0.78, color, 0.86, true, 0.06, "#7e8f5c"));
          parts.push(box("rim", 0, TILE_H + tall + 1.5, 0, fw * 0.7, 3, fd * 0.7, ROOF_DECK_COLOR, 0.85));
          ([[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const).forEach(([mx, mz], i) => {
            parts.push(box(`mast${i}`, (fw + 16) * mx, TILE_H + tall + 12, (fd + 16) * mz, 3, 26, 3, ANTENNA_COLOR, 0.6, false));
          });
        } else {
          // factory: long shed + a rooftop plant box + three fat chimneys
          const shedH = Math.max(l.h * 2.0, 56);
          parts.push(box("shed", 0, TILE_H + shedH / 2, 0, fw + 12, shedH, fd + 12, color, 0.85, true, 0.06, "#8c7a54"));
          parts.push(box("plant", -fw * 0.2, TILE_H + shedH + 8, 0, fw * 0.34, 16, fd * 0.6, CHIMNEY_COLOR, 0.85));
          ([[0.16, 0.26], [0.32, -0.04], [0.16, -0.3]] as const).forEach(([fx, fz], i) => {
            parts.push(box(`ch${i}`, fw * fx, TILE_H + shedH + (tall - shedH) / 2, fd * fz, 12, tall - shedH, 12, CHIMNEY_COLOR, 0.85));
          });
        }

        // Floating icon pin — a slim post + a bright head, above the
        // tallest part, so the landmark is findable from across the map.
        const pinBase = TILE_H + tall + (l.type === "mall" ? 30 : 16);
        parts.push(box("pinpost", 0, pinBase + 8, 0, 1.4, 16, 1.4, "#c8ccd2", 0.6, false));
        parts.push(box("pinhead", 0, pinBase + 20, 0, 10, 10, 3.5, PIN_COLOR, 0.5, false, 0.15));

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
