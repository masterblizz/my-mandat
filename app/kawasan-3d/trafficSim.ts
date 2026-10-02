// Grid-city traffic simulation — pure maths, no React / three.js, so the
// collision guarantees can be checked headlessly (scripts/traffic-check).
// scenery.tsx's <Traffic> owns the instanced meshes and just renders the
// poses this module writes onto each car.
//
// Cars are bound to closed LOOPS made of straight segments joined by
// quarter-circle arcs, so they corner at every junction. Loops that cross
// the central roundabout are rerouted around its ring (detourRoundabout).
// A loop carries a signal GATE only at the signalised 4-way junctions it
// enters (signalJunctions) — the same list <TrafficLights> draws poles
// for, so a car never stops at a light that isn't there.

import { ROAD_GAP, PLOT, worldCentre, roadsV, roadsH } from "./cityData";

const ROAD_W = ROAD_GAP - PLOT;

// ── signals ─────────────────────────────────────────────────────────
export const TL_CYCLE = 9; // seconds for a full green -> amber -> red loop

// Single source of truth for the signal phase — both the lit lens and the
// car behaviour read this so what you see and what the cars do can never
// drift. `axisIsX` = the approach travels along world X (an E-W movement);
// the crossing Z movement runs the opposite half-cycle. Returns 0 green /
// 1 amber / 2 red, with a small all-red overlap so cross streams never
// both show green.
export function signalStateFor(axisIsX: boolean, timeSec: number): 0 | 1 | 2 {
  const local = (timeSec / TL_CYCLE + (axisIsX ? 0 : 0.5)) % 1;
  if (local < 0.46) return 0; // green
  if (local < 0.53) return 1; // amber
  return 2;                    // red
}

export type Junction = { x: number; z: number };

// Every visible 4-way junction gets a signal: both crossing roads must be
// interior arterials (edge roads only make T-junctions), the vertical one
// must not be the river, the centre roundabout runs free, and a junction
// swallowed whole by a large building footprint isn't a junction.
export function signalJunctions(
  gridSize: number,
  roadIndices: { vertical: number[]; horizontal: number[] },
  opts: { riverRoadIndex?: number | null; roundabout?: [number, number] | null; claimed?: Set<string> } = {},
): Junction[] {
  const centre = worldCentre(gridSize);
  const out: Junction[] = [];
  for (const i of roadIndices.vertical) {
    if (i <= 0 || i >= gridSize || i === opts.riverRoadIndex) continue;
    for (const j of roadIndices.horizontal) {
      if (j <= 0 || j >= gridSize) continue;
      const quad = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]];
      if (opts.claimed && quad.every(([c, r]) => opts.claimed!.has(`${c},${r}`))) continue;
      const x = i * ROAD_GAP - centre + ROAD_W / 2;
      const z = j * ROAD_GAP - centre + ROAD_W / 2;
      if (opts.roundabout && Math.hypot(x - opts.roundabout[0], z - opts.roundabout[1]) < 1) continue;
      out.push({ x, z });
    }
  }
  return out;
}

// ── superblock road network ─────────────────────────────────────────
export function neighbourhoodSpans(gridSize: number, density: number) {
  // Vary both directions: the city should have recognisable superblocks,
  // not a repeating chessboard. Rural keeps its two 3×6 town blocks while
  // metro/dense maps get irregular 3–6 cell neighbourhoods.
  const partition = (length: number, pattern: number[]) => {
    const spans: number[] = [];
    let used = 0;
    let index = 0;
    while (used < length) {
      const size = Math.min(pattern[index % pattern.length], length - used);
      spans.push(size);
      used += size;
      index += 1;
    }
    return spans;
  };
  const colSpans = density < 0.3
    ? [3, 3]
    : density < 0.62
    ? partition(gridSize, [3, 5])
    : density < 0.85
    ? partition(gridSize, [4, 3, 5, 4])
    : partition(gridSize, [4, 5, 3, 6]);
  const rowSpans = density < 0.3
    ? [gridSize]
    : density < 0.62
    ? partition(gridSize, [3, 5])
    : density < 0.85
    ? partition(gridSize, [3, 5, 4, 4])
    : partition(gridSize, [5, 3, 4, 6]);
  return { colSpans, rowSpans };
}

// Traffic uses the same major-road boundaries that remain visible around the
// superblocks. Internal grid gaps are now continuous neighbourhood ground,
// so routing vehicles through them would make cars appear to drive on grass.
export function superblockTrafficRoads(gridSize: number, density: number) {
  const { colSpans, rowSpans } = neighbourhoodSpans(gridSize, density);
  const starts = (spans: number[]) => spans.reduce<number[]>((items, span) => {
    items.push(items[items.length - 1] + span);
    return items;
  }, [0]);
  return {
    vertical: starts(colSpans).filter((index) => index < gridSize),
    horizontal: starts(rowSpans),
  };
}

