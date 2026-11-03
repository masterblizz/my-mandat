extends Node
## Picks the location from the page URL (?scene=office|warroom) so every
## location shares one engine download. Defaults to the office.

const LOCATIONS := {
	"office": "res://main.gd",
	"warroom": "res://warroom.gd",
	"studio": "res://studio.gd",
}

func _ready() -> void:
	var scene := "office"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--scene="):
			scene = arg.substr(8)
	if OS.has_feature("web"):
		var q = JavaScriptBridge.eval("new URLSearchParams(window.location.search).get('scene') || ''", true)
		if typeof(q) == TYPE_STRING and LOCATIONS.has(q):
			scene = q
	var world: Node3D = load(LOCATIONS.get(scene, LOCATIONS["office"])).new()
	world.name = "World"
	add_child(world)
