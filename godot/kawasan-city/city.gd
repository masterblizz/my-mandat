extends Node3D
## Procedural Malaysian city, the Godot take on the MY MANDAT Kawasan 3D map.
##
## No street grid: radial arterials wander out from a landmark centre,
## wavy ring arcs and taman crescents run between them, with lorong
## connectors and cul-de-sacs. Buildings are placed along each kerb by
## zone (office towers, shophouse rows, terraces and bungalows, kampung)
## against an occupancy map, and the leftover ground fills with trees.
## Everything repeated is drawn through one MultiMesh per (mesh,
## material) bucket.
##
## Keys: T cycles day / dusk / night, R resets the camera.
## Command line (after `--`): --shot=<png> --view=city|core|taman --tod=0|1|2

const SPAN := 1100.0           # rough city diameter; the camera pans within it
const CELL := 3.0              # occupancy map resolution, metres
const EXT := 4400.0            # occupancy map half-extent (a seat at true scale)
const GN := int(EXT * 2.0 / CELL)
const RIVER_HALF := 15.0
const HIGHWAY_HALF := 11.0
const LRT_Y := 10.0             # guideway soffit height

const C_CONCRETE := Color(0.72, 0.71, 0.68)
const C_PAVING := Color(0.5, 0.46, 0.41)
const C_KERB := Color(0.6, 0.58, 0.54)
const C_ASPHALT := Color(0.16, 0.17, 0.18)

const HOUSE_WALLS := [
	Color("f2e2b8"), Color("f0cfb0"), Color("cfe6c4"), Color("d8d0ec"),
	Color("f4cfc0"), Color("bfe0e8"), Color("f5f1e6"), Color("e8d9a8"),
]
const SHOPHOUSE_WALLS := [
	Color("f0c9a8"), Color("f2d98c"), Color("a8dcc0"), Color("a8cfe8"),
	Color("f2aca0"), Color("d4c0ec"), Color("f6e2b0"), Color("ffffff"),
]
const ROOFS := [Color("a4573f"), Color("5e6268"), Color("8e3f2e"), Color("4a5d6c"), Color("b06446"), Color("6b5a52")]
const ZINC := [Color("8d969a"), Color("7a5a3e"), Color("9a5a3c"), Color("7f8a8e")]
# KL-style skyline: blue and smoked glass mixed with stone and dark-grey towers
const GLASS := [Color("6f97ab"), Color("c4cfd0"), Color("5d88a0"), Color("9fb4bd"), Color("3f5563"), Color("56646c"), Color("8a8f8c"), Color("b8ad9c")]
const CONDO_WALLS := [Color("f4f1ea"), Color("e9e4d8"), Color("dfe6ea"), Color("d9c8ad"), Color("c9bfae"), Color("b9b4aa"), Color("d4c2a2")]
const CONDO_ACCENTS := [Color("c0392b"), Color("2e6da4"), Color("d68910"), Color("1e8449"), Color("7d3c98"), Color("566573")]
const SIGNS := [Color("e53935"), Color("fdd835"), Color("1e88e5"), Color("43a047"), Color("fb8c00"), Color("8e24aa")]

var rng := RandomNumberGenerator.new()
var buckets := {}
var tod := 0
var frame := Transform3D.IDENTITY      # local -> world for the builders
var occ := PackedByteArray()
var roads := []                        # {pts, cum, cls, half, wet, gaps}
var ground_st := SurfaceTool.new()
var river_pts := PackedVector3Array()
var highway_pts := PackedVector3Array()
var highway_curve: Curve3D
var lrt_curves := []                  # Curve3D per elevated LRT line

# ── seat profile ── set from the game for each constituency (apply_profile)
var tier := "metro"                    # metro | city | town | rural
## 0..1 from the seat's real population density (people/km², log scale:
## ~20 → 0, ~12,000 → 1). Scales how full and how tall the city is.
var fill := 0.6
var view_scale := 1.0                  # 1 = full KL metropolis footprint
## Kuala Lumpur landmarks keep their real layout at one map scale:
## 1 real km = KL_SCALE game metres, for distances and heights alike.
## Real positions (WGS84): Petronas 3.15785 N 101.71165 E, Menara KL
## 3.15278 N 101.70384 E, Merdeka 118 3.14194 N 101.70028 E. Game x is
## east, z is south, the twin towers at the origin.
const KL_SCALE := 1000.0       # true scale: buildings, roads and land all in real metres
const KL_TOWER_KM := Vector2(-0.868, 0.561)    # 1.03 km WSW of KLCC
const MERDEKA_KM := Vector2(-1.264, 1.759)     # 2.17 km SSW of KLCC
const KLCC_PARK_KM := Vector2(0.24, 0.2)       # the park just SE of the towers
var cbd_axis := Vector3.ZERO                    # KLCC -> Merdeka high-rise corridor
var r_core := 175.0                    # zone radii from the centre
var r_commercial := 265.0
var r_taman := 430.0
var r_city := 560.0
var landmarks := true                  # KLCC, Menara KL, Merdeka 118: Bukit Bintang only
var has_lrt := true
var has_highway := true
var traits := {}
var seat_seed := 2026
var feature_turn := 0.0                # rotates river / highway / LRT per seat
var sea_edge := 0.0                    # distance along sea_dir where the sea starts
var sea_dir := Vector3.ZERO            # coastal seats: direction of the sea
var industrial_bearing := INF
var gen: Node3D                        # everything generated for the current seat
var lots := []                         # {p, kind} for every placed building / site
var town_centre := Vector3.ZERO         # dataran, or KLCC in Bukit Bintang
var _profile_key := ""

var box_mesh := BoxMesh.new()
var prism_mesh := PrismMesh.new()
var cyl_mesh := CylinderMesh.new()
var oct_mesh := CylinderMesh.new()
var sphere_mesh := SphereMesh.new()

var mat_plain: StandardMaterial3D
var mat_roof: StandardMaterial3D
var mat_glass: StandardMaterial3D
var mat_lowrise: StandardMaterial3D
var mat_landmark: StandardMaterial3D
var mat_water: Material
var mat_ground: StandardMaterial3D
var mat_lawn: StandardMaterial3D
var mat_tree: StandardMaterial3D
var tree_broadleaf_mesh: Mesh
var tree_palm_mesh: Mesh

var sun: DirectionalLight3D
var env: Environment
var sky_mat: ProceduralSkyMaterial


func _ready() -> void:
	_make_meshes()
	_make_materials()
	_setup_environment()
	if OS.has_feature("web") or OS.has_feature("mobile"):
		_lighten_for_mobile()
	# The zone layer talks to the game. Inside the game it waits for the
	# seat's profile before anything is built; standalone it applies a
	# Bukit Bintang demo profile straight away.
	var zl := preload("res://zone_layer.gd").new()
	zl.name = "Zones"
	add_child(zl)
	zl.setup(self)
	_build_hud()
	_apply_cli()


## Seat profile from the game: {code, name, density (0..1), traits}. The
## city is rebuilt only when the profile actually changes.
func apply_profile(p: Dictionary) -> void:
	var key := JSON.stringify(p)
	if key == _profile_key:
		return
	_profile_key = key
	# let the "building" label paint before the (blocking) generation runs
	if _build_label:
		_build_label.visible = true
	await get_tree().process_frame
	await get_tree().process_frame
	while _building:
		await get_tree().process_frame
	if key != _profile_key:
		return   # a newer seat arrived while waiting; that one builds
	_configure(p)
	_building = true
	# nothing needs drawing while the city builds (the page covers it with
	# its loading panel): the frames handed back stay cheap
	RenderingServer.render_loop_enabled = false
	await _build()
	RenderingServer.render_loop_enabled = true
	_building = false
	if _build_label:
		_build_label.visible = false


var _building := false
var _breath_at := 0
var _build_t0 := 0

## Hand the browser a frame now and then during the build (and tell the
## page how far it has got), so the loading bar keeps moving instead of
## the whole page freezing until the city is done.
func _breathe(progress: float) -> void:
	if Time.get_ticks_msec() - _breath_at < 120:
		return
	$Zones.post_progress(progress)
	await get_tree().process_frame
	_breath_at = Time.get_ticks_msec()


var party_color := Color(0.12, 0.35, 0.8)
var party_abbr := ""
var seat_name := ""


func _configure(p: Dictionary) -> void:
	traits = p.get("traits", {})
	party_color = Color.from_string(str(p.get("partyColor", "#1e5ac8")), Color(0.12, 0.35, 0.8))
	party_abbr = str(p.get("partyAbbr", ""))
	seat_name = str(p.get("name", ""))
	# homes: one drawn home stands for HOMES_SCALE households, so the
	# seat's real households decide how many homes stand (a city at real
	# size reaches that; a pekan in a huge rural seat cannot)
	var pop := float(p.get("population", 0.0))
	home_target = pop / 4.2 / HOMES_SCALE if pop > 0.0 else -1.0
	tourists = float(p.get("tourists", 0.0))
	coast_dir = Vector2.ZERO
	var co = p.get("coast", null)
	if co is Dictionary and co.get("dir") is Array:
		coast_dir = Vector2(float(co.dir[0]), float(co.dir[1])).normalized()
		coast_edge = float(co.get("edge", 1.0))
	land_n = []
	var lp = p.get("land", [])
	if lp is Array:
		for ring in lp:
			if ring is Array and ring.size() >= 6:
				var r2 := PackedVector2Array()
				var k := 0
				while k + 1 < ring.size():
					r2.append(Vector2(float(ring[k]), float(ring[k + 1])))
					k += 2
				land_n.append(r2)
	seat_poly_n = []
	var poly = p.get("outline", [])
	if poly is Array:
		for ring in poly:
			if ring is Array and ring.size() >= 6:
				var r2 := PackedVector2Array()
				var k := 0
				while k + 1 < ring.size():
					r2.append(Vector2(float(ring[k]), float(ring[k + 1])))
					k += 2
				seat_poly_n.append(r2)
	shape_k = PackedFloat32Array()
	var sh = p.get("shape", [])
	if sh is Array and sh.size() >= 12:
		for v in sh:
			shape_k.append(clampf(float(v), 0.45, 2.2))
	var d := float(p.get("density", 0.9))
	var kl := bool(traits.get("klLandmarks", false)) or bool(traits.get("bukitBintang", false))
	landmarks = bool(traits.get("bukitBintang", false))
	# Only Kuala Lumpur seats reach the full metropolis; elsewhere density
	# picks a state city, a pekan or a village, and paddy / coastal seats
	# stay a town even when busy.
	var pd := float(p.get("popDensity", -1.0))
	if pd > 0.0:
		# real density decides the kind of place: KL core and Klang Valley
		# satellites are a metropolis, state capitals a city, then pekan, kampung
		fill = clampf((log(pd) / log(10.0) - 1.3) / (4.1 - 1.3), 0.0, 1.0)
		if pd >= 4500.0:
			tier = "metro"
		elif pd >= 1500.0:
			tier = "city"
		elif pd >= 250.0:
			tier = "town"
		else:
			tier = "rural"
	else:
		fill = clampf(d, 0.0, 1.0)
		if kl:
			tier = "metro" if d >= 0.62 else "city"
		elif d >= 0.62:
			tier = "city"
		elif d >= 0.3:
			tier = "town"
		else:
			tier = "rural"
	if not kl and tier == "city" and pd < 1500.0 and (bool(traits.get("paddy", false)) or bool(traits.get("coastal", false))):
		tier = "town"
	# a state capital is a city with a real downtown, however spread out
	# its seat's population is on average
	if bool(traits.get("capital", false)) and tier in ["town", "rural"]:
		tier = "city"
	view_scale = {"metro": 1.2 if kl else 1.0, "city": 0.8, "town": 0.62, "rural": 0.48}[tier]
	cbd_axis = Vector3(MERDEKA_KM.x, 0, MERDEKA_KM.y) * KL_SCALE if landmarks else Vector3.ZERO
	r_core = 175.0 * view_scale
	r_commercial = 265.0 * view_scale
	r_taman = 430.0 * view_scale
	r_city = 560.0 * view_scale
	# a city seat is drawn at its real size: the radius of a circle with the
	# boundary's area at KL_SCALE (Kepong ~480, Bukit Bintang ~650, Petaling
	# Jaya ~1040), every zone band scaled with it. Towns and villages sit in
	# seats far larger than the pekan itself, so they keep their own size.
	var area := float(p.get("areaKm2", 0.0))
	if area > 0.0:
		var k := clampf(sqrt(area / PI) * KL_SCALE, 900.0, 4200.0) / r_city
		# a town keeps its small pekan core; the seat around it (where its
		# people live) is drawn at the seat's size
		if tier in ["metro", "city"]:
			r_core *= k
			r_commercial *= k
		r_taman *= maxf(1.0, k * 0.6) if not (tier in ["metro", "city"]) else k
		r_city *= k
	var kmax := 1.0
	for v in shape_k:
		kmax = maxf(kmax, v)
	for ring in seat_poly_n:
		for v in ring:
			kmax = maxf(kmax, (v as Vector2).length())
	# the whole seat must fit the occupancy raster: shrink it evenly if not
	if r_city * kmax > EXT - 60.0:
		var fit := (EXT - 60.0) / (r_city * kmax)
		# the seat shrinks, but a pekan's centre keeps its real size (a town
		# of shophouses is a few hundred metres whatever the seat around it)
		var core0 := 175.0 * view_scale
		var comm0 := 265.0 * view_scale
		r_city *= fit
		r_taman = maxf(r_taman * fit, minf(430.0 * view_scale, r_city * 0.6))
		r_core = maxf(r_core * fit, minf(core0, r_taman * 0.4))
		r_commercial = maxf(r_commercial * fit, minf(comm0, r_taman * 0.6))
	# a state city's downtown is a few hundred metres across, however big
	# its seat: only KL's metro seats keep a downtown the size of the seat
	# (Bukit Bintang, Petaling Jaya)
	if tier == "city":
		r_core = minf(r_core, 520.0)
		r_commercial = minf(r_commercial, 820.0)
	seat_poly = []
	for ring in seat_poly_n:
		var w2 := PackedVector2Array()
		for v in ring:
			w2.append((v as Vector2) * r_city)
		seat_poly.append(w2)
	land_rings = []
	for ring in land_n:
		var w3 := PackedVector2Array()
		for v in ring:
			w3.append((v as Vector2) * r_city)
		# round off the survey polygon's corners so coasts curve smoothly
		land_rings.append(_chaikin(_chaikin(w3)))
	reach_r = r_city * kmax
	if env:
		env.fog_depth_begin = maxf(900.0, reach_r * 0.8)
		env.fog_depth_end = maxf(5200.0, reach_r * 3.0)
	pan_limit = maxf(SPAN * 0.55, reach_r * 1.05)
	has_lrt = tier == "metro"
	var choices: Array = {"metro": ["radial"], "city": ["oldtown", "taman", "radial"],
		"town": ["strip", "oldtown", "taman"], "rural": ["strip", "taman"]}[tier]
	layout = str(p.get("layout", choices[absi(hash(str(p.get("code", "")) + ":layout")) % choices.size()]))
	if landmarks:
		layout = "radial"
	radials = {"metro": 7, "city": 7, "town": 6, "rural": 4}[tier]
	ring_keep = {"metro": 1.0, "city": 0.9, "town": 0.7, "rural": 0.4}[tier]
	has_highway = tier != "rural"
	seat_seed = hash(str(p.get("code", "demo")))


func _build() -> void:
	_breath_at = Time.get_ticks_msec()
	_build_t0 = _breath_at
	if gen:
		gen.free()
	gen = Node3D.new()
	sky_cells = {}
	gen.name = "Gen"
	add_child(gen)
	rng.seed = seat_seed
	feature_turn = rng.randf() * TAU
	sea_dir = Vector3.ZERO
	sea_edge = r_city + 80.0
	if not seat_poly.is_empty():
		# a seat with its real boundary: the sea is where the real coast is
		# (the page finds it from every seat boundary), else none
		if coast_dir != Vector2.ZERO:
			sea_dir = Vector3(coast_dir.x, 0, coast_dir.y)
			sea_edge = coast_edge * r_city
	elif bool(traits.get("coastal", false)):
		sea_dir = Vector3(cos(feature_turn + PI), 0, sin(feature_turn + PI))
	_set_zoning()
	occ = PackedByteArray()
	occ.resize(GN * GN)
	_mask_outside()
	roads = []
	lots = []
	town_centre = Vector3.ZERO
	buckets = {}
	_last_bk = {}
	_last_mesh = null
	_last_mat = null
	lrt_curves = []
	_rad_ang = []
	_rad_ph = []
	_arcs = {}
	frame = Transform3D.IDENTITY
	ground_st = SurfaceTool.new()
	ground_st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_build_ground()
	_build_features()
	await _breathe(0.15)
	_gen_roads()
	await _breathe(0.25)
	_draw_roads()
	_build_specials()
	if has_lrt:
		_build_lrt()
	homes_built = 0.0
	_build_tourism()
	await _breathe(0.3)
	# hills first in a hilly seat: the interior is forest, the houses
	# spread round its foot
	if bool(traits.get("hilly", false)):
		_forest_hills()
	_plan_lanes()
	await _breathe(0.35)
	_frontage()
	await _breathe(0.45)
	await _infill_homes()
	await _breathe(0.85)
	if true:
		print("CITYSTATS homes=", int(homes_built), " target=", int(home_target), " hotels=", hotels_built, " chalets=", chalets_built, " tier=", tier, " tourists=", int(tourists))
	# lawns and shade trees on the paved centre, in whatever space the
	# buildings left (runs after them so it never takes a lot)
	if tier in ["metro", "city"]:
		_plaza_greenery(r_core - 10.0)
	elif tier == "town" and layout == "radial":
		_plaza_greenery(r_core * 0.6)
	_fill_trees()
	await _breathe(0.9)
	_flush_buckets()
	var gmi := MeshInstance3D.new()
	gmi.mesh = ground_st.commit()
	gmi.material_override = mat_ground
	# flat roads/plaza/river ribbons: receive shadows, never cast them
	# (self-shadow acne flips the ground dark as the cascades move)
	gmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	gen.add_child(gmi)
	$Traffic.setup(self)
	if not has_node("Birds"):
		var birds := Node3D.new()
		birds.name = "Birds"
		birds.set_script(preload("res://birds.gd"))
		add_child(birds)
	$Birds.setup(self)
	$Zones.relayout()
	_billboards()
	_build_outline()
	$CameraRig.view_scale = view_scale
	$CameraRig.preset("city")
	print("CITYZONES ", JSON.stringify(city_summary()))
	$Zones.post_built()
	print("CITYBUILT ms=", Time.get_ticks_msec() - _build_t0)


## The seat boundary as a glowing gold ribbon on the ground (the same
## outline as the game's map), shown by the aerial intro and faded out as
## the camera comes down. Hidden otherwise.
var outline: MeshInstance3D
var _outline_mat: StandardMaterial3D

func _build_outline() -> void:
	if outline == null:
		outline = MeshInstance3D.new()
		_outline_mat = StandardMaterial3D.new()
		_outline_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_outline_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_outline_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_outline_mat.no_depth_test = true
		_outline_mat.render_priority = 12
		_outline_mat.albedo_color = Color(1.0, 0.8, 0.16, 0.0)
		outline.material_override = _outline_mat
		add_child(outline)
	var rings := []
	if not seat_poly.is_empty():
		for ring in seat_poly:
			var r3 := []
			for v in ring:
				r3.append(Vector3(v.x, 0, v.y))
			rings.append(r3)
	else:
		var r3 := []
		for i in 144:
			r3.append(_polar(r_city * 1.04, TAU * i / 144.0))
		rings.append(r3)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var w := maxf(5.0, r_city * 0.008)
	var y := Vector3(0, 2.0, 0)
	for pts in rings:
		var n: int = pts.size()
		for i in n:
			var p0: Vector3 = pts[i]
			var p1: Vector3 = pts[(i + 1) % n]
			if p0.distance_to(p1) < 0.01:
				continue
			var d := (p1 - p0).normalized()
			var side := Vector3(-d.z, 0, d.x) * w
			st.add_vertex(p0 - side + y); st.add_vertex(p0 + side + y); st.add_vertex(p1 + side + y)
			st.add_vertex(p0 - side + y); st.add_vertex(p1 + side + y); st.add_vertex(p1 - side + y)
	outline.mesh = st.commit()
	# the boundary stays faintly marked on the ground after the intro
	set_outline_alpha(0.3)


func set_outline_alpha(a: float) -> void:
	if outline == null:
		return
	outline.visible = a > 0.01
	_outline_mat.albedo_color.a = clampf(a, 0.0, 1.0)


## Campaign billboards: big posters in the player's party colour on the
## street face of the tallest towers near the centre (city-builder flavour).
func _billboards() -> void:
	var count: int = {"metro": 7, "city": 5, "town": 2, "rural": 0}[tier]
	if count == 0:
		return
	var slogans := ["BERSAMA RAKYAT", "KEMUDAHAN RAKYAT", ("PEMBANGUNAN " + seat_name.to_upper()).strip_edges(), "SUARA ANDA", "MAJU BERSAMA"]
	var picks := []
	for lot in lots:
		if lot.kind in ["tower", "condo", "flat"]:
			picks.append(lot)
	picks.sort_custom(func(a, b): return (a.p as Vector3).length() < (b.p as Vector3).length())
	var mat := StandardMaterial3D.new()
	mat.albedo_color = party_color
	mat.emission_enabled = true
	mat.emission = party_color
	mat.emission_energy_multiplier = 0.35
	mat.roughness = 0.6
	var used := 0
	for lot in picks:
		if used >= count:
			break
		var p: Vector3 = lot.p
		var h := height_at(p, 0)
		if h < 18.0:
			continue
		var basis := Basis(Vector3.UP, float(lot.yaw))
		var front := basis * Vector3(0, 0, -1)          # towards the street
		var w := minf(9.0, float(lot.w) * 0.55)
		var ph := minf(h * 0.38, 16.0)
		var centre := p + front * 7.6 + Vector3(0, h * 0.5, 0)
		var panel := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(w, ph, 0.3)
		panel.mesh = bm
		panel.material_override = mat
		panel.transform = Transform3D(basis, centre)
		gen.add_child(panel)
		var lab := Label3D.new()
		lab.text = slogans[used % slogans.size()].replace(" ", "\n")
		lab.font_size = 96
		var longest := 1
		for line in lab.text.split("\n"):
			longest = maxi(longest, line.length())
		# fill ~85% of the panel width (a glyph is ~0.6 em wide)
		lab.pixel_size = (w * 0.85) / (longest * 96.0 * 0.62)
		lab.font = SystemFont.new()
		(lab.font as SystemFont).font_weight = 900
		lab.outline_size = 0
		lab.modulate = Color.WHITE
		lab.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lab.transform = Transform3D(Basis(Vector3.UP, float(lot.yaw) + PI), centre + front * 0.2)
		gen.add_child(lab)
		var tag := Label3D.new()
		tag.text = party_abbr
		tag.font_size = 64
		tag.pixel_size = (w * 0.3) / (maxi(1, party_abbr.length()) * 64.0 * 0.62)
		tag.outline_size = 0
		tag.modulate = Color(1, 0.85, 0.2)
		tag.transform = Transform3D(Basis(Vector3.UP, float(lot.yaw) + PI), centre + front * 0.2 + Vector3(0, ph * 0.38, 0))
		gen.add_child(tag)
		used += 1


## Phones get a smaller shadow atlas, two cascades and a shorter shadow
## range; the UI scales with the screen's pixel density.
var _mobile := false


func _lighten_for_mobile() -> void:
	_mobile = true
	set_tod(tod)
	RenderingServer.directional_shadow_atlas_set_size(2048, true)
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 450.0
	# the Compatibility renderer skips SSAO / colour adjustment, so trim the
	# sky fill and haze that otherwise bleach the city
	env.fog_aerial_perspective = 0.0
	env.ambient_light_sky_contribution = 0.45
	env.ambient_light_color = Color(0.34, 0.4, 0.55)
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	# roll highlights off instead of clipping (sun-facing walls went white)
	env.tonemap_white = 3.0
	env.tonemap_exposure = 0.85
	get_window().content_scale_factor = clampf(DisplayServer.screen_get_scale(), 1.0, 3.0)


var _tod_btn: Button
var _build_label: Label
const TOD_NAMES := ["Siang", "Senja", "Malam"]




## Malaysia's day: light from ~7am, an hour of dusk after ~7pm, then night.
func _follow_clock() -> void:
	var h: int = int(str(JavaScriptBridge.eval("new Date().getHours()", true))) if OS.has_feature("web") else Time.get_datetime_dict_from_system().hour
	var t := 0 if (h >= 7 and h < 19) else (1 if h == 19 else 2)
	if t != tod:
		set_tod(t)


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var embedded: bool = $Zones.is_embedded()
	var bar := HBoxContainer.new()
	bar.position = Vector2(12, 12)
	if embedded:
		# Inside the game its own HUD owns the screen: no buttons here, and
		# it is always daytime (night mode from the real clock was removed).
		bar.visible = false
		set_tod(0)
	bar.add_theme_constant_override("separation", 8)
	layer.add_child(bar)
	_tod_btn = Button.new()
	_tod_btn.text = "Waktu: Siang"
	_tod_btn.custom_minimum_size = Vector2(130, 40)
	_tod_btn.pressed.connect(func(): set_tod((tod + 1) % 3))
	bar.add_child(_tod_btn)
	var reset := Button.new()
	reset.text = "Reset kamera"
	reset.custom_minimum_size = Vector2(130, 40)
	reset.pressed.connect(func(): $CameraRig.preset("city"))
	bar.add_child(reset)
	_build_label = Label.new()
	_build_label.text = "Membina bandar…"
	_build_label.add_theme_font_size_override("font_size", 22)
	_build_label.add_theme_color_override("font_color", Color(0.85, 0.93, 1.0))
	_build_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
	_build_label.add_theme_constant_override("outline_size", 6)
	_build_label.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_build_label.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_build_label.visible = gen == null
	layer.add_child(_build_label)
	var hint := Label.new()
	hint.text = "1 jari: pusing  ·  2 jari: zum / alih"
	hint.add_theme_color_override("font_color", Color(1, 1, 1, 0.85))
	hint.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	hint.add_theme_constant_override("outline_size", 4)
	hint.position = Vector2(14, 58)
	if not embedded:
		layer.add_child(hint)


