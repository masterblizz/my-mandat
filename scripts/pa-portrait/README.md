# PA headshots from the office cast

`public/assistant/pa-*-3d.png` are rendered from the 3D office's own PA
models (`godot/world/cast/pa_male.glb`, `pa_female.glb`) in their standing
pose, so the assistant in dialogs matches the one in the office.

Re-render (Godot 4.3, any GL display; Xvfb works):

    cp scripts/pa-portrait/capture.gd godot/world/
    xvfb-run -a godot --audio-driver Dummy --rendering-driver opengl3 \
      --resolution 512x512 --path godot/world --script capture.gd -- pa_female out.png 0.3
    rm godot/world/capture.gd

then crop to head and shoulders (a 300 px square round the face) and
scale to 320×320 into `public/assistant/`.
