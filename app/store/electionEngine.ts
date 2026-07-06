import { gameEvents } from "../data/events";
import type { StateData } from "../data/states";
import { runOpponentAI, type OpponentAction, type OpponentResult } from "./opponentAI";

interface EngineInput {
  day: number;
  states: StateData[];
  operations: {
    status: string;
    type?: string;
    stateIds: string[];
    supportGain: number;
    fundsCost: number;
    manpowerCost: number;
  }[];
  resources: { funds: number; manpower: number };
  totalDays?: number;
  difficulty?: "easy" | "normal" | "hard" | "nightmare";
  settings?: { oppositionStrength: number; electionScope?: "pru" | "prn"; prnStateId?: string };
}

interface Alert {
  id: string;
  time: string;
  message: string;
  type: string;
}

export interface DayResult {
  stateUpdates: {
    id: string;
    mandatSupport: number;
    lawanSupport: number;
    othersSupport: number;
    projectedSeats: number;
    status: "winning" | "losing" | "contested";
    trend: number;
  }[];
  resourceUpdates: { funds: number; manpower: number };
  newAlerts: Alert[];
  triggeredEvent: (typeof gameEvents)[0] | null;
  opponentActions: OpponentAction[];
}

const BORNEO_STATES = new Set(["sabah", "sarawak"]);

