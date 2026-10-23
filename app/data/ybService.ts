// A YB's working life between elections: the agenda activities a sitting
// representative can spend their week on, the constituent complaints that
// surface in the kawasan, and the calendar both run on. Pure data — the
// rules that apply them live in store/termClock.ts. All figures simulated.

type Bilingual = { ms: string; en: string };
export type ZoneStatKey = "infra" | "welfare" | "economy";
export const ZONE_STAT_LABEL: Record<ZoneStatKey, Bilingual> = {
  infra: { ms: "infra", en: "infra" },
  welfare: { ms: "rakyat", en: "welfare" },
  economy: { ms: "ekonomi", en: "economy" },
};

/** One term is 20 quarters of 91 days (~5 years). */
export const QUARTER_DAYS = 91;
export const TERM_QUARTERS = 20;
export const TERM_DAYS = QUARTER_DAYS * TERM_QUARTERS;
/** Agenda slots granted at the start of every week; unused slots do not carry over. */
export const WEEK_SLOTS = 3;
export const STAMINA_MAX = 100;
export const STAMINA_REGEN_PER_DAY = 6;
/** Presence (how visible the YB is on the ground) fades without fieldwork. */
export const PRESENCE_DECAY_PER_DAY = 0.25;
export const MAX_OPEN_ISSUES = 4;
export const ISSUE_LIFETIME_DAYS = 21;
/** Chance (per mille, per day) that a new complaint surfaces. */
export const ISSUE_SPAWN_PER_MILLE = 90;
/** Days within each quarter when the Dewan (Parliament/DUN) sits. */
export const SITTING_WINDOW = { start: 21, end: 42 } as const;

export type GameSpeed = "day" | "week" | "month" | "quarter";
export const GAME_SPEEDS: GameSpeed[] = ["day", "week", "month", "quarter"];
/** Game days that pass per real second while the clock runs. */
export const SPEED_DAYS: Record<GameSpeed, number> = { day: 1, week: 7, month: 30, quarter: QUARTER_DAYS };
export const SPEED_LABEL: Record<GameSpeed, Bilingual> = {
  day: { ms: "Harian", en: "Daily" },
  week: { ms: "Mingguan", en: "Weekly" },
  month: { ms: "Bulanan", en: "Monthly" },
  quarter: { ms: "Suku tahun", en: "Quarterly" },
};

export type YbActivityId = "clinic" | "visit" | "kenduri" | "ceramah" | "sitting" | "media" | "fundraise" | "rest";

export interface YbActivity {
  id: YbActivityId;
  icon: string;
  title: Bilingual;
  detail: Bilingual;
  slots: number;
  stamina: number;
  cost: number;
  /** Acts on the zone selected in the city. */
  zone?: boolean;
  /** Only while the Dewan is sitting. */
  sittingOnly?: boolean;
}

