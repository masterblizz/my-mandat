// ── kawasan-3d: ported DATA / LAYOUT layer ─────────────────────────────
// These are PORTED COPIES of the engine-agnostic layout math and zone
// data from app/kawasan/page.tsx (PLOT / ROAD_GAP / plotXY / roadsV /
// roadsH / kawasanGridSize / kawasanDevelopedCount / assignZonePositions /
// zoneGround). They are intentionally byte-for-byte equivalent to the
// originals so the 3D grid sits in the exact same relative layout the game
// logic already expects.
//
// DECISION FOR REVIEW (Phase 5 / cutover): rather than keep these copies,
// extract the originals from app/kawasan/page.tsx into a shared module that
// both routes import, so there is one source of truth and zero drift risk.
// Done as a copy for now to keep the live route's diff at zero during the
// migration.
//
// The zone STATS generator here (makeDemoZones) is a spike stand-in: the
// live route feeds City3DMap real Zone[] from the game store / localStorage.
// Phase 5 swaps makeDemoZones for that same store wiring — the rendering
// code below only ever reads zone.id / zone.kind / zone.sentiment etc., so
// the data source is a drop-in replacement.

export type ZoneKind =
  | "urban" | "village" | "housing" | "commercial" | "education"
  | "industry" | "river" | "market" | "community";

export type ZoneArchetype =
  | "townCentre" | "mainVillage" | "housingEstate" | "commercialHub" | "schoolZone"
  | "industrialArea" | "riverside" | "marketHawkers" | "clinicHall"
  | "fishingVillage" | "paddyVillage" | "industrialEstate";

export type Zone = {
  id: string;
  archetype: ZoneArchetype;
  repeat: number;
  kind: ZoneKind;
  economy: number;
  welfare: number;
  infra: number;
  sentiment: number;
  projects: string[];
};

// ── layout constants (ported verbatim from app/kawasan/page.tsx) ────────
export const PLOT = 240;      // zone tile size
export const ROAD_GAP = 280;  // zone pitch (tile + road)

export function plotXY(gridSize: number): number[] {
  return Array.from({ length: gridSize }, (_, i) => 40 + i * ROAD_GAP);
}
export function roadsV(gridSize: number): number[] {
  return Array.from({ length: gridSize }, (_, i) => i * ROAD_GAP);
}
export function roadsH(gridSize: number): number[] {
  return Array.from({ length: gridSize + 1 }, (_, i) => i * ROAD_GAP);
}
export function kawasanGridSize(density: number): number {
  if (density >= 0.85) return 30; // dense metro — a full KL-scale grid
  if (density >= 0.62) return 16; // metro
  if (density >= 0.3) return 8;   // semi-urban
  return 6;                       // rural
}
// Threshold at/above which a grid is treated as a real metropolitan core
// (matches kawasanGridSize's "metro" cutoff). The 3D route packs these
// grids much tighter — see kawasanDevelopedCount / zoneBuildings /
// jitterFootprint below — so Metro / Dense metro read like a KL-style
// built-up core rather than blocks scattered on open land.
export const METRO_DENSITY = 0.62;

export function kawasanDevelopedCount(density: number, gridSize: number): number {
  const total = gridSize * gridSize;
  const minDeveloped = Math.min(9, total);
  const linear = minDeveloped + density * (total - minDeveloped);
  // Metro and up: almost no undeveloped cells inside the footprint.
  // ~0.86 of the grid at Metro (0.72) rising to ~0.98 at Dense (0.9).
  const packed = density >= METRO_DENSITY
    ? total * Math.min(0.99, 0.86 + (density - METRO_DENSITY) * 0.45)
    : 0;
  let n = Math.max(minDeveloped, Math.min(total, Math.round(Math.max(linear, packed))));
  // Dense metro (30×30) fills ~98% of the grid with buildings — a solid
  // built-up sprawl, only a thin fringe of open land. This is heavy; the
  // "min" quality tier (quality.ts) is what keeps it renderable.
  if (gridSize >= 22) n = Math.round(total * 0.98);
  return n;
}
export function assignZonePositions(
  gridSize: number,
  developedCount: number,
): { col: number; row: number }[] {
  const center = (gridSize - 1) / 2;
  const cells: { col: number; row: number; dist: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      cells.push({ col, row, dist: Math.hypot(col - center, row - center) });
    }
  }
  cells.sort((a, b) => a.dist - b.dist || a.row - b.row || a.col - b.col);
  return cells.slice(0, developedCount).map(({ col, row }) => ({ col, row }));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
