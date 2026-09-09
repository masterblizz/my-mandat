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

**Side discovery while starting Phase E**: `package.json`/
`package-lock.json` had `three`, `@react-three/fiber`, `@react-three/drei`
sitting as uncommitted changes this whole time (installed alongside
`app/kawasan-3d` in whatever prior session built it, never committed).
Every commit so far in this log was quietly relying on those being
present in `node_modules` without being declared in the committed
manifest — a fresh `npm ci` would have failed on missing modules despite
the committed source already importing them. Checked the diff was scoped
to exactly those packages (confirmed — nothing unrelated riding along)
and committed it as `fix(kawasan-3d): commit the three/r3f/drei/
postprocessing deps`, bundled with this phase's actual new dependency
(`@react-three/postprocessing`) since both needed the same fix.

**What was built**: `app/kawasan-3d/postfx.tsx` — an `<EffectComposer>`
(from `@react-three/postprocessing@2.19.1`, pinned exact rather than `^`,
since the current `3.x` line requires fiber >=9/react 19 and would break
this repo) added alongside `<CityScene>` inside the existing `<Canvas>`:

- **Bloom**: intensity and luminance threshold both driven by
  `TOD_ENV[tod].winLit + .lamp` (the same day/dusk/night gate already
  used for lit-window and street-lamp emissive intensity) — day stays
  near-threshold-free (high threshold, low intensity) since a bright sky
  has nothing worth blooming, dusk/night lower the threshold and raise
  intensity so the existing emissive windows/lamps pick up an actual
  glow halo instead of just being a flat bright colour.
- **ToneMapping**: ACES Filmic via the `postprocessing` library's own
  `ToneMapping` effect, replacing the Canvas's bare
  `toneMappingExposure` tweak as the sole tone control.
- **SSAO (N8AO)**: gated behind `quality === "high"` from the new
  `quality.ts` scaffold (see below) — **not** shipped unconditionally.
  `defaultQualityForGridSize` currently maps Rural/Semi-urban → "high"
  (SSAO on), Metro → "medium", Dense metro → "low" (SSAO off at the two
  densities that matter most for the perf ceiling).
- `quality.ts` was introduced now (a Phase F concept) specifically
  because Phase E's SSAO needed a real gate on day one rather than a
  throwaway boolean Phase F would have to rip out; it currently only
  drives this one on/off switch; Phase F extends it to shadow resolution
  and foliage density and re-validates the tier thresholds against
  fuller measurements.

**Two real bugs found and fixed while verifying this phase** (both via
the same discipline: don't trust a single "looks fine" signal, cross-check
draw-call/triangle telemetry against actual screenshots):

1. **Perf HUD was silently reporting garbage the instant PostFX mounted.**
   `EffectComposer` renders at r3f priority 1, which also makes it the
   sole thing calling `gl.render()` each frame (r3f defers its own
   auto-render once any priority > 0 callback exists) — and it does so
   several times per frame, once per internal pass. Three.js resets
   `gl.info.render` at the start of *every individual* `render()` call,
   so `PerfProbe` (previously priority-0, reading `gl.info` with no
   coordination) was only ever seeing the LAST pass's numbers — a
   full-screen composite quad, reported as "1 draw, 0 triangles"
   regardless of actual scene complexity. Fixed by setting
   `gl.info.autoReset = false` and moving `PerfProbe` to priority 2 (runs
   after PostFX), so it now reads the frame's *accumulated* total across
   every pass, then manually resets for the next frame. Caught this
   because the very first Phase E screenshot's HUD read "1 draws" and
   that number was obviously wrong for a rendered city, not because the
   number was merely different — a genuinely-lower draw count from an
   optimization would have looked plausible and been easy to miss.
2. **Screenshots came back completely blank for 2 of the 4 densities**,
   alternating (Rural blank, Semi-urban fine, Metro blank, Dense fine) —
   the SAME densities across two independent re-runs, but the *content*
   (draw calls / triangle counts read from `gl.info`, which — per bug #1's
   fix — genuinely reflect what was drawn) was identical and correct both
   times. That ruled out an actual rendering failure and pointed at
   readback: this `<Canvas>` never set `preserveDrawingBuffer`, which is
   fine for continuous rendering (the browser can freely discard the
   backbuffer between frames) but is a known gotcha for anything that
   reads the canvas back at an arbitrary moment — a screenshot, `.toBlob()`,
   Playwright's CDP capture. This never surfaced in Phases A-D because
   nothing was compositing through an extra render-target blit; once
   PostFX's final pass started doing that blit-to-canvas, the window in
   which a readback could catch an already-cleared buffer became real.
   Fixed with `preserveDrawingBuffer: true` on the Canvas's `gl` prop.
   This is worth having correct for more than my own test harness — the
   GDD's improvement-suggestions doc mentions "no share/leaderboard" as a
   gap, and any future "share your city" screenshot feature would hit
   this exact bug the moment it shipped alongside post-processing.

**Verification**:
- `npm run build` / `npm run lint`: both clean.
- Playwright screenshots at all 4 densities, re-verified AFTER both
  fixes above: all four render correctly, bloom/tone-mapping visible as
  a subtle glow/filmic-contrast shift, no z-fighting, no missing
  geometry, no camera clipping.
- Reproducibility check: ran the full 4-density pass twice before
  diagnosing the blank-screenshot bug; identical draws/triangles both
  times at every density, which is what let me conclude the renderer was
  fine and the bug was in readback timing, not rendering.
- Draw calls rose ~40-48 at every density (adding a fixed-size
  post-processing pass chain: Bloom's mip-blur chain + ToneMapping +,
  where active, N8AO) and triangles rose ~50-65% proportionally across
  all four densities. I did not fully root-cause the exact source inside
  `postprocessing`/`n8ao`'s internals of why triangles rose by that much
  even at the two densities with SSAO off (a few full-screen quads alone
  wouldn't explain thousands of extra triangles) — flagging this
  explicitly as unresolved rather than asserting a cause I didn't verify.
  What I did verify directly: the increase is consistent across two
  independent runs, screenshots show no visual artifacts from it, and
  fps did not measurably drop at Dense metro (7 vs. Phase D's 5, within
  this environment's noise band) — so there's no evidence of a real
  regression, just an honestly-reported open question about where the
  extra triangle throughput comes from.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 9 | 114 | 6.4k |
| Semi-urban 8×8 | 8 | 146 | 11.3k |
| Metro 10×10 | 7 | 208 | 21.7k |
| Dense metro 12×12 | 7 | 255 | 36.7k |

\*SwiftShader — see caveat at top of log.

Committed as: `feat(kawasan-3d): Phase E post-processing (bloom, tone
mapping, tiered SSAO)`.

## Phase F — Quality tiers

**What was built**: filled in `quality.ts`'s `QualitySettings` (introduced
as a scaffold in Phase E) with the other two knobs the brief asks for,
and wired both through:

- **Shadow resolution** — `CityEnvironment` (scenery.tsx) now takes a
  `shadowMapSize` prop (default 2048, unchanged behaviour if omitted)
  instead of a hardcoded `[2048, 2048]`. `CityScene` passes
  `QUALITY_SETTINGS[quality].shadowMapSize`.
- **Foliage density** — `Vegetation`'s `density` prop (added in Phase D,
  unused until now) is fed `QUALITY_SETTINGS[quality].foliageDensity`
  through `CityScene` → `Grid` → `Buildings`.
- **Post-processing cost** — `postfx.tsx` now reads `ssao` and
  `bloomMipmapBlur` off the same settings object instead of a hardcoded
  `quality === "high"` check and an always-on `mipmapBlur`.

Tier table: **high** (Rural/Semi-urban) = 2048px shadows, full foliage,
SSAO on, full bloom. **medium** (Metro) = 1536px shadows, 70% foliage,
SSAO off, full bloom. **low** (Dense metro) = 1024px shadows, 45%
foliage, SSAO off, single-level bloom blur. `defaultQualityForGridSize`'s
thresholds (introduced in Phase E) are unchanged — Dense metro's measured
numbers below don't show a case for pushing Metro down to "low" too.

**Two more issues found during this phase's verification** (bringing the
total across Phases E+F to four — see the "why so many" note at the end
of this log):

