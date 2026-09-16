# MY MANDAT — Actual Game Flow (as implemented, Sep 2026)

This is a factual map of how the app currently navigates between screens, derived
by reading every `app/**/page.tsx` route and its `router.push`/`router.replace`
calls, entry guards, and store reads/writes. It reflects the *code as it exists
today*, not the older design docs (`GAME_DESIGN.md`, `GAME_DESIGN_DOCUMENT.md`,
`docs/GAMEPLAY_AND_STORYLINE.md`), which predate a lot of this and may have
drifted. Use this as the baseline for the restructure discussion.

Global note: every gameplay screen renders `<Header />`, which supplies
"← BACK" (`router.back()`), "← MAIN MENU" (`/menu`), and "WAR ROOM HOME"
(`/warroom`) — these aren't repeated per-route below unless a route does
something extra.

---

## 1. Auth gate (middleware.ts)

`middleware.ts` redirects **every** route except `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/auth/callback` to `/login` if there's
no Supabase session. Nothing else in the app does its own auth check — it's
all centralized here.

```
/login    ──success──> /  (then / redirects to /menu)
          ──"Sign in with Google"──> Supabase OAuth ──> /auth/callback ──> /
          ──"Forgot Password"──> /forgot-password
          ──"Register Now"──> /register

/register ──success (session issued)──> /
          ──success (email confirm required)──> stays, link to /login
          ⚠ on ANY successful signup, unconditionally wipes local game data:
            resetGame() + clearHistory() + clearAllSavedGameData()

/forgot-password ──email sent──> shows "sent" screen, link to /login

/reset-password ──success──> /login (after 2s)
                 (no session on load ⇒ inline error, page stays up — no redirect)
```

## 2. Landing → main menu

```
/  (root)
  sessionStorage["mymandat-opening-seen"]==="1" ──> router.replace("/menu")  [immediate]
  else ──> plays IntroVideo ──onComplete──> sets the flag, router.replace("/menu")

/menu  (hub — stats display, election status, primary menu list)
  "New Campaign"      ──> /setup
  "Daily Challenge"   ──> seeds a deterministic run (resetGame + setDataset/
                          setLeader/setNomination/settings/startCampaign) ──> /kawasan
  "Continue"          ──> loads latest/active save ──> /kawasan
                          ⚠ disabled unless a save exists; its configured href
                          says /warroom but the click handler actually targets
                          /kawasan
  "Load Game"         ──> /load-game
  "Settings"          ──> /settings
  "Stats"             ──> /stats
  "Credits"           ──> opens modal in place, no navigation
  "Quit"              ──> supabase.auth.signOut() ──> /login
```

```
/setup  (6-step new-campaign wizard: dataset → leader/party → campaign
         settings [incl. PRU/PRN scope] → seat nomination → difficulty → confirm)
  "LAUNCH CAMPAIGN"   ──> resetGame, setActiveSaveSlot(null), setDataset/
                          setLeader/setNomination/settings/selectedState,
                          setPhase("playing") ──> /kawasan
  Stripe Checkout (premium PRN scope / Nightmare difficulty) happens out-of-band;
  ?purchase=cancelled query param shows a toast on return.

/load-game
  "MAIN MENU"         ──> /   (which re-gates to /menu)
  "LOAD SLOT"          ──> loads slot into gameStore, phase:"playing" ──> /kawasan

/purchase-confirmation  (Stripe return landing, polls /api/purchase-status)
  success ──> /setup
  error   ──> /menu
  timeout ──> full page reload (not a route change)

/settings  (tabbed: Gameplay/Audio/Display/Controls/Notifications/Language/About)
  no outgoing navigation — read/write gameStore.settings + uiStore directly,
  left via the global Header only.

/trailer  (20s scripted marketing/demo player — NOT linked from anywhere in the
           mapped flow; reachable only by direct URL. "← BACK" ──> router.back())
```

## 3. Core campaign loop

`/warroom` is the only screen that calls `advanceDay()` — the entire
simulation's day-tick lives there and nowhere else.

```
/warroom  (hub: day counter, national polls, news/opponent feed, resources,
           the "advance day" control)
  persistent nav bar ──> /menu, /campaign, /polling, /messaging, /calendar, /advisor
  "SEAT"              ──> /kawasan
  state click         ──> /state/[id]           (per-state drill-down)
  "◇ RESULTS"         ──> /results

/kawasan  (constituency 3D city-builder — City3DMapGL; zones/projects/manifesto)
  "▶ ENTER WAR ROOM"  ──> /warroom
  "GOVERNMENT"        ──> /government   (button disabled + 🔒 until hasWonElection)

/campaign  (Campaign HQ — tabs: nomination / mini-games / operations / volunteers
            / resources / schedule / messaging; tab switch is local state only)
  Schedule tab  "VIEW FULL SCHEDULE"     ──> /calendar
  Messaging tab "VIEW MESSAGING CENTER"  ──> /messaging

/polling    (read-only analytics dashboard — no outgoing nav, Header only)
/messaging  (message/channel deployment — no outgoing nav, Header only)
/calendar   (schedule viewer — no outgoing nav, Header only; event data here is
             a local hardcoded array, not live gameStore data)
/advisor    (AI advisor chat, falls back to offline canned Q&A if /api/advisor
             is unavailable — no outgoing nav, Header only)
/stats      (past-playthrough history table — reached from /menu; driven by
             historyStore, NOT gameStore — the one screen outside the live loop)
```

