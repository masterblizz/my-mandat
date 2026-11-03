extends "res://main.gd"
## Ibu Pejabat Parti — the party headquarters during the campaign.
##
## An assembly hall with a stage under the party banner, the candidate room
## whose wall board holds a card for every named party member (click a card
## to review that candidate), a manifesto room and a reception lobby.
## Extra world-state fields:
##   partyName, partyAbbr,
##   candidates [{id, name, role, influence, specialty, seats}], selected
## Extra event: {type:"world-pick", id} when a candidate card is reached.

const BOARD_X := -12.85          # west wall of the candidate room
const BOARD_Z0 := -7.4
const BOARD_Z1 := 1.4
const SPECIALTY := {
	"urban": "#19d3f2", "rural": "#5be3a4", "youth": "#c58bff",
	"economic": "#f2b01e", "media": "#ff7a59", "grassroots": "#8fd14f",
}

var cards := {}          # id -> {root, name, info, glow}
var card_ids: Array = []
var banner_label: Label3D
var stage_label: Label3D
var selected_id := ""

func _init() -> void:
	ROOMS = {
		"calon": [-13.0, -8.0, -4.0, 2.0, "#2a3442", "BILIK CALON", "CANDIDATE ROOM"],
		"dewan": [-4.0, -8.0, 9.0, 2.0, "#3b2a20", "DEWAN PERHIMPUNAN", "ASSEMBLY HALL"],
		"manifesto": [-13.0, 2.0, -4.0, 8.0, "#243040", "BILIK MANIFESTO", "MANIFESTO ROOM"],
		"lobi": [-4.0, 2.0, 9.0, 8.0, "#b9ae9a", "LOBI PARTI", "PARTY LOBBY"],
	}
	FLOORS = {
		"calon": ["carpet_tile", "#24304a", "#4a5f86", 1.0],
		"dewan": ["parquet", "#7a5034", "", 1.2],
		"manifesto": ["carpet", "#2c3a52", "#55688c", 0.9],
		"lobi": ["tiles", "#c4ab84", "#7d6648", 0.6],
	}
	INTERACT = {
		"nominate": ["calon", "PENAMAAN CALON", "NOMINATE CANDIDATES", Vector3(-8.5, 2.6, -7.5), Vector3(-8.5, 0, -6.2), Vector3(-8.5, 0, -8.0)],
		"rally": ["dewan", "LANCAR MANIFESTO", "LAUNCH MANIFESTO", Vector3(2.5, 1.85, -5.7), Vector3(2.5, 0, -4.4), Vector3(2.5, 0, -7.0)],
		"manifesto": ["manifesto", "DRAF MANIFESTO", "DRAFT MANIFESTO", Vector3(-8.5, 1.8, 5.0), Vector3(-8.5, 0, 6.6), Vector3(-8.5, 0, 5.0)],
		"pa": ["lobi", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(5.2, 2.15, 4.0), Vector3(5.2, 0, 5.3), Vector3(5.2, 0, 4.0)],
		"exit": ["lobi", "KELUAR KE BANDAR", "BACK TO THE CITY", Vector3(2.5, 2.55, 7.4), Vector3(2.5, 0, 6.4), Vector3(2.5, 0, 9.0)],
	}
	LOBBY_POINT = Vector3(2.5, 0, 5.0)
	INTRO_START = Vector3(4.6, 0, 10.9)
	door_pos = Vector3(2.5, 0, 8.0)
	wall_color = "#d3c9b6"
	overview_target = Vector3(-2.0, 0, -0.5)
	overview_dist = Vector2(23.0, 31.0)

