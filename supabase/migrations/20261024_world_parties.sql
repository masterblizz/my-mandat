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
