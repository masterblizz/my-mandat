extends "res://main.gd"
## Bangunan Kabinet — the cabinet building in the government chapter.
##
## The cabinet room has a long table with the head of government's chair at
## the far end and a name plaque at each minister's place (from the player's
## appointments); the portfolio briefing room, a waiting lounge and the
## lobby. Named ministers are shown by plaques and empty chairs, not by cast
## models, so a face never contradicts a name.
## Uses world-state fields: ministers [{name, post}], headTitle, partyAbbr

const SEATS_PER_SIDE := 6
var plaques: Array[Label3D] = []
var head_plaque: Label3D
var table_label: Label3D

func _init() -> void:
	ROOMS = {
		"kabinet": [-13.0, -8.0, 2.0, 1.0, "#3b2a20", "BILIK MESYUARAT KABINET", "CABINET ROOM"],
		"taklimat": [2.0, -8.0, 10.0, 1.0, "#243040", "BILIK TAKLIMAT PORTFOLIO", "PORTFOLIO BRIEFING ROOM"],
		"menunggu": [-13.0, 1.0, -4.0, 8.0, "#4a3a2a", "RUANG MENUNGGU", "WAITING LOUNGE"],
		"lobi": [-4.0, 1.0, 10.0, 8.0, "#c4ab84", "LOBI", "LOBBY"],
	}
	FLOORS = {
		"kabinet": ["parquet", "#6a4428", "", 1.2],
		"taklimat": ["carpet", "#22304a", "#45597e", 0.9],
		"menunggu": ["carpet", "#5a1a26", "#8a3a46", 0.9],
		"lobi": ["terrazzo", "#c9bfa8", "", 1.4],
	}
	INTERACT = {
		"meeting": ["kabinet", "MESYUARAT KABINET", "CABINET MEETING", Vector3(-5.5, 1.8, -6.6), Vector3(-5.5, 0, -7.0), Vector3(-5.5, 0, -3.5)],
		"lineup": ["taklimat", "BARISAN MENTERI", "CABINET LINE-UP", Vector3(6.0, 1.5, -6.9), Vector3(6.0, 0, -5.8), Vector3(6.0, 0, -8.0)],
		"pa": ["lobi", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(6.5, 2.15, 4.4), Vector3(6.5, 0, 5.6), Vector3(6.5, 0, 4.4)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(3.0, 2.55, 7.4), Vector3(3.0, 0, 6.4), Vector3(3.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(3.0, 0, 5.0)
	INTRO_START = Vector3(5.0, 0, 10.9)
	door_pos = Vector3(3.0, 0, 8.0)
	wall_color = "#d8cdb6"
	overview_target = Vector3(-1.5, 0, -0.8)
	overview_dist = Vector2(22.0, 30.0)

func _build_exterior() -> void:
	standard_frontage(-13.0, 10.0, 3.0, "BANGUNAN KABINET", Color("#f2b53a"))
	# colonnade along the frontage
	for x in [-10.0, -6.5, 0.0, 6.0, 9.0]:
		box(Vector3(0.45, 3.2, 0.45), Vector3(x, 1.6, 8.6), "#efe9dc", true, 0.0, null, mat("#efe9dc", 0.6))
	facade.append(box(Vector3(23.0, 0.35, 1.4), Vector3(-1.5, 3.35, 8.6), "#efe9dc", false))

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "BANGUNAN KABINET" if lang == "ms" else "CABINET BUILDING"

func _build_walls() -> void:
	wall_x(-8.0, -13.0, 10.0)
	wall_x(8.0, -13.0, 10.0, [[1.8, 4.2]])
	wall_z(-13.0, -8.0, 8.0)
	wall_z(10.0, -8.0, 8.0)
	wall_z(2.0, -8.0, 1.0, [[-2.2, -0.4]])
	wall_x(1.0, -13.0, -4.0, [[-9.4, -7.6]])
	wall_x(1.0, -4.0, 10.0, [[-2.4, 0.0], [4.6, 6.4]])
	wall_z(-4.0, 1.0, 8.0, [[3.6, 5.4]])

func _build_furniture() -> void:
	# ── cabinet room: long table, head chair at the north end ──
	var tz0 := -6.0
	var tz1 := 0.0
	box(Vector3(2.2, 0.76, tz1 - tz0), Vector3(-5.5, 0.38, (tz0 + tz1) / 2.0), "#4a2e16", true, 0.0, null, mat("#4a2e16", 0.4))
	box(Vector3(2.3, 0.05, tz1 - tz0 + 0.1), Vector3(-5.5, 0.78, (tz0 + tz1) / 2.0), "#5a3a1e", false, 0.0, null, mat("#5a3a1e", 0.35))
	plane(Vector2(0.9, tz1 - tz0 - 0.6), Vector3(-5.5, 0.81, (tz0 + tz1) / 2.0), Tex.songket(), false)
	# head of government's chair and plaque
	chair(Vector3(-5.5, 0, -7.0), 0.0, "#2a1a10")
	box(Vector3(0.7, 0.9, 0.12), Vector3(-5.5, 1.05, -7.3), "#2a1a10", false)
	head_plaque = _plaque(Vector3(-5.5, 0.86, -5.8), 0.0)
	for side in [-1, 1]:
		for k in SEATS_PER_SIDE:
			var z := tz0 + 0.5 + k * ((tz1 - tz0 - 1.0) / float(SEATS_PER_SIDE - 1))
			chair(Vector3(-5.5 + side * 1.55, 0, z), -side * PI / 2.0, "#3a2a1c")
			var pl := _plaque(Vector3(-5.5 + side * 0.85, 0.86, z), -side * PI / 2.0)
			plaques.append(pl)
	# jalur gemilang, portraits and the national emblem behind the head
	for x in [-8.6, -2.4]:
		box(Vector3(0.05, 2.4, 0.05), Vector3(x, 1.2, -7.6), "#c9b26a", false)
		plane(Vector2(1.0, 0.5), Vector3(x + (0.52 if x < -5.5 else -0.52), 2.2, -7.6), jalur, true, 0.0, null, true)
	portrait(Vector3(-7.0, 2.4, -7.9))
	portrait(Vector3(-4.0, 2.4, -7.9))
	var emblem := cyl(0.5, 0.04, Vector3(-5.5, 2.9, -7.92), "#c9a227")
	emblem.rotation.x = PI / 2
	emblem.material_override = mat("#c9a227", 0.3, 0.7, "#6a5010", 0.6)
	plane(Vector2(14.6, 0.5), Vector3(-5.5, 0.6, -7.93), Tex.ukiran(), true)
	table_label = label("", Vector3(-5.5, 3.5, -7.9), 46, Color("#f2b53a"), false)
	table_label.no_depth_test = false
	table_label.outline_size = 0
	for x in [-12.4, 1.4]:
		plant(Vector3(x, 0, -7.4))

	# ── portfolio briefing room: the line-up wall and chairs ──
	box(Vector3(7.4, 2.4, 0.08), Vector3(6.0, 2.0, -7.9), "#0b1a2c", false)
	var bt := label("BARISAN KABINET", Vector3(6.0, 2.95, -7.86), 50, Color("#f2b53a"), false)
	bt.no_depth_test = false
	bt.outline_size = 0
	room_labels["__lineup"] = bt
	for i in 8:
		var col: int = i % 4
		var row: int = i / 4
		box(Vector3(1.6, 0.7, 0.02), Vector3(3.6 + col * 1.6, 2.2 - row * 0.85, -7.85), "#16304e", false, 0.0, null, mat("#16304e", 0.5, 0.0, "#0e2340", 0.5))
	for row in 3:
		for k in 4:
			chair(Vector3(3.8 + k * 1.5, 0, -4.4 + row * 1.1), PI, "#46536a")

	# ── waiting lounge ──
	for z in [2.6, 4.4]:
		box(Vector3(2.0, 0.42, 0.8), Vector3(-10.5, 0.21, z), "#7a2f3a", true)
		box(Vector3(2.0, 0.5, 0.18), Vector3(-10.5, 0.64, z - 0.31), "#7a2f3a", false)
	box(Vector3(0.9, 0.4, 0.9), Vector3(-8.2, 0.2, 3.5), "#5a3a1e", true)
	for k in 3:
		cyl(0.045, 0.1, Vector3(-8.4 + k * 0.2, 0.45, 3.5), "#b07a45", region)
	plane(Vector2(2.2, 1.3), Vector3(-12.9, 1.7, 5.0), Tex.batik(), true, PI / 2)

	# ── lobby ──
	box(Vector3(2.4, 1.05, 0.7), Vector3(7.6, 0.525, 3.4), "#e9e6df", true)
	box(Vector3(2.5, 0.04, 0.8), Vector3(7.6, 1.07, 3.4), "#cdbb98", false)
	plane(Vector2(3.4, 2.4), Vector3(3.0, 0.008, 4.6), Tex.songket_rug())
	portrait(Vector3(-1.5, 2.1, 1.1), 1.0)
	plant(Vector3(-3.4, 0, 7.4))
	plant(Vector3(9.4, 0, 7.4))
	room_night_lights()

## A brass name plaque standing on the table, facing the chair it names.
func _plaque(pos: Vector3, rot_y: float) -> Label3D:
	var stand := box(Vector3(0.36, 0.1, 0.03), pos + Vector3(0, 0.05, 0), "#c9a227", false, rot_y, null, mat("#c9a227", 0.3, 0.7))
	stand.rotation.x = -0.25
	var l := label("", pos + Vector3(0, 0.22, 0), 20, Color("#ffe6a8"))
	l.pixel_size = 0.004
	l.visible = false
	return l

func _fit(text: String, n: int) -> String:
	return text if text.length() <= n else text.substr(0, n - 1) + "…"

func _apply_state_extra(s: Dictionary) -> void:
	var en := lang == "en"
	var list = s.get("ministers", [])
	if typeof(list) != TYPE_ARRAY:
		list = []
	for i in plaques.size():
		if i < list.size() and typeof(list[i]) == TYPE_DICTIONARY:
			plaques[i].text = "%s\n%s" % [_fit(String(list[i].get("name", "")), 22), _fit(String(list[i].get("post", "")), 26)]
			plaques[i].visible = true
		else:
			plaques[i].visible = false
	if head_plaque:
		head_plaque.text = "%s\n%s" % [player_name, String(s.get("headTitle", "PERDANA MENTERI" if not en else "PRIME MINISTER"))]
		head_plaque.visible = player_name != ""
	if table_label:
		var n := 0
		for item in list:
			if typeof(item) == TYPE_DICTIONARY:
				n += 1
		table_label.text = ("CABINET IN SESSION · %d MINISTERS" if en else "MESYUARAT KABINET · %d MENTERI") % n
	if room_labels.has("__lineup"):
		room_labels["__lineup"].text = "CABINET LINE-UP" if en else "BARISAN KABINET"

func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(6.5, 0, 4.4), PI)
	npcs.append(spawn("admin", "type", Vector3(7.6, 0, 2.7), PI))
	# the cabinet secretary and an aide in the cabinet room, officers in the lounge
	npcs.append(spawn("aide", "tablet", Vector3(-3.2, 0, -6.6), -PI / 2))
	npcs.append(spawn("pakcik", "stand", Vector3(-3.2, 0, -1.0), -PI / 2 - 0.4))
	npcs.append(spawn("uncle", "sit", Vector3(-10.5, 0, 2.6), 0.0))
	npcs.append(spawn("makcik", "sit", Vector3(-10.5, 0, 4.4), 0.0))
	npcs.append(spawn("anak_muda", "sit", Vector3(5.3, 0, -3.3), PI))
	_spawn_player(LOBBY_POINT, PI)