Dev/orphan routes physically under this section but **not part of the real
loop**:
- `/kawasan-3d` — a "Phase 0 spike" sandbox per its own header comment; the
  real WebGL map already shipped and is used live inside `/kawasan` (via
  `app/kawasan-3d/City3DMapGL.tsx`, a *component*, not this page). This page
  route is stale.
- `/sandbox` — dev/test route; only action is a "← [legacy map]" link to
  `/career`. Purpose unclear from the file alone.
- `/agent` — unrelated internal dev tool (password-gated coding-agent runner
  hitting `/api/agent/run`). No game state, no relation to the simulation.

## 4. Election night → branching

```
/warroom "RESULTS" ──> /results

/results  (animated seat reveal; ALWAYS writes a historyStore record on mount)
  "RETURN TO MENU"       ──> resetGame() ──> /menu
  "♛ SAHKAN MANDAT"      ──> own seat WIN?  /elected  :  /mandate
  "NEW CAMPAIGN"         ──> resetGame() ──> /setup

/elected  (win-only personal certificate screen)
  guard: own seat not a WIN ──> degraded stub, only exit is "Continue Mandate" ──> /mandate
  win branch: setHasWonElection(true)   ⟵ this is the ONLY thing that unlocks
                                            /kawasan's Government button + /government
  "DEVELOP CONSTITUENCY" ──> /kawasan
  "CONTINUE / CONFIRM MANDATE" ──> /mandate

/mandate  (branch hub — the one screen that reads the full 4-way MandateStatus:
           majority / hung / opposition / collapse, via computeElectionOutcome)
  majority or hung ──> "Confirm/Negotiate" ──> /formation
  opposition       ──> "Form Shadow Cabinet" ──> /opposition
  collapse         ──> "Party Post-Mortem" ──> /postmortem
  "← RESULTS" ──> /results
```

⚠ **Two separate verdict systems**: `/results` computes its own cruder
WIN/KINGMAKER/LOSS locally; `/mandate` independently computes the real 4-way
`MandateStatus` from `computeElectionOutcome`. Both read the same underlying
seat data but never share the computed verdict.

## 5. Government formation → governing → long-term career

```
/formation  (coalition negotiation; canForm = coalitionSeats >= majorityTarget)
  canForm  ──> "FORM {executiveBody}" ──> /cabinet
  !canForm ──> "ENTER OPPOSITION" ──> /opposition
  "← MANDATE" ──> /mandate

/cabinet  (ministerial/EXCO assignment; LOCKED panel in place if
           seatsWon < majorityTarget — no redirect, just a disabled builder)
  "SWEARING-IN" (disabled unless canFormGovernment) ──> /swearing-in
  "← FORMATION" ──> /formation

/swearing-in  (ceremony; always renders regardless of whether gov't was really formed)
  "START FIRST 100 DAYS" ──> /government
  "←" ──> /cabinet

/government  ("First 100 Days" governing hub — policy agenda + crisis events;
              LOCKED panel in place if seatsWon < majorityTarget)
  "DEVELOP CONSTITUENCY" ──> /kawasan
  "MANAGE TERM" ──> /career
  "←" ──> /cabinet

/opposition  (shadow-cabinet hub — reached only via /mandate's opposition branch;
              renders unconditionally, no re-check of actual outcome.status)
  "MANAGE OPPOSITION TERM" ──> /career
  "← MANDATE" ──> /mandate

/postmortem  (collapse/rebuild hub — same no-recheck caveat as /opposition)
  "CONTINUE SURVIVAL" ──> /career
  "← MANDATE" ──> /mandate

/career  (long-term multi-term progression — month/term clock, legacy score,
          faction loyalty, PRN/PRK risk meters)
  "ADVANCE MONTH" ──> LOCAL ONLY: mutates careerProgress (month++, or on month
                       60: term++, month=1, adds "next-pru" to completed) —
                       does NOT navigate anywhere
  "NATIONAL SIMULATION" ──> /sandbox
  "← GOVERNMENT" ──> /government
```

⚠ **Loop-closure gap**: reaching a new GE cycle in `/career` (the "next-pru"
milestone) doesn't route anywhere — there's no visible path back to
`/setup`/`/warroom` for the next election. This looks like a dead end in the
long-term loop as currently wired.

---

## State stores (`app/store/`)

