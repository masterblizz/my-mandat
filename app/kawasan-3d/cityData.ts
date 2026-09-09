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
  if (density >= 0.85) return 12; // dense metro
  if (density >= 0.62) return 10; // metro
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
  return Math.max(minDeveloped, Math.min(total, Math.round(Math.max(linear, packed))));
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
  | "sawah" | "pond" | "field" | "plaza" | "kampung" | "shophouse" | "terrace";

export type BSpec = {
  type: BType; slot: number; w: number; d: number; h: number;
  icon?: string; glow?: boolean; flag?: boolean;
};

export type SeatTraits = { coastal: boolean; paddy: boolean; hilly: boolean; industrial: boolean };
export const DEFAULT_TRAITS: SeatTraits = { coastal: false, paddy: false, hilly: false, industrial: false };

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
  // Metro cores: grow footprints toward the slot pitch so towers nearly
  // abut (KL-style street walls) instead of sitting island-like in their
  // slot. Capped at SLOT_PITCH - SLOT_GAP so neighbours never overlap.
  const grow = density >= METRO_DENSITY ? 1 + Math.min(0.32, (density - METRO_DENSITY) * 1.1) : 1;
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
  return 0;
}

const ZONE_BASE: Record<ZoneKind, { type: BType; slot: number }[]> = {
  urban: [{ type: "tower", slot: 0 }, { type: "tower", slot: 4 }, { type: "shop", slot: 2 }, { type: "shophouse", slot: 6 }],
  village: [{ type: "kampung", slot: 0 }, { type: "kampung", slot: 4 }, { type: "sawah", slot: 2 }, { type: "sawah", slot: 6 }, { type: "masjid", slot: 8 }],
  housing: [{ type: "terrace", slot: 0 }, { type: "house", slot: 2 }, { type: "terrace", slot: 4 }, { type: "house", slot: 6 }],
  commercial: [{ type: "shophouse", slot: 0 }, { type: "shop", slot: 4 }, { type: "tower", slot: 2 }, { type: "stall", slot: 6 }],
  education: [{ type: "school", slot: 4 }, { type: "house", slot: 0 }, { type: "field", slot: 2 }],
  industry: [{ type: "factory", slot: 0 }, { type: "factory", slot: 4 }, { type: "warehouse", slot: 2 }],
  river: [{ type: "pond", slot: 0 }, { type: "kampung", slot: 4 }, { type: "sawah", slot: 6 }],
  market: [{ type: "stall", slot: 0 }, { type: "stall", slot: 2 }, { type: "shophouse", slot: 4 }, { type: "stall", slot: 6 }],
  community: [{ type: "clinic", slot: 4 }, { type: "kampung", slot: 0 }, { type: "house", slot: 2 }, { type: "masjid", slot: 6 }],
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
  urban: ["tower", "shophouse", "shop", "house"],
  village: ["kampung", "sawah"],
  housing: ["terrace", "house", "shop"],
  commercial: ["shophouse", "shop", "stall", "tower"],
  education: ["house", "field"],
  industry: ["warehouse", "factory"],
  river: ["kampung", "pond"],
  market: ["stall", "shophouse", "shop"],
  community: ["kampung", "house", "clinic"],
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

  // Deterministic per-(zone, slot) upgrade of a low-rise type.
  const upgrade = (type: BType, slot: number): BType => {
    if (!metroCore || !CORE_LOWRISE.has(type)) return type;
    const r = ((zseed + slot * 53) % 100) / 100; // stable 0..1
    if (r < hi * 0.72) return "tower";
    if (r < 0.3 + hi * 0.45) return "shophouse";
    return type;
  };
  // Height lift for the vertical types, strongest at the centre.
  const lift = (type: BType, h: number): number =>
    type === "tower" || type === "skyscraper" ? Math.round(h * (1 + hi * 0.55)) : h;
  const spec = (type: BType, slot: number, extra?: Partial<BSpec>): BSpec => {
    const t = upgrade(type, slot);
    return { type: t, slot, ...jitterFootprint(t, zone.id, slot, density), h: lift(t, buildingHeight(t, zone)), ...extra };
  };

  const base: BSpec[] = ZONE_BASE[zone.kind].map(({ type, slot }, index) =>
    spec(type, slot, { flag: zone.kind === "urban" && index === 0 }),
  );
  const used = new Set(base.map((b) => b.slot));
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
      ? Math.min(5, 2 + Math.round(hi * 2 + (density - METRO_DENSITY) * 6))
      : zone.kind === "commercial" || zone.kind === "market"
        ? (hi > 0.4 ? 2 : 1)
        : zone.kind === "industry"
          ? 0
          : Math.round(hi * 1.6); // housing / village / education / community / river
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

// ── BType -> flat box colour (parallel to PALETTES) ────────────────────
// One representative solid colour per type, sampled from that type's
// PALETTES gradient. Used as the graceful fallback when a model is absent.
export const BUILDING_COLOR: Record<BType, string> = {
  tower: "#22d3ee", skyscraper: "#6366f1", antenna: "#a855f7",
  shop: "#f59e0b", stall: "#fb923c", house: "#e0673f",
  factory: "#64748b", warehouse: "#78716c", school: "#3b82f6",
  clinic: "#10b981", masjid: "#d6d3d1", mall: "#db2777",
  stadium: "#3fbf6b", terminal: "#fb923c", sawah: "#65a30d",
  pond: "#0ea5e9", field: "#4d7c0f", plaza: "#475569",
  kampung: "#b45309", shophouse: "#8fd0c4", terrace: "#b8a37e",
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
export const CAM_DEFAULT = { rz: 45, rx: 57, zoom: 0.9 };
export const CAM_CLAMP = {
  rz: [5, 85] as const,
  rx: [42, 72] as const,
  zoom: [0.55, 1.7] as const,
};
export const DRAG_RZ_PER_PX = 0.25;
export const DRAG_RX_PER_PX = 0.18;
export const WHEEL_IN = 1.08;
export const WHEEL_OUT = 0.92;
export const BTN_ZOOM_IN = 1.15;
export const BTN_ZOOM_OUT = 0.87;
export const DRAG_CLICK_SUPPRESS_PX = 6;

// Responsive fit-zoom (ported: width<700 -> 0.55, <900 -> 0.66, <1150 ->
// 0.76, else 0.9). Used on mount and by the R (reset) button.
export function fitZoom(widthPx: number): number {
  return widthPx < 700 ? 0.55 : widthPx < 900 ? 0.66 : widthPx < 1150 ? 0.76 : CAM_DEFAULT.zoom;
}

export function clampCam(c: { rz: number; rx: number; zoom: number }) {
  c.rz = Math.max(CAM_CLAMP.rz[0], Math.min(CAM_CLAMP.rz[1], c.rz));
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
  // clear blue midday, sun high in the east; no lamps, no lit windows
  day: {
    skyTop: "#3f79a6", skyBottom: "#dfeef6",
    sun: [0.35, 0.92, 0.2], sunColor: "#fff3d8", sunIntensity: 2.3,
    ambientColor: "#9fb7cc", ambientIntensity: 0.5,
    hemiSky: "#bcd6ec", hemiGround: "#6a7358", hemiIntensity: 0.55,
    fog: "#cfe1ec", ground: "#2b3f30", lamp: 0, winLit: 0, stars: 0,
  },
  // purple-to-amber sunset, low sun in the west; lamps + windows ~half on
  dusk: {
    skyTop: "#241f4a", skyBottom: "#e2a765",
    sun: [-0.86, 0.17, -0.18], sunColor: "#ff9d55", sunIntensity: 1.5,
    ambientColor: "#5c4a66", ambientIntensity: 0.5,
    hemiSky: "#7c6180", hemiGround: "#46372b", hemiIntensity: 0.5,
    fog: "#d29c66", ground: "#1a2a20", lamp: 0.55, winLit: 0.6, stars: 0.35,
  },
  // deep blue night, moon mid-high; lamps + windows full on, stars out
  night: {
    skyTop: "#01030a", skyBottom: "#16233d",
    sun: [0.3, 0.78, -0.4], sunColor: "#aec4e6", sunIntensity: 0.55,
    ambientColor: "#2a3b57", ambientIntensity: 0.5,
    hemiSky: "#33496e", hemiGround: "#101c16", hemiIntensity: 0.5,
    fog: "#1c2c4a", ground: "#0c150f", lamp: 0.9, winLit: 1, stars: 1,
  },
};

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
  urban: "Pusat Bandar", village: "Kampung", housing: "Taman Perumahan",
  commercial: "Pusat Komersial", education: "Zon Sekolah", industry: "Kawasan Industri",
  river: "Tebing Sungai", market: "Pasar / Penjaja", community: "Dewan / Klinik",
};