# ── building ─────────────────────────────────────────────────────────
func _build_exterior() -> void:
	box(Vector3(80, 0.1, 70), Vector3(0, -0.11, 2), "#5f8a4a", false)
	floor_slab(-16, 8.0, 12, 9.6, "#a9a59b", "luar", floor_mat("tiles", "#b9b1a2", "#8a8274", 0.5))
	floor_slab(-30, 9.6, 30, 14.5, "#3a3d43", "luar", floor_mat("carpet", "#3a3d43", "#5a5d63", 2.0))
	for i in 56:
		box(Vector3(0.5, 0.16, 0.22), Vector3(-16.0 + i * 0.5 + 0.25, 0.08, 9.62), "#f2f2ee" if i % 2 == 0 else "#1c1c1c", false)
	for x in range(-28, 30, 4):
		box(Vector3(1.8, 0.012, 0.14), Vector3(x, 0.006, 12.1), "#e8e2c8", false)
	for x in [-15.0, 11.0]:
		palm(Vector3(x, 0, 8.9))
	for x in [-11.0, -9.5, -6.5, -5.0, 6.0, 7.5]:
		bunga_raya(Vector3(x, 0, 8.5))
	party_mat = StandardMaterial3D.new()
	party_mat.albedo_color = player_color
	party_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	# party-coloured facade band and sign
	var band := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(22.0, 0.5, 0.1)
	band.mesh = bm
	band.material_override = party_mat
	band.position = Vector3(-2.0, 2.95, 8.14)
	add_child(band)
	facade.append(band)
	facade.append(box(Vector3(7.0, 0.9, 0.12), Vector3(2.5, 3.65, 8.12), "#0b1a2c", false))
	var sign := label("IBU PEJABAT PARTI", Vector3(2.5, 3.7, 8.2), 86, Color.WHITE, false)
	sign.pixel_size = 0.0062
	sign.no_depth_test = false
	room_labels["__sign"] = sign
	facade.append(sign)
	box(Vector3(0.09, 6.2, 0.09), Vector3(-3.5, 3.1, 9.0), "#d7dbe0", false, 0.0, null, mat("#d7dbe0", 0.3, 0.7))
	plane(Vector2(1.8, 0.9), Vector3(-2.58, 5.65, 9.0), jalur, true, 0.0, null, true)
	box(Vector3(0.09, 6.2, 0.09), Vector3(8.5, 3.1, 9.0), "#d7dbe0", false, 0.0, null, mat("#d7dbe0", 0.3, 0.7))
	var pflag := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(1.8, 0.9, 0.02)
	pflag.mesh = pm
	pflag.material_override = party_mat
	pflag.position = Vector3(9.42, 5.65, 9.0)
	add_child(pflag)
	for i in 30:
		var pen := MeshInstance3D.new()
		var pr := PrismMesh.new()
		pr.size = Vector3(0.36, 0.42, 0.01)
		pen.mesh = pr
		pen.material_override = party_mat if i % 3 != 2 else mat("#ffffff")
		pen.position = Vector3(-13.0 + i * 0.78, 3.3 - 0.3 * sin(PI * (i + 0.5) / 30.0), 9.3)
		pen.rotation.z = PI
		add_child(pen)
	door_l = Node3D.new()
	door_r = Node3D.new()
	add_child(door_l)
	add_child(door_r)
	var glass := mat("#9fd3ef", 0.05, 0.2)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(0.62, 0.83, 0.94, 0.32)
	box(Vector3(1.2, 2.5, 0.05), Vector3(1.9, 1.25, 8.0), null, false, 0.0, door_l, glass)
	box(Vector3(1.2, 2.5, 0.05), Vector3(3.1, 1.25, 8.0), null, false, 0.0, door_r, glass)

func _build_walls() -> void:
	wall_x(-8.0, -13.0, 9.0)
	wall_x(8.0, -13.0, 9.0, [[1.3, 3.7]])
	wall_z(-13.0, -8.0, 8.0)
	wall_z(9.0, -8.0, 8.0)
	wall_z(-4.0, -8.0, 2.0, [[-3.2, -1.4]])
	wall_z(-4.0, 2.0, 8.0, [[4.2, 5.8]])
	wall_x(2.0, -13.0, -4.0, [[-9.4, -7.6]])
	wall_x(2.0, -4.0, 9.0, [[1.0, 4.0]])

func _apply_lang_extra() -> void:
	if room_labels.has("__sign"):
		room_labels["__sign"].text = "IBU PEJABAT PARTI" if lang == "ms" else "PARTY HEADQUARTERS"

