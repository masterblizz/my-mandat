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
var _js_cam: JavaScriptObject
var _press := Vector2.ZERO
var _embedded := false
var zone_labels: Array[Label3D] = []
var placing := false
var land_pick = null                  # [x, z] of the empty land picked while placing
var _site: Node3D                     # marker for that spot
var _facilities: Node3D               # buildings on zones founded on empty land
var _fac_key := ""
var _events: Node3D                   # disaster effects (flood / fire / drought)
var _ev_key := ""
var _ev_nodes := []                   # [{type, root, parts...}] animated each frame
var _site_roads := {}                 # zone id -> access road, routed once per city build


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
	_js_cam = JavaScriptBridge.create_callback(func(args): city.get_node("CameraRig").zoom_step(int(str(args[0]))))
	win.kawasanGodotCamera = _js_cam
	JavaScriptBridge.eval("""
		window.addEventListener('message', function (e) {
			var d = e.data;
			if (d && d.type === 'kawasan-state') window.kawasanGodotSetState(JSON.stringify(d.state));
			if (d && d.type === 'kawasan-intro') window.kawasanGodotIntro('1');
			if (d && d.type === 'kawasan-camera') window.kawasanGodotCamera(String(d.zoom || 0));
		});
		if (window.parent !== window) window.parent.postMessage({ type: 'kawasan-godot-ready' }, '*');
	""", true)


func _on_js_state(args: Array) -> void:
	var data = JSON.parse_string(str(args[0]))
	if data is Dictionary:
		apply_state(data)


## Tells the game the seat's city has finished building (the intro waits for it).
func _probe_land() -> void:
	var ok := 0
	var free := 0
	var tried := 0
	for i in 400:
		var p: Vector3 = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)) * float(city.reach_r)
		if not city.on_land(p):
			continue
		tried += 1
		if city.land_free(p, 30.0, 30.0):
			free += 1
			if city.access_road(p).size() == 2:
				ok += 1
	print("LANDPROBE tried=", tried, " free=", free, " reachable=", ok)


func post_built() -> void:
	if "--probe-land" in OS.get_cmdline_user_args():
		_probe_land()
	if _embedded:
		JavaScriptBridge.eval("window.parent.postMessage({ type: 'kawasan-city-built' }, '*')", true)


## The camera's view for the game's mini-map (yaw in degrees, target on
## the ground, horizontal camera-to-target distance, city radius).
func post_view(yaw: float, x: float, z: float, dist: float, ground: float, r_city: float) -> void:
	if _embedded:
		JavaScriptBridge.eval("window.parent.postMessage({ type: 'kawasan-view', yaw: %.1f, x: %.1f, z: %.1f, dist: %.1f, ground: %.1f, rCity: %.1f }, '*')" % [yaw, x, z, dist, ground, r_city], true)


func _post_land(p: Vector3) -> void:
	if _embedded:
		JavaScriptBridge.eval("window.parent.postMessage({ type: 'kawasan-land-click', x: %.1f, z: %.1f }, '*')" % [p.x, p.z], true)
	else:
		land_pick = [p.x, p.z]
		_update_site()


## The picked building site: a pulsing green pad with corner posts.
func _update_site() -> void:
	if _site == null:
		_site = Node3D.new()
		add_child(_site)
		var pad := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(30, 0.4, 30)
		pad.mesh = pm
		var mat := _overlay_mat(Color(0.3, 0.95, 0.45, 0.45))
		pad.material_override = mat
		_site.add_child(pad)
		for cx in [-1, 1]:
			for cz in [-1, 1]:
				var post := MeshInstance3D.new()
				var bm := BoxMesh.new()
				bm.size = Vector3(1.2, 6, 1.2)
				post.mesh = bm
				post.material_override = _overlay_mat(Color(1.0, 0.85, 0.2, 1.0))
				post.position = Vector3(cx * 15, 3, cz * 15)
				_site.add_child(post)
	var on: bool = placing and land_pick is Array and (land_pick as Array).size() == 2
	_site.visible = on
	if on:
		_site.position = Vector3(float(land_pick[0]), 0.3, float(land_pick[1]))


