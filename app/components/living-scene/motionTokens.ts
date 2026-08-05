// Shared timing so every scene breathes at the same rate instead of each
// component picking its own duration by feel.
export const SCENE_DURATION = {
  fast: 0.2,
  base: 0.4,
  slow: 0.9,
  ambient: 3.2,
} as const;

export const SCENE_EASE = {
  standard: [0.4, 0, 0.2, 1],
  out: [0, 0, 0.2, 1],
} as const;
