"""Blender script: low-poly but leafy trees for the Godot world.

Exports, into the given directory:
  tree_broadleaf.glb  rain-tree style: forked trunk, branches, a canopy of
                      several lumpy leaf clusters (displaced icospheres)
  tree_palm.glb       oil palm / coconut: ringed, slightly bent trunk and
                      drooping fronds with leaflets, a fruit bunch
  shrub.glb           a lumpy bush
Colours are vertex colours with per-face variation (no textures).
Run: python trees.py <out_dir>
Also importable: build_broadleaf(bm, col, pos, scale) etc. for landscape.py.
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector, noise

BARK = (0.52, 0.40, 0.30)
LEAF = [(0.36, 0.62, 0.28), (0.44, 0.70, 0.30), (0.30, 0.55, 0.25), (0.50, 0.72, 0.34)]
PALM = [(0.46, 0.70, 0.30), (0.52, 0.76, 0.34), (0.40, 0.64, 0.28)]


def _paint(face, col, rgb, jitter=0.12):
    k = 1.0 + random.uniform(-jitter, jitter)
    c = tuple(max(0.0, min(1.0, v * k)) for v in rgb) + (1.0,)
    for loop in face.loops:
        loop[col] = c


def cylinder(bm, col, a, b, r0, r1, sides=6, rgb=BARK):
    axis = (b - a)
    length = axis.length
    if length < 1e-4:
        return
    z = axis.normalized()
    x = z.orthogonal().normalized()
    y = z.cross(x)
    ring0 = [bm.verts.new(a + (x * math.cos(t) + y * math.sin(t)) * r0) for t in [k * math.tau / sides for k in range(sides)]]
    ring1 = [bm.verts.new(b + (x * math.cos(t) + y * math.sin(t)) * r1) for t in [k * math.tau / sides for k in range(sides)]]
    for k in range(sides):
        f = bm.faces.new((ring0[k], ring0[(k + 1) % sides], ring1[(k + 1) % sides], ring1[k]))
        _paint(f, col, rgb, 0.08)


def blob(bm, col, centre, radius, palette, seed, squash=0.78):
    """A leaf cluster: an icosphere with noisy, faceted displacement."""
    res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0, matrix=Matrix.Identity(4))
    verts = res["verts"]
    s = Vector((seed * 1.7, seed * 0.3, seed * 2.9))
    for v in verts:
        d = v.co.normalized()
        bump = 1.0 + 0.32 * noise.noise(d * 2.2 + s) + 0.12 * noise.noise(d * 6.0 + s)
        v.co = centre + Vector((d.x * radius, d.y * radius, d.z * radius * squash)) * bump
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        shade = palette[random.randrange(len(palette))]
        # underside darker, top lit
        up = (f.calc_center_median() - centre).normalized().z
        k = 0.78 + 0.3 * max(0.0, up)
        _paint(f, col, tuple(c * k for c in shade), 0.1)


def build_broadleaf(bm, col, base, scale=1.0):
    h = 3.4 * scale
    lean = Vector((random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), 0))
    top = base + Vector((0, 0, h)) + lean * scale
    cylinder(bm, col, base, top, 0.22 * scale, 0.14 * scale)
    # forked branches with a leaf cluster at each tip, plus a crown cluster
    n = random.randint(3, 4)
    tips = []
    for k in range(n):
        a = k * math.tau / n + random.uniform(-0.4, 0.4)
        out = Vector((math.cos(a), math.sin(a), 0)) * random.uniform(1.0, 1.6) * scale
        tip = top + out + Vector((0, 0, random.uniform(0.6, 1.3) * scale))
        cylinder(bm, col, top, tip, 0.11 * scale, 0.05 * scale, 5)
        tips.append(tip)
    seed = random.random() * 50
    for i, tip in enumerate(tips):
        blob(bm, col, tip + Vector((0, 0, 0.3 * scale)), random.uniform(1.0, 1.35) * scale, LEAF, seed + i)
    blob(bm, col, top + Vector((0, 0, 1.6 * scale)), 1.5 * scale, LEAF, seed + 9, 0.7)


def build_palm(bm, col, base, scale=1.0):
    h = random.uniform(4.2, 5.6) * scale
    bend = Vector((random.uniform(-0.5, 0.5), random.uniform(-0.5, 0.5), 0)) * scale
    segs = 7
    prev = base
    for i in range(1, segs + 1):
        t = i / segs
        p = base + Vector((0, 0, h * t)) + bend * (t * t)
        r = (0.2 - 0.06 * t) * scale
        cylinder(bm, col, prev, p, r * 1.08, r, 6, (0.42, 0.34, 0.24) if i % 2 else (0.34, 0.27, 0.19))
        prev = p
    crown = prev
    # fronds: a drooping spine with leaflets on both sides
    fronds = 11
    for k in range(fronds):
        a = k * math.tau / fronds + random.uniform(-0.15, 0.15)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0))
        length = random.uniform(2.6, 3.4) * scale
        rise = random.uniform(0.2, 0.9)
        pts = []
        for j in range(6):
            t = j / 5
            pts.append(crown + d * length * t + Vector((0, 0, (rise * t - 1.9 * t * t) * scale)))
        colr = PALM[random.randrange(len(PALM))]
        for j in range(5):
            p0, p1 = pts[j], pts[j + 1]
            w0 = 0.55 * scale * math.sin(math.pi * (j + 0.3) / 5.5)
            w1 = 0.55 * scale * math.sin(math.pi * (j + 1.3) / 5.5)
            droop = Vector((0, 0, -0.18 * scale))
            for sgn in (-1, 1):
                v = [bm.verts.new(p0), bm.verts.new(p1), bm.verts.new(p1 + side * w1 * sgn + droop), bm.verts.new(p0 + side * w0 * sgn + droop)]
                f = bm.faces.new(v if sgn > 0 else list(reversed(v)))
                _paint(f, col, colr, 0.14)
    # fruit bunch
    blob(bm, col, crown + Vector((0, 0, -0.35 * scale)), 0.38 * scale, [(0.55, 0.30, 0.12), (0.45, 0.24, 0.10)], random.random() * 9, 1.0)


def build_shrub(bm, col, base, scale=1.0):
    seed = random.random() * 30
    for i in range(3):
        off = Vector((random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), 0)) * scale
        blob(bm, col, base + off + Vector((0, 0, 0.45 * scale)), random.uniform(0.45, 0.65) * scale, LEAF, seed + i, 0.8)


def blob_lo(bm, col, centre, radius, palette, seed, squash=0.8):
    res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=Matrix.Identity(4))
    s = Vector((seed * 1.7, seed * 0.3, seed * 2.9))
    for v in res["verts"]:
        d = v.co.normalized()
        bump = 1.0 + 0.3 * noise.noise(d * 2.0 + s)
        v.co = centre + Vector((d.x * radius, d.y * radius, d.z * radius * squash)) * bump
    for f in {f for v in res["verts"] for f in v.link_faces}:
        up = (f.calc_center_median() - centre).normalized().z
        _paint(f, col, tuple(c * (0.78 + 0.3 * max(0.0, up)) for c in palette[random.randrange(len(palette))]), 0.12)


def build_far_broadleaf(bm, col, base, scale=1.0):
    """Distant hill tree: trunk + two lumpy canopy lobes (~90 faces)."""
    top = base + Vector((0, 0, 3.0 * scale))
    cylinder(bm, col, base, top, 0.2 * scale, 0.14 * scale, 5)
    blob_lo(bm, col, top + Vector((0.5, 0.2, 0.9)) * scale, 1.6 * scale, LEAF, 1.0)
    blob_lo(bm, col, top + Vector((-0.6, -0.3, 1.3)) * scale, 1.3 * scale, LEAF, 4.0)


def build_far_palm(bm, col, base, scale=1.0):
    """Distant palm: trunk + seven drooping fronds (~60 faces)."""
    crown = base + Vector((0.3, 0.1, 4.6)) * scale
    cylinder(bm, col, base, crown, 0.2 * scale, 0.15 * scale, 5, (0.40, 0.32, 0.22))
    for k in range(7):
        a = k * math.tau / 7
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0))
        p0 = crown
        p1 = crown + d * 1.6 * scale + Vector((0, 0, 0.3 * scale))
        p2 = crown + d * 3.0 * scale + Vector((0, 0, -0.9 * scale))
        colr = PALM[k % len(PALM)]
        for q0, q1, w in ((p0, p1, 0.5), (p1, p2, 0.35)):
            for sgn in (-1, 1):
                v = [bm.verts.new(q0), bm.verts.new(q1), bm.verts.new(q1 + side * w * scale * sgn + Vector((0, 0, -0.2 * scale))), bm.verts.new(q0 + side * w * scale * sgn + Vector((0, 0, -0.2 * scale)))]
                f = bm.faces.new(v if sgn > 0 else list(reversed(v)))
                _paint(f, col, colr, 0.14)


def export(name, builder, out_dir, seed):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(seed)
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Col")
    builder(bm, col, Vector((0, 0, 0)), 1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    attrs = me.color_attributes
    attrs.active_color = attrs[0]
    attrs.render_color_index = 0
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    mat = bpy.data.materials.new(name + "VC")
    mat.use_nodes = True
    nt = mat.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    me.materials.append(mat)
    path = os.path.join(out_dir, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_vertex_color="ACTIVE", export_materials="EXPORT")
    print("EXPORTED", path, len(me.polygons))


if __name__ == "__main__":
    out = sys.argv[-1] if os.path.isdir(sys.argv[-1]) else "."
    export("tree_broadleaf", build_broadleaf, out, 3)
    export("tree_palm", build_palm, out, 5)
    export("shrub", build_shrub, out, 7)
    export("tree_far_broadleaf", build_far_broadleaf, out, 11)
    export("tree_far_palm", build_far_palm, out, 13)
