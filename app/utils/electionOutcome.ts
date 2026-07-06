import { generateConstituencies } from "../data/constituencies";
import type { StateData } from "../data/states";

export const TOTAL_SEATS = 222;
export const MAJORITY = 112;

export type MandateStatus = "majority" | "hung" | "opposition" | "collapse";

export type ElectionOutcomeSummary = {
  seatsWon: number;
  lawanSeats: number;
  othersSeats: number;
  nationalSupport: number;
  statesWon: number;
  statesLost: number;
  status: MandateStatus;
  statusLabelMS: string;
  statusLabelEN: string;
};

export function computeElectionOutcome(states: StateData[]): ElectionOutcomeSummary {
  const stateSummaries = states.map((state) => {
    const seats = generateConstituencies(state);
    const wins = seats.filter((seat) => seat.mandat >= seat.lawan && seat.mandat >= seat.others).length;
    const losses = seats.filter((seat) => seat.lawan > seat.mandat && seat.lawan >= seat.others).length;
    const others = Math.max(0, seats.length - wins - losses);
    return { state, wins, losses, others };
  });

  const seatsWon = stateSummaries.reduce((sum, item) => sum + item.wins, 0);
  const lawanSeats = stateSummaries.reduce((sum, item) => sum + item.losses, 0);
  const othersSeats = Math.max(0, TOTAL_SEATS - seatsWon - lawanSeats);
  const nationalSupport = Math.round(states.reduce((sum, state) => sum + state.mandatSupport * (state.seats / TOTAL_SEATS), 0));
  const statesWon = stateSummaries.filter((item) => item.wins > Math.max(item.losses, item.others)).length;
  const statesLost = stateSummaries.filter((item) => item.losses > Math.max(item.wins, item.others)).length;
  const status: MandateStatus = seatsWon >= MAJORITY ? "majority" : seatsWon >= 89 ? "hung" : seatsWon >= 40 ? "opposition" : "collapse";
  const labels = {
    majority: ["MANDAT JELAS", "CLEAR MANDATE"],
    hung: ["PARLIMEN TERGANTUNG", "HUNG PARLIAMENT"],
    opposition: ["PEMBANGKANG KUAT", "STRONG OPPOSITION"],
    collapse: ["MANDAT DITOLAK", "MANDATE REJECTED"],
  } satisfies Record<MandateStatus, [string, string]>;

  return {
    seatsWon,
    lawanSeats,
    othersSeats,
    nationalSupport,
    statesWon,
    statesLost,
    status,
    statusLabelMS: labels[status][0],
    statusLabelEN: labels[status][1],
  };
}
