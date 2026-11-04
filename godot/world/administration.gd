extends "res://main.gd"
## Pusat Pentadbiran — the administration centre in the government chapter.
##
## The delivery unit: a policy board with every policy and whether it is
## active, a KPI wall (trust, stability, budget, term progress) above the
## officials' desks, a crisis room and the lobby.
## Uses world-state fields: policies [{name, active}], kpis [{label, value, pct}]

var policy_rows: Array = []    # [MeshInstance3D lamp, Label3D]
var kpi_rows: Array = []       # [Label3D label, Label3D value, MeshInstance3D bar]
const KPI_X0 := 1.4
const KPI_W := 3.2

func _init() -> void:
	ROOMS = {
		"dasar": [-13.0, -8.0, -1.0, 1.0, "#24304a", "UNIT PENYAMPAIAN DASAR", "POLICY DELIVERY UNIT"],
		"kpi": [-1.0, -8.0, 10.0, 1.0, "#1a2230", "BILIK PRESTASI", "PERFORMANCE ROOM"],
		"krisis": [-13.0, 1.0, -4.0, 8.0, "#3a1e22", "BILIK KRISIS", "CRISIS ROOM"],
		"lobi": [-4.0, 1.0, 10.0, 8.0, "#c4ab84", "LOBI", "LOBBY"],
	}
	FLOORS = {
		"dasar": ["carpet_tile", "#22304a", "#45597e", 1.0],
		"kpi": ["carpet_tile", "#1c2638", "#3b5372", 1.0],
		"krisis": ["carpet", "#3a1e22", "#6a3a42", 0.9],
		"lobi": ["terrazzo", "#c9bfa8", "", 1.4],
	}
	INTERACT = {
		"policy": ["dasar", "PAPAN DASAR", "POLICY BOARD", Vector3(-7.0, 1.9, -6.4), Vector3(-7.0, 0, -5.2), Vector3(-7.0, 0, -8.0)],
		"kpi": ["kpi", "PRESTASI KERAJAAN", "GOVERNMENT PERFORMANCE", Vector3(4.5, 1.9, -6.4), Vector3(4.5, 0, -5.2), Vector3(4.5, 0, -8.0)],
		"crisis": ["krisis", "BILIK KRISIS", "CRISIS ROOM", Vector3(-8.5, 1.8, 4.2), Vector3(-8.5, 0, 5.8), Vector3(-8.5, 0, 4.2)],
		"pa": ["lobi", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(6.5, 2.15, 4.4), Vector3(6.5, 0, 5.6), Vector3(6.5, 0, 4.4)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(3.0, 2.55, 7.4), Vector3(3.0, 0, 6.4), Vector3(3.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(3.0, 0, 5.0)
	INTRO_START = Vector3(5.0, 0, 10.9)
	door_pos = Vector3(3.0, 0, 8.0)
	wall_color = "#d3c9b6"
	overview_target = Vector3(-1.5, 0, -0.8)
	overview_dist = Vector2(22.0, 30.0)

func _build_exterior() -> void:
	standard_frontage(-13.0, 10.0, 3.0, "PUSAT PENTADBIRAN", Color("#4fd6ec"))
	for x in [-10.0, -6.5, 0.0, 6.0, 9.0]:
		box(Vector3(0.45, 3.2, 0.45), Vector3(x, 1.6, 8.6), "#e2ddd0", true, 0.0, null, mat("#e2ddd0", 0.6))

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "PUSAT PENTADBIRAN" if lang == "ms" else "ADMINISTRATION CENTRE"

func _build_walls() -> void:
	wall_x(-8.0, -13.0, 10.0)
	wall_x(8.0, -13.0, 10.0, [[1.8, 4.2]])
	wall_z(-13.0, -8.0, 8.0)
	wall_z(10.0, -8.0, 8.0)
	wall_z(-1.0, -8.0, 1.0, [[-2.2, -0.4]])
	wall_x(1.0, -13.0, -4.0, [[-9.4, -7.6]])
	wall_x(1.0, -4.0, 10.0, [[-3.4, -1.6], [4.6, 6.4]])
	wall_z(-4.0, 1.0, 8.0, [[3.6, 5.4]])

func _build_furniture() -> void:
	# ── policy delivery unit: the policy board and officials' desks ──
	box(Vector3(9.0, 2.4, 0.08), Vector3(-7.0, 2.0, -7.9), "#0b1a2c", false)
	var pt := label("DASAR KERAJAAN", Vector3(-7.0, 2.95, -7.86), 50, Color("#4fd6ec"), false)
	pt.no_depth_test = false
	pt.outline_size = 0
	room_labels["__policies"] = pt
	for i in 5:
		var y := 2.5 - i * 0.38
		var lamp := sphere(0.07, Vector3(-10.9, y, -7.84), "#2b3644")
		var l := label("", Vector3(-6.9, y, -7.84), 32, Color.WHITE, false)
		l.no_depth_test = false
		l.outline_size = 0
		policy_rows.append([lamp, l])
	for row in 2:
		for k in 3:
			var c := Vector3(-10.5 + k * 3.2, 0, -4.4 + row * 2.4)
			box(Vector3(2.2, 0.76, 1.0), c + Vector3(0, 0.38, 0), "#3a4656", true)
			box(Vector3(0.55, 0.34, 0.04), c + Vector3(0, 1.0, -0.3), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, "#2a74a8", 0.8))
			chair(c + Vector3(0, 0, 0.75), PI)
	plane(Vector2(0.9, 0.45), Vector3(-1.8, 2.6, -7.88), jalur, true)

	# ── performance room: KPI wall ──
	box(Vector3(9.0, 2.4, 0.08), Vector3(4.5, 2.0, -7.9), "#05080d", false)
	var kt := label("PRESTASI KERAJAAN", Vector3(4.5, 2.95, -7.86), 50, Color("#f2b01e"), false)
	kt.no_depth_test = false
	kt.outline_size = 0
	room_labels["__kpi"] = kt
	for i in 4:
		var y := 2.3 - i * 0.44
		var kl := label("", Vector3(KPI_X0 + 0.9, y + 0.12, -7.84), 28, Color("#8aa3b8"), false)
		kl.no_depth_test = false
		kl.outline_size = 0
		var kv := label("", Vector3(KPI_X0 + KPI_W + 2.3, y, -7.84), 44, Color.WHITE, false)
		kv.no_depth_test = false
		kv.outline_size = 0
		box(Vector3(KPI_W, 0.12, 0.02), Vector3(KPI_X0 + KPI_W / 2.0 + 1.2, y - 0.08, -7.85), "#1a2430", false)
		var bar := box(Vector3(KPI_W, 0.12, 0.025), Vector3(KPI_X0 + KPI_W / 2.0 + 1.2, y - 0.08, -7.84), "#4fd6ec", false, 0.0, null, mat("#4fd6ec", 0.3, 0.0, "#4fd6ec", 1.2))
		kpi_rows.append([kl, kv, bar])
	box(Vector3(5.0, 0.8, 1.0), Vector3(4.5, 0.4, -3.8), "#232c38", true, 0.0, null, mat("#232c38", 0.4, 0.3))
	for m in 3:
		box(Vector3(0.6, 0.36, 0.04), Vector3(3.0 + m * 1.5, 1.0, -4.1), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, ["#1b8a5a", "#a0521b", "#1b6fa0"][m], 0.9))
		chair(Vector3(3.0 + m * 1.5, 0, -3.0), PI)

	# ── crisis room: round table, red phone, alert screen ──
	cyl(1.1, 0.06, Vector3(-8.5, 0.76, 4.2), "#4a2e16")
	box(Vector3(1.4, 0.72, 1.4), Vector3(-8.5, 0.36, 4.2), "#3a2416", true)
	for k in 6:
		var a := k * TAU / 6.0
		chair(Vector3(-8.5 + cos(a) * 1.6, 0, 4.2 + sin(a) * 1.6), atan2(-cos(a), -sin(a)), "#3a2a1c")
	box(Vector3(0.2, 0.08, 0.14), Vector3(-8.1, 0.83, 4.0), "#c0392b", false, 0.0, null, mat("#c0392b", 0.4, 0.0, "#c0392b", 0.8))
	box(Vector3(0.06, 1.4, 2.6), Vector3(-12.9, 1.8, 4.2), "#05080d", false)
	box(Vector3(0.02, 1.25, 2.45), Vector3(-12.85, 1.8, 4.2), "#3a1414", false, 0.0, null, mat("#3a1414", 0.4, 0.0, "#6a1a1a", 1.0))
	var al := label("TIADA KRISIS AKTIF", Vector3(-12.83, 1.8, 4.2), 36, Color("#ffb0a0"), false)
	al.rotation.y = PI / 2
	al.no_depth_test = false
	al.outline_size = 0
	room_labels["__alert"] = al

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
	var pols = s.get("policies", [])
	if typeof(pols) != TYPE_ARRAY:
		pols = []
	for i in policy_rows.size():
		var lamp: MeshInstance3D = policy_rows[i][0]
		var l: Label3D = policy_rows[i][1]
		if i < pols.size() and typeof(pols[i]) == TYPE_DICTIONARY:
			var active: bool = pols[i].get("active", false)
			l.text = "%s   %s" % [String(pols[i].get("name", "")), ("ACTIVE" if en else "AKTIF") if active else ("NOT STARTED" if en else "BELUM DILAKSANA")]
			l.modulate = Color("#5be39a") if active else Color("#8aa3b8")
			lamp.material_override = mat("#5be39a", 0.3, 0.0, "#5be39a", 1.8) if active else mat("#2b3644")
			lamp.visible = true
		else:
			l.text = ""
			lamp.visible = false
	var kpis = s.get("kpis", [])
	if typeof(kpis) != TYPE_ARRAY:
		kpis = []
	for i in kpi_rows.size():
		var kl: Label3D = kpi_rows[i][0]
		var kv: Label3D = kpi_rows[i][1]
		var bar: MeshInstance3D = kpi_rows[i][2]
		if i < kpis.size() and typeof(kpis[i]) == TYPE_DICTIONARY:
			var pct: float = clamp(float(kpis[i].get("pct", 0.0)), 0.0, 1.0)
			kl.text = String(kpis[i].get("label", ""))
			kv.text = String(kpis[i].get("value", ""))
			bar.visible = true
			bar.scale.x = max(0.001, pct)
			bar.position.x = KPI_X0 + 1.2 + KPI_W * pct / 2.0
			var col := "#5be39a" if pct >= 0.6 else ("#f2b01e" if pct >= 0.35 else "#e8603c")
			bar.material_override = mat(col, 0.3, 0.0, col, 1.2)
		else:
			kl.text = ""
			kv.text = ""
			bar.visible = false
	if room_labels.has("__policies"):
		room_labels["__policies"].text = "GOVERNMENT POLICIES" if en else "DASAR KERAJAAN"
		room_labels["__kpi"].text = "GOVERNMENT PERFORMANCE" if en else "PRESTASI KERAJAAN"
		room_labels["__alert"].text = String(s.get("alert", "")) if String(s.get("alert", "")) != "" else ("NO ACTIVE CRISIS" if en else "TIADA KRISIS AKTIF")

func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(6.5, 0, 4.4), PI)
	npcs.append(spawn("admin", "type", Vector3(7.6, 0, 2.7), PI))
	for item in [["aide", Vector3(-10.5, 0, -3.65)], ["makcik", Vector3(-7.3, 0, -3.65)], ["anak_muda", Vector3(-4.1, 0, -1.25)], ["pakcik", Vector3(3.0, 0, -3.0)], ["uncle", Vector3(6.0, 0, -3.0)]]:
		npcs.append(spawn(item[0], "type", item[1], PI))
	npcs.append(spawn("aide", "tablet", Vector3(-9.0, 0, -6.6), PI))
	_spawn_player(LOBBY_POINT, PI)