function seedFrom(text: string) {
  return text.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

// ── zoneGround: CSS gradient -> single material colour ──────────────────
// The CSS version paints each zone tile with a two-stop linear/radial
// gradient (see zoneGround() in app/kawasan/page.tsx). WebGL wants one flat
// material colour, so this returns the DARKER stop of each original
// gradient — the tile still reads as the same per-kind hue, just without
// the CSS-only gradient sheen (lighting will supply the gradient feel).
export function zoneGroundColor(kind: ZoneKind): string {
  switch (kind) {
    case "river": return "#0c2a3a";
    case "village": return "#17331d";
    case "housing": return "#1d2a24";
    case "industry": return "#232936";
    case "market":
    case "commercial": return "#2b2013";
    case "education":
    case "community": return "#132a24";
    default: return "#1a2530"; // urban + fallback
  }
}

// ── demo zone generator (spike stand-in — see file header) ─────────────
// Mirrors makeZones() from app/kawasan/page.tsx: same archetype->kind base
// pool, same centre-outward cycling for counts past the pool, same stat
// formula. Traits are left at their neutral defaults here.
export function makeDemoZones(seedKey: string, developedCount: number): Zone[] {
  const base = seedFrom(seedKey);
  const basePool: [ZoneArchetype, ZoneKind, number][] = [
    ["townCentre", "urban", 0],
    ["mainVillage", "village", 0],
    ["housingEstate", "housing", 0],
    ["commercialHub", "commercial", 0],
    ["schoolZone", "education", 0],
    ["industrialArea", "industry", 0],
    ["riverside", "river", 0],
    ["marketHawkers", "market", 0],
    ["clinicHall", "community", 0],
  ];
  const names: [ZoneArchetype, ZoneKind, number][] = basePool.slice(
    0, Math.min(developedCount, basePool.length),
  );
  if (developedCount > basePool.length) {
    const cyclePool = basePool.slice(1);
    for (let i = 0; i < developedCount - basePool.length; i++) {
      const [archetype, kind] = cyclePool[i % cyclePool.length];
      names.push([archetype, kind, Math.floor(i / cyclePool.length) + 2]);
    }
  }
  return names.map(([archetype, kind, repeat], index) => {
    const n = base + index * 17;
    const infra = 42 + (n % 28);
    const welfare = 40 + ((n * 3) % 30);
    const economy = 38 + ((n * 5) % 32);
    return {
      id: `zone-${index}`,
      archetype,
      repeat,
      kind,
      economy,
      welfare,
      infra,
      sentiment: clamp(Math.round((infra + welfare + economy) / 3)),
      projects: [],
    };
  });
}

// ── px(CSS) -> Three world-space helpers ──────────────────────────────
// CSS world: a WORLD x WORLD square in the element's local XY plane, with
// translateZ used for building height. Three: ground on the XZ plane, +Y
// up. Mapping: cssX -> worldX, cssY(top/"depth") -> worldZ, cssZ(height)
// -> worldY. Everything is recentred so the grid's midpoint is the origin
// (the fixed point the camera pivots around), matching the CSS version
// rotating around its own fixed scene anchor.
export function worldSize(gridSize: number): number {
  return gridSize * ROAD_GAP + 40;
}
// Midpoint of the plot centres (plotXY[i] + PLOT/2), i.e. the grid centre.
export function worldCentre(gridSize: number): number {
  return 40 + PLOT / 2 + ((gridSize - 1) / 2) * ROAD_GAP;
}

export type CellPlacement = {
  zone: Zone;
  col: number;
  row: number;
  /** Three world-space centre of this zone tile (Y = 0, ground). */
  cx: number;
  cz: number;
};

// zones[] holds only the DEVELOPED cells; assignZonePositions maps each
// back onto its (col,row), centre-outward — same as City3DMap.
export function placeZones(zones: Zone[], gridSize: number): CellPlacement[] {
  const positions = assignZonePositions(gridSize, zones.length);
  const XY = plotXY(gridSize);
  const c = worldCentre(gridSize);
  return positions.map((pos, i) => ({
    zone: zones[i],
    col: pos.col,
    row: pos.row,
    cx: XY[pos.col] + PLOT / 2 - c,
    cz: XY[pos.row] + PLOT / 2 - c,
  }));
}

export function emptyCells(zones: Zone[], gridSize: number): { col: number; row: number; cx: number; cz: number }[] {
  const occupied = new Set(
    assignZonePositions(gridSize, zones.length).map((p) => `${p.col},${p.row}`),
  );
  const XY = plotXY(gridSize);
  const c = worldCentre(gridSize);
  const out: { col: number; row: number; cx: number; cz: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (occupied.has(`${col},${row}`)) continue;
      out.push({ col, row, cx: XY[col] + PLOT / 2 - c, cz: XY[row] + PLOT / 2 - c });
    }
  }
  return out;
}

// ══ BUILDING DATA (ported from app/kawasan/page.tsx) ═══════════════════
// zoneBuildings() and its whole dependency chain — footprint / jitterFootprint
// / buildingHeight / ZONE_BASE / ZONE_FILLER / PROJECT_BUILDING / slotPos —
// are PORTED COPIES, byte-for-byte equivalent to the originals. This is the
// engine-agnostic "what to render per zone" layer the migration brief calls
// out as reuse-as-is; same Phase 5 note applies (extract to one shared
// module instead of copying).

