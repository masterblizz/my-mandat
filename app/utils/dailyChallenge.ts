import { states } from "../data/states";
import type { DatasetKind } from "../data/datasets";

// Same small deterministic PRNG already used for constituency generation
// (app/data/constituencies.ts) — reused here rather than adding a new
// pattern, so "today's challenge" only needs a fixed *starting* config
// (dataset/state/difficulty/media bias), not a fully re-seeded engine.
// Day-to-day event/opponent RNG still runs on Math.random() same as any
// other campaign — this fixes the scenario players start from, which is
// what makes results comparable ("everyone played the same setup today"),
// not a byte-for-byte replay.
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 11), 0x165667b1);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

function hashString(text: string) {
  return text.split("").reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7);
}

// Local calendar date (not UTC) — "today" should match the player's own
// clock, same reasoning as /kawasan's client-local time-of-day sync.
export function getDailyDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DailyChallengeConfig {
  dateKey: string;
  dataset: DatasetKind;
  homeStateId: string;
  difficulty: "easy" | "normal" | "hard" | "nightmare";
  mediaBias: "pro" | "balanced" | "hostile";
  oppositionStrength: number;
}

const DIFFICULTIES: DailyChallengeConfig["difficulty"][] = ["easy", "normal", "hard", "nightmare"];
const MEDIA_BIASES: DailyChallengeConfig["mediaBias"][] = ["pro", "balanced", "hostile"];

export function buildDailyChallenge(date: Date = new Date()): DailyChallengeConfig {
  const dateKey = getDailyDateKey(date);
  const rand = seededRand(hashString(dateKey));
  const homeState = states[Math.floor(rand() * states.length)] ?? states[0];
  return {
    dateKey,
    dataset: rand() < 0.5 ? "dummy" : "real-malaysia",
    homeStateId: homeState.id,
    difficulty: DIFFICULTIES[Math.floor(rand() * DIFFICULTIES.length)],
    mediaBias: MEDIA_BIASES[Math.floor(rand() * MEDIA_BIASES.length)],
    oppositionStrength: 45 + Math.floor(rand() * 35),
  };
}
