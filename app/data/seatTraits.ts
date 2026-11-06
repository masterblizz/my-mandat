// Seat traits: what kind of place a constituency is (coast, paddy, hills,
// industry, lake, plantation state, state capital, KL landmarks), from its
// name and state. Shared by the kawasan screen and the 3D city's profile.

export type SeatTraits = { coastal: boolean; paddy: boolean; hilly: boolean; industrial: boolean; lake: boolean; kinabalu: boolean; klLandmarks: boolean; bukitBintang: boolean; plantation: boolean; capital: boolean; tea: boolean };

// "bukit" ("hill") appears in plenty of fully urban seat names too (Bukit
// Bintang, Bukit Gelugor, Bukit Mertajam...) — a blanket substring match
// was giving downtown KL a mountain backdrop. Only these two seats are
// real hill-backdrop terrain despite the "Bukit" name; every other hilly
// match below is a genuine highland/interior district name, not a prefix.
const HILLY_BUKIT_EXCEPTIONS = ["bukit bendera", "bukit antarabangsa"];

// Exact-name match (not substring — "bera" alone would also catch
// "Berapit"/"Seberang Jaya", "sik" would catch "Kemasik"/"Sikamat", and
// "gerik" would catch "Kota Anggerik"): real seats built around a named
// recreational or dam lake. Hulu Terengganu → Tasik Kenyir; Bera → Tasik
// Bera; Chini → Tasik Chini; Putrajaya → the lake itself; Gerik → Tasik
// Temenggor; Bagan Serai → Tasik Bukit Merah / Bukit Merah Laketown;
// Kajang → Tasik Kajang / Tasik Cempaka (Bandar Baru Bangi); Shah Alam →
// Taman Tasik Shah Alam; Batang Ai → the Batang Ai dam lake, Sarawak;
// Sik / Pedu → Tasik Pedu, Kedah.
const LAKE_SEATS = new Set([
  "hulu terengganu", "bera", "chini", "putrajaya", "gerik",
  "bagan serai", "kajang", "shah alam", "batang ai", "sik", "pedu",
]);

// Mount Kinabalu itself — not a generic hilly district, one specific,
// unmistakable granite peak (South-East Asia's tallest). Kota Kinabalu is
// the city named after it and where it's the skyline backdrop in every
// tourism shot; Ranau/Kundasang (also `hilly`, generic rolling terrain)
// are the district the mountain actually stands in.
const KINABALU_SEATS = new Set(["kota kinabalu", "ranau", "kundasang"]);
// The seat holding each state capital's downtown (exact names): the 3D city
// builds these as a city with a real centre even where the seat's average
// population density is town-like (Kuantan, Kota Bharu, Kuala Terengganu…).
const CAPITAL_SEATS = new Set([
  "kuantan", "kota bharu", "kuala terengganu", "alor setar", "kangar", "ipoh timor", "ipoh barat",
  "seremban", "kota melaka", "johor bahru", "shah alam", "tanjong", "kota kinabalu", "bandar kuching", "putrajaya",
]);
// States whose countryside is largely oil-palm estate (the 3D city plants
// ladang sawit on the rural fringe of their town and village seats; paddy
// seats keep their sawah instead).
const PLANTATION_STATES = ["johor", "pahang", "perak", "ns", "terengganu", "sabah", "sarawak"];
export function deriveSeatTraits(seatName: string, stateId: string, seatCode = ""): SeatTraits {
  const name = seatName.toLowerCase();
  const has = (...words: string[]) => words.some((word) => name.includes(word));
  const bukitBintang = seatCode.startsWith("P.") && name === "bukit bintang";
  return {
    coastal: has("pantai", "teluk", "tanjung", "kuala", "pelabuhan", "port", "langkawi", "mersing", "pengerang", "sabak", "labuan", "sandakan", "tawau", "kudat", "semporna", "miri", "bintulu", "santubong", "bagan", "kepala batas", "balik pulau", "marang", "dungun", "kemaman", "besut", "bachok", "tumpat", "pontian", "batu pahat", "muar", "klang", "lumut", "beruas"),
    paddy: ["kedah", "perlis", "kelantan"].includes(stateId) || has("sabak bernam", "sungai besar", "sekinchan", "tanjung karang", "pendang", "yan", "kubang"),
    // Langkawi: Gunung Raya and Mat Cincang rise straight out of the island
    hilly: HILLY_BUKIT_EXCEPTIONS.includes(name) || name === "langkawi" || has("gua", "hulu", "ulu", "cameron", "kundasang", "ranau", "keningau", "tambunan", "lipis", "raub", "bentong", "jelebu", "tapah", "kinta", "lenggong", "gerik", "baling", "jeli", "tenom"),
    // real industrial districts: Gebeng (Kuantan), Kerteh (Kemaman), Bintulu LNG,
    // Pengerang RAPID, Nilai, Batu Kawan, Rawang, Seberang Perai…
    industrial: has("gudang", "kulim", "shah alam", "klang", "perai", "prai", "senai", "skudai", "subang", "kapar", "larkin", "pasir gudang", "kuantan", "kemaman", "bintulu", "pengerang", "nilai", "batu kawan", "rawang", "seberang perai"),
    lake: LAKE_SEATS.has(name) || has("tasik"),
    kinabalu: KINABALU_SEATS.has(name),
    // Iconic Kuala Lumpur landmarks belong to their actual parliamentary
    // constituency only. A dense grid is a performance/layout signal, not
    // permission to place KLCC, Menara KL or Merdeka 118 elsewhere.
    klLandmarks: bukitBintang,
    bukitBintang,
    plantation: PLANTATION_STATES.includes(stateId),
    capital: CAPITAL_SEATS.has(name),
    // highland tea estates: Cameron Highlands (BOH, Sungai Palas) and
    // Sabah Tea at Ranau / Kundasang
    tea: has("cameron", "ranau", "kundasang"),
  };
}
