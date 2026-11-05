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
  /** official boundary (lon/lat rings), when known */
  boundary?: [number, number][][];
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

// ── official electoral boundaries ─────────────────────────────────────
// public/data/boundaries/<dun|parlimen>/<state>.json, built from DOSM open
// data (CC BY 4.0) by scripts/build-boundaries.py: seat name (lower case)
// → rings of [lon, lat]. Fetched per state, on demand.

export type Boundary = [number, number][][];
const boundaryCache = new Map<string, Promise<Record<string, Boundary>>>();

/** Every seat boundary of a state (parlimen for P. codes, DUN for N. codes). */
export function loadStateBoundaries(seatCode: string, stateId: string): Promise<Record<string, Boundary>> {
  const kind = seatCode.startsWith("N") ? "dun" : "parlimen";
  const url = `/data/boundaries/${kind}/${stateId}.json`;
  if (!boundaryCache.has(url)) boundaryCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  return boundaryCache.get(url)!;
}

export function loadSeatBoundary(seatCode: string, stateId: string, name: string): Promise<Boundary | null> {
  return loadStateBoundaries(seatCode, stateId).then((seats) => seats[name.toLowerCase()] ?? null);
}

/** Area-weighted centre of the largest ring, and the bounding box of all rings. */
export function boundaryShape(rings: Boundary): { lat: number; lon: number; box: [number, number, number, number] } {
  let best = rings[0];
  let bestA = 0;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % ring.length]; a += x1 * y2 - x2 * y1; }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = ring; }
  }
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < best.length; i++) {
    const [x1, y1] = best[i]; const [x2, y2] = best[(i + 1) % best.length];
    const k = x1 * y2 - x2 * y1; a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k;
  }
  const lon = a ? cx / (3 * a) : best[0][0];
  const lat = a ? cy / (3 * a) : best[0][1];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ring of rings) for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { lat, lon, box: [x0, y0, x1, y1] };
}

/**
 * The outline as a radius factor per bearing, for the 3D city: `samples`
 * rays from the area centre of the largest ring (in the city's frame:
 * angle a points east·cos a, south·sin a, so north is -90°), each the
 * farthest boundary crossing, divided by their mean. A round seat is all
 * ~1; a long seat is >1 along its axis and <1 across it.
 */
export function boundaryShapeK(rings: Boundary, samples = 72): number[] {
  const shape = boundaryShape(rings);
  let best = rings[0];
  let bestA = 0;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % ring.length]; a += x1 * y2 - x2 * y1; }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = ring; }
  }
  const kx = Math.cos((shape.lat * Math.PI) / 180);
  const pts = best.map(([lon, lat]) => [(lon - shape.lon) * kx, lat - shape.lat] as const);
  const out: number[] = [];
  for (let s = 0; s < samples; s++) {
    const a = (s / samples) * Math.PI * 2;
    const dx = Math.cos(a), dy = -Math.sin(a); // east, north
    let far = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
      const ex = x2 - x1, ey = y2 - y1;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (x1 * ey - y1 * ex) / den;      // along the ray
      const u = (x1 * dy - y1 * dx) / den;      // along the edge
      if (t > 0 && u >= 0 && u <= 1) far = Math.max(far, t);
    }
    out.push(far);
  }
  const mean = out.reduce((sum, v) => sum + v, 0) / Math.max(1, out.filter((v) => v > 0).length);
  lastMean.set(rings, mean);
  return out.map((v) => (mean > 0 && v > 0 ? +(v / mean).toFixed(3) : 1));
}
const lastMean = new WeakMap<Boundary, number>();

/** Where the 3D city sits on the outline: its centre (lon/lat) and the mean
 *  ray length in degrees, which the city draws as r_city (world units). */
export function boundaryCityFrame(rings: Boundary): { lon: number; lat: number; meanDeg: number } {
  if (!lastMean.has(rings)) boundaryShapeK(rings);
  const { lon, lat } = boundaryShape(rings);
  return { lon, lat, meanDeg: lastMean.get(rings) ?? 0 };
}

/** Area of the boundary in km² (all rings; equirectangular, fine at seat scale). */
export function boundaryAreaKm2(rings: Boundary): number {
  let total = 0;
  for (const ring of rings) {
    const kx = 111.32 * Math.cos(((ring[0]?.[1] ?? 0) * Math.PI) / 180);
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i]; const [x2, y2] = ring[(i + 1) % ring.length];
      a += x1 * kx * y2 * 110.57 - x2 * kx * y1 * 110.57;
    }
    total += Math.abs(a) / 2;
  }
  return total;
}
