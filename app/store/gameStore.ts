"use client";
import { newJourney, finishElection, reduceJourney, governingSeats, coalitionPool, coalitionDealEffect, coalitionOpeningCost, outcomeOf, journal, shiftSupport, type Journey, type JourneyAction, type Chapter, type CoalitionDeal, type PersonalOfficeId, type Issue, type LeadershipApproach } from "./journey";
import { create } from "zustand";
import { StateData, states as initialStates } from "../data/states";
import { processDay } from "./electionEngine";
import type { GameEvent } from "../data/events";
import { TOTAL_ELECTION_DAYS } from "../data/electionFlow";
import type { DatasetKind } from "../data/datasets";
import type { OpponentAction } from "./opponentAI";
import type { PoliticalReaction } from "../data/politicalReactions";
import { buildCampaignActionReaction, buildCampaignEventReaction, buildNominationReaction } from "../data/politicalReactions";
import type { LiveNewsItem } from "../data/liveNews";
import { calculateCampaignGain, getCampaignBaseGain, campaignCost } from "./campaignMath";
import { generateConstituencies } from "../data/constituencies";
import { findPrnIssue, prnIssueActionKey, prnIssueBonus } from "../data/prnIssues";
import { getManifestoPackage, manifestoCampaignBonus } from "../data/manifestoPackages";
import { getCampaignEvent, getCampaignTone, isCampaignEventUnlocked, previewCampaignEvent, type CampaignEventId, type CampaignToneId } from "../data/campaignEvents";
import { getPrnCandidate, prnCandidateChannelBonus } from "../data/prnCandidates";
import { applyScenarioState, getScenarioPack, type ScenarioPackId } from "../data/scenarioPacks";

export type NominationEntry =
  | { type: "member"; memberId: string; memberName: string; memberRole: string }
  | { type: "leader" }
  | { type: "none" };

export interface LeaderProfile {
  name: string;
  position: string;
  party: string;
  partyAbbr: string;
  partyColor: string;
  avatarIndex: number;
  influence: number;
  charisma: number;
  credibility: number;
  negotiation: number;
  strategy: number;
  experience: "veteran" | "moderate" | "rookie";
  homeState: string;
  homeConstituencyId: string;
  homeConstituencyName: string;
  ideology: { economic: number; social: number };
  manifesto: string;
}

export interface Resources {
  funds: number;
  manpower: number;
  vehicles: number;
  materials: number;
  mediaBuy: number;
}

export interface Operation {
  id: string;
  name: string;
  type: "door-to-door" | "ceramah" | "youth" | "digital" | "rural";
  location: string;
  stateIds: string[];
  status: "active" | "ongoing" | "planned" | "completed";
  manpowerCost: number;
  fundsCost: number;
  supportGain: number;
}

export interface CareerProgress {
  completed: string[];
  term: number;
  month: number;
}

export interface GovernmentProgress {
  activePolicies: string[];
  crisisIndex: number;
  crisisDeltas: { approval: number; stability: number; trust: number };
}

export interface SandboxProgress {
  activeLevers: string[];
  simulationTick: number;
}

export interface GameState {
  journey: Journey;
  journeyAction: (action: JourneyAction) => void;
  runLocationActivity: (location: string, action: "prepare" | "commit") => void;
  finishElection: () => void;
  confirmCoalition: (partners: string[], terms?: Record<string, CoalitionDeal>) => void;
  enterTerm: (chapter: Chapter) => void;
  phase: "menu" | "setup" | "playing" | "ended";
  dataset: DatasetKind;
  nominations: Record<string, NominationEntry | null>;
  day: number;
  totalDays: number;
  leader: LeaderProfile;
  resources: Resources;
  states: StateData[];
  operations: Operation[];
  alerts: { id: string; time: string; message: string; type: string }[];
  lastEvent: GameEvent | null;
  selectedStateId: string | null;
  difficulty: "easy" | "normal" | "hard" | "nightmare";
  mediaSentiment: "positive" | "neutral" | "negative";
  nationalSupportDelta: number;
  opponentLog: OpponentAction[];
  politicalReactions: PoliticalReaction[];
  // AI-generated daily news headlines (see app/api/news/route.ts) — kept
  // separate from politicalReactions because that type requires opponent-
  // attack/social-reaction/advisor-warning detail fields this content
  // doesn't have; these are plain LiveNewsItem-shaped like the static
  // liveNewsByDay pool, just freshly written per day.
  aiNews: LiveNewsItem[];
  // True once the player's own seat (leader.homeConstituencyId) has been
  // won under whichever electionScope they played (pru or prn) — set from
  // /elected, which only ever renders on that exact win. Gates the
  // /kawasan develop system. Resets with the rest of the run in
  // resetGame(), and is per-save (see saveGame.ts SavedGameSnapshot), not
  // a global one-time unlock — a new campaign starts locked again.
  hasWonElection: boolean;
  // Set only when the run was launched via /menu's "Daily Challenge" —
  // the dateKey (YYYY-MM-DD, player's local calendar day) it was seeded
  // from. Lets /results brand the run distinctly and label the share
  // card so players compare "today's" run specifically, without needing
  // a real backend leaderboard (see GAME_DESIGN_DOCUMENT.md section 10 —
  // sharing is the informal comparison mechanism here).
  dailyChallengeDate: string | null;
  // Career/Government/Sandbox meta-game progress — previously page-local
  // useState with no connection to the store at all, so it reset on every
  // navigate-away-and-back and was absent from SavedGameSnapshot entirely
  // (see saveGame.ts). Living here means it survives route changes within
  // a session and gets captured/restored by the normal save-slot flow like
  // every other run-scoped field. (Kawasan's zone/project progress already
  // has its own localStorage persistence keyed per home seat — see
  // /kawasan's storageKey — so it's intentionally not duplicated here.)
  careerProgress: CareerProgress;
  governmentProgress: GovernmentProgress;
  sandboxProgress: SandboxProgress;
  settings: {
    campaignLength: "full" | "short" | "custom";
    electionScope: "pru" | "prn";
    prnStateId: string;
    difficulty: "easy" | "normal" | "hard" | "nightmare";
    startingFund: number;
    oppositionStrength: number;
    mediaBias: "pro" | "balanced" | "hostile";
    realisticPolls: boolean;
    eventRandomness: boolean;
    permanentConsequences: boolean;
  };

