export type InfluenceScope = "national" | "state" | "local";

export interface PartyMember {
  id: string;
  name: string;
  role: string;
  homeState: string;
  homeConstituency?: string;
  influenceScope: InfluenceScope;
  influence: number;
  charisma: number;
  credibility: number;
  experience: "veteran" | "rising" | "new";
  specialty: "urban" | "rural" | "youth" | "economic" | "media" | "grassroots";
}

export const PARTY_MEMBERS: PartyMember[] = [
  // National heavyweights — strong nationwide recognition, useful in headline/marginal seats
  { id: "pm-001", name: "Dato' Sri Zulkifli Hamdan", role: "Timbalan Presiden", homeState: "selangor", homeConstituency: "Shah Alam", influenceScope: "national", influence: 88, charisma: 78, credibility: 90, experience: "veteran", specialty: "urban" },
  { id: "pm-002", name: "Tan Sri Noraini Yusof", role: "Naib Presiden I", homeState: "johor", homeConstituency: "Johor Bahru", influenceScope: "national", influence: 84, charisma: 80, credibility: 86, experience: "veteran", specialty: "grassroots" },
  { id: "pm-003", name: "Dato' Rizal Mansur", role: "Setiausaha Agung", homeState: "perak", homeConstituency: "Tambun", influenceScope: "national", influence: 82, charisma: 72, credibility: 88, experience: "veteran", specialty: "economic" },
  { id: "pm-004", name: "Puan Sri Haslinda Osman", role: "Naib Presiden II", homeState: "kedah", homeConstituency: "Alor Setar", influenceScope: "national", influence: 79, charisma: 76, credibility: 84, experience: "veteran", specialty: "rural" },
  { id: "pm-005", name: "Dato' Marcus Ling Wei Keong", role: "Pengarah Strategi", homeState: "penang", homeConstituency: "Bukit Bendera", influenceScope: "national", influence: 80, charisma: 74, credibility: 82, experience: "veteran", specialty: "media" },

  // State-level operators — strongest in home state machinery
  { id: "pm-006", name: "Ahmad Faris Khalid", role: "Ketua Negeri Selangor", homeState: "selangor", homeConstituency: "Gombak", influenceScope: "state", influence: 72, charisma: 80, credibility: 70, experience: "rising", specialty: "urban" },
  { id: "pm-007", name: "Nurul Ain Zainudin", role: "Ketua Pemuda", homeState: "wp", homeConstituency: "Lembah Pantai", influenceScope: "state", influence: 68, charisma: 84, credibility: 72, experience: "rising", specialty: "youth" },
  { id: "pm-008", name: "Azhar Rashid", role: "Ketua Negeri Johor", homeState: "johor", homeConstituency: "Batu Pahat", influenceScope: "state", influence: 74, charisma: 70, credibility: 74, experience: "rising", specialty: "grassroots" },
  { id: "pm-009", name: "Dr. Priya Subramaniam", role: "Pengarah Dasar Ekonomi", homeState: "ns", homeConstituency: "Seremban", influenceScope: "state", influence: 70, charisma: 72, credibility: 78, experience: "rising", specialty: "economic" },
  { id: "pm-010", name: "Lim Boon Huat", role: "Ketua Negeri Pulau Pinang", homeState: "penang", homeConstituency: "Tanjung", influenceScope: "state", influence: 73, charisma: 76, credibility: 74, experience: "rising", specialty: "urban" },
  { id: "pm-011", name: "Roslan Ibrahim", role: "Ketua Hal Ehwal Luar Bandar", homeState: "pahang", homeConstituency: "Bera", influenceScope: "state", influence: 68, charisma: 66, credibility: 72, experience: "rising", specialty: "rural" },
  { id: "pm-012", name: "Wan Zuraida Wan Ismail", role: "Ketua Wanita", homeState: "terengganu", homeConstituency: "Marang", influenceScope: "state", influence: 70, charisma: 74, credibility: 76, experience: "rising", specialty: "grassroots" },
  { id: "pm-013", name: "Joseph Dandil", role: "Wakil Sabah", homeState: "sabah", homeConstituency: "Kota Belud", influenceScope: "state", influence: 72, charisma: 68, credibility: 70, experience: "rising", specialty: "rural" },
  { id: "pm-014", name: "Rebecca Lucia Jawa", role: "Wakil Sarawak", homeState: "sarawak", homeConstituency: "Puncak Borneo", influenceScope: "state", influence: 70, charisma: 66, credibility: 72, experience: "rising", specialty: "grassroots" },
  { id: "pm-015", name: "Hafizuddin Mohd Noor", role: "Pengarah Komunikasi", homeState: "selangor", homeConstituency: "Pandan", influenceScope: "state", influence: 66, charisma: 80, credibility: 68, experience: "rising", specialty: "media" },
  { id: "pm-016", name: "Ng Sook Mei", role: "Pengarah Hal Ehwal Bandar", homeState: "wp", homeConstituency: "Seputeh", influenceScope: "state", influence: 68, charisma: 74, credibility: 72, experience: "rising", specialty: "urban" },
  { id: "pm-017", name: "Kamarulzaman Taib", role: "Ketua Wilayah Utara", homeState: "kedah", homeConstituency: "Jerlun", influenceScope: "state", influence: 71, charisma: 67, credibility: 73, experience: "rising", specialty: "rural" },

  // Local/district figures — strongest in their own constituency/community base
  { id: "pm-018", name: "Arif Daniyal Zukri", role: "Pengarah Dasar Belia", homeState: "selangor", homeConstituency: "Petaling Jaya", influenceScope: "local", influence: 58, charisma: 82, credibility: 62, experience: "new", specialty: "youth" },
  { id: "pm-019", name: "Shazana Marzuki", role: "Pengarah Media Sosial", homeState: "wp", homeConstituency: "Wangsa Maju", influenceScope: "local", influence: 55, charisma: 80, credibility: 60, experience: "new", specialty: "media" },
  { id: "pm-020", name: "Michael Raj Kumar", role: "Ketua Penyelidikan Dasar", homeState: "perak", homeConstituency: "Ipoh Barat", influenceScope: "local", influence: 60, charisma: 66, credibility: 70, experience: "new", specialty: "economic" },
  { id: "pm-021", name: "Azmi Rosdi", role: "Ketua Pemuda Kelantan", homeState: "kelantan", homeConstituency: "Kota Bharu", influenceScope: "local", influence: 62, charisma: 70, credibility: 64, experience: "new", specialty: "youth" },
  { id: "pm-022", name: "Darren Kok Chuan Liang", role: "Ketua Kempen Digital", homeState: "penang", homeConstituency: "Bukit Mertajam", influenceScope: "local", influence: 58, charisma: 72, credibility: 62, experience: "new", specialty: "media" },
  { id: "pm-023", name: "Siti Hajar Ramlan", role: "Aktivis Hak Wanita", homeState: "johor", homeConstituency: "Muar", influenceScope: "local", influence: 60, charisma: 74, credibility: 66, experience: "new", specialty: "grassroots" },
  { id: "pm-024", name: "Rafikul Amin", role: "Ketua Cawangan Pahang", homeState: "pahang", homeConstituency: "Temerloh", influenceScope: "local", influence: 63, charisma: 64, credibility: 65, experience: "new", specialty: "rural" },
  { id: "pm-025", name: "Julia Christopher Jimbun", role: "Ketua Belia Sabah", homeState: "sabah", homeConstituency: "Keningau", influenceScope: "local", influence: 59, charisma: 70, credibility: 63, experience: "new", specialty: "youth" },
];
