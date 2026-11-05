extends Node3D
## Bridge to the MY MANDAT web game. When the city runs inside the
## game's /kawasan page (an iframe), the page posts the seat's profile
## (code, density, traits) and its zones; the profile decides what city
## gets built, and the zones are laid out over it. Only the selected zone
## is drawn (a small gold pin over its lot); tapping the ground selects
## the nearest zone and posts its id back so the game opens its panel.
## Outside the game a Bukit Bintang demo profile is used instead.
##
## Messages (window.postMessage):
##   game -> city  {type: "kawasan-state", state: {profile, zones, selected, placing}}
##                 zones carry a localised `name`: the selected zone's name
##                 floats over its lot, and while the player is placing a
##                 project every zone's name shows (gold) so they can aim.
##   city -> game  {type: "kawasan-godot-ready"} once loaded
##                 {type: "kawasan-zone-click", id}

const PIN_Y := 20.0          # hover height of the selection pin

var city: Node3D
var zones := []            # Dictionaries from the game: id, sentiment, ...
var centres := []          # Vector3 per zone
var zone_lots := []        # the lot Dictionary each zone sits on (or {})
var selected := ""
# Selection marker: a small gold pin bobbing above the zone's lot.
var marker: Node3D
var pin: MeshInstance3D
var _t := 0.0
var _js_cb: JavaScriptObject
var _js_intro: JavaScriptObject
var _press := Vector2.ZERO
var _embedded := false
var zone_labels: Array[Label3D] = []
var placing := false


func setup(c: Node3D) -> void:
	city = c
	marker = Node3D.new()
	marker.visible = false
	add_child(marker)
	# downward-pointing pin: an inverted cone with a small ball on top
	var cone := CylinderMesh.new()
	cone.top_radius = 4.0
	cone.bottom_radius = 0.0
	cone.height = 8.0
	cone.radial_segments = 4
	var pin_mat := _overlay_mat(Color(0.96, 0.77, 0.26, 1.0))
	pin_mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	pin_mat.emission_enabled = true
	pin_mat.emission = Color(0.96, 0.7, 0.2)
	pin_mat.emission_energy_multiplier = 0.6
	pin = MeshInstance3D.new()
	pin.mesh = cone
	pin.material_override = pin_mat
	marker.add_child(pin)

	if OS.has_feature("web"):
		# compare as text: eval's return type varies across browsers / builds
		_embedded = str(JavaScriptBridge.eval("(window.parent !== window) ? '1' : '0'", true)) == "1"
		_bridge()
	if not _embedded:
		# next frame, once the city has its HUD
		apply_state.call_deferred(_demo_state())


