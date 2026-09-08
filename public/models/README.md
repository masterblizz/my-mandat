# kawasan-3d building models

Drop low-poly **`.glb`** files here to upgrade a building type from a
coloured placeholder box to a real model. A type with no file keeps its box,
so you can add these one at a time.

**After adding a file, list its key in `manifest.json`** (`{ "models":
["house", "tower"] }`, or `"*"` once every type has one). The loader reads
that manifest — types not listed stay boxes. This keeps a modelless checkout
from firing a 404 per type.

**Variants (optional).** The few types instanced hundreds of times on a
dense grid (see `MODEL_VARIANT_COUNT` in `cityData.ts` — currently house,
terrace, kampung, shophouse, shop, stall, tower, skyscraper) can carry more
than one look so the skyline doesn't read as stamped clones. Drop
`house-2.glb`, `house-3.glb`, ... alongside `house.glb` and list them as
their own manifest keys: `{ "models": ["house", "house-2", "house-3"] }`.
Each building instance deterministically picks one variant (same instance
always gets the same one). Add variants incrementally — an unlisted
`house-2` is never fetched.

## Expected filenames

`app/kawasan-3d/cityData.ts` → `MODEL_MAP` is the source of truth. Current paths:

| file            | building type(s) it covers                    |
| --------------- | --------------------------------------------- |
| `house.glb`     | detached house                                |
| `terrace.glb`   | link/terrace house                            |
| `kampung.glb`   | kampung (stilt) house                         |
| `shophouse.glb` | pre-war shophouse                             |
| `shop.glb`      | modern shoplot                                |
| `stall.glb`     | market stall / hawker                         |
| `tower.glb`     | mid-rise office tower                         |
| `skyscraper.glb`| high-rise                                     |
| `antenna.glb`   | telco / broadcast mast                        |
| `factory.glb`   | factory                                       |
| `warehouse.glb` | warehouse                                     |
| `school.glb`    | school                                        |
| `clinic.glb`    | clinic                                        |
| `masjid.glb`    | mosque / surau                               |
| `mall.glb`      | shopping mall                                 |
| `stadium.glb`   | stadium                                       |
| `terminal.glb`  | bus terminal                                  |

`sawah` / `pond` / `field` / `plaza` are flat ground cover — no model needed.

## Model conventions (the loader normalises, but these help)

- **+Y up.** Base of the building at or near `y = 0` (loader drops it to the
  ground either way).
- Roughly **centred on X/Z**. Real-ish proportions — the loader scales each
  instance non-uniformly to the game's footprint/height, so a model that's
  already close to the right aspect ratio distorts least.
- **One mesh, one material** is ideal. Multiple meshes are merged into one
  geometry (instancing needs a single geometry); multiple materials collapse
  to the first one, so bake colour into vertex colours or a small atlas if
  you need more than one.
- Keep them **low-poly** (hundreds of tris, not thousands) — every type is
  instanced hundreds of times at the dense-metro grid size.
- No Draco/meshopt compression unless you also wire the decoder.

## Licensing

Only commit assets you have the right to redistribute — CC0 (e.g. Kenney.nl,
Poly Pizza CC0), or with a LICENSE/attribution file alongside them here.