// ── vehicles ────────────────────────────────────────────────────────
// Every kind rides the same loops / signal / gap logic; they differ only in
// how the shared body+cabin+wheel+light instances are scaled and offset:
//   car   — hull + greenhouse
//   van   — one tall boxy hull + a short glassy nose section
//   lorry — `body` is the tall cargo box (shifted back), `cabin` the cab up front
//   bus   — one long tall hull + a thin dark window band for `cabin`
export type VKind = "car" | "van" | "lorry" | "bus" | "police" | "ambulance" | "fire";
const V_MIX: { k: VKind; p: number }[] = [
  { k: "car", p: 0.635 }, { k: "van", p: 0.12 }, { k: "lorry", p: 0.10 }, { k: "bus", p: 0.08 },
  { k: "police", p: 0.025 }, { k: "ambulance", p: 0.025 }, { k: "fire", p: 0.015 },
];
export function pickKind(r: number): VKind {
  let a = 0;
  for (const m of V_MIX) { a += m.p; if (r < a) return m.k; }
  return "car";
}
export const V_SPEC: Record<VKind, {
  bodyS: [number, number, number]; bodyDX: number; bodyY: number;
  cabS: [number, number, number]; cabDX: number; cabY: number;
  half: number; wheel: number; tint: number;
}> = {
  car:   { bodyS: [1, 1, 1],          bodyDX: 0,    bodyY: 4,
           cabS: [1, 1, 1],           cabDX: 0,     cabY: 7.4,  half: 9,    wheel: 1,    tint: 0.64 },
  van:   { bodyS: [1.18, 1.7, 1.02],  bodyDX: -0.5, bodyY: 5.7,
           cabS: [0.62, 0.62, 0.98],  cabDX: 6.4,   cabY: 7.6,  half: 10.5, wheel: 1,    tint: 0.72 },
  lorry: { bodyS: [1.3, 1.45, 1.0],   bodyDX: -3.4, bodyY: 5.3,
           cabS: [0.72, 1.42, 1.0],   cabDX: 9.2,   cabY: 4.6,  half: 13,   wheel: 1.16, tint: 0.5  },
  bus:   { bodyS: [1.95, 2.02, 1.05], bodyDX: 0,    bodyY: 6.8,
           cabS: [1.86, 0.5, 1.06],   cabDX: 0,     cabY: 10.6, half: 16,   wheel: 1.12, tint: 0.82 },
  police:{ bodyS: [1, 1, 1],           bodyDX: 0,    bodyY: 4,
           cabS: [1, 1, 1],            cabDX: 0,     cabY: 7.4,  half: 9,    wheel: 1,    tint: 0.64 },
  ambulance: { bodyS: [1.18, 1.7, 1.02], bodyDX: -0.5, bodyY: 5.7,
           cabS: [0.62, 0.62, 0.98],   cabDX: 6.4,   cabY: 7.6,  half: 10.5, wheel: 1,    tint: 0.72 },
  fire:  { bodyS: [1.3, 1.45, 1.0],   bodyDX: -3.4, bodyY: 5.3,
           cabS: [0.72, 1.42, 1.0],    cabDX: 9.2,   cabY: 4.6,  half: 13,   wheel: 1.16, tint: 0.5  },
};

// Rigid footprint used for spacing and the collision check: the furthest
// body / cab / bumper extent (lorries carry their cargo box well behind
// centre) and the wheel track as the half-width.
export function vehicleFootprint(kind: VKind): { half: number; halfW: number } {
  const s = V_SPEC[kind];
  const half = Math.max(
    s.half * 1.06,
    Math.abs(s.bodyDX) + 9 * s.bodyS[0],
    Math.abs(s.cabDX) + 4.75 * s.cabS[0],
  );
  return { half, halfW: 4.8 };
}

export const CAR_BASE_SPEED = 78;   // world units / sec on a clear straight
const CAR_ACCEL = 130;
export const CAR_BRAKE = 240;
const CAR_ARC_SPEED = 34;     // cornering / roundabout speed cap
const CAR_GAP_LIGHT = 18;     // clear-road bumper gap
const CAR_GAP_PEAK = 7;       // compact but still visibly separated in a jam
const BRAKE_LOOKAHEAD = 150;  // start reacting to a gate this far out

// ── loop geometry ───────────────────────────────────────────────────
type Piece = {
  kind: "line" | "arc";
  s0: number;
  len: number;
  // line
  ax?: number; az?: number; bx?: number; bz?: number;
  // arc
  cx?: number; cz?: number; r?: number; a0?: number; a1?: number;
  // gate at the END of this piece (a grid junction the loop crosses)
  gateAxisIsX?: boolean;
};
export type Loop = { pieces: Piece[]; L: number; gates: { s: number; axisIsX: boolean }[] };

