import type { PartyMember } from "./members";

export type Specialty = PartyMember["specialty"];

export interface CabinetPost {
  id: string;
  titleMS: string;
  titleEN: string;
  level: "pm" | "dpm" | "minister" | "deputy";
  requiredSpecialty: Specialty;
  ministryId?: string;
  importance: number; // 1-10
  sector: "pm" | "security" | "economy" | "social" | "infrastructure";
}

export const PM_POST: CabinetPost = {
  id: "pm",
  titleMS: "PERDANA MENTERI",
  titleEN: "PRIME MINISTER",
  level: "pm",
  requiredSpecialty: "urban",
  importance: 10,
  sector: "pm",
};

export const DPM_POSTS: CabinetPost[] = [
  { id: "dpm1", titleMS: "TIMBALAN PM I",  titleEN: "DEPUTY PM I",  level: "dpm", requiredSpecialty: "grassroots", importance: 9, sector: "pm" },
  { id: "dpm2", titleMS: "TIMBALAN PM II", titleEN: "DEPUTY PM II", level: "dpm", requiredSpecialty: "urban",      importance: 9, sector: "pm" },
];

export const MINISTER_POSTS: CabinetPost[] = [
  { id: "min-fin",    titleMS: "KEWANGAN",               titleEN: "FINANCE",              level: "minister", requiredSpecialty: "economic",   importance: 10, sector: "economy" },
  { id: "min-home",   titleMS: "DALAM NEGERI",            titleEN: "HOME AFFAIRS",         level: "minister", requiredSpecialty: "grassroots", importance: 9,  sector: "security" },
  { id: "min-fa",     titleMS: "LUAR NEGERI",             titleEN: "FOREIGN AFFAIRS",      level: "minister", requiredSpecialty: "urban",      importance: 8,  sector: "security" },
  { id: "min-def",    titleMS: "PERTAHANAN",              titleEN: "DEFENCE",              level: "minister", requiredSpecialty: "grassroots", importance: 8,  sector: "security" },
  { id: "min-edu",    titleMS: "PENDIDIKAN",              titleEN: "EDUCATION",            level: "minister", requiredSpecialty: "youth",      importance: 9,  sector: "social" },
  { id: "min-health", titleMS: "KESIHATAN",               titleEN: "HEALTH",               level: "minister", requiredSpecialty: "economic",   importance: 9,  sector: "social" },
  { id: "min-trade",  titleMS: "PERDAGANGAN & PERINDUSTRIAN", titleEN: "TRADE & INDUSTRY", level: "minister", requiredSpecialty: "economic",   importance: 8,  sector: "economy" },
  { id: "min-comm",   titleMS: "KOMUNIKASI",              titleEN: "COMMUNICATIONS",       level: "minister", requiredSpecialty: "media",      importance: 7,  sector: "social" },
  { id: "min-youth",  titleMS: "BELIA & SUKAN",           titleEN: "YOUTH & SPORTS",       level: "minister", requiredSpecialty: "youth",      importance: 6,  sector: "social" },
  { id: "min-women",  titleMS: "WANITA & KELUARGA",       titleEN: "WOMEN & FAMILY",       level: "minister", requiredSpecialty: "grassroots", importance: 7,  sector: "social" },
  { id: "min-trans",  titleMS: "PENGANGKUTAN",            titleEN: "TRANSPORT",            level: "minister", requiredSpecialty: "urban",      importance: 7,  sector: "infrastructure" },
  { id: "min-rural",  titleMS: "PEMBANGUNAN LUAR BANDAR", titleEN: "RURAL DEVELOPMENT",    level: "minister", requiredSpecialty: "rural",      importance: 7,  sector: "infrastructure" },
];

export const DEPUTY_POSTS: CabinetPost[] = MINISTER_POSTS.map((m) => ({
  id: `dep-${m.id.replace("min-", "")}`,
  titleMS: `TIMBALAN MENTERI ${m.titleMS}`,
  titleEN: `DEPUTY MINISTER ${m.titleEN}`,
  level: "deputy" as const,
  requiredSpecialty: m.requiredSpecialty,
  ministryId: m.id,
  importance: Math.max(1, m.importance - 3),
  sector: m.sector,
}));

export const SECTOR_COLORS: Record<CabinetPost["sector"], string> = {
  pm:             "var(--gold)",
  security:       "var(--neon-red)",
  economy:        "var(--neon-green)",
  social:         "var(--cyan)",
  infrastructure: "var(--warn-orange)",
};

export const SECTOR_LABEL: Record<CabinetPost["sector"], [string, string]> = {
  pm:             ["EKSEKUTIF",     "EXECUTIVE"],
  security:       ["KESELAMATAN",  "SECURITY"],
  economy:        ["EKONOMI",      "ECONOMY"],
  social:         ["SOSIAL",       "SOCIAL"],
  infrastructure: ["INFRASTRUKTUR","INFRASTRUCTURE"],
};

export const SPECIALTY_LABEL: Record<Specialty, [string, string]> = {
  urban:      ["BANDAR",    "URBAN"],
  rural:      ["LUAR BANDAR", "RURAL"],
  youth:      ["BELIA",    "YOUTH"],
  economic:   ["EKONOMI",  "ECONOMIC"],
  media:      ["MEDIA",    "MEDIA"],
  grassroots: ["AKAR UMBI","GRASSROOTS"],
};

export function scoreAssignment(member: PartyMember, post: CabinetPost): number {
  const specialtyMatch  = member.specialty === post.requiredSpecialty ? 30 : 0;
  const expScore        = member.experience === "veteran" ? 25 : member.experience === "rising" ? 15 : 5;
  const influenceScore  = (member.influence   / 100) * 20;
  const credScore       = (member.credibility / 100) * 15;
  const charismaScore   = (member.charisma    / 100) * 10;
  return Math.round(specialtyMatch + expScore + influenceScore + credScore + charismaScore);
}

export function getGrade(score: number): { grade: string; color: string; labelMS: string; labelEN: string } {
  if (score >= 90) return { grade: "A+", color: "var(--neon-green)", labelMS: "KABINET GEMILANG",   labelEN: "STELLAR CABINET" };
  if (score >= 80) return { grade: "A",  color: "var(--cyan)",       labelMS: "KABINET KUKUH",      labelEN: "STRONG CABINET" };
  if (score >= 70) return { grade: "B",  color: "var(--gold)",       labelMS: "KABINET MEMUASKAN",  labelEN: "SATISFACTORY CABINET" };
  if (score >= 60) return { grade: "C",  color: "var(--warn-orange)",labelMS: "KABINET SEDERHANA",  labelEN: "MODERATE CABINET" };
  if (score >= 50) return { grade: "D",  color: "var(--neon-red)",   labelMS: "KABINET LEMAH",      labelEN: "WEAK CABINET" };
  return               { grade: "F",  color: "#ff2222",          labelMS: "KABINET GAGAL",      labelEN: "FAILED CABINET" };
}

export const FEMALE_MEMBER_IDS = new Set([
  "pm-002", "pm-004", "pm-007", "pm-009", "pm-012",
  "pm-014", "pm-016", "pm-019", "pm-023", "pm-025",
]);
