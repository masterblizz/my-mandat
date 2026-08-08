import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Snapshot of what actually happened on a campaign day, sent by the client
// right after advanceDay() resolves — grounds the generated item in real
// simulation output instead of letting the model invent plot points.
export type NewsDaySnapshot = {
  day: number;
  totalDays: number;
  scope: "pru" | "prn";
  scopeStateName?: string;
  support: { mandat: number; lawan: number; others: number };
  opponentActions: { type: string; stateName?: string; narrativeEN: string; severity: string }[];
  triggeredEvent: { title: string; description: string } | null;
  topMovers: { stateName: string; delta: number }[];
};

const PERSONA = `You are the news desk for MY MANDAT — a Malaysian election campaign simulator game. Write exactly ONE short news item reporting on the campaign day you're given: real Malaysian political-reporting tone (terse, wire-service style, like Bernama/Astro Awani/Malaysiakini headlines), but the party names are fictional (MANDAT, LAWAN) — never invent or reference real Malaysian politicians or real political parties.

Ground the item ONLY in the day's actual events supplied to you — an opposition (LAWAN) action, a triggered event, or a notable state swing. Do not invent unrelated plot points, scandals, or figures not present in the input. If multiple things happened, pick the single most newsworthy one and lead with it. If truly nothing notable happened, still write a short "quiet day on the trail" style wrap-up grounded in the support numbers given.

Keep the headline under 14 words and the summary under 35 words, in both Bahasa Melayu and English (natural translations of each other, not literal word-for-word).`;

function formatSnapshot(s: NewsDaySnapshot): string {
  const lines = [
    `DAY ${s.day}/${s.totalDays} · ${s.scope === "prn" ? `PRN — ${s.scopeStateName ?? ""}` : "PRU — national"}`,
    `Support: MANDAT ${s.support.mandat}% · LAWAN ${s.support.lawan}% · Others ${s.support.others}%`,
  ];
  if (s.opponentActions.length) {
    lines.push("LAWAN actions today:");
    s.opponentActions.forEach((a) => lines.push(`- [${a.severity}] ${a.type}${a.stateName ? ` (${a.stateName})` : ""}: ${a.narrativeEN}`));
  }
  if (s.triggeredEvent) {
    lines.push(`Triggered event: ${s.triggeredEvent.title} — ${s.triggeredEvent.description}`);
  }
  if (s.topMovers.length) {
    lines.push(`Biggest state swings: ${s.topMovers.map((m) => `${m.stateName} ${m.delta > 0 ? "+" : ""}${m.delta}`).join(", ")}`);
  }
  return lines.join("\n");
}

const MODEL = "claude-opus-5";

const NEWS_TOOL: Anthropic.Tool = {
  name: "publish_news_item",
  description: "Publish one generated news item for the campaign day.",
  input_schema: {
    type: "object",
    properties: {
      outlet: { type: "string", description: "Fictional Malaysian-style news outlet name" },
      headlineMS: { type: "string" },
      headlineEN: { type: "string" },
      summaryMS: { type: "string" },
      summaryEN: { type: "string" },
      tone: { type: "string", enum: ["positive", "negative", "neutral", "warning", "breaking"] },
      impact: { type: "string", description: "Short 3-6 word impact tag, e.g. 'Urban swing voters alert'" },
    },
    required: ["outlet", "headlineMS", "headlineEN", "summaryMS", "summaryEN", "tone", "impact"],
  },
};

export async function POST(request: NextRequest) {
  let body: { snapshot?: NewsDaySnapshot };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { snapshot } = body;
  if (!snapshot) {
    return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
  }

  // No credential configured — the static liveNewsByDay/gameEvents/
  // politicalReactions pools already guarantee non-empty daily content, so
  // this route simply has nothing to contribute rather than needing a
  // rule-based fallback like the advisor route does.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ source: "offline" });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: "low" },
      system: PERSONA,
      messages: [{ role: "user", content: formatSnapshot(snapshot) }],
      tools: [NEWS_TOOL],
      tool_choice: { type: "tool", name: "publish_news_item" },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ source: "offline" });
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "publish_news_item"
    );
    if (!toolUse) {
      return NextResponse.json({ source: "offline" });
    }

    const input = toolUse.input as {
      outlet: string; headlineMS: string; headlineEN: string;
      summaryMS: string; summaryEN: string;
      tone: "positive" | "negative" | "neutral" | "warning" | "breaking";
      impact: string;
    };

    return NextResponse.json({
      source: "ai",
      item: {
        id: `ai-news-${snapshot.day}-${Date.now()}`,
        day: snapshot.day,
        time: new Date().toTimeString().slice(0, 5),
        outlet: input.outlet,
        headline: input.headlineMS,
        headlineEN: input.headlineEN,
        summary: input.summaryMS,
        summaryEN: input.summaryEN,
        tone: input.tone,
        state: snapshot.scopeStateName,
        impact: input.impact,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json({ source: "offline" });
    }
    console.error("news route error", error);
    return NextResponse.json({ source: "offline" });
  }
}
