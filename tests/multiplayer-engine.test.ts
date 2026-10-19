import assert from "node:assert/strict";
import { createMalaysiaCountrySnapshot } from "../app/multiplayer/countryFactory";
import type { AcceptedOrder, MultiplayerSnapshot, Party } from "../app/multiplayer/domain";
import { normaliseSupport, resolveTurn } from "../app/multiplayer/turnResolver";
import { resolveOfficialSeatResults } from "../app/multiplayer/electionResolution";

const parties: Party[] = [
  { id: "aurora", name: "Aurora", abbreviation: "AUR", colour: "#00ffff", controller: "human", role: "unassigned", resources: { funds: 200_000, manpower: 100 } },
  { id: "bintang", name: "Bintang", abbreviation: "BIN", colour: "#f0a500", controller: "human", role: "unassigned", resources: { funds: 200_000, manpower: 100 } },
  { id: "cendana", name: "Cendana", abbreviation: "CEN", colour: "#ff00aa", controller: "ai", role: "unassigned", resources: { funds: 200_000, manpower: 100 } },
];
const makeSnapshot = () => createMalaysiaCountrySnapshot({ countryId: "my-test", countryName: "Test Malaysia", electionId: "e-1", parties });
const order = (id: string, partyId = "aurora", extras: Record<string, unknown> = {}): AcceptedOrder => ({
  actorPartyId: partyId,
  order: { id, partyId, electionId: "e-1", turnId: "e-1:turn:1", phase: "campaign", type: "campaign", constituencyId: "johor-0", ...extras } as AcceptedOrder["order"],
});
const rejected = (snapshot: MultiplayerSnapshot, orders: AcceptedOrder[]) => resolveTurn({ snapshot, acceptedOrders: orders, seed: 7 }).events.filter((event) => event.type === "order_rejected");

{ const input = makeSnapshot(); const orders = [order("a"), order("b", "bintang")]; assert.deepEqual(resolveTurn({ snapshot: input, acceptedOrders: orders, seed: 41 }), resolveTurn({ snapshot: input, acceptedOrders: orders, seed: 41 })); }
{ const result = resolveTurn({ snapshot: makeSnapshot(), acceptedOrders: [order("a"), order("b", "bintang")], seed: 1 }); const support = result.snapshot.constituencies.find((seat) => seat.id === "johor-0")!.support; assert(support.find((entry) => entry.partyId === "aurora")!.value > 33); assert(support.find((entry) => entry.partyId === "bintang")!.value > 33); }
{ const snapshot = makeSnapshot(); const first = resolveTurn({ snapshot, acceptedOrders: [order("z", "bintang"), order("a")], seed: 8 }); const second = resolveTurn({ snapshot, acceptedOrders: [order("a"), order("z", "bintang")], seed: 8 }); assert.deepEqual(first, second); }
{ const snapshot = makeSnapshot(); snapshot.parties[0].resources.funds = 75_000; const events = rejected(snapshot, [order("one"), order("two")]); assert.equal(events.length, 1); assert.equal(events[0].reason, "INSUFFICIENT_RESOURCES"); }
{ const snapshot = makeSnapshot(); const cases = [order("owner", "aurora", {}), order("election", "aurora", { electionId: "bad" }), order("turn", "aurora", { turnId: "bad" }), order("phase", "aurora", { phase: "results" }), order("target", "aurora", { constituencyId: "missing" })]; cases[0].actorPartyId = "bintang"; const events = rejected(snapshot, cases); assert.deepEqual(events.map((event) => event.reason), ["WRONG_OWNER", "WRONG_ELECTION", "WRONG_TURN", "WRONG_PHASE", "INVALID_TARGET"]); }
{ const events = rejected(makeSnapshot(), [order("same"), order("same", "bintang")]); assert(events.every((event) => event.reason === "DUPLICATE_ORDER_ID")); }
{ const snapshot = makeSnapshot(); const events = rejected(snapshot, [order("1"), order("2"), order("3")]); assert.equal(events.at(-1)!.reason, "ACTION_LIMIT"); }
{ const support = normaliseSupport([{ partyId: "a", value: 150 }, { partyId: "b", value: -10 }, { partyId: "c", value: 30 }], 0.1, 99, 2); assert.equal(support.reduce((sum, entry) => sum + entry.value, 0), 100); assert(support.every((entry) => entry.value >= 0 && entry.value <= 100)); }
{ const snapshot = makeSnapshot(); const before = structuredClone(snapshot); resolveTurn({ snapshot, acceptedOrders: [order("a")], seed: 2 }); assert.deepEqual(snapshot, before); }
{ const snapshot = makeSnapshot(); snapshot.nominations = [{ id: "n-b", partyId: "bintang", constituencyId: "johor-0", displayName: "B" }, { id: "n-a", partyId: "aurora", constituencyId: "johor-0", displayName: "A" }]; const seat = snapshot.constituencies.find((item) => item.id === "johor-0")!; seat.support = [{ partyId: "bintang", value: 50 }, { partyId: "aurora", value: 50 }, { partyId: "cendana", value: 0 }]; assert.deepEqual(resolveOfficialSeatResults(snapshot).find((item) => item.constituencyId === "johor-0"), { constituencyId: "johor-0", winningPartyId: "aurora", candidateId: "n-a", support: 50 }); }
console.log("multiplayer engine tests passed");
