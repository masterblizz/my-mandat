-- First shared-world activity ledger. Depends on 20261019_worlds_and_characters.sql.
create table if not exists public.world_turns (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  turn_number integer not null check (turn_number > 0),
  status text not null default 'open' check (status in ('open', 'resolving', 'complete')),
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  unique (world_id, turn_number)
);

create table if not exists public.world_community_activities (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  turn_id uuid not null references public.world_turns(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  activity_type text not null check (activity_type in ('community_outreach')),
  constituency_id text not null,
  status text not null default 'accepted' check (status in ('accepted', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (turn_id, account_id)
);
create index if not exists world_activities_feed_idx on public.world_community_activities(world_id, created_at desc);
alter table public.world_turns enable row level security;
alter table public.world_community_activities enable row level security;

insert into public.world_turns(world_id, turn_number)
select id, 1 from public.worlds on conflict (world_id, turn_number) do nothing;

create or replace function public.world_current_turn(p_world_id uuid)
returns public.world_turns language plpgsql security definer set search_path = public as $$
declare v_turn public.world_turns;
begin
  if not public.is_active_world_member(p_world_id) then raise exception 'world_access_denied'; end if;
  select * into v_turn from public.world_turns where world_id = p_world_id and status = 'open' order by turn_number desc limit 1;
  if not found then raise exception 'no_open_turn'; end if;
  return v_turn;
end; $$;

create or replace function public.submit_world_community_activity(p_world_id uuid, p_character_id uuid, p_constituency_id text)
returns public.world_community_activities language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_turn public.world_turns; v_character public.characters; v_activity public.world_community_activities;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not public.is_active_world_member(p_world_id, v_user) then raise exception 'world_access_denied'; end if;
  select * into v_character from public.characters where id = p_character_id and world_id = p_world_id and account_id = v_user and lifecycle_status = 'active';
  if not found then raise exception 'character_access_denied'; end if;
  if not public.is_malaysia_parliamentary_constituency(p_constituency_id) then raise exception 'invalid_home_constituency'; end if;
  select * into v_turn from public.world_turns where world_id = p_world_id and status = 'open' order by turn_number desc limit 1 for update;
  if not found then raise exception 'no_open_turn'; end if;
  -- Account, not character, owns the one-action budget for the shared turn.
  if exists(select 1 from public.world_community_activities where turn_id = v_turn.id and account_id = v_user) then raise exception 'turn_action_limit'; end if;
  insert into public.world_community_activities(world_id, turn_id, account_id, character_id, activity_type, constituency_id)
  values (p_world_id, v_turn.id, v_user, p_character_id, 'community_outreach', p_constituency_id) returning * into v_activity;
  return v_activity;
end; $$;

drop policy if exists "world turns: member read" on public.world_turns;
create policy "world turns: member read" on public.world_turns for select using (public.is_active_world_member(world_id));
drop policy if exists "activities: member read" on public.world_community_activities;
create policy "activities: member read" on public.world_community_activities for select using (public.is_active_world_member(world_id));
revoke all on function public.world_current_turn(uuid) from public, anon;
revoke all on function public.submit_world_community_activity(uuid, uuid, text) from public, anon;
grant execute on function public.world_current_turn(uuid) to authenticated;
grant execute on function public.submit_world_community_activity(uuid, uuid, text) to authenticated;
