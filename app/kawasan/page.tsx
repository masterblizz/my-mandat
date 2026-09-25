"use client";

import { CSSProperties, MutableRefObject, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import JourneyPanel from "../components/career/JourneyPanel";
import CityOnboarding from "./CityOnboarding";
import CityDestinations, { type CityDestination } from "./CityDestinations";
import OfficeInterior, { type OfficeInteriorKind } from "./OfficeInterior";
import PersonalAssistant from "../components/assistant/PersonalAssistant";
import { resumeRoute } from "../store/journey";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t, type Lang } from "../i18n/useLang";
import { generateConstituencies } from "../data/constituencies";
import { formatNumber } from "../utils/format";
import type { Operation } from "../store/gameStore";


// ── 3D city map: WebGL cutover ────────────────────────────────────────
// The live map is now <City3DMapGL> (app/kawasan-3d/City3DMapGL.tsx), the
// Phase-5 React-Three-Fiber rewrite. It has a byte-identical prop
// signature to the old CSS-3D <City3DMap> below (same Zone/SeatTraits
// shape, same selectedZoneId contract), so nothing else on this page
// changed — the manifesto / campaign / zone-info / lock panels all still
// read off selectedZoneId.
//
// It renders a <Canvas>, so it must be loaded browser-only via
// next/dynamic({ ssr: false }); that also code-splits three.js/R3F off
// this route's first load.
//
// ROLLBACK: flip USE_GL_MAP to false — the old <City3DMap> (defined
// further down, lines ~1570-2465) is still compiled and wired to the
// `false` branch at the render site, so this is a one-line revert. It can
// also be forced off per-session with ?glmap=0 in the URL.
const City3DMapGL = dynamic(() => import("../kawasan-3d/City3DMapGL"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "clamp(520px, 74vh, 760px)",
        borderRadius: 12,
        border: "1px solid rgb(186 230 253 / 0.28)",
        background: "rgb(2 6 23 / 0.55)",
      }}
    />
  ),
});
const USE_GL_MAP = true;

// Same quick-campaign templates as /campaign's deploy modal, kept local so a
// player can launch a home-seat push without leaving the kawasan screen.
type OpType = Operation["type"];
const OP_TEMPLATES: Record<OpType, { manpowerCost: number; fundsCost: number; supportGain: number }> = {
  ceramah:        { manpowerCost: 100, fundsCost: 120000, supportGain: 2.5 },
  "door-to-door": { manpowerCost: 80,  fundsCost: 40000,  supportGain: 1.2 },
  youth:          { manpowerCost: 50,  fundsCost: 30000,  supportGain: 1.8 },
  digital:        { manpowerCost: 20,  fundsCost: 150000, supportGain: 1.0 },
  rural:          { manpowerCost: 90,  fundsCost: 60000,  supportGain: 1.4 },
};

type ZoneKind = "urban" | "village" | "housing" | "commercial" | "education" | "industry" | "river" | "market" | "community";

// Zone display names/types live in app/i18n/strings/kawasan_page.ts under
// zoneName_<archetype> / zoneType_<archetype>.
type ZoneArchetype =
  | "townCentre" | "mainVillage" | "housingEstate" | "commercialHub" | "schoolZone"
  | "industrialArea" | "riverside" | "marketHawkers" | "clinicHall"
  | "fishingVillage" | "paddyVillage" | "industrialEstate";

type Zone = {
  id: string;
  archetype: ZoneArchetype;
  // >0 when the archetype was cycled a second/third time; rendered as a numeric suffix.
  repeat: number;
  kind: ZoneKind;
  economy: number;
  welfare: number;
  infra: number;
  sentiment: number;
  projects: string[];
};

type ZoneStat = "infra" | "welfare" | "economy";

// Light progression gate: a project stays locked until its prerequisite
// project is built in the same zone and/or that zone's stat clears a bar.
type Requirement = { projectId?: string; zoneStat?: { key: ZoneStat; min: number } };

type Project = {
  id: string;
  cost: number;
  target: ZoneStat;
  boost: number;
  icon: string;
  requires?: Requirement;
};

