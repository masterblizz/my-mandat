// Real-world location of a seat, for the city intro (map → zoom → 3D city).
// Coordinates are approximate town-centre positions (WGS84, rounded); the
// nearby towns give the zoomed map some context. Add seats here to give
// them the intro.

export type SeatGeo = {
  lat: number;
  lon: number;
  district: string;
  /** Nearby towns drawn on the zoomed map. */
  towns: { name: string; lat: number; lon: number }[];
};

const SEAT_GEO: Record<string, SeatGeo> = {
  "sungai air tawar": {
    lat: 3.83, lon: 100.86, district: "Sabak Bernam",
    towns: [
      { name: "Sabak", lat: 3.77, lon: 100.99 },
      { name: "Hutan Melintang", lat: 3.88, lon: 100.94 },
      { name: "Sungai Besar", lat: 3.67, lon: 100.99 },
      { name: "Teluk Intan", lat: 4.02, lon: 101.02 },
      { name: "Bagan Datuk", lat: 3.99, lon: 100.79 },
    ],
  },
};

export function seatGeo(name: string | undefined | null): SeatGeo | null {
  return name ? SEAT_GEO[name.toLowerCase()] ?? null : null;
}

// public/malaysia.svg (simplemaps, 1000×332) is a plain lon/lat plate;
// these come from its three georeferenced control points.
export function geoToSvg(lat: number, lon: number): [number, number] {
  return [46.306 * lon - 4568.6, -46.448 * lat + 356.85];
}
