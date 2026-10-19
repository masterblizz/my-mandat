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
