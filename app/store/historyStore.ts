import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Outcome = "WIN" | "LOSE" | "INCOMPLETE";
export type Difficulty = "easy" | "normal" | "hard" | "nightmare";

export interface GameRecord {
  id: string;
  date: string;
  electionName: string;
  leaderName: string;
  party: string;
  difficulty: Difficulty;
  outcome: Outcome;
  seatsWon: number;
  totalSeats: number;
  majorityTarget: number;
  nationalSupport: number;
  daysPlayed: number;
  totalDays: number;
  statesWon: number;
  totalStates: number;
  topState: string;
  worstState: string;
  notes?: string;
}

interface HistoryState {
  records: GameRecord[];
  addRecord: (record: Omit<GameRecord, "id">) => void;
  clearHistory: () => void;
}

function recordFingerprint(record: Omit<GameRecord, "id">) {
  return [
    record.date,
    record.electionName,
    record.leaderName,
    record.party,
    record.difficulty,
    record.outcome,
    record.seatsWon,
    record.daysPlayed,
    record.totalDays,
  ].join("|");
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (record) =>
        set((state) => {
          const fingerprint = recordFingerprint(record);
          const alreadySaved = state.records.some((existing) => recordFingerprint(existing) === fingerprint);
          if (alreadySaved) return state;

          return {
            records: [{ ...record, id: `rec-${Date.now()}` }, ...state.records],
          };
        }),
      clearHistory: () => set({ records: [] }),
    }),
    {
      name: "mymandat-history-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ records: state.records }),
    }
  )
);
