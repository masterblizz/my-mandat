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
