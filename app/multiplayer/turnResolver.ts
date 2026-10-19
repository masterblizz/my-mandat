import type {
  AcceptedOrder, MultiplayerConstituency, MultiplayerSnapshot, OrderRejectionCode,
  PlayerOrder, ResolutionEvent, ResolutionResult,
} from "./domain";

export interface ResolveTurnInput {
  snapshot: MultiplayerSnapshot;
  acceptedOrders: AcceptedOrder[];
  seed: number;
}

interface ValidOrder { submission: AcceptedOrder; order: PlayerOrder }

/**
 * Pure, deterministic simultaneous-turn resolver. Campaign deltas are summed
 * against the same pre-turn support vector, then normalised once per seat.
 */
export function resolveTurn(input: ResolveTurnInput): ResolutionResult {
  const { snapshot, seed } = input;
  const events: ResolutionEvent[] = [];
  const partyById = new Map(snapshot.parties.map((party) => [party.id, party]));
  const constituencyIds = new Set(snapshot.constituencies.map((seat) => seat.id));
  const duplicateIds = duplicateOrderIds(input.acceptedOrders);
  const preliminary: ValidOrder[] = [];

  for (const submission of input.acceptedOrders) {
    const order = submission.order;
    const failure = duplicateIds.has(order.id)
      ? "DUPLICATE_ORDER_ID"
      : basicFailure(snapshot, submission, partyById, constituencyIds);
    if (failure) events.push(rejected(order, failure));
    else preliminary.push({ submission, order });
  }

  // Deterministic order establishes validation/event order only; it never
  // decides which competing campaign gets its effect first.
  const ordered = [...preliminary].sort((a, b) => a.order.id.localeCompare(b.order.id) || a.order.partyId.localeCompare(b.order.partyId));
  const valid: ValidOrder[] = [];
  const perParty = new Map<string, { count: number; funds: number; manpower: number }>();
  for (const item of ordered) {
    const cost = orderCost(snapshot, item.order);
    const spent = perParty.get(item.order.partyId) ?? { count: 0, funds: 0, manpower: 0 };
    const party = partyById.get(item.order.partyId)!;
    const exceedsActions = spent.count + 1 > snapshot.rules.maxOrdersPerPartyPerTurn;
    const exceedsResources = spent.funds + cost.funds > party.resources.funds || spent.manpower + cost.manpower > party.resources.manpower;
    if (exceedsActions) {
      events.push(rejected(item.order, "ACTION_LIMIT"));
    } else if (exceedsResources) {
      events.push(rejected(item.order, "INSUFFICIENT_RESOURCES"));
    } else {
      perParty.set(item.order.partyId, { count: spent.count + 1, funds: spent.funds + cost.funds, manpower: spent.manpower + cost.manpower });
      valid.push(item);
    }
  }

  const partyResources = new Map(snapshot.parties.map((party) => [party.id, { ...party.resources }]));
  perParty.forEach((spent, partyId) => {
    const resources = partyResources.get(partyId)!;
    resources.funds -= spent.funds;
    resources.manpower -= spent.manpower;
  });
  const campaignDeltas = new Map<string, Map<string, number>>();
  for (const { order } of valid) {
    if (order.type === "fundraising") {
      const gain = snapshot.rules.fundraising.fundsGain + randomAmount(seed, order.id, snapshot.rules.fundraising.randomFundsGain);
      partyResources.get(order.partyId)!.funds += gain;
      events.push({ type: "fundraising_resolved", orderId: order.id, partyId: order.partyId, fundsGain: gain });
    } else {
      const delta = snapshot.rules.campaign.baseSupportDelta + randomAmount(seed, order.id, snapshot.rules.campaign.randomSupportDelta);
      const byParty = campaignDeltas.get(order.constituencyId) ?? new Map<string, number>();
      byParty.set(order.partyId, (byParty.get(order.partyId) ?? 0) + delta);
      campaignDeltas.set(order.constituencyId, byParty);
      events.push({ type: "campaign_resolved", orderId: order.id, partyId: order.partyId, constituencyId: order.constituencyId, supportDelta: delta });
    }
  }

  const constituencies = snapshot.constituencies.map((seat) => resolveConstituency(snapshot, seat, campaignDeltas.get(seat.id)));
  return {
    version: 1,
    seed,
    snapshot: {
      ...snapshot,
      parties: snapshot.parties.map((party) => ({ ...party, resources: partyResources.get(party.id)! })),
      constituencies,
      turn: { ...snapshot.turn, phase: "complete" },
    },
    events,
  };
}

