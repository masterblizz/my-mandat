# My Mandat — Gameplay & Storyline Reference

Ground-truth description of what is actually implemented in the codebase as of 2026-07-06 (updated from the original 2026-07-03 pass), written for improvement analysis. Design intent lives in `GAME_DESIGN.md` (Malay) and the feature backlog lives in `docs/my-mandat-improvement-suggestions.md` — this document instead describes **current runtime behavior**, verified by reading the source, so it can be used as a baseline to spot gaps between intent and implementation.

---

## 1. Premise

My Mandat is a Malaysian federal election campaign simulator. The player leads a fictional or real-named party through a 30-day General Election campaign (War Room phase), then — depending on the seat count won — continues into a post-election storyline: government formation, cabinet appointment, governing, and a multi-term political career, or an opposition/rebuilding path if the election is lost.

---

## 2. Player journey map

```
/setup ──▶ /warroom (30 days) ──▶ /results ──▶ /mandate
                                                   │
                    ┌──────────────────────────────┼──────────────────────┐
                    ▼ (majority / hung)             ▼ (opposition)         ▼ (collapse)
                /formation                      /opposition            /postmortem
                    │                                │                      │
        ┌───────────┴───────────┐                    │                      │
        ▼ (coalition ≥112)      ▼ (short of 112)      │                      │
    /cabinet                /opposition                │                      │
        │                                              │                      │
        ▼ (majority only)                              │                      │
    /swearing-in                                        │                      │
        │                                              │                      │
        ▼                                              │                      │
    /government ──▶ /career ◀─────────────────────────┴──────────────────────┘
                        │
                        ▼
                    /sandbox
```

Side panels reachable during the War Room phase (via the top nav, `Header.tsx`): `/campaign` (nomination), `/calendar`, `/messaging`, `/polling`, `/stats`, `/state/[id]`.

`Header.tsx` classifies every route into `WAR_ROOM_FLOW_ROUTES` (pre/at-election — now including `/mandate`, `/formation`, `/cabinet`) or `GOVERNING_ROUTES` (post-election: `/swearing-in`, `/government`, `/career`, `/sandbox`, `/opposition`, `/postmortem`), and switches its own nav affordances accordingly — this is the one place the two halves of the game are aware of each other. On any `GOVERNING_ROUTES` page it also renders a "WAR ROOM LOCKED" badge and swaps the header subtitle to a governing-mode label; on War Room-flow pages the subtitle instead reflects `electionScope` (PRU national vs PRN state-election wording).

---

## 3. Phase-by-phase

### 3.1 Setup (`/setup`)

A 5-step wizard (`STEPS` in `setup/page.tsx`):

0. **Data mode** — choose `dummy` (fictional parties/politicians) or `real-malaysia` (real party names, still-simulated numbers) dataset (`app/data/datasets.ts`).
1. **Avatar & party** — leader name (required to advance), position, experience tier, home state, avatar portrait, party (from the chosen dataset), 5 leader attributes (Influence/Charisma/Credibility/Negotiation/Strategy) allocated from a shared 450-point budget (`TOTAL_POINTS`), each attribute clamped to 1–100 and the pool clamped to never go negative (fixed this session).
2. **Campaign settings** — economic/social ideology sliders (set but not read anywhere downstream — see §6), election scope (`pru` national vs `prn` single-state), region toggles (Peninsular/Sabah/Sarawak — set but never read anywhere, see §6).
3. **Difficulty** — easy/normal/hard/nightmare preset, each setting `oppositionStrength` (40/60/80/95) and an implicit media-bias baseline; also a media-bias selector (pro/balanced/hostile) and toggles for event randomness and permanent consequences.
4. **Confirm & launch** — summary screen; `LAUNCH CAMPAIGN` calls `resetGame()`, writes `leader` + `settings` to the Zustand store, sets `phase: "playing"`, and routes to `/warroom`.

### 3.2 War Room campaign (`/warroom`, 30 days)

This is the only phase with a real, persisted day-by-day simulation. Each `NEXT DAY` click calls `advanceDay()` → `processDay()` (`app/store/electionEngine.ts`):

