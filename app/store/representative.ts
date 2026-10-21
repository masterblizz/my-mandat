import type { GameState } from "./gameStore";
import { generateConstituencies } from "../data/constituencies";
import { computeElectionOutcome } from "../utils/electionOutcome";
import { cityLedger } from "../data/cityEconomy";
import { journal, shiftSupport, type Journey } from "./journey";

// Representative career: a new game starts on the first day after the
// player has WON their own seat (P.xxx in PRU, N.xxx in PRN), sitting on the
// side chosen at setup. The term is spent developing the kawasan; the next
// election is fought at the end of it. All figures are simulated.

export type StartingSide = "government" | "opposition";
export const STARTING_SIDES: StartingSide[] = ["government", "opposition"];

/** Career rank inside a term. null on a journey = legacy party-leader run. */
export type RepRank = "backbencher";

/** Development allocation available on day one. */
export const REP_OPENING_ALLOCATION: Record<StartingSide, number> = { government: 600_000, opposition: 150_000 };
/** Federal/state constituency grant booked each quarter (replaces the city base grant). */
export const REP_QUARTER_GRANT: Record<StartingSide, number> = { government: 100_000, opposition: 40_000 };

export function repSide(journey: Pick<Journey, "rank" | "chapter">): StartingSide | null {
  if (!journey.rank) return null;
  return journey.chapter === "government" ? "government" : journey.chapter === "opposition" ? "opposition" : null;
}

// In PRN the seat is an N.xxx in the selected negeri, which can differ from
// the leader's flavour home state.
export function seatStateId(state: Pick<GameState, "settings" | "leader">) {
  return state.settings.electionScope === "prn" ? state.settings.prnStateId : state.leader.homeState;
}

export function homeSeatWon(state: Pick<GameState, "settings" | "leader">, states: GameState["states"]) {
  const home = states.find((item) => item.id === seatStateId(state));
  const seat = home && generateConstituencies(home, state.settings.electionScope === "prn" ? "dun" : "parliament").find((item) => item.id === state.leader.homeConstituencyId);
  return !!seat && seat.mandat >= Math.max(seat.lawan, seat.others);
}

const MAX_PERSONAL_VOTE = 50;

// Smallest swing that makes the simulated election agree with the chosen
// story (party governs with a majority, or sits in opposition), then the
// smallest incumbent personal vote that makes the player's own seat a win.
// The personal vote is seat-local, so it never flips the party outcome
// beyond the player's single seat — re-checked anyway.
function settleElection(state: GameState, side: StartingSide) {
  const swings = [0];
  for (let step = 0.5; step <= 30; step += 0.5) swings.push(step, -step);
  const options = { electionScope: state.settings.electionScope, prnStateId: state.settings.prnStateId };
  const sideOk = (states: GameState["states"]) => {
    const outcome = computeElectionOutcome(states, options);
    return (side === "government" ? outcome.status === "majority" : outcome.status === "opposition") ? outcome : null;
  };
  const seatState = seatStateId(state);
  const seatId = state.leader.homeConstituencyId;
  for (const swing of swings) {
    const national = swing ? shiftSupport(state, swing) : state.states;
    if (!sideOk(national)) continue;
    for (let personal = 0; personal <= MAX_PERSONAL_VOTE; personal += 1) {
      const states = personal
        ? national.map((item) => item.id === seatState ? { ...item, personalVote: { ...item.personalVote, [seatId]: personal } } : item)
        : national;
      if (!homeSeatWon(state, states)) continue;
      const outcome = sideOk(states);
      if (outcome) return { states, outcome };
      break;
    }
  }
  return null;
}

export function startAsRepresentative(state: GameState): Partial<GameState> {
  const side = state.settings.side;
  const settled = settleElection(state, side);
  if (!settled) return {};
  const j = state.journey;
  const isPrn = state.settings.electionScope === "prn";
  const office = isPrn ? "ADUN" : "Ahli Parlimen";
  const officeEn = isPrn ? "State Assemblyman (ADUN)" : "Member of Parliament";
  const sideMs = side === "government" ? "kerajaan" : "pembangkang";
  const allocation = REP_OPENING_ALLOCATION[side];
  return {
    phase: "playing",
    states: settled.states,
    day: state.totalDays,
    hasWonElection: true,
    careerProgress: { ...state.careerProgress, month: 1 },
    journey: {
      ...j,
      chapter: side,
      rank: "backbencher",
      characterStage: "representative",
      outcome: settled.outcome,
      resultRecorded: true,
      onboarded: true,
      publicBudget: allocation,
      decisions: 3,
      actionsToday: [],
      termActions: [],
      journal: journal(j,
        `Hari pertama sebagai ${office} ${state.leader.homeConstituencyName} (blok ${sideMs}). Peruntukan pembangunan RM${allocation.toLocaleString()}. Bangunkan kawasan dan pertahankan kerusi pada pilihan raya seterusnya.`,
        `Day one as ${officeEn} for ${state.leader.homeConstituencyName} (${side} bench). Development allocation RM${allocation.toLocaleString()}. Develop the constituency and defend the seat at the next election.`),
    },
  };
}

