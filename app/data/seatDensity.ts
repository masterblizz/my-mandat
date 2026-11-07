// Population density (people per km²) for the seats the 3D city is drawn
// for. Real seats use their census 2020 population and area (seatCensus.ts);
// the table below only covers seats without census figures. The generated seat population/area are RNG values,
// so the city used to build from a coarse 3-band "areaType" only; this
// gives well-known seats their real-world character (KL core ≫ Petaling
// Jaya ≫ a state capital ≫ a market town ≫ kampung).
//
// Figures are ROUNDED ESTIMATES (public census population ÷ seat area,
// rounded hard) used only to shape the scenery. They are not gameplay
// numbers and not official statistics.

import type { AreaType } from "./constituencies";

const KNOWN_DENSITY: Record<string, number> = {
  // Kuala Lumpur core
  "bukit bintang": 11000, "kepong": 12000, "cheras": 12000, "batu": 9000,
  "titiwangsa": 8000, "seputeh": 8000, "wangsa maju": 7000, "bandar tun razak": 7000,
  "setiawangsa": 6500, "segambut": 6000, "lembah pantai": 6000,
  // Klang Valley satellite cities (parliament)
  "petaling jaya": 7000, "pandan": 7500, "ampang": 6000, "damansara": 6000,
  "subang": 5500, "puchong": 5000, "selayang": 3000, "hulu kelang": 3500,
  "kota raja": 3500, "klang": 3500, "serdang": 3500, "shah alam": 3000, "gombak": 1500,
  // Klang Valley (DUN)
  "kampung tunku": 8000, "taman medan": 7500, "seri setia": 7000, "pandan indah": 7000,
  "bukit gasing": 6500, "subang jaya": 6500, "bandar utama": 6000, "kinrara": 5500,
  "kota damansara": 5000, "seri kembangan": 5000, "kota kemuning": 4000, "seri serdang": 4000,
  "batu tiga": 3500, "bukit antarabangsa": 3000, "kajang": 3000, "balakong": 3000, "sungai ramal": 2500,
  // other cities
  "johor bahru": 4500, "permas": 3500, "pulai": 2500, "tebrau": 2500, "iskandar puteri": 1500,
  "kota bharu": 3500, "alor setar": 2000, "ipoh barat": 3000, "ipoh timur": 3000,
  "kota melaka": 3000, "bandar hilir": 3500, "seremban": 2000, "rasah": 2500, "kuantan": 1200,
  "tanjung": 6500, "jelutong": 6000, "bukit bendera": 3000, "bukit gelugor": 5000,
  "bayan baru": 3500, "komtar": 9000, "air itam": 5000, "bukit mertajam": 2000, "batu kawan": 1500,
  "kota kinabalu": 3500, "sepanggar": 1500, "bandar kuching": 4000, "stampin": 2500,
  "petra jaya": 1500, "kuala terengganu": 3000, "sibu": 1000, "miri": 600,
  // market towns
  "putrajaya": 1700, "kangar": 900, "teluk intan": 700, "taiping": 900, "muar": 800,
  "batu pahat": 700, "kluang": 500, "temerloh": 400, "kuala kangsar": 400,
};

/** Fallback band per area type, used with the seat's own generated density. */
const BAND: Record<AreaType, [number, number]> = {
  urban_dense: [2500, 9000],
  suburban: [300, 2500],
  rural: [20, 300],
};

export function seatRealDensity(seat: { name: string; areaType: AreaType; population: number; areaKm2: number; households?: number } | null | undefined): number {
  if (!seat) return 800;
  // a real seat: its census 2020 population over its census area
  if (seat.households && seat.areaKm2 > 0) return Math.max(1, Math.round(seat.population / seat.areaKm2 / 10) * 10);
  const known = KNOWN_DENSITY[seat.name.toLowerCase()];
  if (known) return known;
  const [lo, hi] = BAND[seat.areaType];
  const raw = seat.population / Math.max(1, seat.areaKm2);
  return Math.round(Math.min(hi, Math.max(lo, raw)) / 10) * 10;
}
