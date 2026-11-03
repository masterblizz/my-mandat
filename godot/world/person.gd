extends Node3D
## A MakeHuman cast member (res://cast/*.glb) with procedural poses and a
## walk cycle. The GLBs ship without animation clips, so every pose is set
## by aiming bones at directions in the character's own frame (it faces +Z,
## its left side is +X), the same approach the React office uses.

signal arrived

const WALK_SPEED := 1.45
const TURN_SPEED := 9.0

var model_name := ""
var pose := "stand"
var skel: Skeleton3D
var visual: Node3D
var path: PackedVector3Array = PackedVector3Array()
var path_i := 0
var walking := false
var face_target = null # Vector3 or null
var phase := 0.0
var idle_seed := randf() * 10.0
var _bones := {}
var tablet: MeshInstance3D

func setup(name_: String, pose_: String = "stand", tint = null) -> void:
	model_name = name_
	visual = Node3D.new()
	add_child(visual)
	var scene: PackedScene = load("res://cast/%s.glb" % name_)
	var inst := scene.instantiate()
	visual.add_child(inst)
	var found := inst.find_children("*", "Skeleton3D", true, false)
	if found.size() > 0:
		skel = found[0]
	for m in inst.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		mi.extra_cull_margin = 2.0
		if tint != null and "suit" in String(mi.name).to_lower():
			for s in mi.mesh.get_surface_count():
				var mat = mi.mesh.surface_get_material(s)
				if mat is StandardMaterial3D:
					var dup: StandardMaterial3D = mat.duplicate()
					# the cast suits are near-black textures; a flat party colour reads at a distance
					dup.albedo_texture = null
					dup.albedo_color = (tint as Color).darkened(0.1)
					mi.set_surface_override_material(s, dup)
	if skel:
		for b in ["pelvis", "spine_02", "head", "neck_01"]:
			_bones[b] = skel.find_bone(b)
	set_pose(pose_)

func _to_skel(d: Vector3) -> Vector3:
	var basis := skel.global_transform.basis.orthonormalized().inverse() * global_transform.basis.orthonormalized()
	return (basis * d).normalized()

func aim(bone: String, child: String, dir: Vector3) -> void:
	var b := skel.find_bone(bone)
	var c := skel.find_bone(child)
	if b < 0 or c < 0:
		return
	var gb := skel.get_bone_global_pose(b)
	var gc := skel.get_bone_global_pose(c)
	var cur := (gc.origin - gb.origin).normalized()
	var want := _to_skel(dir)
	if cur.is_zero_approx() or cur.is_equal_approx(want):
		return
	var q := Quaternion(cur, want)
	var new_basis := Basis(q) * gb.basis.orthonormalized()
	var p := skel.get_bone_parent(b)
	var parent_basis := skel.get_bone_global_pose(p).basis.orthonormalized() if p >= 0 else Basis()
	skel.set_bone_pose_rotation(b, (parent_basis.inverse() * new_basis).get_rotation_quaternion())

func _arms_down() -> void:
	for s in [1.0, -1.0]:
		var side := "l" if s > 0 else "r"
		aim("upperarm_" + side, "lowerarm_" + side, Vector3(0.12 * s, -1, 0.02))
		aim("lowerarm_" + side, "hand_" + side, Vector3(0.05 * s, -1, 0.18))

func set_pose(p: String) -> void:
	pose = p
	if not skel or not is_inside_tree():
		return
	skel.reset_bone_poses()
	visual.position = Vector3.ZERO
	_arms_down()
	if p == "sit" or p == "type":
		for side in ["l", "r"]:
			aim("thigh_" + side, "calf_" + side, Vector3(0, -0.08, 1))
			aim("calf_" + side, "foot_" + side, Vector3(0, -1, 0.08))
		for s in [1.0, -1.0]:
			var side := "l" if s > 0 else "r"
			if p == "type":
				aim("upperarm_" + side, "lowerarm_" + side, Vector3(0.1 * s, -0.75, 0.6))
				aim("lowerarm_" + side, "hand_" + side, Vector3(-0.1 * s, -0.1, 1))
			else:
				aim("upperarm_" + side, "lowerarm_" + side, Vector3(0.04 * s, -0.95, 0.28))
				aim("lowerarm_" + side, "hand_" + side, Vector3(-0.12 * s, -0.55, 0.85))
		# drop the body so the pelvis rests on a 0.47 m seat
		var pel: int = _bones.get("pelvis", -1)
		if pel >= 0:
			var py := (skel.global_transform * skel.get_bone_global_pose(pel)).origin.y - global_position.y
			visual.position = Vector3(0, 0.47 - py + 0.08, -0.18)
	elif p == "cheer":
		# both arms up, fists high: a supporter celebrating a seat
		for s in [1.0, -1.0]:
			var side := "l" if s > 0 else "r"
			aim("upperarm_" + side, "lowerarm_" + side, Vector3(0.35 * s, 1, 0.15))
			aim("lowerarm_" + side, "hand_" + side, Vector3(0.1 * s, 1, 0.05))
	elif p == "tablet":
		aim("upperarm_r", "lowerarm_r", Vector3(-0.1, -1, 0.15))
		aim("lowerarm_r", "hand_r", Vector3(0.25, -0.1, 1))
		aim("upperarm_l", "lowerarm_l", Vector3(0.1, -1, 0.2))
		aim("lowerarm_l", "hand_l", Vector3(-0.45, -0.05, 1))
	_update_tablet()

