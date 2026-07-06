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