export type BType =
  | "tower" | "skyscraper" | "antenna" | "shop" | "stall" | "house" | "factory"
  | "warehouse" | "school" | "clinic" | "masjid" | "mall" | "stadium" | "terminal"
  | "sawah" | "pond" | "field" | "plaza" | "kampung" | "shophouse" | "terrace"
  // civic / special facilities
  | "police" | "fire" | "hospital" | "library" | "museum" | "powerplant"
  | "zoo" | "themepark" | "riverbend";

export type BSpec = {
  type: BType; slot: number; w: number; d: number; h: number;
  icon?: string; glow?: boolean; flag?: boolean;
};

export type SeatTraits = { coastal: boolean; paddy: boolean; hilly: boolean; industrial: boolean; lake: boolean; kinabalu: boolean };
export const DEFAULT_TRAITS: SeatTraits = { coastal: false, paddy: false, hilly: false, industrial: false, lake: false, kinabalu: false };

export const FLAT_TYPES: BType[] = ["sawah", "pond", "field", "plaza"];

// slot -> top-left corner of the building footprint within the 240x240 tile.
export function slotPos(slot: number) {
  return { x: 22 + (slot % 3) * 72, y: 22 + Math.floor(slot / 3) * 72 };
}

function footprint(type: BType) {
  if (type === "tower") return { w: 40, d: 40 };
  if (type === "skyscraper") return { w: 34, d: 34 };
  if (type === "antenna") return { w: 22, d: 22 };
  if (type === "factory" || type === "warehouse") return { w: 58, d: 46 };
  if (type === "masjid") return { w: 44, d: 40 };
  if (type === "mall") return { w: 58, d: 48 };
  if (type === "stadium") return { w: 58, d: 52 };
  if (type === "terminal") return { w: 52, d: 34 };
  if (type === "stall") return { w: 40, d: 32 };
  if (type === "kampung") return { w: 42, d: 38 };
  if (type === "shophouse") return { w: 30, d: 50 };
  if (type === "terrace") return { w: 52, d: 34 };
  if (type === "police") return { w: 44, d: 38 };
  if (type === "fire") return { w: 46, d: 42 };
  if (type === "hospital") return { w: 56, d: 50 };
  if (type === "library") return { w: 48, d: 42 };
  if (type === "museum") return { w: 54, d: 44 };
  if (type === "powerplant") return { w: 60, d: 54 };
  if (type === "zoo" || type === "themepark") return { w: 58, d: 52 };
  if (FLAT_TYPES.includes(type)) return { w: 58, d: 52 };
  return { w: 48, d: 42 };
}

const SLOT_PITCH = 72;
const SLOT_GAP = 7;
function jitterFootprint(
  type: BType, zoneId: string, slot: number, density = 0,
): { w: number; d: number } {
  const base = footprint(type);
  if (FLAT_TYPES.includes(type)) return base;
  const seed = (seedFrom(zoneId) + slot * 31) % 97;
  const jw = (((seed % 7) - 3) / 3);
  const jd = (((Math.floor(seed / 7) % 7) - 3) / 3);
  const amp = (px: number) => Math.max(0.08, Math.min(0.12, (SLOT_PITCH - SLOT_GAP - px) / px));
  // Metro cores: grow footprints toward the slot pitch so buildings nearly
  // abut (KL-style street walls) instead of sitting island-like in their
  // slot. The tall setback types get an extra bump so a core tower reads
  // as a chunky ~1:5 slab, not a ~1:11 needle — the regression that made
  // items 9+10 look like a spike field. Capped at SLOT_PITCH - SLOT_GAP
  // so neighbours never overlap; the cap makes this a no-op below the
  // threshold (the ported jitter already tops out there).
  const grow = density >= METRO_DENSITY
    ? (1 + Math.min(0.32, (density - METRO_DENSITY) * 1.1)) *
      (type === "tower" || type === "skyscraper" ? 1.42 : 1)
    : 1;
  const cap = SLOT_PITCH - SLOT_GAP;
  return {
    w: Math.min(cap, Math.round(base.w * (1 + jw * amp(base.w)) * grow)),
    d: Math.min(cap, Math.round(base.d * (1 + jd * amp(base.d)) * grow)),
  };
}

