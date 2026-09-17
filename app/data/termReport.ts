import { evaluateCabinet } from "./cabinetDynamics";
import { getManifestoPackage } from "./manifestoPackages";
import type { StateData } from "./states";
import type { GameState } from "../store/gameStore";
import { computeElectionOutcome } from "../utils/electionOutcome";

type Bilingual = { ms: string; en: string };
export type TermChapter = "government" | "opposition" | "rebuilding";
export type RatingBand = "transformative" | "durable" | "mixed" | "fragile" | "rejected";

export interface TermReportRecord {
  term: number;
  chapter: TermChapter;
  scope: "pru" | "prn";
  stateId: string | null;
  seats: number;
  totalSeats: number;
  majorityTarget: number;
  popularVote: number;
  trust: number;
  delivered: number;
  totalPledges: number;
  cabinetQuality: number;
  stability: number;
  organisation: number;
  rating: number;
  ratingBand: RatingBand;
  bestStrategy: Bilingual;
  biggestMistake: Bilingual;
  strongestRegion: Bilingual & { value: number };
  weakestRegion: Bilingual & { value: number };
  voterBlocs: { id: "urban" | "rural" | "youth" | "malay" | "plural"; label: Bilingual; support: number }[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function weightedSupport(states: StateData[], weight: (state: StateData) => number) {
  const weighted = states.reduce((sum, state) => sum + state.mandatSupport * Math.max(0, weight(state)), 0);
  const total = states.reduce((sum, state) => sum + Math.max(0, weight(state)), 0);
  return clamp(total ? weighted / total : 0);
}

function regionalScores(states: StateData[], isPrn: boolean) {
  if (isPrn) {
    const state = states[0];
    const item = { ms: state?.name ?? "Negeri", en: state?.name ?? "State", value: clamp(state?.mandatSupport ?? 0) };
    return { strongest: item, weakest: item };
  }
  const groups = [
    { ms: "Semenanjung", en: "Peninsular Malaysia", states: states.filter(state => state.region === "peninsular") },
    { ms: "Sabah dan Sarawak", en: "Sabah and Sarawak", states: states.filter(state => state.region === "borneo") },
  ].filter(group => group.states.length);
  const scores = groups.map(group => ({ ms: group.ms, en: group.en, value: weightedSupport(group.states, state => state.seats) }));
  return {
    strongest: [...scores].sort((a, b) => b.value - a.value)[0] ?? { ms: "—", en: "—", value: 0 },
    weakest: [...scores].sort((a, b) => a.value - b.value)[0] ?? { ms: "—", en: "—", value: 0 },
  };
}

export function termRatingBand(score: number): RatingBand {
  return score >= 85 ? "transformative" : score >= 70 ? "durable" : score >= 55 ? "mixed" : score >= 40 ? "fragile" : "rejected";
}

export const RATING_LABELS: Record<RatingBand, Bilingual> = {
  transformative: { ms: "Legasi transformatif", en: "Transformative legacy" },
  durable: { ms: "Mandat berkekalan", en: "Durable mandate" },
  mixed: { ms: "Rekod bercampur", en: "Mixed record" },
  fragile: { ms: "Legasi rapuh", en: "Fragile legacy" },
  rejected: { ms: "Mandat ditolak", en: "Mandate rejected" },
};

export function buildTermReport(state: GameState): TermReportRecord {
  const journey = state.journey;
  const outcome = journey.outcome ?? computeElectionOutcome(state.states, state.settings);
  const chapter = (["government", "opposition", "rebuilding"].includes(journey.chapter) ? journey.chapter : "opposition") as TermChapter;
  const isPrn = state.settings.electionScope === "prn";
  const scopeStates = isPrn ? state.states.filter(item => item.id === state.settings.prnStateId) : state.states;
  const delivered = journey.pledges.filter(pledge => pledge.status === "delivered" && pledge.term === state.careerProgress.term).length;
  const termPledges = journey.pledges.filter(pledge => pledge.term === state.careerProgress.term);
  const deliveryScore = termPledges.length ? delivered / termPledges.length * 100 : chapter === "government" ? 45 : 60;
  const cabinet = evaluateCabinet(journey.appointments, journey.ministerLoyalty, { isPrn, stateId: state.settings.prnStateId });
  const cabinetQuality = journey.cabinetQuality || cabinet.score;
  const seatScore = outcome.totalSeats ? Math.min(100, outcome.seatsWon / Math.max(1, outcome.majorityTarget) * 78) : 0;
  const roleScore = chapter === "government"
    ? cabinetQuality * .35 + journey.stability * .35 + deliveryScore * .3
    : journey.organisation * .6 + journey.trust * .4;
  const rating = clamp(seatScore * .22 + outcome.nationalSupport * .18 + journey.trust * .22 + roleScore * .28 + journey.organisation * .1);

  const successfulEvents = journey.campaignEvents.filter(event => event.term === state.careerProgress.term && ["breakthrough", "solid"].includes(event.rating)).length;
  const manifesto = getManifestoPackage(journey.manifestoHistory.find(item => item.term === state.careerProgress.term)?.id ?? journey.manifestoPackageId);
  const strategies: { score: number; copy: Bilingual }[] = [
    { score: journey.organisation, copy: { ms: `Jentera parti mencapai ${journey.organisation}/100 melalui pembinaan akar umbi.`, en: `Party organisation reached ${journey.organisation}/100 through grassroots building.` } },
    { score: successfulEvents * 22, copy: { ms: `${successfulEvents} acara kempen menghasilkan persembahan kukuh atau cemerlang.`, en: `${successfulEvents} campaign events produced solid or breakthrough performances.` } },
    { score: manifesto ? 62 : 0, copy: manifesto ? { ms: `Manifesto “${manifesto.title.ms}” memberi kempen identiti yang jelas.`, en: `The “${manifesto.title.en}” manifesto gave the campaign a clear identity.` } : { ms: "Tiada manifesto utama.", en: "No flagship manifesto." } },
  ];
  if (chapter === "government") {
    strategies.push(
      { score: deliveryScore, copy: { ms: `${delivered}/${termPledges.length} janji penggal ditunaikan.`, en: `${delivered}/${termPledges.length} term commitments were delivered.` } },
      { score: cabinetQuality, copy: { ms: `Kualiti dan imbangan pentadbiran mencapai ${cabinetQuality}/100.`, en: `Administration quality and balance reached ${cabinetQuality}/100.` } },
    );
  } else {
    strategies.push({ score: journey.trust, copy: { ms: `Kepercayaan awam dibina kepada ${journey.trust}/100 dari bangku pembangkang.`, en: `Public trust was built to ${journey.trust}/100 from opposition.` } });
  }
  const bestStrategy = [...strategies].sort((a, b) => b.score - a.score)[0].copy;

  const unfinished = termPledges.length - delivered;
  const backlashes = journey.campaignEvents.filter(event => event.term === state.careerProgress.term && event.rating === "backlash").length;
  const mistakes: { severity: number; copy: Bilingual }[] = [
    { severity: Math.max(0, 65 - journey.stability), copy: { ms: `Kestabilan jatuh kepada ${journey.stability}/100.`, en: `Stability fell to ${journey.stability}/100.` } },
    { severity: backlashes * 24, copy: { ms: `${backlashes} penampilan kempen makan diri.`, en: `${backlashes} campaign appearances backfired.` } },
    { severity: journey.organisation < 55 ? 55 - journey.organisation : 0, copy: { ms: `Jentera berakhir pada ${journey.organisation}/100, terlalu lemah untuk pilihan raya seterusnya.`, en: `Organisation finished at ${journey.organisation}/100, too weak for the next election.` } },
  ];
  if (chapter === "government") {
    mistakes.push(
      { severity: unfinished * 28, copy: { ms: `${unfinished} janji penggal masih belum ditunaikan.`, en: `${unfinished} term commitments remain undelivered.` } },
      { severity: journey.ministerIncidents.length * 20, copy: { ms: `${journey.ministerIncidents.length} insiden atau pembelotan menteri melemahkan pentadbiran.`, en: `${journey.ministerIncidents.length} minister incidents or defections weakened the administration.` } },
      { severity: Math.max(0, 60 - cabinetQuality), copy: { ms: `Kualiti pentadbiran hanya ${cabinetQuality}/100.`, en: `Administration quality reached only ${cabinetQuality}/100.` } },
    );
  }
  const worst = [...mistakes].sort((a, b) => b.severity - a.severity)[0];
  const biggestMistake = worst.severity > 0 ? worst.copy : { ms: "Tiada kegagalan besar; risiko utama ialah rasa terlalu yakin.", en: "No major failure; complacency is now the main risk." };
  const regions = regionalScores(scopeStates, isPrn);
  const voterBlocs: TermReportRecord["voterBlocs"] = [
    { id: "urban", label: { ms: "Bandar", en: "Urban" }, support: weightedSupport(scopeStates, item => item.demographics.urban * (isPrn ? item.dunSeats : item.seats)) },
    { id: "rural", label: { ms: "Luar bandar", en: "Rural" }, support: weightedSupport(scopeStates, item => item.demographics.rural * (isPrn ? item.dunSeats : item.seats)) },
    { id: "youth", label: { ms: "Belia", en: "Youth" }, support: weightedSupport(scopeStates, item => item.demographics.youth * (isPrn ? item.dunSeats : item.seats)) },
    { id: "malay", label: { ms: "Melayu", en: "Malay" }, support: weightedSupport(scopeStates, item => item.demographics.malay * (isPrn ? item.dunSeats : item.seats)) },
    { id: "plural", label: { ms: "Masyarakat majmuk", en: "Plural communities" }, support: weightedSupport(scopeStates, item => (item.demographics.chinese + item.demographics.indian + item.demographics.others) * (isPrn ? item.dunSeats : item.seats)) },
  ];

  return {
    term: state.careerProgress.term, chapter, scope: state.settings.electionScope,
    stateId: isPrn ? state.settings.prnStateId : null,
    seats: outcome.seatsWon, totalSeats: outcome.totalSeats, majorityTarget: outcome.majorityTarget,
    popularVote: outcome.nationalSupport, trust: journey.trust, delivered, totalPledges: termPledges.length,
    cabinetQuality, stability: journey.stability, organisation: journey.organisation,
    rating, ratingBand: termRatingBand(rating), bestStrategy, biggestMistake,
    strongestRegion: regions.strongest, weakestRegion: regions.weakest, voterBlocs,
  };
}
