export interface Advisor {
  id: string;
  codename: string;
  name: string;
  role: string;
  specialty: string;
  icon: string;
  status: "standby" | "active" | "deployed";
  clearance: "alpha" | "beta" | "gamma";
  quote: string;
}

export const advisors: Advisor[] = [
  {
    id: "strategist",
    codename: "ALPHA-1",
    name: "DR. RAZMAN",
    role: "STRATEGIC DIRECTOR",
    specialty: "Campaign strategy · Electoral mapping · Coalition tactics",
    icon: "⬡",
    status: "active",
    clearance: "alpha",
    quote: "Every seat is a battlefield. We fight smart, not loud.",
  },
  {
    id: "media",
    codename: "ALPHA-2",
    name: "SITI NADHIRAH",
    role: "MEDIA STRATEGIST",
    specialty: "Press · Social media · Narrative control",
    icon: "◈",
    status: "active",
    clearance: "alpha",
    quote: "Control the narrative before it controls you.",
  },
  {
    id: "analyst",
    codename: "BETA-2",
    name: "LIM KAH WENG",
    role: "POLL ANALYST",
    specialty: "Voter data · Swing-seat modelling · Demographic intelligence",
    icon: "◉",
    status: "active",
    clearance: "beta",
    quote: "The numbers never lie. Politicians do.",
  },
  {
    id: "fieldops",
    codename: "GAMMA-1",
    name: "ENCIK JOHARI",
    role: "FIELD OPERATIONS",
    specialty: "Ground ops · Logistics · Volunteer deployment",
    icon: "▣",
    status: "deployed",
    clearance: "gamma",
    quote: "Win the streets before you win the seats.",
  },
];