export function buildingHeight(type: BType, zone: Zone) {
  if (type === "tower") return 58 + Math.round(zone.economy * 0.9);
  if (type === "skyscraper") return 150 + Math.round(zone.economy * 1.2);
  if (type === "antenna") return 120;
  if (type === "shop") return 26 + Math.round(zone.economy * 0.2);
  if (type === "stall") return 18;
  if (type === "house") return 20 + Math.round(zone.infra * 0.1);
  if (type === "factory") return 30 + Math.round(zone.economy * 0.25);
  if (type === "warehouse") return 26;
  if (type === "school") return 34 + Math.round(zone.welfare * 0.22);
  if (type === "masjid") return 24;
  if (type === "mall") return 34 + Math.round(zone.economy * 0.15);
  if (type === "stadium") return 16;
  if (type === "terminal") return 18;
  if (type === "clinic") return 32 + Math.round(zone.welfare * 0.22);
  if (type === "kampung") return 20 + Math.round(zone.welfare * 0.08);
  if (type === "shophouse") return 50 + Math.round(zone.economy * 0.35);
  if (type === "terrace") return 30 + Math.round(zone.infra * 0.15);
  if (type === "police") return 30 + Math.round(zone.welfare * 0.14);
  if (type === "fire") return 26 + Math.round(zone.infra * 0.1);
  if (type === "hospital") return 58 + Math.round(zone.welfare * 0.5);
  if (type === "library") return 34 + Math.round(zone.welfare * 0.12);
  if (type === "museum") return 30 + Math.round(zone.welfare * 0.1);
  if (type === "powerplant") return 44 + Math.round(zone.economy * 0.12);
  if (type === "zoo" || type === "themepark") return 14;
  if (type === "riverbend") return 6;
  return 0;
}

const ZONE_BASE: Record<ZoneKind, { type: BType; slot: number }[]> = {
  urban: [{ type: "tower", slot: 0 }, { type: "tower", slot: 4 }, { type: "shop", slot: 2 }, { type: "shophouse", slot: 6 }, { type: "fire", slot: 8 }],
  village: [{ type: "kampung", slot: 0 }, { type: "kampung", slot: 4 }, { type: "sawah", slot: 2 }, { type: "sawah", slot: 6 }, { type: "masjid", slot: 8 }],
  housing: [{ type: "terrace", slot: 0 }, { type: "house", slot: 2 }, { type: "terrace", slot: 4 }, { type: "house", slot: 6 }],
  commercial: [{ type: "shophouse", slot: 0 }, { type: "shop", slot: 4 }, { type: "tower", slot: 2 }, { type: "stall", slot: 6 }, { type: "museum", slot: 8 }],
  education: [{ type: "school", slot: 4 }, { type: "house", slot: 0 }, { type: "field", slot: 2 }, { type: "library", slot: 6 }],
  industry: [{ type: "factory", slot: 0 }, { type: "factory", slot: 4 }, { type: "warehouse", slot: 2 }, { type: "powerplant", slot: 6 }],
  river: [{ type: "pond", slot: 0 }, { type: "kampung", slot: 4 }, { type: "sawah", slot: 6 }],
  market: [{ type: "stall", slot: 0 }, { type: "stall", slot: 2 }, { type: "shophouse", slot: 4 }, { type: "stall", slot: 6 }],
  community: [{ type: "clinic", slot: 4 }, { type: "kampung", slot: 0 }, { type: "hospital", slot: 2 }, { type: "masjid", slot: 6 }, { type: "police", slot: 8 }],
};

const PROJECT_BUILDING: Record<string, BType> = {
  road: "plaza", clinic: "clinic", internet: "antenna", flood: "pond", market: "stall",
  school: "school", park: "field", bus: "terminal", mall: "mall", stadium: "stadium",
  surau: "masjid", office: "tower",
};

const PROJECT_ICON: Record<string, string> = {
  road: "🛣️", clinic: "🏥", internet: "📡", flood: "🌊", market: "🏪", school: "🏫",
  park: "🌳", bus: "🚌", mall: "🏬", stadium: "🏟️", surau: "🕌", office: "🏢",
};

const ZONE_FILLER: Record<ZoneKind, BType[]> = {
  urban: ["tower", "shophouse", "shop", "house", "museum", "police"],
  village: ["kampung", "sawah"],
  housing: ["terrace", "house", "shop", "police"],
  commercial: ["shophouse", "shop", "stall", "tower", "police"],
  education: ["house", "field", "library"],
  industry: ["warehouse", "factory", "powerplant"],
  river: ["kampung", "pond"],
  market: ["stall", "shophouse", "shop"],
  community: ["kampung", "house", "clinic", "police", "hospital"],
};

// Low-rise types a metro core rebuilds as high-rise. Civic / industrial /
// ground-cover types (masjid, school, clinic, factory, sawah, …) are left
// alone — a CBD still has those.
const CORE_LOWRISE = new Set<BType>(["house", "terrace", "kampung", "shop", "stall"]);