function lineP(ax: number, az: number, bx: number, bz: number, gateAxisIsX?: boolean): Piece {
  return { kind: "line", s0: 0, len: Math.hypot(bx - ax, bz - az), ax, az, bx, bz, gateAxisIsX };
}
function arcP(cx: number, cz: number, r: number, a0: number, a1: number): Piece {
  return { kind: "arc", s0: 0, len: Math.abs(a1 - a0) * r, cx, cz, r, a0, a1 };
}
function finishLoop(pieces: Piece[]): Loop {
  let acc = 0;
  const gates: { s: number; axisIsX: boolean }[] = [];
  for (const p of pieces) {
    p.s0 = acc;
    acc += p.len;
    if (p.kind === "line" && p.gateAxisIsX !== undefined) {
      gates.push({ s: acc, axisIsX: p.gateAxisIsX }); // gate sits at the piece end
    }
  }
  return { pieces, L: acc, gates };
}
export function posAt(loop: Loop, s: number): [number, number] {
  let ss = s % loop.L;
  if (ss < 0) ss += loop.L;
  const pcs = loop.pieces;
  let p = pcs[pcs.length - 1];
  for (const q of pcs) { if (ss < q.s0 + q.len || q === pcs[pcs.length - 1]) { p = q; break; } }
  const t = p.len > 0 ? (ss - p.s0) / p.len : 0;
  if (p.kind === "line") {
    return [p.ax! + (p.bx! - p.ax!) * t, p.az! + (p.bz! - p.az!) * t];
  }
  const a = p.a0! + (p.a1! - p.a0!) * t;
  return [p.cx! + Math.cos(a) * p.r!, p.cz! + Math.sin(a) * p.r!];
}

// One Malaysian left-hand-traffic loop around the plot bounded by
// x0<x1, z0<z1. The carriageway runs counter-clockwise with the plot on
// the driver's left: westbound on the top road, southbound on the left,
// eastbound on the bottom and northbound on the right. Each corner is
// therefore a protected left turn around its own quadrant of the junction,
// rather than a wide right turn that crossed the junction centre and
// overlapped the neighbouring block's path.
export function blockLoop(x0: number, x1: number, z0: number, z1: number, laneOff: number, turnR: number): Loop {
  const L = laneOff, R = turnR;
  const tx0 = x0 + L, tx1 = x1 - L, tz0 = z0 + L, tz1 = z1 - L; // lane centreline box
  const pieces: Piece[] = [
    // top edge, travelling west -> gate for the NW junction (E-W movement)
    lineP(tx1 - R, tz0, tx0 + R, tz0, true),
    arcP(tx0 + R, tz0 + R, R, -Math.PI / 2, -Math.PI),
    // left edge, travelling south -> gate for the SW junction (N-S movement)
    lineP(tx0, tz0 + R, tx0, tz1 - R, false),
    arcP(tx0 + R, tz1 - R, R, Math.PI, Math.PI / 2),
    // bottom edge, travelling east -> gate for the SE junction
    lineP(tx0 + R, tz1, tx1 - R, tz1, true),
    arcP(tx1 - R, tz1 - R, R, Math.PI / 2, 0),
    // right edge, travelling north -> gate for the NE junction
    lineP(tx1, tz1 - R, tx1, tz0 + R, false),
    arcP(tx1 - R, tz0 + R, R, 0, -Math.PI / 2),
  ];
  return finishLoop(pieces);
}

export type GridRoadCentres = { x: number[]; z: number[] };

// The rendered road planes use the same grid centres. Keep this check next
// to the route code so every dynamic road user can reject a bad transform
// instead of ever placing a vehicle on a neighbourhood ground slab.
export function gridRoadCentres(
  gridSize: number,
  roadIndices?: { vertical: number[]; horizontal: number[] },
): GridRoadCentres {
  const centre = worldCentre(gridSize);
  return {
    x: (roadIndices?.vertical ?? roadsV(gridSize).map((_, index) => index))
      .map((index) => index * ROAD_GAP - centre + ROAD_W / 2),
    z: (roadIndices?.horizontal ?? roadsH(gridSize).map((_, index) => index))
      .map((index) => index * ROAD_GAP - centre + ROAD_W / 2),
  };
}

export function pointOnGridAsphalt(x: number, z: number, roads: GridRoadCentres, edgePadding = 2) {
  const halfWidth = ROAD_W / 2 - edgePadding;
  return roads.x.some((roadX) => Math.abs(x - roadX) <= halfWidth)
    || roads.z.some((roadZ) => Math.abs(z - roadZ) <= halfWidth);
}

