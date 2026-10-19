import { NextResponse } from "next/server";
import { authenticatedSupabase, rpcError } from "../../../_shared";
export async function POST(_: Request, { params }: { params: { worldId: string } }) { const { supabase, user } = await authenticatedSupabase(); if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 }); const { error } = await supabase.rpc("join_public_world", { p_world_id: params.worldId }); if (error) return rpcError(error); return NextResponse.json({ ok: true }); }
