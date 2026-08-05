# AGENTS.md — MyMandat Development Standards

This file is mandatory project guidance for any AI/development agent working inside this repository.

## Project identity
- MY MANDAT is a Malaysian political strategy simulator, not a generic dashboard.
- Preserve the tactical War Room visual language: dark HUD, cyan/gold accents, compact panels, scanline/ops-console feel.
- Gameplay is multi-phase: PRU/PRN campaign → results → mandate/formation → cabinet → swearing-in → government/career/sandbox. Do not collapse it back into a single campaign-only flow.

## Language display standard
- All user-facing screens must respect the selected UI language.
- Use the existing language helpers/patterns such as `useLang()` and `t(lang, ms, en)` where available.
- Do not hard-code English labels into BM screens or BM labels into English screens unless the label is intentionally an in-universe tactical term.
- When adding new data that appears in UI, provide Malay and English fields where the surrounding feature is bilingual.
- Verify language-sensitive work in the actual browser, not only by reading code.

## PRU vs PRN standard
- PRU mode uses parliamentary constituencies/seats: `P.xxx`, Parlimen framing, federal-government target language, 222-seat national logic.
- PRN mode uses DUN/state constituencies/seats: `N.xxx`, DUN framing, selected-negeri battlefield, MB/state-government target language, and the state `dunSeats` count.
- Never show parliamentary constituency lists in PRN nomination/setup/campaign flows.
- PRN state picker and War Room must show the selected negeri clearly.
- Wilayah Persekutuan has no DUN; do not treat it as a normal PRN negeri unless a special federal-territory mode is deliberately added.

## Data and identity standard
- Party identity must come from the selected dataset party. Do not hard-code `MANDAT`, `Parti Mandat MY`, or a fixed player-party colour when a selected party exists.
- Keep fictional/dummy datasets clearly separated from real Malaysia political-name datasets.
- If gameplay numbers use real party names, keep numbers clearly simulated/fictional.
- Candidate/profile images must be one unique portrait per profile; do not reuse contact sheets or duplicate portraits silently.

## Gameplay implementation standard
- Implement real state/store/gameplay effects, not UI-only descriptions.
- New actions should mutate the game state where appropriate: support, resources, nominations, alerts/news, reactions, cabinet/government metrics, or save data.
- Candidate nomination must use named party members; “local” is a relationship/status, not a generic unnamed candidate type.
- AI Advisor/bulk actions must preserve existing player choices unless explicitly designed as replace/overwrite.

## Save/load and persistence standard
- Save/load must use the existing typed save/persistence modules and store hydration patterns.
- Autosave rewrites the active slot; it must not create a new save slot on every state change.
- New persisted settings must be added to defaults, reset paths, hydration, save snapshot typing, setup UI, settings UI, and visible summary/status labels.

## UI/UX standard
- Implement changes in the real app screens, not mockups only.
- Keep layouts compact and screenshot-safe: no clipped text, cropped borders, hidden buttons, or overlays blocking clicks.
- Primary navigation and setup action buttons must remain user-clickable; if DOM `.click()` works but a real browser click fails, it is still a bug.
- Scrollbars, sliders, toggles, and HUD controls should match the tactical theme.
- Avatar/player portrait should remain visible on major game screens when relevant to the current flow.

## Verification standard
Before reporting completion, run real verification:
- `npx tsc --noEmit --pretty false`
- `npm run build` when the change affects app code
- Browser verification with real clicks for UI/gameplay changes
- Screenshot proof for visual/UI changes when possible

If a dev server or build fails with stale Next.js chunk/cache errors, stop stale dev processes, delete `.next`, restart/rebuild, and re-test before assuming app logic is broken.

## Development hygiene
- Use targeted edits and keep source-of-truth logic centralized in typed data/store modules.
- Do not scatter duplicated constants across screens.
- Search for old hard-coded labels/counts after changing a lifecycle setting such as campaign duration, election scope, party identity, or save format.
- Do not leave placeholder text/data in production flows unless clearly marked demo-only.
- Do not fabricate test/build/browser results; report actual command output and blockers honestly.