function basicFailure(snapshot: MultiplayerSnapshot, submission: AcceptedOrder, parties: Map<string, unknown>, constituencyIds: Set<string>): OrderRejectionCode | null {
  const order = submission.order;
  if (!parties.has(order.partyId)) return "UNKNOWN_PARTY";
  if (submission.actorPartyId !== order.partyId) return "WRONG_OWNER";
  if (order.electionId !== snapshot.election.id) return "WRONG_ELECTION";
  if (order.turnId !== snapshot.turn.id) return "WRONG_TURN";
  if (snapshot.election.phase !== "campaign" || snapshot.turn.phase !== "orders" || order.phase !== "campaign") return "WRONG_PHASE";
  if (order.type === "campaign" && !constituencyIds.has(order.constituencyId)) return "INVALID_TARGET";
  return null;
}

function orderCost(snapshot: MultiplayerSnapshot, order: PlayerOrder) {
  return order.type === "campaign"
    ? { funds: snapshot.rules.campaign.fundsCost, manpower: snapshot.rules.campaign.manpowerCost }
    : { funds: 0, manpower: snapshot.rules.fundraising.manpowerCost };
}

function duplicateOrderIds(orders: AcceptedOrder[]) {
  const count = new Map<string, number>();
  orders.forEach(({ order }) => count.set(order.id, (count.get(order.id) ?? 0) + 1));
  const duplicates = new Set<string>();
  count.forEach((value, id) => { if (value > 1) duplicates.add(id); });
  return duplicates;
}

function rejected(order: PlayerOrder, reason: OrderRejectionCode): ResolutionEvent {
  return { type: "order_rejected", orderId: order.id, partyId: order.partyId, reason };
}

function resolveConstituency(snapshot: MultiplayerSnapshot, seat: MultiplayerConstituency, deltas?: Map<string, number>): MultiplayerConstituency {
  if (!deltas) return { ...seat, support: seat.support.map((entry) => ({ ...entry })) };
  const entries = seat.support.map((entry) => ({ ...entry, value: entry.value + (deltas.get(entry.partyId) ?? 0) }));
  return { ...seat, support: normaliseSupport(entries, snapshot.rules.support.min, snapshot.rules.support.max, snapshot.rules.support.precision) };
}

/** Clamp shares, then scale them to exactly 100 and round with residual correction. */
export function normaliseSupport<T extends { partyId: string; value: number }>(entries: T[], min: number, max: number, precision: number): T[] {
  const factor = 10 ** precision;
  const clamped = entries.map((entry) => ({ ...entry, value: Math.max(min, Math.min(max, entry.value)) }));
  const total = clamped.reduce((sum, entry) => sum + entry.value, 0);
  const scaled = clamped.map((entry) => ({ ...entry, value: Math.round((entry.value / total) * 100 * factor) / factor }));
  const residual = Math.round((100 - scaled.reduce((sum, entry) => sum + entry.value, 0)) * factor) / factor;
  if (scaled.length) scaled.sort((a, b) => b.value - a.value || a.partyId.localeCompare(b.partyId))[0].value += residual;
  return scaled.sort((a, b) => a.partyId.localeCompare(b.partyId)) as T[];
}

function randomAmount(seed: number, key: string, spread: number) {
  if (spread <= 0) return 0;
  return Math.floor(seededUnit(seed, key) * (spread + 1));
}

function seededUnit(seed: number, key: string) {
  let value = seed >>> 0;
  for (let index = 0; index < key.length; index += 1) value = Math.imul(value ^ key.charCodeAt(index), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}