// `coreness` is 0 at the grid edge, 1 dead centre (CityScene passes it per
// cell). At/above METRO_DENSITY it drives how tall a zone builds: central
// cells rebuild low-rise as towers and stack extra skyscrapers, tapering
// to near-original height at the perimeter — a KL-style CBD-to-suburb
// gradient rather than a flat field of mid-rise boxes.
export function zoneBuildings(
  zone: Zone, density: number, traits: SeatTraits, coreness = 0,
): BSpec[] {
  const metroCore = density >= METRO_DENSITY;
  const hi = metroCore ? Math.min(1, Math.max(0, coreness) * 1.15) : 0;
  const zseed = seedFrom(zone.id);

  // Deterministic per-(zone, slot) upgrade of a low-rise type. Kept
  // deliberately partial even dead-centre so the core still has a mix of
  // gabled low-rise + shophouses + towers (silhouette variety), not a
  // monoculture of towers.
  const upgrade = (type: BType, slot: number): BType => {
    if (!metroCore || !CORE_LOWRISE.has(type)) return type;
    const r = ((zseed + slot * 53) % 100) / 100; // stable 0..1
    if (r < hi * 0.68) return "tower";
    if (r < 0.32 + hi * 0.3) return "shophouse";
    return type;
  };
  // Height lift for the vertical types, strongest at the centre — gentle
  // enough that a core tower stays a believable slab (item 10 shipped
  // x1.55, which read as needles once every slot was packed with one).
  const lift = (type: BType, h: number): number =>
    type === "tower" || type === "skyscraper" ? Math.round(h * (1 + hi * 0.3)) : h;
  const spec = (type: BType, slot: number, extra?: Partial<BSpec>): BSpec => {
    const t = upgrade(type, slot);
    return { type: t, slot, ...jitterFootprint(t, zone.id, slot, density), h: lift(t, buildingHeight(t, zone)), ...extra };
  };

  // A river zone's pond is its whole reason for being "Riverside" — at
  // the standard FLAT_TYPES footprint (58x52, same as any decorative
  // pond) it reads as a puddle lost in a 240x240 tile, especially once
  // metro-core crowding (see skyscraperCount below) packs the rest of
  // the slots. Give it a real waterway-sized footprint instead.
  const base: BSpec[] = ZONE_BASE[zone.kind].map(({ type, slot }, index) => {
    const extra: Partial<BSpec> = { flag: zone.kind === "urban" && index === 0 };
    if (zone.kind === "river" && type === "pond") { extra.w = 112; extra.d = 86; }
    return spec(type, slot, extra);
  });
  const used = new Set(base.map((b) => b.slot));
  // The enlarged river pond (112x86, vs. the 72-unit slot pitch) spills
  // into slot 1 (to its right) and slot 3 (below it) — reserve both so
  // nothing else gets placed there and clips through it.
  if (zone.kind === "river") { used.add(1); used.add(3); }
  const free = [1, 3, 5, 7, 8, 6, 2, 0].filter((slot) => !used.has(slot));
  const fillers: BType[] = traits.paddy && (zone.kind === "village" || zone.kind === "river")
    ? ["sawah", "sawah", "house"]
    : ZONE_FILLER[zone.kind];
  const seed = zseed;
  // Metro cores stack a real cluster of high-rises; below the metro
  // threshold this is exactly the ported original (urban only, 0-2).
  // At/above it, ANY zone near the centre gets a skyscraper or two —
  // high-rise residential included — with the CBD kinds getting the most.
  const skyscraperCount = !metroCore
    ? (zone.kind === "urban"
        ? Math.max(0, Math.min(2, Math.round((density - 0.5) * 4)))
        : zone.kind === "commercial" && density >= 0.8 ? 1 : 0)
    : zone.kind === "urban"
      ? Math.min(6, 2 + Math.round(hi * 3 + (density - METRO_DENSITY) * 5))
      : zone.kind === "commercial" || zone.kind === "market"
        ? (hi > 0.4 ? 3 : 1)
        : zone.kind === "industry"
          ? (hi > 0.6 ? 1 : 0)
          // river: never — a glass tower dropped on the same tile as the
          // pond buries the one thing that makes this a "Riverside" zone,
          // even at the Dense Metro core.
          : zone.kind === "river"
            ? 0
            : Math.round(hi * 1.6); // housing / village / education / community
  // `reserve` is the count of free slots held back after skyscrapers +
  // extras. Non-metro keeps the ported original's 2; metro cores keep 0
  // (fill everything) or 1 when the zone has a facility to place.
  const reserve = metroCore ? (zone.projects.length ? 1 : 0) : 2;
  const skyscrapers: BSpec[] = Array.from(
    { length: Math.min(skyscraperCount, Math.max(0, free.length - reserve)) },
    () => spec("skyscraper", free.pop() as number),
  );
  const extraBoost = (traits.industrial && zone.kind === "industry") || (traits.paddy && zone.kind === "village") ? 2 : 0;
  const extraCount = Math.min(
    metroCore ? free.length : Math.round(density * 3) + extraBoost,
    Math.max(0, free.length - reserve),
  );
  const extras: BSpec[] = Array.from({ length: extraCount }, (_, index) =>
    spec(fillers[(seed + index) % fillers.length], free.pop() as number),
  );
  const facilities: BSpec[] = zone.projects.map((projectId, index) => {
    const type = PROJECT_BUILDING[projectId] ?? "plaza";
    const slot = free[index % free.length];
    return {
      type, slot, ...jitterFootprint(type, zone.id, slot, density), h: buildingHeight(type, zone),
      icon: PROJECT_ICON[projectId], glow: true,
    };
  });
  return [...base, ...skyscrapers, ...extras, ...facilities];
}

