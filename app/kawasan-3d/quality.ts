// Phase F scaffold, introduced early (Phase E) because Phase E's SSAO
// needs a gate to hang off immediately rather than a one-off boolean that
// Phase F would have to rip out and replace. This file is the single
// place that will grow to cover shadow resolution + foliage density in
// Phase F; Phase E only consumes `QualityTier` for one thing (SSAO on/off).

export type QualityTier = "low" | "medium" | "high";

// Defaults lower at higher grid densities, per the brief. Thresholds are
// provisional here (Phase E) and re-validated against real Dense-metro
// perf numbers when Phase F wires up the rest of the tier's effects — see
// docs/webgl-migration-log.md's Phase F section for the measured
// before/after that either confirms or moves these.
export function defaultQualityForGridSize(gridSize: number): QualityTier {
  if (gridSize <= 8) return "high"; // rural / semi-urban
  if (gridSize <= 10) return "medium"; // metro
  return "low"; // 12x12 dense metro
}
