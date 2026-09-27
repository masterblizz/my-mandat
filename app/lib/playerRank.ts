export type PlayerRank = {
  id: "cadet" | "organiser" | "strategist" | "state-leader" | "national-director" | "mandat-legend";
  titleMs: string;
  titleEn: string;
  minXp: number;
  color: string;
};

export type RankFeature = {
  icon: string;
  labelMs: string;
  labelEn: string;
  descriptionMs: string;
  descriptionEn: string;
};

export type RankPerks = {
  operationLimit: number;
  dailyDecisions: number;
  locationSupportBonus: number;
  fundDiscount: number;
  features: RankFeature[];
};

const RANKS: PlayerRank[] = [
  { id: "cadet", titleMs: "Kadet Politik", titleEn: "Political Cadet", minXp: 0, color: "#94a3b8" },
  { id: "organiser", titleMs: "Penganjur Akar Umbi", titleEn: "Grassroots Organiser", minXp: 60, color: "var(--cyan)" },
  { id: "strategist", titleMs: "Ahli Strategi", titleEn: "Campaign Strategist", minXp: 180, color: "#a78bfa" },
  { id: "state-leader", titleMs: "Pemimpin Negeri", titleEn: "State Leader", minXp: 420, color: "var(--gold)" },
  { id: "national-director", titleMs: "Pengarah Nasional", titleEn: "National Director", minXp: 800, color: "var(--neon-green)" },
  { id: "mandat-legend", titleMs: "Legenda Mandat", titleEn: "Mandat Legend", minXp: 1400, color: "#ff6b5c" },
];

export function playerXp({ playedMinutes = 0, day = 1, term = 1, completed = [], journalEntries = 0 }: { playedMinutes?: number; day?: number; term?: number; completed?: string[]; journalEntries?: number }) {
  return Math.max(0, Math.floor(playedMinutes)) + Math.max(0, day - 1) * 5 + Math.max(0, term - 1) * 120 + completed.length * 25 + Math.min(60, journalEntries);
}

export function getPlayerRank(xp: number) {
  const rankIndex = RANKS.reduce((best, rank, index) => xp >= rank.minXp ? index : best, 0);
  const rank = RANKS[rankIndex];
  const next = RANKS[rankIndex + 1] ?? null;
  return { rank, next, progress: next ? Math.min(100, Math.round(((xp - rank.minXp) / (next.minXp - rank.minXp)) * 100)) : 100 };
}

const RANK_FEATURES: RankFeature[] = [
  { icon: "◈", labelMs: "Akses Medan", labelEn: "Field Access", descriptionMs: "Boleh mengurus sehingga 5 operasi medan aktif pada satu masa.", descriptionEn: "Manage up to 5 active field operations at once." },
  { icon: "✦", labelMs: "Rangkaian Akar Umbi", labelEn: "Grassroots Network", descriptionMs: "+1 slot operasi medan (6 slot keseluruhan).", descriptionEn: "+1 field operation slot (6 total)." },
  { icon: "⌁", labelMs: "Tinjauan Taktikal", labelEn: "Tactical Scout", descriptionMs: "+0.1 sokongan bagi setiap tindakan di lokasi kempen.", descriptionEn: "+0.1 support for every campaign location action." },
  { icon: "◆", labelMs: "Kuasa Negeri", labelEn: "State Authority", descriptionMs: "4 keputusan tersedia pada setiap hari kempen.", descriptionEn: "4 decisions available on every campaign day." },
  { icon: "▣", labelMs: "Logistik Nasional", labelEn: "National Logistics", descriptionMs: "8 slot operasi dan kos tindakan lokasi 5% lebih rendah.", descriptionEn: "8 operation slots and 5% lower location-action costs." },
  { icon: "★", labelMs: "Legasi Mandat", labelEn: "Mandat Legacy", descriptionMs: "9 slot operasi, 5 keputusan sehari, +0.5 sokongan dan penjimatan dana 10%.", descriptionEn: "9 operation slots, 5 decisions daily, +0.5 support and 10% fund savings." },
];

const PERK_VALUES: Omit<RankPerks, "features">[] = [
  { operationLimit: 5, dailyDecisions: 3, locationSupportBonus: 0, fundDiscount: 0 },
  { operationLimit: 6, dailyDecisions: 3, locationSupportBonus: 0, fundDiscount: 0 },
  { operationLimit: 6, dailyDecisions: 3, locationSupportBonus: 0.1, fundDiscount: 0 },
  { operationLimit: 7, dailyDecisions: 4, locationSupportBonus: 0.1, fundDiscount: 0 },
  { operationLimit: 8, dailyDecisions: 4, locationSupportBonus: 0.1, fundDiscount: 0.05 },
  { operationLimit: 9, dailyDecisions: 5, locationSupportBonus: 0.5, fundDiscount: 0.1 },
];

export function getRankPerks(xp: number): RankPerks {
  const { rank } = getPlayerRank(xp);
  const rankIndex = RANKS.findIndex((item) => item.id === rank.id);
  return { ...PERK_VALUES[rankIndex], features: RANK_FEATURES.slice(0, rankIndex + 1) };
}

export function formatPlaytime(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  return `${Math.floor(safe / 60)}j ${String(safe % 60).padStart(2, "0")}m`;
}