func _update_tablet() -> void:
	if pose == "tablet" and not tablet:
		tablet = MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.26, 0.18, 0.012)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color("#1b2430")
		mat.emission_enabled = true
		mat.emission = Color("#2ba6d8")
		mat.emission_energy_multiplier = 0.35
		bm.material = mat
		tablet.mesh = bm
		tablet.position = Vector3(0.06, 1.0, 0.36)
		tablet.rotation = Vector3(-0.9, 0, 0)
		add_child(tablet)
	if tablet:
		tablet.visible = pose == "tablet" and not walking

## Walk along a world-space path (from NavigationServer3D.map_get_path).
func walk_path(p: PackedVector3Array, look_at_end = null) -> void:
	if p.size() == 0:
		arrived.emit()
		return
	path = p
	path_i = 0
	face_target = look_at_end
	if pose != "stand":
		set_pose("stand")
	walking = true
	_update_tablet()

func stop() -> void:
	walking = false
	path = PackedVector3Array()
	if skel:
		set_pose(pose)

## Celebrate for a moment, then return to the previous pose.
var _cheer_left := 0.0
var _pose_before := "stand"
func cheer(seconds := 1.4) -> void:
	if walking:
		return
	if _cheer_left <= 0.0:
		_pose_before = pose
	_cheer_left = seconds
	set_pose("cheer")

func is_walking() -> bool:
	return walking

func _face(dir: Vector3, delta: float) -> void:
	dir.y = 0
	if dir.length_squared() < 0.0001:
		return
	var target := atan2(dir.x, dir.z)
	rotation.y = lerp_angle(rotation.y, target, clamp(delta * TURN_SPEED, 0.0, 1.0))

func _process(delta: float) -> void:
	if not skel:
		return
	if walking:
		_step_walk(delta)
	else:
		if _cheer_left > 0.0:
			_cheer_left -= delta
			visual.position.y = abs(sin(_cheer_left * 9.0)) * 0.12
			if _cheer_left <= 0.0:
				set_pose(_pose_before)
			return
		_idle(delta)

func _step_walk(delta: float) -> void:
	var remaining := WALK_SPEED * delta
	while remaining > 0.0 and path_i < path.size():
		var goal := path[path_i]
		goal.y = global_position.y
		var to := goal - global_position
		var d := to.length()
		if d <= remaining:
			global_position = goal
			remaining -= d
			path_i += 1
		else:
			global_position += to / d * remaining
			_face(to, delta)
			remaining = 0.0
	if path_i >= path.size():
		walking = false
		set_pose("stand")
		if face_target != null:
			look_toward(face_target)
		arrived.emit()
		return
	phase += delta * WALK_SPEED / 0.72 * PI
	_gait(phase)

func look_toward(p: Vector3) -> void:
	var dir := p - global_position
	dir.y = 0
	if dir.length_squared() > 0.0001:
		rotation.y = atan2(dir.x, dir.z)

func _gait(ph: float) -> void:
	skel.reset_bone_poses()
	for i in 2:
		var side := "l" if i == 0 else "r"
		var s := 1.0 if i == 0 else -1.0
		var p := ph + (0.0 if i == 0 else PI)
		var a := sin(p) * 0.42
		var knee: float = max(0.0, cos(p)) * 0.75 + 0.06
		aim("thigh_" + side, "calf_" + side, Vector3(0, -cos(a), sin(a)))
		aim("calf_" + side, "foot_" + side, Vector3(0, -cos(a - knee), sin(a - knee)))
		var b := -sin(p) * 0.32
		aim("upperarm_" + side, "lowerarm_" + side, Vector3(0.12 * s, -cos(b), sin(b)))
		aim("lowerarm_" + side, "hand_" + side, Vector3(0.05 * s, -cos(b + 0.35), sin(b + 0.35)))
	visual.position = Vector3(0, abs(sin(ph)) * 0.025, 0)

func _idle(_delta: float) -> void:
	# slow breathing and a slight head turn on top of the static pose
	var t := Time.get_ticks_msec() / 1000.0 + idle_seed
	var hb: int = _bones.get("head", -1)
	var sb: int = _bones.get("spine_02", -1)
	if hb >= 0:
		var rest := skel.get_bone_rest(hb).basis.get_rotation_quaternion()
		if pose == "stand" or pose == "tablet":
			skel.set_bone_pose_rotation(hb, rest * Quaternion(Vector3.UP, sin(t * 0.35) * 0.16))
	if sb >= 0 and (pose == "stand" or pose == "tablet"):
		var rest_s := skel.get_bone_rest(sb).basis.get_rotation_quaternion()
		skel.set_bone_pose_rotation(sb, rest_s * Quaternion(Vector3.RIGHT, sin(t * 1.4) * 0.012))
