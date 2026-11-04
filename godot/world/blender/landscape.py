"""Blender script: the rolling Malaysian landscape around every Godot world
location (rubber/oil-palm hills, forested ridges, red laterite cuts).

Run headless with the bpy module or Blender itself:
    python landscape.py ../assets/landscape.glb
    blender -b -P landscape.py -- ../assets/landscape.glb

The centre (where a building and its street sit) is left flat and below
the location's own ground slab; hills rise from ~45 m out. Colours are
baked into vertex colours (no textures) so the file stays small.
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Vector, noise

OUT = sys.argv[-1] if sys.argv[-1].endswith(".glb") else "landscape.glb"
random.seed(16)

SIZE_X, SIZE_Z = 260.0, 230.0      # metres
RES = 1.5                           # grid spacing
FLAT_R = 30.0                       # flat radius around the lot
RISE = 34.0                         # metres over which hills grow in
CENTER_Y = -0.35                    # below every location's ground slab


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def height(x, z):
    """Game coordinates: x east, z south (the camera looks from +z)."""
    d = math.hypot(x / 1.15, z if z < 0 else z * 0.8)
    t = max(0.0, min(1.0, (d - FLAT_R) / RISE))
    t = t * t * (3 - 2 * t)
    # keep the street side low so hills never block the camera's view
    front = max(0.0, min(1.0, (z - 14.0) / 18.0))
    t *= 1.0 - 0.8 * front
    p = Vector((x * 0.014, z * 0.014, 0.0))
    ridge = 1.0 - abs(noise.noise(p * 0.8))          # ridged ranges
    hills = noise.fractal(p, 0.6, 2.1, 5) * 0.5 + 0.5
    detail = noise.fractal(p * 5.0, 0.75, 2.2, 4)
    crisp = abs(noise.noise(p * 14.0))
    h = (ridge ** 1.8) * 17.0 + hills * 9.0 + detail * 2.6 + crisp * 1.4
    # a far mountain line behind and beside the lot
    far = max(0.0, (d - 70.0) / 25.0) * (1.0 - front)
    h += far * far * 9.0 * (0.6 + 0.4 * noise.noise(p * 0.5))
    return CENTER_Y + t * h


def colour(h, slope, x, z):
    p = Vector((x * 0.05, z * 0.05, 0.0))
    n = noise.noise(p) * 0.5 + 0.5
    grass = (0.42, 0.60, 0.31)
    palm = (0.34, 0.54, 0.26)
    forest = (0.24, 0.45, 0.23)
    earth = (0.70, 0.46, 0.31)     # laterite cut
    rock = (0.60, 0.58, 0.52)
    if h < 1.5:
        c = grass
    elif h < 9.0:
        # plantation rows: banded light/dark
        band = 0.5 + 0.5 * math.sin(x * 0.9 + z * 0.35)
        c = tuple(palm[i] * (0.85 + 0.25 * band) for i in range(3))
    else:
        c = forest
    if slope > 1.25:
        c = earth if n > 0.55 else rock
    shade = 0.86 + 0.24 * n + random.uniform(-0.05, 0.05)
    return tuple(min(1.0, v * shade) for v in c) + (1.0,)


def _activate_colours(me):
    """The glTF exporter writes COLOR_0 from the active colour attribute."""
    attrs = me.color_attributes
    if len(attrs):
        attrs.active_color = attrs[0]
        attrs.render_color_index = 0


def build_terrain():
    nx, nz = int(SIZE_X / RES), int(SIZE_Z / RES)
    bm = bmesh.new()
    verts = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            x = -SIZE_X / 2 + i * RES
            z = -SIZE_Z / 2 + j * RES
            row.append(bm.verts.new((x, -z, height(x, z))))   # Blender Z-up; glTF export converts
        verts.append(row)
    for j in range(nz):
        for i in range(nx):
            # wound so the normals face up after the z flip below
            bm.faces.new((verts[j][i], verts[j + 1][i], verts[j + 1][i + 1], verts[j][i + 1]))
    bm.normal_update()
    col = bm.loops.layers.color.new("Col")
    for f in bm.faces:
        slope = 1.0 - abs(f.normal.z)
        for loop in f.loops:
            v = loop.vert.co
            loop[col] = colour(v.z - CENTER_Y, slope * 3.2, v.x, -v.y)
    me = bpy.data.meshes.new("Landscape")
    bm.to_mesh(me)
    bm.free()
    _activate_colours(me)
    obj = bpy.data.objects.new("Landscape", me)
    bpy.context.collection.objects.link(obj)
    # thin it out where it is flat; keep the ridgelines
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.decimate_type = "DISSOLVE"
    mod.angle_limit = math.radians(1.2)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in me.polygons:
        p.use_smooth = False
    return obj


def tree(bm, col, pos, kind, scale):
    """Low-poly tree into bm: trunk + crown (palm = fronds, else a cone)."""
    x, y, zz = pos
    trunk_c = (0.50, 0.38, 0.27, 1.0)
    crown_c = (0.24, 0.47, 0.24, 1.0) if kind == "forest" else (0.36, 0.60, 0.28, 1.0)
    h = (3.2 if kind == "palm" else 2.0) * scale
    r = 0.18 * scale
    sides = 5
    ring0, ring1 = [], []
    for k in range(sides):
        a = k * math.tau / sides
        ring0.append(bm.verts.new((x + math.cos(a) * r, y + math.sin(a) * r, zz)))
        ring1.append(bm.verts.new((x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.7, zz + h)))
    faces = [bm.faces.new((ring0[k], ring0[(k + 1) % sides], ring1[(k + 1) % sides], ring1[k])) for k in range(sides)]
    for f in faces:
        for loop in f.loops:
            loop[col] = trunk_c
    cr = (2.0 if kind == "forest" else 1.2) * scale
    top = zz + h + (1.6 if kind == "forest" else 0.4) * scale
    base_z = zz + h - (0.8 if kind == "forest" else 0.2) * scale
    ring = []
    n = 7
    for k in range(n):
        a = k * math.tau / n + random.random() * 0.3
        rr = cr * (0.85 + random.random() * 0.3)
        ring.append(bm.verts.new((x + math.cos(a) * rr, y + math.sin(a) * rr, base_z)))
    apex = bm.verts.new((x, y, top))
    shade = 0.8 + random.random() * 0.4
    c = tuple(min(1.0, v * shade) for v in crown_c[:3]) + (1.0,)
    for k in range(n):
        f = bm.faces.new((ring[k], ring[(k + 1) % n], apex))
        for loop in f.loops:
            loop[col] = c


def place_trees():
    """Dense forest on the hills, written as instance placements for Godot's
    MultiMesh (assets/landscape_trees.json): [x, y, z, scale, yaw, kind]
    in game coordinates (y up), kind 0 = broadleaf, 1 = palm."""
    import json
    out = []
    for _ in range(40000):
        x = random.uniform(-SIZE_X / 2 + 3, SIZE_X / 2 - 3)
        z = random.uniform(-SIZE_Z / 2 + 3, SIZE_Z / 2 - 3)
        d = math.hypot(x / 1.15, z if z < 0 else z * 0.8)
        if d < FLAT_R + 2:
            continue
        h = height(x, z) - CENTER_Y
        if h < 0.8:
            continue
        clump = noise.noise(Vector((x * 0.05, z * 0.05, 3.0))) * 0.5 + 0.5
        if random.random() > min(1.0, h / 6.0) * (0.35 + 0.65 * clump):
            continue
        kind = 1 if h < 4.0 and random.random() < 0.5 else 0
        out.append([round(x, 2), round(height(x, z) - 0.15, 2), round(z, 2), round(random.uniform(0.9, 1.6), 2), round(random.uniform(0, math.tau), 2), kind])
        if len(out) >= 4500:
            break
    path = os.path.join(os.path.dirname(OUT), "landscape_trees.json")
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    return len(out)


def material():
    mat = bpy.data.materials.new("LandscapeVC")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.95
    return mat


if __name__ == "__main__":
    clear()
    land = build_terrain()
    m = material()
    land.data.materials.append(m)
    n = place_trees()
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", export_apply=True,
        export_vertex_color="ACTIVE", export_normals=True, export_materials="EXPORT",
    )
    print("EXPORTED", OUT, "faces", len(land.data.polygons), "trees", n)
