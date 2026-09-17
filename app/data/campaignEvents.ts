import type { StateData } from "./states";
import type { ManifestoPackageId } from "./manifestoPackages";
import { prnCandidateToneBonus, type PrnCandidateId } from "./prnCandidates";

export type CampaignEventId = "leader-debate" | "press-conference" | "scandal-response" | "youth-townhall" | "mega-rally";
export type CampaignToneId = "calm" | "attack" | "populist" | "technocratic" | "religious" | "reformist";
export type CampaignEventRating = "breakthrough" | "solid" | "mixed" | "backlash";

type Bilingual = { ms: string; en: string };

export interface CampaignEvent {
  id: CampaignEventId;
  title: Bilingual;
  prnTitle?: Bilingual;
  description: Bilingual;
  audience: Bilingual;
  cost: number;
  mediaCost: number;
  manpowerCost: number;
  unlockRatio: number;
  power: number;
  preferredTones: CampaignToneId[];
  riskyTones: CampaignToneId[];
  color: string;
}

export interface CampaignTone {
  id: CampaignToneId;
  title: Bilingual;
  description: Bilingual;
  strength: Bilingual;
  risk: Bilingual;
  color: string;
}

export interface CampaignEventContext {
  charisma: number;
  credibility: number;
  strategy: number;
  manifestoId: ManifestoPackageId | null;
  mediaSentiment: "positive" | "neutral" | "negative";
  difficulty: "easy" | "normal" | "hard" | "nightmare";
  prnCandidateId?: PrnCandidateId | null;
}

export interface CampaignEventPreview {
  stateImpacts: { stateId: string; stateName: string; impact: number }[];
  averageImpact: number;
  strongest: { stateId: string; stateName: string; impact: number };
  weakest: { stateId: string; stateName: string; impact: number };
  rating: CampaignEventRating;
}

export const CAMPAIGN_EVENTS: CampaignEvent[] = [
  { id: "youth-townhall", title: { ms: "Sesi dialog belia", en: "Youth town hall" }, description: { ms: "Soalan langsung mengenai kerja, rumah dan masa depan digital.", en: "Live questions on jobs, housing and the digital future." }, audience: { ms: "Belia dan pengundi kali pertama", en: "Youth and first-time voters" }, cost: 90000, mediaCost: 45, manpowerCost: 25, unlockRatio: 0, power: .34, preferredTones: ["reformist", "technocratic"], riskyTones: ["religious"], color: "#00e5a8" },
  { id: "press-conference", title: { ms: "Sidang media nasional", en: "National press conference" }, description: { ms: "Wartawan menguji angka, konsistensi dan disiplin mesej.", en: "Reporters test your numbers, consistency and message discipline." }, audience: { ms: "Media, profesional dan pengundi bandar", en: "Media, professionals and urban voters" }, cost: 70000, mediaCost: 35, manpowerCost: 10, unlockRatio: .14, power: .24, preferredTones: ["calm", "technocratic"], riskyTones: ["populist", "religious"], color: "#35d9ff" },
  { id: "leader-debate", title: { ms: "Debat calon Perdana Menteri", en: "Prime ministerial debate" }, prnTitle: { ms: "Debat calon MB/KM", en: "MB/CM candidate debate" }, description: { ms: "Perbandingan nasional mengenai ekonomi, integriti dan kepimpinan.", en: "A national comparison on the economy, integrity and leadership." }, audience: { ms: "Pengundi atas pagar seluruh negara", en: "Undecided voters nationwide" }, cost: 160000, mediaCost: 80, manpowerCost: 20, unlockRatio: .32, power: .48, preferredTones: ["calm", "attack", "technocratic"], riskyTones: ["religious"], color: "#ffd166" },
  { id: "scandal-response", title: { ms: "Respons skandal tular", en: "Viral scandal response" }, description: { ms: "Jawab dakwaan sebelum kitaran berita dan serangan lawan mengeras.", en: "Answer allegations before the news cycle and opposition attack harden." }, audience: { ms: "Pengundi ragu-ragu dan pengguna media sosial", en: "Sceptical voters and social-media users" }, cost: 55000, mediaCost: 70, manpowerCost: 10, unlockRatio: .45, power: .12, preferredTones: ["calm", "reformist"], riskyTones: ["attack", "populist"], color: "#fb7185" },
  { id: "mega-rally", title: { ms: "Ceramah mega penutup", en: "Closing mega rally" }, description: { ms: "Himpunan besar menguji jentera, disiplin dan tenaga penyokong.", en: "A mass gathering tests machinery, discipline and supporter energy." }, audience: { ms: "Akar umbi dan pengundi luar bandar", en: "Grassroots and rural voters" }, cost: 220000, mediaCost: 30, manpowerCost: 100, unlockRatio: .68, power: .52, preferredTones: ["populist", "religious", "reformist"], riskyTones: ["technocratic"], color: "#f59e0b" },
];

