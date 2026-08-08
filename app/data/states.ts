export interface StateData {
  id: string;
  name: string;
  shortName: string;
  seats: number;
  dunSeats: number;
  area: number; // km²
  mandatSupport: number;
  lawanSupport: number;
  othersSupport: number;
  swingProbability: number;
  population: number;
  registeredVoters: number;
  turnoutTarget: number;
  groundStrength: number;
  winProbability: number;
  trend: number;
  projectedSeats: number;
  keyIssues: string[];
  demographics: {
    urban: number;
    rural: number;
    youth: number;
    malay: number;
    chinese: number;
    indian: number;
    others: number;
  };
  region: "peninsular" | "borneo";
  status: "winning" | "losing" | "contested";
}

export const states: StateData[] = [
  {
    id: "johor",
    name: "Johor",
    shortName: "JHR",
    seats: 26,
    dunSeats: 56,
    area: 19102,
    mandatSupport: 45,
    lawanSupport: 38,
    othersSupport: 17,
    swingProbability: 18,
    population: 4000000,
    registeredVoters: 2400000,
    turnoutTarget: 75,
    groundStrength: 128,
    winProbability: 62,
    trend: 3.2,
    projectedSeats: 14,
    keyIssues: ["Cost of living", "Job opportunities", "Iskandar development"],
    demographics: { urban: 70, rural: 30, youth: 28, malay: 55, chinese: 35, indian: 7, others: 3 },
    region: "peninsular",
    status: "contested",
  },
  {
    id: "kedah",
    name: "Kedah",
    shortName: "KDH",
    seats: 15,
    dunSeats: 36,
    area: 9500,
    mandatSupport: 38,
    lawanSupport: 52,
    othersSupport: 10,
    swingProbability: 22,
    population: 2200000,
    registeredVoters: 1300000,
    turnoutTarget: 72,
    groundStrength: 54,
    winProbability: 35,
    trend: -1.5,
    projectedSeats: 5,
    keyIssues: ["Agriculture subsidies", "Rural development", "Education"],
    demographics: { urban: 35, rural: 65, youth: 26, malay: 76, chinese: 15, indian: 7, others: 2 },
    region: "peninsular",
    status: "losing",
  },
  {
    id: "kelantan",
    name: "Kelantan",
    shortName: "KTN",
    seats: 14,
    dunSeats: 45,
    area: 15099,
    mandatSupport: 25,
    lawanSupport: 62,
    othersSupport: 13,
    swingProbability: 8,
    population: 1900000,
    registeredVoters: 1100000,
    turnoutTarget: 78,
    groundStrength: 32,
    winProbability: 15,
    trend: -0.5,
    projectedSeats: 2,
    keyIssues: ["Religious governance", "Economic development", "Infrastructure"],
    demographics: { urban: 22, rural: 78, youth: 30, malay: 94, chinese: 4, indian: 1, others: 1 },
    region: "peninsular",
    status: "losing",
  },
  {
    id: "melaka",
    name: "Melaka",
    shortName: "MLK",
    seats: 6,
    dunSeats: 28,
    area: 1664,
    mandatSupport: 52,
    lawanSupport: 33,
    othersSupport: 15,
    swingProbability: 25,
    population: 1000000,
    registeredVoters: 620000,
    turnoutTarget: 80,
    groundStrength: 48,
    winProbability: 75,
    trend: 4.1,
    projectedSeats: 4,
    keyIssues: ["Tourism development", "Heritage conservation", "Manufacturing"],
    demographics: { urban: 65, rural: 35, youth: 27, malay: 60, chinese: 28, indian: 10, others: 2 },
    region: "peninsular",
    status: "winning",
  },
  {
    id: "ns",
    name: "Negeri Sembilan",
    shortName: "N9",
    seats: 8,
    dunSeats: 36,
    area: 6686,
    mandatSupport: 48,
    lawanSupport: 36,
    othersSupport: 16,
    swingProbability: 20,
    population: 1200000,
    registeredVoters: 750000,
    turnoutTarget: 76,
    groundStrength: 42,
    winProbability: 68,
    trend: 2.3,
    projectedSeats: 5,
    keyIssues: ["Industrialization", "Cost of living", "Transport"],
    demographics: { urban: 62, rural: 38, youth: 28, malay: 55, chinese: 25, indian: 18, others: 2 },
    region: "peninsular",
    status: "winning",
  },
  {
    id: "pahang",
    name: "Pahang",
    shortName: "PHG",
    seats: 14,
    dunSeats: 42,
    area: 36137,
    mandatSupport: 55,
    lawanSupport: 30,
    othersSupport: 15,
    swingProbability: 15,
    population: 1700000,
    registeredVoters: 1000000,
    turnoutTarget: 74,
    groundStrength: 56,
    winProbability: 82,
    trend: 5.2,
    projectedSeats: 10,
    keyIssues: ["Flood management", "Forestry", "Tourism"],
    demographics: { urban: 42, rural: 58, youth: 25, malay: 72, chinese: 18, indian: 6, others: 4 },
    region: "peninsular",
    status: "winning",
  },
  {
    id: "perak",
    name: "Perak",
    shortName: "PRK",
    seats: 24,
    dunSeats: 59,
    area: 21035,
    mandatSupport: 42,
    lawanSupport: 40,
    othersSupport: 18,
    swingProbability: 28,
    population: 2700000,
    registeredVoters: 1650000,
    turnoutTarget: 73,
    groundStrength: 88,
    winProbability: 52,
    trend: 1.8,
    projectedSeats: 12,
    keyIssues: ["Mining industry", "Cost of living", "Infrastructure"],
    demographics: { urban: 55, rural: 45, youth: 27, malay: 55, chinese: 30, indian: 13, others: 2 },
    region: "peninsular",
    status: "contested",
  },
  {
    id: "perlis",
    name: "Perlis",
    shortName: "PLS",
    seats: 3,
    dunSeats: 18,
    area: 821,
    mandatSupport: 58,
    lawanSupport: 32,
    othersSupport: 10,
    swingProbability: 12,
    population: 280000,
    registeredVoters: 175000,
    turnoutTarget: 79,
    groundStrength: 18,
    winProbability: 85,
    trend: 3.0,
    projectedSeats: 2,
    keyIssues: ["Border trade", "Agriculture", "Border security"],
    demographics: { urban: 30, rural: 70, youth: 24, malay: 82, chinese: 12, indian: 4, others: 2 },
    region: "peninsular",
    status: "winning",
  },
  {
    id: "penang",
    name: "Penang",
    shortName: "PNG",
    seats: 13,
    dunSeats: 40,
    area: 1048,
    mandatSupport: 35,
    lawanSupport: 40,
    othersSupport: 25,
    swingProbability: 30,
    population: 1800000,
    registeredVoters: 1100000,
    turnoutTarget: 82,
    groundStrength: 62,
    winProbability: 38,
    trend: -2.1,
    projectedSeats: 4,
    keyIssues: ["Reclamation projects", "Heritage", "Tech industry"],
    demographics: { urban: 90, rural: 10, youth: 32, malay: 40, chinese: 43, indian: 10, others: 7 },
    region: "peninsular",
    status: "contested",
  },
  {
    id: "sabah",
    name: "Sabah",
    shortName: "SBH",
    seats: 25,
    dunSeats: 73,
    area: 73631,
    mandatSupport: 40,
    lawanSupport: 35,
    othersSupport: 25,
    swingProbability: 35,
    population: 4200000,
    registeredVoters: 1900000,
    turnoutTarget: 68,
    groundStrength: 76,
    winProbability: 55,
    trend: 2.8,
    projectedSeats: 12,
    keyIssues: ["Illegal immigration", "MA63 rights", "Poverty"],
    demographics: { urban: 40, rural: 60, youth: 35, malay: 18, chinese: 10, indian: 1, others: 71 },
    region: "borneo",
    status: "contested",
  },
  {
    id: "sarawak",
    name: "Sarawak",
    shortName: "SWK",
    seats: 31,
    dunSeats: 82,
    area: 124450,
    mandatSupport: 50,
    lawanSupport: 28,
    othersSupport: 22,
    swingProbability: 20,
    population: 2900000,
    registeredVoters: 1500000,
    turnoutTarget: 65,
    groundStrength: 84,
    winProbability: 70,
    trend: 4.5,
    projectedSeats: 18,
    keyIssues: ["MA63 rights", "Resource wealth", "Native land rights"],
    demographics: { urban: 50, rural: 50, youth: 30, malay: 30, chinese: 24, indian: 0, others: 46 },
    region: "borneo",
    status: "winning",
  },
  {
    id: "selangor",
    name: "Selangor",
    shortName: "SGR",
    seats: 22,
    dunSeats: 56,
    area: 8104,
    mandatSupport: 52,
    lawanSupport: 35,
    othersSupport: 13,
    swingProbability: 22,
    population: 6700000,
    registeredVoters: 4200000,
    turnoutTarget: 75,
    groundStrength: 128,
    winProbability: 72,
    trend: 3.5,
    projectedSeats: 14,
    keyIssues: ["Water management", "Housing", "Traffic congestion"],
    demographics: { urban: 92, rural: 8, youth: 35, malay: 55, chinese: 28, indian: 13, others: 4 },
    region: "peninsular",
    status: "winning",
  },
  {
    id: "terengganu",
    name: "Terengganu",
    shortName: "TRG",
    seats: 8,
    dunSeats: 32,
    area: 13035,
    mandatSupport: 30,
    lawanSupport: 58,
    othersSupport: 12,
    swingProbability: 10,
    population: 1300000,
    registeredVoters: 820000,
    turnoutTarget: 77,
    groundStrength: 28,
    winProbability: 22,
    trend: -1.0,
    projectedSeats: 2,
    keyIssues: ["Oil royalties", "Fishing industry", "Islamic governance"],
    demographics: { urban: 28, rural: 72, youth: 31, malay: 95, chinese: 4, indian: 0, others: 1 },
    region: "peninsular",
    status: "losing",
  },
  {
    id: "wp",
    name: "Wilayah Persekutuan",
    shortName: "WP",
    seats: 13,
    dunSeats: 0,
    area: 383, // KL (243) + Putrajaya (49) + Labuan (91)
    mandatSupport: 38,
    lawanSupport: 42,
    othersSupport: 20,
    swingProbability: 32,
    population: 1800000,
    registeredVoters: 1050000,
    turnoutTarget: 80,
    groundStrength: 70,
    winProbability: 42,
    trend: -0.8,
    projectedSeats: 5,
    keyIssues: ["Affordable housing", "Cost of living", "Public transport", "Federal administration"],
    demographics: { urban: 100, rural: 0, youth: 40, malay: 44, chinese: 38, indian: 10, others: 8 },
    region: "peninsular",
    status: "contested",
  },
];

