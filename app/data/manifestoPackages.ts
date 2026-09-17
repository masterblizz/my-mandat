import type { StateData } from "./states";
import type { MiniGameType } from "../store/campaignMath";

export type ManifestoPackageId = "economy" | "anti-corruption" | "conservative" | "multiracial" | "rural" | "borneo" | "youth-jobs";

export interface ManifestoPackage {
  id: ManifestoPackageId;
  title: { ms: string; en: string };
  slogan: { ms: string; en: string };
  summary: { ms: string; en: string };
  strengths: { ms: string; en: string };
  risks: { ms: string; en: string };
  cost: number;
  organisationDelta: number;
  preferredChannel: MiniGameType;
  color: string;
}

export const MANIFESTO_PACKAGES: ManifestoPackage[] = [
  { id: "economy", title: { ms: "Ekonomi rakyat", en: "People’s economy" }, slogan: { ms: "Gaji naik, kos terkawal", en: "Higher wages, controlled costs" }, summary: { ms: "Pekerjaan mahir, bantuan bersasar dan sokongan PKS.", en: "Skilled jobs, targeted aid and support for small businesses." }, strengths: { ms: "Bandar, pekerja muda, peniaga", en: "Urban workers, youth, small businesses" }, risks: { ms: "Kurang meyakinkan kawasan pertanian", en: "Less convincing in agricultural districts" }, cost: 120000, organisationDelta: 0, preferredChannel: "social", color: "#35d9ff" },
  { id: "anti-corruption", title: { ms: "Reformasi antirasuah", en: "Anti-corruption reform" }, slogan: { ms: "Institusi bersih, wang rakyat dijaga", en: "Clean institutions, protected public money" }, summary: { ms: "Tender terbuka, audit bebas dan pengisytiharan aset.", en: "Open tenders, independent audits and asset declarations." }, strengths: { ms: "Belia, profesional, pengundi bandar", en: "Youth, professionals, urban voters" }, risks: { ms: "Tentangan elit parti dan jentera lama", en: "Resistance from party elites and old machinery" }, cost: 85000, organisationDelta: -2, preferredChannel: "social", color: "#a78bfa" },
  { id: "conservative", title: { ms: "Nilai dan kestabilan", en: "Values and stability" }, slogan: { ms: "Amanah, keluarga, komuniti", en: "Trust, family, community" }, summary: { ms: "Tadbir urus berteraskan nilai, keluarga dan institusi masyarakat.", en: "Governance centred on values, families and community institutions." }, strengths: { ms: "Pengundi Melayu dan luar bandar", en: "Malay and rural voters" }, risks: { ms: "Boleh menjauhkan pengundi bandar bukan Melayu", en: "May alienate non-Malay urban voters" }, cost: 65000, organisationDelta: 3, preferredChannel: "ceramah", color: "#ffd166" },
  { id: "multiracial", title: { ms: "Reformasi berbilang kaum", en: "Multiracial reform" }, slogan: { ms: "Hak sama, masa depan bersama", en: "Equal rights, shared future" }, summary: { ms: "Peluang saksama, institusi bebas dan perlindungan semua komuniti.", en: "Fair opportunity, independent institutions and protection for every community." }, strengths: { ms: "Bandar, minoriti, belia reformis", en: "Urban voters, minorities, reform-minded youth" }, risks: { ms: "Serangan balas di kawasan konservatif", en: "Backlash in conservative districts" }, cost: 105000, organisationDelta: -1, preferredChannel: "social", color: "#fb7185" },
  { id: "rural", title: { ms: "Pembangunan desa", en: "Rural development" }, slogan: { ms: "Jalan, hasil, peluang", en: "Roads, income, opportunity" }, summary: { ms: "Jalan kampung, internet, pertanian dan klinik luar bandar.", en: "Village roads, connectivity, agriculture and rural clinics." }, strengths: { ms: "Petani, kampung, kawasan pedalaman", en: "Farmers, villages, interior districts" }, risks: { ms: "Tarikan lebih rendah dalam pusat bandar", en: "Lower appeal in metropolitan centres" }, cost: 145000, organisationDelta: 4, preferredChannel: "ceramah", color: "#84cc16" },
  { id: "borneo", title: { ms: "Autonomi Sabah–Sarawak", en: "Sabah–Sarawak autonomy" }, slogan: { ms: "Hak negeri, hasil kembali", en: "State rights, revenue returned" }, summary: { ms: "MA63, hasil negeri, infrastruktur dan kuasa pentadbiran.", en: "MA63, state revenue, infrastructure and administrative powers." }, strengths: { ms: "Sabah, Sarawak dan komuniti wilayah", en: "Sabah, Sarawak and regional communities" }, risks: { ms: "Kesan terhad dan sedikit tentangan di Semenanjung", en: "Limited reach and some resistance in the Peninsula" }, cost: 130000, organisationDelta: 2, preferredChannel: "ceramah", color: "#f59e0b" },
  { id: "youth-jobs", title: { ms: "Kerja dan masa depan belia", en: "Youth jobs and future" }, slogan: { ms: "Kemahiran, gaji, rumah pertama", en: "Skills, wages, first homes" }, summary: { ms: "Latihan digital, gaji permulaan, keusahawanan dan perumahan.", en: "Digital skills, starting wages, entrepreneurship and housing." }, strengths: { ms: "Belia, pinggir bandar, pengundi digital", en: "Youth, suburbs, digital voters" }, risks: { ms: "Kurang menonjol bagi pengundi tradisional", en: "Less compelling to traditional voters" }, cost: 95000, organisationDelta: 1, preferredChannel: "social", color: "#00e5a8" },
];

export function getManifestoPackage(id?: string | null) {
  return MANIFESTO_PACKAGES.find(item => item.id === id);
}

const round = (value: number) => Math.round(value * 100) / 100;

export function manifestoStateImpact(id: ManifestoPackageId, state: StateData): number {
  const d = state.demographics;
  const urban = d.urban / 100, rural = d.rural / 100, youth = d.youth / 100;
  const malay = d.malay / 100, chinese = d.chinese / 100, indian = d.indian / 100, others = d.others / 100;
  let impact = 0;
  if (id === "economy") impact = -.2 + urban * .8 + youth * .5 - rural * .3;
  if (id === "anti-corruption") impact = -.1 + urban * .55 + youth * .4 - rural * .25;
  if (id === "conservative") impact = -.8 + malay * 1.6 + rural * .5 - chinese * .8 - indian * .4;
  if (id === "multiracial") impact = -.4 + chinese * 1.2 + indian * 1.2 + others * .5 + urban * .5 + youth * .25 - malay * .35;
  if (id === "rural") impact = -.5 + rural * 1.2 + malay * .45 - urban * .35;
  if (id === "borneo") impact = state.region === "borneo" ? 1.15 + others * .35 : -.25;
  if (id === "youth-jobs") impact = -.15 + youth * 1.5 + urban * .25 - rural * .15;
  return round(Math.max(-1.25, Math.min(1.75, impact)));
}

export function manifestoCampaignBonus(id: ManifestoPackageId | null, state: StateData, gameType: MiniGameType): number {
  if (!id) return 0;
  const pkg = getManifestoPackage(id);
  if (!pkg) return 0;
  const impact = manifestoStateImpact(id, state);
  const channel = pkg.preferredChannel === gameType ? .12 : 0;
  return round(Math.max(-.18, Math.min(.36, impact * .16 + channel)));
}