## Facilities on zones founded on empty land: scaffolding with a crane
## while under construction, the finished building once done.
func _update_facilities() -> void:
	var key := ""
	for z in zones:
		if z.get("facility", null) != null:
			key += "%s:%s:%s:%s;" % [z.get("id"), z.get("facility"), z.get("done"), z.get("pos")]
	if key == _fac_key:
		return
	_fac_key = key
	if _facilities == null:
		_facilities = Node3D.new()
		add_child(_facilities)
	for ch in _facilities.get_children():
		ch.free()
	for z in zones:
		var zp = z.get("pos", null)
		if z.get("facility", null) == null or not (zp is Array):
			continue
		var root := Node3D.new()
		root.position = Vector3(float(zp[0]), 0, float(zp[1]))
		var zid := str(z.get("id", ""))
		if not _site_roads.has(zid):
			# route and claim once: a claimed site would block its own lane
			_site_roads[zid] = city.access_road(root.position)
			city.claim_site(root.position, _site_roads[zid])
		var road: Array = _site_roads[zid]
		city.clear_trees(root.position, 18.0)
		_access_lane(road)
		_facilities.add_child(root)
		if bool(z.get("done", false)):
			_facility_model(root, str(z.facility))
		else:
			_scaffold(root)


## The site's access lane: asphalt over a kerbed pavement, joining the
## road it was routed to, with the trees along it cleared.
func _access_lane(road: Array) -> void:
	if road.size() != 2:
		return
	var a: Vector3 = road[0]
	var b: Vector3 = road[1]
	var d := Vector3(b.x - a.x, 0, b.z - a.z)
	var L := d.length()
	if L < 1.0:
		return
	var dir := d / L
	var n := Vector3(-dir.z, 0, dir.x)
	for k in int(L / 6.0) + 1:
		city.clear_trees(a + dir * (k * 6.0), 5.0)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	for layer in [[5.4, 0.06, Color(0.72, 0.71, 0.68)], [4.0, 0.1, Color(0.16, 0.17, 0.18)]]:
		var w: float = layer[0]
		var y := Vector3(0, float(layer[1]), 0)
		st.set_color(layer[2])
		for v in [a - n * w, a + n * w, b + n * w, a - n * w, b + n * w, b - n * w, a - n * w, b + n * w, a + n * w, a - n * w, b - n * w, b + n * w]:
			st.add_vertex(v + y)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = 0.95
	mi.material_override = m
	_facilities.add_child(mi)


func _fbox(parent: Node3D, pos: Vector3, size: Vector3, col: Color) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = 0.85
	mi.material_override = m
	mi.position = pos + Vector3(0, size.y * 0.5, 0)
	parent.add_child(mi)


func _scaffold(r: Node3D) -> void:
	_fbox(r, Vector3.ZERO, Vector3(28, 0.3, 28), Color(0.55, 0.45, 0.32))       # cleared site
	for cx in [-1, 1]:
		for cz in [-1, 1]:
			_fbox(r, Vector3(cx * 8, 0, cz * 6), Vector3(0.8, 12, 0.8), Color(0.75, 0.75, 0.72))
	_fbox(r, Vector3(0, 6, 0), Vector3(17, 0.6, 13), Color(0.75, 0.75, 0.72))
	_fbox(r, Vector3(0, 12, 0), Vector3(17, 0.6, 13), Color(0.75, 0.75, 0.72))
	_fbox(r, Vector3(11, 0, -9), Vector3(1.6, 34, 1.6), Color(0.98, 0.78, 0.12))  # crane mast
	_fbox(r, Vector3(4, 33, -9), Vector3(22, 1.4, 1.4), Color(0.98, 0.78, 0.12))  # jib


