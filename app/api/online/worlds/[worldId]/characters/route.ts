import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, rpcError } from "../../../_shared";
import { validateCharacterInput } from "../../../../../lib/onlineWorlds";

export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data: membership } = await supabase.from("world_memberships").select("world_id").eq("world_id", params.worldId).eq("account_id", user.id).eq("status", "active").maybeSingle();
  if (!membership) return NextResponse.json({ error: "You do not have access to this world." }, { status: 403 });
  const [{ data: world, error: worldError }, { data: characters, error: characterError }] = await Promise.all([
    supabase.from("worlds").select("id,name,slug,description,geography_template,visibility,lifecycle_status,capacity,character_slot_limit").eq("id", params.worldId).maybeSingle(),
    // Owner-scoped RPC: account_id is not client-readable on characters.
    supabase.rpc("list_my_world_characters", { p_world_id: params.worldId }),
  ]);
  if (worldError || characterError || !world) return NextResponse.json({ error: "Unable to load this world." }, { status: 500 });
  return NextResponse.json({ world, characters: characters ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const input = validateCharacterInput(body); if ("error" in input) return NextResponse.json(input, { status: 400 });
  const { data, error } = await supabase.rpc("create_world_character", { p_world_id: params.worldId, p_name: input.name, p_avatar_ref: input.avatarRef, p_biography: input.biography, p_home_constituency_id: input.homeConstituencyId });
  if (error) return rpcError(error, error.code === "23505" ? "That character name is already taken in this world." : "Unable to create character.");
  return NextResponse.json({ character: data }, { status: 201 });
}
