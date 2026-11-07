extends "res://main.gd"
## Pusat Media — the campaign media centre.
##
## A press briefing room (podium under the party backdrop, reporters and
## cameras on tripods), the broadcast control room (a wall of monitors with
## the live headline), the social media desk with a trending board, a small
## recording studio and the lobby. Extra world-state fields used:
##   headline, partyName, partyAbbr, day, totalDays

var monitor_labels: Array[Label3D] = []
var trend_labels: Array[Label3D] = []
var backdrop_label: Label3D
var ticker: Label3D
var flashes: Array[OmniLight3D] = []
var flash_timer := 2.0

func _init() -> void:
	ROOMS = {
		"sidang": [-12.0, -8.0, 1.0, 1.0, "#1e2a3a", "BILIK SIDANG MEDIA", "PRESS BRIEFING ROOM"],
		"kawalan": [1.0, -8.0, 10.0, 1.0, "#141b26", "BILIK KAWALAN SIARAN", "BROADCAST CONTROL"],
		"sosial": [-12.0, 1.0, -4.0, 8.0, "#232f44", "MEJA MEDIA SOSIAL", "SOCIAL MEDIA DESK"],
		"lobi": [-4.0, 1.0, 10.0, 8.0, "#b9ae9a", "LOBI MEDIA", "MEDIA LOBBY"],
	}
	FLOORS = {
		"sidang": ["carpet", "#1c2a40", "#3a5072", 0.9],
		"kawalan": ["carpet_tile", "#161e2c", "#2f3e58", 1.0],
		"sosial": ["carpet_tile", "#26324a", "#4a5f86", 1.0],
		"lobi": ["terrazzo", "#b9aa8c", "", 1.4],
	}
	INTERACT = {
		"press": ["sidang", "SIDANG MEDIA", "PRESS CONFERENCE", Vector3(-5.5, 2.1, -6.2), Vector3(-5.5, 0, -5.2), Vector3(-5.5, 0, -1.0)],
		"control": ["kawalan", "KONSOL SIARAN", "BROADCAST CONSOLE", Vector3(5.5, 1.75, -3.6), Vector3(5.5, 0, -2.4), Vector3(5.5, 0, -6.0)],
		"social": ["sosial", "DRAF MESEJ", "DRAFT MESSAGE", Vector3(-8.0, 1.8, 4.2), Vector3(-8.0, 0, 5.6), Vector3(-8.0, 0, 4.2)],
		"pa": ["lobi", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(6.5, 2.15, 4.4), Vector3(6.5, 0, 5.6), Vector3(6.5, 0, 4.4)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(3.0, 2.55, 7.4), Vector3(3.0, 0, 6.4), Vector3(3.0, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(3.0, 0, 5.0)
	INTRO_START = Vector3(5.0, 0, 10.9)
	door_pos = Vector3(3.0, 0, 8.0)
	wall_color = "#3d4859"
	interior_sun = 0.75
	overview_target = Vector3(-1.0, 0, -0.5)
	overview_dist = Vector2(22.0, 30.0)

# ── building ─────────────────────────────────────────────────────────
func _build_exterior() -> void:
	box(Vector3(80, 0.1, 70), Vector3(0, -0.11, 2), "#5f8a4a", false)
	floor_slab(-15, 8.0, 13, 9.6, "#a9a59b", "luar", floor_mat("tiles", "#b9b1a2", "#8a8274", 0.5))
	floor_slab(-30, 9.6, 30, 14.5, "#3a3d43", "luar", floor_mat("carpet", "#3a3d43", "#5a5d63", 2.0))
	for i in 56:
		box(Vector3(0.5, 0.16, 0.22), Vector3(-15.0 + i * 0.5 + 0.25, 0.08, 9.62), "#f2f2ee" if i % 2 == 0 else "#1c1c1c", false)
	for x in range(-28, 30, 4):
		box(Vector3(1.8, 0.012, 0.14), Vector3(x, 0.006, 12.1), "#e8e2c8", false)
	for x in [-14.0, 12.0]:
		palm(Vector3(x, 0, 8.9))
	for x in [-10.0, -8.5, -6.0, 8.0, 9.5]:
		bunga_raya(Vector3(x, 0, 8.5))
	# outside broadcast van with a satellite dish
	var van := Node3D.new()
	van.position = Vector3(-6.5, 0, 12.4)
	region.add_child(van)
	box(Vector3(4.6, 1.9, 2.0), Vector3(0, 1.15, 0), "#e9e6df", true, 0.0, van, mat("#e9e6df", 0.4, 0.2))
	box(Vector3(4.6, 0.25, 2.02), Vector3(0, 1.2, 0), "#c0392b", false, 0.0, van)
	var dish := cyl(0.6, 0.06, Vector3(0.8, 2.6, 0), "#d7dbe0", van)
	dish.rotation = Vector3(-0.7, 0, 0)
	box(Vector3(0.08, 0.5, 0.08), Vector3(0.8, 2.25, 0), "#888", false, 0.0, van)
	for p in [Vector3(-1.5, 0.35, 1.0), Vector3(1.5, 0.35, 1.0), Vector3(-1.5, 0.35, -1.0), Vector3(1.5, 0.35, -1.0)]:
		var w := cyl(0.35, 0.24, p, "#111317", van)
		w.rotation.x = PI / 2
	party_mat = StandardMaterial3D.new()
	party_mat.albedo_color = player_color
	party_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	facade.append(box(Vector3(7.0, 0.9, 0.12), Vector3(3.0, 3.65, 8.12), "#0b1a2c", false))
	var sign := label("PUSAT MEDIA KEMPEN", Vector3(3.0, 3.7, 8.2), 86, Color("#4fd6ec"), false)
	sign.pixel_size = 0.0062
	sign.no_depth_test = false
	room_labels["__sign"] = sign
	facade.append(sign)
	# "ON AIR" light over the door
	var onair := box(Vector3(1.4, 0.36, 0.08), Vector3(3.0, 2.95, 8.14), "#c0392b", false, 0.0, null, mat("#c0392b", 0.4, 0.0, "#ff2b2b", 1.8))
	facade.append(onair)
	var oa := label("ON AIR", Vector3(3.0, 2.95, 8.2), 50, Color.WHITE, false)
	oa.no_depth_test = false
	oa.outline_size = 0
	facade.append(oa)
	box(Vector3(0.09, 6.2, 0.09), Vector3(-2.0, 3.1, 9.0), "#d7dbe0", false, 0.0, null, mat("#d7dbe0", 0.3, 0.7))
	plane(Vector2(1.8, 0.9), Vector3(-1.08, 5.65, 9.0), jalur, true, 0.0, null, true)
	door_l = Node3D.new()
	door_r = Node3D.new()
	add_child(door_l)
	add_child(door_r)
	var glass := mat("#9fd3ef", 0.05, 0.2)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(0.62, 0.83, 0.94, 0.32)
	box(Vector3(1.2, 2.5, 0.05), Vector3(2.4, 1.25, 8.0), null, false, 0.0, door_l, glass)
	box(Vector3(1.2, 2.5, 0.05), Vector3(3.6, 1.25, 8.0), null, false, 0.0, door_r, glass)

func _build_walls() -> void:
	wall_x(-8.0, -12.0, 10.0)
	wall_x(8.0, -12.0, 10.0, [[1.8, 4.2]])
	wall_z(-12.0, -8.0, 8.0)
	wall_z(10.0, -8.0, 8.0)
	wall_z(1.0, -8.0, 1.0, [[-1.6, 0.0]])
	wall_x(1.0, -12.0, -4.0, [[-8.9, -7.1]])
	wall_x(1.0, -4.0, 1.0, [[-3.2, -0.8]])
	wall_x(1.0, 1.0, 10.0, [[4.6, 6.4]])
	wall_z(-4.0, 1.0, 8.0, [[3.6, 5.4]])

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "PUSAT MEDIA KEMPEN" if lang == "ms" else "CAMPAIGN MEDIA CENTRE"

func _build_furniture() -> void:
	# ── press briefing room ──
	var backdrop := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(6.0, 2.4, 0.05)
	backdrop.mesh = bm
	backdrop.material_override = party_mat
	backdrop.position = Vector3(-5.5, 1.8, -7.92)
	add_child(backdrop)
	backdrop_label = label("", Vector3(-5.5, 2.45, -7.88), 110, Color.WHITE, false)
	backdrop_label.no_depth_test = false
	backdrop_label.outline_size = 0
	# repeat-logo strip, like a real press wall
	for i in 6:
		var small := label("◆", Vector3(-8.0 + i * 1.0, 1.35, -7.88), 60, Color(1, 1, 1, 0.55), false)
		small.no_depth_test = false
		small.outline_size = 0
	box(Vector3(5.6, 0.35, 2.0), Vector3(-5.5, 0.175, -6.8), "#20354a", true)
	box(Vector3(0.7, 1.15, 0.5), Vector3(-5.5, 0.92, -6.3), "#0e2236", true, 0.0, null, mat("#0e2236", 0.3, 0.3))
	box(Vector3(0.02, 0.32, 0.02), Vector3(-5.5, 1.62, -6.15), "#222", false)
	for m in 4:
		box(Vector3(0.05, 0.05, 0.12), Vector3(-5.62 + m * 0.08, 1.52, -6.08), ["#c0392b", "#1f6aa8", "#f2b01e", "#2f8f5a"][m], false)
	plane(Vector2(0.9, 0.45), Vector3(-9.2, 2.6, -7.88), jalur, true)
	plane(Vector2(0.9, 0.45), Vector3(-1.8, 2.6, -7.88), jalur, true)
	for row in 3:
		for k in 6:
			chair(Vector3(-8.0 + k * 1.0, 0, -3.6 + row * 1.1), PI, "#46536a")
	# camera riser at the back with tripods
	box(Vector3(6.0, 0.3, 1.0), Vector3(-5.5, 0.15, 0.2), "#2a3442", true)
	for x in [-7.8, -5.5, -3.2]:
		_tripod(Vector3(x, 0.3, 0.2))
	# flash lights that pop now and then during the briefing
	for x in [-7.5, -3.5]:
		var f := OmniLight3D.new()
		f.position = Vector3(x, 1.8, -2.5)
		f.light_color = Color("#ffffff")
		f.light_energy = 0.0
		f.omni_range = 6.0
		add_child(f)
		flashes.append(f)

	# ── broadcast control room: monitor wall and consoles ──
	for i in 6:
		var x := 2.4 + (i % 3) * 2.4
		var y := 2.55 - int(i / 3) * 1.15
		box(Vector3(2.2, 1.05, 0.08), Vector3(x, y, -7.9), "#05080d", false)
		var tint: String = ["#0d2f4a", "#3a1414", "#123a2a", "#2a2a0e", "#1a1a3a", "#0d2f4a"][i]
		box(Vector3(2.05, 0.92, 0.02), Vector3(x, y, -7.84), tint, false, 0.0, null, mat(tint, 0.4, 0.0, tint, 1.2))
		var ml := label("", Vector3(x, y, -7.82), 30, Color.WHITE, false)
		ml.no_depth_test = false
		ml.outline_size = 0
		ml.width = 340
		ml.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		monitor_labels.append(ml)
	box(Vector3(7.6, 0.14, 0.03), Vector3(4.8, 0.95, -7.84), "#c0392b", false, 0.0, null, mat("#c0392b", 0.4, 0.0, "#c0392b", 1.2))
	ticker = label("", Vector3(4.8, 0.95, -7.81), 34, Color.WHITE, false)
	ticker.no_depth_test = false
	ticker.outline_size = 0
	for k in 2:
		var z := -4.4 + k * 1.6
		box(Vector3(6.4, 0.8, 0.9), Vector3(5.5, 0.4, z), "#232c38", true, 0.0, null, mat("#232c38", 0.4, 0.3))
		for m in 4:
			box(Vector3(0.6, 0.36, 0.04), Vector3(3.3 + m * 1.45, 1.0, z - 0.3), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, ["#1b6fa0", "#1b8a5a", "#a0521b", "#6a1ba0"][m], 0.9))
		for m in 3:
			chair(Vector3(4.0 + m * 1.6, 0, z + 0.75), PI)

	# ── social media desk: trending board ──
	box(Vector3(0.06, 1.8, 4.6), Vector3(-11.9, 1.65, 4.5), "#0b1a2c", false)
	var tl := label("TRENDING", Vector3(-11.85, 2.35, 4.5), 54, Color("#4fd6ec"), false)
	tl.rotation.y = PI / 2
	tl.no_depth_test = false
	tl.outline_size = 0
	room_labels["__trend"] = tl
	for i in 4:
		var t := label("", Vector3(-11.85, 1.95 - i * 0.32, 4.5), 34, Color.WHITE, false)
		t.rotation.y = PI / 2
		t.no_depth_test = false
		t.outline_size = 0
		trend_labels.append(t)
	box(Vector3(3.2, 0.76, 1.0), Vector3(-8.0, 0.38, 4.2), "#3a4656", true)
	for m in 4:
		box(Vector3(0.12, 0.2, 0.02), Vector3(-9.2 + m * 0.8, 0.88, 4.0), "#111", false, 0.0, null, mat("#111", 0.3, 0.2, "#4fd6ec", 0.5))
	for x in [-9.0, -7.0]:
		chair(Vector3(x, 0, 3.4), 0.0)
	plane(Vector2(2.2, 1.3), Vector3(-6.0, 1.7, 1.08), Tex.batik(), true, 0.0)

	# ── lobby: reception, waiting sofa, recording booth ──
	box(Vector3(2.4, 1.05, 0.7), Vector3(7.6, 0.525, 3.4), "#e9e6df", true)
	box(Vector3(2.5, 0.04, 0.8), Vector3(7.6, 1.07, 3.4), "#cdbb98", false)
	plane(Vector2(3.4, 2.4), Vector3(3.0, 0.008, 4.6), Tex.songket_rug())
	box(Vector3(2.4, 2.4, 2.2), Vector3(-1.6, 1.2, 4.3), "#2a3442", true, 0.0, null, mat("#2a3442", 0.6))
	box(Vector3(0.9, 0.24, 0.04), Vector3(-1.6, 2.6, 5.42), "#c0392b", false, 0.0, null, mat("#c0392b", 0.4, 0.0, "#ff2b2b", 1.6))
	var recl := label("REC", Vector3(-1.6, 2.6, 5.45), 34, Color.WHITE, false)
	recl.outline_size = 0
	recl.no_depth_test = false
	recl.outline_size = 0
	portrait(Vector3(0.6, 2.1, 1.1), 1.0)
	plant(Vector3(-3.4, 0, 7.4))
	plant(Vector3(9.4, 0, 7.4))
	for id in ROOMS:
		var r: Array = ROOMS[id]
		var l := OmniLight3D.new()
		l.position = Vector3((r[0] + r[2]) / 2.0, 2.5, (r[1] + r[3]) / 2.0)
		l.light_color = Color("#ffe2b5")
		l.light_energy = 2.4
		l.omni_range = 9.0
		l.visible = false
		add_child(l)
		night_lights.append(l)

func _tripod(base: Vector3) -> void:
	for a in 3:
		var leg := box(Vector3(0.03, 1.3, 0.03), base + Vector3(cos(a * TAU / 3.0) * 0.22, 0.62, sin(a * TAU / 3.0) * 0.22), "#333", false)
		leg.rotation = Vector3(sin(a * TAU / 3.0) * 0.3, 0, -cos(a * TAU / 3.0) * 0.3)
	box(Vector3(0.32, 0.28, 0.55), base + Vector3(0, 1.4, 0), "#1b1b1b", false)
	var lens := cyl(0.08, 0.2, base + Vector3(0, 1.4, -0.36), "#0b0b0b")
	lens.rotation.x = PI / 2
	sphere(0.03, base + Vector3(0.12, 1.58, -0.2), "#ff2b2b").material_override = mat("#ff2b2b", 0.3, 0.0, "#ff2b2b", 2.0)

func _apply_state_extra(s: Dictionary) -> void:
	var abbr := String(s.get("partyAbbr", s.get("partyName", "")))
	if backdrop_label:
		backdrop_label.text = abbr.to_upper()
	var en := lang == "en"
	var headline := String(s.get("headline", ""))
	if headline == "":
		headline = "No new reports" if en else "Tiada laporan baharu"
	var day := int(s.get("day", 1))
	var total_days := int(s.get("totalDays", 30))
	var titles := ["LIVE", "BREAKING", "POLL", "STREET", "SOCIAL", "CAMERA 3"] if en else ["LANGSUNG", "TERKINI", "TINJAUAN", "LAPANGAN", "MEDIA SOSIAL", "KAMERA 3"]
	# the page sends the clock line ("Q 3/20 · WK 28" in the YB term), else campaign day
	var clock := String(s.get("clock", ""))
	if clock == "":
		clock = "%s %d/%d" % ["DAY" if en else "HARI", day, total_days]
	for i in monitor_labels.size():
		var body := headline if i < 2 else (clock if i == 2 else ("%s · %s" % [abbr, "LIVE" if en else "LANGSUNG"]))
		monitor_labels[i].text = "%s\n%s" % [titles[i], body]
	# Label3D cannot clip, so the ticker shows a line that fits the red bar
	var line := "%s  ●  %s" % [clock, headline]
	ticker.text = line if line.length() <= 58 else line.substr(0, 57) + "…"
	var tags := ["#%sMenang" % abbr, "#PRU16", "#KosSaraHidup", "#AnakMudaMengundi"] if not en else ["#%sWins" % abbr, "#GE16", "#CostOfLiving", "#YouthVote"]
	# the page's own tags (term issues, the PRN negeri), when it sends them
	var page_tags = s.get("tags", null)
	if page_tags is Array and (page_tags as Array).size() >= trend_labels.size():
		tags = page_tags
	for i in trend_labels.size():
		trend_labels[i].text = "%d.  %s" % [i + 1, tags[i]]
	if room_labels.has("__trend"):
		room_labels["__trend"].text = "TRENDING"

func _process(delta: float) -> void:
	super(delta)
	# camera flashes in the briefing room
	flash_timer -= delta
	for f in flashes:
		f.light_energy = max(0.0, f.light_energy - delta * 12.0)
	if flash_timer <= 0.0 and flashes.size() > 0:
		flash_timer = randf_range(0.6, 2.4)
		flashes[randi() % flashes.size()].light_energy = 3.0

func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(6.5, 0, 4.4), PI)
	npcs.append(spawn("admin", "type", Vector3(7.6, 0, 2.7), PI))
	# reporters with devices in the seats, camera operators behind the tripods
	for item in [["anak_muda", Vector3(-8.0, 0, -3.6)], ["makcik", Vector3(-6.0, 0, -3.6)], ["uncle", Vector3(-4.0, 0, -2.5)], ["pakcik", Vector3(-7.0, 0, -1.4)], ["aide", Vector3(-3.0, 0, -1.4)]]:
		npcs.append(spawn(item[0], "sit", item[1], PI))
	for x in [-7.8, -3.2]:
		npcs.append(spawn("anak_muda" if x < -5 else "aide", "stand", Vector3(x, 0.3, 0.75), PI))
	# control room crew
	npcs.append(spawn("aide", "type", Vector3(4.0, 0, -3.65), PI))
	npcs.append(spawn("makcik", "type", Vector3(7.2, 0, -2.05), PI))
	# social media team
	npcs.append(spawn("anak_muda", "type", Vector3(-9.0, 0, 3.4), 0.0))
	_spawn_player(LOBBY_POINT, PI)