export const CAMPAIGN_TONES: CampaignTone[] = [
  { id: "calm", title: { ms: "Tenang", en: "Calm" }, description: { ms: "Jawab tepat, akui batas dan kekal berdisiplin.", en: "Answer precisely, acknowledge limits and stay disciplined." }, strength: { ms: "Kredibiliti dan pengundi sederhana", en: "Credibility and moderate voters" }, risk: { ms: "Kurang bertenaga di pentas besar", en: "Can feel flat on a large stage" }, color: "#60a5fa" },
  { id: "attack", title: { ms: "Serang", en: "Attack" }, description: { ms: "Paksa lawan mempertahankan rekod dan percanggahan mereka.", en: "Force the opponent to defend their record and contradictions." }, strength: { ms: "Kerusi sengit dan liputan media", en: "Tight contests and media attention" }, risk: { ms: "Backlash jika serangan tidak kena", en: "Backlash if the attack misses" }, color: "#fb7185" },
  { id: "populist", title: { ms: "Populis", en: "Populist" }, description: { ms: "Gunakan bahasa mudah mengenai harga, gaji dan kuasa rakyat.", en: "Use plain language about prices, wages and people power." }, strength: { ms: "Akar umbi dan luar bandar", en: "Grassroots and rural voters" }, risk: { ms: "Angka dasar mudah dipersoal", en: "Policy numbers invite scrutiny" }, color: "#f59e0b" },
  { id: "technocratic", title: { ms: "Teknokratik", en: "Technocratic" }, description: { ms: "Bentangkan angka, jadual pelaksanaan dan ukuran hasil.", en: "Present numbers, implementation timelines and outcome measures." }, strength: { ms: "Bandar dan profesional", en: "Urban and professional voters" }, risk: { ms: "Mesej boleh terasa jauh", en: "The message can feel distant" }, color: "#35d9ff" },
  { id: "religious", title: { ms: "Keagamaan", en: "Religious" }, description: { ms: "Tekankan amanah, nilai keluarga dan tanggungjawab masyarakat.", en: "Emphasise trust, family values and community duty." }, strength: { ms: "Melayu konservatif dan luar bandar", en: "Conservative Malay and rural voters" }, risk: { ms: "Boleh mengecilkan gabungan pengundi", en: "Can narrow the voter coalition" }, color: "#ffd166" },
  { id: "reformist", title: { ms: "Reformis", en: "Reformist" }, description: { ms: "Bawa pembaharuan institusi, peluang saksama dan suara generasi baharu.", en: "Champion institutional reform, fair opportunity and a new generation." }, strength: { ms: "Belia, bandar dan pengundi perubahan", en: "Youth, urban and change voters" }, risk: { ms: "Tentangan jentera tradisional", en: "Resistance from traditional machinery" }, color: "#a78bfa" },
];

export function getCampaignEvent(id?: string | null) { return CAMPAIGN_EVENTS.find(event => event.id === id); }
export function getCampaignTone(id?: string | null) { return CAMPAIGN_TONES.find(tone => tone.id === id); }
export function campaignEventUnlockDay(event: CampaignEvent, totalDays: number) { return Math.max(1, Math.ceil(totalDays * event.unlockRatio)); }
export function isCampaignEventUnlocked(event: CampaignEvent, day: number, totalDays: number) { return day >= campaignEventUnlockDay(event, totalDays); }

