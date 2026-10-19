import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, rpcError } from "../_shared";
import { validateWorldInput } from "../../../lib/onlineWorlds";

export async function GET() {
  const { supabase } = await authenticatedSupabase();
  const { data, error } = await supabase.rpc("list_public_worlds");
  if (error) return NextResponse.json({ error: "Unable to load worlds." }, { status: 500 });
  return NextResponse.json({ worlds: data ?? [] });
}
export async function POST(request: NextRequest) {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const input = validateWorldInput(body); if ("error" in input) return NextResponse.json(input, { status: 400 });
  const { data, error } = await supabase.rpc("create_world", { p_name: input.name, p_slug: input.slug, p_description: input.description, p_visibility: input.visibility });
  if (error) return rpcError(error, error.code === "23505" ? "That world slug is already in use." : "Unable to create this world.");
  return NextResponse.json(data, { status: 201 });
}