- **Player operations** (`Operation[]` in the store — door-to-door, ceramah, youth, digital, rural) that are `active`/`ongoing` add `supportGain * 0.08` per day to their target states, and drain `funds`/`manpower` proportionally over the campaign length.
- **Scripted events** (`app/data/events.ts`, 15 hand-authored events keyed to specific days with a probability roll) apply national and/or per-state support deltas and occasional resource swings.
- **Opponent AI** (`app/store/opponentAI.ts`) runs every day and can fire up to 8 distinct action types, each with its own independent probability roll:
  - **`pressure`** — scores states by neglect (not targeted by the player), marginality, seat weight, and whether the player recently gained there, then applies geographic pressure to 1 state (2 in the campaign's back half);
  - **`candidate_poach`** — targets the most marginal contested state not already hit by `pressure` this round with a lower-frequency, single-state lawan boost (probability ramps up after 30% campaign progress);
  - **`counter_narrative`** — reacts to the player's own tactics: 2+ digital ops, 3+ ceramah ops, or zero Borneo ops by day 8;
  - **`manifesto_attack`** — an independent national-credibility chip, separate from `counter_narrative`, that ramps up after 35% progress;
  - **`viral_social`** — high-frequency, low-magnitude national chip damage that can fire from day one (unlike the punchier one-off beats), modelling constant social-media churn;
  - **`scandal`** — probability roughly doubles after the campaign's midpoint;
  - **`coalition_form`** — consolidates smaller/independent parties into LAWAN's camp in whichever state MANDAT is currently trailing worst (active only in the campaign's middle third, 25%–85% progress);
  - **`media_blitz`** — late-game (>72% through) national/state media blitz; when the campaign is scoped to a PRN (see below), its narrative text is rewritten to name the specific negeri instead of "nationwide".
  - All magnitudes scale with `oppositionStrength/100 × difficultyMultiplier` (0.45/0.72/1.1/1.55 for easy→nightmare).
- **Random per-state noise** (±0.3%, seeded off state id + day, so deterministic per playthrough) is added on top.
- State support (`mandatSupport`/`lawanSupport`/`othersSupport`), win/loss/contested `status`, and `projectedSeats` are recomputed daily from the resulting margin. Projected seats use a heuristic win-share formula, not a real constituency count (see §3.3 for the constituency-accurate version).
- Alerts are generated for: the day's scripted event, high-severity opponent actions, and a same-day summary ("support up in N states").

**Nomination** (`/campaign`, `NominationTab`): assign named party members or AI-advisor-suggested candidates (local/technocrat/firebrand archetypes) to each constituency seat. `runNominationDecision()` applies a one-time support/win-probability bump per state and drains funds/manpower; an AI Advisor button auto-fills empty seats using a fit-score (`scoreAssignment`) without overwriting player picks. Nominations also generate `PoliticalReaction` entries (persisted to `localStorage` separately from the save system, and re-hydrated on War Room mount via `readPersistedPoliticalReactions()` so they survive a page reload).
  - **Candidate snub / fallout mechanic**: assigning a seat computes a "grievance" score for every other unassigned pool member (exact-home-seat match, same-state, national-influence figure, weighted by influence/credibility/seniority). If the strongest snubbed candidate's grievance clears a threshold (≥86), `assign()` picks one of 3 scenarios — **independent** run (exact-seat match), **opposition** defection (high influence/credibility figure), or **sabotage** (lower-profile figure) — builds a narrative reaction via `buildCandidateFalloutReaction()`, and calls `applyCandidateFallout(stateId, reaction, lawanBoost, othersBoost)`, which nudges that state's `lawanSupport`/`othersSupport` up and `mandatSupport`/`winProbability`/`trend` down accordingly. This is a real, persisted state mutation — nomination choices can now genuinely backfire.

