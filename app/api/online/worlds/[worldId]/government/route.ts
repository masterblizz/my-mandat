import { NextResponse } from "next/server";
import { authenticatedSupabase, hasActiveWorldMembership } from "../../../_shared";

export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!await hasActiveWorldMembership(supabase, params.worldId, user.id)) return NextResponse.json({ error: "You do not have access to this world." }, { status: 403 });
  const { data, error } = await supabase
    .from("world_political_offices")
    .select("id,office_key,status,term_number,holder_character_id,holder:characters(name,avatar_ref)")
    .eq("world_id", params.worldId)
    .order("term_number").order("office_key");
  if (error) return NextResponse.json({ error: "Unable to load government records." }, { status: 500 });
  return NextResponse.json({ offices: data ?? [] });
}
