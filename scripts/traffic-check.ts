// Headless traffic collision check for app/kawasan-3d.
// Run: npx sucrase-node scripts/traffic-check.ts  (exit 1 on any overlap or gridlock)
import { kawasanGridSize, ROAD_GAP, PLOT, worldCentre } from "../app/kawasan-3d/cityData";
import { createBBSim, stepBBSim } from "../app/kawasan-3d/bukitBintangTrafficSim";
import {
  createTrafficSim, stepTraffic, signalJunctions, superblockTrafficRoads, boxesOverlap,
} from "../app/kawasan-3d/trafficSim";

const R_IN = 84, R_OUT = 156;
const riverIdx = (g: number) => (g >= 10 ? Math.max(1, Math.floor(g * 0.4)) : null);

let failures = 0;

// ── grid city ──
const cases: [number, boolean][] = [[0.2, false], [0.45, false], [0.72, false], [0.9, false], [0.45, true], [0.72, true]];
for (const [density, fullGrid] of cases) {
  const gridSize = kawasanGridSize(density);
  const roads = fullGrid
    ? { vertical: Array.from({ length: gridSize }, (_, i) => i), horizontal: Array.from({ length: gridSize + 1 }, (_, i) => i) }
    : superblockTrafficRoads(gridSize, density);
  const river = riverIdx(gridSize);
  const h = gridSize / 2;
  const rb = Number.isInteger(h) && h !== river && roads.vertical.includes(h) && roads.horizontal.includes(h)
    ? ((): [number, number] => { const c = worldCentre(gridSize); const p = h * ROAD_GAP - c + (ROAD_GAP - PLOT) / 2; return [p, p]; })()
    : null;
  const signals = signalJunctions(gridSize, roads, { riverRoadIndex: river, roundabout: rb });
  const sim = createTrafficSim({ gridSize, roadIndices: roads, riverRoadIndex: river, roundabout: rb,
    roundaboutLaneR: R_IN + (R_OUT - R_IN) * 0.42, signals });
  const gates = sim.loopBoxes.reduce((n, b) => n + b.length, 0);
  let overlaps = 0, frames = 0, worst = "";
  const stillFor = new Float32Array(sim.cars.length);
  let maxStill = 0;
  const dt = 1 / 60;
  const levels = [0.12, 1, 0.5, 1];
  for (let f = 0; f < 60 * 160; f++) {
    const lv = levels[Math.floor(f / (60 * 40))];
    const now = 1000 + f * dt;
    stepTraffic(sim, dt, now, lv);
    sim.cars.forEach((c, i) => {
      if (!c.visible || c.speed > 0.5) { stillFor[i] = 0; return; }
      stillFor[i] += dt; if (stillFor[i] > maxStill) maxStill = stillFor[i];
    });
    if (f % 2) continue;
    frames++;
    const grid = new Map<string, number[]>();
    const vis = sim.cars.map((c, i) => [c, i] as const).filter(([c]) => c.visible);
    for (const [c, i] of vis) {
      const k = `${Math.floor(c.x / 64)},${Math.floor(c.z / 64)}`;
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    }
    for (const [a, i] of vis) {
      const gx = Math.floor(a.x / 64), gz = Math.floor(a.z / 64);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of grid.get(`${gx + dx},${gz + dz}`) ?? []) {
          if (j <= i) continue;
          const b = sim.cars[j];
          if (boxesOverlap(a.x, a.z, a.heading, a.half, a.halfW, b.x, b.z, b.heading, b.half, b.halfW)) {
            overlaps++;
            if (!worst) worst = `t=${(f * dt).toFixed(1)} ${a.kind}@loop${a.loop}(${a.x.toFixed(0)},${a.z.toFixed(0)}) vs ${b.kind}@loop${b.loop}(${b.x.toFixed(0)},${b.z.toFixed(0)})`;
          }
        }
      }
    }
  }
  if (overlaps) failures++;
  console.log(`${fullGrid ? "FULL " : ""}density ${density} grid ${gridSize}: loops=${sim.loops.length} cars=${sim.cars.length} signals=${signals.length} gates=${gates} roundabout=${!!rb} | overlaps=${overlaps}/${frames} frames, longest stop=${maxStill.toFixed(1)}s ${worst}`);
}

// ── Bukit Bintang (only exists at gridSize >= 10) ──

for (const [gridSize, count] of [[16, 200], [16, 260], [30, 260]] as const) {
  const sim = createBBSim(gridSize, count);
  const dt = 1 / 60;
  let overlaps = 0, frames = 0, first = "";
  const still = new Float32Array(sim.cars.length);
  let maxStill = 0, minActive = Infinity;
  for (let f = 0; f < 60 * 180; f++) {
    const lv = [0.3, 1, 0.6][Math.floor(f / (60 * 60))];
    stepBBSim(sim, dt, 500 + f * dt, lv);
    const act = sim.cars.filter((c) => c.active);
    if (f > 600) minActive = Math.min(minActive, act.length);
    sim.cars.forEach((c, i) => {
      if (!c.active || c.speed > 0.5) { still[i] = 0; return; }
      still[i] += dt; maxStill = Math.max(maxStill, still[i]);
    });
    if (f % 2) continue;
    frames++;
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      if (boxesOverlap(a.x, a.z, a.heading, a.half, a.halfW, b.x, b.z, b.heading, b.half, b.halfW)) {
        overlaps++;
        if (!first) first = `t=${(f * dt).toFixed(1)} ${a.kind}@lane${a.lane}(${a.x.toFixed(0)},${a.z.toFixed(0)}) vs ${b.kind}@lane${b.lane}(${b.x.toFixed(0)},${b.z.toFixed(0)})`;
      }
    }
  }
  if (overlaps || maxStill > 40) failures++;
  const sig = sim.zones.filter((z) => z.crossing).length;
  console.log(`grid ${gridSize} cars ${count}: zones=${sim.zones.length} (signalised ${sig}) crossings=${sim.crossings.length} active>=${minActive} | overlaps=${overlaps}/${frames}, longest stop=${maxStill.toFixed(1)}s ${first}`);
}
process.exit(failures ? 1 : 0);
