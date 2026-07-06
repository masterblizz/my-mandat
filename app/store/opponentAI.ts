import type { StateData } from "../data/states";

export type OpponentActionType =
  | "pressure"
  | "scandal"
  | "counter_narrative"
  | "media_blitz"
  | "manifesto_attack"
  | "candidate_poach"
  | "coalition_form"
  | "viral_social";

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
  scopeStateName?: string; // set when this is a PRN (single-state) campaign
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

const MANIFESTO_ATTACK_EN = [
  "LAWAN dismantles MANDAT's flagship pledge live on TV: 'The numbers simply don't add up.'",
  "Opposition economists publish a rebuttal costing paper — MANDAT's manifesto math is challenged nationwide.",
  "LAWAN campaign brands MANDAT's manifesto 'a wish list, not a plan' in a widely shared statement.",
  "Opposition spokesperson: 'MANDAT promised this before and delivered nothing.' Old pledges resurface.",
  "LAWAN think tank releases a point-by-point takedown of MANDAT's policy platform.",
];
const MANIFESTO_ATTACK_MS = [
  "LAWAN pecahkan janji utama MANDAT secara langsung di TV: 'Angka ini memang tak masuk akal.'",
  "Ahli ekonomi pembangkang terbitkan kertas kos balas — matematik manifesto MANDAT dipersoal seluruh negara.",
  "Kempen LAWAN gelar manifesto MANDAT 'senarai harapan, bukan rancangan' dalam kenyataan yang tular.",
  "Jurucakap pembangkang: 'MANDAT pernah janji ini dulu dan tak tunaikan apa-apa.' Janji lama disorot semula.",
  "Badan pemikir LAWAN terbitkan kritikan terperinci terhadap platform dasar MANDAT.",
];

const CANDIDATE_POACH_EN = [
  "LAWAN quietly approaches a MANDAT-aligned community leader in {state} with a defection offer.",
  "Rumours swirl in {state}: a local MANDAT figure is in closed-door talks with the opposition.",
  "LAWAN dangles a safe seat to lure a grassroots organiser away from MANDAT in {state}.",
  "A small allied party in {state} threatens to walk from MANDAT's camp after an opposition overture.",
  "LAWAN recruiters target disgruntled MANDAT branch leaders in {state}.",
];
const CANDIDATE_POACH_MS = [
  "LAWAN diam-diam hubungi seorang pemimpin komuniti berpihak MANDAT di {state} dengan tawaran lompat parti.",
  "Khabar angin tular di {state}: seorang tokoh MANDAT tempatan berunding tertutup dengan pembangkang.",
  "LAWAN tawarkan kerusi selamat untuk pikat penganjur akar umbi keluar dari MANDAT di {state}.",
  "Sebuah parti kecil sekutu di {state} ugut tinggalkan barisan MANDAT selepas didekati pembangkang.",
  "Perekrut LAWAN sasarkan pemimpin cawangan MANDAT yang tidak berpuas hati di {state}.",
];

const COALITION_FORM_EN = [
  "LAWAN seals a seat-sharing pact with two independent blocs — anti-MANDAT votes stop splitting three ways.",
  "Splinter parties fold into LAWAN's coalition ahead of polling day, unifying the opposition vote.",
  "LAWAN announces a unity ticket with former rivals: 'One flag, one fight against MANDAT.'",
  "Independent candidates in key seats withdraw and endorse LAWAN as part of a new pact.",
  "LAWAN's coalition talks conclude — smaller parties agree to stand down and consolidate the anti-MANDAT vote.",
];
const COALITION_FORM_MS = [
  "LAWAN meterai pakatan kongsi kerusi dengan dua blok bebas — undi anti-MANDAT tidak lagi berpecah tiga.",
  "Parti pecahan sertai gabungan LAWAN menjelang hari mengundi, menyatukan undi pembangkang.",
  "LAWAN umum tiket perpaduan dengan bekas saingan: 'Satu bendera, satu perjuangan lawan MANDAT.'",
  "Calon bebas di kerusi penting menarik diri dan sokong LAWAN sebagai sebahagian pakatan baharu.",
  "Rundingan pakatan LAWAN selesai — parti kecil bersetuju berundur dan satukan undi anti-MANDAT.",
];

