/**
 * Framework-free multiplayer game types. These types intentionally describe a
 * country snapshot, not a browser session or a database record.
 */
export type CountryId = string;
export type ElectionId = string;
export type TurnId = string;
export type PartyId = string;
export type RegionId = string;
export type ConstituencyId = string;
export type CandidateId = string;

export type ControllerType = "human" | "ai";
export type ElectionPhase = "campaign" | "polling" | "results" | "formation" | "term";
export type TurnPhase = "orders" | "resolving" | "complete";
export type PartyRole = "unassigned" | "government" | "coalition_partner" | "opposition";

export interface PartyResources {
  funds: number;
  manpower: number;
}

export interface CountryRules {
  readonly geographyTemplateId: "malaysia-v1";
  readonly maxOrdersPerPartyPerTurn: number;
  readonly campaign: Readonly<{ fundsCost: number; manpowerCost: number; baseSupportDelta: number; randomSupportDelta: number }>;
  readonly fundraising: Readonly<{ manpowerCost: number; fundsGain: number; randomFundsGain: number }>;
  /** Support is always normalised to these bounded percentage shares. */
  readonly support: Readonly<{ min: number; max: number; precision: number }>;
}

export interface CountryIdentity {
  id: CountryId;
  name: string;
  geographyTemplateId: CountryRules["geographyTemplateId"];
}

export interface Party {
  id: PartyId;
  name: string;
  abbreviation: string;
  colour: string;
  controller: ControllerType;
  role: PartyRole;
  resources: PartyResources;
}

export interface Region {
  id: RegionId;
  name: string;
  code: string;
  kind: "state" | "federal_territory";
}

export interface ConstituencySupport {
  readonly partyId: PartyId;
  readonly value: number;
}

export interface MultiplayerConstituency {
  id: ConstituencyId;
  regionId: RegionId;
  code: string;
  name: string;
  scope: "parliament" | "dun";
  electorate: number;
  support: ConstituencySupport[];
}

export interface CandidateNomination {
  id: CandidateId;
  partyId: PartyId;
  constituencyId: ConstituencyId;
  displayName: string;
}

export interface ElectionIdentity {
  id: ElectionId;
  sequence: number;
  phase: ElectionPhase;
}

export interface TurnIdentity {
  id: TurnId;
  number: number;
  phase: TurnPhase;
}

export interface MultiplayerSnapshot {
  version: 1;
  country: CountryIdentity;
  rules: CountryRules;
  election: ElectionIdentity;
  turn: TurnIdentity;
  regions: Region[];
  parties: Party[];
  constituencies: MultiplayerConstituency[];
  nominations: CandidateNomination[];
}

export interface OrderBase {
  id: string;
  partyId: PartyId;
  electionId: ElectionId;
  turnId: TurnId;
  phase: "campaign";
}

export interface CampaignOrder extends OrderBase {
  type: "campaign";
  constituencyId: ConstituencyId;
}

export interface FundraisingOrder extends OrderBase {
  type: "fundraising";
}

export type PlayerOrder = CampaignOrder | FundraisingOrder;

/** actorPartyId is established by the future authenticated API, never trusted from the browser payload. */
export interface AcceptedOrder {
  actorPartyId: PartyId;
  order: PlayerOrder;
}

export type OrderRejectionCode =
  | "DUPLICATE_ORDER_ID"
  | "UNKNOWN_PARTY"
  | "WRONG_OWNER"
  | "WRONG_ELECTION"
  | "WRONG_TURN"
  | "WRONG_PHASE"
  | "INVALID_TARGET"
  | "ACTION_LIMIT"
  | "INSUFFICIENT_RESOURCES";

export interface OrderRejectedEvent {
  type: "order_rejected";
  orderId: string;
  partyId: PartyId;
  reason: OrderRejectionCode;
}

export interface CampaignResolvedEvent {
  type: "campaign_resolved";
  orderId: string;
  partyId: PartyId;
  constituencyId: ConstituencyId;
  supportDelta: number;
}

export interface FundraisingResolvedEvent {
  type: "fundraising_resolved";
  orderId: string;
  partyId: PartyId;
  fundsGain: number;
}

export type ResolutionEvent = OrderRejectedEvent | CampaignResolvedEvent | FundraisingResolvedEvent;

export interface ResolutionResult {
  version: 1;
  seed: number;
  snapshot: MultiplayerSnapshot;
  events: ResolutionEvent[];
}
