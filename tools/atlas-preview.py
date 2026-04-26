#!/usr/bin/env python3
"""Label every frame in a 12×11 16×16 packed atlas with its index.

Outputs a 4× scaled grid where each cell is the frame + a small index label
above it, so the rendered image is readable enough to identify each frame.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

src = sys.argv[1]
dst = sys.argv[2]

COLS, ROWS = 12, 11
FRAME = 16
SCALE = 4
LABEL_HEIGHT = 14
CELL_W = FRAME * SCALE
CELL_H = FRAME * SCALE + LABEL_HEIGHT

img = Image.open(src).convert("RGBA")
out = Image.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (40, 40, 50, 255))
draw = ImageDraw.Draw(out)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 11)
except Exception:
    font = ImageFont.load_default()

for r in range(ROWS):
    for c in range(COLS):
        idx = r * COLS + c
        frame = img.crop((c * FRAME, r * FRAME, (c + 1) * FRAME, (r + 1) * FRAME))
        scaled = frame.resize((CELL_W, FRAME * SCALE), Image.NEAREST)
        x = c * CELL_W
        y = r * CELL_H
        out.paste(scaled, (x, y + LABEL_HEIGHT), scaled)
        draw.text((x + 2, y), str(idx), fill=(220, 220, 100, 255), font=font)

out.save(dst)
print(f"saved {dst} ({out.width}×{out.height})")
