---
title: Area transitions spawn the player at the SOURCE exit's entryPoint, not the destination's playerSpawn
applies_when: Changing any area's walkable geometry (collision tiles, parapets, deck rows, spawn rows), OR adding a testbench scenario for an area transition
status: binding
failure_ids: [FB-22 — Pip stuck on the Heart Bridge top parapet entering from Briar]
canon: src/scenes/GameScene.ts (transitionToArea) · docs/testbench.md
---

# A transition uses the exit's entryPoint — audit it when geometry moves

## The rule
When Pip walks through an exit into another area, the engine drops her at the
**source exit's `entryPoint`** (`GameScene.transitionToArea` reads `exit.entryPoint`),
**not** at the destination area's `playerSpawn`. The destination's `playerSpawn` is
only used on a fresh-start / scenario boot. They are **two decoupled coordinates that
must agree**.

So: **whenever you change an area's walkable geometry** — move the spawn row, add
collision tiles, turn rows into parapets/walls — you must re-check **every inbound
exit's `entryPoint`** in **other** areas that target it, not just that area's own
`playerSpawn`. Fixing only the `playerSpawn` leaves every doorway pointing at the old
coordinate, which may now be inside a collision box.

## Why this lesson exists (FB-22)
The FB-19 redesign tripled the Heart Bridge span: the walkable deck moved to rows 3–5
and rows 2/6 became impassable `marsh-stone` parapets placed on every column. The
bridge's own `playerSpawn` was correctly updated to row 4 (`DECK_ROW_MID`) — but the
**Briar→Heart-Bridge exit's `entryPoint` in `briar-wilds.ts` was missed**, still
pointing at the now-stale `{col:1,row:2}`. Row 2 is now the top parapet, so entering
from Briar dropped Pip **inside** the parapet collision box and the movement system
froze her on the first step. A first-time player hit a hard dead end at a story-critical
crossing.

## The second half — why the bench didn't catch it
The existing `has-words-at-bridge` scenario booted **directly onto the bridge at its
`playerSpawn` (1,4)** — which bypasses the exit's `entryPoint` entirely. A scenario that
boots at the destination spawn can **never** reproduce an entry-collision bug, because
the spawn path is the one path that's already trivially correct.

A transition testbench scenario must boot in the **source** area and **walk through the
exit** (the new `briar-to-bridge-transition` scenario boots Pip on the Briar D-band with
the Word and drives her east through the doorway). Only that exercises the `entryPoint`.

## The test (before you ship a geometry change or a transition)
- Changed an area's walkable rows / added collision? → grep every other area's
  `entryPoint` whose `destinationAreaId` is this area, and confirm each still lands on a
  walkable, object-free tile under the **new** geometry. Cross-reference the geometry
  constants (e.g. `DECK_ROW_MID`) in the exit's comment so the next change flags it.
- Writing a transition test? → boot in the **source** area and walk through the exit.
  Never boot at the destination `playerSpawn` — that path can't catch entry collisions.
- Verify headless via `?scenario=<id>` and capture the walk-through as an **MP4** (motion
  → MP4, see [process/gif-for-motion](../process/gif-for-motion.md)).
