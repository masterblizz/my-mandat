extends Node3D
## Orbit / pan / zoom camera, same feel as the web Kawasan 3D rig:
## left drag orbits, right / middle / shift+left drag pans, wheel zooms,
## WASD or arrows pan, Q/E rotate, R resets. The displayed camera eases
## toward the requested values so every input glides.

const MIN_DIST := 40.0
const MAX_DIST := 1500.0
# Held to a low, skyline-showing tilt: you can orbit and zoom, but the
# camera never swings to a flat top-down map view.
const PITCH_MIN := -36.0
const PITCH_MAX := -10.0

var yaw := 45.0
var pitch := -48.0
var dist := 720.0
var target := Vector3.ZERO
var view_scale := 1.0      # set per seat: smaller towns get a closer default view

var _yaw := yaw
var _pitch := pitch
var _dist := dist
var _target := target
var _touches := {}

@onready var cam: Camera3D = $Camera3D
var intro_pending := false     # a fly-in was asked for before the city was built
var _intro_tween: Tween


func _ready() -> void:
	preset("city")


func preset(name: String) -> void:
	match name:
		"core":
			yaw = 30.0; pitch = -24.0; dist = 330.0; target = Vector3(0, 30, 0)
		"taman":
			yaw = 200.0; pitch = -32.0; dist = 170.0; target = Vector3(-260, 0, -120)
		"street":
			yaw = 70.0; pitch = -19.0; dist = 70.0; target = Vector3(-150, 0, -90)
		_:
			# low three-quarter view across the taman towards the skyline
			yaw = 25.0; pitch = -17.0; dist = 640.0 * view_scale; target = Vector3(0, 20 * view_scale, 0)
			var vs := get_viewport().get_visible_rect().size
			if vs.y > vs.x:
				# portrait phone: tilt down and look a little in front of the
				# centre, so the city fills the band between the game's top
				# buttons and its bottom panels instead of leaving open sky
				pitch = -34.0; dist = 380.0 * view_scale
				var toward := Vector3(sin(deg_to_rad(yaw)), 0, cos(deg_to_rad(yaw)))
				target = toward * 90.0 * view_scale
	_yaw = yaw; _pitch = pitch; _dist = dist; _target = target
	_apply()
	if intro_pending and name == "city":
		_start_intro()


## City intro: the game's map zooms into the seat, then the camera drops
## from straight above the town (like the map) and swings down to the
## usual three-quarter skyline view.
func intro() -> void:
	intro_pending = true
	if get_parent().gen != null:
		_start_intro()


## Aerial intro, like a film's establishing shot: straight down over the
## seat with north up (as on the game's map, so the boundary outline lines
## up with it), a slow drift in while the gold outline glows on the
## ground, then a long descent that tilts and turns into the usual
## three-quarter skyline view.
const INTRO_HOLD := 1.6
const INTRO_DESCENT := 3.6
var _intro_running := false
var _intro_start_ms := 0
var _intro_from := {}
var _intro_to := {}
var intro_t := 0.0:
	set(v):
		intro_t = v
		_intro_pose(v)


func _start_intro() -> void:
	intro_pending = false
	# a second fly-in request while one runs must not take the mid-flight
	# top-down pose as its end point (that left the camera stuck overhead)
	if _intro_running:
		return
	var city := get_parent()
	var reach: float = city.reach_r if "reach_r" in city else 700.0
	var vs := get_viewport().get_visible_rect().size
	# frame the whole outline: half its extent fits the shorter half-field
	var half_fov := deg_to_rad(20.0)
	var top := reach * 1.12 / tan(half_fov) * (1.0 if vs.x >= vs.y else maxf(1.0, vs.y / vs.x))
	_intro_from = {"yaw": 0.0, "pitch": -89.5, "dist": top, "target": Vector3.ZERO}
	_intro_to = {"yaw": yaw, "pitch": pitch, "dist": dist, "target": target}
	# timed on the wall clock, not frame deltas: a slow device still gets
	# the whole shot in 5.2 s (just with fewer frames)
	_intro_start_ms = Time.get_ticks_msec()
	_intro_running = true
	intro_t = 0.0


