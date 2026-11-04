extends "res://main.gd"
## Bilik Jadual Kempen — the campaign scheduling centre.
##
## The planning room has a wall calendar with one tile per campaign day
## (today lit, past days crossed out, nomination, cooling-off and polling
## day marked), a route map of the constituency with pinned visits, the
## field team's briefing table, a transport desk and the lobby.
## Uses world-state fields: day, totalDays

var tiles: Array = []         # [MeshInstance3D, Label3D] per day
var today_label: Label3D
const CAL_X0 := -12.0
const CAL_X1 := -1.0

func _init() -> void:
	ROOMS = {
		"jadual": [-13.0, -8.0, 0.0, 1.0, "#2a2f44", "BILIK JADUAL", "SCHEDULE ROOM"],
		"laluan": [0.0, -8.0, 10.0, 1.0, "#24304a", "BILIK LALUAN LAWATAN", "VISIT ROUTE ROOM"],
		"logistik": [-13.0, 1.0, -4.0, 8.0, "#3a3328", "MEJA LOGISTIK", "TRANSPORT DESK"],
		"lobi": [-4.0, 1.0, 10.0, 8.0, "#b9ae9a", "LOBI", "LOBBY"],
	}
	FLOORS = {
		"jadual": ["carpet_tile", "#2a2f48", "#4a5278", 1.0],
		"laluan": ["carpet", "#22304a", "#45597e", 0.9],
		"logistik": ["parquet", "#7a5034", "", 1.2],
		"lobi": ["tiles", "#c4ab84", "#7d6648", 0.6],
	}
	INTERACT = {
		"board": ["jadual", "PAPAN JADUAL", "SCHEDULE BOARD", Vector3(-6.5, 1.9, -6.4), Vector3(-6.5, 0, -5.4), Vector3(-6.5, 0, -8.0)],
		"route": ["laluan", "PETA LALUAN", "ROUTE MAP", Vector3(5.0, 2.2, -4.0), Vector3(5.0, 0, -2.3), Vector3(5.0, 0, -4.0)],
		"transport": ["logistik", "JADUAL KENDERAAN", "TRANSPORT ROSTER", Vector3(-8.5, 1.8, 4.2), Vector3(-8.5, 0, 5.6), Vector3(-8.5, 0, 4.2)],
		"pa": ["lobi", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(6.5, 2.15, 4.4), Vector3(6.5, 0, 5.6), Vector3(6.5, 0, 4.4)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(3.0, 2.55, 7.4), Vector3(3.0, 0, 6.4), Vector3(3.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(3.0, 0, 5.0)
	INTRO_START = Vector3(5.0, 0, 10.9)
	door_pos = Vector3(3.0, 0, 8.0)
	wall_color = "#d3c9b6"
	overview_target = Vector3(-1.5, 0, -0.5)
	overview_dist = Vector2(22.0, 30.0)

func _build_exterior() -> void:
	standard_frontage(-13.0, 10.0, 3.0, "PUSAT JADUAL KEMPEN", Color("#a78bfa"))
	# a minivan and a lorry for the field teams
	for item in [[Vector3(-6.0, 0, 12.4), "#e9e6df"], [Vector3(-11.0, 0, 12.4), "#5a6b7a"]]:
		var v := Node3D.new()
		v.position = item[0]
		region.add_child(v)
		box(Vector3(3.6, 1.5, 1.8), Vector3(0, 0.95, 0), item[1], true, 0.0, v, mat(item[1], 0.4, 0.2))
		for p in [Vector3(-1.2, 0.32, 0.9), Vector3(1.2, 0.32, 0.9), Vector3(-1.2, 0.32, -0.9), Vector3(1.2, 0.32, -0.9)]:
			var w := cyl(0.32, 0.22, p, "#111317", v)
			w.rotation.x = PI / 2

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "PUSAT JADUAL KEMPEN" if lang == "ms" else "CAMPAIGN SCHEDULING CENTRE"

func _build_walls() -> void:
	wall_x(-8.0, -13.0, 10.0)
	wall_x(8.0, -13.0, 10.0, [[1.8, 4.2]])
	wall_z(-13.0, -8.0, 8.0)
	wall_z(10.0, -8.0, 8.0)
	wall_z(0.0, -8.0, 1.0, [[-2.2, -0.4]])
	wall_x(1.0, -13.0, -4.0, [[-9.4, -7.6]])
	wall_x(1.0, -4.0, 10.0, [[-2.4, 0.0], [4.6, 6.4]])
	wall_z(-4.0, 1.0, 8.0, [[3.6, 5.4]])

func _build_furniture() -> void:
	# ── schedule room: the wall calendar, 6 columns × 5 rows ──
	box(Vector3(11.4, 2.8, 0.08), Vector3(-6.5, 2.2, -7.92), "#f7f7f2", false)
	var ct := label("JADUAL KEMPEN 30 HARI", Vector3(-6.5, 3.45, -7.86), 50, Color("#4a3a8a"), false)
	ct.no_depth_test = false
	ct.outline_size = 0
	room_labels["__cal"] = ct
	for i in 30:
		var col := i % 6
		var row := i / 6
		var x := CAL_X0 + (CAL_X1 - CAL_X0) * (col + 0.5) / 6.0
		var y := 3.0 - row * 0.5
		var tile := box(Vector3(1.7, 0.42, 0.02), Vector3(x, y, -7.86), "#e8e4f4", false)
		var tl := label("", Vector3(x, y, -7.84), 26, Color("#2a2f48"), false)
		tl.no_depth_test = false
		tl.outline_size = 0
		tiles.append([tile, tl])
	today_label = label("", Vector3(-6.5, 0.6, -7.86), 34, Color("#4a3a8a"), false)
	today_label.no_depth_test = false
	today_label.outline_size = 0
	box(Vector3(4.6, 0.76, 1.6), Vector3(-6.5, 0.38, -3.6), "#5a3a1e", true, 0.0, null, mat("#5a3a1e", 0.45))
	for k in 3:
		chair(Vector3(-8.0 + k * 1.5, 0, -4.7), 0.0)
		chair(Vector3(-8.0 + k * 1.5, 0, -2.5), PI)
	for m in 6:
		box(Vector3(0.3, 0.01, 0.22), Vector3(-8.2 + m * 0.65, 0.77, -3.6 + (m % 2) * 0.3), ["#f5d76e", "#a8d8f0", "#f2a7a0"][m % 3], false)
	plant(Vector3(-12.4, 0, 0.4))

	# ── route room: a big map with pinned visits and string between them ──
	box(Vector3(6.0, 0.8, 3.0), Vector3(5.0, 0.4, -4.0), "#1f2a3a", true, 0.0, null, mat("#1f2a3a", 0.4, 0.2))
	box(Vector3(5.8, 0.02, 2.8), Vector3(5.0, 0.81, -4.0), "#cfe1c3", false, 0.0, null, mat("#cfe1c3", 0.9))
	for r in [[Vector3(3.0, 0.82, -4.8), Vector3(7.2, 0.82, -3.2)], [Vector3(2.5, 0.82, -3.2), Vector3(6.4, 0.82, -5.0)]]:
		var a: Vector3 = r[0]
		var b: Vector3 = r[1]
		var mid := (a + b) / 2.0
		var road := box(Vector3(0.12, 0.01, a.distance_to(b)), mid, "#e8d9a0", false, atan2(b.x - a.x, b.z - a.z))
	box(Vector3(0.35, 0.02, 1.8), Vector3(4.2, 0.82, -4.0), "#7fb7de", false, 0.6)
	var pins := [Vector3(3.2, 0.82, -4.7), Vector3(4.6, 0.82, -3.4), Vector3(5.8, 0.82, -4.5), Vector3(6.9, 0.82, -3.3), Vector3(3.6, 0.82, -3.1)]
	for i in pins.size():
		box(Vector3(0.02, 0.24, 0.02), pins[i] + Vector3(0, 0.12, 0), "#666", false)
		sphere(0.06, pins[i] + Vector3(0, 0.26, 0), ["#e8603c", "#f2b01e", "#a78bfa", "#19d3f2", "#5be39a"][i])
		if i > 0:
			var a: Vector3 = pins[i - 1] + Vector3(0, 0.22, 0)
			var b: Vector3 = pins[i] + Vector3(0, 0.22, 0)
			box(Vector3(0.015, 0.015, a.distance_to(b)), (a + b) / 2.0, "#c0392b", false, atan2(b.x - a.x, b.z - a.z))
	for x in [2.5, 7.5]:
		chair(Vector3(x, 0, -2.2), PI)
	box(Vector3(5.0, 1.4, 0.06), Vector3(5.0, 1.9, -7.9), "#0b1a2c", false)
	var tt := label("LALUAN LAWATAN HARI INI", Vector3(5.0, 2.35, -7.86), 40, Color("#a78bfa"), false)
	tt.no_depth_test = false
	tt.outline_size = 0
	room_labels["__route"] = tt
	for i in 4:
		var stop := label("", Vector3(5.0, 1.95 - i * 0.28, -7.86), 28, Color.WHITE, false)
		stop.no_depth_test = false
		stop.outline_size = 0
		room_labels["__stop%d" % i] = stop

	# ── transport desk: roster board and keys ──
	box(Vector3(3.0, 0.76, 1.0), Vector3(-8.5, 0.38, 4.2), "#a88a64", true)
	box(Vector3(0.06, 1.5, 3.0), Vector3(-12.9, 1.7, 4.4), "#f7f7f2", false)
	for i in 8:
		box(Vector3(0.01, 0.2, 0.5), Vector3(-12.86, 2.15 - (i / 2) * 0.32, 3.6 + (i % 2) * 1.4), ["#f5d76e", "#a8d8f0"][i % 2], false)
	chair(Vector3(-8.5, 0, 5.0), PI)
	plane(Vector2(2.2, 1.3), Vector3(-6.0, 1.7, 1.08), Tex.batik(), true, 0.0)

	# ── lobby ──
	box(Vector3(2.4, 1.05, 0.7), Vector3(7.6, 0.525, 3.4), "#e9e6df", true)
	box(Vector3(2.5, 0.04, 0.8), Vector3(7.6, 1.07, 3.4), "#cdbb98", false)
	plane(Vector2(3.4, 2.4), Vector3(3.0, 0.008, 4.6), Tex.songket_rug())
	portrait(Vector3(-1.5, 2.1, 1.1), 1.0)
	plant(Vector3(-3.4, 0, 7.4))
	plant(Vector3(9.4, 0, 7.4))
	room_night_lights()

func _apply_state_extra(s: Dictionary) -> void:
	var en := lang == "en"
	var day := int(s.get("day", 1))
	var total := int(s.get("totalDays", 30))
	var marks := {15: "PENAMAAN" if not en else "NOMINATION", 16: "KEMPEN" if not en else "CAMPAIGN", 29: "HARI TENANG" if not en else "COOLING-OFF", 30: "MENGUNDI" if not en else "POLLING"}
	for i in tiles.size():
		var d := i + 1
		var tile: MeshInstance3D = tiles[i][0]
		var tl: Label3D = tiles[i][1]
		tile.visible = d <= total
		tl.visible = d <= total
		var text := "%s %d" % ["DAY" if en else "HARI", d]
		if marks.has(d):
			text += "\n" + marks[d]
		var col := "#e8e4f4"
		var ink := Color("#2a2f48")
		if d < day:
			col = "#c9c6d6"
			ink = Color("#7a7890")
			text = "✓ " + text
		elif d == day:
			col = "#a78bfa"
			ink = Color.WHITE
		elif marks.has(d):
			col = "#f2b01e" if d >= 29 else "#f5d76e"
		tile.material_override = mat(col, 0.6, 0.0, col if d == day else null, 0.6)
		tl.text = text
		tl.modulate = ink
	if today_label:
		today_label.text = ("TODAY: DAY %d OF %d · %d DAYS TO POLLING" if en else "HARI INI: HARI %d DARIPADA %d · %d HARI KE HARI MENGUNDI") % [day, total, max(0, total - day)]
	if room_labels.has("__cal"):
		room_labels["__cal"].text = ("%d-DAY CAMPAIGN SCHEDULE" if en else "JADUAL KEMPEN %d HARI") % total
	if room_labels.has("__route"):
		room_labels["__route"].text = "TODAY'S VISIT ROUTE" if en else "LALUAN LAWATAN HARI INI"
	var stops := ["09:00  Pasar pagi", "11:30  Sesi dengar penduduk", "15:00  Lawatan isu saliran", "20:30  Ceramah malam"] if not en else ["09:00  Morning market", "11:30  Resident listening", "15:00  Drainage site visit", "20:30  Evening ceramah"]
	for i in 4:
		if room_labels.has("__stop%d" % i):
			room_labels["__stop%d" % i].text = stops[i]

func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(6.5, 0, 4.4), PI)
	npcs.append(spawn("admin", "type", Vector3(7.6, 0, 2.7), PI))
	npcs.append(spawn("aide", "tablet", Vector3(-4.2, 0, -6.4), -PI / 2 - 0.6))
	for item in [["pakcik", Vector3(-8.0, 0, -4.7), 0.0], ["makcik", Vector3(-5.0, 0, -2.5), PI], ["anak_muda", Vector3(-6.5, 0, -4.7), 0.0]]:
		npcs.append(spawn(item[0], "sit", item[1], item[2]))
	npcs.append(spawn("uncle", "stand", Vector3(5.0, 0, -2.0), PI))
	npcs.append(spawn("anak_muda", "sit", Vector3(-8.5, 0, 5.0), PI))
	_spawn_player(LOBBY_POINT, PI)
