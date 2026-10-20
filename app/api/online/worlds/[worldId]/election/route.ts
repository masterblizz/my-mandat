import { NextRequest, NextResponse } from "next/server";
import { authenticatedSupabase, hasActiveWorldMembership, rpcError } from "../../../_shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPAIGN_ACTIONS = ["walkabout", "rally", "attack"] as const;

/** The world's current election (advanced to the right phase), its candidates, my candidacy, the campaign feed and the last result. */
export async function GET(_: Request, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!await hasActiveWorldMembership(supabase, params.worldId, user.id)) return NextResponse.json({ error: "You do not have access to this world." }, { status: 403 });

  const { data: election, error: advanceError } = await supabase.rpc("advance_world_election", { p_world_id: params.worldId });
  if (advanceError || !election) {
    console.error("advance_world_election failed", advanceError);
    const missing = advanceError?.code === "PGRST202" || advanceError?.code === "42883";
    return NextResponse.json({ error: missing ? "Elections are not set up in this database yet." : "Unable to load the election." }, { status: 500 });
  }

  const [world, candidacies, mine, feed, lastComplete, offices] = await Promise.all([
    supabase.from("worlds").select("id,name,region_id").eq("id", params.worldId).maybeSingle(),
    supabase.from("world_candidacies")
      .select("id,constituency_id,character_id,party_id,campaign_score,created_at,character:characters(name,avatar_ref),party:world_parties(name,abbreviation,colour)")
      .eq("election_id", election.id).eq("status", "standing").order("created_at"),
    supabase.rpc("my_world_candidacy", { p_election_id: election.id }),
    supabase.from("world_campaign_actions")
      .select("id,candidacy_id,action_type,target_candidacy_id,campaign_day,self_delta,target_delta,backfired,created_at")
      .eq("election_id", election.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("world_elections").select("id,cycle_number,resolved_at,summary").eq("world_id", params.worldId).eq("status", "complete")
      .order("cycle_number", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("world_political_offices").select("office_key,term_number,holder_character_id,holder:characters(name,avatar_ref)")
      .eq("world_id", params.worldId).eq("status", "appointed"),
  ]);
  if (world.error || candidacies.error || mine.error || feed.error || lastComplete.error || offices.error) {
    console.error("election load failed", world.error ?? candidacies.error ?? mine.error ?? feed.error ?? lastComplete.error ?? offices.error);
    return NextResponse.json({ error: "Unable to load the election." }, { status: 500 });
  }

  const myCandidacy = (mine.data ?? [])[0] ?? null;
  let actionsToday = 0;
  if (myCandidacy && election.status === "campaign") {
    const day = Math.min(5, Math.max(1, Math.floor((Date.now() - new Date(election.campaign_opens_at).getTime()) / 86_400_000) + 1));
    const { count } = await supabase.from("world_campaign_actions").select("id", { count: "exact", head: true }).eq("candidacy_id", myCandidacy.id).eq("campaign_day", day);
    actionsToday = count ?? 0;
  }

  let lastResults: unknown[] = [];
  if (lastComplete.data) {
    const { data, error } = await supabase.from("world_election_results")
      .select("constituency_id,candidacy_id,character_id,party_id,votes,vote_share,is_winner,unopposed,character:characters(name,avatar_ref),party:world_parties(name,abbreviation,colour)")
      .eq("election_id", lastComplete.data.id).order("votes", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load election results." }, { status: 500 });
    lastResults = data ?? [];
  }

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    regionId: world.data?.region_id ?? null,
    election,
    candidacies: candidacies.data ?? [],
    myCandidacy: myCandidacy ? { id: myCandidacy.id, constituency_id: myCandidacy.constituency_id, character_id: myCandidacy.character_id, party_id: myCandidacy.party_id, campaign_score: myCandidacy.campaign_score } : null,
    actionsToday,
    feed: feed.data ?? [],
    lastElection: lastComplete.data ?? null,
    lastResults,
    offices: offices.data ?? [],
  });
}

/** { action: "stand", characterId, constituencyId } | { action: "withdraw", candidacyId } | { action: "campaign", candidacyId, type, targetId? } */
export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const { supabase, user } = await authenticatedSupabase();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const str = (key: string) => (typeof body?.[key] === "string" ? (body[key] as string) : "");

  if (body?.action === "stand") {
    const characterId = str("characterId"); const constituencyId = str("constituencyId");
    if (!UUID.test(characterId) || !/^[a-z]+-\d{1,2}$/.test(constituencyId)) return NextResponse.json({ error: "Choose a character and a seat." }, { status: 400 });
    const { data, error } = await supabase.rpc("stand_for_world_election", { p_world_id: params.worldId, p_character_id: characterId, p_constituency_id: constituencyId });
    if (error) return rpcError(error, "Unable to register this candidacy.");
    return NextResponse.json({ candidacy: data }, { status: 201 });
  }
  if (body?.action === "withdraw") {
    const candidacyId = str("candidacyId");
    if (!UUID.test(candidacyId)) return NextResponse.json({ error: "Choose a candidacy." }, { status: 400 });
    const { error } = await supabase.rpc("withdraw_world_candidacy", { p_candidacy_id: candidacyId });
    if (error) return rpcError(error, "Unable to withdraw this candidacy.");
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "campaign") {
    const candidacyId = str("candidacyId"); const type = str("type"); const targetId = str("targetId");
    if (!UUID.test(candidacyId) || !(CAMPAIGN_ACTIONS as readonly string[]).includes(type) || (type === "attack" && !UUID.test(targetId))) {
      return NextResponse.json({ error: "Choose a valid campaign action." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("take_world_campaign_action", { p_candidacy_id: candidacyId, p_action_type: type, p_target_candidacy_id: type === "attack" ? targetId : null });
    if (error) return rpcError(error, "Unable to take this campaign action.");
    return NextResponse.json({ action: { self_delta: data.self_delta, target_delta: data.target_delta, backfired: data.backfired } }, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown election action." }, { status: 400 });
}
