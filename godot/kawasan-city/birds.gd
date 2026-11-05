extends Node3D
## Flocks of birds over the city (egrets / mynas, stylised): each flock
## glides along its own wide loop above the town in a loose V, every bird
## flapping with its own rhythm and gliding now and then, bobbing a little.
## Rebuilt with each city so the loops follow the seat's size.

const FLOCKS := 4

var city: Node3D
var flocks := []   # {centre, rx, rz, alt, speed, phase, birds:[{node, wl, wr, off, flap, glide}]}
var _t := 0.0
var _mat: StandardMaterial3D


func setup(c: Node3D) -> void:
	city = c
	for ch in get_children():
		ch.free()
	flocks = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	if _mat == null:
		_mat = StandardMaterial3D.new()
		_mat.vertex_color_use_as_albedo = true
		_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_mat.roughness = 0.9
	var reach: float = city.r_city
	for f in FLOCKS:
		var n := rng.randi_range(5, 9)
		var flock := {
			"centre": Vector3(rng.randf_range(-0.3, 0.3), 0, rng.randf_range(-0.3, 0.3)) * reach,
			"rx": reach * rng.randf_range(0.45, 0.85), "rz": reach * rng.randf_range(0.35, 0.7),
			"alt": rng.randf_range(55.0, 120.0), "speed": rng.randf_range(0.035, 0.06) * (1.0 if f % 2 == 0 else -1.0),
			"phase": rng.randf() * TAU, "birds": [],
		}
		# egrets are white, mynas dark
		var col := Color(0.95, 0.95, 0.92) if f % 2 == 0 else Color(0.13, 0.12, 0.12)
		for i in n:
			var side := 0.0 if i == 0 else (-1.0 if i % 2 == 1 else 1.0)
			var row := ceili(i / 2.0)
			flock.birds.append(_bird(col, Vector3(-row * 5.5, rng.randf_range(-1.5, 1.5), side * row * 4.5), rng))
		flocks.append(flock)


func _bird(col: Color, off: Vector3, rng: RandomNumberGenerator) -> Dictionary:
	var root := Node3D.new()
	add_child(root)
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.6, 0.35, 0.4)
	body.mesh = bm
	body.material_override = _mat
	root.add_child(body)
	_tint(body, col.darkened(0.1))
	var wings := []
	for sz in [-1.0, 1.0]:
		var pivot := Node3D.new()
		pivot.position = Vector3(0.1, 0.05, sz * 0.2)
		root.add_child(pivot)
		var w := MeshInstance3D.new()
		var wm := BoxMesh.new()
		wm.size = Vector3(0.9, 0.06, 2.6)
		w.mesh = wm
		w.position = Vector3(0, 0, sz * 1.3)
		w.material_override = _mat
		_tint(w, col)
		pivot.add_child(w)
		wings.append(pivot)
	return {"node": root, "wl": wings[0], "wr": wings[1], "off": off, "size": rng.randf_range(1.6, 2.1), "flap": rng.randf_range(7.0, 9.5), "glide": rng.randf() * TAU}


## Per-bird colour without one material each: a vertex-coloured copy of the mesh.
func _tint(mi: MeshInstance3D, col: Color) -> void:
	var arr := (mi.mesh as PrimitiveMesh).get_mesh_arrays()
	var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray()
	cols.resize(n)
	cols.fill(col)
	arr[Mesh.ARRAY_COLOR] = cols
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	mi.mesh = am


func _process(dt: float) -> void:
	if city == null:
		return
	_t += dt
	for f in flocks:
		var a: float = f.phase + _t * f.speed
		var rx: float = f.rx
		var rz: float = f.rz
		var centre: Vector3 = f.centre
		var lead: Vector3 = centre + Vector3(cos(a) * rx, float(f.alt) + sin(_t * 0.4 + float(f.phase)) * 6.0, sin(a) * rz)
		# heading = derivative of the loop
		var s: float = signf(f.speed)
		var fwd := Vector3(-sin(a) * rx * s, 0, cos(a) * rz * s).normalized()
		var yaw := atan2(-fwd.z, fwd.x)
		var basis := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -0.12 * s)   # bank into the turn
		for b in f.birds:
			var node: Node3D = b.node
			var off: Vector3 = b.off
			node.transform = Transform3D(basis.scaled(Vector3.ONE * float(b.size)), lead + basis * off)
			# flap, with a glide every few seconds
			var glide := sin(_t * 0.7 + float(b.glide)) > 0.55
			var flap: float = b.flap
			var gph: float = b.glide
			var ang := 0.08 if glide else sin(_t * flap + gph) * 0.75
			(b.wl as Node3D).rotation.x = ang
			(b.wr as Node3D).rotation.x = -ang
			node.position.y += sin(_t * flap * 0.5 + gph) * 0.25
