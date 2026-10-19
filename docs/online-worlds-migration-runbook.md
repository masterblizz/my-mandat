# Online Worlds — Supabase migration runbook

Scope: `supabase/migrations/20261019_worlds_and_characters.sql` → `20261031_system_managed_worlds.sql` (13 files).
Never apply to Production first. Apply to a staging project, run the verification below, then repeat on Production.

## 0. Preconditions

- `20260806_purchases_and_premium.sql` is already applied (Production has `public.profiles` with `username`).
- `pgcrypto` is installed (Supabase default: schema `extensions`). Check:
  ```sql
  select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname = 'pgcrypto';
  -- expect: extensions
  ```
- None of the online tables exist yet (fresh apply):
  ```sql
  select to_regclass('public.worlds'), to_regclass('public.world_turns'), to_regclass('public.world_parties');
  -- expect: null, null, null   (if not null, see "Re-running" below)
  ```
- Take a backup / note the PITR timestamp (Dashboard → Database → Backups).

## 1a. Apply with Supabase CLI (preferred)

```bash
supabase login
supabase link --project-ref <STAGING_REF>
supabase migration list            # confirm which versions are already recorded remotely
supabase db push --dry-run         # must list exactly 20261019 … 20261031
supabase db push
```

If `migration list` shows 20260806 as *not* recorded remotely (it was applied by hand in the SQL editor), mark it applied first instead of re-running it:
`supabase migration repair --status applied 20260806`.

## 1b. Apply with Dashboard SQL Editor

Paste and run each file **in this exact order**, one at a time, confirming "Success" before the next:

1. 20261019_worlds_and_characters.sql
2. 20261020_world_community_turns.sql
3. 20261021_resolve_world_turns.sql
4. 20261022_scheduled_world_turns.sql
5. 20261023_community_activity_effects.sql
6. 20261024_world_parties.sql
7. 20261025_party_joining.sql
8. 20261026_nominations.sql
9. 20261027_coalitions_government.sql
10. 20261028_public_character_identity_and_nomination_safety.sql
11. 20261029_coalition_commands.sql
12. **20261030_online_worlds_hardening.sql** (mandatory — fixes private-world creation, first turns, a nomination authorization bypass, and account-ID exposure)
13. **20261031_system_managed_worlds.sql** (players can no longer create worlds; seeds "Malaysia 1" and "Malaysia 2", caps each at 100 players, and auto-creates the next world when all open worlds are full)

### Re-running

Every file is re-runnable. Re-running 20261019 / 20261020 / 20261026 restores their original (unsafe) function bodies,
so **always finish by re-running 20261030 and then 20261031**.

## 2. Verification queries (run as `postgres` in SQL Editor)

```sql
-- 2.1 objects exist
select count(*) = 13 from pg_tables where schemaname = 'public' and tablename in
 ('worlds','world_memberships','characters','world_invitations','world_turns','world_community_activities',
  'world_account_reputation','world_turn_events','world_constituency_civic_trust','world_parties',
  'world_party_memberships','world_nominations','world_coalitions');

-- 2.2 RLS enabled on every online table (expect zero rows)
select tablename from pg_tables where schemaname = 'public' and rowsecurity = false
  and tablename like any (array['world%','characters']);

-- 2.3 only the 4-arg community RPC exists (expect 1 row)
select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'submit_world_community_activity';

-- 2.4 pgcrypto resolves inside the definer functions (expect both to include "extensions")
select proname, proconfig from pg_proc where proname in ('create_world','join_private_world');

-- 2.5 resolver is service-role only (expect: false, false, true)
select has_function_privilege('anon','public.resolve_world_turn(uuid,uuid)','execute'),
       has_function_privilege('authenticated','public.resolve_world_turn(uuid,uuid)','execute'),
       has_function_privilege('service_role','public.resolve_world_turn(uuid,uuid)','execute');

-- 2.6 account-linking columns hidden from clients (expect: false, true, false)
select has_column_privilege('authenticated','public.characters','account_id','select'),
       has_column_privilege('authenticated','public.characters','name','select'),
       has_column_privilege('anon','public.characters','name','select');

-- 2.7 every world has an open turn (expect zero rows)
select w.id from public.worlds w where not exists
  (select 1 from public.world_turns t where t.world_id = w.id and t.status = 'open');

-- 2.8 trigger present
select tgname from pg_trigger where tgname in ('worlds_open_first_turn','world_turns_assign_deadline') order by 1;
```

