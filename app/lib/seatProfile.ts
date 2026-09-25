import { generateConstituencies, type AreaType } from "../data/constituencies";
import type { StateData } from "../data/states";
import type { LeaderProfile } from "../store/gameStore";

type ElectionSettings = {
  electionScope: "pru" | "prn";
  prnStateId: string;
};

/**
 * A location view must use the same geography as the 3D city hub.  Keeping
 * this in one place prevents a rural seat from opening a KL-style interior.
 */
export function homeSeatProfile(
  states: StateData[],
  leader: LeaderProfile,
  settings: ElectionSettings,
): { areaType: AreaType; isRural: boolean; seatName: string } {
  const state = states.find((entry) => entry.id === (settings.electionScope === "prn" ? settings.prnStateId : leader.homeState))
    ?? states.find((entry) => entry.id === leader.homeState)
    ?? states[0];
  const seats = state ? generateConstituencies(state, settings.electionScope === "prn" ? "dun" : "parliament") : [];
  const seat = seats.find((entry) => entry.id === leader.homeConstituencyId) ?? seats[0];
  const areaType = seat?.areaType ?? "suburban";
  return { areaType, isRural: areaType === "rural", seatName: seat?.name ?? leader.homeConstituencyName };
}

export function currentLocalTimeIsNight(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 19 || hour < 6;
}
