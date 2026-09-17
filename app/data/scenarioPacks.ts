import type { PrnCandidateId } from "./prnCandidates";
import type { StateData } from "./states";
import type { GameState } from "../store/gameStore";
import type { Issue } from "../store/journey";
import { generateConstituencies } from "./constituencies";
import { computeElectionOutcome } from "../utils/electionOutcome";

type Bilingual = { ms: string; en: string };
export type ScenarioPackId = "reform-wave-1998" | "political-tsunami-2008" | "change-government-2018" | "borneo-kingmaker-2030" | "selangor-climate-2032" | "kelantan-youth-2035";
export type ScenarioObjectiveCriterion =
  | { type: "seats"; target: number }
  | { type: "states-won"; target: number }
  | { type: "support"; target: number }
  | { type: "state-support"; stateId: string; target: number }
  | { type: "trust" | "organisation" | "funds" | "event-success" | "issue-coverage"; target: number }
  | { type: "manifesto"; id: string }
  | { type: "pledge"; id: Issue };

export interface ScenarioObjective {
  id: string;
  title: Bilingual;
  criterion: ScenarioObjectiveCriterion;
}

export interface ScenarioPack {
  id: ScenarioPackId;
  kind: "historical" | "hypothetical";
  year: string;
  title: Bilingual;
  subtitle: Bilingual;
  premise: Bilingual;
  disclaimer?: Bilingual;
  color: string;
  scope: "pru" | "prn";
  stateId: string;
  issue: Issue;
  difficulty: "easy" | "normal" | "hard" | "nightmare";
  oppositionStrength: number;
  mediaBias: "pro" | "balanced" | "hostile";
  funds: number;
  manpower: number;
  mediaBuy: number;
  trust: number;
  organisation: number;
  stateDeltas: Record<string, number>;
  prnCandidateId?: PrnCandidateId;
  objectives: ScenarioObjective[];
}

