import { malaysiaParliamentaryConstituencies, malaysiaRegions } from "./geography";
import type { CountryRules, MultiplayerSnapshot, Party } from "./domain";

export const DEFAULT_MULTIPLAYER_RULES: CountryRules = {
  geographyTemplateId: "malaysia-v1",
  maxOrdersPerPartyPerTurn: 2,
  // These intentionally use smaller, per-turn effects than the solo daily
  // operation model, because every party acts in the same resolution.
  campaign: { fundsCost: 50_000, manpowerCost: 20, baseSupportDelta: 1.5, randomSupportDelta: 1 },
  fundraising: { manpowerCost: 10, fundsGain: 35_000, randomFundsGain: 5_000 },
  support: { min: 0.1, max: 100, precision: 2 },
};

export function createMalaysiaCountrySnapshot(args: {
  countryId: string;
  countryName: string;
  electionId: string;
  parties: Party[];
  rules?: CountryRules;
}): MultiplayerSnapshot {
  const rules = args.rules ?? DEFAULT_MULTIPLAYER_RULES;
  return {
    version: 1,
    country: { id: args.countryId, name: args.countryName, geographyTemplateId: rules.geographyTemplateId },
    rules,
    election: { id: args.electionId, sequence: 1, phase: "campaign" },
    turn: { id: `${args.electionId}:turn:1`, number: 1, phase: "orders" },
    regions: malaysiaRegions(),
    parties: args.parties.map((party) => ({ ...party, resources: { ...party.resources } })),
    constituencies: malaysiaParliamentaryConstituencies(args.parties.map((party) => party.id)),
    nominations: [],
  };
}
