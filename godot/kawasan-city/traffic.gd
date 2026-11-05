extends Node3D
## Cars driving on the left (Malaysian traffic) along the city's street
## polylines and the expressway. Street cars U-turn at a road's end; cars
## over a stretch of street dropped at the river are hidden.
## Each vehicle is one MeshInstance3D (body + cabin merged into one mesh
## with vertex colours). They used to be MultiMeshes updated every frame,
## but in the web (Compatibility) renderer that intermittently drew cars
## with other MultiMeshes' instance data: screen-sized slabs over the city.

const MAX_CARS := 380

var car_count := MAX_CARS   # scales with the seat's street length

var city: Node3D
var cars := []   # {road (-1 = expressway), t, dir, speed, lane}
var car_nodes: Array[MeshInstance3D] = []
var train_nodes: Array[MeshInstance3D] = []
var _veh_mat: StandardMaterial3D


## One mesh from several boxes: [size, centre, colour] each.
static func _boxes_mesh(parts: Array) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for part in parts:
		var bm := BoxMesh.new()
		bm.size = part[0]
		var arr := bm.get_mesh_arrays()
		var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var norms: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		for k in idx:
			st.set_color(part[2])
			st.set_normal(norms[k])
			st.add_vertex(verts[k] + part[1])
	return st.commit()


# ── vehicle models (box parts, +x is the front, wheels on the ground) ──
const GLASS := Color(0.16, 0.22, 0.28)
const TYRE := Color(0.07, 0.07, 0.08)
const LAMP := Color(1.0, 0.96, 0.82)
const TAIL := Color(0.85, 0.08, 0.06)


static func _wheels(len: float, wid: float, r: float) -> Array:
	var out := []
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			out.append([Vector3(r * 2.0, r * 2.0, 0.26), Vector3(sx * len * 0.31, r, sz * (wid * 0.5 - 0.06)), TYRE])
	return out


static func _lamps(len: float, wid: float, y: float) -> Array:
	return [
		[Vector3(0.06, 0.16, 0.34), Vector3(len * 0.5, y, -wid * 0.32), LAMP],
		[Vector3(0.06, 0.16, 0.34), Vector3(len * 0.5, y, wid * 0.32), LAMP],
		[Vector3(0.06, 0.14, 0.3), Vector3(-len * 0.5, y, -wid * 0.34), TAIL],
		[Vector3(0.06, 0.14, 0.3), Vector3(-len * 0.5, y, wid * 0.34), TAIL],
	]


## Saloon: body, glasshouse set back, roof panel; `roof` tints the roof (taxis).
static func _sedan(col: Color, roof: Color = Color(0, 0, 0, 0)) -> ArrayMesh:
	var top := col if roof.a == 0.0 else roof
	return _boxes_mesh([
		[Vector3(4.4, 0.62, 1.8), Vector3(0, 0.62, 0), col],
		[Vector3(4.5, 0.12, 1.84), Vector3(0, 0.36, 0), col.darkened(0.35)],
		[Vector3(2.3, 0.56, 1.64), Vector3(-0.25, 1.21, 0), GLASS],
		[Vector3(2.0, 0.08, 1.56), Vector3(-0.3, 1.53, 0), top],
	] + _wheels(4.4, 1.8, 0.34) + _lamps(4.4, 1.8, 0.7))


## Compact hatchback (kancil-sized): short, tall glasshouse to the back.
static func _compact(col: Color) -> ArrayMesh:
	return _boxes_mesh([
		[Vector3(3.5, 0.62, 1.62), Vector3(0, 0.6, 0), col],
		[Vector3(2.2, 0.6, 1.5), Vector3(-0.45, 1.21, 0), GLASS],
		[Vector3(2.0, 0.08, 1.44), Vector3(-0.5, 1.55, 0), col],
	] + _wheels(3.5, 1.62, 0.31) + _lamps(3.5, 1.62, 0.7))


## People-carrier: long tall cabin almost to the bonnet.
static func _mpv(col: Color) -> ArrayMesh:
	return _boxes_mesh([
		[Vector3(4.7, 0.75, 1.85), Vector3(0, 0.7, 0), col],
		[Vector3(3.5, 0.72, 1.72), Vector3(-0.4, 1.43, 0), GLASS],
		[Vector3(3.3, 0.09, 1.66), Vector3(-0.45, 1.83, 0), col],
	] + _wheels(4.7, 1.85, 0.36) + _lamps(4.7, 1.85, 0.8))


