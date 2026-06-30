import { StateData } from "./states";

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
}

const STATE_NAMES: Record<string, string[]> = {
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

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 11), 0x165667b1);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

export function generateConstituencies(state: StateData): Constituency[] {
  const seed = state.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 97 + state.seats;
  const rand = seededRand(seed);
  const names = STATE_NAMES[state.id] || [];

  const result: Constituency[] = [];

  for (let i = 0; i < state.seats; i++) {
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

    const name = names[i] || `Kawasan ${i + 1}`;
    const codeNum = i + 1;
    const code = `P.${String(codeNum).padStart(3, "0")}`;

    result.push({ id: `${state.id}-${i}`, name, code, mandat, lawan, others, winner, margin, safety });
  }

  return result;
}
