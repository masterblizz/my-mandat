"use client";
import { create } from "zustand";
import { StateData, states as initialStates } from "../data/states";
import { processDay } from "./electionEngine";
import type { GameEvent } from "../data/events";
import { TOTAL_ELECTION_DAYS } from "../data/electionFlow";
import type { DatasetKind } from "../data/datasets";
import type { OpponentAction } from "./opponentAI";
import type { PoliticalReaction } from "../data/politicalReactions";
import { buildCampaignActionReaction, buildNominationReaction } from "../data/politicalReactions";
import type { LiveNewsItem } from "../data/liveNews";
import { calculateCampaignGain, getCampaignBaseGain } from "./campaignMath";
import { generateConstituencies } from "../data/constituencies";

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
  setDailyChallengeDate: (dateKey: string | null) => void;
  setCareerProgress: (patch: Partial<CareerProgress>) => void;
  setGovernmentProgress: (patch: Partial<GovernmentProgress>) => void;
  setSandboxProgress: (patch: Partial<SandboxProgress>) => void;
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
  runCampaignMiniGame: (stateId: string, gameType: "ceramah" | "social", tactic: "safe" | "balanced" | "aggressive") => void;
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
  partyColor: "#00d4ff",
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
  careerProgress: { completed: ["prn-test", "shadow-or-govern"], term: 1, month: 1 },
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

  setHasWonElection: (won) => set({ hasWonElection: won }),
  setDailyChallengeDate: (dateKey) => set({ dailyChallengeDate: dateKey }),
  setCareerProgress: (patch) => set((state) => ({ careerProgress: { ...state.careerProgress, ...patch } })),
  setGovernmentProgress: (patch) => set((state) => ({ governmentProgress: { ...state.governmentProgress, ...patch } })),
  setSandboxProgress: (patch) => set((state) => ({ sandboxProgress: { ...state.sandboxProgress, ...patch } })),

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
      if (gameState.day >= gameState.totalDays) return {};
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
    return set({
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
      careerProgress: { completed: ["prn-test", "shadow-or-govern"], term: 1, month: 1 },
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
    set((state) => ({ operations: [...state.operations, op] })),

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

  runCampaignMiniGame: (stateId, gameType, tactic) =>
    set((state) => {
      const fundsCost = gameType === "ceramah" ? 75_000 : 45_000;
      const mediaCost = gameType === "social" ? 65 : 15;
      const manpowerCost = gameType === "ceramah" ? 42 : 12;
      const ts = new Date().toTimeString().slice(0, 5);
      const targetState = state.states.find((s) => s.id === stateId);
      const projectedGain = targetState
        ? calculateCampaignGain(targetState, gameType, tactic)
        : getCampaignBaseGain(gameType, tactic);
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
        states: state.states.map((s) => {
          if (s.id !== stateId) return s;
          const gain = calculateCampaignGain(s, gameType, tactic);
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
          message: `${gameType === "ceramah" ? "Ceramah" : "Social media"} mini-game completed in ${stateId.toUpperCase()} using ${tactic.toUpperCase()} tactic.`,
          type: tactic === "aggressive" ? "warning" : "positive",
        }, ...state.alerts].slice(0, 12),
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