1. **A `next dev` 500 with "Could not find the module ... in the React
   Client Manifest"** on the first post-Phase-F dev server start. This is
   the exact gotcha the `verify` skill already documents (stale `.next`
   under WSL `/mnt/c`) — not a new bug, just the first time this
   particular manifestation (a 500 with that exact error, rather than a
   plain 404-on-chunks) showed up in this session. Fixed per the
   documented remedy: stop the dev server, `rm -rf .next` while it's
   stopped, restart. Noting it mainly because the fix worked immediately
   and confirms the skill's existing guidance is accurate for this
   failure mode too, not just the one it originally described.
2. **N8AO (SSAO) produced visible dark speckle noise across the sky**
   on Rural/Semi-urban (the two "high"-tier, SSAO-on densities), roughly
   2 out of every 4 captures, with IDENTICAL settings to Phase E (where
   it was never observed) — ruling out anything Phase F changed as the
   cause. Root-cause hypothesis (not fully proven, stated as a hypothesis
   deliberately): this scene's camera has a 40000:1 far:near ratio
   (`near: 1, far: 40000`), which is known to leave depth-buffer
   precision very poor at extreme distances; N8AO reconstructs view-space
   position from that depth buffer, and the sky dome sits at up to 18000
   units out — exactly where precision would be worst. This would explain
   noise concentrated specifically in the far background and its
   intermittent, frame-dependent appearance (small numerical jitter
   flipping the reconstructed position enough to matter only some
   frames). Mitigation applied: dropped N8AO's `screenSpaceRadius` flag
   (a mode documented as more sensitive to exactly this kind of extreme
   depth range) — 3 out of 3 re-verification runs came back clean
   afterward, which is supportive but not conclusive given the issue was
   already intermittent before the fix (I did not run enough trials to
   rule out coincidence with full statistical confidence; treat this as
   "meaningfully improved, not provably eliminated"). This is worth a
   real look on actual hardware before shipping, since real GPUs generally
   have better depth precision than SwiftShader and may not exhibit this
   at all — or might exhibit something SwiftShader doesn't. Did not
   attempt a deeper fix (e.g., excluding the sky dome from AO via
   render layers) given the low severity (cosmetic, background-only,
   only at the two lowest-density tiers) relative to the effort a proper
   fix would take.

**Verification**:
- `npm run build` / `npm run lint`: both clean.
- Playwright screenshots at all 4 densities, confirmed clean (no
  z-fighting, missing geometry, broken materials, camera clipping) after
  both the `.next` fix and the SSAO mitigation above.
- Draws/triangles at Metro and Dense metro dropped vs. Phase E, exactly
  matching the tier cuts: Metro 208 draws / 21.7k→21.3k tris (foliage
  density 100%→70%, ~0.4k fewer triangles, roughly matches expectation),
  Dense metro 255→246 draws / 36.7k→35.0k tris (foliage 100%→45% plus
  losing bloom's mip chain). Rural/Semi-urban are byte-for-byte unchanged
  from Phase E (114/146 draws, 6.4k/11.3k tris) — expected, since "high"
  tier's settings are identical to what Phase E hardcoded.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 4 | 114 | 6.4k |
| Semi-urban 8×8 | 4 | 146 | 11.3k |
| Metro 10×10 | 3 | 208 | 21.3k |
| Dense metro 12×12 | 3 | 246 | 35.0k |

\*SwiftShader — see caveat at top of log.

**On the brief's "30+ fps" bar and the "stop and report" condition**:
I'm flagging this explicitly rather than letting the numbers speak for
themselves, because they could otherwise read as "Phase F failed to fix
it." Dense metro's fps never got close to 30 at ANY point in this migration —
the Phase A baseline (plain box-fallback rendering, before water,
vegetation, or post-processing existed) was already 4-6 fps in this
environment. That is a software-rendering ceiling, not a regression this
migration introduced or a gap Phase F's tiering failed to close: real
GPU hardware renders this same draw-call/triangle load at a completely
different order of magnitude than SwiftShader's full CPU rasterization.
The number that actually matters here — draws/triangles at Dense metro
trending flat-to-down across Phase F (246/35.0k, down from Phase E's
255/36.7k) rather than continuing to climb — is the honest signal I have
access to in this environment, and it says the quality-tier work did its
job. I do not have access to real GPU hardware in this environment to
measure true fps, so I can't respond to the letter of "stop if Dense
metro is still below threshold" — there was never a reading against that
threshold to be below or above. Recommend a real-hardware pass (any
laptop/desktop GPU, even integrated) before treating Dense metro's actual
interactive feel as validated.

Committed as: `feat(kawasan-3d): Phase F quality tiers (shadows, foliage,
post-fx cost)`.

---

## Item 1 — Roads: contrast, a shadow artifact, and real road detail

New session, post-Phase-F. The user gave this as a 4-item follow-up list
(roads / trees / grass-confirmation / procedural buildings); this section
covers item 1, which grew substantially via two follow-up messages sent
mid-work — the log entry below reflects that arc as it actually happened
rather than pretending it was scoped like this from the start.

### 1a — Roads invisible against the ground: colour contrast, not geometry

Investigated the three hypotheses in order, per the brief:
- **Z-fighting**: road planes sit at y=0.8, empty-cell ground at y=0.4,
  zone tiles span y=0-4, the perimeter sheet at y=-1 — all cleanly
  separated, and roads/empty-cells don't spatially overlap (roads run in
  the `ROAD_GAP - PLOT` gaps between plot columns, empty-cell tiles fill
  the plot footprints themselves). No flicker observed. Ruled out.
- **Phase C-F interference (roads accidentally getting grass, etc.)**:
  roads are built directly in `Grid()` as their own plane meshes, entirely
  separate from `Buildings()`/`zoneBuildings()`, which is the only place
  `Vegetation` (Phase D) attaches to `"sawah"`/`"field"` instances. Roads
  can't structurally receive grass. Ruled out by code inspection alone.
- **Colour/contrast**: confirmed. Road colour was `#1b2331`; the default/
  urban `zoneGroundColor()` (the most common zone tile colour, used by
  `"urban"` and as the fallback) is `#1a2530` — within 1-2 RGB units per
  channel, i.e. functionally the same colour. Since both are lit by the
  same TOD lighting, this mismatch holds regardless of time of day (they
  scale together). This was the actual cause.

**Fix**: introduced a named `ROAD_COLOR` constant (`CityScene.tsx`) —
`#5a6270`, a neutral asphalt gray chosen for contrast against every
`zoneGroundColor()` value (all cluster around luminance ~25-37) and kept
deliberately TOD-independent (real asphalt doesn't change hue with time
of day, only its lit brightness). Verified via a before/after crop of the
same road segment at Metro density, and again at dusk/night — roads read
clearly as a distinct light-gray lattice in all three.

### 1b — Floating-road hypothesis: investigated, disproven, real bug found instead

The user's hypothesis (roads drawn across the full square grid while
zones only populate a circular/diamond subset, leaving road segments
suspended over ground-less space) was worth taking seriously, so I
checked the actual generation math before touching anything:

- `emptyCells()` (`cityData.ts`) loops the **full** `gridSize × gridSize`
  square (`row < gridSize`, `col < gridSize`) and fills every cell NOT
  occupied by a developed zone with a plain ground plane. So ground — zone
  tile or empty-cell plane — genuinely exists everywhere within the
  square; there is no literal hole. The "circular cluster" look in the
  minimap is `assignZonePositions()`'s centre-outward fill order painting
  sentiment-tinted colour in the middle and leaving perimeter cells
  neutral gray — a colouring artifact, not a missing-ground one.
- Road plane lengths (`span`, i.e. `worldSize(gridSize)`) are sized to
  exactly match the square's true extent, and `roadsH`'s one extra
  boundary line lands exactly at the last row's far edge, not past it.
  **The hypothesis, as literally stated, does not hold** — verified by
  reading the exact math, not just asserting it.

That said, zooming the camera all the way out (past the developed
footprint, at the user's request to check every zoom level) revealed a
**real** bug in the same area: a field of scattered dark rectangular
blobs fading toward the horizon, well beyond the last road line. Cropped
in and traced it to the perimeter ground sheet (`scenery.tsx`) — a
`span * 8` plane with `receiveShadow` set, while the directional light's
shadow camera frustum only covers `±span * 0.75`. Shadow-map sampling
beyond that frustum clamps to the map's edge texels (three.js's default
wrap mode), which smears the city's own shadow pattern outward across
the oversized plane instead of leaving it unshadowed. This is a shadow-
sampling artifact having nothing to do with road/ground coverage, but it
sat in exactly the region the user was looking at, which is almost
certainly what read as "something's wrong out past the city."