export const SCENARIO_PACKS: ScenarioPack[] = [
  {
    id: "reform-wave-1998", kind: "historical", year: "1998",
    title: { ms: "Gelombang Reformasi", en: "Reform Wave" }, subtitle: { ms: "Krisis keyakinan dan kebangkitan bandar", en: "A confidence crisis and urban mobilisation" },
    premise: { ms: "Sebuah gerakan baharu lahir ketika ekonomi dan institusi dipersoal. Dana terhad, media bermusuhan, tetapi pengundi bandar bersedia mendengar.", en: "A new movement emerges as the economy and institutions face scrutiny. Funds are tight and media hostile, but urban voters are ready to listen." },
    disclaimer: { ms: "Senario fiksyen berasaskan suasana sejarah; semua angka dan parti ialah simulasi.", en: "A fictional scenario inspired by a historical climate; all figures and parties are simulated." },
    color: "#f97316", scope: "pru", stateId: "wp", issue: "jobs", difficulty: "hard", oppositionStrength: 82, mediaBias: "hostile", funds: 1_450_000, manpower: 480, mediaBuy: 360, trust: 58, organisation: 44,
    stateDeltas: { wp: 4, selangor: 2.5, penang: 2, perak: .8, kedah: -1.5, kelantan: -3, terengganu: -2.5, pahang: -1.5 },
    objectives: [
      { id: "urban", title: { ms: "Capai 50% sokongan Kuala Lumpur", en: "Reach 50% support in Kuala Lumpur" }, criterion: { type: "state-support", stateId: "wp", target: 50 } },
      { id: "national", title: { ms: "Naikkan sokongan nasional ke 43%", en: "Raise national support to 43%" }, criterion: { type: "support", target: 43 } },
      { id: "stage", title: { ms: "Catat satu persembahan kempen kukuh", en: "Deliver one strong campaign performance" }, criterion: { type: "event-success", target: 1 } },
    ],
  },
  {
    id: "political-tsunami-2008", kind: "historical", year: "2008",
    title: { ms: "Tsunami Politik", en: "Political Tsunami" }, subtitle: { ms: "Koridor bandar mula beralih", en: "The urban corridor begins to swing" },
    premise: { ms: "Kos sara hidup dan pengundi digital membuka ruang di negeri industri. Bina gelombang tanpa kehilangan disiplin jentera.", en: "Living costs and digital voters open a path through industrial states. Build a wave without losing organisational discipline." },
    disclaimer: { ms: "Senario fiksyen berasaskan pola sejarah; keputusan sebenar tidak diterbitkan semula.", en: "A fictional scenario inspired by historical patterns; actual results are not reproduced." },
    color: "#22d3ee", scope: "pru", stateId: "penang", issue: "jobs", difficulty: "normal", oppositionStrength: 68, mediaBias: "balanced", funds: 1_950_000, manpower: 610, mediaBuy: 480, trust: 53, organisation: 56,
    stateDeltas: { penang: 4, selangor: 3, perak: 2.2, kedah: 1.5, wp: 2.5, johor: -1.2, pahang: -1.2, sabah: -.8, sarawak: -.8 },
    objectives: [
      { id: "seats", title: { ms: "Menangi sekurang-kurangnya 80 kerusi", en: "Win at least 80 seats" }, criterion: { type: "seats", target: 80 } },
      { id: "states", title: { ms: "Menangi empat negeri", en: "Win four states" }, criterion: { type: "states-won", target: 4 } },
      { id: "machine", title: { ms: "Bina jentera ke 62", en: "Build organisation to 62" }, criterion: { type: "organisation", target: 62 } },
    ],
  },
  {
    id: "change-government-2018", kind: "historical", year: "2018",
    title: { ms: "Ujian Pertukaran Kuasa", en: "Change of Government Test" }, subtitle: { ms: "Gabungan reformasi mengejar majoriti", en: "A reform coalition pursues a majority" },
    premise: { ms: "Pengundi menuntut integriti dan perubahan, tetapi kemenangan memerlukan penembusan Johor serta Borneo dan keyakinan terhadap gabungan luas.", en: "Voters demand integrity and change, but victory requires breakthroughs in Johor and Borneo plus confidence in a broad coalition." },
    disclaimer: { ms: "Senario alternatif dengan parti fiksyen; ia bukan simulasi keputusan rasmi 2018.", en: "An alternate scenario with fictional parties; it is not a simulation of the official 2018 result." },
    color: "#facc15", scope: "pru", stateId: "johor", issue: "clinic", difficulty: "hard", oppositionStrength: 76, mediaBias: "balanced", funds: 2_300_000, manpower: 720, mediaBuy: 560, trust: 61, organisation: 62,
    stateDeltas: { johor: 3.5, selangor: 2, wp: 2, penang: 1.5, kedah: 1, sabah: 2.2, sarawak: 1.6, kelantan: -2, terengganu: -2 },
    objectives: [
      { id: "majority", title: { ms: "Capai majoriti Parlimen", en: "Secure a parliamentary majority" }, criterion: { type: "seats", target: 112 } },
      { id: "integrity", title: { ms: "Lancarkan manifesto antirasuah", en: "Launch the anti-corruption manifesto" }, criterion: { type: "manifesto", id: "anti-corruption" } },
      { id: "trust", title: { ms: "Kekalkan kepercayaan sekurang-kurangnya 60", en: "Keep trust at 60 or higher" }, criterion: { type: "trust", target: 60 } },
    ],
  },
  {
    id: "borneo-kingmaker-2030", kind: "hypothetical", year: "2030",
    title: { ms: "Borneo Penentu Kuasa", en: "Borneo Kingmaker" }, subtitle: { ms: "Pakatan wilayah menentukan Putrajaya", en: "A regional pact holds the route to Putrajaya" },
    premise: { ms: "Semenanjung terpecah tiga. Sabah dan Sarawak menawarkan laluan ke kerajaan, tetapi hanya kepada parti yang membina kepercayaan wilayah sebenar.", en: "The peninsula splits three ways. Sabah and Sarawak offer a route to government, but only to a party that earns real regional trust." },
    color: "#34d399", scope: "pru", stateId: "sabah", issue: "jobs", difficulty: "hard", oppositionStrength: 72, mediaBias: "balanced", funds: 1_800_000, manpower: 560, mediaBuy: 430, trust: 50, organisation: 48,
    stateDeltas: { sabah: 6, sarawak: 5, johor: -1.5, selangor: -1.5, wp: -2, penang: -1.5, kelantan: -1, terengganu: -1 },
    objectives: [
      { id: "sabah", title: { ms: "Capai 50% sokongan Sabah", en: "Reach 50% support in Sabah" }, criterion: { type: "state-support", stateId: "sabah", target: 50 } },
      { id: "sarawak", title: { ms: "Capai 47% sokongan Sarawak", en: "Reach 47% support in Sarawak" }, criterion: { type: "state-support", stateId: "sarawak", target: 47 } },
      { id: "reserve", title: { ms: "Simpan RM400,000 untuk rundingan", en: "Retain RM400,000 for negotiations" }, criterion: { type: "funds", target: 400000 } },
    ],
  },
  {
    id: "selangor-climate-2032", kind: "hypothetical", year: "2032",
    title: { ms: "PRN Darurat Iklim", en: "Climate Emergency PRN" }, subtitle: { ms: "Selangor selepas banjir besar", en: "Selangor after a major flood" },
    premise: { ms: "Kemarahan terhadap tebatan banjir dan perumahan memecahkan sokongan bandar. Calon muda perlu menukar krisis kepada mandat negeri.", en: "Anger over flood mitigation and housing fractures the urban vote. A young candidate must turn crisis into a state mandate." },
    color: "#38bdf8", scope: "prn", stateId: "selangor", issue: "flood", difficulty: "hard", oppositionStrength: 78, mediaBias: "hostile", funds: 1_350_000, manpower: 420, mediaBuy: 460, trust: 44, organisation: 46, prnCandidateId: "youth-reformer",
    stateDeltas: { selangor: -3 },
    objectives: [
      { id: "majority", title: { ms: "Capai majoriti DUN Selangor", en: "Secure a Selangor DUN majority" }, criterion: { type: "seats", target: 29 } },
      { id: "promise", title: { ms: "Ikrar projek tebatan banjir", en: "Make a flood-protection commitment" }, criterion: { type: "pledge", id: "flood" } },
      { id: "issues", title: { ms: "Liputi isu negeri dua kali", en: "Cover state issues twice" }, criterion: { type: "issue-coverage", target: 2 } },
    ],
  },
  {
    id: "kelantan-youth-2035", kind: "hypothetical", year: "2035",
    title: { ms: "Gelombang Belia Pantai Timur", en: "East Coast Youth Wave" }, subtitle: { ms: "Pengundi muda mencabar kubu lama", en: "Young voters challenge an old fortress" },
    premise: { ms: "Penghijrahan belia dan kekurangan kerja menjadi isu utama. Sebuah gerakan baharu cuba memecahkan kubu melalui media sosial tanpa mengabaikan kampung.", en: "Youth migration and scarce jobs dominate the election. A new movement tries to break a fortress through social media without abandoning villages." },
    color: "#a78bfa", scope: "prn", stateId: "kelantan", issue: "jobs", difficulty: "nightmare", oppositionStrength: 92, mediaBias: "hostile", funds: 1_100_000, manpower: 390, mediaBuy: 620, trust: 47, organisation: 40, prnCandidateId: "youth-reformer",
    stateDeltas: { kelantan: 7 },
    objectives: [
      { id: "support", title: { ms: "Capai 42% sokongan negeri", en: "Reach 42% state support" }, criterion: { type: "support", target: 42 } },
      { id: "manifesto", title: { ms: "Lancarkan manifesto pekerjaan belia", en: "Launch the youth-jobs manifesto" }, criterion: { type: "manifesto", id: "youth-jobs" } },
      { id: "issues", title: { ms: "Liputi isu negeri tiga kali", en: "Cover state issues three times" }, criterion: { type: "issue-coverage", target: 3 } },
    ],
  },
];

