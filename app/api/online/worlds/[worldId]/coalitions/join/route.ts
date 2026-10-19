import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, rpcError } from "../../../../_shared";

export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: { coalitionId?: unknown }; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (typeof body.coalitionId !== "string") return NextResponse.json({ error: "coalitionId is required." }, { status: 400 });
  const { data, error } = await supabase.rpc("join_world_coalition", { p_coalition_id: body.coalitionId });
  if (error) return rpcError(error, "Unable to join coalition.");
  return NextResponse.json({ membership: data });
}
