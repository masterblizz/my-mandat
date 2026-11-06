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
/** The 3D city's centre: the area centre of the largest ring when it lies
 *  inside the seat, else the interior point farthest from the boundary
 *  (a crescent or L-shaped seat has its centroid outside). */
const centreCache = new WeakMap<Boundary, { lat: number; lon: number }>();
export function boundaryCityCentre(rings: Boundary): { lat: number; lon: number } {
  const hit = centreCache.get(rings);
  if (hit) return hit;
  const shape = boundaryShape(rings);
  const inside = (lon: number, lat: number) => rings.some((r) => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]; const [xj, yj] = r[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  });
  let best = { lat: shape.lat, lon: shape.lon };
  if (!inside(shape.lon, shape.lat)) {
    const [x0, y0, x1, y1] = shape.box;
    const segDist = (px: number, py: number) => {
      let m = Infinity;
      for (const r of rings) for (let i = 0; i < r.length; i++) {
        const [ax, ay] = r[i]; const [bx, by] = r[(i + 1) % r.length];
        const dx = bx - ax, dy = by - ay; const L = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
        m = Math.min(m, Math.hypot(px - ax - t * dx, py - ay - t * dy));
      }
      return m;
    };
    let bestD = -1;
    const N = 40;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const lon = x0 + ((x1 - x0) * i) / N, lat = y0 + ((y1 - y0) * j) / N;
      if (!inside(lon, lat)) continue;
      const d = segDist(lon, lat);
      if (d > bestD) { bestD = d; best = { lat, lon }; }
    }
  }
  centreCache.set(rings, best);
  return best;
}

export function boundaryShapeK(rings: Boundary, samples = 72): number[] {
  const shape = boundaryCityCentre(rings);
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
  const { lon, lat } = boundaryCityCentre(rings);
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

/** The outline for the 3D city, in its frame: flat [x, z, x, z, ...] per
 *  ring, x east / z south, in units of the mean ray (the city multiplies
 *  by r_city). Points closer than `minStep` are dropped. */
export function boundaryCityOutline(rings: Boundary, minStep = 0.012): number[][] {
  const f = boundaryCityFrame(rings);
  if (!f.meanDeg) return [];
  const kx = Math.cos((f.lat * Math.PI) / 180);
  return rings.map((ring) => {
    const out: number[] = [];
    let lx = Infinity, lz = Infinity;
    for (const [lon, lat] of ring) {
      const x = ((lon - f.lon) * kx) / f.meanDeg, z = -(lat - f.lat) / f.meanDeg;
      if (Math.hypot(x - lx, z - lz) < minStep) continue;
      out.push(+x.toFixed(4), +z.toFixed(4)); lx = x; lz = z;
    }
    return out;
  }).filter((ring) => ring.length >= 6);
}

// ── real coastline ────────────────────────────────────────────────────
const ALL_STATES = ["johor", "kedah", "kelantan", "melaka", "ns", "pahang", "penang", "perak", "perlis", "sabah", "sarawak", "selangor", "terengganu", "wp"];
let landCache: Promise<{ ring: [number, number][]; box: [number, number, number, number] }[]> | null = null;
function loadLand() {
  if (!landCache) landCache = Promise.all(ALL_STATES.map((id) => loadStateBoundaries("P", id))).then((all) => {
    const out: { ring: [number, number][]; box: [number, number, number, number] }[] = [];
    for (const seats of all) for (const rings of Object.values(seats)) for (const ring of rings) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      out.push({ ring, box: [x0, y0, x1, y1] });
    }
    return out;
  });
  return landCache;
}
const inRing = (ring: [number, number][], lon: number, lat: number) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Coarse outlines of the neighbours' land along Malaysia's land borders
// (southern Thailand, Kalimantan, Brunei), so a border seat isn't taken
// for a coastal one. Seas beside them (Andaman, Gulf of Thailand, South
// China Sea, Celebes Sea) stay outside.
const FOREIGN_LAND: [number, number][][] = [
  [[100.0, 7.5], [100.12, 6.75], [100.25, 6.3], [100.6, 5.9], [101.0, 5.4], [101.6, 5.4], [101.9, 5.7], [102.12, 6.18], [102.05, 7.5]],
  [[108.0, 1.0], [109.6, 1.9], [110.5, 0.9], [112.0, 1.3], [113.5, 2.0], [114.5, 3.5], [115.5, 4.45], [116.0, 4.5], [117.0, 4.35], [117.6, 4.25], [118.0, 4.0], [118.0, -2.0], [108.0, -2.0]],
  [[114.05, 4.6], [114.4, 5.05], [115.0, 4.95], [115.15, 4.7], [115.35, 4.75], [115.35, 4.35], [114.8, 4.0], [114.1, 4.3]],
];

/**
 * Where the sea is, for the 3D city: rays from the city centre are taken
 * just past the seat boundary; a ray whose point lies in no parliamentary
 * seat of any state is over the sea. Returns the mean sea direction in the
 * city frame (x east, z south) and the coastline's distance along it in
 * mean-ray units (the city multiplies by r_city), or null when inland.
 */
export async function boundaryCityCoast(rings: Boundary): Promise<{ dir: [number, number]; edge: number } | null> {
  const land = await loadLand();
  const f = boundaryCityFrame(rings);
  if (!f.meanDeg) return null;
  const kx = Math.cos((f.lat * Math.PI) / 180);
  const pts = rings.flatMap((r) => r.map(([lon, lat]) => [(lon - f.lon) * kx, lat - f.lat] as const));
  const segs = rings.flatMap((r) => r.map(([lon, lat], i) => { const [lon2, lat2] = r[(i + 1) % r.length]; return [(lon - f.lon) * kx, lat - f.lat, (lon2 - f.lon) * kx, lat2 - f.lat] as const; }));
  const onLand = (lon: number, lat: number) => FOREIGN_LAND.some((ring) => inRing(ring, lon, lat)) || land.some(({ ring, box }) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3] && inRing(ring, lon, lat));
  let sx = 0, sz = 0, n = 0;
  const hits: number[] = [];
  const N = 72;
  for (let s = 0; s < N; s++) {
    const a = (s / N) * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a); // east, north
    let far = 0;
    for (const [x1, y1, x2, y2] of segs) {
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (x1 * ey - y1 * ex) / den, u = (x1 * dy - y1 * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) far = Math.max(far, t);
    }
    if (!far) continue;
    const probe = far + Math.max(0.006, f.meanDeg * 0.12);
    if (!onLand(f.lon + (dx * probe) / kx, f.lat + dy * probe)) { sx += dx; sz -= dy; n++; hits.push(far); }
  }
  if (n < 4) return null; // a stray estuary gap, not a coast
  const len = Math.hypot(sx, sz) || 1;
  const dir: [number, number] = [sx / len, sz / len];
  // the coastline: boundary points' mean projection on the sea side
  const proj = pts.map(([x, y]) => (x * dir[0] - y * dir[1]) / f.meanDeg);
  const farP = Math.max(...proj);
  const coastPts = proj.filter((p) => p > farP * 0.6);
  const edge = coastPts.reduce((a, b) => a + b, 0) / Math.max(1, coastPts.length);
  return { dir: [+dir[0].toFixed(3), +dir[1].toFixed(3)], edge: +edge.toFixed(3) };
}
