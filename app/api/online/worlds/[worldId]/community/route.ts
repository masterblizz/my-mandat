import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, rpcError } from "../../../_shared";
import { isValidMalaysiaConstituency } from "../../../../../lib/onlineWorlds";

export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data: turn, error: turnError } = await supabase.rpc("world_current_turn", { p_world_id: params.worldId });
  if (turnError) return rpcError(turnError, "Unable to load the current world turn.");
  const [{ data: activities, error }, { data: events }, { data: reputation }] = await Promise.all([
    supabase.from("world_community_activities").select("id,character_id,activity_type,constituency_id,status,created_at").eq("world_id", params.worldId).eq("turn_id", turn.id).order("created_at", { ascending: false }),
    supabase.from("world_turn_events").select("id,public_summary,reputation_delta,created_at").eq("world_id", params.worldId).order("created_at", { ascending: false }).limit(8),
    supabase.from("world_account_reputation").select("reputation").eq("world_id", params.worldId).eq("account_id", user.id).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: "Unable to load community activity." }, { status: 500 });
  return NextResponse.json({ turn, activities: activities ?? [], events: events ?? [], reputation: reputation?.reputation ?? 0 });
}

export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: { characterId?: unknown; constituencyId?: unknown; activityType?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (typeof body.characterId !== "string" || typeof body.constituencyId !== "string" || !isValidMalaysiaConstituency(body.constituencyId) || !["community_outreach", "town_hall", "volunteer_drive"].includes(String(body.activityType))) return NextResponse.json({ error: "Choose your character, activity, and a valid constituency." }, { status: 400 });
  const { data, error } = await supabase.rpc("submit_world_community_activity", { p_world_id: params.worldId, p_character_id: body.characterId, p_constituency_id: body.constituencyId, p_activity_type: body.activityType });
  if (error) return rpcError(error, error.message === "turn_action_limit" ? "Your account has already acted this turn." : "Unable to submit activity.");
  return NextResponse.json({ activity: data }, { status: 201 });
}
