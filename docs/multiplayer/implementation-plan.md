# Persistent political MMORPG plan

## Implemented in this slice: worlds and characters

The solo game remains a browser-local Zustand campaign: `gameStore`, `saveGame`, `journey`, `StoreHydrator`, autosave and progress tracking only touch solo localStorage state. Online state is separate: Supabase tables `worlds`, `world_memberships`, `characters` and protected `world_invitations`, server RPCs for atomic mutations, `/api/online/*` endpoints, and a small online-session store holding selected IDs. A refresh or direct `/online/:worldId/play` link always re-fetches the caller's owned characters before showing the overview.

`world_id` logically isolates every future political record. A world uses the existing `malaysia-v1` template; fictional names do not create custom maps or election systems. Public worlds can be browsed and joined; private worlds require a one-time-disclosed, hash-stored invitation token. Creation is capped at five active worlds per account. Creators have lobby-management membership only, not political office. Each account has at most three active characters per world; names are unique per world, 3–32 conservative display characters, and characters cannot yet be deleted or transferred.

All capacity and character-limit checks run in locking PostgreSQL functions, never browser read-count-insert flows. Future political rights must be keyed by **account-within-world**, not character: creating characters cannot create extra votes, candidacies, action budgets, party authority, or resource claims.

The existing 3D kawasan scene is intentionally not reused: it reads/writes solo state and would falsely expose solo actions in an online world. The delivered overview is database-backed and intentionally non-interactive politically.

## 1. Worlds and characters

Implemented: login → browse/create/join world → create/select character → persisted overview. RLS exposes public worlds plus member worlds, and only the caller's characters/memberships. Every mutation authenticates and derives the account from the session. `auth.users` remains the account source; credentials are never duplicated.

Future: world administration, moderation, invitation revocation/rotation, archival and account-wide character management.

## 2. Community activities, reputation and world turns

Implemented: an account-scoped community-outreach intent per open world turn, a public activity ledger, private account reputation, and a server-only atomic resolver. Resolving a specific turn locks it, resolves accepted activities deterministically (+5 reputation), publishes immutable events, completes the turn, and opens the next turn in one transaction. Repeating the same completed turn is idempotent.

Implemented: the protected due-turn scheduler endpoint discovers up to 50 expired open turns and resolves each exact ID with the service role. Initial turns use a server-enforced 60-minute deadline. The online overview now renders public resolution reports and the caller's private reputation.

Future: configure an external cron provider to call the scheduler endpoint with `WORLD_TURN_CRON_SECRET`; richer activity effects, private plans and the multiplayer campaign resolver remain separate work. Clients submit intents only.

## 3. Player-run parties, roles and shared resources

Implemented: world-scoped parties, one active account-level party membership per world, founder/officer/member roles, protected party creation and joining, and a real overview UI for forming or joining a party. The account identity always comes from the authenticated server session; a browser-supplied party ID never proves authority. Treasury is present as shared party state but this slice deliberately includes no client-controlled deposits, withdrawals, or spending ledger.

Future: officer appointment/removal, party applications/invitations, treasury income and an immutable resource ledger.

## 4. Nominations, campaigns and elections

Implemented: founders and officers can record a party nomination for an active world character and a validated Malaysian parliamentary constituency. Nominations are public to world members and are not official results. The home-seat selector validates only the existing Malaysian parliamentary template. Solo `mandat/lawan/others` aggregates are not migrated or split into online parties.

Future: election phases, eligibility rules, campaign-order submission against the deterministic domain engine, polling, transactional official counts, and election history. Official outcomes remain separate from projections.

## 5. Coalitions, parliament and government

Implemented: a public, account-authorized coalition ledger. Party founders/officers can propose a coalition from their party or join another non-dissolved coalition with their party. Coalition status never grants government office.

Future: election-result thresholds, coalition deals and consent, confidence, cabinet offices, government/opposition roles, and term records. Creator membership does not grant any of these powers. The solo `journey.ts` formation path remains isolated.

## 6. Shared 3D presence and live events

Implemented: a dedicated read-only online city adapter renders the selected world and character without importing solo Zustand state, local save APIs, journey state, or online mutation actions. It is deliberately visual-only; political actions remain in authenticated, server-validated world forms.

Future: authenticated presence, live events, character movement synchronization, and explicit online city commands. These must remain separate from the solo scene and save system.

## Setup and migration

Apply migrations `20261019_worlds_and_characters.sql` through `20261029_coalition_commands.sql` in order through the Supabase CLI or SQL editor in a non-production project. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and an unguessable `WORLD_TURN_CRON_SECRET` for the scheduler endpoint. No migration is applied by this repository.