**Campaign mini-games** (also in `/campaign`, MINI-GAMES tab): ceramah or social-media pushes with a safe/balanced/aggressive tactic choice. Selecting a tactic opens `CeramahSceneModal` — a short interstitial: the player picks a speech/post **topic** (`generateCampaignTopics()` in `app/data/campaignTopics.ts` mixes 1–2 of the target state's own `keyIssues` with a random pick from a 10-entry generic pool per game type, so choices feel state-specific and vary each session), then a `CrowdScene` animation rolls a reaction (`positive`/`negative`/`neutral`) per simulated attendee face (`ReactionFace`) based on the projected gain, and only after a 1.3s settle delay does it actually call `runCampaignMiniGame()` to mutate the store. The gain formula itself (`calculateCampaignGain()` in `app/store/campaignMath.ts`) is a single source of truth shared by the real store mutation and the animation's cosmetic preview, so the crowd reaction can never visually drift from the real number: aggressive tactics give the highest base gain but carry a support-risk penalty; social pushes scale with a state's youth demographic, ceramah with its rural demographic. This directly mutates `states` in the store (real, persisted effect — unlike most of the post-election screens, see §6).

**Side panels**: `/calendar` (election-flow timeline reference, `app/data/electionFlow.ts` — Malaysia's real PRU procedural stages: dissolution → EC date → writ → nomination day (day 15) → 14-day campaign window (day 16–29) → cooling-off → polling (day 30) → counting → results → government formation, used only as flavor text/reference, not gated gameplay), `/messaging`, `/polling`, `/stats`.

**PRN (state election) scoping is now real, not just a label.** When `settings.electionScope === "prn"` (set at `/setup` or `/settings`, persisted in the store, no longer local-only component state), `processDay()` filters the day's simulation — opponent AI input, per-state support updates, and the weighted national-support delta — down to just the selected negeri; other states receive no `stateUpdates` entry that day. The War Room itself reflects this with dedicated UI: a "PRN COMMAND BRIEFING" panel, a seat-distribution donut driven by the state's real DUN (state assembly) seat count (`StateData.dunSeats`, a new field on every state) instead of the national 222, a daerah/constituency-level breakdown table (`generateConstituencies()` scoped to that one state) replacing the multi-state summary table, a map locked to that single state, and live news/opponent intel filtered to state-relevant items only (`newsMatchesElectionScope()` in `app/data/liveNews.ts`, using a state-name alias table). Nomination, mini-games, and operation deployment (`DeployModal`) all restrict their target-state pickers to the PRN state as well. **The gap that remains:** `computeElectionOutcome()` (§3.3) and everything downstream of it (`/mandate` through `/sandbox`) are not PRN-aware — they always compute the national 222-seat / 112-majority outcome regardless of `electionScope`, so a PRN campaign still resolves into the full national storyline at Results time rather than a standalone state-government outcome.

### 3.3 Results (`/results`)

Once `day >= totalDays` (30), the War Room's action button becomes `VIEW RESULTS`, navigating here. This page (and everything downstream) uses `computeElectionOutcome()` (`app/utils/electionOutcome.ts`), which:

1. Generates a deterministic, seeded constituency list per state (`generateConstituencies()`, `app/data/constituencies.ts`) — seat count matches `state.seats`, each constituency's mandat/lawan/others % is the state aggregate ± seeded per-seat variation.
2. Counts constituency winners by simple percentage comparison (no simulated vote totals at this stage).
3. Classifies the outcome by total seats won against fixed thresholds (`MAJORITY = 112` of `TOTAL_SEATS = 222`):
   - `seatsWon ≥ 112` → **majority** ("MANDAT JELAS / CLEAR MANDATE")
   - `seatsWon ≥ 89` → **hung** ("PARLIMEN TERGANTUNG / HUNG PARLIAMENT")
   - `seatsWon ≥ 40` → **opposition** ("PEMBANGKANG KUAT / STRONG OPPOSITION")
   - else → **collapse** ("MANDAT DITOLAK / MANDATE REJECTED")

Buttons: `RETURN TO MENU` (resets game), `NEW CAMPAIGN` (resets, back to `/setup`), and `♛ SAHKAN MANDAT` ("Confirm Mandate") which pushes to `/mandate` without resetting anything.

### 3.4 Mandate (`/mandate`)

A pure classification/branch screen: shows the verdict, seat/majority/LAWAN/others tallies, national support and states won/lost, then a single CTA button whose destination and label depend on `outcome.status`:

| Status | Route | Button |
|---|---|---|
| majority | `/formation` | SAHKAN MANDAT DI ISTANA / CONFIRM MANDATE AT PALACE |
| hung | `/formation` | RUNDING KOALISI / NEGOTIATE COALITION |
| opposition | `/opposition` | BENTUK SHADOW CABINET / FORM SHADOW CABINET |
| collapse | `/postmortem` | POST-MORTEM PARTI / PARTY POST-MORTEM |

### 3.5 Formation (`/formation`)

Coalition negotiation vignette. Three fixed potential partners (Borneo Bloc +18 seats, Centrist Alliance +14, State Parties +9, each with a stability rating and a flavor demand) can be toggled on/off; `coalitionSeats = outcome.seatsWon + sum(selected partner seats)`. A `confidenceScore` is derived from coalition-seats-vs-majority ratio, leader negotiation stat, and partner stability average. `canForm = coalitionSeats ≥ 112` decides whether the CTA routes to `/cabinet` (FORM CABINET) or `/opposition` (ENTER OPPOSITION).

### 3.6 Cabinet (`/cabinet`)

The most mechanically real of the post-election screens. Cabinet capacity (number of DPM/minister slots) scales with `seatsWon` (`getCabinetCapacity`). Each `PartyMember` can be assigned to a `CabinetPost`; `scoreAssignment()` fit-scores a member against a post (specialty match, experience, influence, credibility, some charisma). An **AI Advisor auto-fill** greedily assigns the best-fit unused member to each post. A live "Kesan Kabinet / Cabinet Effects" panel (`getCabinetGameplayEffects()`) derives:

- **Funds** from Finance + Trade minister fit scores
- **Media** from the Communications minister's fit score
- **Stability** from DPM(s) + Home Affairs + Defence fit scores
- **Trust** from Education + Health + Women/Family + Youth fit scores
- **Scandal risk** from the average fit score across all appointments plus a penalty per "weak" (<65) appointment

`SWEARING-IN` is only enabled once `canFormGovernment` (`seatsWon ≥ 112`) is true.

### 3.7 Swearing-in (`/swearing-in`)

A short cinematic confirmation screen — shows a fixed "key lineup" of PM/DPM/Finance/Home/Education/Health ministers (mapped from the first 6 `PARTY_MEMBERS`, not necessarily the player's actual cabinet picks — see §6) and a `cabinetScore` derived from seats won + leader credibility. Single CTA to `/government` ("Start First 100 Days").

### 3.8 Government (`/government`)

The "governing" simulation vignette: recomputes seats via an independent constituency-level vote simulation (`computeMandatSeats()` — see §6 duplication note), then presents:

- **5 selectable policy cards** (Cost of Living, Youth Jobs, Anti-Corruption, Rural Infrastructure, Federal-State Compact), each with a funds cost and approval/stability/trust deltas.
- **A crisis room** cycling through 4 fixed crises (living cost, flood, coalition demands, minister scandal), each a binary choice with its own approval/stability/trust deltas.
- Composite indices: `approval`, `publicTrust`, `coalitionStability`, `fiscalSpace` (funds minus policy cost), all clamped 0–100 and derived from national support + leader stats + the above choices.

If `seatsWon < MAJORITY` (e.g. reached here directly via cold navigation without going through formation), shows a "Government Not Formed" blocking state instead.

### 3.9 Career (`/career`)

The "multi-term" meta-layer. A `month`/`term` counter (local state, starts at 1/1) advances via an "ADVANCE MONTH +1" button; at month 60 it rolls into a new term and appends a `next-pru` completed action. Five toggleable **Career Actions** (PRN test, by-election machine, party election, government/opposition prep, next-GE narrative) each contribute to four indices:

- **Legacy score** (headline number, seats + accumulated action bonuses)
- **Faction control** (leader negotiation + action bonuses)
- **Party machinery** (leader strategy + action bonuses)
- **Next-GE readiness** (national support + month progress + action bonuses)

Also shows 4 fixed **party factions** (Reformists, State Warlords, Youth Wing, Borneo Bloc) with a loyalty number nudged by `factionControl`, and PRN/PRK electoral-risk meters. Branches by `isGovernment = seatsWon ≥ MAJORITY`: government-survival framing vs opposition-comeback framing — this is the shared hub that `/government`, `/opposition`, and `/postmortem` all route into.

### 3.10 Sandbox (`/sandbox`)

The "full Malaysia" long-horizon layer. Six toggleable **national policy levers** (targeted subsidy, MA63/Borneo autonomy, MACC/anti-corruption reform, media freedom charter, regional investment corridor, parliament reform), each with cost and Economy/Federal-State/Parliament/Institutions/International deltas. A `nationalStability` composite (average of the 5 metrics) selects one of 4 narrative **scenarios** (Stable Reformist Malaysia / Fragile Coalition / Economic Pressure / Competitive Sandbox) via simple threshold rules. Also shows strongest/weakest states by `mandatSupport` and a 3-line "alternate history log" (static flavor text, doesn't change with lever selection).

### 3.11 Opposition (`/opposition`)

Reached after a failed formation or an "opposition" mandate verdict. Three toggleable strategies (shadow cabinet, parliamentary pressure, target by-elections/PRN) each add to a `comeback` index (base 35 + seats/3 + 8 per active strategy). Routes onward to `/career`.

### 3.12 Postmortem (`/postmortem`)

Reached after a "collapse" mandate verdict. Four toggleable reforms (leadership challenge, audit toxic candidates, party rebrand, recruit young leaders) each add to a `survival` index (base 18 + seats + 12 per selected reform). Routes onward to `/career`.

---

## 4. Cross-cutting systems

**Datasets** (`app/data/datasets.ts`): `dummy` (fictional MANDAT/LAWAN/etc.) and `real-malaysia` (real party names — UMNO, PKR, DAP, AMANAH, BERSATU, PAS, GPS, GRS, etc.) — both datasets carry simulated, not real, support numbers. Selected once at setup and does not change mid-game.

**Difficulty**: sets `oppositionStrength` (0–100) and a difficulty multiplier (0.45/0.72/1.1/1.55) that both scale directly into `runOpponentAI()`'s aggression. This is the one setting with a clear, traceable mechanical effect.

**Save/load** (`app/store/saveGame.ts`): up to 5 slots in `localStorage`. `SavedGameSnapshot` only captures `phase, dataset, nominations, day, totalDays, leader, resources, states, operations, alerts, lastEvent, selectedStateId, difficulty, mediaSentiment, settings` — i.e. exactly the pre-election War Room state. `load-game/page.tsx` always routes back to `/warroom` after loading. See §6 for what this implies about the post-election storyline.

**i18n**: every screen has parallel Malay (`MS`) / English (`EN`) strings via `t(lang, ms, en)`; default language is `ms` (`useUIStore`).

**Political reactions** (`app/data/politicalReactions.ts`): a separate, append-only log (persisted to its own `localStorage` key, capped at 30 entries, re-hydrated into the War Room on mount via `readPersistedPoliticalReactions()`) of narrative blurbs generated from nomination, candidate-fallout (`candidate_fallout` action type), and campaign-tactic choices. Feeds UI flavor panels; the narrative text itself is not consumed by the simulation engine, but the fallout variant's *support deltas* (`applyCandidateFallout`) are a real, persisted store mutation — see §3.2.

**Navigation pending-state** (`app/hooks/usePendingNav.ts`): wraps `router.push` in a React transition so CTA buttons (War Room's "VIEW RESULTS", Results' "RETURN TO MENU"/"SAHKAN MANDAT"/"NEW CAMPAIGN") show a disabled "LOADING..." state until the destination page has actually mounted, instead of looking unresponsive during heavy page transitions. Presentation-only; no gameplay effect.

---

## 5. Key constants

| Constant | Value | Source |
|---|---|---|
| Total Parliament seats | 222 | `electionOutcome.ts` |
| Majority threshold | 112 | `electionOutcome.ts` |
| Hung-parliament floor | 89 seats | `electionOutcome.ts` |
| Opposition floor | 40 seats | `electionOutcome.ts` |
| Campaign length | 30 days | `electionFlow.ts` (`TOTAL_ELECTION_DAYS`) |
| Nomination day | Day 15 | `electionFlow.ts` |
| Campaign period | Day 16–29 (14 days) | `electionFlow.ts` |
| Polling day | Day 30 | `electionFlow.ts` |
| Attribute point budget (setup) | 450 across 5 stats, 1–100 each | `setup/page.tsx` |
| Difficulty → opposition strength | easy 40 / normal 60 / hard 80 / nightmare 95 | `setup/page.tsx` |
| Difficulty → AI multiplier | 0.45 / 0.72 / 1.1 / 1.55 | `opponentAI.ts` |
| Career term length | 60 months | `career/page.tsx` |
| Max save slots | 5 | `saveGame.ts` |

---

## 6. Notes for improvement analysis

Factual, code-verified observations about how the systems relate to each other — not recommendations, since a separate backlog (`docs/my-mandat-improvement-suggestions.md`) already exists for that.

1. **The simulation is front-loaded.** Only the War Room phase (`processDay`, `runOpponentAI`, nomination, mini-games) mutates the shared Zustand store in ways that compound day-over-day. Everything from `/formation` onward (formation, cabinet's *effects panel* specifically, swearing-in, government, career, sandbox, opposition, postmortem) computes its scores from **local `useState`** seeded by the frozen election outcome and static leader stats. Toggling a policy/lever/action changes a number on that screen only; it is not written back to the store, does not persist across navigation, and is not read by any other screen. Two consequences:
   - Leaving and returning to `/career` or `/government` resets `month`/`term`/selected policies/selected levers to their initial defaults.
   - The player's cabinet appointment quality (`getCabinetGameplayEffects` — funds/media/stability/trust/scandal risk) is displayed on `/cabinet` but never referenced again on `/swearing-in`, `/government`, `/career`, or `/sandbox` — those pages derive `approval`/`stability`/`trust`-shaped numbers independently from `leader` attributes and seat count instead.
   - `/swearing-in`'s "key lineup" shows the first 6 entries of `PARTY_MEMBERS` by post ID, not the member IDs the player actually assigned on `/cabinet`.

2. **Save/load only covers the War Room phase.** `SavedGameSnapshot` has no field for career term/month, cabinet assignments, government policy choices, or sandbox levers — because none of that lives in the store (see #1). `load-game` always resumes at `/warroom`. A player who saves after reaching `/government` or `/career` has no way to resume there; the post-mandate storyline is effectively single-session.

3. **Seat-count is computed by three independent, near-duplicate formulas** that happen to agree numerically but are separately written and maintained:
   - `computeElectionOutcome()` (`utils/electionOutcome.ts`) — compares constituency mandat/lawan/others percentages directly.
   - `computeMandatSeats()` in `government/page.tsx` — simulates registered voters, turnout %, and vote counts from the same percentages, then compares vote counts.
   - `computeMandatSeats()` in `career/page.tsx` — an identical copy of the government-page version.
   Because all three ultimately compare the same underlying percentages against the same total, they always produce the same winner per seat — but this is coincidental to the math, not enforced by shared code, so `/results`/`/mandate` and `/government`/`/career` could silently diverge if either formula's constants are tuned independently in the future.

4. **Several setup/settings fields are captured but never read by the simulation:**
   - `economicIdeology` / `socialIdeology` sliders (step 2 of setup) — stored on `leader.ideology`, never referenced by `processDay`, `runOpponentAI`, or any downstream screen.
   - `regionPeninsular` / `regionSabah` / `regionSarawak` toggles (step 2 of setup) — local component state only, never passed to `updateSettings` or used in `handleLaunch`.
   - `settings.campaignLength` (editable on `/settings`) and `settings.realisticPolls` (editable on `/settings`) — both are read/written by the settings UI but never consumed by `electionEngine.ts` or anywhere else.

5. **The War Room's daily seat projection and the election-night constituency count use different math.** `processDay()` projects seats with a heuristic win-share formula (`0.5 + margin/100 + 0.08`, applied to a state's total seats) for the live War Room display, while `computeElectionOutcome()` (used at `/results` onward) generates actual per-seat winners from seeded constituency variation. The two are not required to agree — the War Room's live seat counter is an approximation that can differ from the final declared result the player sees at `/results`.

6. **PRU vs PRN scope is now real during the War Room, but not beyond it.** As of this update, `electionScope`/`prnStateId` genuinely restrict `processDay()`'s simulation, opponent AI, news feed, and nomination/mini-game/deploy targeting to the single selected negeri (see §3.2 for the full breakdown) — this closes what was previously a cosmetic-only gap. The remaining gap: `computeElectionOutcome()` (`utils/electionOutcome.ts`) still unconditionally computes the national 222-seat / 112-majority outcome with no branch on `electionScope`, so a PRN campaign's War Room phase is scoped correctly but its Results/Mandate/Formation/Cabinet/... outcome is not — there's still no PRN-specific single-state win condition downstream of `/warroom`.

7. **`electionFlow.ts`'s 10-stage procedural timeline** (dissolution → EC date → writ → nomination → campaign → cooling-off → polling → counting → results → government formation) is real Malaysian PRU procedure and is shown as reference/flavor text on the War Room's timeline panel, but the actual playable loop is a flat 30-day counter — none of the individual procedural stages gate or unlock gameplay beyond the nomination-day/campaign-day math already baked into `getElectionFlowStatus()`.
