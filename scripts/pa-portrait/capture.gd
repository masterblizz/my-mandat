extends SceneTree
## Render a head-and-shoulders portrait of a cast member (the same GLB,
## textures and standing pose the 3D office uses) to a PNG.
## godot --rendering-driver opengl3 --script capture.gd -- <model> <out.png> [yaw]

var person: Node3D
var cam: Camera3D
var frames := 0
var out_path := ""

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var model := args[0] if args.size() > 0 else "pa_female"
	out_path = args[1] if args.size() > 1 else "/tmp/pa.png"
	var yaw := float(args[2]) if args.size() > 2 else 0.35
	root.size = Vector2i(512, 512)
	var world := Node3D.new()
	root.add_child(world)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.09, 0.16, 0.27)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.66, 0.74)
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	# key (warm, office lamps), fill (cool) and a rim from behind
	for l in [[Vector3(-28, 32, 0), Color(1.0, 0.93, 0.84), 1.15], [Vector3(-12, -60, 0), Color(0.75, 0.82, 1.0), 0.55], [Vector3(-20, 170, 0), Color(0.9, 0.95, 1.0), 0.9]]:
		var dl := DirectionalLight3D.new()
		dl.rotation_degrees = l[0]
		dl.light_color = l[1]
		dl.light_energy = l[2]
		world.add_child(dl)
	# a soft vignette backdrop: a large gradient card behind the figure
	var card := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(4, 4)
	card.mesh = qm
	var gm := StandardMaterial3D.new()
	gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var grad := Gradient.new()
	grad.set_color(0, Color(0.2, 0.33, 0.52))
	grad.set_color(1, Color(0.06, 0.11, 0.2))
	var gt := GradientTexture2D.new()
	gt.gradient = grad
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.42)
	gt.fill_to = Vector2(1.05, 1.0)
	gm.albedo_texture = gt
	card.material_override = gm
	world.add_child(card)
	person = load("res://person.gd").new()
	world.add_child(person)
	person.setup(model, "stand", null)
	person.rotation.y = yaw
	cam = Camera3D.new()
	cam.fov = 20.0
	world.add_child(cam)
	card.position = Vector3(0, 1.5, -1.2)

func _process(_dt: float) -> bool:
	frames += 1
	if frames == 2:
		person.set_pose("stand")
	if frames == 3:
		# frame on the head bone, from slightly below eye level
		var sk: Skeleton3D = person.skel
		var hb := sk.find_bone("head")
		var head: Vector3 = (sk.global_transform * sk.get_bone_global_pose(hb)).origin
		var look := head + Vector3(0, 0.1, 0)
		cam.position = look + Vector3(0, -0.02, 1.75)
		cam.look_at(look + Vector3(0, -0.15, 0), Vector3.UP)
	if frames == 12:
		var img := root.get_texture().get_image()
		img.save_png(out_path)
		print("SAVED ", out_path, " ", img.get_size())
		return true
	return false