// Pieces covering arc-length [sA, sB] of `loop` (0 ≤ sA < sB ≤ sA + L;
// sB may run past L and wraps). A line keeps its signal gate only when
// its real end — the junction — is still included.
function slicePieces(loop: Loop, sA: number, sB: number): Piece[] {
  const out: Piece[] = [];
  for (let lap = 0; lap <= 1; lap++) {
    const off = lap * loop.L;
    for (const p of loop.pieces) {
      const p0 = p.s0 + off, p1 = p.s0 + p.len + off;
      const a = Math.max(sA, p0), b = Math.min(sB, p1);
      if (b - a < 1e-6) continue;
      const ta = (a - p0) / p.len, tb = (b - p0) / p.len;
      if (p.kind === "line") {
        const dx = p.bx! - p.ax!, dz = p.bz! - p.az!;
        out.push(lineP(p.ax! + dx * ta, p.az! + dz * ta, p.ax! + dx * tb, p.az! + dz * tb,
          b >= p1 - 1e-6 ? p.gateAxisIsX : undefined));
      } else {
        const da = p.a1! - p.a0!;
        out.push(arcP(p.cx!, p.cz!, p.r!, p.a0! + da * ta, p.a0! + da * tb));
      }
    }
  }
  return out;
}

function headingAt(loop: Loop, s: number): [number, number] {
  const [ax, az] = posAt(loop, s - 0.5), [bx, bz] = posAt(loop, s + 0.5);
  const l = Math.hypot(bx - ax, bz - az) || 1;
  return [(bx - ax) / l, (bz - az) / l];
}

// Cubic Hermite blend from (p0, t0) to (p1, t1) as short line pieces, so
// the swing onto and off the ring has no heading snap.
function blendPieces(p0: [number, number], t0: [number, number], p1: [number, number], t1: [number, number]): Piece[] {
  const k = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1.1;
  const at = (t: number): [number, number] => {
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return [
      h00 * p0[0] + h10 * k * t0[0] + h01 * p1[0] + h11 * k * t1[0],
      h00 * p0[1] + h10 * k * t0[1] + h01 * p1[1] + h11 * k * t1[1],
    ];
  };
  const out: Piece[] = [];
  let prev = p0;
  for (let i = 1; i <= 10; i++) {
    const q = at(i / 10);
    out.push(lineP(prev[0], prev[1], q[0], q[1]));
    prev = q;
  }
  return out;
}

// Reroute a loop through the roundabout at (cx, cz). Wherever its lane
// would cross the ring (and so the landscaped island), the vehicle
// instead blends onto a circulating lane of radius `laneR`, runs
// clockwise on screen (Malaysian left-hand traffic: increasing
// atan2(z, x) goes east → south) and blends back onto its own route on
// the far side. Signal gates inside the cut section are dropped —
// roundabouts run free.
export function detourRoundabout(loop: Loop, cx: number, cz: number, laneR: number, blend = 28): Loop {
  const dist = (s: number) => {
    const [x, z] = posAt(loop, s);
    return Math.hypot(x - cx, z - cz);
  };
  const inside = (s: number) => dist(s) < laneR;
  const step = 2;
  const n = Math.ceil(loop.L / step);
  // Walk from the point farthest from the ring, so no crossing (and its
  // entry/exit blend) straddles the lap seam.
  let start = 0, far = -1;
  for (let i = 0; i < n; i++) { const d = dist(i * step); if (d > far) { far = d; start = i * step; } }
  if (far < laneR) return loop;
  // Crossing intervals [in, out], relative to `start`, refined by bisection.
  const refine = (lo: number, hi: number) => {
    const from = inside(start + lo);
    for (let k = 0; k < 20; k++) {
      const m = (lo + hi) / 2;
      if (inside(start + m) === from) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };
  const spans: [number, number][] = [];
  let enter = -1;
  for (let i = 1; i <= n; i++) {
    const u0 = (i - 1) * step, u1 = Math.min(i * step, loop.L);
    const was = inside(start + u0), now = inside(start + u1);
    if (!was && now) enter = refine(u0, u1);
    else if (was && !now && enter >= 0) { spans.push([enter, refine(u0, u1)]); enter = -1; }
  }
  if (!spans.length) return loop;

  const ringPt = (a: number): [number, number] => [cx + Math.cos(a) * laneR, cz + Math.sin(a) * laneR];
  const ringTan = (a: number): [number, number] => [-Math.sin(a), Math.cos(a)];
  const dAng = blend / laneR;
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const [uIn, uOut] of spans) {
    const sIn = Math.max(cursor, uIn - blend), sOut = Math.min(loop.L, uOut + blend);
    if (sIn > cursor) pieces.push(...slicePieces(loop, start + cursor, start + sIn));
    const [ex, ez] = posAt(loop, start + uIn);
    const [xx, xz] = posAt(loop, start + uOut);
    const a0 = Math.atan2(ez - cz, ex - cx) + dAng;
    let a1 = Math.atan2(xz - cz, xx - cx) - dAng;
    while (a1 <= a0 + 0.2) a1 += Math.PI * 2;
    pieces.push(...blendPieces(posAt(loop, start + sIn), headingAt(loop, start + sIn), ringPt(a0), ringTan(a0)));
    pieces.push(arcP(cx, cz, laneR, a0, a1));
    pieces.push(...blendPieces(ringPt(a1), ringTan(a1), posAt(loop, start + sOut), headingAt(loop, start + sOut)));
    cursor = sOut;
  }
  if (cursor < loop.L) pieces.push(...slicePieces(loop, start + cursor, start + loop.L));
  return finishLoop(pieces);
}

