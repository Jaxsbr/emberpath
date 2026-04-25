## Phase goal

Make the two POC areas read as **places**, not as random debug grids. Today, Ashen Isle is a green field with orange-pip wallpaper and stone walls forming arbitrary rectangles around the Old Man; Fog Marsh is a brown box bordered by silver tomb-tile shapes. A first-time player cannot identify a building, a path, an island edge, or an exit — and that illegibility blocks every downstream phase (`save-resume`, `fog-marsh-dead-end`, `wayfinding`). This phase introduces a tile-decoration layer, expands the visual vocabulary used by each area, and rebuilds Ashen Isle and Fog Marsh as legible compositions: a coastal village on Ashen Isle (path, houses, fence, water edge, dock-as-exit) and a wet marsh with a dry path and a ruin corner on Fog Marsh. Same Kenney CC0 tilesets — the placeholder *art* stays placeholder, but the placeholder *layout* becomes communicative. The phase ends when a fresh observer, given no instructions, can correctly point at the player's house, the path, the island edge, and the way to leave the area, on both Ashen Isle and Fog Marsh.

### Design direction

**Communicative, not pretty.** This is still placeholder art. The bar is "a 6-12yo can read where they are and what's around them," not "shippable polish." Concretely:

- A vocabulary, not a noise field — each area uses a small, intentional set of tile meanings (ground, path, building wall, building roof, fence, water/edge, doorway, decoration).
- Buildings read as buildings — house has roof + wall-side + door, oriented top-down, multi-tile, NOT a 1×1 stone block.
- The path is the wayfinding — a visible cobble or dirt path connects every important thing on Ashen Isle (player spawn → Old Man's cottage → dock exit).
- Edges read as edges — Ashen Isle has at least one water/cliff edge (a coast); Fog Marsh has at least one impassable wet edge.
- Exits are diegetic — wooden gate, dock, or doorway sign, NOT a floor tile tinted amber.

The Tiny Town and Tiny Dungeon Kenney atlases already contain the needed houses, roofs, doors, gates, signs, fences, water, paths, bushes, gravestones. The phase is about *using* them — not generating new art.

### Stories in scope
- US-58 — Decoration layer (engine)
- US-59 — Ashen Isle as a legible coastal village
- US-60 — Fog Marsh as a legible wet marsh with a ruin
- US-61 — Tileset vocabulary doc

### Done-when (observable)

#### Structural — engine (US-58)

- [x] `AreaDefinition.decorations: DecorationDefinition[]` exists in `src/data/areas/types.ts` (verified: source read) [US-58]
- [x] `DecorationDefinition` has exactly `{ col, row, spriteFrame }` (verified: source read) [US-58]
- [x] `GameScene.renderDecorations()` exists and is called in area-load order after `renderTileMap` and before `renderProps` (or alongside; depth ordering is what matters) [US-58]
- [x] Decoration sprites render at depth 2; depth map in AGENTS.md is updated to insert "Decorations | 2 | main" between "Tiles | 0" and "Props | 3" [US-58]
- [x] Missing-frame decoration logs a warning naming `(col, row)` and the missing frame, then skips (verified: source read of the warn-and-skip branch + a deliberate dev test entry with a bogus frame) [US-58]
- [x] No collision contribution from decorations — `collision.ts` is not consulted for decoration cells (verified: source read; player walks through a decoration tile placed on a FLOOR cell) [US-58]

#### Structural — Ashen Isle redesign (US-59)

- [x] Continuous path from `playerSpawn` to Old Man's cottage to dock exit; verifiable by visually following the dirt/cobble decoration tiles in DevTools or the editor map view [US-59]
- [x] At least one ≥ 3×3 building composition (roof + wall-front + door) using Tiny Town atlas frames [US-59]
- [x] Old Man spawn `(col, row)` is on a path tile adjacent to a building door tile (verified: read coordinates from `ashen-isle.ts`, cross-reference the decoration layer) [US-59]
- [x] At least one ≥ 4-tile fence run using a Tiny Town fence frame [US-59]
- [x] At least one full area edge (one side: top OR bottom OR left OR right) is water tiles [US-59]
- [x] At least three distinct decorative frame ids in use beyond grass + flower; no single frame > ~30% of decoration entries by count (verified: tally via grep or a small counter in the area file's load-time) [US-59]
- [x] EXIT zone visually shows a dock or gate sprite, NOT amber-tinted floor (verified: open Ashen Isle, walk to the exit, screenshot reads as "wooden dock" or "wooden gate") [US-59]
- [x] All existing `ashen-isle` triggers fire on the same flag keys after redesign (verified by walking the Old Man → dialogue → choice paths and observing the same flags set as before) [US-59]
- [x] First frame after fade-in (at zoom 1) shows player + at least one decorated landmark in viewport (verified manually) [US-59]

#### Structural — Fog Marsh redesign (US-60)

- [ ] Visible distinction between wet ground (most of FLOOR cells) and dry path (decoration overlay on a connected route) [US-60]
- [ ] Ruin corner (3-5 tiles) using Tiny Dungeon brick frames, placed in one corner [US-60]
- [ ] At least 8 reed/vegetation decorations in wet ground area, none on the dry path [US-60]
- [ ] At least one full edge is impassable wet/reed-wall composition (WALL cells with marsh-edge decoration) [US-60]
- [ ] Marsh Hermit spawn `(col, row)` is on the dry path adjacent to the ruin [US-60]
- [ ] EXIT zone reaches the dry path (verified by walking from the entry point to the exit on path tiles only — no need to step into wet ground) [US-60]
- [ ] Round-trip legibility: exiting Ashen Isle's dock → entering Fog Marsh lands on the dry path; exiting Fog Marsh → returning to Ashen Isle lands on the dock decoration (verified manually for both directions) [US-60]
- [ ] Whispering Stones trigger renders adjacent to or on the path (visible to a player following the path) [US-60]
- [ ] All existing `fog-marsh` triggers fire on the same flag keys after redesign [US-60]

#### Structural — vocabulary docs (US-61)

- [ ] `docs/tilesets/tiny-town.md` exists with frame table covering all Ashen Isle decorations + a Reserved-for-future appendix [US-61]
- [ ] `docs/tilesets/tiny-dungeon.md` exists with frame table covering all Fog Marsh decorations + a Reserved-for-future appendix [US-61]
- [ ] Each doc explains the atlas grid math (frame = row × cols + col) [US-61]
- [ ] AGENTS.md "Directory layout" tree includes `docs/tilesets/` [US-61]

#### Behavior — reads-as (legibility)

Each reads-as is paired with a mechanism proxy, per phase rule.

- [ ] **Ashen Isle reads-as a coastal village**: a first-time observer (someone who has never seen Ashen Isle before) given the question "where are you, and what are the things around you?" can identify (a) "I'm in / next to a village", (b) "that's a path", (c) "that's a house", (d) "that's the water / the edge of the island", (e) "that's the way out (the dock/gate)". At least 4 of 5 identifications correct = pass. [US-59]
- [ ] **Ashen Isle mechanism proxy**: every legibility element is structurally present per the US-59 acceptance criteria above. [US-59]
- [ ] **Fog Marsh reads-as a wet marsh with a ruin**: same observer test. Identifications: (a) "I'm in a marsh / wetland / swamp", (b) "the dry strip is the path", (c) "that broken-walls thing is a ruin / shrine / tomb", (d) "the edges are too thick / wet to cross", (e) "the door at the end is the way through". At least 4 of 5 = pass. [US-60]
- [ ] **Fog Marsh mechanism proxy**: every legibility element is structurally present per the US-60 acceptance criteria. [US-60]
- [ ] **Diegetic exit reads-as a thing you walk through**: same observer can point at the dock/gate on Ashen Isle and the door on Fog Marsh and say "that's the way out" — without seeing the player ever walk through them. [US-59, US-60]

#### Variant baseline (per-area verification)

- [ ] **Ashen Isle**: redesigned area loads, fade-in from TitleScene shows the new layout, all NPC + trigger interactions still work end-to-end, exit to Fog Marsh works [US-59]
- [ ] **Fog Marsh**: redesigned area loads via the Ashen Isle exit, all NPC + trigger interactions still work end-to-end, exit back to Ashen Isle works [US-60]
- [ ] **Round-trip**: Ashen Isle → Fog Marsh → Ashen Isle, three full transitions, no orphan sprites, no console warnings, flags persist across transitions [US-59, US-60]

#### Editor sync

- [x] `tools/editor/src/mapRenderer.ts` renders the decoration layer on top of the base tile grid, before NPC circles and trigger overlays. Verified by opening the editor and seeing the redesigned Ashen Isle layout (path, houses, fence, water edge, dock) match what the game shows. [US-58, US-59]
- [x] `cd tools/editor && npm run build` succeeds with the new types [US-58]

#### Error paths

- [x] A decoration with a bogus `spriteFrame` does NOT crash the area load — only logs a warning and skips (verified by adding a deliberate temp entry with `spriteFrame: 'bogus'`, observing console + visible missing decoration, then removing it) [US-58]
- [x] A decoration on a coordinate outside `(mapCols, mapRows)` is not crashing — either ignored with a warning OR rendered off-grid harmlessly. Document the chosen behaviour in `renderDecorations` source comment. [US-58]

#### Invariants

- [ ] `npx tsc --noEmit && npm run build` passes [phase]
- [ ] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors during 60 seconds of play covering: spawn on Ashen Isle, walk the path to the Old Man, full dialogue, walk to dock, transition to Fog Marsh, walk path to Marsh Hermit, full dialogue, Whispering Stones, return to Ashen Isle [phase]
- [ ] AGENTS.md "Directory layout" tree updated to include `docs/tilesets/` [phase]
- [ ] AGENTS.md "Depth map" updated to insert "Decorations | 2 | main" row between Tiles and Props [phase]
- [ ] AGENTS.md "File ownership" rows updated for: `data/areas/types.ts` (`AreaDefinition.decorations`, `DecorationDefinition`), `scenes/GameScene.ts` (`renderDecorations()`), `data/areas/ashen-isle.ts` and `fog-marsh.ts` (mention the redesigned compositions), `tools/editor/src/mapRenderer.ts` (decoration layer rendering) [phase]
- [ ] AGENTS.md "Behavior rules" gains a "Decorations" entry mirroring the existing "Decorative props (non-blocking)" entry — describing tile-snapped, depth 2, atlas-frame literal, no collision contribution, missing-frame warn-and-skip [phase]
- [ ] **Loop-invariant audit (Learning EP-01):** decorations are created once at area load, not per-frame; no `update()` work added [phase]

### Golden principles (phase-relevant)

- **Depth map authority:** Decorations land at depth 2 — a new entry, but explicit. Ad-hoc depths still prohibited.
- **Parameterized systems:** All redesigned-area work happens in data files. The engine (US-58) is generic; it doesn't know about Ashen Isle or Fog Marsh specifically.
- **No silent breaking changes:** `decorations` is required from the start, but every existing area definition is updated in this same phase, so no transitional state with missing fields hits `main`.
- **From LEARNINGS EP-01 (loop invariants):** decoration sprites are created once at area load; no per-frame creation, no per-frame `setTexture`. Mirror the props pattern.
- **From LEARNINGS #57 (depth-map authority):** the new depth 2 row must be added to the AGENTS.md depth map in the same PR that introduces it.
- **Communicative-not-pretty:** placeholder art stays placeholder. Any work that spends time on "make this look nicer" rather than "make this read more clearly" is out-of-scope and bumped to a later art-pass phase.

### Reference

Full spec, schematic layouts, story design rationale, and AGENTS.md sections affected: `docs/product/phases/world-legibility.md`.
