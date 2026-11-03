extends "res://main.gd"
## Dewan Rakyat / Dewan Undangan Negeri — the chamber for the swearing-in.
##
## Westminster layout: the Speaker's chair on a dais at the north end, the
## clerks' table with the mace, government benches on the Speaker's right
## (west) and the opposition on his left (east), green carpet, and an oath
## lectern in the aisle. Every seat of the house is a coloured place on the
## benches: the player's party, coalition partners, then the opposition.
## Extra world-state fields:
##   chamberName, partyName, totalSeats, ownSeats, governmentSeats,
##   ministers [{name, post}], headTitle

const ROW_LEN := 13.2
const SEAT_PITCH := 0.62
const BENCH_Z0 := -7.6

var seat_mm: MultiMeshInstance3D
var bench_seats: Array = []   # [side(-1 gov west / 1 opp east), row, slot, Vector3]
var minister_tags: Array[Label3D] = []
var ministers: Array = []
var house_label: Label3D
var built_total := -1
var seat_scale := 1.0

func _init() -> void:
	ROOMS = {
		"dewan": [-9.0, -10.0, 9.0, 7.0, "#1f4a2e", "DEWAN", "CHAMBER"],
		"lobi": [-9.0, 7.0, 9.0, 11.0, "#c9bfa8", "LOBI PARLIMEN", "PARLIAMENT LOBBY"],
	}
	FLOORS = {
		"dewan": ["carpet", "#1e5a34", "#3f8a5a", 0.9],
		"lobi": ["terrazzo", "#c9bfa8", "", 1.4],
	}
	INTERACT = {
		"oath": ["dewan", "IKRAR JAWATAN", "OATH OF OFFICE", Vector3(0, 1.95, -3.4), Vector3(0, 0, -2.5), Vector3(0, 0, -9)],
		"cabinet": ["dewan", "BARISAN KABINET", "CABINET LINE-UP", Vector3(-1.5, 2.35, 1.2), Vector3(-0.5, 0, 1.2), Vector3(-1.5, 0, 1.2)],
		"exit": ["lobi", "KELUAR", "LEAVE", Vector3(0, 2.5, 10.5), Vector3(0, 0, 9.8), Vector3(0, 0, 13)],
	}
	LOBBY_POINT = Vector3(0, 0, 5.6)
	INTRO_START = Vector3(0, 0, 13.4)
	door_pos = Vector3(0, 0, 11.0)
	wall_color = "#6b4a2e"
	interior_sun = 0.8
	overview_target = Vector3(0, 0.4, -1.6)
	overview_dist = Vector2(21.0, 29.0)

func _build_exterior() -> void:
	box(Vector3(70, 0.1, 60), Vector3(0, -0.11, 4), "#5f8a4a", false)
	floor_slab(-12, 11.0, 12, 16.0, "#d8d2c4", "luar", floor_mat("tiles", "#b8ad98", "#8a7f6c", 0.8))
	for i in 3:
		box(Vector3(8.0 - i * 1.0, 0.12, 0.5), Vector3(0, 0.06 + i * 0.12, 11.3 + i * 0.5), "#c9c0ae", false)
	for x in [-6.0, 6.0]:
		box(Vector3(0.09, 6.0, 0.09), Vector3(x, 3.0, 13.2), "#d7dbe0", false, 0.0, null, mat("#d7dbe0", 0.3, 0.7))
		plane(Vector2(1.8, 0.9), Vector3(x + 0.92, 5.45, 13.2), jalur, true, 0.0, null, true)
	for x in [-10.0, 10.0]:
		palm(Vector3(x, 0, 14.0))
	facade.append(box(Vector3(7.2, 0.9, 0.12), Vector3(0, 3.45, 11.12), "#0b1a2c", false))
	house_label = label("PARLIMEN MALAYSIA", Vector3(0, 3.5, 11.2), 84, Color("#f2b01e"), false)
	house_label.pixel_size = 0.0062
	house_label.no_depth_test = false
	facade.append(house_label)
	door_l = Node3D.new()
	door_r = Node3D.new()
	add_child(door_l)
	add_child(door_r)
	box(Vector3(1.4, 2.6, 0.08), Vector3(-0.7, 1.3, 11.0), "#5a3a1e", false, 0.0, door_l, mat("#5a3a1e", 0.5))
	box(Vector3(1.4, 2.6, 0.08), Vector3(0.7, 1.3, 11.0), "#5a3a1e", false, 0.0, door_r, mat("#5a3a1e", 0.5))

func _build_walls() -> void:
	wall_x(-10.0, -9.0, 9.0)
	wall_x(11.0, -9.0, 9.0, [[-1.4, 1.4]])
	wall_z(-9.0, -10.0, 11.0)
	wall_z(9.0, -10.0, 11.0)
	wall_x(7.0, -9.0, 9.0, [[-1.6, 1.6]])

