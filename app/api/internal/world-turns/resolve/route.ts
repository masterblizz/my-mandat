import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../../utils/supabase/service";
import { isAuthorizedScheduler } from "../_auth";

/** Scheduler-only endpoint. Keep WORLD_TURN_CRON_SECRET out of the browser. */
export async function POST(request: NextRequest) {
  if (!isAuthorizedScheduler(request)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  let body: { worldId?: unknown; turnId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (typeof body.worldId !== "string" || typeof body.turnId !== "string") return NextResponse.json({ error: "worldId and turnId are required." }, { status: 400 });
  let supabase;
  try { supabase = createServiceClient(); } catch { return NextResponse.json({ error: "World turn service is not configured." }, { status: 503 }); }
  const { data, error } = await supabase.rpc("resolve_world_turn", { p_world_id: body.worldId, p_turn_id: body.turnId });
  if (error) return NextResponse.json({ error: "Unable to resolve world turn." }, { status: error.message === "turn_busy" ? 409 : 400 });
  return NextResponse.json({ resolution: data });
}
