import { NextResponse } from "next/server";
import { createClient } from "../../utils/supabase/server";

export async function authenticatedSupabase() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function hasActiveWorldMembership(supabase: Awaited<ReturnType<typeof authenticatedSupabase>>["supabase"], worldId: string, accountId: string) {
  const { data } = await supabase.from("world_memberships").select("world_id").eq("world_id", worldId).eq("account_id", accountId).eq("status", "active").maybeSingle();
  return Boolean(data);
}

export function rpcError(error: { message?: string } | null, fallback = "Unable to complete this request.") {
  const message = error?.message ?? fallback;
  const known: Record<string, [number, string]> = {
    not_authenticated: [401, "Please sign in first."], world_creation_limit: [429, "An account may create up to five active worlds."],
    world_not_available: [404, "This world is not available for public joining."], world_not_open: [409, "This world is not accepting members."],
    world_full: [409, "This world is full."], invalid_invitation: [404, "This invitation is invalid or expired."],
    world_access_denied: [403, "You do not have access to this world."], character_limit: [409, "All character slots in this world are occupied."],
    invalid_home_constituency: [400, "Choose a valid Malaysian parliamentary constituency."],
    character_access_denied: [403, "You do not control that character."], no_open_turn: [409, "No world turn is currently open."],
    turn_action_limit: [409, "Your account has already acted this turn."],
    already_in_party: [409, "Your account already belongs to a party in this world."],
    party_permission_denied: [403, "Only party founders and officers can nominate candidates."],
    invalid_nominee: [400, "Choose an active character in this world."],
    coalition_unavailable: [409, "This coalition is no longer available."],
  };
  const [status, safe] = known[message] ?? [400, fallback];
  return NextResponse.json({ error: safe }, { status });
}