// ── collision geometry ──────────────────────────────────────────────
// Separating-axis test for two yawed rectangles (x, z centre; heading =
// atan2(dz, dx) of the long axis). `pad` grows both boxes.
export function boxesOverlap(
  ax: number, az: number, ah: number, aHalf: number, aW: number,
  bx: number, bz: number, bh: number, bHalf: number, bW: number,
  pad = 0,
): boolean {
  const dx = bx - ax, dz = bz - az;
  const reach = aHalf + aW + bHalf + bW + 2 * pad;
  if (dx * dx + dz * dz > reach * reach) return false;
  const axes = [[Math.cos(ah), Math.sin(ah)], [-Math.sin(ah), Math.cos(ah)], [Math.cos(bh), Math.sin(bh)], [-Math.sin(bh), Math.cos(bh)]];
  const aU = axes[0], aV = axes[1], bU = axes[2], bV = axes[3];
  for (const [nx, nz] of axes) {
    const dist = Math.abs(dx * nx + dz * nz);
    const ra = (aHalf + pad) * Math.abs(aU[0] * nx + aU[1] * nz) + (aW + pad) * Math.abs(aV[0] * nx + aV[1] * nz);
    const rb = (bHalf + pad) * Math.abs(bU[0] * nx + bU[1] * nz) + (bW + pad) * Math.abs(bV[0] * nx + bV[1] * nz);
    if (dist > ra + rb) return false;
  }
  return true;
}

/// ── simulation ──────────────────────────────────────────────────────
// Each loop is its own single-file queue (following distance by arc
// length), and loops never share a lane. Where they DO meet is the junction
// box: every block turns left round its own quadrant, but a long bus or
// lorry swings its nose into the next block's approach lane while it turns.
// So each junction is a shared box with an axis mutex: a car may only nose
// into it when (1) its signal allows, (2) no car that entered on the
// crossing axis is still inside, and (3) its own exit is clear, so nobody
// ever stops inside the box and the mutex can't gridlock. Diagonal
// quadrants share an axis and never touch, so two streams still flow.

const BOX_HALF = ROAD_W / 2 + 8; // junction square + the swing allowance

type Box = { j: number; sIn: number; len: number; axisIsX: boolean };

export type SimCar = {
  loop: number;
  s: number;        // arc-length position around the loop (unwrapped)
  speed: number;
  wheelSpin: number;
  braking: boolean;
  kind: VKind;
  half: number;
  halfW: number;
  /** running this frame (count follows the traffic level) */
  active: boolean;
  /** index into loopBoxes[loop] of the junction box it holds, or -1 */
  box: number;
  /** written by stepTraffic: rendered pose; visible=false → park the instance */
  visible: boolean;
  x: number; z: number; heading: number;
  /** distance to the next corner arc (indicator timing) */
  turnDistance: number;
};

export type TrafficSim = {
  loops: Loop[];
  cars: SimCar[];
  /** car indices per loop */
  perLoop: number[][];
  loopBoxes: Box[][];
  /** per junction: whether a signal stands there */
  signalised: boolean[];
  /** per junction: cars inside that entered on X / on Z */
  occX: Int16Array;
  occZ: Int16Array;
  asphalt: GridRoadCentres;
};

const mod = (a: number, L: number) => ((a % L) + L) % L;

