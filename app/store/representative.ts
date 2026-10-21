import type { GameState } from "./gameStore";
import { generateConstituencies } from "../data/constituencies";
import { computeElectionOutcome } from "../utils/electionOutcome";
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
function seatStateId(state: GameState) {
  return state.settings.electionScope === "prn" ? state.settings.prnStateId : state.leader.homeState;
}

function homeSeatWon(state: GameState, states: GameState["states"]) {
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