export const YB_ACTIVITIES: YbActivity[] = [
  { id: "clinic", icon: "🗂️", slots: 1, stamina: 20, cost: 5_000,
    title: { ms: "Sesi khidmat rakyat", en: "Meet-the-people session" },
    detail: { ms: "Buka pejabat untuk aduan. Selesaikan aduan tertua; kepercayaan +1.", en: "Open the office for complaints. Resolves the oldest complaint; trust +1." } },
  { id: "visit", icon: "🚶", slots: 1, stamina: 15, cost: 2_000, zone: true,
    title: { ms: "Turun padang", en: "Ground visit" },
    detail: { ms: "Lawat zon dipilih: statistik paling lemah +2; selesaikan aduan di zon itu.", en: "Visit the selected zone: weakest stat +2; resolves a complaint there." } },
  { id: "kenduri", icon: "🍛", slots: 1, stamina: 10, cost: 1_000, zone: true,
    title: { ms: "Hadir kenduri / majlis", en: "Attend a community event" },
    detail: { ms: "Kehadiran di zon dipilih: rakyat +1, jentera +1.", en: "Show up in the selected zone: welfare +1, organisation +1." } },
  { id: "ceramah", icon: "🎤", slots: 1, stamina: 25, cost: 8_000,
    title: { ms: "Ceramah / dialog", en: "Public talk / dialogue" },
    detail: { ms: "Terangkan kerja anda kepada pengundi: sokongan tempatan +0.15.", en: "Explain your work to voters: local support +0.15." } },
  { id: "sitting", icon: "🏛️", slots: 2, stamina: 20, cost: 0, sittingOnly: true,
    title: { ms: "Bahas di Dewan", en: "Debate in the Dewan" },
    detail: { ms: "Bangkitkan isu kawasan semasa Dewan bersidang. Kerajaan: peruntukan tambahan RM20k. Pembangkang: kepercayaan +1 lagi.", en: "Raise kawasan issues while the Dewan sits. Government: extra RM20k allocation. Opposition: +1 more trust." } },
  { id: "media", icon: "📡", slots: 1, stamina: 10, cost: 3_000,
    title: { ms: "Kenyataan media", en: "Media statement" },
    detail: { ms: "Hebahkan kerja kawasan: media positif. Pembangkang: kepercayaan +1.", en: "Publicise your kawasan work: positive media. Opposition: trust +1." } },
  { id: "fundraise", icon: "💰", slots: 1, stamina: 20, cost: 0,
    title: { ms: "Majlis kutipan dana", en: "Fundraising dinner" },
    detail: { ms: "Dana pejabat +RM30k, jentera +1.", en: "Office funds +RM30k, organisation +1." } },
  { id: "rest", icon: "🛌", slots: 1, stamina: 0, cost: 0,
    title: { ms: "Rehat bersama keluarga", en: "Rest with family" },
    detail: { ms: "Pulihkan tenaga +45.", en: "Recover stamina +45." } },
];

export function getYbActivity(id: YbActivityId) {
  return YB_ACTIVITIES.find((activity) => activity.id === id);
}

export type YbIssueType = "flood" | "road" | "water" | "clinic" | "aid" | "layoff" | "traders" | "crime";

export const YB_ISSUES: Record<YbIssueType, { icon: string; stat: ZoneStatKey; title: Bilingual }> = {
  flood: { icon: "🌧️", stat: "infra", title: { ms: "Banjir kilat", en: "Flash flood" } },
  road: { icon: "🕳️", stat: "infra", title: { ms: "Jalan berlubang", en: "Potholed road" } },
  water: { icon: "🚱", stat: "infra", title: { ms: "Gangguan bekalan air", en: "Water supply cut" } },
  clinic: { icon: "🏥", stat: "welfare", title: { ms: "Klinik terlalu sesak", en: "Overcrowded clinic" } },
  aid: { icon: "🤲", stat: "welfare", title: { ms: "Keluarga perlukan bantuan", en: "Family needs aid" } },
  layoff: { icon: "🏭", stat: "economy", title: { ms: "Kilang buang pekerja", en: "Factory layoffs" } },
  traders: { icon: "🏪", stat: "economy", title: { ms: "Peniaga kecil terjejas", en: "Small traders hit" } },
  crime: { icon: "🚨", stat: "welfare", title: { ms: "Kes pecah rumah", en: "Burglary spree" } },
};
export const YB_ISSUE_TYPES = Object.keys(YB_ISSUES) as YbIssueType[];

export interface YbIssue { id: string; type: YbIssueType; zone: string; day: number; expires: number }

export interface YbService {
  slots: number;
  stamina: number;
  presence: number;
  issues: YbIssue[];
  resolved: number;
  missed: number;
}

export function newYbService(): YbService {
  return { slots: WEEK_SLOTS, stamina: STAMINA_MAX, presence: 50, issues: [], resolved: 0, missed: 0 };
}

export function dewanSitting(termDay: number) {
  const inQuarter = termDay % QUARTER_DAYS;
  return inQuarter >= SITTING_WINDOW.start && inQuarter < SITTING_WINDOW.end;
}

/** Calendar view of a term day: quarter, month, week (all 1-based). */
export function termCalendar(termDay: number) {
  return {
    quarter: Math.min(TERM_QUARTERS, Math.floor(termDay / QUARTER_DAYS) + 1),
    month: Math.min(60, Math.floor(termDay / (TERM_DAYS / 60)) + 1),
    week: Math.floor(termDay / 7) + 1,
    day: termDay + 1,
  };
}
