// Road network for the multiplayer city hub.
//
// Avatars walk along every street line of the city grid, on a lane just
// inside the kerb: the arterial roads plus the internal lanes that
// CityScene paves over with neighbourhood greens (they read as footpaths). Paths are
// deterministic: every client computes the same route from the same
// (from, to) pair, so the network only has to carry start and destination
// points, never per-frame positions.

import { ROAD_GAP, PLOT, roadsH, roadsV, worldCentre } from "../../kawasan-3d/cityData";

const ROAD_W = ROAD_GAP - PLOT;
/** Offset from the road centre line toward the kerb, so avatars don't walk down the lane markings. */
const KERB_OFFSET = 13;

export type Vec2 = [number, number];
export type RoadGrid = { xs: number[]; zs: number[]; minX: number; maxX: number; minZ: number; maxZ: number };

export function buildRoadGrid(gridSize: number): RoadGrid {
  const centre = worldCentre(gridSize);
  const xs = roadsV(gridSize).map((x) => x - centre + ROAD_W / 2 + KERB_OFFSET);
  const zs = roadsH(gridSize).map((z) => z - centre + ROAD_W / 2 + KERB_OFFSET);
  return { xs, zs, minX: xs[0], maxX: xs[xs.length - 1], minZ: zs[0], maxZ: zs[zs.length - 1] };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const nearest = (values: number[], value: number) => values.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best), values[0]);
const EPS = 0.01;
const onV = (grid: RoadGrid, p: Vec2) => grid.xs.some((x) => Math.abs(x - p[0]) < EPS);
const onH = (grid: RoadGrid, p: Vec2) => grid.zs.some((z) => Math.abs(z - p[1]) < EPS);

/** Nearest point on the road network to an arbitrary ground point. */
export function snapToRoad(grid: RoadGrid, point: Vec2): Vec2 {
  const x = clamp(point[0], grid.minX, grid.maxX);
  const z = clamp(point[1], grid.minZ, grid.maxZ);
  const vx = nearest(grid.xs, x);
  const hz = nearest(grid.zs, z);
  return Math.abs(vx - x) <= Math.abs(hz - z) ? [vx, z] : [x, hz];
}

/** The (up to two) junctions bounding the road segment a point sits on. */
function junctionsAround(grid: RoadGrid, p: Vec2): Vec2[] {
  const out: Vec2[] = [];
  if (onV(grid, p)) {
    const below = [...grid.zs].reverse().find((z) => z <= p[1] + EPS);
    const above = grid.zs.find((z) => z >= p[1] - EPS);
    if (below !== undefined) out.push([p[0], below]);
    if (above !== undefined) out.push([p[0], above]);
  }
  if (onH(grid, p)) {
    const left = [...grid.xs].reverse().find((x) => x <= p[0] + EPS);
    const right = grid.xs.find((x) => x >= p[0] - EPS);
    if (left !== undefined) out.push([left, p[1]]);
    if (right !== undefined) out.push([right, p[1]]);
  }
  return out;
}

const manhattan = (a: Vec2, b: Vec2) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/** Shortest road route from `from` to `to` (both already on the network), as waypoints ending at `to`. */
export function roadPath(grid: RoadGrid, from: Vec2, to: Vec2): Vec2[] {
  if (manhattan(from, to) < EPS) return [to];
  const sameV = onV(grid, from) && onV(grid, to) && Math.abs(from[0] - to[0]) < EPS;
  const sameH = onH(grid, from) && onH(grid, to) && Math.abs(from[1] - to[1]) < EPS;
  if (sameV || sameH) return [to];

  let best: Vec2[] = [to];
  let bestCost = Infinity;
  for (const a of junctionsAround(grid, from)) {
    for (const b of junctionsAround(grid, to)) {
      // Junction to junction: along a's horizontal road, then b's vertical road.
      const corner: Vec2 = [b[0], a[1]];
      const cost = manhattan(from, a) + manhattan(a, b) + manhattan(b, to);
      if (cost < bestCost - EPS) {
        bestCost = cost;
        best = [a, corner, b, to];
      }
    }
  }
  // Drop zero-length legs so walkers don't stall on duplicate points.
  return best.filter((point, index) => manhattan(point, index === 0 ? from : best[index - 1]) > EPS || index === best.length - 1);
}

/** A spawn point on a road near the city centre, spread out so arrivals don't stack. */
export function spawnPoint(grid: RoadGrid, seed: string): Vec2 {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const r1 = ((hash >>> 0) % 1000) / 1000;
  const r2 = (((hash >>> 10) >>> 0) % 1000) / 1000;
  const cx = nearest(grid.xs, 0);
  const cz = nearest(grid.zs, 0);
  return r2 < 0.5 ? [cx, clamp(cz + (r1 - 0.5) * 600, grid.minZ, grid.maxZ)] : [clamp(cx + (r1 - 0.5) * 600, grid.minX, grid.maxX), cz];
}

/** Advance a walker along its waypoints by `step` world units. Mutates and returns the remaining path. */
export function advance(position: Vec2, path: Vec2[], step: number): { position: Vec2; path: Vec2[]; heading: number | null } {
  let [x, z] = position;
  let remaining = step;
  let heading: number | null = null;
  const queue = [...path];
  while (queue.length && remaining > 0) {
    const [tx, tz] = queue[0];
    const dx = tx - x; const dz = tz - z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1e-6) heading = Math.atan2(dx, dz);
    if (distance <= remaining) { x = tx; z = tz; remaining -= distance; queue.shift(); }
    else { x += (dx / distance) * remaining; z += (dz / distance) * remaining; remaining = 0; }
  }
  return { position: [x, z], path: queue, heading };
}