const round = (value: number) => Math.round(value * 100) / 100;

function toneAudienceFit(tone: CampaignToneId, state: StateData) {
  const d = state.demographics;
  if (tone === "attack") return state.swingProbability / 100 * .34 - .04;
  if (tone === "populist") return d.rural / 100 * .42 + d.youth / 100 * .08 - d.urban / 100 * .08;
  if (tone === "technocratic") return d.urban / 100 * .38 + d.youth / 100 * .12 - d.rural / 100 * .08;
  if (tone === "religious") return d.malay / 100 * .42 + d.rural / 100 * .18 - (d.chinese + d.indian) / 100 * .14;
  if (tone === "reformist") return d.youth / 100 * .32 + d.urban / 100 * .16 + (d.chinese + d.indian + d.others) / 100 * .1;
  return .12;
}

function eventAudienceFit(event: CampaignEventId, state: StateData) {
  if (event === "youth-townhall") return state.demographics.youth / 100 * .46;
  if (event === "press-conference") return state.demographics.urban / 100 * .28;
  if (event === "scandal-response") return state.swingProbability / 100 * .22;
  if (event === "mega-rally") return state.demographics.rural / 100 * .38;
  return .14;
}

const manifestoTone: Partial<Record<ManifestoPackageId, CampaignToneId[]>> = {
  economy: ["populist", "technocratic"],
  "anti-corruption": ["calm", "reformist"],
  conservative: ["religious", "calm"],
  multiracial: ["reformist", "calm"],
  rural: ["populist", "religious"],
  borneo: ["populist", "reformist"],
  "youth-jobs": ["reformist", "technocratic"],
};

function leaderFit(tone: CampaignToneId, context: CampaignEventContext) {
  const relevant = tone === "attack" ? (context.charisma + context.strategy) / 2
    : tone === "technocratic" ? (context.credibility + context.strategy) / 2
    : tone === "calm" || tone === "religious" ? context.credibility
    : tone === "reformist" ? (context.charisma + context.credibility) / 2
    : context.charisma;
  return (relevant - 70) / 100 * .8;
}

export function campaignEventStateImpact(eventId: CampaignEventId, toneId: CampaignToneId, state: StateData, context: CampaignEventContext) {
  const event = getCampaignEvent(eventId);
  if (!event) return 0;
  const toneMatch = event.preferredTones.includes(toneId) ? .28 : event.riskyTones.includes(toneId) ? -.58 : -.08;
  const manifestoMatch = context.manifestoId && manifestoTone[context.manifestoId]?.includes(toneId) ? .2 : 0;
  const media = context.mediaSentiment === "positive" ? .08 : context.mediaSentiment === "negative" ? -.12 : 0;
  const difficulty = { easy: 0, normal: .05, hard: .13, nightmare: .22 }[context.difficulty];
  const candidateFit = prnCandidateToneBonus(context.prnCandidateId ?? null, toneId, eventId);
  return round(Math.max(-.9, Math.min(2.1, event.power + toneMatch + toneAudienceFit(toneId, state) + eventAudienceFit(eventId, state) + leaderFit(toneId, context) + manifestoMatch + candidateFit + media - difficulty)));
}

export function previewCampaignEvent(eventId: CampaignEventId, toneId: CampaignToneId, states: StateData[], context: CampaignEventContext): CampaignEventPreview {
  const stateImpacts = states.map(state => ({ stateId: state.id, stateName: state.name, impact: campaignEventStateImpact(eventId, toneId, state, context) }));
  const ranked = [...stateImpacts].sort((a, b) => b.impact - a.impact);
  const averageImpact = round(stateImpacts.reduce((sum, item) => sum + item.impact, 0) / Math.max(1, stateImpacts.length));
  const rating: CampaignEventRating = averageImpact >= 1.05 ? "breakthrough" : averageImpact >= .45 ? "solid" : averageImpact >= 0 ? "mixed" : "backlash";
  const empty = { stateId: "", stateName: "—", impact: 0 };
  return { stateImpacts, averageImpact, strongest: ranked[0] ?? empty, weakest: ranked[ranked.length - 1] ?? empty, rating };
}
