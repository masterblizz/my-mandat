export interface Message {
  id: string;
  titleBM: string;
  titleEN: string;
  description: string;
  effectiveness: number;
  trend: number[];
  channels: string[];
  targetDemographic: string;
}

export const keyMessages: Message[] = [
  {
    id: "msg01",
    titleBM: "EKONOMI & KOS SARA HIDUP",
    titleEN: "ECONOMY & COST OF LIVING",
    description: "Addressing the rising cost of living through targeted subsidies, wage reform, and economic restructuring to benefit B40 and M40 households.",
    effectiveness: 68,
    trend: [55, 58, 61, 64, 66, 68],
    channels: ["TV", "Social Media", "Ceramah"],
    targetDemographic: "Urban & Semi-urban voters, B40-M40",
  },
  {
    id: "msg02",
    titleBM: "PELUANG PEKERJAAN",
    titleEN: "JOB OPPORTUNITIES",
    description: "Creating 500,000 new quality jobs through green economy, digital transformation, and foreign investment attraction.",
    effectiveness: 61,
    trend: [48, 52, 54, 57, 59, 61],
    channels: ["Social Media", "Ceramah", "Digital"],
    targetDemographic: "Youth (18-35), Graduates",
  },
  {
    id: "msg03",
    titleBM: "PENDIDIKAN BERKUALITI",
    titleEN: "QUALITY EDUCATION",
    description: "Reforming education from rote learning to skills-based curriculum, improving teacher quality, and expanding TVET pathways.",
    effectiveness: 52,
    trend: [45, 46, 48, 49, 51, 52],
    channels: ["TV", "Print", "Ceramah"],
    targetDemographic: "Parents, Teachers, Students",
  },
  {
    id: "msg04",
    titleBM: "SISTEM KESIHATAN RAKYAT",
    titleEN: "PEOPLE'S HEALTHCARE",
    description: "Strengthening public healthcare with RM 3B investment, reducing waiting times, and expanding community health clinics nationwide.",
    effectiveness: 47,
    trend: [40, 42, 43, 45, 46, 47],
    channels: ["TV", "Radio", "Print"],
    targetDemographic: "Elderly, Families",
  },
  {
    id: "msg05",
    titleBM: "TADBIR URUS BAIK",
    titleEN: "GOOD GOVERNANCE",
    description: "Zero tolerance for corruption with MACC independence, transparent procurement, and mandatory asset declaration for all ministers.",
    effectiveness: 44,
    trend: [38, 39, 40, 42, 43, 44],
    channels: ["Social Media", "Print"],
    targetDemographic: "Urban professionals, Civil society",
  },
  {
    id: "msg06",
    titleBM: "PERPADUAN NASIONAL",
    titleEN: "NATIONAL UNITY",
    description: "Building a Malaysia where all communities thrive — preserving Malay special rights while ensuring fairness and opportunity for all.",
    effectiveness: 38,
    trend: [35, 35, 36, 37, 37, 38],
    channels: ["Ceramah", "TV"],
    targetDemographic: "Multi-ethnic, Rural Malay",
  },
];

export const messagePerformanceHistory = [
  { week: "Wk 1", ekonomi: 55, peluang: 48, pendidikan: 45 },
  { week: "Wk 2", ekonomi: 58, peluang: 52, pendidikan: 46 },
  { week: "Wk 3", ekonomi: 61, peluang: 54, pendidikan: 48 },
  { week: "Wk 4", ekonomi: 64, peluang: 57, pendidikan: 49 },
  { week: "Wk 5", ekonomi: 66, peluang: 59, pendidikan: 51 },
  { week: "Wk 6", ekonomi: 68, peluang: 61, pendidikan: 52 },
];

export const channelEffectiveness = [
  { channel: "TV", icon: "📺", effectiveness: 78, reach: 12000000 },
  { channel: "SOCIAL MEDIA", icon: "📱", effectiveness: 72, reach: 8500000 },
  { channel: "CERAMAH", icon: "🎤", effectiveness: 65, reach: 450000 },
  { channel: "PRINT", icon: "📰", effectiveness: 41, reach: 2100000 },
  { channel: "RADIO", icon: "📻", effectiveness: 38, reach: 4200000 },
];
