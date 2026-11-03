extends "res://main.gd"
## Pusat Operasi — the campaign war room as a Sims-style 3D building.
##
## Main operations floor with a 3D Malaysia map on the table (each state
## raised by MANDAT support and coloured by its race), a wall of screens,
## an analytics room, a briefing room and a security lobby. Clicking a
## state on the table opens that state's page; gold markers open the
## page's existing panels. Extra bridge fields in world-state:
##   states [{id, short, support, status, active}], seats, totalSeats,
##   majority, day, totalDays, headline
## and one extra event: {type:"world-state-click", id}.

const MAP_DATA := "res://data/malaysia.json"
const MAP_CENTER := Vector3(-3.5, 0.0, -3.2)
const MAP_SIZE := Vector2(9.0, 4.2)
const TABLE_TOP := 0.86

var map_polys := {}           # state id -> Array[PackedVector2Array] (table metres, x/z)
var map_meshes := {}          # state id -> MeshInstance3D
var map_bodies := {}          # state id -> StaticBody3D
var map_labels := {}          # state id -> Label3D
var map_info := {}            # state id -> last data from the page
var screen_labels := {}

func _init() -> void:
	ROOMS = {
		"gerakan": [-11.0, -8.0, 4.0, 2.5, "#1e2a3a", "BILIK GERAKAN UTAMA", "MAIN OPERATIONS FLOOR"],
		"analitik": [4.0, -8.0, 11.0, -0.5, "#243040", "BILIK ANALITIK", "ANALYTICS ROOM"],
		"taklimat": [4.0, -0.5, 11.0, 8.0, "#2a3a4f", "BILIK TAKLIMAT", "BRIEFING ROOM"],
		"lobi": [-11.0, 2.5, 4.0, 8.0, "#8f8a80", "LOBI KESELAMATAN", "SECURITY LOBBY"],
	}
	FLOORS = {
		"gerakan": ["carpet_tile", "#1c2838", "#3b5372", 1.0],
		"analitik": ["carpet", "#222d3d", "#46597a", 0.9],
		"taklimat": ["carpet", "#5a1a26", "#8a3a46", 0.9],
		"lobi": ["tiles", "#8f8a80", "#5f5a52", 0.6],
	}
	INTERACT = {
		"console": ["gerakan", "KONSOL OPERASI", "OPERATIONS CONSOLE", Vector3(-3.5, 1.75, -0.7), Vector3(-3.5, 0, -0.05), Vector3(-3.5, 0, -3.2)],
		"screens": ["gerakan", "DINDING PAPARAN", "SCREEN WALL", Vector3(-3.5, 3.55, -7.6), Vector3(-3.5, 0, -6.7), Vector3(-3.5, 0, -8.0)],
		"pa": ["gerakan", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(-9.4, 2.15, -3.2), Vector3(-9.4, 0, -1.9), Vector3(-9.4, 0, -3.2)],
		"analytics": ["analitik", "DATA TINJAUAN", "POLLING DATA", Vector3(7.5, 1.75, -5.6), Vector3(7.5, 0, -3.6), Vector3(7.5, 0, -5.6)],
		"briefing": ["taklimat", "TAKLIMAT JENTERA", "FIELD BRIEFING", Vector3(10.3, 2.6, 3.8), Vector3(8.4, 0, 3.8), Vector3(10.9, 0, 3.8)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(-4.0, 2.55, 7.4), Vector3(-4.0, 0, 6.4), Vector3(-4.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(-4.0, 0, 5.2)
	INTRO_START = Vector3(-1.4, 0, 10.9)
	door_pos = Vector3(-4.0, 0, 8.0)
	wall_color = "#3d4859"
	interior_sun = 0.72
	overview_target = Vector3(-2.0, 0, -2.6)
	overview_dist = Vector2(19.0, 27.0)

# ── building ─────────────────────────────────────────────────────────
func _build_exterior() -> void:
	box(Vector3(80, 0.1, 70), Vector3(0, -0.11, 2), "#5f8a4a", false)
	floor_slab(-14, 8.0, 14, 9.6, "#a9a59b", "luar", floor_mat("tiles", "#b9b1a2", "#8a8274", 0.5))
	floor_slab(-30, 9.6, 30, 14.5, "#3a3d43", "luar", floor_mat("carpet", "#3a3d43", "#5a5d63", 2.0))
	for i in 56:
		box(Vector3(0.5, 0.16, 0.22), Vector3(-14.0 + i * 0.5 + 0.25, 0.08, 9.62), "#f2f2ee" if i % 2 == 0 else "#1c1c1c", false)
	for x in range(-28, 30, 4):
		box(Vector3(1.8, 0.012, 0.14), Vector3(x, 0.006, 12.1), "#e8e2c8", false)
	for x in [-13.0, 13.0]:
		palm(Vector3(x, 0, 8.9))
	for x in [-9.5, -8.0, 0.5, 2.0, 6.5, 8.0]:
		bunga_raya(Vector3(x, 0, 8.5))
	# facade sign over the entrance
	facade.append(box(Vector3(6.4, 0.9, 0.12), Vector3(-4.0, 3.45, 8.12), "#0b1a2c", false))
	var sign := label("PUSAT OPERASI KEMPEN", Vector3(-4.0, 3.5, 8.2), 88, Color("#19d3f2"), false)
	sign.pixel_size = 0.0062
	sign.no_depth_test = false
	room_labels["__sign"] = sign
	facade.append(sign)
	facade.append(box(Vector3(3.8, 0.14, 1.4), Vector3(-4.0, 2.72, 8.7), "#20354a", false))
	# flagpole
	box(Vector3(0.09, 6.2, 0.09), Vector3(-9.0, 3.1, 9.0), "#d7dbe0", false, 0.0, null, mat("#d7dbe0", 0.3, 0.7))
	plane(Vector2(1.8, 0.9), Vector3(-8.08, 5.65, 9.0), jalur, true, 0.0, null, true)
	# party pennants across the frontage
	party_mat = StandardMaterial3D.new()
	party_mat.albedo_color = player_color
	party_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	for i in 26:
		var pen := MeshInstance3D.new()
		var pr := PrismMesh.new()
		pr.size = Vector3(0.36, 0.42, 0.01)
		pen.mesh = pr
		pen.material_override = party_mat if i % 3 != 2 else mat("#ffffff")
		pen.position = Vector3(-10.0 + i * 0.78, 3.3 - 0.3 * sin(PI * (i + 0.5) / 26.0), 9.25)
		pen.rotation.z = PI
		add_child(pen)
	# sliding glass doors
	door_l = Node3D.new()
	door_r = Node3D.new()
	add_child(door_l)
	add_child(door_r)
	var glass := mat("#9fd3ef", 0.05, 0.2)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(0.62, 0.83, 0.94, 0.32)
	box(Vector3(1.2, 2.5, 0.05), Vector3(-4.6, 1.25, 8.0), null, false, 0.0, door_l, glass)
	box(Vector3(1.2, 2.5, 0.05), Vector3(-3.4, 1.25, 8.0), null, false, 0.0, door_r, glass)

func _build_walls() -> void:
	wall_x(-8.0, -11.0, 11.0)
	wall_x(8.0, -11.0, 11.0, [[-5.2, -2.8]])
	wall_z(-11.0, -8.0, 8.0)
	wall_z(11.0, -8.0, 8.0)
	wall_x(2.5, -11.0, 4.0, [[-6.0, -2.0]])
	wall_z(4.0, -8.0, 8.0, [[-4.6, -3.0], [3.6, 5.1]])
	wall_x(-0.5, 4.0, 11.0)

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "PUSAT OPERASI KEMPEN" if lang == "ms" else "CAMPAIGN OPERATIONS CENTRE"

func _build_furniture() -> void:
	# ── main operations floor: the map table ──
	box(Vector3(MAP_SIZE.x + 0.8, TABLE_TOP, MAP_SIZE.y + 0.8), Vector3(MAP_CENTER.x, TABLE_TOP / 2.0, MAP_CENTER.z), "#121a26", true, 0.0, null, mat("#121a26", 0.35, 0.4))
	box(Vector3(MAP_SIZE.x + 0.9, 0.04, MAP_SIZE.y + 0.9), Vector3(MAP_CENTER.x, TABLE_TOP + 0.02, MAP_CENTER.z), "#0a2233", false, 0.0, null, mat("#0a2233", 0.2, 0.2, "#0b3f5c", 0.6))
	for side in [-1.0, 1.0]:
		box(Vector3(MAP_SIZE.x + 0.9, 0.03, 0.05), Vector3(MAP_CENTER.x, TABLE_TOP + 0.05, MAP_CENTER.z + side * (MAP_SIZE.y / 2.0 + 0.43)), "#19d3f2", false, 0.0, null, mat("#19d3f2", 0.3, 0.0, "#19d3f2", 1.6))
	_load_map()
	_build_map({})
	# screen wall on the north side
	for i in 3:
		var x := -9.0 + i * 5.5
		box(Vector3(4.6, 2.3, 0.1), Vector3(x, 2.1, -7.88), "#05080d", false)
		box(Vector3(4.4, 2.1, 0.02), Vector3(x, 2.1, -7.82), "#0d2f4a", false, 0.0, null, mat("#0d2f4a", 0.4, 0.0, ["#123a5c", "#0f4a3a", "#4a2a10"][i], 0.9))
		var title := label("", Vector3(x, 2.85, -7.79), 52, Color("#f2b01e"), false)
		title.no_depth_test = false
		title.outline_size = 0
		var body := label("", Vector3(x, 2.0, -7.79), 96, Color.WHITE, false)
		body.no_depth_test = false
		body.outline_size = 0
		body.width = 680
		body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		screen_labels[i] = [title, body]
	box(Vector3(14.0, 0.16, 0.03), Vector3(-3.5, 0.9, -7.84), "#c0392b", false, 0.0, null, mat("#c0392b", 0.4, 0.0, "#c0392b", 1.0))
	plane(Vector2(0.9, 0.45), Vector3(-10.4, 3.45, -7.85), jalur, true)
	portrait(Vector3(3.2, 3.4, -7.86))
	# operator consoles along the south of the floor
	for x in [-9.5, -7.0, 0.0, 2.5]:
		box(Vector3(1.8, 0.76, 0.8), Vector3(x, 0.38, 1.4), "#2a3442", true)
		box(Vector3(0.6, 0.36, 0.04), Vector3(x - 0.4, 1.0, 1.65), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, "#1b6fa0", 0.8))
		box(Vector3(0.6, 0.36, 0.04), Vector3(x + 0.4, 1.0, 1.65), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, "#1b8a5a", 0.8))
		chair(Vector3(x, 0, 0.6), PI)
	# volunteer whiteboard on the west wall
	box(Vector3(0.06, 1.3, 3.2), Vector3(-10.88, 1.55, -3.2), "#f7f7f2", false)
	for i in 12:
		box(Vector3(0.01, 0.2, 0.3), Vector3(-10.84, 1.95 - int(i / 4) * 0.36, -4.4 + (i % 4) * 0.8), ["#f5d76e", "#a8d8f0", "#f2a7a0"][i % 3], false)
	plant(Vector3(3.4, 0, -7.4))
	plant(Vector3(-10.4, 0, 1.9))

	# ── analytics ──
	for z in [-6.8, -4.9]:
		for x in [5.6, 7.5, 9.4]:
			box(Vector3(1.5, 0.76, 0.7), Vector3(x, 0.38, z), "#3a4656", true)
			box(Vector3(0.55, 0.34, 0.04), Vector3(x, 1.0, z - 0.25), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, "#2a74a8", 0.8))
	chair(Vector3(5.6, 0, -6.2), 0.0)
	chair(Vector3(9.4, 0, -4.3), 0.0)
	box(Vector3(0.05, 1.5, 3.0), Vector3(10.9, 1.7, -4.2), "#0b1a2c", false)
	for i in 6:
		var h: float = 0.3 + [0.55, 0.8, 0.45, 0.95, 0.7, 1.05][i]
		box(Vector3(0.04, h, 0.3), Vector3(10.86, 1.0 + h / 2.0, -5.4 + i * 0.48), ["#19d3f2", "#f2b01e"][i % 2], false, 0.0, null, mat(["#19d3f2", "#f2b01e"][i % 2], 0.4, 0.0, ["#19d3f2", "#f2b01e"][i % 2], 0.7))

	# ── briefing room ──
	box(Vector3(0.08, 1.7, 3.0), Vector3(10.9, 1.75, 3.8), "#05080d", false)
	box(Vector3(0.02, 1.5, 2.8), Vector3(10.85, 1.75, 3.8), "#123a5c", false, 0.0, null, mat("#123a5c", 0.4, 0.0, "#1d5a8a", 0.9))
	var bl := label("TAKLIMAT", Vector3(10.83, 2.2, 3.8), 70, Color("#f2b01e"), false)
	bl.rotation.y = -PI / 2
	bl.no_depth_test = false
	bl.outline_size = 0
	box(Vector3(0.5, 1.1, 0.6), Vector3(9.9, 0.55, 5.6), "#20354a", true)
	for row in 3:
		for k in 4:
			chair(Vector3(6.6 - row * 1.0, 0, 2.3 + k * 1.0), PI / 2, "#5a1a26")
	plane(Vector2(2.0, 1.2), Vector3(7.5, 1.7, 7.9), Tex.batik(), true, PI)

	# ── security lobby ──
	box(Vector3(2.4, 1.05, 0.7), Vector3(-8.0, 0.525, 6.0), "#2a3442", true)
	box(Vector3(2.5, 0.04, 0.8), Vector3(-8.0, 1.07, 6.0), "#cdbb98", false)
	for x in [-6.0, -2.0]:
		box(Vector3(0.25, 1.0, 0.8), Vector3(x, 0.5, 4.4), "#9aa3ad", true, 0.0, null, mat("#9aa3ad", 0.3, 0.6))
	# a small stand sign at the opening into the operations floor
	box(Vector3(0.06, 1.2, 0.06), Vector3(-1.4, 0.6, 3.2), "#59606a", false)
	box(Vector3(1.6, 0.5, 0.05), Vector3(-1.4, 1.35, 3.2), "#0b1a2c", false)
	var banner := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.6, 0.08, 0.06)
	banner.mesh = bm
	banner.material_override = party_mat
	banner.position = Vector3(-1.4, 1.64, 3.2)
	add_child(banner)
	var welcome := label("BILIK GERAKAN · AKSES TERHAD", Vector3(-1.4, 1.35, 3.235), 22, Color("#f2b01e"), false)
	welcome.width = 300
	welcome.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	welcome.no_depth_test = false
	welcome.outline_size = 0
	room_labels["__restricted"] = welcome
	box(Vector3(2.0, 0.42, 0.8), Vector3(1.8, 0.21, 6.9), "#3b4656", true)
	plant(Vector3(3.4, 0, 7.4))
	plant(Vector3(-10.4, 0, 7.4))
	plane(Vector2(3.2, 2.0), Vector3(-6.5, 0.008, 5.2), Tex.songket_rug())

	# night lighting + cyan glow over the map
	for id in ROOMS:
		var r: Array = ROOMS[id]
		var l := OmniLight3D.new()
		l.position = Vector3((r[0] + r[2]) / 2.0, 2.5, (r[1] + r[3]) / 2.0)
		l.light_color = Color("#ffe2b5")
		l.light_energy = 1.2
		l.omni_range = 7.5
		l.visible = false
		add_child(l)
		night_lights.append(l)
	for x in [-6.5, -0.5]:
		var glow := OmniLight3D.new()
		glow.position = Vector3(x, 2.2, MAP_CENTER.z)
		glow.light_color = Color("#5fd7ff")
		glow.light_energy = 0.9
		glow.omni_range = 5.0
		add_child(glow)

