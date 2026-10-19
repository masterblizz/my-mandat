-- Server-only, transactional resolution of the community-turn ledger.
create table if not exists public.world_account_reputation (
  world_id uuid not null references public.worlds(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  reputation integer not null default 0 check (reputation >= 0 and reputation <= 1000),
  updated_at timestamptz not null default now(),
  primary key (world_id, account_id)
);

create table if not exists public.world_turn_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  turn_id uuid not null references public.world_turns(id) on delete cascade,
  activity_id uuid unique references public.world_community_activities(id) on delete cascade,
  event_type text not null check (event_type = 'community_outreach_resolved'),
  public_summary text not null,
  reputation_delta integer not null,
  created_at timestamptz not null default now()
);
create index if not exists world_turn_events_feed_idx on public.world_turn_events(world_id, created_at desc);
alter table public.world_account_reputation enable row level security;
alter table public.world_turn_events enable row level security;

create or replace function public.resolve_world_turn(p_world_id uuid, p_turn_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_world public.worlds; v_turn public.world_turns; v_next public.world_turns; v_activity record; v_count integer := 0;
begin
  -- This function is callable only by the server scheduler/service role.
  select * into v_world from public.worlds where id = p_world_id for update;
  if not found then raise exception 'world_not_available'; end if;
  select * into v_turn from public.world_turns where id = p_turn_id and world_id = p_world_id for update;
  if not found then raise exception 'turn_not_found'; end if;
  if v_turn.status = 'complete' then
    return jsonb_build_object('turn_id', v_turn.id, 'status', 'complete', 'idempotent', true);
  end if;
  if v_turn.status <> 'open' then raise exception 'turn_busy'; end if;
  update public.world_turns set status = 'resolving', closes_at = now() where id = v_turn.id;
  for v_activity in select a.*, c.name as character_name from public.world_community_activities a join public.characters c on c.id = a.character_id where a.turn_id = v_turn.id and a.status = 'accepted' order by a.id loop
    insert into public.world_account_reputation(world_id, account_id, reputation, updated_at)
    values (p_world_id, v_activity.account_id, 5, now())
    on conflict (world_id, account_id) do update set reputation = least(1000, public.world_account_reputation.reputation + 5), updated_at = now();
    insert into public.world_turn_events(world_id, turn_id, activity_id, event_type, public_summary, reputation_delta)
    values (p_world_id, v_turn.id, v_activity.id, 'community_outreach_resolved', v_activity.character_name || ' completed community outreach in ' || v_activity.constituency_id || '.', 5)
    on conflict (activity_id) do nothing;
    update public.world_community_activities set status = 'resolved' where id = v_activity.id;
    v_count := v_count + 1;
  end loop;
  update public.world_turns set status = 'complete' where id = v_turn.id;
  insert into public.world_turns(world_id, turn_number, status, opens_at)
  values (p_world_id, v_turn.turn_number + 1, 'open', now())
  on conflict (world_id, turn_number) do update set world_id = excluded.world_id
  returning * into v_next;
  return jsonb_build_object('turn_id', v_turn.id, 'status', 'complete', 'idempotent', false, 'activities_resolved', v_count, 'next_turn_id', v_next.id, 'next_turn_number', v_next.turn_number);
end; $$;

drop policy if exists "reputation: own" on public.world_account_reputation;
create policy "reputation: own" on public.world_account_reputation for select using (account_id = auth.uid() and public.is_active_world_member(world_id));
drop policy if exists "turn events: member read" on public.world_turn_events;
create policy "turn events: member read" on public.world_turn_events for select using (public.is_active_world_member(world_id));
revoke all on function public.resolve_world_turn(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_world_turn(uuid, uuid) to service_role;
