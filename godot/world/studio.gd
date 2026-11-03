extends "res://main.gd"
## Studio Malam Keputusan — election night as a 3D TV studio.
##
## The broadcast studio (anchor desk, LED wall with the live tally, a 3D
## hemicycle that fills seat by seat) sits next to the party's watch room,
## where the player waits with supporters who cheer every seat won and
## erupt when a majority is called. The page's count drives everything;
## extra world-state fields:
##   partyName, tally {mandat, lawan, others}, declared, totalSeats,
##   majority, scopeLabel, current {seat, state, winner, result}, call

const HEMI_CENTER := Vector3(-3.0, 0.0, 1.2)
const HEMI_RADIUS := 3.0

var seat_mm: MultiMeshInstance3D
var seat_total := 0
var wall := {}            # name -> Label3D
var supporters: Array = []
var last_mandat := 0
var last_call := ""
var confetti: CPUParticles3D
var party_name := "MANDAT"
var orbit := true
var _seat_angles: Array = []
var majority_line: MeshInstance3D

func _init() -> void:
	ROOMS = {
		"studio": [-11.0, -7.0, 5.0, 6.0, "#10161f", "STUDIO SIARAN", "BROADCAST STUDIO"],
		"parti": [5.0, -7.0, 12.0, 6.0, "#2a2018", "BILIK GERAKAN PARTI", "PARTY WATCH ROOM"],
	}
	FLOORS = {
		"studio": ["carpet", "#121a26", "#24344a", 1.2],
		"parti": ["parquet", "#7a5034", "", 1.2],
	}
	INTERACT = {}
	LOBBY_POINT = Vector3(8.4, 0, 1.6)
	INTRO_START = Vector3(6.2, 0, 4.0)
	door_pos = Vector3(100, 0, 100)
	wall_color = "#1a2230"
	interior_sun = 0.45
	overview_target = Vector3(-0.5, 1.2, -1.6)
	overview_dist = Vector2(19.5, 27.0)

func _build_exterior() -> void:
	box(Vector3(60, 0.1, 50), Vector3(0, -0.11, 0), "#0b0f16", false)

func _build_walls() -> void:
	wall_x(-7.0, -11.0, 12.0)
	wall_x(6.0, -11.0, 12.0)
	wall_z(-11.0, -7.0, 6.0)
	wall_z(12.0, -7.0, 6.0)
	wall_z(5.0, -7.0, 6.0, [[-1.0, 3.0]])