| Store | Role |
|---|---|
| `gameStore.ts` | Single source of truth for almost everything: `states`/seats, `resources`, `day`/`totalDays`, `leader`, `operations`, `settings`, `difficulty`, `hasWonElection`, `governmentProgress`, `careerProgress`, `dailyChallengeDate`, `phase`. `advanceDay()` lives only here, called only from `/warroom`. |
| `uiStore.ts` | Cross-cutting UI prefs: `theme`, `language`, `musicEnabled`/`musicVolume`. Each setter also writes straight to `localStorage` (no zustand persist middleware). |
| `historyStore.ts` | Past-playthrough records (`/stats`). Independent of `gameStore`; wiped alongside it on `/register` signup, and read (not written) implicitly wherever `resetGame()`/`clearHistory()` are called together. |
| `saveGame.ts` | Save-slot CRUD (`/menu` Continue, `/load-game`). |
| `electionEngine.ts` | `computeElectionOutcome()` — the 4-way majority/hung/opposition/collapse verdict used by `/mandate`, `/formation`, `/cabinet`, `/government`. |
| `opponentAI.ts` | Rival-party behavior (opponent log in `/warroom`, threat level in `/advisor`). |
| `campaignMath.ts` | Shared scoring/formula helpers used across `/campaign`, `/warroom`, `/results`, etc. |

---

## Full flow diagram

```
                          ┌────────────┐
                          │ middleware │  no session ⇒ everything → /login
                          └─────┬──────┘
                                │
    /login,/register,/forgot-password,/reset-password (auth-exempt)
                                │ success
                                ▼
                               "/"  ──(intro video / sessionStorage)──> /menu
                                                                          │
        ┌───────────────┬───────────────┬───────────────┬───────────────┼─────────────┐
        ▼               ▼               ▼               ▼               ▼             ▼
     /setup       Daily Challenge    /load-game       /settings        /stats      /login (Quit)
        │            (seeds run)         │
        └───────────────┴─────────────────┘
                        │  launch / load / continue
                        ▼
                    /kawasan  ⇄  /warroom  (the core loop)
                        │              │
                        │      ┌───────┼────────┬──────────┬──────────┐
                        │      ▼       ▼        ▼          ▼          ▼
                        │  /campaign /polling /messaging /calendar /advisor
                        │
                        │ (win own seat, hasWonElection)
                        ▼
                 /government  (locked until majority)
                        │
              warroom "RESULTS" ──> /results
                                        │
                          ┌─────────────┴─────────────┐
                          ▼ (own seat WIN)             ▼ (otherwise)
                       /elected                     /mandate
                    (setHasWonElection)          (4-way branch)
                          │                     ┌────┼────┬────────┐
                          ▼                     ▼    ▼    ▼        ▼
                       /kawasan            /formation  │ /opposition /postmortem
                                                │       │      │         │
                                          /cabinet      │      │         │
                                                │        (hung also → /formation)
                                          /swearing-in   │      │         │
                                                │        │      │         │
                                          /government ◄──┘      │         │
                                                │                │         │
                                                └────────┬───────┴─────────┘
                                                          ▼
                                                       /career  ──> /sandbox
                                                          │
                                                   (advanceMonth loops
                                                    month/term locally —
                                                    no route back to /setup)
```

---

## Open questions / inconsistencies worth deciding on before restructuring

1. **`/menu`'s "Continue" label/target mismatch** — configured href reads
   `/warroom`, click handler actually pushes `/kawasan`.
2. **Two independent election verdicts** — `/results` (WIN/KINGMAKER/LOSS,
   local calc) vs `/mandate` (majority/hung/opposition/collapse, via
   `computeElectionOutcome`) compute different classifications from the same
   seat data in different files.
3. **`/kawasan-3d/page.tsx` is a stale dev spike** — the real 3D map already
   lives inside `/kawasan` via the `kawasan-3d/` *component* folder. This page
   route itself appears to be dead.
4. **`/sandbox`'s relationship to `/career`** — only action is a "legacy map"
   link back to `/career`; unclear if this is a real feature or a leftover.
5. **Career loop has no route back to a new election** — `advanceMonth()`
   reaching "next-pru" doesn't navigate anywhere. Either a screen is missing,
   or there's a mechanism elsewhere not caught by this pass.
6. **Locked panels instead of redirects, everywhere** — `/cabinet`,
   `/government` (and `/kawasan`'s Government button) all show a
   disabled/locked state rather than redirecting when prerequisites aren't
   met. Consistent pattern, but means these routes are reachable pre-election
   by direct URL and just show a stub — worth deciding if that's desired.
7. **`/opposition` and `/postmortem` don't re-verify `outcome.status`** — they
   render unconditionally once reached via `/mandate`, so a direct URL visit
   shows the screen regardless of actual game state.
8. **`/trailer`, `/kawasan-3d`, `/sandbox`, `/agent`** are not part of the
   player-facing flow at all (marketing tool, dead spike, unclear dev route,
   internal coding-agent runner) but live under the same route namespace as
   the game.

This document describes the code as it stands — none of the above are framed
as bugs, just facts to react to. Mark up whichever parts you want changed and
we'll scope the restructure from there.