func _facility_model(r: Node3D, f: String) -> void:
	var white := Color(0.95, 0.95, 0.93)
	match f:
		"clinic":
			_fbox(r, Vector3.ZERO, Vector3(24, 9, 16), white)
			_fbox(r, Vector3(0, 9, 0), Vector3(25, 0.8, 17), Color(0.2, 0.55, 0.7))
			_fbox(r, Vector3(0, 9.8, 0), Vector3(6, 0.6, 2), Color(0.9, 0.15, 0.15))
			_fbox(r, Vector3(0, 9.8, 0), Vector3(2, 0.6, 6), Color(0.9, 0.15, 0.15))
		"surau":
			_fbox(r, Vector3.ZERO, Vector3(16, 7, 16), white)
			var dome := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 5.5
			sm.height = 8.0
			dome.mesh = sm
			var dm := StandardMaterial3D.new()
			dm.albedo_color = Color(0.2, 0.6, 0.55)
			dome.material_override = dm
			dome.position = Vector3(0, 8.5, 0)
			r.add_child(dome)
			_fbox(r, Vector3(10, 0, 10), Vector3(1.8, 18, 1.8), white)
		"school", "stadium":
			if f == "stadium":
				_fbox(r, Vector3.ZERO, Vector3(28, 0.2, 20), Color(0.3, 0.62, 0.3))
				for sd in [-1, 1]:
					_fbox(r, Vector3(0, 0, sd * 11), Vector3(28, 5, 3), Color(0.85, 0.86, 0.88))
			else:
				_fbox(r, Vector3(0, 0, -6), Vector3(26, 10, 7), Color(0.96, 0.9, 0.78))
				_fbox(r, Vector3(-10, 0, 3), Vector3(6, 10, 12), Color(0.96, 0.9, 0.78))
				_fbox(r, Vector3(0, 10, -6), Vector3(27, 0.8, 8), Color(0.6, 0.25, 0.2))
		"park":
			_fbox(r, Vector3.ZERO, Vector3(28, 0.25, 28), Color(0.32, 0.62, 0.3))
			for k in 7:
				var a := TAU * k / 7.0
				_fbox(r, Vector3(cos(a) * 9, 0, sin(a) * 9), Vector3(1, 4, 1), Color(0.4, 0.28, 0.18))
				_fbox(r, Vector3(cos(a) * 9, 4, sin(a) * 9), Vector3(5, 4, 5), Color(0.2, 0.5, 0.22))
		"market":
			_fbox(r, Vector3.ZERO, Vector3(26, 5, 16), Color(0.9, 0.85, 0.72))
			_fbox(r, Vector3(0, 5, 0), Vector3(28, 1.2, 18), Color(0.85, 0.35, 0.2))
		"mall":
			_fbox(r, Vector3.ZERO, Vector3(28, 14, 22), Color(0.85, 0.88, 0.92))
			_fbox(r, Vector3(0, 14, 0), Vector3(20, 2, 14), Color(0.3, 0.5, 0.75))
		"office":
			_fbox(r, Vector3.ZERO, Vector3(14, 46, 14), Color(0.55, 0.68, 0.82))
			_fbox(r, Vector3(0, 46, 0), Vector3(10, 3, 10), Color(0.8, 0.82, 0.85))
		_:
			_fbox(r, Vector3.ZERO, Vector3(20, 8, 14), white)


## Disasters in the 3D city: rising flood water, a fire with smoke, or
## parched cracked ground with dead crops, centred on the stricken zone,
## with a pulsing warning label. Rebuilt when the set of events changes.
func _update_events() -> void:
	var key := ""
	for i in mini(zones.size(), centres.size()):
		var ev = zones[i].get("event", null)
		if ev is Dictionary:
			key += "%s:%s:%s;" % [zones[i].get("id"), ev.get("type"), ev.get("label")]
	if key == _ev_key:
		return
	_ev_key = key
	if _events == null:
		_events = Node3D.new()
		add_child(_events)
	for ch in _events.get_children():
		ch.free()
	_ev_nodes = []
	for i in mini(zones.size(), centres.size()):
		var ev = zones[i].get("event", null)
		if not (ev is Dictionary):
			continue
		var root := Node3D.new()
		root.position = centres[i]
		_events.add_child(root)
		var kind := str(ev.get("type", ""))
		var entry := {"type": kind, "root": root, "parts": []}
		match kind:
			"flood": _flood(root, entry)
			"fire": _fire(root, entry)
			"drought": _drought(root, entry)
		var tag := _make_label(30, Color(1.0, 0.4, 0.3))
		remove_child(tag)
		root.add_child(tag)
		tag.text = "! " + str(ev.get("label", kind.to_upper())) + " !"
		tag.position = Vector3(0, 46 + (float(city.height_at(root.position, 0)) if city.has_method("height_at") else 0.0), 0)
		tag.outline_size = 14
		entry["tag"] = tag
		_ev_nodes.append(entry)