# ── 3D Malaysia map ──────────────────────────────────────────────────
func _load_map() -> void:
	var f := FileAccess.open(MAP_DATA, FileAccess.READ)
	if not f:
		return
	var data: Dictionary = JSON.parse_string(f.get_as_text())
	# Peninsular Malaysia is small next to Borneo; like the 2D war-room map,
	# give each landmass its own panel: peninsula left (enlarged), Borneo right.
	var groups := {"pen": [], "bor": []}
	for id in data:
		for poly in data[id]:
			var cx := 0.0
			for p in poly:
				cx += p[0]
			cx /= poly.size()
			groups["pen" if cx < 420.0 else "bor"].append([id, poly])
	var panels := {
		"pen": Rect2(MAP_CENTER.x - MAP_SIZE.x / 2.0, MAP_CENTER.z - MAP_SIZE.y / 2.0, MAP_SIZE.x * 0.34, MAP_SIZE.y),
		"bor": Rect2(MAP_CENTER.x - MAP_SIZE.x / 2.0 + MAP_SIZE.x * 0.38, MAP_CENTER.z - MAP_SIZE.y / 2.0, MAP_SIZE.x * 0.62, MAP_SIZE.y),
	}
	for g in groups:
		var lo := Vector2(INF, INF)
		var hi := Vector2(-INF, -INF)
		for item in groups[g]:
			for p in item[1]:
				lo = Vector2(min(lo.x, p[0]), min(lo.y, p[1]))
				hi = Vector2(max(hi.x, p[0]), max(hi.y, p[1]))
		var span := hi - lo
		var panel: Rect2 = panels[g]
		var sc: float = min(panel.size.x / span.x, panel.size.y / span.y) * 0.96
		var mid := (lo + hi) / 2.0
		var dest := panel.get_center()
		for item in groups[g]:
			var pts := PackedVector2Array()
			for p in item[1]:
				pts.append(Vector2((p[0] - mid.x) * sc + dest.x, (p[1] - mid.y) * sc + dest.y))
			if not map_polys.has(item[0]):
				map_polys[item[0]] = []
			map_polys[item[0]].append(pts)
	# a thin divider between the two panels, like an inset frame
	box(Vector3(0.03, 0.02, MAP_SIZE.y), Vector3(MAP_CENTER.x - MAP_SIZE.x / 2.0 + MAP_SIZE.x * 0.36, TABLE_TOP + 0.05, MAP_CENTER.z), "#19d3f2", false, 0.0, null, mat("#19d3f2", 0.3, 0.0, "#19d3f2", 1.2))

