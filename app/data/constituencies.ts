import { StateData } from "./states";

export type AreaType = "rural" | "suburban" | "urban_dense";

export interface Constituency {
  id: string;
  name: string;
  code: string;
  mandat: number;
  lawan: number;
  others: number;
  winner: "mandat" | "lawan" | "others";
  margin: number;
  safety: "safe" | "marginal" | "danger";
  voters: number;
  // Population is the "real" quantity voters are a ~52% share of — kept
  // separate so seat visuals (population density) don't have to be driven
  // by raw voter turnout, which says nothing about how physically built-up
  // a seat is (see areaKm2).
  population: number;
  // Modeled seat area, independent of population — a small dense urban
  // seat and a huge sparse rural seat can carry similar populations, so
  // area (not population alone) is what should drive how "packed" the
  // 3D city reads.
  areaKm2: number;
  // How built-up the seat actually is, used by /kawasan to pick the right
  // asset set (skyscrapers vs. terrace houses vs. kampung). Named real
  // seats known to be dense urban cores or clear satellite towns are
  // pinned via a curated list (see AREA_TYPE_OVERRIDES below) rather than
  // left to population/areaKm2 RNG, which has no idea "Bukit Bintang" is
  // downtown KL and not a hill village.
  areaType: AreaType;
}

const PARLIAMENT_NAMES: Record<string, string[]> = {
  johor: [
    "Ledang", "Segamat", "Sekijang", "Labis", "Pagoh",
    "Ayer Hitam", "Sri Gading", "Batu Pahat", "Simpang Renggam", "Kluang",
    "Sembrong", "Mersing", "Tenggara", "Kota Tinggi", "Pengerang",
    "Benut", "Pontian", "Tanjung Piai", "Pulai", "Iskandar Puteri",
    "Johor Bahru", "Permas", "Kulai", "Tebrau", "Muar", "Bakri",
  ],
  kedah: [
    "Padang Terap", "Jerlun", "Kubang Pasu", "Alor Setar", "Kuala Kedah",
    "Langkawi", "Pendang", "Jerai", "Sik", "Baling",
    "Padang Serai", "Merbok", "Kulim-BB", "Kota Siputeh", "Pokok Sena",
  ],
  kelantan: [
    "Pengkalan Chepa", "Kota Bharu", "Pasir Mas", "Rantau Panjang", "Kubang Kerian",
    "Bachok", "Ketereh", "Tanah Merah", "Machang", "Jeli",
    "Kuala Krai", "Gua Musang", "Pasir Puteh", "Tumpat",
  ],
  melaka: [
    "Jasin", "Masjid Tanah", "Alor Gajah", "Kota Melaka", "Tangga Batu", "Hang Tuah Jaya",
  ],
  ns: [
    "Jempol", "Jelebu", "Kuala Pilah", "Rasah", "Seremban",
    "Tampin", "Rembau", "Port Dickson",
  ],
  pahang: [
    "Cameron Highlands", "Lipis", "Raub", "Jerantut", "Indera Mahkota",
    "Kuantan", "Paya Besar", "Pekan", "Maran", "Muadzam Shah",
    "Rompin", "Temerloh", "Bentong", "Bera",
  ],
  perak: [
    "Gerik", "Lenggong", "Larut", "Parit Buntar", "Bagan Serai",
    "Bukit Gantang", "Taiping", "Padang Rengas", "Sungai Siput", "Tambun",
    "Lumut", "Beruas", "Teluk Intan", "Tanjung Malim", "Bagan Datok",
    "Gopeng", "Batu Gajah", "Kuala Kangsar", "Sungai Rapat", "Ipoh Barat",
    "Ipoh Timur", "Kampar", "Slim", "Hulu Perak",
  ],
  perlis: ["Padang Besar", "Kangar", "Arau"],
  penang: [
    "Kepala Batas", "Tasek Gelugor", "Nibong Tebal", "Bukit Mertajam", "Batu Kawan",
    "Balik Pulau", "Bukit Bendera", "Tanjung", "Jelutong", "Bukit Gelugor",
    "Bayan Baru", "Permatang Pauh", "Padang Serai",
  ],
  sabah: [
    "Kudat", "Kota Marudu", "Kota Belud", "Tuaran", "Sepanggar",
    "Kota Kinabalu", "Putatan", "Penampang", "Papar", "Kimanis",
    "Beaufort", "Sipitang", "Ranau", "Labuk Sugut", "Beluran",
    "Libaran", "Sandakan", "Kinabatangan", "Lahad Datu", "Silam",
    "Semporna", "Tawau", "Kalabakan", "Keningau", "Pensiangan",
  ],
  sarawak: [
    "Mas Gading", "Santubong", "Petra Jaya", "Bandar Kuching", "Stampin",
    "Kota Samarahan", "Puncak Borneo", "Serian", "Batang Sadong", "Batang Lupar",
    "Sri Aman", "Lubok Antu", "Betong", "Saratok", "Tanjung Manis",
    "Igan", "Sarikei", "Julau", "Kanowit", "Lanang",
    "Sibu", "Mukah", "Selangau", "Kapit", "Hulu Rajang",
    "Bintulu", "Sibuti", "Miri", "Kota Belait", "Limbang", "Lawas",
  ],
  selangor: [
    "Sabak Bernam", "Sungai Besar", "Hulu Selangor", "Tanjung Karang", "Kuala Selangor",
    "Selayang", "Gombak", "Ampang", "Pandan", "Hulu Langat",
    "Serdang", "Puchong", "Subang", "Petaling Jaya", "Damansara",
    "Kapar", "Klang", "Kota Raja", "Shah Alam", "Sepang",
    "Kuala Langat", "Hulu Kelang",
  ],
  terengganu: [
    "Besut", "Setiu", "Kuala Nerus", "Kuala Terengganu", "Marang",
    "Hulu Terengganu", "Dungun", "Kemaman",
  ],
  wp: [
    "Kepong", "Batu", "Wangsa Maju", "Segambut", "Setiawangsa",
    "Titiwangsa", "Bukit Bintang", "Lembah Pantai", "Seputeh", "Cheras",
    "Bandar Tun Razak", "Putrajaya", "Labuan",
  ],
};