**Fix**: removed `receiveShadow` from the perimeter sheet. Nothing that
casts a shadow exists that far out (every building sits well inside the
frustum) — the plane was never displaying real shadow information, just
sampling artifacts. Re-verified at all 4 densities, zoomed out to the
same extent: the blob field is gone, ground reads as a clean flat colour
past the developed grid, and the road lattice still correctly stops at
the grid boundary (confirming 1b's disproof again from the fixed state).

**Camera zoom-out cap** (requested as a secondary safety net): checked
`CAM_CLAMP.zoom` (`cityData.ts`) — floor is 0.55. The zoom-out screenshots
above were taken by clicking "Zoom out" 8 times, which hits that floor
after ~4 clicks (`0.9 × 0.87⁴ ≈ 0.52`, clamped to 0.55) — so those
screenshots already show the worst case the UI allows. At that floor the
developed footprint still fills a comfortable majority of the frame in
every density's screenshot. Concluded no change needed: the existing cap
was already sensible, and the actual problem (the shadow artifact) is
fixed at its source rather than hidden by preventing the camera from
reaching the view where it was visible.

### 1c — Real road detail: texture, crosswalks, sidewalks

Read the CSS reference first, as asked (`app/kawasan/page.tsx`'s
`laneBg()`/`.kw-road-x`/`.kw-road-y`, and the zebra-crossing + ZonePlot-
sidewalk blocks). Two things worth flagging before the build notes:

- **The "organic lit-window map" canvas-texture technique this was
  expected to reuse doesn't exist in the WebGL route.** That technique is
  CSS-only (`app/kawasan/page.tsx`); this route's window-lighting
  (`models.tsx`'s `InstancedBoxes`) is a flat per-instance emissive tint,
  not a texture. There was nothing to reuse — `roadTexture.ts` is the
  first canvas-texture generator in `app/kawasan-3d/`.
- **The CSS sidewalk is inset within each zone tile's own south/east
  edge**, not added to the road gap — `ROAD_GAP (280) - PLOT (240) =
  ROAD_W (40)` exactly, zero spare width on the road side. Reading this
  before building saved me from putting sidewalk geometry somewhere that
  doesn't physically have room for it in this layout.

**What was built**:
- `roadTexture.ts` — `getRoadTextures(density)` returns a `{vertical,
  horizontal}` `CanvasTexture` pair (one canvas, one rotated 90° via
  `.center`/`.rotation` for the other orientation, since `vRoads` and
  `hRoads` planes have swapped width/length axes) drawn once per lane
  count and cached. Lane count/median thresholds are copied verbatim from
  the CSS `LANE_OFFSETS` cutoffs: 0 markings below density 0.3, 1 dashed
  line to 0.62, 2 to 0.85, 3 with a median at ≥0.85. Base canvas is white
  so the plane's own `ROAD_COLOR` material colour tints it (asphalt tone
  stays a single source of truth with 1a's fix); curb strips and dashed/
  solid lane paint are drawn in colour on top. `getCrosswalkTexture()` is
  a second, much smaller shared texture (white stripes on transparent).
- `roadDetail.tsx` — `Crosswalks` (one `InstancedMesh`, 2 decal instances
  per qualifying junction — the two differ only in which local axis
  carries the "long" scale, not by an extra rotation, sidestepping a
  Euler-composition-order question I wasn't confident enough to reason
  through blind) and `Sidewalks` (two `InstancedMesh`, one for every
  developed tile's south-edge curb, one for every tile's east-edge curb).
  Crosswalk qualification ports the CSS logic (junction borders an
  education/community-kind zone) exactly, not just its visual result.
- Wired into `Grid()` (`CityScene.tsx`): road planes now carry
  `map={roadTex.vertical|horizontal}` alongside the existing `ROAD_COLOR`;
  `<Crosswalks>`/`<Sidewalks>` added as siblings.
- **Traffic**: did not touch `scenery.tsx`'s `Traffic` component. Its car
  positions are computed from `ROAD_GAP`/`PLOT`/`roadsV`/`roadsH`
  (`cityData.ts`), none of which changed this session (only road mesh
  `material.map`/`color` changed — not geometry dimensions or the
  position formulas) — so it's provably unaffected, not just assumed
  fine. Confirmed no console errors across every screenshot pass in this
  section, which would have surfaced a runtime break had one occurred.

**Two real bugs found while verifying this** (same discipline as Phases
E-F: cross-check the number against the screenshot, don't trust either
alone):
1. **Sidewalks were invisible** — draw calls barely moved after adding
   them. Root cause: `Sidewalks`' two `InstancedMesh`es scale a unit
   `boxGeometry` per-instance but never called `computeBoundingSphere()`
   afterward, so frustum culling used the tiny default bounding sphere
   (computed from the *unscaled* geometry) and culled the whole mesh out
   almost everywhere. Every other per-instance-scaled `InstancedMesh` in
   this codebase (`models.tsx`, `water.tsx`, `vegetation.tsx`) already
   does this recompute — missed it on the first pass here. Fixed by
   adding the same call; confirmed via draw-call delta after the fix.
2. **A debug `console.log` I added to `Crosswalks` to diagnose #1 didn't
   show up for two separate HMR cycles**, even after confirming no page
   errors. Not a code bug — a repeat of the WSL `/mnt/c` file-watching
   staleness this log has flagged before (Phase F's `.next` 500), this
   time manifesting as "edits silently not picked up" rather than a
   build error. Fixed by a full stop-dev/`rm -rf .next`/restart cycle,
   after which the log line appeared immediately (36 qualifying
   junctions at the default Metro preset). Worth restating since it's
   now bitten this session in two different-looking ways: **when a
   just-made edit doesn't seem to be reflected at all** (not "reflected
   incorrectly" — just plain absent, no error either), suspect stale
   `.next`/HMR before suspecting the edit itself.

**Verification**:
- `npm run build` / `npm run lint`: both clean.
- Draws rose by a small, **density-independent** amount at every step —
  the actual signature the brief asked me to watch for
  (`draws should add near-zero ... if the numbers jump a lot, something
  strayed from the design`): +5 (Semi-urban/Metro/Dense) to +6 (Rural).
  This is exactly 1 (Crosswalks, when non-empty) + 2×2 (Sidewalks' two
  `InstancedMesh`es, each rendered twice — once for the shadow-map depth
  pass, once for the colour pass, since both have `castShadow` set) = 5,
  matching every density but Rural's +6, which I did not chase down to
  the exact extra unit (small enough, and consistent with the "why
  doesn't matter, it's still O(1) not O(n)" conclusion, to not be worth
  more time against the actual ask here). Road texturing itself added
  **zero** extra draws, as designed (same planes, now with a `map` set).
- Crosswalk decals and sidewalk curbs are **clearly confirmed visually**
  — a zoomed screenshot at Metro density shows a distinct white "+"
  decal at a qualifying junction and continuous light-gray curb strips
  outlining every developed tile. The finer yellow lane-dash markings
  inside the road texture were **not** clearly resolvable in SwiftShader
  screenshots at any zoom level I tried (asphalt noise and curb strips
  ARE visible, so the texture is being sampled — just not enough pixel
  budget left for the thin dash detail under software rasterization).
  Flagging this the same way Phase C flagged not being able to visually
  pick out the water shader: relying on code review (the dash-drawing
  logic is the same straightforward canvas 2D fillRect pattern as the
  curb strips, which do render correctly) rather than claiming a
  screenshot confirmation I don't actually have for that one element.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 2 | 120 | 7.1k |
| Semi-urban 8×8 | 3 | 151 | 13.0k |
| Metro 10×10 | 3 | 213 | 25.0k |
| Dense metro 12×12 | 4 | 251 | 41.5k |

\*SwiftShader — see caveat at top of log. Compare draws against Phase F's
114/146/208/246 — the density-flat +5/+6 delta is the signal that
matters here, not the raw numbers.

Committed as: `feat(kawasan-3d): road contrast, shadow-artifact fix,
texture/crosswalk/sidewalk detail`.

## Item 2 — Freestanding trees

**Confirmed from the log before starting**: Phase D added grass/paddy
*blade* instancing on flat `"sawah"`/`"field"` tiles only — no standalone
tree geometry (trunk + canopy) exists anywhere in the WebGL route. Double-
checked by grepping `scenery.tsx`/`models.tsx` for tree-shaped geometry
and finding none. This is a genuine gap versus the CSS version's Tree/
Palm/Conifer components, not something this session regressed.

**Placement — ported the spirit, not the literal CSS technique**: the CSS
Tree/Palm/Conifer placement (`app/kawasan/page.tsx`) is a fixed list of
pixel positions scattered around a fixed-size world div, plus a few
coastal-only beach palms. That doesn't translate to this route's
variable-`gridSize`, per-zone-grid architecture — there's no equivalent
"the world's fixed edge" to hang fixed positions off. Built instead: a
small number of trees per **developed** zone tile, count driven by
`zone.kind` (village 2, housing/education/community 1, river 2 — the
concrete-core kinds urban/commercial/market/industry get 0, keeping the
skyline read as a dense core rather than a park), positioned in the
tile-edge margin outside the building-slot grid and just inside item 1's
new sidewalk curb; plus one tree per **undeveloped** (empty) cell, so
those previously-bare dark tiles read as unbuilt land instead of voids.
Species selection ports the CSS's actual bias (coastal → palm, hilly →
conifer) via the already-threaded `SeatTraits`, with a baseline mix
(65% round / 20% conifer / 15% palm) when neither trait applies. Same
Phase-C caveat applies: the sandbox's `DEFAULT_TRAITS` is all-false, so
the coastal/hilly bias is demo-inert but wired correctly for whenever the
live route feeds real traits.

**What was built**: `sway.ts` — extracted vegetation.tsx's Phase D wind-
sway shader (`SWAY_VERT`/`SWAY_FRAG`) into its own module, parameterized
with `uAmp`/`uFreq` uniforms instead of the old hardcoded 0.5/2.0, and
refactored `vegetation.tsx` to import it (same values, so blade behaviour
is unchanged — this was a pure extraction, not a rewrite). This is the
literal shared shader source the brief asked for, not a second sway
mechanism reimplementing the same idea. `trees.tsx` reuses it for canopy
sway with its own `uAmp`/`uFreq` (1.6 / 1.1 — larger absolute amplitude
than grass but slower frequency, since canopies are ~12-14 world-units
across vs. a blade's ~9-unit height; trunks don't sway at all, plain
`meshStandardMaterial`, matching real tree physics).

Geometry: **4 `InstancedMesh`es total, regardless of tree count** — one
shared cylinder for every trunk across all 3 species (a palm's trunk is
just a taller/thinner per-instance scale of the same geometry, not a
separate mesh), plus one canopy mesh per species (round = sphere, conifer
= cone, palm = a flattened/squashed sphere standing in for a frond crown
— a stylised approximation consistent with this scene's existing low-poly
primitive-only aesthetic, not an attempt at literal frond geometry).

**Verification**:
- `npm run build` / `npm run lint`: both clean.
- Draws rose by a density-flat **+7/+8** (Rural +7, Semi/Metro/Dense +8)
  — matches 4 meshes × 2 passes (shadow depth + colour, since trunks and
  canopies both have `castShadow` set, the same shadow-doubling item 1's
  Sidewalks already established) = 8, with Rural's -1 plausibly one
  species mesh having zero instances there (not chased further — the
  density-flat shape, not the exact unit, is what the brief's "should add
  near-zero draw calls... if the numbers jump a lot" check cares about,
  and 4 fixed meshes is squarely what "2-4 draw calls" asked for).
  Triangles rose more substantially (Dense: 41.5k → 63.4k, +21.9k) from
  the canopy sphere/cone geometry itself (~100-120 tris/tree) — a real
  but bounded, expected-shape cost, not a runaway (scales with tree
  count, which itself is bounded by the fixed per-zone-kind/per-empty-
  cell counts above, not by grid size directly).
- Visually confirmed at Rural (fewer buildings, easiest to inspect
  individually): trees render with a clearly visible brown trunk under a
  pale-green canopy, populating both empty perimeter cells and developed
  village/housing tiles, matching the design. Metro's wider shot shows
  what appear to be both round (pale, rounded) and darker,
  more-pointed (conifer) silhouettes, consistent with the species mix,
  though I'm not claiming 100% certainty on species identification at
  screenshot resolution — the count/structure/placement logic is what I
  verified with confidence (build/typecheck + visual presence + no
  console errors), not a pixel-level species audit.
- No z-fighting, missing geometry, or broken materials at any density;
  Dense metro (the fullest grid, all cells developed, so this exercises
  the per-zone-kind path exclusively with zero empty-cell trees) shows no
  regressions from the added geometry.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 2 | 127 | 12.9k |
| Semi-urban 8×8 | 4 | 159 | 23.2k |
| Metro 10×10 | 4 | 221 | 41.1k |
| Dense metro 12×12 | 3 | 259 | 63.4k |

\*SwiftShader — see caveat at top of log. Compare draws against item 1's
120/151/213/251 — the density-flat +7/+8 delta is the signal that
matters, not the raw numbers.

Committed as: `feat(kawasan-3d): freestanding trees (round/conifer/palm)`.

## Item 3 — Grass: re-verified, not rebuilt

Per the brief, Phase D already built this (`vegetation.tsx`'s instanced
grass/paddy blades on `"sawah"`/`"field"` tiles) — this item was
verification-only, no code change, so there's nothing to commit
separately (same "folds into the surrounding work" treatment Phase B got
back when it turned out to need no new code).

Cropped into a `"field"` tile from item 2's own Rural screenshot (already
on disk, no new capture needed) and confirmed individual pointed blade
shapes are clearly visible on the bright-green patch — the same
recognisable silhouette as Phase D's original verification, sitting
correctly alongside item 1's road/sidewalk work and item 2's new trees
with no visible interference between any of them (the round tree in the
same crop, item 2's addition, renders cleanly next to the grass blades
with no z-fighting or overlap issues). **Confirmed working, not
regressed** by anything in items 1 or 2 — `vegetation.tsx` itself was
only touched for item 2's shader-extraction refactor (moving the sway
GLSL into `sway.ts`), which is a pure move with the same uniform values,
not a behavioural change, and this visual check corroborates that it
didn't accidentally change anything.