func _ev_mat(col: Color, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = 0.9
	if col.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = Color(col.r, col.g, col.b)
		m.emission_energy_multiplier = emit
	return m


func _flood(root: Node3D, entry: Dictionary) -> void:
	var r := clampf(float(city.r_city) * 0.16, 70.0, 170.0)
	var water := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = 1.2
	cm.radial_segments = 40
	water.mesh = cm
	water.material_override = _ev_mat(Color(0.25, 0.55, 0.85, 0.8), 0.4)
	water.position = Vector3(0, 2.5, 0)
	cm.height = 5.0
	root.add_child(water)
	entry["water"] = water
	# floating debris
	for k in 6:
		var a := TAU * k / 6.0 + 0.4
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(3, 0.6, 2)
		mi.mesh = bm
		mi.material_override = _ev_mat(Color(0.45, 0.33, 0.2))
		mi.position = Vector3(cos(a) * r * 0.6, 1.6, sin(a) * r * 0.6)
		root.add_child(mi)
		entry.parts.append(mi)


func _fire(root: Node3D, entry: Dictionary) -> void:
	# flames on the roof of whatever stands there (or on the ground)
	var h: float = 0.0
	if city.has_method("height_at"):
		h = float(city.height_at(root.position, 0))
	for k in 5:
		var a := TAU * k / 5.0
		var d := 12.0 + 10.0 * float(k % 2)
		var flame := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 9.0
		cone.height = 30.0
		cone.radial_segments = 8
		flame.mesh = cone
		flame.material_override = _ev_mat(Color(1.0, 0.45 if k % 2 == 0 else 0.7, 0.1, 0.9), 3.0)
		flame.position = Vector3(cos(a) * d, h + 15.0, sin(a) * d)
		root.add_child(flame)
		entry.parts.append(flame)
	var smoke := CPUParticles3D.new()
	smoke.amount = 70
	smoke.lifetime = 6.0
	smoke.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	smoke.emission_sphere_radius = 10.0
	smoke.direction = Vector3(0.2, 1, 0)
	smoke.spread = 12.0
	smoke.gravity = Vector3(1.5, 3.0, 0)
	smoke.initial_velocity_min = 6.0
	smoke.initial_velocity_max = 10.0
	smoke.scale_amount_min = 8.0
	smoke.scale_amount_max = 18.0
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	sm.radial_segments = 8
	sm.rings = 4
	smoke.mesh = sm
	smoke.material_override = _ev_mat(Color(0.25, 0.25, 0.27, 0.55))
	smoke.position = Vector3(0, h + 30.0, 0)
	root.add_child(smoke)
	var glow := OmniLight3D.new()
	glow.light_color = Color(1.0, 0.5, 0.15)
	glow.light_energy = 4.0
	glow.omni_range = 120.0
	glow.position = Vector3(0, h + 12.0, 0)
	root.add_child(glow)
	entry["glow"] = glow


func _drought(root: Node3D, entry: Dictionary) -> void:
	var r := clampf(float(city.r_city) * 0.18, 80.0, 190.0)
	var ground := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = 0.3
	cm.radial_segments = 40
	ground.mesh = cm
	ground.material_override = _ev_mat(Color(0.72, 0.55, 0.3, 0.92))
	ground.position = Vector3(0, 0.25, 0)
	root.add_child(ground)
	# cracks
	for k in 10:
		var a := TAU * k / 10.0 + randf() * 0.3
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(r * 0.7, 0.1, 0.8)
		mi.mesh = bm
		mi.material_override = _ev_mat(Color(0.35, 0.25, 0.15))
		mi.position = Vector3(cos(a) * r * 0.35, 0.45, sin(a) * r * 0.35)
		mi.rotation.y = -a
		root.add_child(mi)
	# dead crops / bare trees
	for k in 14:
		var a := randf() * TAU
		var d := sqrt(randf()) * r * 0.85
		var trunk := MeshInstance3D.new()
		var tm := CylinderMesh.new()
		tm.top_radius = 0.15
		tm.bottom_radius = 0.35
		tm.height = 5.0
		trunk.mesh = tm
		trunk.material_override = _ev_mat(Color(0.42, 0.32, 0.22))
		trunk.position = Vector3(cos(a) * d, 2.5, sin(a) * d)
		trunk.rotation.z = randf_range(-0.3, 0.3)
		root.add_child(trunk)
		var bush := MeshInstance3D.new()
		var bs := SphereMesh.new()
		bs.radius = 1.6
		bs.height = 2.2
		bush.mesh = bs
		bush.material_override = _ev_mat(Color(0.62, 0.55, 0.3))
		bush.position = trunk.position + Vector3(0, 2.6, 0)
		root.add_child(bush)
	entry["sun"] = ground


func _process_events(dt: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for e in _ev_nodes:
		var tag: Label3D = e.get("tag")
		if tag:
			var k := 0.5 + 0.5 * sin(t * 6.0)
			tag.modulate = Color(1.0, 0.85, 0.25).lerp(Color(1.0, 0.25, 0.2), k)
		match str(e.type):
			"flood":
				var w: Node3D = e.water
				w.position.y = 2.5 + sin(t * 0.8) * 0.8
				for p in e.parts:
					(p as Node3D).position.y = 5.3 + sin(t * 1.3 + (p as Node3D).position.x) * 0.4
					(p as Node3D).rotation.y += dt * 0.2
			"fire":
				var i := 0
				for p in e.parts:
					var f := 1.0 + 0.25 * sin(t * 9.0 + i * 1.7)
					(p as Node3D).scale = Vector3(1.0, f, 1.0)
					i += 1
				var g: OmniLight3D = e.glow
				g.light_energy = 3.0 + 1.5 * sin(t * 11.0)


## The aerial intro shot has finished.
func post_intro_done() -> void:
	if _embedded:
		JavaScriptBridge.eval("window.parent.postMessage({ type: 'kawasan-intro-done' }, '*')", true)


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
	land_pick = d.get("landPick", null)
	_update_site()
	_update_facilities()
	_update_events()
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
	_fac_key = ""   # a rebuilt city needs its founded sites claimed again
	_ev_key = ""
	_site_roads = {}
	centres = []
	zone_lots = []
	var n := zones.size()
	var R: float = city.r_taman * 0.95
	var lots: Array = city.lots
	var used := {}
	for i in n:
		var z: Dictionary = zones[i]
		var zp = z.get("pos", null)
		if zp is Array and zp.size() == 2:
			# founded on empty land: it stands exactly where it was built
			centres.append(Vector3(float(zp[0]), 0, float(zp[1])))
			zone_lots.append({})
			continue
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
	_update_events()


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
	_process_events(dt)
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
	if placing:
		# aiming a project: a tap on a zone picks it, a tap on open ground
		# (inside the seat, free of roads and buildings) picks that land
		best_d = 24.0
		for i in centres.size():
			var dz: float = hit.distance_to(centres[i])
			if dz < best_d:
				best_d = dz
				best = i
		if best < 0:
			# open, free of other buildings and sites, and reachable by road
			if city.land_free(hit, 30.0, 30.0) and city.access_road(hit).size() == 2:
				_post_land(hit)
			return
		selected = str(zones[best].get("id", ""))
		_focus_selected(true)
		_post_click(selected)
		return
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
	# headless checks: --profile=<path to a JSON profile> builds that seat
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--profile="):
			var f := FileAccess.open(arg.substr(10), FileAccess.READ)
			if f:
				var prof = JSON.parse_string(f.get_as_text())
				if prof is Dictionary:
					var zs2 := []
					for i in 36:
						zs2.append({"id": "zone-%d" % i, "archetype": "housingEstate"})
					return {"profile": prof, "zones": zs2, "selected": "zone-0"}
	var zs := []
	var types := ["townCentre", "commercialHub", "housingEstate", "paddyVillage", "schoolZone", "mainVillage", "riverside", "marketHawkers", "clinicHall"]
	for i in 36:
		zs.append({"id": "zone-%d" % i, "archetype": types[i % types.size()]})
	return {
		"profile": {"code": "P.120", "name": "Bukit Bintang", "density": 0.9,
			"traits": {"klLandmarks": true, "bukitBintang": true}},
		"zones": zs, "selected": "zone-0",
	}