// ── BType -> GLB model path(s) (parallel to BUILDING_COLOR / PALETTES) ──
// Phase A: drop CC0/licensed low-poly GLBs at these paths under public/ to
// upgrade a type from a coloured box to a real model. Missing files fall
// back to the Phase B box automatically (see useModelAvailability), so
// models can be added one at a time. FLAT_TYPES stay as ground planes.
//
// Each entry is a NAMING CONVENTION, not a literal file list: index 0 is
// `${type}.glb`, index N (N>=1) is `${type}-${N + 1}.glb` (so a 2nd variant
// of "house" is `house-2.glb`, a 3rd is `house-3.glb`, ...). This lets a
// handful of the most-repeated types (a dense grid instances "house" and
// "terrace" hundreds of times) carry visual variety instead of every
// instance being a stamped clone. Variant COUNT per type is capped here at
// a sane ceiling; actual availability still comes from manifest.json (see
// useModelAvailability in models.tsx) — an unlisted variant simply isn't
// tried, no 404s. Types with no variety need are left at a 1-entry array.
export const MODEL_VARIANT_COUNT: Partial<Record<BType, number>> = {
  house: 3,
  terrace: 3,
  kampung: 2,
  shophouse: 2,
  shop: 2,
  stall: 2,
  tower: 2,
  skyscraper: 2,
};

function variantPaths(type: BType, count: number): string[] {
  return Array.from({ length: count }, (_, i) => (i === 0 ? `/models/${type}.glb` : `/models/${type}-${i + 1}.glb`));
}

// Deterministic string hash -> variant index. Same key always resolves to
// the same variant, so a re-render / re-layout never makes a building
// "flicker" between skins; used to pick both which GLB variant an instance
// gets (models.tsx) and, since InstancedMesh needs one geometry per mesh,
// which (type, variant) instancing group it belongs to (CityScene.tsx).
export function pickVariantIndex(key: string, variantCount: number): number {
  if (variantCount <= 1) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (h >>> 0) % variantCount;
}

export const MODEL_MAP: Partial<Record<BType, string[]>> = Object.fromEntries(
  ([
    "house", "terrace", "kampung", "shophouse", "shop", "stall", "tower",
    "skyscraper", "antenna", "factory", "warehouse", "school", "clinic",
    "masjid", "mall", "stadium", "terminal",
  ] as BType[]).map((type) => [type, variantPaths(type, MODEL_VARIANT_COUNT[type] ?? 1)]),
) as Partial<Record<BType, string[]>>;

// Types worth useGLTF.preload()-ing: the ones that repeat most across a
// dense grid, so they never pop in mid-pan.
export const COMMON_MODEL_TYPES: BType[] = [
  "house", "terrace", "shop", "stall", "kampung", "shophouse", "tower",
];

// ── BType -> flat box colour ──────────────────────────────────────────
// Muted architectural tones — real concrete / glass / render / brick,
// desaturated ~50% from the old near-neon palette so the city reads as a
// place rather than a toy. Hue identity is kept so types are still
// distinguishable (glassy blue-greys for the office towers, warm renders
// for housing, greys for civic/industrial). sawah / field stay natural
// crop greens; pond stays water. Used for the box fallback and as the
// procedural / large-building shell colour.
// ── realistic material palette (from the "City Realism" design canvas) ──
// Real surfaces: plaster, concrete, zinc, glass, terracotta, timber.
// Near-greyscale — nothing above ~0.06 chroma. The one warm accent
// (terracotta tile) lives on the gable roofs, applied in procedural.tsx.
export const BUILDING_COLOR: Record<BType, string> = {
  tower: "#7f97a3", skyscraper: "#56707e", antenna: "#aeb4b8",
  shop: "#dcd2be", stall: "#ded7c6", house: "#e0d3b6",
  factory: "#9aa0a6", warehouse: "#7f858b", school: "#c4cfc2",
  clinic: "#d8dcd9", masjid: "#dcd2be", mall: "#9fb1bb",
  stadium: "#c2b8a6", terminal: "#9b9182", sawah: "#8b9b53",
  pond: "#5d7c84", field: "#78895a", plaza: "#a8a49a",
  kampung: "#b89a7c", shophouse: "#d8bfae", terrace: "#c9b79c",
  // civic / special — a bit more colour-coded so they read at a glance
  police: "#5c6b86", fire: "#a83f34", hospital: "#e4ebe6",
  library: "#c3b48f", museum: "#cabfa4", powerplant: "#6b6f78",
  zoo: "#6f9440", themepark: "#9a5ba8", riverbend: "#4a7a6a",
};