const VIRAL_SOCIAL_EN = [
  "A LAWAN-aligned hashtag hits nationwide trending — anti-MANDAT memes flood every timeline.",
  "TikTok's algorithm favours a wave of anti-MANDAT skits overnight; youth engagement spikes.",
  "Coordinated LAWAN accounts flood comment sections across platforms with the same talking points.",
  "A rap parody mocking MANDAT's leader racks up millions of views in 24 hours.",
  "LAWAN's social media wing floods group chats with edited clips ahead of the weekend.",
];
const VIRAL_SOCIAL_MS = [
  "Hashtag berpihak LAWAN jadi trending seluruh negara — meme anti-MANDAT banjiri setiap timeline.",
  "Algoritma TikTok sebar gelombang skit anti-MANDAT semalaman; penglibatan belia melonjak.",
  "Akaun LAWAN yang diselaraskan banjiri ruangan komen merentasi platform dengan mesej sama.",
  "Parodi rap mempersendakan pemimpin MANDAT tembusi berjuta tontonan dalam 24 jam.",
  "Sayap media sosial LAWAN banjiri group chat dengan klip disunting menjelang hujung minggu.",
];

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
    scopeStateName,
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

  // ── 1b. CANDIDATE POACHING ────────────────────────────────────────────────
  // Targets the most marginal contested state not already hit by geographic
  // pressure this round — a subtler, lower-frequency threat to a specific race.
  const poachProb = mult * (progress > 0.3 ? 0.24 : 0.09);
  const pressureTargets = new Set(scored.slice(0, numTargets).map(({ s }) => s.id));
  const poachTarget = scored.find(({ s }) => s.status === "contested" && !pressureTargets.has(s.id))
    ?? scored.find(({ s }) => !pressureTargets.has(s.id));
  if (poachTarget && Math.random() < poachProb) {
    const { s } = poachTarget;
    const boost = Math.round(mult * 0.9 * 10) / 10;
    stateDebuffs[s.id] = (stateDebuffs[s.id] ?? 0) + boost;
    const i = Math.floor(Math.random() * CANDIDATE_POACH_EN.length);
    actions.push({
      id: nextId(),
      type: "candidate_poach",
      stateId: s.id,
      stateName: s.name,
      lawanBoost: boost,
      nationalDamage: 0,
      narrativeEN: fill(CANDIDATE_POACH_EN[i], s.name),
      narrativeMS: fill(CANDIDATE_POACH_MS[i], s.name),
      severity: boost >= 1.0 ? "high" : boost >= 0.55 ? "medium" : "low",
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

  // ── 2b. MANIFESTO ATTACK ───────────────────────────────────────────────────
  // Independent national-level probability, separate from counter_narrative
  // (which reacts to player op mix) — this one just chips at policy credibility.
  const manifestoProb = mult * (progress > 0.35 ? 0.2 : 0.07);
  if (Math.random() < manifestoProb) {
    const dmg = Math.round(mult * 1.0 * 10) / 10;
    nationalDamage += dmg;
    actions.push({
      id: nextId(),
      type: "manifesto_attack",
      lawanBoost: 0,
      nationalDamage: dmg,
      narrativeEN: pick(MANIFESTO_ATTACK_EN),
      narrativeMS: pick(MANIFESTO_ATTACK_MS),
      severity: dmg >= 1.3 ? "high" : "medium",
      day,
    });
  }

  // ── 2c. VIRAL SOCIAL MEDIA FLOOD ────────────────────────────────────────────
  // High-frequency, low-magnitude chip damage — social media churns constantly,
  // unlike the punchier one-off scandal/media_blitz beats. Can fire from day one.
  const viralProb = mult * (progress > 0.1 ? 0.22 : 0.1);
  if (Math.random() < viralProb) {
    const dmg = Math.round(mult * 0.5 * 10) / 10;
    nationalDamage += dmg;
    actions.push({
      id: nextId(),
      type: "viral_social",
      lawanBoost: 0,
      nationalDamage: dmg,
      narrativeEN: pick(VIRAL_SOCIAL_EN),
      narrativeMS: pick(VIRAL_SOCIAL_MS),
      severity: dmg >= 0.6 ? "medium" : "low",
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

  // ── 3b. COALITION FORMATION ─────────────────────────────────────────────────
  // Consolidates smaller/independent parties into LAWAN's camp — reinforces
  // the state where MANDAT is already trailing worst, converting split votes
  // rather than contesting new ground the way pressure/poaching do.
  const coalitionProb = mult * (progress > 0.25 && progress < 0.85 ? 0.16 : 0.05);
  const consolidationTarget = states
    .filter((s) => s.status === "losing")
    .sort((a, b) => b.seats - a.seats)[0];
  if (consolidationTarget && Math.random() < coalitionProb) {
    const dmg = Math.round(mult * 0.4 * 10) / 10;
    const boost = Math.round(mult * 0.6 * 10) / 10;
    nationalDamage += dmg;
    stateDebuffs[consolidationTarget.id] = (stateDebuffs[consolidationTarget.id] ?? 0) + boost;
    actions.push({
      id: nextId(),
      type: "coalition_form",
      stateId: consolidationTarget.id,
      stateName: consolidationTarget.name,
      lawanBoost: boost,
      nationalDamage: dmg,
      narrativeEN: pick(COALITION_FORM_EN),
      narrativeMS: pick(COALITION_FORM_MS),
      severity: boost >= 0.9 ? "high" : "medium",
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
    const blitzEN = scopeStateName
      ? `LAWAN launches a prime-time media blitz across ${scopeStateName} — TV, billboards, radio blanket the state.`
      : BLITZ_EN;
    const blitzMS = scopeStateName
      ? `LAWAN lancar serangan media perdana merentasi ${scopeStateName} — TV, papan iklan, radio penuhi negeri.`
      : BLITZ_MS;
    actions.push({
      id: nextId(),
      type: "media_blitz",
      stateId: topContested?.id,
      stateName: topContested?.name,
      lawanBoost: topContested ? 0.5 : 0,
      nationalDamage: dmg,
      narrativeEN: blitzEN,
      narrativeMS: blitzMS,
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
