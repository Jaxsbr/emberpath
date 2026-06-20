---
status: active
type: feature
created: 2026-06-21
issue: FB-23
slug: per-object-collision-shadow
---

# Per-object collision shapes + per-object shadow placement (FB-23)

## Problem frame

Collision today is **cell-grained** (`TILE_SIZE` = 32px) and authored **per area**.
Two consequences Jaco hit:

- A small object that does not fill its tile (a rock, a sign) blocks the **whole**
  32px cell — Pip stops on empty ground beside it. Multi-tile objects (trees,
  houses) are worse: their collider is hand-tuned per kind (`collisionFootprint`)
  or hand-laid per area (cottage `collision-block` grids, #153), and still snaps
  to whole cells.
- Collision is defined where an object is *placed* (the per-area paint editor,
  #119/U2), not on the object *kind*. Every placement of `rock` must be re-painted;
  there is no single "this is what a rock blocks" definition.

Shadows have the same kind-vs-placement gap: each kind's ground shadow is derived
by **hard-coded heuristics** in `renderObjects` (building → rectangle band, tree →
footprint ellipse, prop → small ellipse). There is no per-kind shadow config, so a
shadow that is wrong for a specific sprite (too big, offset, wrong shape) can only
be fixed by editing branch logic in `GameScene.ts`.

**Goal:** author collision **and** shadow **per object-kind** in one editor — pick
a kind, draw its collision zones and place its shadow over the actual sprite, save
per-kind — and have the game load those definitions wherever the kind is placed.

Annotation (`autonomy/feedback/FB-23/collision-shadow-annotation.jpg`, SEEN):
**purple** = ideal collision area (front-wall band on the house, a tight box on the
small rock), **blue** = ideal shadow placement (offset block under the cottage).

## Requirements (traceability)

| # | Requirement | Source |
|---|---|---|
| R1 | Collision is defined per object-**kind**, single or multi-tile, not per tile-per-area | FB-23 msg 1106 |
| R2 | Collision can hug an object **finer than a 32px cell** (small rock fix) | FB-23 "empty parts of a tile" |
| R3 | Editor flow: pick a kind from a selector → draw collision zones over the sprite → save per-kind | FB-23 |
| R4 | The game loads each kind's collision def and applies it wherever that kind is placed | FB-23 |
| R5 | Per-kind shadow config (size, shape, position relative to object), authored in the **same** editor | FB-23 (less urgent) |
| R6 | The game reads the shadow config and passes it to the renderer | FB-23 |
| R7 | No regression: every existing kind keeps its current collision + shadow until migrated | safety / #346, FB-8/21 canon |

## Key decisions (the forks — surfaced to GATE 1)

### Fork 1 — collision granularity & data model (the big one)

The runtime is a cell-keyed `objectBlockMap: Map<"col,row", boolean>` consumed by
`cellBlocks` (O(1) lookup) and `collidesWithWall` (iterates the cells under Pip's
AABB). Two ways to get sub-cell precision:

- **(a) Sub-cell raster grid — RECOMMENDED.** Subdivide each tile into N×N sub-cells
  (propose **N=4 → 8px**). A kind's collision is a set of sub-cells relative to its
  anchor. `buildObjectCollisionMap` stamps a kind's sub-cell set at each placement;
  `objectBlockMap` keys become sub-cell coords; `cellBlocks`/`collidesWithWall` step
  at 8px. **Why:** minimal-risk evolution — keeps the O(1) Map-lookup runtime and
  the *paint* metaphor the #119 editor already has (just finer); matches the blocky
  annotation; terrain collision can stay cell-grained (the test handles both). 8px
  is plenty to hug a rock without exploding the map (16× cells, still thousands).
- **(b) Rectangle-shape list.** Each kind carries a list of collision rects (in
  fractional cells / px) relative to anchor; runtime tests Pip's AABB against the
  rects of nearby placed objects. More precise/arbitrary; editor = "draw boxes."
  **Cost:** replaces the Map-lookup runtime with per-object AABB tests (still cheap
  with spatial limiting) and is a bigger rewrite of `collision.ts`.

**Recommend (a).** It fixes R2, reuses the most code, and the visible result is
identical to (b) for the shapes in the annotation.

### Fork 2 — scope / sequencing

Jaco flagged shadows as **less urgent**. Options: **(a) collision first** (its own
PR + GATE 2), shadows as a fast-follow in the same editor — RECOMMENDED; vs **(b)
both in one PR**. Recommend (a): smaller diffs, a focused GATE-2 visual review per
feature, value lands sooner.

### Fork 3 — migration of existing kinds

New per-kind shapes **supersede** `collisionFootprint`. Back-compat order in
`buildObjectCollisionMap`: **per-kind collision shape → `collisionFootprint` →
single anchor cell** (R7 — nothing changes until migrated). Migrate the existing
footprint kinds (trees' trunk-base, `cottage-large` band, `hermit-house`, stag)
into the new format opportunistically; this also lets the cottage's hand-laid
collision (#153) come from the editor instead of `collision-block` grids.

### Other decisions

- **Storage:** per-kind defs live in a committed JSON the game imports —
  `src/data/object-shapes.json` (keyed by `ObjectKindId`), holding `collision`
  (sub-cell set or rects) and `shadow` ({shape, w, h, dx, dy, alpha}). Authored
  values are real game data (unlike the gitignored per-area `staged/` scratch), so
  they ship. A dev save endpoint writes it directly (it's the source of truth, no
  port step). `ObjectKindDefinition` gains optional typed fields mirrored from it,
  or the scene reads the JSON at load — decide at implementation (lean: import JSON,
  merge onto `OBJECT_KINDS` at module init so types stay centralized).
- **Editor reuse:** extend `collisionEditor.ts` with an **object mode**
  (`?editor=object&kind=<id>` or a kind selector in the HUD) that renders the
  chosen sprite at native scale on a grid backdrop and paints the kind's sub-cell
  collision + drags a shadow handle — rather than a second editor. The existing
  per-area collision mode stays for terrain.

## Implementation units

### U1 — Per-kind collision data model + game loader
**Files:** `src/maps/objects.ts`, `src/data/object-shapes.json` (new),
`src/scenes/GameScene.ts` (`buildObjectCollisionMap`), `src/systems/collision.ts`
**Test:** `src/systems/collision.test.ts` (or the existing collision test file)
- Define the per-kind shape schema (sub-cell collision set + shadow config), import
  the JSON, merge onto `OBJECT_KINDS` at init.
- Generalize `objectBlockMap` to sub-cell keys; update `cellBlocks` +
  `collidesWithWall` to step at the sub-cell size. Terrain stays cell-grained.
- `buildObjectCollisionMap`: stamp per-kind shape → fall back to `collisionFootprint`
  → anchor cell (Fork 3 order).
- **Scenarios:** small rock blocks only its drawn sub-cells (Pip passes the empty
  side); a tree still blocks only its trunk-base; an unmigrated kind is byte-identical
  to today; out-of-bounds + terrain collision unchanged; conditional-object rebuild
  still works.

### U2 — Object-mode editor (collision authoring)
**Files:** `src/systems/collisionEditor.ts` (or a new `objectShapeEditor.ts`),
GameScene editor boot (`editorActive`, `?editor=` parse)
- Kind selector (HUD dropdown of `ObjectKindId`); render the selected sprite at
  native scale centered on a sub-cell grid; paint sub-cell collision over it; Save.
- **Scenarios (headless, Playwright like `capture-collision-baseline.cjs`):** pick a
  kind, paint cells, Save writes the kind's entry; re-open seeds from saved; grid
  aligns to the sprite at native scale.

### U3 — Dev save endpoint for per-kind shapes
**Files:** `vite-plugins/collision-save.ts` (extend) or new
`vite-plugins/object-shapes-save.ts`
- POST a kind's shape → write/merge `src/data/object-shapes.json` (committed source,
  not `staged/`). Sanitize kind id against `ObjectKindId`. Dev-only (`apply:'serve'`).
- **Scenarios:** valid kind writes/merges; unknown kind rejected; malformed payload
  400; other kinds in the file untouched.

### U4 — Per-kind shadow config (render) — *Fork 2: fast-follow*
**Files:** `src/scenes/GameScene.ts` (`renderObjects`, `makeGroundShadow`),
`src/data/object-shapes.json`
- When a kind has a `shadow` config, build the shadow from it (shape ellipse/rect,
  w/h, dx/dy offset, alpha) instead of the heuristic branch; otherwise keep the
  current building-rect / tree-ellipse / prop-ellipse fallback (R7). Honor `noShadow`.
- **Scenarios:** a configured kind renders its exact shadow; an unconfigured kind is
  unchanged; `noShadow` kinds still cast none; the FB-21 ground-shadow canon holds
  for fallbacks.

### U5 — Shadow authoring in the object editor — *Fork 2: fast-follow*
**Files:** the object editor (U2)
- Add a draggable/resizable shadow handle over the sprite; Save writes the `shadow`
  block alongside `collision`.
- **Scenarios:** place a shadow, Save, re-open seeds it; matches what U4 renders.

### U6 — Migrate existing footprint kinds + cottage (#153)
**Files:** `src/data/object-shapes.json`, `src/maps/objects.ts` (retire migrated
`collisionFootprint`s once shapes exist), cottage area data if its `collision-block`
grid is replaced.
- Author shapes for trees, `cottage-large`, `hermit-house`, `golden-stag`, rock,
  etc.; verify each via testbench parity before removing the old footprint.
- **Scenarios:** behind-cottage walk (#119/#175) still passes; trees still walk-under;
  reachability of every area unchanged (run the collision baseline harness per area).

## Verification (hard gates)

- `npm run build` clean (`tsc --noEmit && vite build`).
- Per-kind collision proven headless: extend `capture-collision-baseline.cjs` to a
  per-kind capture; the F4 collision overlay (`?debugCollision=1`) shows only the
  drawn sub-cells blocked.
- Behind-fade / reachability testbench scenarios pass for ashen-isle (cottage),
  fog-marsh (hermit-house), briar (trees).
- **GATE 2 MP4** for the visible result: Pip walking tight past a rock (collision),
  and the shadow change (shadows) — MP4, pre-merge approval.

## Risks

- **Sub-cell map size** — 16× the cells. Mitigation: still a sparse `Map` keyed only
  on blocked sub-cells; profile if needed (Learning EP-01 keeps it O(1)).
- **Terrain/object granularity mismatch** — `collidesWithWall` must test terrain at
  32px and objects at 8px. Mitigation: compute the sub-cell span of Pip's AABB; check
  object sub-cells, derive the parent cell for terrain. Cover in U1 tests.
- **Migration regression** — the FB-8/FB-21 shadow canon and #119 walk-behind are
  load-bearing. Mitigation: Fork-3 fallback order means zero change until a kind is
  explicitly migrated; U6 verifies each before retiring its old footprint.
- **Editor scope creep** — keep the object editor a thin extension of the existing
  one; do not rebuild the per-area mode.

## Out of scope

- Polygon/rotated collision shapes (rects/sub-cells only).
- Per-instance overrides (collision/shadow are per-kind; a specific placement that
  needs something different stays a separate kind, as today).
- Changing terrain collision granularity (stays cell-grained).
