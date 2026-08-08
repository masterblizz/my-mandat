import type { StateData } from "./states";

export interface Party {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  ideology: string;
  nationalSupport: number;
  projectedSeats: number;
  leader: string;
  founded: number;
}

export const parties: Party[] = [
  {
    id: "mandat",
    name: "Parti Mandat MY",
    abbreviation: "MANDAT",
    color: "#00d4ff",
    ideology: "Centre-progressive",
    nationalSupport: 47,
    projectedSeats: 94,
    leader: "Ali Rahman",
    founded: 2018,
  },
  {
    id: "lawan",
    name: "Parti Lawan",
    abbreviation: "LAWAN",
    color: "#ff8800",
    ideology: "Conservative-nationalist",
    nationalSupport: 38,
    projectedSeats: 68,
    leader: "Dato Ridhwan",
    founded: 1962,
  },
  {
    id: "others",
    name: "Others / Coalition",
    abbreviation: "OTHERS",
    color: "#8899aa",
    ideology: "Various",
    nationalSupport: 15,
    projectedSeats: 60,
    leader: "Various",
    founded: 0,
  },
];

export const nationalPollHistory = [
  { month: "Jan", mandat: 41, lawan: 42, others: 17 },
  { month: "Feb", mandat: 43, lawan: 41, others: 16 },
  { month: "Mar", mandat: 44, lawan: 40, others: 16 },
  { month: "Apr", mandat: 45, lawan: 39, others: 16 },
  { month: "May", mandat: 46, lawan: 38, others: 16 },
  { month: "Jun", mandat: 47, lawan: 38, others: 15 },
];

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 11), 0x165667b1);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

const POLL_HISTORY_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

// Same shape as nationalPollHistory, but scoped to one state — /polling's
// "6-month trend" chart used to always show nationalPollHistory even in a
// PRN (single-state) game, the one leak the rest of that page's isPrn
// branching missed. Walks backward from the state's actual current
// mandat/lawan/others support (so the most recent point always matches
// what the rest of the page already shows) using a small per-state seeded
// drift — same seeding style as generateConstituencies — so each state
// gets its own stable trend shape instead of identical flat months or a
// value that changes on every render.
export function getStatePollHistory(state: Pick<StateData, "id" | "mandatSupport" | "lawanSupport" | "othersSupport">) {
  const seed = state.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 53 + 911;
  const rand = seededRand(seed);
  const points: { month: string; mandat: number; lawan: number; others: number }[] = [];
  let mandat = state.mandatSupport;
  let lawan = state.lawanSupport;

  for (let i = POLL_HISTORY_MONTHS.length - 1; i >= 0; i--) {
    points.unshift({
      month: POLL_HISTORY_MONTHS[i],
      mandat: Math.round(mandat),
      lawan: Math.round(lawan),
      others: Math.max(0, Math.round(100 - mandat - lawan)),
    });
    const drift = (rand() - 0.5) * 6;
    mandat = Math.max(10, Math.min(70, mandat - drift));
    lawan = Math.max(10, Math.min(70, lawan + drift * 0.7));
  }

  return points;
}
