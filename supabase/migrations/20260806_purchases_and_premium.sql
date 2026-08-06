-- MY MANDAT — in-app purchases (Stripe) schema.
-- Run this once in the Supabase SQL editor (or via `supabase db push` if
-- you use the Supabase CLI). No supabase/ directory existed in this repo
-- before this migration, so there is no CLI project link set up yet —
-- pasting this file into Project > SQL Editor > New query is the fastest
-- path.

-- ── profiles ────────────────────────────────────────────────────────────
-- One row per auth.users row. Didn't exist before this migration — created
-- here rather than assumed, per the brief.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  premium_tier text,                -- e.g. 'basic' | 'premium'; null = free
  premium_expires_at timestamptz,   -- subscriptions only; null for a
                                     -- permanent one-time-purchase unlock
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may read their own profile (client-side usePremiumStatus() needs
-- this) but there is deliberately NO insert/update/delete policy for the
-- anon/authenticated roles — RLS default-denies any write from the client,
-- so premium_tier can only ever be changed by the webhook's service-role
-- client, which bypasses RLS entirely. Don't add a client-writable column
-- to this table without thinking through whether it should stay that way.
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create the profiles row the moment a new auth user signs up, so
-- /api/checkout and the webhook never have to special-case "row doesn't
-- exist yet" for brand-new accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: existing accounts that registered before this migration ran
-- won't have fired the trigger above.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ── purchases ───────────────────────────────────────────────────────────
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text,
  stripe_payment_intent_id text,
  product_name text not null,
  amount integer,   -- smallest currency unit (e.g. sen/cents), matches
                     -- Stripe's session.amount_total
  currency text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on public.purchases(user_id);

alter table public.purchases enable row level security;

-- Same pattern as profiles: read-only from the client, scoped to the
-- caller's own rows. No write policy at all — only the webhook's
-- service-role client (bypasses RLS) may insert/update purchases.
create policy "purchases: read own" on public.purchases
  for select using (auth.uid() = user_id);
