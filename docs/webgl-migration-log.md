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

## Phase B — Real models wired in

No new work needed. Re-reading the brief's Phase B checklist against what
already exists in `models.tsx`/`CityScene.tsx`:

- **Instancing preserved for repeated types** — yes, one `InstancedMesh`
  per (type, variant) group; Phase A's variant split is the only change
  to this and it's additive (falls back to the old single-group-per-type
  behaviour whenever a type has ≤1 available variant).
- **Deterministic scale jitter** — yes, `jitterFootprint()` in
  `cityData.ts`, unchanged, seeded from `zoneId + slot`.
- **Graceful fallback to box+roof for missing types** — yes,
  `InstancedBoxes` (gabled-roof detail is on the CSS version only per its
  own recent commits; the WebGL box fallback is a plain box, which is
  what "graceful fallback" means here — a box stand-in, not full CSS
  parity). Confirmed still correct by the same Phase A smoke test (the
  two-variant synthetic GLB run implicitly exercises "some instances on
  model, others still on box" since only `house`/`house-2` were listed —
  every other type in that same render stayed on its box fallback with
  zero errors).

Phase A's verification pass (build/lint/screenshots/perf, above) already
covers Phase B's acceptance bar, so no separate commit for this phase —
it's folded into the Phase A commit.

## Phase C — Water shader

**Water.js vs. custom shader — the actual decision and the arithmetic
behind it.** `three/examples/jsm/objects/Water.js` is present and version-
compatible with the pinned three@0.169.0. I did not prototype it, because
the cost model rules it out before that would matter: Water.js implements
its reflection by rendering the whole scene to a texture from a mirrored
camera, once **per Water instance**, every frame. "pond" is not a rare
BType here — `ZONE_BASE.river` always places one, `ZONE_FILLER.river`
(`["kampung", "pond"]`) keeps supplying more as a river-kind zone's density
fill runs, and river-kind zones themselves recur repeatedly once the
developed-zone count passes the 9-archetype base pool (see the cycling
loop in `makeDemoZones`). I instrumented the actual component with a
temporary instance-count log (removed before commit) and read real
numbers off the four density presets: **2 / 6 / 18 / 39** pond instances
at Rural / Semi-urban / Metro / Dense metro respectively. 39 extra
scene-to-texture reflection passes a frame at the perf ceiling density is
not a reasonable price for a decorative pond shimmer, so I went straight
to a custom `ShaderMaterial` (`water.tsx`) rather than spending time
prototyping Water.js only to discard it — the brief's "don't spend
excessive time forcing the addon to work" applies here even before hitting
a compatibility snag, since the constraint that rules it out is a
performance one I could work out analytically.

**What was built**: one `InstancedMesh` (flat plane, rotated to lie on the
XZ ground plane) covering every "pond" instance across the whole grid —
so pond *count* is free, cost-wise; it's always exactly 1 draw call no
matter how many ponds exist. The `ShaderMaterial`:
- Vertex shader manually applies `instanceMatrix` (three.js auto-declares
  the `attribute mat4 instanceMatrix` for any material on an
  `isInstancedMesh` object, whether or not the shader uses the
  `<instancing_vertex>` chunk — confirmed this works rather than assuming
  it, since it's the one part of this file relying on an undocumented-
  feeling three.js internal).
- Fragment shader fakes "reflects its surroundings" cheaply: no actual
  reflection, just tints the water colour toward the current TOD's sky-
  bottom colour (`TOD_ENV[tod].skyBottom`) so day/dusk/night ponds still
  read as belonging to their environment, plus a layered-sine ripple
  field (three overlapping travelling waves, no texture sampling) for
  motion and a `smoothstep`-gated "glint" highlight.
- Re-tints (not re-allocates) on time-of-day change via a `useEffect`
  that mutates the existing uniform's `THREE.Color` in place.