export function getStateById(id: string): StateData | undefined {
  return states.find((s) => s.id === id);
}

export function getTotalProjectedSeats(): number {
  return states.reduce((sum, s) => sum + s.projectedSeats, 0);
}

export function getWinningStates(): StateData[] {
  return states.filter((s) => s.status === "winning");
}

export function getContestedStates(): StateData[] {
  return states.filter((s) => s.status === "contested");
}

export interface NationalStats {
  population: number;
  area: number;
  ethnic: { malay: number; chinese: number; indian: number; others: number };
}

// demographics.* are per-state PERCENTAGES, so the national breakdown is a
// population-weighted average, not a plain average of the 14 percentages.
export function getNationalStats(): NationalStats {
  const population = states.reduce((sum, s) => sum + s.population, 0);
  const area = states.reduce((sum, s) => sum + s.area, 0);
  const weighted = states.reduce(
    (acc, s) => ({
      malay: acc.malay + (s.demographics.malay * s.population) / 100,
      chinese: acc.chinese + (s.demographics.chinese * s.population) / 100,
      indian: acc.indian + (s.demographics.indian * s.population) / 100,
      others: acc.others + (s.demographics.others * s.population) / 100,
    }),
    { malay: 0, chinese: 0, indian: 0, others: 0 }
  );
  return {
    population,
    area,
    ethnic: {
      malay: Math.round((weighted.malay / population) * 1000) / 10,
      chinese: Math.round((weighted.chinese / population) * 1000) / 10,
      indian: Math.round((weighted.indian / population) * 1000) / 10,
      others: Math.round((weighted.others / population) * 1000) / 10,
    },
  };
}