func _build_furniture() -> void:
	# ── LED wall ──
	box(Vector3(14.4, 3.4, 0.12), Vector3(-3.0, 2.25, -6.88), "#05080d", false)
	box(Vector3(14.0, 3.1, 0.02), Vector3(-3.0, 2.25, -6.8), "#081a2e", false, 0.0, null, mat("#081a2e", 0.4, 0.0, "#0c2a4a", 0.9))
	box(Vector3(14.0, 0.06, 0.03), Vector3(-3.0, 3.82, -6.78), "#19d3f2", false, 0.0, null, mat("#19d3f2", 0.3, 0.0, "#19d3f2", 1.6))
	box(Vector3(14.0, 0.06, 0.03), Vector3(-3.0, 0.68, -6.78), "#f2b01e", false, 0.0, null, mat("#f2b01e", 0.3, 0.0, "#f2b01e", 1.6))
	wall["title"] = _wall_label(Vector3(-3.0, 3.5, -6.77), 70, Color("#f2b01e"))
	wall["mandat"] = _wall_label(Vector3(-7.6, 2.35, -6.77), 210, player_color)
	wall["mandat_name"] = _wall_label(Vector3(-7.6, 1.35, -6.77), 50, Color.WHITE)
	wall["lawan"] = _wall_label(Vector3(-3.0, 2.35, -6.77), 210, Color("#ff8a3d"))
	wall["lawan_name"] = _wall_label(Vector3(-3.0, 1.35, -6.77), 50, Color.WHITE)
	wall["others"] = _wall_label(Vector3(1.6, 2.35, -6.77), 210, Color("#8b9bb0"))
	wall["others_name"] = _wall_label(Vector3(1.6, 1.35, -6.77), 50, Color.WHITE)
	wall["declared"] = _wall_label(Vector3(-3.0, 0.95, -6.77), 44, Color("#19d3f2"))
	# ── anchor desk ──
	for k in 5:
		var a := -0.5 + k * 0.25
		box(Vector3(1.3, 0.95, 0.6), Vector3(-3.0 + sin(a) * 2.2, 0.475, -3.8 + cos(a) * 0.6 - 0.6), "#0e2236", true, a, null, mat("#0e2236", 0.3, 0.3))
	box(Vector3(5.6, 0.06, 0.12), Vector3(-3.0, 0.98, -3.25), "#19d3f2", false, 0.0, null, mat("#19d3f2", 0.3, 0.0, "#19d3f2", 1.5))
	chair(Vector3(-4.0, 0, -4.7), 0.0, "#1b2230")
	chair(Vector3(-2.0, 0, -4.7), 0.0, "#1b2230")
	var logo := label("SIARAN LANGSUNG", Vector3(-3.0, 0.6, -3.22), 54, Color("#f2b01e"), false)
	logo.no_depth_test = false
	logo.outline_size = 0
	room_labels["__live"] = logo
	# ── hemicycle stage ──
	cyl(HEMI_RADIUS + 0.6, 0.12, HEMI_CENTER + Vector3(0, 0.06, 0), "#0a1420")
	# ── studio cameras and light rigs ──
	for p in [Vector3(-9.0, 0, 3.8), Vector3(3.0, 0, 4.2)]:
		box(Vector3(0.08, 1.3, 0.08), p + Vector3(0, 0.65, 0), "#333", false)
		box(Vector3(0.35, 0.3, 0.6), p + Vector3(0, 1.45, 0), "#1b1b1b", false)
		var tally := sphere(0.04, p + Vector3(0, 1.65, 0.22), "#ff2b2b")
		tally.material_override = mat("#ff2b2b", 0.3, 0.0, "#ff2b2b", 2.0)
	for x in [-9.0, -5.0, -1.0, 3.0]:
		var spot := SpotLight3D.new()
		spot.position = Vector3(x, 4.3, 2.0)
		spot.rotation = Vector3(deg_to_rad(-58), 0, 0)
		spot.light_energy = 2.2
		spot.light_color = Color("#fff1dc")
		spot.spot_range = 12.0
		spot.spot_angle = 32.0
		add_child(spot)
		box(Vector3(0.3, 0.3, 0.4), Vector3(x, 4.25, 2.0), "#111", false)
	# ── party watch room ──
	box(Vector3(0.1, 1.6, 3.0), Vector3(11.9, 1.8, -0.5), "#05080d", false)
	box(Vector3(0.02, 1.4, 2.8), Vector3(11.84, 1.8, -0.5), "#0d2f4a", false, 0.0, null, mat("#0d2f4a", 0.4, 0.0, "#123a5c", 0.9))
	wall["tv"] = _wall_label(Vector3(11.82, 1.9, -0.5), 80, Color.WHITE, -PI / 2)
	wall["tv_sub"] = _wall_label(Vector3(11.82, 1.35, -0.5), 34, Color("#f2b01e"), -PI / 2)
	party_mat = StandardMaterial3D.new()
	party_mat.albedo_color = player_color
	party_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var banner := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(5.6, 0.7, 0.03)
	banner.mesh = bm
	banner.material_override = party_mat
	banner.position = Vector3(8.5, 2.6, -6.88)
	add_child(banner)
	wall["banner"] = _wall_label(Vector3(8.5, 2.6, -6.85), 64, Color.WHITE)
	for i in 12:
		var pen := MeshInstance3D.new()
		var pr := PrismMesh.new()
		pr.size = Vector3(0.3, 0.36, 0.01)
		pen.mesh = pr
		pen.material_override = party_mat if i % 2 == 0 else mat("#ffffff")
		pen.position = Vector3(5.6 + i * 0.52, 3.35 - 0.18 * sin(PI * (i + 0.5) / 12.0), 2.0)
		pen.rotation.z = PI
		add_child(pen)
	box(Vector3(2.2, 0.42, 0.9), Vector3(7.0, 0.21, 4.8), "#3b2a20", true)
	box(Vector3(2.2, 0.42, 0.9), Vector3(10.2, 0.21, 4.8), "#3b2a20", true)
	box(Vector3(1.2, 0.74, 0.7), Vector3(8.6, 0.37, -4.8), "#a88a64", true)
	for k in 3:
		cyl(0.045, 0.1, Vector3(8.3 + k * 0.3, 0.79, -4.8), "#b07a45", region)
	plane(Vector2(4.0, 2.6), Vector3(8.6, 0.008, 1.0), Tex.songket_rug())
	plane(Vector2(0.9, 0.45), Vector3(5.6, 3.2, -6.86), jalur, true)
	plant(Vector3(11.4, 0, 5.4))
	plant(Vector3(5.6, 0, -6.4))
	# confetti burst for the majority call
	confetti = CPUParticles3D.new()
	confetti.position = Vector3(8.5, 3.6, 0.5)
	confetti.emitting = false
	confetti.one_shot = true
	confetti.amount = 260
	confetti.lifetime = 3.2
	confetti.explosiveness = 0.85
	confetti.direction = Vector3(0, -1, 0)
	confetti.spread = 75.0
	confetti.initial_velocity_min = 1.5
	confetti.initial_velocity_max = 4.0
	confetti.gravity = Vector3(0, -2.2, 0)
	confetti.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	confetti.emission_box_extents = Vector3(3.0, 0.2, 2.5)
	var cm := QuadMesh.new()
	cm.size = Vector2(0.07, 0.04)
	var cmat := StandardMaterial3D.new()
	cmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	cmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	cmat.vertex_color_use_as_albedo = true
	cm.material = cmat
	confetti.mesh = cm
	var grad := Gradient.new()
	grad.colors = PackedColorArray([Color("#f2b01e"), Color("#19d3f2"), Color("#ffffff"), Color("#cc0001")])
	grad.offsets = PackedFloat32Array([0.0, 0.33, 0.66, 1.0])
	confetti.color_initial_ramp = grad
	add_child(confetti)
	_build_hemicycle(222)
	# soft fill so the studio floor reads, plus a warm lamp in the watch room
	for p in [Vector3(-7.0, 3.0, -1.0), Vector3(1.0, 3.0, -1.0), Vector3(8.5, 2.8, 0.5)]:
		var fill := OmniLight3D.new()
		fill.position = p
		fill.light_color = Color("#9fc4ff") if p.x < 5 else Color("#ffe2b5")
		fill.light_energy = 1.1
		fill.omni_range = 8.0
		add_child(fill)