# ── meshes & materials ───────────────────────────────────────────────
func _make_meshes() -> void:
	box_mesh.size = Vector3.ONE
	prism_mesh.size = Vector3.ONE
	cyl_mesh.top_radius = 0.5
	cyl_mesh.bottom_radius = 0.5
	cyl_mesh.height = 1.0
	cyl_mesh.radial_segments = 12
	cyl_mesh.rings = 1
	oct_mesh.top_radius = 0.5
	oct_mesh.bottom_radius = 0.5
	oct_mesh.height = 1.0
	oct_mesh.radial_segments = 8
	oct_mesh.rings = 1
	sphere_mesh.radius = 0.5
	sphere_mesh.height = 1.0
	sphere_mesh.radial_segments = 16
	sphere_mesh.rings = 8


func _tex(img: Image) -> ImageTexture:
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


## Genting courses: horizontal bands so world-triplanar mapping turns them
## into rows parallel to every ridge, whatever the roof's orientation.
func _roof_texture() -> ImageTexture:
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	for y in 64:
		var b := y % 16
		var v := 0.95 - 0.35 * float(b) / 15.0
		if b >= 14:
			v = 0.45
		for x in 64:
			var seam := 1.0 if ((x + (y / 16) * 8) % 16) != 0 else 0.7
			var n := rng.randf_range(-0.04, 0.04)
			img.set_pixel(x, y, Color(v * seam + n, v * seam + n, v * seam + n))
	return _tex(img)


## Window grid. `lit` builds the matching emission map: a random share of
## panes glowing warm, everything else black.
func _window_texture(cols: int, rows: int, frame: Color, glass: Color, lit: bool, lit_share: float, pane := 0.85) -> ImageTexture:
	var size := 128
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(Color.BLACK if lit else frame)
	var cw := size / cols
	var ch := size / rows
	for r in rows:
		for c in cols:
			var col := glass
			if lit:
				col = Color.BLACK
				if rng.randf() < lit_share:
					col = Color(1.0, 0.8, 0.52).lerp(Color(0.85, 0.92, 1.0), rng.randf() * 0.5) * rng.randf_range(0.6, 1.0)
			else:
				col = glass.lerp(Color.WHITE, rng.randf_range(0.0, 0.18))
			var pw := int(cw * pane)
			var ph := int(ch * pane * 0.8)
			img.fill_rect(Rect2i(c * cw + (cw - pw) / 2, r * ch + (ch - ph) / 2, pw, ph), col)
	return _tex(img)


func _triplanar(m: StandardMaterial3D, metres: float) -> void:
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	var s := 1.0 / metres
	m.uv1_scale = Vector3(s, s, s)


## Blender-baked tileable detail (multiplied over the colour) + normal map,
## mapped in world space. See ../world/blender/materials.py.
func _detail(m: StandardMaterial3D, name: String, metres: float, normal_scale: float) -> void:
	var d: Texture2D = load("res://assets/tex/%s_detail.png" % name)
	if d == null:
		return
	m.albedo_texture = d
	if normal_scale > 0.0:
		var n: Texture2D = load("res://assets/tex/%s_normal.png" % name)
		if n:
			m.normal_enabled = true
			m.normal_texture = n
			m.normal_scale = normal_scale
	_triplanar(m, metres)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC


func _glb_mesh(path: String) -> Mesh:
	var scene: PackedScene = load(path)
	if scene == null:
		return null
	var inst := scene.instantiate()
	var found := inst.find_children("*", "MeshInstance3D", true, false)
	var m: Mesh = (found[0] as MeshInstance3D).mesh if found.size() > 0 else null
	inst.free()
	return m


func _make_materials() -> void:
	mat_plain = StandardMaterial3D.new()
	mat_plain.vertex_color_use_as_albedo = true
	mat_plain.vertex_color_is_srgb = true
	mat_plain.roughness = 0.85
	mat_plain.metallic_specular = 0.2   # no sun glare off pale walls at grazing angles

	mat_roof = StandardMaterial3D.new()
	mat_roof.vertex_color_use_as_albedo = true
	mat_roof.vertex_color_is_srgb = true
	mat_roof.albedo_texture = _roof_texture()
	mat_roof.roughness = 0.9
	_triplanar(mat_roof, 2.4)

	mat_glass = StandardMaterial3D.new()
	mat_glass.vertex_color_use_as_albedo = true
	mat_glass.vertex_color_is_srgb = true
	mat_glass.albedo_texture = _window_texture(4, 4, Color(0.78, 0.8, 0.82), Color(0.42, 0.5, 0.58), false, 0)
	mat_glass.emission_enabled = true
	mat_glass.emission_texture = _window_texture(4, 4, Color.BLACK, Color.BLACK, true, 0.45)
	mat_glass.emission_energy_multiplier = 0.0
	mat_glass.metallic = 0.3
	mat_glass.roughness = 0.25
	_triplanar(mat_glass, 14.0)

	mat_lowrise = StandardMaterial3D.new()
	mat_lowrise.vertex_color_use_as_albedo = true
	mat_lowrise.vertex_color_is_srgb = true
	mat_lowrise.albedo_texture = _window_texture(4, 4, Color(1, 1, 1), Color(0.3, 0.36, 0.42), false, 0, 0.42)
	mat_lowrise.emission_enabled = true
	mat_lowrise.emission_texture = _window_texture(4, 4, Color.BLACK, Color.BLACK, true, 0.45, 0.42)
	mat_lowrise.emission_energy_multiplier = 0.0
	mat_lowrise.roughness = 0.8
	mat_lowrise.metallic_specular = 0.2
	_triplanar(mat_lowrise, 14.0)

	mat_landmark = StandardMaterial3D.new()
	mat_landmark.albedo_color = Color(0.86, 0.88, 0.9)
	mat_landmark.albedo_texture = _window_texture(6, 4, Color(0.92, 0.93, 0.95), Color(0.5, 0.58, 0.66), false, 0)
	mat_landmark.emission_enabled = true
	mat_landmark.emission_texture = _window_texture(6, 4, Color.BLACK, Color.BLACK, true, 0.8)
	mat_landmark.emission_energy_multiplier = 0.0
	mat_landmark.metallic = 0.75
	mat_landmark.roughness = 0.22
	_triplanar(mat_landmark, 8.0)

	mat_ground = StandardMaterial3D.new()
	mat_ground.vertex_color_use_as_albedo = true
	mat_ground.vertex_color_is_srgb = true
	mat_ground.roughness = 0.95
	mat_ground.cull_mode = BaseMaterial3D.CULL_DISABLED
	_detail(mat_ground, "concrete", 4.0, 0.5)

	mat_lawn = StandardMaterial3D.new()
	mat_lawn.vertex_color_use_as_albedo = true
	mat_lawn.vertex_color_is_srgb = true
	mat_lawn.roughness = 1.0
	_detail(mat_lawn, "grass", 2.5, 0.5)

	mat_tree = StandardMaterial3D.new()
	mat_tree.vertex_color_use_as_albedo = true
	mat_tree.vertex_color_is_srgb = true
	mat_tree.roughness = 0.9
	mat_tree.cull_mode = BaseMaterial3D.CULL_DISABLED
	_detail(mat_tree, "grass", 1.2, 0.0)
	tree_broadleaf_mesh = _glb_mesh("res://assets/tree_far_broadleaf.glb")
	tree_palm_mesh = _glb_mesh("res://assets/tree_far_palm.glb")

	mat_water = _water_material()


## Water for rivers, lakes and the sea: two scrolling normal maps for
## small moving ripples, a slow large-scale tint so open water isn't one
## flat colour, and a sky-tinted sheen at grazing angles. Works in the
## web build's compatibility renderer (no depth or screen reads).
const WATER_SHADER := """
shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;
uniform vec3 deep : source_color = vec3(0.09, 0.42, 0.56);
uniform vec3 shallow : source_color = vec3(0.24, 0.66, 0.72);
uniform vec3 sheen : source_color = vec3(0.78, 0.9, 0.96);
uniform sampler2D waves : hint_normal;
uniform sampler2D tint;
varying vec3 wpos;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 p = wpos.xz;
	vec3 n1 = texture(waves, p * 0.011 + TIME * vec2(0.006, 0.004)).rgb;
	vec3 n2 = texture(waves, p * 0.019 - TIME * vec2(0.005, 0.007)).rgb;
	NORMAL_MAP = normalize(n1 + n2 - 1.0) * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.55;
	float m = texture(tint, p * 0.0011).r;
	vec3 col = mix(deep, shallow, smoothstep(0.25, 0.8, m));
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	ALBEDO = mix(col, sheen, f * 0.4);
	ROUGHNESS = 0.07;
	METALLIC = 0.12;
	SPECULAR = 0.65;
}
"""

func _water_material() -> Material:
	var sh := Shader.new()
	sh.code = WATER_SHADER
	var m := ShaderMaterial.new()
	m.shader = sh
	var wn := NoiseTexture2D.new()
	wn.width = 256
	wn.height = 256
	wn.seamless = true
	wn.as_normal_map = true
	wn.bump_strength = 6.0
	var f1 := FastNoiseLite.new()
	f1.frequency = 0.03
	f1.fractal_octaves = 3
	wn.noise = f1
	var tn := NoiseTexture2D.new()
	tn.width = 128
	tn.height = 128
	tn.seamless = true
	var f2 := FastNoiseLite.new()
	f2.frequency = 0.02
	tn.noise = f2
	m.set_shader_parameter("waves", wn)
	m.set_shader_parameter("tint", tn)
	return m


# ── geometry helpers ─────────────────────────────────────────────────
## Catmull-Rom style Curve3D through `pts`.
func _smooth_curve(pts: Array) -> Curve3D:
	var c := Curve3D.new()
	c.bake_interval = 4.0
	for i in pts.size():
		var prev: Vector3 = pts[maxi(i - 1, 0)]
		var nxt: Vector3 = pts[mini(i + 1, pts.size() - 1)]
		var tan := (nxt - prev) / 6.0
		c.add_point(pts[i], -tan, tan)
	return c


## Nearest point on the river (ground plane) and the river's direction there.
func _river_near(p: Vector3) -> Array:
	var best := INF
	var bq := Vector3.ZERO
	var bt := Vector3.RIGHT
	var q0 := Vector3(p.x, 0, p.z)
	for k in river_pts.size() - 1:
		var a := Vector3(river_pts[k].x, 0, river_pts[k].z)
		var b := Vector3(river_pts[k + 1].x, 0, river_pts[k + 1].z)
		var c := Geometry3D.get_closest_point_to_segment(q0, a, b)
		var d := q0.distance_to(c)
		if d < best:
			best = d; bq = c; bt = (b - a).normalized()
	return [bq, bt]


## Distance from p to the river, through a coarse grid of the river's
## segments (rebuilt whenever the river changes), so a road's every point
## can be checked without walking the whole river each time.
const RIVER_CELL := 80.0
var _rgrid := {}
var _rgrid_n := -1
func _river_dist(p: Vector3) -> float:
	if river_pts.size() < 2:
		return INF
	if _rgrid_n != river_pts.size() or _rgrid.is_empty():
		_rgrid = {}
		_rgrid_n = river_pts.size()
		for i in river_pts.size() - 1:
			var a := river_pts[i]
			var b := river_pts[i + 1]
			var x0 := floori(minf(a.x, b.x) / RIVER_CELL)
			var x1 := floori(maxf(a.x, b.x) / RIVER_CELL)
			var z0 := floori(minf(a.z, b.z) / RIVER_CELL)
			var z1 := floori(maxf(a.z, b.z) / RIVER_CELL)
			for gx in range(x0, x1 + 1):
				for gz in range(z0, z1 + 1):
					var key := Vector2i(gx, gz)
					if not _rgrid.has(key):
						_rgrid[key] = []
					(_rgrid[key] as Array).append(i)
	var c := Vector2i(floori(p.x / RIVER_CELL), floori(p.z / RIVER_CELL))
	var q := Vector3(p.x, 0, p.z)
	var best := INF
	for dx in [-1, 0, 1]:
		for dz in [-1, 0, 1]:
			var key := c + Vector2i(dx, dz)
			if not _rgrid.has(key):
				continue
			for i: int in _rgrid[key]:
				var a := Vector3(river_pts[i].x, 0, river_pts[i].z)
				var b := Vector3(river_pts[i + 1].x, 0, river_pts[i + 1].z)
				best = minf(best, q.distance_to(Geometry3D.get_closest_point_to_segment(q, a, b)))
	# beyond the searched cells the river is at least a cell away
	return best if best < RIVER_CELL else maxf(best, RIVER_CELL)


func _dist_to(pts: PackedVector3Array, p: Vector3) -> float:
	var best := INF
	if pts.is_empty():
		return best
	var q := Vector3(p.x, 0, p.z)
	for i in pts.size() - 1:
		var a := Vector3(pts[i].x, 0, pts[i].z)
		var b := Vector3(pts[i + 1].x, 0, pts[i + 1].z)
		best = minf(best, q.distance_to(Geometry3D.get_closest_point_to_segment(q, a, b)))
	return best


## Ribbon along a polyline into `st`: flat strip of half-width `half` at height y.
func _ribbon(st: SurfaceTool, pts: PackedVector3Array, half: float, y: float, col: Color) -> void:
	for i in pts.size() - 1:
		var a := pts[i]
		var b := pts[i + 1]
		var ta := (pts[mini(i + 1, pts.size() - 1)] - pts[maxi(i - 1, 0)]).normalized()
		var tb := (pts[mini(i + 2, pts.size() - 1)] - pts[i]).normalized()
		var na := Vector3(-ta.z, 0, ta.x) * half
		var nb := Vector3(-tb.z, 0, tb.x) * half
		_quad(st, Vector3(a.x, y, a.z) - na, Vector3(a.x, y, a.z) + na, Vector3(b.x, y, b.z) + nb, Vector3(b.x, y, b.z) - nb, col, Vector3.UP)


func _quad(st: SurfaceTool, p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, col: Color, n: Vector3) -> void:
	st.set_color(col)
	st.set_normal(n)
	for v in [p0, p1, p2, p0, p2, p3]:
		st.add_vertex(v)


# ── instancing helpers ───────────────────────────────────────────────
## Instances go into a bucket per mesh and material, kept per ground tile
## so each MultiMesh chunk later covers one compact patch of the seat
## (the camera can then skip the chunks it isn't looking at).
const TILE := 400.0
var _last_mesh: Mesh
var _last_mat: Material
var _last_bk: Dictionary
func _add(mesh: Mesh, mat: Material, xf: Transform3D, col: Color) -> void:
	xf = frame * xf
	var bk: Dictionary
	if mesh == _last_mesh and mat == _last_mat and not _last_bk.is_empty():
		bk = _last_bk
	else:
		var bm: Dictionary = buckets.get(mesh, {})
		if bm.is_empty():
			buckets[mesh] = bm
		bk = bm.get(mat, {})
		if bk.is_empty():
			bk = {"mesh": mesh, "mat": mat, "tiles": {}}
			bm[mat] = bk
		_last_mesh = mesh
		_last_mat = mat
		_last_bk = bk
	var o := xf.origin
	var tk := Vector2i(floori(o.x / TILE), floori(o.z / TILE))
	var tiles: Dictionary = bk.tiles
	var arr: Array = tiles.get(tk, [])
	if arr.is_empty():
		tiles[tk] = arr
	var x := xf.basis.x
	var y := xf.basis.y
	var z := xf.basis.z
	# MultiMesh buffer layout: basis rows with origin, then the colour
	arr.append_array([x.x, y.x, z.x, o.x, x.y, y.y, z.y, o.y, x.z, y.z, z.z, o.z, col.r, col.g, col.b, col.a])


## Box standing on `pos` (bottom-centre).
func box(pos: Vector3, size: Vector3, col: Color, mat: Material = null, yaw := 0.0) -> void:
	var b := Basis(Vector3.UP, yaw) * Basis.from_scale(size)
	_add(box_mesh, mat if mat else mat_plain, Transform3D(b, pos + Vector3(0, size.y * 0.5, 0)), col)


func cyl(pos: Vector3, radius: float, h: float, col: Color, mat: Material = null, mesh: Mesh = null) -> void:
	var b := Basis.from_scale(Vector3(radius * 2, h, radius * 2))
	_add(mesh if mesh else cyl_mesh, mat if mat else mat_plain, Transform3D(b, pos + Vector3(0, h * 0.5, 0)), col)


func ball(pos: Vector3, size: Vector3, col: Color, mat: Material = null) -> void:
	_add(sphere_mesh, mat if mat else mat_plain, Transform3D(Basis.from_scale(size), pos), col)


## Gable roof sitting on a w×d wall top at height y; the ridge follows the
## longer side, with a small eave overhang.
func gable(pos: Vector3, w: float, d: float, rise: float, col: Color) -> void:
	var b: Basis
	if w > d:
		b = Basis(Vector3.UP, PI * 0.5) * Basis.from_scale(Vector3(d + 1.0, rise, w + 0.8))
	else:
		b = Basis.from_scale(Vector3(w + 1.0, rise, d + 0.8))
	_add(prism_mesh, mat_roof, Transform3D(b, pos + Vector3(0, rise * 0.5, 0)), col)


func tree(pos: Vector3, palm := false) -> void:
	var mesh := tree_palm_mesh if palm else tree_broadleaf_mesh
	if mesh:
		var sc := rng.randf_range(1.4, 1.9) if palm else rng.randf_range(1.1, 1.6)
		var b := Basis(Vector3.UP, rng.randf() * TAU) * Basis.from_scale(Vector3.ONE * sc)
		var shade := rng.randf_range(0.88, 1.12)
		_add(mesh, mat_tree, Transform3D(b, pos), Color(shade, shade, shade))
		return
	if palm:
		var h := rng.randf_range(6.0, 9.0)
		cyl(pos, 0.22, h, Color(0.45, 0.36, 0.26))
		ball(pos + Vector3(0, h, 0), Vector3(4.2, 1.3, 4.2), Color(0.2, 0.42, 0.18).lerp(Color(0.3, 0.5, 0.2), rng.randf()))
	else:
		var h := rng.randf_range(2.2, 3.4)
		var r := rng.randf_range(2.0, 3.4)
		cyl(pos, 0.3, h, Color(0.38, 0.29, 0.2))
		ball(pos + Vector3(0, h + r * 0.6, 0), Vector3(r * 2, r * 1.6, r * 2), Color(0.18, 0.42, 0.16).lerp(Color(0.36, 0.56, 0.2), rng.randf()))


## Roof height per 16 m cell (from every instanced part's top), so the
## camera can keep above the buildings instead of flying through them.
const SKY_CELL := 16.0
var sky_cells := {}


func _note_height(xf: Transform3D) -> void:
	var top := xf.origin.y + absf(xf.basis.y.y) * 0.5
	if top < 4.0:
		return
	var k := Vector2i(floori(xf.origin.x / SKY_CELL), floori(xf.origin.z / SKY_CELL))
	if top > float(sky_cells.get(k, 0.0)):
		sky_cells[k] = top


func height_at(p: Vector3, reach := 1) -> float:
	var cx := floori(p.x / SKY_CELL)
	var cz := floori(p.z / SKY_CELL)
	var h := 0.0
	for dx in range(-reach, reach + 1):
		for dz in range(-reach, reach + 1):
			h = maxf(h, float(sky_cells.get(Vector2i(cx + dx, cz + dz), 0.0)))
	return h


func _flush_buckets() -> void:
	for bm: Dictionary in buckets.values():
		for bk: Dictionary in bm.values():
			var tiles: Dictionary = bk.tiles
			var keys := tiles.keys()
			keys.sort()
			var all := []
			for k in keys:
				all.append_array(tiles[k])
			var buf := PackedFloat32Array(all)
			var total := buf.size() / 16
			for i in total:
				var top := buf[i * 16 + 7] + absf(buf[i * 16 + 5]) * 0.5
				if top >= 4.0:
					var sk := Vector2i(floori(buf[i * 16 + 3] / SKY_CELL), floori(buf[i * 16 + 11] / SKY_CELL))
					if top > float(sky_cells.get(sk, 0.0)):
						sky_cells[sk] = top
			# chunked: very large instance buffers break on some WebGL drivers
			var is_tree: bool = bk.mesh == tree_palm_mesh or bk.mesh == tree_broadleaf_mesh
			var start := 0
			while start < total:
				var n := mini(4096, total - start)
				var cb := buf.slice(start * 16, (start + n) * 16)
				# each chunk stands at its own centre (so distance culling
				# works per patch) and its instances are kept relative to it
				var cen := Vector3.ZERO
				var top := 0.0
				for i in n:
					cen += Vector3(cb[i * 16 + 3], 0, cb[i * 16 + 11])
					top = maxf(top, cb[i * 16 + 7] + absf(cb[i * 16 + 5]) * 0.5)
				cen /= float(n)
				for i in n:
					cb[i * 16 + 3] -= cen.x
					cb[i * 16 + 11] -= cen.z
				var mm := MultiMesh.new()
				mm.transform_format = MultiMesh.TRANSFORM_3D
				mm.use_colors = true
				mm.mesh = bk.mesh
				mm.instance_count = n
				mm.buffer = cb
				var mmi := MultiMeshInstance3D.new()
				mmi.multimesh = mm
				mmi.material_override = bk.mat
				mmi.position = cen
				# far patches of small things drop out (they are a few pixels
				# by then, and in the haze); towers and landmarks always show
				if is_tree:
					mmi.visibility_range_end = maxf(3200.0, reach_r * 1.25)
				elif top < 12.0:
					mmi.visibility_range_end = maxf(4500.0, reach_r * 1.9)
				mmi.visibility_range_end_margin = 300.0
				gen.add_child(mmi)
				start += n
	buckets.clear()
	_last_mesh = null
	_last_mat = null
	_last_bk = {}


func _single(mesh: Mesh, mat: Material, xf: Transform3D) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.transform = frame * xf
	_note_height(mi.transform)
	gen.add_child(mi)


# ── environment ──────────────────────────────────────────────────────
func _setup_environment() -> void:
	sky_mat = ProceduralSkyMaterial.new()
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.9
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.2
	env.adjustment_contrast = 1.08
	env.ssao_enabled = true
	env.ssao_radius = 2.0
	env.glow_enabled = true
	env.glow_hdr_threshold = 1.2
	env.fog_enabled = true
	# depth fog: the city stays crisp, only the far valley fades out
	env.fog_mode = Environment.FOG_MODE_DEPTH
	# haze like a KL skyline: the near streets stay crisp, the towers
	# and ranges behind fade layer by layer into the horizon colour
	env.fog_depth_begin = 900.0
	env.fog_depth_end = 5200.0
	env.fog_depth_curve = 1.3
	env.fog_aerial_perspective = 0.15
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.shadow_normal_bias = 2.5
	sun.directional_shadow_max_distance = 900.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	add_child(sun)
	set_tod(0)


func set_tod(t: int) -> void:
	tod = t
	var win := 0.0
	match tod:
		0:
			sun.rotation_degrees = Vector3(-52, -35, 0)
			sun.light_color = Color(1.0, 0.96, 0.88)
			# 1.7 clipped pale walls facing the sun to flat white
			sun.light_energy = 1.35
			sky_mat.sky_top_color = Color(0.32, 0.55, 0.85)
			sky_mat.sky_horizon_color = Color(0.72, 0.82, 0.9)
			sky_mat.ground_horizon_color = Color(0.6, 0.66, 0.6)
			env.ambient_light_energy = 0.55
			env.fog_light_color = Color(0.72, 0.8, 0.88)
		1:
			# golden hour: low warm sun, teal-grey sky over a peach horizon
			sun.rotation_degrees = Vector3(-12, -70, 0)
			sun.light_color = Color(1.0, 0.7, 0.45)
			sun.light_energy = 1.15
			sky_mat.sky_top_color = Color(0.34, 0.43, 0.5)
			sky_mat.sky_horizon_color = Color(0.94, 0.7, 0.58)
			sky_mat.ground_horizon_color = Color(0.4, 0.3, 0.3)
			env.ambient_light_energy = 0.7
			env.fog_light_color = Color(0.8, 0.55, 0.45)
			win = 1.2
		2:
			sun.rotation_degrees = Vector3(-40, 120, 0)
			sun.light_color = Color(0.55, 0.65, 0.95)
			sun.light_energy = 0.18
			sky_mat.sky_top_color = Color(0.03, 0.05, 0.12)
			sky_mat.sky_horizon_color = Color(0.12, 0.16, 0.28)
			sky_mat.ground_horizon_color = Color(0.04, 0.05, 0.08)
			# moonlit blue fill, stronger on phones whose renderer has a
			# weaker sky-ambient term, so streets and roofs still read
			env.ambient_light_energy = 1.6 if _mobile else 0.6
			if _mobile:
				sun.light_energy = 0.55
			env.fog_light_color = Color(0.08, 0.1, 0.16)
			win = 2.6
	# below-horizon sky and haze share the horizon colour, so the far
	# ground melts into the sky instead of ending in a grey band
	sky_mat.ground_horizon_color = sky_mat.sky_horizon_color
	sky_mat.ground_bottom_color = sky_mat.sky_horizon_color
	env.fog_light_color = sky_mat.sky_horizon_color
	if _tod_btn:
		_tod_btn.text = "Waktu: " + TOD_NAMES[tod]
	mat_glass.emission_energy_multiplier = win * 0.8
	mat_lowrise.emission_energy_multiplier = win * 0.8
	mat_landmark.emission_energy_multiplier = win * 0.9


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and e.keycode == KEY_T:
		set_tod((tod + 1) % 3)