func _build_furniture() -> void:
	# ── assembly hall: stage under the party banner, rows of chairs ──
	box(Vector3(8.0, 0.5, 2.4), Vector3(2.5, 0.25, -6.6), "#4a2e16", true, 0.0, null, mat("#4a2e16", 0.5))
	var banner := MeshInstance3D.new()
	var bmesh := BoxMesh.new()
	bmesh.size = Vector3(8.0, 1.6, 0.06)
	banner.mesh = bmesh
	banner.material_override = party_mat
	banner.position = Vector3(2.5, 2.7, -7.9)
	add_child(banner)
	banner_label = label("", Vector3(2.5, 2.95, -7.85), 120, Color.WHITE, false)
	banner_label.no_depth_test = false
	banner_label.outline_size = 0
	stage_label = label("", Vector3(2.5, 2.25, -7.85), 40, Color.WHITE, false)
	stage_label.outline_size = 0
	stage_label.no_depth_test = false
	box(Vector3(0.6, 1.1, 0.5), Vector3(2.5, 1.05, -6.0), "#20354a", true)
	plane(Vector2(0.9, 0.45), Vector3(-2.6, 2.7, -7.88), jalur, true)
	plane(Vector2(0.9, 0.45), Vector3(7.6, 2.7, -7.88), jalur, true)
	for row in 4:
		for k in 8:
			chair(Vector3(-0.5 + k * 0.85, 0, -3.6 + row * 1.0), PI, "#7a2f3a")
	plane(Vector2(2.4, 9.0), Vector3(2.5, 0.009, -3.0), Tex.songket_rug(), false, PI / 2)
	# ── candidate room: the board and a review table ──
	box(Vector3(0.08, 2.4, BOARD_Z1 - BOARD_Z0 + 0.4), Vector3(BOARD_X - 0.04, 1.55, (BOARD_Z0 + BOARD_Z1) / 2.0), "#0b1a2c", false)
	var bt := label("PAPAN CALON", Vector3(BOARD_X + 0.02, 2.95, (BOARD_Z0 + BOARD_Z1) / 2.0), 60, Color("#f2b01e"), false)
	bt.rotation.y = PI / 2
	bt.no_depth_test = false
	bt.outline_size = 0
	room_labels["__board"] = bt
	# light the board so the cards read from across the room
	var board_light := SpotLight3D.new()
	board_light.position = Vector3(-10.4, 3.6, (BOARD_Z0 + BOARD_Z1) / 2.0)
	board_light.rotation = Vector3(0, -PI / 2, 0)
	board_light.rotate_object_local(Vector3.RIGHT, deg_to_rad(-35))
	board_light.light_energy = 2.5
	board_light.spot_range = 8.0
	board_light.spot_angle = 60.0
	board_light.light_color = Color("#fff1dc")
	add_child(board_light)
	box(Vector3(2.8, 0.76, 1.2), Vector3(-8.5, 0.38, -4.0), "#5a3a1e", true, 0.0, null, mat("#5a3a1e", 0.45))
	for x in [-9.4, -7.6]:
		chair(Vector3(x, 0, -4.9), 0.0)
		chair(Vector3(x, 0, -3.1), PI)
	box(Vector3(4.0, 1.6, 0.06), Vector3(-8.5, 1.7, -7.9), "#f7f7f2", false)
	for i in 10:
		box(Vector3(0.32, 0.22, 0.01), Vector3(-10.0 + (i % 5) * 0.75, 2.05 - int(i / 5) * 0.4, -7.86), ["#f5d76e", "#a8d8f0", "#f2a7a0"][i % 3], false)
	plant(Vector3(-4.6, 0, -7.4))
	plant(Vector3(-4.6, 0, 1.4))
	# ── manifesto room ──
	box(Vector3(2.4, 0.76, 1.0), Vector3(-8.5, 0.38, 5.0), "#3a4656", true)
	box(Vector3(0.6, 0.36, 0.04), Vector3(-8.5, 1.0, 4.75), "#0b0f14", false, 0.0, null, mat("#0b0f14", 0.3, 0.2, "#2a74a8", 0.8))
	chair(Vector3(-8.5, 0, 5.7), PI)
	plane(Vector2(2.2, 1.3), Vector3(-12.9, 1.7, 5.0), Tex.batik(), true, PI / 2)
	for i in 4:
		box(Vector3(0.3, 0.4, 0.02), Vector3(-6.0 + i * 0.4, 0.98, 4.7), ["#f2b01e", "#19d3f2", "#ffffff", "#f2a7a0"][i], false)
	# ── lobby: reception, party wall ──
	box(Vector3(2.4, 1.05, 0.7), Vector3(6.6, 0.525, 3.4), "#e9e6df", true)
	box(Vector3(2.5, 0.04, 0.8), Vector3(6.6, 1.07, 3.4), "#cdbb98", false)
	portrait(Vector3(-1.5, 2.1, 2.1), 1.0)
	plane(Vector2(3.4, 2.4), Vector3(2.5, 0.008, 5.0), Tex.songket_rug())
	plant(Vector3(-3.4, 0, 7.4))
	plant(Vector3(8.4, 0, 7.4))
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