  // Actions
  setHasWonElection: (won: boolean) => void;
  setPersonalOffice: (office: PersonalOfficeId) => void;
  completeCharacterPrologue: (issue: Issue, approach: LeadershipApproach) => void;
  setDailyChallengeDate: (dateKey: string | null) => void;
  setCareerProgress: (patch: Partial<CareerProgress>) => void;
  setGovernmentProgress: (patch: Partial<GovernmentProgress>) => void;
  setSandboxProgress: (patch: Partial<SandboxProgress>) => void;
  applyScenarioPack: (id: ScenarioPackId) => void;
  setPhase: (phase: GameState["phase"]) => void;
  setDataset: (dataset: DatasetKind) => void;
  setNomination: (constituencyId: string, entry: NominationEntry | null) => void;
  setLeader: (leader: Partial<LeaderProfile>) => void;
  setSelectedState: (id: string | null) => void;
  advanceDay: () => void;
  updateSettings: (settings: Partial<GameState["settings"]>) => void;
  startCampaign: () => void;
  addOperation: (op: Operation) => void;
  removeOperation: (id: string) => void;
  runNominationDecision: (stateId: string, candidateType: "local" | "technocrat" | "firebrand") => void;
  runCampaignMiniGame: (stateId: string, gameType: "ceramah" | "social", tactic: "safe" | "balanced" | "aggressive", issueId?: string) => void;
  runCampaignEvent: (eventId: CampaignEventId, toneId: CampaignToneId) => void;
  addPoliticalReaction: (reaction: PoliticalReaction) => void;
  addAiNewsReaction: (item: LiveNewsItem) => void;
  applyCandidateFallout: (stateId: string, reaction: PoliticalReaction, lawanBoost: number, othersBoost: number) => void;
  clearLastEvent: () => void;
  getTotalProjectedSeats: () => number;
  getNationalSupport: () => { mandat: number; lawan: number; others: number };
  resetGame: () => void;
}

const defaultHomeState = initialStates.find((s) => s.id === "selangor") ?? initialStates[0];
const defaultHomeConstituency = generateConstituencies(defaultHomeState)[0];

const defaultLeader: LeaderProfile = {
  name: "ALI RAHMAN",
  position: "PRESIDENT",
  party: "PARTI MANDAT MY",
  partyAbbr: "MANDAT",
  partyColor: "var(--cyan)",
  avatarIndex: 0,
  influence: 85,
  charisma: 72,
  credibility: 91,
  negotiation: 88,
  strategy: 84,
  experience: "veteran",
  homeState: "selangor",
  homeConstituencyId: defaultHomeConstituency.id,
  homeConstituencyName: defaultHomeConstituency.name,
  ideology: { economic: 45, social: 40 },
  manifesto: "",
};

const POLITICAL_REACTIONS_KEY = "mymandat-political-reactions";

function persistPoliticalReactions(reactions: PoliticalReaction[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(POLITICAL_REACTIONS_KEY, JSON.stringify(reactions.slice(0, 30)));
  }
}

export function readPersistedPoliticalReactions(): PoliticalReaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(POLITICAL_REACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 30) as PoliticalReaction[] : [];
  } catch {
    localStorage.removeItem(POLITICAL_REACTIONS_KEY);
    return [];
  }
}

const AI_NEWS_KEY = "mymandat-ai-news";

function persistAiNews(items: LiveNewsItem[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(AI_NEWS_KEY, JSON.stringify(items.slice(0, 20)));
  }
}

export function readPersistedAiNews(): LiveNewsItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_NEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) as LiveNewsItem[] : [];
  } catch {
    localStorage.removeItem(AI_NEWS_KEY);
    return [];
  }
}

const defaultOperations: Operation[] = [
  { id: "op1", name: "DOOR TO DOOR", type: "door-to-door", location: "Selangor · Johor", stateIds: ["selangor", "johor"], status: "active", manpowerCost: 120, fundsCost: 50000, supportGain: 1.5 },
  { id: "op2", name: "CERAMAH MEGA", type: "ceramah", location: "Pahang (6 events)", stateIds: ["pahang"], status: "active", manpowerCost: 80, fundsCost: 120000, supportGain: 2.2 },
  { id: "op3", name: "YOUTH OUTREACH", type: "youth", location: "Klang Valley", stateIds: ["selangor", "wp"], status: "active", manpowerCost: 60, fundsCost: 40000, supportGain: 1.8 },
  { id: "op4", name: "RURAL ENGAGEMENT", type: "rural", location: "Perak · Kedah", stateIds: ["perak", "kedah"], status: "ongoing", manpowerCost: 100, fundsCost: 80000, supportGain: 1.2 },
  { id: "op5", name: "DIGITAL CAMPAIGN", type: "digital", location: "Nationwide", stateIds: ["selangor", "wp", "johor", "penang"], status: "planned", manpowerCost: 30, fundsCost: 200000, supportGain: 1.0 },
];

