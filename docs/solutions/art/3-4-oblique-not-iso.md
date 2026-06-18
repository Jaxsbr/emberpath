---
title: Perspective is 3/4 oblique — top + exactly one front face (never iso, never pure-overhead)
applies_when: Generating or regenerating any sprite/tile/building/prop, or writing any placement array
status: binding
failure_ids: [FB-1, FB-9, FB-12]
canon: docs/art-style.md (Perspective) · docs/art-topdown-guide.md
---

# 3/4 oblique — not isometric, not pure-overhead

## The rule
emberpath is **3/4 oblique projection**: a ~45° downward camera that shows the **top
AND exactly ONE front face** of an object at once (the Pokémon/Stardew/Zelda look).

## Why this lesson exists (it keeps recurring)
- **FB-1**: trees shipped as flat overhead "rosettes", stones as flat blobs — pure
  overhead, no front face.
- **FB-9**: an isometric (3-sided cube) rock shipped across all maps.
- **FB-12**: a building shipped **isometric twice through the gate** — a reviewer
  rationalized "one front face" when there were two.

These recur because the rule was applied per-asset by eye instead of by a mechanical
test, and because PixelLab defaults push toward iso/side-on.

## The test (run it on every asset, every time)
- **General object:** Can I see the top **and exactly one** front face? Yes → pass.
  No front face (flat-from-above) → pure-overhead → **regenerate**. Two+ side faces
  (cube look) → iso → **regenerate**.
- **Buildings — two hard tells, check BOTH:**
  1. **Wall faces = exactly 1.** A front wall *and* a side wall (rotated dollhouse) =
     iso = reject. A correct building is a **front elevation**: front-on, symmetric
     left-to-right, only the front wall shows.
  2. **Roof = a single front-facing slope, no diagonal ridge.** A ridge running
     corner-to-corner with two visible pitches = iso = reject.
  Benchmark against `assets/objects/ashen-isle/cottage.png` (known-good front
  elevation). "Symmetric and front-on like cottage.png" is the bar — not "I can find
  one face if I squint."
- **Trees:** round canopy from above **with a small trunk stub** at the base (the stub
  *is* the front face — never omit it).

## Generation recipes (avoid the known traps)
- PixelLab buildings default to a rotated dollhouse → steer hard: *"flat 2D FRONT
  ELEVATION, facing camera straight on, ONE flat front wall, symmetric, gable roof as a
  single front-facing slope, NO side wall, NO diagonal ridge, NOT isometric."* Generate
  2 variants, eyeball against cottage.png, run the two tells before placing.
- Conifer/pine trap: the words *pine/conifer/christmas tree* draw a side-on triangle.
  Describe the **shape** ("round dark-green needle blob from directly overhead, tiny
  trunk dot, NOT a triangle"). Generate trees **square** (e.g. 128×128) so the canopy
  reads round.
- One consistent light direction across all assets — no per-asset baked shadow implying
  a different camera.

Full reasoning + per-element rules: `docs/art-topdown-guide.md`.
