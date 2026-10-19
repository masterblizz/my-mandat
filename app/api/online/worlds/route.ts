import { NextResponse } from "next/server";
import { authenticatedSupabase } from "../_shared";

// Worlds are provisioned by the database (ensure_system_worlds); players only list and join them.
export async function GET() {
  const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data, error } = await supabase.rpc("list_public_worlds");
  if (error) {
    console.error("list_public_worlds failed", error);
    // PGRST202 / 42883: function missing; 42703 / 42P01: schema behind. Online-worlds migrations are not applied.
    const schemaBehind = ["PGRST202", "42883", "42703", "42P01"].includes(error.code ?? "");
    return NextResponse.json({
      error: schemaBehind ? "Unable to load worlds: online worlds database is not set up yet." : "Unable to load worlds.",
      code: error.code ?? null,
    }, { status: 500 });
  }
  return NextResponse.json({ worlds: data ?? [] });
}
