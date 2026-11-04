extends Node3D
## Cars driving on the left (Malaysian traffic) along the city's street
## polylines and the expressway. Street cars U-turn at a road's end; cars
## over a stretch of street dropped at the river are hidden. Bodies and
## cabins are two MultiMeshes that share one transform per car.

const MAX_CARS := 280

var car_count := MAX_CARS   # scales with the seat's street length

var city: Node3D
var cars := []   # {road (-1 = expressway), t, dir, speed, lane}
var body_mm := MultiMesh.new()
var cabin_mm := MultiMesh.new()


## Called after every city build: drops the previous seat's vehicles.
func setup(c: Node3D) -> void:
	city = c
	for ch in get_children():
		ch.free()
	cars = []
	trains = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	var lengths := []
	var total := 0.0
	for rd in city.roads:
		var L: float = rd.cum[rd.cum.size() - 1]
		lengths.append(L)
		total += L
	var hw_len: float = city.highway_curve.get_baked_length()
	car_count = clampi(int(total / 70.0), 30, MAX_CARS)
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
	body_mm = _mm(Vector3(4.3, 1.1, 1.9), true)
	cabin_mm = _mm(Vector3(2.3, 0.85, 1.7), false)
	var palette := [Color("e8e8e8"), Color("202326"), Color("b71c1c"), Color("9ea4a8"), Color("1e4f8a"), Color("f2f2f0"), Color("c9a227")]
	for i in car_count:
		body_mm.set_instance_color(i, palette[rng.randi() % palette.size()])
	_setup_trains(rng)


# ── LRT trains ───────────────────────────────────────────────────────
const TRAIN_CARS := 3
const CAR_LEN := 13.5
const LINE_COLOURS := [Color(0.85, 0.15, 0.2), Color(0.15, 0.35, 0.8)]

var trains := []     # {line, s, dir}
var train_body := MultiMesh.new()
var train_band := MultiMesh.new()


func _setup_trains(rng: RandomNumberGenerator) -> void:
	for li in city.lrt_curves.size():
		var L: float = city.lrt_curves[li].get_baked_length()
		for k in 4:
			trains.append({"line": li, "s": rng.randf() * L, "dir": 1.0 if k % 2 == 0 else -1.0})
	var n := trains.size() * TRAIN_CARS
	train_body = _train_mm(Vector3(CAR_LEN - 0.8, 3.0, 2.8), n, Color(0.95, 0.95, 0.96), false)
	train_band = _train_mm(Vector3(CAR_LEN - 0.7, 1.0, 2.86), n, Color.WHITE, true)
	for i in trains.size():
		for j in TRAIN_CARS:
			train_band.set_instance_color(i * TRAIN_CARS + j, LINE_COLOURS[trains[i].line % LINE_COLOURS.size()])


func _train_mm(size: Vector3, count: int, col: Color, colours: bool) -> MultiMesh:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.metallic = 0.3
	mat.roughness = 0.3
	if colours:
		mat.vertex_color_use_as_albedo = true
		mat.vertex_color_is_srgb = true
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = colours
	mm.mesh = mesh
	mm.instance_count = count
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	add_child(mmi)
	return mm


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
			var b := Basis(Vector3.UP, atan2(-fwd.z, fwd.x))
			train_body.set_instance_transform(i * TRAIN_CARS + j, Transform3D(b, p))
			train_band.set_instance_transform(i * TRAIN_CARS + j, Transform3D(b, p + Vector3(0, 0.45, 0)))


func _mm(size: Vector3, colours: bool) -> MultiMesh:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	if colours:
		mat.vertex_color_use_as_albedo = true
		mat.vertex_color_is_srgb = true
		mat.metallic = 0.4
		mat.roughness = 0.35
	else:
		mat.albedo_color = Color(0.12, 0.16, 0.2)
		mat.metallic = 0.6
		mat.roughness = 0.15
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = colours
	mm.mesh = mesh
	mm.instance_count = car_count
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	add_child(mmi)
	return mm


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
			c.t = fposmod(c.t + c.speed * 1.6 * c.dir * dt, hw_len)
			var p := hw.sample_baked(c.t)
			fwd = (hw.sample_baked(fposmod(c.t + c.dir * 2.0, hw_len)) - p).normalized()
			pos = p + Vector3(0, 0.3, 0)
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
		if hidden:
			pos.y = -50.0
		var b := Basis(Vector3.UP, atan2(-fwd.z, fwd.x))
		body_mm.set_instance_transform(i, Transform3D(b, pos + Vector3(0, 0.6, 0)))
		cabin_mm.set_instance_transform(i, Transform3D(b, pos + Vector3(0, 1.57, 0) + b * Vector3(-0.3, 0, 0)))
