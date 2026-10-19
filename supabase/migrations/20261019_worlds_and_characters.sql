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
