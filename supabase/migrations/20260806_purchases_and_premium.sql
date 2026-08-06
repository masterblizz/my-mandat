-- MY MANDAT — in-app purchases (Stripe) schema.
-- Run this in the Supabase SQL editor (or via `supabase db push` if you use
-- the Supabase CLI). Every statement here is idempotent (IF NOT EXISTS /
-- OR REPLACE / DROP+CREATE), so re-running the whole file again is safe —
-- this matters because this file already had one broken run against a
-- project that turned out to already have its own `profiles` table (see
-- below), and it needed to be re-run after the fix.

-- ── profiles ────────────────────────────────────────────────────────────
-- This project ALREADY had a `profiles` table (with a `username text not
-- null` column, from whatever earlier auth/profile setup this project's
-- register flow uses) before this migration existed. The first version of
-- this file assumed profiles didn't exist yet, used `create table if not
-- exists` (a no-op against an existing table — it does NOT add missing
-- columns), and then tried to insert rows that only set `id`, which
-- violated that pre-existing NOT NULL constraint. Fixed by only ever
-- ADDing columns to whatever's already there, and by giving the
-- auto-create trigger a safe fallback for `username` instead of assuming
-- it doesn't need one.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists premium_tier text;              -- e.g. 'prn' | 'premium'; null = free
alter table public.profiles add column if not exists premium_expires_at timestamptz; -- subscriptions only; null for a permanent one-time-purchase unlock
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS` — a unique index is the
-- idempotent equivalent and works identically for query/upsert purposes.
create unique index if not exists profiles_stripe_customer_id_key on public.profiles(stripe_customer_id);

alter table public.profiles enable row level security;

-- Users may read their own profile (client-side usePremiumStatus() needs
-- this) but there is deliberately NO insert/update/delete policy for the
-- anon/authenticated roles — RLS default-denies any write from the client,
-- so premium_tier can only ever be changed by the webhook's service-role
-- client, which bypasses RLS entirely. Don't add a client-writable column
-- to this table without thinking through whether it should stay that way.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

-- Namespaced function/trigger names (not the generic `handle_new_user` /
-- `on_auth_user_created` every Supabase starter template uses) — reusing
-- those generic names with `create or replace` would have silently
-- overwritten this project's real signup trigger if it already had one
-- under that name, which is exactly the kind of thing that caused the
-- username failure above.
create or replace function public.set_purchases_profile_updated_at()
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
  for each row execute function public.set_purchases_profile_updated_at();

-- Auto-create the profiles row the moment a new auth user signs up, so
-- /api/checkout and the webhook never have to special-case "row doesn't
-- exist yet" for brand-new accounts. Supplies a fallback username (this
-- project's profiles.username is NOT NULL with no default) from the
-- signup metadata when present, otherwise a generated placeholder — same
-- fallback the backfill below uses.
create or replace function public.handle_new_user_purchases_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_purchases_profile on auth.users;
create trigger on_auth_user_created_purchases_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_purchases_profile();

-- Backfill: existing accounts that registered before this migration ran
-- won't have fired the trigger above.
insert into public.profiles (id, username)
select id, coalesce(raw_user_meta_data->>'username', 'user_' || substr(id::text, 1, 8))
from auth.users
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
drop policy if exists "purchases: read own" on public.purchases;
create policy "purchases: read own" on public.purchases
  for select using (auth.uid() = user_id);