# ── organic road network ─────────────────────────────────────────────
## Radial arterials leave the centre on wandering bearings; between each
## pair, wavy ring arcs at varying radii (some sectors skip some rings),
## short lorong connectors and taman cul-de-sacs. No grid anywhere, so
## every sector ends up with its own street pattern.
const RING_DEFS := [
	# radius, keep chance, class
	[55.0, 1.0, 1], [108.0, 0.8, 2], [160.0, 1.0, 0], [212.0, 0.75, 2], [262.0, 0.95, 1],
	[314.0, 0.75, 2], [366.0, 0.9, 1], [418.0, 0.7, 2], [470.0, 0.8, 1],
]
const ROAD_HALF := [7.0, 5.5, 4.0]          # half-width per class
const ROAD_Y := [0.12, 0.11, 0.10]

var layout := "radial"   # see _gen_roads
var radials := 7         # fewer for towns and villages
var ring_keep := 1.0     # scales each ring's keep chance
var _rad_ang := []
var _rad_ph := []
var _arcs := {}         # "ring:sector" -> {R, a0, a1, amp, ph}


func _radial_angle(k: int, r: float) -> float:
	return _rad_ang[k] + 0.16 * sin(r * 0.011 + _rad_ph[k]) + 0.06 * sin(r * 0.027 + _rad_ph[k] * 2.0)


## The seat's real outline as a radius factor per bearing (72 samples, 5°
## apart, mean 1). Every polar placement (arterials, ring roads, estates,
## zone bands) stretches by it, so the built-up area takes the boundary's
## shape instead of a circle; buildings themselves keep their size.
var shape_k := PackedFloat32Array()
## The seat's real boundary in world units (one PackedVector2Array per
## ring, x east / y = world z south), built from the page's normalised
## outline times r_city. Nothing is built outside it except the coast and
## sea: the occupancy raster starts "taken" outside, and roads, river,
## expressway and LRT are clipped to it.
var seat_poly_n := []          # normalised rings from the profile
var seat_poly := []            # in world units, after r_city is known
var coast_dir := Vector2.ZERO  # real sea direction (x east, z south) from the page
## The real land around a coastal seat (every nearby seat's boundary, in
## world units): the sea is everything outside them, so the coast follows
## the true shoreline instead of a straight line.
var land_n := []
var land_rings := []
var landmask := PackedByteArray()   # 1 = land, per occupancy cell
var seatmask := PackedByteArray()   # 1 = inside the seat boundary, per cell
var coast_edge := 1.0          # coastline distance along it, in r_city units

func in_seat(p: Vector3) -> bool:
	if seat_poly.is_empty():
		return true
	if seatmask.size() == GN * GN:
		var ix := int((p.x + EXT) / CELL)
		var iz := int((p.z + EXT) / CELL)
		if ix < 0 or iz < 0 or ix >= GN or iz >= GN:
			return false
		return seatmask[iz * GN + ix] == 1
	var q := Vector2(p.x, p.z)
	for ring in seat_poly:
		if Geometry2D.is_point_in_polygon(q, ring):
			return true
	return false


## Land you can build on: inside the seat and short of the beach (the
## sea and a 32 m strand before it carry no roads, rails or buildings).
func on_land(p: Vector3) -> bool:
	if not in_seat(p):
		return false
	if not land_rings.is_empty():
		# land, and a beach-width away from the water in every direction
		for d in [Vector3.ZERO, Vector3(32, 0, 0), Vector3(-32, 0, 0), Vector3(0, 0, 32), Vector3(0, 0, -32)]:
			if in_sea(p + d):
				return false
		return true
	return sea_dir == Vector3.ZERO or p.dot(sea_dir) < sea_edge - 32.0


## Mark every occupancy cell outside the boundary as taken (scanline fill).
func _mask_outside() -> void:
	# built as images with native rect fills: a per-cell loop over the
	# whole raster (millions of cells) was the slowest step of a build
	landmask = PackedByteArray()
	seatmask = PackedByteArray()
	var land_runs := [] if land_rings.is_empty() else _row_runs(land_rings)
	if not land_runs.is_empty():
		var lm := Image.create(GN, GN, false, Image.FORMAT_L8)
		_fill_runs(lm, land_runs, 1)
		landmask = lm.get_data()
	var img := Image.create(GN, GN, false, Image.FORMAT_L8)
	if seat_poly.is_empty():
		if not land_runs.is_empty():
			# open ground: everything off the land is taken
			img.fill(Color(1.0 / 255.0, 0, 0))
			_fill_runs(img, land_runs, 0)
		occ = img.get_data()
		if land_runs.is_empty():
			_mask_sea_line()
		return
	img.fill(Color(1.0 / 255.0, 0, 0))
	var seat_runs := _row_runs(seat_poly)
	# the seat itself as a raster too: in_seat() is asked for every road,
	# lane and lot point, far too often for a polygon test each time
	var sm := Image.create(GN, GN, false, Image.FORMAT_L8)
	_fill_runs(sm, seat_runs, 1)
	seatmask = sm.get_data()
	if land_runs.is_empty():
		_fill_runs(img, seat_runs, 0)
	else:
		# free only where the seat and the land overlap
		for iz in GN:
			var sr: PackedInt32Array = seat_runs[iz]
			var lr: PackedInt32Array = land_runs[iz]
			if sr.is_empty() or lr.is_empty():
				continue
			for i in range(0, sr.size(), 2):
				for j in range(0, lr.size(), 2):
					var x0 := maxi(sr[i], lr[j])
					var x1 := mini(sr[i + 1], lr[j + 1])
					if x1 > x0:
						img.fill_rect(Rect2i(x0, iz, x1 - x0, 1), Color(0, 0, 0))
	occ = img.get_data()
	if land_runs.is_empty():
		_mask_sea_line()


## Per raster row, the [from, to) cell runs inside each ring (rings taken
## one by one, so overlapping neighbours don't cancel out).
func _row_runs(rings: Array) -> Array:
	var rows := []
	rows.resize(GN)
	for iz in GN:
		rows[iz] = PackedInt32Array()
	for ring in rings:
		var n: int = ring.size()
		var z0 := INF
		var z1 := -INF
		for v in ring:
			z0 = minf(z0, v.y)
			z1 = maxf(z1, v.y)
		var iz0 := clampi(int((z0 + EXT) / CELL), 0, GN - 1)
		var iz1 := clampi(int((z1 + EXT) / CELL) + 1, 0, GN)
		if iz1 <= iz0:
			continue
		# each edge drops its crossing into just the rows it spans
		var xs := []
		xs.resize(iz1 - iz0)
		for i in xs.size():
			xs[i] = PackedFloat32Array()
		for k in n:
			var a: Vector2 = ring[k]
			var b: Vector2 = ring[(k + 1) % n]
			if a.y == b.y:
				continue
			var lo := minf(a.y, b.y)
			var hi := maxf(a.y, b.y)
			# row centres z with lo <= z < hi
			var r0 := maxi(iz0, int(ceil((lo + EXT) / CELL - 0.5)))
			var r1 := mini(iz1 - 1, int(ceil((hi + EXT) / CELL - 0.5)) - 1)
			for iz in range(r0, r1 + 1):
				var z := -EXT + (iz + 0.5) * CELL
				if z < lo or z >= hi:
					continue
				var arr: PackedFloat32Array = xs[iz - iz0]
				arr.append(a.x + (z - a.y) / (b.y - a.y) * (b.x - a.x))
				xs[iz - iz0] = arr
		for li in xs.size():
			var arr: PackedFloat32Array = xs[li]
			if arr.size() < 2:
				continue
			arr.sort()
			var iz := iz0 + li
			var row: PackedInt32Array = rows[iz]
			var k2 := 0
			while k2 + 1 < arr.size():
				var i0 := clampi(int((arr[k2] + EXT) / CELL), 0, GN)
				var i1 := clampi(int((arr[k2 + 1] + EXT) / CELL), 0, GN)
				if i1 > i0:
					row.append(i0)
					row.append(i1)
				k2 += 2
			rows[iz] = row
	return rows


func _fill_runs(img: Image, rows: Array, v: int) -> void:
	var col := Color(float(v) / 255.0, 0, 0)
	for iz in GN:
		var r: PackedInt32Array = rows[iz]
		for i in range(0, r.size(), 2):
			img.fill_rect(Rect2i(r[i], iz, r[i + 1] - r[i], 1), col)


## No real coast: the sea beyond a straight line (and its beach) is taken.
func _mask_sea_line() -> void:
	if sea_dir == Vector3.ZERO:
		return
	var img := Image.create_from_data(GN, GN, false, Image.FORMAT_L8, occ)
	var col := Color(1.0 / 255.0, 0, 0)
	var lim := sea_edge - 32.0
	for iz in GN:
		var z := -EXT + (iz + 0.5) * CELL
		# taken where x * sx + z * sz > lim
		if absf(sea_dir.x) < 1e-6:
			if z * sea_dir.z > lim:
				img.fill_rect(Rect2i(0, iz, GN, 1), col)
			continue
		var xb := (lim - z * sea_dir.z) / sea_dir.x
		var ib := clampi(int(ceil((xb + EXT) / CELL - 0.5)), 0, GN)
		if sea_dir.x > 0.0:
			if ib < GN:
				img.fill_rect(Rect2i(ib, iz, GN - ib, 1), col)
		elif ib > 0:
			img.fill_rect(Rect2i(0, iz, ib, 1), col)
	occ = img.get_data()


## Draw a polyline only where it is inside the seat, as separate runs.
func _inside_runs(pts: PackedVector3Array) -> Array:
	if seat_poly.is_empty():
		return [pts]
	var runs := []
	var cur := PackedVector3Array()
	for p in pts:
		if on_land(p):
			cur.append(p)
		elif cur.size() > 0:
			if cur.size() > 1:
				runs.append(cur)
			cur = PackedVector3Array()
	if cur.size() > 1:
		runs.append(cur)
	return runs
var reach_r := 560.0      # farthest built-up edge (r_city along the longest bearing)
var pan_limit := 605.0    # camera pan bound, from the real city extent

func _shape(a: float) -> float:
	var n := shape_k.size()
	if n == 0:
		return 1.0
	var f := fposmod(a, TAU) / TAU * n
	var i := int(floor(f)) % n
	return lerpf(shape_k[i], shape_k[(i + 1) % n], f - floor(f))


func _polar(r: float, a: float) -> Vector3:
	var k := _shape(a)
	return Vector3(cos(a) * r * k, 0, sin(a) * r * k)


## Polar without the seat outline (local rings, far scenery).
func _polar_raw(r: float, a: float) -> Vector3:
	return Vector3(cos(a) * r, 0, sin(a) * r)


## Distance from the centre in "outline units": 1 * r_city on the boundary
## in every direction.
func _shape_r(p: Vector3) -> float:
	return Vector2(p.x, p.z).length() / _shape(atan2(p.z, p.x))


func _arc_r(arc: Dictionary, a: float) -> float:
	var u := clampf((a - arc.a0) / (arc.a1 - arc.a0), 0.0, 1.0)
	return arc.R * (1.0 + arc.amp * sin(PI * u) * sin(3.0 * a + arc.ph))


## Street layout per seat. Malaysian towns grow in a few recognisable
## ways, and each seat gets one, seeded by its code:
##   radial  - KL-style arterials and ring roads (metropolis, Bukit Bintang)
##   strip   - a pekan strung along one trunk road, lorongs off both sides
##   oldtown - a colonial shophouse grid core with taman estates outside
##   taman   - a ring road and spokes, each sector its own looped estate
# ── road graph ───────────────────────────────────────────────────────
## A road that stops just short of another (a street ending a few metres
## from the next one, a spur running past an arterial) is carried on to
## meet it, so it becomes a T-junction instead of a dead end. Real
## cul-de-sacs (ending far from any road) are left alone.
const SNAP_REACH := 34.0
func _connect_dead_ends() -> void:
	var n0 := roads.size()
	# every other point of every road, bucketed in 40 m cells
	var grid := {}
	for rj in n0:
		var op: PackedVector3Array = roads[rj].pts
		var og: PackedByteArray = roads[rj].gaps
		for k in range(0, op.size(), 2):
			if og[k] == 1:
				continue
			var key := Vector2i(floori(op[k].x / 40.0), floori(op[k].z / 40.0))
			if not grid.has(key):
				grid[key] = []
			(grid[key] as Array).append(Vector2i(rj, k))
	for ri in n0:
		var rd: Dictionary = roads[ri]
		var pts: PackedVector3Array = rd.pts
		var gaps: PackedByteArray = rd.gaps
		if pts.size() < 4:
			continue
		for end in [0, pts.size() - 1]:
			if gaps[end] == 1:
				continue
			var p: Vector3 = pts[end]
			var inward: int = 3 if end == 0 else pts.size() - 4
			var out := (p - pts[inward]).normalized()
			var best := Vector3.ZERO
			var bd := INF
			var bcls := 2
			var c := Vector2i(floori(p.x / 40.0), floori(p.z / 40.0))
			for dx in [-1, 0, 1]:
				for dz in [-1, 0, 1]:
					for e: Vector2i in grid.get(c + Vector2i(dx, dz), []):
						if e.x == ri:
							continue
						var q: Vector3 = (roads[e.x].pts as PackedVector3Array)[e.y]
						var dl := Vector2(q.x - p.x, q.z - p.z).length()
						if dl < bd and dl < SNAP_REACH:
							bd = dl
							best = q
							bcls = int(roads[e.x].cls)
			if bd == INF:
				continue
			var gap: float = bd - float(rd.half)
			# already touching, or the other road is behind this end
			if gap < 3.0 or (best - p).normalized().dot(out) < 0.35:
				continue
			var mid := (p + best) * 0.5
			if not (on_land(mid) and on_land(best)):
				continue
			_make_road([p, mid, best], maxi(int(rd.cls), bcls))


var road_graph := {}   # {nodes: [[x, z, arms]], edges: [[a, b, road, length]]}
var junctions := []    # [Vector3 position, radius] where roads cross or meet

## Junctions where roads meet or cross (segment intersections found
## through a coarse grid), and the graph of road pieces between them.
## The graph is metadata for the simulation side; the junction list also
## keeps lane markings out of the crossing.
func _build_road_graph() -> void:
	junctions = []
	var grid := {}
	const GC := 40.0
	var segs := []   # [road, k, a, b]
	for ri in roads.size():
		var rd: Dictionary = roads[ri]
		var pts: PackedVector3Array = rd.pts
		var gaps: PackedByteArray = rd.gaps
		var k := 0
		while k + 2 < pts.size():
			if gaps[k] == 0:
				var a := Vector2(pts[k].x, pts[k].z)
				var b := Vector2(pts[k + 2].x, pts[k + 2].z)
				var si := segs.size()
				segs.append([ri, k, a, b])
				for key in [Vector2i(floori(a.x / GC), floori(a.y / GC)), Vector2i(floori(b.x / GC), floori(b.y / GC))]:
					if not grid.has(key):
						grid[key] = []
					if not (grid[key] as Array).has(si):
						(grid[key] as Array).append(si)
			k += 2
	# per road: arc positions of its junctions, for the graph edges
	var cuts := {}
	var seen := {}
	for key in grid:
		var lst: Array = grid[key]
		for i in lst.size():
			for j in range(i + 1, lst.size()):
				var A: Array = segs[lst[i]]
				var B: Array = segs[lst[j]]
				if A[0] == B[0]:
					continue
				var hit = Geometry2D.segment_intersects_segment(A[2], A[3], B[2], B[3])
				if hit == null:
					continue
				var hp: Vector2 = hit
				var hk := Vector2i(floori(hp.x / 6.0), floori(hp.y / 6.0))
				if seen.has(hk):
					continue
				seen[hk] = true
				var ra: Dictionary = roads[A[0]]
				var rb: Dictionary = roads[B[0]]
				var rad := maxf(float(ra.half), float(rb.half)) + 2.0
				junctions.append([Vector3(hp.x, 0, hp.y), rad])
				for pr in [[A[0], A[1]], [B[0], B[1]]]:
					if not cuts.has(pr[0]):
						cuts[pr[0]] = []
					(cuts[pr[0]] as Array).append(float((roads[pr[0]].cum as PackedFloat32Array)[pr[1]]))
	# graph: nodes at junctions and road ends, edges along each road
	var nodes := []
	var node_at := {}
	# a node's last field counts the road arms meeting there: a road
	# passing through adds two, a road ending there adds one
	var add_node := func(p: Vector3, arms: int) -> int:
		var key := Vector2i(floori(p.x / 8.0), floori(p.z / 8.0))
		if node_at.has(key):
			nodes[node_at[key]][2] += arms
			return node_at[key]
		node_at[key] = nodes.size()
		nodes.append([snappedf(p.x, 0.1), snappedf(p.z, 0.1), arms])
		return nodes.size() - 1
	var edges := []
	for ri in roads.size():
		var rd: Dictionary = roads[ri]
		var L: float = rd.cum[rd.cum.size() - 1]
		var cs: Array = cuts.get(ri, [])
		cs.sort()
		var stops := [0.0] + cs + [L]
		var prev := -1
		var prev_s := 0.0
		for st in stops:
			var idx: int = add_node.call(road_sample(rd, st)[0], 1 if (st <= 0.0 or st >= L) else 2)
			if prev >= 0 and idx != prev and st - prev_s > 1.0:
				edges.append([prev, idx, ri, snappedf(st - prev_s, 0.1)])
			prev = idx
			prev_s = st
	road_graph = {"nodes": nodes, "edges": edges}


## Fast junction test through a grid built on first use per build.
var _jgrid := {}
var _jgrid_n := -1
func _near_junction(p: Vector3) -> bool:
	if _jgrid_n != junctions.size():
		_jgrid = {}
		_jgrid_n = junctions.size()
		for i in junctions.size():
			var q: Vector3 = junctions[i][0]
			var key := Vector2i(floori(q.x / 30.0), floori(q.z / 30.0))
			if not _jgrid.has(key):
				_jgrid[key] = []
			(_jgrid[key] as Array).append(i)
	var c := Vector2i(floori(p.x / 30.0), floori(p.z / 30.0))
	for dx in [-1, 0, 1]:
		for dz in [-1, 0, 1]:
			for i: int in _jgrid.get(c + Vector2i(dx, dz), []):
				var j: Array = junctions[i]
				if Vector2(p.x - j[0].x, p.z - j[0].z).length() < float(j[1]):
					return true
	return false


## Inside a junction (lane markings stop there)?
func in_junction(p: Vector3) -> bool:
	for j in junctions:
		if Vector2(p.x - j[0].x, p.z - j[0].z).length() < float(j[1]):
			return true
	return false


# ── zoning preset ────────────────────────────────────────────────────
## How the seat is zoned, from its kind of place (tier) and its traits:
## the share of semi-detached among landed houses, whether and how big an
## industrial district it has (an estate for real industrial seats, light
## industry for cities and some towns), oil-palm estates on the rural
## fringe of plantation states. One table, so a new kind of seat is a
## new row rather than a new code path.
const ZONING_BY_TIER := {
	"metro": {"semi_d": 0.3, "industry": "light", "plantation": false},
	"city": {"semi_d": 0.4, "industry": "light", "plantation": false},
	"town": {"semi_d": 0.35, "industry": "maybe", "plantation": true},
	"rural": {"semi_d": 0.1, "industry": "none", "plantation": true},
}
var zoning := {}
var industry_width := 0.0     # half-angle of the industrial sector (rad)
var industry_r0 := 0.0
var industry_r1 := 0.0

func _set_zoning() -> void:
	zoning = (ZONING_BY_TIER.get(tier, ZONING_BY_TIER["town"]) as Dictionary).duplicate()
	var ind := str(zoning.industry)
	if bool(traits.get("industrial", false)):
		ind = "estate"
	elif ind == "maybe":
		ind = "light" if absi(seat_seed) % 2 == 0 else "none"
	if landmarks:
		ind = "none"   # downtown KL: no factory sector
	zoning.industry = ind
	# oil palm is lowland: paddy seats keep their sawah, highland seats
	# (Cameron, Kundasang) aren't palm country
	zoning.plantation = bool(zoning.plantation) and bool(traits.get("plantation", false)) and not bool(traits.get("paddy", false)) and not bool(traits.get("hilly", false))
	industrial_bearing = INF
	if ind == "none":
		return
	# industry sits away from the beach and the tourist coast: on the far
	# side of town from the sea, give or take
	var away := rng.randf() * TAU
	var sea := Vector2(sea_dir.x, sea_dir.z) if sea_dir != Vector3.ZERO else coast_dir
	if sea != Vector2.ZERO:
		away = atan2(-sea.y, -sea.x) + rng.randf_range(-0.6, 0.6)
	industrial_bearing = away
	industry_width = 0.5 if ind == "estate" else 0.28
	industry_r0 = r_commercial * 1.05
	industry_r1 = r_taman * (1.15 if ind == "estate" else 0.95)


## Inside the industrial district (by bearing and distance from centre)?
func in_industry(p: Vector3) -> bool:
	if industrial_bearing == INF:
		return false
	var r := _shape_r(p)
	if r < industry_r0 or r > industry_r1:
		return false
	return absf(angle_difference(atan2(p.z, p.x), industrial_bearing)) < industry_width


## The industrial district's own street grid: wide lorry roads (class 1)
## spaced for big factory and warehouse plots, turned to face the centre.
func _industrial_grid() -> void:
	if industrial_bearing == INF:
		return
	var rm := (industry_r0 + industry_r1) * 0.5
	var c := _polar(rm, industrial_bearing)
	var u := Vector3(c.x, 0, c.z).normalized()       # out from the centre
	var v := Vector3(-u.z, 0, u.x)
	var depth := (industry_r1 - industry_r0) * 0.5
	var half_w := rm * sin(industry_width) * 0.85
	var sp := rng.randf_range(78.0, 92.0)
	# streets across, then a spine and side streets along
	var d := -depth
	while d <= depth:
		_make_road([c + u * d - v * half_w, c + u * d, c + u * d + v * half_w], 1)
		d += sp
	var w := -half_w
	while w <= half_w + 1.0:
		_make_road([c - u * depth + v * w, c + v * w, c + u * depth + v * w], 1 if absf(w) < sp * 0.5 else 2)
		w += sp * 1.6


func _gen_roads() -> void:
	match layout:
		"strip": _gen_strip()
		"oldtown": _gen_oldtown()
		"taman": _gen_taman()
		_: _gen_radial()
	_industrial_grid()
	_connect_dead_ends()
	_build_road_graph()


func _gen_radial() -> void:
	for k in radials:
		_rad_ang.append(deg_to_rad(k * 360.0 / radials + 8.0 + rng.randf_range(-9, 9)))
		_rad_ph.append(rng.randf() * TAU)
	# radials: from the core out across the whole seat
	for k in radials:
		var ctrl := []
		var r := 55.0 * view_scale
		while r <= r_city * 1.2:
			ctrl.append(_polar(r, _radial_angle(k, r)))
			r += 30.0
		_make_road(ctrl, (0 if k % 2 == 0 else 1) if tier in ["metro", "city"] else 1)
	# three ring roads (inner, middle, outer) instead of a ring every block
	var rings := [[r_core * 0.32, 1.0, 1], [r_core, 1.0, 0], [r_taman * 0.85, ring_keep, 1]]
	for ri in rings.size():
		var R: float = rings[ri][0]
		for k in radials:
			if rng.randf() > float(rings[ri][1]):
				continue
			var a0 := _radial_angle(k, R)
			var a1 := _radial_angle((k + 1) % radials, R)
			if a1 <= a0:
				a1 += TAU
			var arc := {"R": R, "a0": a0, "a1": a1, "amp": 0.0 if ri == 0 else rng.randf_range(0.02, 0.05), "ph": rng.randf() * TAU}
			_arcs["%d:%d" % [ri, k]] = arc
			var n := maxi(3, int(ceil((a1 - a0) * R / 24.0)))
			var ctrl := []
			for j in n + 1:
				var a := lerpf(a0, a1, float(j) / n)
				ctrl.append(_polar(_arc_r(arc, a), a))
			var cls: int = rings[ri][2]
			_make_road(ctrl, cls if tier in ["metro", "city"] else maxi(cls, 1))
	# a street grid of city blocks in the centre
	_core_grid(minf(r_core * 0.9, 700.0))
	if tier == "rural":
		return
	# taman estates (street grids) off both sides of every radial
	for k in radials:
		var side := 1.0 if rng.randf() < 0.5 else -1.0
		var r := r_core + rng.randf_range(40.0, 80.0)
		while r < r_taman:
			var p0 := _polar(r, _radial_angle(k, r))
			var tdir := (_polar(r + 5.0, _radial_angle(k, r + 5.0)) - p0).normalized()
			var out := Vector3(-tdir.z, 0, tdir.x) * side
			_taman_loop(p0, out, rng.randf_range(38.0, 62.0) * maxf(view_scale, 0.75))
			side = -side
			r += rng.randf_range(110.0, 160.0)


