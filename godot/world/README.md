# MY MANDAT 3D world (Godot 4.3)

Sims-style 3D locations embedded in the Next.js game. One web export serves
every location; the page picks one with `?scene=`:

| scene     | page                    | script        |
|-----------|-------------------------|---------------|
| `office`  | `/office`               | `main.gd`     |
| `warroom` | `/location/operations`  | `warroom.gd`  |
| `studio`  | `/results` (election night count) | `studio.gd` |
| `dewan`   | `/swearing-in` (chamber, oath) | `dewan.gd` |
| `party`   | `/location/party` (headquarters, candidate board) | `partyhq.gd` |
| `media`   | `/location/media` (press room, broadcast control, social desk) | `media.gd` |

`main.gd` is the base: rooms, textured floors, walls with Sims cutaway, a
navmesh baked at start-up, the camera, click-to-walk, the walk-in intro and
the page bridge. A new location extends it (`extends "res://main.gd"`),
sets its rooms/markers in `_init()` and overrides `_build_exterior`,
`_build_walls`, `_build_furniture` and `_spawn_cast`. `person.gd` poses and
walks the MakeHuman cast; `textures.gd` draws floors and Malaysian motifs.
`data/malaysia.json` holds the state polygons for the war-room map table
(converted from `public/malaysia.svg`).

Bridge: see the header of `main.gd` and `app/components/world/GodotWorld.tsx`.

## Rebuild the web export

```bash
# 1. Godot 4.3 editor + the web "nothreads" export templates
#    (~/.local/share/godot/export_templates/4.3.stable/web_nothreads_{release,debug}.zip)
# 2. Cast models: public/office-cast/*.glb use meshopt compression, which
#    Godot's importer does not read. Decode them into godot/world/cast/
#    with gltf-transform (MeshoptDecoder + dequantize) before importing.
godot --headless --path godot/world --import
godot --headless --path godot/world -- --scene=office --selftest
godot --headless --path godot/world -- --scene=warroom --selftest
godot --headless --path godot/world -- --scene=studio --selftest
godot --headless --path godot/world -- --scene=dewan --selftest
godot --headless --path godot/world -- --scene=party --selftest
godot --headless --path godot/world -- --scene=media --selftest
godot --headless --path godot/world --export-release Web ../../public/godot/world/index.html
```

The export is single-threaded (no SharedArrayBuffer / COOP headers needed)
and uses the Compatibility renderer, so it runs on WebGL2 phones and the
Android WebView. Without WebGL2 each page falls back to its light view.
