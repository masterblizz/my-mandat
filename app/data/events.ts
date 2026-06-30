export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: "political" | "economic" | "social" | "media" | "ground";
  impact: {
    national?: number;
    states?: string[];
    stateImpact?: number;
    resource?: "funds" | "manpower" | "media";
    resourceChange?: number;
  };
  probability: number;
  day: number;
}

export const gameEvents: GameEvent[] = [
  {
    id: "ev01",
    title: "Opposition Leader Gaffe",
    description: "Parti Lawan leader makes controversial statement about minority rights. National sentiment shifts.",
    type: "political",
    impact: { national: 2.5, states: ["selangor", "penang", "wp"], stateImpact: 3 },
    probability: 0.15,
    day: 3,
  },
  {
    id: "ev02",
    title: "Petrol Price Hike",
    description: "Government announces fuel subsidy reduction. Urban voters react negatively.",
    type: "economic",
    impact: { national: -1.5, states: ["selangor", "wp", "penang", "johor"], stateImpact: -2.5 },
    probability: 0.2,
    day: 5,
  },
  {
    id: "ev03",
    title: "MANDAT Youth Rally",
    description: "Massive youth rally in KL draws 50,000 attendees. Social media buzzes.",
    type: "political",
    impact: { national: 1.8, states: ["wp", "selangor"], stateImpact: 4 },
    probability: 0.3,
    day: 7,
  },
  {
    id: "ev04",
    title: "Corruption Scandal — Lawan MP",
    description: "Leaked documents reveal financial misconduct by senior Lawan parliamentarian.",
    type: "media",
    impact: { national: 3.2, states: ["perak", "kedah"], stateImpact: 5 },
    probability: 0.12,
    day: 10,
  },
  {
    id: "ev05",
    title: "Flood Crisis — East Coast",
    description: "Severe flooding in Kelantan and Terengganu. Voters demand government response.",
    type: "social",
    impact: { national: -0.5, states: ["kelantan", "terengganu", "pahang"], stateImpact: -1.5 },
    probability: 0.25,
    day: 8,
  },
  {
    id: "ev06",
    title: "Business Leaders Endorse MANDAT",
    description: "FMM and ACCCIM issue joint endorsement of MANDAT economic policies.",
    type: "media",
    impact: { national: 1.5, states: ["selangor", "johor", "penang"], stateImpact: 2.5 },
    probability: 0.18,
    day: 12,
  },
  {
    id: "ev07",
    title: "Sabah Kingmaker Talks",
    description: "Sabah-based parties open to coalition discussions with MANDAT.",
    type: "political",
    impact: { national: 0.5, states: ["sabah"], stateImpact: 8 },
    probability: 0.22,
    day: 15,
  },
  {
    id: "ev08",
    title: "Digital Economy Announcement",
    description: "MANDAT announces RM 5B digital economy plan. Tech sector responds positively.",
    type: "economic",
    impact: { national: 2.0, states: ["selangor", "wp", "penang"], stateImpact: 3.5 },
    probability: 0.35,
    day: 6,
  },
  {
    id: "ev09",
    title: "Viral Social Media Controversy",
    description: "Edited video of MANDAT leader circulates. Rapid response team needed.",
    type: "media",
    impact: { national: -2.0, resource: "media", resourceChange: -200000 },
    probability: 0.15,
    day: 11,
  },
  {
    id: "ev10",
    title: "Borneo Autonomy Promise",
    description: "MANDAT promises expanded autonomy for Sabah and Sarawak under MA63.",
    type: "political",
    impact: { states: ["sabah", "sarawak"], stateImpact: 6 },
    probability: 0.4,
    day: 9,
  },
  {
    id: "ev11",
    title: "Cost of Living Survey Released",
    description: "New survey shows 73% of Malaysians struggling. MANDAT responds with aid package.",
    type: "economic",
    impact: { national: 1.2 },
    probability: 0.5,
    day: 4,
  },
  {
    id: "ev12",
    title: "Opposition Internal Conflict",
    description: "Factional dispute within Lawan coalition surfaces publicly.",
    type: "political",
    impact: { national: 2.0 },
    probability: 0.2,
    day: 14,
  },
  {
    id: "ev13",
    title: "Rural Roads Funding Announced",
    description: "MANDAT pledges rural infrastructure fund. Northern states react positively.",
    type: "social",
    impact: { states: ["kedah", "kelantan", "terengganu", "perak"], stateImpact: 2 },
    probability: 0.3,
    day: 16,
  },
  {
    id: "ev14",
    title: "Celebrity Endorsement",
    description: "Popular national artist endorses MANDAT. Youth engagement increases.",
    type: "media",
    impact: { national: 1.0, states: ["wp", "selangor", "johor"], stateImpact: 1.5 },
    probability: 0.25,
    day: 18,
  },
  {
    id: "ev15",
    title: "New Polling Data Released",
    description: "Independent pollster shows MANDAT at 48%, highest in campaign period.",
    type: "media",
    impact: { national: 0.8 },
    probability: 0.6,
    day: 20,
  },
];

export const alerts = [
  { id: "a1", time: "21:32", message: "Johor trending +7% in urban areas after ceramah", type: "positive" },
  { id: "a2", time: "21:31", message: "Opposition rally announced in Kuala Lumpur — counter-event needed", type: "warning" },
  { id: "a3", time: "21:05", message: "New polling data from Sabah shows +4% swing to MANDAT", type: "positive" },
  { id: "a4", time: "20:48", message: "Media buy in Perak confirmed — 3 prime time slots secured", type: "info" },
  { id: "a5", time: "20:22", message: "Youth volunteer numbers exceed target by 12% in Selangor", type: "positive" },
  { id: "a6", time: "19:55", message: "Flood relief effort in Pahang boosts ground team credibility", type: "positive" },
  { id: "a7", time: "19:40", message: "Lawan ceramah draws 8,000 in Kelantan — expected stronghold", type: "neutral" },
];