## A gently bent grid of city blocks, clipped to a circle of radius half
## (the old town or the CBD).
func _core_grid(half: float) -> void:
	var g := rng.randf() * PI
	var b := Basis(Vector3.UP, g)
	var bend := rng.randf_range(4.0, 10.0)
	var xs := [0.0]
	var x := 0.0
	while x < half:
		x += rng.randf_range(48.0, 66.0)
		xs.append(x)
		xs.append(-x)
	var zs := [0.0]
	var z := 0.0
	while z < half:
		z += rng.randf_range(58.0, 80.0)
		zs.append(z)
		zs.append(-z)
	for axis in 2:
		for c in (xs if axis == 0 else zs):
			var h := sqrt(maxf(half * half - c * c, 0.0)) * rng.randf_range(0.8, 1.0)
			if h < 40.0:
				continue
			var pts := []
			var steps := maxi(6, int(h / 40.0))
			for k in steps + 1:
				var u := lerpf(-h, h, float(k) / steps)
				var w: float = c + bend * sin(u * 0.02 + c)
				pts.append(b * (Vector3(w, 0, u) if axis == 0 else Vector3(u, 0, w)))
			_make_road(pts, _trunk_cls() if c == 0.0 else 2)


func _cul_de_sac(from: Vector3, dir: Vector3, length: float) -> void:
	var n := Vector3(-dir.z, 0, dir.x) * rng.randf_range(-0.25, 0.25) * length
	var end := from + dir * length + n
	_make_road([from, from + dir * length * 0.5 + n * 0.4, end], 2)
	if on_land(end):
		_disc(ground_st, end, 7.5, ROAD_Y[2] + 0.001, C_ASPHALT)
	_mark_rect(end, 0.0, 17.0, 17.0)


## Main-street class: a city's trunk roads are dual carriageways.
func _trunk_cls() -> int:
	return 0 if tier in ["metro", "city"] else 1


## Pekan along a trunk road: the spine wanders across the valley, back
## lanes run parallel behind the shop rows, and lorongs leave both sides,
## some joining the back lane, some ending in a taman cul-de-sac.
func _gen_strip() -> void:
	var a := feature_turn + PI * 0.5 + rng.randf_range(-0.5, 0.5)
	var d := Vector3(cos(a), 0, sin(a))
	var n := Vector3(-d.z, 0, d.x)
	var L := r_city * 1.25
	var amp := rng.randf_range(25.0, 60.0) * view_scale
	var f := rng.randf_range(0.004, 0.008) / view_scale
	var ph := rng.randf() * TAU
	var spine := func(t: float) -> Vector3: return d * t + n * (amp * sin(t * f + ph))
	var ctrl := []
	var t := -L
	while t <= L:
		ctrl.append(spine.call(t))
		t += 30.0
	_make_road(ctrl, _trunk_cls())
	# the pekan's shophouse blocks either side of the main road
	if tier != "rural":
		_core_grid(r_core * 0.9)
	# a cross road through the town centre
	var cross := []
	for k in 9:
		var u := lerpf(-r_taman, r_taman, k / 8.0)
		cross.append(n * u + d * (18.0 * sin(u * 0.012 + ph)))
	_make_road(cross, 1)
	# back lanes behind the frontage on each side
	var backs := {}
	for side: float in [-1.0, 1.0]:
		if tier == "rural" and side > 0.0:
			continue
		var off: float = side * rng.randf_range(58.0, 72.0)
		var t0 := -L * rng.randf_range(0.45, 0.7)
		var t1 := L * rng.randf_range(0.45, 0.7)
		backs[side] = [off, t0, t1]
		var bc := []
		t = t0
		while t <= t1:
			bc.append(spine.call(t) + n * off)
			t += 30.0
		_make_road(bc, 2)
	# lorongs off both sides
	t = -L * 0.85
	while t < L * 0.85:
		for side: float in [-1.0, 1.0]:
			if rng.randf() < 0.3:
				continue
			var p0: Vector3 = spine.call(t)
			var b: Array = backs.get(side, [])
			if not b.is_empty() and t > b[1] and t < b[2]:
				var far := rng.randf_range(90.0, 170.0) * (1.0 if tier != "rural" else 0.7)
				_make_road([p0, p0 + n * float(b[0]) * 0.5, p0 + n * float(b[0])], 2)
				if rng.randf() < 0.6:
					_cul_de_sac(p0 + n * side * absf(float(b[0])), n * side, far - absf(float(b[0])))
			else:
				_cul_de_sac(p0, n * side, rng.randf_range(60.0, 140.0))
		t += rng.randf_range(70.0, 115.0) * (1.4 if tier == "rural" else 1.0)


## A colonial-era grid of shophouse blocks in the middle (irregular
## block sizes, gently bent), clipped to a round core; arterials run out
## from it with looped taman estates hanging off them.
func _gen_oldtown() -> void:
	var half := r_commercial * 0.95
	_core_grid(half)
	_gen_arterials_with_estates(rng.randi_range(3, 5), half)


## Ring road around the centre and spokes out to the countryside; every
## sector between spokes is its own looped taman.
func _gen_taman() -> void:
	var R := r_commercial * 0.75
	var ring := []
	var ph := rng.randf() * TAU
	for k in 19:
		var a := TAU * k / 18.0
		ring.append(_polar(R * (1.0 + 0.12 * sin(3.0 * a + ph)), a))
	_make_road(ring, 1)
	# a short shopping street across the middle, and the pekan's grid of
	# shophouse blocks round it
	var a0 := rng.randf() * PI
	_make_road([_polar(R, a0), Vector3.ZERO, _polar(R, a0 + PI)], 1)
	if tier != "rural":
		_core_grid(r_core * 0.95)
	_gen_arterials_with_estates(rng.randi_range(4, 6), R)


func _gen_arterials_with_estates(count: int, start_r: float) -> void:
	var base := rng.randf() * TAU
	for k in count:
		var a := base + TAU * k / count + rng.randf_range(-0.25, 0.25)
		var wig := rng.randf_range(0.1, 0.25)
		var ph := rng.randf() * TAU
		var spoke := func(r: float) -> Vector3: return _polar(r, a + wig * sin(r * 0.008 + ph))
		var ctrl := []
		var r := start_r
		while r <= r_city * 1.2:
			ctrl.append(spoke.call(r))
			r += 30.0
		_make_road(ctrl, _trunk_cls() if k % 2 == 0 else 1)
		# looped estates on alternating sides along the arterial
		var side := 1.0 if rng.randf() < 0.5 else -1.0
		r = start_r + rng.randf_range(40.0, 70.0)
		while r < r_taman:
			var p0: Vector3 = spoke.call(r)
			var tdir: Vector3 = (spoke.call(r + 5.0) - p0).normalized()
			var out := Vector3(-tdir.z, 0, tdir.x) * side
			_taman_loop(p0, out, rng.randf_range(38.0, 62.0) * maxf(view_scale, 0.75))
			side = -side
			r += rng.randf_range(110.0, 160.0)


## One taman, laid out the Malaysian way: an entrance road off the
## arterial, parallel streets (Jalan Taman 1, 2, 3...) across it spaced for
## two back-to-back terrace rows, and side streets closing the grid into
## blocks. R sets the estate's size.
func _taman_loop(gate: Vector3, out: Vector3, R: float) -> void:
	var u := out.normalized()
	var v := Vector3(-u.z, 0, u.x)
	# a slight skew so neighbouring estates don't line up exactly
	var tw := rng.randf_range(-0.12, 0.12)
	u = (u + v * tw).normalized()
	v = Vector3(-u.z, 0, u.x)
	var depth := R * rng.randf_range(2.4, 3.2)
	var half_w := R * rng.randf_range(0.9, 1.3)
	var start := 30.0
	var spacing := rng.randf_range(42.0, 50.0)
	_make_road([gate, gate + u * start, gate + u * (start + depth)], 2)
	var rows := []
	var d := start + spacing * 0.6
	while d <= start + depth:
		# streets differ a little in length, so the block edge isn't ruled
		var l0 := half_w * rng.randf_range(0.75, 1.0)
		var l1 := half_w * rng.randf_range(0.75, 1.0)
		var c := gate + u * d
		_make_road([c - v * l0, c, c + v * l1], 2)
		rows.append([c, l0, l1])
		d += spacing
	if rows.size() < 2:
		return
	# side streets join the ends of each pair of rows into blocks; one
	# side is sometimes left open (dead ends onto the next field)
	for sgn: float in [-1.0, 1.0]:
		if rng.randf() < 0.25:
			continue
		var line := []
		for r in rows:
			var l: float = r[1] if sgn < 0.0 else r[2]
			line.append((r[0] as Vector3) + v * sgn * minf(l, half_w * 0.75))
		_make_road(line, 2)


func _make_road(ctrl: Array, cls: int) -> void:
	var c := _smooth_curve(ctrl)
	var pts := c.get_baked_points()
	if pts.size() < 2:
		return
	var cum := PackedFloat32Array()
	cum.resize(pts.size())
	cum[0] = 0.0
	for i in range(1, pts.size()):
		cum[i] = cum[i - 1] + pts[i].distance_to(pts[i - 1])
	# over the river: a short run is a crossing and stays as a bridge; a
	# long run (the road runs along the river) is moved onto the bank it
	# is on, so the road keeps going as a riverside road instead of being
	# cut into dead ends. Where it changes bank, the step between is a
	# bridge.
	var half_w: float = ROAD_HALF[cls]
	var wet := PackedByteArray()
	wet.resize(pts.size())
	for k in pts.size():
		wet[k] = 1 if _river_dist(pts[k]) < RIVER_HALF + 3.0 else 0
	var i := 0
	var moved := false
	while i < pts.size():
		if wet[i] == 0:
			i += 1
			continue
		var e := i
		while e < pts.size() and wet[e] == 1:
			e += 1
		if e - i > 12:
			# ease in/out of the bank over a few points either side
			var lo := maxi(0, i - 4)
			var hi := mini(pts.size(), e + 4)
			for k in range(lo, hi):
				var nt := _river_near(pts[k])
				var q: Vector3 = nt[0]
				var tan: Vector3 = nt[1]
				var off := Vector3(pts[k].x - q.x, 0, pts[k].z - q.z)
				var side := signf(tan.cross(off).y)
				if side == 0.0:
					side = 1.0
				var normal := Vector3(-tan.z, 0, tan.x) * -side
				var want := RIVER_HALF + half_w + 6.0
				var d := off.length()
				if d < want:
					var w := 1.0
					if k < i:
						w = float(k - lo + 1) / float(i - lo + 1)
					elif k >= e:
						w = float(hi - k) / float(hi - e + 1)
					var target := Vector3(q.x, pts[k].y, q.z) + normal * want
					pts[k] = pts[k].lerp(target, w)
			moved = true
		i = e
	if moved:
		for k in range(1, pts.size()):
			cum[k] = cum[k - 1] + pts[k].distance_to(pts[k - 1])
		for k in pts.size():
			wet[k] = 1 if _river_dist(pts[k]) < RIVER_HALF + 3.0 else 0
	var gaps := PackedByteArray()
	gaps.resize(pts.size())
	# outside the seat boundary the road is not drawn (and cars hide there)
	for k in pts.size():
		if not on_land(pts[k]):
			gaps[k] = 1
	# a scrap of road left between gaps (or a gap and an end) shorter than
	# a short block leads nowhere: drop it too
	var k0 := 0
	while k0 < pts.size():
		if gaps[k0] == 1:
			k0 += 1
			continue
		var k1 := k0
		while k1 < pts.size() and gaps[k1] == 0:
			k1 += 1
		var cut := k0 > 0 or k1 < pts.size()
		if cut and cum[k1 - 1] - cum[k0] < 45.0:
			for k in range(k0, k1):
				gaps[k] = 1
		k0 = k1
	var rd := {"pts": pts, "cum": cum, "cls": cls, "half": ROAD_HALF[cls], "wet": wet, "gaps": gaps, "elev": _bridge_profile(cum, wet)}
	roads.append(rd)
	_mark_road(rd, ROAD_HALF[cls] + (2.6 if cls < 2 else 1.6))


## Height of the deck along a road: up to BRIDGE_H over the river, with
## ramps of BRIDGE_RAMP either side. Empty when the road crosses no water.
const BRIDGE_H := 3.4
const BRIDGE_RAMP := 34.0
func _bridge_profile(cum: PackedFloat32Array, wet: PackedByteArray) -> PackedFloat32Array:
	var n := cum.size()
	var out := PackedFloat32Array()
	if wet.find(1) < 0:
		return out
	out.resize(n)
	var last := -INF
	var dist := PackedFloat32Array()
	dist.resize(n)
	for k in n:
		if wet[k] == 1:
			last = cum[k]
		dist[k] = cum[k] - last
	last = INF
	for k in range(n - 1, -1, -1):
		if wet[k] == 1:
			last = cum[k]
		dist[k] = minf(dist[k], last - cum[k])
	for k in n:
		var f := clampf(1.0 - dist[k] / BRIDGE_RAMP, 0.0, 1.0)
		out[k] = BRIDGE_H * f * f * (3.0 - 2.0 * f)
	return out


## Deck height at arc length s (0 off any bridge).
func road_elev(rd: Dictionary, s: float) -> float:
	var e: PackedFloat32Array = rd.get("elev", PackedFloat32Array())
	if e.is_empty():
		return 0.0
	var cum: PackedFloat32Array = rd.cum
	s = clampf(s, 0.0, cum[cum.size() - 1])
	var i := clampi(cum.bsearch(s) - 1, 0, cum.size() - 2)
	var seg := cum[i + 1] - cum[i]
	var f := 0.0 if seg <= 0.0 else (s - cum[i]) / seg
	return lerpf(e[i], e[i + 1], f)


## Point and unit tangent at arc length s along a road, plus segment index.
func road_sample(rd: Dictionary, s: float) -> Array:
	var pts: PackedVector3Array = rd.pts
	var cum: PackedFloat32Array = rd.cum
	s = clampf(s, 0.0, cum[cum.size() - 1])
	var i := clampi(cum.bsearch(s) - 1, 0, pts.size() - 2)
	var seg := cum[i + 1] - cum[i]
	var f := 0.0 if seg <= 0.0 else (s - cum[i]) / seg
	return [pts[i].lerp(pts[i + 1], f), (pts[i + 1] - pts[i]).normalized(), i]


func _draw_roads() -> void:
	for rd in roads:
		var cls: int = rd.cls
		var half: float = rd.half
		var pts: PackedVector3Array = rd.pts
		var gaps: PackedByteArray = rd.gaps
		var elev: PackedFloat32Array = rd.get("elev", PackedFloat32Array())
		var walk := half + (2.6 if cls < 2 else 1.6)
		# pavement under, carriageway over, piece by piece so gaps can drop out
		for i in pts.size() - 1:
			if gaps[i] == 1:
				continue
			var seg := PackedVector3Array([pts[maxi(i - 1, 0)], pts[i], pts[i + 1], pts[mini(i + 2, pts.size() - 1)]])
			var ea: float = 0.0 if elev.is_empty() else elev[i]
			var eb: float = 0.0 if elev.is_empty() else elev[i + 1]
			if ea <= 0.0 and eb <= 0.0:
				_ribbon_piece(ground_st, seg, 1, walk, 0.06, C_CONCRETE)
				_ribbon_piece(ground_st, seg, 1, half, ROAD_Y[cls], C_ASPHALT)
				continue
			# a bridge: the deck rises over the water on ramps, with a
			# concrete edge beam, parapets and piers down into the river
			_ribbon_piece_h(ground_st, seg, walk, 0.06 + ea, 0.06 + eb, C_CONCRETE)
			_ribbon_piece_h(ground_st, seg, half, ROAD_Y[cls] + ea, ROAD_Y[cls] + eb, C_ASPHALT)
			var t := (pts[i + 1] - pts[i]).normalized()
			var n := Vector3(-t.z, 0, t.x)
			var yaw := atan2(-t.z, t.x)
			var mid := (pts[i] + pts[i + 1]) * 0.5
			var e := (ea + eb) * 0.5
			var len := pts[i].distance_to(pts[i + 1]) + 0.2
			for s in [-1.0, 1.0]:
				box(mid + n * s * (walk - 0.2) + Vector3(0, e - 0.6, 0), Vector3(len, 0.6, 0.4), C_CONCRETE.darkened(0.12), null, yaw)
				if e > 0.8:
					box(mid + n * s * (walk - 0.2) + Vector3(0, e + 0.05, 0), Vector3(len, 1.0, 0.3), C_CONCRETE, null, yaw)
			if rd.wet[i] == 1 and i % 4 == 0:
				for s in [-0.5, 0.5]:
					cyl(mid + n * s * half, 0.7, e - 0.5, Color(0.62, 0.62, 0.6))
		if cls == 2:
			continue
		# centre line (yellow) and, on arterials, white lane dashes
		var L: float = rd.cum[rd.cum.size() - 1]
		var s := 8.0
		while s < L - 8.0:
			var sm := road_sample(rd, s)
			if gaps[sm[2]] == 0 and not _near_junction(sm[0]):
				var p: Vector3 = sm[0]
				var t: Vector3 = sm[1]
				var yaw := atan2(-t.z, t.x)
				var n := Vector3(-t.z, 0, t.x)
				var de := road_elev(rd, s)
				box(p + Vector3(0, ROAD_Y[cls] + de, 0), Vector3(3.0, 0.03, 0.22), Color(0.95, 0.78, 0.2), null, yaw)
				if cls == 0:
					for o in [-half * 0.5, half * 0.5]:
						box(p + n * o + Vector3(0, ROAD_Y[cls] + de, 0), Vector3(3.0, 0.03, 0.18), Color(0.92, 0.92, 0.88), null, yaw)
			s += 7.0


## A ribbon quad whose two ends stand at their own heights (bridge decks).
func _ribbon_piece_h(st: SurfaceTool, seg: PackedVector3Array, half: float, ya: float, yb: float, col: Color) -> void:
	var ta := (seg[2] - seg[0]).normalized()
	var tb := (seg[3] - seg[1]).normalized()
	var na := Vector3(-ta.z, 0, ta.x) * half
	var nb := Vector3(-tb.z, 0, tb.x) * half
	var a := Vector3(seg[1].x, ya, seg[1].z)
	var b := Vector3(seg[2].x, yb, seg[2].z)
	_quad(st, a - na, a + na, b + nb, b - nb, col, Vector3.UP)


## One quad of a ribbon: `seg` holds [prev, a, b, next] so the joint
## normals match the neighbouring pieces.
func _ribbon_piece(st: SurfaceTool, seg: PackedVector3Array, _unused: int, half: float, y: float, col: Color) -> void:
	var ta := (seg[2] - seg[0]).normalized()
	var tb := (seg[3] - seg[1]).normalized()
	var na := Vector3(-ta.z, 0, ta.x) * half
	var nb := Vector3(-tb.z, 0, tb.x) * half
	var a := Vector3(seg[1].x, y, seg[1].z)
	var b := Vector3(seg[2].x, y, seg[2].z)
	_quad(st, a - na, a + na, b + nb, b - nb, col, Vector3.UP)


## The paved downtown: not a perfect circle but the city's own outline
## (stretched like everything else) at radius r, cut to the seat boundary.
func _paving(r: float) -> void:
	var ring := PackedVector2Array()
	for i in 72:
		var p := _polar(r, TAU * i / 72.0)
		ring.append(Vector2(p.x, p.z))
	var parts := [ring]
	if not seat_poly.is_empty():
		parts = []
		for sp in seat_poly:
			for piece in Geometry2D.intersect_polygons(ring, sp):
				parts.append(piece)
	for poly in parts:
		var tris := Geometry2D.triangulate_polygon(poly)
		ground_st.set_color(C_PAVING)
		ground_st.set_normal(Vector3.UP)
		for k in range(0, tris.size(), 3):
			# both windings: the ground material may cull back faces
			for m in [0, 1, 2, 0, 2, 1]:
				var v: Vector2 = poly[tris[k + m]]
				ground_st.add_vertex(Vector3(v.x, 0.015, v.y))


func _disc(st: SurfaceTool, c: Vector3, r: float, y: float, col: Color) -> void:
	st.set_color(col)
	st.set_normal(Vector3.UP)
	for i in 16:
		var a0 := TAU * i / 16.0
		var a1 := TAU * (i + 1) / 16.0
		st.add_vertex(Vector3(c.x, y, c.z))
		st.add_vertex(Vector3(c.x + cos(a0) * r, y, c.z + sin(a0) * r))
		st.add_vertex(Vector3(c.x + cos(a1) * r, y, c.z + sin(a1) * r))


# ── occupancy map ────────────────────────────────────────────────────
## A coarse raster of everything already claimed (roads, river, highway,
## buildings) so new buildings and trees never land on top of anything.
func _cell(p: Vector3) -> int:
	var ix := int((p.x + EXT) / CELL)
	var iz := int((p.z + EXT) / CELL)
	if ix < 0 or iz < 0 or ix >= GN or iz >= GN:
		return -1
	return iz * GN + ix


func _mark_road(rd: Dictionary, half: float) -> void:
	_mark_polyline(rd.pts, half, rd.gaps)


func _mark_polyline(pts: PackedVector3Array, half: float, gaps := PackedByteArray()) -> void:
	for i in pts.size() - 1:
		if not gaps.is_empty() and gaps[i] == 1:
			continue
		var a := pts[i]
		var b := pts[i + 1]
		var t := (b - a)
		var L := t.length()
		if L <= 0.0:
			continue
		t /= L
		var n := Vector3(-t.z, 0, t.x)
		var u := 0.0
		while u <= L:
			var v := -half
			while v <= half:
				var ci := _cell(a + t * u + n * v)
				if ci >= 0:
					occ[ci] = 1
				v += 1.5
			u += 1.5


func _rect_points(c: Vector3, yaw: float, w: float, d: float) -> Array:
	var out := []
	var b := Basis(Vector3.UP, yaw)
	var u := -w * 0.5
	while u <= w * 0.5 + 0.01:
		var v := -d * 0.5
		while v <= d * 0.5 + 0.01:
			out.append(c + b * Vector3(u, 0, v))
			v += 2.0
		u += 2.0
	return out


const RECT_STEP := CELL * 0.9   # under a cell, so no cell is skipped

## Scan the cells under a w x d rectangle at c turned by yaw, without
## building a point list. mode 0: free of anything; 1: free of all but
## trees; 2: mark taken. Returns false as soon as a check fails.
func _rect_scan(c: Vector3, yaw: float, w: float, d: float, mode: int) -> bool:
	var cy := cos(yaw)
	var sy := sin(yaw)
	# basis(UP, yaw) * (u, 0, v) = (u cos + v sin, 0, -u sin + v cos)
	var nu := maxi(1, int(ceil(w / RECT_STEP)))
	var nv := maxi(1, int(ceil(d / RECT_STEP)))
	for iu in nu + 1:
		var u := -w * 0.5 + w * float(iu) / float(nu)
		for iv in nv + 1:
			var v := -d * 0.5 + d * float(iv) / float(nv)
			var px := c.x + u * cy + v * sy
			var pz := c.z - u * sy + v * cy
			var ix := int((px + EXT) / CELL)
			var iz := int((pz + EXT) / CELL)
			if ix < 0 or iz < 0 or ix >= GN or iz >= GN:
				if mode == 2:
					continue
				return false
			var ci := iz * GN + ix
			if mode == 2:
				occ[ci] = 1
			elif occ[ci] == 1 or (mode == 0 and occ[ci] != 0):
				return false
	return true


func _rect_free(c: Vector3, yaw: float, w: float, d: float) -> bool:
	if in_sea(c):
		return false
	# probe slightly inside the footprint: the 2 m raster would otherwise
	# reject every lot whose edge merely touches a pavement cell
	return _rect_scan(c, yaw, maxf(w - 2.0, 1.0), maxf(d - 2.0, 1.0), 0)


## Open land the player can build on: inside the seat, off the sea, and
## free of roads, buildings and lots (trees are cleared for the site).
func land_free(c: Vector3, w: float, d: float) -> bool:
	if not on_land(c) or in_sea(c):
		return false
	for p in _rect_points(c, 0.0, w, d):
		var ci := _cell(p)
		if ci < 0 or occ[ci] == 1:
			return false
	return true


## An access road for a new site at c: a straight lane from the site's
## edge to the nearest road point it can reach without crossing buildings,
## lots, the river or the boundary. Returns [from, to] or [] if none.
func access_road(c: Vector3) -> Array:
	var cands := []
	for rd in roads:
		var pts: PackedVector3Array = rd.pts
		var gaps: PackedByteArray = rd.gaps
		for k in range(0, pts.size(), 2):
			if gaps[k] == 1:
				continue
			var d := Vector2(pts[k].x - c.x, pts[k].z - c.z).length()
			if d > 20.0 and d < 240.0:
				cands.append([d, pts[k], float(rd.half)])
	cands.sort_custom(func(x, y): return x[0] < y[0])
	for k in mini(cands.size(), 60):
		var q: Vector3 = cands[k][1]
		var half: float = cands[k][2]
		var dir := Vector3(q.x - c.x, 0, q.z - c.z).normalized()
		var from := c + dir * 15.5
		# stop short of the road's own kerb and pavement (marked half + 2.6)
		var stop := Vector2(q.x - from.x, q.z - from.z).length() - (half + 4.5)
		var ok := stop > 0.0
		var s := 0.0
		while ok and s < stop:
			var p := from + dir * s
			var side := Vector3(-dir.z, 0, dir.x) * 3.0
			for e in [p, p + side, p - side]:
				var ci := _cell(e)
				if ci < 0 or occ[ci] == 1 or not on_land(e):
					ok = false
					break
			s += 2.0
		if ok:
			return [from, Vector3(q.x, 0, q.z)]
	return []


