-- Deterministic, non-electoral community effects for shared world turns.
alter table public.world_community_activities drop constraint if exists world_community_activities_activity_type_check;
alter table public.world_community_activities add constraint world_community_activities_activity_type_check check (activity_type in ('community_outreach', 'town_hall', 'volunteer_drive'));

create table if not exists public.world_constituency_civic_trust (
  world_id uuid not null references public.worlds(id) on delete cascade,
  constituency_id text not null,
  civic_trust integer not null default 0 check (civic_trust >= 0 and civic_trust <= 1000),
  updated_at timestamptz not null default now(),
  primary key (world_id, constituency_id)
);
alter table public.world_constituency_civic_trust enable row level security;
drop policy if exists "civic trust: member read" on public.world_constituency_civic_trust;
create policy "civic trust: member read" on public.world_constituency_civic_trust for select using (public.is_active_world_member(world_id));

create or replace function public.submit_world_community_activity(p_world_id uuid, p_character_id uuid, p_constituency_id text, p_activity_type text default 'community_outreach')
returns public.world_community_activities language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_turn public.world_turns; v_character public.characters; v_activity public.world_community_activities;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_world_member(p_world_id, v_user) then raise exception 'world_access_denied'; end if;
  select * into v_character from public.characters where id = p_character_id and world_id = p_world_id and account_id = v_user and lifecycle_status = 'active';
  if not found then raise exception 'character_access_denied'; end if;
  if not public.is_malaysia_parliamentary_constituency(p_constituency_id) or p_activity_type not in ('community_outreach', 'town_hall', 'volunteer_drive') then raise exception 'invalid_community_activity'; end if;
  select * into v_turn from public.world_turns where world_id = p_world_id and status = 'open' order by turn_number desc limit 1 for update;
  if not found then raise exception 'no_open_turn'; end if;
  if exists(select 1 from public.world_community_activities where turn_id = v_turn.id and account_id = v_user) then raise exception 'turn_action_limit'; end if;
  insert into public.world_community_activities(world_id, turn_id, account_id, character_id, activity_type, constituency_id)
  values (p_world_id, v_turn.id, v_user, p_character_id, p_activity_type, p_constituency_id) returning * into v_activity;
  return v_activity;
end; $$;

create or replace function public.resolve_world_turn(p_world_id uuid, p_turn_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_world public.worlds; v_turn public.world_turns; v_next public.world_turns; v_activity record; v_count integer := 0; v_reputation integer; v_trust integer;
begin
  select * into v_world from public.worlds where id = p_world_id for update;
  if not found then raise exception 'world_not_available'; end if;
  select * into v_turn from public.world_turns where id = p_turn_id and world_id = p_world_id for update;
  if not found then raise exception 'turn_not_found'; end if;
  if v_turn.status = 'complete' then return jsonb_build_object('turn_id', v_turn.id, 'status', 'complete', 'idempotent', true); end if;
  if v_turn.status <> 'open' then raise exception 'turn_busy'; end if;
  update public.world_turns set status = 'resolving', closes_at = now() where id = v_turn.id;
  for v_activity in select a.*, c.name as character_name from public.world_community_activities a join public.characters c on c.id = a.character_id where a.turn_id = v_turn.id and a.status = 'accepted' order by a.id loop
    v_reputation := case v_activity.activity_type when 'town_hall' then 7 when 'volunteer_drive' then 4 else 5 end;
    v_trust := case v_activity.activity_type when 'town_hall' then 4 when 'volunteer_drive' then 6 else 3 end;
    insert into public.world_account_reputation(world_id, account_id, reputation, updated_at) values (p_world_id, v_activity.account_id, v_reputation, now()) on conflict (world_id, account_id) do update set reputation = least(1000, public.world_account_reputation.reputation + v_reputation), updated_at = now();
    insert into public.world_constituency_civic_trust(world_id, constituency_id, civic_trust, updated_at) values (p_world_id, v_activity.constituency_id, v_trust, now()) on conflict (world_id, constituency_id) do update set civic_trust = least(1000, public.world_constituency_civic_trust.civic_trust + v_trust), updated_at = now();
    insert into public.world_turn_events(world_id, turn_id, activity_id, event_type, public_summary, reputation_delta) values (p_world_id, v_turn.id, v_activity.id, 'community_outreach_resolved', v_activity.character_name || ' completed ' || replace(v_activity.activity_type, '_', ' ') || ' in ' || v_activity.constituency_id || '.', v_reputation) on conflict (activity_id) do nothing;
    update public.world_community_activities set status = 'resolved' where id = v_activity.id; v_count := v_count + 1;
  end loop;
  update public.world_turns set status = 'complete' where id = v_turn.id;
  insert into public.world_turns(world_id, turn_number, status, opens_at) values (p_world_id, v_turn.turn_number + 1, 'open', now()) on conflict (world_id, turn_number) do update set world_id = excluded.world_id returning * into v_next;
  return jsonb_build_object('turn_id', v_turn.id, 'status', 'complete', 'idempotent', false, 'activities_resolved', v_count, 'next_turn_id', v_next.id, 'next_turn_number', v_next.turn_number);
end; $$;

revoke all on function public.submit_world_community_activity(uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_world_community_activity(uuid, uuid, text, text) to authenticated;
