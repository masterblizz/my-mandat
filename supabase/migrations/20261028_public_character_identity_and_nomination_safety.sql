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
