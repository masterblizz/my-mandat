import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, hasActiveWorldMembership, rpcError } from "../../../_shared";
import { validatePartyInput } from "../../../../../lib/onlineWorlds";

export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!await hasActiveWorldMembership(supabase, params.worldId, user.id)) return NextResponse.json({ error: "You do not have access to this world." }, { status: 403 });
  const [{ data: parties, error }, { data: membership }] = await Promise.all([
    supabase.from("world_parties").select("id,name,abbreviation,colour,treasury,created_at").eq("world_id", params.worldId).order("created_at"),
    supabase.from("world_party_memberships").select("party_id,role").eq("world_id", params.worldId).eq("account_id", user.id).eq("status", "active").maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: "Unable to load parties." }, { status: 500 });
  return NextResponse.json({ parties: parties ?? [], membership: membership ?? null });
}
export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const input = validatePartyInput(body); if ("error" in input) return NextResponse.json(input, { status: 400 });
  const { data, error } = await supabase.rpc("create_world_party", { p_world_id: params.worldId, p_name: input.name, p_abbreviation: input.abbreviation, p_colour: input.colour });
  if (error) return rpcError(error, error.message === "already_in_party" ? "Your account already belongs to a party in this world." : "Unable to create party.");
  return NextResponse.json({ party: data }, { status: 201 });
}
