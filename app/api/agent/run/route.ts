import { NextRequest, NextResponse } from "next/server";
import { startAgentTask } from "@/lib/sandbox-agent";

export const maxDuration = 60; // just enough to kick off the sandbox, not to finish the task

const AGENT_SECRET = process.env.AGENT_SECRET!;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${AGENT_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const result = await startAgentTask(prompt);
    return NextResponse.json({ status: "started", ...result });
  } catch (err: any) {
    console.error("failed to start agent task:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
