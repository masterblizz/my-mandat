// Bukit Bintang traffic simulation — pure maths (no React / three.js), so
// the no-collision guarantee is checkable headlessly. bukitBintangRoads.tsx
// draws the roads from ROUTES and renders the poses written here.
//
// Every route carries two LANES (Malaysian left-hand traffic: each
// direction keeps to the driver's left of the centre-line). A lane is a
// single-file queue with real following distance. Wherever two routes come
// close enough for their vehicles to touch — a crossing, a merge, two route
// ends meeting — the lanes share a CONFLICT ZONE: a route may only drive a
// car into it when no car from another route is inside, its own exit is
// clear (nobody stops inside), and, at a signalised crossing, its light is
// green. Lights at a crossing give each route its own green in turn.

export type BBRoute = { width: number; points: Array<[number, number]> };

// The route centre-lines used to end at ±0.98 of the world span. Once the
// carriageway width and lane offset were added, their geometry could spill
// beyond the playable city footprint. Keep a generous clear margin for the
// widest road (78 units) plus buses and lorries.
export const ROUTE_EDGE_INSET = 62;

// West/east is X; north/south is Z. Routes represent, respectively, the
// Sultan Ismail/Ampang arc, P. Ramlee, Raja Chulan, Bukit Bintang, Imbi,
// Tun Razak and the short Jalan Kia Peng/KLCC connectors.
export const ROUTES: BBRoute[] = [
  { width: 76, points: [[-0.98, -0.42], [-0.62, -0.34], [-0.28, -0.30], [0.10, -0.34], [0.52, -0.48], [0.98, -0.58]] },
  { width: 58, points: [[0.12, -0.98], [0.08, -0.52], [0.02, -0.18], [-0.04, 0.15], [-0.08, 0.54], [-0.15, 0.98]] },
  { width: 64, points: [[-0.50, 0.96], [-0.34, 0.60], [-0.16, 0.30], [0.02, -0.02], [0.14, -0.34]] },
  { width: 70, points: [[-0.70, 0.46], [-0.35, 0.34], [0.02, 0.25], [0.36, 0.20], [0.78, 0.30], [0.98, 0.38]] },
  { width: 54, points: [[0.58, 0.96], [0.50, 0.66], [0.40, 0.36], [0.30, 0.12], [0.14, -0.34]] },
  { width: 78, points: [[0.98, -0.92], [0.78, -0.64], [0.64, -0.40], [0.54, -0.12], [0.48, 0.18], [0.46, 0.52], [0.44, 0.98]] },
  { width: 44, points: [[-0.04, -0.14], [0.20, -0.10], [0.42, -0.08], [0.68, -0.16], [0.90, -0.32]] },
];

export const bbHalfSpan = (gridSize: number) => (gridSize * 280 + 40) / 2;

export function routePointsXZ(route: BBRoute, halfSpan: number): [number, number][] {
  const inner = Math.max(0, halfSpan - ROUTE_EDGE_INSET);
  const clamp = (v: number) => Math.max(-inner, Math.min(inner, v));
  return route.points.map(([x, z]) => [clamp(x * halfSpan), clamp(z * halfSpan)]);
}

// ── vehicles ────────────────────────────────────────────────────────
export type BBKind = "car" | "suv" | "van" | "motorcycle" | "bus" | "truck";
export const BB_KINDS: readonly BBKind[] = ["car", "car", "suv", "van", "car", "motorcycle", "bus", "car", "truck", "motorcycle"];
// Rigid footprint (half length incl. cab / cargo box, half width incl.
// wheels) of the instanced parts bukitBintangRoads.tsx draws per kind.
export const BB_FOOTPRINT: Record<BBKind, { half: number; halfW: number }> = {
  bus: { half: 13.2, halfW: 5.1 },
  truck: { half: 12.6, halfW: 4.8 },
  van: { half: 10.2, halfW: 4.5 },
  suv: { half: 9.2, halfW: 4.6 },
  car: { half: 8.2, halfW: 4.3 },
  motorcycle: { half: 4.4, halfW: 2.2 },
};
export const bbLaneOffset = (kind: BBKind) => (kind === "motorcycle" ? 6.5 : 9.5);
const MAX_R = Math.hypot(13.2, 5.1); // largest footprint radius (bus)