func _overlay_mat(col: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	# selection reads through buildings, like a strategy-game cursor
	m.no_depth_test = true
	m.render_priority = 10
	return m


func is_embedded() -> bool:
	return _embedded


# â”€â”€ web bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
func _bridge() -> void:
	_js_cb = JavaScriptBridge.create_callback(_on_js_state)
	var win := JavaScriptBridge.get_interface("window")
	win.kawasanGodotSetState = _js_cb
	_js_intro = JavaScriptBridge.create_callback(func(_args): city.get_node("CameraRig").intro())
	win.kawasanGodotIntro = _js_intro
	JavaScriptBridge.eval("""
		window.addEventListener('message', function (e) {
			var d = e.data;
			if (d && d.type === 'kawasan-state') window.kawasanGodotSetState(JSON.stringify(d.state));
			if (d && d.type === 'kawasan-intro') window.kawasanGodotIntro('1');
		});
		if (window.parent !== window) window.parent.postMessage({ type: 'kawasan-godot-ready' }, '*');
	""", true)


func _on_js_state(args: Array) -> void:
	var data = JSON.parse_string(str(args[0]))
	if data is Dictionary:
		apply_state(data)


## Tells the game the seat's city has finished building (the intro waits for it).
func post_built() -> void:
	if _embedded:
		JavaScriptBridge.eval("window.parent.postMessage({ type: 'kawasan-city-built' }, '*')", true)


func _post_click(id: String) -> void:
	if _embedded:
		JavaScriptBridge.eval("window.parent.postMessage({ type: 'kawasan-zone-click', id: %s }, '*')" % JSON.stringify(id), true)


# â”€â”€ state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
func apply_state(d: Dictionary) -> void:
	if d.get("profile") is Dictionary:
		city.apply_profile(d.profile)      # rebuilds only when the seat changes
	var zs: Array = d.get("zones", [])
	var relay := zs.size() != zones.size()
	zones = zs
	if relay:
		relayout()
	var sel := str(d.get("selected", ""))
	var moved := sel != selected
	selected = sel
	placing = bool(d.get("placing", false))
	_refresh_labels()
	_focus_selected(moved)


## Floating city-builder style labels: always face the camera, keep a
## readable on-screen size and read through buildings.
func _make_label(size: int, col: Color) -> Label3D:
	var l := Label3D.new()
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0011
	l.font_size = size
	l.outline_size = 10
	l.outline_modulate = Color(0.02, 0.05, 0.1, 0.9)
	l.modulate = col
	l.no_depth_test = true
	l.render_priority = 11
	add_child(l)
	return l


func _refresh_labels() -> void:
	for i in zones.size():
		if i >= zone_labels.size():
			zone_labels.append(_make_label(24, Color.WHITE))
		var l: Label3D = zone_labels[i]
		var z: Dictionary = zones[i]
		l.text = str(z.get("name", ""))
		var is_sel := str(z.get("id", "")) == selected
		# all names only while aiming a project; otherwise just the selected zone
		l.visible = l.text != "" and i < centres.size() and (placing or is_sel)
		if i < centres.size():
			l.position = (centres[i] as Vector3) + Vector3(0, 14.0, 0)
		l.modulate = Color(0.98, 0.8, 0.3)
		l.font_size = 17 if placing else 26
	for i in range(zones.size(), zone_labels.size()):
		zone_labels[i].visible = false


## Which lot kinds can stand for each game zone archetype, best first.
## A zone is placed on the free lot of the earliest kind in its list that
## is nearest its spread position, so "Paddy Village" lands on sawah or a
## kampung, a school zone on the school, and so on.
const ZONE_LOTS := {
	"townCentre": ["dataran", "landmark"],
	"mainVillage": ["kampung", "terrace", "bungalow"],
	"paddyVillage": ["paddy", "kampung"],
	"fishingVillage": ["@coast:kampung", "@river:kampung", "kampung"],
	"housingEstate": ["terrace", "bungalow", "condo"],
	"commercialHub": ["shoprow", "mall", "tower", "flat"],
	"marketHawkers": ["shoprow", "carpark", "flat"],
	"schoolZone": ["school", "field"],
	"industrialArea": ["factory", "flat", "carpark"],
	"industrialEstate": ["factory", "flat", "carpark"],
	"riverside": ["@river:*", "park", "lake"],
	"clinicHall": ["masjid", "park", "flat", "shoprow"],
}
const KIND_LOTS := {
	"urban": ["shoprow", "tower", "flat"], "village": ["kampung", "paddy"],
	"housing": ["terrace", "bungalow", "condo"], "commercial": ["shoprow", "mall"],
	"education": ["school", "field"], "industry": ["factory"],
	"river": ["@river:*", "park"], "market": ["shoprow", "carpark"],
	"community": ["masjid", "park", "field"],
}


func _lot_fits(lot: Dictionary, want: String) -> bool:
	var kind := want
	if want.begins_with("@"):
		var parts := want.substr(1).split(":")
		var p: Vector3 = lot.p
		if parts[0] == "river" and city._dist_to(city.river_pts, p) > city.RIVER_HALF + 60.0:
			return false
		if parts[0] == "coast" and (city.sea_dir == Vector3.ZERO or p.dot(city.sea_dir) < city.r_city * 0.6):
			return false
		kind = parts[1]
	return kind == "*" or lot.kind == kind


## Zone centres: each zone gets a spread position (sunflower spiral over
## the built-up area, zone 0 in the middle), then the nearest free lot of
## a kind that fits its archetype. Re-run after every rebuild, since the
## city depends on the seat.
func relayout() -> void:
	centres = []
	zone_lots = []
	var n := zones.size()
	var R: float = city.r_taman * 0.95
	var lots: Array = city.lots
	var used := {}
	for i in n:
		var z: Dictionary = zones[i]
		var want := Vector3.ZERO
		if i > 0 and n > 1:
			var r := R * sqrt(float(i) / (n - 1))
			var a := i * 2.39996
			want = Vector3(cos(a) * r, 0, sin(a) * r)
		var prefs: Array = ZONE_LOTS.get(str(z.get("archetype", "")), KIND_LOTS.get(str(z.get("kind", "")), []))
		var best := -1
		for kind in prefs + ["*"]:
			var best_d := INF
			for j in lots.size():
				if used.has(j) or not _lot_fits(lots[j], kind):
					continue
				var d: float = (lots[j].p as Vector3).distance_squared_to(want)
				if d < best_d:
					best_d = d
					best = j
			if best >= 0:
				break
		if best >= 0:
			used[best] = true
			centres.append(lots[best].p)
			zone_lots.append(lots[best])
			if "--debug-zones" in OS.get_cmdline_user_args():
				print("zone %s %s -> %s" % [z.get("id"), z.get("archetype"), lots[best].kind])
		else:
			centres.append(want)
			zone_lots.append({})
	_refresh_labels()
	_focus_selected(false)


func _spacing() -> float:
	return city.r_taman * 1.7 / sqrt(maxf(zones.size(), 1))


func _focus_selected(move_camera: bool) -> void:
	var idx := -1
	for i in mini(zones.size(), centres.size()):
		if str(zones[i].get("id", "")) == selected:
			idx = i
			break
	marker.visible = idx >= 0
	if idx < 0:
		return
	var c: Vector3 = centres[idx]
	marker.position = c
	if move_camera:
		var rig = city.get_node("CameraRig")
		rig.target = Vector3(c.x, rig.target.y, c.z)


func _process(dt: float) -> void:
	if marker == null or not marker.visible:
		return
	_t += dt
	# the pin keeps a constant on-screen size, bobbing and turning slowly
	var cam: Camera3D = city.get_node("CameraRig/Camera3D")
	var k := clampf(cam.global_position.distance_to(marker.global_position) / 320.0, 0.5, 2.6)
	pin.scale = Vector3.ONE * k
	pin.position = Vector3(0, PIN_Y * k + sin(_t * 2.0) * 1.6 * k, 0)
	pin.rotation.y = _t * 0.8


# â”€â”€ tap the ground to select the nearest zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
func _unhandled_input(e: InputEvent) -> void:
	if not (e is InputEventMouseButton) or e.button_index != MOUSE_BUTTON_LEFT:
		return
	if e.pressed:
		_press = e.position
		return
	if e.position.distance_to(_press) > 10.0 or centres.is_empty():
		return
	var cam: Camera3D = city.get_node("CameraRig/Camera3D")
	var o := cam.project_ray_origin(e.position)
	var dir := cam.project_ray_normal(e.position)
	if dir.y >= -0.01:
		return
	var hit := o + dir * (-o.y / dir.y)
	var best := -1
	var best_d := _spacing()
	for i in centres.size():
		var d: float = hit.distance_to(centres[i])
		if d < best_d:
			best_d = d
			best = i
	if best < 0:
		return
	selected = str(zones[best].get("id", ""))
	_focus_selected(true)
	_post_click(selected)


func _demo_state() -> Dictionary:
	var zs := []
	var types := ["townCentre", "commercialHub", "housingEstate", "paddyVillage", "schoolZone", "mainVillage", "riverside", "marketHawkers", "clinicHall"]
	for i in 36:
		zs.append({"id": "zone-%d" % i, "archetype": types[i % types.size()]})
	return {
		"profile": {"code": "P.120", "name": "Bukit Bintang", "density": 0.9,
			"traits": {"klLandmarks": true, "bukitBintang": true}},
		"zones": zs, "selected": "zone-0",
	}