## Claim a founded site and its access road in the occupancy map, so the
## next site can't overlap them.
func claim_site(c: Vector3, road: Array) -> void:
	_mark_rect(c, 0.0, 32.0, 32.0)
	if road.size() == 2:
		_mark_polyline(PackedVector3Array([road[0], road[1]]), 6.0)


## Clear the trees standing on a new building site.
func clear_trees(c: Vector3, radius: float) -> void:
	var meshes := [tree_palm_mesh, tree_broadleaf_mesh]
	for node in gen.get_children():
		if not (node is MultiMeshInstance3D):
			continue
		var mm: MultiMesh = (node as MultiMeshInstance3D).multimesh
		if mm == null or not (mm.mesh in meshes):
			continue
		for i in mm.instance_count:
			var xf := mm.get_instance_transform(i)
			# chunks stand at their own centre: instance origins are local
			var wo: Vector3 = (node as Node3D).position + xf.origin
			if Vector2(wo.x - c.x, wo.z - c.z).length() < radius:
				mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3.ONE * 0.001), xf.origin + Vector3(0, -50, 0)))


## Like _rect_free, but a tree in the way may be cleared.
func _rect_free_soft(c: Vector3, yaw: float, w: float, d: float) -> bool:
	if in_sea(c):
		return false
	return _rect_scan(c, yaw, maxf(w - 2.0, 1.0), maxf(d - 2.0, 1.0), 1)


func _mark_rect(c: Vector3, yaw: float, w: float, d: float) -> void:
	_rect_scan(c, yaw, w + 1.0, d + 1.0, 2)


# ── river & expressway ───────────────────────────────────────────────
## Control points turned by the seat's `feature_turn` and drawn in toward
## smaller towns, so every constituency gets its own river and road.
func _turn(pts: Array) -> Array:
	var b := Basis(Vector3.UP, feature_turn)
	var k := lerpf(1.0, view_scale, 0.6)
	var out := []
	for v in pts:
		out.append(b * (v * k))
	return out


## Continue a curve straight out past both ends until each end is at
## least `reach` from the centre (adds smooth extra control points).
func _extend_curve(c: Curve3D, reach: float) -> Curve3D:
	var pts := []
	for i in c.point_count:
		pts.append(c.get_point_position(i))
	if pts.size() < 2:
		return c
	for end in [0, 1]:
		var a: Vector3 = pts[0] if end == 0 else pts[pts.size() - 1]
		var b: Vector3 = pts[1] if end == 0 else pts[pts.size() - 2]
		var dir := (a - b).normalized()
		var p := a
		var guard := 0
		while Vector2(p.x, p.z).length() < reach and guard < 40:
			p += dir * 160.0
			guard += 1
			if end == 0:
				pts.push_front(p)
			else:
				pts.append(p)
	return _smooth_curve(pts)


## Chaikin corner cutting: each pass replaces every corner of a closed
## ring by two points a quarter of the way along its edges.
func _chaikin(ring: PackedVector2Array) -> PackedVector2Array:
	var n := ring.size()
	if n < 3:
		return ring
	var out := PackedVector2Array()
	for k in n:
		var a: Vector2 = ring[k]
		var b: Vector2 = ring[(k + 1) % n]
		out.append(a.lerp(b, 0.25))
		out.append(a.lerp(b, 0.75))
	return out


## Sand along every stretch of land edge that faces open water, as one
## continuous strip per stretch: each vertex is offset along the average
## of its two edge normals (a mitred join), so curves stay an even width
## with no gaps or overlaps at the corners. Palms on it inside the seat.
func _build_shore() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var shallows := SurfaceTool.new()
	shallows.begin(Mesh.PRIMITIVE_TRIANGLES)
	shallows.set_normal(Vector3.UP)
	st.set_color(Color(0.86, 0.8, 0.62))
	const IN := 26.0
	const OUT := 3.0
	for ring in land_rings:
		var n: int = ring.size()
		if n < 3:
			continue
		# which way is the water from this ring (sign of the left normal)?
		var area := 0.0
		for k in n:
			area += ring[k].x * ring[(k + 1) % n].y - ring[(k + 1) % n].x * ring[k].y
		var sea_side := -1.0 if area > 0.0 else 1.0   # outward normal side
		var wet := PackedByteArray()
		wet.resize(n)
		var nrm := PackedVector2Array()
		nrm.resize(n)
		for k in n:
			var a: Vector2 = ring[k]
			var b: Vector2 = ring[(k + 1) % n]
			var t := (b - a).normalized()
			var e := Vector2(-t.y, t.x) * sea_side
			nrm[k] = e
			var m := (a + b) * 0.5
			var probe := Vector3(m.x + e.x * 12.0, 0, m.y + e.y * 12.0)
			# beyond the raster the coast is far past the fog: no beach drawn
			wet[k] = 1 if _cell(probe) >= 0 and in_sea(probe) else 0
		var y := 0.03
		for k in n:
			if wet[k] == 0:
				continue
			var a: Vector2 = ring[k]
			var b: Vector2 = ring[(k + 1) % n]
			var na := (nrm[k] + nrm[(k - 1 + n) % n]).normalized() if wet[(k - 1 + n) % n] == 1 else nrm[k]
			var nb := (nrm[k] + nrm[(k + 1) % n]).normalized() if wet[(k + 1) % n] == 1 else nrm[k]
			var ka := 1.0 / maxf(0.5, na.dot(nrm[k]))
			var kb := 1.0 / maxf(0.5, nb.dot(nrm[k]))
			var A := Vector3(a.x + na.x * OUT * ka, y, a.y + na.y * OUT * ka)
			var B := Vector3(b.x + nb.x * OUT * kb, y, b.y + nb.y * OUT * kb)
			var C := Vector3(b.x - nb.x * IN * kb, y, b.y - nb.y * IN * kb)
			var D := Vector3(a.x - na.x * IN * ka, y, a.y - na.y * IN * ka)
			for v in [A, B, C, A, C, D, A, C, B, A, D, C]:
				st.add_vertex(v)
			# shallows: turquoise fading out to open water over ~60 m
			var A2 := Vector3(a.x + na.x * (OUT + 60.0) * ka, -0.3, a.y + na.y * (OUT + 60.0) * ka)
			var B2 := Vector3(b.x + nb.x * (OUT + 60.0) * kb, -0.3, b.y + nb.y * (OUT + 60.0) * kb)
			var A1 := Vector3(A.x, -0.3, A.z)
			var B1 := Vector3(B.x, -0.3, B.z)
			var cin := Color(0.42, 0.82, 0.8, 0.85)
			var cout := Color(0.3, 0.72, 0.78, 0.0)
			for pr in [[A1, cin], [B1, cin], [B2, cout], [A1, cin], [B2, cout], [A2, cout]]:
				shallows.set_color(pr[1])
				shallows.add_vertex(pr[0])
			if rng.randf() < 0.08:
				var m := (a + b) * 0.5 - nrm[k] * 30.0
				var tp := Vector3(m.x, 0, m.y)
				if in_seat(tp) and not in_sea(tp):
					tree(tp, true)
	var sand := StandardMaterial3D.new()
	sand.vertex_color_use_as_albedo = true
	sand.roughness = 1.0
	_single(st.commit(), sand, Transform3D.IDENTITY)
	var shm := StandardMaterial3D.new()
	shm.vertex_color_use_as_albedo = true
	shm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shm.cull_mode = BaseMaterial3D.CULL_DISABLED
	shm.roughness = 0.15
	shm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_single(shallows.commit(), shm, Transform3D.IDENTITY)


func in_sea(p: Vector3) -> bool:
	if not land_rings.is_empty():
		var ci := _cell(p)
		if ci >= 0 and landmask.size() == GN * GN:
			return landmask[ci] == 0
		var q := Vector2(p.x, p.z)
		for ring in land_rings:
			if Geometry2D.is_point_in_polygon(q, ring):
				return false
		return true
	return sea_dir != Vector3.ZERO and p.dot(sea_dir) > sea_edge


func _build_features() -> void:
	var river := _smooth_curve(_turn([
		Vector3(-640, 0, 150), Vector3(-470, 0, 260), Vector3(-300, 0, 225), Vector3(-150, 0, 330),
		Vector3(10, 0, 380), Vector3(170, 0, 320), Vector3(320, 0, 400), Vector3(640, 0, 330),
	]))
	highway_curve = _smooth_curve(_turn([
		Vector3(-300, 0, -640), Vector3(-130, 0, -400), Vector3(80, 0, -230), Vector3(200, 0, -70),
		Vector3(215, 0, 85), Vector3(160, 0, 230), Vector3(210, 0, 420), Vector3(360, 0, 640),
	]))
	# the city is drawn at its real size and outline now, so the river and
	# expressway must run right through it and out the other side
	river = _extend_curve(river, reach_r * 1.4)
	highway_curve = _extend_curve(highway_curve, reach_r * 1.4)
	# coarse polylines (16 m) for distance checks, fine ones (4 m) to draw
	river.bake_interval = 16.0
	highway_curve.bake_interval = 16.0
	river_pts = river.get_baked_points()
	highway_pts = highway_curve.get_baked_points()
	river.bake_interval = 4.0
	highway_curve.bake_interval = 4.0
	var river_fine := river.get_baked_points()
	var highway_fine := highway_curve.get_baked_points()

	var wst := SurfaceTool.new()
	wst.begin(Mesh.PRIMITIVE_TRIANGLES)
	for run in _inside_runs(river_fine):
		_ribbon(wst, run, RIVER_HALF, 0.03, Color.WHITE)
	var wmi := MeshInstance3D.new()
	wmi.mesh = wst.commit()
	wmi.material_override = mat_water
	gen.add_child(wmi)
	for run in _inside_runs(river_fine):
		_ribbon(ground_st, run, RIVER_HALF + 5.0, 0.02, Color(0.5, 0.46, 0.33))
	_mark_polyline(river_fine, RIVER_HALF + 6.0)

	# coastal seats: open sea beyond a beach on one side
	if not land_rings.is_empty():
		_build_shore()
	elif sea_dir != Vector3.ZERO:
		var yaw := atan2(-sea_dir.z, sea_dir.x)
		var edge := sea_edge
		box(sea_dir * (edge + 4000.0) + Vector3(0, 0.0, 0), Vector3(8000, 0.06, 8000), Color.WHITE, mat_water, yaw)
		box(sea_dir * (edge - 14.0), Vector3(30, 0.05, 8000), Color(0.86, 0.8, 0.62), null, yaw)
		for i in 40:
			var along := Vector3(-sea_dir.z, 0, sea_dir.x) * rng.randf_range(-700, 700)
			var tp := sea_dir * (edge - rng.randf_range(24, 40)) + along
			if on_land(tp):
				tree(tp, true)

	if not has_highway:
		highway_pts = PackedVector3Array()
		return

	# expressway: kerbed carriageway, central median with lamps, lane dashes
	for run in _inside_runs(highway_fine):
		_ribbon(ground_st, run, HIGHWAY_HALF + 1.2, 0.26, C_CONCRETE)
		_ribbon(ground_st, run, HIGHWAY_HALF, 0.3, Color(0.2, 0.21, 0.22))
		_ribbon(ground_st, run, 0.8, 0.45, Color(0.78, 0.77, 0.74))
	_mark_polyline(highway_fine, HIGHWAY_HALF + 4.0)
	var length := highway_curve.get_baked_length()
	var o := 0.0
	while o < length:
		var p := highway_curve.sample_baked(o)
		var t := (highway_curve.sample_baked(minf(o + 1.0, length)) - p).normalized()
		var yaw := atan2(-t.z, t.x)
		var n := Vector3(-t.z, 0, t.x)
		for off in [-5.5, 5.5]:
			box(p + n * off + Vector3(0, 0.3, 0), Vector3(3.0, 0.03, 0.2), Color(0.92, 0.92, 0.88), null, yaw)
		if fmod(o, 48.0) < 12.0:
			cyl(p + Vector3(0, 0.45, 0), 0.15, 9.0, Color(0.7, 0.72, 0.74))
			box(p + Vector3(0, 9.4, 0) + n * 1.2, Vector3(0.4, 0.25, 2.6), Color(0.95, 0.93, 0.8), null, yaw)
		o += 12.0


# ── LRT ──────────────────────────────────────────────────────────────
## Two elevated lines on pillars crossing the city either side of the
## core, with stations along them. The corridor is reserved before the
## buildings go in, so nothing stands under the guideway.
func _build_lrt() -> void:
	var lines := [
		[Vector3(-640, 0, -330), Vector3(-420, 0, -250), Vector3(-230, 0, -180), Vector3(-100, 0, -110),
			Vector3(10, 0, -85), Vector3(140, 0, -150), Vector3(300, 0, -300), Vector3(460, 0, -520)],
		[Vector3(620, 0, 120), Vector3(400, 0, 60), Vector3(230, 0, 40), Vector3(95, 0, 70),
			Vector3(-20, 0, 95), Vector3(-160, 0, 170), Vector3(-330, 0, 330), Vector3(-520, 0, 470)],
	]
	var concrete := Color(0.8, 0.79, 0.76)
	for ctrl in lines:
		var c := _smooth_curve(_turn(ctrl))
		c.bake_interval = 8.0
		var pts := c.get_baked_points()
		lrt_curves.append(c)
		for i in pts.size() - 1:
			var a := pts[i]
			var b := pts[i + 1]
			var L := a.distance_to(b)
			var t := (b - a) / L
			var yaw := atan2(-t.z, t.x)
			var n := Vector3(-t.z, 0, t.x)
			var mid := (a + b) * 0.5
			if not on_land(mid):
				continue
			box(mid + Vector3(0, LRT_Y, 0), Vector3(L + 0.3, 1.3, 6.0), concrete, null, yaw)
			for sd in [-1.0, 1.0]:
				box(mid + n * sd * 2.9 + Vector3(0, LRT_Y + 1.3, 0), Vector3(L + 0.3, 0.8, 0.2), concrete, null, yaw)
			# a pillar every ~24 m, skipped where it would stand in a street
			if i % 3 == 0:
				var ci := _cell(a)
				if ci < 0 or occ[ci] == 0:
					cyl(a, 1.0, LRT_Y, concrete)
					box(a + Vector3(0, LRT_Y - 1.0, 0), Vector3(2.4, 1.0, 6.4), concrete, null, yaw)
		var length := c.get_baked_length()
		var s := 150.0
		while s < length - 60.0:
			var p := c.sample_baked(s)
			if _shape_r(p) < r_taman and on_land(p):
				var t := (c.sample_baked(s + 1.0) - p).normalized()
				_lrt_station(p, atan2(-t.z, t.x))
			s += 300.0
		_mark_polyline(pts, 5.0)


func _lrt_station(p: Vector3, yaw: float) -> void:
	_mark_rect(p, yaw, 50, 18)
	_place(p, yaw, "station", 50, 18)
	var roof := Color(0.86, 0.87, 0.9)
	box(Vector3(0, LRT_Y + 1.3, 0), Vector3(48, 0.4, 14), C_CONCRETE)              # platforms
	for z in [-6.4, 6.4]:
		box(Vector3(0, LRT_Y + 1.7, z), Vector3(46, 3.2, 0.3), Color(0.92, 0.93, 0.95), mat_lowrise)
	box(Vector3(0, LRT_Y + 5.2, 0), Vector3(50, 0.5, 15), roof)
	var b := Basis(Vector3.UP, PI * 0.5) * Basis.from_scale(Vector3(15.4, 1.6, 50))
	_add(prism_mesh, mat_plain, Transform3D(b, Vector3(0, LRT_Y + 6.5, 0)), roof)
	for x in [-18.0, 0.0, 18.0]:
		for z in [-5.5, 5.5]:
			cyl(Vector3(x, 0, z), 0.8, LRT_Y, C_CONCRETE)
	# street-level entrance with the line's sign
	box(Vector3(20, 0, 9.5), Vector3(7, 6, 4), Color(0.9, 0.9, 0.9), mat_lowrise)
	box(Vector3(20, 6, 9.5), Vector3(7.4, 0.8, 4.4), Color(0.85, 0.15, 0.2) if lrt_curves.size() == 1 else Color(0.15, 0.35, 0.8))
	frame = Transform3D.IDENTITY


# ── placement ────────────────────────────────────────────────────────
## Builders work in local space (front facing -z, toward the street);
## `frame` carries them to their lot.
## `kind` says what stands on the lot (shoprow, kampung, school, paddy...);
## zone_layer.gd matches each game zone to a lot of a fitting kind.
## What each kind of lot is, for the simulation side (zone of the plan).
const LOT_ZONE := {
	"terrace": "residential", "bungalow": "residential", "semid": "residential",
	"kampung": "residential", "flat": "residential", "condo": "residential",
	"shoprow": "commercial", "tower": "commercial", "mall": "commercial",
	"carpark": "commercial", "market": "commercial",
	"hotel": "tourism", "chalet": "tourism",
	"factory": "industrial", "warehouse": "industrial",
	"paddy": "agriculture", "plantation": "agriculture",
	"trees": "green", "park": "green", "field": "green", "lake": "green",
}

## Totals the simulation side can read: lots and households per zone,
## lots per district, and the zoning preset in force.
func city_summary() -> Dictionary:
	var by_zone := {}
	var by_district := {}
	var homes := 0
	for lot in lots:
		var z := str(lot.get("zone", "civic"))
		var e: Dictionary = by_zone.get(z, {"lots": 0, "homes": 0})
		e.lots += 1
		e.homes += int(lot.get("homes", 0))
		by_zone[z] = e
		var dk := str(lot.get("district", ""))
		by_district[dk] = int(by_district.get(dk, 0)) + 1
		homes += int(lot.get("homes", 0))
	# bridges: one per run of a road over water, at its middle
	var bridges := []
	for rd in roads:
		var wet: PackedByteArray = rd.wet
		var k := 0
		while k < wet.size():
			if wet[k] == 0:
				k += 1
				continue
			var e := k
			while e < wet.size() and wet[e] == 1:
				e += 1
			var m: Vector3 = (rd.pts as PackedVector3Array)[(k + e) / 2]
			if (rd.gaps as PackedByteArray)[(k + e) / 2] == 0:
				bridges.append([snappedf(m.x, 1.0), snappedf(m.z, 1.0)])
			k = e
	return {"tier": tier, "layout": layout, "zoning": zoning, "homes": homes, "zones": by_zone, "districts": by_district.size(),
		"hills": hills_built, "tea": tea_hills, "bridges": bridges, "r_city": snappedf(r_city, 1.0),
		"junctions": _junction_degrees(), "graph": {"nodes": (road_graph.get("nodes", []) as Array).size(), "edges": (road_graph.get("edges", []) as Array).size()}}


## Junction count by number of road arms (3 = T, 4 = crossroads...).
func _junction_degrees() -> Dictionary:
	var out := {}
	for nd in road_graph.get("nodes", []):
		var d: int = nd[2]
		if d >= 3:
			out[str(d)] = int(out.get(str(d), 0)) + 1
	return out

## The planning district a point falls in: the band out from the centre
## (core, commercial, taman, outskirts) and, for the outer bands, which
## eighth of the compass it lies in, e.g. "taman-3".
func district_of(p: Vector3) -> String:
	if in_industry(p):
		return "industry"
	var r := _urban_r(p)
	if r < r_core:
		return "core"
	var band := "commercial" if r < r_commercial else ("taman" if r < r_taman else "outskirts")
	var sector := posmod(int(floor((atan2(p.z, p.x) + PI) / (TAU / 8.0))), 8)
	return "%s-%d" % [band, sector]


## Record a lot without moving the build frame (for builders that place
## in world coordinates themselves).
func _lot(c: Vector3, yaw: float, kind: String, w: float, d: float) -> void:
	var p := Vector3(c.x, 0, c.z)
	lots.append({"p": p, "kind": kind, "yaw": yaw, "w": w, "d": d,
		"zone": LOT_ZONE.get(kind, "civic"), "district": district_of(p), "homes": 0})


func _place(c: Vector3, yaw: float, kind := "", w := 0.0, d := 0.0) -> void:
	frame = Transform3D(Basis(Vector3.UP, yaw), c)
	if kind != "":
		var p := Vector3(c.x, 0, c.z)
		lots.append({"p": p, "kind": kind, "yaw": yaw, "w": w, "d": d,
			"zone": LOT_ZONE.get(kind, "civic"), "district": district_of(p), "homes": 0})


## A landmark on the free lot nearest its real map position (spiral
## search out from it in 4 m steps).
func _landmark_at(kind: String, target: Vector3, size: float) -> void:
	for ring in 30:
		var steps := maxi(1, ring * 8)
		for k in steps:
			var c := target + _polar_raw(ring * 4.0, TAU * k / steps)
			var yaw := atan2(c.x, c.z)
			if not _rect_free(c, yaw, size, size):
				continue
			_mark_rect(c, yaw, size, size)
			_place(c, yaw, kind, size, size)
			match kind:
				"telecom": _telecom()
				"park": _park(Vector3.ZERO, false)
				_: _merdeka118()
			frame = Transform3D.IDENTITY
			return


func _special(kind: String, r: float, deg: float, w: float, d: float) -> void:
	for attempt in 40:
		# step a fixed ~10 m sideways, so far landmarks stay near their real spot
		var a := deg_to_rad(deg) + (attempt / 2) * minf(0.06, 10.0 / maxf(r, 1.0)) * (1.0 if attempt % 2 == 0 else -1.0)
		var rr := r + float(attempt % 3 - 1) * 14.0
		var c := _polar(rr, a)
		var yaw := atan2(c.x, c.z)
		if not _rect_free(c, yaw, w, d):
			continue
		_mark_rect(c, yaw, w, d)
		_place(c, yaw, kind, w, d)
		match kind:
			"merdeka118": _merdeka118()
			"lake": _lake()
			"masjid": _masjid(Vector3.ZERO)
			"school": _school(Vector3.ZERO)
			"park": _park(Vector3.ZERO, false)
			"field": _field(Vector3.ZERO)
			"mall": _mall(Vector3.ZERO)
			"telecom": _telecom()
		frame = Transform3D.IDENTITY
		return


func _build_specials() -> void:
	var s := view_scale
	if landmarks:
		# Bukit Bintang: KLCC twin towers in the core loop, Menara KL and
		# Merdeka 118 just outside it
		_mark_rect(Vector3.ZERO, 0.0, 38, 38)
		_place(Vector3(0, 0, -4), 0.0, "landmark", 38, 38)
		_twin_towers(Vector3.ZERO)
		town_centre = Vector3(0, 0, -4)
		frame = Transform3D.IDENTITY
		for lm in [["park", KLCC_PARK_KM, 38.0], ["telecom", KL_TOWER_KM, 20.0], ["merdeka118", MERDEKA_KM, 30.0]]:
			var v: Vector2 = lm[1] * KL_SCALE
			_landmark_at(lm[0], Vector3(v.x, 0, v.y), lm[2])
	else:
		# everywhere else the centre is the town's own dataran, on the
		# nearest open ground to the middle so no street runs through it
		var sz := 55.0 * s * 0.85
		var placed := false
		for ring in 12:
			var r := ring * 12.0
			var steps := maxi(1, ring * 6)
			for k in steps:
				var a := TAU * k / steps
				var c := _polar(r, a)
				for yaw in [0.0, PI * 0.5, PI * 0.25]:
					if not placed and _rect_free(c, yaw, sz, sz * 0.75):
						_mark_rect(c, yaw, sz, sz * 0.75)
						_place(c, yaw, "dataran", sz, sz * 0.75)
						_town_square(sz)
						frame = Transform3D.IDENTITY
						town_centre = c
						placed = true
			if placed:
				break
	if tier in ["metro", "city"]:
		_special("mall", 186.0 * s, 75.0, 38, 34)
	_special("masjid", 238.0 * s, 30.0, 36, 38)
	_special("school", 290.0 * s, 140.0, 36, 36)
	_special("field", 340.0 * s, 95.0, 38, 36)
	if tier != "rural":
		_special("masjid", 340.0 * s, 250.0, 36, 38)
		_special("school", 392.0 * s, 318.0, 36, 36)
		_special("park", 240.0 * s, 285.0, 38, 38)
		_special("park", 392.0 * s, 190.0, 38, 38)
	if bool(traits.get("lake", false)):
		_special("lake", 330.0 * s, 160.0, 64, 46)


