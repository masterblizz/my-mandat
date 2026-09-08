# kawasan-3d WebGL migration log

Running log for the Phase A–F migration work on `app/kawasan-3d/*`
(`City3DMapGL`, three@0.169.0 / @react-three/fiber@8.18.0 /
@react-three/drei@9.114.0). Newest entries at the bottom of each phase's
section is not the convention here — entries are appended in the order the
work happened, phase by phase.

## Before starting: state of the world

This route was **not a blank slate**. `app/kawasan-3d/` already contained a
fairly complete R3F rewrite from prior sessions (see the git log — "organic
lit-window map", "sidewalk paver texture", "deterministic per-instance
footprint jitter", "gabled roofs", etc.):

- `cityData.ts` — ported layout/zone/building data layer, `MODEL_MAP`
  (BType → `/models/*.glb`), `BUILDING_COLOR` fallback palette, TOD_ENV
  day/dusk/night environment tables, camera constants.
- `models.tsx` — `useModelAvailability()` (manifest-driven, one HEAD-check
  request instead of one per type), `InstancedModel` (GLTF normalisation:
  mesh-merge, recentre, non-uniform scale-to-footprint) with automatic
  fallback to `InstancedBoxes`, and a shared height-tween (`useHeightTween`)
  used by both the box and model instancing paths.
- `scenery.tsx` — day/dusk/night sky+fog+lights, rain, street lamps with a
  handful of real point lights, instanced traffic, an elevated LRT with a
  station and a shuttling train, and zone beacons (landmark + celebration).
- `CameraRig.tsx` — a bespoke orbit rig matching the CSS version's
  `rz`/`rx`/`zoom` interaction model exactly (not drei's `OrbitControls`).
- `City3DMapGL.tsx` — the drop-in component with the **exact prop
  signature** of the CSS `<City3DMap>`, HUD chrome (legend, controls,
  minimap, perf readout).
- `Scene.tsx` / `Kawasan3DView.tsx` / `page.tsx` — an isolated `/kawasan-3d`
  sandbox route with demo data and the four density-preset chips
  (Rural 6×6 / Semi-urban 8×8 / Metro 10×10 / Dense metro 12×12) — these
  chips are what the verification harness below drives.

So **Phase A/B's core ask (BType→model mapping, graceful box fallback,
instancing preserved, deterministic jitter) was already built and working**.
`public/models/` is empty except `README.md` + `manifest.json` (`"models":
[]`), exactly the "sparse is expected" case the brief anticipated — the
whole pipeline is exercised end-to-end on the box-fallback path with zero
GLBs present. Phase A below is therefore a verification + one deliberate
extension (variant selection, which did not exist yet), not a rebuild.

## Infrastructure set up before Phase A

Two things the brief assumed existed did not, so I built them first:

1. **No Playwright/SwiftShader headless harness existed in the repo.** The
   `verify` skill only covers driving pages generically; nothing wired
   Chromium to software-render WebGL. Built
   `scripts/kawasan3d-verify.mjs`: launches Chromium with
   `--use-gl=angle --use-angle=swiftshader`, drives the four density chips
   on `/kawasan-3d`, screenshots each, and reads the in-app perf HUD
   (fps / draw calls / triangles). Re-run after every phase with
   `NODE_PATH=./node_modules node scripts/kawasan3d-verify.mjs --tag <phase>`.
   It does a full unmeasured warm-up lap over all four densities first
   (shader compilation under SwiftShader is slow enough to skew a
   first-touch sample by 2-4x) before the timed pass.

2. **`npm run build` requires auth.** `middleware.ts` (uncommitted local
   work, not part of this task) now gates every route behind Supabase
   login when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are set, which they are
   in `.env.local`. Rather than touch `.env.local` or any committed file,
   the verify dev server is launched with those two vars overridden empty
   on the process env (`NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY=
   npm run dev -- --port 3177`) — Next.js never lets `.env.local` overwrite
   a var already present in the process environment, so this reliably
   drops the app into the middleware's "no Supabase configured" bypass for
   this one throwaway dev server only. Nothing under version control
   changes.

**Important caveat on the fps numbers in this log**: headless Chromium here
has no GPU, so everything renders through SwiftShader (a full software
rasterizer). Absolute fps in this log (single digits) is **not**
representative of the real hardware-accelerated experience the game ships
with — do not read "5 fps" as "the game runs at 5 fps." What these numbers
*are* good for is **relative regression tracking**: if Dense metro's fps
(or draw calls / triangle count) craters phase-over-phase, that is a real
signal a change got more expensive, even though the absolute number is a
software-rendering artifact. The brief's "30+ fps" bar is a real-hardware
target; I track it here as "did this phase change the trend line," and
flag explicitly (not silently) if I ever can't tell the two apart.

### Baseline (pre-Phase-A-extension, current committed state)

Build/lint: both clean (`npm run build` exit 0 after clearing a stale
`.next` — see note below; `npm run lint` → "No ESLint warnings or errors").

`npm run build` note: the very first attempt failed with
`PageNotFoundError` for `/agent`, `/auth/callback`, `/calendar` during
"Collecting page data". Those routes are untouched and exist on disk —
the cause was running `npm run build` concurrently with `npm run dev`
against the same `.next` directory (both processes write build artifacts
there). Stopping dev, `rm -rf .next`, and rebuilding alone fixed it. Not a
kawasan-3d issue; noting it here since it cost time to diagnose and the
`verify` skill's existing gotcha about deleting `.next` almost covers this
case but doesn't mention the concurrent-process trigger.

| density | fps* | draw calls | triangles |
|---|---|---|---|
| Rural 6×6 | 4 | 73 | 4.0k |
| Semi-urban 8×8 | 8 | 105 | 6.6k |
| Metro 10×10 | 3 | 161 | 12.0k |
| Dense metro 12×12 | 5 | 207 | 19.6k |

\*SwiftShader software rendering — see caveat above.

Screenshots: `docs/webgl-qa-screenshots/baseline-{rural,semi,metro,dense}.png`.
Visual check: all four clean — no z-fighting, no clipping through ground,
box-fallback materials render correctly (no models present, as expected),
minimap/HUD/legend all correct per density.

---

## Phase A — Asset pipeline

**Discovery while committing this phase**: `app/kawasan-3d/` (the entire
directory described above) had never been committed to git — `git status`
showed it as untracked, alongside `public/models/`. The git-log commits
that sound like kawasan-3d work ("organic lit-window map for
tower/skyscraper/antenna", "sidewalk paver texture", "deterministic
per-instance footprint jitter", "gabled roofs") are all on `app/kawasan/
page.tsx`, the **CSS** version — they read like 3D-migration commits
because the WebGL data layer was ported from that same CSS file and the
commit messages describe the same visual features, but they're a different
codebase. So this phase's commit is the *first* commit for `kawasan-3d`
ever, carrying both the pre-existing scaffolding and this phase's actual
new work in one place — I'm calling that out explicitly rather than
letting the diff imply I wrote the whole sandbox harness/camera
rig/scenery pass this session. The repo also has a large amount of
unrelated pre-existing uncommitted state (candidate SVGs, `package.json`,
Supabase client/server changes, `app/kawasan/page.tsx` itself) — none of
that is touched or staged by any commit in this log; every commit here is
scoped to kawasan-3d files only (`app/kawasan-3d/`, `public/models/`,
`scripts/kawasan3d-verify.mjs`, `docs/webgl-migration-log.md`,
`docs/webgl-qa-screenshots/`).

**What was actually missing and built this phase: variant selection.**
The brief asks for "the full BType → model-path mapping and
variant-selection logic," and while the mapping/fallback/instancing existed,
variant selection (multiple looks for the same BType, so a dense grid's
~100 houses don't all look like the same stamped clone) did not. Added:

- `MODEL_VARIANT_COUNT` (`cityData.ts`) — a per-BType variant ceiling for
  the types that repeat most on a dense grid: house/terrace (3 each),
  kampung/shophouse/shop/stall/tower/skyscraper (2 each). Everything else
  stays single-variant. `MODEL_MAP` is now `Partial<Record<BType,
  string[]>>` generated from that count via a naming convention
  (`house.glb`, `house-2.glb`, `house-3.glb`, ...) instead of one bare
  string per type.
- `pickVariantIndex(key, count)` (`cityData.ts`) — a tiny deterministic
  string hash mod variant count, shared by the manifest resolver and the
  scene's instancing grouper so the same building instance always gets the
  same variant (no flicker on re-layout/re-render).
- `useModelAvailability()` (`models.tsx`) now resolves `Map<BType,
  string[]>` (which variant URLs actually exist per type) instead of
  `Set<BType>`, parsing manifest keys like `"house"` (variant 1) and
  `"house-2"` (variant 2) — an unlisted variant is never fetched, so a
  partial rollout (only `house.glb`, not `house-2/3` yet) still produces
  zero 404s, same guarantee the original single-file design had.
- `Buildings()` (`CityScene.tsx`) now splits each type's instances into
  per-variant buckets before instancing, since `InstancedMesh` needs one
  geometry per mesh — this is the one place instancing had to grow an
  extra dimension (type × variant instead of just type), everything else
  about the instancing/fallback/tween machinery is untouched.
- Docs: `public/models/README.md` and `manifest.json`'s `_comment` updated
  to explain the variant naming convention for whoever adds the real GLBs.

**Trade-off**: variant counts (3 for house/terrace, 2 for the rest) are a
judgment call, not derived from anything — picked as "enough to break up
visible repetition at Dense metro without doubling the Suspense/instancing
fan-out for types that don't repeat much." Easy to raise per-type later by
bumping `MODEL_VARIANT_COUNT`; no code changes needed beyond that and
dropping the extra GLB files.

**Oversized-model check (brief's ask)**: N/A this phase — `public/models/`
has no GLB files yet (confirmed empty apart from `README.md` +
`manifest.json`), so there's nothing to flag for Draco compression. Noting
for whenever real files land: `gltf-transform optimize <in>.glb <out>.glb
--compress draco` is the one-line fix if any lands over a few MB; the
README's "hundreds of tris, not thousands" guidance should keep low-poly
kit assets well under that anyway.

**Verification**:
- Smoke-tested the actual GLTF-load → merge → normalise → instance →
  variant-split pipeline with two hand-built synthetic GLBs (a unit box
  each, distinct colours) temporarily dropped in `public/models/` +
  listed in `manifest.json` as `["house", "house-2"]` — confirmed via the
  Playwright harness: canvas rendered, **zero console/page errors**, draw
  calls went from 73→74 at Rural (exactly the expected +1 for the second
  variant's own `InstancedMesh`), and the screenshot shows two distinct
  building colours where "house" used to be a single uniform colour.
  Deleted both synthetic GLBs and reset `manifest.json` to `"models": []`
  before committing — these were throwaway pipeline tests, not real
  assets, and shouldn't ship.
- `npm run build` and `npm run lint`: both clean.
- Playwright pass at all 4 densities (`phaseA-{rural,semi,metro,dense}.png`)
  against the real shipped state (empty manifest): visually identical to
  the pre-phase baseline screenshots — correct, since with zero models
  listed the new variant code is a complete no-op and every type still
  falls back to its box. Draw calls / triangle counts match baseline
  exactly (73/105/161/207 draws, 4.0/6.6/12.0/19.6k tris) — confirms the
  Phase A change added no runtime cost to the current (modelless) shipped
  state.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 4 | 73 | 4.0k |
| Semi-urban 8×8 | 9 | 105 | 6.6k |
| Metro 10×10 | 3 | 161 | 12.0k |
| Dense metro 12×12 | 6 | 207 | 19.6k |

\*SwiftShader, noisy at this magnitude — see caveat at top of this log.
Draw calls / triangles (deterministic, not frame-timing-noise-prone) are
the more trustworthy regression signal here and match baseline exactly.

Committed as: `feat(kawasan-3d): capture WebGL spike + Phase A variant
selection`.
