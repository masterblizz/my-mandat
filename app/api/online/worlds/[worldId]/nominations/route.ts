import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, hasActiveWorldMembership, rpcError } from "../../../_shared";
import { validateNominationInput } from "../../../../../lib/onlineWorlds";

export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!await hasActiveWorldMembership(supabase, params.worldId, user.id)) return NextResponse.json({ error: "You do not have access to this world." }, { status: 403 });
  const { data, error } = await supabase
    .from("world_nominations")
    .select("id,party_id,constituency_id,character_id,status,created_at,party:world_parties(name,abbreviation,colour),character:characters(name,avatar_ref,home_constituency_id)")
    .eq("world_id", params.worldId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load nominations." }, { status: 500 });
  return NextResponse.json({ nominations: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const input = validateNominationInput(body);
  if ("error" in input) return NextResponse.json(input, { status: 400 });
  const { data, error } = await supabase.rpc("propose_world_nomination", {
    p_world_id: params.worldId, p_party_id: input.partyId, p_character_id: input.characterId, p_constituency_id: input.constituencyId,
  });
  if (error) return rpcError(error, "Unable to record this nomination.");
  return NextResponse.json({ nomination: data }, { status: 201 });
}