## Walks both kerbs of every street and fills the frontage with whatever
## the zone calls for: towers in the core, shophouse rows around it,
## terrace rows and bungalows in the taman, kampung houses at the edge.
func _frontage() -> void:
	var order := range(roads.size())
	order.sort_custom(func(a, b): return roads[a].cls < roads[b].cls)
	for ri in order:
		var rd: Dictionary = roads[ri]
		var L: float = rd.cum[rd.cum.size() - 1]
		var setback: float = rd.half + (2.6 if rd.cls < 2 else 1.6)
		for side: float in [-1.0, 1.0]:
			var s := rng.randf_range(0.0, 6.0)
			while s < L - 6.0:
				var p0: Vector3 = road_sample(rd, s)[0]
				var spec := _pick_building(p0, rd.cls)
				var mid: float = s + spec.w * 0.5
				if mid > L - 2.0:
					break
				var sm := road_sample(rd, mid)
				var t: Vector3 = sm[1]
				var n: Vector3 = Vector3(-t.z, 0, t.x) * side
				var c: Vector3 = sm[0] + n * (setback + 1.5 + spec.d * 0.5)
				var yaw := atan2(n.x, n.z)
				if spec.kind != "skip" and not _homes_left(spec):
					spec = {"kind": "skip", "w": spec.w, "d": 0.0, "gap": 0.0}
				if spec.kind != "skip" and _rect_free(c, yaw, spec.w, spec.d):
					_mark_rect(c, yaw, spec.w, spec.d)
					_place(c, yaw, spec.kind, spec.w, spec.d)
					_build_spec(spec, _urban_r(p0))
					frame = Transform3D.IDENTITY
					_back_row(c, n, yaw, spec, p0, rd.cls)
					s += spec.w + spec.gap
				else:
					s += 4.0 if spec.kind != "skip" else spec.w


## Density: a second building on the lot behind a frontage building, so
## the blocks between streets fill in instead of staying open grass.
## Out to the edge of a town (only the inner ring of a village), and only
## for small/medium kinds — towers, malls and factories keep their space.
const BACK_ROW_KINDS := ["terrace", "bungalow", "semid", "shoprow", "flat", "kampung", "condo"]
func _back_row(c: Vector3, n: Vector3, yaw: float, front: Dictionary, p0: Vector3, cls: int) -> void:
	# towns and cities fill out to their edge; villages only near the centre
	if _urban_r(p0) > (r_taman if tier == "rural" else r_city):
		return
	if not (front.kind in BACK_ROW_KINDS):
		return
	# denser seats fill every back lot; a sleepy pekan only some
	if rng.randf() > lerpf(0.3, 1.0, fill):
		return
	var back := _pick_building(p0 + n * (front.d + 8.0), cls)
	if back.kind == "skip" or back.kind == "trees" or not (back.kind in BACK_ROW_KINDS) or not _homes_left(back):
		return
	var c2: Vector3 = c + n * (front.d * 0.5 + 3.0 + back.d * 0.5)
	# the back yard faces away from the street: same yaw, so rows line up
	if _rect_free(c2, yaw, back.w, back.d):
		_mark_rect(c2, yaw, back.w, back.d)
		_place(c2, yaw, back.kind, back.w, back.d)
		_build_spec(back, _urban_r(c2))
		frame = Transform3D.IDENTITY


func _shoprow(lo: int, hi: int) -> Dictionary:
	var u := rng.randi_range(lo, hi)
	return {"kind": "shoprow", "units": u, "w": u * 6.0, "d": 14.0, "gap": rng.randf_range(1, 6)}


func _terrace() -> Dictionary:
	var u := rng.randi_range(4, 8)
	return {"kind": "terrace", "units": u, "w": u * 6.0, "d": 14.0, "gap": rng.randf_range(2, 6)}


## How "central" a point is: distance to the centre, or on Bukit Bintang
## to the KLCC -> Merdeka corridor, so the real CBD's towers run between
## the two instead of stopping at a ring round the twin towers.
func _urban_r(p: Vector3) -> float:
	var r := _shape_r(p)
	if cbd_axis == Vector3.ZERO:
		return r
	var ax := Vector2(cbd_axis.x, cbd_axis.z)
	var q := Vector2(p.x, p.z)
	var t := clampf(q.dot(ax) / ax.length_squared(), 0.0, 1.0)
	return minf(r, q.distance_to(ax * t) * 1.25 + 30.0)


func _pick_building(p: Vector3, cls: int) -> Dictionary:
	# zone edges wander with the bearing so the bands aren't perfect rings
	var a := atan2(p.z, p.x)
	var r := _urban_r(p) + 26.0 * view_scale * sin(a * 3.0 + 1.3) + 14.0 * view_scale * sin(a * 7.0)
	var x := rng.randf()
	var bungalow := {"kind": "bungalow", "w": 16.0, "d": 16.0, "gap": rng.randf_range(1, 5)}
	var trees := {"kind": "trees", "w": 12.0, "d": 12.0, "gap": 3.0}
	var kampung := {"kind": "kampung", "w": 10.0, "d": 10.0, "gap": rng.randf_range(6, 20)}
	var skip := {"kind": "skip", "w": rng.randf_range(10, 30), "d": 0.0, "gap": 0.0}
	# the industrial district: factories and warehouses, no houses
	if in_industry(p):
		if x < 0.5:
			return {"kind": "factory", "w": 28.0, "d": 22.0, "gap": rng.randf_range(4, 10)}
		if x < 0.88:
			return {"kind": "warehouse", "w": 36.0, "d": 26.0, "gap": rng.randf_range(4, 10)}
		return {"kind": "skip", "w": rng.randf_range(12, 30), "d": 0.0, "gap": 0.0}
	# landed houses: some are semi-detached pairs (rumah berkembar)
	if rng.randf() < float(zoning.get("semi_d", 0.0)) * 0.5:
		bungalow = {"kind": "semid", "w": 20.0, "d": 15.0, "gap": rng.randf_range(1, 4)}
	if r < r_core:
		match tier:
			"metro":
				if x < 0.72:
					return {"kind": "tower", "w": 20.0, "d": 20.0, "gap": rng.randf_range(2, 6)}
				return {"kind": "condo", "w": 18.0, "d": 17.0, "gap": 3.0}
			"city":
				# a state capital's downtown is mostly mid-rise: shophouse
				# blocks and flats, with a scatter of office towers
				if x < 0.2:
					return {"kind": "tower", "w": 20.0, "d": 20.0, "gap": 4.0, "h": rng.randf_range(30, 75)}
				if x < 0.7:
					return _shoprow(3, 7)
				if x < 0.92:
					return {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 4.0, "h": rng.randf_range(16, 30)}
				return trees
			"town":
				if x < 0.75:
					return _shoprow(3, 6)
				if x < 0.86:
					return {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 4.0, "h": rng.randf_range(10, 18)}
				return trees
			_:
				return _shoprow(2, 4) if x < 0.7 else trees
	if r < r_commercial:
		match tier:
			"metro":
				if x < 0.42:
					return _shoprow(3, 7)
				if x < 0.78:
					return {"kind": "condo", "w": 18.0, "d": 17.0, "gap": 4.0}
				if x < 0.9:
					return {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 4.0}
				return {"kind": "carpark", "w": 16.0, "d": 12.0, "gap": 3.0}
			"city":
				if x < 0.5:
					return _shoprow(3, 7)
				if x < 0.65:
					return {"kind": "condo", "w": 18.0, "d": 17.0, "gap": 4.0, "top": 45.0}
				if x < 0.85:
					return _terrace()
				return {"kind": "carpark", "w": 16.0, "d": 12.0, "gap": 3.0}
			"town":
				if x < 0.45:
					return _shoprow(2, 6)
				if x < 0.7:
					return _terrace()
				return bungalow if x < 0.9 else trees
			_:
				return kampung if x < 0.65 else (_shoprow(2, 3) if x < 0.82 else skip)
	if r < r_taman:
		if tier == "rural":
			return kampung if x < 0.75 else skip
		# condo blocks cluster along a metropolis's main roads
		if tier == "metro" and cls == 0 and rng.randf() < lerpf(0.35, 0.08, clampf((r - r_commercial) / (r_taman - r_commercial), 0.0, 1.0)):
			return {"kind": "condo", "w": 18.0, "d": 17.0, "gap": 4.0}
		if tier == "metro":
			# a metropolis's suburbs are built up: terraces, flats, shop rows
			if x < 0.5:
				return _terrace()
			if x < 0.72:
				return {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 3.0, "h": rng.randf_range(12, 24)}
			if x < 0.9:
				return _shoprow(3, 6)
			return bungalow
		if tier == "town" and x < 0.15:
			return kampung
		if x < 0.56:
			return _terrace()
		return bungalow if x < 0.95 else trees
	if r < r_city:
		if tier == "metro":
			if x < 0.45:
				return _terrace()
			if x < 0.7:
				return bungalow
			if x < 0.85:
				return {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 4.0, "h": rng.randf_range(10, 18)}
			return kampung
		return kampung if x < 0.72 else (bungalow if x < 0.85 else skip)
	return {"kind": "skip", "w": 40.0, "d": 0.0, "gap": 0.0}


## Hotels and chalets for the seat's visitors: rooms = visitors × 2.2
## nights / 365 / 65 % occupancy. Cities and towns get hotels (about 180
## rooms each) by the main roads near the centre; coasts, hills and
## kampung seats get chalet resorts (about 24 rooms each) by the beach or
## at the edge of town.
func _build_tourism() -> void:
	hotels_built = 0
	chalets_built = 0
	if tourists <= 0.0:
		return
	var rooms := tourists * 2.2 / 365.0 / 0.65
	var resort := sea_dir != Vector3.ZERO or not land_rings.is_empty() or bool(traits.get("hilly", false)) or tier in ["town", "rural"]
	var hotel_share := 0.85 if tier in ["metro", "city"] else (0.35 if resort else 0.6)
	# a drawn hotel stands for ~300 rooms (towns: ~200 in lower blocks), a
	# chalet resort for ~40; capped so the city stays a city
	var urban := tier in ["metro", "city"]
	var n_hotels := clampi(int(round(rooms * hotel_share / (300.0 if urban else 200.0))), 0, 80 if urban else 30)
	var n_chalets := clampi(int(round(rooms * (1.0 - hotel_share) / 40.0)), 0, 120) if resort else 0
	# hotels: facing the main roads, nearest the centre first, set back
	# from the kerb like any frontage building
	var cands := []
	for rd in roads:
		if int(rd.cls) > 1:
			continue
		var L: float = rd.cum[rd.cum.size() - 1]
		var s := 20.0
		while s < L - 20.0:
			var sm := road_sample(rd, s)
			if (rd.gaps as PackedByteArray)[sm[2]] == 0:
				cands.append([_urban_r(sm[0]), sm[0], sm[1], float(rd.half)])
			s += 28.0
	# the centre itself is left to the shophouses and offices: hotels
	# cluster on the main roads round the edge of the commercial district
	var ring := r_commercial
	cands.sort_custom(func(a, b): return absf(a[0] - ring) < absf(b[0] - ring))
	var min_r := r_core * (0.6 if urban else 1.0)
	for cnd in cands:
		if hotels_built >= n_hotels:
			break
		if float(cnd[0]) < min_r:
			continue
		var q: Vector3 = cnd[1]
		var t: Vector3 = cnd[2]
		for side in [1.0, -1.0]:
			var nrm := Vector3(-t.z, 0, t.x) * float(side)
			var c: Vector3 = q + nrm * (float(cnd[3]) + 4.0 + 11.0)
			var yaw := atan2(nrm.x, nrm.z)
			if on_land(c) and _rect_free(c, yaw, 22.0, 20.0):
				_mark_rect(c, yaw, 22.0, 20.0)
				_lot(c, yaw, "hotel", 22.0, 20.0)
				_hotel(c)
				hotels_built += 1
				break
	# chalets: by the beach when there is one, else round the town's edge
	for i in 2000:
		if chalets_built >= n_chalets:
			break
		var a := rng.randf() * TAU
		var p := _polar(rng.randf_range(r_taman * 0.6, r_city * 1.05), a)
		var near_sea := false
		if sea_dir != Vector3.ZERO or not land_rings.is_empty():
			for d in [Vector3(70, 0, 0), Vector3(-70, 0, 0), Vector3(0, 0, 70), Vector3(0, 0, -70)]:
				if in_sea(p + d):
					near_sea = true
			if not near_sea and i < 1500:
				continue
		if on_land(p) and _rect_free(p, 0.0, 34.0, 26.0):
			_mark_rect(p, 0.0, 34.0, 26.0)
			_lot(p, 0.0, "chalet", 34.0, 26.0)
			_chalets(p)
			chalets_built += 1


func _hotel(c: Vector3) -> void:
	var h := (rng.randf_range(26.0, 48.0) if tier in ["metro", "city"] else rng.randf_range(12.0, 22.0)) * lerpf(0.7, 1.0, fill)
	var facade: Color = [Color(0.95, 0.93, 0.88), Color(0.86, 0.9, 0.95), Color(0.93, 0.86, 0.78)][rng.randi() % 3]
	flat_block(c, Vector3(20, 6, 16), Color(0.8, 0.78, 0.74))                       # lobby podium
	box(c + Vector3(0, 6, 0), Vector3(16, h, 11), facade, mat_glass)
	box(c + Vector3(0, 6 + h, 0), Vector3(16.6, 1.2, 11.6), Color(0.2, 0.35, 0.6))
	box(c + Vector3(6, 0, 9), Vector3(6, 0.15, 4), Color(0.3, 0.65, 0.9))           # pool
	var sign := Label3D.new()
	sign.text = "HOTEL"
	sign.font_size = 96
	sign.pixel_size = 0.03
	sign.outline_size = 10
	sign.modulate = Color(1.0, 0.85, 0.3)
	sign.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sign.position = c + Vector3(0, 6 + h + 4.0, 0)
	gen.add_child(sign)


func _chalets(c: Vector3) -> void:
	var roof: Color = [Color(0.62, 0.32, 0.2), Color(0.3, 0.45, 0.32), Color(0.5, 0.35, 0.22)][rng.randi() % 3]
	box(c, Vector3(8, 0.15, 5), Color(0.3, 0.65, 0.9))                              # pool
	for k in 6:
		var a := TAU * k / 6.0 + 0.3
		var p := c + Vector3(cos(a) * 12.0, 0, sin(a) * 9.0)
		var yaw := -a
		box(p, Vector3(4.2, 2.6, 4.2), Color(0.9, 0.82, 0.66), null, yaw)              # timber chalet
		var b := Basis(Vector3.UP, yaw) * Basis.from_scale(Vector3(5.0, 2.2, 5.0))
		_add(prism_mesh, mat_plain, Transform3D(b, p + Vector3(0, 2.6 + 1.1, 0)), roof)
	for k in 4:
		tree(c + Vector3(rng.randf_range(-15, 15), 0, rng.randf_range(-12, 12)), true)


## Homes for the households the street frontage could not house: kampung
## houses, terraces and bungalows on free land beside the streets (inside
## the seat, off the water), until the seat's household target is met.
func _infill_homes() -> void:
	if home_target < 0.0 or homes_built >= home_target or roads.is_empty():
		return
	# every home past the main-road frontage stands on a lane: a narrow
	# road sprouting from a street (or from an earlier lane) out into the
	# open land, with houses on both sides facing it
	var urban := tier in ["metro", "city"]
	for ln in lanes:
		if homes_built >= home_target:
			break
		_homes_on_lane(ln, urban)
		await _breathe(0.45 + 0.4 * homes_built / maxf(home_target, 1.0))
	# then country roads: from the nearest point of the road-and-lane
	# network out toward open land further off, each with side lanes
	var net := {}
	for rd in roads:
		var pts: PackedVector3Array = rd.pts
		for k in range(0, pts.size(), 3):
			if (rd.gaps as PackedByteArray)[k] == 0:
				_net_add(net, pts[k])
	for ln: PackedVector3Array in lanes:
		for k in range(4, ln.size(), 4):
			_net_add(net, ln[k])
	var tries := 0
	while homes_built < home_target and tries < 80000 and not net.is_empty():
		tries += 1
		await _breathe(0.45 + 0.4 * homes_built / maxf(home_target, 1.0))
		var seed := _polar(rng.randf_range(0.12, 1.0) * r_city, rng.randf() * TAU)
		if not on_land(seed) or in_sea(seed) or in_industry(seed) or _urban_r(seed) < r_commercial:
			continue
		var ci := _cell(seed)
		if ci < 0 or occ[ci] == 1:
			continue
		var best := _net_near(net, seed)
		var bd := Vector2(best.x - seed.x, best.z - seed.z).length()
		if bd < 30.0 or bd == INF:
			continue
		var dir := Vector3(seed.x - best.x, 0, seed.z - best.z).normalized()
		var pts := _grow_lane(best + dir * (LANE_HALF + 2.0), dir, bd + rng.randf_range(60.0, 200.0), seed)
		if pts.size() < 10:
			continue
		var made := [pts]
		# side lanes off the new road
		var i := rng.randi_range(8, 14)
		while i < pts.size() - 3:
			var t := (pts[i + 1] - pts[i]).normalized()
			var sd := Vector3(-t.z, 0, t.x) * (1.0 if rng.randf() < 0.5 else -1.0)
			_mark_polyline(pts, LANE_HALF + 0.5)
			var sub := _grow_lane(pts[i] + sd * (LANE_HALF + 0.6), sd, rng.randf_range(60.0, 140.0 if urban else 220.0))
			if sub.size() >= 10:
				_mark_polyline(sub, LANE_HALF + 0.5)
				made.append(sub)
			i += rng.randi_range(12, 22)
		for ln: PackedVector3Array in made:
			_mark_polyline(ln, LANE_HALF + 0.5)
			_draw_lane(ln)
			lanes.append(ln)
			for k in range(4, ln.size(), 4):
				_net_add(net, ln[k])
		for ln: PackedVector3Array in made:
			_homes_on_lane(ln, urban)
	# last, single houses in the land left between lanes, each with its
	# own driveway to the nearest lane or street
	var t2 := 0
	while homes_built < home_target and t2 < 60000:
		t2 += 1
		await _breathe(0.45 + 0.4 * homes_built / maxf(home_target, 1.0))
		var spec: Dictionary = {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 3.0, "h": rng.randf_range(16, 36)} if urban and rng.randf() < 0.6 else ({"kind": "bungalow", "w": 16.0, "d": 16.0, "gap": 2.0} if urban else {"kind": "kampung", "w": 10.0, "d": 10.0, "gap": 4.0})
		var c := _polar(rng.randf_range(0.12, 1.0) * r_city, rng.randf() * TAU)
		if not on_land(c) or in_sea(c) or in_industry(c) or _urban_r(c) < r_core:
			continue
		var q := _net_near(net, c)
		var off := Vector3(c.x - q.x, 0, c.z - q.z)
		var dist := off.length()
		if dist == INF or dist > 70.0 or dist < float(spec.d) * 0.5 + LANE_HALF + 4.0:
			continue
		var o := off / dist
		var yaw := atan2(o.x, o.z)
		if not _rect_free_soft(c, yaw, spec.w, spec.d):
			continue
		var a2 := q + o * (LANE_HALF + 0.4)
		var b2 := c - o * (float(spec.d) * 0.5 + 0.2)
		if a2.distance_to(b2) > 3.0 and not _path_free(a2 + o * 2.5, b2 - o * 1.5):
			continue
		_mark_rect(c, yaw, spec.w, spec.d)
		_place(c, yaw, spec.kind, spec.w, spec.d)
		_build_spec(spec, _urban_r(c))
		frame = Transform3D.IDENTITY
		if a2.distance_to(b2) > 1.0:
			_ribbon_piece(ground_st, PackedVector3Array([a2, a2, b2, b2]), 1, 1.3, 0.045, C_CONCRETE.darkened(0.08))
			_mark_polyline(PackedVector3Array([a2, b2]), 1.4)


const NET_CELL := 60.0

func _net_add(net: Dictionary, p: Vector3) -> void:
	var k := Vector2i(floori(p.x / NET_CELL), floori(p.z / NET_CELL))
	if not net.has(k):
		net[k] = []
	(net[k] as Array).append(p)


## The nearest network point to p (searching outward ring by ring), or a
## point at infinity when none lies within reach.
func _net_near(net: Dictionary, p: Vector3) -> Vector3:
	var c := Vector2i(floori(p.x / NET_CELL), floori(p.z / NET_CELL))
	var best := Vector3(INF, 0, INF)
	var bd := INF
	# out to ~10 cells: a seed further from every road waits until the
	# network has grown nearer (searching wider cost most of a build)
	for r in 10:
		for dx in range(-r, r + 1):
			for dz in range(-r, r + 1):
				if maxi(absi(dx), absi(dz)) != r:
					continue
				var k := c + Vector2i(dx, dz)
				if not net.has(k):
					continue
				for q: Vector3 in net[k]:
					var d := Vector2(q.x - p.x, q.z - p.z).length_squared()
					if d < bd:
						bd = d
						best = q
		if bd < INF and sqrt(bd) < (r - 1) * NET_CELL:
			break
	return best


var lanes := []

## Lanes laid out before the street frontage is built, so they can leave
## every street at intervals and branch again into the land behind it.
func _plan_lanes() -> void:
	lanes = []
	if home_target < 0.0:
		return
	var urban := tier in ["metro", "city"]
	var fresh := []
	for rd in roads:
		var L: float = rd.cum[rd.cum.size() - 1]
		var s := rng.randf_range(20.0, 60.0)
		while s < L - 20.0:
			var sm := road_sample(rd, s)
			s += rng.randf_range(50.0, 95.0) if urban else rng.randf_range(60.0, 130.0)
			if (rd.gaps as PackedByteArray)[sm[2]] == 1:
				continue
			# the town centre is shophouse streets, not housing lanes
			if _urban_r(sm[0]) < r_commercial:
				continue
			var t: Vector3 = sm[1]
			var dir := Vector3(-t.z, 0, t.x) * (1.0 if rng.randf() < 0.5 else -1.0)
			var pts := _grow_lane(sm[0] + dir * (float(rd.half) - 0.5), dir, rng.randf_range(80.0, 170.0 if urban else 280.0))
			if pts.size() >= 10:
				_mark_polyline(pts, LANE_HALF + 0.5)
				lanes.append(pts)
				fresh.append(pts)
	# two generations of side lanes off the first
	for gen_i in 2:
		var next := []
		for ln: PackedVector3Array in fresh:
			var i := rng.randi_range(8, 14)
			while i < ln.size() - 3:
				var t := (ln[i + 1] - ln[i]).normalized()
				var dir := Vector3(-t.z, 0, t.x) * (1.0 if rng.randf() < 0.5 else -1.0)
				var pts := _grow_lane(ln[i] + dir * (LANE_HALF + 0.6), dir, rng.randf_range(60.0, 140.0 if urban else 220.0))
				if pts.size() >= 10:
					_mark_polyline(pts, LANE_HALF + 0.5)
					lanes.append(pts)
					next.append(pts)
				i += rng.randi_range(12, 22)
		fresh = next
	for ln in lanes:
		_draw_lane(ln)


const LANE_HALF := 2.4

## A lane walked out from p in 4 m steps, bending gently, until it meets
## something already built, the boundary or the sea, or runs its length.
func _grow_lane(p: Vector3, dir: Vector3, length: float, aim := Vector3(INF, 0, 0)) -> PackedVector3Array:
	var pts := PackedVector3Array([p])
	var head := atan2(dir.z, dir.x)
	var bend := rng.randf_range(-0.03, 0.03)
	var s := 0.0
	# the first metres cross the parent road's own pavement
	var skip := 9.0
	while s < length:
		head += bend + rng.randf_range(-0.02, 0.02)
		if aim.x != INF:
			var last := pts[pts.size() - 1]
			if Vector2(aim.x - last.x, aim.z - last.z).length() < 40.0:
				aim = Vector3(INF, 0, 0)
			else:
				head = lerp_angle(head, atan2(aim.z - last.z, aim.x - last.x), 0.12)
		var d := Vector3(cos(head), 0, sin(head))
		var q := pts[pts.size() - 1] + d * 4.0
		s += 4.0
		if not on_land(q) or in_sea(q):
			break
		if s > skip:
			var side := Vector3(-d.z, 0, d.x) * (LANE_HALF + 1.5)
			var hit := false
			for e in [q + d * 3.0, q + side, q - side]:
				var ci := _cell(e)
				if ci < 0 or occ[ci] == 1:
					hit = true
					break
			if hit:
				break
		pts.append(q)
	return pts


func _draw_lane(pts: PackedVector3Array) -> void:
	for i in pts.size() - 1:
		var seg := PackedVector3Array([pts[maxi(i - 1, 0)], pts[i], pts[i + 1], pts[mini(i + 2, pts.size() - 1)]])
		_ribbon_piece(ground_st, seg, 1, LANE_HALF + 0.7, 0.05, C_CONCRETE)
		_ribbon_piece(ground_st, seg, 1, LANE_HALF, 0.085, C_ASPHALT)


## Houses down both sides of a lane, each facing it.
func _homes_on_lane(pts: PackedVector3Array, urban: bool) -> void:
	for side: float in [-1.0, 1.0]:
		var i := 3
		while i < pts.size() - 1 and homes_built < home_target:
			var x := rng.randf()
			var spec: Dictionary
			if urban:
				spec = {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 3.0, "h": rng.randf_range(16, 36)} if x < 0.4 else (_terrace() if x < 0.8 else ({"kind": "semid", "w": 20.0, "d": 15.0, "gap": 2.0} if x < 0.8 + 0.2 * float(zoning.get("semi_d", 0.0)) else {"kind": "bungalow", "w": 16.0, "d": 16.0, "gap": 2.0}))
			else:
				spec = {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 3.0, "h": rng.randf_range(12, 20)} if x < 0.08 else (_terrace() if x < 0.4 else {"kind": "kampung", "w": 10.0, "d": 10.0, "gap": rng.randf_range(3.0, 8.0)})
			var t := (pts[i + 1] - pts[i - 1]).normalized()
			var o: Vector3 = Vector3(-t.z, 0, t.x) * side
			var setb: float = LANE_HALF + 1.5 + spec.d * 0.5 + (rng.randf_range(0.0, 5.0) if spec.kind == "kampung" else 0.0)
			var c: Vector3 = pts[i] + o * setb
			var yaw := atan2(o.x, o.z)
			var step := int(ceil((spec.w + spec.gap) / 4.0))
			if on_land(c) and not in_industry(c) and _rect_free_soft(c, yaw, spec.w, spec.d):
				_mark_rect(c, yaw, spec.w, spec.d)
				_place(c, yaw, spec.kind, spec.w, spec.d)
				_build_spec(spec, _urban_r(c))
				frame = Transform3D.IDENTITY
				_back_rows(pts[i], t, o, spec, urban)
				i += step
			else:
				i += 1


