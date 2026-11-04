extends "res://warroom.gd"
## Pusat Analisis Negara — the national analysis centre.
##
## Built on the war room's shell (same building, walk-in intro and the 3D
## Malaysia map table, every state raised by support and clickable), but
## dressed as an analysis floor: violet accent, a state-comparison bar
## chart on the analysis-room wall, and wall screens that read national
## support, the seat projection and the two weakest states.
## Uses world-state fields: states [{id, short, support, status, active}],
## seats, totalSeats, majority. Interaction ids: map, compare, analytics,
## briefing, pa, exit.

const ACCENT := "#a78bfa"
const CHART_X0 := 4.5
const CHART_X1 := 10.6
var chart_bars: Array = []        # [MeshInstance3D, Label3D] per state slot

func _init() -> void:
	ROOMS = {
		"gerakan": [-11.0, -8.0, 4.0, 2.5, "#1e1a33", "BILIK PETA NEGARA", "NATIONAL MAP ROOM"],
		"analitik": [4.0, -8.0, 11.0, -0.5, "#241f3a", "BILIK PERBANDINGAN NEGERI", "STATE COMPARISON ROOM"],
		"taklimat": [4.0, -0.5, 11.0, 8.0, "#2a2448", "BILIK TAKLIMAT DASAR", "POLICY BRIEFING ROOM"],
		"lobi": [-11.0, 2.5, 4.0, 8.0, "#8f8a80", "LOBI PUSAT ANALISIS", "ANALYSIS CENTRE LOBBY"],
	}
	FLOORS = {
		"gerakan": ["carpet_tile", "#1d1a30", "#4a3f7a", 1.0],
		"analitik": ["carpet", "#211d36", "#55498a", 0.9],
		"taklimat": ["carpet", "#2b2446", "#5b4f8f", 0.9],
		"lobi": ["terrazzo", "#b9aa8c", "", 1.4],
	}
	INTERACT = {
		"map": ["gerakan", "PETA NASIONAL", "NATIONAL MAP", Vector3(-3.5, 1.75, -0.7), Vector3(-3.5, 0, -0.05), Vector3(-3.5, 0, -3.2)],
		"compare": ["analitik", "PERBANDINGAN NEGERI", "STATE COMPARISON", Vector3(7.5, 2.9, -7.4), Vector3(7.5, 0, -3.6), Vector3(7.5, 0, -7.0)],
		"pa": ["gerakan", "PENGANALISIS NEGARA", "NATIONAL ANALYST", Vector3(-9.4, 2.15, -3.2), Vector3(-9.4, 0, -1.9), Vector3(-9.4, 0, -3.2)],
		"analytics": ["analitik", "DATA TINJAUAN", "POLLING DATA", Vector3(10.3, 1.75, -4.2), Vector3(9.4, 0, -3.6), Vector3(10.6, 0, -4.2)],
		"briefing": ["taklimat", "TAKLIMAT DASAR", "POLICY BRIEFING", Vector3(10.3, 2.6, 3.8), Vector3(8.4, 0, 3.8), Vector3(10.9, 0, 3.8)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(-4.0, 2.55, 7.4), Vector3(-4.0, 0, 6.4), Vector3(-4.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(-4.0, 0, 5.2)
	INTRO_START = Vector3(-1.4, 0, 10.9)
	door_pos = Vector3(-4.0, 0, 8.0)
	wall_color = "#3b3754"
	interior_sun = 0.72
	overview_target = Vector3(-2.0, 0, -2.6)
	overview_dist = Vector2(19.0, 27.0)

func _build_exterior() -> void:
	super._build_exterior()
	if room_labels.has("__sign"):
		(room_labels["__sign"] as Label3D).modulate = Color(ACCENT)
	# a violet band and a "data" dot row across the facade
	facade.append(box(Vector3(22.0, 0.3, 0.1), Vector3(0.0, 4.15, 8.14), ACCENT, false, 0.0, null, mat(ACCENT, 0.3, 0.0, ACCENT, 0.8)))
	for i in 9:
		facade.append(box(Vector3(0.22, 0.22, 0.06), Vector3(-8.0 + i * 2.0, 4.6, 8.16), "#e9e4ff", false, 0.0, null, mat("#e9e4ff", 0.3, 0.0, ACCENT, 1.2)))

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "PUSAT ANALISIS NEGARA" if lang == "ms" else "NATIONAL ANALYSIS CENTRE"
	if room_labels.has("__chart"):
		room_labels["__chart"].text = "SOKONGAN MENGIKUT NEGERI" if lang == "ms" else "SUPPORT BY STATE"

func _build_furniture() -> void:
	super._build_furniture()
	# state comparison chart on the analysis-room wall: one bar per state
	box(Vector3(6.6, 2.0, 0.08), Vector3(7.55, 2.3, -7.9), "#07060d", false)
	box(Vector3(6.4, 1.8, 0.02), Vector3(7.55, 2.3, -7.84), "#15112a", false, 0.0, null, mat("#15112a", 0.4, 0.0, "#2a2152", 0.9))
	var ct := label("SOKONGAN MENGIKUT NEGERI", Vector3(7.55, 3.05, -7.82), 40, Color(ACCENT), false)
	ct.no_depth_test = false
	ct.outline_size = 0
	room_labels["__chart"] = ct
	# the 50% line
	box(Vector3(6.2, 0.02, 0.02), Vector3(7.55, 1.65 + 0.6, -7.82), "#f2b01e", false, 0.0, null, mat("#f2b01e", 0.3, 0.0, "#f2b01e", 1.2))
	for i in 14:
		var x := CHART_X0 + (CHART_X1 - CHART_X0) * (i + 0.5) / 14.0
		var bar := box(Vector3(0.28, 1.0, 0.03), Vector3(x, 1.65, -7.81), ACCENT, false, 0.0, null, mat(ACCENT, 0.3, 0.0, ACCENT, 1.0))
		var lab := label("", Vector3(x, 1.5, -7.8), 18, Color("#b9b2d8"), false)
		lab.no_depth_test = false
		lab.outline_size = 0
		chart_bars.append([bar, lab])
	# violet glow over the analysis room
	var glow := OmniLight3D.new()
	glow.position = Vector3(7.5, 2.3, -5.0)
	glow.light_color = Color(ACCENT)
	glow.light_energy = 0.7
	glow.omni_range = 5.0
	add_child(glow)

func _apply_state_extra(s: Dictionary) -> void:
	super._apply_state_extra(s)
	var en := lang == "en"
	var list = s.get("states", [])
	var active: Array = []
	if typeof(list) == TYPE_ARRAY:
		for item in list:
			if typeof(item) == TYPE_DICTIONARY and item.get("active", true):
				active.append(item)
	# wall screens: national support, seat projection, weakest two states
	if screen_labels.size() == 3:
		var avg := 0.0
		for item in active:
			avg += float(item.get("support", 0.0))
		avg = avg / max(1, active.size())
		# one active state = a PRN run: say "state", not "national"
		if active.size() == 1:
			screen_labels[0][0].text = "STATE SUPPORT" if en else "SOKONGAN NEGERI"
		else:
			screen_labels[0][0].text = "NATIONAL SUPPORT" if en else "SOKONGAN NASIONAL"
		screen_labels[0][1].text = "%d%%" % int(round(avg))
		screen_labels[0][1].font_size = 96
		var weak := active.duplicate()
		weak.sort_custom(func(a, b): return float(a.get("support", 0.0)) < float(b.get("support", 0.0)))
		var names: Array = []
		for item in weak.slice(0, 2):
			names.append("%s %d%%" % [String(item.get("short", "")), int(round(float(item.get("support", 0.0))))])
		screen_labels[2][0].text = "NEEDS ATTENTION" if en else "PERLU PERHATIAN"
		screen_labels[2][1].text = "\n".join(names) if names.size() > 0 else "—"
		screen_labels[2][1].font_size = 56
	if room_labels.has("__restricted"):
		room_labels["__restricted"].text = "ANALYSIS CENTRE · STAFF ONLY" if en else "PUSAT ANALISIS · KAKITANGAN SAHAJA"
	# comparison chart
	if typeof(list) != TYPE_ARRAY:
		return
	for i in chart_bars.size():
		var bar: MeshInstance3D = chart_bars[i][0]
		var lab: Label3D = chart_bars[i][1]
		if i < list.size() and typeof(list[i]) == TYPE_DICTIONARY:
			var item: Dictionary = list[i]
			var sup: float = clamp(float(item.get("support", 0.0)), 0.0, 100.0)
			var h: float = max(0.02, sup / 100.0 * 1.2)
			bar.visible = true
			bar.scale.y = h
			bar.position.y = 1.65 + h / 2.0
			var col := _state_color(item)
			bar.material_override = mat(col, 0.3, 0.0, col, 1.0)
			lab.text = "%s\n%d%%" % [String(item.get("short", "")), int(round(sup))]
		else:
			bar.visible = false
			lab.text = ""

func _spawn_cast() -> void:
	super._spawn_cast()
	# analysts at the comparison wall
	npcs.append(spawn("aide", "tablet", Vector3(6.4, 0, -7.55), PI))
	npcs.append(spawn("makcik", "stand", Vector3(8.6, 0, -7.55), PI))