// ── camera model (ported interaction contract from app/kawasan/page.tsx) ─
// cam.rz  = azimuth  (CSS rotateZ)  default 45, clamp 5..85
// cam.rx  = polar    (CSS rotateX tilt: 0 = top-down, 90 = horizon)
//                                    default 57, clamp 42..72
// cam.zoom = post-projection scale (CSS scale())
//                                    default 0.9, clamp 0.55..1.7
// drag:  rz -= dx * 0.25 ; rx += dy * 0.18   (from pointerdown anchor)
// wheel: zoom *= (deltaY > 0 ? 0.92 : 1.08)  per event
// +/- buttons: zoom *= 1.15 / 0.87 ; R: reset to CAM_DEFAULT + fit-zoom
// A drag that moves > 6px suppresses the click that would select a zone.
export const CAM_DEFAULT = { rz: 45, rx: 57, zoom: 1 };
export const CAM_CLAMP = {
  // rz (azimuth) is NOT clamped — the camera orbits a full 360° and rz
  // wraps in clampCam(). Kept here as a full-turn range for any caller
  // that still reads the tuple.
  rz: [0, 360] as const,
  rx: [42, 72] as const,
  // `zoom` is now a DISTANCE multiplier: the camera's orbit radius is
  // `baseDistance / zoom` (see CameraRig), so higher zoom = physically
  // closer, with real perspective. These are loose guard rails — the true
  // limit is the effective-distance clamp [CAM_MIN_DISTANCE ..
  // baseDistance × CAM_MAX_OUT] applied in CameraRig each frame.
  zoom: [0.4, 120] as const,
};
// Absolute closest the camera may orbit, in world units — a street-level
// floor that every density preset can reach (PLOT is 240), so Dense Metro
// zooms in exactly as close as Rural despite its far bigger footprint.
export const CAM_MIN_DISTANCE = 260;
// Furthest out, as a multiple of the preset's base framing distance —
// only ~12% past the default whole-city framing, so max zoom-out keeps the
// city large and recognisable instead of shrinking to a distant speck.
// (Must be > 1, or the default view itself gets clamped inward.)
export const CAM_MAX_OUT = 1.12;
export const DRAG_RZ_PER_PX = 0.25;
export const DRAG_RX_PER_PX = 0.18;
// Per-notch / per-click zoom factors. Larger than the old 1.08/1.15 so
// the much wider distance range (far framing → street level) is only a
// few scrolls apart.
export const WHEEL_IN = 1.14;
export const WHEEL_OUT = 0.88;
export const BTN_ZOOM_IN = 1.28;
export const BTN_ZOOM_OUT = 0.78;
export const DRAG_CLICK_SUPPRESS_PX = 6;

// ── depth-buffer precision ────────────────────────────────────────────
// A standard (non-logarithmic) depth buffer concentrates almost all of
// its precision right in front of the near plane; a fixed `near: 0.5`
// against a `far` in the tens of thousands (needed to fit the sky dome /
// background ground sheet) is an 80,000:1+ ratio, which starves the
// depth buffer of precision everywhere the actual city geometry sits —
// invisible when zoomed in close (the camera + geometry are both near
// the lens, well inside the precise region), but at max zoom-out the
// near-coplanar road/tile/building-base surfaces land in the coarse tail
// of the range and z-fight into a "torn" mess. Fix: `near` tracks the
// camera's LIVE orbit radius (CameraRig) instead of staying pinned at
// 0.5 — when zoomed far out nothing is close to the lens anyway, so
// pushing `near` out with it reclaims precision for the range that
// actually matters at that zoom level.
export const CAM_NEAR_MIN = 0.5;
export const CAM_NEAR_K = 0.028;
// Far clip plane: must clear the biggest background element (see
// CityEnvironment's span*8 perimeter ground sheet in scenery.tsx) as
// seen from the camera at max zoom-out — that sheet's far edge, in the
// direction the camera looks (through the origin), sits at roughly
// (max orbit radius) + (sheet's own half-extent, span*4) from the
// camera. `+4.4` leaves a margin past that.
export function farPlaneFor(span: number): number {
  return span * (CAM_MAX_OUT + 4.4);
}

// Responsive fit-zoom: narrower viewports frame a touch further out.
// zoom is a distance multiplier now (baseDistance / zoom), so < 1 = out.
export function fitZoom(widthPx: number): number {
  return widthPx < 700 ? 0.62 : widthPx < 900 ? 0.74 : widthPx < 1150 ? 0.88 : CAM_DEFAULT.zoom;
}

export function clampCam(c: { rz: number; rx: number; zoom: number }) {
  // azimuth wraps — full 360° free orbit, no hard stop at a "front"
  c.rz = ((c.rz % 360) + 360) % 360;
  c.rx = Math.max(CAM_CLAMP.rx[0], Math.min(CAM_CLAMP.rx[1], c.rx));
  c.zoom = Math.max(CAM_CLAMP.zoom[0], Math.min(CAM_CLAMP.zoom[1], c.zoom));
  return c;
}