## Item 4 — Procedural building detail

The last of the 4-item follow-up list, and the one with real new code.
Per the earlier migration notes the box fallback was "a box stand-in,
not full CSS parity" — the biggest remaining visual gap against both the
CSS version and a real city. This adds a middle tier between a real GLTF
model and the plain box, so the fallback order is now **real model
(Phase A/B) > procedural detail (`procedural.tsx`) > plain box**
(`InstancedBoxes`, unchanged, still the last resort for every BType this
file doesn't cover and for this file's own generation-failure path).

Two shapes, both ported from the CSS version's actual technique rather
than just its look:

- **Gable roof** — `house` / `terrace` / `kampung`. The CSS `PitchedRoof`
  derives its slope from a RISE and a HALF-WIDTH via
  `Math.hypot(half, RIDGE_RISE)` / `atan2(RIDGE_RISE, half)`; that same
  rise/half-width relationship is expressed here directly as the apex
  vertex position of real 3D geometry (`buildGableTemplate`) instead of a
  rotated flat face. One deliberate departure: the CSS adds the rise as
  an absolute pixel height per instance, but this file's roof lives in a
  UNIT template that each instance non-uniformly scales by its real
  `(w, h, d)` — the same convention `InstancedBoxes` / `InstancedModel`
  already use — so the rise is a FRACTION of unit height, not an absolute
  amount. Ridge axis is fixed per type rather than the CSS version's
  per-instance width-vs-depth check (these footprints only vary ~10%
  around their base aspect via `jitterFootprint`, so one fixed axis is a
  reasonable simplification, not a materially different building).
- **Stacked setback** — `tower` / `skyscraper` (pronounced) + `shophouse`
  (barely recessed, matching its real low-rise proportions): a
  full-footprint lower block plus a narrower upper block.

