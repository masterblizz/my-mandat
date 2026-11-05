extends Node3D
## Orbit / pan / zoom camera, same feel as the web Kawasan 3D rig:
## left drag orbits, right / middle / shift+left drag pans, wheel zooms,
## WASD or arrows pan, Q/E rotate, R resets. The displayed camera eases
## toward the requested values so every input glides.

const MIN_DIST := 40.0
const MAX_DIST := 1100.0
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


func _start_intro() -> void:
	intro_pending = false
	# a second fly-in request while one runs must not take the mid-flight
	# top-down pose as its end point (that left the camera stuck overhead)
	if _intro_tween and _intro_tween.is_running():
		return
	var end_yaw := yaw
	var end_pitch := pitch
	var end_dist := dist
	_yaw = end_yaw - 70.0; yaw = _yaw
	_pitch = -86.0; pitch = _pitch
	_dist = MAX_DIST * 1.6; dist = _dist
	_apply()
	if _intro_tween:
		_intro_tween.kill()
	_intro_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_intro_tween.tween_property(self, "dist", end_dist, 3.2)
	_intro_tween.tween_property(self, "pitch", end_pitch, 3.2)
	_intro_tween.tween_property(self, "yaw", end_yaw, 3.2)


func _limit() -> float:
	return get_parent().SPAN * 0.55


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