**Trade-off**: this is a deliberately fake reflection (colour-tint, not
geometry-aware). A real screen-space or planar reflection would look
better up close but reintroduces exactly the per-instance cost problem
above (planar reflection still needs an extra camera pass; SSR needs a
G-buffer this pipeline doesn't have set up). Given ponds are a small
background decoration, not a gameplay focal point, colour-tint-plus-
ripple was judged the right fidelity-for-cost point. If ponds ever became
a small fixed number instead of "however many small river zones cycle
to," it would be worth revisiting a single shared low-res reflection
texture for all of them.

**Verification**:
- `npm run build` / `npm run lint`: both clean (build had to be re-run
  stopped-then-alone after I made the mistake of leaving a stray `npm run
  dev` alive while testing — see the recurring `.next`-corruption note in
  the "infrastructure" section above; from this phase on I stop dev,
  clear `.next`, build, then restart dev, strictly sequential).
- Instance-count instrumentation (temporary, removed before commit)
  confirmed `WaterPatches` actually receives pond data at all four
  densities (2/6/18/39, matching the arithmetic above) with zero
  console/page errors.
- Playwright screenshots at all 4 densities
  (`phaseC-{rural,semi,metro,dense}.png`): no z-fighting, no missing
  geometry, no broken materials, camera not clipping the ground. I was
  **not** able to visually pick the water patches out of the wide top-down
  establishing shots at this thumbnail scale with confidence (tried two
  targeted rotate+zoom passes aimed at a river-kind zone and landed on the
  town-centre landmark both times instead) — flagging that limitation
  rather than claiming a visual confirmation I don't actually have. The
  instance-count instrumentation plus the draw-call/triangle accounting
  below is what I'm actually relying on for correctness here, not the
  screenshots.
- Draw calls unchanged phase-over-phase (207 at Dense metro, matching
  Phase A) — expected, since the pond box group (1 draw call) was
  replaced 1:1 by the pond water group (also 1 draw call). Triangles
  dropped slightly (19.6k → 19.3k at Dense metro) — expected too, a plane
  is 2 triangles vs. a box's 12.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 6 | 73 | 4.0k |
| Semi-urban 8×8 | 6 | 105 | 6.6k |
| Metro 10×10 | 6 | 161 | 11.9k |
| Dense metro 12×12 | 3 | 207 | 19.3k |

\*SwiftShader — see caveat at top of log. Draws/tris are the trustworthy
signal here; both track the expected box→water swap exactly.

Committed as: `feat(kawasan-3d): Phase C water shader for pond tiles`.

## Phase D — Vegetation wind sway

**What was built**: `app/kawasan-3d/vegetation.tsx` — instanced grass
blades for "field" tiles and paddy blades for "sawah" tiles, layered ON
TOP of the existing flat colour box for that tile (the box still reads as
the paddy floor / turf underneath; blades are new detail, not a
replacement — chosen specifically to keep this phase additive with zero
risk to the already-working flat-tile rendering). Same cost shape as
Phase C: one `InstancedMesh` per ground-cover type covering every blade
across every tile of that type, so blade *count* is free — always exactly
1 draw call per type regardless of how many sawah/field tiles exist.

- Wind sway is computed **per-vertex** off one shared `uTime` uniform:
  `pos.x += sin(uTime * 2.0 + phase) * 0.5 * heightFraction`, where
  `heightFraction` is 0 at the blade base and 1 at the tip (so the base
  stays planted and the sway grows toward the tip, the standard
  "grass shader" trick) and `phase` comes from the instance's own
  position (`instanceMatrix[3].xyz`) so the sway reads as a wave passing
  across the field rather than every blade bobbing in lockstep. The CPU
  sets each blade's transform once at layout and never touches it again
  — the only per-frame cost is one uniform update.
- Deliberately capped each blade's random Y-rotation to a small ±0.3 rad
  jitter instead of a full 0..2π spread. Sway is applied in the blade's
  *local* space before the instance's rotation is applied, so a blade
  rotated further from "upright" would sway in a more different-looking
  direction — small rotation jitter keeps enough organic variation to
  not look stamped, while keeping the sway direction visually coherent
  across a whole field. (A fully general solution — applying sway in
  world space after the instance transform — was possible but added a
  second matrix-math path alongside Phase C's convention for no visible
  benefit given the jitter is already small; not worth the extra
  complexity here.)
- Exposed a `density` prop (0..1, defaults to 1, scales blades-per-tile)
  specifically so Phase F can gate foliage density by quality tier
  without touching this file again.

**Verification**:
- `npm run build` / `npm run lint`: both clean.
- Playwright screenshots at all 4 densities confirm the intended visual
  change directly (unlike Phase C's water, which I couldn't visually
  pick out of a wide shot) — the Rural screenshot clearly shows small
  green blade specks scattered across what were previously flat solid
  green rectangles; Dense metro shows the same with no z-fighting,
  missing geometry, broken materials, or camera clipping.
- Draw calls rose by exactly **+2** at every density (73→75 Rural,
  105→107 Semi-urban, 161→163 Metro, 207→209 Dense metro) — exactly the
  expected +1 for the sawah InstancedMesh and +1 for the field
  InstancedMesh, confirming the "cost is O(1) draw calls regardless of
  tile count" design held in practice, not just in theory. Triangles
  rose by a modest, expected amount (19.6k→22.3k at Dense metro, +2.7k)
  from the added blade geometry.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 2 | 75 | 4.2k |
| Semi-urban 8×8 | 4 | 107 | 7.2k |
| Metro 10×10 | 6 | 163 | 13.4k |
| Dense metro 12×12 | 5 | 209 | 22.3k |

\*SwiftShader — see caveat at top of log; draws/tris are the trustworthy
signal and both moved by exactly the predicted amount.

Committed as: `feat(kawasan-3d): Phase D instanced vegetation wind sway`.