export function createTrafficSim(opts: {
  gridSize: number;
  roadIndices?: { vertical: number[]; horizontal: number[] };
  riverRoadIndex?: number | null;
  roundabout?: [number, number] | null;
  roundaboutLaneR: number;
  signals: Junction[];
}): TrafficSim {
  const { gridSize, roadIndices, riverRoadIndex = null, roundabout = null, signals } = opts;
  const centre = worldCentre(gridSize);
  let seed = gridSize * 911 + 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const xs = (roadIndices?.vertical ?? roadsV(gridSize).map((_, index) => index))
    .map((index) => index * ROAD_GAP - centre + ROAD_W / 2);
  const zs = (roadIndices?.horizontal ?? roadsH(gridSize).map((_, index) => index))
    .map((index) => index * ROAD_GAP - centre + ROAD_W / 2);
  const laneOff = ROAD_W * 0.2;
  // The lane and arc meet at the plot corner (20 u from the road centre),
  // keeping the whole turn on asphalt instead of cutting into the plot.
  const turnR = ROAD_W / 2 - laneOff;

  const loops: Loop[] = [];
  const cars: SimCar[] = [];
  const addCarsTo = (loopIdx: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const kind = pickKind(rnd());
      const fp = vehicleFootprint(kind);
      cars.push({
        loop: loopIdx,
        s: 0,
        speed: CAR_BASE_SPEED * (0.7 + rnd() * 0.3),
        wheelSpin: rnd() * Math.PI * 2,
        braking: false,
        kind,
        half: fp.half,
        halfW: fp.halfW,
        active: false,
        box: -1,
        visible: false, x: 0, z: 0, heading: 0, turnDistance: Infinity,
      });
    }
  };

  // One loop per plot, ~55% of plots. Each loop is stocked to its
  // PEAK-HOUR (bumper-to-bumper) capacity; stepTraffic then activates a
  // `trafficLevel` fraction of each loop's cars + a fraction of the
  // (centre-outward) loops, and slows / packs them — so off-peak is far
  // cheaper while PEAK genuinely gridlocks.
  const maxLoops = gridSize >= 22 ? 175 : gridSize >= 14 ? 230 : 9999;
  const peakPerLoop = gridSize >= 22 ? 16 : gridSize >= 14 ? 12 : gridSize <= 6 ? 9 : 16;
  const mid = (xs.length - 1) / 2;
  const order: [number, number][] = [];
  for (let a = 0; a < xs.length - 1; a++)
    for (let b = 0; b < zs.length - 1; b++) order.push([a, b]);
  order.sort((p, q) => (Math.hypot(p[0] - mid, p[1] - mid) - Math.hypot(q[0] - mid, q[1] - mid)));
  for (const [a, b] of order) {
    if (loops.length >= maxLoops) break;
    const leftRoad = roadIndices?.vertical?.[a] ?? a;
    const rightRoad = roadIndices?.vertical?.[a + 1] ?? a + 1;
    if (riverRoadIndex !== null && (leftRoad === riverRoadIndex || rightRoad === riverRoadIndex)) continue;
    if (((a * 73 + b * 31 + gridSize) % 100) >= 55) continue;
    // A loop whose lane crosses the central junction would cut straight
    // through the roundabout island; route it around the ring instead.
    let loop = blockLoop(xs[a], xs[a + 1], zs[b], zs[b + 1], laneOff, turnR);
    if (roundabout) loop = detourRoundabout(loop, roundabout[0], roundabout[1], opts.roundaboutLaneR);
    loops.push(loop);
    addCarsTo(loops.length - 1, peakPerLoop);
  }

  // Junction boxes: where each loop's centreline runs inside a junction
  // square, and on which axis it entered. Only junctions shared by two or
  // more loops need the mutex.
  const junctions: Junction[] = [];
  for (const x of xs) for (const z of zs) junctions.push({ x, z });
  const raw: Box[][] = loops.map((loop) => {
    const out: Box[] = [];
    const step = 1;
    const n = Math.ceil(loop.L / step);
    const where = (s: number) => {
      const [x, z] = posAt(loop, s);
      return junctions.findIndex((jn) => Math.abs(x - jn.x) < BOX_HALF && Math.abs(z - jn.z) < BOX_HALF);
    };
    // start outside any box so no interval straddles the seam
    let s0 = 0;
    while (where(s0) >= 0 && s0 < loop.L) s0 += step;
    let cur = -1, enter = 0;
    for (let i = 0; i <= n; i++) {
      const s = s0 + i * step;
      const j = where(s);
      if (j !== cur) {
        if (cur >= 0) {
          const [ax, az] = posAt(loop, enter), [bx, bz] = posAt(loop, enter + 2);
          out.push({ j: cur, sIn: mod(enter, loop.L), len: s - enter, axisIsX: Math.abs(bx - ax) > Math.abs(bz - az) });
        }
        cur = j; enter = s;
      }
    }
    return out;
  });
  const users = new Map<number, Set<number>>();
  raw.forEach((boxes, li) => boxes.forEach((b) => {
    if (!users.has(b.j)) users.set(b.j, new Set());
    users.get(b.j)!.add(li);
  }));
  const loopBoxes = raw.map((boxes) => boxes.filter((b) => users.get(b.j)!.size > 1));
  const signalised = junctions.map((jn) =>
    signals.some((sj) => Math.abs(sj.x - jn.x) < 1 && Math.abs(sj.z - jn.z) < 1));

  const perLoop: number[][] = loops.map(() => []);
  cars.forEach((c, i) => perLoop[c.loop].push(i));
  return {
    loops, cars, perLoop, loopBoxes, signalised,
    occX: new Int16Array(junctions.length), occZ: new Int16Array(junctions.length),
    asphalt: gridRoadCentres(gridSize, roadIndices),
  };
}

