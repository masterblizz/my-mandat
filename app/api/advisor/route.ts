import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Live game snapshot sent by the client with every question, injected
// into the model's context so advice is grounded in the actual run.
export type AdvisorGameState = {
  day: number;
  totalDays: number;
  funds: number;
  manpower: number;
  projectedSeats: number;
  majorityTarget: number;
  totalSeats: number;
  support: { mandat: number; lawan: number; others: number };
  mediaSentiment: string;
  leaderName: string;
  party: string;
  homeSeat: string;
  scope: string;
  weakStates: string[];
  // LAWAN's recent posture — lets the advisor cite specific opposition
  // moves instead of only speaking in aggregate percentages.
  opponentThreatLevel?: { label: string; labelMS: string };
  recentOpponentActions?: { type: string; narrativeEN: string; narrativeMS: string; day: number }[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const PERSONA = `You are DR. RAZMAN, codename ALPHA-1, Strategic Director of the MANDAT party's election war room in the game MY MANDAT — a Malaysian election campaign simulator. The player may be running a PRU (national, 222 parliamentary seats, 112 for a federal majority) or a PRN (single-state DUN election — the state and its seat/majority numbers are given in the campaign state each turn). Always match your advice to whichever mode the campaign state says you're in: for PRN, stay focused entirely on that one negeri (its seats, issues, coalition maths) — do not bring up other states or a federal majority target. You advise the party leader (the player) on strategy: seat targeting, budget allocation, media handling, coalition maths, and Malaysian political geography (Borneo kingmakers, Malay heartland, urban-rural splits) as relevant to the current scope. When the campaign state gives you LAWAN's threat level and recent moves, cite them specifically (by move type and where relevant) instead of only speaking in aggregate percentages — a real strategist reacts to what the opposition just did, not just the scoreboard.

Style: a seasoned, slightly dry Malaysian political operative. Terse, tactical, numbers-first. Refer to real Malaysian states and political dynamics, but never real politicians or real parties — this is a fictional simulation. Keep replies under 150 words unless asked for a deep dive. Use short paragraphs or tight bullet lists. Your motto: "Every seat is a battlefield. We fight smart, not loud."

Language: reply in Bahasa Melayu when the user writes in Malay or when the language field says "ms"; reply in English when it says "en" or the user writes English. Match the user's switching.

You are given the live campaign state each turn. Ground every recommendation in it — cite the actual numbers. If the player asks about something outside the campaign (real-world politics, other topics), steer back to the war room in character.`;

function formatState(state: AdvisorGameState): string {
  const lines = [
    `CAMPAIGN STATE — DAY ${state.day}/${state.totalDays} (${Math.max(0, state.totalDays - state.day)} days to polling)`,
    `Leader: ${state.leaderName} (${state.party}) · Home seat: ${state.homeSeat} · Mode: ${state.scope}`,
    `Funds: RM ${state.funds.toLocaleString()} · Ground workers: ${state.manpower}`,
    `Projected seats: ${state.projectedSeats}/${state.totalSeats} (majority target ${state.majorityTarget})`,
    `Support: MANDAT ${state.support.mandat}% · LAWAN ${state.support.lawan}% · Others ${state.support.others}%`,
    `Media sentiment: ${state.mediaSentiment}`,
    state.weakStates.length ? `Trailing areas: ${state.weakStates.join(", ")}` : "No trailing areas flagged.",
  ];
  if (state.opponentThreatLevel) {
    lines.push(`LAWAN threat level: ${state.opponentThreatLevel.label}`);
  }
  if (state.recentOpponentActions?.length) {
    lines.push("LAWAN recent moves:");
    state.recentOpponentActions.forEach((a) => lines.push(`- (day ${a.day}, ${a.type}) ${a.narrativeEN}`));
  }
  return lines.join("\n");
}

// Rule-based fallback so the advisor still answers when no API
// credential is configured (or the API is unreachable).
function offlineAdvice(state: AdvisorGameState, lang: string): string {
  const ms = lang !== "en";
  const daysLeft = Math.max(0, state.totalDays - state.day);
  const gap = state.majorityTarget - state.projectedSeats;
  const lines: string[] = [];

  if (gap > 0) {
    lines.push(ms
      ? `Kita kurang ${gap} kerusi daripada sasaran majoriti ${state.majorityTarget}. Fokuskan sumber pada kerusi marginal — jangan bazir dana di kubu selamat.`
      : `We are ${gap} seats short of the ${state.majorityTarget}-seat majority. Concentrate resources on marginal seats — do not waste funds on safe strongholds.`);
  } else {
    lines.push(ms
      ? `Unjuran ${state.projectedSeats} kerusi melepasi sasaran. Kekalkan momentum — pertahankan kerusi marginal kita, jangan leka.`
      : `Projection of ${state.projectedSeats} seats clears the target. Hold the line — defend our marginals, no complacency.`);
  }

  if (state.recentOpponentActions?.length) {
    const latest = state.recentOpponentActions[0];
    lines.push(ms
      ? `LAWAN baru bergerak (${latest.type}): ${latest.narrativeMS}. Sediakan tindak balas.`
      : `LAWAN just moved (${latest.type}): ${latest.narrativeEN}. Prepare a response.`);
  }

  if (state.weakStates.length) {
    lines.push(ms
      ? `Kawasan lemah: ${state.weakStates.join(", ")}. Hantar jentera dan belanja iklan di sana minggu ini.`
      : `Weak areas: ${state.weakStates.join(", ")}. Deploy ground teams and ad spend there this week.`);
  }

  if (state.funds < 500_000) {
    lines.push(ms
      ? `Dana tinggal RM ${state.funds.toLocaleString()} — tumpukan operasi kos rendah (rumah ke rumah, media sosial).`
      : `Only RM ${state.funds.toLocaleString()} left — pivot to low-cost ops (door-to-door, social media).`);
  }

  if (daysLeft <= 7) {
    lines.push(ms
      ? `${daysLeft} hari sebelum mengundi: kunci mesej utama, mobilisasi keluar mengundi, elak kontroversi baharu.`
      : `${daysLeft} days to polling: lock the core message, drive turnout, avoid fresh controversy.`);
  }

  return lines.join("\n\n");
}

const MODEL = "claude-opus-5";

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[]; gameState?: AdvisorGameState; lang?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { messages, gameState, lang = "ms" } = body;
  if (!Array.isArray(messages) || messages.length === 0 || !gameState) {
    return NextResponse.json({ error: "messages and gameState are required" }, { status: 400 });
  }

  // Keep the tail of the conversation; the API is stateless.
  const history: Anthropic.MessageParam[] = messages.slice(-16).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 2000),
  }));

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ source: "offline", reply: offlineAdvice(gameState, lang) });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      // Stable persona first, volatile game state after — cache-friendly ordering.
      system: [
        { type: "text", text: PERSONA },
        { type: "text", text: `${formatState(gameState)}\nUI language: ${lang}` },
      ],
      messages: history,
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ source: "offline", reply: offlineAdvice(gameState, lang) });
    }

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json({ source: "ai", model: response.model, reply: reply || offlineAdvice(gameState, lang) });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json({ source: "offline", reply: offlineAdvice(gameState, lang) });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ source: "offline", reply: offlineAdvice(gameState, lang), note: "rate_limited" });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json({ source: "offline", reply: offlineAdvice(gameState, lang), note: "no_connection" });
    }
    console.error("advisor route error", error);
    return NextResponse.json({ source: "offline", reply: offlineAdvice(gameState, lang), note: "api_error" });
  }
}

// Cheap upfront availability check — the advisor page calls this once on
// mount so it can disable free-text input and switch to the pre-written
// Q&A pool *before* the player wastes a question on a dead connection,
// rather than only discovering "offline" after their first real send().
// A minimal real request (not just an env-var presence check) is
// necessary: the key can be configured but the account still out of
// credits (see AuthenticationError/insufficient-credit handling above),
// which only surfaces once a real call is attempted.
export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ available: false });
  }
  const client = new Anthropic();
  try {
    await client.messages.create({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return NextResponse.json({ available: true });
  } catch {
    return NextResponse.json({ available: false });
  }
}