const DUN_NAMES: Record<string, string[]> = {
  ns: [
    "Chennah", "Pertang", "Sungai Lui", "Klawang", "Serting", "Palong",
    "Jeram Padang", "Bahau", "Lenggeng", "Nilai", "Lobak", "Temiang",
    "Sikamat", "Ampangan", "Juasseh", "Seri Menanti", "Senaling", "Pilah",
    "Johol", "Labu", "Bukit Kepayang", "Rahang", "Mambau", "Seremban Jaya",
    "Paroi", "Chembong", "Rantau", "Kota", "Chuah", "Lukut",
    "Bagan Pinang", "Linggi", "Gemencheh", "Gemas", "Repah", "Sri Tanjung",
  ],
  selangor: [
    "Sungai Air Tawar", "Sabak", "Sungai Panjang", "Sekinchan", "Hulu Bernam", "Kuala Kubu Baharu",
    "Batang Kali", "Sungai Burong", "Permatang", "Bukit Melawati", "Ijok", "Jeram",
    "Kuang", "Rawang", "Taman Templer", "Sungai Tua", "Gombak Setia", "Hulu Kelang",
    "Bukit Antarabangsa", "Lembah Jaya", "Pandan Indah", "Teratai", "Dusun Tua", "Semenyih",
    "Kajang", "Sungai Ramal", "Balakong", "Seri Kembangan", "Seri Serdang", "Kinrara",
    "Subang Jaya", "Seri Setia", "Taman Medan", "Bukit Gasing", "Kampung Tunku", "Bandar Utama",
    "Bukit Lanjan", "Paya Jaras", "Kota Damansara", "Kota Anggerik", "Batu Tiga", "Meru",
    "Sementa", "Selat Klang", "Bandar Baru Klang", "Pelabuhan Klang", "Pandamaran", "Sentosa",
    "Sungai Kandis", "Kota Kemuning", "Sijangkang", "Banting", "Morib", "Tanjong Sepat",
    "Dengkil", "Sungai Pelek",
  ],
  penang: [
    "Penaga", "Bertam", "Pinang Tunggal", "Permatang Berangan", "Sungai Dua", "Telok Ayer Tawar",
    "Sungai Puyu", "Bagan Jermal", "Bagan Dalam", "Seberang Jaya", "Permatang Pasir", "Penanti",
    "Berapit", "Machang Bubok", "Padang Lalang", "Perai", "Bukit Tengah", "Bukit Tambun",
    "Jawi", "Sungai Bakap", "Pulau Betong", "Telok Bahang", "Air Putih", "Kebun Bunga",
    "Pulau Tikus", "Padang Kota", "Pengkalan Kota", "Komtar", "Datok Keramat", "Sungai Pinang",
    "Batu Lancang", "Seri Delima", "Air Itam", "Paya Terubong", "Batu Uban", "Pantai Jerejak",
    "Batu Maung", "Bayan Lepas", "Pulau Betong Selatan", "Teluk Kumbar",
  ],
  melaka: [
    "Kuala Linggi", "Tanjung Bidara", "Ayer Limau", "Lendu", "Taboh Naning", "Rembia", "Gadek",
    "Machap Jaya", "Durian Tunggal", "Asahan", "Sungai Udang", "Pantai Kundor", "Paya Rumput", "Kelebang",
    "Pengkalan Batu", "Ayer Keroh", "Bukit Katil", "Ayer Molek", "Kesidang", "Kota Laksamana", "Duyong",
    "Bandar Hilir", "Telok Mas", "Bemban", "Rim", "Serkam", "Merlimau", "Sungai Rambai",
  ],
  terengganu: [
    "Kuala Besut", "Kota Putera", "Jerteh", "Hulu Besut", "Jabi", "Permaisuri", "Langkap", "Batu Rakit",
    "Tepuh", "Buluh Gading", "Seberang Takir", "Bukit Tunggal", "Wakaf Mempelam", "Bandar", "Ladang", "Batu Buruk",
    "Alur Limbat", "Bukit Payung", "Rhu Rendang", "Pengkalan Berangan", "Telemong", "Manir", "Kuala Berang", "Ajil",
    "Bukit Besi", "Rantau Abang", "Sura", "Paka", "Kemasik", "Kijal", "Cukai", "Air Putih",
  ],
  perlis: [
    "Titi Tinggi", "Beseri", "Chuping", "Mata Ayer", "Santan", "Bintong", "Sena", "Indera Kayangan", "Kuala Perlis", "Kayang", "Pauh", "Tambun Tulang", "Guar Sanji", "Simpang Empat", "Sanglang",
  ],
};