## Lorry: cab with windscreen and a cargo box.
static func _lorry(col: Color) -> ArrayMesh:
	return _boxes_mesh([
		[Vector3(1.9, 1.5, 2.2), Vector3(2.55, 1.15, 0), col],
		[Vector3(0.06, 0.6, 1.9), Vector3(3.52, 1.55, 0), GLASS],
		[Vector3(4.8, 2.4, 2.3), Vector3(-0.85, 1.75, 0), Color(0.92, 0.92, 0.9)],
		[Vector3(4.82, 0.3, 2.32), Vector3(-0.85, 1.1, 0), col],
		[Vector3(6.9, 0.3, 2.0), Vector3(0.15, 0.55, 0), Color(0.2, 0.2, 0.22)],
	] + _wheels(6.6, 2.1, 0.5) + _lamps(7.0, 2.2, 0.75))


## City bus: long body, window band, coloured skirt (Rapid-style livery).
static func _bus(col: Color) -> ArrayMesh:
	return _boxes_mesh([
		[Vector3(11.0, 2.7, 2.5), Vector3(0, 1.75, 0), Color(0.95, 0.95, 0.93)],
		[Vector3(11.02, 0.9, 2.52), Vector3(0, 2.05, 0), GLASS],
		[Vector3(11.02, 0.55, 2.52), Vector3(0, 0.75, 0), col],
		[Vector3(0.06, 1.0, 2.2), Vector3(5.52, 2.0, 0), GLASS],
		[Vector3(10.6, 0.2, 2.3), Vector3(0, 3.18, 0), Color(0.8, 0.8, 0.8)],
	] + _wheels(10.0, 2.5, 0.52) + _lamps(11.0, 2.5, 0.85))


func _vehicle_mat() -> StandardMaterial3D:
	if _veh_mat == null:
		_veh_mat = StandardMaterial3D.new()
		_veh_mat.vertex_color_use_as_albedo = true
		_veh_mat.vertex_color_is_srgb = true
		_veh_mat.metallic = 0.25
		_veh_mat.roughness = 0.45
	return _veh_mat


func _vehicle(mesh: Mesh) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = _vehicle_mat()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi


## Called after every city build: drops the previous seat's vehicles.
func setup(c: Node3D) -> void:
	city = c
	for ch in get_children():
		ch.free()
	cars = []
	trains = []
	car_nodes.clear()
	train_nodes.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var lengths := []
	var total := 0.0
	for rd in city.roads:
		var L: float = rd.cum[rd.cum.size() - 1]
		lengths.append(L)
		total += L
	var hw_len: float = city.highway_curve.get_baked_length()
	car_count = clampi(int(total / 45.0), 40, MAX_CARS)   # busier streets
	for i in car_count:
		var car := {"dir": 1.0 if rng.randf() < 0.5 else -1.0, "speed": rng.randf_range(9.0, 16.0)}
		if city.has_highway and rng.randf() < 0.22:
			car.road = -1
			car.t = rng.randf() * hw_len
			car.lane = 3.0 if rng.randf() < 0.5 else 7.5
		else:
			# pick a street weighted by its length
			var x := rng.randf() * total
			var idx := 0
			while idx < lengths.size() - 1 and x > lengths[idx]:
				x -= lengths[idx]
				idx += 1
			car.road = idx
			car.t = rng.randf() * lengths[idx]
			car.lane = city.roads[idx].half * 0.45
		cars.append(car)
	# a Malaysian street mix: compacts, sedans, MPVs, taxis, lorries, buses
	var palette := [Color("e8e8e8"), Color("202326"), Color("b71c1c"), Color("9ea4a8"), Color("1e4f8a"), Color("f2f2f0"), Color("c9a227"), Color("5b6b3a"), Color("8a4a2b")]
	var kinds := []   # [mesh, speed factor] per variant, weighted by repetition
	for col in palette:
		kinds.append([_sedan(col), 1.0])
		kinds.append([_compact(col), 1.05])
	for col in [Color("f2f2f0"), Color("9ea4a8"), Color("202326"), Color("1e4f8a")]:
		kinds.append([_mpv(col), 0.95])
	kinds.append([_sedan(Color("c62828"), Color("f5f5f5")), 1.0])     # taxi: red & white
	kinds.append([_sedan(Color("1aa39a"), Color("f2f2f0")), 1.0])     # teal e-hailing
	for col in [Color("1e5aa8"), Color("e0e0dc"), Color("c9a227")]:
		kinds.append([_lorry(col), 0.75])
	for col in [Color("d32f2f"), Color("1e88e5")]:
		kinds.append([_bus(col), 0.7])
	for i in car_count:
		var k: Array = kinds[rng.randi() % kinds.size()]
		car_nodes.append(_vehicle(k[0]))
		cars[i].speed *= k[1] * rng.randf_range(0.9, 1.1)
	_setup_trains(rng)


