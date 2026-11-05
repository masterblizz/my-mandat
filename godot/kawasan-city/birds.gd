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
			"alt": rng.randf_range(90.0, 150.0), "speed": rng.randf_range(0.035, 0.06) * (1.0 if f % 2 == 0 else -1.0),
			"phase": rng.randf() * TAU, "birds": [],
		}
		# egrets are white, mynas dark
		var col := Color(0.95, 0.95, 0.92) if f % 2 == 0 else Color(0.13, 0.12, 0.12)
		for i in n:
			var side := 0.0 if i == 0 else (-1.0 if i % 2 == 1 else 1.0)
			var row := ceili(i / 2.0)
			flock.birds.append(_bird(col, Vector3(-row * 3.2, rng.randf_range(-1.0, 1.0), side * row * 2.8), rng))
		flocks.append(flock)


## A small, stylised bird: a slim body and two thin swept wings (flat,
## tapered triangles) that flap from the shoulder — reads as a bird
## silhouette at any distance instead of a box.
func _bird(col: Color, off: Vector3, rng: RandomNumberGenerator) -> Dictionary:
	var root := Node3D.new()
	add_child(root)
	var body := MeshInstance3D.new()
	body.mesh = _body_mesh(col.darkened(0.08))
	body.material_override = _mat
	root.add_child(body)
	var wings := []
	for sz in [-1.0, 1.0]:
		var pivot := Node3D.new()
		pivot.position = Vector3(0.05, 0.02, sz * 0.08)
		root.add_child(pivot)
		var w := MeshInstance3D.new()
		w.mesh = _wing_mesh(col, sz)
		w.material_override = _mat
		pivot.add_child(w)
		wings.append(pivot)
	return {"node": root, "wl": wings[0], "wr": wings[1], "off": off, "size": rng.randf_range(0.9, 1.2), "flap": rng.randf_range(6.0, 8.0), "glide": rng.randf() * TAU}


func _tri_mesh(verts: PackedVector3Array, col: Color) -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	var cols := PackedColorArray()
	cols.resize(verts.size())
	cols.fill(col)
	arr[Mesh.ARRAY_COLOR] = cols
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m


## Wing: swept back and tapering to a point (x forward, z out to the side).
func _wing_mesh(col: Color, side: float) -> ArrayMesh:
	var z := side
	return _tri_mesh(PackedVector3Array([
		Vector3(0.35, 0, 0), Vector3(-0.3, 0, 0), Vector3(-0.55, 0, 1.7 * z),
		Vector3(0.35, 0, 0), Vector3(-0.55, 0, 1.7 * z), Vector3(0.05, 0, 0.9 * z),
	]), col)


## Body: a slim diamond (head forward, tail back) seen from above or below.
func _body_mesh(col: Color) -> ArrayMesh:
	return _tri_mesh(PackedVector3Array([
		Vector3(0.75, 0, 0), Vector3(0, 0.08, 0.12), Vector3(0, 0.08, -0.12),
		Vector3(0, 0.08, 0.12), Vector3(-0.7, 0, 0.18), Vector3(-0.7, 0, -0.18),
		Vector3(0, 0.08, 0.12), Vector3(-0.7, 0, -0.18), Vector3(0, 0.08, -0.12),
	]), col)


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


var cam: Camera3D

func _process(dt: float) -> void:
	if city == null:
		return
	if cam == null:
		cam = city.get_node_or_null("CameraRig/Camera3D")
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
			var ang := 0.05 if glide else sin(_t * flap + gph) * 0.55
			(b.wl as Node3D).rotation.x = ang
			(b.wr as Node3D).rotation.x = -ang
			node.position.y += sin(_t * flap * 0.5 + gph) * 0.25
			# right beside the camera a bird only blocks the view: hide it
			node.visible = cam == null or cam.global_position.distance_to(node.position) > 60.0
