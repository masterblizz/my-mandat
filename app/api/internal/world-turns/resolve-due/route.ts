import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../utils/supabase/service";
import { isAuthorizedScheduler } from "../_auth";

export const dynamic = "force-dynamic";

/** Called by a trusted cron service; discovers due turns and resolves each exact ID once. */
async function resolveDue(request: NextRequest) {
  if (!isAuthorizedScheduler(request)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  let supabase;
  try { supabase = createServiceClient(); } catch { return NextResponse.json({ error: "World turn service is not configured." }, { status: 503 }); }
  const { data: due, error } = await supabase.from("world_turns").select("id,world_id").eq("status", "open").lte("closes_at", new Date().toISOString()).order("closes_at").limit(50);
  if (error) return NextResponse.json({ error: "Unable to find due world turns." }, { status: 500 });
  const results = [];
  for (const turn of due ?? []) {
    const result = await supabase.rpc("resolve_world_turn", { p_world_id: turn.world_id, p_turn_id: turn.id });
    results.push({ worldId: turn.world_id, turnId: turn.id, ok: !result.error, resolution: result.data ?? null });
  }
  return NextResponse.json({ resolved: results.filter((result) => result.ok).length, attempted: results.length, results });
}

// Vercel Cron invokes GET; manual/external schedulers may POST.
export const GET = resolveDue;
export const POST = resolveDue;