# ── LRT trains ───────────────────────────────────────────────────────
const TRAIN_CARS := 3
const CAR_LEN := 13.5
const LINE_COLOURS := [Color(0.85, 0.15, 0.2), Color(0.15, 0.35, 0.8)]

var trains := []     # {line, s, dir}


func _setup_trains(rng: RandomNumberGenerator) -> void:
	for li in city.lrt_curves.size():
		var L: float = city.lrt_curves[li].get_baked_length()
		for k in 4:
			trains.append({"line": li, "s": rng.randf() * L, "dir": 1.0 if k % 2 == 0 else -1.0})
	var meshes := []
	for col in LINE_COLOURS:
		meshes.append(_boxes_mesh([
			[Vector3(CAR_LEN - 0.8, 3.0, 2.8), Vector3.ZERO, Color(0.95, 0.95, 0.96)],
			[Vector3(CAR_LEN - 0.7, 1.0, 2.86), Vector3(0, 0.45, 0), col],
		]))
	for i in trains.size():
		for j in TRAIN_CARS:
			train_nodes.append(_vehicle(meshes[trains[i].line % meshes.size()]))


func _move_trains(dt: float) -> void:
	for i in trains.size():
		var tr: Dictionary = trains[i]
		var curve: Curve3D = city.lrt_curves[tr.line]
		var L := curve.get_baked_length()
		tr.s = fposmod(tr.s + 15.0 * tr.dir * dt, L)
		for j in TRAIN_CARS:
			var sj := fposmod(tr.s - tr.dir * j * CAR_LEN, L)
			var p := curve.sample_baked(sj)
			var fwd := (curve.sample_baked(fposmod(sj + tr.dir * 2.0, L)) - p).normalized()
			p += Vector3(fwd.z, 0, -fwd.x) * 1.5 + Vector3(0, city.LRT_Y + 1.3 + 1.6, 0)
			if not p.is_finite() or not fwd.is_finite() or fwd.length_squared() < 1e-6:
				p = Vector3(0, -50.0, 0)
				fwd = Vector3.RIGHT
			var b := Basis(Vector3.UP, atan2(-fwd.z, fwd.x))
			train_nodes[i * TRAIN_CARS + j].transform = Transform3D(b, p)
			train_nodes[i * TRAIN_CARS + j].visible = city.in_seat(p)


func _process(dt: float) -> void:
	if city == null or city.roads.is_empty():
		return
	_move_trains(dt)
	var hw: Curve3D = city.highway_curve
	var hw_len := hw.get_baked_length()
	for i in cars.size():
		var c: Dictionary = cars[i]
		var pos: Vector3
		var fwd: Vector3
		var hidden := false
		if c.road < 0:
			if hw_len <= 0.0:
				car_nodes[i].visible = false
				continue
			c.t = fposmod(c.t + c.speed * 1.6 * c.dir * dt, hw_len)
			var p := hw.sample_baked(c.t)
			fwd = (hw.sample_baked(fposmod(c.t + c.dir * 2.0, hw_len)) - p).normalized()
			pos = p + Vector3(0, 0.3, 0)
			# the expressway is only drawn inside the seat boundary
			hidden = not city.in_seat(p)
		else:
			var rd: Dictionary = city.roads[c.road]
			var L: float = rd.cum[rd.cum.size() - 1]
			c.t += c.speed * c.dir * dt
			if c.t > L:
				c.t = L
				c.dir = -1.0
			elif c.t < 0.0:
				c.t = 0.0
				c.dir = 1.0
			var sm: Array = city.road_sample(rd, c.t)
			pos = sm[0] + Vector3(0, 0.12, 0)
			fwd = sm[1] * c.dir
			hidden = rd.gaps[sm[2]] == 1
		# keep left: offset to the left of the direction of travel
		pos += Vector3(fwd.z, 0, -fwd.x) * c.lane
		# a degenerate road segment gives a NaN / zero heading: park the car
		# out of sight rather than hand the GPU a broken transform
		if not pos.is_finite() or not fwd.is_finite() or fwd.length_squared() < 1e-6:
			pos = Vector3(0, -50.0, 0)
			fwd = Vector3.RIGHT
		if hidden:
			pos.y = -50.0
		var want := atan2(-fwd.z, fwd.x)
		c.yaw = lerp_angle(float(c.get("yaw", want)), want, 1.0 - pow(0.002, dt))
		var b := Basis(Vector3.UP, c.yaw)
		var node := car_nodes[i]
		node.visible = not hidden
		if not hidden:
			node.transform = Transform3D(b, pos)