const PROJECTS: Project[] = [
  { id: "road", icon: "🛣️", cost: 180_000, target: "infra", boost: 12 },
  { id: "clinic", icon: "🏥", cost: 220_000, target: "welfare", boost: 14 },
  { id: "internet", icon: "📡", cost: 260_000, target: "economy", boost: 13 },
  { id: "flood", icon: "🌊", cost: 300_000, target: "infra", boost: 16 },
  { id: "market", icon: "🏪", cost: 150_000, target: "economy", boost: 10 },
  { id: "school", icon: "🏫", cost: 200_000, target: "welfare", boost: 11 },
  { id: "park", icon: "🌳", cost: 170_000, target: "welfare", boost: 9, requires: { zoneStat: { key: "infra", min: 55 } } },
  { id: "bus", icon: "🚌", cost: 240_000, target: "infra", boost: 13, requires: { projectId: "road" } },
  { id: "mall", icon: "🏬", cost: 400_000, target: "economy", boost: 18, requires: { projectId: "market", zoneStat: { key: "economy", min: 60 } } },
  { id: "stadium", icon: "🏟️", cost: 350_000, target: "welfare", boost: 15, requires: { projectId: "school" } },
  { id: "surau", icon: "🕌", cost: 160_000, target: "welfare", boost: 9 },
  { id: "office", icon: "🏢", cost: 450_000, target: "economy", boost: 20, requires: { projectId: "internet" } },
  { id: "demolish", icon: "🚜", cost: 200_000, target: "infra", boost: 13 },
  { id: "hotel", icon: "🏨", cost: 380_000, target: "economy", boost: 17, requires: { zoneStat: { key: "economy", min: 50 } } },
  { id: "police", icon: "🚓", cost: 210_000, target: "welfare", boost: 11 },
  { id: "firestation", icon: "🚒", cost: 195_000, target: "infra", boost: 10 },
  { id: "library", icon: "📚", cost: 175_000, target: "welfare", boost: 10, requires: { projectId: "school" } },
  { id: "museum", icon: "🏛️", cost: 320_000, target: "economy", boost: 14, requires: { projectId: "mall" } },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

// Real-constituency character, derived from the seat's actual name and
// state so the generated city echoes the real kawasan: coastal seats get
// a seafront, rice-bowl seats get paddies, highland seats get hills.
type SeatTraits = { coastal: boolean; paddy: boolean; hilly: boolean; industrial: boolean; lake: boolean; kinabalu: boolean };

// "bukit" ("hill") appears in plenty of fully urban seat names too (Bukit
// Bintang, Bukit Gelugor, Bukit Mertajam...) — a blanket substring match
// was giving downtown KL a mountain backdrop. Only these two seats are
// real hill-backdrop terrain despite the "Bukit" name; every other hilly
// match below is a genuine highland/interior district name, not a prefix.
const HILLY_BUKIT_EXCEPTIONS = ["bukit bendera", "bukit antarabangsa"];

// Exact-name match (not substring — "bera" alone would also catch
// "Berapit"/"Seberang Jaya", "sik" would catch "Kemasik"/"Sikamat", and
// "gerik" would catch "Kota Anggerik"): real seats built around a named
// recreational or dam lake. Hulu Terengganu → Tasik Kenyir; Bera → Tasik
// Bera; Chini → Tasik Chini; Putrajaya → the lake itself; Gerik → Tasik
// Temenggor; Bagan Serai → Tasik Bukit Merah / Bukit Merah Laketown;
// Kajang → Tasik Kajang / Tasik Cempaka (Bandar Baru Bangi); Shah Alam →
// Taman Tasik Shah Alam; Batang Ai → the Batang Ai dam lake, Sarawak;
// Sik / Pedu → Tasik Pedu, Kedah.
const LAKE_SEATS = new Set([
  "hulu terengganu", "bera", "chini", "putrajaya", "gerik",
  "bagan serai", "kajang", "shah alam", "batang ai", "sik", "pedu",
]);

// Mount Kinabalu itself — not a generic hilly district, one specific,
// unmistakable granite peak (South-East Asia's tallest). Kota Kinabalu is
// the city named after it and where it's the skyline backdrop in every
// tourism shot; Ranau/Kundasang (also `hilly`, generic rolling terrain)
// are the district the mountain actually stands in.
const KINABALU_SEATS = new Set(["kota kinabalu", "ranau", "kundasang"]);

function deriveSeatTraits(seatName: string, stateId: string): SeatTraits {
  const name = seatName.toLowerCase();
  const has = (...words: string[]) => words.some((word) => name.includes(word));
  return {
    coastal: has("pantai", "teluk", "tanjung", "kuala", "pelabuhan", "port", "langkawi", "mersing", "pengerang", "sabak", "labuan", "sandakan", "tawau", "kudat", "semporna", "miri", "bintulu", "santubong", "bagan", "kepala batas", "balik pulau", "marang", "dungun", "kemaman", "besut", "bachok", "tumpat", "pontian", "batu pahat", "muar", "klang", "lumut", "beruas"),
    paddy: ["kedah", "perlis", "kelantan"].includes(stateId) || has("sabak bernam", "sungai besar", "sekinchan", "tanjung karang", "pendang", "yan", "kubang"),
    hilly: HILLY_BUKIT_EXCEPTIONS.includes(name) || has("gua", "hulu", "ulu", "cameron", "kundasang", "ranau", "keningau", "tambunan", "lipis", "raub", "bentong", "jelebu", "tapah", "kinta", "lenggong", "gerik", "baling", "jeli", "tenom"),
    industrial: has("gudang", "kulim", "shah alam", "klang", "perai", "prai", "senai", "skudai", "subang", "kapar", "larkin", "pasir gudang"),
    lake: LAKE_SEATS.has(name) || has("tasik"),
    kinabalu: KINABALU_SEATS.has(name),
  };
}

function seedFrom(text: string) {
  return text.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

// How many zones actually get generated scales with population density (see
// kawasanDevelopedCount) instead of every seat building out a fixed 9 —
// a rural seat only develops its base town core, a metro seat fills every
// cell of its (bigger) grid. Zone-0 stays the "Pusat Bandar" flagship
// (isPrimary/landmark logic keys off zone.id === "zone-0", and
// assignZonePositions always places it at the grid centre) regardless of
// count; counts smaller than the base archetype list take a prefix of it,
// counts larger cycle back through the non-flagship archetypes with a
// numbered suffix so a big city can have e.g. two housing estates without
// them reading as literal duplicates.
function makeZones(seedKey: string, traits: SeatTraits, developedCount: number): Zone[] {
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
  if (traits.coastal) basePool[6] = ["fishingVillage", "river", 0];
  if (traits.paddy) basePool[1] = ["paddyVillage", "village", 0];
  if (traits.industrial) basePool[5] = ["industrialEstate", "industry", 0];

  const names: [ZoneArchetype, ZoneKind, number][] = basePool.slice(0, Math.min(developedCount, basePool.length));
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

function metricColor(value: number) {
  if (value >= 74) return "var(--neon-green)";
  if (value >= 54) return "var(--gold)";
  return "var(--neon-red)";
}

// Smooth (non-hard-cutoff) red->gold->green interpolation for zone ground
// tiles + building roof accents, so a zone at 73 vs 75 reads as nearly
// identical instead of snapping orange->green at metricColor()'s bands.
// Hardcoded RGB anchors rather than the CSS theme vars metricColor() uses:
// matches the scene's existing convention of fixed decorative colours
// (train livery, glows, contact shadows, etc.) that don't shift with the
// app's light/dark theme toggle, and lets this interpolate as plain numbers.
const SCORE_TINT_RED: [number, number, number] = [255, 68, 68];
const SCORE_TINT_GOLD: [number, number, number] = [240, 165, 0];
const SCORE_TINT_GREEN: [number, number, number] = [0, 255, 136];
function scoreTintRGB(value: number): string {
  const v = clamp(value);
  const [from, to, t] = v <= 54 ? [SCORE_TINT_RED, SCORE_TINT_GOLD, v / 54] : [SCORE_TINT_GOLD, SCORE_TINT_GREEN, (v - 54) / 46];
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `${r},${g},${b}`;
}

// Legend bands mirror metricColor's cutoffs — keep the two in step.
const SCORE_LEGEND: { color: string; labelKey: string }[] = [
  { color: "var(--neon-green)", labelKey: "kawasan_page.scoreLegendGood" },
  { color: "var(--gold)", labelKey: "kawasan_page.scoreLegendFair" },
  { color: "var(--neon-red)", labelKey: "kawasan_page.scoreLegendCritical" },
];

const STAT_ORDER: ZoneStat[] = ["infra", "welfare", "economy"];

function statLabel(lang: ReturnType<typeof useLang>, key: ZoneStat) {
  if (key === "welfare") return t(lang, "kawasan_page.welfare");
  if (key === "economy") return t(lang, "kawasan_page.economy");
  return "INFRA";
}

function weakestStat(zone: Zone): ZoneStat {
  return STAT_ORDER.reduce((lowest, key) => (zone[key] < zone[lowest] ? key : lowest));
}

// Returns a localised "what unlocks this" line, or null when the project is open.
function lockReason(project: Project, zone: Zone | undefined, lang: ReturnType<typeof useLang>) {
  const requires = project.requires;
  if (!requires || !zone) return null;
  const missing: string[] = [];
  if (requires.projectId && !zone.projects.includes(requires.projectId)) {
    const prerequisite = PROJECTS.find((candidate) => candidate.id === requires.projectId);
    if (prerequisite) missing.push(t(lang, "kawasan_page.done", { prerequisite: t(lang, `kawasan_page.projectTitle_${prerequisite.id}`) }));
  }
  if (requires.zoneStat && zone[requires.zoneStat.key] < requires.zoneStat.min) {
    missing.push(`${statLabel(lang, requires.zoneStat.key)} ≥ ${requires.zoneStat.min}`);
  }
  if (!missing.length) return null;
  return t(lang, "kawasan_page.requires", { missingJoin: missing.join(" & ") });
}

function zoneName(lang: Lang, zone: Zone) {
  const name = t(lang, `kawasan_page.zoneName_${zone.archetype}`);
  return zone.repeat ? `${name} ${zone.repeat}` : name;
}

function zoneIcon(kind: ZoneKind) {
  const icons: Record<ZoneKind, string> = {
    urban: "🏙️",
    village: "🏡",
    housing: "🏘️",
    commercial: "🏬",
    education: "🏫",
    industry: "🏭",
    river: "🌊",
    market: "🏪",
    community: "🏥",
  };
  return icons[kind];
}

// ── 3D city engine ─────────────────────────────────────────────
// One CSS-3D world: camera angles live in --kw-rz / --kw-rx /
// --kw-zoom on .kw-scene (see globals.css) and are mutated
// imperatively during drag/zoom, so nothing re-renders per frame.
// Buildings are true extruded boxes (south wall + east wall +
// roof); the camera is clamped so only those two faces are ever
// visible. Labels/icons are .kw-bill billboards that counter-
// rotate to face the camera. Scene colours are deliberate
// artwork on a fixed dark/sky palette, independent of app theme.

// City footprint scales with gridSize (5..7, see kawasanGridSize) instead of
// every seat being a fixed 3x3 block. PLOT (zone tile size) and ROAD_GAP
// (zone pitch) stay constant — only the grid COUNT changes, so a metro seat
// is a literally bigger city, not the same zones stretched out. Every seat —
// even the most rural — gets at least a real 5x5 town plan; density instead
// decides how much of that plan is actually BUILT (see kawasanDevelopedCount)
// vs left as vacant surveyed land (see assignZonePositions/EmptyPlot), so a
// rural seat reads as a small built core surrounded by open land rather than
// a literally tiny map.
const PLOT = 240;
const ROAD_GAP = 280;
function plotXY(gridSize: number): number[] {
  return Array.from({ length: gridSize }, (_, i) => 40 + i * ROAD_GAP);
}
function roadsV(gridSize: number): number[] {
  return Array.from({ length: gridSize }, (_, i) => i * ROAD_GAP);
}
function roadsH(gridSize: number): number[] {
  return Array.from({ length: gridSize + 1 }, (_, i) => i * ROAD_GAP);
}
function kawasanGridSize(density: number): number {
  if (density >= 0.85) return 30; // dense metro — full KL-scale grid (WebGL map)
  if (density >= 0.62) return 16; // metro
  if (density >= 0.3) return 8;   // semi-urban
  return 6;                      // rural
}
// How many of the grid's cells are actually developed zones. Always at
// least the base 9 archetypes (a real town core), scaling up to every cell
// at maximum density — the gap between this and gridSize² is empty land.
function kawasanDevelopedCount(density: number, gridSize: number): number {
  const total = gridSize * gridSize;
  const minDeveloped = Math.min(9, total);
  let n = Math.max(minDeveloped, Math.round(minDeveloped + density * (total - minDeveloped)));
  // Dense metro (30×30): fill ~98% of the grid with buildings.
  if (gridSize >= 22) n = Math.round(total * 0.98);
  return n;
}
// Places developed zones starting from the grid's centre outward (so the
// "Pusat Bandar" flagship at zones[0] sits in the middle of the town, not
// jammed in a corner) and leaves the remaining, farther-out cells empty —
// that's the actual "lot of empty grid around a small core" look for rural
// seats. Deterministic (stable sort, tie-broken by row/col) so the same seat
// always lays out identically across sessions.
function assignZonePositions(gridSize: number, developedCount: number): { col: number; row: number }[] {
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

type BType = "tower" | "skyscraper" | "antenna" | "shop" | "stall" | "house" | "factory" | "warehouse" | "school" | "clinic" | "masjid" | "mall" | "stadium" | "terminal" | "sawah" | "pond" | "field" | "plaza" | "kampung" | "shophouse" | "terrace";

const FLAT_TYPES: BType[] = ["sawah", "pond", "field", "plaza"];

const PALETTES: Record<string, { wall: string; side: string; top: string; win?: boolean }> = {
  tower: { wall: "linear-gradient(0deg, #67e8f9, #155e75)", side: "linear-gradient(90deg, #082f49, #164e63)", top: "linear-gradient(135deg, #a5f3fc, #22d3ee)", win: true },
  skyscraper: { wall: "linear-gradient(0deg, #c7d2fe, #312e81)", side: "linear-gradient(90deg, #1e1b4b, #3730a3)", top: "linear-gradient(135deg, #e0e7ff, #6366f1)", win: true },
  antenna: { wall: "linear-gradient(0deg, #e9d5ff, #6b21a8)", side: "linear-gradient(90deg, #3b0764, #581c87)", top: "linear-gradient(135deg, #f3e8ff, #a855f7)", win: true },
  shop: { wall: "linear-gradient(0deg, #fde68a, #b45309)", side: "linear-gradient(90deg, #451a03, #92400e)", top: "linear-gradient(135deg, #fbbf24, #92400e)", win: true },
  stall: { wall: "linear-gradient(0deg, #fdba74, #c2410c)", side: "linear-gradient(90deg, #431407, #9a3412)", top: "repeating-linear-gradient(90deg, #f97316 0 10px, #fff7ed 10px 20px)" },
  house: { wall: "linear-gradient(0deg, #fed7aa, #c2410c)", side: "linear-gradient(90deg, #7c2d12, #9a3412)", top: "linear-gradient(135deg, #ef4444, #7f1d1d)" },
  factory: { wall: "linear-gradient(0deg, #cbd5e1, #475569)", side: "linear-gradient(90deg, #1e293b, #334155)", top: "linear-gradient(135deg, #94a3b8, #334155)", win: true },
  warehouse: { wall: "linear-gradient(0deg, #a8a29e, #57534e)", side: "linear-gradient(90deg, #292524, #44403c)", top: "repeating-linear-gradient(0deg, #78716c 0 8px, #57534e 8px 16px)" },
  school: { wall: "linear-gradient(0deg, #93c5fd, #1d4ed8)", side: "linear-gradient(90deg, #172554, #1e40af)", top: "linear-gradient(135deg, #bfdbfe, #3b82f6)", win: true },
  clinic: { wall: "linear-gradient(0deg, #86efac, #047857)", side: "linear-gradient(90deg, #022c22, #065f46)", top: "linear-gradient(135deg, #d1fae5, #10b981)", win: true },
  masjid: { wall: "linear-gradient(0deg, #fafaf9, #78716c)", side: "linear-gradient(90deg, #44403c, #57534e)", top: "linear-gradient(135deg, #6ee7b7, #047857)" },
  mall: { wall: "linear-gradient(0deg, #fbcfe8, #9d174d)", side: "linear-gradient(90deg, #500724, #831843)", top: "linear-gradient(135deg, #f9a8d4, #db2777)", win: true },
  stadium: { wall: "linear-gradient(0deg, #e2e8f0, #475569)", side: "linear-gradient(90deg, #1e293b, #334155)", top: "radial-gradient(ellipse at 50% 50%, #22c55e 0 36%, #e2e8f0 40% 52%, #475569 54%)" },
  terminal: { wall: "linear-gradient(0deg, #fed7aa, #9a3412)", side: "linear-gradient(90deg, #431407, #7c2d12)", top: "repeating-linear-gradient(0deg, #fb923c 0 8px, #fff7ed 8px 16px)" },
  // Traditional Malay kampung house: warm timber walls (kw-face-plain's
  // plank texture reads as weatherboard here), zinc roof, no glass grid.
  kampung: { wall: "linear-gradient(0deg, #d97a4d, #7c4a2d)", side: "linear-gradient(90deg, #4a2c1a, #6b3a20)", top: "repeating-linear-gradient(90deg, #b45309 0 6px, #92400e 6px 12px)" },
  // Pre-war heritage shophouse: two-tone facade (cream five-foot-way arcade
  // at ground level, pastel upper storeys) with a clay-tile roof.
  shophouse: { wall: "linear-gradient(0deg, #f5e6c8 0%, #f5e6c8 30%, #8fd0c4 30%, #8fd0c4 100%)", side: "linear-gradient(90deg, #04312b, #1f6b5c)", top: "linear-gradient(135deg, #dc7c4f, #92400e)", win: true },
  // Suburban link/terrace house: a repeating brick-unit texture stands in
  // for the party-wall seams between attached units.
  terrace: { wall: "repeating-linear-gradient(90deg, #cbb994 0 22px, #b8a37e 22px 24px)", side: "linear-gradient(90deg, #4a4030, #6b5d42)", top: "linear-gradient(135deg, #c2622f, #7c2d12)", win: true },
};

function flatTile(type: BType) {
  if (type === "sawah") return "repeating-linear-gradient(115deg, rgba(163,230,53,0.72) 0 9px, rgba(77,124,15,0.82) 9px 18px)";
  if (type === "field") return "radial-gradient(circle at 40% 35%, #4d7c0f, #1a2e05)";
  if (type === "plaza") return "repeating-linear-gradient(90deg, #475569 0 12px, #334155 12px 24px)";
  return "";
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

// footprint(type) is one fixed {w,d} per type, so every instance of a type
// is pixel-identical — at zoomed-out (gridSize 10-12) scale a street of
// eight identical "house" boxes reads as stamped clones. jitterFootprint
// adds a deterministic +/-8-12% wobble to w and d, seeded from the zone id
// AND the building's slot (same stable-seed style as seedFrom(zone.id) /
// Building3D's csSeed — never Math.random, so it's identical on every
// render and every reload). Both inputs matter: zone id alone would scale
// every building in a zone the same way; slot alone would clone the same
// wobble across zones. FLAT_TYPES (sawah/pond/field/plaza) are excluded —
// they abut edge-to-edge as ground cover, so size variance there reads as
// sloppy tiling, not organic.
const SLOT_PITCH = 72; // must track slotPos()'s fixed grid spacing
const SLOT_GAP = 7;    // min clearance kept to the next slot at full +jitter
function jitterFootprint(type: BType, zoneId: string, slot: number): { w: number; d: number } {
  const base = footprint(type);
  if (FLAT_TYPES.includes(type)) return base;
  // 0..96, stable per (zone, slot); two near-independent draws for w and d.
  const seed = (seedFrom(zoneId) + slot * 31) % 97;
  const jw = (((seed % 7) - 3) / 3);                  // -1..1 in thirds
  const jd = (((Math.floor(seed / 7) % 7) - 3) / 3);  // -1..1 in thirds
  // Amplitude is normally 12%, but clamped so base + jitter still leaves
  // SLOT_GAP px before the neighbouring slot. Every current non-flat
  // footprint tops out at w/d 58 (factory/warehouse/mall/stadium), which
  // still permits the full 12% (58*1.12 = 65 <= 72-7) — the clamp is a
  // guard for any future wider type.
  const amp = (px: number) => Math.max(0.08, Math.min(0.12, (SLOT_PITCH - SLOT_GAP - px) / px));
  return {
    w: Math.round(base.w * (1 + jw * amp(base.w))),
    d: Math.round(base.d * (1 + jd * amp(base.d))),
  };
}

// Heights track zone metrics, so approving a project visibly grows
// the skyline (faces carry a CSS transition on height/transform).
function buildingHeight(type: BType, zone: Zone) {
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
  road: "plaza",
  clinic: "clinic",
  internet: "antenna",
  flood: "pond",
  market: "stall",
  school: "school",
  park: "field",
  bus: "terminal",
  mall: "mall",
  stadium: "stadium",
  surau: "masjid",
  office: "tower",
  // This legacy CSS-3D renderer's BType union predates police/fire/
  // library/museum/hotel (see app/kawasan-3d/cityData.ts) — stand in with
  // the closest existing shape rather than growing this deprecated
  // fallback's own type union.
  demolish: "shophouse",
  hotel: "tower",
  police: "terminal",
  firestation: "warehouse",
  library: "school",
  museum: "mall",
};

type BSpec = { type: BType; slot: number; w: number; d: number; h: number; icon?: string; glow?: boolean; flag?: boolean };

function slotPos(slot: number) {
  return { x: 22 + (slot % 3) * 72, y: 22 + Math.floor(slot / 3) * 72 };
}

// Extra buildings used to pad zones out on high-density (high-voter)
// seats: rural seats show the base layout, metro seats fill spare slots.
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

function zoneBuildings(zone: Zone, density: number, traits: SeatTraits): BSpec[] {
  const base: BSpec[] = ZONE_BASE[zone.kind].map(({ type, slot }, index) => ({ type, slot, ...jitterFootprint(type, zone.id, slot), h: buildingHeight(type, zone), flag: zone.kind === "urban" && index === 0 }));
  const used = new Set(base.map((b) => b.slot));
  const free = [1, 3, 5, 7, 8, 6, 2, 0].filter((slot) => !used.has(slot));
  // Projects are physical facilities, not a second visual layer over a
  // zone's ordinary buildings. Reserve one unique slot for each project
  // that the plot can physically display before filling high-density spare
  // slots. This is especially visible with the Stadium project: its green
  // oval is a stadium roof (PALETTES.stadium), not an interchange plaza or
  // roundabout. The old facilities[index % free.length] assignment cycled
  // after the remaining slots ran out, so a later project could be painted
  // directly into that oval. The LRT interchange itself is centred on a
  // road crossing and has no separate circular ground footprint; the nearby
  // visual collision was therefore a generic project-slot collision, not
  // building placement entering an infrastructure-reserved area.
  const reservedFacilitySlots = Math.min(zone.projects.length, free.length);
  const fillers: BType[] = traits.paddy && (zone.kind === "village" || zone.kind === "river")
    ? ["sawah", "sawah", "house"]
    : ZONE_FILLER[zone.kind];
  const seed = seedFrom(zone.id);
  // Metro seats (high voter counts) grow true skyscrapers downtown
  const skyscraperCount = zone.kind === "urban"
    ? Math.max(0, Math.min(2, Math.round((density - 0.5) * 4), free.length - reservedFacilitySlots))
    : zone.kind === "commercial" && density >= 0.8 ? Math.max(0, Math.min(1, free.length - reservedFacilitySlots)) : 0;
  const skyscrapers: BSpec[] = Array.from({ length: Math.min(skyscraperCount, free.length - reservedFacilitySlots) }, () => {
    const slot = free.pop() as number;
    return { type: "skyscraper" as BType, slot, ...jitterFootprint("skyscraper", zone.id, slot), h: buildingHeight("skyscraper", zone) };
  });
  const extraBoost = (traits.industrial && zone.kind === "industry") || (traits.paddy && zone.kind === "village") ? 2 : 0;
  const extraCount = Math.min(Math.round(density * 3) + extraBoost, Math.max(0, free.length - reservedFacilitySlots));
  const extras: BSpec[] = Array.from({ length: extraCount }, (_, index) => {
    const type = fillers[(seed + index) % fillers.length];
    const slot = free.pop() as number;
    return { type, slot, ...jitterFootprint(type, zone.id, slot), h: buildingHeight(type, zone) };
  });
  const facilities: BSpec[] = zone.projects.slice(0, free.length).map((projectId) => {
    const type = PROJECT_BUILDING[projectId] ?? "plaza";
    const slot = free.pop() as number;
    return {
      type,
      slot,
      ...jitterFootprint(type, zone.id, slot),
      h: buildingHeight(type, zone),
      icon: PROJECTS.find((project) => project.id === projectId)?.icon,
      glow: true,
    };
  });
  return [...base, ...skyscrapers, ...extras, ...facilities];
}

function zoneGround(kind: ZoneKind) {
  if (kind === "river") return "linear-gradient(135deg, #173a2a, #0c2a3a)";
  if (kind === "village") return "radial-gradient(circle at 30% 30%, #2a5a33, #17331d)";
  if (kind === "housing") return "linear-gradient(135deg, #33413a, #1d2a24)";
  if (kind === "industry") return "linear-gradient(135deg, #3a4150, #232936)";
  if (kind === "market" || kind === "commercial") return "linear-gradient(135deg, #4a3a26, #2b2013)";
  if (kind === "education" || kind === "community") return "linear-gradient(135deg, #264a40, #132a24)";
  return "linear-gradient(135deg, #31404f, #1a2530)";
}

// Parking pads (rendered in ZonePlot next to the buildings): only the
// busier commercial zone kinds get them, and only beside these street-level
// retail types — kept sparse on purpose so the plot doesn't turn to tarmac.
const PARKING_ZONE_KINDS = new Set<ZoneKind>(["commercial", "market", "urban"]);
const PARKING_HOST_TYPES = new Set<BType>(["shop", "stall", "shophouse"]);

const FACE_TRANSITION = "height 0.7s, width 0.7s, transform 0.7s";

// Kampung houses sit on a stilt platform below the wall/roof tier — same
// translateZ(tier)-prefixed rotateX/rotateY wall-hinge composition already
// proven for the layered Car body/cabin and the bridge piers, just applied
// to a building. Every other type keeps stiltH at 0 (translateZ(0) is a
// no-op) so this doesn't change their geometry at all.
const STILT_H = 14;

// Ground-level residential/shop types share one fixed palette entry each —
// every "house" on the map was the exact same orange. A subtle per-building
// hue/brightness jitter (deterministic from slot+height, not Math.random —
// must stay stable across renders) breaks that up into 3-4 shades without
// touching PALETTES itself. Deliberately NOT applied to windowed glass
// towers (tower/skyscraper/etc.) — hue-rotating those would shift the
// window-light tint too, which reads as broken rather than varied.
const VARIABLE_TINT_TYPES = new Set<BType>(["house", "kampung", "terrace", "shophouse", "shop", "stall"]);

// Low-rise homes get a real gabled roof instead of the flat kw-face-roof
// cap every other type shares — a flat lid on a 20px-tall house was the
// single biggest "toy block" tell next to the detailed towers. Every other
// type still takes the flat cap unchanged.
const PITCHED_ROOF_TYPES = new Set<BType>(["house", "terrace", "kampung"]);
// Ridge rise (peak height above the eaves). Deliberately shallow relative
// to the wall heights of these types (~20-40px) so it reads as a suburban
// hip/gable, not an A-frame, and so the whole roof assembly — which is
// translateZ'd off spec.h — travels as one piece under FACE_TRANSITION
// when a building grows on project approval.
const RIDGE_RISE = 15;

// Two-slope gable roof for PITCHED_ROOF_TYPES. The ridge runs down the
// middle of the SHORTER footprint axis; each slope is a planar face hinged
// up from an eave with the same translateZ'd rotateX/rotateY wall-hinge
// composition used for the walls, the rooftop AC condenser and the kampung
// stilt platform — just tipped to a shallow pitch instead of a full 90deg.
// Both slopes render palette.top; their light/dark difference comes from
// the shared kw-face-lit / kw-face-shadow "sun from the south" ::after
// washes (same single light source as the walls), NOT a hand-rolled
// per-slope gradient. FACE_TRANSITION on every piece keeps the roof growing
// in step with the walls. The thin ridge beam carries the score-tint accent
// the flat cap used to show (roof colour -> zone sentiment, see
// scoreTintRGB) so swapping the cap doesn't drop that signal, and it hides
// the seam where the two slopes meet.
const PitchedRoof = memo(function PitchedRoof({ w, d, h, baseZ, top, wall, side, tintFilter, accent }: { w: number; d: number; h: number; baseZ: number; top: string; wall: string; side: string; tintFilter?: string; accent: CSSProperties }) {
  const ridgeAlongY = w <= d; // shorter axis is W -> ridge runs N-S (down Y)
  const half = (ridgeAlongY ? w : d) / 2;
  const slant = Math.hypot(half, RIDGE_RISE);
  const angle = (Math.atan2(RIDGE_RISE, half) * 180) / Math.PI;
  const z = baseZ + h;
  return ridgeAlongY ? (
    <>
      {/* west slope (faces the light) + east slope (shadow side), hinged at
          the two eaves and tipped up to meet at the ridge at x = w/2 */}
      <div className="absolute kw-face-lit" style={{ left: 0, top: 0, width: slant, height: d, transformOrigin: "left", transform: `translateZ(${z}px) rotateY(-${angle}deg)`, background: top, filter: tintFilter, transition: FACE_TRANSITION }} />
      <div className="absolute kw-face-shadow" style={{ left: w - slant, top: 0, width: slant, height: d, transformOrigin: "right", transform: `translateZ(${z}px) rotateY(${angle}deg)`, background: top, filter: tintFilter, transition: FACE_TRANSITION }} />
      {/* south gable: triangular wall infill under the slopes at the
          camera-facing end (wall colour + kw-face-lit, continuing the south
          wall right below it) so the roof doesn't read as hollow */}
      <div className="absolute kw-face-lit" style={{ left: 0, top: d, width: w, height: RIDGE_RISE, transformOrigin: "top", transform: `translateZ(${z}px) rotateX(90deg)`, background: wall, filter: tintFilter, clipPath: "polygon(0 0, 100% 0, 50% 100%)", transition: FACE_TRANSITION }} />
      <div className="absolute" style={{ left: w / 2 - 1, top: 0, width: 2, height: d, background: top, transform: `translateZ(${z + RIDGE_RISE}px)`, transition: FACE_TRANSITION, ...accent }} />
    </>
  ) : (
    <>
      {/* south slope (faces the light) + north slope (shadow side), meeting
          at the ridge at y = d/2 */}
      <div className="absolute kw-face-shadow" style={{ left: 0, top: 0, width: w, height: slant, transformOrigin: "top", transform: `translateZ(${z}px) rotateX(${angle}deg)`, background: top, filter: tintFilter, transition: FACE_TRANSITION }} />
      <div className="absolute kw-face-lit" style={{ left: 0, top: d - slant, width: w, height: slant, transformOrigin: "bottom", transform: `translateZ(${z}px) rotateX(-${angle}deg)`, background: top, filter: tintFilter, transition: FACE_TRANSITION }} />
      {/* east gable infill (camera-facing end when the ridge runs E-W) */}
      <div className="absolute kw-face-shadow" style={{ left: w, top: 0, width: RIDGE_RISE, height: d, transformOrigin: "left", transform: `translateZ(${z}px) rotateY(-90deg)`, background: side, filter: tintFilter, clipPath: "polygon(0 0, 100% 50%, 0 100%)", transition: FACE_TRANSITION }} />
      <div className="absolute" style={{ left: 0, top: d / 2 - 1, width: w, height: 2, background: top, transform: `translateZ(${z + RIDGE_RISE}px)`, transition: FACE_TRANSITION, ...accent }} />
    </>
  );
});

// tower / skyscraper / antenna get an ORGANIC lit-window map instead of the
// shared kw-win-lit repeating gradient. kw-win-lit alone lights every unit
// on a face on the same twinkle beat (offset only by a per-building
// animationDelay) — it reads as a blinking sign, not a tower with a mixed
// occupied/dark floor grid. litWindowMap bakes a seeded scatter of ~40%
// "lit" cells into ONE background-image (a handful of small radial-gradient
// dots — never one node per window; see the FPS/compositor note on the
// contact-shadow block) so the pattern is stable per building (seed =
// csSeed, same determinism as the hue jitter) yet differs building to
// building. Only these three types — the other win:true palettes
// (shop/school/clinic/mall/factory/shophouse/terrace) keep the simpler
// two-layer treatment below, which suits their squat proportions.
const WINDOW_TOWERS = new Set<BType>(["tower", "skyscraper", "antenna"]);
const WIN_MAP_COLS = 4;
const WIN_MAP_ROWS = 6;
function litWindowMap(seed: number): string {
  // Deterministic LCG walk over a small cell grid — no Math.random, so the
  // same seed yields the same lit/dark pattern on every render and reload.
  let s = (seed % 97) + 1;
  const dots: string[] = [];
  for (let r = 0; r < WIN_MAP_ROWS; r++) {
    for (let c = 0; c < WIN_MAP_COLS; c++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if ((s >>> 9) % 10 < 4) { // ~40% of cells lit
        const px = 8 + (c * 84) / (WIN_MAP_COLS - 1);
        const py = 6 + (r * 88) / (WIN_MAP_ROWS - 1);
        dots.push(`radial-gradient(circle at ${px.toFixed(0)}% ${py.toFixed(0)}%, rgba(255,206,120,0.92) 0 2px, rgba(255,206,120,0.3) 2px 3.4px, transparent 3.6px)`);
      }
    }
  }
  // A low seed can light zero cells — force one so no tower goes fully dark.
  if (!dots.length) dots.push("radial-gradient(circle at 30% 24%, rgba(255,206,120,0.9) 0 2px, transparent 3px)");
  return dots.join(",");
}

const Building3D = memo(function Building3D({ spec, scoreColor }: { spec: BSpec; scoreColor?: string }) {
  const { x, y } = slotPos(spec.slot);
  const palette = PALETTES[spec.type];
  const flat = FLAT_TYPES.includes(spec.type);
  const stiltH = spec.type === "kampung" ? STILT_H : 0;
  // Applied per leaf face (wall/side/roof), never on the kw-3d preserve-3d
  // wrapper around them — filter on a preserve-3d ancestor flattens its 3D
  // children into a 2D composite (see the .kw-scene comment on this exact
  // trap in globals.css). These leaf divs only ever hold flat 2D overlays
  // (kw-win textures), so filter here is safe.
  const csSeed = (spec.slot * 37 + Math.round(spec.h) * 13) % 97;
  const tintFilter = VARIABLE_TINT_TYPES.has(spec.type)
    ? `hue-rotate(${(csSeed % 5 - 2) * 6}deg) brightness(${0.94 + (csSeed % 4) * 0.04})`
    : undefined;
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: spec.w, height: spec.d, pointerEvents: "none" }}>
      <div className={`kw-3d absolute inset-0 ${spec.glow ? "kw-rise" : ""}`}>
        {flat ? (
          <div
            className={`absolute inset-0 ${spec.type === "pond" ? "kw-water" : ""}`}
            style={{
              background: spec.type === "pond" ? undefined : flatTile(spec.type),
              borderRadius: spec.type === "pond" ? "42%" : 4,
              border: spec.glow ? "2px solid rgba(0,255,136,0.55)" : "1px solid rgba(255,255,255,0.16)",
              boxShadow: spec.glow ? "0 0 18px rgba(0,255,136,0.28)" : undefined,
              transform: "translateZ(1.5px)",
            }}
          />
        ) : (
          <>
            {/* Contact shadow: was 3 stacked filter:blur() layers (near-black
                seam + tight core + soft falloff) so the wall read as pressed
                into the ground rather than pasted on. filter:blur forces its
                own compositor layer per element — with up to ~9 buildings
                per zone across a big grid that was hundreds of blurred
                layers, a real GPU compositing cost (see the FPS-optimization
                pass this comment is from). A single radial-gradient with a
                built-in soft edge gets the same grounded look — same trick
                already used for Car/Tree/Palm/Conifer contact shadows below
                — with zero filter cost. */}
            <div className="absolute" style={{ left: -14, top: -9, width: spec.w + 32, height: spec.d + 22, background: "radial-gradient(ellipse, rgba(0,0,0,0.55), rgba(0,0,0,0.22) 55%, transparent 75%)", transform: "translateZ(0.3px)" }} />
            {/* Stilt platform: open timber understructure the house tier
                (below) sits on, inset a little from the house footprint so
                it reads as a base rather than a second identical wall. */}
            {stiltH > 0 && (
              <>
                <div className="absolute" style={{ left: spec.w * 0.12, top: spec.d * 0.88, width: spec.w * 0.76, height: stiltH, transformOrigin: "top", transform: "rotateX(90deg)", background: "linear-gradient(180deg, #5b3a1e, #2e1a0c)" }} />
                <div className="absolute" style={{ left: spec.w * 0.88, top: spec.d * 0.12, width: stiltH, height: spec.d * 0.76, transformOrigin: "left", transform: "rotateY(-90deg)", background: "linear-gradient(90deg, #2e1a0c, #40260f)" }} />
              </>
            )}
            {/* kw-face-lit/-shadow: a fixed "sun from the south" wash layered
                over every palette via ::after (see globals.css), so light
                direction reads consistently across all types instead of
                being an accident of each type's own gradient choice.
                kw-face-edge adds a roofline highlight + ground AO band on
                top of that. kw-face-plain adds a plank/coursing texture
                (via ::before) to the types with no window grid (house/
                masjid/stadium/terminal/stall/warehouse/kampung) — without
                it those read as flat-painted boxes next to the detailed
                towers, which was the actual "different asset quality"
                complaint, not the height variance itself. */}
            <div className={`absolute kw-face-lit kw-face-edge ${palette.win ? "" : "kw-face-plain"}`} style={{ left: 0, top: spec.d, width: spec.w, height: spec.h, transformOrigin: "top", transform: `translateZ(${stiltH}px) rotateX(90deg)`, background: palette.wall, filter: tintFilter, borderRadius: spec.type === "stadium" ? "45% 45% 0 0" : undefined, transition: FACE_TRANSITION }}>
              {palette.win && <div className="kw-win" />}
              {palette.win && (WINDOW_TOWERS.has(spec.type)
                ? <div className="kw-win-lit" style={{ backgroundImage: litWindowMap(csSeed), animationDelay: `${csSeed * -0.11}s` }} />
                : <div className="kw-win-lit" style={{ animationDelay: `${spec.slot * -0.45}s` }} />)}
            </div>
            <div className={`absolute kw-face-shadow kw-face-edge ${palette.win ? "" : "kw-face-plain"}`} style={{ left: spec.w, top: 0, width: spec.h, height: spec.d, transformOrigin: "left", transform: `translateZ(${stiltH}px) rotateY(-90deg)`, background: palette.side, filter: tintFilter, borderRadius: spec.type === "stadium" ? "45% 45% 0 0" : undefined, transition: FACE_TRANSITION }}>
              {palette.win && <div className="kw-win" style={{ opacity: 0.55 }} />}
              {palette.win && (WINDOW_TOWERS.has(spec.type)
                ? <div className="kw-win-lit" style={{ backgroundImage: litWindowMap(csSeed + 13), animationDelay: `${csSeed * -0.11 - 1.2}s` }} />
                : <div className="kw-win-lit" style={{ animationDelay: `${spec.slot * -0.45 - 1.2}s` }} />)}
            </div>
            {PITCHED_ROOF_TYPES.has(spec.type) ? (
              // house/terrace/kampung: real gabled roof (see PitchedRoof).
              // The score-tint / glow accent that lived on the flat cap's
              // border moves to PitchedRoof's ridge beam so the "roof colour
              // -> zone sentiment" signal survives the swap.
              <PitchedRoof
                w={spec.w}
                d={spec.d}
                h={spec.h}
                baseZ={stiltH}
                top={palette.top}
                wall={palette.wall}
                side={palette.side}
                tintFilter={tintFilter}
                accent={
                  spec.glow
                    ? { border: "1px solid rgba(0,255,136,0.7)", boxShadow: "0 0 12px rgba(0,255,136,0.35)" }
                    : scoreColor
                    ? { border: `1px solid rgba(${scoreColor},0.65)`, boxShadow: `0 0 8px rgba(${scoreColor},0.3)` }
                    : { border: "1px solid rgba(255,255,255,0.18)" }
                }
              />
            ) : (
              <div
                className="absolute inset-0 kw-face-roof"
                style={{
                  background: palette.top,
                  // Roof accent reads the zone's live sentiment score (smooth
                  // red->gold->green, see scoreTintRGB) so building colour
                  // maps to zone health without touching the type-based wall
                  // palette above (which stays the readability cue for what
                  // a building IS). spec.glow buildings (flags/facilities)
                  // keep their own fixed green "new project" marker instead.
                  border: spec.glow ? "2px solid rgba(0,255,136,0.7)" : scoreColor ? `2px solid rgba(${scoreColor},0.65)` : "1px solid rgba(255,255,255,0.18)",
                  boxShadow: spec.glow ? "0 0 20px rgba(0,255,136,0.35)" : scoreColor ? `0 0 12px rgba(${scoreColor},0.3)` : undefined,
                  // Stadium's roof texture is already an elliptical pitch
                  // gradient (see PALETTES.stadium) — it was sitting inside a
                  // sharp-cornered rectangular cap, which cut the ellipse off
                  // at the corners instead of reading as an actual oval bowl.
                  // Rounding the cap itself (plus the wall tops above, for a
                  // matching silhouette) turns that into a real oval footprint
                  // without needing curved-wall-segment geometry.
                  borderRadius: spec.type === "stadium" ? "50%" : undefined,
                  transform: `translateZ(${stiltH + spec.h}px)`,
                  filter: tintFilter,
                  transition: FACE_TRANSITION,
                }}
              />
            )}
            {/* Shophouse five-foot-way: a low overhang slab near the south
                wall, protruding slightly past the footprint — same flat-cap-
                at-translateZ technique as the roof above, just shorter. */}
            {spec.type === "shophouse" && (
              <div className="absolute" style={{ left: -4, top: spec.d * 0.62, width: spec.w + 8, height: spec.d * 0.4, background: "linear-gradient(180deg, #7c4a2d, #4a2c1a)", border: "1px solid rgba(0,0,0,0.3)", transform: "translateZ(16px)" }} />
            )}
          </>
        )}
      </div>
      {spec.icon && (
        <div className="kw-3d absolute" style={{ left: spec.w / 2, top: spec.d / 2, width: 0, height: 0, transform: `translateZ(${spec.h + 2}px)` }}>
          <div className="kw-bill">
            <span className="inline-block rounded border px-1.5 py-0.5 text-[13px]" style={{ borderColor: "rgba(0,255,136,0.5)", background: "rgba(3,8,15,0.82)" }}>{spec.icon}</span>
          </div>
        </div>
      )}
      {spec.type === "factory" && (
        <div className="kw-3d absolute" style={{ left: 13, top: 12, width: 0, height: 0, transform: `translateZ(${spec.h}px)`, transition: FACE_TRANSITION }}>
          <div className="kw-bill">
            {[0, 1, 2].map((puff) => <span key={puff} className="kw-smoke" style={{ animationDelay: `${puff * -1.2}s` }} />)}
          </div>
        </div>
      )}
      {(spec.type === "tower" || spec.type === "skyscraper" || spec.type === "antenna") && (
        <div className="kw-blink absolute" style={{ left: spec.w / 2 - 3, top: spec.d / 2 - 3, transform: `translateZ(${spec.h + 2}px)`, transition: FACE_TRANSITION }} />
      )}
      {/* Rooftop AC condenser: a flat colour cap otherwise reads as a bare
          lid on tall buildings specifically — a small true-3D box (same
          wall-hinge convention as everything else) at one corner is enough
          to sell "someone maintains this roof" without needing a bigger
          water-tank silhouette that would clip through the skybridge on
          twin-tower zones. */}
      {(spec.type === "tower" || spec.type === "skyscraper") && (
        <div className="kw-3d absolute" style={{ left: spec.w * 0.62, top: spec.d * 0.6, width: 8, height: 6, transition: FACE_TRANSITION }}>
          <div className="absolute" style={{ left: 0, top: 0, width: 8, height: 6, background: "#cbd5e1", transform: `translateZ(${spec.h + 4}px)` }} />
          <div className="absolute kw-face-lit" style={{ left: 0, top: 6, width: 8, height: 4, transformOrigin: "top", transform: `translateZ(${spec.h}px) rotateX(90deg)`, background: "#94a3b8" }} />
          <div className="absolute kw-face-shadow" style={{ left: 8, top: 0, width: 4, height: 6, transformOrigin: "left", transform: `translateZ(${spec.h}px) rotateY(-90deg)`, background: "#475569" }} />
        </div>
      )}
      {spec.type === "masjid" && (
        <div className="kw-3d absolute" style={{ left: spec.w / 2, top: spec.d / 2, width: 0, height: 0, transform: `translateZ(${spec.h}px)`, transition: FACE_TRANSITION }}>
          <div className="kw-bill">
            <div className="relative" style={{ width: 44, height: 40 }}>
              <div className="absolute" style={{ left: 3, bottom: 0, width: 4, height: 30, background: "linear-gradient(180deg, #fafaf9, #a8a29e)" }} />
              <div className="absolute" style={{ left: 0, bottom: 30, width: 10, height: 8, borderRadius: "50% 50% 22% 22%", background: "radial-gradient(circle at 38% 28%, #fde68a, #b45309)" }} />
              <div className="absolute" style={{ left: 13, bottom: 0, width: 26, height: 19, borderRadius: "50% 50% 8% 8%", background: "radial-gradient(circle at 38% 26%, #fde68a, #d97706 55%, #92400e)" }} />
              <div className="absolute" style={{ left: 25, bottom: 19, width: 2, height: 6, background: "#fbbf24" }} />
            </div>
          </div>
        </div>
      )}
      {spec.flag && (
        <div className="kw-3d absolute" style={{ left: 7, top: 7, width: 0, height: 0, transform: `translateZ(${spec.h}px)`, transition: FACE_TRANSITION }}>
          <div className="kw-bill">
            <div className="relative" style={{ width: 22, height: 34 }}>
              <div className="absolute" style={{ left: 0, bottom: 0, width: 2, height: 34, background: "linear-gradient(180deg, #e2e8f0, #64748b)" }} />
              <div className="kw-wave absolute" style={{ left: 2, top: 0, width: 17, height: 10, background: "repeating-linear-gradient(0deg, #dc2626 0 2px, #f8fafc 2px 4px)" }}>
                <span className="absolute" style={{ left: 0, top: 0, width: 8, height: 5, background: "#1e3a8a" }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// A few tropical-green shade variants so a tree line doesn't read as
// identical clones stamped out at different scales — same idea as the car
// colour palette, applied to foliage.
const TREE_CANOPY = [
  "radial-gradient(circle at 35% 28%, #86efac, #166534 60%, #052e16)",
  "radial-gradient(circle at 35% 28%, #a3e635, #3f6212 60%, #1a2e05)",
  "radial-gradient(circle at 35% 28%, #6ee7b7, #065f46 60%, #022c22)",
];
const CONIFER_CANOPY = [
  "linear-gradient(180deg, #4d7c0f, #14532d 55%, #052e16)",
  "linear-gradient(180deg, #3f6212, #0f3d24 55%, #021a0c)",
  "linear-gradient(180deg, #65a30d, #166534 55%, #052e16)",
];
// [x, y, scale, zNudge] per hill — shared between the mound render pass and
// the forested-slope tree specks so both stay in sync.
const HILL_POSITIONS: [number, number, number, number][] = [[100, -44, 0.95, 0], [330, -62, 1.4, 2], [560, -50, 1.1, 0], [820, -40, 1.2, 1]];
// Shared ground-contact shadow, pinned outside .kw-sway so it doesn't rock
// with the canopy — same soft radial-gradient technique already used under
// buildings/cars/boats, just sized for a small plant instead.
function PlantShadow({ width, scale }: { width: number; scale: number }) {
  return <div className="absolute" style={{ left: (30 * scale - width) / 2 - 4, bottom: -3, width: width + 8, height: 7 * scale, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 72%)" }} />;
}

const Tree = memo(function Tree({ x, y, scale = 1, variant = 0 }: { x: number; y: number; scale?: number; variant?: number }) {
  const canopy = TREE_CANOPY[variant % TREE_CANOPY.length];
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="kw-bill" style={{ width: 30 * scale }}>
        <PlantShadow width={26 * scale} scale={scale} />
        <div className="kw-sway" style={{ animationDelay: `${((x + y) % 6) * -0.8}s` }}>
          {/* Clumped canopy (3 overlapping blobs) instead of one perfect
              circle — reads as a fuller, less geometric crown. */}
          <div className="relative mx-auto" style={{ width: 30 * scale, height: 26 * scale }}>
            <div className="absolute rounded-full" style={{ left: 1 * scale, top: 6 * scale, width: 16 * scale, height: 16 * scale, background: canopy }} />
            <div className="absolute rounded-full" style={{ left: 9 * scale, top: 0, width: 20 * scale, height: 20 * scale, background: canopy }} />
            <div className="absolute rounded-full" style={{ left: 4 * scale, top: 9 * scale, width: 13 * scale, height: 13 * scale, background: canopy, opacity: 0.94 }} />
          </div>
          <div className="mx-auto" style={{ width: 5 * scale, height: 11 * scale, background: "linear-gradient(180deg, #92400e, #451a03)" }} />
        </div>
      </div>
    </div>
  );
});

const Palm = memo(function Palm({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="kw-bill" style={{ width: 34 * scale }}>
        <PlantShadow width={30 * scale} scale={scale} />
        <div className="kw-sway" style={{ animationDelay: `${((x + y) % 7) * -0.7}s` }}>
          <div className="relative mx-auto" style={{ width: 34 * scale, height: 18 * scale }}>
            {[-150, -120, -90, -60, -30].map((deg) => (
              <div key={deg} className="absolute" style={{ left: "50%", bottom: 0, width: 16 * scale, height: 5 * scale, borderRadius: "50%", background: "linear-gradient(90deg, #16a34a, #052e16)", transformOrigin: "0 50%", transform: `rotate(${deg}deg)` }} />
            ))}
          </div>
          <div className="mx-auto" style={{ width: 4 * scale, height: 16 * scale, background: "linear-gradient(180deg, #a16207, #451a03)" }} />
        </div>
      </div>
    </div>
  );
});

const Conifer = memo(function Conifer({ x, y, scale = 1, variant = 0 }: { x: number; y: number; scale?: number; variant?: number }) {
  const canopy = CONIFER_CANOPY[variant % CONIFER_CANOPY.length];
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="kw-bill" style={{ width: 24 * scale }}>
        <PlantShadow width={22 * scale} scale={scale} />
        <div className="kw-sway" style={{ animationDelay: `${((x + y) % 5) * -0.9}s` }}>
          <div className="mx-auto" style={{ width: 22 * scale, height: 32 * scale, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)", background: canopy }} />
          <div className="mx-auto" style={{ width: 5 * scale, height: 8 * scale, background: "linear-gradient(180deg, #78350f, #451a03)" }} />
        </div>
      </div>
    </div>
  );
});

const BUNTING_COLORS = ["#dc2626", "#facc15", "#2563eb", "#f8fafc", "#16a34a"];

// Election bunting: string of triangle flags between two poles
const Bunting = memo(function Bunting({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="kw-bill">
        <div className="relative" style={{ width: 48, height: 32 }}>
          <div className="absolute" style={{ left: 0, bottom: 0, width: 2, height: 32, background: "#78716c" }} />
          <div className="absolute" style={{ right: 0, bottom: 0, width: 2, height: 32, background: "#78716c" }} />
          <div className="absolute" style={{ left: 0, top: 0, width: 48, height: 2, background: "rgba(226,232,240,0.75)" }} />
          <div className="kw-sway absolute flex" style={{ left: 3, top: 2, gap: 2, animationDelay: `${delay}s` }}>
            {[0, 1, 2, 3, 4].map((flagIndex) => (
              <span key={flagIndex} style={{ width: 7, height: 9, clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: BUNTING_COLORS[(flagIndex + Math.abs(x + y)) % BUNTING_COLORS.length] }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function Fireworks() {
  const bursts = [
    { x: PLOT / 2 - 44, z: 165, delay: 0, color: "#ffd54a" },
    { x: PLOT / 2 + 46, z: 200, delay: 0.5, color: "#4ade80" },
    { x: PLOT / 2, z: 232, delay: 1, color: "#7dd3fc" },
  ];
  return (
    <>
      {bursts.map((burst, burstIndex) => (
        <div key={burstIndex} className="kw-3d absolute" style={{ left: burst.x, top: PLOT / 2, width: 0, height: 0, transform: `translateZ(${burst.z}px)`, pointerEvents: "none" }}>
          <div className="kw-bill">
            {Array.from({ length: 10 }, (_, index) => {
              const angle = (index / 10) * Math.PI * 2;
              const style = {
                background: burst.color,
                boxShadow: `0 0 6px ${burst.color}`,
                animationDelay: `${burst.delay}s`,
                "--sx": `${Math.round(Math.cos(angle) * 36)}px`,
                "--sy": `${Math.round(Math.sin(angle) * 36) - 12}px`,
              } as CSSProperties;
              return <span key={index} className="kw-spark" style={style} />;
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function SelectionBeacon() {
  return (
    <div className="kw-3d absolute" style={{ left: PLOT / 2, top: PLOT / 2, width: 0, height: 0 }}>
      <div className="kw-ring" style={{ left: -70, top: -70, width: 140, height: 140 }} />
      <div className="kw-beacon-plane" style={{ left: -5, top: 0, width: 10, height: 150 }} />
      <div className="kw-3d absolute" style={{ transform: "rotateZ(90deg)" }}>
        <div className="kw-beacon-plane" style={{ left: -5, top: 0, width: 10, height: 150 }} />
      </div>
    </div>
  );
}

// Five hand-picked liveries so the road doesn't read as identical clones —
// each is a body/side pair so the true-3D faces below get a consistent
// lit-top / shadow-side split, same convention as the building palettes.
const CAR_PALETTES = [
  { body: "#dc2626", side: "#7f1d1d", cabin: "#1c1917" }, // red
  { body: "#f8fafc", side: "#94a3b8", cabin: "#1e293b" }, // white
  { body: "#1e293b", side: "#0b1220", cabin: "#020617" }, // black
  { body: "#2563eb", side: "#1e3a8a", cabin: "#111827" }, // blue
  { body: "#cbd5e1", side: "#64748b", cabin: "#1e293b" }, // silver
];
// Buses use a civic/transit livery (saturated, branded colours a private
// car wouldn't wear) rather than the car palette, so they read as public
// transport at a glance even at this scale. Motorcycles reuse the car
// palette's body/side pair but skip the cabin tier entirely (no separate
// windshield tier on a bike) — see VEHICLE_DIMS' cabH: 0 below.
const BUS_PALETTES = [
  { body: "#f59e0b", side: "#b45309", cabin: "#1e293b" }, // amber transit
  { body: "#0d9488", side: "#115e59", cabin: "#1e293b" }, // teal transit
];

type VehicleKind = "car" | "bus" | "motorcycle";
// Per-kind footprint/tier sizing — width/depth given in the vehicle's own
// "unrotated" orientation (travel along the long axis); Car swaps them for
// the vertical case the same way it always has. wheelCount lets the
// motorcycle use 2 centreline wheels instead of the car/bus's 4 corners.
const VEHICLE_DIMS: Record<VehicleKind, { w: number; d: number; bodyH: number; cabH: number; cabInset: number; wheelSize: number; wheelCount: 2 | 4 }> = {
  car: { w: 20, d: 10, bodyH: 3, cabH: 3, cabInset: 5, wheelSize: 4, wheelCount: 4 },
  bus: { w: 32, d: 12, bodyH: 7, cabH: 4, cabInset: 3, wheelSize: 4, wheelCount: 4 },
  motorcycle: { w: 8, d: 4, bodyH: 2, cabH: 0, cabInset: 1, wheelSize: 2.5, wheelCount: 2 },
};

// parkedAt (an along-axis pixel offset) switches Car into a static
// roadside-parking render: no kw-car/-v animation class at all, both axes
// fixed directly on the wrapper instead of cross-axis-only + an animated
// along-axis. Reuses the exact same body/cabin/wheel/light markup as a
// moving car — parked traffic filling out empty kerb space shouldn't look
// like a cheaper asset than the cars actually driving past it.
const Car = memo(function Car({ vertical, lane, dur, delay, rev, colorIdx = 0, kind = "car", parkedAt }: { vertical?: boolean; lane: number; dur?: number; delay?: number; rev?: boolean; colorIdx?: number; kind?: VehicleKind; parkedAt?: number }) {
  const isParked = parkedAt !== undefined;
  const dims = VEHICLE_DIMS[kind];
  const p = kind === "bus" ? BUS_PALETTES[colorIdx % BUS_PALETTES.length] : CAR_PALETTES[colorIdx % CAR_PALETTES.length];
  const elW = vertical ? dims.d : dims.w;
  const elH = vertical ? dims.w : dims.d;
  const bodyH = dims.bodyH;
  const cabH = dims.cabH;
  // Cabin is inset only along the travel axis (leaves a hood + trunk
  // overhang front/back), full width across the travel axis.
  const cabInset = dims.cabInset;
  const cabLeft = vertical ? 1 : cabInset;
  const cabTop = vertical ? cabInset : 1;
  const cabW = vertical ? elW - 2 : elW - cabInset * 2;
  const cabD = vertical ? elH - cabInset * 2 : elH - 2;
  const wheelSize = dims.wheelSize;
  const wheelOverhang = 1;
  const wheelZ = 1;
  // Motorcycle: 2 wheels on the travel-axis centreline (front + back)
  // instead of 4 corners — a corner-wheeled 8x4 box reads as a tiny car,
  // not a bike.
  const wheelCorners: Array<[number, number]> = dims.wheelCount === 2
    ? (vertical
        ? [[elW / 2 - wheelSize / 2, -wheelOverhang], [elW / 2 - wheelSize / 2, elH - wheelSize + wheelOverhang]]
        : [[-wheelOverhang, elH / 2 - wheelSize / 2], [elW - wheelSize + wheelOverhang, elH / 2 - wheelSize / 2]])
    : [
        [-wheelOverhang, -wheelOverhang],
        [elW - wheelSize + wheelOverhang, -wheelOverhang],
        [-wheelOverhang, elH - wheelSize + wheelOverhang],
        [elW - wheelSize + wheelOverhang, elH - wheelSize + wheelOverhang],
      ];
  // Direction of travel decides which short edge gets headlights vs
  // taillights — kw-drive-x/-y increase X/Y, the -rev variants decrease.
  const front = vertical ? (rev ? "top" : "bottom") : rev ? "left" : "right";
  const lightSize = 2.5;
  const frontLights: Array<[number, number]> =
    front === "right" ? [[elW - lightSize, 1.5], [elW - lightSize, elH - lightSize - 1.5]]
    : front === "left" ? [[0, 1.5], [0, elH - lightSize - 1.5]]
    : front === "bottom" ? [[1.5, elH - lightSize], [elW - lightSize - 1.5, elH - lightSize]]
    : [[1.5, 0], [elW - lightSize - 1.5, 0]];
  const rearLights: Array<[number, number]> =
    front === "right" ? [[0, 1.5], [0, elH - lightSize - 1.5]]
    : front === "left" ? [[elW - lightSize, 1.5], [elW - lightSize, elH - lightSize - 1.5]]
    : front === "bottom" ? [[1.5, 0], [elW - lightSize - 1.5, 0]]
    : [[1.5, elH - lightSize], [elW - lightSize - 1.5, elH - lightSize]];

  return (
    <div className="kw-3d absolute" style={{ ...(vertical ? { left: lane, top: isParked ? parkedAt : 0 } : { top: lane, left: isParked ? parkedAt : 0 }), transform: "translateZ(2px)", pointerEvents: "none" }}>
      <div
        className={isParked ? "" : `kw-car ${vertical ? "kw-car-v" : ""} ${rev ? "kw-car-rev" : ""}`}
        style={isParked ? { width: elW, height: elH } : { width: elW, height: elH, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
      >
        <div className="kw-3d absolute" style={{ left: 0, top: 0, width: elW, height: elH, transformStyle: "preserve-3d" }}>
          {/* light contact shadow, grounds the car regardless of camera angle */}
          <div className="absolute" style={{ left: -3, top: -2, width: elW + 6, height: elH + 4, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,0.45), transparent 72%)" }} />
          {/* body: true 3D box — top + south (lit) + east (shadow) faces */}
          <div className="absolute" style={{ left: 0, top: 0, width: elW, height: elH, background: p.body, transform: `translateZ(${bodyH}px)`, boxShadow: "0 0 3px rgba(0,0,0,0.4)" }} />
          <div className="absolute kw-face-lit" style={{ left: 0, top: elH, width: elW, height: bodyH, transformOrigin: "top", transform: "rotateX(90deg)", background: p.body }} />
          <div className="absolute kw-face-shadow" style={{ left: elW, top: 0, width: bodyH, height: elH, transformOrigin: "left", transform: "rotateY(-90deg)", background: p.side }} />
          {/* cabin: smaller tier stacked on the body roof, same true-3D pattern */}
          <div className="absolute" style={{ left: cabLeft, top: cabTop, width: cabW, height: cabD, background: p.cabin, transform: `translateZ(${bodyH + cabH}px)` }} />
          <div className="absolute kw-face-lit" style={{ left: cabLeft, top: cabTop + cabD, width: cabW, height: cabH, transformOrigin: "top", transform: `translateZ(${bodyH}px) rotateX(90deg)`, background: p.cabin }} />
          <div className="absolute kw-face-shadow" style={{ left: cabLeft + cabW, top: cabTop, width: cabH, height: cabD, transformOrigin: "left", transform: `translateZ(${bodyH}px) rotateY(-90deg)`, background: p.cabin }} />
          {/* wheels: 4 corners, slightly overhanging the body sides */}
          {wheelCorners.map(([wx, wy], wi) => (
            <div key={wi} className="absolute" style={{ left: wx, top: wy, width: wheelSize, height: wheelSize, borderRadius: "50%", background: "radial-gradient(circle, #1e293b 40%, #020617 100%)", transform: `translateZ(${wheelZ}px)`, boxShadow: "0 0 1px rgba(0,0,0,0.8)" }} />
          ))}
          {/* headlights (front) / taillights (rear) */}
          {frontLights.map(([lx, ly], li) => (
            <div key={`f${li}`} className="absolute kw-car-light" style={{ left: lx, top: ly, width: lightSize, height: lightSize, borderRadius: 1, background: "#fef9c3", transform: `translateZ(${bodyH / 2}px)`, boxShadow: "0 0 3px rgba(254,249,195,0.9)" }} />
          ))}
          {rearLights.map(([lx, ly], li) => (
            <div key={`r${li}`} className="absolute kw-car-light" style={{ left: lx, top: ly, width: lightSize, height: lightSize, borderRadius: 1, background: "#f87171", transform: `translateZ(${bodyH / 2}px)`, boxShadow: "0 0 3px rgba(248,113,113,0.8)" }} />
          ))}
        </div>
      </div>
    </div>
  );
});

// River boats sit at translateZ(1px) — below the bridge deck's translateZ(4px)
// — so a boat passing under a bridge is correctly occluded by the deck. The
// bob/wake animate on a nested child so they don't fight the outer .kw-boat's
// own translateY drive-along-the-river animation (two `transform` animations
// on the same element don't compose — the later one just wins each frame).
const Boat = memo(function Boat({ x, w, h, hullTop, hullBottom, dur, delay, rev }: { x: number; w: number; h: number; hullTop: string; hullBottom: string; dur: string; delay: string; rev?: boolean }) {
  const hullClip = rev
    ? "polygon(50% 0%, 100% 22%, 100% 85%, 50% 100%, 0% 85%, 0% 22%)"
    : "polygon(50% 100%, 100% 78%, 100% 15%, 50% 0%, 0% 15%, 0% 78%)";
  const wakeSide: "top" | "bottom" = rev ? "bottom" : "top";
  return (
    <div className="kw-3d absolute" style={{ left: x, top: 0, transform: "translateZ(1px)", pointerEvents: "none" }}>
      <div className={`kw-boat ${rev ? "kw-rev" : ""}`} style={{ width: w, height: h, animationDuration: dur, animationDelay: delay }}>
        <div className="kw-boat-bob absolute" style={{ left: 0, top: 0, width: w, height: h }}>
          <div className="kw-boat-hull absolute" style={{ inset: 0, clipPath: hullClip, background: `linear-gradient(180deg, ${hullTop}, ${hullBottom})` }} />
          <div className="kw-boat-wake absolute" style={{ left: w / 2 - 3, [wakeSide]: -3, width: 6, height: 6 }} />
          <div className="kw-boat-wake absolute" style={{ left: w / 2 - 2, [wakeSide]: -9, width: 4, height: 4, animationDelay: "0.5s" }} />
        </div>
      </div>
    </div>
  );
});

// LRT/MRT train following the west-entry-to-north-exit route (see the
// ROUTE_P0..P3 waypoints in City3DMap). Position is driven entirely by the
// kw-drive-l/-l-rev keyframes, which read 8 --kw-lrt-x/y0..3 custom
// properties — translate(x,y) at each of the 4 waypoints, CSS linearly
// interpolating in between, which is exactly the straight line each leg/
// chamfer already is. Each train instance sets its OWN copy of those 8
// properties inline on its outer wrapper (shadowing whatever .kw-world
// declares), which is what gives the two directions their own parallel
// lane — see FWD_ROUTE/REV_ROUTE in City3DMap. The animated element
// (.kw-train-path) must not directly parent the rotateX/rotateY face divs —
// same "animating transform on an element that's itself an ancestor of
// further 3D-positioned content" flattening bug noted on .kw-world above.
// Car works around it with an inner static preserve-3d wrapper between the
// animated box and its true-3D faces; this mirrors that. The box keeps its
// default north/south-heading proportions through the whole route rather
// than rotating to face the current leg — a deliberate scope cut, not a bug.
const TRAIN_CAR_COUNT = 3;
const TRAIN_CAR_LEN = 19;
const TRAIN_CAR_GAP = 3;
const TRAIN_W = 14;
// Wall height was 10px against a 14x19 footprint — visibly squatter than
// its width, which read as a flat slab ("leper") rather than a boxy train
// car once the roof cap dominated the silhouette. Bumped closer to the
// width for a proper box cross-section, matching real LRT rolling stock's
// roughly-square profile.
const TRAIN_WALL_H = 15;
// Total consist length spans all carriages + the gaps between them — this
// is the moving element's own footprint, so the path animation carries the
// whole consist as one rigid body (all carriages share the single outer
// transform; only their positions within it are fixed offsets).
const TRAIN_LEN = TRAIN_CAR_COUNT * TRAIN_CAR_LEN + (TRAIN_CAR_COUNT - 1) * TRAIN_CAR_GAP;

interface RoutePoint { x: number; y: number }
interface TransitRoute { p0: RoutePoint; p1: RoutePoint; p2: RoutePoint; p3: RoutePoint }

// Forward heading (CSS rotate() degrees) at each of the 4 waypoints — see
// the kw-drive-l/-l-rev comment in globals.css for the full derivation and
// why the -rev keyframe can reuse these same 4 numbers (+180deg) instead of
// needing its own set. Defaults to "never turns" (straight route, e.g.
// Line 2) so callers that don't pass `rot` keep the old fixed-heading
// behaviour rather than silently rotating to 0.
const NO_TURN: [number, number, number, number] = [0, 0, 0, 0];

const TransitTrain = memo(function TransitTrain({ z, dur, delay, rev, route, rot = NO_TURN }: { z: number; dur: string; delay?: string; rev?: boolean; route: TransitRoute; rot?: [number, number, number, number] }) {
  // Rotation used to interpolate from r1 to r2 across the ENTIRE 40%-60%
  // chamfer window (same span as the p1->p2 position lerp) — meaning for
  // most of that window the box's heading didn't match its actual direction
  // of travel (they only agreed exactly at the 50% midpoint). For a long,
  // narrow consist (63x14px) on a narrow deck (34px), that mismatch swings
  // the far end of the box past the deck's edge — most visibly right as it
  // commits to the new leg, which read as the train "leaving the track"
  // when turning onto the vertical leg. Fix: keep the box's heading pinned
  // to each leg's own constant heading for as much of the chamfer as
  // possible, and only let it swing through the turn over a short window
  // tight around the corner's own pivot point (p1a/p1b, 30%/70% along the
  // p1->p2 chamfer) — the same visual turn, over much less distance, so any
  // momentary overhang is small instead of spanning the whole corner.
  const p1a = { x: route.p1.x + (route.p2.x - route.p1.x) * 0.3, y: route.p1.y + (route.p2.y - route.p1.y) * 0.3 };
  const p1b = { x: route.p1.x + (route.p2.x - route.p1.x) * 0.7, y: route.p1.y + (route.p2.y - route.p1.y) * 0.7 };
  const routeVars = {
    ["--kw-lrt-x0" as string]: `${route.p0.x}px`, ["--kw-lrt-y0" as string]: `${route.p0.y}px`,
    ["--kw-lrt-x1" as string]: `${route.p1.x}px`, ["--kw-lrt-y1" as string]: `${route.p1.y}px`,
    ["--kw-lrt-x1a" as string]: `${p1a.x}px`, ["--kw-lrt-y1a" as string]: `${p1a.y}px`,
    ["--kw-lrt-x1b" as string]: `${p1b.x}px`, ["--kw-lrt-y1b" as string]: `${p1b.y}px`,
    ["--kw-lrt-x2" as string]: `${route.p2.x}px`, ["--kw-lrt-y2" as string]: `${route.p2.y}px`,
    ["--kw-lrt-x3" as string]: `${route.p3.x}px`, ["--kw-lrt-y3" as string]: `${route.p3.y}px`,
    ["--kw-lrt-r0" as string]: `${rot[0]}deg`, ["--kw-lrt-r1" as string]: `${rot[1]}deg`,
    ["--kw-lrt-r2" as string]: `${rot[2]}deg`, ["--kw-lrt-r3" as string]: `${rot[3]}deg`,
  };
  return (
    <div className="kw-3d absolute" style={{ left: 0, top: 0, transform: `translateZ(${z}px)`, pointerEvents: "none", ...routeVars }}>
      <div className={`kw-train-path ${rev ? "kw-train-path-rev" : ""}`} style={{ width: TRAIN_W, height: TRAIN_LEN, animationDuration: dur, animationDelay: delay }}>
        <div className="kw-3d absolute" style={{ left: 0, top: 0, width: TRAIN_W, height: TRAIN_LEN, transformStyle: "preserve-3d" }}>
          {/* Contact glow: a soft cyan halo under the whole consist, always
              on (not gated to night like street lamps) — a plain small box
              this size otherwise reads as random city clutter rather than
              "this is the transit line" at a glance. Kept tight to the
              consist's own footprint (was +24px/blur 2px, ballooning into a
              soft blob from top-down camera angles that swallowed the train
              body itself) — a thinner, lower-opacity halo reads as "glow
              coming off a train" instead of "glowing puddle with a train
              somewhere inside it". */}
          <div className="absolute" style={{ left: -5, top: -5, width: TRAIN_W + 10, height: TRAIN_LEN + 10, borderRadius: 6, background: "radial-gradient(ellipse, rgba(56,189,248,0.5), transparent 78%)", filter: "blur(1px)" }} />
          {Array.from({ length: TRAIN_CAR_COUNT }, (_, i) => {
            const carTop = i * (TRAIN_CAR_LEN + TRAIN_CAR_GAP);
            // Real LRT rolling stock (Kelana Jaya/Ampang line included) runs
            // bidirectionally with a driving cab at BOTH ends of the
            // consist — so both end carriages get the tapered cab-window
            // treatment, not just whichever end happens to be leading right
            // now. isLead only decides which cab's headlight is lit.
            const isCabEnd = i === 0 || i === TRAIN_CAR_COUNT - 1;
            const isLead = rev ? i === TRAIN_CAR_COUNT - 1 : i === 0;
            const frontY = rev ? carTop : carTop + TRAIN_CAR_LEN;
            return (
              // kw-3d (transform-style: preserve-3d) is required here, not just
              // "absolute" — without it this per-car wrapper defaults to "flat"
              // and flattens every rotateX/rotateY/translateZ face below onto
              // its own 2D plane before the camera's 3D transform ever sees it,
              // which is exactly what made the whole consist render as a flat
              // glowing sliver instead of a boxy carriage.
              <div key={i} className="kw-3d absolute" style={{ left: 0, top: carTop, width: TRAIN_W, height: TRAIN_CAR_LEN }}>
                {/* south end-cap: a plain coupler face between cars, or a
                    tapered windshield (clip-path wedge) on the 2 true ends —
                    this is what gives the consist an actual nose instead of
                    every carriage reading as an identical repeated box. */}
                <div
                  className="absolute kw-face-lit"
                  style={{
                    left: 0, top: TRAIN_CAR_LEN, width: TRAIN_W, height: TRAIN_WALL_H,
                    transformOrigin: "top", transform: "rotateX(90deg)",
                    background: isCabEnd ? "linear-gradient(180deg, #0c4a6e, #082f49)" : "#0ea5e9",
                    clipPath: isCabEnd ? "polygon(18% 0, 82% 0, 100% 100%, 0 100%)" : undefined,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
                  }}
                />
                {/* east long side: the primary window+livery face — this was
                    previously a flat solid colour with the window texture
                    misapplied to the roof cap instead (barely visible at
                    this camera's angle), which is why the train read as a
                    featureless box. A 2-tone livery (silver body, dark
                    window band, gold seam) matches how the RapidKL LRT
                    lines actually look while reusing the app's own gold
                    accent instead of a random brand colour. */}
                <div className="absolute kw-face-shadow" style={{ left: TRAIN_W, top: 0, width: TRAIN_WALL_H, height: TRAIN_CAR_LEN, transformOrigin: "left", transform: "rotateY(-90deg)", background: "#0ea5e9", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" }}>
                  <div className="absolute" style={{ left: 0, right: 0, top: "8%", height: "40%", background: "repeating-linear-gradient(90deg, rgba(8,47,73,0.95) 0 4px, rgba(186,230,253,0.7) 4px 4.8px, rgba(8,47,73,0.95) 4.8px 8px)" }} />
                  <div className="absolute" style={{ left: 0, right: 0, top: "50%", height: 2, background: "var(--gold, #f0a500)", boxShadow: "0 0 3px rgba(240,165,0,0.8)" }} />
                  <div className="absolute" style={{ left: 0, right: 0, top: "57%", bottom: 0, background: "linear-gradient(180deg, #38bdf8, #0369a1)" }} />
                </div>
                {/* roof: the side livery band is still the primary face, but
                    from the camera's mostly-overhead angle (and especially
                    zoomed out) the roof is what's actually on-screen most of
                    the time, and a flat gradient cap read as anonymous city
                    clutter against nearby light-coloured rooftops — easy to
                    lose entirely under the contact glow. A centred gold seam
                    (matching the side band's own accent) plus a brighter
                    highlight edge gives the roof its own legible silhouette
                    without needing extra DOM nodes. */}
                <div
                  className="absolute"
                  style={{
                    left: 0, top: 0, width: TRAIN_W, height: TRAIN_CAR_LEN,
                    transform: `translateZ(${TRAIN_WALL_H}px)`,
                    background:
                      "linear-gradient(90deg, transparent 0 42%, var(--gold, #f0a500) 42% 58%, transparent 58% 100%), " +
                      "linear-gradient(180deg, #bae6fd, #7dd3fc 30%, #0284c7)",
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
                  }}
                />
                {/* coupler: a short dark connector bridging the gap to the
                    next carriage, so the gap reads as a mechanical joint
                    instead of a random slice missing out of the consist. */}
                {i < TRAIN_CAR_COUNT - 1 && (
                  <div className="absolute" style={{ left: TRAIN_W * 0.3, top: TRAIN_CAR_LEN, width: TRAIN_W * 0.4, height: TRAIN_CAR_GAP, background: "#1e293b", transform: `translateZ(${TRAIN_WALL_H * 0.4}px)` }} />
                )}
                {/* headlight: only on the currently-leading cab, so the
                    consist visibly has a direction instead of both ends
                    glowing regardless of travel. */}
                {isLead && (
                  <div
                    className="absolute kw-blink"
                    style={{
                      left: TRAIN_W / 2 - 2,
                      top: frontY - 2,
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "#fef9c3",
                      boxShadow: "0 0 6px 2px rgba(254,249,195,0.9)",
                      transform: "translateZ(3px)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// A single elevated-viaduct support column: true-3D wall-hinge (south+east
// face) convention, same as building walls and the road bridge piers.
const TransitPylon = memo(function TransitPylon({ left, top, deckZ }: { left: number; top: number; deckZ: number }) {
  return (
    <div className="kw-3d absolute" style={{ left, top, width: 10, height: 10 }}>
      <div className="absolute kw-face-lit" style={{ left: 0, top: 10, width: 10, height: deckZ - 2, transformOrigin: "top", transform: "rotateX(90deg)", background: "linear-gradient(180deg, #64748b, #334155)" }} />
      <div className="absolute kw-face-shadow" style={{ left: 10, top: 0, width: deckZ - 2, height: 10, transformOrigin: "left", transform: "rotateY(-90deg)", background: "linear-gradient(90deg, #334155, #1e293b)" }} />
    </div>
  );
});

// An LRT/MRT platform: low slab + 2-pole canopy + a name-tag billboard,
// centred on (x, y) so it can sit beside either a horizontal or vertical
// deck run without needing an axis-specific variant. Plus a ground-level
// entrance accent (thin glowing shaft from street to platform, same "thin
// primitive spanning the full deck height" pattern TransitPylon already
// proves safe against this scene's perspective-culling bug — see the deck
// segmentation comment above) so the station reads as connected down to
// street level instead of floating with no way up.
const TransitStation = memo(function TransitStation({ x, y, deckZ, tag }: { x: number; y: number; deckZ: number; tag: string }) {
  return (
    <div className="kw-3d absolute" style={{ left: x - 27, top: y - 15, width: 54, height: 30 }}>
      <div className="absolute kw-face-lit" style={{ left: 0, top: 30, width: 54, height: 9, transformOrigin: "top", transform: `translateZ(${deckZ}px) rotateX(90deg)`, background: "linear-gradient(180deg, #cbd5e1, #64748b)" }} />
      <div className="absolute kw-face-shadow" style={{ left: 54, top: 0, width: 9, height: 30, transformOrigin: "left", transform: `translateZ(${deckZ}px) rotateY(-90deg)`, background: "linear-gradient(90deg, #64748b, #334155)" }} />
      <div className="absolute" style={{ left: 0, top: 0, width: 54, height: 30, background: "linear-gradient(135deg, #e2e8f0, #94a3b8)", border: "1px solid rgba(30,41,59,0.4)", transform: `translateZ(${deckZ + 9}px)` }} />
      {/* entrance shaft: a slim glowing glass-and-steel column from street
          level up to the platform underside, at the platform's own SW
          corner — off the pylons' own x/y crossings (stations sit at LEG
          MIDPOINTS, pylons at road crossings) so it can't collide with a
          real support column. Reuses TransitPylon's proven-safe thin-column
          shape rather than the plain-concrete finish, so it reads as glass/
          lit rather than another structural pier. */}
      <div className="kw-3d absolute" style={{ left: -2, top: 26, width: 8, height: 8 }}>
        <div className="absolute kw-face-lit" style={{ left: 0, top: 8, width: 8, height: deckZ - 2, transformOrigin: "top", transform: "rotateX(90deg)", background: "linear-gradient(180deg, rgba(125,211,252,0.5), rgba(8,47,73,0.65))", boxShadow: "0 0 6px rgba(56,189,248,0.4)" }} />
        <div className="absolute kw-face-shadow" style={{ left: 8, top: 0, width: deckZ - 2, height: 8, transformOrigin: "left", transform: "rotateY(-90deg)", background: "linear-gradient(90deg, rgba(14,116,144,0.55), rgba(8,47,73,0.7))" }} />
      </div>
      {/* canopy: a slim overhanging roof on 2 thin poles, held above the
          platform slab. A centred gold ridge (matching the train's own gold
          seam, tying the two structures together as one transit system) and
          brighter, steady edge glow — the previous flat translucent panel
          all but disappeared into the skyline at normal play zoom; a bare
          rectangle also read as generic rather than specifically a canopy. */}
      <div className="absolute" style={{ left: 6, top: 6, width: 2, height: 16, transformOrigin: "top", transform: `translateZ(${deckZ + 9}px) rotateX(90deg)`, background: "#334155" }} />
      <div className="absolute" style={{ left: 46, top: 6, width: 2, height: 16, transformOrigin: "top", transform: `translateZ(${deckZ + 9}px) rotateX(90deg)`, background: "#334155" }} />
      <div
        className="absolute"
        style={{
          left: -6, top: -4, width: 66, height: 22, borderRadius: 3,
          background:
            "linear-gradient(90deg, transparent 0 46%, var(--gold, #f0a500) 46% 54%, transparent 54% 100%), " +
            "linear-gradient(135deg, rgba(186,230,253,0.65), rgba(14,116,144,0.6))",
          border: "1px solid rgba(186,230,253,0.75)",
          boxShadow: "0 0 8px rgba(56,189,248,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
          transform: `translateZ(${deckZ + 25}px)`,
        }}
      />
      {/* billboard: a small always-on transit dot ahead of the line tag —
          steady, not the aircraft-warning kw-blink used elsewhere, since
          this needs to read as "here's the station" at a glance rather than
          intermittently. */}
      <div className="kw-3d absolute" style={{ left: 27, top: -8, width: 0, height: 0, transform: `translateZ(${deckZ + 27}px)` }}>
        <div className="kw-bill">
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
            style={{ background: "rgba(3,8,15,0.85)", color: "#e0f2fe", border: "1px solid rgba(125,211,252,0.6)", boxShadow: "0 0 6px rgba(56,189,248,0.4)" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#7dd3fc", boxShadow: "0 0 4px 1px rgba(125,211,252,0.9)" }} />
            {tag}
          </span>
        </div>
      </div>
    </div>
  );
});

// A surveyed-but-undeveloped grid cell: flat ground with just a faint plot
// outline, no building/stats/click handler — visually distinct from an
// actual Zone without pulling in the full ZonePlot machinery.
const EmptyPlot = memo(function EmptyPlot({ col, row, gridSize }: { col: number; row: number; gridSize: number }) {
  const PLOT_XY = plotXY(gridSize);
  return (
    <div className="kw-3d absolute" style={{ left: PLOT_XY[col], top: PLOT_XY[row], width: PLOT, height: PLOT, pointerEvents: "none" }}>
      <div className="absolute" style={{ inset: 18, border: "1px dashed rgba(148,163,184,0.16)" }} />
    </div>
  );
});

// memo() below relies on every prop here being referentially stable across
// unrelated re-renders of the parent (tod/weather toggles, hover on a
// different zone, etc.) so this only actually re-renders when something
// about THIS zone changed: onSelect is the raw setSelectedZoneId setter
// (not a fresh per-zone closure) and movedRef is a stable ref, both from
// City3DMap; zone/traits/lang are themselves stable/memoized upstream.
const ZonePlot = memo(function ZonePlot({ zone, selected, onSelect, movedRef, lang, col, row, gridSize, density, traits, celebrating }: { zone: Zone; selected: boolean; onSelect: (id: string) => void; movedRef: MutableRefObject<boolean>; lang: ReturnType<typeof useLang>; col: number; row: number; gridSize: number; density: number; traits: SeatTraits; celebrating: number }) {
  const PLOT_XY = plotXY(gridSize);
  const buildings = useMemo(() => zoneBuildings(zone, density, traits), [zone, density, traits]);
  const [hovered, setHovered] = useState(false);
  const weakest = weakestStat(zone);
  // zone-0 is always "Pusat Bandar"/Town Centre (see makeZones) — the one
  // zone.kind==="urban" guarantees the extra skyscrapers in zoneBuildings.
  // It ends up visibly taller than every other zone by design (it's the
  // seat's admin hub, not a stray size accident), so it gets a persistent
  // landmark beacon marking that on purpose — every other zone's height
  // still only reflects its own infra/welfare/economy stats.
  const isPrimary = zone.id === "zone-0";
  // Label floats above the tallest roof in the zone, not at a fixed height,
  // so skyscraper zones don't bury their own label under their buildings.
  const tallest = Math.max(30, ...buildings.map((spec) => spec.h));
  const labelZ = tallest + 30;
  // Twin skyscrapers side by side get a KLCC-style skybridge
  const skyscrapers = buildings.filter((spec) => spec.type === "skyscraper").sort((a, b) => a.slot - b.slot);
  const twin = skyscrapers.length >= 2 && skyscrapers[1].slot - skyscrapers[0].slot === 1 && Math.floor(skyscrapers[0].slot / 3) === Math.floor(skyscrapers[1].slot / 3) ? skyscrapers : null;
  // Smooth score tint shared by the ground tile border/glow and every
  // building's roof accent in this zone — computed once per zone here
  // rather than per building, since it only depends on zone.sentiment.
  const scoreRgb = scoreTintRGB(zone.sentiment);
  const critical = zone.sentiment < 54;
  return (
    <div className="kw-3d absolute" style={{ left: PLOT_XY[col], top: PLOT_XY[row], width: PLOT, height: PLOT }}>
      <button
        type="button"
        onClick={() => { if (!movedRef.current) onSelect(zone.id); }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        aria-label={zoneName(lang, zone)}
        className={`kw-zone kw-grassy ${selected ? "kw-zone-sel" : ""} ${hovered ? "kw-zone-hov" : ""} ${critical ? "kw-zone-critical" : ""}`}
        style={{
          background: zoneGround(zone.kind),
          "--kw-zone-score": `rgba(${scoreRgb},0.5)`,
          "--kw-zone-score-glow": `rgba(${scoreRgb},0.16)`,
        } as CSSProperties}
      >
        <span className="absolute left-0 right-0 block" style={{ top: PLOT / 2 - 6, height: 12, background: "rgba(148,163,184,0.15)" }} />
        <span className="absolute bottom-0 top-0 block" style={{ left: PLOT / 2 - 6, width: 12, background: "rgba(148,163,184,0.15)" }} />
        {/* Sidewalk/kerb: a light concrete strip along the plot's own
            south+east edges (the two faces the camera convention already
            treats as "road-facing"), inset entirely within this tile's own
            footprint — the road/plot pitch (ROAD_GAP 280 vs PLOT 240) has
            zero spare width to steal a strip from the road side without
            reflowing every zone position, so this reads as a curb without
            needing any of that. The first gradient layer draws thin paver
            joints across the strip so it reads as laid slabs, distinct from
            zoneGround's per-kind dirt/asphalt colouring rather than just a
            paler band of it. */}
        <span className="absolute left-0 right-0 bottom-0 block" style={{ height: 5, background: "repeating-linear-gradient(90deg, transparent 0 13px, rgba(71,85,105,0.45) 13px 14px), linear-gradient(180deg, rgba(226,232,240,0.55), rgba(148,163,184,0.3))" }} />
        <span className="absolute top-0 bottom-0 right-0 block" style={{ width: 5, background: "repeating-linear-gradient(0deg, transparent 0 13px, rgba(71,85,105,0.45) 13px 14px), linear-gradient(90deg, rgba(226,232,240,0.45), rgba(148,163,184,0.25))" }} />
        {zone.kind === "river" && <span className="kw-water absolute block" style={{ left: -1, right: -1, top: "40%", height: 34, opacity: 0.9 }} />}
      </button>
      {buildings.map((spec, index) => <Building3D key={`${zone.id}-${spec.slot}-${spec.type}-${index}`} spec={spec} scoreColor={scoreRgb} />)}
      {/* Parking pads: a small asphalt apron on the south (open-ground) side
          of 1-2 retail buildings — commercial/market/urban only (see
          PARKING_ZONE_KINDS) and deliberately not one per shop, so the plot
          doesn't fill with tarmac. Flat tile at a low translateZ, same
          ground-plane technique as the shophouse five-foot-way and the
          plaza flatTile; the asphalt + faint bay-line read is a
          repeating-linear-gradient (cf. warehouse's roof texture), no
          filter cost. Pure ground cosmetic — reads the already-computed
          buildings list and their (possibly jittered) footprints, touches
          no PLOT/ROAD_GAP/slotPos layout math. Pad stays inside its host
          slot's own 72px cell: y + d + 2 + 12 clears the next slot row even
          at max footprint jitter. */}
      {PARKING_ZONE_KINDS.has(zone.kind) && (() => {
        const retail = buildings.filter((b) => PARKING_HOST_TYPES.has(b.type));
        if (!retail.length) return null;
        const s = seedFrom(zone.id);
        // Stable pick of host buildings; 2 pads only once a plot has enough
        // retail to spare, otherwise just 1.
        const idx = Array.from(new Set([s % retail.length, (s + Math.ceil(retail.length / 2)) % retail.length])).slice(0, retail.length >= 3 ? 2 : 1);
        return idx.map((i) => {
          const b = retail[i];
          const { x, y } = slotPos(b.slot);
          return (
            <div key={`park-${b.slot}`} className="kw-3d absolute" style={{ left: x - 3, top: y + b.d + 2, width: b.w + 6, height: 12, pointerEvents: "none" }}>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 13px), " +
                    "repeating-linear-gradient(0deg, #3f3f46 0 6px, #2f2f35 6px 12px)",
                  border: "1px solid rgba(0,0,0,0.4)",
                  borderRadius: 2,
                  transform: "translateZ(1px)",
                }}
              />
            </div>
          );
        });
      })()}
      {twin && (() => {
        const left = slotPos(twin[0].slot).x + twin[0].w;
        const width = slotPos(twin[1].slot).x - left;
        const top = slotPos(twin[0].slot).y + twin[0].d / 2 - 5;
        const z = Math.round(twin[0].h * 0.42);
        return (
          <div className="kw-3d absolute" style={{ left, top, width, height: 10, pointerEvents: "none" }}>
            <div className="absolute inset-0" style={{ transform: `translateZ(${z + 6}px)`, background: "linear-gradient(90deg, #cbd5e1, #64748b)", border: "1px solid rgba(255,255,255,0.3)", transition: FACE_TRANSITION }} />
            <div className="absolute" style={{ left: 0, top: 10, width, height: 6, transformOrigin: "top", transform: `translateZ(${z + 6}px) rotateX(90deg)`, background: "linear-gradient(0deg, #334155, #94a3b8)", transition: FACE_TRANSITION }} />
          </div>
        );
      })()}
      {isPrimary && (
        <div className="kw-3d absolute" style={{ left: PLOT / 2, top: PLOT / 2, width: 0, height: 0, transform: `translateZ(${tallest + 16}px)` }}>
          <div className="kw-bill">
            <span className="kw-landmark" />
          </div>
        </div>
      )}
      {selected && <SelectionBeacon />}
      {celebrating > 0 && <Fireworks key={celebrating} />}
      {/* leader line + label: anchored on the road below the plot, the pole rises in true 3D
          past the tallest roof in this zone so the billboard floats above the skyline instead
          of sitting at ground level, where rotation lets nearer buildings slide over it */}
      <div className="kw-3d absolute" style={{ left: PLOT / 2 - 1, top: PLOT + 16, width: 2, height: labelZ, transformOrigin: "top", transform: "rotateX(90deg)", background: `linear-gradient(180deg, transparent, ${selected ? "rgba(250,204,21,0.65)" : "rgba(125,211,252,0.5)"})`, transition: FACE_TRANSITION }} />
      <div className="kw-3d absolute" style={{ left: PLOT / 2 - 3, top: PLOT + 16 - 3, width: 6, height: 6, borderRadius: "50%", transform: "translateZ(2px)", background: selected ? "var(--gold)" : "#7dd3fc", boxShadow: `0 0 6px ${selected ? "rgba(250,204,21,0.8)" : "rgba(125,211,252,0.8)"}` }} />
      {/* Name+stats label only renders for the selected zone now — every
          zone showing its card at once (regardless of zoom) buried the map
          under 9+ overlapping labels. Click-gated instead of the old
          zoom-based opacity fade, so it needs no CSS var wiring: it simply
          isn't in the tree until this zone is selected. */}
      {selected && (
        <div className="kw-3d absolute" style={{ left: PLOT / 2, top: PLOT + 16, width: 0, height: 0, transform: `translateZ(${labelZ}px)` }}>
          <div className="kw-bill">
            <div className="flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5" style={{ background: "rgba(3,8,15,0.9)", borderColor: "var(--gold)" }}>
              <div>
                <div className="text-[9px] font-black tracking-[0.1em]" style={{ color: "var(--gold)" }}>{zoneIcon(zone.kind)} {zoneName(lang, zone)}</div>
                <div className="mt-0.5 text-[7px] font-bold tracking-wider" style={{ color: "rgba(148,163,184,0.85)" }}>INF {zone.infra} · RKT {zone.welfare} · EKO {zone.economy}</div>
              </div>
              <div className="text-base font-black leading-none" style={{ color: metricColor(zone.sentiment) }}>{zone.sentiment}</div>
              {zone.projects.length > 0 && <div className="rounded-full border px-1 py-0.5 text-[7px] font-black" style={{ borderColor: "rgba(0,255,136,0.5)", color: "#4ade80", background: "rgba(0,255,136,0.1)" }}>LV{zone.projects.length + 1}</div>}
            </div>
          </div>
        </div>
      )}
      {/* hover tooltip: anchored on the north edge so it never stacks on the
          persistent label, which hangs off the south edge of the same plot */}
      {hovered && (
        <div className="kw-3d absolute" style={{ left: PLOT / 2, top: -18, width: 0, height: 0, transform: `translateZ(${labelZ + 26}px)`, pointerEvents: "none" }}>
          <div className="kw-bill">
            {/* scene-palette colours, not theme vars: the 3D city keeps a fixed
                dark artwork palette in both light and dark app themes */}
            <div className="kw-tip rounded-sm border px-2 py-1" style={{ background: "rgba(3,8,15,0.94)", borderColor: "rgba(125,211,252,0.75)", boxShadow: "0 0 16px rgba(125,211,252,0.35)" }}>
              <div className="text-[9px] font-black tracking-[0.1em]" style={{ color: "#7dd3fc" }}>{zoneIcon(zone.kind)} {zoneName(lang, zone)}</div>
              <div className="mt-0.5 text-[8px] font-bold tracking-wider" style={{ color: "rgba(148,163,184,0.9)" }}>
                {t(lang, "kawasan_page.sentiment")} <span style={{ color: metricColor(zone.sentiment) }}>{zone.sentiment}</span>
              </div>
              <div className="text-[8px] font-bold tracking-wider" style={{ color: "#fbbf24" }}>
                {t(lang, "kawasan_page.mostNeeded")}: {statLabel(lang, weakest)} {zone[weakest]}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const TOD_SEQUENCE = ["dusk", "night", "day"] as const;
type Tod = (typeof TOD_SEQUENCE)[number];
const TOD_ICON: Record<Tod, string> = { day: "☀", dusk: "🌆", night: "🌙" };
// Matches the scene to the player's actual local clock on load — roughly
// Malaysia's real sunrise/sunset (~7am/~7pm) with a one-hour dusk window
// right after sunset, rather than always opening on a fixed "dusk" preset.
// The 🕐/☀/🌆/🌙 toggle button still lets the player override it manually
// afterwards; this only sets where the scene starts.
function todFromClientHour(hour: number): Tod {
  if (hour >= 7 && hour < 19) return "day";
  if (hour >= 19 && hour < 20) return "dusk";
  return "night";
}

const CAM_DEFAULT = { rz: 45, rx: 57, zoom: 0.9 };
const MINIMAP_CELL = 12;

// memo()'d because KawasanDevelopmentPage re-renders on unrelated local
// state (manifesto textarea keystrokes, the notice toast, etc.) — every
// prop below is stable/value-equal across those (zones/gridSize/density/
// traits derive from the fixed seat, lang is a stable string from the
// uiStore selector, setSelectedZoneId is the raw setState fn), so memo
// lets City3DMap bail out of that entirely instead of re-running its full
// body (which recreates the JSX for every zone, junction, car, etc.) and
// re-diffing ~144 ZonePlot children on every keystroke elsewhere on the
// page.
const City3DMap = memo(function City3DMap({ zones, selectedZoneId, setSelectedZoneId, lang, gridSize, density, densityLabel, traits, celebration, overall }: { zones: Zone[]; selectedZoneId: string; setSelectedZoneId: (id: string) => void; lang: ReturnType<typeof useLang>; gridSize: number; density: number; densityLabel: string; traits: SeatTraits; celebration: { zoneId: string; at: number } | null; overall: number }) {
  const ROADS_V = roadsV(gridSize);
  const ROADS_H = roadsH(gridSize);
  const WORLD = gridSize * ROAD_GAP + 40;
  const RIVER_X = gridSize * ROAD_GAP;
  // Decorative-only scale factor for edge dressing (hills/paddy/perimeter
  // vegetation) authored for the original fixed 3x3 (WORLD=880) block — keeps
  // them hugging the new edge proportionally without resizing the actual
  // zone tiles/buildings, which stay a constant PLOT regardless of city size.
  const k = WORLD / 880;
  // Cars/boats/trains now travel the real WORLD length (see --kw-drive-len
  // above) instead of a fixed distance authored for the original 3x3 grid —
  // without also scaling duration, a big metro grid would make every
  // vehicle whiz past at several times its old speed. Reusing k (the same
  // WORLD/880 ratio already driving every other piece of edge decoration)
  // keeps apparent px/sec speed roughly constant across grid sizes instead
  // of introducing a new, unrelated scale factor.
  const sc = (seconds: number) => `${(seconds * k).toFixed(1)}s`;
  // LRT/MRT viaduct — metro/dense-metro seats only. Gated on density (not
  // areaType directly; City3DMap only receives the already-areaType-clamped
  // density) so it lines up with the same METRO threshold densityLabel
  // itself uses, rather than a second cutoff to keep in sync.
  //
  // Routed through the town centre rather than hugging the empty west
  // margin (the first version of this feature): enters from the west edge,
  // runs east along a middle row, bends near downtown — right past
  // "Pusat Bandar", which assignZonePositions always seats at the grid
  // centre — and continues north out the top edge. The bend is a single
  // 45deg chamfer rather than a sharp right angle, reading as a curve
  // without needing real arc geometry.
  const showTransit = density >= 0.62;
  // Widened from the original 24 — a single centreline was fine for the
  // deck/pylons, but the two train directions need enough room either side
  // of it for their own offset lane (see FWD_ROUTE/REV_ROUTE below) without
  // poking past the deck edge.
  const TRACK_W = 34;
  const TRACK_DECK_Z = 58;
  const ROUTE_Y = ROADS_H[Math.floor(ROADS_H.length / 2)];
  const ROUTE_X = ROADS_V[Math.floor(ROADS_V.length / 2)];
  // Corner radius: MUST stay within the road's own half-width (TRACK_W/2)
  // or the chamfer cuts diagonally across the block it's turning at — and
  // that block is guaranteed to be downtown ("Pusat Bandar", always seated
  // at the grid centre, right where ROUTE_X/ROUTE_Y put this bend) with the
  // seat's tallest buildings. The deck sits at a fixed, modest TRACK_DECK_Z
  // (58px) — far below what a skyscraper can grow to (150 + economy*1.2,
  // 250px+) — so with no real depth buffer, a chamfer that strays past the
  // road into that plot doesn't clip *behind* the tower, it paints straight
  // through it (DOM order puts the transit layer after zones specifically
  // so it's visible over low buildings — see that render-site comment —
  // which backfires the moment the deck's own path leaves the road). A
  // radius previously up to 90px (rounding up toward the block's own 240px
  // plot) guaranteed this collision; keeping it inside TRACK_W/2 minus a
  // safety margin keeps the whole curve — including the bend — physically
  // over the road at every point, the one place no building ever occupies,
  // regardless of building height.
  const CORNER_R = Math.max(8, TRACK_W / 2 - 3);
  const ROUTE_P0 = { x: -40, y: ROUTE_Y };
  const ROUTE_P1 = { x: ROUTE_X - CORNER_R, y: ROUTE_Y };
  const ROUTE_P2 = { x: ROUTE_X, y: ROUTE_Y - CORNER_R };
  const ROUTE_P3 = { x: ROUTE_X, y: -40 };
  // Deck segment boundaries for each straight leg — one block per pylon
  // crossing, see the deck's own render-site comment for why this can't be
  // a single spanning div.
  const LEG1_BOUNDS = [ROUTE_P0.x, ...ROADS_V.filter((x) => x > ROUTE_P0.x && x < ROUTE_P1.x), ROUTE_P1.x];
  const LEG2_BOUNDS = [ROUTE_P2.y, ...ROADS_H.filter((y) => y < ROUTE_P2.y && y > ROUTE_P3.y).sort((a, b) => b - a), ROUTE_P3.y];
  // Dual-track offset: the deck/pylons/stations stay on the ROUTE_P0..P3
  // centreline (one shared elevated structure, like a real viaduct), but
  // each direction of travel gets its own parallel lane a few px either
  // side of it — without this, both trains shared the literal same path
  // and would visually merge into one shape whenever their timing
  // coincided. Offset is perpendicular to whichever leg the point belongs
  // to (y-offset on the horizontal leg, x-offset on the vertical leg); the
  // diagonal chamfer point takes whichever offset its neighbouring leg
  // uses, which reads as parallel enough at this scale.
  const LANE_OFFSET = 6;
  const FWD_ROUTE = {
    p0: { x: ROUTE_P0.x, y: ROUTE_P0.y - LANE_OFFSET },
    p1: { x: ROUTE_P1.x, y: ROUTE_P1.y - LANE_OFFSET },
    p2: { x: ROUTE_P2.x - LANE_OFFSET, y: ROUTE_P2.y },
    p3: { x: ROUTE_P3.x - LANE_OFFSET, y: ROUTE_P3.y },
  };
  const REV_ROUTE = {
    p0: { x: ROUTE_P0.x, y: ROUTE_P0.y + LANE_OFFSET },
    p1: { x: ROUTE_P1.x, y: ROUTE_P1.y + LANE_OFFSET },
    p2: { x: ROUTE_P2.x + LANE_OFFSET, y: ROUTE_P2.y },
    p3: { x: ROUTE_P3.x + LANE_OFFSET, y: ROUTE_P3.y },
  };
  // Forward heading at each waypoint, in CSS rotate() degrees — the train's
  // un-rotated box already "points" along +Y (south) by construction (see
  // TRAIN_W/TRAIN_LEN), which is the baseline every heading below is
  // relative to (heading - 90deg, since CSS rotate() is clockwise and
  // atan2 here uses the same y-down screen convention):
  //   leg1 (P0->P1, heading east, dx=1 dy=0): atan2(0,1)=0deg -> -90deg
  //   chamfer (heading NE, dx=1 dy=-1): atan2(-1,1)=-45deg -> -135deg
  //   leg2 (P2->P3, heading north, dx=0 dy=-1): atan2(-1,0)=-90deg -> -180deg
  // Stored per-waypoint (not per-leg) so linear keyframe interpolation
  // between r1 (-90, end of leg1) and r2 (-180, end of chamfer) sweeps the
  // turn smoothly across the chamfer's own 40%-60% keyframe window — the
  // exact same trick FWD_ROUTE/REV_ROUTE already uses for position. Reused
  // by both the fwd and rev train instances; see the -rev keyframe comment
  // in globals.css for why reversed direction only needs +180deg on top of
  // these same 4 numbers rather than its own set.
  const LINE1_ROT: [number, number, number, number] = [-90, -90, -180, -180];
  // Train pace: unlike Car/Boat's fixed "-50..930" keyframe distance (a
  // holdover from the original 3x3 grid, which is why THEY need `sc()`'s
  // k-multiplier to catch the duration up to var(--kw-drive-len)), the
  // train's route waypoints are computed fresh above for this grid's actual
  // WORLD size — the geometry already reflects real scale. Multiplying an
  // already-real-scale duration by k a second time compounded on itself as
  // grids got bigger; a 12-wide grid worked out to a 90+ second lap, which
  // reads as "frozen", not "slow". Deriving duration directly from the real
  // route length instead keeps px/sec roughly constant with zero double
  // counting.
  const TRAIN_ROUTE_LEN = (ROUTE_P1.x - ROUTE_P0.x) + Math.hypot(ROUTE_P2.x - ROUTE_P1.x, ROUTE_P2.y - ROUTE_P1.y) + (ROUTE_P2.y - ROUTE_P3.y);
  const TRAIN_SPEED_PX_S = 95;
  const trainDur = Math.max(14, TRAIN_ROUTE_LEN / TRAIN_SPEED_PX_S);
  // Second line: a plain straight north-south run crossing Line 1's east-
  // west leg, giving only the densest metro seats (0.8, stricter than Line
  // 1's 0.62) a proper interchange instead of one isolated route — real
  // Malaysian cities only grow a second rapid-transit line once they're
  // genuinely large. No chamfer needed since it's already straight; it
  // still gets the same per-crossing deck segmentation and dual-lane
  // offset treatment as Line 1. Stacked at a different deck height
  // (LINE2_DECK_Z) so the two viaducts don't collide where they cross —
  // same reasoning real elevated interchanges use a level change, not two
  // decks occupying the same space.
  const showLine2 = density >= 0.8;
  const LINE2_X = ROADS_V[Math.max(1, Math.floor(ROADS_V.length * 0.25))];
  const LINE2_DECK_Z = TRACK_DECK_Z + 34;
  const LINE2_TOP = { x: LINE2_X, y: -40 };
  const LINE2_BOTTOM = { x: LINE2_X, y: WORLD + 40 };
  const LINE2_MID1 = { x: LINE2_X, y: LINE2_TOP.y + (LINE2_BOTTOM.y - LINE2_TOP.y) * 0.4 };
  const LINE2_MID2 = { x: LINE2_X, y: LINE2_TOP.y + (LINE2_BOTTOM.y - LINE2_TOP.y) * 0.6 };
  const LINE2_BOUNDS = [LINE2_TOP.y, ...ROADS_H.filter((y) => y > LINE2_TOP.y && y < LINE2_BOTTOM.y), LINE2_BOTTOM.y];
  const LINE2_FWD_ROUTE = {
    p0: { x: LINE2_TOP.x - LANE_OFFSET, y: LINE2_TOP.y },
    p1: { x: LINE2_MID1.x - LANE_OFFSET, y: LINE2_MID1.y },
    p2: { x: LINE2_MID2.x - LANE_OFFSET, y: LINE2_MID2.y },
    p3: { x: LINE2_BOTTOM.x - LANE_OFFSET, y: LINE2_BOTTOM.y },
  };
  const LINE2_REV_ROUTE = {
    p0: { x: LINE2_TOP.x + LANE_OFFSET, y: LINE2_TOP.y },
    p1: { x: LINE2_MID1.x + LANE_OFFSET, y: LINE2_MID1.y },
    p2: { x: LINE2_MID2.x + LANE_OFFSET, y: LINE2_MID2.y },
    p3: { x: LINE2_BOTTOM.x + LANE_OFFSET, y: LINE2_BOTTOM.y },
  };
  const line2Dur = Math.max(14, (LINE2_BOTTOM.y - LINE2_TOP.y) / TRAIN_SPEED_PX_S);
  // Interchange: where LINE2_X crosses Line 1's east-west leg. Valid
  // whenever LINE2_X (fixed at ~25% of grid width) sits before Line 1's
  // bend (~50% width minus CORNER_R) — true for every grid size showLine2
  // can trigger on (density >=0.8 only ever yields the two biggest grid
  // tiers, see kawasanGridSize).
  const INTERCHANGE = { x: LINE2_X, y: ROUTE_Y };
  // Lane markings scale with density rather than the road's physical width:
  // PLOT (240) and ROAD_GAP (280) leave zero slack between adjacent zone
  // tiles, so widening the actual asphalt strip would mean reflowing every
  // zone position and every margin decoration calibrated to ROAD_GAP —
  // instead a rural single-track road carries no markings at all, and
  // dense-metro reads as a proper multi-lane boulevard with a median, all
  // within the same 40px footprint. All layered onto the road div's own
  // background (not per-line child divs) — on a big metro grid that's
  // ~26 roads, and a 3-line dense-metro treatment as separate children
  // would be ~80 extra nodes just for lane paint. laneBg is the same
  // object for every road this render (offsets are density-driven, not
  // per-road), so it's computed once and spread onto each road div.
  function laneBg(offsets: number[], medianIndex: number, axis: "x" | "y"): CSSProperties {
    if (!offsets.length) return {};
    const dash = axis === "x" ? "repeating-linear-gradient(90deg, rgba(250,204,21,0.55) 0 14px, transparent 14px 34px)" : "repeating-linear-gradient(0deg, rgba(250,204,21,0.55) 0 14px, transparent 14px 34px)";
    const median = axis === "x" ? "linear-gradient(rgba(250,204,21,0.85), rgba(250,204,21,0.85))" : "linear-gradient(90deg, rgba(250,204,21,0.85), rgba(250,204,21,0.85))";
    const images: string[] = [];
    const sizes: string[] = [];
    const positions: string[] = [];
    const repeats: string[] = [];
    offsets.forEach((off, i) => {
      const isMedian = i === medianIndex;
      images.push(isMedian ? median : dash);
      sizes.push(axis === "x" ? (isMedian ? "100% 2.5px" : "100% 2px") : (isMedian ? "2.5px 100%" : "2px 100%"));
      positions.push(axis === "x" ? `0 ${off}px` : `${off}px 0`);
      repeats.push(isMedian ? "no-repeat" : axis === "x" ? "repeat-x" : "repeat-y");
    });
    // Inline backgroundImage replaces (doesn't layer under) the road's own
    // asphalt gradient from the kw-road-x/-y class — same shorthand
    // property, inline always wins — so the base gradient has to be
    // re-appended here as the bottom layer or the road goes flat black.
    images.push(axis === "x" ? "linear-gradient(180deg, #253046, #141b2c)" : "linear-gradient(90deg, #253046, #141b2c)");
    sizes.push("100% 100%");
    positions.push("0 0");
    repeats.push("no-repeat");
    return { backgroundImage: images.join(","), backgroundSize: sizes.join(","), backgroundPosition: positions.join(","), backgroundRepeat: repeats.join(",") };
  }
  const LANE_OFFSETS = density >= 0.85 ? [10, 20, 30] : density >= 0.62 ? [13, 27] : density >= 0.3 ? [19] : [];
  const LANE_MEDIAN_INDEX = density >= 0.85 ? 1 : -1;
  // Everything below this comment through emptyCells is memoized: all of it
  // is a pure function of gridSize/density/zones, but was previously being
  // rebuilt from scratch (sorts, Map/Set builds, O(gridSize^2) loops) on
  // every City3DMap re-render — including ones triggered by nothing more
  // than clicking a different zone to inspect it, which changes none of
  // this world geometry. On a dense-metro grid (gridSize 12, ~110
  // junctions) that redundant work ran on every single zone click.
  // LANE_OFFSETS/LANE_MEDIAN_INDEX/interiorX/interiorY are deliberately left
  // out of these deps: they're plain consts recomputed fresh every render
  // (new array identity each time) but always equal in value for a given
  // gridSize/density, which is what's actually listed — including them
  // would make the array reference "change" every render and defeat the
  // memo entirely.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const laneBgX = useMemo(() => laneBg(LANE_OFFSETS, LANE_MEDIAN_INDEX, "x"), [density]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const laneBgY = useMemo(() => laneBg(LANE_OFFSETS, LANE_MEDIAN_INDEX, "y"), [density]);
  const interiorX = ROADS_V.slice(1);
  const interiorY = ROADS_H.slice(1, -1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const junctions = useMemo(() => interiorX.flatMap((jx, xi) => interiorY.map((jy, yi) => ({ jx, jy, xi, yi }))), [gridSize]);
  // Traffic road count scales with density instead of a flat cap for every
  // seat: a rural seat stays quiet (2 busy interior roads, the original
  // cap), while dense-metro puts traffic on essentially every interior road
  // (capped at 10 to bound DOM/animation cost on a big grid) — matching how
  // empty-vs-jammed a real small town and a real city centre actually look,
  // not just building density.
  //
  // The diagonal LRT chamfer needs no special exclusion here. It is an
  // elevated, post-zone sibling (not a ground-road replacement), and these
  // arrays deliberately take roads from the outer/interior edge inward. At
  // Metro they stop at index 5 while the chamfer is at the middle index 8;
  // at Dense Metro they stop at 10 while it is at index 15. Consequently no
  // Car can inherit the deck's rotate(-45deg), or even occupy its tiny
  // centre-grid footprint: every Car remains a straight X/Y WORLD-space
  // sibling. A vehicle that appears diagonal below that deck is therefore a
  // CSS-3D oblique-view layering/projection read, not car turn geometry.
  const carRoadsY = useMemo(() => {
    const carRoadCap = density >= 0.85 ? Math.min(interiorY.length, interiorX.length, 10) : density >= 0.62 ? 5 : 2;
    return interiorY.slice(0, carRoadCap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize, density]);
  const carRoadsX = useMemo(() => {
    const carRoadCap = density >= 0.85 ? Math.min(interiorY.length, interiorX.length, 10) : density >= 0.62 ? 5 : 2;
    return interiorX.slice(0, carRoadCap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize, density]);
  // Dense-metro also queues extra cars behind the regular 2 on its busiest
  // roads — short, fixed delay gaps behind the lead car (not a random
  // stagger) read as nose-to-tail congestion, not just "more roads have
  // traffic". Capped to 4 roads per axis, 2 queued cars each, to bound the
  // extra DOM/animation cost this adds on an already-busy dense-metro scene.
  const jamLanes = density >= 0.85;
  const JAM_ROAD_COUNT = 4;
  const JAM_QUEUE = 2;
  // zones[] only holds the DEVELOPED cells (see kawasanDevelopedCount) — this
  // maps each one back onto its grid (col,row), centre-outward, and
  // zoneKindByCell lets the zebra-crossing check ask "what's at this cell?"
  // in O(1) instead of assuming a dense row*gridSize+col layout.
  const zonePositions = useMemo(() => assignZonePositions(gridSize, zones.length), [gridSize, zones.length]);
  // (col,row) -> zone, reused by the minimap below so it doesn't need its
  // own O(gridSize^2 * zones.length) lookup pass.
  const { zoneKindByCell, zoneByCell } = useMemo(() => {
    const kindByCell = new Map<string, ZoneKind>();
    const byCell = new Map<string, Zone>();
    zonePositions.forEach((pos, i) => {
      const zone = zones[i];
      if (zone) {
        kindByCell.set(`${pos.col},${pos.row}`, zone.kind);
        byCell.set(`${pos.col},${pos.row}`, zone);
      }
    });
    return { zoneKindByCell: kindByCell, zoneByCell: byCell };
  }, [zonePositions, zones]);
  const emptyCells = useMemo(() => {
    const occupiedCells = new Set(zonePositions.map((pos) => `${pos.col},${pos.row}`));
    const cells: { col: number; row: number }[] = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!occupiedCells.has(`${col},${row}`)) cells.push({ col, row });
      }
    }
    return cells;
  }, [gridSize, zonePositions]);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const cam = useRef({ ...CAM_DEFAULT });
  const defaultZoom = useRef(CAM_DEFAULT.zoom);
  const drag = useRef<{ x: number; y: number; rz: number; rx: number } | null>(null);
  const movedRef = useRef(false);
  // Starts on the fixed "dusk" default (server-rendered markup has no
  // access to the visitor's clock) and is corrected to the real local
  // time-of-day in the effect below, right after mount — client-only by
  // design, so this never causes a hydration mismatch against the
  // server-rendered HTML.
  const [tod, setTod] = useState<Tod>("dusk");
  const [weather, setWeather] = useState<"clear" | "rain">("clear");

  useEffect(() => {
    setTod(todFromClientHour(new Date().getHours()));
  }, []);

  const applyCam = useCallback(() => {
    const el = sceneRef.current;
    if (!el) return;
    const c = cam.current;
    c.rz = Math.max(5, Math.min(85, c.rz));
    c.rx = Math.max(42, Math.min(72, c.rx));
    c.zoom = Math.max(0.55, Math.min(1.7, c.zoom));
    el.style.setProperty("--kw-rz", `${c.rz}deg`);
    el.style.setProperty("--kw-rx", `${c.rx}deg`);
    el.style.setProperty("--kw-zoom", `${c.zoom}`);
  }, []);

  // The idle-triggered cinematic auto-sweep was removed — on a heavy
  // dense-metro scene the constant rAF-driven camera writes it added on
  // top of manual drag/zoom read as the whole view stuttering even when
  // nobody was touching it. markInteraction is kept as a no-op-shaped hook
  // (still called from every camera input site) so none of those call
  // sites need touching if something gets hung off it again later.
  const markInteraction = useCallback(() => {}, []);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    // Fit the city to the panel: narrower scenes start zoomed out so the
    // whole grid (and its labels) stays inside the frame.
    const width = el.clientWidth;
    defaultZoom.current = width < 700 ? 0.55 : width < 900 ? 0.66 : width < 1150 ? 0.76 : CAM_DEFAULT.zoom;
    cam.current.zoom = defaultZoom.current;
    applyCam();
    markInteraction();
    // Both handlers used to call applyCam() (a synchronous DOM style write
    // over the whole preserve-3d tree) directly on every raw pointermove/
    // wheel event — on a dense-metro seat (hundreds of building/road/transit
    // elements) that's more style recalc than one frame budget allows, and
    // reads as the drag/zoom stuttering ("tersangkut"). Coalescing to one
    // applyCam() per animation frame (using the latest pointer delta / an
    // accumulated zoom factor at fire time, not whatever was queued first)
    // fixes that without changing the actual camera math.
    let dragFrame: number | null = null;
    let latestDelta: { dx: number; dy: number } | null = null;
    let wheelFrame: number | null = null;
    let pendingZoomFactor = 1;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      markInteraction();
      pendingZoomFactor *= event.deltaY > 0 ? 0.92 : 1.08;
      if (wheelFrame != null) return;
      wheelFrame = requestAnimationFrame(() => {
        wheelFrame = null;
        cam.current.zoom *= pendingZoomFactor;
        pendingZoomFactor = 1;
        applyCam();
      });
    };
    const onMove = (event: PointerEvent) => {
      if (!drag.current) return;
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true;
      latestDelta = { dx, dy };
      if (dragFrame != null) return;
      dragFrame = requestAnimationFrame(() => {
        dragFrame = null;
        if (!drag.current || !latestDelta) return;
        cam.current.rz = drag.current.rz - latestDelta.dx * 0.25;
        cam.current.rx = drag.current.rx + latestDelta.dy * 0.18;
        applyCam();
      });
    };
    const onUp = () => {
      if (drag.current) markInteraction();
      drag.current = null;
      el.classList.remove("kw-dragging");
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (dragFrame != null) cancelAnimationFrame(dragFrame);
      if (wheelFrame != null) cancelAnimationFrame(wheelFrame);
    };
  }, [applyCam, markInteraction]);

  const controlButton = "pointer-events-auto flex h-9 w-9 items-center justify-center border text-[13px] font-black";
  const controlStyle = { borderColor: "rgba(125,211,252,0.4)", background: "rgba(3,8,15,0.8)", color: "#7dd3fc" } as const;

  // worldDecorPre/worldDecorPost: the static roads/junctions/traffic/trees/
  // transit-line dressing that surrounds the zone grid. None of it depends
  // on selectedZoneId or celebration, but City3DMap re-renders on both
  // (clicking a zone to inspect it is the single most frequent interaction
  // on this screen). Without this memo boundary, React would re-create and
  // reconcile this entire subtree — hundreds of elements on a dense-metro
  // grid (junctions, lamps, cars, traffic lights, transit deck segments) —
  // on every zone click even though not one pixel of it actually changed.
  // Memoizing the JSX itself (not just the data feeding it) means React
  // sees the same element reference and bails out of that subtree entirely
  // instead of re-diffing it. Split in two (pre/post) only so ZonePlot's
  // own zones.map — which DOES need the live selectedZoneId — can sit
  // between them without being swallowed into the memo.
  const worldDecorPre = useMemo(() => (
    <>
      {/* Distant terrain: far larger than the city block and mask-faded at
          its own outer edge, so the horizon dissolves into the sky instead
          of cutting off — this is what makes the city read as sitting
          *in* a world instead of floating on a cropped tile. */}
      <div
        className="kw-farground absolute"
        style={{
          inset: -340,
          pointerEvents: "none",
          transform: "translateZ(-6px)",
          // Soft sheen layered over the ground colour: a low-alpha highlight
          // (not a mirror image — this is a flat plane, not a real
          // reflection) that reads as damp/reflective ground catching the
          // sky's light, so the terrain doesn't look like flat matte paint.
          background:
            "radial-gradient(ellipse 380px 160px at 50% 36%, rgba(255,255,255,0.08), transparent 72%), var(--kw-ground, linear-gradient(135deg, #1d3326, #12211a))",
          maskImage: "radial-gradient(circle at 50% 50%, black 30%, black 46%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 30%, black 46%, transparent 82%)",
        }}
      />
      {/* pointer-events none: coplanar with the zone buttons, so it can steal their clicks in 3D hit-testing.
          kw-worldground masks this layer's own hard rectangle edge (see globals.css) so its grass
          texture fades into kw-farground below instead of stopping in a crisp square seam — that
          seam, not the (already-soft) farground, was the real source of the "cake platter" look.
          The extra radial-gradient blotches are fixed, hand-placed light/dark patches faking gentle
          elevation — a real per-vertex heightmap isn't practical on a flat CSS plane, and moving
          actual geometry here risks the preserve-3d flattening bug (see kw-horizonglow above). */}
      <div
        className="kw-grassy kw-worldground absolute"
        style={{
          inset: -70,
          pointerEvents: "none",
          background: "var(--kw-ground, linear-gradient(135deg, #1d3326, #12211a))",
          backgroundImage:
            "radial-gradient(220px 140px at 18% 74%, rgba(255,255,255,0.05), transparent 70%), radial-gradient(260px 160px at 82% 20%, rgba(0,0,0,0.14), transparent 72%), radial-gradient(200px 130px at 70% 86%, rgba(255,255,255,0.04), transparent 70%), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 60px), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 60px)",
        }}
      />
      {/* City base: thick concrete/soil skirt around the immediate ground
          tile so it reads as a block resting on a foundation, not a flat
          sliced plane. Tilted a few degrees short of vertical (rotateX 74
          instead of 90) so the ground-to-wall corner reads as a shallow
          batter/embankment rather than a table edge. Only the south + east
          faces are ever camera-facing (see the building-wall convention
          above). */}
      <div className="kw-3d absolute kw-slab-wall" style={{ left: -70, top: WORLD + 70, width: WORLD + 140, height: 78, transformOrigin: "top", transform: "rotateX(74deg)" }} />
      <div className="kw-3d absolute kw-slab-wall kw-slab-wall-side" style={{ left: WORLD + 70, top: -70, width: 78, height: WORLD + 140, transformOrigin: "left", transform: "rotateY(-74deg)" }} />
      {ROADS_H.map((y) => (
        <div key={`rh-${y}`} className="kw-road-x absolute" style={{ left: 0, top: y, width: RIVER_X, height: 40, ...laneBgX }} />
      ))}
      {ROADS_V.map((x) => (
        <div key={`rv-${x}`} className="kw-road-y absolute" style={{ left: x, top: 0, width: 40, height: WORLD, ...laneBgY }} />
      ))}
      {/* coastal seats face open sea with a beach + jetty; inland seats get the river and bridges */}
      {traits.coastal && <div className="absolute" style={{ left: RIVER_X - 14, top: -70, width: 14, height: WORLD + 140, background: "repeating-linear-gradient(0deg, #fde68a 0 12px, #fcd34d 12px 24px)", opacity: 0.85 }} />}
      <div className="kw-water absolute" style={{ left: RIVER_X, top: -70, width: traits.coastal ? 110 : 40, height: WORLD + 140 }} />
      {/* Bridge deck sits at translateZ(4px) — above the boats' translateZ(1px)
          water plane — so a boat passing underneath is correctly occluded by
          the deck instead of floating on top of it. Two piers per crossing
          (true 3D wall-hinge, same convention as building walls) stand from
          the water up to the deck so it reads as supported, not floating. */}
      {!traits.coastal && ROADS_H.map((y) => (
        <div key={`bridge-${y}`}>
          <div className="absolute" style={{ left: RIVER_X + 4, top: y + 42, width: 5, height: 9, transformOrigin: "top", transform: "rotateX(90deg)", background: "linear-gradient(180deg, #64748b, #1e293b)" }} />
          <div className="absolute" style={{ left: RIVER_X + 34, top: y + 42, width: 5, height: 9, transformOrigin: "top", transform: "rotateX(90deg)", background: "linear-gradient(180deg, #64748b, #1e293b)" }} />
          <div className="absolute" style={{ left: RIVER_X - 4, top: y - 2, width: 48, height: 44, background: "linear-gradient(180deg, #3b4a63, #232f45)", border: "2px solid rgba(148,163,184,0.35)", transform: "translateZ(4px)" }} />
        </div>
      ))}
      {traits.coastal && (
        <>
          {/* Jetty: was hardcoded at top:420, a value with no relation to
              ROADS_H — it read as a disconnected, off-grid ramp. Snapped
              onto a middle ROADS_H entry so it's the literal continuation
              of that street across the coastline (ROADS_H now varies with
              gridSize, so the middle index is picked at render time rather
              than a fixed [2]), and its width is clamped so it ends exactly
              at WORLD's edge instead of overshooting into the margin unclamped. */}
          <div className="absolute" style={{ left: RIVER_X - 6, top: ROADS_H[Math.floor(ROADS_H.length / 2)] + 14, width: WORLD - (RIVER_X - 6), height: 12, transform: "translateZ(3px)", background: "repeating-linear-gradient(90deg, #92400e 0 6px, #78350f 6px 8px)", border: "1px solid rgba(69,26,3,0.9)" }} />
          <Boat x={RIVER_X + 62} w={11} h={24} hullTop="#0ea5e9" hullBottom="#075985" dur={sc(52)} delay={sc(-31)} />
        </>
      )}
      {/* highland seats: hill backdrop along the north edge. Each entry is a
          layered stack (back mound + shaded main mound + front mound
          overlapping the ground) rather than one flat silhouette, so the
          skyline reads as elevation, not just tall buildings on flat ground.
          The main mound's shading is a fixed off-centre highlight/shadow
          pair (not the world-rotation-driven lit/shadow faces buildings use)
          since billboards always face the camera and have no true side. */}
      {traits.hilly && HILL_POSITIONS.map(([x, y, s, zNudge], index) => (
        <div key={`hill-${index}`} className="kw-3d absolute" style={{ left: x * k, top: y * k, width: 0, height: 0, transform: `translateZ(${zNudge}px)` }}>
          <div className="kw-bill" style={{ width: 210 * s, height: 82 * s }}>
            <div style={{ position: "absolute", left: 22 * s, top: -16 * s, width: 168 * s, height: 58 * s, borderRadius: "50% 50% 0 0", background: "linear-gradient(180deg, #052e16, #021a0c)", opacity: 0.85 }} />
            <div
              style={{
                position: "absolute",
                width: 210 * s,
                height: 82 * s,
                borderRadius: "50% 50% 0 0",
                background:
                  "radial-gradient(55% 50% at 30% 18%, rgba(163,230,53,0.32), transparent 62%), " +
                  "radial-gradient(65% 55% at 74% 88%, rgba(2,6,15,0.5), transparent 68%), " +
                  "linear-gradient(180deg, #14532d, #052e16)",
                opacity: 0.94,
              }}
            />
            <div style={{ position: "absolute", left: -16 * s, bottom: -8 * s, width: 118 * s, height: 38 * s, borderRadius: "50% 50% 0 0", background: "linear-gradient(180deg, #1a7a3d, #14532d)", opacity: 0.9 }} />
          </div>
        </div>
      ))}
      {/* Forested slopes: small conifer specks scattered along each hill's
          front mound so it reads as a vegetated hillside instead of a bare
          green dome. Reuses the same Conifer component at a tiny scale. */}
      {traits.hilly && HILL_POSITIONS.flatMap(([x, y, s], hillIndex) => (
        [-42, -14, 16, 42].map((dx, speckIndex) => (
          <Conifer
            key={`hill-tree-${hillIndex}-${speckIndex}`}
            x={x * k + dx * s}
            y={(y + 58) * k}
            scale={0.3 * s}
            variant={(hillIndex + speckIndex) % CONIFER_CANOPY.length}
          />
        ))
      ))}
      {/* rice-bowl seats: paddy plots in the world margins */}
      {traits.paddy && [[-64, 180], [-60, 470], [-66, 720], [180, 898], [520, 902]].map(([x, y], index) => (
        <div key={`padi-${index}`} className="absolute" style={{ left: x * k, top: y * k, width: 48, height: 42, transform: "translateZ(1px)", background: flatTile("sawah"), border: "1px solid rgba(163,230,53,0.25)", borderRadius: 3 }} />
      ))}
      {junctions.map(({ jx, jy }) => <div key={`lamp-${jx}-${jy}`} className="kw-lamp" style={{ left: jx + 20 - 36, top: jy + 20 - 36 }} />)}
      <Boat x={RIVER_X + 6} w={12} h={26} hullTop="#d97706" hullBottom="#7c2d12" dur={sc(38)} delay={sc(-9)} />
      <Boat x={RIVER_X + 23} w={10} h={22} hullTop="#e2e8f0" hullBottom="#64748b" dur={sc(47)} delay={sc(-22)} rev />
      {/* Traffic mix: mostly cars with the occasional bus/motorcycle
          (index-derived, not random — must stay stable across renders
          like every other seeded value in this scene) instead of every
          vehicle being the same generic car. */}
      {carRoadsY.flatMap((y, ri) => [
        <Car key={`car-h-${ri}-0`} lane={y + 8} dur={(13 + ri * 2) * k} delay={(-3 - ri) * k} colorIdx={ri * 2} kind={ri === 0 ? "bus" : "car"} />,
        <Car key={`car-h-${ri}-1`} lane={y + 22} dur={(17 + ri * 2) * k} delay={(-9 - ri) * k} rev colorIdx={ri * 2 + 1} kind={ri === 1 ? "motorcycle" : "car"} />,
        ...(jamLanes && ri < JAM_ROAD_COUNT
          ? Array.from({ length: JAM_QUEUE }, (_, qi) => (
              <Car key={`car-h-${ri}-q${qi}`} lane={y + 22} dur={(17 + ri * 2) * k} delay={(-9 - ri) * k + (qi + 1) * 3.2} rev colorIdx={(ri + qi + 3) % 5} />
            ))
          : []),
      ])}
      {carRoadsX.flatMap((x, ri) => [
        <Car key={`car-v-${ri}-0`} vertical lane={x + 8} dur={(16 - ri) * k} delay={(-5 - ri) * k} colorIdx={(ri * 2 + 4) % 5} kind={ri === 0 ? "motorcycle" : "car"} />,
        <Car key={`car-v-${ri}-1`} vertical lane={x + 22} dur={(12 + ri) * k} delay={(-8 - ri) * k} rev colorIdx={(ri * 2 + 5) % 5} kind={ri === 1 ? "bus" : "car"} />,
        ...(jamLanes && ri < JAM_ROAD_COUNT
          ? Array.from({ length: JAM_QUEUE }, (_, qi) => (
              <Car key={`car-v-${ri}-q${qi}`} vertical lane={x + 8} dur={(16 - ri) * k} delay={(-5 - ri) * k + (qi + 1) * 3.5} colorIdx={(ri + qi + 1) % 5} />
            ))
          : []),
      ])}
      {/* Parked traffic: a couple of static cars at the kerb on the first
          busy road each axis, filling the empty edge next to the new
          sidewalk strip. Fixed offsets (not random) at the curb-side lane
          (y/x + 33, right against the sidewalk added to ZonePlot above),
          kept to 2 per axis to bound the DOM-node cost this adds. */}
      {carRoadsY.slice(0, 1).flatMap((y) => [
        <Car key="park-h-0" lane={y + 29} parkedAt={80} colorIdx={2} />,
        <Car key="park-h-1" lane={y + 29} parkedAt={ROAD_GAP * 1.55} colorIdx={4} />,
      ])}
      {carRoadsX.slice(0, 1).flatMap((x) => [
        <Car key="park-v-0" vertical lane={x + 29} parkedAt={90} colorIdx={1} />,
        <Car key="park-v-1" vertical lane={x + 29} parkedAt={ROAD_GAP * 1.6} colorIdx={3} />,
      ])}
      {junctions.map(({ jx, jy, xi, yi }) => (
        <div key={`tl-${jx}-${jy}`} className="kw-3d absolute" style={{ left: jx - 7, top: jy - 7, width: 0, height: 0 }}>
          <div className="kw-bill">
            <div className="mx-auto flex h-[11px] w-[9px] items-center justify-center rounded-sm" style={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.5)" }}>
              <span className="kw-tlight" style={{ animationDelay: `${(xi * 2 + yi) * -2.2}s` }} />
            </div>
            <div className="mx-auto" style={{ width: 2, height: 14, background: "#475569" }} />
          </div>
        </div>
      ))}
      {/* Zebra crossings: only painted at junctions bordering a school or
          clinic zone (education/community kind), not every junction, so
          they read as a deliberate safety marking rather than decoration. */}
      {junctions.flatMap(({ jx, jy, xi, yi }) => {
        const cols = [xi, xi + 1];
        const rows = [yi, yi + 1];
        const hasSchoolOrClinic = rows.some((row) => cols.some((col) => {
          const kind = zoneKindByCell.get(`${col},${row}`);
          return kind === "education" || kind === "community";
        }));
        if (!hasSchoolOrClinic) return [];
        return [
          <div key={`zebra-h-${jx}-${jy}`} className="absolute" style={{ left: jx - 34, top: jy, width: 24, height: 40, backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.8) 0 4px, transparent 4px 9px)" }} />,
          <div key={`zebra-v-${jx}-${jy}`} className="absolute" style={{ left: jx, top: jy - 34, width: 40, height: 24, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.8) 0 4px, transparent 4px 9px)" }} />,
        ];
      })}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [gridSize, density, traits, WORLD, RIVER_X, k, junctions, carRoadsY, carRoadsX, jamLanes, laneBgX, laneBgY, zoneKindByCell]);

  const worldDecorPost = useMemo(() => (
    <>
      {/* Metro/dense-metro seats only: an elevated LRT/MRT viaduct along the
          west margin, mirroring how the river owns the east edge. Painted
          after the zone grid (like the perimeter vegetation below) rather
          than before it — this scene has no real depth buffer, so a west-
          margin structure has to come later in paint order than the
          buildings to actually read as in front of them, the same reason
          the tree line below is ordered where it is. Piers use the same
          true-3D wall-hinge (south+east face) convention as buildings/
          bridge piers; the deck itself stays a flat translateZ'd cap like
          the road bridges above rather than a full extruded box —
          proportionally too thin over this length to need real side walls. */}
      {showTransit && (
        <>
          {/* One deck div per block (matching the pylon/bridge spacing) rather
              than a single span across the whole route: a lone primitive
              that long has a far corner extreme enough to fall outside this
              camera's valid perspective range, and gets culled wholesale —
              not clipped, just invisible — the same reason bridge decks are
              already built one-per-crossing instead of one long deck. */}
          {LEG1_BOUNDS.slice(0, -1).map((segX, i) => (
            <div key={`deck-h-${segX}`} className="kw-3d absolute kw-lrt-deck-h" style={{ left: segX, top: ROUTE_Y - TRACK_W / 2, width: LEG1_BOUNDS[i + 1] - segX, height: TRACK_W, transform: `translateZ(${TRACK_DECK_Z}px)` }} />
          ))}
          {/* Chamfer: one diagonal deck segment softening the turn from the
              east-west leg into the north-south leg into a 45deg curve
              instead of a sharp corner — length is the straight-line
              distance between the two leg ends, rotated to match. */}
          <div className="kw-3d absolute kw-lrt-deck-h" style={{ left: ROUTE_P1.x, top: ROUTE_Y - TRACK_W / 2, width: Math.round(Math.hypot(ROUTE_P2.x - ROUTE_P1.x, ROUTE_P2.y - ROUTE_P1.y)), height: TRACK_W, transformOrigin: "0 50%", transform: `translateZ(${TRACK_DECK_Z}px) rotate(-45deg)` }} />
          {LEG2_BOUNDS.slice(0, -1).map((segY, i) => (
            <div key={`deck-v-${segY}`} className="kw-3d absolute kw-lrt-deck-v" style={{ left: ROUTE_X - TRACK_W / 2, top: LEG2_BOUNDS[i + 1], width: TRACK_W, height: segY - LEG2_BOUNDS[i + 1], transform: `translateZ(${TRACK_DECK_Z}px)` }} />
          ))}
          {/* The train and its support columns are sibling CSS-3D subtrees:
              although their world volumes are deliberately separate (pylon
              ends at deckZ - 2; train starts at deckZ + 3), CSS has no
              cross-sibling depth buffer. The old pylon-then-train source
              order let the animated train composite over the column at the
              Town Centre road junction, which read as the consist passing
              through solid concrete. Keep the deck first, then the moving
              train, then the fixed columns: at the default/common orbit the
              near, vertical columns now retain their foreground silhouette.
              This is a paint-order mitigation, not a geometry collision
              rule; arbitrary reverse camera angles remain a CSS-3D sorting
              limitation (as with the zone/decor ordering below). */}
          <TransitTrain z={TRACK_DECK_Z + 3} dur={`${trainDur.toFixed(1)}s`} route={FWD_ROUTE} rot={LINE1_ROT} />
          <TransitTrain z={TRACK_DECK_Z + 3} dur={`${(trainDur * 1.08).toFixed(1)}s`} delay={`${(-trainDur * 0.5).toFixed(1)}s`} rev route={REV_ROUTE} rot={LINE1_ROT} />
          {ROADS_V.filter((x) => x > ROUTE_P0.x && x <= ROUTE_P1.x).map((x) => (
            <TransitPylon key={`pylon-h-${x}`} left={x - 5} top={ROUTE_Y - 5} deckZ={TRACK_DECK_Z} />
          ))}
          {ROADS_H.filter((y) => y <= ROUTE_P2.y && y >= ROUTE_P3.y).map((y) => (
            <TransitPylon key={`pylon-v-${y}`} left={ROUTE_X - 5} top={y - 5} deckZ={TRACK_DECK_Z} />
          ))}
          <TransitStation x={(ROUTE_P0.x + ROUTE_P1.x) / 2} y={ROUTE_Y} deckZ={TRACK_DECK_Z} tag={density >= 0.85 ? "MRT" : "LRT"} />
          <TransitStation x={ROUTE_X} y={(ROUTE_P2.y + ROUTE_P3.y) / 2} deckZ={TRACK_DECK_Z} tag={density >= 0.85 ? "MRT" : "LRT"} />
        </>
      )}
      {/* Line 2: a second, straight north-south route stacked above Line 1
          (dense-metro seats only) crossing it at INTERCHANGE — see the
          constants above for why a plain straight line needs no chamfer
          and why it's stacked at a different deck height. */}
      {showTransit && showLine2 && (
        <>
          {LINE2_BOUNDS.slice(0, -1).map((segY, i) => (
            <div key={`deck2-${segY}`} className="kw-3d absolute kw-lrt-deck-v" style={{ left: LINE2_X - TRACK_W / 2, top: segY, width: TRACK_W, height: LINE2_BOUNDS[i + 1] - segY, transform: `translateZ(${LINE2_DECK_Z}px)` }} />
          ))}
          {ROADS_H.filter((y) => y > LINE2_TOP.y && y < LINE2_BOTTOM.y).map((y) => (
            <TransitPylon key={`pylon2-${y}`} left={LINE2_X - 5} top={y - 5} deckZ={LINE2_DECK_Z} />
          ))}
          <TransitStation x={LINE2_X} y={(LINE2_TOP.y + ROUTE_Y) / 2} deckZ={LINE2_DECK_Z} tag="LRT 2" />
          <TransitStation x={LINE2_X} y={(ROUTE_Y + LINE2_BOTTOM.y) / 2} deckZ={LINE2_DECK_Z} tag="LRT 2" />
          <TransitTrain z={LINE2_DECK_Z + 3} dur={`${line2Dur.toFixed(1)}s`} route={LINE2_FWD_ROUTE} />
          <TransitTrain z={LINE2_DECK_Z + 3} dur={`${(line2Dur * 1.1).toFixed(1)}s`} delay={`${(-line2Dur * 0.5).toFixed(1)}s`} rev route={LINE2_REV_ROUTE} />
          {/* Interchange complex: both lines' platforms plus a vertical
              connector shaft tying the two deck levels together, so the
              crossing reads as one deliberate interchange station rather
              than two unrelated lines that happen to overlap in plan. */}
          <TransitStation x={INTERCHANGE.x} y={INTERCHANGE.y} deckZ={TRACK_DECK_Z} tag="INTERCHANGE" />
          <TransitStation x={INTERCHANGE.x} y={INTERCHANGE.y} deckZ={LINE2_DECK_Z} tag="INTERCHANGE" />
          <div className="kw-3d absolute" style={{ left: INTERCHANGE.x - 3, top: INTERCHANGE.y - 3, width: 6, height: 6 }}>
            <div className="absolute kw-face-lit" style={{ left: 0, top: 6, width: 6, height: LINE2_DECK_Z - TRACK_DECK_Z, transformOrigin: "top", transform: `translateZ(${TRACK_DECK_Z + 9}px) rotateX(90deg)`, background: "linear-gradient(180deg, #7dd3fc, #0369a1)" }} />
            <div className="absolute kw-face-shadow" style={{ left: 6, top: 0, width: LINE2_DECK_Z - TRACK_DECK_Z, height: 6, transformOrigin: "left", transform: `translateZ(${TRACK_DECK_Z + 9}px) rotateY(-90deg)`, background: "linear-gradient(90deg, #0369a1, #0c4a6e)" }} />
          </div>
        </>
      )}
      {/* helicopter patrol: anchor orbits the world centre, counter-spin keeps the billboard steady */}
      <div className="kw-3d kw-heli-orbit absolute" style={{ left: WORLD / 2, top: WORLD / 2, width: 0, height: 0 }}>
        <div className="kw-3d absolute" style={{ left: 396 * k, top: 0, width: 0, height: 0, transform: "translateZ(195px)" }}>
          <div className="kw-3d kw-heli-counter absolute" style={{ width: 0, height: 0 }}>
            <div className="kw-bill">
              <div className="relative" style={{ width: 34, height: 16 }}>
                <div className="kw-rotor absolute" style={{ left: 3, top: 0, width: 28, height: 2, borderRadius: 2, background: "rgba(226,232,240,0.8)" }} />
                <div className="absolute" style={{ left: 6, top: 4, width: 16, height: 9, borderRadius: "45% 55% 50% 50%", background: "linear-gradient(180deg, #64748b, #1e293b)" }} />
                <div className="absolute" style={{ left: 20, top: 6, width: 12, height: 3, background: "linear-gradient(180deg, #475569, #1e293b)" }} />
                <span className="kw-blink absolute" style={{ left: 29, top: 3 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* hot-air balloon: drifts across the valley, grounded at night and in rain */}
      <div className="kw-3d kw-balloon absolute" style={{ left: 0, top: 0, width: 0, height: 0 }}>
        <div className="kw-bill">
          <div className="kw-balloon-body">
            <div className="kw-bob">
              <div className="mx-auto" style={{ width: 26, height: 30, borderRadius: "50% 50% 44% 44%", background: "repeating-linear-gradient(90deg, #f87171 0 5px, #fbbf24 5px 10px, #34d399 10px 15px, #60a5fa 15px 20px)", boxShadow: "inset -4px -6px 10px rgba(0,0,0,0.25)" }} />
              <div className="mx-auto" style={{ width: 2, height: 5, background: "rgba(148,163,184,0.8)" }} />
              <div className="mx-auto" style={{ width: 9, height: 6, borderRadius: 2, background: "linear-gradient(180deg, #92400e, #451a03)" }} />
            </div>
          </div>
        </div>
      </div>
      {/* Perimeter vegetation: 3 shapes (round leafy / conifer / palm) instead
          of just 1, each nudged off its base coordinate by a small
          index-derived (deterministic, not Math.random — must stay stable
          across renders) jitter so the tree line doesn't read as
          grid-snapped. */}
      {[[-32, 130], [-40, 410], [-30, 690], [905, 190], [912, 480], [120, -34], [430, -40], [700, -32], [-30, 905], [340, 905], [640, 908]].map(([x, y], index) => {
        const jx = x * k + ((index * 37) % 11) - 5;
        const jy = y * k + ((index * 53) % 9) - 4;
        const scale = 0.8 + (index % 3) * 0.18;
        if (index % 3 === 0) return <Palm key={`tree-${index}`} x={jx} y={jy} scale={scale} />;
        if (index % 3 === 1) return <Conifer key={`tree-${index}`} x={jx} y={jy} scale={scale} variant={index % CONIFER_CANOPY.length} />;
        return <Tree key={`tree-${index}`} x={jx} y={jy} scale={scale} variant={index % TREE_CANOPY.length} />;
      })}
      {traits.coastal && [[-22, 120], [-24, 360], [-20, 640]].map(([x, y], index) => (
        <Palm key={`beach-palm-${index}`} x={RIVER_X + x} y={y * k} scale={0.9 + (index % 2) * 0.25} />
      ))}
      {[[300, 150], [580, 430], [300, 700], [580, 130]].map(([x, y], index) => (
        <Bunting key={`bunting-${index}`} x={x * k} y={y * k} delay={index * -1.3} />
      ))}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [gridSize, density, traits, WORLD, RIVER_X, k, showTransit, showLine2]);

  return (
    <div
      ref={sceneRef}
      className="kw-scene h-[clamp(520px,74vh,760px)] border"
      data-tod={tod}
      data-weather={weather}
      data-mood={overall > 0 && overall < 54 ? "low" : "ok"}
      style={{ background: "var(--kw-sky)", borderColor: "rgb(var(--cyan-rgb)/0.18)" }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        markInteraction();
        drag.current = { x: event.clientX, y: event.clientY, rz: cam.current.rz, rx: cam.current.rx };
        movedRef.current = false;
        sceneRef.current?.classList.add("kw-dragging");
      }}
    >
      {/* sky dressing (screen space) */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: "var(--kw-stars)", transition: "opacity 0.6s", backgroundImage: "radial-gradient(1.4px 1.4px at 20px 30px, #fff, transparent), radial-gradient(1px 1px at 96px 84px, #cbd5e1, transparent), radial-gradient(1.2px 1.2px at 168px 42px, #fff, transparent), radial-gradient(1px 1px at 58px 120px, #e2e8f0, transparent), radial-gradient(1.3px 1.3px at 204px 96px, #fff, transparent), radial-gradient(0.9px 0.9px at 140px 138px, #cbd5e1, transparent)", backgroundSize: "220px 160px, 220px 160px, 220px 160px, 300px 210px, 300px 210px, 300px 210px" }} />
      <div className="kw-cloud" style={{ top: 46, width: 190, height: 46, animationDuration: "70s" }} />
      <div className="kw-cloud" style={{ top: 108, width: 130, height: 34, animationDuration: "95s", animationDelay: "-40s" }} />
      <div className="kw-cloud" style={{ top: 24, width: 240, height: 40, animationDuration: "120s", animationDelay: "-70s" }} />
      {[{ top: 84, dur: 26, delay: -5 }, { top: 138, dur: 36, delay: -21 }, { top: 58, dur: 31, delay: -12 }].map((bird, index) => (
        <div key={`bird-${index}`} className="kw-bird" style={{ top: bird.top, animationDuration: `${bird.dur}s`, animationDelay: `${bird.delay}s` }} />
      ))}
      {traits.paddy && (
        <div className="kw-wau pointer-events-none absolute" style={{ right: "26%", top: 88 }}>
          <div style={{ width: 16, height: 16, transform: "rotate(45deg)", borderRadius: "20% 62% 20% 62%", background: "linear-gradient(135deg, #dc2626, #facc15 55%, #16a34a)", boxShadow: "0 0 4px rgba(0,0,0,0.25)" }} />
          <div style={{ margin: "-2px auto 0", width: 2, height: 36, background: "rgba(226,232,240,0.5)" }} />
        </div>
      )}

      {/* 3D world */}
      {/* --kw-drive-len: cars/boats/trains all travel a fixed pixel range
          via the kw-drive-x/-y keyframes — was hardcoded to fit the
          original 3x3 (880-unit) grid, so on a bigger metro grid (up to
          3400+) they only ever covered a small corner of the road and read
          as stuck in place. Setting the real distance here once lets every
          vehicle's keyframes (which reference var(--kw-drive-len)) inherit
          it, without touching each Car/Boat/TransitTrain call site. */}
      <div
        className="kw-world"
        style={{
          width: WORLD,
          height: WORLD,
          ["--kw-drive-len" as string]: `${WORLD + 40}px`,
          // LRT/MRT route waypoints (see ROUTE_P0..P3 above) — read by the
          // kw-drive-l/-l-rev keyframes so TransitTrain's path scales with
          // this grid's actual geometry instead of being hardcoded per grid
          // size. Harmless to always set even when showTransit is false;
          // nothing references them without a rendered .kw-train-path.
          ["--kw-lrt-x0" as string]: `${ROUTE_P0.x}px`,
          ["--kw-lrt-y0" as string]: `${ROUTE_P0.y}px`,
          ["--kw-lrt-x1" as string]: `${ROUTE_P1.x}px`,
          ["--kw-lrt-y1" as string]: `${ROUTE_P1.y}px`,
          ["--kw-lrt-x2" as string]: `${ROUTE_P2.x}px`,
          ["--kw-lrt-y2" as string]: `${ROUTE_P2.y}px`,
          ["--kw-lrt-x3" as string]: `${ROUTE_P3.x}px`,
          ["--kw-lrt-y3" as string]: `${ROUTE_P3.y}px`,
        }}
      >
        {worldDecorPre}
        {zones.map((zone, index) => (
          <ZonePlot
            key={zone.id}
            zone={zone}
            selected={zone.id === selectedZoneId}
            onSelect={setSelectedZoneId}
            movedRef={movedRef}
            lang={lang}
            col={zonePositions[index]?.col ?? 0}
            row={zonePositions[index]?.row ?? 0}
            gridSize={gridSize}
            density={density}
            traits={traits}
            celebrating={celebration?.zoneId === zone.id ? celebration.at : 0}
          />
        ))}
        {/* Vacant, surveyed-but-undeveloped lots — the "empty grid" around a
            rural seat's small built core, or the last few gaps a near-full
            metro grid hasn't filled yet. Purely decorative: no stats, no
            buildings, not clickable. */}
        {emptyCells.map(({ col, row }) => (
          <EmptyPlot key={`empty-${col}-${row}`} col={col} row={row} gridSize={gridSize} />
        ))}
        {worldDecorPost}
      </div>

      {/* Screen-space depth fog: fades the far/upper part of the frame toward
          the sky's horizon tone (the world's "far" edge projects toward the
          top of the frame under this camera tilt), approximating distance
          fog without touching the preserve-3d tree. */}
      <div className="kw-fog pointer-events-none absolute inset-0" />
      {/* Horizon glow: screen-space ring roughly where the ground plane's
          own fade dissolves (kw-world's fixed anchor is 50%/53% of the
          scene regardless of camera rotation), tinted with the tod's
          horizon colour so the ground reads as "meets a lit sky" instead
          of "meets black". Deliberately kept outside .kw-world — a
          mix-blend-mode/opacity layer inside the preserve-3d tree
          flattens the whole scene into roof-only rectangles. */}
      <div className="kw-horizonglow pointer-events-none absolute inset-0" />
      {/* Ground mist "cheat": low blurred cloud blobs sitting right where the
          worldground/farground fade happens on screen, drifting slowly.
          Doesn't fix the geometry — it hides the seam, same trick as fog
          over a horizon in any renderer. Screen-space (outside .kw-world)
          for the same flattening reason as kw-horizonglow. */}
      <div className="kw-groundmist pointer-events-none absolute inset-0" />
      {/* night dimmer + vignette over the world, under the HUD */}
      <div className="kw-tintlayer pointer-events-none absolute inset-0" />
      <div className="kw-rain" />
      <div className="kw-lightning" />

      {/* HUD (screen space) */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[64%] truncate border px-3 py-2 text-[10px] font-black tracking-[0.22em]" style={{ color: "#7dd3fc", borderColor: "rgba(125,211,252,0.35)", background: "rgba(3,8,15,0.72)" }}>
        {t(lang, "kawasan_page.interactive3dCity")} · {densityLabel}
      </div>
      <div className="pointer-events-none absolute left-4 top-[58px] flex flex-col gap-1 border px-2.5 py-1.5 text-[8px] font-bold tracking-[0.14em]" style={{ borderColor: "rgba(125,211,252,0.22)", background: "rgba(3,8,15,0.68)", color: "rgba(148,163,184,0.95)" }}>
        <div className="tracking-[0.2em]" style={{ color: "#7dd3fc" }}>{t(lang, "kawasan_page.zoneScore")}</div>
        {SCORE_LEGEND.map((band) => (
          <div key={band.labelKey} className="flex items-center gap-1.5">
            <span className="block h-1.5 w-3.5" style={{ background: band.color }} />
            <span>{t(lang, band.labelKey)}</span>
          </div>
        ))}
      </div>
      <div className="absolute right-4 top-4 flex flex-col gap-2" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Zoom in" className={controlButton} style={controlStyle} onClick={() => { markInteraction(); cam.current.zoom *= 1.15; applyCam(); }}>+</button>
        <button type="button" aria-label="Zoom out" className={controlButton} style={controlStyle} onClick={() => { markInteraction(); cam.current.zoom *= 0.87; applyCam(); }}>-</button>
        <button type="button" aria-label="Reset camera" className={controlButton} style={controlStyle} onClick={() => { markInteraction(); cam.current = { ...CAM_DEFAULT, zoom: defaultZoom.current }; applyCam(); }}>R</button>
        <button
          type="button"
          className="pointer-events-auto border px-2 py-2 text-[9px] font-black tracking-widest"
          style={controlStyle}
          onClick={() => { markInteraction(); setTod((current) => TOD_SEQUENCE[(TOD_SEQUENCE.indexOf(current) + 1) % TOD_SEQUENCE.length]); }}
        >
          {TOD_ICON[tod]} {t(lang, `kawasan_page.tod_${tod}`)}
        </button>
        <button
          type="button"
          className="pointer-events-auto border px-2 py-2 text-[9px] font-black tracking-widest"
          style={controlStyle}
          onClick={() => { markInteraction(); setWeather((current) => (current === "rain" ? "clear" : "rain")); }}
        >
          {weather === "rain" ? `🌧 ${t(lang, "kawasan_page.rain")}` : `☀ ${t(lang, "kawasan_page.clear")}`}
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[9px] font-bold tracking-[0.18em]" style={{ color: "rgba(148,163,184,0.95)" }}>
        <span>{t(lang, "kawasan_page.dragRotateMap")} / {t(lang, "kawasan_page.scrollZoom")}</span>
        <span>{t(lang, "kawasan_page.clickAZoneToPickA")}</span>
      </div>
      {/* Minimap: top-down grid readout, screen-space (sibling of .kw-world,
          not inside its preserve-3d tree). The compass wedge reads --kw-rz
          straight off this element via CSS var() — --kw-rz is set
          imperatively on the .kw-scene root (this component's own outer
          div) every frame during drag/zoom (see applyCam above), and CSS
          custom properties inherit to every descendant for free, so the
          wedge tracks the live camera angle without any extra per-frame
          JS write or React state of its own. This orbit camera has no pan,
          only rotate+tilt+zoom, so "camera position" here is really just
          the orbit angle — the wedge direction is the honest equivalent of
          a position dot. */}
      <div className="pointer-events-auto absolute bottom-16 right-4 border p-1.5" style={{ borderColor: "rgba(125,211,252,0.3)", background: "rgba(3,8,15,0.8)" }}>
        <div className="mb-1 text-center text-[7px] font-black tracking-[0.2em]" style={{ color: "#7dd3fc" }}>{t(lang, "kawasan_page.map")}</div>
        <div className="relative" style={{ width: gridSize * MINIMAP_CELL, height: gridSize * MINIMAP_CELL }}>
          {Array.from({ length: gridSize * gridSize }, (_, index) => {
            const col = index % gridSize;
            const row = Math.floor(index / gridSize);
            const zone = zoneByCell.get(`${col},${row}`);
            const isSelected = !!zone && zone.id === selectedZoneId;
            return (
              <div
                key={`mm-${col}-${row}`}
                className="absolute"
                onClick={zone ? () => setSelectedZoneId(zone.id) : undefined}
                style={{
                  left: col * MINIMAP_CELL,
                  top: row * MINIMAP_CELL,
                  width: MINIMAP_CELL - 1,
                  height: MINIMAP_CELL - 1,
                  background: zone ? `rgba(${scoreTintRGB(zone.sentiment)},0.85)` : "rgba(148,163,184,0.12)",
                  outline: isSelected ? "1px solid var(--gold)" : undefined,
                  cursor: zone ? "pointer" : undefined,
                }}
              />
            );
          })}
          <div className="pointer-events-none absolute" style={{ left: "50%", top: "50%", width: 0, height: 0, transform: "translate(-50%,-50%) rotate(var(--kw-rz, 45deg))" }}>
            <div style={{ width: 0, height: 0, marginTop: -gridSize * MINIMAP_CELL * 0.5, borderLeft: "3.5px solid transparent", borderRight: "3.5px solid transparent", borderBottom: "8px solid #facc15", filter: "drop-shadow(0 0 2px rgba(250,204,21,0.8))" }} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default function KawasanDevelopmentPage() {
  const router = useRouter();
  const lang = useLang();
  const { states, leader, resources, settings, operations, addOperation, setLeader, journey, journeyAction, day, totalDays } = useGameStore();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("zone-0");
  const [notice, setNotice] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ zoneId: string; at: number } | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [manifestoDraft, setManifestoDraft] = useState(leader.manifesto ?? "");
  const [manifestoSaved, setManifestoSaved] = useState(true);
  // Transient feedback states — Save flips a button to a green "✓ SAVED"
  // confirmation for a moment, and a launched op's support-gain figure
  // floats up off its button, instead of both actions being silent.
  const [justSaved, setJustSaved] = useState(false);
  const [launchedType, setLaunchedType] = useState<OpType | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [focusedDestination, setFocusedDestination] = useState<string | null>(null);
  const [activeInterior, setActiveInterior] = useState<OfficeInteriorKind | null>(null);
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);

  const homeState = states.find((state) => state.id === (settings.electionScope === "prn" ? settings.prnStateId : leader.homeState)) ?? states.find((state) => state.id === leader.homeState) ?? states[0];
  const seatMode = settings.electionScope === "prn" ? "dun" : "parliament";
  const constituencies = useMemo(() => homeState ? generateConstituencies(homeState, seatMode) : [], [homeState, seatMode]);
  const ownSeat = constituencies.find((seat) => seat.id === leader.homeConstituencyId) ?? constituencies[0];
  const seatKindMS = settings.electionScope === "prn" ? "DUN" : "PARLIMEN";

  // City density scales with population per km² (people actually living
  // there, packed into the seat's modeled area) — not raw voter turnout,
  // which says nothing about how physically built-up a seat is. ~50/km²
  // reads rural, ~3,000/km²+ reads metro (more filler buildings + skyscrapers).
  const popDensity = ownSeat ? ownSeat.population / ownSeat.areaKm2 : 500;
  const rawDensity = Math.max(0, Math.min(1, (popDensity - 50) / 2950));
  // Raw population/areaKm2 are independently seeded RNG values with no idea
  // which real seat they landed on, so a famous metro seat (Bukit Bintang,
  // Cheras, Petaling Jaya...) could roll a low density and build out as a
  // kampung. ownSeat.areaType (see constituencies.ts) is a curated
  // classification for known seats plus a state-urban%-blended fallback for
  // the rest, and clamps the raw density into the band its real-world
  // character calls for — rawDensity still adds texture within that band.
  const areaType = ownSeat?.areaType ?? "suburban";
  const density = areaType === "urban_dense"
    ? Math.max(0.85, rawDensity)
    : areaType === "suburban"
    ? Math.min(0.62, Math.max(0.3, rawDensity))
    : Math.min(0.29, rawDensity);
  // Every seat gets at least a real 6x6 town plan; density decides the grid
  // size (6/8/10/12) AND how many of those cells are actually built up — a
  // rural seat only develops its town core and leaves the rest as open
  // land, a dense metro seat fills its (much bigger) grid almost entirely.
  const gridSize = kawasanGridSize(density);
  const developedCount = kawasanDevelopedCount(density, gridSize);
  const densityLabel = density >= 0.85
    ? t(lang, "kawasan_page.denseMetro")
    : density >= 0.62
    ? t(lang, "kawasan_page.metro")
    : density >= 0.3
    ? t(lang, "kawasan_page.semiUrban")
    : t(lang, "kawasan_page.rural");

  const traits = useMemo(() => deriveSeatTraits(ownSeat?.name ?? "", homeState?.id ?? ""), [ownSeat?.name, homeState?.id]);
  const traitLabels = [
    traits.coastal ? t(lang, "kawasan_page.coastal") : null,
    traits.paddy ? t(lang, "kawasan_page.riceBowl") : null,
    traits.hilly ? t(lang, "kawasan_page.highlands") : null,
    traits.industrial ? t(lang, "kawasan_page.industrial") : null,
  ].filter(Boolean).join(" · ");
  const sceneLabel = traitLabels ? `${densityLabel} · ${traitLabels}` : densityLabel;

  const seatId = ownSeat?.id ?? "unknown";
  useEffect(() => {
    const saved = journey.cityZones[seatId];
    const base = saved ?? makeZones(seatId, traits, developedCount);
    const completed = journey.pledges.filter(p => p.status === "delivered");
    const display = base.map((zone, index) => {
      if (index !== 0) return zone;
      let next = { ...zone, projects: [...zone.projects] };
      for (const pledge of completed) {
        const id = pledge.id === "jobs" ? "market" : pledge.id;
        if (!next.projects.includes(id)) {
          const project = PROJECTS.find(p => p.id === id)!;
          next.projects.push(id);
          next = { ...next, [project.target]: clamp(next[project.target] + project.boost) };
        }
      }
      return { ...next, sentiment: Math.round((next.infra + next.welfare + next.economy) / 3) };
    });
    setZones(display);
  }, [seatId, traits, developedCount, journey.cityZones, journey.pledges]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 2600);
    return () => clearTimeout(timer);
  }, [celebration]);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? zones[0];
  // WebGL city map is on by default (USE_GL_MAP); ?glmap=0 forces the old
  // CSS-3D map for this session without a redeploy.
  const useGlMap = useMemo(() => {
    if (!USE_GL_MAP) return false;
    if (typeof window === "undefined") return true;
    return new URLSearchParams(window.location.search).get("glmap") !== "0";
  }, []);
  // Development is available during the campaign; project costs and zone
  // progression still apply normally. Election victory continues to gate
  // the separate government route below.
  const unlocked = journey.chapter === "government";
  const overall = zones.length ? Math.round(zones.reduce((sum, zone) => sum + zone.sentiment, 0) / zones.length) : 0;
  const totalProjects = zones.reduce((sum, zone) => sum + zone.projects.length, 0);

  const pendingProject = pendingProjectId ? PROJECTS.find((project) => project.id === pendingProjectId) ?? null : null;
  const canRunCityActivity = journey.chapter === "campaign" && day < totalDays && journey.decisions > 0;
  const cityActivity = ["results", "formation", "opposition", "rebuilding"].includes(journey.chapter)
    ? { icon: journey.chapter === "results" ? "📊" : journey.chapter === "formation" ? "🤝" : "🧭", title: journey.chapter === "results" ? t(lang, "Pusat keputusan", "Results centre") : journey.chapter === "formation" ? t(lang, "Dewan rundingan", "Negotiation hall") : t(lang, "Pusat gerakan", "Movement centre"), detail: t(lang, "Bab politik seterusnya menanti di pusat bandar.", "Your next political chapter awaits in the city centre."), label: t(lang, "Sambung perjalanan", "Continue journey"), run: () => router.push(`${resumeRoute(useGameStore.getState())}?from=city`), enabled: true }
    : journey.chapter === "government" && selectedZone?.kind === "commercial"
    ? { icon: "🏛️", title: t(lang, "Bangunan kabinet", "Cabinet building"), detail: t(lang, "Lantik pasukan menteri dan urus portfolio kerajaan.", "Appoint your ministerial team and manage government portfolios."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("cabinet"), enabled: true }
    : journey.chapter === "government" && selectedZone?.kind === "industry"
    ? { icon: "⚖️", title: t(lang, "Pusat pentadbiran", "Administration centre"), detail: t(lang, "Laksana dasar dan majukan penggal pentadbiran.", "Deliver policies and advance the administration term."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("administration"), enabled: true }
    : journey.chapter === "government" && selectedZone?.kind === "river"
    ? { icon: "🗺️", title: t(lang, "Pusat analisis negara", "National analysis centre"), detail: t(lang, "Lihat kesan keputusan anda di seluruh negara.", "See the impact of your decisions across the country."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("national"), enabled: true }
    : journey.chapter === "government"
    ? { icon: "🏢", title: t(lang, "Pejabat wakil rakyat", "Representative office"), detail: t(lang, "Semak janji kawasan dan rekod perkhidmatan anda.", "Review constituency promises and your service record."), label: t(lang, "Masuk pejabat", "Enter office"), run: () => setActiveInterior("office"), enabled: true }
    : focusedDestination === "calendar" && selectedZone?.kind === "education"
    ? { icon: "📅", title: t(lang, "Bilik jadual kempen", "Campaign calendar room"), detail: t(lang, "Masuk untuk menyusun masa, lawatan dan gerakan harian.", "Enter to plan time, visits and daily movement."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("calendar"), enabled: true }
    : selectedZone?.kind === "community"
    ? { icon: "🤝", title: t(lang, "Pusat khidmat komuniti", "Community service centre"), detail: t(lang, "Bertemu penduduk dan dengar isu setempat.", "Meet residents and hear local issues."), label: t(lang, "Mulakan lawatan", "Start visit"), run: () => journeyAction({ type: "campaign", action: "visit" }), enabled: canRunCityActivity && resources.funds >= 25_000 }
    : selectedZone?.kind === "market"
    ? { icon: "🏪", title: t(lang, "Pasar dan rangkaian peniaga", "Market and trader network"), detail: t(lang, "Bina dana kecil dan hubungan perniagaan setempat.", "Build grassroots funds and local business ties."), label: t(lang, "Kutip dana", "Fundraise"), run: () => journeyAction({ type: "campaign", action: "fundraise" }), enabled: canRunCityActivity }
    : selectedZone?.kind === "education"
    ? { icon: "📋", title: t(lang, "Pusat latihan jentera", "Organisation training centre"), detail: t(lang, "Latih sukarelawan untuk menggerakkan kempen.", "Train volunteers to power the campaign."), label: t(lang, "Latih jentera", "Train organisers"), run: () => journeyAction({ type: "campaign", action: "organise" }), enabled: canRunCityActivity && resources.funds >= 40_000 }
    : selectedZone?.kind === "commercial"
    ? { icon: "🏛️", title: t(lang, "Pusat parti", "Party headquarters"), detail: t(lang, "Semak calon, manifesto dan operasi kempen.", "Review candidates, manifesto and campaign operations."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("party"), enabled: true }
    : selectedZone?.kind === "industry"
    ? { icon: "🛰️", title: t(lang, "Pusat operasi", "Operations centre"), detail: t(lang, "Susun operasi, medan negeri dan hari kempen.", "Plan operations, state battlefield and campaign days."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("operations"), enabled: true }
    : selectedZone?.kind === "housing" || selectedZone?.kind === "village"
    ? { icon: "📡", title: t(lang, "Pusat media", "Media centre"), detail: t(lang, "Susun mesej dan respons kepada penduduk.", "Plan messages and responses for residents."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("media"), enabled: true }
    : selectedZone?.kind === "river"
    ? { icon: "📈", title: t(lang, "Pusat tinjauan", "Polling centre"), detail: t(lang, "Semak momentum dan perubahan sokongan.", "Review momentum and shifts in support."), label: t(lang, "Masuk bangunan", "Enter building"), run: () => setActiveInterior("commission"), enabled: true }
    : { icon: "🏢", title: t(lang, "Pejabat politik anda", "Your political office"), detail: t(lang, "Rancang langkah seterusnya dan semak perjalanan karier.", "Plan the next move and review your career journey."), label: t(lang, "Masuk pejabat", "Enter office"), run: () => setActiveInterior("office"), enabled: true };

  function runProject(project: Project, targetZoneId = selectedZone?.id) {
    const targetZone = zones.find((zone) => zone.id === targetZoneId);
    if (!targetZone) return;
    // Defensive: the UI never exposes a clickable project button pre-win
    // (see the locked-panel branch below), but guard the action itself
    // too in case something calls it directly.
    if (!unlocked || useGameStore.getState().careerProgress.month >= 60) {
      setNotice(t(lang, "Formasi kerajaan membuka bajet pembangunan awam. Mulakan dengan janji di atas.", "Forming government unlocks the public development budget. Start with a commitment above."));
      return;
    }
    if (targetZone.projects.includes(project.id)) {
      setNotice(t(lang, "kawasan_page.projectAlreadyApprovedForThisZone"));
      return;
    }
    const locked = lockReason(project, targetZone, lang);
    if (locked) {
      setNotice(t(lang, "kawasan_page.projectStillLocked"));
      return;
    }
    if (journey.publicBudget < project.cost) {
      setNotice(t(lang, "kawasan_page.insufficientBudget"));
      return;
    }

    const current = useGameStore.getState().journey;
    if (current.construction.some(w => w.seat === seatId && w.zone === targetZone.id && w.project === project.id)) return;
    useGameStore.setState(state => ({ journey: { ...state.journey,
      publicBudget: state.journey.publicBudget - project.cost,
      cityZones: { ...state.journey.cityZones, [seatId]: zones },
      construction: [...state.journey.construction, { seat: seatId, zone: targetZone.id, project: project.id, target: project.target, boost: project.boost, remaining: 2 }],
    } }));
    setSelectedZoneId(targetZone.id);
    setPendingProjectId(null);

    setNotice(t(lang, "Pembinaan bermula. Siap dalam dua suku tahun.", "Construction started. Completion in two quarters."));
  }

  function handleZoneSelect(zoneId: string) {
    setSelectedZoneId(zoneId);
    setFocusedDestination(null);
    setFocusZoneId(null);
    setBuildMenuOpen(false);
    if (pendingProject) runProject(pendingProject, zoneId);
  }

  function focusDestination(destination: CityDestination) {
    const preferredKind: Record<string, ZoneKind> = { office: "urban", party: "commercial", operations: "industry", calendar: "education", media: "housing", commission: "river", cabinet: "commercial", administration: "industry", national: "river" };
    const target = zones.find((zone) => zone.kind === preferredKind[destination.id]) ?? zones[0];
    if (!target) return;
    setSelectedZoneId(target.id);
    setFocusZoneId(target.id);
    setFocusedDestination(destination.id);
    setNotice(t(lang, `PA: ${destination[lang].name} telah ditanda pada peta. Klik bangunan yang ditanda untuk masuk.`, `PA: ${destination[lang].name} is marked on the map. Click the marked building to go inside.`));
  }

  function enterFocusedBuilding() {
    const interiors: Record<string, OfficeInteriorKind> = { office: "office", party: "party", operations: "operations", calendar: "calendar", media: "media", commission: "commission", cabinet: "cabinet", administration: "administration", national: "national" };
    const interior = focusedDestination ? interiors[focusedDestination] : null;
    if (interior) setActiveInterior(interior);
  }

  function launchQuickOperation(type: OpType) {
    if (!homeState || journey.chapter !== "campaign" || journey.decisions < 1) return;
    const template = OP_TEMPLATES[type];
    if (resources.funds < template.fundsCost || resources.manpower < template.manpowerCost) return;
    // Display name only — the operation still scopes its actual support gain
    // to the whole state via stateIds below, but the label/notice should
    // name the seat the player is personally contesting (e.g. "Petaling
    // Jaya"), not just the state, since this launch is triggered from the
    // player's own kawasan screen.
    const seatLabel = ownSeat ? `${ownSeat.name}, ${homeState.name}` : homeState.name;
    addOperation({
      id: `op-kawasan-${Date.now()}`,
      name: t(lang, `kawasan_page.opLabel_${type}`),
      type,
      location: seatLabel,
      stateIds: [homeState.id],
      status: "active",
      manpowerCost: template.manpowerCost,
      fundsCost: template.fundsCost,
      supportGain: template.supportGain,
    });
    setNotice(t(lang, "kawasan_page.launchedIn", { template: t(lang, `kawasan_page.opLabel_${type}`), ownSeatNameHomeState: ownSeat?.name ?? homeState.name }));
    setLaunchedType(type);
    window.setTimeout(() => setLaunchedType((cur) => (cur === type ? null : cur)), 1100);
  }

  function saveManifesto() {
    setLeader({ manifesto: manifestoDraft });
    setManifestoSaved(true);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1400);
  }

  if (!ownSeat) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Header />
        <main className="pt-[80px] px-8">
          <TacticalPanel title={t(lang, "kawasan_page.noConstituency")}>
            <div className="text-text-muted">{t(lang, "kawasan_page.selectWinASeatBeforeManaging")}</div>
          </TacticalPanel>
        </main>
      </div>
    );
  }

  return (
    <div className="kw-page-shell min-h-screen">
      <Header />
      <CityOnboarding />
      {notice && (
        <div role="status" className="fixed right-6 top-[58px] z-[80] border px-5 py-3 text-[11px] font-black tracking-[0.2em] uppercase" style={{ borderColor: "rgb(var(--gold-rgb)/0.58)", background: "linear-gradient(135deg, rgb(var(--gold-rgb)/0.16), rgb(var(--bg-rgb) / 0.96))", color: "var(--gold)", fontFamily: "Space Mono, monospace" }}>
          {notice}
        </div>
      )}

      <main className="kw-page-content px-3 pb-[40px] pt-[48px] w-full">
        <div className="relative h-[calc(100vh-92px)] min-h-[560px]">
          <TacticalPanel noPadding className="h-full overflow-hidden">
            <div className="relative h-full">
              {useGlMap ? (
                <City3DMapGL zones={zones} selectedZoneId={selectedZone?.id ?? selectedZoneId} setSelectedZoneId={handleZoneSelect} lang={lang} gridSize={gridSize} density={density} densityLabel={sceneLabel} traits={traits} celebration={celebration} overall={overall} focusZoneId={focusZoneId} onEnterFocusedZone={enterFocusedBuilding} height="calc(100vh - 94px)" />
              ) : (
                <City3DMap zones={zones} selectedZoneId={selectedZone?.id ?? selectedZoneId} setSelectedZoneId={handleZoneSelect} lang={lang} gridSize={gridSize} density={density} densityLabel={sceneLabel} traits={traits} celebration={celebration} overall={overall} />
              )}
              <div className="pointer-events-none absolute left-4 top-3 z-20 max-w-[min(360px,calc(100%-112px))]" style={{ fontFamily: "'Space Mono', monospace" }}>
                <div className="inline-block border px-3 py-2 shadow-xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .4)", background: "rgb(var(--bg-rgb) / .82)", backdropFilter: "blur(12px)" }}>
                  <div className="text-[8px] font-black tracking-[.2em] text-cyan">{seatKindMS} {ownSeat.code} · {t(lang, "BANDAR 3D AKTIF", "3D CITY ACTIVE")}</div>
                  <div className="mt-1 text-sm font-black tracking-wider text-white">{ownSeat.name} <span className="text-gold">· {overall}%</span></div>
                </div>
              </div>
              <CityDestinations onFocus={focusDestination} variant="overlay" />
              <PersonalAssistant embedded />
              {selectedZone && <div className="absolute bottom-20 left-4 z-20 w-[min(330px,calc(100%-32px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--cyan-rgb) / .42)", background: "rgb(var(--bg-rgb) / .9)", backdropFilter: "blur(12px)", fontFamily: "'Space Mono', monospace" }}>
                <div className="flex items-start gap-2"><span className="text-xl">{cityActivity.icon}</span><div className="min-w-0"><div className="text-[9px] font-black tracking-widest text-gold">{zoneIcon(selectedZone.kind)} {zoneName(lang, selectedZone)}</div><p className="mt-1 text-[10px] leading-relaxed text-text-muted">{cityActivity.detail}</p></div></div>
                <div className="mt-2 flex gap-2"><button type="button" onClick={cityActivity.run} disabled={!cityActivity.enabled} className="flex-1 border px-2 py-2 text-[9px] font-black tracking-widest disabled:opacity-40" style={{ borderColor: "rgb(var(--cyan-rgb) / .5)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb) / .08)" }}>{cityActivity.label} →</button>{unlocked && <button type="button" onClick={() => setBuildMenuOpen((open) => !open)} className="border px-2 py-2 text-[9px] font-black tracking-widest" style={{ borderColor: "rgb(var(--gold-rgb) / .5)", color: "var(--gold)", background: "rgb(var(--gold-rgb) / .08)" }}>BINA</button>}</div>
              </div>}
              {buildMenuOpen && selectedZone && <div className="absolute bottom-20 left-4 z-30 w-[min(470px,calc(100%-32px))] border p-3 shadow-2xl" style={{ borderColor: "rgb(var(--gold-rgb) / .55)", background: "rgb(var(--bg-rgb) / .96)", backdropFilter: "blur(14px)", fontFamily: "'Space Mono', monospace" }}><div className="mb-2 flex items-center justify-between"><b className="text-[10px] tracking-widest text-gold">{t(lang, "PILIH PROJEK UNTUK ZON", "CHOOSE A PROJECT FOR ZONE")}</b><button type="button" onClick={() => setBuildMenuOpen(false)} className="text-text-muted">×</button></div><div className="grid grid-cols-3 gap-1 sm:grid-cols-4">{PROJECTS.filter((project) => !selectedZone.projects.includes(project.id)).slice(0, 12).map((project) => <button key={project.id} type="button" onClick={() => { setPendingProjectId(project.id); setBuildMenuOpen(false); setNotice(t(lang, "kawasan_page.clickZoneToPlaceProject")); }} className="border p-2 text-left" style={{ borderColor: "rgb(var(--cyan-rgb) / .2)", background: "rgb(var(--bg-rgb) / .7)" }}><span>{project.icon}</span><span className="mt-1 block text-[8px] font-black text-white">{t(lang, `kawasan_page.projectTitle_${project.id}`)}</span><span className="mt-1 block text-[8px] text-gold">RM {formatNumber(project.cost)}</span></button>)}</div></div>}
            </div>
          </TacticalPanel>

          <aside className="hidden space-y-4 lg:sticky lg:top-14 lg:max-h-[calc(100vh-76px)] lg:overflow-y-auto lg:pr-1">
            <CityDestinations onFocus={focusDestination} />
            <div className="grid grid-cols-2 gap-2">
              <div className="border p-2" style={{ borderColor: "rgb(var(--gold-rgb)/0.24)", background: "rgb(var(--bg-rgb) / 0.64)" }}><div className="text-[8px] text-text-muted tracking-widest">{unlocked ? t(lang, "Bajet", "Budget") : t(lang, "Dana", "Funds")}</div><div className="mt-1 text-sm font-black" style={{ color: "var(--gold)" }}>RM {formatNumber(unlocked ? journey.publicBudget : resources.funds)}</div></div>
              <div className="border p-2" style={{ borderColor: "rgb(var(--cyan-rgb)/0.24)", background: "rgb(var(--bg-rgb) / 0.64)" }}><div className="text-[8px] text-text-muted tracking-widest">{t(lang, "kawasan_page.sentiment")}</div><div className="mt-1 text-sm font-black" style={{ color: metricColor(overall) }}>{overall}%</div></div>
            </div>
            <JourneyPanel local />
            {!unlocked && (
              <TacticalPanel title={t(lang, "kawasan_page.manifestoCampaign")}>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-black tracking-widest text-text-muted">{t(lang, "kawasan_page.seatManifesto")}</span>
                      {!manifestoSaved && <span className="animate-pulse text-[9px] font-bold tracking-widest" style={{ color: "var(--warn-orange)" }}>{t(lang, "kawasan_page.unsaved")}</span>}
                    </div>
                    <textarea
                      value={manifestoDraft}
                      onChange={(event) => { setManifestoDraft(event.target.value); setManifestoSaved(false); }}
                      placeholder={t(lang, "kawasan_page.writeYourPledgesAndPolicyFocus")}
                      rows={4}
                      className="w-full resize-none text-[12px] transition-shadow duration-300 focus:shadow-cyan-lg focus:outline-none"
                      style={{ background: "rgb(var(--bg-rgb) / 0.72)", border: "1px solid rgb(var(--cyan-rgb)/0.2)", color: "var(--text-primary)", padding: "8px" }}
                    />
                    <button
                      onClick={saveManifesto}
                      disabled={manifestoSaved}
                      className="mt-2 border px-3 py-1.5 text-[10px] font-black tracking-widest transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        borderColor: justSaved ? "rgba(0,255,136,0.55)" : "rgb(var(--gold-rgb)/0.45)",
                        color: justSaved ? "var(--neon-green)" : "var(--gold)",
                        background: justSaved ? "rgba(0,255,136,0.12)" : "rgb(var(--gold-rgb)/0.08)",
                        transform: justSaved ? "scale(1.05)" : "scale(1)",
                      }}
                    >
                      {justSaved ? t(lang, "kawasan_page.savedConfirm") : t(lang, "kawasan_page.saveManifesto")}
                    </button>
                  </div>

                  <div className="border-t pt-3" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.12)" }}>
                    <div className="mb-2 text-[10px] font-black tracking-widest text-text-muted">
                      {t(lang, "kawasan_page.quickCampaignLaunch", { homeStateName: homeState?.name?.toUpperCase() ?? "" })}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(OP_TEMPLATES) as OpType[]).map((type) => {
                        const template = OP_TEMPLATES[type];
                        const affordable = journey.chapter === "campaign" && journey.decisions > 0 && resources.funds >= template.fundsCost && resources.manpower >= template.manpowerCost;
                        const justLaunched = launchedType === type;
                        return (
                          <button
                            key={type}
                            onClick={() => launchQuickOperation(type)}
                            disabled={!affordable}
                            title={`RM ${formatNumber(template.fundsCost)} · ${template.manpowerCost} MAN`}
                            className={`relative border p-2 text-left transition-all duration-200 enabled:hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40 ${affordable && !justLaunched ? "animate-glow-pulse" : ""}`}
                            style={{
                              borderColor: justLaunched ? "rgba(0,255,136,0.6)" : "rgb(var(--cyan-rgb)/0.2)",
                              background: justLaunched ? "rgba(0,255,136,0.14)" : "rgb(var(--bg-rgb) / 0.6)",
                              transform: justLaunched ? "scale(1.05)" : undefined,
                            }}
                          >
                            <div className="text-[10px] font-black tracking-wider" style={{ color: "var(--cyan)" }}>{t(lang, `kawasan_page.opLabel_${type}`)}</div>
                            <div className="mt-0.5 text-[9px] text-text-muted">RM {formatNumber(template.fundsCost)} · +{template.supportGain}%/{t(lang, "kawasan_page.day")}</div>
                            {justLaunched && (
                              <span
                                className="pointer-events-none absolute left-1/2 top-0 text-[11px] font-black"
                                style={{ color: "var(--neon-green)", animation: "kw-float-gain 1.1s ease-out forwards" }}
                              >
                                +{template.supportGain}% 🚀
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-[9px] leading-relaxed text-text-muted">
                      {t(lang, "kawasan_page.activeOperationsInVisitWarRoom", { operationsFilterOp: operations.filter((op) => op.stateIds.includes(homeState?.id ?? "")).length, homeStateName: homeState?.name ?? "negeri anda", homeStateName2: homeState?.name ?? "your state" })}
                    </div>
                  </div>
                </div>
              </TacticalPanel>
            )}

            <TacticalPanel
              title={
                selectedZone
                  ? unlocked
                    ? t(lang, "kawasan_page.develop", { zoneName: zoneName(lang, selectedZone).toUpperCase() })
                    : t(lang, "kawasan_page.zoneInfo", { zoneName: zoneName(lang, selectedZone).toUpperCase() })
                  : t(lang, "kawasan_page.developArea")
              }
              noPadding
            >
              {selectedZone && (
                <div className="border-b p-4" style={{ borderColor: "rgb(var(--gold-rgb) / 0.28)", background: "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.09), rgb(var(--bg-rgb) / 0.68))" }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl" aria-hidden="true">{cityActivity.icon}</span>
                    <div className="min-w-0 flex-1"><div className="text-[10px] font-black tracking-widest" style={{ color: "var(--gold)" }}>{cityActivity.title}</div><p className="mt-1 text-[10px] leading-relaxed text-text-muted">{cityActivity.detail}</p></div>
                  </div>
                  <button type="button" onClick={cityActivity.run} disabled={!cityActivity.enabled} className="mt-3 w-full border px-3 py-2 text-[10px] font-black tracking-widest disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.45)", background: "rgb(var(--cyan-rgb) / 0.08)", color: "var(--cyan)" }}>{cityActivity.label} →</button>
                </div>
              )}
              {selectedZone && (
                <div className="border-b p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.14)", background: "linear-gradient(135deg, rgb(var(--cyan-rgb)/0.07), rgb(var(--bg-rgb) / 0.72))" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{zoneIcon(selectedZone.kind)} {zoneName(lang, selectedZone)}</div>
                      <div className="text-[10px] font-bold tracking-widest" style={{ color: "var(--cyan)" }}>{t(lang, `kawasan_page.zoneType_${selectedZone.archetype}`)} · {selectedZone.projects.length} {t(lang, "kawasan_page.projects2")}</div>
                    </div>
                    <div className="text-4xl font-black" style={{ color: metricColor(selectedZone.sentiment) }}>{selectedZone.sentiment}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[9px] font-bold tracking-widest">
                    {STAT_ORDER.map((key) => (
                      <div key={key} className="border p-2" style={{ borderColor: "rgb(var(--cyan-rgb)/0.12)" }}>
                        <div className="text-text-muted">{key === "welfare" ? "RAKYAT" : key.toUpperCase()}</div>
                        <div className="mt-1 h-1.5" style={{ background: "var(--bar-empty)" }}><div className="h-full" style={{ width: `${selectedZone[key]}%`, background: metricColor(selectedZone[key]), transition: "width 0.7s cubic-bezier(0.22,1,0.36,1), background 0.5s" }} /></div>
                        <div className="mt-1" style={{ color: metricColor(selectedZone[key]) }}>{selectedZone[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!unlocked ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="text-3xl">🔒</div>
                  <div className="text-[12px] font-black tracking-widest text-white">
                    {t(lang, "kawasan_page.developmentNotYetUnlocked")}
                  </div>
                  <div className="max-w-[280px] text-[11px] leading-relaxed text-text-muted">
                    {t(lang, "kawasan_page.winThisSeatInTheElection")}
                  </div>
                </div>
              ) : (
              <div className="max-h-[calc(100vh-360px)] min-h-[420px] overflow-y-auto p-4 space-y-3">
                {pendingProject && (
                  <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb) / 0.62)", background: "linear-gradient(135deg, rgb(var(--gold-rgb) / 0.14), rgb(var(--bg-rgb) / 0.78))", boxShadow: "0 0 22px rgb(var(--gold-rgb) / 0.12)" }}>
                    <div className="text-[10px] font-black tracking-widest" style={{ color: "var(--gold)" }}>{t(lang, "kawasan_page.placementMode")}</div>
                    <div className="mt-1 text-[11px] font-black text-white">{pendingProject.icon} {t(lang, `kawasan_page.projectTitle_${pendingProject.id}`)}</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-text-muted">{t(lang, "kawasan_page.clickZoneToPlaceProject")}</div>
                    <button type="button" onClick={() => setPendingProjectId(null)} className="mt-2 border px-2 py-1 text-[9px] font-black tracking-widest" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.35)", color: "var(--cyan)", background: "rgb(var(--bg-rgb) / 0.72)" }}>{t(lang, "kawasan_page.cancelPlacement")}</button>
                  </div>
                )}
                {PROJECTS.map((project) => {
                  const done = selectedZone?.projects.includes(project.id) ?? false;
                  const locked = done ? null : lockReason(project, selectedZone, lang);
                  const affordable = useGameStore.getState().careerProgress.month < 60 && journey.publicBudget >= project.cost && !journey.construction.some(w => w.seat === seatId && w.zone === selectedZone?.id && w.project === project.id);
                  const accent = done ? "var(--neon-green)" : locked ? "var(--text-muted)" : affordable ? "var(--gold)" : "var(--neon-red)";
                  return (
                    <button key={project.id} onClick={() => { setPendingProjectId(project.id); setNotice(t(lang, "kawasan_page.clickZoneToPlaceProject")); }} disabled={!affordable} className="w-full border p-3 text-left transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed" style={{ opacity: !affordable ? 0.55 : 1, borderColor: pendingProjectId === project.id ? "rgb(var(--gold-rgb) / 0.72)" : done ? "rgb(0 255 136 / 0.35)" : locked ? "rgba(148,163,184,0.28)" : "rgb(var(--cyan-rgb)/0.22)", background: pendingProjectId === project.id ? "rgb(var(--gold-rgb) / 0.11)" : done ? "rgb(0 255 136 / 0.06)" : "rgb(var(--bg-rgb) / 0.72)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] font-black tracking-wider" style={{ color: locked ? "var(--text-muted)" : "var(--text-primary)" }}>{locked ? "🔒" : project.icon} {t(lang, `kawasan_page.projectTitle_${project.id}`)}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-text-muted">{t(lang, `kawasan_page.projectDetail_${project.id}`)}</div>
                        </div>
                        <div className="shrink-0 text-right text-[10px] font-black tracking-widest" style={{ color: accent }}>
                          {pendingProjectId === project.id ? t(lang, "kawasan_page.selectLocation") : done ? t(lang, "kawasan_page.done2") : locked ? t(lang, "kawasan_page.locked") : `RM ${formatNumber(project.cost)}`}
                        </div>
                      </div>
                      <div className="mt-2 flex items-start justify-between gap-3 text-[9px] font-bold tracking-wider">
                        <span className="shrink-0" style={{ color: "var(--cyan)" }}>+{project.boost} {project.target === "welfare" ? "RAKYAT" : project.target.toUpperCase()}</span>
                        <span className="text-right" style={{ color: locked ? "var(--warn-orange)" : affordable || done ? "var(--text-muted)" : "var(--neon-red)" }}>
                          {pendingProjectId === project.id ? t(lang, "kawasan_page.clickZoneToPlaceProject") : done ? t(lang, "kawasan_page.visualUpgraded") : locked ?? t(lang, "kawasan_page.clickToBuild")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </TacticalPanel>
          </aside>
        </div>
      </main>

      {activeInterior && <OfficeInterior kind={activeInterior} onClose={() => setActiveInterior(null)} />}
      <StatusBar leftText={`${seatKindMS} ${ownSeat.code} · ${ownSeat.name} · ${t(lang, "kawasan_page.localCityBuilder")}`} rightText={t(lang, "kawasan_page.rmSentimentProjects", { formatNumberResourcesFunds: formatNumber(resources.funds), overall: overall, totalProjects: totalProjects })} />
    </div>
  );
}
