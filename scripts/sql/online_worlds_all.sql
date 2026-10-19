-- Online worlds: migrations 20261019 → 20261031 in one transaction. Paste into Supabase SQL Editor and Run.
begin;
-- Lets this file re-run safely: 20261019 defines an older list_public_worlds shape that 20261031 replaces.
drop function if exists public.list_public_worlds();

-- ===== 20261019_worlds_and_characters.sql =====
-- Persistent political-world lobby foundation. Apply with `supabase db push`
-- against a non-production project first; this migration is not auto-applied.
create extension if not exists pgcrypto;

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 500),
  geography_template text not null default 'malaysia-v1' check (geography_template = 'malaysia-v1'),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  lifecycle_status text not null default 'open' check (lifecycle_status in ('open', 'locked', 'archived')),
  capacity integer not null default 100 check (capacity between 1 and 1000),
  character_slot_limit integer not null default 3 check (character_slot_limit between 1 and 3),
  creator_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.world_memberships (
  world_id uuid not null references public.worlds(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('creator', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended', 'left')),
  joined_at timestamptz not null default now(),
  primary key (world_id, account_id)
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9 .''-]{3,32}$'),
  avatar_ref text not null check (avatar_ref in ('player-standing-01.png', 'player-standing-02.png', 'player-standing-03.png', 'player-standing-04.png', 'player-standing-05.png')),
  biography text not null default '' check (char_length(biography) <= 280),
  home_constituency_id text not null,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, name)
);

-- Token hashes only. Invitation tokens are returned once from the RPC and
-- never readable via public world listing queries.
create table if not exists public.world_invitations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer not null default 25 check (max_uses between 1 and 1000),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

create index if not exists world_memberships_account_idx on public.world_memberships(account_id, world_id);
create index if not exists characters_owner_idx on public.characters(account_id, world_id);
create index if not exists characters_world_idx on public.characters(world_id);

alter table public.worlds enable row level security;
alter table public.world_memberships enable row level security;
alter table public.characters enable row level security;
alter table public.world_invitations enable row level security;

create or replace function public.is_active_world_member(p_world_id uuid, p_account_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.world_memberships where world_id = p_world_id and account_id = p_account_id and status = 'active');
$$;

create or replace function public.is_malaysia_parliamentary_constituency(p_constituency_id text)
returns boolean language sql immutable as $$
  select case
    when p_constituency_id ~ '^johor-([0-9]|1[0-9]|2[0-5])$' then true
    when p_constituency_id ~ '^(kedah|kelantan|pahang)-([0-9]|1[0-4])$' then true
    when p_constituency_id ~ '^(melaka|ns)-[0-7]$' then true
    when p_constituency_id ~ '^perak-([0-9]|1[0-9]|2[0-3])$' then true
    when p_constituency_id ~ '^perlis-[0-2]$' then true
    when p_constituency_id ~ '^penang-([0-9]|1[0-2])$' then true
    when p_constituency_id ~ '^sabah-([0-9]|1[0-9]|2[0-4])$' then true
    when p_constituency_id ~ '^sarawak-([0-9]|[12][0-9]|30)$' then true
    when p_constituency_id ~ '^selangor-([0-9]|1[0-9]|2[01])$' then true
    when p_constituency_id ~ '^terengganu-[0-7]$' then true
    when p_constituency_id ~ '^wp-([0-9]|1[0-2])$' then true
    else false end;
$$;

drop policy if exists "worlds: browse public or own" on public.worlds;
create policy "worlds: browse public or own" on public.worlds for select using (
  (visibility = 'public' and lifecycle_status <> 'archived') or public.is_active_world_member(id)
);
drop policy if exists "memberships: own" on public.world_memberships;
create policy "memberships: own" on public.world_memberships for select using (account_id = auth.uid());
drop policy if exists "characters: own" on public.characters;
create policy "characters: own" on public.characters for select using (account_id = auth.uid());
-- No client insert/update/delete policies: mutations go through the audited RPCs.

