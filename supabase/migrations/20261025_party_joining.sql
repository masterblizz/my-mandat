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