## Houses set back behind the first row, reached by a short driveway
## from the lane that runs past the side of the front house.
func _back_rows(p: Vector3, t: Vector3, o: Vector3, front: Dictionary, urban: bool) -> void:
	var lat := (float(front.w) * 0.5 + 4.0) * (1.0 if rng.randf() < 0.5 else -1.0)
	var a := p + o * (LANE_HALF + 0.4) + t * lat
	var depth := LANE_HALF + 1.5 + float(front.d)
	var rows := 0
	for r in (3 if urban else 5):
		if homes_built >= home_target or rng.randf() > (0.75 if urban else 0.9):
			break
		var spec: Dictionary = {"kind": "flat", "w": 16.0, "d": 13.0, "gap": 3.0, "h": rng.randf_range(16, 36)} if urban and rng.randf() < 0.6 else ({"kind": "bungalow", "w": 16.0, "d": 16.0, "gap": 2.0} if urban else {"kind": "kampung", "w": 10.0, "d": 10.0, "gap": 4.0})
		depth += rng.randf_range(3.0, 8.0)
		var c := p + o * (depth + float(spec.d) * 0.5) + t * (lat - signf(lat) * (float(spec.w) * 0.5 + 2.2))
		var b := p + o * (depth + float(spec.d) * 0.5) + t * lat
		var yaw := atan2(o.x, o.z)
		if not on_land(c) or in_industry(c) or not _rect_free_soft(c, yaw, spec.w, spec.d) or not _path_free(a + o * (2.5 if rows == 0 else 0.0), b):
			break
		_mark_rect(c, yaw, spec.w, spec.d)
		_place(c, yaw, spec.kind, spec.w, spec.d)
		_build_spec(spec, _urban_r(c))
		frame = Transform3D.IDENTITY
		depth += float(spec.d)
		rows += 1
		var seg := PackedVector3Array([a, a, b, b])
		_ribbon_piece(ground_st, seg, 1, 1.3, 0.045, C_CONCRETE.darkened(0.08))
		_mark_polyline(PackedVector3Array([a, b]), 1.4)
		a = b


func _path_free(a: Vector3, b: Vector3) -> bool:
	var L := a.distance_to(b)
	var d := (b - a) / maxf(L, 0.01)
	var s := 0.0
	while s <= L:
		var ci := _cell(a + d * s)
		if ci < 0 or occ[ci] == 1:
			return false
		s += 2.0
	return true


## Homes a drawn building stands for, before the seat's homes-per-model
## scale: one per terrace unit / bungalow / kampung house / shophouse,
## and per flat or condo floor several.
func _spec_homes(spec: Dictionary) -> float:
	match str(spec.kind):
		"terrace": return float(spec.get("units", 6))
		"shoprow": return float(spec.get("units", 4)) * 0.6
		"bungalow", "kampung": return 1.0
		"semid": return 2.0
		"flat": return float(spec.get("h", 20.0)) / 3.2 * 6.0
		"condo": return float(spec.get("top", 40.0)) / 3.2 * 10.0
	return 0.0


const HOMES_SCALE := 1.0      # one drawn home per household (true scale)
var homes_built := 0.0
var tourists := 0.0            # visitors a year (simulated)
var hotels_built := 0
var chalets_built := 0
var home_target := -1.0        # drawn homes the seat's households call for (-1: no limit)

## A residential building is only placed while the seat still needs
## homes for its households; past that the lot stays open.
func _homes_left(spec: Dictionary) -> bool:
	# shophouses are the commercial street first (the flats upstairs are
	# a bonus): they never wait on the household budget
	if str(spec.kind) == "shoprow":
		return true
	var h := _spec_homes(spec)
	if h <= 0.0 or home_target < 0.0:
		return true
	return homes_built < home_target


func _build_spec(spec: Dictionary, r: float) -> void:
	var hh := _spec_homes(spec)
	homes_built += hh
	# capacity on the lot just placed (its households)
	if not lots.is_empty() and (lots[-1].p as Vector3).distance_squared_to(Vector3(frame.origin.x, 0, frame.origin.z)) < 0.01:
		lots[-1].homes = int(round(hh))
	match spec.kind:
		"tower":
			var hmax := lerpf(60.0, 30.0, clampf(r / r_core, 0.0, 1.0)) * lerpf(0.7, 1.1, fill)    # ~240 m real at most: landmarks stay taller
			var h: float = spec.get("h", hmax * rng.randf_range(0.55, 1.0))
			_office_tower(Vector3.ZERO, rng.randf_range(10, 14), rng.randf_range(10, 14), h)
		"flat":
			flat_block(Vector3.ZERO, Vector3(spec.w - 2.0, spec.get("h", rng.randf_range(14, 34)), spec.d - 2.0), Color(0.93, 0.9, 0.84).lerp(Color(0.8, 0.72, 0.6), rng.randf()))
		"factory":
			_factory()
		"shoprow":
			_shophouse_row(spec.units)
		"condo":
			var top: float = spec.get("top", lerpf(60.0, 30.0, clampf((r - r_core * 0.5) / (r_taman - r_core * 0.5), 0.0, 1.0)))
			_condo(rng.randf_range(top * 0.55, top))
		"carpark":
			box(Vector3.ZERO, Vector3(spec.w, 0.04, spec.d), Color(0.3, 0.31, 0.32))
			for k in 5:
				box(Vector3(-5 + k * 2.5, 0, rng.randf_range(-2, 2)), Vector3(1.8, 1.3, 4.0), SIGNS[rng.randi() % SIGNS.size()].lerp(Color.WHITE, 0.4))
		"terrace":
			_terrace_row(Vector3(0, 0, 1.0), spec.units, true)
		"bungalow":
			_bungalow()
		"semid":
			_semi_detached()
		"warehouse":
			_warehouse()
		"kampung":
			_kampung_house()
		"trees":
			for k in 3:
				tree(Vector3(rng.randf_range(-4, 4), 0, rng.randf_range(-4, 4)), rng.randf() < 0.5)


## Trees in whatever ground is still free: back gardens, verges, the
## leftover corners between curved streets, then the forest outside.
func _fill_trees() -> void:
	_street_trees()
	if bool(traits.get("paddy", false)):
		_paddy_fields()
	if bool(zoning.get("plantation", false)):
		_oil_palm_estates()
	for i in 9000:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * maxf(1150.0, reach_r * 1.3)
		var p := _polar(r, a)
		var ci := _cell(p)
		if (ci >= 0 and occ[ci] != 0) or in_sea(p) or (ci < 0 and not seat_poly.is_empty()):
			continue
		var urban := tier in ["metro", "city"]
		var ur := _urban_r(p)
		var keep := ((0.08 if urban else 0.35) if ur < r_core else ((0.22 if urban else 0.55) if r < r_city else 0.8))
		if r < r_city:
			keep *= lerpf(1.3, 0.6, fill)   # denser seats keep less filler greenery
		var n := sin(p.x * 0.02) * sin(p.z * 0.023) + sin((p.x + p.z) * 0.011)
		if rng.randf() > keep or (r > r_city and n < 0.1):
			continue
		if ci >= 0:
			occ[ci] = 2   # a tree: blocks lots, but a new building site may clear it
		tree(p, rng.randf() < 0.25)
	# mountain ranges ringing the valley, in layers: a near forested
	# ridge, then bluer and paler ranges behind it that the haze softens
	var hilly := bool(traits.get("hilly", false))
	# only seats that really have hills get the ranges round the valley: a
	# flat city (Bukit Bintang, Petaling Jaya) or a coastal plain stays flat
	var push := maxf(1.0, reach_r * 1.25 / 900.0)
	var layers := [] if (not hilly or not seat_poly.is_empty()) else [
		{"r": Vector2(900, 1100) if hilly else Vector2(1250, 1400), "n": 30, "w": Vector2(260, 380), "h": Vector2(180, 320) if hilly else Vector2(80, 170), "c0": Color(0.2, 0.33, 0.19), "c1": Color(0.28, 0.4, 0.24)},
		{"r": Vector2(1650, 1850), "n": 46, "w": Vector2(320, 480), "h": Vector2(180, 300) if hilly else Vector2(110, 210), "c0": Color(0.14, 0.22, 0.2), "c1": Color(0.2, 0.28, 0.27)},
		{"r": Vector2(2300, 2600), "n": 52, "w": Vector2(420, 640), "h": Vector2(260, 420) if hilly else Vector2(170, 300), "c0": Color(0.2, 0.26, 0.3), "c1": Color(0.26, 0.32, 0.36)},
	]
	for L in layers:
		var n: int = L.n
		for i in n:
			var a := TAU * i / float(n) + rng.randf_range(-0.08, 0.08)
			var hp := _polar_raw(rng.randf_range(L.r.x, L.r.y) * push, a)
			if in_sea(hp):
				continue
			var col: Color = (L.c0 as Color).lerp(L.c1, rng.randf())
			var hh := rng.randf_range(L.h.x, L.h.y)
			var wide := rng.randf_range(L.w.x, L.w.y)
			# long and narrow along the ring, so neighbours merge into a ridge
			var b := Basis(Vector3.UP, -a) * Basis.from_scale(Vector3(rng.randf_range(160, 260), hh, wide))
			_add(sphere_mesh, mat_plain, Transform3D(b, hp + Vector3(0, -hh * 0.08, 0)), col)
			# a lower shoulder beside each peak breaks up the dome outline
			if rng.randf() < 0.7:
				var sp := _polar_raw(hp.length() + rng.randf_range(-40, 40), a + rng.randf_range(0.03, 0.07))
				var b2 := Basis(Vector3.UP, -a) * Basis.from_scale(Vector3(rng.randf_range(140, 220), hh * rng.randf_range(0.45, 0.7), wide * 0.8))
				_add(sphere_mesh, mat_plain, Transform3D(b2, sp), col.lightened(0.04))
	if bool(traits.get("kinabalu", false)) and seat_poly.is_empty():
		var mp := _polar_raw(2600.0, feature_turn + PI * 0.5)
		ball(mp, Vector3(2200, 1500, 1800), Color(0.26, 0.36, 0.24))
		ball(mp + Vector3(0, 560, 0), Vector3(700, 520, 600), Color(0.46, 0.47, 0.48))


## Bukit for a hilly seat: smooth forested hills on the open land past
## the town and beyond the seat boundary (where nothing is built), each a
## rounded bump with rainforest trees standing on its slopes. Only seats
## whose real terrain is hilly get them.
var _hill_mesh: ArrayMesh
var hills_built := 0
var tea_hills := []        # tea estate hill centres (world x, z)
func _forest_hills() -> void:
	hills_built = 0
	tea_hills = []
	if _hill_mesh == null:
		_hill_mesh = _unit_hill()
	var hills := []
	var inside := 0
	var want := 34 if tier == "rural" else 24
	for attempt in want * 12:
		if hills.size() >= want:
			break
		var r := rng.randf_range(maxf(r_taman, r_city * 0.4), reach_r * 1.35)
		var c := _polar_raw(r, rng.randf() * TAU)
		var R := rng.randf_range(140.0, 360.0)
		var H := R * rng.randf_range(0.22, 0.42)
		var ok := true
		for h in hills:
			if Vector2(c.x - h[0].x, c.z - h[0].z).length() < (R + float(h[1])) * 0.75:
				ok = false
				break
		if not ok:
			continue
		# open ground under it: nothing built inside the seat, land outside
		for k in 16:
			var q := c + Vector3(cos(k * 0.785) * R * (0.35 if k < 8 else 0.8), 0, sin(k * 0.785) * R * (0.35 if k < 8 else 0.8))
			if in_sea(q):
				ok = false
				break
			var ci := _cell(q)
			if ci >= 0 and in_seat(q) and occ[ci] == 1:
				ok = false
				break
		if not ok:
			continue
		# only a few inside the seat (the land is where people live), the
		# rest rise beyond the boundary
		if in_seat(c):
			if inside >= 7:
				continue
			inside += 1
		hills.append([c, R])
		hills_built += 1
		var sx := R * rng.randf_range(0.85, 1.15)
		var sz := R * rng.randf_range(0.85, 1.15)
		var yaw := rng.randf() * TAU
		var green := Color(0.17, 0.33, 0.16).lerp(Color(0.25, 0.41, 0.19), rng.randf())
		var bs := Basis(Vector3.UP, yaw) * Basis.from_scale(Vector3(sx, H, sz))
		_add(_hill_mesh, mat_lawn, Transform3D(bs, c), green)
		# keep the rest of the generator off it, and plant its slopes
		if in_seat(c):
			_rect_scan(c, yaw, sx * 1.6, sz * 1.6, 2)
		# highland tea seats: every other hill near town is a tea estate,
		# its slopes ringed with rows of bushes along the contours
		if bool(traits.get("tea", false)) and hills_built % 2 == 1 and r < reach_r * 1.1:
			_tea_rows(c, yaw, sx, sz, H)
			tea_hills.append([snappedf(c.x, 1.0), snappedf(c.z, 1.0)])
			continue
		var n := int(R * R / 420.0)
		for k in n:
			var u := Vector3(rng.randf_range(-1, 1), 0, rng.randf_range(-1, 1))
			var t2 := u.x * u.x + u.z * u.z
			if t2 > 0.85:
				continue
			var y := H * _hill_h(sqrt(t2))
			var p := c + Basis(Vector3.UP, yaw) * Vector3(u.x * sx, 0, u.z * sz)
			tree(p + Vector3(0, y - 0.6, 0), rng.randf() < 0.12)


## Tea bushes in contour rows round a hill: each row a ring at one
## height, cut into clipped hedge segments with a path gap here and there.
func _tea_rows(c: Vector3, yaw: float, sx: float, sz: float, H: float) -> void:
	var b := Basis(Vector3.UP, yaw)
	var R := (sx + sz) * 0.5
	var t := 0.12
	while t < 0.9:
		var circ := TAU * R * t
		var nseg := maxi(8, int(circ / 7.0))
		var y := H * _hill_h(t) + 0.2
		var shade := rng.randf_range(0.0, 1.0)
		for j in nseg:
			if rng.randf() < 0.06:
				continue   # a picking path through the rows
			var a := TAU * (float(j) + 0.5) / nseg
			var p := c + b * Vector3(cos(a) * t * sx, 0, sin(a) * t * sz)
			var tan := b * Vector3(-sin(a) * sx, 0, cos(a) * sz)
			var hy := atan2(-tan.z, tan.x)
			var bs := Basis(Vector3.UP, hy) * Basis.from_scale(Vector3(7.4, 1.2, 1.5))
			_add(sphere_mesh, mat_plain, Transform3D(bs, p + Vector3(0, y, 0)), Color(0.3, 0.58, 0.2).lerp(Color(0.42, 0.66, 0.24), shade))
		t += 9.0 / R


func _hill_h(t: float) -> float:
	var q := clampf(1.0 - t * t, 0.0, 1.0)
	return q * q


## A unit hill (radius 1, height 1): smooth (1 - r^2)^2 profile.
func _unit_hill() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	const RINGS := 10
	const SEG := 28
	var pt := func(i: int, j: int) -> Vector3:
		var t := float(i) / RINGS
		var a := TAU * float(j) / SEG
		return Vector3(cos(a) * t, _hill_h(t) - 0.02, sin(a) * t)
	for i in RINGS:
		for j in SEG:
			var a: Vector3 = pt.call(i, j)
			var b: Vector3 = pt.call(i + 1, j)
			var c: Vector3 = pt.call(i + 1, j + 1)
			var d: Vector3 = pt.call(i, j + 1)
			for v in [a, b, c, a, c, d]:
				st.add_vertex(v)
	st.generate_normals()
	return st.commit()


## Shade trees along the main roads (rain trees on the verge), wherever
## the verge was left open.
func _street_trees() -> void:
	for rd in roads:
		if int(rd.cls) > 1:
			continue
		var L: float = rd.cum[rd.cum.size() - 1]
		var off: float = float(rd.half) + 2.6 + 1.4
		var s := rng.randf_range(4.0, 14.0)
		while s < L:
			var sm := road_sample(rd, s)
			s += rng.randf_range(14.0, 22.0)
			if (rd.gaps as PackedByteArray)[sm[2]] == 1 or int((rd.wet as PackedByteArray)[sm[2]]) == 1:
				continue
			var t: Vector3 = sm[1]
			var n := Vector3(-t.z, 0, t.x)
			for side in [-1.0, 1.0]:
				var p: Vector3 = sm[0] + n * off * float(side)
				var ci := _cell(p)
				if ci < 0 or occ[ci] != 0 or not on_land(p):
					continue
				occ[ci] = 2
				tree(p, rng.randf() < 0.3)


## Ladang sawit on the rural fringe of a plantation seat: rectangular
## blocks of oil palms in staggered rows (about 9 m apart, as planted),
## each block on open land past the taman ring with a laterite track
## along one side. Each block is a lot ("plantation").
func _oil_palm_estates() -> void:
	var made := 0
	var want := 70 if tier == "rural" else 40
	for attempt in want * 8:
		if made >= want:
			break
		var r := rng.randf_range(maxf(r_taman, r_city * 0.35), r_city * 1.05)
		var a := rng.randf() * TAU
		var c := _polar(r, a)
		var out := Vector3(c.x, 0, c.z).normalized()
		var yaw := atan2(out.x, out.z) + rng.randf_range(-0.2, 0.2)
		var w := rng.randf_range(110.0, 170.0)
		var d := rng.randf_range(80.0, 130.0)
		if not on_land(c) or in_industry(c) or not _rect_free(c, yaw, w, d):
			continue
		_mark_rect(c, yaw, w, d)
		_lot(c, yaw, "plantation", w, d)
		var b := Basis(Vector3.UP, yaw)
		var row := 0
		var v := -d * 0.5 + 5.0
		while v < d * 0.5 - 4.0:
			var u := -w * 0.5 + 5.0 + (4.5 if row % 2 == 1 else 0.0)
			while u < w * 0.5 - 4.0:
				var p := c + b * Vector3(u, 0, v)
				if on_land(p):
					_oil_palm(p)
				u += 9.0
			v += 7.8
			row += 1
		# laterite estate track along the near side
		var e0 := c + b * Vector3(-w * 0.5, 0, -d * 0.5 - 3.0)
		var e1 := c + b * Vector3(w * 0.5, 0, -d * 0.5 - 3.0)
		_ribbon_piece(ground_st, PackedVector3Array([e0, e0, e1, e1]), 1, 2.2, 0.04, Color(0.62, 0.42, 0.3))
		made += 1


## An oil palm: a short, thick-crowned palm, darker than a coconut palm.
func _oil_palm(p: Vector3) -> void:
	if tree_palm_mesh:
		var sc := rng.randf_range(0.95, 1.2)
		var bs := Basis(Vector3.UP, rng.randf() * TAU) * Basis.from_scale(Vector3(sc * 1.25, sc * 0.8, sc * 1.25))
		var sh := rng.randf_range(0.62, 0.78)
		_add(tree_palm_mesh, mat_tree, Transform3D(bs, p), Color(sh, sh * 1.02, sh * 0.9))
	else:
		tree(p, true)


## Sawah on the outskirts: flooded green-gold plots with earth bunds,
## laid on a grid turned with the seat.
func _paddy_fields() -> void:
	var yaw := feature_turn
	var b := Basis(Vector3.UP, yaw)
	var reach := r_city + 520.0
	var u := -reach
	while u < reach:
		var v := -reach
		while v < reach:
			var c := b * Vector3(u, 0, v)
			var r := _shape_r(c)
			if r > r_city * 0.85 and r < reach and on_land(c) and _rect_free(c, yaw, 40, 30):
				_mark_rect(c, yaw, 40, 30)
				lots.append({"p": c, "kind": "paddy", "yaw": yaw, "w": 40.0, "d": 30.0})
				var col := Color(0.42, 0.62, 0.28).lerp(Color(0.72, 0.68, 0.3), rng.randf() * 0.6)
				box(c, Vector3(40, 0.12, 30), col, null, yaw)
				box(c + b * Vector3(0, 0, -15), Vector3(40, 0.35, 0.8), Color(0.5, 0.42, 0.3), null, yaw)
				box(c + b * Vector3(-20, 0, 0), Vector3(0.8, 0.35, 30), Color(0.5, 0.42, 0.3), null, yaw)
			v += 31.0
		u += 41.0


## The seat's pieces (rings) cut to a band along `dir`: lo <= p.dir <= hi.
func _seat_band(dir: Vector3, lo: float, hi: float) -> Array:
	var d := Vector2(dir.x, dir.z).normalized()
	var n := Vector2(-d.y, d.x)
	var band := PackedVector2Array([d * lo - n * 9000.0, d * hi - n * 9000.0, d * hi + n * 9000.0, d * lo + n * 9000.0])
	var out := []
	for ring in seat_poly:
		for piece in Geometry2D.intersect_polygons(ring, band):
			out.append(piece)
	return out


