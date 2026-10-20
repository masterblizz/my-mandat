// Regions used by online worlds. Each system world covers one region, so its
// 100 players compete for a handful of parliamentary seats.
// Mirrors public.world_regions / world_region_seats; the SQL seed is generated
// from this list by scripts/online/gen-region-seats.ts.

import { generateConstituencies } from "../data/constituencies";
import { states } from "../data/states";

export type OnlineRegion = {
  id: string; stateId: string; nameMs: string; nameEn: string; headMs: string; headEn: string;
  /** Optional subset of the state's seats (KL excludes Putrajaya and Labuan). */
  seatFilter?: (constituencyId: string) => boolean;
};

// World rotation order: small/medium regions first so early worlds have close contests.
export const ONLINE_REGIONS: OnlineRegion[] = [
  { id: "kl", stateId: "wp", nameMs: "Kuala Lumpur", nameEn: "Kuala Lumpur", headMs: "Datuk Bandar", headEn: "Mayor", seatFilter: (id) => Number(id.split("-")[1]) <= 10 },
  { id: "penang", stateId: "penang", nameMs: "Pulau Pinang", nameEn: "Penang", headMs: "Ketua Menteri", headEn: "Chief Minister" },
  { id: "selangor", stateId: "selangor", nameMs: "Selangor", nameEn: "Selangor", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "johor", stateId: "johor", nameMs: "Johor", nameEn: "Johor", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "perak", stateId: "perak", nameMs: "Perak", nameEn: "Perak", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "melaka", stateId: "melaka", nameMs: "Melaka", nameEn: "Malacca", headMs: "Ketua Menteri", headEn: "Chief Minister" },
  { id: "ns", stateId: "ns", nameMs: "Negeri Sembilan", nameEn: "Negeri Sembilan", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "kedah", stateId: "kedah", nameMs: "Kedah", nameEn: "Kedah", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "kelantan", stateId: "kelantan", nameMs: "Kelantan", nameEn: "Kelantan", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "pahang", stateId: "pahang", nameMs: "Pahang", nameEn: "Pahang", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "terengganu", stateId: "terengganu", nameMs: "Terengganu", nameEn: "Terengganu", headMs: "Menteri Besar", headEn: "Menteri Besar" },
  { id: "sabah", stateId: "sabah", nameMs: "Sabah", nameEn: "Sabah", headMs: "Ketua Menteri", headEn: "Chief Minister" },
  { id: "sarawak", stateId: "sarawak", nameMs: "Sarawak", nameEn: "Sarawak", headMs: "Premier", headEn: "Premier" },
  { id: "perlis", stateId: "perlis", nameMs: "Perlis", nameEn: "Perlis", headMs: "Menteri Besar", headEn: "Menteri Besar" },
];

export type RegionSeat = { id: string; code: string; name: string; voters: number };

export function regionSeats(regionId: string | null | undefined): RegionSeat[] {
  const region = ONLINE_REGIONS.find((item) => item.id === regionId);
  if (!region) return [];
  const state = states.find((item) => item.id === region.stateId);
  if (!state) return [];
  return generateConstituencies(state)
    .filter((seat) => !region.seatFilter || region.seatFilter(seat.id))
    .map((seat) => ({ id: seat.id, code: seat.code, name: seat.name, voters: Math.round(seat.voters) }));
}

export function findRegion(regionId: string | null | undefined) {
  return ONLINE_REGIONS.find((item) => item.id === regionId) ?? null;
}
