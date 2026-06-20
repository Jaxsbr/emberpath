---
title: A tall building's collision band sits at the FRONT-WALL BASE (low), never mid-roof — or the walk-behind fade stays dormant
applies_when: Giving any tall building/object a `collisionFootprint`, or making the player able to walk behind a house/structure (FB-3 see-through fade)
status: binding
failure_ids: [#119 — Pip could not walk behind the Old Man's cottage; first mid-roof band made the see-through read weak]
canon: src/maps/objects.ts (cottage-large kind · collisionFootprint vs baseFootprint) · src/scenarios/behind-old-man-cottage.ts · docs/testbench.md
---

# Tall-building collision band lives at the base, not the middle

## The failure
Pip could not walk behind the Old Man's cottage at all — she had to detour far
around it, and the FB-3 behind-object see-through fade (occlude + 50% alpha + white
rim) **never fired** for the house even though the kind is `tall`. The whole 8×8
footprint was walled by collision, so no cell behind the body was ever reachable.

The first fix attempt then failed a *second* way: a collision band painted on the
**mid-roof** (`collisionFootprint: { dx: 1, dy: 3, w: 6, h: 3 }`, rows ~24–26) built
clean but the walk-behind read **weak** — Pip rode the thin roof ridge and barely
disappeared.

## The rule
Give a tall building a **thin, tree-style collision band** on the object KIND's
`collisionFootprint`, and place that band at the **front-wall BASE** — the rows where
the sprite visually meets the ground — leaving the entire upper body/roof walkable.

```ts
// src/maps/objects.ts — cottage-large
collisionFootprint: { dx: 1, dy: 5, w: 6, h: 2 },  // rows 26–27, the front-wall BASE
baseFootprint:      { dx: 0, dy: 7, w: 8, h: 1 },  // row 28 — Y-sort + fade trigger ONLY
```

This is the exact tree model: a tree blocks only its trunk-base cell
(`collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 }`) and leaves the whole canopy
walkable. The cottage now blocks only its ground-contact base and leaves the whole
roof walkable, so Pip rounds the body, steps up **under** the painted roof, is drawn
behind the sprite, and the see-through fade reads strong across the traverse.

## Why mid-roof fails — tall-sprite geometry
A tall building's footprint is **not** a top-down floor plan: the sprite is drawn
tall, so footprint rows map to *vertical* positions on the image. The **top** rows
(dy 0–2) line up with the roof **ridge**; the **bottom** rows are where the wall meets
the ground. The fade only fires when Pip stands on a cell the painted mass occludes —
i.e. **under** the roof. A mid-roof band blocks exactly those tuck-under cells and
leaves only the ridge (above the painted mass) walkable, so there's nothing to occlude
her against. The band must sit low so the roof rows stay open.

Two fields, two jobs — never conflate them:
- **`collisionFootprint`** blocks ONLY its cells → put it at the base.
- **`baseFootprint`** is used ONLY for Y-sort depth + the fade trigger line → never for
  collision.

## The check that catches it next time
Verify with the dedicated testbench scenario, not the eye alone on a still:
`?scenario=behind-old-man-cottage` boots Pip beside the building level with the roof
rows; walk her across **behind** it, capture an **MP4** (the fade is motion), and
confirm the strong tuck-behind before merge. A mid-roof band passes `npm run build`
but fails the recorded walk-behind — only the clip proves the fade actually reads.
When the band geometry is tuned, update **every** comment that cites the old values, or
the wrong band gets reintroduced from a stale comment.

## Related
- [implementation/area-transition-uses-exit-entrypoint](area-transition-uses-exit-entrypoint.md) — sibling rule: verify walkable geometry by walking the real path in a testbench scenario.
- [art/ground-shadow-canon](../art/ground-shadow-canon.md) — a building's *shadow* rectangle also sits at the front-wall base; same anatomical line, different system (shadow vs collision) — don't conflate them.
- Issue #119 (this fix) · #346 (the tree trunk-base `collisionFootprint` precedent) · FB-3 (the behind-object see-through fade).