export function processDay(state: EngineInput): DayResult {
  const electionScope = state.settings?.electionScope ?? "pru";
  const prnStateId = state.settings?.prnStateId;

  // PRN (state election) campaigns are scoped to a single negeri — every event,
  // opponent action and per-day support swing below only concerns that state.
  // Other negeri are untouched (no entry in stateUpdates) since they're not part
  // of this campaign.
  const scopedStates = electionScope === "prn"
    ? state.states.filter((s) => s.id === prnStateId)
    : state.states;
  const effectiveStates = scopedStates.length ? scopedStates : state.states;

  const triggeredEvent = pickEvent(state.day, electionScope, prnStateId);
  const totalDays = state.totalDays ?? 30;

  // ── Build opponent AI inputs from current game state ──────────────────────
  const activeOps = state.operations.filter(
    (op) => op.status === "active" || op.status === "ongoing"
  );
  const activeStateIds = new Set(activeOps.flatMap((op) => op.stateIds));
  const playerDigitalOps = activeOps.filter((op) => op.type === "digital").length;
  const playerCeramahOps = activeOps.filter((op) => op.type === "ceramah").length;
  const playerBorneoOps = activeOps.filter((op) =>
    op.stateIds.some((id) => BORNEO_STATES.has(id))
  ).length;
  const recentPlayerGains = effectiveStates
    .filter((s) => s.trend > 0.5)
    .map((s) => s.id);

  const opponentResult: OpponentResult = runOpponentAI({
    day: state.day,
    totalDays,
    states: effectiveStates,
    activeStateIds,
    playerDigitalOps,
    playerCeramahOps,
    playerBorneoOps,
    oppositionStrength: state.settings?.oppositionStrength ?? 60,
    difficulty: state.difficulty ?? "normal",
    recentPlayerGains,
    scopeStateName: electionScope === "prn" ? effectiveStates[0]?.name : undefined,
  });

  // Spread national damage evenly across all in-scope states
  const perStateNationalDamage = opponentResult.nationalDamage / effectiveStates.length;

  // ── Per-state support updates ─────────────────────────────────────────────
  const stateUpdates = effectiveStates.map((s) => {
    let delta = 0;

    // Player operations boost
    activeOps
      .filter((op) => op.stateIds.includes(s.id))
      .forEach((op) => { delta += op.supportGain * 0.08; });

    // Random event effects
    if (triggeredEvent) {
      if (triggeredEvent.impact.national) delta += triggeredEvent.impact.national * 0.25;
      if (triggeredEvent.impact.states?.includes(s.id) && triggeredEvent.impact.stateImpact)
        delta += triggeredEvent.impact.stateImpact * 0.3;
    }

    // Noise ±0.3%
    delta += (lcg(s.id.charCodeAt(0) * state.day) - 0.5) * 0.6;

    // Opponent AI national pressure erodes player delta
    delta -= perStateNationalDamage;

    // Opponent AI geographic pressure in this specific state
    const aiBoost = opponentResult.stateDebuffs[s.id] ?? 0;

    const newMandat = clamp(s.mandatSupport + delta - aiBoost * 0.35, 8, 82);
    const newLawan  = clamp(s.lawanSupport  - delta * 0.65 + aiBoost,  8, 82);
    const newOthers = Math.max(4, 100 - newMandat - newLawan);

    const margin = newMandat - newLawan;
    const winShare = Math.min(0.95, 0.5 + margin / 100 + 0.08);
    const rawProjected = Math.round(s.seats * winShare);
    const newProjected = margin > 0
      ? clamp(rawProjected, 0, s.seats)
      : clamp(s.seats - rawProjected, 0, s.seats);

    const newStatus: "winning" | "losing" | "contested" =
      margin >= 8 ? "winning" : margin <= -8 ? "losing" : "contested";

    return {
      id: s.id,
      mandatSupport: round1(newMandat),
      lawanSupport:  round1(newLawan),
      othersSupport: round1(newOthers),
      projectedSeats: margin > 0 ? newProjected : s.seats - newProjected,
      status: newStatus,
      trend: round1(delta),
    };
  });

  // ── Resource drain from active ops ────────────────────────────────────────
  const dailyFunds = activeOps.reduce((sum, op) => sum + op.fundsCost / totalDays, 0);
  const dailyManpower = activeOps.reduce((sum, op) => sum + op.manpowerCost / (totalDays * 10), 0);

  let bonusFunds = 0;
  if (triggeredEvent?.impact.resource === "funds" && triggeredEvent.impact.resourceChange)
    bonusFunds = triggeredEvent.impact.resourceChange;

  // ── Build alerts ──────────────────────────────────────────────────────────
  const newAlerts: Alert[] = [];
  const ts = new Date().toTimeString().slice(0, 5);

  if (triggeredEvent) {
    newAlerts.push({
      id: `ev-${state.day}-${triggeredEvent.id}`,
      time: ts,
      message: `[DAY ${state.day}] ${triggeredEvent.description}`,
      type: (triggeredEvent.impact.national ?? 0) >= 0 && (triggeredEvent.impact.stateImpact ?? 0) >= 0
        ? "positive" : "warning",
    });
  }

  // Opponent action alerts (high-severity ones surface as war room alerts)
  for (const action of opponentResult.actions) {
    if (action.severity === "high" || action.type === "scandal") {
      newAlerts.push({
        id: action.id,
        time: ts,
        message: `[OPPOSITION] ${action.narrativeEN}`,
        type: "warning",
      });
    }
  }

  const gained = stateUpdates.filter((u) => {
    const orig = state.states.find((s) => s.id === u.id);
    return orig && u.mandatSupport > orig.mandatSupport + 0.05;
  }).length;

  newAlerts.push({
    id: `daily-${state.day}`,
    time: ts,
    message: `Day ${state.day} ops complete — support up in ${gained} state${gained !== 1 ? "s" : ""}.`,
    type: "info",
  });

  return {
    stateUpdates,
    resourceUpdates: {
      funds: Math.max(0, state.resources.funds - Math.round(dailyFunds) + bonusFunds),
      manpower: Math.max(0, state.resources.manpower - Math.round(dailyManpower)),
    },
    newAlerts,
    triggeredEvent,
    opponentActions: opponentResult.actions,
  };
}

function pickEvent(day: number, electionScope: "pru" | "prn", prnStateId?: string): (typeof gameEvents)[0] | null {
  const candidates = gameEvents.filter((ev) => {
    if (Math.abs(ev.day - day) > 1) return false;
    // In PRN mode, drop events tied to a different negeri; keep negeri-agnostic ones.
    if (electionScope === "prn") return !ev.impact.states || ev.impact.states.includes(prnStateId ?? "");
    return true;
  });
  for (const ev of candidates) {
    if (Math.random() < ev.probability * 0.4) return ev;
  }
  return null;
}

function lcg(seed: number): number {
  const s = Math.imul(seed ^ (seed >>> 17), 0x45d9f3b);
  return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
