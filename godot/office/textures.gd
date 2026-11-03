extends RefCounted
## Procedural textures for the office: floors (carpet, tiles, parquet) and
## Malaysian motifs (songket, batik, sejadah, Jalur Gemilang). Generated once
## at start-up so the export stays small and every pattern tiles cleanly.

static func _tex(img: Image) -> ImageTexture:
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

static func _jitter(c: Color, amount: float, rng: RandomNumberGenerator) -> Color:
	var d := rng.randf_range(-amount, amount)
	return Color(clamp(c.r + d, 0.0, 1.0), clamp(c.g + d, 0.0, 1.0), clamp(c.b + d, 0.0, 1.0), c.a)

## Cut-pile carpet: dense flecks of lighter and darker fibre; optional
## carpet-tile seams every `seam` pixels.
static func carpet(base: Color, fleck: Color, seam := 0, size := 128, seed_ := 1) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(base)
	for i in size * size / 3:
		var x := rng.randi_range(0, size - 1)
		var y := rng.randi_range(0, size - 1)
		var c := base.lerp(fleck, rng.randf_range(0.2, 0.9)) if rng.randf() < 0.45 else _jitter(base, 0.05, rng)
		img.set_pixel(x, y, c)
	if seam > 0:
		var line := base.darkened(0.22)
		for s in range(0, size, seam):
			img.fill_rect(Rect2i(s, 0, 1, size), line)
			img.fill_rect(Rect2i(0, s, size, 1), line)
	return _tex(img)

## Square floor tiles with grout and a faint mottled glaze.
static func tiles(base: Color, grout: Color, size := 128, seed_ := 2) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(base)
	for i in 900:
		var x := rng.randi_range(0, size - 2)
		var y := rng.randi_range(0, size - 2)
		img.fill_rect(Rect2i(x, y, 2, 2), _jitter(base, 0.035, rng))
	img.fill_rect(Rect2i(0, 0, size, 2), grout)
	img.fill_rect(Rect2i(0, 0, 2, size), grout)
	return _tex(img)

## Terrazzo: a cream ground with scattered stone chips.
static func terrazzo(base: Color, size := 128, seed_ := 3) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(base)
	var chips := [Color("#8c8273"), Color("#a39275"), Color("#6f7a80"), Color("#c2b294"), Color("#8f5a46")]
	for i in 200:
		var w := rng.randi_range(1, 4)
		img.fill_rect(Rect2i(rng.randi_range(0, size - w), rng.randi_range(0, size - w), w, w), chips[rng.randi() % chips.size()])
	return _tex(img)

## Chengal-style parquet: four planks per tile with grain lines and seams.
static func parquet(base: Color, size := 128, seed_ := 4) -> ImageTexture:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var plank := size / 4
	for p in 4:
		var tone := _jitter(base, 0.06, rng)
		img.fill_rect(Rect2i(0, p * plank, size, plank), tone)
		for g in 10:
			var y := p * plank + rng.randi_range(1, plank - 2)
			var x0 := rng.randi_range(0, size / 2)
			img.fill_rect(Rect2i(x0, y, rng.randi_range(size / 4, size / 2), 1), tone.darkened(rng.randf_range(0.06, 0.14)))
		img.fill_rect(Rect2i(0, p * plank, size, 1), base.darkened(0.35))
		var cut := (p * 37 + 20) % size
		img.fill_rect(Rect2i(cut, p * plank, 1, plank), base.darkened(0.35))
	return _tex(img)

## Songket: maroon silk with gold supplementary-weft motifs — a diamond
## lattice (pucuk rebung style bands top and bottom) that tiles.
static func songket(ground := Color("#6e1423"), gold := Color("#d9a63a"), size := 128) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	img.fill(ground)
	var cell := size / 4
	for y in size:
		for x in size:
			var cx := x % cell - cell / 2
			var cy := y % cell - cell / 2
			var d: int = abs(cx) + abs(cy)
			# nested diamonds with a gold core
			if d == cell / 2 - 2 or d == cell / 2 - 6 or d < 3:
				img.set_pixel(x, y, gold)
			elif d == cell / 2 - 4:
				img.set_pixel(x, y, gold.darkened(0.35))
			# fine gold weft every 4 rows inside the diamond
			elif d < cell / 2 - 6 and y % 4 == 0:
				img.set_pixel(x, y, ground.lerp(gold, 0.35))
	return _tex(img)

## A rug: songket field with a solid border, for a single plane (UV 0..1).
static func songket_rug(w := 256, h := 160) -> ImageTexture:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var ground := Color("#6e1423")
	var gold := Color("#d9a63a")
	img.fill(ground)
	var cell := 32
	for y in h:
		for x in w:
			var cx := x % cell - cell / 2
			var cy := y % cell - cell / 2
			var d: int = abs(cx) + abs(cy)
			if d == 12 or d < 3:
				img.set_pixel(x, y, gold)
			elif d == 8:
				img.set_pixel(x, y, gold.darkened(0.3))
	# border bands with pucuk rebung (bamboo shoot) triangles
	img.fill_rect(Rect2i(0, 0, w, 14), Color("#2a0a10"))
	img.fill_rect(Rect2i(0, h - 14, w, 14), Color("#2a0a10"))
	img.fill_rect(Rect2i(0, 0, 10, h), Color("#2a0a10"))
	img.fill_rect(Rect2i(w - 10, 0, 10, h), Color("#2a0a10"))
	for x in w:
		var t := x % 16
		var ht: int = 8 - abs(t - 8)
		for y in ht:
			img.set_pixel(x, 13 - y, gold)
			img.set_pixel(x, h - 14 + y, gold)
	return _tex(img)

