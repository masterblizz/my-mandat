import { PARTY_MEMBERS, type PartyMember } from "./members";

export type CabinetFaction = "leadership" | "reformist" | "grassroots" | "youth" | "regional";
export type CabinetCommunity = "malay" | "chinese" | "indian" | "sabah" | "sarawak";
export type CabinetRegion = "north" | "central" | "south" | "east-coast" | "borneo";

export interface CabinetMemberTraits {
  gender: "woman" | "man";
  community: CabinetCommunity;
  faction: CabinetFaction;
  loyalty: number;
  ambition: number;
  scandalRisk: number;
}

const IDENTITY: Record<string, Pick<CabinetMemberTraits, "gender" | "community">> = {
  "pm-001": { gender: "man", community: "malay" },
  "pm-002": { gender: "woman", community: "malay" },
  "pm-003": { gender: "man", community: "malay" },
  "pm-004": { gender: "woman", community: "malay" },
  "pm-005": { gender: "man", community: "chinese" },
  "pm-006": { gender: "man", community: "malay" },
  "pm-007": { gender: "woman", community: "malay" },
  "pm-008": { gender: "man", community: "malay" },
  "pm-009": { gender: "woman", community: "indian" },
  "pm-010": { gender: "man", community: "chinese" },
  "pm-011": { gender: "man", community: "malay" },
  "pm-012": { gender: "woman", community: "malay" },
  "pm-013": { gender: "man", community: "sabah" },
  "pm-014": { gender: "woman", community: "sarawak" },
  "pm-015": { gender: "man", community: "malay" },
  "pm-016": { gender: "woman", community: "chinese" },
  "pm-017": { gender: "man", community: "malay" },
  "pm-018": { gender: "man", community: "malay" },
  "pm-019": { gender: "woman", community: "malay" },
  "pm-020": { gender: "man", community: "chinese" },
  "pm-021": { gender: "man", community: "malay" },
  "pm-022": { gender: "man", community: "chinese" },
  "pm-023": { gender: "woman", community: "malay" },
  "pm-024": { gender: "man", community: "malay" },
  "pm-025": { gender: "woman", community: "sabah" },
};

const NORTH = new Set(["perlis", "kedah", "penang", "perak"]);
const CENTRAL = new Set(["selangor", "wp", "wp-kuala-lumpur", "wp-putrajaya", "wp-labuan", "kuala-lumpur"]);
const SOUTH = new Set(["ns", "negeri-sembilan", "melaka", "johor"]);
const EAST_COAST = new Set(["kelantan", "terengganu", "pahang"]);

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function memberRegion(member: PartyMember): CabinetRegion {
  if (member.homeState === "sabah" || member.homeState === "sarawak") return "borneo";
  if (NORTH.has(member.homeState)) return "north";
  if (SOUTH.has(member.homeState)) return "south";
  if (EAST_COAST.has(member.homeState)) return "east-coast";
  if (CENTRAL.has(member.homeState)) return "central";
  return "central";
}

export function getMemberTraits(member: PartyMember): CabinetMemberTraits {
  const identity = IDENTITY[member.id] ?? { gender: "man" as const, community: "malay" as const };
  const regional = memberRegion(member) === "borneo";
  const faction: CabinetFaction = regional ? "regional"
    : member.specialty === "youth" ? "youth"
      : member.specialty === "grassroots" || member.specialty === "rural" ? "grassroots"
        : member.specialty === "urban" || member.specialty === "media" ? "reformist"
          : "leadership";
  const ambition = clamp(member.influence * .48 + member.charisma * .32 + (member.experience === "veteran" ? 16 : member.experience === "rising" ? 10 : 5));
  const loyalty = clamp(48 + member.credibility * .42 - Math.max(0, ambition - 65) * .32 + (faction === "leadership" ? 5 : 0));
  const scandalRisk = clamp(30 - member.credibility * .2 + ambition * .24 + (member.specialty === "media" ? 5 : 0));
  return { ...identity, faction, loyalty, ambition, scandalRisk };
}

