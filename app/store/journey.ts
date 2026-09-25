import type { GameState } from "./gameStore";
import type { ElectionOutcomeSummary } from "../utils/electionOutcome";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { generateConstituencies } from "../data/constituencies";
import { CAREER_STORIES, type StoryChoice } from "../data/careerStories";
import { PARTY_MEMBERS } from "../data/members";
import { evaluateCabinet, getMemberTraits, initialMinisterLoyalty } from "../data/cabinetDynamics";
import { getManifestoPackage, manifestoStateImpact, type ManifestoPackageId } from "../data/manifestoPackages";
import type { CampaignEventId, CampaignEventRating, CampaignToneId } from "../data/campaignEvents";
import { getPrnCandidate, prnCandidateStateImpact, type PrnCandidateId } from "../data/prnCandidates";
import { buildTermReport, type TermReportRecord } from "../data/termReport";
import type { ScenarioPackId } from "../data/scenarioPacks";

export type Chapter = "campaign" | "results" | "formation" | "government" | "opposition" | "rebuilding";
export type Issue = "flood" | "clinic" | "jobs";
export type Bilingual = { ms: string; en: string };
export type CoalitionDeal = "development" | "portfolio" | "confidence";
export type PersonalOfficeId = "community" | "city" | "digital";
export type LeadershipApproach = "service" | "bridge" | "digital";
export type CharacterStage = "member" | "organiser" | "candidate" | "representative" | "partyLeader" | "nationalLeader" | "legacy";
export interface Pledge { id: Issue; status: "promised" | "funded" | "delivered"; remaining: number; term: number }
export interface JournalEntry extends Bilingual { id: string }
export interface CityZone {
  id: string;
  archetype: "townCentre" | "mainVillage" | "housingEstate" | "commercialHub" | "schoolZone" | "industrialArea" | "riverside" | "marketHawkers" | "clinicHall" | "fishingVillage" | "paddyVillage" | "industrialEstate";
  repeat: number;
  kind: "urban" | "village" | "housing" | "commercial" | "education" | "industry" | "river" | "market" | "community";
  economy: number; welfare: number; infra: number; sentiment: number; projects: string[];
}
export interface Journey {
  chapter: Chapter;
  decisions: number;
  actionsToday: string[];
  locationObjectives: string[];
  readOfficeMail: number[];
  partners: string[];
  coalitionTerms: Record<string, CoalitionDeal>;
  coalitionConfirmed: boolean;
  appointments: Record<string, string | null>;
  cabinetQuality: number;
  ministerLoyalty: Record<string, number>;
  ministerIncidents: string[];
  outcome: ElectionOutcomeSummary | null;
  publicBudget: number;
  trust: number;
  stability: number;
  organisation: number;
  pledges: Pledge[];
  policies: string[];
  termActions: string[];
  storyResolved: string[];
  storyChoices: Record<string, StoryChoice>;
  prnIssueActions: Record<string, number>;
  prnCandidateId: PrnCandidateId | null;
  prnCandidateHistory: { term: number; stateId: string; id: PrnCandidateId }[];
  manifestoPackageId: ManifestoPackageId | null;
  manifestoHistory: { term: number; id: ManifestoPackageId }[];
  campaignEvents: { term: number; eventId: CampaignEventId; toneId: CampaignToneId; rating: CampaignEventRating; impact: number }[];
  relationships: Record<string, number>;
  journal: JournalEntry[];
  records: TermReportRecord[];
  scenario: Issue;
  scenarioPackId: ScenarioPackId | null;
  scenarioPackTerm: number | null;
  onboarded: boolean;
  personalOffice: PersonalOfficeId | null;
  originIssue: Issue | null;
  leadershipApproach: LeadershipApproach | null;
  characterStage: CharacterStage;
  resultRecorded: boolean;
  cityZones: Record<string, CityZone[]>;
  construction: { seat: string; zone: string; project: string; target: "infra" | "welfare" | "economy"; boost: number; remaining: number }[];
  /** Consecutive days (campaign) or quarters (term) each repeatable action was used. Rotating actions resets it. */
  streaks: Record<string, number>;
}
export const ISSUE_DATA: Record<Issue, Bilingual & { cost: number; detail: Bilingual }> = {
  flood: { ms: "Tebatan banjir", en: "Flood protection", cost: 300000, detail: { ms: "Penduduk mahu saliran disiapkan sebelum musim hujan.", en: "Residents want drainage completed before the rainy season." } },
  clinic: { ms: "Klinik komuniti", en: "Community clinic", cost: 220000, detail: { ms: "Keluarga terpaksa pergi jauh untuk rawatan.", en: "Families travel too far for basic treatment." } },
  jobs: { ms: "Pasar dan pekerjaan", en: "Market and jobs", cost: 150000, detail: { ms: "Peniaga memerlukan tapak niaga dan pekerjaan tempatan.", en: "Traders need market space and local jobs." } },
};
export const POLICY_DATA = [
  { id: "cost", ms: "Bantuan kos sara hidup", en: "Cost-of-living relief", cost: 180000, trust: 4, stability: 1 },
  { id: "jobs", ms: "Latihan pekerjaan", en: "Job training", cost: 150000, trust: 3, stability: 2 },
  { id: "antiCorruption", ms: "Audit bebas", en: "Independent audit", cost: 90000, trust: 5, stability: -4 },
];
export function newJourney(): Journey {
  return { chapter: "campaign", decisions: 3, actionsToday: [], locationObjectives: [], readOfficeMail: [], partners: [], coalitionTerms: {}, coalitionConfirmed: false, appointments: {}, cabinetQuality: 0, ministerLoyalty: {}, ministerIncidents: [], outcome: null, publicBudget: 0, trust: 50, stability: 65, organisation: 40, pledges: [], policies: [], termActions: [], storyResolved: [], storyChoices: {}, prnIssueActions: {}, prnCandidateId: null, prnCandidateHistory: [], manifestoPackageId: null, manifestoHistory: [], campaignEvents: [], relationships: {}, journal: [], records: [], scenario: "flood", scenarioPackId: null, scenarioPackTerm: null, onboarded: false, personalOffice: null, originIssue: null, leadershipApproach: null, characterStage: "member", resultRecorded: false, cityZones: {}, construction: [], streaks: {} };
}
export function normalizeJourney(value?: Partial<Journey>): Journey {
  return { ...newJourney(), ...value };
}
export function journal(j: Journey, ms: string, en: string): JournalEntry[] {
  return [{ id: `${Date.now()}-${j.journal.length}-${j.decisions}`, ms, en }, ...j.journal].slice(0, 12);
}
// Repeating the same move on back-to-back days (or quarters) loses force, so the
// best play rotates between visits, fundraising, organising, stories and events.
export const CAMPAIGN_REPEATABLES = ["visit", "fundraise", "organise"] as const;
export const TERM_REPEATABLES = ["scrutiny", "branches", "recruit"] as const;
export function fatigueFactor(streak = 0) { return Math.max(0.35, 1 - streak * 0.2); }
export function rollStreaks(streaks: Record<string, number>, used: string[], keys: readonly string[]) {
  const next = { ...streaks };
  for (const key of keys) next[key] = used.includes(key) ? (streaks[key] ?? 0) + 1 : 0;
  return next;
}
export function campaignActionYield(j: Pick<Journey, "streaks">, action: typeof CAMPAIGN_REPEATABLES[number]) {
  const factor = fatigueFactor(j.streaks?.[action]);
  return { factor, support: Math.round(1.2 * factor * 100) / 100, funds: Math.round(90 * factor) * 1000, volunteers: Math.round(40 * factor), organisation: factor >= 0.8 ? 2 : 1 };
}
export function scrutinyTrust(j: Pick<Journey, "streaks">) { return Math.max(1, Math.round(3 * fatigueFactor(j.streaks?.scrutiny))); }
/** Voters expect more from a popular government: very high trust erodes unless it is re-earned. */
export function expectationDrag(j: Pick<Journey, "chapter" | "trust">) { return j.chapter !== "government" ? 0 : j.trust >= 85 ? 3 : j.trust >= 75 ? 1 : 0; }
export function outcomeOf(s: GameState) { return s.journey.outcome ?? computeElectionOutcome(s.states, s.settings); }
export function coalitionPool(s: GameState) {
  const available = outcomeOf(s).othersSeats;
  const first = Math.ceil(available * .45), second = Math.floor(available * .35);
  return [
    { id: "borneo", seats: first, stability: 74, cost: 180000, ms: "Blok pembangunan wilayah", en: "Regional development bloc" },
    { id: "centrist", seats: second, stability: 68, cost: 120000, ms: "Blok reformasi", en: "Reform bloc" },
    { id: "regional", seats: available - first - second, stability: 61, cost: 90000, ms: "Wakil komuniti bebas", en: "Independent community bloc" },
  ].filter(p => p.seats > 0);
}
export function coalitionDealEffect(partner: ReturnType<typeof coalitionPool>[number], deal: CoalitionDeal) {
  if (deal === "portfolio") return { seats: partner.seats, cost: Math.round(partner.cost * .35), stability: 1, cabinetPenalty: 5 };
  if (deal === "confidence") return { seats: Math.max(1, Math.floor(partner.seats * .7)), cost: 0, stability: -10, cabinetPenalty: 0 };
  return { seats: partner.seats, cost: partner.cost, stability: 4, cabinetPenalty: 0 };
}
export function coalitionCabinetPenalty(s: GameState) {
  return coalitionPool(s).filter(p => s.journey.partners.includes(p.id)).reduce((sum, p) => sum + coalitionDealEffect(p, s.journey.coalitionTerms[p.id] ?? "development").cabinetPenalty, 0);
}
export function coalitionOpeningCost(s: GameState) {
  return coalitionPool(s).filter(p => s.journey.partners.includes(p.id)).reduce((sum, p) => sum + coalitionDealEffect(p, s.journey.coalitionTerms[p.id] ?? "development").cost, 0);
}
export function governingSeats(s: GameState): number {
  return outcomeOf(s).seatsWon + (s.journey.coalitionConfirmed ? coalitionPool(s).filter(p => s.journey.partners.includes(p.id)).reduce((n, p) => n + coalitionDealEffect(p, s.journey.coalitionTerms[p.id] ?? "development").seats, 0) : 0);
}
export function resumeRoute(s: { journey?: Journey; day: number; totalDays: number }): string {
  const chapter = s.journey?.chapter ?? "campaign";
  if (chapter === "campaign") return s.day >= s.totalDays ? "/results" : "/kawasan";
  if (chapter === "results" && !s.journey?.resultRecorded) return "/results";
  return ({ results: "/mandate", formation: "/cabinet", government: "/government", opposition: "/opposition", rebuilding: "/postmortem" })[chapter];
}
export function finishElection(s: GameState): Partial<GameState> {
  if (s.day < s.totalDays || s.journey.chapter !== "campaign") return {};
  const outcome = computeElectionOutcome(s.states, s.settings);
  const home = s.states.find(x => x.id === s.leader.homeState);
  const seat = home && generateConstituencies(home, s.settings.electionScope === "prn" ? "dun" : "parliament").find(x => x.id === s.leader.homeConstituencyId);
  const wonOwnSeat = !!seat && seat.mandat >= Math.max(seat.lawan, seat.others);
  return { hasWonElection: wonOwnSeat, journey: { ...s.journey, chapter: "results", characterStage: wonOwnSeat ? "representative" : "organiser", outcome, journal: journal(s.journey, wonOwnSeat ? "Anda dipilih sebagai wakil rakyat. Rekod khidmat kini menentukan pengaruh anda." : "Kekalahan tidak menamatkan perjalanan. Bina semula jentera dan kepercayaan di akar umbi.", wonOwnSeat ? "You are elected as a representative. Your service record now determines your influence." : "Defeat does not end the journey. Rebuild organisation and trust from the grassroots.") } };
}
export function shiftSupport(s: GameState, delta: number, homeOnly = false) {
  return s.states.map(x => {
    if ((homeOnly && x.id !== s.leader.homeState) || (s.settings.electionScope === "prn" && x.id !== s.settings.prnStateId)) return x;
    const support = Math.max(8, Math.min(82, x.mandatSupport + delta));
    const other = Math.min(x.othersSupport, 100 - support - 8);
    const updated = { ...x, mandatSupport: support, lawanSupport: 100 - support - other, othersSupport: other, trend: delta };
    const margin = support - updated.lawanSupport;
    return { ...updated, projectedSeats: generateConstituencies(updated, s.settings.electionScope === "prn" ? "dun" : "parliament").filter(seat => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length, winProbability: Math.max(5, Math.min(95, 50 + margin * 2)), status: margin >= 8 ? "winning" as const : margin <= -8 ? "losing" as const : "contested" as const };
  });
}

function applyManifestoSupport(s: GameState, manifestoId: ManifestoPackageId) {
  return s.states.map(state => {
    if (s.settings.electionScope === "prn" && state.id !== s.settings.prnStateId) return state;
    const delta = manifestoStateImpact(manifestoId, state);
    const mandatSupport = Math.max(8, Math.min(82, Math.round((state.mandatSupport + delta) * 100) / 100));
    const othersSupport = Math.max(4, Math.min(state.othersSupport, 100 - mandatSupport - 8));
    const lawanSupport = Math.round((100 - mandatSupport - othersSupport) * 100) / 100;
    const updated = { ...state, mandatSupport, lawanSupport, othersSupport, trend: delta };
    const margin = mandatSupport - lawanSupport;
    return {
      ...updated,
      projectedSeats: generateConstituencies(updated, s.settings.electionScope === "prn" ? "dun" : "parliament").filter(seat => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length,
      winProbability: Math.max(5, Math.min(95, Math.round((50 + margin * 2) * 100) / 100)),
      status: margin >= 8 ? "winning" as const : margin <= -8 ? "losing" as const : "contested" as const,
    };
  });
}
export type JourneyAction =
  | { type: "pledge"; issue: Issue }
  | { type: "fund"; issue: Issue }
  | { type: "campaign"; action: "visit" | "fundraise" | "organise" }
  | { type: "policy"; id: string }
  | { type: "term"; action: "branches" | "scrutiny" | "recruit" }
  | { type: "story"; storyId: string; choice: StoryChoice; character: string }
  | { type: "manifesto"; id: ManifestoPackageId }
  | { type: "prn-candidate"; id: PrnCandidateId }
  | { type: "quarter" }
  | { type: "next-election" };

export function reduceJourney(s: GameState, action: JourneyAction): Partial<GameState> {
  const j = s.journey;
  const campaign = j.chapter === "campaign" && s.day < s.totalDays;
  const term = ["government", "opposition", "rebuilding"].includes(j.chapter);
  if (term && s.careerProgress.month >= 60 && action.type !== "next-election") return {};
  const key = action.type === "campaign" || action.type === "term" ? action.action : action.type;
  const log = (ms: string, en: string, patch: Partial<Journey> = {}): Journey => ({ ...j, ...patch, journal: journal(j, ms, en) });
  if (action.type === "prn-candidate") {
    const candidate = getPrnCandidate(action.id);
    const target = s.states.find(state => state.id === s.settings.prnStateId);
    if (!campaign || s.settings.electionScope !== "prn" || !candidate || !target || j.prnCandidateId) return {};
    const impact = prnCandidateStateImpact(action.id, target);
    const mandatSupport = Math.max(8, Math.min(82, Math.round((target.mandatSupport + impact) * 100) / 100));
    const othersSupport = Math.max(4, Math.min(target.othersSupport, 100 - mandatSupport - 8));
    const lawanSupport = Math.round((100 - mandatSupport - othersSupport) * 100) / 100;
    const updatedTarget = { ...target, mandatSupport, lawanSupport, othersSupport, trend: impact };
    const margin = mandatSupport - lawanSupport;
    return {
      states: s.states.map(state => state.id === target.id ? {
        ...updatedTarget,
        projectedSeats: generateConstituencies(updatedTarget, "dun").filter(seat => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length,
        winProbability: Math.max(5, Math.min(95, Math.round((50 + margin * 2) * 100) / 100)),
        status: margin >= 8 ? "winning" as const : margin <= -8 ? "losing" as const : "contested" as const,
      } : state),
      journey: log(
        `${candidate.name} dinamakan calon ketua kerajaan ${target.name}. Kesan awal ${impact >= 0 ? "+" : ""}${impact.toFixed(2)} sokongan; jentera ${candidate.organisationDelta >= 0 ? "+" : ""}${candidate.organisationDelta}; kepercayaan ${candidate.trustDelta >= 0 ? "+" : ""}${candidate.trustDelta}.`,
        `${candidate.name} is nominated to lead the ${target.name} government. Opening effect ${impact >= 0 ? "+" : ""}${impact.toFixed(2)} support; organisation ${candidate.organisationDelta >= 0 ? "+" : ""}${candidate.organisationDelta}; trust ${candidate.trustDelta >= 0 ? "+" : ""}${candidate.trustDelta}.`,
        {
          prnCandidateId: action.id,
          prnCandidateHistory: [...j.prnCandidateHistory, { term: s.careerProgress.term, stateId: target.id, id: action.id }],
          organisation: Math.max(0, Math.min(100, j.organisation + candidate.organisationDelta)),
          trust: Math.max(0, Math.min(100, j.trust + candidate.trustDelta)),
        }
      ),
    };
  }
  if (action.type === "manifesto") {
    const manifesto = getManifestoPackage(action.id);
    if (!campaign || !manifesto || j.manifestoPackageId || j.decisions < 1 || s.resources.funds < manifesto.cost) return {};
    const scope = s.settings.electionScope === "prn" ? s.states.filter(state => state.id === s.settings.prnStateId) : s.states;
    const ranked = scope.map(state => ({ state, impact: manifestoStateImpact(action.id, state) })).sort((a, b) => b.impact - a.impact);
    const best = ranked[0], weakest = ranked[ranked.length - 1];
    const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
    return {
      states: applyManifestoSupport(s, action.id),
      resources: { ...s.resources, funds: s.resources.funds - manifesto.cost },
      journey: log(
        `Manifesto “${manifesto.title.ms}” dilancarkan. Kesan terkuat: ${best?.state.name ?? "—"} ${best ? signed(best.impact) : "—"}; risiko terbesar: ${weakest?.state.name ?? "—"} ${weakest ? signed(weakest.impact) : "—"}.`,
        `“${manifesto.title.en}” manifesto launched. Strongest effect: ${best?.state.name ?? "—"} ${best ? signed(best.impact) : "—"}; biggest risk: ${weakest?.state.name ?? "—"} ${weakest ? signed(weakest.impact) : "—"}.`,
        { decisions: j.decisions - 1, manifestoPackageId: action.id, manifestoHistory: [...j.manifestoHistory, { term: s.careerProgress.term, id: action.id }], organisation: Math.max(0, Math.min(100, j.organisation + manifesto.organisationDelta)) }
      ),
    };
  }
  if (action.type === "pledge") {
    if (!campaign || j.decisions < 1 || j.pledges.some(p => p.id === action.issue && p.status !== "delivered")) return {};
    return { states: shiftSupport(s, 1, true), journey: log("Janji diumumkan: sokongan tempatan +1. Pengundi akan menilai pelaksanaannya.", "Promise announced: local support +1. Voters will judge its delivery.", { decisions: j.decisions - 1, onboarded: true, pledges: [...j.pledges.filter(p => p.id !== action.issue), { id: action.issue, status: "promised", remaining: 0, term: s.careerProgress.term }] }) };
  }
  if (action.type === "campaign") {
    if (!campaign || j.decisions < 1 || j.actionsToday.includes(key)) return {};
    const costs = { visit: 25000, fundraise: 0, organise: 40000 };
    if (s.resources.funds < costs[action.action]) return {};
    const y = campaignActionYield(j, action.action);
    const tired = y.factor < 1 ? { ms: ` Kesan berulang ${Math.round(y.factor * 100)}% — tukar strategi esok.`, en: ` Repeat effect ${Math.round(y.factor * 100)}% — rotate tomorrow.` } : { ms: "", en: "" };
    return { states: action.action === "visit" ? shiftSupport(s, y.support, true) : s.states,
      resources: { ...s.resources, funds: s.resources.funds - costs[action.action] + (action.action === "fundraise" ? y.funds : 0), manpower: s.resources.manpower + (action.action === "organise" ? y.volunteers : 0) },
      journey: log((action.action === "visit" ? `Lawatan komuniti: sokongan tempatan +${y.support}.` : action.action === "fundraise" ? `Kutipan dana: dana kempen +RM${y.funds.toLocaleString()}.` : `Latihan jentera: ${y.volunteers} sukarelawan baharu.`) + tired.ms, (action.action === "visit" ? `Community visit: local support +${y.support}.` : action.action === "fundraise" ? `Fundraising: campaign funds +RM${y.funds.toLocaleString()}.` : `Organiser training: ${y.volunteers} new volunteers.`) + tired.en, { decisions: j.decisions - 1, actionsToday: [...j.actionsToday, key], organisation: Math.min(100, j.organisation + (action.action === "organise" ? y.organisation : 0)) }) };
  }
  if (action.type === "fund") {
    const pledge = j.pledges.find(p => p.id === action.issue && p.status === "promised");
    const cost = ISSUE_DATA[action.issue].cost;
    if (!term || j.chapter !== "government" || !pledge || j.publicBudget < cost) return {};
    return { journey: log("Projek dibiayai daripada bajet awam. Siap dalam dua suku tahun.", "Project funded from the public budget. Delivery in two quarters.", { publicBudget: j.publicBudget - cost, pledges: j.pledges.map(p => p === pledge ? { ...p, status: "funded", remaining: 2 } : p) }) };
  }
  if (action.type === "policy") {
    const policy = POLICY_DATA.find(p => p.id === action.id);
    if (!term || j.chapter !== "government" || !policy || j.policies.includes(policy.id) || j.publicBudget < policy.cost || j.termActions.length >= 2) return {};
    return { journey: log("Dasar diluluskan. Kesan akan dinilai pada akhir suku tahun.", "Policy approved. Its effects resolve at the end of this quarter.", { policies: [...j.policies, policy.id], publicBudget: j.publicBudget - policy.cost, termActions: [...j.termActions, `policy:${policy.id}`] }) };
  }
  if (action.type === "term") {
    if (!term || j.termActions.length >= 2 || j.termActions.includes(key)) return {};
    const cost = action.action === "scrutiny" ? 0 : 40000;
    if (s.resources.funds < cost) return {};
    return { resources: { ...s.resources, funds: s.resources.funds - cost }, journey: log("Usaha penggal direkodkan: kesannya dibawa ke pilihan raya seterusnya.", "Term work recorded: its effects carry into the next election.", { termActions: [...j.termActions, key], organisation: Math.min(100, j.organisation + (action.action === "branches" ? 6 : action.action === "recruit" ? 4 : 0)), trust: Math.min(100, j.trust + (action.action === "scrutiny" ? scrutinyTrust(j) : 1)) }) };
  }
  if (action.type === "story") {
    const story = CAREER_STORIES.find(item => item.id === action.storyId);
    const storyKey = `${story?.id}:${s.careerProgress.term}:${campaign ? `d${s.day}` : `m${s.careerProgress.month}`}`;
    const phaseAllowed = !!story && (campaign ? story.phases.includes("campaign") : story.phases.includes("term") || story.phases.includes(j.chapter === "government" ? "government" : "opposition"));
    const requirementMet = !story?.requires || (!!j.storyChoices[story.requires.storyId] && (!story.requires.choices || story.requires.choices.includes(j.storyChoices[story.requires.storyId])));
    if (!story || !phaseAllowed || !requirementMet || j.storyChoices[story.id] || j.storyResolved.includes(storyKey) || (campaign && j.decisions < 1) || (term && j.termActions.length >= 2)) return {};
    const effects = story.choices[action.choice].effects;
    const fundsChange = effects.funds ?? 0;
    if (s.resources.funds + fundsChange < 0) return {};
    const relationship = effects.relationship ?? 0;
    return {
      states: effects.localSupport ? shiftSupport(s, effects.localSupport, true) : s.states,
      resources: { ...s.resources, funds: s.resources.funds + fundsChange },
      journey: log(`${action.character}: keputusan “${story.choices[action.choice].ms}” mengubah kepercayaan ${effects.trust ?? 0}, kestabilan ${effects.stability ?? 0} dan hubungan ${relationship}.`, `${action.character}: “${story.choices[action.choice].en}” changes trust ${effects.trust ?? 0}, stability ${effects.stability ?? 0}, and relationship ${relationship}.`, {
        decisions: campaign ? j.decisions - 1 : j.decisions,
        termActions: term ? [...j.termActions, `story:${story.id}`] : j.termActions,
        storyResolved: [...j.storyResolved, storyKey],
        storyChoices: { ...j.storyChoices, [story.id]: action.choice },
        relationships: { ...j.relationships, [action.character]: Math.max(0, Math.min(100, (j.relationships[action.character] ?? 50) + relationship)) },
        organisation: Math.max(0, Math.min(100, j.organisation + (effects.organisation ?? 0))),
        stability: Math.max(0, Math.min(100, j.stability + (effects.stability ?? 0))),
        trust: Math.max(0, Math.min(100, j.trust + (effects.trust ?? 0))),
      }),
    };
  }
  if (action.type === "quarter") {
    if (!term || s.careerProgress.month >= 60) return {};
    const month = Math.min(60, s.careerProgress.month + 3);
    const delivered = j.pledges.filter(p => p.status === "funded" && p.remaining === 1).length;
    const completedWorks = j.construction.filter(p => p.remaining === 1);
    const cityZones = Object.fromEntries(Object.entries(j.cityZones).map(([seat, zones]) => [seat, zones.map(zone => {
      let next = { ...zone, projects: [...zone.projects] };
      for (const work of completedWorks.filter(w => w.seat === seat && w.zone === zone.id)) {
        next = { ...next, [work.target]: Math.min(100, next[work.target] + work.boost), projects: [...next.projects, work.project] };
      }
      next.sentiment = Math.round((next.infra + next.welfare + next.economy) / 3);
      return next;
    })]));
    const policies = POLICY_DATA.filter(p => j.termActions.includes(`policy:${p.id}`));
    const instability = j.stability < 40 ? 3 : 0;
    const effectiveCabinetQuality = j.cabinetQuality - coalitionCabinetPenalty(s);
    const appointedBonus = j.chapter === "government" ? (effectiveCabinetQuality >= 70 ? 1 : -1) : 0;
    const cabinetBalance = evaluateCabinet(j.appointments, j.ministerLoyalty, { isPrn: s.settings.electionScope === "prn", stateId: s.settings.prnStateId });
    const loyaltyStep = j.stability >= 65 ? 1 : j.stability < 45 ? -3 : 0;
    const ministerLoyalty = initialMinisterLoyalty(j.appointments, j.ministerLoyalty);
    if (j.chapter === "government") {
      for (const memberId of Object.values(j.appointments)) {
        if (memberId) ministerLoyalty[memberId] = Math.max(0, Math.min(100, (ministerLoyalty[memberId] ?? 50) + loyaltyStep));
      }
    }
    const defectors = j.chapter === "government" ? Array.from(new Set(Object.values(j.appointments).filter((memberId): memberId is string => {
      if (!memberId || (ministerLoyalty[memberId] ?? 100) > 25) return false;
      const member = PARTY_MEMBERS.find(candidate => candidate.id === memberId);
      return !!member && getMemberTraits(member).ambition >= 70;
    }))) : [];
    const appointments = defectors.length ? Object.fromEntries(Object.entries(j.appointments).map(([postId, memberId]) => [postId, memberId && defectors.includes(memberId) ? null : memberId])) : j.appointments;
    const defectionPenalty = defectors.length * 3;
    const relationshipPressure = Object.values(j.relationships).some(n => n < 35) ? 3 : 0;
    const representationTrust = j.chapter === "government" ? cabinetBalance.trustDelta : 0;
    const loyaltyStability = j.chapter === "government" ? cabinetBalance.stabilityDelta : 0;
    const expectations = expectationDrag(j);
    const trust = Math.max(0, Math.min(100, j.trust - expectations + delivered * 6 + completedWorks.length * 2 + policies.reduce((n, p) => n + p.trust, 0) + appointedBonus + representationTrust - instability - relationshipPressure - defectionPenalty));
    const defectorNames = defectors.map(id => PARTY_MEMBERS.find(member => member.id === id)?.name ?? id);
    return { careerProgress: { ...s.careerProgress, month, completed: Array.from(new Set([...s.careerProgress.completed, ...(delivered ? ["shadow-or-govern"] : []), ...(j.organisation >= 65 ? ["prk-machine"] : [])])) },
      journey: log(`Suku tahun selesai: ${delivered + completedWorks.length} projek siap. Kepercayaan ${j.trust} → ${trust}.${expectations ? ` Jangkaan rakyat meningkat (−${expectations}).` : ""}${defectorNames.length ? ` ${defectorNames.join(", ")} meninggalkan pentadbiran.` : ""}`, `Quarter complete: ${delivered + completedWorks.length} projects delivered. Trust ${j.trust} → ${trust}.${expectations ? ` Public expectations rise (−${expectations}).` : ""}${defectorNames.length ? ` ${defectorNames.join(", ")} left the administration.` : ""}`, { trust, cityZones, appointments, ministerLoyalty, ministerIncidents: [...j.ministerIncidents, ...defectorNames.map(name => `defection:${s.careerProgress.term}:${month}:${name}`)], construction: j.construction.filter(w => w.remaining > 1).map(w => ({ ...w, remaining: w.remaining - 1 })), publicBudget: j.publicBudget + (j.chapter === "government" ? 100000 : 0), streaks: rollStreaks(j.streaks, j.termActions, TERM_REPEATABLES), stability: Math.max(0, Math.min(100, j.stability + policies.reduce((n, p) => n + p.stability, 0) + loyaltyStability - relationshipPressure - defectors.length * 5)), termActions: [], pledges: j.pledges.map(p => p.status === "funded" ? { ...p, remaining: p.remaining - 1, status: p.remaining <= 1 ? "delivered" : "funded" } : p) }) };
  }
  if (action.type === "next-election") {
    if (!term || s.careerProgress.month < 60) return {};
    const delivered = j.pledges.filter(p => p.status === "delivered" && p.term === s.careerProgress.term).length;
    const broken = j.pledges.filter(p => p.status !== "delivered").length;
    const record = Math.max(-10, Math.min(10, (j.trust - 50) / 10 + (j.organisation - 40) / 15 + delivered * 1.5 - broken * (j.chapter === "government" ? 2 : .5)));
  return { phase: "playing", day: 1, hasWonElection: false, dailyChallengeDate: null, operations: [], lastEvent: null, opponentLog: [], politicalReactions: [], aiNews: [], alerts: [], states: shiftSupport(s, record), resources: { ...s.resources, funds: s.settings.startingFund, manpower: 400 + j.organisation * 4, mediaBuy: 540 }, careerProgress: { completed: [], month: 1, term: s.careerProgress.term + 1 }, governmentProgress: { activePolicies: [], crisisIndex: 0, crisisDeltas: { approval: 0, stability: 0, trust: 0 } }, journey: log(`Pilihan raya baharu: rekod penggal mengubah sokongan ${record.toFixed(1)} mata. ${broken} janji belum selesai.`, `New election: your term record changes support by ${record.toFixed(1)} points. ${broken} commitments remain unfinished.`, { chapter: "campaign", characterStage: s.careerProgress.term >= 2 ? "legacy" : "candidate", decisions: 3, actionsToday: [], partners: [], coalitionTerms: {}, coalitionConfirmed: false, outcome: null, appointments: {}, policies: [], termActions: [], manifestoPackageId: null, resultRecorded: false, records: [...j.records, buildTermReport(s)], publicBudget: 0, streaks: {} }) };
  }
  return {};
}
