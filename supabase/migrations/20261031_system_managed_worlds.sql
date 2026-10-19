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
