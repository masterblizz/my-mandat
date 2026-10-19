import type { MultiplayerSnapshot } from "./domain";

export type OfficialSeatResult = { constituencyId: string; winningPartyId: string | null; candidateId: string | null; support: number | null };

/** Pure official-count projection: only nominated parties can win a seat.
 * Ties use stable party-id ordering, never input ordering or wall-clock data. */
export function resolveOfficialSeatResults(snapshot: MultiplayerSnapshot): OfficialSeatResult[] {
  return snapshot.constituencies.map((seat) => {
    const nominated = snapshot.nominations.filter((nomination) => nomination.constituencyId === seat.id);
    if (!nominated.length) return { constituencyId: seat.id, winningPartyId: null, candidateId: null, support: null };
    const ranked = nominated.map((nomination) => ({ nomination, support: seat.support.find((entry) => entry.partyId === nomination.partyId)?.value ?? 0 }))
      .sort((left, right) => right.support - left.support || left.nomination.partyId.localeCompare(right.nomination.partyId) || left.nomination.id.localeCompare(right.nomination.id));
    const winner = ranked[0];
    return { constituencyId: seat.id, winningPartyId: winner.nomination.partyId, candidateId: winner.nomination.id, support: winner.support };
  });
}