func _wall_label(pos: Vector3, size: int, color: Color, rot_y := 0.0) -> Label3D:
	var l := label("", pos, size, color, false)
	l.no_depth_test = false
	l.outline_size = 0
	l.rotation.y = rot_y
	return l

## Seats in rows that grow with the radius, ordered left to right by angle,
## drawn with one MultiMesh so a full Dewan stays cheap.
func _build_hemicycle(total: int) -> void:
	total = max(1, total)
	if seat_mm and seat_total == total:
		return
	seat_total = total
	if seat_mm:
		seat_mm.queue_free()
	var rows: int = clamp(int(round(sqrt(total / 4.2))), 2, 9)
	var inner := 0.5 if rows <= 3 else 0.36
	var radii: Array[float] = []
	var sum := 0.0
	for i in rows:
		var r := inner + (1.0 - inner) * i / float(max(1, rows - 1))
		radii.append(r)
		sum += r
	var counts: Array[int] = []
	var placed := 0
	for i in rows:
		var c: int = max(1, int(round(total * radii[i] / sum)))
		counts.append(c)
		placed += c
	var k := rows - 1
	while placed != total:
		var step := 1 if placed < total else -1
		if counts[k] + step >= 1:
			counts[k] += step
			placed += step
		k = (k - 1 + rows) % rows
	var seats: Array = []
	for i in rows:
		for j in counts[i]:
			var a: float = PI / 2.0 if counts[i] == 1 else PI - PI * j / float(counts[i] - 1)
			seats.append([a, radii[i]])
	seats.sort_custom(func(x, y): return x[0] > y[0] or (x[0] == y[0] and x[1] < y[1]))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var sm := SphereMesh.new()
	var gap := (1.0 - inner) * HEMI_RADIUS / float(max(1, rows - 1))
	sm.radius = clamp(gap * 0.36, 0.05, 0.2)
	sm.height = sm.radius * 2.0
	sm.radial_segments = 10
	sm.rings = 5
	var smat := StandardMaterial3D.new()
	smat.vertex_color_use_as_albedo = true
	smat.emission_enabled = true
	smat.emission_energy_multiplier = 0.0
	sm.material = smat
	mm.mesh = sm
	mm.instance_count = total
	for i in total:
		var a: float = seats[i][0]
		var r: float = seats[i][1] * HEMI_RADIUS
		# the open side of the chamber faces the camera (+z)
		var pos := HEMI_CENTER + Vector3(cos(a) * r, 0.14 + sm.radius, -sin(a) * r)
		mm.set_instance_transform(i, Transform3D(Basis(), pos))
		mm.set_instance_color(i, Color(0.16, 0.2, 0.26))
	seat_mm = MultiMeshInstance3D.new()
	seat_mm.multimesh = mm
	add_child(seat_mm)
	_seat_angles = []
	for item in seats:
		_seat_angles.append(item[0])

