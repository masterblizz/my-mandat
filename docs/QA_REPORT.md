# My Mandat — QA Report

**Date:** 2026-07-03  
**Scope:** Static checks (typecheck/lint/build) + Phase A cold route load + Phase B full interactive playthrough  

## Summary

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ PASS — no type errors |
| `next lint` | ✅ PASS — 0 errors, 7 pre-existing `<img>`→`next/image` warnings only |
| `next build` (production) | ✅ PASS — all 24 routes compile & prerender |
| Phase A — cold route load (21 routes) | ✅ 21/21 PASS |
| Phase B — interactive playthrough (18 steps) | ✅ 18/18 PASS |

**No bugs found.** Full player journey — setup wizard → war room (30 campaign days) → results → mandate → formation → cabinet → swearing-in → government → career → sandbox — completed with zero console errors and zero page crashes.

### Known coverage gap

The automated playthrough (Phase B) only exercised the **majority-government** storyline branch, since the AI-driven 30-day campaign happened to land a majority for the dummy dataset. The `/opposition` and `/postmortem` branches (reached when the mandate outcome is "opposition" or "collapse" instead of "majority"/"hung") were verified only via **Phase A cold load** — they render without crashing on an empty store, but their in-context interactive flow (career hub hand-off, shadow cabinet, etc.) was not driven end-to-end. Re-run `node scripts/qa-full-game.js` on a `hard`/`nightmare` difficulty setup to exercise those branches if a losing run is needed.

---

## Phase A — Cold Route Load

Each route hit directly via URL with a fresh (empty) game store — catches crashes on screens that assume an active game exists.

| Route | Result | Detail |
|-------|--------|--------|
| Root redirect | ✅ PASS ([screenshot](qa-screenshots/cold-root-redirect.png)) | HTTP 200 |
| Main Menu | ✅ PASS ([screenshot](qa-screenshots/cold-main-menu.png)) | HTTP 200 |
| Setup / New Game | ✅ PASS ([screenshot](qa-screenshots/cold-setup-new-game.png)) | HTTP 200 |
| War Room | ✅ PASS ([screenshot](qa-screenshots/cold-war-room.png)) | HTTP 200 |
| Campaign (Nomination) | ✅ PASS ([screenshot](qa-screenshots/cold-campaign-nomination-.png)) | HTTP 200 |
| Calendar | ✅ PASS ([screenshot](qa-screenshots/cold-calendar.png)) | HTTP 200 |
| Messaging | ✅ PASS ([screenshot](qa-screenshots/cold-messaging.png)) | HTTP 200 |
| Polling | ✅ PASS ([screenshot](qa-screenshots/cold-polling.png)) | HTTP 200 |
| Stats | ✅ PASS ([screenshot](qa-screenshots/cold-stats.png)) | HTTP 200 |
| Results | ✅ PASS ([screenshot](qa-screenshots/cold-results.png)) | HTTP 200 |
| Mandate | ✅ PASS ([screenshot](qa-screenshots/cold-mandate.png)) | HTTP 200 |
| Formation | ✅ PASS ([screenshot](qa-screenshots/cold-formation.png)) | HTTP 200 |
| Cabinet | ✅ PASS ([screenshot](qa-screenshots/cold-cabinet.png)) | HTTP 200 |
| Swearing-in | ✅ PASS ([screenshot](qa-screenshots/cold-swearing-in.png)) | HTTP 200 |
| Government | ✅ PASS ([screenshot](qa-screenshots/cold-government.png)) | HTTP 200 |
| Career | ✅ PASS ([screenshot](qa-screenshots/cold-career.png)) | HTTP 200 |
| Sandbox | ✅ PASS ([screenshot](qa-screenshots/cold-sandbox.png)) | HTTP 200 |
| Opposition | ✅ PASS ([screenshot](qa-screenshots/cold-opposition.png)) | HTTP 200 |
| Postmortem | ✅ PASS ([screenshot](qa-screenshots/cold-postmortem.png)) | HTTP 200 |
| Load Game | ✅ PASS ([screenshot](qa-screenshots/cold-load-game.png)) | HTTP 200 |
| Settings | ✅ PASS ([screenshot](qa-screenshots/cold-settings.png)) | HTTP 200 |
| State (Selangor) | ✅ PASS ([screenshot](qa-screenshots/cold-state-selangor-.png)) | HTTP 200 |

---

## Phase B — Interactive Playthrough

Drives the real UI: setup wizard -> war room -> 30 campaign days -> results -> mandate -> whichever outcome branch actually occurs (formation/cabinet/swearing-in/government/career/sandbox, or opposition/career, or postmortem/career).

| Step | Result | Detail |
|------|--------|--------|
| Setup loads | ✅ PASS | step 0 (DATA MODE) |
| Launch campaign -> War Room | ✅ PASS | URL: http://localhost:3000/warroom |
| Side panel: Nomination | ✅ PASS | URL: http://localhost:3000/campaign |
| Side panel: Calendar | ✅ PASS | URL: http://localhost:3000/calendar |
| Side panel: Messaging | ✅ PASS | URL: http://localhost:3000/messaging |
| Side panel: Polling | ✅ PASS | URL: http://localhost:3000/polling |
| Advanced through campaign days | ✅ PASS | 29 NEXT DAY clicks |
| Reach Results screen | ✅ PASS | URL: http://localhost:3000/results |
| Results -> Mandate | ✅ PASS | clicked "/MANDAT/i", URL: http://localhost:3000/mandate |
| Mandate -> outcome branch | ✅ PASS | clicked "/SAHKAN MANDAT DI ISTANA|CONFIRM MANDATE AT PALACE/i", branch: /formation |
| Formation -> Cabinet/Opposition | ✅ PASS | clicked "/BENTUK KABINET|FORM CABINET/i", branch: /cabinet |
| Cabinet: swearing-in button state | ✅ PASS | enabled |
| Cabinet -> Swearing-in | ✅ PASS | URL: http://localhost:3000/swearing-in |
| Swearing-in -> Government | ✅ PASS | clicked "/MULA 100 HARI PERTAMA|START FIRST 100 DAYS/i", URL: http://localhost:3000/government |
| Government -> Career | ✅ PASS | clicked "/URUS PENGGAL|MANAGE TERM/i", URL: http://localhost:3000/career |
| Career -> Sandbox | ✅ PASS | clicked "/SIMULASI NEGARA|NATIONAL SIMULATION/i", URL: http://localhost:3000/sandbox |
| No console errors during playthrough | ✅ PASS |  |

---

*Phase A/B generated by `scripts/qa-full-game.js` against `next dev` on 2026-07-03 03:36:36 UTC. Static checks (`tsc`, `next lint`, `next build`) run separately against the same commit.*