/**
 * Incumbent personal vote carried into the next election: half of the
 * existing incumbency plus a performance term from the kawasan the player
 * actually built (sentiment, delivered facilities) and public trust. A
 * neglected seat loses its cushion; a well-served one can survive a bad
 * national swing.
 */
export function electionPersonalVote(state: GameState) {
  const seatState = seatStateId(state);
  const seatId = state.leader.homeConstituencyId;
  const previous = state.states.find((item) => item.id === seatState)?.personalVote?.[seatId] ?? 0;
  const zones = state.journey.cityZones[seatId] ?? [];
  const ledger = cityLedger(zones);
  // Out of office (rebuilding) there is no kawasan record to run on — only
  // the grassroots organisation and trust rebuilt since losing the seat.
  const outOfOffice = state.journey.chapter === "rebuilding";
  const kawasanRecord = outOfOffice ? (state.journey.organisation - 40) * 0.15 : zones.length ? (ledger.avgSentiment - 50) * 0.4 + ledger.built * 0.6 : -4;
  const performance = Math.max(-15, Math.min(20, kawasanRecord + (state.journey.trust - 50) * 0.1));
  const next = Math.round((previous * 0.5 + performance) * 10) / 10;
  return { seatState, seatId, previous, performance: Math.round(performance * 10) / 10, next };
}

export function withPersonalVote(states: GameState["states"], seatState: string, seatId: string, value: number) {
  return states.map((item) => item.id === seatState ? { ...item, personalVote: { ...item.personalVote, [seatId]: value } } : item);
}

/**
 * After the end-of-term election: a representative who held the seat opens
 * a new term on day one (bench decided by the result, the kawasan carried
 * over); one who lost it goes into the rebuilding chapter.
 */
export function continueRepresentativeCareer(state: GameState): { patch: Partial<GameState>; route: string } | null {
  const j = state.journey;
  if (!j.rank || j.chapter !== "results" || state.day < state.totalDays) return null;
  const term = state.careerProgress.term;
  if (!homeSeatWon(state, state.states)) {
    return {
      route: "/postmortem",
      patch: {
        hasWonElection: false,
        journey: {
          ...j, chapter: "rebuilding", characterStage: "organiser", publicBudget: 0, termActions: [],
          journal: journal(j,
            `Kerusi ${state.leader.homeConstituencyName} tewas. Bina semula jentera dan kepercayaan untuk merebut kembali kerusi.`,
            `${state.leader.homeConstituencyName} is lost. Rebuild your organisation and trust to win the seat back.`),
        },
      },
    };
  }
  const outcome = j.outcome ?? computeElectionOutcome(state.states, { electionScope: state.settings.electionScope, prnStateId: state.settings.prnStateId });
  const side: StartingSide = outcome.status === "majority" ? "government" : "opposition";
  const allocation = REP_OPENING_ALLOCATION[side];
  return {
    route: "/elected",
    patch: {
      hasWonElection: true,
      careerProgress: { ...state.careerProgress, month: 1 },
      journey: {
        ...j, chapter: side, characterStage: "representative", publicBudget: j.publicBudget + allocation,
        decisions: 3, actionsToday: [], termActions: [],
        journal: journal(j,
          `Dipilih semula di ${state.leader.homeConstituencyName} untuk penggal ${term} (blok ${side === "government" ? "kerajaan" : "pembangkang"}). Peruntukan baharu RM${allocation.toLocaleString()}; pembangunan kawasan diteruskan.`,
          `Re-elected in ${state.leader.homeConstituencyName} for term ${term} (${side} bench). New allocation RM${allocation.toLocaleString()}; constituency development carries on.`),
      },
    },
  };
}