Then smoke-test with two real accounts on the staging deployment (`/online` → create world → character → play;
second account joins; private world via invitation code).

## 3. Rollback

Forward-fix is preferred. If a full removal is required (no player data worth keeping), run in a transaction:

```sql
begin;
drop table if exists public.world_coalition_parties, public.world_coalitions, public.world_political_offices,
  public.world_nominations, public.world_party_memberships, public.world_parties,
  public.world_constituency_civic_trust, public.world_turn_events, public.world_account_reputation,
  public.world_community_activities, public.world_turns, public.world_invitations,
  public.characters, public.world_memberships, public.worlds cascade;
drop function if exists public.create_world(text,text,text,text), public.list_public_worlds(), public.join_public_world(uuid),
  public.join_private_world(text), public.create_world_character(uuid,text,text,text,text), public.world_current_turn(uuid),
  public.submit_world_community_activity(uuid,uuid,text,text), public.resolve_world_turn(uuid,uuid),
  public.create_world_party(uuid,text,text,text), public.join_world_party(uuid),
  public.propose_world_nomination(uuid,uuid,uuid,text), public.create_world_coalition(uuid,text),
  public.join_world_coalition(uuid), public.list_my_world_characters(uuid), public.is_active_world_member(uuid,uuid),
  public.is_malaysia_parliamentary_constituency(text), public.touch_world_rows(), public.assign_world_turn_deadline(),
  public.open_first_world_turn() cascade;
commit;
```

If using the CLI, also remove the versions from history: `supabase migration repair --status reverted 20261019 … 20261031`.
Rollback does not touch `profiles` or any solo-game data (solo saves are browser-local).

## 4. Vercel configuration

Required for **Production and Preview** (Project → Settings → Environment Variables):

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview should point at the staging project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | matches the URL's project |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only; never `NEXT_PUBLIC_` |
| `WORLD_TURN_CRON_SECRET` | ≥32 random chars, e.g. `openssl rand -hex 32` |
| `CRON_SECRET` | needed for Vercel Cron; Vercel sends it as `Authorization: Bearer …` |

Check names without printing values: `vercel env ls production` and `vercel env ls preview`.

### Turn scheduler

`GET|POST /api/internal/world-turns/resolve-due` resolves every open turn past `closes_at` (default 60 min).
It accepts `Bearer $CRON_SECRET` or `Bearer $WORLD_TURN_CRON_SECRET`.

Vercel Cron on **Pro** (Hobby allows only once-per-day jobs and rejects deployments with more frequent schedules):

```json
{ "crons": [{ "path": "/api/internal/world-turns/resolve-due", "schedule": "*/10 * * * *" }] }
```

Add this as `vercel.json` only after confirming the plan. On Hobby, use an external scheduler (GitHub Actions cron,
Supabase `pg_cron` + `pg_net`) that calls the endpoint with `Authorization: Bearer $WORLD_TURN_CRON_SECRET`.

Verify safely:
```bash
curl -i https://<deployment>/api/internal/world-turns/resolve-due                    # expect 401
curl -s -H "Authorization: Bearer $WORLD_TURN_CRON_SECRET" https://<deployment>/api/internal/world-turns/resolve-due
# expect {"resolved":N,"attempted":N,...}; resolving is idempotent, repeated calls are safe
```