func _build_furniture() -> void:
	# carpet runner down the aisle with a songket border
	var runner := plane(Vector2(2.0, 15.5), Vector3(0, 0.009, -1.2), Tex.songket())
	var rm := StandardMaterial3D.new()
	rm.albedo_texture = Tex.songket()
	rm.uv1_triplanar = true
	rm.uv1_scale = Vector3.ONE / 1.0
	rm.roughness = 0.95
	runner.material_override = rm
	# Speaker's dais, chair and emblem
	box(Vector3(4.0, 0.6, 2.0), Vector3(0, 0.3, -9.0), "#5a3a1e", true, 0.0, null, mat("#5a3a1e", 0.5))
	box(Vector3(1.1, 0.5, 0.9), Vector3(0, 0.85, -9.1), "#1e5a34", false)
	box(Vector3(1.1, 2.4, 0.2), Vector3(0, 1.8, -9.5), "#4a2e16", false, 0.0, null, mat("#4a2e16", 0.4))
	box(Vector3(1.3, 0.16, 0.24), Vector3(0, 3.05, -9.5), "#c9a227", false, 0.0, null, mat("#c9a227", 0.3, 0.7))
	var emblem := cyl(0.7, 0.04, Vector3(0, 3.9, -9.88), "#c9a227")
	emblem.rotation.x = PI / 2
	emblem.material_override = mat("#c9a227", 0.3, 0.7, "#6a5010", 0.6)
	var star := cyl(0.32, 0.05, Vector3(0, 3.9, -9.84), "#ffcc00")
	star.rotation.x = PI / 2
	(star.mesh as CylinderMesh).radial_segments = 14
	for x in [-2.6, 2.6]:
		box(Vector3(0.05, 3.2, 0.05), Vector3(x, 1.6, -9.6), "#c9b26a", false)
		plane(Vector2(1.0, 0.5), Vector3(x + (0.52 if x < 0 else -0.52), 2.9, -9.6), jalur, true, 0.0, null, true)
	# clerks' table with the mace (cokmar)
	box(Vector3(1.5, 0.78, 3.4), Vector3(0, 0.39, -6.0), "#5a3a1e", true, 0.0, null, mat("#5a3a1e", 0.45))
	box(Vector3(1.6, 0.04, 3.5), Vector3(0, 0.8, -6.0), "#1e5a34", false)
	var mace := cyl(0.05, 1.5, Vector3(0, 0.88, -6.0), "#c9a227")
	mace.rotation.x = PI / 2
	mace.material_override = mat("#c9a227", 0.25, 0.8, "#6a5010", 0.5)
	sphere(0.12, Vector3(0, 0.9, -6.8), "#c9a227").material_override = mat("#c9a227", 0.25, 0.8)
	chair(Vector3(-0.45, 0, -7.9), PI, "#1e5a34")
	chair(Vector3(0.45, 0, -7.9), PI, "#1e5a34")
	# oath lectern in the aisle
	box(Vector3(0.7, 1.1, 0.5), Vector3(0, 0.55, -3.4), "#5a3a1e", true, 0.0, null, mat("#5a3a1e", 0.45))
	box(Vector3(0.75, 0.04, 0.6), Vector3(0, 1.12, -3.35), "#c9a227", false, 0.0, null, mat("#c9a227", 0.3, 0.6))
	# wood panelling and portraits on the north wall
	portrait(Vector3(-4.2, 2.6, -9.9))
	portrait(Vector3(4.2, 2.6, -9.9))
	plane(Vector2(14.0, 0.5), Vector3(0, 0.6, -9.91), Tex.ukiran(), true)
	# public gallery rail at the south end
	box(Vector3(17.6, 1.0, 0.2), Vector3(0, 0.5, 6.4), "#4a2e16", false)
	for x in range(-8, 9, 2):
		chair(Vector3(x * 1.0 + 0.5, 0, 6.75), PI, "#7a2f3a")
	_build_benches(222)

## Long benches either side of the aisle, sized for the house.
var bench_nodes: Array[Node3D] = []

func _build_benches(total: int, gov := -1) -> void:
	total = max(2, total)
	if gov < 0:
		gov = int(ceil(total / 2.0))
	# each side must hold its bloc: a landslide needs a longer government bench
	var per_side: int = max(gov, total - gov) + 4
	var key := total * 1000 + per_side
	if key == built_total:
		return
	built_total = key
	for n in bench_nodes:
		n.queue_free()
	bench_nodes.clear()
	var per_row: int = int(floor(ROW_LEN / SEAT_PITCH))
	var rows: int = clamp(int(ceil(per_side / float(per_row))), 2, 7)
	if rows * per_row < per_side:
		per_row = int(ceil(per_side / float(rows)))
	bench_seats.clear()
	var pitch := ROW_LEN / float(per_row)
	seat_scale = clamp(pitch * 0.8 / 0.5, 0.4, 1.0)
	for side in [-1, 1]:
		for r in rows:
			var x: float = side * (2.2 + r * 0.95)
			var h := 0.12 + r * 0.12
			# raked floor step, bench desk and seat line
			var step := box(Vector3(0.95, h, ROW_LEN + 0.4), Vector3(x, h / 2.0, BENCH_Z0 + ROW_LEN / 2.0), "#4a2e16", true, 0.0, null, mat("#4a2e16", 0.5))
			var desk := box(Vector3(0.12, 0.62, ROW_LEN), Vector3(x - side * 0.4, h + 0.31, BENCH_Z0 + ROW_LEN / 2.0), "#5a3a1e", false, 0.0, null, mat("#5a3a1e", 0.45))
			bench_nodes.append(step.get_parent() as Node3D)
			bench_nodes.append(desk)
			for k in per_row:
				var z := BENCH_Z0 + pitch / 2.0 + k * pitch
				bench_seats.append([side, r, k, Vector3(x + side * 0.12, h, z)])
	# order: front rows first, from the Speaker's end
	bench_seats.sort_custom(func(a, b): return a[1] < b[1] or (a[1] == b[1] and a[2] < b[2]))
	if seat_mm:
		seat_mm.queue_free()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var bm := BoxMesh.new()
	bm.size = Vector3(0.5, 0.5, 0.5)
	var smat := StandardMaterial3D.new()
	smat.vertex_color_use_as_albedo = true
	smat.roughness = 0.6
	bm.material = smat
	mm.mesh = bm
	mm.instance_count = bench_seats.size()
	for i in bench_seats.size():
		var p: Vector3 = bench_seats[i][3]
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(1, 0.5, seat_scale)), p + Vector3(0, 0.36, 0)))
		mm.set_instance_color(i, Color("#24452f"))
	seat_mm = MultiMeshInstance3D.new()
	seat_mm.multimesh = mm
	add_child(seat_mm)

