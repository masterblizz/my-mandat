extends Node3D
## MY MANDAT · Pusat Khidmat — a Sims-style 3D service centre.
##
## The whole building is generated here: seven rooms around a corridor, a
## street outside, MakeHuman cast members, a navmesh baked at start-up and a
## free orbit camera whose near walls drop away (cutaway) so every room stays
## readable. All game state lives in the Next.js page; this scene only draws
## and reports what the player does.
##
## Bridge (window.postMessage, JSON strings):
##   page -> scene  {type:"office-state", lang, player, playerName, playerColor, pa, night, badges, intro}
##                  {type:"office-skip"} · {type:"office-probe"} (test aid)
##   scene -> page  {type:"office-ready"}
##                  {type:"office-intro", playing}
##                  {type:"office-room", room, action:"enter"}
##                  {type:"office-room", room, action:"open", id}

const Person := preload("res://person.gd")

const WALL_H := 2.8
const WALL_T := 0.16
const CUT_H := 0.42
const LAYER_FLOOR := 1
const LAYER_SOLID := 2
const LAYER_PICK := 4

# room id -> [x0, z0, x1, z1, floor colour, ms name, en name]
const ROOMS := {
	"yb": [-13.0, -9.0, -3.0, -2.5, "#7a5638", "BILIK YB", "YB'S OFFICE"],
	"mesyuarat": [-3.0, -9.0, 4.0, -2.5, "#3d4a5c", "BILIK MESYUARAT", "MEETING ROOM"],
	"media": [4.0, -9.0, 13.0, -2.5, "#252c39", "BILIK MEDIA", "MEDIA ROOM"],
	"koridor": [-13.0, -2.5, 13.0, -0.5, "#a39678", "KORIDOR", "CORRIDOR"],
	"gerakan": [-13.0, -0.5, -5.5, 9.0, "#5f6a76", "BILIK GERAKAN", "OPERATIONS ROOM"],
	"lobi": [-5.5, -0.5, 5.5, 9.0, "#b9ae9a", "LOBI & MENUNGGU", "LOBBY & WAITING"],
	"kaunter": [5.5, -0.5, 13.0, 5.0, "#a9b4bb", "KAUNTER ADUAN", "COMPLAINTS COUNTER"],
	"surau": [5.5, 5.0, 13.0, 9.0, "#58764f", "SURAU · PANTRI", "PRAYER ROOM · PANTRY"],
}

# id -> room, ms label, en label, marker, stand point, face point
var INTERACT := {
	"desk": ["yb", "MEJA STRATEGI", "STRATEGY DESK", Vector3(-8, 1.65, -6.6), Vector3(-8, 0, -5.0), Vector3(-8, 0, -6.6)],
	"pa": ["yb", "PEMBANTU PERIBADI", "PERSONAL ASSISTANT", Vector3(-4.6, 2.15, -6.6), Vector3(-4.6, 0, -5.3), Vector3(-4.6, 0, -6.6)],
	"meeting": ["mesyuarat", "MESYUARAT · PETI MASUK", "MEETINGS · INBOX", Vector3(0.5, 1.55, -5.75), Vector3(0.5, 0, -3.5), Vector3(0.5, 0, -5.75)],
	"tv": ["media", "BERITA TV", "LIVE NEWS", Vector3(8.5, 3.05, -8.6), Vector3(8.5, 0, -5.9), Vector3(8.5, 0, -9)],
	"board": ["gerakan", "JADUAL POLITIK", "POLITICAL SCHEDULE", Vector3(-12.6, 2.45, 4.0), Vector3(-11.0, 0, 5.4), Vector3(-12.9, 0, 4.6)],
	"residents": ["lobi", "DENGAR PENDUDUK", "LISTEN TO RESIDENTS", Vector3(-4.7, 2.0, 4.5), Vector3(-3.0, 0, 4.5), Vector3(-4.9, 0, 4.5)],
	"files": ["kaunter", "FAIL KAWASAN", "CONSTITUENCY FILES", Vector3(10.0, 1.9, 1.0), Vector3(8.6, 0, 1.1), Vector3(10.0, 0, 1.1)],
	"pantry": ["surau", "REHAT SEBENTAR", "TAKE A BREAK", Vector3(7.6, 1.6, 8.4), Vector3(7.6, 0, 7.2), Vector3(7.6, 0, 8.6)],
}

const LOBBY_POINT := Vector3(0, 0, 6.2)
const INTRO_START := Vector3(2.3, 0, 11.4)

var lang := "ms"
var night := false
var badges := {}
var player_model := "pa_male"
var player_color := Color("#f2b01e")
var player_name := ""
var pa_model := "pa_female"

var region: NavigationRegion3D
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var night_lights: Array[OmniLight3D] = []
var walls: Array = []          # [{mesh, center, full}]
var room_labels := {}          # room -> Label3D
var markers := {}              # id -> {label, orb}
var player: Node3D
var pa: Node3D
var queue_npc: Node3D
var npcs: Array = []
var facade: Array[Node3D] = []  # sign + awning: hidden while the camera works inside
var door_l: Node3D
var door_r: Node3D
var player_ring: MeshInstance3D
var player_tag: Label3D
var click_ring: MeshInstance3D
var click_ring_t := 0.0
var nav_ready := false

# camera rig
var target := Vector3(0, 0, 3)
var target_goal := Vector3(0, 0, 3)
var yaw := 0.35
var yaw_goal := 0.35
var pitch := deg_to_rad(52.0)
var dist := 17.0
var dist_goal := 17.0
var follow_player := false

var current_room := ""
var pending_open := ""
var intro_playing := false
var intro_done := false
var state_seen := false
var queue_at_counter := false
var queue_timer := 6.0

var _mat_cache := {}
var _js_cb = null
var _press_pos = null
var _dragging := false
var _rotating := false
var _touches := {}
var _pinch_d := 0.0
var _pinch_a := 0.0

func _ready() -> void:
	_build_environment()
	region = NavigationRegion3D.new()
	add_child(region)
	_build_exterior()
	_build_floors()
	_build_walls()
	_build_furniture()
	_build_markers()
	_build_camera()
	_bake_nav()
	_spawn_cast()
	_setup_bridge()
	_apply_lang()
	await get_tree().physics_frame
	await get_tree().physics_frame
	nav_ready = true
	if "--selftest" in OS.get_cmdline_user_args():
		_selftest()
		return
	# standalone (no page): play the intro anyway after a moment
	await get_tree().create_timer(1.2).timeout
	if not state_seen and not intro_done:
		start_intro()

