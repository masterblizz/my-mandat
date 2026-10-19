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