## Government seats fill the west benches (spilling east if needed), the
## opposition fills the east benches; empty places stay leather green.
func _paint(own: int, gov: int, total: int) -> void:
	if not seat_mm:
		return
	var west: Array = []
	var east: Array = []
	for i in bench_seats.size():
		(west if bench_seats[i][0] < 0 else east).append(i)
	var colours := {}
	var gov_list: Array = west.duplicate()
	var east_back := east.duplicate()
	east_back.reverse()
	gov_list.append_array(east_back)
	for n in min(gov, gov_list.size()):
		colours[gov_list[n]] = (player_color if n < own else Color("#e0a422")).darkened(0.12)
	var opp := total - gov
	var placed := 0
	for idx in east:
		if placed >= opp:
			break
		if colours.has(idx):
			continue
		colours[idx] = Color("#e8753a").darkened(0.08)
		placed += 1
	var mm := seat_mm.multimesh
	for i in bench_seats.size():
		mm.set_instance_color(i, colours.get(i, Color("#24452f")))

func _apply_state_extra(s: Dictionary) -> void:
	var total := int(s.get("totalSeats", 222))
	_build_benches(total, int(s.get("governmentSeats", -1)))
	_paint(int(s.get("ownSeats", 0)), int(s.get("governmentSeats", 0)), total)
	var chamber := String(s.get("chamberName", ""))
	if house_label and chamber != "":
		house_label.text = chamber.to_upper()
	var list = s.get("ministers", [])
	if typeof(list) == TYPE_ARRAY:
		for i in minister_tags.size():
			if i < list.size() and typeof(list[i]) == TYPE_DICTIONARY:
				minister_tags[i].text = "%s\n%s" % [String(list[i].get("name", "")), String(list[i].get("post", ""))]
				minister_tags[i].visible = true
			else:
				minister_tags[i].visible = false

func _apply_lang_extra() -> void:
	pass

func _spawn_cast() -> void:
	# the Speaker on the dais, clerks at the table
	var speaker: Node3D = spawn("pakcik", "sit", Vector3(0, 0.6, -9.0), 0.0)
	npcs.append(speaker)
	npcs.append(spawn("admin", "type", Vector3(-0.45, 0, -7.9), 0.0))
	npcs.append(spawn("aide", "type", Vector3(0.45, 0, -7.9), 0.0))
	# the new cabinet lined up beside the aisle, facing it
	var line := ["uncle", "makcik", "anak_muda", "pa_male", "aide"]
	for i in line.size():
		var p: Node3D = spawn(line[i], "stand", Vector3(-1.5, 0, -0.6 + i * 0.95), PI / 2)
		ministers.append(p)
		npcs.append(p)
		var tag := label("", p.position + Vector3(0, 2.05, 0), 26, Color("#ffe6a8"))
		tag.visible = false
		minister_tags.append(tag)
	pa = spawn(pa_model, "tablet", Vector3(1.4, 0, 3.6), -PI / 2)
	# members already in their seats
	var picks := [[-1, 0, 3, "uncle"], [-1, 0, 7, "pakcik"], [-1, 1, 5, "makcik"], [-1, 0, 12, "anak_muda"], [-1, 1, 15, "admin"],
		[1, 0, 2, "pakcik"], [1, 0, 6, "uncle"], [1, 1, 9, "anak_muda"], [1, 0, 13, "makcik"]]
	for pk in picks:
		for item in bench_seats:
			if item[0] == pk[0] and item[1] == pk[1] and item[2] == pk[2]:
				var pos: Vector3 = item[3]
				npcs.append(spawn(pk[3], "sit", Vector3(pos.x, pos.y, pos.z), PI / 2 if pk[0] < 0 else -PI / 2))
				break
	_spawn_player(LOBBY_POINT, PI)
