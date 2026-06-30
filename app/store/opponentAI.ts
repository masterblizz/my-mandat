import type { StateData } from "../data/states";

export type OpponentActionType = "pressure" | "scandal" | "counter_narrative" | "media_blitz";

export interface OpponentAction {
  id: string;
  type: OpponentActionType;
  stateId?: string;
  stateName?: string;
  lawanBoost: number;
  nationalDamage: number;
  narrativeEN: string;
  narrativeMS: string;
  severity: "low" | "medium" | "high";
  day: number;
}

export interface OpponentResult {
  actions: OpponentAction[];
  stateDebuffs: Record<string, number>; // stateId → extra lawan support boost
  nationalDamage: number;               // spread across all states
}

export interface AIInput {
  day: number;
  totalDays: number;
  states: StateData[];
  activeStateIds: Set<string>;
  playerDigitalOps: number;
  playerCeramahOps: number;
  playerBorneoOps: number;
  oppositionStrength: number; // 0–100 from settings
  difficulty: "easy" | "normal" | "hard" | "nightmare";
  recentPlayerGains: string[]; // stateIds where player trended up last day
}

// ── Narrative pools ───────────────────────────────────────────────────────────

const PRESSURE_EN = [
  "LAWAN deploys ground teams to {state} — targeting neglected voters.",
  "Opposition ceramah draws thousands in {state} sensing MANDAT absence.",
  "LAWAN campaign convoy floods {state} — local press coverage spikes.",
  "Opposition opens party branches in {state} as MANDAT gap widens.",
  "LAWAN door-to-door canvassers saturate {state} neighbourhoods.",
];
const PRESSURE_MS = [
  "LAWAN gerakkan pasukan ke {state} — sasarkan pengundi yang diabaikan.",
  "Ceramah pembangkang menarik ribuan di {state} setelah MANDAT absen.",
  "Konvoi kempen LAWAN banjiri {state} — liputan akhbar tempatan melonjak.",
  "Pembangkang buka cawangan parti di {state} semasa jurang MANDAT melebar.",
  "Petugas pintu ke pintu LAWAN penuhi kawasan kejiranan {state}.",
];

const SCANDAL_EN = [
  "Leaked docs allege MANDAT financial irregularities — opposition media runs wall-to-wall coverage.",
  "Viral clip frames MANDAT leader as 'out of touch'. Rapid response team scrambled.",
  "Pro-LAWAN portal publishes exposé on MANDAT candidate's undisclosed past.",
  "Opposition accuses MANDAT of vote-buying. EC asked to investigate.",
  "Anonymous source to Astro Awani: 'MANDAT promises cannot be funded.' Economists quoted.",
];
const SCANDAL_MS = [
  "Dokumen bocor dakwa ketidakaturan kewangan MANDAT — media pembangkang siaran penuh.",
  "Klip viral gambarkan pemimpin MANDAT sebagai 'tidak peduli rakyat'. Pasukan tindak balas digerakkan.",
  "Portal pro-LAWAN terbitkan pendedahan latar belakang calon MANDAT yang tidak didedahkan.",
  "Pembangkang tuduh MANDAT rasuah undi. SPR diminta siasat.",
  "Sumber tanpa nama kepada Astro Awani: 'Janji MANDAT tidak boleh dibiayai.' Ahli ekonomi dipetik.",
];

type CounterKey = "digital_heavy" | "ceramah_heavy" | "borneo_neglect";
const COUNTER: Record<CounterKey, { en: string; ms: string }> = {
  digital_heavy: {
    en: "LAWAN: 'Our opponents run an online-only war room — zero grassroots, zero heart for the rakyat.'",
    ms: "LAWAN: 'Pencabar kita hanya berperang atas talian — tiada akar umbi, tiada empati untuk rakyat.'",
  },
  ceramah_heavy: {
    en: "Opposition media: 'MANDAT rallies draw crowds but deliver no concrete policy. All noise, no plan.'",
    ms: "Media pembangkang: 'Ceramah MANDAT penuh orang tapi tiada dasar konkrit. Bunyi semata, tiada rancangan.'",
  },
  borneo_neglect: {
    en: "Sabah & Sarawak leaders warn: 'MANDAT has forgotten Borneo again — we are not an afterthought.'",
    ms: "Pemimpin Sabah & Sarawak amaran: 'MANDAT lupakan Borneo lagi — kami bukan renungan kemudian.'",
  },
};

const BLITZ_EN = "LAWAN launches nationwide prime-time media blitz — TV, billboards, radio across all 14 states.";
const BLITZ_MS = "LAWAN lancar serangan media perdana nasional — TV, papan iklan, radio merentasi 14 negeri.";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(s: string, state: string): string {
  return s.replace("{state}", state);
}

function diffMult(d: AIInput["difficulty"]): number {
  return { easy: 0.45, normal: 0.72, hard: 1.1, nightmare: 1.55 }[d];
}

// ── Main AI function ──────────────────────────────────────────────────────────

