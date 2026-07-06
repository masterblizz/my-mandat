from collections import deque
from pathlib import Path
import sys
from PIL import Image, ImageFilter

if len(sys.argv) != 3:
    raise SystemExit("usage: edge-transparent-portrait.py input.png output.png")

src = Path(sys.argv[1])
out = Path(sys.argv[2])
img = Image.open(src).convert("RGBA")
w, h = img.size
pix = img.load()

# Only remove light studio/backdrop pixels that are connected to the outer edge.
# This avoids the old global colorkey bug where white eye highlights/teeth/skin
# highlights became transparent and appeared as black lines on dark UI panels.
def is_backdrop(x, y):
    r, g, b, a = pix[x, y]
    if a < 8:
        return True
    # near-white / very light neutral background; reject saturated skin/clothes
    return r >= 224 and g >= 224 and b >= 224 and (max(r, g, b) - min(r, g, b)) <= 30

seen = bytearray(w * h)
mask = Image.new("L", (w, h), 0)
mask_pix = mask.load()
q = deque()

def add(x, y):
    if x < 0 or y < 0 or x >= w or y >= h:
        return
    idx = y * w + x
    if seen[idx]:
        return
    seen[idx] = 1
    if is_backdrop(x, y):
        q.append((x, y))

for x in range(w):
    add(x, 0)
    add(x, h - 1)
for y in range(h):
    add(0, y)
    add(w - 1, y)

while q:
    x, y = q.popleft()
    mask_pix[x, y] = 255
    add(x + 1, y)
    add(x - 1, y)
    add(x, y + 1)
    add(x, y - 1)

# Feather the removed edge slightly so portraits sit cleanly on dark/light themes.
soft = mask.filter(ImageFilter.GaussianBlur(0.7))
out_img = img.copy()
out_pix = out_img.load()
soft_pix = soft.load()
for y in range(h):
    for x in range(w):
        remove = soft_pix[x, y]
        if remove:
            r, g, b, a = out_pix[x, y]
            new_a = max(0, int(a * (255 - remove) / 255))
            out_pix[x, y] = (r, g, b, new_a)

out.parent.mkdir(parents=True, exist_ok=True)
out_img.save(out)
