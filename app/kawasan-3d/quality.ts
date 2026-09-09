// Phase F: one quality tier drives shadow resolution, foliage density,
// and post-processing cost together — all keyed off the SAME tier a
// density preset resolves to, so "Dense metro is the perf ceiling, back
// off automatically there" is one decision made in one place instead of
// three separate ad-hoc knobs drifting apart over time.
//
// Phase E introduced this file early (just the tier + SSAO on/off) because
// SSAO needed a real gate on day one. This is that scaffold, filled in.

export type QualityTier = "low" | "medium" | "high";

export type QualitySettings = {
  /** Directional-light shadow map resolution, per side. */
  shadowMapSize: number;
  /** 0..1 fraction of Vegetation's full blades-per-tile (see vegetation.tsx). */
  foliageDensity: number;
  /** N8AO (SSAO) on/off — see postfx.tsx and the Phase E log entry for why
   * this is the one effect that gets fully disabled rather than scaled
   * down: it's the single most expensive effect in the composer chain. */
  ssao: boolean;
  /** Bloom's mip-based blur chain costs several extra passes; drop to a
   * single-level blur at the lowest tier instead of cutting bloom
   * entirely, since day/night bloom is part of the scene's read (lit
   * windows, lamps) rather than a pure nicety. */
  bloomMipmapBlur: boolean;
  /** 0..1 fraction of the per-cell buildings to actually instance
   * (CityScene's Buildings thins deterministically). The metro-density
   * work (items 9-10) pushed Dense metro's triangle count up ~25%; this
   * pulls the lowest tier back toward the pre-item-9 baseline without
   * touching the placement logic or the higher tiers. */
  buildingBudget: number;
};

export const QUALITY_SETTINGS: Record<QualityTier, QualitySettings> = {
  high: { shadowMapSize: 2048, foliageDensity: 1, ssao: true, bloomMipmapBlur: true, buildingBudget: 1 },
  medium: { shadowMapSize: 1536, foliageDensity: 0.7, ssao: false, bloomMipmapBlur: true, buildingBudget: 0.92 },
  low: { shadowMapSize: 1024, foliageDensity: 0.45, ssao: false, bloomMipmapBlur: false, buildingBudget: 0.78 },
};

// Defaults lower at higher grid densities, per the brief. Re-validated
// against the measured Dense-metro numbers in the Phase F log entry
// (docs/webgl-migration-log.md) after wiring all three knobs below.
export function defaultQualityForGridSize(gridSize: number): QualityTier {
  if (gridSize <= 8) return "high"; // rural / semi-urban
  if (gridSize <= 10) return "medium"; // metro
  return "low"; // 12x12 dense metro
}
