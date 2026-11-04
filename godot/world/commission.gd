extends "res://main.gd"
## Suruhanjaya Pilihan Raya — the election commission centre.
##
## A counting hall (stacked ballot boxes, counting tables with officials and
## a big results board showing projected seats against the majority line),
## a model polling station with voting booths and the indelible-ink table,
## the polling data room with a support chart per state, and the lobby.
## Uses world-state fields: states, seats, totalSeats, majority, day, totalDays

var board_labels := {}
var bars: Array = []            # [MeshInstance3D, Label3D] per state slot
const CHART_X0 := 1.6
const CHART_X1 := 9.4

func _init() -> void:
	ROOMS = {
		"kiraan": [-13.0, -8.0, 0.0, 1.0, "#2a3442", "DEWAN PENGIRAAN UNDI", "COUNTING HALL"],
		"data": [0.0, -8.0, 10.0, 1.0, "#1a2230", "BILIK DATA TINJAUAN", "POLLING DATA ROOM"],
		"saluran": [-13.0, 1.0, -4.0, 8.0, "#5a5a52", "SALURAN MENGUNDI", "POLLING STATION"],
		"lobi": [-4.0, 1.0, 10.0, 8.0, "#b9ae9a", "LOBI SPR", "COMMISSION LOBBY"],
	}
	FLOORS = {
		"kiraan": ["tiles", "#9aa3a8", "#6a7378", 0.6],
		"data": ["carpet_tile", "#1c2638", "#3b5372", 1.0],
		"saluran": ["tiles", "#c9c0ae", "#8a8170", 0.5],
		"lobi": ["terrazzo", "#b9aa8c", "", 1.4],
	}
	INTERACT = {
		"count": ["kiraan", "PAPAN KEPUTUSAN", "RESULTS BOARD", Vector3(-6.5, 1.9, -6.4), Vector3(-6.5, 0, -5.6), Vector3(-6.5, 0, -8.0)],
		"poll": ["data", "TERMINAL TINJAUAN", "POLL TERMINAL", Vector3(5.5, 1.75, -3.0), Vector3(5.5, 0, -1.8), Vector3(5.5, 0, -3.4)],
		"booth": ["saluran", "SALURAN CONTOH", "MODEL POLLING STATION", Vector3(-8.5, 2.2, 3.4), Vector3(-8.5, 0, 5.0), Vector3(-8.5, 0, 3.4)],
		"pa": ["lobi", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(6.5, 2.15, 4.4), Vector3(6.5, 0, 5.6), Vector3(6.5, 0, 4.4)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(3.0, 2.55, 7.4), Vector3(3.0, 0, 6.4), Vector3(3.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(3.0, 0, 5.0)
	INTRO_START = Vector3(5.0, 0, 10.9)
	door_pos = Vector3(3.0, 0, 8.0)
	wall_color = "#d8d2c4"
	overview_target = Vector3(-1.5, 0, -0.5)
	overview_dist = Vector2(22.0, 30.0)

func _build_exterior() -> void:
	standard_frontage(-13.0, 10.0, 3.0, "SURUHANJAYA PILIHAN RAYA", Color("#5be39a"))
	# the SPR blue band and ballot-box emblem on the facade
	facade.append(box(Vector3(23.0, 0.45, 0.1), Vector3(-1.5, 2.95, 8.14), "#1f4e9c", false))

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "SURUHANJAYA PILIHAN RAYA" if lang == "ms" else "ELECTION COMMISSION"

func _build_walls() -> void:
	wall_x(-8.0, -13.0, 10.0)
	wall_x(8.0, -13.0, 10.0, [[1.8, 4.2]])
	wall_z(-13.0, -8.0, 8.0)
	wall_z(10.0, -8.0, 8.0)
	wall_z(0.0, -8.0, 1.0, [[-2.2, -0.4]])
	wall_x(1.0, -13.0, -4.0, [[-9.4, -7.6]])
	wall_x(1.0, -4.0, 10.0, [[-2.4, 0.0], [4.6, 6.4]])
	wall_z(-4.0, 1.0, 8.0, [[3.6, 5.4]])

func _ballot_box(pos: Vector3, rot := 0.0) -> void:
	box(Vector3(0.5, 0.42, 0.4), pos + Vector3(0, 0.21, 0), "#f4f1e8", true, rot, null, mat("#f4f1e8", 0.5))
	box(Vector3(0.51, 0.06, 0.41), pos + Vector3(0, 0.38, 0), "#1f4e9c", false, rot)
	box(Vector3(0.22, 0.01, 0.03), pos + Vector3(0, 0.425, 0), "#111", false, rot)

func _build_furniture() -> void:
	# ── counting hall: results board, counting tables, stacks of boxes ──
	box(Vector3(8.6, 2.6, 0.1), Vector3(-6.5, 2.4, -7.9), "#05080d", false)
	box(Vector3(8.4, 2.4, 0.02), Vector3(-6.5, 2.4, -7.84), "#0b2a1e", false, 0.0, null, mat("#0b2a1e", 0.4, 0.0, "#0e3a28", 0.9))
	for key in ["title", "seats", "majority", "day"]:
		var l := label("", Vector3.ZERO, 60, Color.WHITE, false)
		l.no_depth_test = false
		l.outline_size = 0
		board_labels[key] = l
	board_labels["title"].position = Vector3(-6.5, 3.35, -7.82)
	board_labels["title"].modulate = Color("#5be39a")
	board_labels["seats"].position = Vector3(-6.5, 2.45, -7.82)
	board_labels["seats"].font_size = 180
	board_labels["majority"].position = Vector3(-6.5, 1.65, -7.82)
	board_labels["majority"].font_size = 48
	board_labels["day"].position = Vector3(-6.5, 1.3, -7.82)
	board_labels["day"].font_size = 36
	board_labels["day"].modulate = Color("#8aa3b8")
	# progress bar under the seat number, with the majority mark
	box(Vector3(7.0, 0.12, 0.02), Vector3(-6.5, 1.95, -7.82), "#1a2a22", false)
	board_labels["bar"] = box(Vector3(7.0, 0.12, 0.025), Vector3(-6.5, 1.95, -7.81), "#5be39a", false, 0.0, null, mat("#5be39a", 0.3, 0.0, "#5be39a", 1.4))
	board_labels["mark"] = box(Vector3(0.04, 0.24, 0.03), Vector3(-6.5, 1.95, -7.8), "#f2b01e", false, 0.0, null, mat("#f2b01e", 0.3, 0.0, "#f2b01e", 1.6))
	for row in 2:
		for k in 3:
			var c := Vector3(-10.5 + k * 3.0, 0, -3.8 + row * 2.4)
			box(Vector3(2.2, 0.76, 1.0), c + Vector3(0, 0.38, 0), "#e9e6df", true, 0.0, null, mat("#e9e6df", 0.5))
			for m in 5:
				box(Vector3(0.18, 0.01, 0.12), c + Vector3(-0.8 + m * 0.4, 0.77, 0.1 * ((m % 2) * 2 - 1)), "#f7f5ee", false)
			chair(c + Vector3(-0.5, 0, -0.8), 0.0)
			chair(c + Vector3(0.5, 0, 0.8), PI)
	for i in 10:
		_ballot_box(Vector3(-12.3, 0, -6.6 + i * 0.5), 0.0)
		if i % 2 == 0:
			_ballot_box(Vector3(-12.3, 0.42, -6.6 + i * 0.5), 0.0)
	plane(Vector2(0.9, 0.45), Vector3(-1.2, 3.2, -7.88), jalur, true)

	# ── polling data room: a support bar per state on the wall ──
	box(Vector3(8.4, 2.4, 0.08), Vector3(5.5, 2.1, -7.9), "#05080d", false)
	box(Vector3(8.2, 2.2, 0.02), Vector3(5.5, 2.1, -7.84), "#0d1f33", false, 0.0, null, mat("#0d1f33", 0.4, 0.0, "#102a44", 0.8))
	var dt := label("SOKONGAN MENGIKUT NEGERI", Vector3(5.5, 3.0, -7.82), 44, Color("#5be39a"), false)
	dt.no_depth_test = false
	dt.outline_size = 0
	room_labels["__chart"] = dt
	box(Vector3(7.8, 0.02, 0.02), Vector3(5.5, 1.35 + 0.6, -7.82), "#f2b01e", false, 0.0, null, mat("#f2b01e", 0.3, 0.0, "#f2b01e", 1.2))
	for i in 14:
		var x := CHART_X0 + (CHART_X1 - CHART_X0) * (i + 0.5) / 14.0
		var bar := box(Vector3(0.36, 1.0, 0.03), Vector3(x, 1.35, -7.81), "#5be39a", false, 0.0, null, mat("#5be39a", 0.3, 0.0, "#5be39a", 1.0))
		var lab := label("", Vector3(x, 1.16, -7.8), 22, Color("#8aa3b8"), false)
		lab.no_depth_test = false
		lab.outline_size = 0
		bars.append([bar, lab])
	box(Vector3(5.0, 0.8, 0.9), Vector3(5.5, 0.4, -3.4), "#232c38", true, 0.0, null, mat("#232c38", 0.4, 0.3))
	for m in 3:
		box(Vector3(0.6, 0.36, 0.04), Vector3(4.0 + m * 1.5, 1.0, -3.7), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, ["#1b8a5a", "#1b6fa0", "#a0521b"][m], 0.9))
		chair(Vector3(4.0 + m * 1.5, 0, -2.6), PI)

	# ── model polling station: booths, ink table, ballot box ──
	for k in 4:
		var bx := -11.8 + k * 1.3
		box(Vector3(1.0, 1.4, 0.05), Vector3(bx, 0.95, 2.3), "#c9c2b2", false)
		box(Vector3(0.05, 1.4, 0.8), Vector3(bx - 0.5, 0.95, 2.7), "#c9c2b2", false)
		box(Vector3(0.9, 0.04, 0.5), Vector3(bx, 0.95, 2.55), "#8a6a48", false)
		box(Vector3(0.02, 0.9, 0.02), Vector3(bx - 0.45, 0.45, 2.8), "#666", false)
	box(Vector3(1.8, 0.76, 0.7), Vector3(-8.5, 0.38, 3.4), "#e9e6df", true)
	cyl(0.06, 0.12, Vector3(-8.9, 0.82, 3.4), "#3b2a7a")
	_ballot_box(Vector3(-6.4, 0, 4.2), 0.0)
	box(Vector3(1.8, 0.5, 0.04), Vector3(-8.5, 2.0, 1.1), "#0b1a2c", false)
	var sl := label("SALURAN 1", Vector3(-8.5, 2.0, 1.13), 44, Color("#f2b01e"), false)
	sl.no_depth_test = false
	sl.outline_size = 0

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
	var seats := int(s.get("seats", 0))
	var total := int(s.get("totalSeats", 222))
	var majority := int(s.get("majority", total / 2 + 1))
	if board_labels.has("title"):
		board_labels["title"].text = "SEAT PROJECTION" if en else "UNJURAN KERUSI"
		board_labels["seats"].text = "%d / %d" % [seats, total]
		board_labels["majority"].text = ("MAJORITY %d" if en else "MAJORITI %d") % majority
		board_labels["day"].text = ("CAMPAIGN DAY %d/%d" if en else "HARI KEMPEN %d/%d") % [int(s.get("day", 1)), int(s.get("totalDays", 30))]
		var frac: float = clamp(seats / float(max(1, total)), 0.0, 1.0)
		var bar: MeshInstance3D = board_labels["bar"]
		bar.scale.x = max(0.001, frac)
		bar.position.x = -6.5 - 3.5 + 3.5 * frac
		var ok := seats >= majority
		bar.material_override = mat("#5be39a" if ok else "#f2b01e", 0.3, 0.0, "#5be39a" if ok else "#f2b01e", 1.4)
		(board_labels["mark"] as MeshInstance3D).position.x = -10.0 + 7.0 * majority / float(max(1, total))
	if room_labels.has("__chart"):
		room_labels["__chart"].text = "SUPPORT BY STATE" if en else "SOKONGAN MENGIKUT NEGERI"
	var list = s.get("states", [])
	if typeof(list) == TYPE_ARRAY:
		for i in bars.size():
			var bar: MeshInstance3D = bars[i][0]
			var lab: Label3D = bars[i][1]
			if i < list.size() and typeof(list[i]) == TYPE_DICTIONARY:
				var item: Dictionary = list[i]
				var sup: float = clamp(float(item.get("support", 0.0)), 0.0, 100.0)
				var h: float = max(0.02, sup / 100.0 * 1.6)
				bar.visible = true
				bar.scale.y = h
				bar.position.y = 1.35 + h / 2.0 - 0.0
				var col := Color("#2b3644") if not item.get("active", true) else (player_color if String(item.get("status", "")) == "winning" else (Color("#e8603c") if String(item.get("status", "")) == "losing" else Color("#f2b01e")))
				bar.material_override = mat(col, 0.3, 0.0, col, 1.0)
				lab.text = "%s\n%d%%" % [String(item.get("short", "")), int(round(sup))]
				lab.position.y = 1.18
			else:
				bar.visible = false
				lab.text = ""

func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(6.5, 0, 4.4), PI)
	npcs.append(spawn("admin", "type", Vector3(7.6, 0, 2.7), PI))
	for item in [["pakcik", Vector3(-11.0, 0, -4.6), 0.0], ["makcik", Vector3(-8.0, 0, -3.0), PI], ["uncle", Vector3(-5.0, 0, -4.6), 0.0], ["anak_muda", Vector3(-7.5, 0, -0.6), PI], ["aide", Vector3(-4.5, 0, -2.2), 0.0]]:
		npcs.append(spawn(item[0], "sit", item[1], item[2]))
	npcs.append(spawn("aide", "tablet", Vector3(-9.0, 0, -5.6), PI))
	npcs.append(spawn("anak_muda", "type", Vector3(4.0, 0, -2.6), PI))
	npcs.append(spawn("makcik", "stand", Vector3(-10.5, 0, 2.9), PI))
	npcs.append(spawn("uncle", "stand", Vector3(-8.5, 0, 2.8), 0.0))
	_spawn_player(LOBBY_POINT, PI)
