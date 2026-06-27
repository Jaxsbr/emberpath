---
title: Procedural warm-light sources (campfire, beacon) — root the flame ON a brightened ember bed and draw on the UI camera so the warm light survives the main-cam desaturation
applies_when: Building any in-scene warm point-light effect (fire, lantern glow, beacon) with no sprite art, especially in a scene whose main camera applies a gloom/desaturation tint
status: binding
failure_ids: ["#156 build — first-round flame floated above the logs as a candle/torch jet (ART-review REQUEST_CHANGES); warm light drawn on the main camera would be washed out by the area's desaturation"]
canon: src/systems/campfire.ts · src/systems/smokeBeacon.ts · src/data/areas (campfire? field) · src/scenes/GameScene.ts
---

# Procedural fire that reads as fire, on a camera that keeps it warm

Driftwood's campfire (#156) had to be built with **no new pixel art** (PixelLab sub
expired 06-26), so the fire is fully procedural Graphics. Two traps cost a round each.

## 1. A flame must be ROOTED on a brightened ember bed — low and broad, not a tall jet
The first build drew the flame as a tall narrow upward shape and the ART-review failed it:
it read as a **candle / torch jet floating above the logs**, not a campfire. A campfire
flame is **low and broad**, sitting directly on a **brightened ember bed** that anchors it
to the logs. The layering that reads correctly:

1. crossed logs (dark base)
2. a glowing **ember bed** brightened where the flame meets it — this is the anchor; without
   it the flame looks detached
3. low, broad, layered warm flames (wide base, short height) rising off the bed
4. a soft glow pool + a few sparks on top

Rule of thumb: if the flame's height is greater than its base width, it looks like a torch.
Keep it squat and seat it on a lit bed.

## 2. Draw warm light on the UI camera, projected from the tile — so desaturation can't eat it
emberpath's gloomy areas desaturate/tint via the **main** world camera. Anything warm drawn
in world space (on the main camera) gets washed grey. Warm point-lights must instead be drawn
on the separate **`'ui'` camera** and positioned by projecting the source tile to screen
space — the same pattern `smokeBeacon` already uses. That keeps the fire's warm color intact
over a desaturated scene. (Side effect to be aware of: a UI-camera effect does **not** scroll
with the world automatically — you re-project from the tile each frame.)

Persistence note: this fire is **Driftwood's own** and is permanent (unlike the transient
smoke plume), so it lives for the area's lifetime rather than being event-gated.

## Verify
Capture the real flow headless (the `driftwood-campfire` testbench scenario) as an **MP4** —
fire is motion, so a still can't show it reads as fire. Run the cold `emberpath-art-review`
gate on the rendered frame before merge; it is exactly the gate that caught the floating-jet
miss here.
