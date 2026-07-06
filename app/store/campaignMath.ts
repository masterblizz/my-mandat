import type { StateData } from "../data/states";

export type MiniGameType = "ceramah" | "social";
export type MiniGameTactic = "safe" | "balanced" | "aggressive";

const BASE_GAIN: Record<MiniGameType, Record<MiniGameTactic, number>> = {
  ceramah: { safe: 0.9, balanced: 1.5, aggressive: 2.3 },
  social: { safe: 0.7, balanced: 1.3, aggressive: 2.0 },
};

const RISK_PENALTY: Record<MiniGameTactic, number> = {
  safe: 0,
  balanced: 0.15,
  aggressive: 0.45,
};

/**
 * Base gain before demographic bonuses/risk penalty. Exposed so callers can
 * reproduce `runCampaignMiniGame`'s no-target-state fallback exactly instead
 * of hardcoding a second copy of this table.
 */
export function getCampaignBaseGain(gameType: MiniGameType, tactic: MiniGameTactic): number {
  return BASE_GAIN[gameType][tactic];
}

/**
 * Single source of truth for the campaign mini-game support-gain formula.
 * `app/store/gameStore.ts`'s `runCampaignMiniGame` calls this to mutate
 * state, and the ceramah/social scene animation calls the same function
 * (read-only) to size its crowd-reaction preview — so the animation can
 * never drift out of sync with the real number.
 */
export function calculateCampaignGain(state: StateData, gameType: MiniGameType, tactic: MiniGameTactic): number {
  const base = getCampaignBaseGain(gameType, tactic);
  const riskPenalty = RISK_PENALTY[tactic];
  const youthBonus = gameType === "social" ? state.demographics.youth / 100 : 0;
  const ruralBonus = gameType === "ceramah" ? state.demographics.rural / 120 : 0;
  return Math.round((base + youthBonus + ruralBonus - riskPenalty) * 100) / 100;
}

// ── Presentation-only helpers below — read `calculateCampaignGain`'s output,
// never read by the store, and never feed back into it. ─────────────────────

/**
 * Maps a projected gain into a 0–1 "how well is the crowd taking it" ratio
 * for the CrowdScene animation. Cosmetic only: the number that actually
 * moves support/resources is `calculateCampaignGain`, not this ratio.
 */
export function gainToPositiveRatio(gain: number): number {
  const MIN_GAIN = 0.3;
  const MAX_GAIN = 3;
  const normalized = (gain - MIN_GAIN) / (MAX_GAIN - MIN_GAIN);
  return Math.min(0.95, Math.max(0.15, normalized));
}

/** Wraps Math.random() so crowd-reaction rolls can be swapped for a seeded RNG in tests. */
export function rollCrowdRandom(): number {
  return Math.random();
}