export interface CabinetBalance {
  score: number;
  appointed: number;
  women: number;
  emerging: number;
  borneo: number;
  territorial: number;
  regions: number;
  communities: number;
  averageLoyalty: number;
  atRisk: string[];
  trustDelta: number;
  stabilityDelta: number;
}

export function evaluateCabinet(
  appointments: Record<string, string | null>,
  ministerLoyalty: Record<string, number> = {},
  options: { isPrn?: boolean; stateId?: string } = {},
): CabinetBalance {
  const ids = Array.from(new Set(Object.values(appointments).filter(Boolean) as string[]));
  const members = ids.map(id => PARTY_MEMBERS.find(member => member.id === id)).filter((member): member is PartyMember => !!member);
  const appointed = members.length;
  if (!appointed) return { score: 0, appointed: 0, women: 0, emerging: 0, borneo: 0, territorial: 0, regions: 0, communities: 0, averageLoyalty: 0, atRisk: [], trustDelta: -2, stabilityDelta: -2 };

  const traits = members.map(member => ({ member, traits: getMemberTraits(member), loyalty: ministerLoyalty[member.id] ?? getMemberTraits(member).loyalty }));
  const women = traits.filter(item => item.traits.gender === "woman").length;
  const emerging = traits.filter(item => item.member.experience !== "veteran").length;
  const borneo = traits.filter(item => memberRegion(item.member) === "borneo").length;
  const normalizedState = options.stateId === "negeri-sembilan" ? "ns" : options.stateId?.startsWith("wp-") ? "wp" : options.stateId;
  const territorial = options.isPrn ? traits.filter(item => item.member.homeState === normalizedState).length : borneo;
  const regions = new Set(traits.map(item => memberRegion(item.member))).size;
  const communities = new Set(traits.map(item => item.traits.community)).size;
  const averageLoyalty = Math.round(traits.reduce((sum, item) => sum + item.loyalty, 0) / appointed);
  const atRisk = traits.filter(item => item.loyalty < 45 || item.traits.ambition - item.loyalty >= 20).map(item => item.member.id);
  const targetBorneo = appointed >= 8 ? 2 : 1;
  const targetRegions = Math.min(4, appointed);
  const targetCommunities = Math.min(3, appointed);
  const score = clamp(options.isPrn
    ? Math.min(1, women / Math.max(1, appointed * .3)) * 25
      + Math.min(1, emerging / Math.max(1, appointed * .35)) * 20
      + Math.min(1, territorial / Math.max(1, appointed * .6)) * 40
      + Math.min(1, communities / targetCommunities) * 15
    : Math.min(1, women / Math.max(1, appointed * .3)) * 25
      + Math.min(1, emerging / Math.max(1, appointed * .35)) * 20
      + Math.min(1, borneo / targetBorneo) * 20
      + Math.min(1, regions / targetRegions) * 20
      + Math.min(1, communities / targetCommunities) * 15,
  );
  const trustDelta = appointed < 4 ? 0 : score >= 80 ? 2 : score >= 65 ? 1 : score < 40 ? -2 : score < 55 ? -1 : 0;
  const stabilityDelta = appointed < 4 ? 0 : (averageLoyalty >= 72 ? 1 : averageLoyalty < 55 ? -2 : 0) - (atRisk.length ? 1 : 0) - (score < 40 ? 1 : 0);
  return { score, appointed, women, emerging, borneo, territorial, regions, communities, averageLoyalty, atRisk, trustDelta, stabilityDelta };
}

export function initialMinisterLoyalty(appointments: Record<string, string | null>, current: Record<string, number> = {}) {
  const next = { ...current };
  for (const id of Object.values(appointments)) {
    if (!id || next[id] !== undefined) continue;
    const member = PARTY_MEMBERS.find(candidate => candidate.id === id);
    if (member) next[id] = getMemberTraits(member).loyalty;
  }
  return next;
}
