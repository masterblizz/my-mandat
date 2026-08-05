import { generateConstituencies, type Constituency } from "../data/constituencies";
import type { StateData } from "../data/states";

export type SeatDetail = {
  constituency: Constituency;
  result: "WIN" | "LOSS" | "OTHERS";
  winnerLabel: string;
  runnerUpLabel: string;
  majorityVotes: number;
  majorityPct: number;
  turnoutPct: number;
  votesCast: number;
  registeredVoters: number;
  mandatVotes: number;
  lawanVotes: number;
  othersVotes: number;
};

export function computeSeatDetails(state: StateData, partyLabel: string, seatScope: "parliament" | "dun" = "parliament"): SeatDetail[] {
  const constituencies = generateConstituencies(state, seatScope);
  const seatCount = seatScope === "dun" ? state.dunSeats : state.seats;
  const avgRegistered = Math.max(1, Math.round(state.registeredVoters / Math.max(1, seatCount)));

  return constituencies.map((constituency, index) => {
    const seed = constituency.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + index * 13;
    const turnoutPct = Math.max(55, Math.min(88, state.turnoutTarget + ((seed % 17) - 8) * 0.55));
    const registeredVoters = Math.round(avgRegistered * (0.88 + (seed % 25) / 100));
    const votesCast = Math.round(registeredVoters * (turnoutPct / 100));
    const mandatVotes = Math.round(votesCast * (constituency.mandat / 100));
    const lawanVotes = Math.round(votesCast * (constituency.lawan / 100));
    const othersVotes = Math.max(0, votesCast - mandatVotes - lawanVotes);
    const entries = [
      { label: partyLabel, votes: mandatVotes, pct: constituency.mandat, result: "WIN" as const },
      { label: "LAWAN", votes: lawanVotes, pct: constituency.lawan, result: "LOSS" as const },
      { label: "OTHERS", votes: othersVotes, pct: constituency.others, result: "OTHERS" as const },
    ].sort((a, b) => b.votes - a.votes);
    const winner = entries[0];
    const runnerUp = entries[1];

    return {
      constituency,
      result: winner.result,
      winnerLabel: winner.label,
      runnerUpLabel: runnerUp.label,
      majorityVotes: Math.max(0, winner.votes - runnerUp.votes),
      majorityPct: Math.max(0, winner.pct - runnerUp.pct),
      turnoutPct,
      votesCast,
      registeredVoters,
      mandatVotes,
      lawanVotes,
      othersVotes,
    };
  });
}