export function getScenarioPack(id?: string | null) {
  return SCENARIO_PACKS.find(pack => pack.id === id);
}

export function applyScenarioState(states: StateData[], pack: ScenarioPack) {
  return states.map(state => {
    const delta = pack.stateDeltas[state.id] ?? 0;
    const mandatSupport = Math.max(8, Math.min(82, Math.round((state.mandatSupport + delta) * 100) / 100));
    const othersSupport = Math.max(4, Math.min(state.othersSupport, 100 - mandatSupport - 8));
    const lawanSupport = Math.round((100 - mandatSupport - othersSupport) * 100) / 100;
    const updated = { ...state, mandatSupport, lawanSupport, othersSupport, trend: delta };
    const seats = generateConstituencies(updated, pack.scope === "prn" ? "dun" : "parliament");
    const projectedSeats = seats.filter(seat => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length;
    const margin = mandatSupport - lawanSupport;
    return { ...updated, projectedSeats, winProbability: Math.max(5, Math.min(95, Math.round((50 + margin * 2) * 100) / 100)), status: margin >= 8 ? "winning" as const : margin <= -8 ? "losing" as const : "contested" as const };
  });
}

export function scenarioObjectiveProgress(state: GameState, criterion: ScenarioObjectiveCriterion) {
  const outcome = computeElectionOutcome(state.states, state.settings);
  if (criterion.type === "seats") return { value: outcome.seatsWon, target: criterion.target, complete: outcome.seatsWon >= criterion.target };
  if (criterion.type === "states-won") return { value: outcome.statesWon, target: criterion.target, complete: outcome.statesWon >= criterion.target };
  if (criterion.type === "support") return { value: outcome.nationalSupport, target: criterion.target, complete: outcome.nationalSupport >= criterion.target };
  if (criterion.type === "state-support") {
    const value = Math.round(state.states.find(item => item.id === criterion.stateId)?.mandatSupport ?? 0);
    return { value, target: criterion.target, complete: value >= criterion.target };
  }
  if (criterion.type === "trust") return { value: state.journey.trust, target: criterion.target, complete: state.journey.trust >= criterion.target };
  if (criterion.type === "organisation") return { value: state.journey.organisation, target: criterion.target, complete: state.journey.organisation >= criterion.target };
  if (criterion.type === "funds") return { value: state.resources.funds, target: criterion.target, complete: state.resources.funds >= criterion.target };
  if (criterion.type === "event-success") {
    const value = state.journey.campaignEvents.filter(event => event.term === state.careerProgress.term && ["solid", "breakthrough"].includes(event.rating)).length;
    return { value, target: criterion.target, complete: value >= criterion.target };
  }
  if (criterion.type === "issue-coverage") {
    const prefix = `${state.careerProgress.term}:${state.settings.prnStateId}:`;
    const value = Object.entries(state.journey.prnIssueActions).filter(([key]) => key.startsWith(prefix)).reduce((sum, [, count]) => sum + count, 0);
    return { value, target: criterion.target, complete: value >= criterion.target };
  }
  if (criterion.type === "manifesto") {
    const complete = state.journey.manifestoPackageId === criterion.id;
    return { value: complete ? 1 : 0, target: 1, complete };
  }
  if (criterion.type === "pledge") {
    const complete = state.journey.pledges.some(pledge => pledge.id === criterion.id && pledge.term === state.careerProgress.term);
    return { value: complete ? 1 : 0, target: 1, complete };
  }
  return { value: 0, target: 1, complete: false };
}