const ACCEL = 110;
const BRAKE = 220;
const BUMPER_GAP = 9;
const LOOKAHEAD = 160;

// ── signals ─────────────────────────────────────────────────────────
// Each crossing gives every route through it its own green in turn:
// GREEN, then AMBER, then a short all-red before the next route.
const SLOT = 7;
const GREEN = 4.8;
const AMBER = 1.3;
export type BBCrossing = { x: number; z: number; routes: number[]; offset: number };
export function bbSignalState(crossing: BBCrossing, route: number, t: number): 0 | 1 | 2 {
  const k = crossing.routes.indexOf(route);
  if (k < 0) return 0;
  const cycle = SLOT * crossing.routes.length;
  const local = (((t + crossing.offset) % cycle) + cycle) % cycle;
  if (Math.floor(local / SLOT) !== k) return 2;
  const within = local - k * SLOT;
  return within < GREEN ? 0 : within < GREEN + AMBER ? 1 : 2;
}

// ── lane geometry ───────────────────────────────────────────────────
type RouteGeo = {
  pts: [number, number][];
  cum: number[];          // cumulative centre-line length at each vertex
  normals: [number, number][]; // mitred left normal (for +direction) per vertex
  L: number;
  width: number;
};

function buildRoute(route: BBRoute, halfSpan: number): RouteGeo {
  const pts = routePointsXZ(route, halfSpan);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const segN = (i: number): [number, number] => {
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l]; // driver's left of (dx, dz)
  };
  const normals = pts.map((_, i): [number, number] => {
    const a = segN(Math.max(0, i - 1)), b = segN(Math.min(pts.length - 2, i));
    const nx = a[0] + b[0], nz = a[1] + b[1];
    const l = Math.hypot(nx, nz) || 1;
    return [nx / l, nz / l];
  });
  return { pts, cum, normals, L: cum[cum.length - 1], width: route.width };
}

// Centre-line point at distance u from the route start (0 ≤ u ≤ L).
function centreAt(g: RouteGeo, u: number): { x: number; z: number; nx: number; nz: number } {
  let i = 0;
  while (i < g.pts.length - 2 && u > g.cum[i + 1]) i++;
  const seg = g.cum[i + 1] - g.cum[i] || 1;
  const t = Math.max(0, Math.min(1, (u - g.cum[i]) / seg));
  const a = g.pts[i], b = g.pts[i + 1], na = g.normals[i], nb = g.normals[i + 1];
  const nx = na[0] + (nb[0] - na[0]) * t, nz = na[1] + (nb[1] - na[1]) * t;
  const nl = Math.hypot(nx, nz) || 1;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, nx: nx / nl, nz: nz / nl };
}

const mod = (a: number, L: number) => ((a % L) + L) % L;

// Lane position at lane distance s (dir +1 runs start→end, −1 end→start),
// offset `off` to the driver's left.
export function lanePoint(g: RouteGeo, dir: 1 | -1, s: number, off: number): [number, number] {
  const u = dir > 0 ? mod(s, g.L) : g.L - mod(s, g.L);
  const c = centreAt(g, u);
  return [c.x + c.nx * off * dir, c.z + c.nz * off * dir];
}

