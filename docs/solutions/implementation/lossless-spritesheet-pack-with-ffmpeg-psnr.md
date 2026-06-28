---
title: Pack per-frame PNGs into one sprite sheet losslessly with ffmpeg's tile filter, prove byte-identity by cropping each cell back and asserting PSNR=inf, and address frames by a manifest index — never re-load 600 files at runtime
applies_when: Any animation/character art stored as one-PNG-per-frame is killing load time (hundreds of HTTP requests); you need to combine images without changing a single pixel; or you're wiring Phaser to a packed spritesheet and need a stable frame-index contract
status: binding
failure_ids: ["#214 F6 — 607 individual per-frame PNGs (96 Pip + 511 NPC) meant 667 asset requests to enter one map; the web killer was request COUNT, not bytes"]
canon: scripts/pack-sprite-sheets.cjs · src/data/sprite-sheets.json · src/systems/spriteSheets.ts · src/scenes/GameScene.ts (preload/createAnimations) · src/systems/npcBehavior.ts · src/maps/characters.ts
---

# Lossless sprite-sheet packing with ffmpeg `tile`, verified by per-cell PSNR

emberpath shipped every character animation as **one PNG per frame** — 607 files for
Pip + 7 NPCs. Entering a single map fired **667 HTTP requests**. On Fast-3G that's tens
of seconds of request-setup overhead, almost none of it bytes. The fix is to pack each
character's frames into **one grid sheet** and load that single file — without touching a
pixel (Jaco's hard boundary: "don't change the art").

## 1. Pack with ffmpeg's `tile` filter — it's lossless for PNG/RGBA
No sharp / ImageMagick / pngjs in this container; **ffmpeg + ffprobe are installed**.
Stage the frames as a zero-padded sequence in a **fixed canonical order**, then:
```
ffmpeg -y -start_number 0 -framerate 1 -i %04d.png -frames:v 1 \
       -vf tile=COLUMNSxROWS,format=rgba -pix_fmt rgba out.png
```
- `format=rgba` + `-pix_fmt rgba` keeps the alpha channel and avoids any colorspace
  conversion — PNG is lossless, so the cells are bit-exact copies of the inputs.
- Pick `COLUMNS` to **divide the frame count of every sheet** so the grid is full with no
  padding cells. 12 divides 96 (Pip) and 72 (each NPC) exactly. A ragged last row is fine
  too, but a clean divisor keeps the manifest math trivial.

## 2. PROVE it's lossless — crop every cell back and assert PSNR is infinite
"Lossless in theory" is not the boundary; **byte-identity verified** is. After packing,
crop each cell back out and PSNR-compare it to its original frame:
```
ffmpeg -i orig.png -i cropped_cell.png -lavfi psnr -f null - 2>&1   # read 'average:inf'
```
Only `average:inf` (zero error) passes; the packer **throws** on anything else. Gotcha:
ffmpeg writes PSNR to **stderr**, so capture stderr — `spawnSync('ffmpeg',[...],{encoding:'utf8'}).stderr`,
not stdout (stdout is empty and silently parses to null).

## 3. Address frames by a committed manifest index, not by filename
The packer writes `src/data/sprite-sheets.json`: per sheet `{frameWidth, frameHeight,
columns, count, index}` where `index` maps a **logical key** (`idle-south-2`,
`static-north`) → the frame's row-major position. Phaser numbers `load.spritesheet`
frames row-major 0..N-1, so the packer's emit order **is** the frame index — one source of
truth. A thin accessor (`src/systems/spriteSheets.ts`: `pipFrame(anim,dir,i)`,
`npcFrame(id,anim,dir,i)`, `npcStaticFrame(id,dir)`, `pipTextureKey()`, `npcTextureKey(id)`)
hides the JSON; it **throws on an unknown key** so a rename can't silently mis-index.

## 4. Rewire every load + setTexture site to (key, frameIndex)
A spritesheet texture needs BOTH a key and a frame. Every place that used a per-frame key
must now pass the index:
- `preload`: one `this.load.spritesheet(key, 'sheets/<id>.png', {frameWidth,frameHeight})`
  per character (was a 96-iteration / per-frame loop).
- `createAnimations`: frames become `{key, frame: pipFrame(anim,dir,i)}`.
- initial sprite + every `setTexture`: `add.sprite(x,y,key,frame)` /
  `setTexture(key, frameIndex)` — the NPC static-pose path (`npcBehavior.ts`) had **two**
  call sites at different indentation; `replace_all` only caught one. Grep for every
  `setTexture(` and every old key pattern before declaring it done.
- dev editors (`shadowEditor`, `characterCollisionEditor`): `add.image(0,0,key,frame)`,
  guarded by `textures.exists()` so they degrade rather than throw.

## 5. Keep the per-frame PNGs as regeneratable SOURCE
The packer *reads* the per-frame PNGs, so they're the source-of-truth to re-pack from when
an animation changes — keep them in the repo. They're simply **no longer loaded at
runtime**, which is the entire win. (Trimming them from the deployed `dist/` — they still
get copied by vite's `publicDir` — is a separate, optional size cleanup, not a perf
requirement; the request-count win is already banked.)

## Result (#214, measured)
667 → **75** asset requests (−88.8%); time-to-playable 1.26s → 0.83s local, **31.5s → 14.6s
on Fast-3G**; all 607 frames PSNR=inf (pixel-identical); 0 console errors; runtime-verified
Pip draws from `sheet-fox-pip` on the correct south-idle frames.

## The check that catches it next time
Sprite-sheet packing is **format, not art** — output is pixel-identical, so it is NOT a
GATE-2 visual change and self-merges on the code gates. But that claim must be *proven*
every run: the packer's per-cell PSNR=inf assertion is the gate. If a future pack can't
show inf, it changed pixels and becomes an art review.

## Related
- [benchmark-driven-with-baseline-and-failing-test](../process/benchmark-driven-with-baseline-and-failing-test.md) — baseline → failing test → green → re-bench, the method that drove this.
- [instant-paint-html-loader-before-bundle](instant-paint-html-loader-before-bundle.md) — the other half of #214: paint before the bundle parses.
- Issue #214 (F6 loading performance).
