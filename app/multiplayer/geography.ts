import { generateConstituencies } from "../data/constituencies";
import { states } from "../data/states";
import type { MultiplayerConstituency, PartyId, Region, RegionId } from "./domain";

/**
 * Adapter for the existing Malaysia template. It deliberately only adapts
 * geography; the solo mandat/lawan/others polling aggregate is not party data.
 */
export function malaysiaRegions(): Region[] {
  return states.map((state) => ({
    id: state.id as RegionId,
    name: state.name,
    code: state.shortName,
    kind: state.id === "wp" ? "federal_territory" : "state",
  }));
}

export function malaysiaParliamentaryConstituencies(partyIds: PartyId[]): MultiplayerConstituency[] {
  if (partyIds.length === 0) throw new Error("At least one party is required to initialise support.");
  const equalShare = 100 / partyIds.length;
  return states.flatMap((state) => generateConstituencies(state, "parliament").map((seat) => ({
    id: seat.id,
    regionId: state.id,
    code: `${state.shortName}-${seat.code}`,
    name: seat.name,
    scope: "parliament" as const,
    electorate: seat.voters,
    // Equal-share policy is intentional: no solo aggregate is assigned to
    // newly created parties. Setup may later supply an explicit scenario.
    support: partyIds.map((partyId) => ({ partyId, value: equalShare })),
  })));
}
