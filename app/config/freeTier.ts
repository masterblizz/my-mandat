// What a free account can play: the national PRU, and a PRN in Perlis
// only. Every other negeri's PRN needs Premium.
export const FREE_PRN_STATE = "perlis";

export function prnStateUnlocked(stateId: string, hasPremium: boolean): boolean {
  return hasPremium || stateId === FREE_PRN_STATE;
}
