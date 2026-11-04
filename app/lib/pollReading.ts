// Setting: realisticPolls — published polls carry sampling error. When the
// setting is on, every poll figure the player sees is the true support plus a
// deterministic ±2.5-point error that changes day to day (stable within a
// day); when off, polls read the true simulated support exactly. Gameplay
// always uses the true numbers — only what the player is shown is noisy.

export interface SupportShares { mandat: number; lawan: number; others: number }

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const POLL_ERROR = 2.5;

export function pollReading(truth: SupportShares, opts: { realistic: boolean; seed: string; day: number }): SupportShares {
  if (!opts.realistic) return truth;
  const err = (hash01(`${opts.seed}:${opts.day}`) - 0.5) * 2 * POLL_ERROR;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const mandat = Math.max(0, truth.mandat + err);
  // The error is taken from the main rival so the three shares still sum to the same total.
  const lawan = Math.max(0, truth.lawan - err);
  return { mandat: r1(mandat), lawan: r1(lawan), others: r1(truth.others) };
}