// ── time-of-day (ported from app/kawasan/page.tsx) ───────────────────
export const TOD_SEQUENCE = ["day", "dusk", "night"] as const;
export type Tod = (typeof TOD_SEQUENCE)[number];
export const TOD_ICON: Record<Tod, string> = { day: "☀", dusk: "🌆", night: "🌙" };
// Real-clock -> tod, same thresholds as the CSS version (roughly Malaysia's
// ~7am sunrise / ~7pm sunset with a one-hour dusk window after).
export function todFromClientHour(hour: number): Tod {
  if (hour >= 7 && hour < 19) return "day";
  if (hour >= 19 && hour < 20) return "dusk";
  return "night";
}

// Real-clock -> traffic density 0..1. Piecewise-linear over the 24h day:
// weekday has two sharp rush spikes (≈08:00 and ≈18:00), weekend is a
// gentle undulation with no rush. Drives active-car count + speed/gap in
// scenery.tsx's <Traffic> (and LRT train frequency). Recomputed every
// ~30s by City3DMapGL, or overridden by the manual Traffic button.
export function trafficProfile(now: Date): number {
  const h = now.getHours() + now.getMinutes() / 60;
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const pts: [number, number][] = weekend
    ? [[0, 0.14], [5, 0.14], [8, 0.30], [12, 0.55], [15, 0.60], [18, 0.62], [21, 0.50], [23, 0.32], [24, 0.14]]
    : [[0, 0.08], [5, 0.08], [6.5, 0.50], [8, 1.0], [9.5, 0.60], [11, 0.55], [13, 0.50], [15, 0.55], [17, 0.85], [18, 1.0], [19.5, 0.55], [21, 0.42], [23, 0.20], [24, 0.08]];
  for (let i = 1; i < pts.length; i++) {
    if (h <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (h - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

// 3D environment per tod. Reference: app/globals.css .kw-scene[data-tod=...]
// --kw-sky / --kw-lit (window lights) / --kw-lamp (street lamps) / --kw-fog.
// `sun` is a unit direction FROM the origin toward the light; the rig
// multiplies it by the world span. `lamp`/`winLit` are 0..1 gates.
export type TodEnv = {
  skyTop: string;
  skyBottom: string;
  sun: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  ground: string;  // --kw-ground: the perimeter ground sheet colour
  lamp: number;    // --kw-lamp: street-lamp brightness
  winLit: number;  // --kw-lit: lit-window emissive gate
  stars: number;
};
export const TOD_ENV: Record<Tod, TodEnv> = {
  // clear blue midday, sun high in the east; no lamps, no lit windows.
  // Colours + intensities from REAL_OVERRIDE.day (design canvas): softer
  // hazy sky, warmer sun, a bright olive ground sheet instead of near-black.
  day: {
    skyTop: "#5d8fb8", skyBottom: "#e6ecec",
    sun: [0.35, 0.92, 0.2], sunColor: "#fff2dc", sunIntensity: 2.5,
    ambientColor: "#c3cfd6", ambientIntensity: 0.5,
    hemiSky: "#dceaf2", hemiGround: "#8f8a6c", hemiIntensity: 0.95,
    fog: "#eef3f4", ground: "#7e8461", lamp: 0, winLit: 0, stars: 0,
  },
  // purple-to-amber sunset, low sun in the west; lamps + windows ~half on.
  // REAL_OVERRIDE.dusk keeps the warm sun colour, lifts the ground.
  dusk: {
    skyTop: "#3a3358", skyBottom: "#eab473",
    sun: [-0.86, 0.17, -0.18], sunColor: "#ff9d55", sunIntensity: 1.7,
    ambientColor: "#5c4a66", ambientIntensity: 0.5,
    hemiSky: "#8f7590", hemiGround: "#5b4a38", hemiIntensity: 0.7,
    fog: "#e4b57f", ground: "#4d4a38", lamp: 0.55, winLit: 0.6, stars: 0.35,
  },
  // deep blue night, moon mid-high; lamps + windows full on, stars out.
  // REAL_OVERRIDE.night: a touch more sky/hemi lift so massing stays read.
  night: {
    skyTop: "#050a16", skyBottom: "#1d2c48",
    sun: [0.3, 0.78, -0.4], sunColor: "#aec4e6", sunIntensity: 0.7,
    ambientColor: "#2a3b57", ambientIntensity: 0.5,
    hemiSky: "#3d557d", hemiGround: "#1a231c", hemiIntensity: 0.65,
    fog: "#243553", ground: "#22261c", lamp: 0.9, winLit: 1, stars: 1,
  },
};

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
  urban: "Pusat Bandar", village: "Kampung", housing: "Taman Perumahan",
  commercial: "Pusat Komersial", education: "Zon Sekolah", industry: "Kawasan Industri",
  river: "Tebing Sungai", market: "Pasar / Penjaja", community: "Dewan / Klinik",
};