func _state_color(info: Dictionary) -> Color:
	if info.is_empty():
		return Color("#3a4f66")
	if not info.get("active", true):
		return Color("#2b3644")
	match String(info.get("status", "contested")):
		"winning":
			return player_color
		"losing":
			return Color("#e8603c")
		_:
			return Color("#f2b01e")

## (Re)build every state prism: height follows MANDAT support.
func _build_map(by_id: Dictionary) -> void:
	for id in map_polys:
		var info: Dictionary = by_id.get(id, map_info.get(id, {}))
		map_info[id] = info
		var support: float = float(info.get("support", 40.0))
		var h: float = 0.05 + clamp(support, 0.0, 100.0) / 100.0 * 0.4
		if not info.is_empty() and not info.get("active", true):
			h = 0.04
		var top := TABLE_TOP + 0.04
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var faces := PackedVector3Array()
		var biggest := PackedVector2Array()
		for poly in map_polys[id]:
			var pts: PackedVector2Array = poly
			if pts.size() > biggest.size():
				biggest = pts
			var idx := Geometry2D.triangulate_polygon(pts)
			if idx.is_empty():
				idx = Geometry2D.triangulate_polygon(Geometry2D.convex_hull(pts))
				pts = Geometry2D.convex_hull(pts)
			st.set_normal(Vector3.UP)
			for k in range(0, idx.size(), 3):
				for j in [k, k + 2, k + 1]:
					var v := Vector3(pts[idx[j]].x, top + h, pts[idx[j]].y)
					st.add_vertex(v)
					faces.append(v)
			# side walls
			var n := pts.size()
			for k in n:
				var a := pts[k]
				var b := pts[(k + 1) % n]
				var nrm := Vector3(b.y - a.y, 0, -(b.x - a.x)).normalized()
				st.set_normal(nrm)
				var a0 := Vector3(a.x, top, a.y)
				var b0 := Vector3(b.x, top, b.y)
				var a1 := Vector3(a.x, top + h, a.y)
				var b1 := Vector3(b.x, top + h, b.y)
				for v in [a0, b0, b1, a0, b1, a1, a0, b1, b0, a0, a1, b1]:
					st.add_vertex(v)
		var mesh := st.commit()
		var mi: MeshInstance3D = map_meshes.get(id)
		if not mi:
			mi = MeshInstance3D.new()
			add_child(mi)
			map_meshes[id] = mi
		mi.mesh = mesh
		var m := StandardMaterial3D.new()
		var c := _state_color(info)
		m.albedo_color = c
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = 0.35
		m.roughness = 0.4
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		mi.material_override = m
		# pick body on the top face
		var body: StaticBody3D = map_bodies.get(id)
		if body:
			body.queue_free()
		body = StaticBody3D.new()
		body.collision_layer = LAYER_STATE
		body.collision_mask = 0
		body.set_meta("state", id)
		var cs := CollisionShape3D.new()
		var shape := ConcavePolygonShape3D.new()
		shape.set_faces(faces)
		shape.backface_collision = true
		cs.shape = shape
		body.add_child(cs)
		add_child(body)
		map_bodies[id] = body
		# label over the largest landmass
		var centre := Vector2.ZERO
		for p in biggest:
			centre += p
		centre /= max(1, biggest.size())
		var l: Label3D = map_labels.get(id)
		if not l:
			l = label("", Vector3.ZERO, 40, Color.WHITE)
			l.pixel_size = 0.0045
			map_labels[id] = l
		l.position = Vector3(centre.x, top + h + 0.18, centre.y)
		var short := String(info.get("short", id.substr(0, 3).to_upper()))
		l.text = short if info.is_empty() else "%s %d%%" % [short, int(round(support))]
		l.visible = info.is_empty() or info.get("active", true)

