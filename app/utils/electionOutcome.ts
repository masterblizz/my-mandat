import { generateConstituencies } from "../data/constituencies";
import type { StateData } from "../data/states";

export const TOTAL_SEATS = 222;
export const MAJORITY = 112;

export type ElectionScope = "pru" | "prn";
export type SeatScope = "parliament" | "dun";
export type MandateStatus = "majority" | "hung" | "opposition" | "collapse";

export type ElectionOutcomeSummary = {
  seatsWon: number;
  lawanSeats: number;
  othersSeats: number;
  nationalSupport: number;
  statesWon: number;
  statesLost: number;
  totalSeats: number;
  majorityTarget: number;
  contestedStates: StateData[];
  seatScope: SeatScope;
  status: MandateStatus;
  statusLabelKey: string;
};

type Options = {
  electionScope?: ElectionScope;
  prnStateId?: string;
};

export function getElectionContext(states: StateData[], options: Options = {}) {
  const electionScope = options.electionScope ?? "pru";
  const prnState = states.find((state) => state.id === options.prnStateId) ?? states[0];
  const contestedStates = electionScope === "prn" && prnState ? [prnState] : states;
  const seatScope: SeatScope = electionScope === "prn" ? "dun" : "parliament";
  const totalSeats = contestedStates.reduce((sum, state) => sum + (seatScope === "dun" ? state.dunSeats : state.seats), 0);
  const majorityTarget = Math.floor(totalSeats / 2) + 1;
  return { electionScope, contestedStates, seatScope, totalSeats, majorityTarget };
}

export function computeElectionOutcome(states: StateData[], options: Options = {}): ElectionOutcomeSummary {
  const { electionScope, contestedStates, seatScope, totalSeats, majorityTarget } = getElectionContext(states, options);
  const stateSummaries = contestedStates.map((state) => {
    const seats = generateConstituencies(state, seatScope);
    const wins = seats.filter((seat) => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length;
    const losses = seats.filter((seat) => seat.lawan > seat.mandat && seat.lawan >= seat.others).length;
    const others = Math.max(0, seats.length - wins - losses);
    return { state, wins, losses, others };
  });

  const seatsWon = stateSummaries.reduce((sum, item) => sum + item.wins, 0);
  const lawanSeats = stateSummaries.reduce((sum, item) => sum + item.losses, 0);
  const othersSeats = Math.max(0, totalSeats - seatsWon - lawanSeats);
  const nationalSupport = totalSeats > 0
    ? Math.round(contestedStates.reduce((sum, state) => sum + state.mandatSupport * ((seatScope === "dun" ? state.dunSeats : state.seats) / totalSeats), 0))
    : 0;
  const statesWon = stateSummaries.filter((item) => item.wins > Math.max(item.losses, item.others)).length;
  const statesLost = stateSummaries.filter((item) => item.losses > Math.max(item.wins, item.others)).length;
  const hungThreshold = electionScope === "prn" ? Math.ceil(totalSeats * 0.40) : 89;
  const oppositionThreshold = electionScope === "prn" ? Math.ceil(totalSeats * 0.18) : 40;
  const status: MandateStatus = seatsWon >= majorityTarget ? "majority" : seatsWon >= hungThreshold ? "hung" : seatsWon >= oppositionThreshold ? "opposition" : "collapse";
  const statusLabelScope = electionScope === "prn" ? "prn" : "pru";

  return {
    seatsWon,
    lawanSeats,
    othersSeats,
    nationalSupport,
    statesWon,
    statesLost,
    totalSeats,
    majorityTarget,
    contestedStates,
    seatScope,
    status,
    statusLabelKey: `mandate_page.status_${statusLabelScope}_${status}`,
  };
}
