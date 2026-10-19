import { NextResponse } from "next/server";
import { authenticatedSupabase } from "../_shared";

// Worlds are provisioned by the database (ensure_system_worlds); players only list and join them.
export async function GET() {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data, error } = await supabase.rpc("list_public_worlds");
  if (error) return NextResponse.json({ error: "Unable to load worlds." }, { status: 500 });
  return NextResponse.json({ worlds: data ?? [] });
}