// Real seats known to be dense urban conurbation cores — CBDs, city
// centres, packed satellite-city downtowns. Overrides the RNG so these
// always render as "urban_dense" (skyscrapers, malls, minimal open land)
// in /kawasan regardless of the seat's randomly-generated population/area.
const URBAN_DENSE_SEAT_NAMES = [
  // wp
  "Kepong", "Batu", "Wangsa Maju", "Segambut", "Setiawangsa", "Titiwangsa",
  "Bukit Bintang", "Lembah Pantai", "Seputeh", "Cheras", "Bandar Tun Razak",
  // selangor (parliament)
  "Selayang", "Gombak", "Ampang", "Pandan", "Serdang", "Puchong", "Subang",
  "Petaling Jaya", "Damansara", "Klang", "Kota Raja", "Shah Alam", "Hulu Kelang",
  // selangor (dun)
  "Subang Jaya", "Kajang", "Kota Damansara", "Bandar Utama", "Batu Tiga",
  "Bukit Antarabangsa", "Kota Kemuning", "Seri Kembangan", "Kinrara",
  "Seri Setia", "Taman Medan", "Bukit Gasing", "Kampung Tunku", "Pandan Indah",
  "Balakong", "Sungai Ramal", "Seri Serdang",
  // johor
  "Pulai", "Iskandar Puteri", "Johor Bahru", "Permas", "Kulai", "Tebrau",
  // kedah
  "Alor Setar",
  // kelantan
  "Kota Bharu",
  // melaka (parliament + dun)
  "Kota Melaka", "Kota Laksamana", "Duyong", "Bandar Hilir",
  // negeri sembilan (parliament + dun)
  "Rasah", "Seremban", "Seremban Jaya", "Temiang", "Sikamat", "Ampangan",
  "Rahang", "Mambau", "Bukit Kepayang",
  // pahang
  "Indera Mahkota", "Kuantan",
  // perak
  "Ipoh Barat", "Ipoh Timur",
  // penang (parliament + dun)
  "Batu Kawan", "Bukit Bendera", "Tanjung", "Jelutong", "Bukit Gelugor",
  "Bayan Baru", "Bukit Mertajam", "Air Itam", "Komtar", "Datok Keramat",
  "Bayan Lepas", "Seberang Jaya", "Pulau Tikus", "Paya Terubong", "Batu Uban",
  "Batu Maung", "Kebun Bunga", "Padang Kota", "Pengkalan Kota", "Sungai Pinang",
  "Batu Lancang", "Seri Delima",
  // sabah
  "Sepanggar", "Kota Kinabalu", "Sandakan", "Tawau",
  // sarawak
  "Petra Jaya", "Bandar Kuching", "Stampin", "Sibu", "Bintulu", "Miri",
  // terengganu (parliament + dun)
  "Kuala Terengganu", "Bandar", "Batu Buruk", "Ladang",
];

