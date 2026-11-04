"""Blender script: bake tileable surface textures for the Godot world.

For each material it builds a procedural Cycles shader (noise, voronoi,
waves) whose coordinates wrap round a torus, so the baked 512x512 image
tiles seamlessly, then bakes two maps:
  <name>_detail.png   greyscale detail, mean ~0.9, multiplied over the
                      object's own colour in Godot
  <name>_normal.png   tangent-space normal map
Run: python materials.py <out_dir>
"""
import math
import os
import sys

import bpy

OUT = sys.argv[-1] if os.path.isdir(sys.argv[-1]) else "."
RES = 512


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.render.bake.margin = 0
    bpy.ops.mesh.primitive_plane_add(size=2)
    plane = bpy.context.active_object
    return plane


def torus_coords(nt):
    """UV (0..1) -> a 4D point on a torus, so any 4D noise tiles."""
    uv = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs[0])
    out = []
    for axis in ("X", "Y"):
        ang = nt.nodes.new("ShaderNodeMath")
        ang.operation = "MULTIPLY"
        ang.inputs[1].default_value = math.tau
        nt.links.new(sep.outputs[axis], ang.inputs[0])
        c = nt.nodes.new("ShaderNodeMath"); c.operation = "COSINE"
        s = nt.nodes.new("ShaderNodeMath"); s.operation = "SINE"
        nt.links.new(ang.outputs[0], c.inputs[0])
        nt.links.new(ang.outputs[0], s.inputs[0])
        out += [c, s]
    vec = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(out[0].outputs[0], vec.inputs[0])
    nt.links.new(out[1].outputs[0], vec.inputs[1])
    nt.links.new(out[2].outputs[0], vec.inputs[2])
    return vec, out[3]          # vector + W


def noise(nt, vec, w, scale, detail=6.0, rough=0.6, kind="ShaderNodeTexNoise"):
    n = nt.nodes.new(kind)
    if kind == "ShaderNodeTexNoise":
        n.noise_dimensions = "4D"
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
    else:
        n.voronoi_dimensions = "4D"
    n.inputs["Scale"].default_value = scale
    nt.links.new(vec.outputs[0], n.inputs["Vector"])
    nt.links.new(w.outputs[0], n.inputs["W"])
    return n


def ramp(nt, src, a, b, lo=0.0, hi=1.0):
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].position = lo
    r.color_ramp.elements[0].color = (a, a, a, 1)
    r.color_ramp.elements[1].position = hi
    r.color_ramp.elements[1].color = (b, b, b, 1)
    nt.links.new(src, r.inputs[0])
    return r