func _intro_pose(v: float) -> void:
	if _intro_from.is_empty():
		return
	var total := INTRO_HOLD + INTRO_DESCENT
	var t := v * total
	var city := get_parent()
	var y0: float = _intro_from.yaw
	var y1: float = _intro_to.yaw
	var d0: float = _intro_from.dist
	var d1: float = _intro_to.dist
	if t < INTRO_HOLD:
		# hold overhead, drifting in a little
		var h := t / INTRO_HOLD
		yaw = y0
		pitch = _intro_from.pitch
		dist = d0 * lerpf(1.0, 0.9, h)
		target = _intro_from.target
		if city.has_method("set_outline_alpha"):
			city.set_outline_alpha(maxf(0.3, minf(1.0, h * 2.5)))
	else:
		var k := (t - INTRO_HOLD) / INTRO_DESCENT
		var e := k * k * (3.0 - 2.0 * k)          # smoothstep
		var ep := pow(e, 1.6)                      # tilt late: stay map-like at first
		yaw = rad_to_deg(lerp_angle(deg_to_rad(y0), deg_to_rad(y1), e))
		pitch = lerpf(_intro_from.pitch, _intro_to.pitch, ep)
		dist = exp(lerpf(log(d0 * 0.9), log(d1), e))
		target = (_intro_from.target as Vector3).lerp(_intro_to.target, e)
		if city.has_method("set_outline_alpha"):
			city.set_outline_alpha(lerpf(1.0, 0.3, smoothstep(0.35, 0.8, k)))
	# the valley haze is set for the low view: push it out while high up
	if "env" in city and city.env:
		city.env.fog_depth_begin = 900.0 + maxf(0.0, _dist - 700.0)
		city.env.fog_depth_end = 5200.0 + maxf(0.0, _dist - 700.0) * 1.5
	# drive the shown camera directly: the intro is the camera move
	_yaw = yaw; _pitch = pitch; _dist = dist; _target = target
	cam.far = maxf(6000.0, _dist * 2.5)
	_apply()


## Mini-map +/−: one step closer (+1) or further (−1).
func zoom_step(dir: int) -> void:
	dist = clampf(dist * (0.75 if dir > 0 else 1.33), MIN_DIST, MAX_DIST)


func _limit() -> float:
	return get_parent().pan_limit


func _pan_pixels(dx: float, dy: float) -> void:
	var h := float(get_viewport().get_visible_rect().size.y)
	var wpp := 2.0 * _dist * tan(deg_to_rad(cam.fov) * 0.5) / maxf(h, 1.0)
	var y := deg_to_rad(_yaw)
	var right := Vector3(cos(y), 0, -sin(y))
	var fwd := Vector3(-sin(y), 0, -cos(y))
	var fore := 1.0 / maxf(0.4, sin(deg_to_rad(-_pitch)))
	target += -right * dx * wpp + fwd * dy * wpp * fore
	var lim := _limit()
	target.x = clampf(target.x, -lim, lim)
	target.z = clampf(target.z, -lim, lim)


## Touch: one finger orbits (through Godot's mouse emulation), two fingers
## pinch-zoom and pan together; emulated mouse motion is ignored meanwhile.
func _touch(e: InputEvent) -> void:
	if e is InputEventScreenTouch:
		if e.pressed:
			_touches[e.index] = e.position
		else:
			_touches.erase(e.index)
		return
	var before := _touches.duplicate()
	_touches[e.index] = e.position
	if _touches.size() < 2 or before.size() < 2:
		return
	var k := _touches.keys()
	var a0: Vector2 = before[k[0]]
	var b0: Vector2 = before[k[1]]
	var a1: Vector2 = _touches[k[0]]
	var b1: Vector2 = _touches[k[1]]
	var d1 := a1.distance_to(b1)
	if d1 > 1.0:
		dist = clampf(dist * a0.distance_to(b0) / d1, MIN_DIST, MAX_DIST)
	var mv := ((a1 + b1) - (a0 + b0)) * 0.5
	_pan_pixels(mv.x, mv.y)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch or e is InputEventScreenDrag:
		_touch(e)
		return
	if e is InputEventMouseMotion and _touches.size() >= 2:
		return
	if e is InputEventMouseMotion:
		var m: int = e.button_mask
		var pan: bool = (m & (MOUSE_BUTTON_MASK_RIGHT | MOUSE_BUTTON_MASK_MIDDLE)) != 0 \
			or ((m & MOUSE_BUTTON_MASK_LEFT) != 0 and e.shift_pressed)
		if pan:
			_pan_pixels(e.relative.x, e.relative.y)
		elif m & MOUSE_BUTTON_MASK_LEFT:
			yaw -= e.relative.x * 0.25
			pitch = clampf(pitch - e.relative.y * 0.18, PITCH_MIN, PITCH_MAX)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist = maxf(MIN_DIST, dist * 0.87)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist = minf(MAX_DIST, dist / 0.87)
	elif e is InputEventMagnifyGesture:
		dist = clampf(dist / e.factor, MIN_DIST, MAX_DIST)
	elif e is InputEventPanGesture:
		_pan_pixels(-e.delta.x * 8.0, -e.delta.y * 8.0)
	elif e is InputEventKey and e.pressed and not e.echo and e.keycode == KEY_R:
		preset("city")


