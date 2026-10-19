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
create policy "coalitions: member read" on public.world_coalitions for select using(public.is_active_world_member(world_id));
create policy "offices: member read" on public.world_political_offices for select using(public.is_active_world_member(world_id));
-- No appointment functions: only the future official election/formation resolver may create offices.