## One card per candidate on the board, in a grid; each is pickable.
func _build_cards(list: Array) -> void:
	var ids: Array = []
	for c in list:
		ids.append(String(c.get("id", "")))
	if ids != card_ids:
		for id in cards:
			cards[id]["root"].queue_free()
		cards.clear()
		card_ids = ids
		var n: int = max(1, list.size())
		var cols: int = int(ceil(n / 5.0))
		var rows: int = int(ceil(n / float(cols)))
		var span := BOARD_Z1 - BOARD_Z0
		var cw := span / cols
		# ~0.08 m per character at this font size
		name_chars = max(10, int((cw - 0.25) / 0.085))
		for i in list.size():
			var col: int = i % cols
			var row: int = i / cols
			var z := BOARD_Z0 + cw * (col + 0.5)
			var y: float = 2.55 - row * (1.9 / max(1, rows - 1) if rows > 1 else 0.0)
			var root := Node3D.new()
			root.position = Vector3(BOARD_X + 0.03, y, z)
			root.rotation.y = PI / 2
			add_child(root)
			box(Vector3(cw - 0.1, 0.34, 0.03), Vector3.ZERO, "#1d3556", false, 0.0, root, mat("#1d3556", 0.5, 0.0, "#0e2340", 0.6))
			var glow := MeshInstance3D.new()
			var gm := BoxMesh.new()
			gm.size = Vector3(0.05, 0.34, 0.035)
			glow.mesh = gm
			glow.position = Vector3(-(cw - 0.1) / 2.0 + 0.03, 0, 0.005)
			root.add_child(glow)
			var nm := label("", Vector3(0.03, 0.07, 0.03), 26, Color.WHITE, false, root)
			nm.no_depth_test = false
			nm.outline_size = 0
			var info := label("", Vector3(0.03, -0.08, 0.03), 18, Color("#8aa3b8"), false, root)
			info.no_depth_test = false
			info.outline_size = 0
			# pick body + where the player stands to read it
			var body := StaticBody3D.new()
			body.collision_layer = LAYER_PICK
			body.collision_mask = 0
			body.set_meta("pick", ids[i])
			body.set_meta("stand", Vector3(BOARD_X + 1.3, 0, clamp(z, BOARD_Z0 + 0.6, BOARD_Z1 - 0.6)))
			body.set_meta("face", Vector3(BOARD_X, 0, z))
			var cs := CollisionShape3D.new()
			var sh := BoxShape3D.new()
			sh.size = Vector3(cw - 0.1, 0.34, 0.2)
			cs.shape = sh
			body.add_child(cs)
			root.add_child(body)
			cards[ids[i]] = {"root": root, "name": nm, "info": info, "glow": glow}
	for c in list:
		var id := String(c.get("id", ""))
		if not cards.has(id):
			continue
		var card: Dictionary = cards[id]
		var seats := int(c.get("seats", 0))
		card["name"].text = _fit(String(c.get("name", "")), name_chars)
		var en := lang == "en"
		card["info"].text = "%s · INF %d · %s" % [String(c.get("role", "")), int(c.get("influence", 0)), ("%d %s" % [seats, "SEAT(S)" if en else "KERUSI"]) if seats > 0 else ("FREE" if en else "BELUM DICALONKAN")]
		var gcol := Color(SPECIALTY.get(String(c.get("specialty", "")), "#8aa3b8"))
		var gmat := mat(gcol, 0.3, 0.0, gcol, 1.4)
		card["glow"].material_override = gmat
		var highlight := id == selected_id
		card["name"].modulate = Color("#f2b01e") if highlight else (player_color.lightened(0.35) if seats > 0 else Color.WHITE)

## Label3D cannot clip, so long names are shortened to the card width.
var name_chars := 22
func _fit(text: String, n: int) -> String:
	return text if text.length() <= n else text.substr(0, n - 1) + "…"

func _apply_state_extra(s: Dictionary) -> void:
	var name := String(s.get("partyName", ""))
	var abbr := String(s.get("partyAbbr", name))
	if banner_label:
		banner_label.text = abbr.to_upper()
		stage_label.text = name.to_upper()
	selected_id = String(s.get("selected", ""))
	var list = s.get("candidates", [])
	if typeof(list) == TYPE_ARRAY:
		_build_cards(list)
	if room_labels.has("__board"):
		room_labels["__board"].text = "CANDIDATE BOARD" if lang == "en" else "PAPAN CALON"

func _probe_points() -> Dictionary:
	var out := {}
	for id in cards:
		out["card:" + id] = (cards[id]["root"] as Node3D).global_position
	return out

# ── cast ──────────────────────────────────────────────────────────────
func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(5.2, 0, 4.0), PI)
	npcs.append(spawn("admin", "type", Vector3(6.6, 0, 2.7), PI))
	npcs.append(spawn("aide", "tablet", Vector3(-8.5, 0, -2.4), PI))
	npcs.append(spawn("uncle", "sit", Vector3(-9.4, 0, -4.9), 0.0))
	npcs.append(spawn("makcik", "sit", Vector3(-7.6, 0, -3.1), PI))
	npcs.append(spawn("anak_muda", "type", Vector3(-8.5, 0, 5.7), PI))
	for item in [["pakcik", Vector3(0.35, 0, -3.6)], ["makcik", Vector3(2.05, 0, -2.6)], ["anak_muda", Vector3(3.75, 0, -3.6)], ["uncle", Vector3(5.45, 0, -1.6)]]:
		npcs.append(spawn(item[0], "sit", item[1], PI))
	_spawn_player(LOBBY_POINT, PI)