function distToPolyline(x: number, z: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// Real centre-line crossings, merged within 92 units into one junction.
// Shared end-points are not crossings (t/u kept inside 0.08..0.92).
export function bbCrossings(gridSize: number): BBCrossing[] {
  const halfSpan = bbHalfSpan(gridSize);
  const lines = ROUTES.map((r) => routePointsXZ(r, halfSpan));
  const out: BBCrossing[] = [];
  for (let r1 = 0; r1 < lines.length; r1++) for (let r2 = r1 + 1; r2 < lines.length; r2++) {
    const A = lines[r1], B = lines[r2];
    for (let i = 0; i < A.length - 1; i++) for (let j = 0; j < B.length - 1; j++) {
      const [ax, az] = A[i], [bx, bz] = A[i + 1], [cx, cz] = B[j], [dx, dz] = B[j + 1];
      const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz;
      const cross = rx * sz - rz * sx;
      if (Math.abs(cross) < 0.001) continue;
      const qx = cx - ax, qz = cz - az;
      const t = (qx * sz - qz * sx) / cross, u = (qx * rz - qz * rx) / cross;
      if (t < 0.08 || t > 0.92 || u < 0.08 || u > 0.92) continue;
      const x = ax + rx * t, z = az + rz * t;
      let hit = out.find((c) => Math.hypot(c.x - x, c.z - z) < 92);
      if (!hit) { hit = { x, z, routes: [], offset: out.length * 2.3 }; out.push(hit); }
      if (!hit.routes.includes(r1)) hit.routes.push(r1);
      if (!hit.routes.includes(r2)) hit.routes.push(r2);
    }
  }
  return out;
}

// ── conflict zones ──────────────────────────────────────────────────
type Interval = { a: number; len: number; zone: number };
type Zone = { routes: number[]; crossing: BBCrossing | null };

export type BBLane = { route: number; dir: 1 | -1; intervals: Interval[]; cars: number[] };

export type BBCar = {
  lane: number;
  kind: BBKind;
  half: number;
  halfW: number;
  cruise: number;
  s: number;
  speed: number;
  active: boolean;
  /** zone currently held, or -1, and which of its lane's intervals */
  zone: number;
  iv: number;
  x: number; z: number; heading: number;
};

export type BBSim = {
  routes: RouteGeo[];
  lanes: BBLane[];
  zones: Zone[];
  crossings: BBCrossing[];
  cars: BBCar[];
  /** per zone: route currently inside (-1 free) and how many of its cars */
  owner: Int16Array;
  ownerCount: Int16Array;
  /** per zone × route: when a car of that route started waiting on the mutex */
  waitSince: Float64Array;
  waitSeen: Uint8Array;
};

export function createBBSim(gridSize: number, count: number): BBSim {
  const halfSpan = bbHalfSpan(gridSize);
  const routes = ROUTES.map((r) => buildRoute(r, halfSpan));
  const crossings = bbCrossings(gridSize);
  const lanes: BBLane[] = [];
  routes.forEach((_, r) => { lanes.push({ route: r, dir: 1, intervals: [], cars: [] }); lanes.push({ route: r, dir: -1, intervals: [], cars: [] }); });

  // Mark every lane sample whose car centre could touch a car on another
  // route: (two footprint radii) + the other lane's offset + slack for the
  // motorcycle offset and the 2-unit sampling step.
  const STEP = 2;
  const D_MARK = 2 * MAX_R + 9.5 + 3 + STEP + 2;
  const D_UNION = 2 * MAX_R + 3 * 2 + STEP * 2 + 2;
  type Run = { lane: number; a: number; b: number; samples: [number, number][]; id: number };
  const runs: Run[] = [];
  const runsFor = (li: number, other: number) => {
    const lane = lanes[li], g = routes[lane.route];
    const n = Math.ceil(g.L / STEP);
    const out: Run[] = [];
    let cur: Run | null = null;
    for (let i = 0; i <= n; i++) {
      const s = Math.min(g.L, i * STEP);
      const p = lanePoint(g, lane.dir, s, 9.5);
      if (distToPolyline(p[0], p[1], routes[other].pts) < D_MARK) {
        if (!cur) { cur = { lane: li, a: s, b: s, samples: [], id: runs.length + out.length }; out.push(cur); }
        cur.b = s; cur.samples.push(p);
      } else cur = null;
    }
    runs.push(...out);
    return out;
  };
  const parent: number[] = [];
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => { parent[find(i)] = find(j); };
  const pairs: [Run, Run][] = [];
  for (let r1 = 0; r1 < routes.length; r1++) for (let r2 = r1 + 1; r2 < routes.length; r2++) {
    for (const l1 of [r1 * 2, r1 * 2 + 1]) for (const l2 of [r2 * 2, r2 * 2 + 1]) {
      const A = runsFor(l1, r2), B = runsFor(l2, r1);
      for (const ra of A) for (const rb of B) pairs.push([ra, rb]);
    }
  }
  runs.forEach((_, i) => parent.push(i));
  for (const [ra, rb] of pairs) {
    const near = ra.samples.some(([x, z]) => rb.samples.some(([u, v]) => Math.hypot(x - u, z - v) < D_UNION));
    if (near) union(ra.id, rb.id);
  }
  // A run on a lane that met no partner run still guards that lane (e.g.
  // the other route's lanes only come close at a shared end-point).

  // Per lane: merge overlapping runs (and ones too close for a car to wait
  // between them, also across the wrap from route end to route start).
  const MIN_GAP = 2 * 13.2 + BUMPER_GAP + 4;
  lanes.forEach((lane, li) => {
    const L = routes[lane.route].L;
    const mine = runs.filter((r) => r.lane === li).map((r) => ({ a: r.a, b: r.b, id: r.id })).sort((p, q) => p.a - q.a);
    const merged: { a: number; b: number; id: number }[] = [];
    for (const r of mine) {
      const last = merged[merged.length - 1];
      if (last && r.a - last.b < MIN_GAP) { last.b = Math.max(last.b, r.b); union(r.id, last.id); }
      else merged.push({ ...r });
    }
    if (merged.length > 1) {
      const first = merged[0], last = merged[merged.length - 1];
      if (first.a + L - last.b < MIN_GAP) {
        union(first.id, last.id);
        last.b = first.b + L;
        merged.shift();
      }
    } else if (merged.length === 1 && merged[0].a < MIN_GAP && L - merged[0].b < MIN_GAP) {
      merged[0] = { a: 0, b: L, id: merged[0].id };
    }
    lane.intervals = merged.map((m) => ({ a: m.a, len: m.b - m.a, zone: m.id }));
  });
  // Compact zone ids.
  const zoneOf = new Map<number, number>();
  const zones: Zone[] = [];
  lanes.forEach((lane) => lane.intervals.forEach((iv) => {
    const root = find(iv.zone);
    if (!zoneOf.has(root)) { zoneOf.set(root, zones.length); zones.push({ routes: [], crossing: null }); }
    iv.zone = zoneOf.get(root)!;
    const z = zones[iv.zone];
    if (!z.routes.includes(lane.route)) z.routes.push(lane.route);
  }));
  // A zone containing a real crossing is signalised by it.
  for (const c of crossings) {
    for (const r of c.routes) {
      for (const li of [r * 2, r * 2 + 1]) {
        const lane = lanes[li], g = routes[lane.route];
        // lane distance of the crossing point
        let best = 0, bestD = Infinity;
        for (let s = 0; s <= g.L; s += STEP) {
          const [x, z] = lanePoint(g, lane.dir, s, 0);
          const d = Math.hypot(x - c.x, z - c.z);
          if (d < bestD) { bestD = d; best = s; }
        }
        const iv = lane.intervals.find((v) => mod(best - v.a, g.L) <= v.len);
        if (iv && !zones[iv.zone].crossing) zones[iv.zone].crossing = c;
      }
    }
  }

  // Fleet: kinds cycle as before; lanes stocked in proportion to length.
  const cars: BBCar[] = [];
  const totalL = lanes.reduce((n, l) => n + routes[l.route].L, 0);
  let seed = gridSize * 131 + 17;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let acc = 0, li = 0;
  for (let i = 0; i < count; i++) {
    const at = ((i + 0.5) / count) * totalL;
    while (li < lanes.length - 1 && at > acc + routes[lanes[li].route].L) { acc += routes[lanes[li].route].L; li++; }
    const kind = BB_KINDS[i % BB_KINDS.length];
    const fp = BB_FOOTPRINT[kind];
    lanes[li].cars.push(cars.length);
    cars.push({
      lane: li, kind, half: fp.half, halfW: fp.halfW,
      cruise: (kind === "motorcycle" ? 70 : kind === "bus" || kind === "truck" ? 52 : 60) + rnd() * 18,
      s: 0, speed: 0, active: false, zone: -1, iv: -1, x: 0, z: 0, heading: 0,
    });
  }
  return {
    routes, lanes, zones, crossings, cars,
    owner: new Int16Array(zones.length).fill(-1),
    ownerCount: new Int16Array(zones.length),
    waitSince: new Float64Array(zones.length * routes.length),
    waitSeen: new Uint8Array(zones.length * routes.length),
  };
}

const followGap = (a: BBCar, b: BBCar) => a.half + b.half + BUMPER_GAP;

export function stepBBSim(sim: BBSim, step: number, now: number, level: number) {
  const { routes, lanes, zones, cars, owner, ownerCount, waitSince, waitSeen } = sim;
  const nr = routes.length;
  const slow = 1 - 0.35 * Math.max(0, Math.min(1, level));
  waitSeen.fill(0);

  const take = (c: BBCar, zi: number, iv: number, route: number) => {
    if (owner[zi] !== route) { owner[zi] = route; ownerCount[zi] = 0; }
    ownerCount[zi]++;
    c.zone = zi;
    c.iv = iv;
    waitSince[zi * nr + route] = 0;
  };
  const release = (c: BBCar) => {
    if (c.zone < 0) return;
    if (--ownerCount[c.zone] <= 0) { ownerCount[c.zone] = 0; owner[c.zone] = -1; }
    c.zone = -1;
    c.iv = -1;
  };

  lanes.forEach((lane) => {
    const g = routes[lane.route];
    const L = g.L;
    const r = lane.route;

    // Bring the fleet into service one car per frame, in the widest gap
    // and never inside a zone, so no car ever appears on top of another.
    const idle = lane.cars.find((ci) => !cars[ci].active);
    if (idle !== undefined) {
      const fresh = cars[idle];
      const act = lane.cars.filter((ci) => cars[ci].active).map((ci) => cars[ci]).sort((p, q) => mod(p.s, L) - mod(q.s, L));
      const free = (s: number) => lane.intervals.every((iv) => mod(s - iv.a + 2, L) > iv.len + 4);
      let spot = -1;
      if (!act.length) {
        for (let s = 0; s < L; s += 4) if (free(s)) { spot = s; break; }
      } else {
        let best = 0, bestGap = 0;
        act.forEach((c, k) => {
          const gap = act.length === 1 ? L : mod(act[(k + 1) % act.length].s - c.s, L);
          if (gap > bestGap) { bestGap = gap; best = k; }
        });
        const back = act[best], front = act[(best + 1) % act.length];
        const lo = followGap(fresh, back), hi = bestGap - followGap(fresh, front);
        for (let u = (lo + hi) / 2; u >= lo; u -= 4) if (free(back.s + u)) { spot = back.s + u; break; }
      }
      if (spot >= 0) { fresh.s = spot; fresh.speed = 0; fresh.active = true; fresh.zone = -1; fresh.iv = -1; }
    }

    const order = lane.cars.filter((ci) => cars[ci].active).map((ci) => cars[ci]).sort((p, q) => mod(p.s, L) - mod(q.s, L));
    for (let k = order.length - 1; k >= 0; k--) {
      const c = order[k];
      const sMod = mod(c.s, L);
      const cruise = c.cruise * slow;
      let target = cruise;

      const ahead = order.length > 1 ? order[(k + 1) % order.length] : null;
      const aheadS = ahead ? c.s + (mod(ahead.s - c.s, L) || L) : Infinity;
      let gapHold = Infinity;
      if (ahead) {
        gapHold = aheadS - followGap(c, ahead);
        target = Math.min(target, Math.sqrt(ahead.speed ** 2 + 2 * BRAKE * Math.max(0, gapHold - c.s)));
      }

      // Next zone the centre reaches (skipping the one held).
      let nextIdx = -1, toZone = Infinity;
      lane.intervals.forEach((iv, i) => {
        if (i === c.iv) return;
        const d = mod(iv.a - sMod, L);
        if (d < toZone && d < L - iv.len) { toZone = d; nextIdx = i; }
      });
      const next = nextIdx >= 0 ? lane.intervals[nextIdx] : null;
      const mayEnter = (iv: Interval, d: number, record: boolean) => {
        const z = zones[iv.zone];
        if (z.crossing && z.crossing.routes.includes(r)) {
          const st = bbSignalState(z.crossing, r, now);
          if (st === 2 || (st === 1 && d > c.speed ** 2 / (2 * BRAKE))) return false;
        }
        let ok = owner[iv.zone] === -1 || owner[iv.zone] === r;
        // Fairness: a route that has waited longer gets the zone next.
        if (ok) {
          const mine = waitSince[iv.zone * nr + r];
          for (let q = 0; q < nr && ok; q++) {
            if (q === r) continue;
            const w = waitSince[iv.zone * nr + q];
            if (w > 0 && now - w > 2.5 && (mine === 0 || w < mine)) ok = false;
          }
        }
        if (!ok && record && d < 3) {
          const key = iv.zone * nr + r;
          waitSeen[key] = 1;
          if (waitSince[key] === 0) waitSince[key] = now;
        }
        // don't block the zone: there must be room for me past its exit
        return ok && (!ahead || aheadS - followGap(c, ahead) >= c.s + d + iv.len + 1);
      };
      let zoneHold = Infinity;
      if (next && toZone < LOOKAHEAD && !mayEnter(next, toZone, true)) {
        zoneHold = c.s + toZone - 0.5;
        target = Math.min(target, Math.sqrt(2 * BRAKE * Math.max(0, zoneHold - c.s)));
      }

      const accel = target >= c.speed ? ACCEL : BRAKE;
      c.speed += Math.max(-accel * step, Math.min(accel * step, target - c.speed));
      if (c.speed < 0) c.speed = 0;
      let ns = c.s + c.speed * step;
      if (ns > gapHold) { ns = Math.max(c.s, gapHold); c.speed = 0; }
      if (ns > zoneHold) { ns = Math.max(c.s, zoneHold); c.speed = 0; }
      if (next && ns - c.s >= toZone) {
        if (mayEnter(next, toZone, false)) { release(c); take(c, next.zone, nextIdx, r); }
        else { ns = Math.max(c.s, c.s + toZone - 0.5); c.speed = 0; }
      }
      if (c.iv >= 0) {
        const iv = lane.intervals[c.iv];
        if (mod(ns - (iv.a + iv.len), L) < L / 2) release(c);
      }
      c.s = ns;

      const off = bbLaneOffset(c.kind);
      const [x, z] = lanePoint(g, lane.dir, c.s, off);
      const [rx, rz] = lanePoint(g, lane.dir, c.s - 4, off);
      const [fx, fz] = lanePoint(g, lane.dir, c.s + 4, off);
      c.x = x; c.z = z;
      // Across the route-end wrap the chord would span the whole map;
      // keep the previous heading for that one frame.
      if (Math.hypot(fx - rx, fz - rz) < 12) c.heading = Math.atan2(fz - rz, fx - rx);
    }
  });
  // A route no longer held at a zone's edge stops counting as waiting.
  for (let i = 0; i < waitSeen.length; i++) if (!waitSeen[i]) waitSince[i] = 0;
}

// Signal heads for every crossing: one per route direction, on the
// driver's near-left kerb just before its conflict zone, facing the queue.
export function bbSignalPoles(sim: BBSim) {
  const out: { x: number; z: number; fx: number; fz: number; crossing: BBCrossing; route: number }[] = [];
  for (const c of sim.crossings) {
    for (const r of c.routes) {
      for (const li of [r * 2, r * 2 + 1]) {
        const lane = sim.lanes[li], g = sim.routes[r];
        let best = 0, bestD = Infinity;
        for (let s = 0; s <= g.L; s += 2) {
          const [x, z] = lanePoint(g, lane.dir, s, 0);
          const d = Math.hypot(x - c.x, z - c.z);
          if (d < bestD) { bestD = d; best = s; }
        }
        const iv = lane.intervals.find((v) => mod(best - v.a, g.L) <= v.len);
        const stopS = iv ? iv.a + 6 : best - 50;
        const [px, pz] = lanePoint(g, lane.dir, stopS, g.width / 2 + 5);
        const [ax, az] = lanePoint(g, lane.dir, stopS - 4, 0), [bx, bz] = lanePoint(g, lane.dir, stopS + 4, 0);
        const l = Math.hypot(bx - ax, bz - az) || 1;
        out.push({ x: px, z: pz, fx: -(bx - ax) / l, fz: -(bz - az) / l, crossing: c, route: r });
      }
    }
  }
  return out;
}