func _probe_points() -> Dictionary:
	var out := {}
	for id in map_labels:
		out["state:" + id] = (map_labels[id] as Label3D).global_position - Vector3(0, 0.16, 0)
	return out

func _apply_state_extra(s: Dictionary) -> void:
	var list = s.get("states", [])
	if typeof(list) == TYPE_ARRAY and list.size() > 0:
		var by_id := {}
		for item in list:
			if typeof(item) == TYPE_DICTIONARY and item.has("id"):
				by_id[String(item["id"])] = item
		_build_map(by_id)
	elif party_mat:
		_build_map({})
	var en := lang == "en"
	var seats := int(s.get("seats", 0))
	var total := int(s.get("totalSeats", 222))
	var majority := int(s.get("majority", 112))
	var day := int(s.get("day", 1))
	var total_days := int(s.get("totalDays", 30))
	var headline := String(s.get("headline", ""))
	if screen_labels.size() == 3:
		screen_labels[0][0].text = "LIVE NEWS" if en else "BERITA LANGSUNG"
		screen_labels[0][1].text = headline if headline != "" else ("No new reports" if en else "Tiada laporan baharu")
		screen_labels[0][1].font_size = 44
		screen_labels[1][0].text = "SEAT PROJECTION" if en else "UNJURAN KERUSI"
		screen_labels[1][1].text = "%d / %d\n%s %d" % [seats, total, "MAJORITY" if en else "MAJORITI", majority]
		screen_labels[2][0].text = "CAMPAIGN DAY" if en else "HARI KEMPEN"
		screen_labels[2][1].text = "%d / %d" % [day, total_days]
	if room_labels.has("__restricted"):
		room_labels["__restricted"].text = "OPERATIONS · RESTRICTED ACCESS" if en else "BILIK GERAKAN · AKSES TERHAD"

# ── cast ──────────────────────────────────────────────────────────────
func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(-9.4, 0, -3.2), PI / 2)
	npcs.append(spawn("admin", "type", Vector3(-9.5, 0, 0.6), PI))
	npcs.append(spawn("anak_muda", "type", Vector3(2.5, 0, 0.6), PI))
	npcs.append(spawn("aide", "tablet", Vector3(1.6, 0, -0.3), PI + 0.5))
	npcs.append(spawn("makcik", "stand", Vector3(-10.2, 0, -4.6), PI / 2))
	npcs.append(spawn("uncle", "type", Vector3(5.6, 0, -6.2), 0.0))
	npcs.append(spawn("pakcik", "sit", Vector3(5.6, 0, 3.3), PI / 2))
	npcs.append(spawn("anak_muda", "sit", Vector3(4.6, 0, 4.3), PI / 2))
	npcs.append(spawn("pakcik", "stand", Vector3(-8.0, 0, 6.8), PI))
	_spawn_player(LOBBY_POINT, PI)
