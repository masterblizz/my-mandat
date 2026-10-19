import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, hasActiveWorldMembership, rpcError } from "../../../_shared";

export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!await hasActiveWorldMembership(supabase, params.worldId, user.id)) return NextResponse.json({ error: "You do not have access to this world." }, { status: 403 });
  const { data, error } = await supabase
    .from("world_coalitions")
    .select("id,name,status,created_at,world_coalition_parties(party_id,party:world_parties(name,abbreviation,colour))")
    .eq("world_id", params.worldId)
    .neq("status", "dissolved")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load coalitions." }, { status: 500 });
  return NextResponse.json({ coalitions: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: { name?: unknown }; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 3 || name.length > 60) return NextResponse.json({ error: "Coalition names must be 3–60 characters." }, { status: 400 });
  const { data, error } = await supabase.rpc("create_world_coalition", { p_world_id: params.worldId, p_name: name });
  if (error) return rpcError(error, "Unable to form coalition.");
  return NextResponse.json({ coalition: data }, { status: 201 });
}
