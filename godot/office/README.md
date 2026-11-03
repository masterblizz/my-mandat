# Pusat Khidmat 3D (Godot 4.3)

The Sims-style office scene used by `/office`. Everything is generated in
`main.gd` (rooms, furniture, navmesh, camera, cutaway walls); `person.gd`
poses the MakeHuman cast and walks them procedurally (the GLBs have no
animation clips). The page bridge is documented at the top of `main.gd`
and in `app/office/GodotOffice.tsx`.

## Rebuild the web export

```bash
# 1. Godot 4.3 editor + the web "nothreads" export templates
#    (~/.local/share/godot/export_templates/4.3.stable/web_nothreads_{release,debug}.zip)
# 2. Cast models: public/office-cast/*.glb use meshopt compression, which
#    Godot's importer does not read. Decode them into godot/office/cast/
#    with gltf-transform (MeshoptDecoder + dequantize) before importing.
godot --headless --path godot/office --import
godot --headless --path godot/office -- --selftest      # every room reachable
godot --headless --path godot/office --export-release Web ../../public/godot/office/index.html
```

The export is single-threaded (no SharedArrayBuffer / COOP headers needed)
and uses the Compatibility renderer so it runs on WebGL2 phones and the
Android WebView. Without WebGL2 the page falls back to `Office3D.tsx`.