Variant selection reuses `pickVariantIndex` (`cityData.ts`) — the exact
per-instance-key hash Phase A's GLTF variants use — not a second jitter
mechanism. 3 geometry variants per type (roof pitch / setback ratio),
each a merged unit-size `BufferGeometry` shared by one InstancedMesh per
`(type, variant)`, the same InstancedMesh-per-`(type,variant)` pattern
Phase A established for GLTF. This adds a geometry SOURCE, not a new
instancing strategy. `useHeightTween` (was module-private in
`models.tsx`) is now exported so the grow tween is shared, not
reimplemented.

### Bug the harness caught: silent `mergeGeometries` failure on the gable types

First harness run came back with **9 identical console errors** —
`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at
index 1 ... make sure index attribute exists among all geometries, or in
none of them`. Cause: `BoxGeometry` (the wall) is indexed, the roof's
`ExtrudeGeometry` is not, and `mergeGeometries` requires every input to
agree. On failure `buildGableTemplate` returned `merged ?? wall`, i.e.
**the gable types silently rendered as a roofless box** — the setback
types (two `BoxGeometry`, both indexed) were unaffected. This was
invisible to `npm run build`, `tsc`, and `next lint` (all clean), and
invisible to a glance at the screenshot too — a roofless house still
looks like a plausible box at this zoom. Only the harness's
console-error capture surfaced it. Fix: `stripToPositionNormalUv` (the
shared chokepoint both templates route through) now flattens any indexed
input to non-indexed before the merge — after that, any pair merges.
Re-run: **0 console errors**, and triangle counts rose by the amount the
roof geometry actually costs (Rural +0.3k, Dense +4.7k over the
roofless-fallback run) — confirming the roofs are now really there.

### Perf

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 1 | 148 | 13.5k |
| Semi-urban 8×8 | 4 | 179 | 24.6k |
| Metro 10×10 | 3 | 241 | 44.7k |
| Dense metro 12×12 | 4 | 282 | 70.7k |

\*SwiftShader — see caveat at top of log; fps is noise, draws/tris are
the signal. Compare draws against item 2's 127 / 159 / 221 / 259: the
delta is +21 / +20 / +20 / +23 — **density-flat**, which is the expected
shape. Procedural rendering replaces what were ~6 box InstancedMeshes
with up to 6 types × 3 variants = 18 InstancedMeshes, and that count is a
function of how many BTypes/variants are present, NOT of grid size — so
it does not scale with density. Triangles rose +0.6k / +1.4k / +3.6k /
+7.3k, scaling with building count (each instance now carries a roof
prism or a second setback block instead of six box faces) — a real but
bounded cost, the same density-proportional shape items 1 and 2 had.

### Visual

Verified at Rural (fewest buildings, easiest to inspect individually)
and cross-checked at every density: the tall central buildings show a
clear stepped profile (setback lower/upper blocks) while the shorter
residential blocks around them carry a sloped roof cap the towers don't
have — i.e. the intended `gable` vs `setback` type split is visibly
distinct. No z-fighting, missing geometry, or broken materials at any
density, and Dense metro (all cells developed) shows no regression from
the added geometry. Not claiming pitch-angle or per-variant
identification at screenshot resolution under the scene's dusk lighting —
what's confirmed with confidence is the type-split, the structural
correctness (roofs sit on walls, setbacks are centred and narrower), the
clean perf shape, and zero console errors.

Committed as: `feat(kawasan-3d): procedural gable-roof / setback building
detail`.

## Item 5 — Window lights ("more detail and polish")