// Rear-to-front chord scaled to the vehicle wheelbase: a stable, gradual
// yaw through the line/arc join instead of pivoting a long body at its
// centre.
function poseAt(loop: Loop, s: number, half: number): [number, number, number] {
  const [x, z] = posAt(loop, s);
  const span = Math.min(8, Math.max(3, half * 0.5));
  const [rx, rz] = posAt(loop, s - span);
  const [fx, fz] = posAt(loop, s + span);
  return [x, z, Math.atan2(fz - rz, fx - rx)];
}

// Centre-to-centre spacing on one loop: both footprints, the bumper gap,
// plus a corner allowance (on a turn the chord is shorter than the arc).
const followGap = (a: SimCar, b: SimCar, bumperGap: number) => a.half + b.half + bumperGap + 4;

export function stepTraffic(sim: TrafficSim, step: number, now: number, level: number) {
  const { loops, cars, perLoop, loopBoxes, signalised, occX, occZ, asphalt } = sim;
  // time-of-day density: activate a fraction of the (centre-outward)
  // loops, and at peak slow every car right down + pack the bumper gaps
  // so the queues at the lights read as a jam, not just "more cars".
  const lv = Math.max(0, Math.min(1, level));
  const activeLoops = Math.max(1, Math.ceil(loops.length * (0.32 + 0.68 * lv)));
  const perLoopFrac = 0.16 + 0.84 * lv;               // how full each active loop is
  const baseSpeed = CAR_BASE_SPEED * (1 - 0.62 * lv); // 78 → ~30 at full jam
  const bumperGap = CAR_GAP_LIGHT + (CAR_GAP_PEAK - CAR_GAP_LIGHT) * lv;

  const release = (c: SimCar) => {
    if (c.box < 0) return;
    const b = loopBoxes[c.loop][c.box];
    if (b.axisIsX) occX[b.j]--; else occZ[b.j]--;
    c.box = -1;
  };
  const park = (c: SimCar) => { release(c); c.active = false; c.visible = false; };

  for (let li = 0; li < loops.length; li++) {
    const loop = loops[li];
    const L = loop.L;
    const boxes = loopBoxes[li];
    const ring = perLoop[li];
    if (li >= activeLoops) {
      // A loop leaves service car by car, each once it is clear of a box.
      for (const ci of ring) if (cars[ci].box < 0) park(cars[ci]);
      if (ring.every((ci) => !cars[ci].active)) continue;
    }

    // Fleet size follows the traffic level one car per frame. A car leaves
    // service only while it holds no box; a new one is slotted into the
    // middle of the widest gap, never inside a box — visible cars are never
    // teleported, so a level change can't drop one onto another.
    const want = li >= activeLoops ? 0
      : Math.max(1, Math.min(ring.length, Math.round(ring.length * perLoopFrac)));
    let act = ring.filter((ci) => cars[ci].active);
    if (act.length > want) {
      const ci = act.find((i) => cars[i].box < 0);
      if (ci !== undefined) { park(cars[ci]); act = act.filter((i) => i !== ci); }
    } else if (act.length < want) {
      const freshIdx = ring.find((ci) => !cars[ci].active)!;
      const fresh = cars[freshIdx];
      const inBox = (s: number) => boxes.some((b) => mod(s + fresh.half + 2 - b.sIn, L) < b.len + 2 * fresh.half + 4);
      let spot = -1;
      if (!act.length) {
        for (let s = 0; s < L; s += 4) if (!inBox(s)) { spot = s; break; }
      } else {
        const sorted = act.map((i) => cars[i]).sort((p, q) => mod(p.s, L) - mod(q.s, L));
        let best = 0, bestGap = 0;
        sorted.forEach((c, k) => {
          const gap = sorted.length === 1 ? L : mod(sorted[(k + 1) % sorted.length].s - c.s, L);
          if (gap > bestGap) { bestGap = gap; best = k; }
        });
        const back = sorted[best], front = sorted[(best + 1) % sorted.length];
        const lo = followGap(fresh, back, bumperGap), hi = bestGap - followGap(fresh, front, bumperGap);
        for (let u = (lo + hi) / 2; u >= lo; u -= 4) {
          if (!inBox(back.s + u)) { spot = back.s + u; break; }
        }
        if (spot >= 0) fresh.speed = Math.min(back.speed, front.speed);
      }
      if (spot >= 0) {
        fresh.s = spot; fresh.active = true; fresh.box = -1;
        fresh.speed = Math.min(fresh.speed, baseSpeed);
        act.push(freshIdx);
      }
    }
    for (const ci of ring) if (!cars[ci].active) cars[ci].visible = false;

    // process lead car first so followers clamp against an updated gap
    const order = act.map((i) => cars[i]).sort((p, q) => mod(p.s, L) - mod(q.s, L));
    for (let k = order.length - 1; k >= 0; k--) {
      const c = order[k];
      const sMod = mod(c.s, L);

      // Desired speed from the road, the next corner and the next box.
      let target = baseSpeed;
      let turnDistance = Infinity;
      // Brake before the turn rather than reaching an arc at straight-line
      // speed and snapping down to the corner limit in a single frame.
      for (const p of loop.pieces) {
        if (p.kind !== "arc") continue;
        const inside = sMod >= p.s0 && sMod < p.s0 + p.len;
        const distance = inside ? 0 : mod(p.s0 - sMod, L);
        turnDistance = Math.min(turnDistance, distance);
        target = Math.min(target, Math.sqrt(CAR_ARC_SPEED ** 2 + 2 * CAR_BRAKE * distance));
      }

      const ahead = order.length > 1 ? order[(k + 1) % order.length] : null;
      const aheadS = ahead ? c.s + (mod(ahead.s - c.s, L) || L) : Infinity;
      let gapHold = Infinity;
      if (ahead) {
        gapHold = aheadS - followGap(c, ahead, bumperGap);
        target = Math.min(target, Math.sqrt(ahead.speed ** 2 + 2 * CAR_BRAKE * Math.max(0, gapHold - c.s)));
      }

      // Next junction box the nose reaches (skipping the one it holds).
      let next = -1, noseToBox = Infinity;
      boxes.forEach((b, bi) => {
        if (bi === c.box) return;
        const d = mod(b.sIn - (sMod + c.half), L);
        if (d < noseToBox && d < L - b.len - 2 * c.half) { noseToBox = d; next = bi; }
      });
      const mayEnter = (b: Box, d: number) => {
        if (signalised[b.j]) {
          const st = signalStateFor(b.axisIsX, now); // 0 green 1 amber 2 red
          if (st === 2 || (st === 1 && d > c.speed ** 2 / (2 * CAR_BRAKE))) return false;
        }
        if ((b.axisIsX ? occZ : occX)[b.j] > 0) return false;
        // don't block the box: my tail must clear it before I'd reach the car ahead
        return !ahead || aheadS - ahead.half - bumperGap >= c.s + d + b.len + 2 * c.half;
      };
      let boxHold = Infinity;
      if (next >= 0 && noseToBox < BRAKE_LOOKAHEAD && !mayEnter(boxes[next], noseToBox)) {
        boxHold = c.s + noseToBox - 0.5;
        target = Math.min(target, Math.sqrt(2 * CAR_BRAKE * Math.max(0, boxHold - c.s)));
      }

      // integrate speed toward target, then advance, then clamp to holds
      const previousSpeed = c.speed;
      const accel = target >= c.speed ? CAR_ACCEL : CAR_BRAKE;
      c.speed += Math.max(-accel * step, Math.min(accel * step, target - c.speed));
      if (c.speed < 0) c.speed = 0;
      if (c.speed > baseSpeed) c.speed = baseSpeed;
      let ns = c.s + c.speed * step;
      if (ns > gapHold) { ns = Math.max(c.s, gapHold); c.speed = 0; }
      if (ns > boxHold) { ns = Math.max(c.s, boxHold); c.speed = 0; }
      // Nose reaches the box this frame: re-check against what moved
      // earlier in the frame, then take the box or stop at its edge.
      if (next >= 0 && ns - c.s >= noseToBox) {
        const b = boxes[next];
        if (mayEnter(b, noseToBox)) {
          release(c);
          c.box = next;
          if (b.axisIsX) occX[b.j]++; else occZ[b.j]++;
        } else {
          ns = Math.max(c.s, c.s + noseToBox - 0.5);
          c.speed = 0;
        }
      }
      // Tail out of the held box: hand it back.
      if (c.box >= 0) {
        const b = boxes[c.box];
        if (mod(ns - c.half - (b.sIn + b.len), L) < L / 2) release(c);
      }
      c.braking = previousSpeed - c.speed > 0.35 || (c.speed < 0.25 && (gapHold < Infinity || boxHold < Infinity));
      const travelled = Math.max(0, ns - c.s);
      c.wheelSpin = (c.wheelSpin + travelled / (2.05 * V_SPEC[c.kind].wheel)) % (Math.PI * 2);
      c.s = ns;
      c.turnDistance = turnDistance;

      const [x, z, heading] = poseAt(loop, c.s, c.half);
      c.x = x; c.z = z; c.heading = heading;
      // Never render a vehicle during an invalid reroute/blend frame: the
      // visible fleet stays strictly on the asphalt, not the green slab.
      c.visible = pointOnGridAsphalt(x, z, asphalt, 2);
    }
  }
}