## Flat triangulated polygons into a mesh (both windings), UV from world x/z.
func _poly_mesh(polys: Array, y: float, uv_per_m: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	for poly in polys:
		var tris := Geometry2D.triangulate_polygon(poly)
		for k in range(0, tris.size(), 3):
			for m in [0, 1, 2, 0, 2, 1]:
				var v: Vector2 = poly[tris[k + m]]
				st.set_uv(v * uv_per_m)
				st.add_vertex(Vector3(v.x, y, v.y))
	return st.commit()


## A cut-out seat stands like a model: its ground is the boundary shape,
## with an earth edge dropping away under it — nothing outside.
func _cutout_ground(gm: StandardMaterial3D) -> void:
	_single(_poly_mesh(seat_poly, 0.0, 6.0 / 16000.0), gm, Transform3D.IDENTITY)
	(gen.get_child(gen.get_child_count() - 1) as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var depth := maxf(24.0, r_city * 0.05)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for ring in seat_poly:
		var n: int = ring.size()
		for i in n:
			var a: Vector2 = ring[i]
			var b: Vector2 = ring[(i + 1) % n]
			if a.distance_to(b) < 0.01:
				continue
			var t := (b - a).normalized()
			st.set_normal(Vector3(t.y, 0, -t.x))
			var top := Color(0.42, 0.33, 0.22)
			var bot := Color(0.24, 0.18, 0.12)
			for v in [[a, 0.0, top], [b, 0.0, top], [b, -depth, bot], [a, 0.0, top], [b, -depth, bot], [a, -depth, bot]]:
				st.set_color(v[2])
				st.add_vertex(Vector3(v[0].x, v[1], v[0].y))
	var em := StandardMaterial3D.new()
	em.vertex_color_use_as_albedo = true
	em.cull_mode = BaseMaterial3D.CULL_DISABLED
	em.roughness = 1.0
	_single(st.commit(), em, Transform3D.IDENTITY)


func _build_ground() -> void:
	var g := PlaneMesh.new()
	g.size = Vector2(40000, 40000)
	var gm := StandardMaterial3D.new()
	# soft painted grass: large yellow-green to deep-green patches
	gm.albedo_color = Color(1, 1, 1)
	gm.roughness = 1.0
	var nt := NoiseTexture2D.new()
	nt.width = 512
	nt.height = 512
	nt.seamless = true
	var fn := FastNoiseLite.new()
	fn.frequency = 0.006
	fn.fractal_octaves = 3
	fn.seed = seat_seed
	nt.noise = fn
	var ramp := Gradient.new()
	ramp.set_color(0, Color(0.33, 0.52, 0.24))
	ramp.set_color(1, Color(0.62, 0.7, 0.32))
	ramp.add_point(0.5, Color(0.45, 0.62, 0.27))
	nt.color_ramp = ramp
	gm.albedo_texture = nt
	gm.uv1_scale = Vector3(6, 6, 1)
	gm.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	# the land carries on past the boundary as plain grass (nothing is
	# built there: the occupancy raster is taken outside the seat)
	if land_rings.is_empty():
		_single(g, gm, Transform3D.IDENTITY)
		_ground_no_shadow()
	else:
		# the real shoreline: open water underneath, the land on top of it
		box(Vector3(0, -0.4, 0), Vector3(40000, 0.05, 40000), Color.WHITE, mat_water)
		gm.uv1_scale = Vector3(1, 1, 1)
		_single(_poly_mesh(land_rings, 0.0, 6.0 / 16000.0), gm, Transform3D.IDENTITY)
		_ground_no_shadow()
	# paved downtown (a smaller town centre in towns, none in villages)
	# warm, darker paving: the old light grey bleached to white in the sun
	if tier in ["metro", "city"]:
		_paving(r_core - 10.0)
	elif tier == "town" and layout == "radial":
		_paving(r_core * 0.6)


func _ground_no_shadow() -> void:
	# The 16 km ground must not cast shadows onto itself: with phone-sized
	# cascades that acne turned everything inside the shadow range grey
	# at night, and the patch moved as the camera rotated.
	(gen.get_child(gen.get_child_count() - 1) as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Lawns, planters and shade trees scattered over the paved centre, kept off
## roads and building lots.
func _plaza_greenery(radius: float) -> void:
	var placed := 0
	for i in 900:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * (radius - 6.0)
		var p := Vector3(cos(a) * r, 0, sin(a) * r)
		var w := rng.randf_range(10.0, 22.0)
		var d := rng.randf_range(8.0, 16.0)
		var yaw := rng.randf() * PI
		if not _rect_free(p, yaw, w, d):
			continue
		_mark_rect(p, yaw, w, d)
		box(p, Vector3(w, 0.08, d), Color(0.3, 0.5, 0.24).lerp(Color(0.4, 0.56, 0.28), rng.randf()), mat_lawn, yaw)
		box(p, Vector3(w + 0.6, 0.35, 0.35), C_KERB, null, yaw)
		for k in rng.randi_range(2, 4):
			tree(p + Basis(Vector3.UP, yaw) * Vector3(rng.randf_range(-w, w) * 0.4, 0, rng.randf_range(-d, d) * 0.4), rng.randf() < 0.35)
		placed += 1
		if placed >= int(radius * 0.35):
			break


# ── buildings ────────────────────────────────────────────────────────
## Flat-roof building with a plain roof slab and parapet over the windowed walls.
func flat_block(p: Vector3, size: Vector3, col: Color) -> void:
	box(p, size, col, mat_lowrise)
	box(p + Vector3(0, size.y, 0), Vector3(size.x + 0.3, 0.7, size.z + 0.3), col.darkened(0.12))


func _office_tower(p: Vector3, fw: float, fd: float, h: float) -> void:
	var col: Color = GLASS[rng.randi() % GLASS.size()]
	flat_block(p, Vector3(fw + 5, 7, fd + 5), Color(0.82, 0.8, 0.76))          # podium
	box(p + Vector3(0, 7, 0), Vector3(fw, h, fd), col, mat_glass)
	var top := p + Vector3(0, 7 + h, 0)
	if rng.randf() < 0.6:
		box(top, Vector3(fw * 0.7, h * 0.12, fd * 0.7), col, mat_glass)               # setback crown
		top.y += h * 0.12
		box(top, Vector3(fw * 0.7 + 0.4, 0.6, fd * 0.7 + 0.4), Color(0.6, 0.62, 0.64))
	else:
		box(top, Vector3(fw + 0.4, 0.8, fd + 0.4), Color(0.6, 0.62, 0.64))
	box(top + Vector3(0, 0.6, 0), Vector3(fw * 0.35, 3, fd * 0.3), Color(0.55, 0.56, 0.58))   # plant room
	if rng.randf() < 0.3:
		cyl(top + Vector3(0, 3.6, 0), 0.25, 14, Color(0.8, 0.2, 0.2))


func _terrace_row(p: Vector3, units: int, flip: bool) -> void:
	var unit := 6.0
	var depth := 10.0
	var h := 6.8
	var row_len := units * unit
	var roof: Color = ROOFS[rng.randi() % ROOFS.size()]
	for u in units:
		var x := -row_len * 0.5 + unit * 0.5 + u * unit
		var wall: Color = HOUSE_WALLS[rng.randi() % HOUSE_WALLS.size()]
		box(p + Vector3(x, 0, 0), Vector3(unit - 0.08, h, depth), wall, mat_lowrise)
		# porch wall + gate in the front yard
		var fz := (depth * 0.5 + 3.0) * (-1.0 if flip else 1.0)
		box(p + Vector3(x, 0, fz), Vector3(unit - 0.3, 1.1, 0.2), Color(0.92, 0.9, 0.86))
		box(p + Vector3(x + unit * 0.5 - 0.1, 0, fz * 0.75), Vector3(0.18, 1.1, 3.0), Color(0.92, 0.9, 0.86))
		# car porch roof
		box(p + Vector3(x, 2.7, fz * 0.6), Vector3(unit - 0.6, 0.18, 3.2), roof.darkened(0.15))
		if rng.randf() < 0.55:
			box(p + Vector3(x, 0, fz * 0.62), Vector3(1.8, 1.4, 4.0), SIGNS[rng.randi() % SIGNS.size()].lerp(Color.WHITE, 0.35), null, PI * 0.5)
	gable(p + Vector3(0, h, 0), row_len, depth, 3.0, roof)


## Residential condo tower: pale slab on a car-park podium, a coloured
## accent fin up the front, crown and water tanks on the roof.
func _condo(h: float) -> void:
	var col: Color = CONDO_WALLS[rng.randi() % CONDO_WALLS.size()]
	flat_block(Vector3.ZERO, Vector3(17, 9, 16), Color(0.78, 0.77, 0.74))
	box(Vector3(0, 9, 0.5), Vector3(14, h, 12), col, mat_lowrise)
	var accent: Color = CONDO_ACCENTS[rng.randi() % CONDO_ACCENTS.size()]
	box(Vector3(rng.randf_range(-3, 3), 9, -5.6), Vector3(1.6, h + 2.0, 0.8), accent)
	box(Vector3(0, 9 + h, 0.5), Vector3(14.6, 1.0, 12.6), col.darkened(0.15))
	box(Vector3(0, 10 + h, 0.5), Vector3(8, 4.0, 6), accent.lerp(Color.WHITE, 0.3))
	cyl(Vector3(4.5, 10 + h, 3.5), 1.2, 3.0, Color(0.85, 0.85, 0.82))


## Row of shophouses along the street: five-foot-way canopy and shop
## signs on the front (-z), clay-tile roofs, 2-3 storeys.
func _shophouse_row(units: int) -> void:
	var unit := 6.0
	var depth := 12.0
	var h := rng.randi_range(2, 3) * 3.6
	var row := units * unit
	for u in units:
		var x := -row * 0.5 + unit * 0.5 + u * unit
		var wall: Color = SHOPHOUSE_WALLS[rng.randi() % SHOPHOUSE_WALLS.size()]
		box(Vector3(x, 0, 0.6), Vector3(unit - 0.1, h, depth), wall, mat_lowrise)
		box(Vector3(x, 3.4, -5.55), Vector3(unit - 0.6, 1.0, 0.3), SIGNS[rng.randi() % SIGNS.size()])
		box(Vector3(x, 3.1, -6.4), Vector3(unit, 0.25, 2.0), Color(0.86, 0.84, 0.8))
		var b := Basis(Vector3.UP, PI * 0.5) * Basis.from_scale(Vector3(depth + 0.6, 2.2, unit))
		_add(prism_mesh, mat_roof, Transform3D(b, Vector3(x, h + 1.1, 0.6)), ROOFS[rng.randi() % 3])


func _bungalow() -> void:
	var w := rng.randf_range(8, 10)
	var dd := rng.randf_range(7, 8.5)
	var h := rng.randf_range(3.6, 7.2)
	box(Vector3(0, 0, 1), Vector3(w, h, dd), HOUSE_WALLS[rng.randi() % HOUSE_WALLS.size()], mat_lowrise)
	gable(Vector3(0, h, 1), w, dd, rng.randf_range(2.4, 3.4), ROOFS[rng.randi() % ROOFS.size()])
	# boundary wall with a gate gap at the front
	var fc := Color(0.9, 0.88, 0.84)
	box(Vector3(-4.8, 0, -7.4), Vector3(5.2, 1.3, 0.25), fc)
	box(Vector3(4.8, 0, -7.4), Vector3(5.2, 1.3, 0.25), fc)
	box(Vector3(0, 0, 7.4), Vector3(14.8, 1.3, 0.25), fc)
	box(Vector3(-7.4, 0, 0), Vector3(0.25, 1.3, 14.8), fc)
	box(Vector3(7.4, 0, 0), Vector3(0.25, 1.3, 14.8), fc)
	box(Vector3(0, 0, -5.4), Vector3(4.0, 0.03, 4.0), Color(0.55, 0.55, 0.53))   # driveway
	if rng.randf() < 0.6:
		box(Vector3(0, 0, -5.2), Vector3(1.8, 1.4, 4.0), SIGNS[rng.randi() % SIGNS.size()].lerp(Color.WHITE, 0.35), null, PI * 0.5)
	tree(Vector3(rng.randf_range(-5, 5), 0, 6.0), rng.randf() < 0.5)


## Rumah berkembar: two mirrored houses under one roof, a shared party
## wall down the middle, a car porch and gate each.
func _semi_detached() -> void:
	var w := rng.randf_range(7.5, 8.5)
	var dd := rng.randf_range(8.0, 9.5)
	var h := rng.randf_range(6.4, 7.4)
	var wall: Color = HOUSE_WALLS[rng.randi() % HOUSE_WALLS.size()]
	for sx in [-1.0, 1.0]:
		box(Vector3(sx * w * 0.5, 0, 1), Vector3(w, h, dd), wall.lerp(Color.WHITE, 0.08 * (sx + 1.0)), mat_lowrise)
		box(Vector3(sx * w * 0.55, 0, -5.4), Vector3(3.6, 0.03, 4.0), Color(0.55, 0.55, 0.53))   # porch
	gable(Vector3(0, h, 1), w * 2.0, dd, rng.randf_range(2.4, 3.0), ROOFS[rng.randi() % ROOFS.size()])
	var fc := Color(0.9, 0.88, 0.84)
	box(Vector3(0, 0, 7.4), Vector3(19.6, 1.3, 0.25), fc)
	box(Vector3(0, 0, 0), Vector3(0.25, 1.3, 14.6), fc)
	if rng.randf() < 0.6:
		box(Vector3(-w * 0.55, 0, -5.2), Vector3(1.8, 1.4, 4.0), SIGNS[rng.randi() % SIGNS.size()].lerp(Color.WHITE, 0.35), null, PI * 0.5)


## Gudang: a long low warehouse with a shallow roof, loading bays and a
## lorry at the dock.
func _warehouse() -> void:
	var col := Color(0.78, 0.79, 0.8).lerp(Color(0.62, 0.68, 0.74), rng.randf())
	var h := rng.randf_range(7.0, 9.0)
	box(Vector3(0, 0, 2), Vector3(34, h, 20), col, mat_lowrise)
	gable(Vector3(0, h, 2), 34, 20, 1.6, Color(0.5, 0.56, 0.62).lerp(Color(0.32, 0.42, 0.55), rng.randf()))
	for k in 4:
		box(Vector3(-12 + k * 8, 0, -8.1), Vector3(4.2, 4.6, 0.3), Color(0.42, 0.44, 0.46))   # roller doors
	box(Vector3(0, 0, -11), Vector3(34, 0.04, 5), Color(0.4, 0.4, 0.4))                     # apron
	if rng.randf() < 0.7:
		box(Vector3(rng.randf_range(-10, 10), 0, -11.5), Vector3(2.4, 3.2, 8.0), Color(0.92, 0.92, 0.9), null, PI * 0.5)


## Rumah kampung on stilts, tangga at the front, fruit trees behind.
func _kampung_house() -> void:
	var w := rng.randf_range(7, 9)
	var dd := rng.randf_range(6, 8)
	var wood := Color(0.55, 0.38, 0.24).lerp(Color(0.72, 0.56, 0.38), rng.randf())
	# the stilts read as one dark under-floor block at true scale
	box(Vector3.ZERO, Vector3(w - 0.8, 1.4, dd - 0.8), Color(0.35, 0.26, 0.18))
	box(Vector3(0, 1.4, 0), Vector3(w, 3.0, dd), wood)
	gable(Vector3(0, 4.4, 0), w, dd, 3.6, ZINC[rng.randi() % ZINC.size()])
	tree(Vector3(rng.randf_range(-5, 5), 0, rng.randf_range(3.5, 5.5)), rng.randf() < 0.65)
	if rng.randf() < 0.5:
		tree(Vector3(rng.randf_range(-5, 5), 0, rng.randf_range(3.5, 5.5)), rng.randf() < 0.65)


## Merdeka 118: faceted tiers stepping in as they rise, then a long spire.
func _merdeka118() -> void:
	flat_block(Vector3.ZERO, Vector3(28, 10, 28), Color(0.82, 0.84, 0.86))
	var y := 10.0
	for i in 9:
		var r := lerpf(11.0, 4.5, float(i) / 8.0)
		var h := 13.2 if i < 8 else 9.4
		var b := Basis(Vector3.UP, i * 0.13) * Basis.from_scale(Vector3(r * 2.0, h, r * 2.0))
		_single(oct_mesh, mat_landmark, Transform3D(b, Vector3(0, y + h * 0.5, 0)))
		y += h
	var spire := CylinderMesh.new()
	spire.top_radius = 0.08
	spire.bottom_radius = 1.6
	spire.height = 45
	_single(spire, mat_landmark, Transform3D(Basis(), Vector3(0, y + 22.5, 0)))


## Dataran for every seat that is not Bukit Bintang: padang with its
## white rail, a clock tower at the head, flagpole and shade trees.
func _town_square(sz: float) -> void:
	box(Vector3.ZERO, Vector3(sz, 0.05, sz * 0.7), Color(0.38, 0.6, 0.3))
	var w := Color(0.95, 0.95, 0.92)
	for z in [-sz * 0.35, sz * 0.35]:
		box(Vector3(0, 0, z), Vector3(sz, 0.7, 0.2), w)
	for x in [-sz * 0.5, sz * 0.5]:
		box(Vector3(x, 0, 0), Vector3(0.2, 0.7, sz * 0.7), w)
	var ct := Vector3(0, 0, -sz * 0.42)
	box(ct, Vector3(4, 18, 4), Color(0.95, 0.92, 0.84), mat_lowrise)
	box(ct + Vector3(0, 18, 0), Vector3(4.6, 0.6, 4.6), Color(0.8, 0.76, 0.66))
	for f in [Vector3(0, 0, -2.05), Vector3(0, 0, 2.05)]:
		box(ct + f + Vector3(0, 14.2, 0), Vector3(2.4, 2.4, 0.1), Color.WHITE)
	ball(ct + Vector3(0, 19.6, 0), Vector3(3.8, 4.4, 3.8), Color("8e3f2e"))
	cyl(Vector3(sz * 0.3, 0, -sz * 0.42), 0.12, 12, Color(0.9, 0.9, 0.9))
	box(Vector3(sz * 0.3 + 1.2, 10.4, -sz * 0.42), Vector3(2.4, 1.4, 0.05), Color(0.8, 0.1, 0.12))
	for k in 6:
		tree(Vector3(rng.randf_range(-sz * 0.45, sz * 0.45), 0, sz * 0.42), rng.randf() < 0.5)


func _lake() -> void:
	var water := CylinderMesh.new()
	water.top_radius = 0.5
	water.bottom_radius = 0.5
	water.height = 0.1
	water.radial_segments = 24
	_single(water, mat_water, Transform3D(Basis.from_scale(Vector3(56, 1, 38)), Vector3(0, 0.05, 0)))
	for k in 16:
		var a := TAU * k / 16.0
		tree(Vector3(cos(a) * 31.0, 0, sin(a) * 22.0), rng.randf() < 0.3)


func _factory() -> void:
	var col := Color(0.66, 0.7, 0.74)
	box(Vector3(0, 0, 1), Vector3(26, 8, 18), col, mat_lowrise)
	for k in 3:
		var b := Basis(Vector3.UP, PI * 0.5) * Basis.from_scale(Vector3(6.0, 2.4, 26.4))
		_add(prism_mesh, mat_plain, Transform3D(b, Vector3(0, 9.2, -5.0 + k * 6.0)), Color(0.55, 0.6, 0.66))
	cyl(Vector3(9, 0, 7), 1.0, 22, Color(0.75, 0.72, 0.7))
	box(Vector3(0, 0, -9), Vector3(20, 0.04, 4), Color(0.4, 0.4, 0.4))


## Telecom tower on a small plaza: tapering shaft, observation pod, mast.
func _telecom() -> void:
	flat_block(Vector3.ZERO, Vector3(14, 6, 14), Color(0.85, 0.84, 0.8))
	var sh := CylinderMesh.new()
	sh.top_radius = 1.8
	sh.bottom_radius = 3.4
	sh.height = 66
	_single(sh, mat_landmark, Transform3D(Basis(), Vector3(0, 6 + 33, 0)))
	ball(Vector3(0, 69, 0), Vector3(12, 7, 12), Color(0.92, 0.93, 0.95), mat_landmark)
	ball(Vector3(0, 74, 0), Vector3(7, 4, 7), Color(0.92, 0.93, 0.95), mat_landmark)
	cyl(Vector3(0, 76, 0), 0.4, 26, Color(0.9, 0.9, 0.9))
	cyl(Vector3(0, 102, 0), 0.2, 3, Color(1, 0.2, 0.2))
	for k in 4:
		tree(Vector3([-8.5, 8.5][k % 2], 0, [-8.5, 8.5][k / 2]), true)


func _park(g: Vector3, with_tower: bool) -> void:
	box(g + Vector3(-6, 0, 6), Vector3(16, 0.05, 12), Color.WHITE, mat_water)
	for k in 26:
		var p := g + Vector3(rng.randf_range(-18, 18), 0, rng.randf_range(-18, 18))
		if p.distance_to(g + Vector3(-6, 0, 6)) < 9.0:
			continue
		tree(p, rng.randf() < 0.3)
	# footpath loop
	box(g + Vector3(0, 0, -15), Vector3(34, 0.04, 2), Color(0.8, 0.74, 0.62))
	box(g + Vector3(15, 0, 0), Vector3(2, 0.04, 32), Color(0.8, 0.74, 0.62))
	if with_tower:
		# telecom tower: tapering shaft, observation pod, mast
		var p := g + Vector3(8, 0, -6)
		flat_block(p, Vector3(14, 6, 14), Color(0.85, 0.84, 0.8))
		var sh := CylinderMesh.new()
		sh.top_radius = 1.8
		sh.bottom_radius = 3.4
		sh.height = 150
		_single(sh, mat_landmark, Transform3D(Basis(), p + Vector3(0, 6 + 75, 0)))
		ball(p + Vector3(0, 128, 0), Vector3(15, 10, 15), Color(0.92, 0.93, 0.95), mat_landmark)
		ball(p + Vector3(0, 136, 0), Vector3(9, 5, 9), Color(0.92, 0.93, 0.95), mat_landmark)
		cyl(p + Vector3(0, 138, 0), 0.5, 38, Color(0.9, 0.9, 0.9))
		cyl(p + Vector3(0, 176, 0), 0.25, 6, Color(1, 0.2, 0.2))


func _field(g: Vector3) -> void:
	box(g, Vector3(32, 0.04, 22), Color(0.36, 0.62, 0.3))
	var w := Color(0.95, 0.95, 0.95)
	for z in [-11.0, 11.0]:
		box(g + Vector3(0, 0, z), Vector3(32, 0.06, 0.3), w)
	for x in [-16.0, 0.0, 16.0]:
		box(g + Vector3(x, 0, 0), Vector3(0.3, 0.06, 22), w)
	for x in [-16.0, 16.0]:
		box(g + Vector3(x, 0, -2.5), Vector3(0.3, 2.4, 0.3), w)
		box(g + Vector3(x, 0, 2.5), Vector3(0.3, 2.4, 0.3), w)
	for k in 10:
		tree(g + Vector3(rng.randf_range(-18, 18), 0, [-16.5, 16.5][k % 2]), false)


func _school(g: Vector3) -> void:
	var cream := Color(0.96, 0.93, 0.82)
	var blue := Color(0.3, 0.48, 0.72)
	# U-shaped blocks around a quad: walls cream, roof trims blue
	for spec in [[Vector3(0, 0, -13), Vector3(34, 10.8, 9)], [Vector3(-13, 0, 4), Vector3(9, 10.8, 22)], [Vector3(13, 0, 4), Vector3(9, 10.8, 22)]]:
		var p: Vector3 = g + spec[0]
		var s: Vector3 = spec[1]
		box(p, s, cream, mat_lowrise)
		box(p + Vector3(0, s.y, 0), s + Vector3(0.6, -s.y + 0.6, 0.6), blue)
	box(g + Vector3(0, 0, 4), Vector3(14, 0.04, 18), Color(0.7, 0.32, 0.28))     # court
	cyl(g + Vector3(0, 0, 15), 0.12, 10, Color(0.9, 0.9, 0.9))                   # flagpole
	box(g + Vector3(1.2, 8.4, 15), Vector3(2.4, 1.4, 0.05), Color(0.8, 0.1, 0.12))


func _masjid(g: Vector3) -> void:
	var cream := Color(0.97, 0.95, 0.88)
	var dome := Color(0.18, 0.5, 0.42) if rng.randf() < 0.5 else Color(0.2, 0.36, 0.62)
	box(g + Vector3(0, 0, 2), Vector3(22, 9, 22), cream, mat_lowrise)
	box(g + Vector3(0, 9, 2), Vector3(23, 0.8, 23), dome.darkened(0.2))
	cyl(g + Vector3(0, 9.8, 2), 6.5, 3, cream, null, oct_mesh)
	ball(g + Vector3(0, 12.8, 2), Vector3(14, 12, 14), dome)
	cyl(g + Vector3(0, 18.6, 2), 0.15, 2.5, Color(0.9, 0.8, 0.3))
	for sx in [-1.0, 1.0]:
		var mp := g + Vector3(sx * 15, 0, -12)
		cyl(mp, 1.2, 30, cream, null, oct_mesh)
		box(mp + Vector3(0, 24, 0), Vector3(3.4, 0.6, 3.4), dome.darkened(0.2))
		ball(mp + Vector3(0, 31, 0), Vector3(2.6, 3.2, 2.6), dome)
	box(g + Vector3(0, 0, -13), Vector3(14, 0.04, 8), Color(0.85, 0.82, 0.76))   # courtyard
	for k in 6:
		tree(g + Vector3(rng.randf_range(-18, 18), 0, rng.randf_range(14, 18)), true)


func _twin_towers(g: Vector3) -> void:
	# podium linking both towers
	flat_block(g, Vector3(36, 9, 24), Color(0.84, 0.84, 0.86))
	for sx in [-1.0, 1.0]:
		var p := g + Vector3(sx * 9.5, 9, 0)
		var y := 0.0
		# tiers: (radius, height) tapering towards the pinnacle
		for tier in [[6.4, 60.0], [5.6, 9.0], [4.8, 6.0], [3.8, 4.5], [2.8, 3.5], [1.8, 2.5]]:
			var r: float = tier[0]
			var h: float = tier[1]
			var m := oct_mesh
			_single(m, mat_landmark, Transform3D(Basis.from_scale(Vector3(r * 2, h, r * 2)), p + Vector3(0, y + h * 0.5, 0)))
			_single(m, mat_landmark, Transform3D(Basis(Vector3.UP, PI / 8) * Basis.from_scale(Vector3(r * 2, h, r * 2)), p + Vector3(0, y + h * 0.5, 0)))
			y += h
		var spire := CylinderMesh.new()
		spire.top_radius = 0.05
		spire.bottom_radius = 0.9
		spire.height = 18.5
		_single(spire, mat_landmark, Transform3D(Basis(), p + Vector3(0, y + 9.25, 0)))
	# skybridge with its supporting legs
	_single(box_mesh, mat_landmark, Transform3D(Basis.from_scale(Vector3(7.2, 3.4, 3.0)), g + Vector3(0, 42.5, 0)))
	for sx in [-1.0, 1.0]:
		var leg := Basis(Vector3.FORWARD, sx * 0.55) * Basis.from_scale(Vector3(0.6, 11, 0.6))
		_single(box_mesh, mat_landmark, Transform3D(leg, g + Vector3(sx * 6.0, 37.0, 0)))
	# fountain plaza in front
	box(g + Vector3(0, 0, 16), Vector3(18, 0.3, 4), Color.WHITE, mat_water)


func _mall(g: Vector3) -> void:
	flat_block(g, Vector3(36, 16, 30), Color(0.9, 0.88, 0.84))
	box(g + Vector3(0, 6, -15.2), Vector3(30, 3, 0.6), Color(0.85, 0.2, 0.25))   # signage band
	box(g + Vector3(0, 16, 0), Vector3(20, 4, 14), Color(0.55, 0.65, 0.72), mat_glass)
	box(g + Vector3(0, 0, -17.4), Vector3(36, 3.6, 1.2), Color(0.95, 0.95, 0.95))  # entrance canopy


## Sample seat profiles for `--seat=` screenshots (same shape the game sends).
const TEST_SEATS := {
	"strip": {"code": "T1", "density": 0.45, "traits": {}, "layout": "strip"},
	"oldtown": {"code": "T2", "density": 0.7, "traits": {}, "layout": "oldtown"},
	"taman": {"code": "T3", "density": 0.5, "traits": {}, "layout": "taman"},
	"petalingjaya": {"code": "P.105", "density": 0.9, "popDensity": 7000, "traits": {}},
	"bukitbintang": {"code": "P.120", "density": 0.9, "traits": {"klLandmarks": true, "bukitBintang": true}},
	"kualaselangor": {"code": "P.095", "density": 0.9, "traits": {"coastal": true, "paddy": true}},
	"ipoh": {"code": "P.064", "density": 0.7, "traits": {"hilly": true, "industrial": true}},
	"kampung": {"code": "P.001", "density": 0.2, "traits": {"paddy": true}},
	"ranau": {"code": "P.177", "density": 0.25, "traits": {"hilly": true, "kinabalu": true}},
}

# ── command line / screenshots ───────────────────────────────────────
func _apply_cli() -> void:
	var shot := ""
	var rig := $CameraRig
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			shot = a.substr(7)
		elif a.begins_with("--tod="):
			set_tod(int(a.substr(6)))
		elif a.begins_with("--view="):
			rig.preset(a.substr(7))
		elif a.begins_with("--seat="):
			apply_profile.call_deferred(TEST_SEATS.get(a.substr(7), {}))
	if shot != "":
		for i in 120:
			await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(shot)
		get_tree().quit()