# ── materials & primitives ───────────────────────────────────────────
func mat(c, rough := 0.85, metal := 0.0, emission = null, energy := 1.0) -> StandardMaterial3D:
	var key := "%s|%s|%s|%s|%s" % [str(c), rough, metal, str(emission), energy]
	if _mat_cache.has(key):
		return _mat_cache[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c if c is Color else Color(c)
	m.roughness = rough
	m.metallic = metal
	if emission != null:
		m.emission_enabled = true
		m.emission = emission if emission is Color else Color(emission)
		m.emission_energy_multiplier = energy
	_mat_cache[key] = m
	return m

## A box. solid=true also makes it a navmesh obstacle.
func box(size: Vector3, pos: Vector3, color, solid := true, rot_y := 0.0, parent: Node3D = null, m: Material = null) -> MeshInstance3D:
	var p := parent if parent else region
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m if m else mat(color)
	if solid:
		var body := StaticBody3D.new()
		body.collision_layer = LAYER_SOLID
		body.collision_mask = 0
		body.position = pos
		body.rotation.y = rot_y
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = size
		cs.shape = sh
		body.add_child(cs)
		body.add_child(mi)
		p.add_child(body)
	else:
		mi.position = pos
		mi.rotation.y = rot_y
		p.add_child(mi)
	return mi

func cyl(r: float, h: float, pos: Vector3, color, parent: Node3D = null, scale_x := 1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = 24
	mi.mesh = cm
	mi.material_override = mat(color, 0.6)
	mi.position = pos
	mi.scale = Vector3(scale_x, 1, 1)
	(parent if parent else region).add_child(mi)
	return mi

func sphere(r: float, pos: Vector3, color, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = r
	sm.height = r * 2
	sm.radial_segments = 16
	sm.rings = 8
	mi.mesh = sm
	mi.material_override = mat(color, 0.9)
	mi.position = pos
	(parent if parent else region).add_child(mi)
	return mi

func label(text: String, pos: Vector3, size := 48, color := Color.WHITE, billboard := true, parent: Node3D = null) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.006
	l.modulate = color
	l.outline_size = 10
	l.outline_modulate = Color(0.01, 0.03, 0.08, 0.9)
	l.position = pos
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED if billboard else BaseMaterial3D.BILLBOARD_DISABLED
	l.no_depth_test = billboard
	l.render_priority = 2 if billboard else 0
	(parent if parent else self).add_child(l)
	return l

func floor_slab(x0: float, z0: float, x1: float, z1: float, color, room := "") -> void:
	var size := Vector3(x1 - x0, 0.1, z1 - z0)
	var pos := Vector3((x0 + x1) / 2.0, -0.05, (z0 + z1) / 2.0)
	var body := StaticBody3D.new()
	body.collision_layer = LAYER_FLOOR
	body.collision_mask = 0
	body.position = pos
	body.set_meta("room", room)
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	body.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat(color, 0.9)
	body.add_child(mi)
	region.add_child(body)

# ── world ─────────────────────────────────────────────────────────────
func _build_environment() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.92
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-52), deg_to_rad(-28), 0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 45.0
	add_child(sun)
	_apply_daylight()

func _apply_daylight() -> void:
	if night:
		env.background_color = Color("#070d1c")
		env.ambient_light_color = Color("#5c6a90")
		env.ambient_light_energy = 0.55
		sun.light_energy = 0.12
		sun.light_color = Color("#8da2d8")
	else:
		env.background_color = Color("#bcd6ea")
		env.ambient_light_color = Color("#c9d6e6")
		env.ambient_light_energy = 0.32
		sun.light_energy = 0.78
		sun.light_color = Color("#fff3df")
	for l in night_lights:
		l.visible = night

func _build_exterior() -> void:
	# grass (decor only, not walkable), sidewalk and road (walkable)
	box(Vector3(80, 0.1, 70), Vector3(0, -0.11, 4), "#5f8a4a", false)
	floor_slab(-16, 9.0, 16, 10.6, "#a9a59b", "luar")
	floor_slab(-30, 10.6, 30, 15.5, "#3a3d43", "luar")
	for x in range(-28, 30, 4):
		box(Vector3(1.8, 0.012, 0.14), Vector3(x, 0.006, 13.1), "#e8e2c8", false)
	# the YB's car beside the kerb
	var car := Node3D.new()
	car.position = Vector3(4.9, 0, 12.6)
	region.add_child(car)
	box(Vector3(3.9, 0.7, 1.75), Vector3(0, 0.55, 0), "#1f2a38", true, 0.0, car, mat("#1f2a38", 0.35, 0.5))
	box(Vector3(2.1, 0.5, 1.55), Vector3(-0.2, 1.15, 0), "#1f2a38", false, 0.0, car, mat("#1f2a38", 0.35, 0.5))
	for zz in [0.78, -0.78]:
		box(Vector3(1.8, 0.34, 0.02), Vector3(-0.2, 1.17, zz), "#36536d", false, 0.0, car, mat("#36536d", 0.1, 0.4))
	box(Vector3(0.02, 0.34, 1.35), Vector3(0.86, 1.17, 0), "#36536d", false, 0.0, car, mat("#36536d", 0.1, 0.4))
	box(Vector3(0.05, 0.12, 1.5), Vector3(1.96, 0.62, 0), "#fff4d0", false, 0.0, car, mat("#fff4d0", 0.4, 0.0, "#fff1c4", 1.2))
	for p in [Vector3(-1.25, 0.32, 0.88), Vector3(1.25, 0.32, 0.88), Vector3(-1.25, 0.32, -0.88), Vector3(1.25, 0.32, -0.88)]:
		var w := cyl(0.32, 0.22, p, "#111317", car)
		w.rotation.x = PI / 2
	# trees and lamps along the sidewalk
	for x in [-14.0, -8.5, 8.5, 14.0]:
		box(Vector3(0.22, 1.8, 0.22), Vector3(x, 0.9, 9.8), "#5a4030", true)
		sphere(1.05, Vector3(x, 2.5, 9.8), "#3f7a3a")
		sphere(0.8, Vector3(x + 0.5, 2.9, 9.6), "#4b8a43")
	for x in [-11.0, 11.0]:
		box(Vector3(0.1, 3.6, 0.1), Vector3(x, 1.8, 10.3), "#59606a", false)
		box(Vector3(0.6, 0.1, 0.25), Vector3(x, 3.6, 10.3), "#59606a", false, 0.0, null, mat("#fff2c8", 0.5, 0.0, "#ffe7b0", 1.5))
	# facade sign and awning over the glass doors
	facade.append(box(Vector3(4.4, 0.14, 1.5), Vector3(0, 2.72, 9.75), "#20354a", false))
	facade.append(box(Vector3(7.0, 0.9, 0.12), Vector3(0, 3.45, 9.12), "#0b1a2c", false))
	var sign := label("PUSAT KHIDMAT RAKYAT", Vector3(0, 3.5, 9.2), 92, Color("#f2b01e"), false)
	sign.pixel_size = 0.0065
	sign.no_depth_test = false
	room_labels["__sign"] = sign
	facade.append(sign)
	# sliding glass doors (not part of the navmesh: baked open)
	door_l = Node3D.new()
	door_r = Node3D.new()
	add_child(door_l)
	add_child(door_r)
	var glass := mat("#9fd3ef", 0.05, 0.2)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.albedo_color = Color(0.62, 0.83, 0.94, 0.32)
	box(Vector3(1.2, 2.5, 0.05), Vector3(-0.6, 1.25, 9.0), null, false, 0.0, door_l, glass)
	box(Vector3(1.2, 2.5, 0.05), Vector3(0.6, 1.25, 9.0), null, false, 0.0, door_r, glass)
	box(Vector3(0.05, 2.5, 0.07), Vector3(-0.02, 1.25, 9.0), "#c9ced4", false, 0.0, door_l)
	box(Vector3(0.05, 2.5, 0.07), Vector3(0.02, 1.25, 9.0), "#c9ced4", false, 0.0, door_r)

func _build_floors() -> void:
	for id in ROOMS:
		var r: Array = ROOMS[id]
		floor_slab(r[0], r[1], r[2], r[3], r[4], id)
		if id != "koridor":
			var l := label(r[5], Vector3((r[0] + r[2]) / 2.0, 0.02, r[3] - 0.55), 72, Color(0.95, 0.69, 0.12, 0.55), false)
			l.rotation.x = -PI / 2
			l.outline_size = 0
			l.pixel_size = 0.0075
			room_labels[id] = l

## Wall along X at fixed z with door gaps [[a,b],...].
func wall_x(z: float, x0: float, x1: float, gaps := []) -> void:
	var xs := [x0]
	for g in gaps:
		xs.append(g[0])
		xs.append(g[1])
	xs.append(x1)
	for i in range(0, xs.size(), 2):
		var a: float = xs[i]
		var b: float = xs[i + 1]
		if b - a > 0.05:
			_wall(Vector3(b - a, WALL_H, WALL_T), Vector3((a + b) / 2.0, WALL_H / 2.0, z))
	for g in gaps:
		# lintel above each doorway
		_wall(Vector3(g[1] - g[0], 0.5, WALL_T), Vector3((g[0] + g[1]) / 2.0, WALL_H - 0.25, z), false)

func wall_z(x: float, z0: float, z1: float, gaps := []) -> void:
	var zs := [z0]
	for g in gaps:
		zs.append(g[0])
		zs.append(g[1])
	zs.append(z1)
	for i in range(0, zs.size(), 2):
		var a: float = zs[i]
		var b: float = zs[i + 1]
		if b - a > 0.05:
			_wall(Vector3(WALL_T, WALL_H, b - a), Vector3(x, WALL_H / 2.0, (a + b) / 2.0))
	for g in gaps:
		_wall(Vector3(WALL_T, 0.5, g[1] - g[0]), Vector3(x, WALL_H - 0.25, (g[0] + g[1]) / 2.0), false)

func _wall(size: Vector3, pos: Vector3, solid := true) -> void:
	var mi := box(size, pos, "#e9e4da", solid, 0.0, null, mat("#ddd6c8", 0.92))
	# a darker cap reads as the cut edge when the wall drops away
	var cap := MeshInstance3D.new()
	var cm := BoxMesh.new()
	cm.size = Vector3(size.x + 0.01, 0.04, size.z + 0.01)
	cap.mesh = cm
	cap.material_override = mat("#2c3e50", 0.7)
	cap.position = Vector3(0, size.y / 2.0, 0)
	mi.add_child(cap)
	walls.append({"mesh": mi, "center": pos, "full": size.y, "h": size.y, "lintel": not solid})

func _build_walls() -> void:
	wall_x(-9.0, -13.0, 13.0)
	wall_x(9.0, -13.0, 13.0, [[-1.2, 1.2]])
	wall_z(-13.0, -9.0, 9.0)
	wall_z(13.0, -9.0, 9.0)
	wall_x(-2.5, -13.0, 13.0, [[-8.7, -7.3], [-0.2, 1.2], [7.8, 9.2]])
	wall_z(-3.0, -9.0, -2.5)
	wall_z(4.0, -9.0, -2.5)
	wall_x(-0.5, -13.0, -5.5, [[-9.7, -8.3]])
	wall_x(-0.5, -5.5, 5.5, [[-2.2, 2.2]])
	wall_x(-0.5, 5.5, 13.0)
	wall_z(-5.5, -0.5, 9.0)
	wall_z(5.5, -0.5, 5.0, [[1.3, 2.8]])
	wall_z(5.5, 5.0, 9.0, [[6.3, 7.7]])
	wall_x(5.0, 5.5, 13.0)

func chair(pos: Vector3, rot_y: float, color := "#2f3a48") -> void:
	var c := Node3D.new()
	c.position = pos
	c.rotation.y = rot_y
	region.add_child(c)
	box(Vector3(0.5, 0.08, 0.5), Vector3(0, 0.45, 0), color, false, 0.0, c)
	box(Vector3(0.5, 0.55, 0.07), Vector3(0, 0.76, -0.24), color, false, 0.0, c)
	box(Vector3(0.06, 0.42, 0.06), Vector3(0, 0.21, 0), "#59606a", false, 0.0, c)

func plant(pos: Vector3) -> void:
	box(Vector3(0.4, 0.45, 0.4), pos + Vector3(0, 0.22, 0), "#d8d2c4", true)
	sphere(0.32, pos + Vector3(0, 0.75, 0), "#3f7a3a")
	sphere(0.24, pos + Vector3(0.12, 1.02, 0.05), "#2f6430")

func _build_furniture() -> void:
	# ── Bilik YB ──
	box(Vector3(4.6, 0.01, 3.2), Vector3(-8, 0.005, -6.2), "#6a2f2f", false)
	box(Vector3(2.3, 0.78, 1.0), Vector3(-8, 0.39, -6.6), "#4a3524", true, 0.0, null, mat("#4a3524", 0.55))
	box(Vector3(0.66, 0.4, 0.04), Vector3(-7.7, 1.0, -6.85), "#11161d", false, 0.0, null, mat("#11161d", 0.3, 0.2, "#1f6a92", 0.6))
	box(Vector3(0.34, 0.02, 0.24), Vector3(-8.6, 0.8, -6.4), "#f4f1e8", false)
	chair(Vector3(-8, 0, -7.45), 0.0, "#2a2018")
	chair(Vector3(-8.5, 0, -5.75), PI)
	chair(Vector3(-7.5, 0, -5.75), PI)
	box(Vector3(2.6, 2.0, 0.42), Vector3(-11.4, 1.0, -8.7), "#5a3f2a", true)
	for i in 14:
		box(Vector3(0.12, 0.34, 0.3), Vector3(-12.55 + i * 0.17, 1.42 - (i % 2) * 0.62, -8.55), ["#a8432f", "#2f5f8a", "#c9a227", "#4d7a4a"][i % 4], false)
	box(Vector3(0.05, 2.3, 0.05), Vector3(-12.4, 1.15, -8.2), "#c9b26a", false)
	var flag := Node3D.new()
	flag.position = Vector3(-12.0, 2.0, -8.2)
	region.add_child(flag)
	for i in 14:
		box(Vector3(0.8, 0.034, 0.01), Vector3(0, 0.18 - i * 0.034, 0), "#cc0001" if i % 2 == 0 else "#ffffff", false, 0.0, flag)
	# Jalur Gemilang: 14 stripes, blue canton with the yellow crescent and star
	box(Vector3(0.4, 0.24, 0.012), Vector3(-0.2, 0.06, 0.004), "#010066", false, 0.0, flag)
	for d in [[0.075, Vector3(-0.27, 0.06, 0.012), "#ffcc00"], [0.064, Vector3(-0.245, 0.06, 0.016), "#010066"]]:
		var disc := cyl(d[0], 0.004, d[1], d[2], flag)
		disc.rotation.x = PI / 2
	var star := cyl(0.04, 0.004, Vector3(-0.13, 0.06, 0.016), "#ffcc00", flag)
	star.rotation.x = PI / 2
	(star.mesh as CylinderMesh).radial_segments = 14
	box(Vector3(0.9, 0.42, 2.0), Vector3(-12.45, 0.21, -4.6), "#3b4656", true)
	plant(Vector3(-3.6, 0, -8.4))
	plant(Vector3(-12.4, 0, -3.1))

	# ── Bilik Mesyuarat ──
	var table := cyl(0.95, 0.06, Vector3(0.5, 0.76, -5.75), "#6b4a32", null, 1.75)
	table.material_override = mat("#6b4a32", 0.45)
	box(Vector3(3.0, 0.72, 1.5), Vector3(0.5, 0.36, -5.75), "#4a3524", true, 0.0, null, mat("#3a2a1c", 0.6))
	for x in [-0.6, 0.5, 1.6]:
		chair(Vector3(x, 0, -6.95), 0.0)
		chair(Vector3(x, 0, -4.55), PI)
	chair(Vector3(-1.45, 0, -5.75), PI / 2)
	chair(Vector3(2.45, 0, -5.75), -PI / 2)
	box(Vector3(2.4, 1.2, 0.05), Vector3(0.5, 1.6, -8.9), "#f7f7f2", false)
	box(Vector3(2.2, 0.06, 0.02), Vector3(0.5, 2.05, -8.87), "#1d8bc4", false)
	plant(Vector3(3.5, 0, -8.5))

	# ── Bilik Media ──
	box(Vector3(3.4, 1.9, 0.1), Vector3(8.5, 1.95, -8.85), "#0a0d12", false)
	box(Vector3(3.2, 1.7, 0.02), Vector3(8.5, 1.95, -8.79), "#2a74a8", false, 0.0, null, mat("#2a74a8", 0.4, 0.0, "#2a74a8", 0.9))
	box(Vector3(3.2, 0.18, 0.025), Vector3(8.5, 1.22, -8.77), "#c0392b", false, 0.0, null, mat("#c0392b", 0.4, 0.0, "#c0392b", 1.0))
	var tvl := label("BERITA LANGSUNG", Vector3(8.5, 2.35, -8.74), 60, Color.WHITE, false)
	tvl.no_depth_test = false
	room_labels["__tv"] = tvl
	box(Vector3(0.75, 1.1, 0.5), Vector3(8.5, 0.55, -7.3), "#20354a", true)
	box(Vector3(0.04, 0.35, 0.04), Vector3(8.5, 1.27, -7.42), "#222", false)
	for x in [5.5, 6.7, 7.9, 9.1, 10.3, 11.5]:
		chair(Vector3(x, 0, -4.4), PI, "#46536a")
	box(Vector3(0.1, 1.4, 0.1), Vector3(11.9, 0.7, -6.3), "#333", false)
	box(Vector3(0.35, 0.25, 0.5), Vector3(11.9, 1.5, -6.3), "#1b1b1b", false)

	# ── Koridor ──
	box(Vector3(2.2, 1.0, 0.04), Vector3(-4.6, 1.6, -2.4), "#c9a46a", false)
	for i in 6:
		box(Vector3(0.28, 0.2, 0.01), Vector3(-5.4 + (i % 3) * 0.75, 1.75 - int(i / 3) * 0.35, -2.37), ["#f5d76e", "#a8d8f0", "#f2a7a0"][i % 3], false)
	plant(Vector3(-12.5, 0, -1.5))
	plant(Vector3(12.5, 0, -1.5))

	# ── Bilik Gerakan ──
	box(Vector3(0.06, 1.3, 3.6), Vector3(-12.88, 1.55, 4.0), "#f7f7f2", false)
	for i in 15:
		box(Vector3(0.01, 0.2, 0.28), Vector3(-12.84, 1.95 - int(i / 5) * 0.36, 2.6 + (i % 5) * 0.66), ["#f5d76e", "#a8d8f0", "#f2a7a0"][i % 3], false)
	box(Vector3(2.8, 0.78, 1.3), Vector3(-8.8, 0.39, 4.5), "#8a8f96", true, 0.0, null, mat("#7b828a", 0.5, 0.3))
	for p in [Vector3(-9.6, 0.81, 4.3), Vector3(-8.2, 0.81, 4.7)]:
		box(Vector3(0.5, 0.03, 0.35), p, "#2b3038", false)
	for x in [-9.7, -7.9]:
		chair(Vector3(x, 0, 3.4), 0.0)
		chair(Vector3(x, 0, 5.6), PI)
	box(Vector3(2.8, 1.6, 0.05), Vector3(-9.0, 1.6, 8.88), "#1b3b2a", false)
	for i in 9:
		box(Vector3(0.5, 0.4, 0.01), Vector3(-10.1 + (i % 3) * 1.0, 2.05 - int(i / 3) * 0.48, 8.85), ["#2f8f5a", "#c9a227", "#b8413a"][(i * 2) % 3], false)
	box(Vector3(0.45, 1.8, 2.4), Vector3(-6.0, 0.9, 7.4), "#5a3f2a", true)

	# ── Lobi ──
	box(Vector3(4.0, 0.01, 3.0), Vector3(0.8, 0.005, 4.3), "#284a6a", false)
	for z in [3.0, 4.0, 5.0, 6.0]:
		chair(Vector3(-4.85, 0, z), PI / 2, "#7a2f3a")
	box(Vector3(0.6, 0.4, 1.2), Vector3(-3.7, 0.2, 4.5), "#6b4a2e", true)
	box(Vector3(1.6, 1.05, 0.5), Vector3(3.8, 0.525, 1.4), "#e9e6df", true)
	box(Vector3(1.6, 0.04, 0.65), Vector3(3.8, 1.07, 1.4), "#cdbb98", false)
	plant(Vector3(-2.2, 0, 8.4))
	plant(Vector3(2.2, 0, 8.4))
	plant(Vector3(5.0, 0, 0.1))
	box(Vector3(0.35, 1.15, 0.35), Vector3(5.0, 0.58, 8.4), "#dfe6ea", true)
	box(Vector3(3.2, 0.7, 0.04), Vector3(0, 2.1, -0.42), "#0b1a2c", false)
	var welcome := label("SELAMAT DATANG", Vector3(0, 2.1, -0.38), 64, Color("#f2b01e"), false)
	welcome.no_depth_test = false
	room_labels["__welcome"] = welcome

	# ── Kaunter Aduan ──
	box(Vector3(0.8, 1.05, 3.4), Vector3(10.0, 0.525, 2.2), "#e9e6df", true)
	box(Vector3(0.95, 0.04, 3.5), Vector3(10.0, 1.07, 2.2), "#cdbb98", false)
	box(Vector3(0.04, 0.32, 0.5), Vector3(10.2, 1.25, 2.2), "#11161d", false, 0.0, null, mat("#11161d", 0.3, 0.2, "#1f6a92", 0.6))
	chair(Vector3(11.0, 0, 2.2), -PI / 2)
	for z in [0.4, 1.1, 1.8, 2.5, 3.2, 3.9]:
		box(Vector3(0.6, 1.35, 0.6), Vector3(12.55, 0.675, z), "#7d8791", true, 0.0, null, mat("#7d8791", 0.4, 0.5))
	box(Vector3(1.0, 0.45, 0.04), Vector3(9.0, 2.15, -0.42), "#0b1a2c", false)
	var qn := label("NO. 024", Vector3(9.0, 2.15, -0.38), 52, Color("#ff5d4f"), false)
	qn.no_depth_test = false

	# ── Surau · Pantri ──
	box(Vector3(0.1, 1.1, 3.4), Vector3(9.6, 0.55, 7.0), "#c9c2b2", true)
	for i in 3:
		box(Vector3(0.7, 0.015, 1.2), Vector3(10.6 + i * 0.85, 0.008, 6.8), ["#7b2d3a", "#2d5a7b", "#4a6b2d"][i], false)
	box(Vector3(3.0, 0.9, 0.6), Vector3(7.6, 0.45, 8.6), "#d9d4c8", true)
	box(Vector3(0.7, 1.8, 0.7), Vector3(6.0, 0.9, 5.5), "#dfe6ea", true)
	box(Vector3(0.9, 0.74, 0.9), Vector3(7.8, 0.37, 6.2), "#a88a64", true)
	chair(Vector3(7.8, 0, 5.5), 0.0)

	# night lighting: one warm lamp per room
	for id in ROOMS:
		var r: Array = ROOMS[id]
		var l := OmniLight3D.new()
		l.position = Vector3((r[0] + r[2]) / 2.0, 2.5, (r[1] + r[3]) / 2.0)
		l.light_color = Color("#ffe2b5")
		l.light_energy = 1.4
		l.omni_range = 7.5
		l.visible = false
		add_child(l)
		night_lights.append(l)

func _build_markers() -> void:
	for id in INTERACT:
		var it: Array = INTERACT[id]
		var orb := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.11
		sm.height = 0.22
		orb.mesh = sm
		var om := StandardMaterial3D.new()
		om.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		om.albedo_color = Color("#f2b01e")
		orb.material_override = om
		orb.position = it[3]
		add_child(orb)
		var l := label(it[1], it[3] + Vector3(0, 0.3, 0), 54, Color("#ffe6a8"))
		# a pick body around the object so clicks land on it
		var body := StaticBody3D.new()
		body.collision_layer = LAYER_PICK
		body.collision_mask = 0
		body.position = Vector3(it[3].x, 0.9, it[3].z)
		body.set_meta("interact", id)
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = Vector3(1.4, 1.8, 1.4)
		cs.shape = sh
		body.add_child(cs)
		add_child(body)
		markers[id] = {"orb": orb, "label": l, "base": it[3]}

func _build_camera() -> void:
	cam = Camera3D.new()
	cam.fov = 40
	cam.near = 0.1
	cam.far = 120
	add_child(cam)
	player_ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.3
	tm.outer_radius = 0.38
	player_ring.mesh = tm
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.albedo_color = Color("#f2b01e")
	player_ring.material_override = rm
	player_ring.scale = Vector3(1, 0.15, 1)
	add_child(player_ring)
	click_ring = MeshInstance3D.new()
	click_ring.mesh = tm
	var cm := StandardMaterial3D.new()
	cm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	cm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	cm.albedo_color = Color(0.1, 0.83, 0.95, 0.9)
	click_ring.material_override = cm
	click_ring.visible = false
	add_child(click_ring)

func _bake_nav() -> void:
	var nm := NavigationMesh.new()
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.geometry_collision_mask = LAYER_FLOOR | LAYER_SOLID
	nm.cell_size = 0.1
	nm.cell_height = 0.1
	nm.agent_radius = 0.3
	nm.agent_height = 1.7
	nm.agent_max_climb = 0.2
	nm.region_min_size = 1.0
	region.navigation_mesh = nm
	region.bake_navigation_mesh(false)

# ── cast ──────────────────────────────────────────────────────────────
func spawn(model: String, pose: String, pos: Vector3, rot_y: float, tint = null) -> Node3D:
	var p: Node3D = Person.new()
	add_child(p)
	p.position = pos
	p.rotation.y = rot_y
	p.setup(model, pose, tint)
	return p

func _spawn_cast() -> void:
	pa = spawn(pa_model, "tablet", Vector3(-4.6, 0, -6.6), -PI / 2 - 0.9)
	npcs.append(spawn("admin", "type", Vector3(11.0, 0, 2.2), -PI / 2))
	npcs.append(spawn("aide", "tablet", Vector3(-11.6, 0, 3.0), -PI / 2 + 0.4))
	npcs.append(spawn("makcik", "sit", Vector3(-4.85, 0, 3.0), PI / 2))
	npcs.append(spawn("pakcik", "sit", Vector3(-4.85, 0, 4.0), PI / 2))
	queue_npc = spawn("uncle", "sit", Vector3(-4.85, 0, 5.0), PI / 2)
	npcs.append(queue_npc)
	npcs.append(spawn("anak_muda", "tablet", Vector3(10.8, 0, -3.4), PI + 0.3))
	npcs.append(spawn("pakcik", "sit", Vector3(-0.6, 0, -6.95), 0.0))
	_spawn_player(LOBBY_POINT, PI)

func _spawn_player(pos: Vector3, rot_y: float) -> void:
	if player:
		player.queue_free()
	player = spawn(player_model, "stand", pos, rot_y, player_color)
	player.arrived.connect(_on_player_arrived)
	if not player_tag:
		player_tag = label("", Vector3.ZERO, 40, Color("#f2b01e"))
	player_tag.text = player_name

func _swap_pa(model: String) -> void:
	if model == pa_model and pa:
		return
	pa_model = model
	var t := pa.global_transform if pa else Transform3D()
	if pa:
		pa.queue_free()
	pa = spawn(pa_model, "tablet", t.origin, t.basis.get_euler().y)

# ── navigation ────────────────────────────────────────────────────────
func path_to(from: Vector3, to: Vector3) -> PackedVector3Array:
	var map := get_world_3d().navigation_map
	var a := NavigationServer3D.map_get_closest_point(map, from)
	var b := NavigationServer3D.map_get_closest_point(map, to)
	var p := NavigationServer3D.map_get_path(map, a, b, true)
	if p.size() == 0:
		p = PackedVector3Array([to])
	return p

func walk_player(to: Vector3, face = null) -> void:
	if not nav_ready or not player:
		return
	player.walk_path(path_to(player.global_position, to), face)

func room_at(p: Vector3) -> String:
	for id in ROOMS:
		var r: Array = ROOMS[id]
		if p.x >= r[0] and p.x <= r[2] and p.z >= r[1] and p.z <= r[3]:
			return id
	return "luar"

func _on_player_arrived() -> void:
	if intro_playing:
		_end_intro()
		return
	if pending_open != "":
		var id := pending_open
		pending_open = ""
		_post({"type": "office-room", "room": INTERACT[id][0], "action": "open", "id": id})

# ── intro: arrive by car and walk in ─────────────────────────────────
func start_intro() -> void:
	if intro_done or not nav_ready:
		return
	intro_playing = true
	player.global_position = INTRO_START
	player.rotation.y = PI
	follow_player = true
	dist_goal = 9.5
	dist = 9.5
	yaw = 0.55
	yaw_goal = 0.15
	target = INTRO_START
	_post({"type": "office-intro", "playing": true})
	walk_player(LOBBY_POINT, LOBBY_POINT + Vector3(0, 0, -3))

func _end_intro() -> void:
	intro_playing = false
	intro_done = true
	follow_player = false
	# whole-building overview, like a lot view: zoom in from here
	var vs := get_viewport().get_visible_rect().size
	target_goal = Vector3(0, 0, 0.8)
	dist_goal = 31.0 if vs.y > vs.x else 25.0
	yaw_goal = 0.3
	_post({"type": "office-intro", "playing": false})

func skip_intro() -> void:
	if not intro_playing:
		intro_done = true
		return
	player.stop()
	player.global_position = LOBBY_POINT
	player.rotation.y = PI
	_end_intro()

# ── per frame ─────────────────────────────────────────────────────────
func _process(delta: float) -> void:
	_update_camera(delta)
	_update_walls(delta)
	_update_doors(delta)
	_update_markers()
	var show_facade := target.z > 10.5 and not intro_playing
	for f in facade:
		f.visible = show_facade
	_update_queue(delta)
	if player:
		player_ring.global_position = player.global_position + Vector3(0, 0.02, 0)
		player_tag.global_position = player.global_position + Vector3(0, 2.05, 0)
		player_tag.visible = player_name != ""
		var room := room_at(player.global_position)
		if room != current_room:
			current_room = room
			if not intro_playing:
				_post({"type": "office-room", "room": room, "action": "enter"})
	if click_ring.visible:
		click_ring_t += delta
		var s := 1.0 + click_ring_t * 1.5
		click_ring.scale = Vector3(s, 0.15, s)
		(click_ring.material_override as StandardMaterial3D).albedo_color.a = max(0.0, 0.9 - click_ring_t * 1.4)
		if click_ring_t > 0.7:
			click_ring.visible = false

func _update_camera(delta: float) -> void:
	# portrait phones: fix the horizontal field of view so the room keeps its width
	var vs := get_viewport().get_visible_rect().size
	var portrait := vs.y > vs.x
	cam.keep_aspect = Camera3D.KEEP_WIDTH if portrait else Camera3D.KEEP_HEIGHT
	cam.fov = 58.0 if portrait else 40.0
	if follow_player and player:
		target_goal = player.global_position
	target = target.lerp(target_goal, clamp(delta * 4.0, 0.0, 1.0))
	yaw = lerp_angle(yaw, yaw_goal, clamp(delta * 6.0, 0.0, 1.0))
	dist = lerp(dist, dist_goal, clamp(delta * 6.0, 0.0, 1.0))
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	cam.global_position = target + Vector3(0, 0.6, 0) + off
	cam.look_at(target + Vector3(0, 0.6, 0), Vector3.UP)

## Sims-style cutaway: walls between the camera and the focus point drop
## to a stub so the rooms behind them stay visible.
func _update_walls(delta: float) -> void:
	var toward_cam := Vector3(sin(yaw), 0, cos(yaw))
	var focus := target
	for w in walls:
		var rel: Vector3 = w["center"] - focus
		rel.y = 0
		var cut: bool = rel.dot(toward_cam) > 0.9 or (w["center"] as Vector3).distance_to(cam.global_position) < 6.0
		# also keep the player in sight: drop walls just in front of them
		if not cut and player:
			var rp: Vector3 = w["center"] - player.global_position
			rp.y = 0
			cut = rp.dot(toward_cam) > 0.05 and rp.length() < 3.2
		var goal: float = (0.0 if w["lintel"] else CUT_H) if cut else w["full"]
		var h: float = lerp(float(w["h"]), goal, clamp(delta * 8.0, 0.0, 1.0))
		w["h"] = h
		var mi: MeshInstance3D = w["mesh"]
		var full: float = w["full"]
		mi.visible = h > 0.02
		mi.scale.y = max(0.001, h / full)
		if w["lintel"]:
			continue
		mi.position.y = (h - full) / 2.0

func _update_doors(delta: float) -> void:
	var near := false
	for p in [player, queue_npc]:
		if p and (p as Node3D).global_position.distance_to(Vector3(0, 0, 9)) < 2.8:
			near = true
	var goal := 1.15 if near else 0.0
	door_l.position.x = lerp(door_l.position.x, -goal, clamp(delta * 5.0, 0.0, 1.0))
	door_r.position.x = lerp(door_r.position.x, goal, clamp(delta * 5.0, 0.0, 1.0))

func _update_markers() -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for id in markers:
		var m: Dictionary = markers[id]
		var base: Vector3 = m["base"]
		if id == "pa" and pa:
			base = pa.global_position + Vector3(0, 2.15, 0)
		m["orb"].position = base + Vector3(0, sin(t * 2.2 + base.x) * 0.06, 0)
		m["label"].position = base + Vector3(0, 0.32, 0)
		m["orb"].visible = not intro_playing
		m["label"].visible = not intro_playing

## A resident takes their turn at the complaints counter, then sits again.
func _update_queue(delta: float) -> void:
	if not nav_ready or not queue_npc or queue_npc.is_walking():
		return
	queue_timer -= delta
	if queue_timer > 0:
		return
	queue_timer = 11.0
	queue_at_counter = not queue_at_counter
	if queue_at_counter:
		queue_npc.walk_path(path_to(queue_npc.global_position, Vector3(8.7, 0, 2.9)), Vector3(10, 0, 2.9))
	else:
		var p := path_to(queue_npc.global_position, Vector3(-4.85, 0, 5.0))
		queue_npc.walk_path(p, Vector3(0, 0, 5.0))
		await queue_npc.arrived
		if not queue_at_counter:
			queue_npc.set_pose("sit")

# ── input ─────────────────────────────────────────────────────────────
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			dist_goal = clamp(dist_goal * 0.9, 6.0, 36.0)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			dist_goal = clamp(dist_goal * 1.1, 6.0, 36.0)
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_press_pos = mb.position
				_dragging = false
			else:
				if not _dragging and _press_pos != null:
					_click(mb.position)
				_press_pos = null
				_dragging = false
		elif mb.button_index == MOUSE_BUTTON_RIGHT or mb.button_index == MOUSE_BUTTON_MIDDLE:
			_rotating = mb.pressed
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _rotating:
			yaw_goal -= mm.relative.x * 0.008
		elif _press_pos != null:
			if (mm.position - (_press_pos as Vector2)).length() > 6.0:
				_dragging = true
			if _dragging:
				_pan(mm.relative)
	elif event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			_touches[st.index] = st.position
			if _touches.size() == 1:
				_press_pos = st.position
				_dragging = false
			elif _touches.size() == 2:
				_press_pos = null
				_pinch_reset()
		else:
			if _touches.size() == 1 and _press_pos != null and not _dragging:
				_click(st.position)
			_touches.erase(st.index)
			if _touches.size() < 2:
				_pinch_d = 0.0
			if _touches.is_empty():
				_press_pos = null
				_dragging = false
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		_touches[sd.index] = sd.position
		if _touches.size() >= 2:
			var pts := _touches.values()
			var d: float = (pts[0] as Vector2).distance_to(pts[1])
			var a: float = ((pts[1] as Vector2) - (pts[0] as Vector2)).angle()
			if _pinch_d > 0.0:
				dist_goal = clamp(dist_goal * _pinch_d / max(d, 1.0), 6.0, 36.0)
				yaw_goal -= angle_difference(_pinch_a, a)
			_pinch_d = d
			_pinch_a = a
		elif _press_pos != null:
			if (sd.position - (_press_pos as Vector2)).length() > 10.0:
				_dragging = true
			if _dragging:
				_pan(sd.relative)
	elif event is InputEventKey and event.pressed and not event.echo:
		var k := event as InputEventKey
		if k.keycode == KEY_Q:
			yaw_goal += PI / 4
		elif k.keycode == KEY_E:
			yaw_goal -= PI / 4
		elif k.keycode == KEY_ESCAPE or k.keycode == KEY_SPACE:
			skip_intro()

func _pinch_reset() -> void:
	var pts := _touches.values()
	_pinch_d = (pts[0] as Vector2).distance_to(pts[1])
	_pinch_a = ((pts[1] as Vector2) - (pts[0] as Vector2)).angle()

func _pan(rel: Vector2) -> void:
	follow_player = false
	var k := dist / 900.0
	var right := Vector3(cos(yaw), 0, -sin(yaw))
	var fwd := Vector3(-sin(yaw), 0, -cos(yaw))
	target_goal += (-right * rel.x + fwd * rel.y) * k * 1.6
	target_goal.x = clamp(target_goal.x, -14.0, 14.0)
	target_goal.z = clamp(target_goal.z, -10.0, 12.0)

func _click(screen: Vector2) -> void:
	if intro_playing:
		skip_intro()
		return
	var from := cam.project_ray_origin(screen)
	var dir := cam.project_ray_normal(screen)
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 200.0, LAYER_FLOOR | LAYER_PICK)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return
	var col: Object = hit["collider"]
	if col.has_meta("interact"):
		var id: String = col.get_meta("interact")
		var it: Array = INTERACT[id]
		var stand: Vector3 = it[4]
		var face: Vector3 = it[5]
		if id == "pa" and pa:
			face = pa.global_position
			stand = pa.global_position + (pa.global_transform.basis.z * 1.1)
		pending_open = id
		_show_click(stand)
		if player.global_position.distance_to(stand) < 0.35:
			player.look_toward(face)
			_on_player_arrived()
		else:
			walk_player(stand, face)
	else:
		pending_open = ""
		var p: Vector3 = hit["position"]
		_show_click(p)
		walk_player(Vector3(p.x, 0, p.z))

func _show_click(p: Vector3) -> void:
	click_ring.global_position = Vector3(p.x, 0.03, p.z)
	click_ring_t = 0.0
	click_ring.visible = true

# ── page bridge ───────────────────────────────────────────────────────
func _setup_bridge() -> void:
	if not OS.has_feature("web"):
		return
	_js_cb = JavaScriptBridge.create_callback(_on_js_message)
	var window = JavaScriptBridge.get_interface("window")
	window.addEventListener("message", _js_cb)
	_post({"type": "office-ready"})

func _post(d: Dictionary) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.parent && window.parent.postMessage(%s, window.location.origin)" % JSON.stringify(JSON.stringify(d)), true)

func _on_js_message(args) -> void:
	var data = args[0].data
	if typeof(data) != TYPE_STRING:
		return
	var msg = JSON.parse_string(data)
	if typeof(msg) != TYPE_DICTIONARY:
		return
	match msg.get("type", ""):
		"office-state":
			_apply_state(msg)
		"office-skip":
			skip_intro()
		"office-probe":
			# test aid: where each gold marker is on screen, and where the player is
			var pts := {}
			for id in markers:
				var w: Vector3 = markers[id]["orb"].global_position
				if not cam.is_position_behind(w):
					var v := cam.unproject_position(w)
					pts[id] = [v.x, v.y]
			var vsz := get_viewport().get_visible_rect().size
			_post({"type": "office-probe", "markers": pts, "room": current_room, "intro": intro_playing, "size": [vsz.x, vsz.y],
				"player": [player.global_position.x, player.global_position.z] if player else []})

func _apply_state(s: Dictionary) -> void:
	var first := not state_seen
	state_seen = true
	lang = "en" if s.get("lang", "ms") == "en" else "ms"
	badges = s.get("badges", {})
	var n: bool = s.get("night", false)
	if n != night:
		night = n
		_apply_daylight()
	player_name = String(s.get("playerName", ""))
	var col = s.get("playerColor", "")
	var new_color := Color(col) if typeof(col) == TYPE_STRING and String(col).begins_with("#") else player_color
	var new_model: String = s.get("player", player_model)
	if new_model != player_model or new_color != player_color:
		player_model = new_model
		player_color = new_color
		_spawn_player(player.global_position if player else LOBBY_POINT, player.rotation.y if player else PI)
	_swap_pa(String(s.get("pa", pa_model)))
	_apply_lang()
	if first:
		if s.get("intro", true):
			start_intro()
		else:
			intro_done = true

func _apply_lang() -> void:
	var i := 6 if lang == "en" else 5
	for id in ROOMS:
		if room_labels.has(id):
			room_labels[id].text = ROOMS[id][i]
	room_labels["__sign"].text = "PUSAT KHIDMAT RAKYAT" if lang == "ms" else "CONSTITUENCY SERVICE CENTRE"
	room_labels["__tv"].text = "BERITA LANGSUNG" if lang == "ms" else "LIVE NEWS"
	room_labels["__welcome"].text = "SELAMAT DATANG" if lang == "ms" else "WELCOME"
	for id in markers:
		var it: Array = INTERACT[id]
		var text: String = it[2] if lang == "en" else it[1]
		var count := int(badges.get(id, 0))
		markers[id]["label"].text = text + ("  (%d)" % count if count > 0 else "")

# ── headless self-test: every room must be reachable from the street ──
func _selftest() -> void:
	var ok := true
	var start := INTRO_START
	var all := {"lobby": LOBBY_POINT}
	for id in INTERACT:
		all[id] = INTERACT[id][4]
	for id in all:
		var p := path_to(start, all[id])
		var end := p[p.size() - 1] if p.size() > 0 else Vector3.INF
		var reached := end.distance_to(all[id]) < 0.6 and p.size() > 1
		var length := 0.0
		for i in range(1, p.size()):
			length += p[i - 1].distance_to(p[i])
		print("SELFTEST %s points=%d length=%.1f reached=%s room=%s" % [id, p.size(), length, reached, room_at(all[id])])
		ok = ok and reached
	print("SELFTEST walls=%d interact=%d cast=%d" % [walls.size(), markers.size(), npcs.size() + 2])
	print("SELFTEST RESULT ", "PASS" if ok else "FAIL")
	get_tree().quit(0 if ok else 1)