## A gold spoke from the centre to the edge at the majority seat.
func _place_majority_line(majority: int) -> void:
	if _seat_angles.is_empty():
		return
	var i: int = clamp(majority - 1, 0, _seat_angles.size() - 1)
	var a: float = _seat_angles[i]
	if not majority_line:
		majority_line = MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.05, 0.03, HEMI_RADIUS + 0.4)
		majority_line.mesh = bm
		majority_line.material_override = mat("#f2b01e", 0.3, 0.0, "#f2b01e", 1.8)
		add_child(majority_line)
	var mid := (HEMI_RADIUS + 0.4) / 2.0
	majority_line.position = HEMI_CENTER + Vector3(cos(a) * mid, 0.14, -sin(a) * mid)
	majority_line.rotation.y = atan2(cos(a), -sin(a))

func _paint_seats(t: Dictionary) -> void:
	if not seat_mm:
		return
	var m := int(t.get("mandat", 0))
	var l := int(t.get("lawan", 0))
	var o := int(t.get("others", 0))
	var mm := seat_mm.multimesh
	for i in seat_total:
		var c := Color(0.16, 0.2, 0.26)
		if i < m:
			c = player_color
		elif i >= seat_total - l:
			c = Color("#ff8a3d")
		elif i < m + o:
			c = Color("#8b9bb0")
		mm.set_instance_color(i, c)

func _apply_state_extra(s: Dictionary) -> void:
	party_name = String(s.get("partyName", party_name))
	var total := int(s.get("totalSeats", 222))
	var majority := int(s.get("majority", total / 2 + 1))
	_build_hemicycle(total)
	_place_majority_line(majority)
	var t: Dictionary = s.get("tally", {})
	_paint_seats(t)
	var m := int(t.get("mandat", 0))
	var l := int(t.get("lawan", 0))
	var o := int(t.get("others", 0))
	var en := lang == "en"
	var scope := String(s.get("scopeLabel", ""))
	wall["title"].text = ("ELECTION NIGHT" if en else "MALAM KEPUTUSAN") + ("  ·  " + scope if scope != "" else "")
	wall["mandat"].text = str(m)
	wall["mandat"].modulate = player_color
	wall["mandat_name"].text = party_name
	wall["lawan"].text = str(l)
	wall["lawan_name"].text = "LAWAN"
	wall["others"].text = str(o)
	wall["others_name"].text = "OTHERS" if en else "LAIN-LAIN"
	wall["declared"].text = "%d / %d %s  ·  %s %d" % [int(s.get("declared", m + l + o)), total, "DECLARED" if en else "DIUMUMKAN", "MAJORITY" if en else "MAJORITI", majority]
	wall["banner"].text = party_name
	var cur: Dictionary = s.get("current", {})
	if not cur.is_empty():
		wall["tv"].text = String(cur.get("seat", "")).to_upper()
		wall["tv_sub"].text = "%s · %s" % [String(cur.get("state", "")), String(cur.get("winner", ""))]
	else:
		wall["tv"].text = party_name
		wall["tv_sub"].text = "WAITING FOR THE FIRST BOX" if en else "MENUNGGU PETI PERTAMA"
	if room_labels.has("__live"):
		room_labels["__live"].text = "LIVE" if en else "SIARAN LANGSUNG"
	# supporters react: one cheers for every seat won; all of them, with
	# confetti, when the party crosses the majority line
	if m > last_mandat and supporters.size() > 0:
		supporters[randi() % supporters.size()].cheer(1.3)
	last_mandat = m
	var call := String(s.get("call", ""))
	if call != last_call:
		last_call = call
		if call == "mandat":
			for p in supporters:
				p.cheer(3.5)
			if player:
				player.cheer(3.5)
			confetti.restart()
			confetti.emitting = true

func _process(delta: float) -> void:
	if orbit and not follow_player:
		yaw_goal += delta * 0.045
	super(delta)

func _unhandled_input(event: InputEvent) -> void:
	# any touch or drag stops the slow broadcast orbit
	if event is InputEventMouseButton or event is InputEventScreenTouch or event is InputEventScreenDrag:
		orbit = false
	super(event)

func _spawn_cast() -> void:
	pa = spawn(pa_model, "type", Vector3(-4.0, 0, -4.7), 0.0)
	npcs.append(spawn("aide", "type", Vector3(-2.0, 0, -4.7), 0.0))
	npcs.append(spawn("anak_muda", "stand", Vector3(-9.0, 0, 4.5), PI - 0.3))
	for item in [["makcik", Vector3(7.2, 0, 0.4)], ["pakcik", Vector3(9.8, 0, 0.6)], ["uncle", Vector3(7.8, 0, 2.6)], ["anak_muda", Vector3(10.2, 0, 2.4)], ["admin", Vector3(9.0, 0, -1.6)]]:
		var p: Node3D = spawn(item[0], "stand", item[1], PI / 2 + randf_range(-0.4, 0.4))
		supporters.append(p)
		npcs.append(p)
	_spawn_player(LOBBY_POINT, PI / 2)