export function runOpponentAI(input: AIInput): OpponentResult {
  const {
    day, totalDays, states, activeStateIds, oppositionStrength,
    difficulty, recentPlayerGains, playerDigitalOps, playerCeramahOps, playerBorneoOps,
  } = input;

  const mult = (oppositionStrength / 100) * diffMult(difficulty);
  const progress = day / totalDays;
  const actions: OpponentAction[] = [];
  const stateDebuffs: Record<string, number> = {};
  let nationalDamage = 0;
  let seq = 0;
  const nextId = () => `opp-${day}-${++seq}`;

  // ── 1. GEOGRAPHIC PRESSURE ─────────────────────────────────────────────────
  // Score each state: neglected + contested + seats + counter-push priority
  const scored = states
    .map((s) => {
      const neglect = !activeStateIds.has(s.id) ? 2.2 : 1.0;
      const marginal = s.status === "contested" ? 1.7 : s.status === "winning" ? 1.4 : 0.7;
      const seatW = s.seats / 8;
      const counter = recentPlayerGains.includes(s.id) ? 1.5 : 1.0;
      return { s, score: neglect * marginal * seatW * counter };
    })
    .sort((a, b) => b.score - a.score);

  // Target 1 state early, 2 in second half of campaign
  const numTargets = progress > 0.6 ? 2 : 1;
  for (const { s } of scored.slice(0, numTargets)) {
    const boost = Math.round(mult * 1.3 * 10) / 10;
    stateDebuffs[s.id] = (stateDebuffs[s.id] ?? 0) + boost;
    const i = Math.floor(Math.random() * PRESSURE_EN.length);
    actions.push({
      id: nextId(),
      type: "pressure",
      stateId: s.id,
      stateName: s.name,
      lawanBoost: boost,
      nationalDamage: 0,
      narrativeEN: fill(PRESSURE_EN[i], s.name),
      narrativeMS: fill(PRESSURE_MS[i], s.name),
      severity: boost >= 1.2 ? "high" : boost >= 0.7 ? "medium" : "low",
      day,
    });
  }

  // ── 2. COUNTER NARRATIVES ──────────────────────────────────────────────────
  // React intelligently to how the player has been campaigning
  const counterKeys: CounterKey[] = [];
  if (playerDigitalOps >= 2) counterKeys.push("digital_heavy");
  if (playerCeramahOps >= 3) counterKeys.push("ceramah_heavy");
  if (playerBorneoOps === 0 && day >= 8) counterKeys.push("borneo_neglect");

  if (counterKeys.length > 0 && Math.random() < 0.52 * mult) {
    const key = pick(counterKeys);
    const cn = COUNTER[key];
    const dmg = Math.round(mult * 0.55 * 10) / 10;
    nationalDamage += dmg;
    actions.push({
      id: nextId(),
      type: "counter_narrative",
      lawanBoost: 0,
      nationalDamage: dmg,
      narrativeEN: cn.en,
      narrativeMS: cn.ms,
      severity: "medium",
      day,
    });
  }

  // ── 3. SCANDAL / MEDIA ATTACK ──────────────────────────────────────────────
  // Probability ramps up in the second half of the campaign
  const scandalProb = mult * (progress > 0.5 ? 0.24 : 0.09);
  if (Math.random() < scandalProb) {
    const dmg = Math.round(mult * 1.7 * 10) / 10;
    nationalDamage += dmg;
    actions.push({
      id: nextId(),
      type: "scandal",
      lawanBoost: 0,
      nationalDamage: dmg,
      narrativeEN: pick(SCANDAL_EN),
      narrativeMS: pick(SCANDAL_MS),
      severity: "high",
      day,
    });
  }

  // ── 4. LATE-GAME MEDIA BLITZ ───────────────────────────────────────────────
  if (progress > 0.72 && Math.random() < mult * 0.3) {
    const dmg = Math.round(mult * 0.9 * 10) / 10;
    nationalDamage += dmg;
    const topContested = states
      .filter((s) => s.status === "contested")
      .sort((a, b) => b.seats - a.seats)[0];
    if (topContested) {
      stateDebuffs[topContested.id] = (stateDebuffs[topContested.id] ?? 0) + 0.5;
    }
    actions.push({
      id: nextId(),
      type: "media_blitz",
      stateId: topContested?.id,
      stateName: topContested?.name,
      lawanBoost: topContested ? 0.5 : 0,
      nationalDamage: dmg,
      narrativeEN: BLITZ_EN,
      narrativeMS: BLITZ_MS,
      severity: "high",
      day,
    });
  }

  return { actions, stateDebuffs, nationalDamage };
}

// ── Threat level helper (used by UI) ─────────────────────────────────────────

export function computeThreatLevel(log: OpponentAction[], lookbackDays = 3):
  { label: string; labelMS: string; color: string } {
  const score = log
    .slice(0, lookbackDays * 3) // rough cap
    .reduce((s, a) => s + ({ low: 1, medium: 2, high: 3 }[a.severity] ?? 0), 0);

  if (score >= 14) return { label: "CRITICAL",  labelMS: "KRITIKAL",  color: "#ff2244" };
  if (score >= 9)  return { label: "HIGH",       labelMS: "TINGGI",    color: "var(--neon-red)" };
  if (score >= 5)  return { label: "ELEVATED",   labelMS: "MENINGKAT", color: "var(--warn-orange)" };
  if (score >= 2)  return { label: "LOW",        labelMS: "RENDAH",    color: "var(--gold)" };
  return             { label: "MINIMAL",     labelMS: "MINIMAL",   color: "var(--neon-green)" };
}