export const useGameStore = create<GameState>((set, get) => ({
  journey: newJourney(),
  phase: "menu",
  dataset: "dummy",
  nominations: {},
  day: 1,
  totalDays: TOTAL_ELECTION_DAYS,
  leader: defaultLeader,
  resources: {
    funds: 2300000,
    manpower: 632,
    vehicles: 312,
    materials: 680,
    mediaBuy: 540,
  },
  states: initialStates,
  operations: defaultOperations,
  alerts: [],
  lastEvent: null,
  selectedStateId: null,
  difficulty: "normal",
  mediaSentiment: "neutral",
  nationalSupportDelta: 0,
  opponentLog: [],
  politicalReactions: [],
  aiNews: [],
  hasWonElection: false,
  dailyChallengeDate: null,
  careerProgress: { completed: [], term: 1, month: 1 },
  governmentProgress: { activePolicies: ["cost", "antiCorruption"], crisisIndex: 0, crisisDeltas: { approval: 0, stability: 0, trust: 0 } },
  sandboxProgress: { activeLevers: ["ma63", "antiCorruption", "foreignInvestment"], simulationTick: 1 },
  settings: {
    campaignLength: "full",
    electionScope: "pru",
    prnStateId: "selangor",
    difficulty: "normal",
    startingFund: 2300000,
    oppositionStrength: 60,
    mediaBias: "balanced",
    realisticPolls: true,
    eventRandomness: true,
    permanentConsequences: true,
  },

  journeyAction: (action) => set((state) => reduceJourney(state, action)),
  runLocationActivity: (location, action) => set((state) => {
    const campaign = state.journey.chapter === "campaign" && state.day < state.totalDays;
    const term = ["government", "opposition", "rebuilding"].includes(state.journey.chapter);
    const key = `location:${location}:${action}`;
    if ((!campaign && !term) || state.journey.actionsToday.includes(key) || state.journey.termActions.includes(key)) return {};

    const campaignEffects: Record<string, { prepare: { funds: number; manpower: number; organisation: number; trust: number; support: number; media?: "positive" | "neutral" | "negative" }; commit: { funds: number; manpower: number; organisation: number; trust: number; support: number; media?: "positive" | "neutral" | "negative" } }> = {
      office: { prepare: { funds: 10000, manpower: 0, organisation: 2, trust: 1, support: 0 }, commit: { funds: 25000, manpower: -5, organisation: 0, trust: 1, support: .8 } },
      party: { prepare: { funds: 20000, manpower: 0, organisation: 4, trust: 0, support: 0 }, commit: { funds: 15000, manpower: 0, organisation: 1, trust: 2, support: .6 } },
      operations: { prepare: { funds: 30000, manpower: -20, organisation: 2, trust: 0, support: 0 }, commit: { funds: 35000, manpower: -40, organisation: 1, trust: 0, support: 1 } },
      calendar: { prepare: { funds: 10000, manpower: 0, organisation: 2, trust: 0, support: 0 }, commit: { funds: 25000, manpower: -10, organisation: 0, trust: 1, support: 1.2 } },
      media: { prepare: { funds: 15000, manpower: 0, organisation: 0, trust: 1, support: 0, media: "positive" }, commit: { funds: 20000, manpower: -5, organisation: 0, trust: 1, support: .8, media: "positive" } },
      commission: { prepare: { funds: 5000, manpower: 0, organisation: 0, trust: 1, support: 0 }, commit: { funds: 12000, manpower: 0, organisation: 1, trust: 1, support: .5 } },
      cabinet: { prepare: { funds: 15000, manpower: 0, organisation: 1, trust: 2, support: 0 }, commit: { funds: 30000, manpower: -10, organisation: 0, trust: 3, support: .4 } },
      administration: { prepare: { funds: 10000, manpower: 0, organisation: 1, trust: 2, support: 0 }, commit: { funds: 25000, manpower: -10, organisation: 0, trust: 3, support: .5 } },
      national: { prepare: { funds: 10000, manpower: 0, organisation: 2, trust: 1, support: 0 }, commit: { funds: 18000, manpower: -5, organisation: 1, trust: 1, support: .6 } },
    };
    const effect = campaignEffects[location]?.[action] ?? campaignEffects.party[action];
    if (campaign) {
      if (state.journey.decisions < 1 || state.resources.funds < effect.funds || state.resources.manpower + effect.manpower < 0) return {};
      const verb = action === "prepare" ? "Persediaan" : "Tindakan";
      return {
        states: effect.support ? shiftSupport(state, effect.support, true) : state.states,
        resources: { ...state.resources, funds: state.resources.funds - effect.funds, manpower: state.resources.manpower + effect.manpower },
        mediaSentiment: effect.media ?? state.mediaSentiment,
        journey: {
          ...state.journey,
          decisions: state.journey.decisions - 1,
          actionsToday: [...state.journey.actionsToday, key],
          organisation: Math.max(0, Math.min(100, state.journey.organisation + effect.organisation)),
          trust: Math.max(0, Math.min(100, state.journey.trust + effect.trust)),
          journal: journal(state.journey,
            `${verb} di ${location} selesai: dana -RM${effect.funds.toLocaleString()}, sokongan ${effect.support >= 0 ? "+" : ""}${effect.support.toFixed(1)}, kepercayaan ${effect.trust >= 0 ? "+" : ""}${effect.trust}.`,
            `${verb} at ${location} completed: funds -RM${effect.funds.toLocaleString()}, support ${effect.support >= 0 ? "+" : ""}${effect.support.toFixed(1)}, trust ${effect.trust >= 0 ? "+" : ""}${effect.trust}.`),
        },
      };
    }

    if (state.journey.termActions.length >= 2) return {};
    const publicCost = action === "commit" ? 50000 : 20000;
    if (state.journey.chapter === "government" && state.journey.publicBudget < publicCost) return {};
    return {
      journey: {
        ...state.journey,
        publicBudget: state.journey.chapter === "government" ? state.journey.publicBudget - publicCost : state.journey.publicBudget,
        termActions: [...state.journey.termActions, key],
        trust: Math.min(100, state.journey.trust + (action === "commit" ? 3 : 1)),
        stability: Math.min(100, state.journey.stability + (action === "commit" ? 2 : 1)),
        journal: journal(state.journey,
          `${action === "prepare" ? "Semakan" : "Keputusan"} ${location} direkodkan untuk penggal ini.`,
          `${action === "prepare" ? "Review" : "Decision"} at ${location} has been recorded for this term.`),
      },
    };
  }),
  finishElection: () => set((state) => finishElection(state)),
  confirmCoalition: (partners, terms = {}) => set((state) => {
    if (state.day < state.totalDays || !["results", "formation"].includes(state.journey.chapter)) return {};
    const valid = coalitionPool(state).filter(p => partners.includes(p.id));
    const coalitionTerms = Object.fromEntries(valid.map(p => [p.id, terms[p.id] ?? "development"])) as Record<string, CoalitionDeal>;
    if (outcomeOf(state).seatsWon + valid.reduce((n, p) => n + coalitionDealEffect(p, coalitionTerms[p.id]).seats, 0) < outcomeOf(state).majorityTarget) return {};
    return { journey: { ...state.journey, partners: valid.map(p => p.id), coalitionTerms, coalitionConfirmed: true, chapter: "formation", journal: journal(state.journey, "Perjanjian gabungan disahkan. Jenis sokongan menentukan kos, kestabilan dan kebebasan membentuk kabinet.", "Coalition agreement confirmed. Each deal now determines its cost, stability, and cabinet constraint.") } };
  }),
  enterTerm: (chapter) => set((state) => {
    if (state.day < state.totalDays || !["results", "formation"].includes(state.journey.chapter)) return {};
    if (!["government", "opposition", "rebuilding"].includes(chapter)) return {};
    if (chapter === "government" && (!state.journey.coalitionConfirmed || !Object.values(state.journey.appointments).some(Boolean) || governingSeats(state) < outcomeOf(state).majorityTarget)) return {};
    const partners = coalitionPool(state).filter(p => state.journey.partners.includes(p.id));
    const stability = partners.length ? Math.max(25, Math.min(85, Math.round(partners.reduce((sum, p) => sum + p.stability + coalitionDealEffect(p, state.journey.coalitionTerms[p.id] ?? "development").stability, 0) / partners.length))) : 72;
    return { journey: { ...state.journey, chapter, characterStage: chapter === "government" ? "nationalLeader" : "partyLeader", publicBudget: chapter === "government" ? 900000 - coalitionOpeningCost(state) : 0, stability: chapter === "government" ? stability : state.journey.stability, journal: journal(state.journey, "Penggal bermula. Tunaikan janji atau bina gerakan kembali.", "Your term begins. Deliver your promises or build a comeback.") } };
  }),
  setHasWonElection: (won) => set({ hasWonElection: won }),
  setPersonalOffice: (office) => set((state) => {
    const trustBonus = office === "community" ? 5 : office === "city" ? 1 : 0;
    const organisationBonus = office === "digital" ? 5 : office === "city" ? 3 : 0;
    return {
      journey: {
        ...state.journey,
        personalOffice: office,
        trust: Math.min(100, state.journey.trust + trustBonus),
        organisation: Math.min(100, state.journey.organisation + organisationBonus),
        journal: journal(state.journey, "Pejabat peribadi dipilih. Di sinilah kerjaya politik anda bermula.", "Personal office selected. Your political career starts here."),
      },
    };
  }),
  completeCharacterPrologue: (issue, approach) => set((state) => {
    if (!state.journey.personalOffice || state.journey.originIssue) return {};
    const trustBonus = approach === "service" ? 4 : approach === "bridge" ? 2 : 1;
    const organisationBonus = approach === "digital" ? 5 : approach === "bridge" ? 3 : 1;
    return {
      journey: {
        ...state.journey,
        scenario: issue,
        originIssue: issue,
        leadershipApproach: approach,
        characterStage: "candidate",
        trust: Math.min(100, state.journey.trust + trustBonus),
        organisation: Math.min(100, state.journey.organisation + organisationBonus),
        journal: journal(state.journey, `Langkah akar umbi bermula dengan isu ${issue}. Gaya kepimpinan anda kini membentuk reputasi awal.`, `Your grassroots journey begins with the ${issue} issue. Your leadership approach now shapes your early reputation.`),
      },
    };
  }),
  setDailyChallengeDate: (dateKey) => set({ dailyChallengeDate: dateKey }),
  setCareerProgress: (patch) => set((state) => ({ careerProgress: { ...state.careerProgress, ...patch } })),
  setGovernmentProgress: (patch) => set((state) => ({ governmentProgress: { ...state.governmentProgress, ...patch } })),
  setSandboxProgress: (patch) => set((state) => ({ sandboxProgress: { ...state.sandboxProgress, ...patch } })),
  applyScenarioPack: (id) => set((state) => {
    const pack = getScenarioPack(id);
    if (!pack) return {};
    const settings = {
      ...state.settings,
      campaignLength: "full" as const,
      electionScope: pack.scope,
      prnStateId: pack.scope === "prn" ? pack.stateId : state.settings.prnStateId,
      difficulty: pack.difficulty,
      startingFund: pack.funds,
      oppositionStrength: pack.oppositionStrength,
      mediaBias: pack.mediaBias,
    };
    if (typeof window !== "undefined") localStorage.setItem("mymandat-game-settings", JSON.stringify(settings));
    return {
      settings,
      difficulty: pack.difficulty,
      selectedStateId: pack.scope === "prn" ? pack.stateId : null,
      operations: [],
      states: applyScenarioState(state.states, pack),
      resources: { ...state.resources, funds: pack.funds, manpower: pack.manpower, mediaBuy: pack.mediaBuy },
      journey: {
        ...state.journey,
        scenario: pack.issue,
        scenarioPackId: pack.id,
        scenarioPackTerm: state.careerProgress.term,
        trust: pack.trust,
        organisation: pack.organisation,
        journal: journal(state.journey, `Senario “${pack.title.ms}” bermula. Tiga objektif khas kini aktif.`, `“${pack.title.en}” scenario started. Three special objectives are now active.`),
      },
      alerts: [{ id: `scenario-${pack.id}`, time: "00:00", message: `${pack.year} SCENARIO: ${pack.title.en} · ${pack.scope.toUpperCase()} · ${pack.difficulty.toUpperCase()}`, type: "warning" }],
    };
  }),

  setPhase: (phase) => set({ phase }),

  setDataset: (dataset) => set({ dataset }),

  setNomination: (constituencyId, entry) =>
    set((state) => {
      const next = { ...state.nominations };
      if (entry === null) {
        delete next[constituencyId];
      } else {
        next[constituencyId] = entry;
      }
      const reaction = entry?.type === "member"
        ? buildNominationReaction({
            day: state.day,
            constituencyId,
            stateId: constituencyId.split("-")[0],
            candidateName: entry.memberName,
            candidateRole: entry.memberRole,
            influenceScope: /presiden|naib|setiausaha|strategi/i.test(entry.memberRole) ? "national" : /negeri|wilayah/i.test(entry.memberRole) ? "state" : "local",
            partyAbbr: state.leader.partyAbbr,
          })
        : null;
      const politicalReactions = reaction ? [reaction, ...state.politicalReactions].slice(0, 30) : state.politicalReactions;
      persistPoliticalReactions(politicalReactions);
      return {
        nominations: next,
        politicalReactions,
      };
    }),

  setLeader: (updates) =>
    set((state) => ({ leader: { ...state.leader, ...updates } })),

  setSelectedState: (id) => set({ selectedStateId: id }),

  advanceDay: () =>
    set((gameState) => {
      if (gameState.day >= gameState.totalDays || gameState.journey.chapter !== "campaign") return {};
      const result = processDay(gameState);
      const updatedStates = gameState.states.map((s) => {
        const u = result.stateUpdates.find((x) => x.id === s.id);
        return u ? { ...s, ...u } : s;
      });
      const maxAlerts = 12;
      const combinedAlerts = [...result.newAlerts, ...gameState.alerts].slice(0, maxAlerts);

      const scopedStates = gameState.settings.electionScope === "prn"
        ? gameState.states.filter((s) => s.id === gameState.settings.prnStateId)
        : gameState.states;
      const seatBasis = scopedStates.length ? scopedStates : gameState.states;
      const totalSeats = seatBasis.reduce((sum, s) => sum + s.seats, 0);
      const weightedDelta = result.stateUpdates.reduce((sum, u) => {
        const weight = (seatBasis.find((s) => s.id === u.id)?.seats ?? 1) / totalSeats;
        return sum + u.trend * weight;
      }, 0);
      const delta = Math.round(weightedDelta * 10) / 10;
      const newSentiment: GameState["mediaSentiment"] =
        delta > 0.4 ? "positive" : delta < -0.4 ? "negative" : "neutral";

      return {
        day: gameState.day + 1,
        journey: { ...gameState.journey, decisions: 3, actionsToday: [], journal: journal(gameState.journey, `Hari ${gameState.day + 1}: perubahan sokongan ${delta.toFixed(1)} mata selepas operasi, peristiwa dan tindak balas lawan.`, `Day ${gameState.day + 1}: support changed ${delta.toFixed(1)} points after operations, events and opponent responses.`) },
        states: updatedStates,
        resources: { ...gameState.resources, ...result.resourceUpdates },
        alerts: combinedAlerts,
        lastEvent: result.triggeredEvent,
        mediaSentiment: newSentiment,
        nationalSupportDelta: delta,
        opponentLog: [...result.opponentActions, ...gameState.opponentLog].slice(0, 24),
      };
    }),

  updateSettings: (updates) =>
    set((state) => {
      const settings = { ...state.settings, ...updates };
      if (typeof window !== "undefined") {
        localStorage.setItem("mymandat-game-settings", JSON.stringify(settings));
      }
      // Keep the top-level `difficulty` field (read by electionEngine's opponent AI
      // and every difficulty display across cabinet/career/government/sandbox/results)
      // in sync with settings.difficulty — this is the only place either one changes.
      return updates.difficulty ? { settings, difficulty: updates.difficulty } : { settings };
    }),

  startCampaign: () => set({ phase: "playing" }),

  resetGame: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(POLITICAL_REACTIONS_KEY);
      localStorage.removeItem(AI_NEWS_KEY);
    }
    const prologue = get().journey;
    const freshJourney = newJourney();
    const retainedJourney = prologue.personalOffice && prologue.originIssue && prologue.leadershipApproach
      ? {
          ...freshJourney,
          personalOffice: prologue.personalOffice,
          originIssue: prologue.originIssue,
          leadershipApproach: prologue.leadershipApproach,
          characterStage: "candidate" as const,
          scenario: prologue.originIssue,
          trust: prologue.trust,
          organisation: prologue.organisation,
          journal: journal(freshJourney, "Asas kerjaya anda dibawa ke kempen baharu.", "Your career foundation carries into the new campaign."),
        }
      : freshJourney;
    return set({
      journey: retainedJourney,
      phase: "menu",
      dataset: "dummy",
      nominations: {},
      day: 1,
      totalDays: TOTAL_ELECTION_DAYS,
      leader: defaultLeader,
      states: initialStates,
      alerts: [],
      lastEvent: null,
      selectedStateId: null,
      operations: defaultOperations,
      resources: { funds: 2300000, manpower: 632, vehicles: 312, materials: 680, mediaBuy: 540 },
      difficulty: "normal",
      mediaSentiment: "neutral",
      nationalSupportDelta: 0,
      opponentLog: [],
      politicalReactions: [],
      aiNews: [],
      hasWonElection: false,
      dailyChallengeDate: null,
      careerProgress: { completed: [], term: 1, month: 1 },
      governmentProgress: { activePolicies: ["cost", "antiCorruption"], crisisIndex: 0, crisisDeltas: { approval: 0, stability: 0, trust: 0 } },
      sandboxProgress: { activeLevers: ["ma63", "antiCorruption", "foreignInvestment"], simulationTick: 1 },
      settings: {
        campaignLength: "full",
        electionScope: "pru",
        prnStateId: "selangor",
        difficulty: "normal",
        startingFund: 2300000,
        oppositionStrength: 60,
        mediaBias: "balanced",
        realisticPolls: true,
        eventRandomness: true,
        permanentConsequences: true,
      },
    });
  },

  addOperation: (op) =>
    set((state) => state.journey.chapter === "campaign" && state.day < state.totalDays && state.journey.decisions > 0 ? { operations: [...state.operations, op], journey: { ...state.journey, decisions: state.journey.decisions - 1 } } : {}),

  removeOperation: (id) =>
    set((state) => ({ operations: state.operations.filter((op) => op.id !== id) })),

  runNominationDecision: (stateId, candidateType) =>
    set((state) => {
      const profile = {
        local: { support: 1.8, win: 4, funds: 35_000, manpower: 18, label: "LOCAL CHAMPION" },
        technocrat: { support: 1.2, win: 6, funds: 55_000, manpower: 8, label: "TECHNOCRAT" },
        firebrand: { support: 2.6, win: 2, funds: 25_000, manpower: 28, label: "FIREBRAND" },
      }[candidateType];
      const ts = new Date().toTimeString().slice(0, 5);

      return {
        states: state.states.map((s) => {
          if (s.id !== stateId) return s;
          const mandatSupport = Math.min(82, Math.round((s.mandatSupport + profile.support) * 100) / 100);
          const lawanSupport = Math.max(8, Math.round((s.lawanSupport - profile.support * 0.55) * 100) / 100);
          const othersSupport = Math.max(4, Math.round((100 - mandatSupport - lawanSupport) * 100) / 100);
          const margin = mandatSupport - lawanSupport;
          return {
            ...s,
            mandatSupport,
            lawanSupport,
            othersSupport,
            winProbability: Math.min(95, Math.round((s.winProbability + profile.win) * 100) / 100),
            projectedSeats: Math.max(0, Math.min(s.seats, s.projectedSeats + (margin > 5 ? 1 : 0))),
            status: margin >= 8 ? "winning" : margin <= -8 ? "losing" : "contested",
            trend: Math.round(profile.support * 100) / 100,
          };
        }),
        resources: {
          ...state.resources,
          funds: Math.max(0, state.resources.funds - profile.funds),
          manpower: Math.max(0, state.resources.manpower - profile.manpower),
        },
        alerts: [{
          id: `nom-${Date.now()}`,
          time: ts,
          message: `Nomination confirmed: ${profile.label} candidate deployed in ${stateId.toUpperCase()} (+${profile.support}% support).`,
          type: "positive",
        }, ...state.alerts].slice(0, 12),
      };
    }),

  runCampaignMiniGame: (stateId, gameType, tactic, issueId) =>
    set((state) => {
      if (state.journey.chapter !== "campaign" || state.day >= state.totalDays || state.journey.decisions < 1) return {};
      if (state.settings.electionScope === "prn" && stateId !== state.settings.prnStateId) return {};
      if (!state.states.some(s => s.id === stateId)) return {};
      const { funds: fundsCost, media: mediaCost, manpower: manpowerCost } = campaignCost(gameType, tactic);
      if (state.resources.funds < fundsCost || state.resources.manpower < manpowerCost || state.resources.mediaBuy < mediaCost) return {};
      const ts = new Date().toTimeString().slice(0, 5);
      const targetState = state.states.find((s) => s.id === stateId);
      const prnIssue = state.settings.electionScope === "prn" ? findPrnIssue(stateId, issueId) : undefined;
      const issueKey = prnIssue ? prnIssueActionKey(state.careerProgress.term, stateId, prnIssue.id) : null;
      const previousIssueUses = issueKey ? state.journey.prnIssueActions[issueKey] ?? 0 : 0;
      const issueGain = prnIssue ? prnIssueBonus(prnIssue, gameType, previousIssueUses) : 0;
      const manifesto = getManifestoPackage(state.journey.manifestoPackageId);
      const manifestoGain = targetState ? manifestoCampaignBonus(state.journey.manifestoPackageId, targetState, gameType) : 0;
      const prnCandidate = state.settings.electionScope === "prn" ? getPrnCandidate(state.journey.prnCandidateId) : undefined;
      const candidateGain = prnCandidate ? prnCandidateChannelBonus(prnCandidate.id, gameType) : 0;
      const projectedGain = Math.round(((targetState
        ? calculateCampaignGain(targetState, gameType, tactic)
        : getCampaignBaseGain(gameType, tactic)) + issueGain + manifestoGain + candidateGain) * 100) / 100;
      const reaction = buildCampaignActionReaction({
        day: state.day,
        stateId,
        gameType,
        tactic,
        gain: projectedGain,
        partyAbbr: state.leader.partyAbbr,
      });
      const politicalReactions = [reaction, ...state.politicalReactions].slice(0, 30);
      persistPoliticalReactions(politicalReactions);

      return {
        journey: {
          ...state.journey,
          decisions: state.journey.decisions - 1,
          prnIssueActions: issueKey ? { ...state.journey.prnIssueActions, [issueKey]: previousIssueUses + 1 } : state.journey.prnIssueActions,
          journal: journal(state.journey,
            prnIssue ? `Isu PRN “${prnIssue.title.ms}” diketengahkan melalui ${gameType === "ceramah" ? "ceramah" : "media sosial"}: +${projectedGain.toFixed(1)} sokongan termasuk bonus isu +${issueGain.toFixed(2)}${manifesto ? ` dan padanan manifesto ${manifestoGain >= 0 ? "+" : ""}${manifestoGain.toFixed(2)}` : ""}${prnCandidate ? ` serta calon ${candidateGain >= 0 ? "+" : ""}${candidateGain.toFixed(2)}` : ""}.` : `Kempen: +${projectedGain.toFixed(1)} sokongan; kos RM${fundsCost}${manifesto ? `; padanan manifesto ${manifestoGain >= 0 ? "+" : ""}${manifestoGain.toFixed(2)}` : ""}${prnCandidate ? `; calon ${candidateGain >= 0 ? "+" : ""}${candidateGain.toFixed(2)}` : ""}.`,
            prnIssue ? `PRN issue “${prnIssue.title.en}” addressed through ${gameType === "ceramah" ? "a rally" : "social media"}: +${projectedGain.toFixed(1)} support including +${issueGain.toFixed(2)} issue bonus${manifesto ? ` and ${manifestoGain >= 0 ? "+" : ""}${manifestoGain.toFixed(2)} manifesto fit` : ""}${prnCandidate ? ` and ${candidateGain >= 0 ? "+" : ""}${candidateGain.toFixed(2)} candidate fit` : ""}.` : `Campaign: +${projectedGain.toFixed(1)} support; cost RM${fundsCost}${manifesto ? `; manifesto fit ${manifestoGain >= 0 ? "+" : ""}${manifestoGain.toFixed(2)}` : ""}${prnCandidate ? `; candidate fit ${candidateGain >= 0 ? "+" : ""}${candidateGain.toFixed(2)}` : ""}.`),
        },
        states: state.states.map((s) => {
          if (s.id !== stateId) return s;
          const gain = Math.round((calculateCampaignGain(s, gameType, tactic) + issueGain + manifestoGain + candidateGain) * 100) / 100;
          const mandatSupport = Math.min(82, Math.round((s.mandatSupport + gain) * 100) / 100);
          const lawanSupport = Math.max(8, Math.round((s.lawanSupport - gain * 0.5) * 100) / 100);
          const othersSupport = Math.max(4, Math.round((100 - mandatSupport - lawanSupport) * 100) / 100);
          const margin = mandatSupport - lawanSupport;
          return {
            ...s,
            mandatSupport,
            lawanSupport,
            othersSupport,
            winProbability: Math.min(95, Math.round((s.winProbability + gain * 1.8) * 100) / 100),
            projectedSeats: Math.max(0, Math.min(s.seats, s.projectedSeats + (gain >= 1.8 && margin > 0 ? 1 : 0))),
            status: margin >= 8 ? "winning" : margin <= -8 ? "losing" : "contested",
            trend: gain,
          };
        }),
        resources: {
          ...state.resources,
          funds: Math.max(0, state.resources.funds - fundsCost),
          manpower: Math.max(0, state.resources.manpower - manpowerCost),
          mediaBuy: Math.max(0, state.resources.mediaBuy - mediaCost),
        },
        alerts: [{
          id: `mini-${Date.now()}`,
          time: ts,
          message: `${gameType === "ceramah" ? "Ceramah" : "Social media"} completed in ${stateId.toUpperCase()} using ${tactic.toUpperCase()} tactic${prnIssue ? ` on ${prnIssue.title.en} (+${issueGain.toFixed(2)} issue fit)` : ""}${manifesto ? ` with ${manifesto.title.en} (${manifestoGain >= 0 ? "+" : ""}${manifestoGain.toFixed(2)} fit)` : ""}.`,
          type: tactic === "aggressive" ? "warning" : "positive",
        }, ...state.alerts].slice(0, 12),
        politicalReactions,
      };
    }),

  runCampaignEvent: (eventId, toneId) =>
    set((state) => {
      const event = getCampaignEvent(eventId);
      const tone = getCampaignTone(toneId);
      const completed = state.journey.campaignEvents.some(result => result.term === state.careerProgress.term && result.eventId === eventId);
      if (!event || !tone || completed || state.journey.chapter !== "campaign" || state.day >= state.totalDays || state.journey.decisions < 1 || !isCampaignEventUnlocked(event, state.day, state.totalDays)) return {};
      if (state.resources.funds < event.cost || state.resources.mediaBuy < event.mediaCost || state.resources.manpower < event.manpowerCost) return {};
      const scope = state.settings.electionScope === "prn" ? state.states.filter(item => item.id === state.settings.prnStateId) : state.states;
      const preview = previewCampaignEvent(eventId, toneId, scope, {
        charisma: state.leader.charisma,
        credibility: state.leader.credibility,
        strategy: state.leader.strategy,
        manifestoId: state.journey.manifestoPackageId,
        mediaSentiment: state.mediaSentiment,
        difficulty: state.settings.difficulty,
        prnCandidateId: state.settings.electionScope === "prn" ? state.journey.prnCandidateId : null,
      });
      const impactByState = new Map(preview.stateImpacts.map(item => [item.stateId, item.impact]));
      const eventTitle = state.settings.electionScope === "prn" && event.prnTitle ? event.prnTitle : event.title;
      const ratingMS = { breakthrough: "cemerlang", solid: "kukuh", mixed: "bercampur", backlash: "makan diri" }[preview.rating];
      const reaction = buildCampaignEventReaction({
        day: state.day,
        partyAbbr: state.leader.partyAbbr,
        eventTitle: eventTitle.ms,
        eventTitleEN: eventTitle.en,
        tone: tone.title.ms,
        toneEN: tone.title.en,
        rating: preview.rating,
        impact: preview.averageImpact,
        strongestState: preview.strongest.stateName,
        weakestState: preview.weakest.stateName,
        scopeLabel: state.settings.electionScope === "prn" ? preview.strongest.stateName : "National",
      });
      const politicalReactions = [reaction, ...state.politicalReactions].slice(0, 30);
      persistPoliticalReactions(politicalReactions);
      return {
        states: state.states.map(item => {
          const impact = impactByState.get(item.id);
          if (impact === undefined) return item;
          const mandatSupport = Math.max(8, Math.min(82, Math.round((item.mandatSupport + impact) * 100) / 100));
          const othersSupport = Math.max(4, Math.min(item.othersSupport, 100 - mandatSupport - 8));
          const lawanSupport = Math.round((100 - mandatSupport - othersSupport) * 100) / 100;
          const updated = { ...item, mandatSupport, lawanSupport, othersSupport, trend: impact };
          const margin = mandatSupport - lawanSupport;
          return {
            ...updated,
            projectedSeats: generateConstituencies(updated, state.settings.electionScope === "prn" ? "dun" : "parliament").filter(seat => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length,
            winProbability: Math.max(5, Math.min(95, Math.round((50 + margin * 2) * 100) / 100)),
            status: margin >= 8 ? "winning" as const : margin <= -8 ? "losing" as const : "contested" as const,
          };
        }),
        resources: { ...state.resources, funds: state.resources.funds - event.cost, mediaBuy: state.resources.mediaBuy - event.mediaCost, manpower: state.resources.manpower - event.manpowerCost },
        mediaSentiment: preview.rating === "backlash" ? "negative" as const : preview.rating === "mixed" ? "neutral" as const : "positive" as const,
        nationalSupportDelta: Math.round((state.nationalSupportDelta + preview.averageImpact) * 100) / 100,
        journey: {
          ...state.journey,
          decisions: state.journey.decisions - 1,
          campaignEvents: [...state.journey.campaignEvents, { term: state.careerProgress.term, eventId, toneId, rating: preview.rating, impact: preview.averageImpact }],
          journal: journal(state.journey,
            `${eventTitle.ms}: nada ${tone.title.ms} menghasilkan prestasi ${ratingMS}, purata sokongan ${preview.averageImpact >= 0 ? "+" : ""}${preview.averageImpact.toFixed(2)}. Terkuat di ${preview.strongest.stateName}; paling lemah di ${preview.weakest.stateName}.`,
            `${eventTitle.en}: a ${tone.title.en.toLowerCase()} tone delivered a ${preview.rating} result, averaging ${preview.averageImpact >= 0 ? "+" : ""}${preview.averageImpact.toFixed(2)} support. Strongest in ${preview.strongest.stateName}; weakest in ${preview.weakest.stateName}.`),
        },
        alerts: [{ id: `event-${Date.now()}`, time: new Date().toTimeString().slice(0, 5), message: `${eventTitle.en}: ${preview.rating.toUpperCase()} (${preview.averageImpact >= 0 ? "+" : ""}${preview.averageImpact.toFixed(2)} average support).`, type: preview.rating === "backlash" ? "warning" : "positive" }, ...state.alerts].slice(0, 12),
        politicalReactions,
      };
    }),

  addPoliticalReaction: (reaction) =>
    set((state) => {
      const politicalReactions = [reaction, ...state.politicalReactions].slice(0, 30);
      persistPoliticalReactions(politicalReactions);
      return { politicalReactions };
    }),

  addAiNewsReaction: (item) =>
    set((state) => {
      const aiNews = [item, ...state.aiNews].slice(0, 20);
      persistAiNews(aiNews);
      return { aiNews };
    }),

  applyCandidateFallout: (stateId, reaction, lawanBoost, othersBoost) =>
    set((state) => {
      const politicalReactions = [reaction, ...state.politicalReactions].slice(0, 30);
      persistPoliticalReactions(politicalReactions);
      return {
        politicalReactions,
        states: state.states.map((s) => {
          if (s.id !== stateId) return s;
          const mandatSupport = Math.max(8, Math.round((s.mandatSupport - lawanBoost * 0.55 - othersBoost * 0.35) * 10) / 10);
          const lawanSupport = Math.min(82, Math.round((s.lawanSupport + lawanBoost) * 10) / 10);
          const othersSupport = Math.min(35, Math.max(4, Math.round((s.othersSupport + othersBoost) * 10) / 10));
          const margin = mandatSupport - Math.max(lawanSupport, othersSupport);
          return {
            ...s,
            mandatSupport,
            lawanSupport,
            othersSupport,
            winProbability: Math.max(8, Math.round((s.winProbability - (lawanBoost + othersBoost) * 1.4) * 10) / 10),
            status: margin >= 8 ? "winning" : margin <= -8 ? "losing" : "contested",
            trend: Math.round((s.trend - lawanBoost - othersBoost) * 10) / 10,
          };
        }),
      };
    }),

  clearLastEvent: () => set({ lastEvent: null }),

  getTotalProjectedSeats: () => {
    const { states } = get();
    return states.reduce((sum, s) => sum + s.projectedSeats, 0);
  },

  getNationalSupport: () => {
    const { states } = get();
    const totalSeats = states.reduce((sum, s) => sum + s.seats, 0);
    let mandat = 0, lawan = 0, others = 0;
    states.forEach((s) => {
      const weight = s.seats / totalSeats;
      mandat += s.mandatSupport * weight;
      lawan += s.lawanSupport * weight;
      others += s.othersSupport * weight;
    });
    return {
      mandat: Math.round(mandat),
      lawan: Math.round(lawan),
      others: Math.round(others),
    };
  },
}));