def mix(nt, a, b, fac=0.5, op="MULTIPLY"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = op
    m.inputs["Factor"].default_value = fac
    nt.links.new(a, m.inputs[6])
    nt.links.new(b, m.inputs[7])
    return m.outputs[2]


def stretch(nt, vec, sx, sy, sz):
    """Scale the torus point per axis (grain direction)."""
    v = nt.nodes.new("ShaderNodeVectorMath")
    v.operation = "MULTIPLY"
    v.inputs[1].default_value = (sx, sy, sz)
    nt.links.new(vec.outputs[0], v.inputs[0])
    return v


def build(name, plane):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    outn = [n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"][0]
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], outn.inputs[0])
    vec, w = torus_coords(nt)

    if name == "plaster":
        a = noise(nt, vec, w, 3.0, 8, 0.65)
        b = noise(nt, vec, w, 14.0, 4, 0.5)
        col = mix(nt, ramp(nt, a.outputs[0], 0.6, 1.0, 0.3, 0.75).outputs[0], ramp(nt, b.outputs[0], 0.9, 1.0).outputs[0])
        height = b.outputs[0]
    elif name == "wood":
        sv = stretch(nt, vec, 1.0, 1.0, 1.0)
        waves = nt.nodes.new("ShaderNodeTexWave")
        waves.wave_type = "BANDS"; waves.bands_direction = "X"
        waves.inputs["Scale"].default_value = 3.0
        waves.inputs["Distortion"].default_value = 6.0
        waves.inputs["Detail"].default_value = 3.0
        nt.links.new(sv.outputs[0], waves.inputs["Vector"])
        g = noise(nt, vec, w, 40.0, 2, 0.5)
        col = mix(nt, ramp(nt, waves.outputs[0], 0.5, 1.0).outputs[0], ramp(nt, g.outputs[0], 0.85, 1.0).outputs[0])
        height = waves.outputs[0]
    elif name == "fabric":
        weave = nt.nodes.new("ShaderNodeTexChecker")
        weave.inputs["Scale"].default_value = 48.0
        uv = nt.nodes.new("ShaderNodeTexCoord")
        nt.links.new(uv.outputs["UV"], weave.inputs["Vector"])
        n2 = noise(nt, vec, w, 6.0, 6, 0.6)
        col = mix(nt, ramp(nt, weave.outputs["Fac"], 0.72, 1.0).outputs[0], ramp(nt, n2.outputs[0], 0.8, 1.0).outputs[0])
        height = weave.outputs["Fac"]
    elif name == "concrete":
        a = noise(nt, vec, w, 5.0, 10, 0.7)
        v = noise(nt, vec, w, 22.0, kind="ShaderNodeTexVoronoi")
        pits = ramp(nt, v.outputs["Distance"], 0.55, 1.0, 0.0, 0.12)
        col = mix(nt, ramp(nt, a.outputs[0], 0.58, 1.0, 0.25, 0.8).outputs[0], pits.outputs[0])
        height = a.outputs[0]
    elif name == "grass":
        # blades: fine streaks, clumped by voronoi, with dry patches
        blades = nt.nodes.new("ShaderNodeTexNoise")
        blades.noise_dimensions = "4D"
        blades.inputs["Scale"].default_value = 90.0
        blades.inputs["Detail"].default_value = 2.0
        st = stretch(nt, vec, 1.0, 1.0, 1.0)
        nt.links.new(st.outputs[0], blades.inputs["Vector"])
        nt.links.new(w.outputs[0], blades.inputs["W"])
        clumps = noise(nt, vec, w, 10.0, kind="ShaderNodeTexVoronoi")
        patches = noise(nt, vec, w, 3.0, 6, 0.6)
        c1 = mix(nt, ramp(nt, blades.outputs[0], 0.55, 1.0, 0.3, 0.7).outputs[0], ramp(nt, clumps.outputs["Distance"], 0.75, 1.0, 0.0, 0.6).outputs[0])
        col = mix(nt, c1, ramp(nt, patches.outputs[0], 0.8, 1.0, 0.35, 0.65).outputs[0])
        height = blades.outputs[0]
    else:  # metal: brushed streaks
        sv = stretch(nt, vec, 1.0, 1.0, 1.0)
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.noise_dimensions = "4D"
        n.inputs["Scale"].default_value = 60.0
        n.inputs["Detail"].default_value = 2.0
        nt.links.new(sv.outputs[0], n.inputs["Vector"])
        nt.links.new(w.outputs[0], n.inputs["W"])
        col = ramp(nt, n.outputs[0], 0.74, 1.0).outputs[0]
        height = n.outputs[0]

    nt.links.new(col, bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 3.0
    nt.links.new(height, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    plane.data.materials.clear()
    plane.data.materials.append(mat)
    return mat, nt


def bake(name, plane, mat, nt, kind):
    img = bpy.data.images.new(f"{name}_{kind}", RES, RES, alpha=False, float_buffer=False)
    if kind == "normal":
        img.colorspace_settings.name = "Non-Color"
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    nt.nodes.active = node
    bpy.context.view_layer.objects.active = plane
    plane.select_set(True)
    if kind == "detail":
        bpy.context.scene.render.bake.use_pass_direct = False
        bpy.context.scene.render.bake.use_pass_indirect = False
        bpy.context.scene.render.bake.use_pass_color = True
        bpy.ops.object.bake(type="DIFFUSE")
    else:
        bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")
    path = os.path.join(OUT, f"{name}_{kind}.png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    nt.nodes.remove(node)
    print("BAKED", path)


if __name__ == "__main__":
    names = sys.argv[-2].split(",") if len(sys.argv) > 2 and "," in sys.argv[-2] else ["plaster", "wood", "fabric", "concrete", "metal", "grass"]
    for name in names:
        plane = reset()
        mat, nt = build(name, plane)
        bake(name, plane, mat, nt, "detail")
        bake(name, plane, mat, nt, "normal")