A follow-on polish pass after the 4-item list, not part of the original
brief. The single biggest remaining gap between the WebGL night scene and
both the CSS route and a real city: buildings had no windows. At
dusk/night they got a flat whole-body emissive tint (`InstancedBoxes`'
`winLit` param, and item 4's procedural material carried the same idea) —
a building-shaped glow, not a tower with a mixed occupied/dark floor
grid. `roadTexture.ts`'s own header even flagged this ("this route's
window-lighting is a flat per-instance emissive tint, not a texture").

### What it is

New `windows.ts`: a canvas → `CanvasTexture` emissiveMap, one per
`(type, variant)`, following `roadTexture.ts`'s module-level-cache +
`CanvasTexture` idiom (the first canvas-texture generator this route
grew). It is the texture port of the CSS route's `litWindowMap`
(`app/kawasan/page.tsx`) — same deterministic LCG walk and the same
multiplier/increment/mask constants, seeded off `(type, variant)`, ~40%
of cells lit, in the CSS version's exact warm `rgb(255,206,120)` — drawn
near-black everywhere else (emissiveMap multiplies `emissive`, so black =
no contribution) with a soft halo so the Phase E bloom has something to
catch. `wrapT` + a per-type `repeat.y` tiles the floor grid up tall
walls (skyscraper 6×, house 1×).

Wired into `procedural.tsx` (the types that matter most for a skyline —
tower / skyscraper / shophouse and house / terrace / kampung — all route
through there now). The wall material gets the emissiveMap; its
`emissiveIntensity` starts at 0 and is driven by `winLit` in an effect,
so **daytime is byte-for-byte unchanged** (verified — see below) and a
TOD toggle doesn't rebuild materials. Gain is higher for the setback
towers (crisp bright grid) than the domestic gable types (gentler
lived-in glow).

### The draw-call regression, and the fix

First attempt split every box into 6 per-face geometry groups so only the
vertical faces would be windowed (no glowing roof deck / gable slope).
three emits **one draw call per group even when adjacent groups share a
material**, so draws exploded: Rural 148 → 387, Dense 283 → 589
(~+250 across the board — density-flat but a ~2.5× scene-wide blowup, well
past item 2's "should add near-zero draw calls" bar). Fix: drop the
per-face split. Setback templates go back to a single material for the
whole shell — a faint window grid on a tower roof-deck reads fine as
rooftop lights, and 1 material = 1 draw. Only the **gable roof** keeps a
2-group split (box walls = windowed, extruded roof slope = plain), since
a glowing pitched roof is the one genuinely wrong-looking surface and
there are at most 9 gable InstancedMeshes. Re-run: Rural 166, Semi 197,
Metro 259, Dense 301 — **+18 vs item 4 at every density** (the ~9 gable
meshes' second group, ×2 for the shadow pass). Triangles unchanged
(13.5 / 24.6 / 44.7 / 70.7 k — identical to item 4, no geometry change).
Zero console errors.

| density | fps* | draws | tris | Δdraws vs item 4 |
|---|---|---|---|---|
| Rural 6×6 | 1 | 166 | 13.5k | +18 |
| Semi-urban 8×8 | 3 | 197 | 24.6k | +18 |
| Metro 10×10 | 3 | 259 | 44.7k | +18 |
| Dense metro 12×12 | 4 | 301 | 70.7k | +18 |

\*SwiftShader — noise, see caveat at top.

### Visual

Night (Rural + Metro, camera dropped low and zoomed into the skyline):
setback towers carry a full window grid climbing the shell — warm lit
cells scattered through blue-tinted glass, the bloom catching them, and a
visibly different pattern building to building. Gable houses show one or
two warm windows low on the wall with the **roof slope staying dark** —
the 2-group split doing its job — and the softer gain reads domestic
next to the commercial towers. Plain-box civic/industrial types
(factory, warehouse, school, …) are untouched, still dark — expected,
they don't route through `procedural.tsx`. Day: buildings are flat solid
colour with **no glow anywhere** (`winLit` 0 → `emissiveIntensity` 0),
confirming zero daytime impact.

Not carried further this pass: per-instance pattern variety (all
instances in one InstancedMesh share the `(type, variant)` texture — a
UV-offset atlas keyed off an instanced attribute is the way there);
window lights on the plain-box civic types; the downtown-core towers
read a touch hot once halo bleed + bloom stack on the ~40% lit base, on
the bright side of the intended aesthetic rather than wrong.

Committed as: `feat(kawasan-3d): lit-window emissive maps for procedural
buildings`.

## Item 6 — Ground / grass colour and variation (task part A)

New three-part brief (A ground/grass, B multi-cell footprints, C
roundabout), done in order with a commit + harness pass per part. This
is part A.

### What was wrong, and what changed

The zone-tile ground colours (`zoneGroundColor()`, `cityData.ts`) are the
darker stop of each CSS gradient — `housing` `#1d2a24`, `village`
`#17331d`, `education`/`community` `#132a24` — which under this scene's
lighting read as flat dark olive/navy, not grass. New `ground.ts`:

- `isGrassKind()` — only `housing` / `village` / `education` / `community`
  get grass. `urban` / `commercial` / `market` / `industry` / `river`
  keep their existing `zoneGroundColor()` value untouched (the legend and
  the minimap score coding read against those per-kind hues — flattening
  them was explicitly out of scope).
- `grassColor(kind, seed)` — a brighter natural-lawn green per kind
  (`#3f5a36`..`#47613c`), plus a small deterministic per-tile HSL jitter
  so neighbouring lawns differ tile-to-tile.
- `undevelopedGrassColor(seed)` — the empty cells (was a flat `#141b26`
  navy plane) become a drier, slightly yellow-green scrub so unbuilt land
  still reads distinct from a kept lawn.
- One shared 128² canvas noise texture (`roadTexture.ts` / `windows.ts`
  cache idiom — mid-grey base so it multiplies the colour ±~18%, a few
  big soft wrapped blobs + fine speckle), `grassTextureFor(seed)` hands
  out a `.clone()` per tile with a deterministic quarter-turn
  rotation / offset / repeat so the mottle doesn't visibly tile.

Wired into `CityScene.tsx`: `ZoneTile` picks grass vs palette colour and
attaches the cloned texture as `map` for grass kinds; the empty-cell
plane is now an `<EmptyCell>` with the same treatment. Both `useMemo` the
clone and dispose it on unmount. The zone tiles are already one mesh
each (they carry hover/select state) and empty cells were already one
mesh each, so **nothing here adds a draw call or a triangle**.

### On the score-tint compositing the brief asked about

The brief flagged that the BAIK/SEDERHANA/KRITIKAL score tint
"presumably" tints these same tiles and needs to compose with the grass
rather than fight it. Checked: in the current WebGL build the score tint
(`scoreTint()`, `City3DMapGL.tsx`) is applied **only to the minimap
cells** — the 3D `ZoneTile` material has never carried it (its only
non-base term is the cyan selected / grey hover emissive). So there is
no compositing conflict to resolve today. The grass is nonetheless
layered so a future 3D score tint would drop in cleanly: base grass
`color` × noise `map` as the ground, leaving `emissive` (or a second
colour multiply) free for the tint. Noted here rather than silently
skipped.

### Verification

`tsc` + `next lint` clean. Harness, all four densities: **0 console
errors**, draws 165 / 197 / 259 / 301 and triangles 13.5 / 24.6 / 44.7 /
70.7 k — identical to item 5 (±1 draw of SwiftShader noise), confirming
the zero-cost claim. Visually (day, Metro + Rural): the residential /
village / school / community tiles now read as distinct mottled green
lawns, each a slightly different shade, with the empty cells a drier
khaki-green; the commercial / industrial / urban / river tiles are
unchanged dark palette, so the zone-kind coding still holds; the minimap
score tint is unaffected. No z-fighting.

| density | fps* | draws | tris |
|---|---|---|---|
| Rural 6×6 | 8 | 165 | 13.5k |
| Semi-urban 8×8 | 6 | 197 | 24.6k |
| Metro 10×10 | 10 | 259 | 44.7k |
| Dense metro 12×12 | 3 | 301 | 70.7k |

\*SwiftShader — noise, see caveat at top.

Committed as: `feat(kawasan-3d): grass tone + patchy variation for green
zone kinds`.

## Item 7 — Multi-cell building footprints (task part B)

### The placement model, read before designing

Confirmed by reading `cityData.ts` / `CityScene.tsx`:

- Buildings are placed **strictly per developed zone cell**.
  `zoneBuildings(zone)` returns slot-indexed `BSpec`s (slots 0–8 via
  `slotPos()`) inside that one 240×240 tile; `Buildings()` turns each into
  a `BuildingInstance` positioned within that tile. There is no
  pre-existing multi-cell concept.
- Roads are **not per-cell-boundary segments**. `Grid()` draws exactly
  one full-span plane per grid line (`vRoads` / `hRoads`, from
  `roadsV()` / `roadsH()`), each spanning the whole grid. So the brief's
  "route roads around a merged footprint … likely one segment per
  cell-boundary" doesn't match this route — there is no segment to drop.
- Sidewalks are per developed tile's own south + east edge
  (`roadDetail.tsx`); street lamps are one instanced pole+head per road
  junction (`scenery.tsx`); traffic is straight-line motion along the
  lane centres, no path-following.

### Design

New `largeBuildings.tsx` — a footprint-reservation pass:

- `reserveLargeFootprints(placed, gridSize)` walks `placed` (already
  centre-outward), and for zones of a candidate kind — `commercial` →
  `mall` 2×2, `education` → `stadium` 2×2, `industry` → `factory` 2×1 —
  gated by a stable `hash(zone.id)` so only some qualify, reserves an
  N×M block toward +col/+row when every required cell is in-bounds and
  unclaimed. Claimed cells go in a `Set<"col,row">`. Hard cap
  `MAX_LARGE = 3`, central candidates first, so a large building reads as
  an intentional core landmark, not a pattern. Fully deterministic from
  `placed` — no per-render randomness.
- `claimed` is threaded through `CityScene` into: `Buildings` (skip
  per-cell buildings on claimed cells — the large one replaces them),
  `Sidewalks` (skip claimed tiles' curbs — the podium edge is the
  boundary), `Trees` (skip claimed placed + empty cells), and
  `StreetLamps` via `junctionInsideLarge()` (suppress the one lamp at a
  junction whose four surrounding cells are all claimed, so a 26-unit
  pole doesn't spear up through the podium).
- **Roads / "route around":** since roads are full-span strips, each
  large building carries a tall opaque **podium skirt** (`y = 0 …
  GROUND_Y+2`) spanning the whole combined footprint. It occludes the
  road / sidewalk / ground — and any car — passing underneath from every
  camera angle this scene's `CAM_CLAMP` allows: the road visibly stops
  at the podium and resumes on the far side. A literal strip
  segmentation (splitting `vRoads` / `hRoads` planes to leave a gap) is
  the "more correct" version and is noted here as a **follow-up**; the
  podium is the pragmatic solve and reads correctly.
- **Traffic:** cars still drive their straight lane paths; one whose lane
  crosses a footprint is fully hidden inside the opaque podium for that
  span (the podium encloses the car's y-range) rather than rerouted.
  Path-following is out of scope, same call the roundabout (item 8)
  makes.
- Geometry: podium + a massed body (two-tier for `mall` / `stadium` so
  the silhouette isn't a plain lid — a first cut with a full-footprint
  flat body + a near-black roof cap read as a black void from the
  near-top-down camera) + a small **light** rooftop deck. Bodies use a
  per-type minimum height (`mall` 62, `stadium` 40, `factory` 44) since
  the raw `buildingHeight()` values look flat on a 2-cell footprint.
  Clicking any part selects the anchor zone. Ordinary meshes — ≤ 3
  buildings, all different sizes, instancing would only add complexity.

### Verification

`tsc` + `next lint` clean. Harness, all four densities: **0 console
errors**.

| density | fps* | draws | tris | Δ vs item 6 |
|---|---|---|---|---|
| Rural 6×6 | 3 | 177 | 11.0k | +12 draws, −2.5k tris |
| Semi-urban 8×8 | 5 | 215 | 22.0k | +18 draws, −2.6k tris |
| Metro 10×10 | 4 | 279 | 41.8k | +20 draws, −2.9k tris |
| Dense metro 12×12 | 4 | 323 | 67.5k | +22 draws, −3.2k tris |

\*SwiftShader — noise, see caveat at top.

Draws rise a small, near-density-flat amount (`≤ MAX_LARGE` buildings ×
~6–8 meshes-with-shadow-pass each). **Triangles go negative** at every
density: one large building's 3–4 boxes replace up to four cells' worth
of small instanced buildings. So there is no regression to gate — the
quality-tier knobs (`quality.ts`) are untouched.

Visually (day, Rural + Metro + Dense): three large buildings — a tiered
pink `mall`, a tiered green `stadium`, a low grey `factory` — each
spanning its 2×2 / 2×1 block including the swallowed road gaps, with the
podium skirt masking the interior road/sidewalk and the road lattice
visibly routing around the outer boundary. No clipping into neighbouring
buildings, no trees or lamp poles poking through a podium, at every
density. The count holds at 3 from Rural through Dense, so it stays a
landmark, not a motif.

Committed as: `feat(kawasan-3d): multi-cell footprint reservation for
mall / stadium / factory`.

## Item 8 — Roundabout at the central junction (task part C)

### Site + the constraint that shaped it

Candidate intersections come straight from the road-position data
(`roadsV` / `roadsH`). For the even grid sizes this route uses (6 / 8 /
10 / 12), the grid lines `i = j = gridSize/2` cross exactly at world
origin — the 4-way junction the town-centre / zone-0 tile sits on. That
is the roundabout site (one, prominent, central — per the brief).

The constraint: the four zone tiles around that junction meet across only
the 40-unit road gap, so their inner corners are ~28 units from the
junction centre. Any ring road wider than that overlaps those corners,
and the tile boxes (y 0..TILE_H) poke up through a flat ring. First
attempt reshaped each adjacent tile with a 45° chamfer geometry — it
worked but needed a chamfer so deep (to clear a readable ring) that it
ate several buildings per tile and still left the ring cut roughly in
half by the tile edge, so the carriageway barely read. Replaced with a
simpler, more robust approach: build the roundabout as a **slightly
raised circular deck** — ring + island at `y = TILE_H + 0.4`, just above
the tile tops. The opaque ring then covers the tile-corner overlap from
every camera angle `CAM_CLAMP` allows; the tiles stay plain boxes. The
only per-tile change kept is a **building filter**: `Buildings()` drops
any per-cell building whose slot centre is within `CLEAR_R` (Manhattan)
of that tile's junction-facing corner, so nothing stands in the ring.

### What was built (`roundabout.tsx`)

- `ringGeometry(rInner, rOuter)` — a flat annulus BufferGeometry on XZ,
  authored by hand (not a reused straight segment): UV `(radialFrac,
  angleFrac × circumferenceRepeat)` so the shared road texture's dashes
  run around the circumference. Textured with a `.clone()` of
  `getRoadTextures(density).vertical` (wrap set for the ring, so the
  straight roads' copy is untouched).
- A landscaped centre island: opaque disc + a raised kerb wall + a
  mounded top (all opaque, so the four straight approach roads crossing
  underneath are hidden), a monument (plinth + obelisk + a flag), and
  five trees ringing it.
- The four approach roads already pass through the junction as full-span
  planes (`Grid()`), so they are the radiating connectors — no extra
  geometry. `StreetLamps` takes the junction centre and suppresses the
  one lamp that would stand in the island.
- **Traffic:** cars keep their straight lane paths (`scenery.tsx`) — one
  whose lane crosses the roundabout drives straight through it. Path
  following around the ring is **a follow-up**, not attempted in this
  visual pass (flagged per the brief).

### Verification

`tsc` + `next lint` clean. Harness, all four densities: **0 console
errors**.

| density | fps* | draws | tris | Δ vs item 7 |
|---|---|---|---|---|
| Rural 6×6 | 5 | 208 | 12.5k | +31 draws, +1.5k tris |
| Semi-urban 8×8 | 7 | 246 | 23.5k | +31 draws, +1.5k tris |
| Metro 10×10 | 5 | 310 | 43.3k | +31 draws, +1.5k tris |
| Dense metro 12×12 | 5 | 354 | 69.0k | +31 draws, +1.5k tris |

\*SwiftShader — noise, see caveat at top.

Exactly **+31 draws / +1.5k triangles at every density** — one
roundabout is a fixed cost independent of grid size (ring + island +
kerb + mound + monument + 5 trees, several with a shadow-pass draw).
Dense metro moves 323 → 354 draws / 67.5k → 69.0k tris — not a
meaningful regression, so the quality-tier knobs (`quality.ts`) stay
untouched.

Visually (day, Rural + Metro, zoomed on the centre and again from a low
angle): a clear circular carriageway around a landscaped island —
kerb wall, mound, monument + flag, trees — at the central junction, with
the four approach roads meeting it. The four surrounding tiles' inner
corners are hidden under the raised ring with no poke-through at the low
angle, and the per-cell buildings nearest the junction are gone so none
stands in the carriageway. The central street lamp is suppressed.

Committed as: `feat(kawasan-3d): central roundabout — ring road, island,
monument`.

## Item 9 — Metro / Dense-metro density: pack the core like a real CBD

Ask: the Metro preset read as blocks scattered on open land, not a
built-up metropolitan core — make it dense like KL. All three changes in
`cityData.ts`, gated behind a new `METRO_DENSITY = 0.62` constant (the
same cutoff `kawasanGridSize` already uses for "metro"), so **Rural and
Semi-urban are byte-for-byte unchanged** — the ported originals still run
below the threshold.

- `kawasanDevelopedCount` — at/above the threshold, fill ~0.86 of the
  grid at Metro rising to ~0.98 at Dense (was the plain linear
  `min + density·(total−min)`, ≈0.75 at Metro). Almost no undeveloped
  cells inside the footprint.
- `zoneBuildings` — `metroCore` tiles pack every slot: `urban` zones get
  2 → 4 skyscrapers (scaling `2 + round((density−0.62)·7)`), `commercial`
  gets 1 → 2, and `extras` fill **all** remaining free slots instead of
  `round(density·3)` with two always held back — only reserving a slot
  when the zone actually has a facility project. Below the threshold the
  original skyscraper formula and the `free.length − 2` reserve are
  untouched.
- `jitterFootprint` — takes `density` now; `metroCore` grows footprints
  ×1.11 (Metro) → ×1.31 (Dense), capped at `SLOT_PITCH − SLOT_GAP` so
  neighbours still can't overlap. Towers nearly abut, KL-street-wall
  style, instead of sitting island-like in their 72-unit slot. The cap
  makes this a no-op below the threshold (the ported jitter already
  tops out at the same value), so Rural/Semi are unaffected.

### Verification

`tsc` + `next lint` clean. Harness, all four densities: **0 console
errors**.

| density | fps* | draws | tris | Δ vs item 8 |
|---|---|---|---|---|
| Rural 6×6 | 1 | 209 | 12.5k | +1 draw, ±0 tris (noise) |
| Semi-urban 8×8 | 2 | 246 | 23.5k | ±0 |
| Metro 10×10 | 1 | 316 | 55.5k | +6 draws, **+12.2k tris (+28%)** |
| Dense metro 12×12 | 3 | 354 | 81.7k | ±0 draws, **+12.7k tris (+18%)** |

\*SwiftShader — noise, see caveat at top.

Rural / Semi-urban confirmed **byte-identical** (the threshold gate
holds). Metro / Dense get the intended density: **draw calls stay flat**
— instancing absorbs the extra buildings, so the real GPU state-change
cost is unchanged — while triangles rise ~20-28% from the denser
placement. That rise is bounded and one-time (more instances at fixed
per-type geometry, not a runaway), and Dense metro is already on the
`"low"` quality tier (`quality.ts`), so no additional tier gating was
applied. If a real-GPU pass later shows Dense struggling, the
`skyscraperCount` scale and `jitterFootprint`'s `grow` factor are the
dials to back off.

Visually (day + night, Metro + Dense): the grid is now built out nearly
cell-to-cell (the minimap fills almost solid), each core tile is packed
with buildings edge-to-edge, and the `urban` / `commercial` zones stack
clusters of 3-4 skyscrapers that read as a recognisable CBD skyline,
tallest around the centre and tapering to lower residential blocks at
the perimeter. Rural is unchanged — same sparse ~9-cell cluster.

Committed as: `feat(kawasan-3d): dense KL-style core for Metro / Dense
metro`.

## Item 10 — Metro core should be *tall*, not just full

Follow-up to item 9: Metro was fuller but still mostly mid-rise boxes —
only `urban` / `commercial` zones went vertical, and the demo has ~1
`urban` zone, so the grid read as low blocks with a few tower clusters,
not a skyline. The fix threads a **`coreness`** value (0 at the grid
edge, 1 dead centre — `CityScene`'s `Buildings` computes it per cell from
`Math.hypot(col−mid, row−mid)`) into `zoneBuildings`, and at/above
`METRO_DENSITY` uses it to build a real height gradient:

- **Type upgrade** (`CORE_LOWRISE` → high-rise): a deterministic
  per-`(zone, slot)` value rebuilds `house` / `terrace` / `kampung` /
  `shop` / `stall` as a `tower` (probability `∝ hi`) or `shophouse`
  (mid-band), leaving them unchanged toward the perimeter. Civic /
  industrial / ground-cover types (`masjid`, `school`, `clinic`,
  `factory`, `sawah`, …) are never touched — a CBD still has those.
- **Skyscraper count** now applies to *every* kind near the centre, not
  just `urban`: `urban` 2→5, `commercial` / `market` 1→2, and
  `housing` / `village` / `education` / `community` / `river` get
  `round(hi·1.6)` (high-rise residential — very KL). `industry` stays 0.
  Below the threshold this is byte-for-byte the ported original
  (`urban` only, 0–2).
- **Height lift**: `tower` / `skyscraper` heights ×`(1 + hi·0.55)` —
  ~1.0 at the edge, ~1.6 dead centre, so the tallest towers spike in the
  core and step down outward.

`hi` is `min(1, coreness·1.15)`. Everything is gated on `metroCore`, so
`coreness` is inert below `METRO_DENSITY` and Rural / Semi-urban stay
exactly the ported original.

### Verification

`tsc` + `next lint` clean. Harness, all four densities: **0 console
errors**.

| density | fps* | draws | tris | Δ vs item 9 |
|---|---|---|---|---|
| Rural 6×6 | 1 | 209 | 12.5k | ±0 (byte-identical) |
| Semi-urban 8×8 | 4 | 246 | 23.5k | ±0 (byte-identical) |
| Metro 10×10 | 2 | 316 | 58.4k | ±0 draws, +2.9k tris (+5%) |
| Dense metro 12×12 | 4 | 351 | 86.3k | −3 draws, +4.6k tris (+6%) |

\*SwiftShader — noise, see caveat at top.

This item swaps building *types*, it doesn't add instances — a `tower` /
`skyscraper` routes through the procedural setback geometry (a couple
more triangles than a plain `house` box), hence the small +5-6% triangle
move; **draw calls are flat** (instancing). Rural / Semi-urban
byte-identical again. No tier gating needed (Dense's `"low"` tier already
covers it; the triangle rise is small and bounded).

Visually (Metro + Dense, night): the core is now a genuine skyline —
dense clusters of towers throughout the built-up area, clearly tallest
around the centre (mall / stadium / roundabout) and stepping down to
orange / green low-rise residential at the perimeter. Rural / Semi-urban
unchanged.

Dials, if the core ever reads too spiky on real hardware: `lift`'s
`hi·0.55` factor, the `upgrade()` probability thresholds, and the
per-kind `skyscraperCount` in `zoneBuildings`.

Committed as: `feat(kawasan-3d): high-rise CBD gradient for the metro
core`.

## Item 11 — Regression triage after items 9-10 (spikes + flat platforms + fps)

Screenshots after item 10 showed three problems: hundreds of hairline
spike towers across Metro/Dense, the mall/stadium/factory reading as flat
coloured platforms, and the perf HUD at 1-4 fps. Diagnosed each against
the two hypotheses in the brief:

- **"Footprint jitter/scale collapsing a dimension near zero"** — ruled
  out. `jitterFootprint` clamps `w`/`d` to `≥ 0.88·base` (≈30 for a
  skyscraper), never near zero. The spikes were **real** setback towers,
  but items 9+10 compounded: slot-packing (9) + `house`/`shop`→`tower`
  upgrade (10) + a height `×1.55` lift (10) → hundreds of ~35-wide,
  ~250-420-tall boxes. Correct geometry, wrong aggregate.
- **"Large-building geometry never executes / silently fails"** — ruled
  out. `LargeBuildings` renders its podium + body + roof meshes fine; the
  failure was **proportion**: `BODY_MIN` (mall 62 / stadium 40 / factory
  44) on a ≈520-wide 2-cell footprint is a ~1:9 pancake, so at the
  harness camera it reads as a platform, not a building.
- **fps** — SwiftShader software-render plus the ~+25% triangle count
  from item 9's density (Dense 68k baseline → 86k).

### Fixes

- `cityData.ts` — spike taming, still dense, still tall, gated on
  `metroCore` so Rural/Semi stay byte-identical:
  - `jitterFootprint` gives `tower`/`skyscraper` an extra `×1.42` width
    in the metro core (capped at `SLOT_PITCH − SLOT_GAP`), so a core
    tower is a chunky ~1:5 slab, not a ~1:11 needle.
  - `lift` `×(1 + hi·0.55)` → `×(1 + hi·0.3)`.
  - `upgrade()` tower probability `hi·0.72 → hi·0.5`, shophouse band
    tightened — the core keeps a real mix of gabled low-rise + shophouse
    + tower rather than a tower monoculture.
  - per-kind `skyscraperCount` pulled down (urban `2→5` cap → `1→4`;
    residential kinds `round(hi·1.6) → round(hi·0.85)`).
- `largeBuildings.tsx` — composed, per-type massing so a landmark reads
  as a building: **mall** = wide retail podium + two office slabs + an
  antenna; **stadium** = stepped green bowl + inset tier + a light cap
  over the inset only (the earlier full-footprint grey "roof" read as a
  giant tabletop hiding the bowl) + four corner floodlight masts;
  **factory** = tall shed + a rooftop plant box + three fat chimneys.
  `TALL_MIN` mall 205 / stadium 104 / factory 150.
- `quality.ts` — new `buildingBudget` per tier (high 1.0 / medium 0.92 /
  low 0.78). `CityScene`'s `Buildings` thins per-cell instances
  deterministically (FNV hash of the instance key) to that fraction,
  never touching a `flag` structure or a glowing facility. This is the
  brief's "use the existing quality-tier system" — it pulls Dense metro
  back toward the pre-item-9 triangle count without touching the
  placement logic or the higher tiers.

### Verification

`tsc` + `next lint` clean (run with the dev server stopped — a
concurrent `next lint` + `next dev` corrupted `.next` into a "React
Client Manifest" 500 mid-run, the documented gotcha, cleared by
`rm -rf .next` + restart). Harness, all four densities: **0 console
errors**.

| density | fps* | draws | tris | vs item 10 |
|---|---|---|---|---|
| Rural 6×6 | 3 | 221 | 12.6k | +12 draws (richer large-bldg meshes), tris flat |
| Semi-urban 8×8 | 5 | 259 | 23.7k | +13 draws, tris flat |
| Metro 10×10 | 4 | 329 | 56.2k | +13 draws, −2.2k tris |
| Dense metro 12×12 | 4 | 367 | 75.4k | +16 draws, **−10.9k tris**, fps 1→4 |

\*SwiftShader — noise, see caveat at top.

Rural/Semi building **placement** is still byte-identical (the
`METRO_DENSITY` gate holds, `buildingBudget` is 1.0 at the high tier);
the small draw rise there is only the three large buildings' new mesh
count. Dense metro drops ~11k triangles (86.3k → 75.4k) — the
`buildingBudget` gate — landing between the item-8 pre-density baseline
(68k) and the item-9/10 peak, and fps recovers.

Visually (Metro + Dense, night): the spike field is gone — towers are
chunky slabs with a real mix of heights and roof shapes; the mall shows
a podium + two slabs + antenna, the stadium a green tiered bowl with
corner masts, the factory a shed with chimneys. Rural small buildings
unchanged.

Committed as: `fix(kawasan-3d): tame item 9-10 spike towers, give large
buildings real massing, gate Dense density`.

## Why four separate bugs surfaced in Phases E-F, and none in A-D

Worth calling out as a pattern, not just listing each fix separately:
every one of them was invisible to "does `npm run build` pass" and three
of the four were invisible to "does the screenshot look plausible at a
glance" too (the perf-HUD bug LOOKED like an improvement — fewer draws
reported — until I noticed the number was implausibly small; the blank
screenshots and SSAO speckle both needed a second run or a pixel-level
crop to catch). All four only became visible once Phases E/F introduced
multi-pass rendering (EffectComposer) — Phases A-D each did one thing to
the scene's geometry/materials and rendered it in the same single pass
the app always used, so there was no seam for these classes of bug to
hide in. The general lesson I'm taking from this into anything similar
later: multi-pass rendering changes the contract for anything that reads
back from the renderer (perf counters, canvas screenshots, timing) even
when it doesn't change a single line of scene-content code, and that
contract change is worth checking for explicitly rather than assuming
"I only touched the post-processing stack" means "nothing else could
have broken."