// Real seats that are clear built-up satellite/market towns — denser than
// a rural core but not a metro skyline. Overrides the RNG toward
// "suburban" (terrace houses, 2-3 storey shophouses, small parks) the same
// way URBAN_DENSE_SEAT_NAMES pins metro seats.
const SUBURBAN_SEAT_NAMES = [
  // wp
  "Putrajaya", "Labuan",
  // selangor (parliament + dun)
  "Hulu Langat", "Sepang", "Kuala Langat", "Kapar", "Rawang", "Semenyih",
  "Dusun Tua", "Meru", "Pelabuhan Klang", "Sentosa", "Kuala Kubu Baharu",
  "Batang Kali", "Taman Templer", "Sungai Tua", "Gombak Setia",
  // johor
  "Segamat", "Pagoh", "Sri Gading", "Batu Pahat", "Kluang", "Kota Tinggi",
  "Pengerang", "Pontian", "Muar", "Bakri",
  // kedah
  "Langkawi", "Padang Serai", "Kulim-BB",
  // kelantan
  "Pengkalan Chepa", "Kubang Kerian", "Pasir Mas", "Tumpat",
  // melaka (parliament + dun)
  "Alor Gajah", "Tangga Batu", "Hang Tuah Jaya", "Ayer Keroh", "Bukit Katil",
  "Kesidang", "Pengkalan Batu", "Telok Mas",
  // negeri sembilan (parliament + dun)
  "Kuala Pilah", "Tampin", "Port Dickson", "Nilai", "Labu", "Lukut",
  "Bagan Pinang", "Rantau", "Kota",
  // pahang
  "Paya Besar", "Pekan", "Temerloh",
  // perak
  "Parit Buntar", "Bukit Gantang", "Taiping", "Tambun", "Lumut", "Teluk Intan",
  "Tanjung Malim", "Batu Gajah", "Kuala Kangsar", "Sungai Rapat", "Kampar",
  // perlis (parliament + dun)
  "Kangar", "Arau", "Kuala Perlis", "Indera Kayangan",
  // penang (parliament + dun)
  "Kepala Batas", "Permatang Pauh", "Bukit Tambun", "Machang Bubok",
  "Bagan Jermal", "Bagan Dalam", "Permatang Pasir", "Berapit",
  // sabah
  "Putatan", "Penampang", "Tuaran", "Papar", "Beaufort", "Lahad Datu",
  "Semporna", "Keningau",
  // sarawak
  "Santubong", "Kota Samarahan", "Sri Aman", "Sarikei", "Lanang", "Mukah",
  "Limbang",
  // terengganu (parliament + dun)
  "Kuala Nerus", "Dungun", "Kemaman", "Wakaf Mempelam", "Bukit Tunggal",
  "Seberang Takir", "Cukai", "Kijal",
];

const URBAN_DENSE_SEAT_SET = new Set(URBAN_DENSE_SEAT_NAMES.map((name) => name.toLowerCase()));
const SUBURBAN_SEAT_SET = new Set(SUBURBAN_SEAT_NAMES.map((name) => name.toLowerCase()));

