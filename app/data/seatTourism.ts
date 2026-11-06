// Visitors a year per seat, for the 3D city's hotels and chalets.
// SIMULATED figures in the spirit of each place (not official statistics):
// well-known destinations by name, then a rough default from the seat's
// traits (coast, hills, KL) for the rest.

const VISITORS: Record<string, number> = {
  "bukit bintang": 6_000_000, "langkawi": 3_000_000, "kota melaka": 4_000_000, "tanjong": 2_500_000,
  "bukit bendera": 1_500_000, "bayan baru": 900_000, "cameron highlands": 1_200_000, "kota kinabalu": 2_000_000,
  "ranau": 800_000, "semporna": 700_000, "port dickson": 1_000_000, "lumut": 900_000, "kuantan": 900_000,
  "indera mahkota": 400_000, "rompin": 300_000, "mersing": 500_000, "besut": 500_000, "kuala terengganu": 800_000,
  "kota bharu": 600_000, "johor bahru": 2_000_000, "iskandar puteri": 1_200_000, "putrajaya": 1_500_000,
  "bandar kuching": 1_200_000, "santubong": 400_000, "miri": 600_000, "sandakan": 500_000, "labuan": 400_000,
  "petaling jaya": 900_000, "segambut": 300_000, "cheras": 200_000, "seputeh": 400_000, "lembah pantai": 400_000,
  "titiwangsa": 300_000, "batu": 300_000, "sepang": 700_000, "jasin": 200_000, "pekan": 200_000, "kemaman": 300_000,
  "dungun": 300_000, "marang": 300_000, "bachok": 150_000, "jerantut": 300_000, "lipis": 150_000, "raub": 200_000,
  "bentong": 500_000, "kota tinggi": 250_000, "pengerang": 150_000, "pontian": 150_000, "tanjung piai": 100_000,
};

export function seatVisitors(name: string, traits: { coastal?: boolean; hilly?: boolean; klLandmarks?: boolean }): number {
  const known = VISITORS[name.toLowerCase()];
  if (known != null) return known;
  if (traits.klLandmarks) return 800_000;
  if (traits.coastal) return 150_000;
  if (traits.hilly) return 100_000;
  return 30_000;
}