## Batik: hibiscus-like blooms on indigo with cracked-wax veins.
static func batik(size := 128) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var ground := Color("#1f3a5f")
	var petal := Color("#e0694a")
	var core := Color("#f2c14e")
	var leaf := Color("#3d8a6a")
	var cell := size / 2
	for y in size:
		for x in size:
			var lx := float(x % cell) - cell / 2.0
			var ly := float(y % cell) - cell / 2.0
			var r := sqrt(lx * lx + ly * ly) / (cell / 2.0)
			var a := atan2(ly, lx)
			var petal_r := 0.55 + 0.22 * cos(a * 5.0)
			var c := ground
			if r < 0.16:
				c = core
			elif r < petal_r:
				c = petal.lerp(petal.darkened(0.3), r)
			elif r < 0.95 and abs(sin(a * 3.0 + r * 6.0)) < 0.12:
				c = leaf
			# wax-crack veins
			if fposmod(x * 0.37 + y * 0.11 + sin(y * 0.2) * 3.0, 23.0) < 0.6:
				c = c.darkened(0.25)
			img.set_pixel(x, y, c)
	return _tex(img)

## Sejadah (prayer mat) with a mihrab arch, for one plane.
static func sejadah(base := Color("#1f5f4a"), w := 96, h := 160) -> ImageTexture:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var gold := Color("#d9a63a")
	img.fill(base)
	img.fill_rect(Rect2i(0, 0, w, 6), gold)
	img.fill_rect(Rect2i(0, h - 6, w, 6), gold)
	img.fill_rect(Rect2i(0, 0, 5, h), gold)
	img.fill_rect(Rect2i(w - 5, 0, 5, h), gold)
	var cx := w / 2.0
	for y in range(10, h - 10):
		for x in range(9, w - 9):
			# arch: a rectangle topped by a pointed curve
			var inside := false
			if y > 52:
				inside = x > 20 and x < w - 20 and y < h - 20
			else:
				var dx: float = abs(x - cx)
				inside = y > 18 + dx * dx / 22.0 and dx < cx - 20
			if inside:
				var edge := x == 21 or x == w - 21 or y == h - 21
				img.set_pixel(x, y, gold if edge else base.lightened(0.12))
	# small motif rows at the foot
	for x in range(14, w - 14, 8):
		img.fill_rect(Rect2i(x, h - 16, 4, 4), gold)
	return _tex(img)

## Jalur Gemilang: 14 red/white stripes, blue canton, yellow crescent and
## 14-point star. 2:1 flag.
static func jalur_gemilang(w := 256, h := 128) -> ImageTexture:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var red := Color("#cc0001")
	var white := Color("#ffffff")
	var blue := Color("#010066")
	var yellow := Color("#ffcc00")
	for i in 14:
		var y0 := int(round(i * h / 14.0))
		var y1 := int(round((i + 1) * h / 14.0))
		img.fill_rect(Rect2i(0, y0, w, y1 - y0), red if i % 2 == 0 else white)
	var ch := int(round(8 * h / 14.0))
	var cw := w / 2
	img.fill_rect(Rect2i(0, 0, cw, ch), blue)
	var ccx := cw * 0.36
	var ccy := ch / 2.0
	var R := ch * 0.40
	var scx := cw * 0.68
	var sr := ch * 0.30
	for y in ch:
		for x in cw:
			var dx := x - ccx
			var dy := y - ccy
			var in_outer := dx * dx + dy * dy < R * R
			var dx2 := x - (ccx + R * 0.24)
			var in_inner := dx2 * dx2 + dy * dy < (R * 0.86) * (R * 0.86)
			if in_outer and not in_inner:
				img.set_pixel(x, y, yellow)
			var sx := x - scx
			var sy := y - ccy
			var rr := sqrt(sx * sx + sy * sy)
			var a := atan2(sy, sx)
			var lim := sr * (0.42 + 0.58 * pow(abs(cos(a * 7.0)), 6.0))
			if rr < lim:
				img.set_pixel(x, y, yellow)
	return _tex(img)

## Ukiran: a carved timber panel (awan larat scrolls) for wall screens.
static func ukiran(size := 128) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var wood := Color("#7a4a26")
	img.fill(wood)
	for y in size:
		for x in size:
			var u := x / float(size) * TAU * 2.0
			var v := y / float(size) * TAU * 2.0
			var s := sin(u + sin(v) * 1.6) * cos(v * 0.5 + sin(u * 0.5))
			if abs(s) < 0.12:
				img.set_pixel(x, y, wood.darkened(0.45))
			elif s > 0.55:
				img.set_pixel(x, y, wood.lightened(0.12))
	img.fill_rect(Rect2i(0, 0, size, 4), wood.darkened(0.3))
	img.fill_rect(Rect2i(0, 0, 4, size), wood.darkened(0.3))
	return _tex(img)
