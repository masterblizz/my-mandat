# Kawasan 3D City (Godot)

Godot 4.7 recreation of the MY MANDAT `/kawasan-3d` city: a procedural
Malaysian city generated at startup. It's a standalone project, separate
from the Super Takraw League project in `GodotMCP`.

- Office-tower core around a twin-tower landmark, a telecom tower and a mall
- Shophouse rows with five-foot-way canopies, shop signs and genting roofs
- Taman terrace rows, bungalows behind boundary walls, kampung houses on stilts
- Masjid, schools, parks with ponds, a football field, a river with tree-lined banks
- Cars driving on the left, plus lane markings and zebra crossings
- Day, dusk and night lighting with lit office and house windows

## Run

Open the folder in Godot 4.7 and press F5, or:

    Godot_v4.7.2-stable_win64_console.exe --path C:\Users\maste\KawasanGodot

## Controls

| Input | Action |
| --- | --- |
| Left drag | Orbit |
| Right / middle / Shift+left drag, WASD, arrows | Pan |
| Mouse wheel, pinch | Zoom |
| Q / E | Rotate |
| T | Day, dusk, night |
| R | Reset camera |

## Screenshots from the command line

    Godot...exe --path . -- --shot=out.png --view=city|core|taman|street --tod=0|1|2

## Files

- `city.gd`: generator, materials, lighting and time of day
- `camera_rig.gd`: eased orbit, pan and zoom camera
- `traffic.gd`: cars as MultiMesh instances