create or replace function public.touch_world_rows() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists worlds_touch_updated_at on public.worlds;
create trigger worlds_touch_updated_at before update on public.worlds for each row execute function public.touch_world_rows();
drop trigger if exists characters_touch_updated_at on public.characters;
create trigger characters_touch_updated_at before update on public.characters for each row execute function public.touch_world_rows();

create or replace function public.create_world(
  p_name text, p_slug text, p_description text, p_visibility text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_world public.worlds; v_token text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if (select count(*) from public.worlds where creator_id = v_user and lifecycle_status <> 'archived') >= 5 then raise exception 'world_creation_limit'; end if;
  insert into public.worlds(name, slug, description, visibility, creator_id)
  values (trim(p_name), lower(trim(p_slug)), trim(coalesce(p_description, '')), p_visibility, v_user) returning * into v_world;
  insert into public.world_memberships(world_id, account_id, role) values (v_world.id, v_user, 'creator');
  if p_visibility = 'private' then
    v_token := encode(gen_random_bytes(18), 'hex');
    insert into public.world_invitations(world_id, token_hash, created_by) values (v_world.id, encode(digest(v_token, 'sha256'), 'hex'), v_user);
  end if;
  return jsonb_build_object('world', jsonb_build_object('id', v_world.id, 'name', v_world.name, 'slug', v_world.slug, 'visibility', v_world.visibility), 'invitation_token', v_token);
end; $$;

create or replace function public.list_public_worlds()
returns table (id uuid, name text, slug text, description text, geography_template text, visibility text, lifecycle_status text, capacity integer, character_slot_limit integer, created_at timestamptz, member_count bigint)
language sql stable security definer set search_path = public as $$
  select w.id, w.name, w.slug, w.description, w.geography_template, w.visibility, w.lifecycle_status, w.capacity, w.character_slot_limit, w.created_at,
    count(m.account_id) filter (where m.status = 'active') as member_count
  from public.worlds w left join public.world_memberships m on m.world_id = w.id
  where w.visibility = 'public' and w.lifecycle_status <> 'archived'
  group by w.id order by w.created_at desc;
$$;

create or replace function public.join_public_world(p_world_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_world public.worlds; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_world from public.worlds where id = p_world_id for update;
  if not found or v_world.visibility <> 'public' then raise exception 'world_not_available'; end if;
  if v_world.lifecycle_status <> 'open' then raise exception 'world_not_open'; end if;
  if exists(select 1 from public.world_memberships where world_id = p_world_id and account_id = v_user) then return; end if;
  if (select count(*) from public.world_memberships where world_id = p_world_id and status = 'active') >= v_world.capacity then raise exception 'world_full'; end if;
  insert into public.world_memberships(world_id, account_id) values (p_world_id, v_user);
end; $$;

create or replace function public.join_private_world(p_token text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.world_invitations; v_world public.worlds; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_inv from public.world_invitations where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex') for update;
  if not found or (v_inv.expires_at is not null and v_inv.expires_at <= now()) or v_inv.uses >= v_inv.max_uses then raise exception 'invalid_invitation'; end if;
  select * into v_world from public.worlds where id = v_inv.world_id for update;
  if v_world.lifecycle_status <> 'open' then raise exception 'world_not_open'; end if;
  if not exists(select 1 from public.world_memberships where world_id = v_world.id and account_id = v_user) then
    if (select count(*) from public.world_memberships where world_id = v_world.id and status = 'active') >= v_world.capacity then raise exception 'world_full'; end if;
    insert into public.world_memberships(world_id, account_id) values (v_world.id, v_user);
    update public.world_invitations set uses = uses + 1 where id = v_inv.id;
  end if;
  return v_world.id;
end; $$;

create or replace function public.create_world_character(p_world_id uuid, p_name text, p_avatar_ref text, p_biography text, p_home_constituency_id text)
returns public.characters language plpgsql security definer set search_path = public as $$
declare v_world public.worlds; v_user uuid := auth.uid(); v_character public.characters;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_world from public.worlds where id = p_world_id for update;
  if not found or v_world.lifecycle_status <> 'open' or not public.is_active_world_member(p_world_id, v_user) then raise exception 'world_access_denied'; end if;
  -- Malaysia parliamentary IDs match app/data/constituencies.ts: state-id plus 0-based seat index.
  if not public.is_malaysia_parliamentary_constituency(p_home_constituency_id) then raise exception 'invalid_home_constituency'; end if;
  if (select count(*) from public.characters where world_id = p_world_id and account_id = v_user and lifecycle_status = 'active') >= v_world.character_slot_limit then raise exception 'character_limit'; end if;
  insert into public.characters(world_id, account_id, name, avatar_ref, biography, home_constituency_id)
  values (p_world_id, v_user, trim(p_name), p_avatar_ref, trim(coalesce(p_biography, '')), p_home_constituency_id) returning * into v_character;
  return v_character;
end; $$;

revoke all on function public.create_world(text, text, text, text) from public, anon;
revoke all on function public.list_public_worlds() from public, anon;
revoke all on function public.join_public_world(uuid) from public, anon;
revoke all on function public.join_private_world(text) from public, anon;
revoke all on function public.create_world_character(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_world(text, text, text, text) to authenticated;
grant execute on function public.list_public_worlds() to authenticated;
grant execute on function public.join_public_world(uuid) to authenticated;
grant execute on function public.join_private_world(text) to authenticated;
grant execute on function public.create_world_character(uuid, text, text, text, text) to authenticated;


-- ===== 20261020_world_community_turns.sql =====
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


-- ===== 20261021_resolve_world_turns.sql =====
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


-- ===== 20261022_scheduled_world_turns.sql =====
-- Adds a fixed, server-enforced cadence for the initial community turns.
alter table public.worlds add column if not exists turn_duration_minutes integer not null default 60 check (turn_duration_minutes between 5 and 1440);
update public.world_turns set closes_at = opens_at + interval '60 minutes' where closes_at is null and status = 'open';

create or replace function public.assign_world_turn_deadline()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_minutes integer;
begin
  if new.closes_at is null then
    select turn_duration_minutes into v_minutes from public.worlds where id = new.world_id;
    new.closes_at := new.opens_at + make_interval(mins => coalesce(v_minutes, 60));
  end if;
  return new;
end; $$;
drop trigger if exists world_turns_assign_deadline on public.world_turns;
create trigger world_turns_assign_deadline before insert on public.world_turns for each row execute function public.assign_world_turn_deadline();

-- Replace only to ensure successor turns receive a deadline through the trigger.
-- `resolve_world_turn` remains the idempotent resolver introduced in 20261021.


-- ===== 20261023_community_activity_effects.sql =====
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


-- ===== 20261024_world_parties.sql =====
-- World-scoped, account-authorized political organizations. No election powers yet.
create table if not exists public.world_parties (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  abbreviation text not null check (abbreviation ~ '^[A-Z0-9]{2,8}$'),
  colour text not null check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  treasury integer not null default 0 check (treasury >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(world_id, name), unique(world_id, abbreviation)
);
create table if not exists public.world_party_memberships (
  party_id uuid not null references public.world_parties(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('founder','officer','member')),
  status text not null default 'active' check (status in ('active','left','removed')),
  joined_at timestamptz not null default now(),
  primary key(party_id, account_id),
  unique(world_id, account_id)
);
alter table public.world_parties enable row level security;
alter table public.world_party_memberships enable row level security;
drop policy if exists "parties: world member read" on public.world_parties;
create policy "parties: world member read" on public.world_parties for select using (public.is_active_world_member(world_id));
drop policy if exists "party memberships: own read" on public.world_party_memberships;
create policy "party memberships: own read" on public.world_party_memberships for select using (account_id = auth.uid());

create or replace function public.create_world_party(p_world_id uuid, p_name text, p_abbreviation text, p_colour text)
returns public.world_parties language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_party public.world_parties;
begin
  if v_user is null or not public.is_active_world_member(p_world_id, v_user) then raise exception 'world_access_denied'; end if;
  if exists(select 1 from public.world_party_memberships where world_id=p_world_id and account_id=v_user and status='active') then raise exception 'already_in_party'; end if;
  insert into public.world_parties(world_id,name,abbreviation,colour,created_by) values(p_world_id,trim(p_name),upper(trim(p_abbreviation)),p_colour,v_user) returning * into v_party;
  insert into public.world_party_memberships(party_id,world_id,account_id,role) values(v_party.id,p_world_id,v_user,'founder');
  return v_party;
end; $$;
revoke all on function public.create_world_party(uuid,text,text,text) from public, anon;
grant execute on function public.create_world_party(uuid,text,text,text) to authenticated;


-- ===== 20261025_party_joining.sql =====
create or replace function public.join_world_party(p_party_id uuid)
returns public.world_party_memberships language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_party public.world_parties; v_membership public.world_party_memberships;
begin
  select * into v_party from public.world_parties where id=p_party_id for update;
  if v_user is null or not found or not public.is_active_world_member(v_party.world_id,v_user) then raise exception 'world_access_denied'; end if;
  if exists(select 1 from public.world_party_memberships where world_id=v_party.world_id and account_id=v_user and status='active') then raise exception 'already_in_party'; end if;
  insert into public.world_party_memberships(party_id,world_id,account_id) values(v_party.id,v_party.world_id,v_user) returning * into v_membership;
  return v_membership;
end; $$;
revoke all on function public.join_world_party(uuid) from public, anon;
grant execute on function public.join_world_party(uuid) to authenticated;


-- ===== 20261026_nominations.sql =====
-- Party nominations remain account-authorized; official election counting is a later phase.
create table if not exists public.world_nominations (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  party_id uuid not null references public.world_parties(id) on delete cascade,
  constituency_id text not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  nominated_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'proposed' check(status in ('proposed','confirmed','withdrawn')),
  created_at timestamptz not null default now(),
  unique(world_id, constituency_id, party_id)
);
alter table public.world_nominations enable row level security;
drop policy if exists "nominations: member read" on public.world_nominations;
create policy "nominations: member read" on public.world_nominations for select using(public.is_active_world_member(world_id));

create or replace function public.propose_world_nomination(p_world_id uuid,p_party_id uuid,p_character_id uuid,p_constituency_id text)
returns public.world_nominations language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text; v_nom public.world_nominations;
begin
 if v_user is null or not public.is_active_world_member(p_world_id,v_user) then raise exception 'world_access_denied'; end if;
 select role into v_role from public.world_party_memberships where party_id=p_party_id and world_id=p_world_id and account_id=v_user and status='active';
 if v_role not in ('founder','officer') then raise exception 'party_permission_denied'; end if;
 if not public.is_malaysia_parliamentary_constituency(p_constituency_id) then raise exception 'invalid_home_constituency'; end if;
 if not exists(select 1 from public.characters where id=p_character_id and world_id=p_world_id and lifecycle_status='active') then raise exception 'invalid_nominee'; end if;
 insert into public.world_nominations(world_id,party_id,constituency_id,character_id,nominated_by) values(p_world_id,p_party_id,p_constituency_id,p_character_id,v_user) returning * into v_nom;
 return v_nom;
end; $$;
revoke all on function public.propose_world_nomination(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.propose_world_nomination(uuid,uuid,uuid,text) to authenticated;


-- ===== 20261027_coalitions_government.sql =====
-- Post-election structures; they do not assign offices until a future official result resolver.
create table if not exists public.world_coalitions (
 id uuid primary key default gen_random_uuid(), world_id uuid not null references public.worlds(id) on delete cascade,
 name text not null, status text not null default 'proposed' check(status in ('proposed','active','dissolved')), created_at timestamptz not null default now(), unique(world_id,name)
);
create table if not exists public.world_coalition_parties (
 coalition_id uuid not null references public.world_coalitions(id) on delete cascade, party_id uuid not null references public.world_parties(id) on delete cascade, joined_at timestamptz not null default now(), primary key(coalition_id,party_id)
);
create table if not exists public.world_political_offices (
 id uuid primary key default gen_random_uuid(), world_id uuid not null references public.worlds(id) on delete cascade,
 office_key text not null, holder_character_id uuid references public.characters(id) on delete set null,
 status text not null default 'vacant' check(status in ('vacant','appointed','ended')), term_number integer not null default 1, unique(world_id,office_key,term_number)
);
alter table public.world_coalitions enable row level security; alter table public.world_coalition_parties enable row level security; alter table public.world_political_offices enable row level security;
drop policy if exists "coalitions: member read" on public.world_coalitions;
create policy "coalitions: member read" on public.world_coalitions for select using(public.is_active_world_member(world_id));
drop policy if exists "offices: member read" on public.world_political_offices;
create policy "offices: member read" on public.world_political_offices for select using(public.is_active_world_member(world_id));
-- No appointment functions: only the future official election/formation resolver may create offices.


-- ===== 20261028_public_character_identity_and_nomination_safety.sql =====
-- World members may see a character's in-world identity, never its account.
-- This permits public nomination lists without exposing auth/profile records.
drop policy if exists "characters: world member public identity" on public.characters;
create policy "characters: world member public identity" on public.characters for select using (public.is_active_world_member(world_id));

-- Replaces the initial function with explicit locks and world consistency
-- checks. Political authority remains account-level through party membership.
create or replace function public.propose_world_nomination(p_world_id uuid,p_party_id uuid,p_character_id uuid,p_constituency_id text)
returns public.world_nominations language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text; v_party public.world_parties; v_nominee public.characters; v_nom public.world_nominations;
begin
 if v_user is null or not public.is_active_world_member(p_world_id,v_user) then raise exception 'world_access_denied'; end if;
 select * into v_party from public.world_parties where id=p_party_id and world_id=p_world_id for update;
 if not found then raise exception 'world_access_denied'; end if;
 select role into v_role from public.world_party_memberships where party_id=p_party_id and world_id=p_world_id and account_id=v_user and status='active' for update;
 if v_role not in ('founder','officer') then raise exception 'party_permission_denied'; end if;
 if not public.is_malaysia_parliamentary_constituency(p_constituency_id) then raise exception 'invalid_home_constituency'; end if;
 select * into v_nominee from public.characters where id=p_character_id and world_id=p_world_id and lifecycle_status='active' for key share;
 if not found then raise exception 'invalid_nominee'; end if;
 insert into public.world_nominations(world_id,party_id,constituency_id,character_id,nominated_by)
 values(p_world_id,p_party_id,p_constituency_id,p_character_id,v_user) returning * into v_nom;
 return v_nom;
end; $$;


-- ===== 20261029_coalition_commands.sql =====
-- Account-authorised political alliances. Coalition status never grants an
-- office: government formation remains dependent on a future official result.
drop policy if exists "coalition parties: member read" on public.world_coalition_parties;
create policy "coalition parties: member read" on public.world_coalition_parties for select using (
  exists (select 1 from public.world_coalitions c where c.id = coalition_id and public.is_active_world_member(c.world_id))
);

create or replace function public.create_world_coalition(p_world_id uuid, p_name text)
returns public.world_coalitions language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_membership public.world_party_memberships; v_coalition public.world_coalitions;
begin
 if v_user is null or not public.is_active_world_member(p_world_id,v_user) then raise exception 'world_access_denied'; end if;
 select * into v_membership from public.world_party_memberships where world_id=p_world_id and account_id=v_user and status='active' for update;
 if not found or v_membership.role not in ('founder','officer') then raise exception 'party_permission_denied'; end if;
 if char_length(trim(p_name)) not between 3 and 60 then raise exception 'invalid_coalition_name'; end if;
 insert into public.world_coalitions(world_id,name,status) values(p_world_id,trim(p_name),'proposed') returning * into v_coalition;
 insert into public.world_coalition_parties(coalition_id,party_id) values(v_coalition.id,v_membership.party_id);
 return v_coalition;
end; $$;

create or replace function public.join_world_coalition(p_coalition_id uuid)
returns public.world_coalition_parties language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_coalition public.world_coalitions; v_membership public.world_party_memberships; v_row public.world_coalition_parties;
begin
 select * into v_coalition from public.world_coalitions where id=p_coalition_id for update;
 if not found or v_user is null or not public.is_active_world_member(v_coalition.world_id,v_user) then raise exception 'world_access_denied'; end if;
 if v_coalition.status='dissolved' then raise exception 'coalition_unavailable'; end if;
 select * into v_membership from public.world_party_memberships where world_id=v_coalition.world_id and account_id=v_user and status='active' for update;
 if not found or v_membership.role not in ('founder','officer') then raise exception 'party_permission_denied'; end if;
 insert into public.world_coalition_parties(coalition_id,party_id) values(p_coalition_id,v_membership.party_id)
 on conflict(coalition_id,party_id) do update set party_id=excluded.party_id returning * into v_row;
 return v_row;
end; $$;

revoke all on function public.create_world_coalition(uuid,text) from public,anon;
revoke all on function public.join_world_coalition(uuid) from public,anon;
grant execute on function public.create_world_coalition(uuid,text) to authenticated;
grant execute on function public.join_world_coalition(uuid) to authenticated;


-- ===== 20261030_online_worlds_hardening.sql =====
-- Hardening found by applying 20261019–20261029 to a fresh Supabase stack.
-- Forward-only and idempotent: safe whether or not earlier files were applied.

-- 1. Supabase installs pgcrypto in the `extensions` schema, so functions pinned
--    to `search_path = public` could not resolve gen_random_bytes()/digest():
--    private world creation and invitation joins always failed.
alter function public.create_world(text, text, text, text) set search_path = public, extensions;
alter function public.join_private_world(text) set search_path = public, extensions;

-- 2. Worlds created after 20261020 never received turn 1, so community
--    activity returned `no_open_turn` forever. Open turn 1 on insert and
--    backfill any world that has no turn yet.
create or replace function public.open_first_world_turn()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.world_turns(world_id, turn_number) values (new.id, 1)
  on conflict (world_id, turn_number) do nothing;
  return new;
end; $$;
revoke all on function public.open_first_world_turn() from public, anon, authenticated;
drop trigger if exists worlds_open_first_turn on public.worlds;
create trigger worlds_open_first_turn after insert on public.worlds for each row execute function public.open_first_world_turn();
insert into public.world_turns(world_id, turn_number)
select w.id, 1 from public.worlds w
where not exists (select 1 from public.world_turns t where t.world_id = w.id)
on conflict (world_id, turn_number) do nothing;

-- 3. 20261023 added a 4-argument overload but left the unvalidated 3-argument
--    version from 20261020 callable. Remove it.
drop function if exists public.submit_world_community_activity(uuid, uuid, text);

-- 4. Membership helper: only answer for the calling account and never for anon,
--    so it cannot be used as a membership oracle for arbitrary account IDs.
create or replace function public.is_active_world_member(p_world_id uuid, p_account_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select p_account_id is not null and p_account_id = auth.uid()
    and exists (select 1 from public.world_memberships where world_id = p_world_id and account_id = p_account_id and status = 'active');
$$;
revoke all on function public.is_active_world_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_world_member(uuid, uuid) to authenticated;

-- 5. `v_role not in (...)` is NULL when the caller is not in the party, which
--    skipped the guard and let any world member nominate for any party.
create or replace function public.propose_world_nomination(p_world_id uuid,p_party_id uuid,p_character_id uuid,p_constituency_id text)
returns public.world_nominations language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_role text; v_party public.world_parties; v_nominee public.characters; v_nom public.world_nominations;
begin
 if v_user is null or not public.is_active_world_member(p_world_id,v_user) then raise exception 'world_access_denied'; end if;
 select * into v_party from public.world_parties where id=p_party_id and world_id=p_world_id for update;
 if not found then raise exception 'world_access_denied'; end if;
 select role into v_role from public.world_party_memberships where party_id=p_party_id and world_id=p_world_id and account_id=v_user and status='active' for update;
 if v_role is null or v_role not in ('founder','officer') then raise exception 'party_permission_denied'; end if;
 if not public.is_malaysia_parliamentary_constituency(p_constituency_id) then raise exception 'invalid_home_constituency'; end if;
 select * into v_nominee from public.characters where id=p_character_id and world_id=p_world_id and lifecycle_status='active' for key share;
 if not found then raise exception 'invalid_nominee'; end if;
 insert into public.world_nominations(world_id,party_id,constituency_id,character_id,nominated_by)
 values(p_world_id,p_party_id,p_constituency_id,p_character_id,v_user) returning * into v_nom;
 return v_nom;
end; $$;
revoke all on function public.propose_world_nomination(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.propose_world_nomination(uuid,uuid,uuid,text) to authenticated;

-- 6. World members may read in-world identity but never the owning account.
--    Column grants hide account-linking columns from client roles; the owner
--    lists their own characters through list_my_world_characters().
revoke select on public.characters from anon, authenticated;
grant select (id, world_id, name, avatar_ref, biography, home_constituency_id, lifecycle_status, created_at, updated_at) on public.characters to authenticated;
revoke select on public.world_community_activities from anon, authenticated;
grant select (id, world_id, turn_id, character_id, activity_type, constituency_id, status, created_at) on public.world_community_activities to authenticated;
revoke select on public.world_nominations from anon, authenticated;
grant select (id, world_id, party_id, constituency_id, character_id, status, created_at) on public.world_nominations to authenticated;
revoke select on public.world_parties from anon, authenticated;
grant select (id, world_id, name, abbreviation, colour, treasury, created_at) on public.world_parties to authenticated;

create or replace function public.list_my_world_characters(p_world_id uuid)
returns table (id uuid, world_id uuid, name text, avatar_ref text, biography text, home_constituency_id text, lifecycle_status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.world_id, c.name, c.avatar_ref, c.biography, c.home_constituency_id, c.lifecycle_status, c.created_at
  from public.characters c
  where c.world_id = p_world_id and c.account_id = auth.uid() and public.is_active_world_member(p_world_id)
  order by c.created_at;
$$;
revoke all on function public.list_my_world_characters(uuid) from public, anon;
grant execute on function public.list_my_world_characters(uuid) to authenticated;

-- Trigger/helper functions are not client RPCs.
revoke all on function public.assign_world_turn_deadline() from public, anon, authenticated;
revoke all on function public.touch_world_rows() from public, anon, authenticated;


-- ===== 20261031_system_managed_worlds.sql =====
-- Worlds are provisioned by the system, not by players.
-- * At least two public worlds always exist ("Malaysia 1", "Malaysia 2").
-- * Each world holds at most 100 players (active memberships).
-- * When every open system world is full, a new one is created automatically.
-- Forward-only and idempotent. Must run after 20261030 (and after any re-run of 20261019,
-- which restores the player-facing create_world grant and old function bodies).

alter table public.worlds alter column creator_id drop not null;
alter table public.worlds add column if not exists is_system boolean not null default false;
alter table public.worlds add column if not exists system_number integer;
create unique index if not exists worlds_system_number_idx on public.worlds(system_number) where is_system;

-- Players can no longer create worlds (public or private).
revoke execute on function public.create_world(text, text, text, text) from authenticated;

-- Ensures the minimum number of system worlds exist and that at least one open
-- system world still has room. Serialised with an advisory lock so concurrent
-- joins cannot spawn duplicate worlds.
create or replace function public.ensure_system_worlds(p_min_worlds integer default 2, p_capacity integer default 100)
returns void language plpgsql security definer set search_path = public as $$
declare v_next integer; v_has_room boolean; v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('public.ensure_system_worlds'));
  loop
    select count(*) into v_count from public.worlds where is_system and lifecycle_status = 'open';
    select exists (
      select 1 from public.worlds w
      where w.is_system and w.lifecycle_status = 'open'
        and (select count(*) from public.world_memberships m where m.world_id = w.id and m.status = 'active') < w.capacity
    ) into v_has_room;
    exit when v_count >= p_min_worlds and v_has_room;
    select coalesce(max(system_number), 0) + 1 into v_next from public.worlds where is_system;
    insert into public.worlds(name, slug, description, visibility, capacity, creator_id, is_system, system_number)
    values ('Malaysia ' || v_next, 'malaysia-' || v_next || '-' || substr(md5(random()::text), 1, 6),
            '',
            'public', p_capacity, null, true, v_next);
  end loop;
end; $$;
revoke all on function public.ensure_system_worlds(integer, integer) from public, anon, authenticated;

-- Lobby lists system worlds only, topping up capacity first. Open worlds with
-- room are listed first, then by world number. is_member lets a player re-enter
-- a world that has since filled up.
drop function if exists public.list_public_worlds();
create function public.list_public_worlds()
returns table (id uuid, name text, slug text, description text, geography_template text, visibility text, lifecycle_status text, capacity integer, character_slot_limit integer, created_at timestamptz, member_count bigint, is_member boolean)
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.ensure_system_worlds();
  return query
  select w.id, w.name, w.slug, w.description, w.geography_template, w.visibility, w.lifecycle_status, w.capacity, w.character_slot_limit, w.created_at,
    count(m.account_id) filter (where m.status = 'active') as member_count,
    bool_or(m.account_id = auth.uid() and m.status = 'active') is true as is_member
  from public.worlds w left join public.world_memberships m on m.world_id = w.id
  where w.is_system and w.visibility = 'public' and w.lifecycle_status <> 'archived'
  group by w.id
  order by (count(m.account_id) filter (where m.status = 'active') >= w.capacity), w.system_number;
end; $$;
revoke all on function public.list_public_worlds() from public, anon;
grant execute on function public.list_public_worlds() to authenticated;

-- Join enforces the 100-player cap and spawns the next world when this join fills one.
create or replace function public.join_public_world(p_world_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_world public.worlds; v_user uuid := auth.uid(); v_members integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_world from public.worlds where id = p_world_id for update;
  if not found or v_world.visibility <> 'public' or not v_world.is_system then raise exception 'world_not_available'; end if;
  if v_world.lifecycle_status <> 'open' then raise exception 'world_not_open'; end if;
  if exists(select 1 from public.world_memberships where world_id = p_world_id and account_id = v_user and status = 'active') then return; end if;
  select count(*) into v_members from public.world_memberships where world_id = p_world_id and status = 'active';
  if v_members >= v_world.capacity then raise exception 'world_full'; end if;
  insert into public.world_memberships(world_id, account_id) values (p_world_id, v_user)
  on conflict (world_id, account_id) do update set status = 'active', joined_at = now()
  where public.world_memberships.status = 'left';
  if not found then raise exception 'world_access_denied'; end if; -- suspended accounts stay out
  if v_members + 1 >= v_world.capacity then perform public.ensure_system_worlds(); end if;
end; $$;
revoke all on function public.join_public_world(uuid) from public, anon;
grant execute on function public.join_public_world(uuid) to authenticated;

-- Seed the first two worlds.
select public.ensure_system_worlds();

commit;
