"""Key the flat ground out of the home hero photograph.

The photograph ships with a solid near-black field baked in, which is
why the hero panel was painted #171b20: any other colour behind it and
the picture reads as a dark rectangle pasted on the page. The panel now
follows the theme, so the picture has to carry its own alpha.

The ground is one flat colour, so the cut is a flood fill from the
border rather than a colour threshold over the whole frame: black tyres
and shadow inside the machines are the same value as the ground, and a
threshold would punch holes through them.

    python3 scripts/cut-hero-art.py

Requires Pillow and numpy; writes src/assets/home-mining.webp in place.
"""
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

SRC = "src/assets/home-mining.webp"
TOLERANCE = 10      # the ground is flat to within 5; anything looser eats the tyres
FEATHER = 1.1       # blur radius on the alpha edge, in pixels

img = Image.open(SRC).convert("RGB")
rgb = np.asarray(img).astype(np.int16)
h, w, _ = rgb.shape

corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])
ground = np.median(corners, axis=0)
near = (np.abs(rgb - ground).max(axis=2) <= TOLERANCE)

# Flood fill inwards from every border pixel that matches the ground.
seen = np.zeros((h, w), dtype=bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if near[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if near[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True
            q.append((ny, nx))

alpha = Image.fromarray(np.where(seen, 0, 255).astype(np.uint8))
# Erode one pixel before feathering: the half-covered pixels along the
# cut still carry the old ground in their RGB, and eroding first stops
# that dark fringe from surviving as a halo on a light panel.
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(FEATHER))

out = img.copy()
out.putalpha(alpha)
out.save(SRC, "WEBP", quality=90, method=6)
print(f"{SRC}: ground {tuple(int(c) for c in ground)}, {int(seen.sum() / seen.size * 100)}% cut")