// Named-seat overrides above take priority; everything else (mostly
// procedurally-named DUN seats with no curated entry, and genuinely rural
// seats) falls back to a density estimate blended with the state's actual
// urban population share — so an unlisted seat in an overwhelmingly rural
// state (e.g. Kelantan, urban: 22) doesn't roll "metro" purely off the
// areaKm2/population RNG, and vice versa for an overwhelmingly urban state
// (e.g. Selangor, urban: 92).
function deriveAreaType(name: string, stateUrbanPct: number, popDensity: number): AreaType {
  const key = name.toLowerCase();
  if (URBAN_DENSE_SEAT_SET.has(key)) return "urban_dense";
  if (SUBURBAN_SEAT_SET.has(key)) return "suburban";
  const score = Math.min(1, popDensity / 3000) * 0.6 + (stateUrbanPct / 100) * 0.4;
  if (score >= 0.62) return "urban_dense";
  if (score >= 0.28) return "suburban";
  return "rural";
}

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 11), 0x165667b1);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

export type ConstituencyScope = "parliament" | "dun";

export function generateConstituencies(state: StateData, scope: ConstituencyScope = "parliament"): Constituency[] {
  const seatCount = scope === "dun" ? state.dunSeats : state.seats;
  const seed = state.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 97 + seatCount + (scope === "dun" ? 1307 : 0);
  const rand = seededRand(seed);
  const names = scope === "dun" ? (DUN_NAMES[state.id] || []) : (PARLIAMENT_NAMES[state.id] || []);

  const result: Constituency[] = [];

  for (let i = 0; i < seatCount; i++) {
    const variation = (rand() - 0.5) * 36;
    const baseMandat = Math.max(12, Math.min(78, state.mandatSupport + variation));
    const baseLawan = Math.max(12, Math.min(78, state.lawanSupport - variation * 0.75));
    const baseOthers = Math.max(5, 100 - baseMandat - baseLawan);

    const total = baseMandat + baseLawan + baseOthers;
    const mandat = Math.round((baseMandat / total) * 100);
    const lawan = Math.round((baseLawan / total) * 100);
    const others = Math.max(0, 100 - mandat - lawan);

    const mandatLeads = mandat > lawan && mandat > others;
    const lawanLeads = lawan > mandat && lawan > others;
    const winner = mandatLeads ? "mandat" : lawanLeads ? "lawan" : "others";

    const margin = mandatLeads
      ? mandat - Math.max(lawan, others)
      : lawanLeads
      ? lawan - Math.max(mandat, others)
      : others - Math.max(mandat, lawan);

    const safety: "safe" | "marginal" | "danger" =
      margin >= 15 ? "safe" : margin >= 5 ? "marginal" : "danger";

    const codeNum = i + 1;
    const codePrefix = scope === "dun" ? "N" : "P";
    const name = names[i] || (scope === "dun" ? `DUN ${state.shortName} ${codeNum}` : `Kawasan ${codeNum}`);
    const code = `${codePrefix}.${String(codeNum).padStart(3, "0")}`;
    const id = scope === "dun" ? `${state.id}-dun-${i}` : `${state.id}-${i}`;

    // Population is the real quantity — voters are a fixed ~52% share of it,
    // same deterministic per-seat spread (hash, not rand(), so the seeded
    // sequence above — and every existing seat voter/result figure — stays
    // byte-identical to before this split).
    const popBase = state.population / seatCount;
    const popJitter = 0.72 + (((seed + (i + 1) * 131) % 97) / 97) * 0.66;
    const population = Math.max(28800, Math.round((popBase * popJitter) / 500) * 500);
    const voters = Math.max(15000, Math.round((population * 0.52) / 500) * 500);

    // Area is modeled independently of population (a separate seeded stream)
    // so density reflects how physically packed a seat is, not just how
    // many people live somewhere in it — a small urban seat and a huge
    // rural one can carry similar populations but read completely
    // differently in the 3D city. Skewed toward compact seats (km2^2.2)
    // with rarer large rural outliers, roughly matching the real spread
    // between dense urban cores and sprawling interior seats.
    const areaRand = seededRand(seed * 7 + (i + 1) * 733)();
    const areaKm2 = Math.round(8 + Math.pow(areaRand, 2.2) * 2500);
    const areaType = deriveAreaType(name, state.demographics.urban, population / areaKm2);

    result.push({ id, name, code, mandat, lawan, others, winner, margin, safety, voters, population, areaKm2, areaType });
  }

  return result;
}
