// What a free account can play: the national PRU, and a PRN in Perlis
// only. Every other negeri's PRN needs Premium.
export const FREE_PRN_STATE = "perlis";

export function prnStateUnlocked(stateId: string, hasPremium: boolean): boolean {
  return hasPremium || stateId === FREE_PRN_STATE;
}

/** A saved PRN run in a negeri this account cannot play (e.g. Premium lapsed). */
export function savePrnLocked(state: { settings?: { electionScope?: string; prnStateId?: string }; leader?: { homeState?: string } }, hasPremium: boolean): boolean {
  if ((state.settings?.electionScope ?? "pru") !== "prn") return false;
  return !prnStateUnlocked(state.settings?.prnStateId ?? state.leader?.homeState ?? "", hasPremium);
}