func _process(dt: float) -> void:
	if _intro_running:
		var v := (Time.get_ticks_msec() - _intro_start_ms) / 1000.0 / (INTRO_HOLD + INTRO_DESCENT)
		intro_t = minf(v, 1.0)
		if v >= 1.0:
			_intro_running = false
			var zl = get_parent().get_node_or_null("Zones")
			if zl and zl.has_method("post_intro_done"):
				zl.post_intro_done()
		_report_view(dt)
		return
	var kx := int(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT)) - int(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT))
	var ky := int(Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)) - int(Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP))
	if kx != 0 or ky != 0:
		_pan_pixels(-kx * 900.0 * dt, -ky * 900.0 * dt)
	var kr := int(Input.is_key_pressed(KEY_E)) - int(Input.is_key_pressed(KEY_Q))
	yaw += kr * 75.0 * dt

	var k_rot := 1.0 - pow(0.00002, dt)
	var k_zoom := 1.0 - pow(0.0008, dt)
	_yaw = rad_to_deg(lerp_angle(deg_to_rad(_yaw), deg_to_rad(yaw), k_rot))
	_pitch = lerpf(_pitch, pitch, k_rot)
	_dist = exp(lerpf(log(_dist), log(dist), k_zoom))
	_target = _target.lerp(target, 1.0 - pow(0.0016, dt))
	_apply()
	_report_view(dt)


## Tell the page where the camera looks (mini-map cone), at most ~8 times
## a second and only when it moved.
var _view_t := 0.0
var _view_last := Vector4(INF, 0, 0, 0)
func _report_view(dt: float) -> void:
	_view_t += dt
	if _view_t < 0.12:
		return
	_view_t = 0.0
	var v := Vector4(_yaw, _target.x, _target.z, _dist)
	if absf(v.x - _view_last.x) < 0.5 and Vector2(v.y - _view_last.y, v.z - _view_last.z).length() < 2.0 and absf(v.w - _view_last.w) < 4.0:
		return
	_view_last = v
	var city := get_parent()
	var zl = city.get_node_or_null("Zones")
	if zl and zl.has_method("post_view"):
		zl.post_view(fposmod(_yaw, 360.0), _target.x, _target.z, _dist, _dist * cos(deg_to_rad(_pitch)), float(city.r_city))


func _apply() -> void:
	position = _target
	basis = Basis.from_euler(Vector3(deg_to_rad(_pitch), deg_to_rad(_yaw), 0))
	cam.position = Vector3(0, 0, _dist)
	cam.rotation = Vector3.ZERO
	cam.near = maxf(0.3, _dist * 0.004)
	# never inside a tower: lift the camera over the roofs around it and
	# keep looking at the same spot
	var city := get_parent()
	if city.has_method("height_at"):
		var cp := cam.global_position
		var clear: float = city.height_at(cp) + 8.0
		if cp.y < clear:
			cam.global_position = Vector3(cp.x, clear, cp.z)
			cam.look_at(_target, Vector3.UP)
	# portrait phones: hold the horizontal field so the city isn't cropped
	var vs := get_viewport().get_visible_rect().size
	cam.keep_aspect = Camera3D.KEEP_WIDTH if vs.y > vs.x else Camera3D.KEEP_HEIGHT
	cam.fov = 62.0 if vs.y > vs.x else 40.0
