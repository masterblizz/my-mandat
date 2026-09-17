import type { CampaignEventId, CampaignToneId } from "./campaignEvents";
import type { StateData } from "./states";

export type PrnCandidateId = "local-champion" | "religious-figure" | "technocrat" | "youth-reformer" | "state-warlord";
export type BilingualText = { ms: string; en: string };

export interface PrnCandidate {
  id: PrnCandidateId;
  name: string;
  archetype: BilingualText;
  pitch: BilingualText;
  strength: BilingualText;
  risk: BilingualText;
  preferredChannel: "ceramah" | "social";
  preferredTones: CampaignToneId[];
  riskyTones: CampaignToneId[];
  organisationDelta: number;
  trustDelta: number;
  formationBonus: number;
  color: string;
}

export const PRN_CANDIDATES: PrnCandidate[] = [
  {
    id: "local-champion", name: "Nur Aisyah Karim",
    archetype: { ms: "Tokoh tempatan popular", en: "Popular local figure" },
    pitch: { ms: "Bekas pemimpin komuniti yang dikenali merentas daerah dan kuat dalam isu perkhidmatan negeri.", en: "A former community leader known across districts and strong on state-service issues." },
    strength: { ms: "Paling selamat di kerusi sengit; ceramah akar umbi lebih berkesan.", en: "Safest in tight seats; grassroots rallies work better." },
    risk: { ms: "Kurang menonjol dalam perbahasan dasar teknikal.", en: "Less distinctive in technical policy debates." },
    preferredChannel: "ceramah", preferredTones: ["calm", "populist"], riskyTones: ["technocratic"],
    organisationDelta: 4, trustDelta: 1, formationBonus: 3, color: "#22d3ee",
  },
  {
    id: "religious-figure", name: "Ustaz Hadi Rahman",
    archetype: { ms: "Tokoh agama", en: "Religious figure" },
    pitch: { ms: "Pendakwah negeri yang menekankan amanah, kebajikan keluarga dan pentadbiran berintegriti.", en: "A state preacher focused on trust, family welfare and principled administration." },
    strength: { ms: "Sangat kuat dalam negeri Melayu dan luar bandar.", en: "Very strong in Malay-majority and rural states." },
    risk: { ms: "Boleh mengecilkan sokongan bandar dan masyarakat majmuk.", en: "Can narrow urban and plural-community support." },
    preferredChannel: "ceramah", preferredTones: ["religious", "calm"], riskyTones: ["attack", "reformist"],
    organisationDelta: 3, trustDelta: 1, formationBonus: 2, color: "#facc15",
  },
  {
    id: "technocrat", name: "Dr Lim Wei Jian",
    archetype: { ms: "Teknokrat", en: "Technocrat" },
    pitch: { ms: "Pakar ekonomi negeri dengan pelan pelaksanaan, sasaran prestasi dan imej pentadbiran cekap.", en: "A state economist offering delivery plans, performance targets and competent administration." },
    strength: { ms: "Menarik pengundi bandar, profesional dan media dasar.", en: "Appeals to urban voters, professionals and policy media." },
    risk: { ms: "Jentera akar umbi kurang bersemangat dan mesej mudah terasa jauh.", en: "Grassroots machinery is less energised and the message can feel distant." },
    preferredChannel: "social", preferredTones: ["technocratic", "calm"], riskyTones: ["populist", "religious"],
    organisationDelta: -1, trustDelta: 3, formationBonus: 4, color: "#60a5fa",
  },
  {
    id: "youth-reformer", name: "Farah Nabila Yusuf",
    archetype: { ms: "Reformis muda", en: "Youth reformer" },
    pitch: { ms: "ADUN generasi baharu yang membawa agenda pekerjaan, perumahan dan kerajaan digital.", en: "A new-generation assembly member campaigning on jobs, housing and digital government." },
    strength: { ms: "Menggerakkan belia, pengundi kali pertama dan kempen digital.", en: "Mobilises youth, first-time voters and digital campaigning." },
    risk: { ms: "Pengalaman eksekutif dipersoal oleh pengundi lebih tua.", en: "Older voters question limited executive experience." },
    preferredChannel: "social", preferredTones: ["reformist", "technocratic"], riskyTones: ["religious", "attack"],
    organisationDelta: 3, trustDelta: 1, formationBonus: 0, color: "#a78bfa",
  },
  {
    id: "state-warlord", name: "Datuk Amir Jalal",
    archetype: { ms: "Panglima politik negeri", en: "State political heavyweight" },
    pitch: { ms: "Veteran rangkaian bahagian yang mampu menyatukan ketua tempatan dan menggerakkan jentera besar.", en: "A veteran division-network broker who can align local chiefs and mobilise a large machine." },
    strength: { ms: "Jentera paling kuat dan kuasa tawar-menawar tinggi selepas keputusan.", en: "Strongest machinery and high bargaining power after the result." },
    risk: { ms: "Imej politik lama mengurangkan kepercayaan pengundi perubahan.", en: "Old-politics baggage reduces trust among change voters." },
    preferredChannel: "ceramah", preferredTones: ["attack", "populist"], riskyTones: ["reformist", "technocratic"],
    organisationDelta: 7, trustDelta: -3, formationBonus: 5, color: "#fb923c",
  },
];

export function getPrnCandidate(id?: string | null) {
  return PRN_CANDIDATES.find(candidate => candidate.id === id);
}

export function prnCandidateStateImpact(id: PrnCandidateId, state: StateData) {
  const d = state.demographics;
  const value = id === "local-champion" ? .72 + state.swingProbability * .018
    : id === "religious-figure" ? -.35 + d.malay * .013 + d.rural * .006 - (d.chinese + d.indian) * .003
    : id === "technocrat" ? .02 + d.urban * .013 + state.swingProbability * .006
    : id === "youth-reformer" ? .06 + d.youth * .019 + d.urban * .005
    : .58 + d.rural * .004 + state.groundStrength / 500;
  return Math.round(Math.max(-.35, Math.min(1.7, value)) * 100) / 100;
}

export function prnCandidateChannelBonus(id: PrnCandidateId | null, channel: "ceramah" | "social") {
  const candidate = getPrnCandidate(id);
  if (!candidate) return 0;
  return candidate.preferredChannel === channel ? .3 : -.05;
}

export function prnCandidateToneBonus(id: PrnCandidateId | null, tone: CampaignToneId, eventId: CampaignEventId) {
  const candidate = getPrnCandidate(id);
  if (!candidate) return 0;
  const scale = eventId === "leader-debate" ? 1 : .4;
  if (candidate.preferredTones.includes(tone)) return Math.round(.42 * scale * 100) / 100;
  if (candidate.riskyTones.includes(tone)) return Math.round(-.38 * scale * 100) / 100;
  return 0;
}
