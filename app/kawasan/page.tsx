"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";
import { generateConstituencies } from "../data/constituencies";
import { formatNumber } from "../utils/format";

const STORAGE_PREFIX = "mymandat-kawasan-development-v2";

type ZoneKind = "urban" | "village" | "housing" | "commercial" | "education" | "industry" | "river" | "market" | "community";

type Zone = {
  id: string;
  nameMS: string;
  nameEN: string;
  typeMS: string;
  typeEN: string;
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
  titleMS: string;
  titleEN: string;
  detailMS: string;
  detailEN: string;
  cost: number;
  target: ZoneStat;
  boost: number;
  icon: string;
  requires?: Requirement;
};

const PROJECTS: Project[] = [
  { id: "road", icon: "🛣️", titleMS: "Naik Taraf Jalan & Lampu", titleEN: "Road & Streetlight Upgrade", detailMS: "Bina laluan utama, lampu jalan dan papan tanda keselamatan.", detailEN: "Build main access roads, lighting and safety signage.", cost: 180_000, target: "infra", boost: 12 },
  { id: "clinic", icon: "🏥", titleMS: "Klinik Komuniti Bergerak", titleEN: "Mobile Community Clinic", detailMS: "Rawatan asas, pemeriksaan warga emas dan klinik hujung minggu.", detailEN: "Basic care, senior checks and weekend clinics.", cost: 220_000, target: "welfare", boost: 14 },
  { id: "internet", icon: "📡", titleMS: "Internet Kawasan & WiFi Rakyat", titleEN: "Constituency Internet & Public WiFi", detailMS: "Menara mikro, WiFi awam dan pusat digital belia.", detailEN: "Micro towers, public WiFi and youth digital hubs.", cost: 260_000, target: "economy", boost: 13 },
  { id: "flood", icon: "🌊", titleMS: "Tebatan Banjir Mikro", titleEN: "Micro Flood Mitigation", detailMS: "Longkang, pam, kolam takungan dan amaran awal banjir.", detailEN: "Drains, pumps, detention ponds and flood alerts.", cost: 300_000, target: "infra", boost: 16 },
  { id: "market", icon: "🏪", titleMS: "Geran Pasar & Penjaja", titleEN: "Market & Hawker Grant", detailMS: "Kanopi, lot niaga, modal kecil dan promosi bazar rakyat.", detailEN: "Canopies, trade lots, micro grants and market promotions.", cost: 150_000, target: "economy", boost: 10 },
  { id: "school", icon: "🏫", titleMS: "Baik Pulih Sekolah / Dewan", titleEN: "School / Hall Repair", detailMS: "Dewan rakyat, padang, kelas tambahan dan kemudahan komuniti.", detailEN: "Community halls, fields, tuition rooms and public facilities.", cost: 200_000, target: "welfare", boost: 11 },
  { id: "park", icon: "🌳", titleMS: "Taman Rekreasi Rakyat", titleEN: "People's Recreation Park", detailMS: "Laluan pejalan kaki, taman permainan dan ruang keluarga.", detailEN: "Walkways, playgrounds and family spaces.", cost: 170_000, target: "welfare", boost: 9, requires: { zoneStat: { key: "infra", min: 55 } } },
  { id: "bus", icon: "🚌", titleMS: "Bas Komuniti & Hentian", titleEN: "Community Bus & Stops", detailMS: "Hentian berbumbung dan laluan bas mini ke pusat bandar.", detailEN: "Covered stops and minibus route to town centre.", cost: 240_000, target: "infra", boost: 13, requires: { projectId: "road" } },
  { id: "mall", icon: "🏬", titleMS: "Pusat Beli-Belah", titleEN: "Shopping Mall", detailMS: "Mall bertingkat dengan lot niaga tempatan dan medan selera.", detailEN: "Multi-storey mall with local retail lots and a food court.", cost: 400_000, target: "economy", boost: 18, requires: { projectId: "market", zoneStat: { key: "economy", min: 60 } } },
  { id: "stadium", icon: "🏟️", titleMS: "Kompleks Sukan Rakyat", titleEN: "Community Sports Complex", detailMS: "Stadium mini, gelanggang futsal dan trek larian komuniti.", detailEN: "Mini stadium, futsal courts and a community running track.", cost: 350_000, target: "welfare", boost: 15, requires: { projectId: "school" } },
  { id: "surau", icon: "🕌", titleMS: "Naik Taraf Masjid & Surau", titleEN: "Mosque & Surau Upgrade", detailMS: "Baik pulih kubah, dewan solat dan kelas agama komuniti.", detailEN: "Dome repairs, prayer hall and community religious classes.", cost: 160_000, target: "welfare", boost: 9 },
  { id: "office", icon: "🏢", titleMS: "Menara Pejabat SME", titleEN: "SME Office Tower", detailMS: "Ruang pejabat mampu sewa untuk syarikat kecil dan startup.", detailEN: "Affordable office space for small firms and startups.", cost: 450_000, target: "economy", boost: 20, requires: { projectId: "internet" } },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

// Real-constituency character, derived from the seat's actual name and
// state so the generated city echoes the real kawasan: coastal seats get
// a seafront, rice-bowl seats get paddies, highland seats get hills.
type SeatTraits = { coastal: boolean; paddy: boolean; hilly: boolean; industrial: boolean };

function deriveSeatTraits(seatName: string, stateId: string): SeatTraits {
  const name = seatName.toLowerCase();
  const has = (...words: string[]) => words.some((word) => name.includes(word));
  return {
    coastal: has("pantai", "teluk", "tanjung", "kuala", "pelabuhan", "port", "langkawi", "mersing", "pengerang", "sabak", "labuan", "sandakan", "tawau", "kudat", "semporna", "miri", "bintulu", "santubong", "bagan", "kepala batas", "balik pulau", "marang", "dungun", "kemaman", "besut", "bachok", "tumpat", "pontian", "batu pahat", "muar", "klang", "lumut", "beruas"),
    paddy: ["kedah", "perlis", "kelantan"].includes(stateId) || has("sabak bernam", "sungai besar", "sekinchan", "tanjung karang", "pendang", "yan", "kubang"),
    hilly: has("bukit", "gua", "hulu", "ulu", "cameron", "kundasang", "ranau", "keningau", "tambunan", "lipis", "raub", "bentong", "jelebu", "tapah", "kinta", "lenggong", "gerik", "baling", "jeli", "tenom"),
    industrial: has("gudang", "kulim", "shah alam", "klang", "perai", "prai", "senai", "skudai", "subang", "kapar", "larkin", "pasir gudang"),
  };
}

function seedFrom(text: string) {
  return text.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function makeZones(seedKey: string, traits: SeatTraits): Zone[] {
  const base = seedFrom(seedKey);
  const names: [string, string, string, string, ZoneKind][] = [
    ["Pusat Bandar", "Town Centre", "Bandar", "Urban", "urban"],
    ["Kampung Utama", "Main Village", "Kampung", "Village", "village"],
    ["Taman Perumahan", "Housing Estate", "Perumahan", "Housing", "housing"],
    ["Pusat Niaga", "Commercial Hub", "Niaga", "Commercial", "commercial"],
    ["Zon Sekolah", "School Zone", "Pendidikan", "Education", "education"],
    ["Kawasan Industri", "Industrial Area", "Industri", "Industry", "industry"],
    ["Pinggir Sungai", "Riverside", "Risiko Banjir", "Flood Risk", "river"],
    ["Pasar & Penjaja", "Market & Hawkers", "Ekonomi Rakyat", "People Economy", "market"],
    ["Klinik / Dewan", "Clinic / Hall", "Komuniti", "Community", "community"],
  ];
  if (traits.coastal) names[6] = ["Kampung Nelayan", "Fishing Village", "Pesisir Pantai", "Coastal", "river"];
  if (traits.paddy) names[1] = ["Kampung Sawah", "Paddy Village", "Jelapang Padi", "Rice Bowl", "village"];
  if (traits.industrial) names[5] = ["Zon Perindustrian", "Industrial Estate", "Industri Berat", "Heavy Industry", "industry"];

  return names.map(([nameMS, nameEN, typeMS, typeEN, kind], index) => {
    const n = base + index * 17;
    const infra = 42 + (n % 28);
    const welfare = 40 + ((n * 3) % 30);
    const economy = 38 + ((n * 5) % 32);
    return {
      id: `zone-${index}`,
      nameMS,
      nameEN,
      typeMS,
      typeEN,
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

// Legend bands mirror metricColor's cutoffs — keep the two in step.
const SCORE_LEGEND: { color: string; ms: string; en: string }[] = [
  { color: "var(--neon-green)", ms: "BAIK ≥ 74", en: "GOOD ≥ 74" },
  { color: "var(--gold)", ms: "SEDERHANA 54–73", en: "FAIR 54–73" },
  { color: "var(--neon-red)", ms: "KRITIKAL < 54", en: "CRITICAL < 54" },
];

const STAT_ORDER: ZoneStat[] = ["infra", "welfare", "economy"];

function statLabel(lang: ReturnType<typeof useLang>, key: ZoneStat) {
  if (key === "welfare") return t(lang, "RAKYAT", "WELFARE");
  if (key === "economy") return t(lang, "EKONOMI", "ECONOMY");
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
    if (prerequisite) missing.push(t(lang, `${prerequisite.titleMS} siap`, `${prerequisite.titleEN} done`));
  }
  if (requires.zoneStat && zone[requires.zoneStat.key] < requires.zoneStat.min) {
    missing.push(`${statLabel(lang, requires.zoneStat.key)} ≥ ${requires.zoneStat.min}`);
  }
  if (!missing.length) return null;
  return t(lang, `Perlu: ${missing.join(" & ")}`, `Requires: ${missing.join(" & ")}`);
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

const WORLD = 880;
const PLOT = 240;
const PLOT_XY = [40, 320, 600];
const ROADS_H = [0, 280, 560, 840];
const ROADS_V = [0, 280, 560];
const RIVER_X = 840;

type BType = "tower" | "skyscraper" | "antenna" | "shop" | "stall" | "house" | "factory" | "warehouse" | "school" | "clinic" | "masjid" | "mall" | "stadium" | "terminal" | "sawah" | "pond" | "field" | "plaza";

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
  if (FLAT_TYPES.includes(type)) return { w: 58, d: 52 };
  return { w: 48, d: 42 };
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
  return 0;
}

const ZONE_BASE: Record<ZoneKind, { type: BType; slot: number }[]> = {
  urban: [{ type: "tower", slot: 0 }, { type: "tower", slot: 4 }, { type: "shop", slot: 2 }, { type: "house", slot: 6 }],
  village: [{ type: "house", slot: 0 }, { type: "house", slot: 4 }, { type: "sawah", slot: 2 }, { type: "sawah", slot: 6 }, { type: "masjid", slot: 8 }],
  housing: [{ type: "house", slot: 0 }, { type: "house", slot: 2 }, { type: "house", slot: 4 }, { type: "house", slot: 6 }],
  commercial: [{ type: "shop", slot: 0 }, { type: "shop", slot: 4 }, { type: "tower", slot: 2 }, { type: "stall", slot: 6 }],
  education: [{ type: "school", slot: 4 }, { type: "house", slot: 0 }, { type: "field", slot: 2 }],
  industry: [{ type: "factory", slot: 0 }, { type: "factory", slot: 4 }, { type: "warehouse", slot: 2 }],
  river: [{ type: "pond", slot: 0 }, { type: "house", slot: 4 }, { type: "sawah", slot: 6 }],
  market: [{ type: "stall", slot: 0 }, { type: "stall", slot: 2 }, { type: "shop", slot: 4 }, { type: "stall", slot: 6 }],
  community: [{ type: "clinic", slot: 4 }, { type: "house", slot: 0 }, { type: "house", slot: 2 }, { type: "masjid", slot: 6 }],
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
};

type BSpec = { type: BType; slot: number; w: number; d: number; h: number; icon?: string; glow?: boolean; flag?: boolean };

function slotPos(slot: number) {
  return { x: 22 + (slot % 3) * 72, y: 22 + Math.floor(slot / 3) * 72 };
}

// Extra buildings used to pad zones out on high-density (high-voter)
// seats: rural seats show the base layout, metro seats fill spare slots.
const ZONE_FILLER: Record<ZoneKind, BType[]> = {
  urban: ["tower", "shop", "house"],
  village: ["house", "sawah"],
  housing: ["house", "house", "shop"],
  commercial: ["shop", "stall", "tower"],
  education: ["house", "field"],
  industry: ["warehouse", "factory"],
  river: ["house", "pond"],
  market: ["stall", "shop"],
  community: ["house", "clinic"],
};

function zoneBuildings(zone: Zone, density: number, traits: SeatTraits): BSpec[] {
  const base: BSpec[] = ZONE_BASE[zone.kind].map(({ type, slot }, index) => ({ type, slot, ...footprint(type), h: buildingHeight(type, zone), flag: zone.kind === "urban" && index === 0 }));
  const used = new Set(base.map((b) => b.slot));
  const free = [1, 3, 5, 7, 8, 6, 2, 0].filter((slot) => !used.has(slot));
  const fillers: BType[] = traits.paddy && (zone.kind === "village" || zone.kind === "river")
    ? ["sawah", "sawah", "house"]
    : ZONE_FILLER[zone.kind];
  const seed = seedFrom(zone.id);
  // Metro seats (high voter counts) grow true skyscrapers downtown
  const skyscraperCount = zone.kind === "urban"
    ? Math.max(0, Math.min(2, Math.round((density - 0.5) * 4)))
    : zone.kind === "commercial" && density >= 0.8 ? 1 : 0;
  const skyscrapers: BSpec[] = Array.from({ length: Math.min(skyscraperCount, free.length - 2) }, () => {
    const slot = free.pop() as number;
    return { type: "skyscraper" as BType, slot, ...footprint("skyscraper"), h: buildingHeight("skyscraper", zone) };
  });
  const extraBoost = (traits.industrial && zone.kind === "industry") || (traits.paddy && zone.kind === "village") ? 2 : 0;
  const extraCount = Math.min(Math.round(density * 3) + extraBoost, Math.max(0, free.length - 2));
  const extras: BSpec[] = Array.from({ length: extraCount }, (_, index) => {
    const type = fillers[(seed + index) % fillers.length];
    const slot = free.pop() as number;
    return { type, slot, ...footprint(type), h: buildingHeight(type, zone) };
  });
  const facilities: BSpec[] = zone.projects.map((projectId, index) => {
    const type = PROJECT_BUILDING[projectId] ?? "plaza";
    return {
      type,
      slot: free[index % free.length],
      ...footprint(type),
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

const FACE_TRANSITION = "height 0.7s, width 0.7s, transform 0.7s";

function Building3D({ spec }: { spec: BSpec }) {
  const { x, y } = slotPos(spec.slot);
  const palette = PALETTES[spec.type];
  const flat = FLAT_TYPES.includes(spec.type);
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
            {/* three-layer contact shadow: a near-black seam right at the
                footprint so the wall visibly presses into the ground, a
                tight dark core around that, and a wider soft falloff —
                stacked tightest-to-widest so the base reads as
                weighted/grounded instead of pasted on top of the tile */}
            <div className="absolute" style={{ left: -14, top: -9, width: spec.w + 32, height: spec.d + 22, background: "rgba(0,0,0,0.34)", filter: "blur(9px)", transform: "translateZ(0.2px)" }} />
            <div className="absolute" style={{ left: -5, top: -3, width: spec.w + 12, height: spec.d + 8, background: "rgba(0,0,0,0.55)", filter: "blur(3px)", transform: "translateZ(0.4px)" }} />
            <div className="absolute" style={{ left: 0, top: 0, width: spec.w, height: spec.d, background: "rgba(0,0,0,0.6)", filter: "blur(0.5px)", transform: "translateZ(0.55px)" }} />
            <div className="absolute" style={{ left: 0, top: spec.d, width: spec.w, height: spec.h, transformOrigin: "top", transform: "rotateX(90deg)", background: palette.wall, transition: FACE_TRANSITION }}>
              {palette.win && <div className="kw-win" />}
              {palette.win && <div className="kw-win-lit" style={{ animationDelay: `${spec.slot * -0.45}s` }} />}
            </div>
            <div className="absolute" style={{ left: spec.w, top: 0, width: spec.h, height: spec.d, transformOrigin: "left", transform: "rotateY(-90deg)", background: palette.side, transition: FACE_TRANSITION }}>
              {palette.win && <div className="kw-win" style={{ opacity: 0.55 }} />}
              {palette.win && <div className="kw-win-lit" style={{ animationDelay: `${spec.slot * -0.45 - 1.2}s` }} />}
            </div>
            <div
              className="absolute inset-0"
              style={{
                background: palette.top,
                border: spec.glow ? "2px solid rgba(0,255,136,0.7)" : "1px solid rgba(255,255,255,0.18)",
                boxShadow: spec.glow ? "0 0 20px rgba(0,255,136,0.35)" : undefined,
                transform: `translateZ(${spec.h}px)`,
                transition: FACE_TRANSITION,
              }}
            />
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
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="kw-bill" style={{ width: 30 * scale }}>
        <div className="kw-sway" style={{ animationDelay: `${((x + y) % 6) * -0.8}s` }}>
          <div className="mx-auto rounded-full" style={{ width: 26 * scale, height: 26 * scale, background: "radial-gradient(circle at 35% 28%, #86efac, #166534 60%, #052e16)" }} />
          <div className="mx-auto" style={{ width: 5 * scale, height: 11 * scale, background: "linear-gradient(180deg, #92400e, #451a03)" }} />
        </div>
      </div>
    </div>
  );
}

function Palm({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <div className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
      <div className="kw-bill" style={{ width: 34 * scale }}>
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
}

const BUNTING_COLORS = ["#dc2626", "#facc15", "#2563eb", "#f8fafc", "#16a34a"];

// Election bunting: string of triangle flags between two poles
function Bunting({ x, y, delay }: { x: number; y: number; delay: number }) {
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
}

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

function Car({ vertical, lane, dur, delay, rev, color }: { vertical?: boolean; lane: number; dur: number; delay: number; rev?: boolean; color: string }) {
  return (
    <div className="kw-3d absolute" style={{ ...(vertical ? { left: lane, top: 0 } : { top: lane, left: 0 }), transform: "translateZ(2px)", pointerEvents: "none" }}>
      <div
        className={`kw-car ${vertical ? "kw-car-v" : ""} ${rev ? "kw-car-rev" : ""}`}
        style={{ width: vertical ? 10 : 20, height: vertical ? 20 : 10, background: color, boxShadow: "0 0 6px rgba(0,0,0,0.5)", animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
      />
    </div>
  );
}

function ZonePlot({ zone, selected, onSelect, lang, col, row, density, traits, celebrating }: { zone: Zone; selected: boolean; onSelect: () => void; lang: ReturnType<typeof useLang>; col: number; row: number; density: number; traits: SeatTraits; celebrating: number }) {
  const buildings = useMemo(() => zoneBuildings(zone, density, traits), [zone, density, traits]);
  const [hovered, setHovered] = useState(false);
  const weakest = weakestStat(zone);
  // Label floats above the tallest roof in the zone, not at a fixed height,
  // so skyscraper zones don't bury their own label under their buildings.
  const labelZ = Math.max(30, ...buildings.map((spec) => spec.h)) + 30;
  // Twin skyscrapers side by side get a KLCC-style skybridge
  const skyscrapers = buildings.filter((spec) => spec.type === "skyscraper").sort((a, b) => a.slot - b.slot);
  const twin = skyscrapers.length >= 2 && skyscrapers[1].slot - skyscrapers[0].slot === 1 && Math.floor(skyscrapers[0].slot / 3) === Math.floor(skyscrapers[1].slot / 3) ? skyscrapers : null;
  return (
    <div className="kw-3d absolute" style={{ left: PLOT_XY[col], top: PLOT_XY[row], width: PLOT, height: PLOT }}>
      <button
        type="button"
        onClick={onSelect}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        aria-label={t(lang, zone.nameMS, zone.nameEN)}
        className={`kw-zone kw-grassy ${selected ? "kw-zone-sel" : ""} ${hovered ? "kw-zone-hov" : ""}`}
        style={{ background: zoneGround(zone.kind) }}
      >
        <span className="absolute left-0 right-0 block" style={{ top: PLOT / 2 - 6, height: 12, background: "rgba(148,163,184,0.15)" }} />
        <span className="absolute bottom-0 top-0 block" style={{ left: PLOT / 2 - 6, width: 12, background: "rgba(148,163,184,0.15)" }} />
        {zone.kind === "river" && <span className="kw-water absolute block" style={{ left: -1, right: -1, top: "40%", height: 34, opacity: 0.9 }} />}
      </button>
      {buildings.map((spec, index) => <Building3D key={`${zone.id}-${spec.slot}-${spec.type}-${index}`} spec={spec} />)}
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
      {selected && <SelectionBeacon />}
      {celebrating > 0 && <Fireworks key={celebrating} />}
      {/* leader line + label: anchored on the road below the plot, the pole rises in true 3D
          past the tallest roof in this zone so the billboard floats above the skyline instead
          of sitting at ground level, where rotation lets nearer buildings slide over it */}
      <div className="kw-3d absolute" style={{ left: PLOT / 2 - 1, top: PLOT + 16, width: 2, height: labelZ, transformOrigin: "top", transform: "rotateX(90deg)", background: `linear-gradient(180deg, transparent, ${selected ? "rgba(250,204,21,0.65)" : "rgba(125,211,252,0.5)"})`, transition: FACE_TRANSITION }} />
      <div className="kw-3d absolute" style={{ left: PLOT / 2 - 3, top: PLOT + 16 - 3, width: 6, height: 6, borderRadius: "50%", transform: "translateZ(2px)", background: selected ? "var(--gold)" : "#7dd3fc", boxShadow: `0 0 6px ${selected ? "rgba(250,204,21,0.8)" : "rgba(125,211,252,0.8)"}` }} />
      <div className="kw-3d absolute" style={{ left: PLOT / 2, top: PLOT + 16, width: 0, height: 0, transform: `translateZ(${labelZ}px)`, transition: FACE_TRANSITION }}>
        <div className="kw-bill">
          <div className="flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5" style={{ background: "rgba(3,8,15,0.9)", borderColor: selected ? "var(--gold)" : "rgba(56,189,248,0.3)" }}>
            <div>
              <div className="text-[9px] font-black tracking-[0.1em]" style={{ color: selected ? "var(--gold)" : "#7dd3fc" }}>{zoneIcon(zone.kind)} {t(lang, zone.nameMS, zone.nameEN)}</div>
              <div className="mt-0.5 text-[7px] font-bold tracking-wider" style={{ color: "rgba(148,163,184,0.85)" }}>INF {zone.infra} · RKT {zone.welfare} · EKO {zone.economy}</div>
            </div>
            <div className="text-base font-black leading-none" style={{ color: metricColor(zone.sentiment) }}>{zone.sentiment}</div>
            {zone.projects.length > 0 && <div className="rounded-full border px-1 py-0.5 text-[7px] font-black" style={{ borderColor: "rgba(0,255,136,0.5)", color: "#4ade80", background: "rgba(0,255,136,0.1)" }}>LV{zone.projects.length + 1}</div>}
          </div>
        </div>
      </div>
      {/* hover tooltip: anchored on the north edge so it never stacks on the
          persistent label, which hangs off the south edge of the same plot */}
      {hovered && (
        <div className="kw-3d absolute" style={{ left: PLOT / 2, top: -18, width: 0, height: 0, transform: `translateZ(${labelZ + 26}px)`, pointerEvents: "none" }}>
          <div className="kw-bill">
            {/* scene-palette colours, not theme vars: the 3D city keeps a fixed
                dark artwork palette in both light and dark app themes */}
            <div className="kw-tip rounded-sm border px-2 py-1" style={{ background: "rgba(3,8,15,0.94)", borderColor: "rgba(125,211,252,0.75)", boxShadow: "0 0 16px rgba(125,211,252,0.35)" }}>
              <div className="text-[9px] font-black tracking-[0.1em]" style={{ color: "#7dd3fc" }}>{zoneIcon(zone.kind)} {t(lang, zone.nameMS, zone.nameEN)}</div>
              <div className="mt-0.5 text-[8px] font-bold tracking-wider" style={{ color: "rgba(148,163,184,0.9)" }}>
                {t(lang, "SENTIMEN", "SENTIMENT")} <span style={{ color: metricColor(zone.sentiment) }}>{zone.sentiment}</span>
              </div>
              <div className="text-[8px] font-bold tracking-wider" style={{ color: "#fbbf24" }}>
                {t(lang, "PALING PERLU", "MOST NEEDED")}: {statLabel(lang, weakest)} {zone[weakest]}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TOD_SEQUENCE = ["dusk", "night", "day"] as const;
type Tod = (typeof TOD_SEQUENCE)[number];
const TOD_LABEL: Record<Tod, [string, string, string]> = { day: ["☀", "SIANG", "DAY"], dusk: ["🌆", "SENJA", "DUSK"], night: ["🌙", "MALAM", "NIGHT"] };

const CAM_DEFAULT = { rz: 45, rx: 57, zoom: 0.9 };

function City3DMap({ zones, selectedZoneId, setSelectedZoneId, lang, density, densityLabel, traits, celebration, overall }: { zones: Zone[]; selectedZoneId: string; setSelectedZoneId: (id: string) => void; lang: ReturnType<typeof useLang>; density: number; densityLabel: string; traits: SeatTraits; celebration: { zoneId: string; at: number } | null; overall: number }) {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const cam = useRef({ ...CAM_DEFAULT });
  const defaultZoom = useRef(CAM_DEFAULT.zoom);
  const drag = useRef<{ x: number; y: number; rz: number; rx: number } | null>(null);
  const movedRef = useRef(false);
  const [tod, setTod] = useState<Tod>("dusk");
  const [weather, setWeather] = useState<"clear" | "rain">("clear");

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

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    // Fit the city to the panel: narrower scenes start zoomed out so the
    // whole grid (and its labels) stays inside the frame.
    const width = el.clientWidth;
    defaultZoom.current = width < 700 ? 0.55 : width < 900 ? 0.66 : width < 1150 ? 0.76 : CAM_DEFAULT.zoom;
    cam.current.zoom = defaultZoom.current;
    applyCam();
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cam.current.zoom *= event.deltaY > 0 ? 0.92 : 1.08;
      applyCam();
    };
    const onMove = (event: PointerEvent) => {
      if (!drag.current) return;
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true;
      cam.current.rz = drag.current.rz - dx * 0.25;
      cam.current.rx = drag.current.rx + dy * 0.18;
      applyCam();
    };
    const onUp = () => {
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
    };
  }, [applyCam]);

  const controlButton = "pointer-events-auto flex h-9 w-9 items-center justify-center border text-[13px] font-black";
  const controlStyle = { borderColor: "rgba(125,211,252,0.4)", background: "rgba(3,8,15,0.8)", color: "#7dd3fc" } as const;

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
        drag.current = { x: event.clientX, y: event.clientY, rz: cam.current.rz, rx: cam.current.rx };
        movedRef.current = false;
        sceneRef.current?.classList.add("kw-dragging");
      }}
    >
      {/* sky dressing (screen space) */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: "var(--kw-stars)", transition: "opacity 0.6s", backgroundImage: "radial-gradient(1.4px 1.4px at 20px 30px, #fff, transparent), radial-gradient(1px 1px at 96px 84px, #cbd5e1, transparent), radial-gradient(1.2px 1.2px at 168px 42px, #fff, transparent), radial-gradient(1px 1px at 58px 120px, #e2e8f0, transparent), radial-gradient(1.3px 1.3px at 204px 96px, #fff, transparent), radial-gradient(0.9px 0.9px at 140px 138px, #cbd5e1, transparent)", backgroundSize: "220px 160px, 220px 160px, 220px 160px, 300px 210px, 300px 210px, 300px 210px" }} />
      <div className="kw-orb pointer-events-none absolute rounded-full" style={{ right: "11%", top: 26, width: 62, height: 62 }} />
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
      <div className="kw-world" style={{ width: WORLD, height: WORLD }}>
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
        <div className="kw-3d absolute kw-slab-wall" style={{ left: -70, top: 950, width: 1020, height: 78, transformOrigin: "top", transform: "rotateX(74deg)" }} />
        <div className="kw-3d absolute kw-slab-wall kw-slab-wall-side" style={{ left: 950, top: -70, width: 78, height: 1020, transformOrigin: "left", transform: "rotateY(-74deg)" }} />
        {ROADS_H.map((y) => (
          <div key={`rh-${y}`} className="kw-road-x absolute" style={{ left: 0, top: y, width: RIVER_X, height: 40 }}>
            <div className="kw-lane-x absolute left-0 right-0" style={{ top: 19 }} />
          </div>
        ))}
        {ROADS_V.map((x) => (
          <div key={`rv-${x}`} className="kw-road-y absolute" style={{ left: x, top: 0, width: 40, height: WORLD }}>
            <div className="kw-lane-y absolute bottom-0 top-0" style={{ left: 19 }} />
          </div>
        ))}
        {/* coastal seats face open sea with a beach + jetty; inland seats get the river and bridges */}
        {traits.coastal && <div className="absolute" style={{ left: RIVER_X - 14, top: -70, width: 14, height: WORLD + 140, background: "repeating-linear-gradient(0deg, #fde68a 0 12px, #fcd34d 12px 24px)", opacity: 0.85 }} />}
        <div className="kw-water absolute" style={{ left: RIVER_X, top: -70, width: traits.coastal ? 110 : 40, height: WORLD + 140 }} />
        {!traits.coastal && ROADS_H.map((y) => (
          <div key={`bridge-${y}`} className="absolute" style={{ left: RIVER_X - 4, top: y - 2, width: 48, height: 44, background: "linear-gradient(180deg, #3b4a63, #232f45)", border: "2px solid rgba(148,163,184,0.35)", transform: "translateZ(1px)" }} />
        ))}
        {traits.coastal && (
          <>
            {/* Jetty: was hardcoded at top:420, a value with no relation to
                ROADS_H — it read as a disconnected, off-grid ramp. Snapped
                onto ROADS_H[2] so it's the literal continuation of that
                street across the coastline, and its width is clamped so it
                ends exactly at WORLD's edge instead of overshooting into
                the margin unclamped. */}
            <div className="absolute" style={{ left: RIVER_X - 6, top: ROADS_H[2] + 14, width: WORLD - (RIVER_X - 6), height: 12, transform: "translateZ(3px)", background: "repeating-linear-gradient(90deg, #92400e 0 6px, #78350f 6px 8px)", border: "1px solid rgba(69,26,3,0.9)" }} />
            <div className="kw-3d absolute" style={{ left: RIVER_X + 62, top: 0, transform: "translateZ(3px)", pointerEvents: "none" }}>
              <div className="kw-boat" style={{ width: 11, height: 24, background: "linear-gradient(180deg, #0ea5e9, #075985)", animationDuration: "52s", animationDelay: "-31s" }} />
            </div>
          </>
        )}
        {/* highland seats: hill backdrop along the north edge */}
        {traits.hilly && [[140, -46, 1], [450, -58, 1.5], [740, -42, 1.15]].map(([x, y, s], index) => (
          <div key={`hill-${index}`} className="kw-3d absolute" style={{ left: x, top: y, width: 0, height: 0 }}>
            <div className="kw-bill" style={{ width: 190 * s }}>
              <div style={{ width: 190 * s, height: 74 * s, borderRadius: "50% 50% 0 0", background: "linear-gradient(180deg, #14532d, #052e16)", opacity: 0.92 }} />
            </div>
          </div>
        ))}
        {/* rice-bowl seats: paddy plots in the world margins */}
        {traits.paddy && [[-64, 180], [-60, 470], [-66, 720], [180, 898], [520, 902]].map(([x, y], index) => (
          <div key={`padi-${index}`} className="absolute" style={{ left: x, top: y, width: 48, height: 42, transform: "translateZ(1px)", background: flatTile("sawah"), border: "1px solid rgba(163,230,53,0.25)", borderRadius: 3 }} />
        ))}
        {[280, 560].flatMap((x) => [280, 560].map((y) => <div key={`lamp-${x}-${y}`} className="kw-lamp" style={{ left: x + 20 - 36, top: y + 20 - 36 }} />))}
        <div className="kw-3d absolute" style={{ left: RIVER_X + 6, top: 0, transform: "translateZ(3px)", pointerEvents: "none" }}>
          <div className="kw-boat" style={{ width: 12, height: 26, background: "linear-gradient(180deg, #d97706, #7c2d12)", animationDuration: "38s", animationDelay: "-9s" }} />
        </div>
        <div className="kw-3d absolute" style={{ left: RIVER_X + 23, top: 0, transform: "translateZ(3px)", pointerEvents: "none" }}>
          <div className="kw-boat kw-rev" style={{ width: 10, height: 22, background: "linear-gradient(180deg, #e2e8f0, #64748b)", animationDuration: "47s", animationDelay: "-22s" }} />
        </div>
        <Car lane={288} dur={13} delay={-3} color="#f87171" />
        <Car lane={302} dur={17} delay={-9} rev color="#fbbf24" />
        <Car lane={568} dur={15} delay={-6} color="#7dd3fc" />
        <Car lane={582} dur={11} delay={-2} rev color="#f8fafc" />
        <Car vertical lane={288} dur={16} delay={-5} color="#4ade80" />
        <Car vertical lane={302} dur={12} delay={-8} rev color="#f97316" />
        <Car vertical lane={568} dur={14} delay={-1} color="#c084fc" />
        {[280, 560].flatMap((x) => [280, 560].map((y) => (
          <div key={`tl-${x}-${y}`} className="kw-3d absolute" style={{ left: x - 7, top: y - 7, width: 0, height: 0 }}>
            <div className="kw-bill">
              <div className="mx-auto flex h-[11px] w-[9px] items-center justify-center rounded-sm" style={{ background: "#1e293b", border: "1px solid rgba(148,163,184,0.5)" }}>
                <span className="kw-tlight" style={{ animationDelay: `${((x === 280 ? 0 : 1) * 2 + (y === 280 ? 0 : 1)) * -2.2}s` }} />
              </div>
              <div className="mx-auto" style={{ width: 2, height: 14, background: "#475569" }} />
            </div>
          </div>
        )))}
        {zones.map((zone, index) => (
          <ZonePlot
            key={zone.id}
            zone={zone}
            selected={zone.id === selectedZoneId}
            onSelect={() => { if (!movedRef.current) setSelectedZoneId(zone.id); }}
            lang={lang}
            col={index % 3}
            row={Math.floor(index / 3)}
            density={density}
            traits={traits}
            celebrating={celebration?.zoneId === zone.id ? celebration.at : 0}
          />
        ))}
        {/* helicopter patrol: anchor orbits the world centre, counter-spin keeps the billboard steady */}
        <div className="kw-3d kw-heli-orbit absolute" style={{ left: WORLD / 2, top: WORLD / 2, width: 0, height: 0 }}>
          <div className="kw-3d absolute" style={{ left: 396, top: 0, width: 0, height: 0, transform: "translateZ(195px)" }}>
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
        {[[-32, 130], [-40, 410], [-30, 690], [905, 190], [912, 480], [120, -34], [430, -40], [700, -32], [-30, 905], [340, 905], [640, 908]].map(([x, y], index) => (
          index % 2 === 0
            ? <Palm key={`tree-${index}`} x={x} y={y} scale={0.8 + (index % 3) * 0.18} />
            : <Tree key={`tree-${index}`} x={x} y={y} scale={0.8 + (index % 3) * 0.18} />
        ))}
        {traits.coastal && [[818, 120], [816, 360], [820, 640]].map(([x, y], index) => (
          <Palm key={`beach-palm-${index}`} x={x} y={y} scale={0.9 + (index % 2) * 0.25} />
        ))}
        {[[300, 150], [580, 430], [300, 700], [580, 130]].map(([x, y], index) => (
          <Bunting key={`bunting-${index}`} x={x} y={y} delay={index * -1.3} />
        ))}
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
      {/* night dimmer + vignette over the world, under the HUD */}
      <div className="kw-tintlayer pointer-events-none absolute inset-0" />
      <div className="kw-rain" />
      <div className="kw-lightning" />

      {/* HUD (screen space) */}
      <div className="pointer-events-none absolute left-4 top-4 max-w-[64%] truncate border px-3 py-2 text-[10px] font-black tracking-[0.22em]" style={{ color: "#7dd3fc", borderColor: "rgba(125,211,252,0.35)", background: "rgba(3,8,15,0.72)" }}>
        {t(lang, "BANDAR 3D INTERAKTIF", "INTERACTIVE 3D CITY")} · {densityLabel}
      </div>
      <div className="pointer-events-none absolute left-4 top-[58px] flex flex-col gap-1 border px-2.5 py-1.5 text-[8px] font-bold tracking-[0.14em]" style={{ borderColor: "rgba(125,211,252,0.22)", background: "rgba(3,8,15,0.68)", color: "rgba(148,163,184,0.95)" }}>
        <div className="tracking-[0.2em]" style={{ color: "#7dd3fc" }}>{t(lang, "SKOR ZON", "ZONE SCORE")}</div>
        {SCORE_LEGEND.map((band) => (
          <div key={band.en} className="flex items-center gap-1.5">
            <span className="block h-1.5 w-3.5" style={{ background: band.color }} />
            <span>{t(lang, band.ms, band.en)}</span>
          </div>
        ))}
      </div>
      <div className="absolute right-4 top-4 flex flex-col gap-2" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Zoom in" className={controlButton} style={controlStyle} onClick={() => { cam.current.zoom *= 1.15; applyCam(); }}>+</button>
        <button type="button" aria-label="Zoom out" className={controlButton} style={controlStyle} onClick={() => { cam.current.zoom *= 0.87; applyCam(); }}>-</button>
        <button type="button" aria-label="Reset camera" className={controlButton} style={controlStyle} onClick={() => { cam.current = { ...CAM_DEFAULT, zoom: defaultZoom.current }; applyCam(); }}>R</button>
        <button
          type="button"
          className="pointer-events-auto border px-2 py-2 text-[9px] font-black tracking-widest"
          style={controlStyle}
          onClick={() => setTod((current) => TOD_SEQUENCE[(TOD_SEQUENCE.indexOf(current) + 1) % TOD_SEQUENCE.length])}
        >
          {TOD_LABEL[tod][0]} {t(lang, TOD_LABEL[tod][1], TOD_LABEL[tod][2])}
        </button>
        <button
          type="button"
          className="pointer-events-auto border px-2 py-2 text-[9px] font-black tracking-widest"
          style={controlStyle}
          onClick={() => setWeather((current) => (current === "rain" ? "clear" : "rain"))}
        >
          {weather === "rain" ? `🌧 ${t(lang, "HUJAN", "RAIN")}` : `☀ ${t(lang, "CERAH", "CLEAR")}`}
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[9px] font-bold tracking-[0.18em]" style={{ color: "rgba(148,163,184,0.95)" }}>
        <span>{t(lang, "SERET · PUTAR PETA", "DRAG · ROTATE MAP")} / {t(lang, "SKROL · ZUM", "SCROLL · ZOOM")}</span>
        <span>{t(lang, "KLIK ZON UNTUK PILIH PROJEK", "CLICK A ZONE TO PICK A PROJECT")}</span>
      </div>
    </div>
  );
}
export default function KawasanDevelopmentPage() {
  const router = useRouter();
  const lang = useLang();
  const { states, leader, resources, settings } = useGameStore();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("zone-0");
  const [notice, setNotice] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ zoneId: string; at: number } | null>(null);

  const homeState = states.find((state) => state.id === (settings.electionScope === "prn" ? settings.prnStateId : leader.homeState)) ?? states.find((state) => state.id === leader.homeState) ?? states[0];
  const seatMode = settings.electionScope === "prn" ? "dun" : "parliament";
  const constituencies = useMemo(() => homeState ? generateConstituencies(homeState, seatMode) : [], [homeState, seatMode]);
  const ownSeat = constituencies.find((seat) => seat.id === leader.homeConstituencyId) ?? constituencies[0];
  const seatKindMS = settings.electionScope === "prn" ? "DUN" : "PARLIMEN";
  const officeMS = settings.electionScope === "prn" ? "ADUN" : "AHLI PARLIMEN";
  const storageKey = `${STORAGE_PREFIX}:${ownSeat?.id ?? "unknown"}`;

  // City density scales with the seat's electorate: ~30k voters reads
  // rural, ~120k+ reads metro (more filler buildings + skyscrapers).
  const density = ownSeat ? Math.max(0, Math.min(1, (ownSeat.voters - 30000) / 90000)) : 0.5;
  const densityLabel = density >= 0.62
    ? t(lang, "BANDAR RAYA", "METRO")
    : density >= 0.3
    ? t(lang, "SEPARA BANDAR", "SEMI-URBAN")
    : t(lang, "LUAR BANDAR", "RURAL");

  const traits = useMemo(() => deriveSeatTraits(ownSeat?.name ?? "", homeState?.id ?? ""), [ownSeat?.name, homeState?.id]);
  const traitLabels = [
    traits.coastal ? t(lang, "PESISIR", "COASTAL") : null,
    traits.paddy ? t(lang, "JELAPANG PADI", "RICE BOWL") : null,
    traits.hilly ? t(lang, "TANAH TINGGI", "HIGHLANDS") : null,
    traits.industrial ? t(lang, "PERINDUSTRIAN", "INDUSTRIAL") : null,
  ].filter(Boolean).join(" · ");
  const sceneLabel = traitLabels ? `${densityLabel} · ${traitLabels}` : densityLabel;

  useEffect(() => {
    if (!ownSeat) return;
    try {
      const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(`mymandat-kawasan-development-v1:${ownSeat.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Zone[];
        if (Array.isArray(parsed) && parsed.length) {
          // Merge saved progress but let the generator's names/types win,
          // so trait-based zone identities (fishing village, paddy village)
          // apply to saves made before traits existed.
          const upgraded = makeZones(ownSeat.id, traits).map((fallback, index) => ({ ...fallback, ...(parsed[index] ?? {}), kind: fallback.kind, nameMS: fallback.nameMS, nameEN: fallback.nameEN, typeMS: fallback.typeMS, typeEN: fallback.typeEN }));
          setZones(upgraded);
          return;
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    setZones(makeZones(ownSeat.id, traits));
  }, [ownSeat, storageKey, traits]);

  useEffect(() => {
    if (!zones.length) return;
    localStorage.setItem(storageKey, JSON.stringify(zones));
  }, [zones, storageKey]);

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
  const overall = zones.length ? Math.round(zones.reduce((sum, zone) => sum + zone.sentiment, 0) / zones.length) : 0;
  const spent = zones.reduce((sum, zone) => sum + zone.projects.reduce((projectSum, projectId) => projectSum + (PROJECTS.find((project) => project.id === projectId)?.cost ?? 0), 0), 0);
  const totalProjects = zones.reduce((sum, zone) => sum + zone.projects.length, 0);
  const priorityZone = zones.length ? [...zones].sort((a, b) => a.sentiment - b.sentiment)[0] : null;

  function runProject(project: Project) {
    if (!selectedZone) return;
    if (selectedZone.projects.includes(project.id)) {
      setNotice(t(lang, "PROJEK SUDAH DILULUSKAN UNTUK ZON INI", "PROJECT ALREADY APPROVED FOR THIS ZONE"));
      return;
    }
    const locked = lockReason(project, selectedZone, lang);
    if (locked) {
      setNotice(t(lang, "PROJEK MASIH TERKUNCI", "PROJECT STILL LOCKED"));
      return;
    }
    if (resources.funds < project.cost) {
      setNotice(t(lang, "BAJET TIDAK MENCUKUPI", "INSUFFICIENT BUDGET"));
      return;
    }

    useGameStore.setState((state) => ({
      resources: { ...state.resources, funds: Math.max(0, state.resources.funds - project.cost) },
      alerts: [{
        id: `dev-${Date.now()}`,
        time: new Date().toTimeString().slice(0, 5),
        message: `${project.titleMS} approved in ${selectedZone.nameMS}, ${ownSeat?.name ?? "kawasan"}.`,
        type: "positive",
      }, ...state.alerts].slice(0, 12),
    }));

    setZones((current) => current.map((zone) => {
      if (zone.id !== selectedZone.id) return zone;
      const next = {
        ...zone,
        [project.target]: clamp(zone[project.target] + project.boost),
        projects: [...zone.projects, project.id],
      };
      return { ...next, sentiment: clamp(Math.round((next.infra + next.welfare + next.economy) / 3)) };
    }));
    setCelebration({ zoneId: selectedZone.id, at: Date.now() });
    setNotice(t(lang, "PROJEK DILULUSKAN · GRAFIK KAWASAN DIKEMAS KINI", "PROJECT APPROVED · LOCAL GRID UPDATED"));
  }

  function quickDevelopPriority() {
    if (!priorityZone) return;
    setSelectedZoneId(priorityZone.id);
    const open = PROJECTS.filter((project) => !priorityZone.projects.includes(project.id) && !lockReason(project, priorityZone, lang));
    const best = open.find((project) => project.target === weakestStat(priorityZone)) ?? open[0];
    if (best) setTimeout(() => runProject(best), 0);
  }

  if (!ownSeat) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Header />
        <main className="pt-[80px] px-8">
          <TacticalPanel title={t(lang, "TIADA KAWASAN", "NO CONSTITUENCY")}>
            <div className="text-text-muted">{t(lang, "Pilih/menang kerusi dahulu sebelum membuat pembangunan.", "Select/win a seat before managing development.")}</div>
          </TacticalPanel>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(circle at 20% 0%, rgb(var(--cyan-rgb)/0.12), transparent 30%), radial-gradient(circle at 85% 8%, rgb(var(--gold-rgb)/0.10), transparent 24%), var(--bg)" }}>
      <Header />
      {notice && (
        <div role="status" className="fixed right-6 top-[58px] z-[80] border px-5 py-3 text-[11px] font-black tracking-[0.2em] uppercase" style={{ borderColor: "rgb(var(--gold-rgb)/0.58)", background: "linear-gradient(135deg, rgb(var(--gold-rgb)/0.16), rgba(3,8,15,0.96))", color: "var(--gold)", fontFamily: "Space Mono, monospace" }}>
          {notice}
        </div>
      )}

      <main className="pt-[56px] pb-[58px] px-6 w-full">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-text-muted tracking-widest mb-1">◇ {seatKindMS} · {officeMS} · {t(lang, "SIMULATOR PEMBANGUNAN KAWASAN", "CONSTITUENCY BUILDER SIM")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>{ownSeat.name}</h1>
            <div className="mt-1 text-[12px] tracking-wider" style={{ color: "var(--gold)" }}>{ownSeat.code} · {homeState.name} · {leader.partyAbbr || leader.party} · {formatNumber(ownSeat.voters)} {t(lang, "PENGUNDI", "VOTERS")} · {densityLabel}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={quickDevelopPriority} className="px-4 py-2 text-[11px] font-black tracking-widest" style={{ border: "1px solid rgb(0 255 136 / 0.38)", color: "var(--neon-green)", background: "rgba(0,255,136,0.07)" }}>+ {t(lang, "BANGUNKAN ZON KRITIKAL", "DEVELOP PRIORITY ZONE")}</button>
            <button onClick={() => router.push("/government")} className="px-4 py-2 text-[11px] font-bold tracking-widest" style={{ border: "1px solid rgb(var(--gold-rgb)/0.42)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}>{t(lang, "KERAJAAN", "GOVERNMENT")}</button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="border p-3" style={{ borderColor: "rgb(var(--gold-rgb)/0.24)", background: "rgba(3,8,15,0.64)" }}><div className="text-[9px] text-text-muted tracking-widest">{t(lang, "BAKI DANA", "FUNDS")}</div><div className="text-2xl font-black" style={{ color: "var(--gold)" }}>RM {formatNumber(resources.funds)}</div></div>
          <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.24)", background: "rgba(3,8,15,0.64)" }}><div className="text-[9px] text-text-muted tracking-widest">{t(lang, "SENTIMEN", "SENTIMENT")}</div><div className="text-2xl font-black" style={{ color: metricColor(overall) }}>{overall}%</div></div>
          <div className="border p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.24)", background: "rgba(3,8,15,0.64)" }}><div className="text-[9px] text-text-muted tracking-widest">{t(lang, "PROJEK SIAP", "PROJECTS")}</div><div className="text-2xl font-black text-white">{totalProjects}</div></div>
          <div className="border p-3" style={{ borderColor: "rgb(255 68 68 / 0.22)", background: "rgba(3,8,15,0.64)" }}><div className="text-[9px] text-text-muted tracking-widest">{t(lang, "ZON PRIORITI", "PRIORITY ZONE")}</div><div className="truncate text-lg font-black" style={{ color: "var(--warn-orange)" }}>{priorityZone ? t(lang, priorityZone.nameMS, priorityZone.nameEN) : "—"}</div></div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <TacticalPanel title={t(lang, "PETA BANDAR 3D · KAWASAN ANDA", "3D CITY MAP · YOUR CONSTITUENCY")} noPadding>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] leading-relaxed text-text-muted">{t(lang, "Seret untuk pusing bandar, skrol untuk zum, klik zon untuk bina. Bangunan tumbuh apabila projek diluluskan — tukar waktu siang/malam di penjuru kanan.", "Drag to rotate the city, scroll to zoom, click a zone to build. Buildings grow as projects are approved — switch day/night in the corner.")}</div>
                <div className="shrink-0 whitespace-nowrap text-[10px] font-black tracking-widest" style={{ color: "var(--cyan)" }}>RM {formatNumber(spent)} {t(lang, "DIBELANJA", "SPENT")}</div>
              </div>
              <City3DMap zones={zones} selectedZoneId={selectedZone?.id ?? selectedZoneId} setSelectedZoneId={setSelectedZoneId} lang={lang} density={density} densityLabel={sceneLabel} traits={traits} celebration={celebration} overall={overall} />
            </div>
          </TacticalPanel>

          <div className="space-y-4">
            <TacticalPanel title={selectedZone ? t(lang, `BANGUNKAN · ${selectedZone.nameMS.toUpperCase()}`, `DEVELOP · ${selectedZone.nameEN.toUpperCase()}`) : t(lang, "BANGUNKAN KAWASAN", "DEVELOP AREA")} noPadding>
              {selectedZone && (
                <div className="border-b p-4" style={{ borderColor: "rgb(var(--cyan-rgb)/0.14)", background: "linear-gradient(135deg, rgb(var(--cyan-rgb)/0.07), rgba(3,8,15,0.72))" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{zoneIcon(selectedZone.kind)} {t(lang, selectedZone.nameMS, selectedZone.nameEN)}</div>
                      <div className="text-[10px] font-bold tracking-widest" style={{ color: "var(--cyan)" }}>{t(lang, selectedZone.typeMS, selectedZone.typeEN)} · {selectedZone.projects.length} {t(lang, "projek", "projects")}</div>
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
              <div className="max-h-[calc(100vh-360px)] min-h-[420px] overflow-y-auto p-4 space-y-3">
                {PROJECTS.map((project) => {
                  const done = selectedZone?.projects.includes(project.id) ?? false;
                  const locked = done ? null : lockReason(project, selectedZone, lang);
                  const affordable = resources.funds >= project.cost;
                  const accent = done ? "var(--neon-green)" : locked ? "rgba(148,163,184,0.85)" : affordable ? "var(--gold)" : "var(--neon-red)";
                  return (
                    <button key={project.id} onClick={() => runProject(project)} disabled={done || !!locked || !affordable} className="w-full border p-3 text-left transition enabled:hover:scale-[1.01] disabled:cursor-not-allowed" style={{ opacity: locked ? 0.45 : done || !affordable ? 0.55 : 1, borderColor: done ? "rgb(0 255 136 / 0.35)" : locked ? "rgba(148,163,184,0.28)" : affordable ? "rgb(var(--cyan-rgb)/0.22)" : "rgb(255 68 68 / 0.25)", background: done ? "rgb(0 255 136 / 0.06)" : locked ? "rgba(10,14,22,0.72)" : "rgba(3,8,15,0.72)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] font-black tracking-wider" style={{ color: locked ? "rgba(203,213,225,0.75)" : "#fff" }}>{locked ? "🔒" : project.icon} {t(lang, project.titleMS, project.titleEN)}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-text-muted">{t(lang, project.detailMS, project.detailEN)}</div>
                        </div>
                        <div className="shrink-0 text-right text-[10px] font-black tracking-widest" style={{ color: accent }}>
                          {done ? t(lang, "SIAP", "DONE") : locked ? t(lang, "TERKUNCI", "LOCKED") : `RM ${formatNumber(project.cost)}`}
                        </div>
                      </div>
                      <div className="mt-2 flex items-start justify-between gap-3 text-[9px] font-bold tracking-wider">
                        <span className="shrink-0" style={{ color: "var(--cyan)" }}>+{project.boost} {project.target === "welfare" ? "RAKYAT" : project.target.toUpperCase()}</span>
                        <span className="text-right" style={{ color: locked ? "var(--warn-orange)" : affordable || done ? "var(--text-muted)" : "var(--neon-red)" }}>
                          {done ? t(lang, "grafik dinaik taraf", "visual upgraded") : locked ?? t(lang, "klik untuk bina", "click to build")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>

      <StatusBar leftText={`${seatKindMS} ${ownSeat.code} · ${ownSeat.name} · ${t(lang, "CITY BUILDER KAWASAN", "LOCAL CITY BUILDER")}`} rightText={`RM ${formatNumber(resources.funds)} · SENTIMEN ${overall}% · PROJEK ${totalProjects}`} />
    </div>
  );
}
