# Phase: world-legibility

Status: draft

## Phase goal

Make the two POC areas read as **places**, not as random debug grids. Today, Ashen Isle is a green field with orange-pip wallpaper and stone walls forming arbitrary rectangles around the Old Man; Fog Marsh is a brown box bordered by silver tomb-tile shapes. A first-time player cannot identify a building, a path, an island edge, or an exit — and that illegibility blocks every downstream phase (`save-resume`, `fog-marsh-dead-end`, `wayfinding`). This phase introduces a tile-decoration layer, expands the visual vocabulary used by each area, and rebuilds Ashen Isle and Fog Marsh as legible compositions: a coastal village on Ashen Isle (path, houses, fence, water edge, dock-as-exit) and a wet marsh with a dry path and a ruin corner on Fog Marsh. Same Kenney CC0 tilesets — the placeholder *art* stays placeholder, but the placeholder *layout* becomes communicative. The phase ends when a fresh observer, given no instructions, can correctly point at the player's house, the path, the island edge, and the way to leave the area, on both Ashen Isle and Fog Marsh.

## Design direction

**Communicative, not pretty.** This is still placeholder art. The bar is "a 6-12yo can read where they are and what's around them," not "shippable polish." Concretely:

- **A vocabulary, not a noise field.** Each area uses a small, intentional set of tile meanings — ground, path, building wall, building roof, fence, water/edge, doorway, decoration — instead of WALL/FLOOR with random variants. Repetition is fine; randomness without meaning is not.
- **Buildings read as buildings.** A house has roof + wall-side + door, oriented top-down, occupying multiple tiles. Not a 1×1 stone block. Not a featureless rectangle of wall tiles enclosing nothing.
- **The path is the wayfinding.** A visible cobble or dirt path connects every important thing on Ashen Isle (player spawn → Old Man's cottage → dock exit). The player follows the path; that *is* the navigation system for now.
- **Edges read as edges.** Ashen Isle is an island; at least one edge of the playable area is water or cliff so the world has a coast. Fog Marsh has an edge of impassable wet ground so the player feels enclosed by the marsh, not by an invisible wall.
- **Exits are diegetic.** A wooden gate, a dock, a doorway sign — not a floor tile tinted amber. The exit looks like a thing you walk through.

The Tiny Town and Tiny Dungeon Kenney atlases already contain houses, roofs, doors, gates, signs, fences, water, paths, bushes, gravestones. The phase is about *using* them — not about generating new art.

## Safety criteria

N/A — this phase introduces no API endpoints, no user text input, no query interpolation. All map data is authored by Jaco in source files.

## Stories

### US-58 — Decoration layer (engine)

As an area author, I want to author a per-area list of tile-snapped decoration overrides on top of the base FLOOR/WALL grid, so that I can compose buildings, paths, and edges from specific tileset frames without expanding the collision enum or creating one Sprite-per-decoration as a prop.

**Acceptance criteria**:
- `AreaDefinition` (in `src/data/areas/types.ts`) gains `decorations: DecorationDefinition[]` (required, may be empty array).
- `DecorationDefinition` is `{ col: number; row: number; spriteFrame: string; }` — tile-snapped (1×1), atlas frame from `area.tileset`. No size/scale fields; decorations are exactly TILE_SIZE.
- `GameScene.renderDecorations()` iterates `area.decorations` and creates one `Phaser.GameObjects.Image` per entry on the area's tileset atlas at depth **2** (between Tiles=0 and Props=3 — new entry in the depth map).
- A decoration whose `(col, row)` overlaps a base-layer cell renders **on top of** the base tile, fully obscuring it. Collision is unchanged — the base FLOOR/WALL cell still controls walkability; decorations contribute zero to collision.
- A decoration whose `spriteFrame` is missing on the area's atlas logs a warning naming the decoration's `(col, row)` and the missing frame, then skips that decoration (same recovery shape as the existing `renderProps` warning path).
- Decorations are NOT participating in `resolveFrame` variant picking — `spriteFrame` is the literal, deterministic frame string. No hash-based randomness.
- Both `npx tsc --noEmit` and `npm run build` succeed with the new field. Existing areas (after US-60 / US-61) supply the field; the foundation phase does not need a separate empty-decorations sweep — the type is required from the start.

**User guidance:** Discovery — none. Players see redesigned areas in US-60 / US-61.

**Design rationale:** A decoration layer is the smallest change that gives area authors expressive power without breaking the FLOOR/WALL collision contract. A second tile *kind* enum (BUILDING_WALL, FENCE, PATH, WATER, EDGE) was rejected because most of these distinctions are visual-only — a fence and a wall both block; a path and grass are both walkable. Extending the type vocabulary inflates the collision branch with no behavioural difference. Prop-based decoration was rejected because props (`PropDefinition`) are not tile-snapped (they take pixel coords) and are intended for non-grid decoration — composing a house from props would mean per-prop pixel math at every author site. The decoration layer is the compromise: tile-snapped (cheap to author), atlas-frame literal (no variant logic), zero collision contribution (no ambiguity).

**Consumer adaptation:** `renderDecorations` is called once at area load, alongside `renderTileMap` and `renderProps`. No per-frame work added to `update()`. Adding a third decoration to an area requires only a row in `area.decorations`.

---

### US-59 — Ashen Isle as a legible coastal village

As a player, I want Ashen Isle to read as a small fishing-village on the edge of an island, so that on first arrival I can identify a path, at least one house, the Old Man's location relative to the path, and the way off the island, without being told.

**Acceptance criteria**:
- `src/data/areas/ashen-isle.ts` is rebuilt with the following legibility elements (all using Tiny Town atlas frames):
  - **Path**: a continuous cobble or dirt path (tile-snapped via decoration layer) connecting `playerSpawn` → Old Man's cottage area → dock exit. Path width 1 tile. Path branches no more than once per junction.
  - **At least one house** rendered as a multi-tile composition: roof tiles (top), wall-front tiles (middle), door tile (bottom-centre). Minimum 3×3 tiles. Door tile is decoration-only (walkable), so the player can stand visually inside the doorway during dialogue, but the rest of the house is WALL cells.
  - **Old Man's cottage**: a second building (or the same building if Ashen Isle has only one). The Old Man NPC's spawn `(col, row)` is on the path adjacent to its door, not inside an arbitrary stone pen.
  - **Fence**: a fence line — at least one continuous straight run of ≥ 4 tiles using the Tiny Town fence frame — bordering a yard or garden visible from the path. Fence frames are decorations on WALL cells; collision unchanged.
  - **Coast**: at least one full edge (top, bottom, left, or right) of the playable area is water tiles via the decoration layer over WALL cells. The player can see they're on an island.
  - **Decoration variety**: at least three distinct decorative frames in use beyond grass + flower (e.g. small bush, stones, flower variants, lantern, sign). No frame is repeated more than ~30% of decoration entries by count.
- The amber-tinted EXIT floor tile is **replaced** by a diegetic exit visual: the Tiny Town gate/dock frame placed as a decoration on the EXIT zone's tile. The base EXIT-tile frame in `TILESETS['tiny-town'].tileFrames[TileType.EXIT]` is updated from `'15'` to a frame that reads as a wooden boardwalk / dock surface, OR the EXIT frame stays cosmetic and a decoration entry above it provides the dock visual. (Either is fine — pick one and document the choice in the area file.)
- The Old Man's spawn position and trigger zones still resolve to walkable FLOOR cells; the redesign does not break any existing dialogue trigger condition. Existing `flags.ts` keys persist unchanged.
- The `playerSpawn` is on the path, with at least one decorated landmark (house, fence, sign) within the camera's initial viewport at zoom 1 — so the very first frame after fade-in shows the player a recognisable place.
- The editor's map view (`tools/editor/src/mapRenderer.ts`) renders the new `decorations` layer (drawn after the base tile grid, before NPC circles + trigger overlays). Editor authors can see what the game shows.
- `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes.

**User guidance:** Discovery — Ashen Isle is the default starting area (`getDefaultAreaId()` unchanged). Player walks off the spawn tile and sees village structure. Manual section: N/A — no new control. Key steps: same WASD/joystick movement.

**Design rationale:** The path is doing the wayfinding job until the dedicated `wayfinding` phase ships — it's a near-zero-cost system that already exists implicitly in every top-down game ever made. Bordering one edge with water (rather than walls) is the cheapest way to convey "island" — the player's spatial intuition does the work, no narration required. Replacing the amber EXIT tint with a dock/gate is the single highest-impact wayfinding fix in the phase: today, the exit is invisible to anyone not told where to look; with a dock sprite, it advertises itself.

**Consumer adaptation:** All redesign happens in `src/data/areas/ashen-isle.ts` data; no engine code changes (engine work is US-58). The redesigned area is a drop-in replacement.

---

### US-60 — Fog Marsh as a legible wet marsh with a ruin

As a player, I want Fog Marsh to read as a wet, enclosing marsh with a dry path winding through it and an ancient stone ruin in one corner, so that on entry I feel the change of biome from Ashen Isle and can read the marsh's geometry — the dry path is where I walk, the wet ground is what surrounds me, the ruin is the only built thing here.

**Acceptance criteria**:
- `src/data/areas/fog-marsh.ts` is rebuilt with the following legibility elements:
  - **Wet ground vs dry path distinction**: the marsh's FLOOR cells render with a base "wet" frame (mossy / damp / green-grey) for most of the area, with a tile-decoration "dry path" overlay (rocky / boardwalk / dirt) tracing a connected route from the entry point to the Marsh Hermit's location and toward the (failed) exit. Both are walkable. The visual distinction is read-as: "I'm walking on the path / I've stepped into the marsh proper."
  - **Ruin corner**: a small tomb / shrine / ruined wall composition (3-5 tiles) in one corner of the area, using Tiny Dungeon brick + door frames. Houses the Marsh Hermit OR is adjacent to him.
  - **Reeds / vegetation**: at least 8 reed / cattail / bush decoration entries scattered through the wet ground, NOT on the dry path. Read-as: "this is a marsh, things grow here." The reeds use a Tiny Dungeon decorative frame OR (if Tiny Dungeon lacks suitable reed frames) a frame substituted from the existing tiny-town atlas for the marsh tileset is acceptable as a placeholder — but the choice is documented in the area file.
  - **Edge**: at least one full edge of the playable area is impassable marsh (WALL cells with a "deep water" or "thick reed wall" decoration). The edge reads as "you can't go that way because the marsh is too thick," not as "an invisible wall."
  - **Diegetic exit**: the existing `tiny-dungeon` EXIT frame `'22'` (wooden door) is retained; placement is verified to be on the dry path so the player can reach it, AND the door tile is visually distinct from the surrounding marsh (which it already is, being a dungeon door). If exit returns to Ashen Isle, the entry-point `(col, row)` on Ashen Isle resolves onto the dock decoration from US-59 (round-trip legibility).
- The Marsh Hermit NPC's spawn `(col, row)` is on the dry path adjacent to the ruin, not floating in the open marsh.
- All existing flags, triggers, and dialogue scripts continue to fire on the same flag keys. Trigger zone `(col, row, width, height)` may be re-positioned to match the new layout, but the `id`, `actionRef`, and `condition` fields are unchanged.
- The Whispering Stones trigger placement reads-as: stones are visible on the path or just off it. (The trigger remains portrait-less per US-56.)
- The redesigned `playerSpawn` (entry from Ashen Isle dock) lands the player on the dry path, with the ruin corner visible somewhere in the initial viewport at zoom 1.
- Editor map renderer (`mapRenderer.ts`) shows the decorations layer, same as US-59.
- `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes.

**User guidance:** Discovery — player exits Ashen Isle via the dock, fade transition, lands on Fog Marsh's dry path. Manual section: N/A. Key steps: same movement.

**Design rationale:** The dry-path-through-wet-marsh layout is the layout the future `fog-marsh-dead-end` phase needs — a path that *visibly* runs out, branches into dead-ends, or loops back to itself reads-as stuck because the player can see the path failing. With today's uniform brown-box layout, "the path runs out" is meaningless because there's no path. This phase doesn't yet build the dead-end mechanic; it just builds the *substrate* that mechanic will need. The ruin corner gives the Marsh Hermit a place to be, gives the area a focal point, and prepares ground for later allegorical scenes.

**Consumer adaptation:** All work in `src/data/areas/fog-marsh.ts` data and (potentially) `src/maps/tilesets.ts` if a wet-floor frame is added to the tiny-dungeon registry. No `GameScene` or `DialogueSystem` edits.

---

### US-61 — Tileset vocabulary doc

As a future area author (or the same author returning in a month), I want a one-page reference per tileset listing which frame index means "house roof corner top-left," "fence horizontal," "dock," "gate," "sign," "wet ground," etc., so that composing a new area is a vocabulary lookup, not a pixel-hunt through `tilemap.png`.

**Acceptance criteria**:
- `docs/tilesets/tiny-town.md` exists, listing per-frame intent for every Tiny Town frame USED in Ashen Isle (US-59) plus a short "Reserved-for-future" appendix of intent-mapped frames not yet used (e.g. additional roof variants, signs, lanterns) that the author identified as useful while building US-59. Format: small table `| frame | intent | used in |`.
- `docs/tilesets/tiny-dungeon.md` exists with the same shape, covering frames used in Fog Marsh (US-60) plus a reserved appendix.
- Each doc cites the source atlas grid (e.g. "Tiny Town is a 12×11 grid of 16×16 frames; frame number = row × 12 + col, zero-indexed from top-left") so a future author can resolve "frame 47" → grid position without reverse-engineering.
- The decoration entries in `ashen-isle.ts` and `fog-marsh.ts` reference the docs in inline comments where the choice is non-obvious (e.g. `// frame '32' = house roof top-left, see docs/tilesets/tiny-town.md`).
- AGENTS.md "Directory layout" tree gains a `docs/tilesets/` entry.

**User guidance:** Discovery — N/A (author-facing).

**Design rationale:** The tileset registry in `src/maps/tilesets.ts` knows about FLOOR / WALL / EXIT slots only. The vocabulary needed to compose a building from a 132-frame atlas does not live in code; it lives in the author's head while they look at `tilemap.png` in an image viewer. Writing it down once is the difference between "I have to re-derive the roof-corner frames every time" and "I open the doc, copy the frame, drop it in the area data."

**Consumer adaptation:** Pure documentation; consumed by humans authoring `data/areas/*.ts`.

---

## Schematic layouts (illustrative)

These ASCII schematics communicate the **structural intent** at true map dimensions (Ashen Isle 50×38, Fog Marsh 30×24). They are not pixel-perfect specs — minor adjustments are expected when authoring `ashen-isle.ts` and `fog-marsh.ts`. What is binding is the topology: path connectivity, building placement, NPC adjacency to doors and paths, edge composition (water vs. wet vs. fence), entry/exit positions.

### Glyph legend

Shared across both layouts:

| Glyph | Meaning | Base layer | Decoration layer |
|---|---|---|---|
| `.` | Grass / dry ground (Ashen Isle interior) | FLOOR | (none) |
| `,` | Path — cobble / dirt / boardwalk (walkable) | FLOOR | path-tile frame |
| `~` | Water / impassable wet edge | WALL | water frame |
| `=` | Fence (blocks) | WALL | fence frame |
| `^` | Building roof | WALL | roof frame |
| `H` | Building wall-front | WALL | wall-front frame |
| `D` | Doorway (walkable; on building, on ruin, or as map exit) | FLOOR | door / dock / gate frame |
| `T` | Bush / small tree (decorative; walkable in this phase) | FLOOR | bush frame |
| `*` | Flower cluster / pebbles (decorative) | FLOOR | flower / pebble frame |
| `S` | Sign post (decorative; walkable) | FLOOR | sign frame |
| `E` | EXIT zone (also rendered as dock / gate / doorway) | FLOOR | dock / gate frame |
| `P` | Player spawn | FLOOR | (none — entity, not tile) |

Fog Marsh additional:

| Glyph | Meaning | Base layer | Decoration layer |
|---|---|---|---|
| `:` | Wet ground (walkable, marsh interior) | FLOOR | wet-ground frame |
| `r` | Reed / cattail (decorative; walkable) | FLOOR | reed frame |
| `R` | Ruin wall (blocks) | WALL | ruin-brick frame |
| `M` | Marsh Hermit NPC spawn (on dry path) | FLOOR | (none — entity) |
| `W` | Whispering Stones trigger position (decorative stones) | FLOOR | stones frame |

`P`, `M`, `O` are entity-spawn markers, not tile types — they label `(col, row)` for the area's `playerSpawn` and NPC `npcs` entries. The underlying tile under any entity marker is whatever it would be without the entity (path or grass for `P` and `O`; path for `M`).

### Ashen Isle (50×38)

Coastal village. Water on the north edge, dock as map exit at top, vertical main path running south, player's fenced cottage on the west, Old Man's fenced cottage on the east, Old Man (`O`) standing just south of his door.

```
        col       1111111111222222222233333333334444444444
        col  0123456789012345678901234567890123456789012345 6789
        ----  --------------------------------------------------
        r 00: ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        r 01: ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        r 02: ~~~~~~~~~~~~~~~~~~~~~~~EEEE~~~~~~~~~~~~~~~~~~~~~~
        r 03: ~~~~~~~~~~~~~~~~~~~~~~~~,,~~~~~~~~~~~~~~~~~~~~~~~
        r 04: ........................,,........................
        r 05: ........................,,S.......................
        r 06: ........T...............,,........................
        r 07: ........................,,..........T.............
        r 08: ........................,,........................
        r 09: ...T....................,,........................
        r 10: ........................,,...*....................
        r 11: .....==========.........,,........................
        r 12: .....=..^^^^^.=.........,,........................
        r 13: .....=..^^^^^.=.........,,........................
        r 14: .....=..HHHHH.=.........,,........................
        r 15: .....=..HHDHH.=.........,,........................
        r 16: .....=........=.........,,........................
        r 17: .....=...*....=.........,,........................
        r 18: .....=........=.........,,........................
        r 19: .....====,=====.........,,........................
        r 20: .........P,,,,,,,,,,,,,,,,........................
        r 21: .......T................,,........................
        r 22: ........................,,,,,,,,,,,,,,,,..........
        r 23: ........................,,.........====,=====.....
        r 24: ........................,,.........=..^^^^^.=.....
        r 25: ........................,,.........=..^^^^^.=.....
        r 26: ........................,,.........=..HHHHH.=.....
        r 27: ........................,,.........=..HHHHH.=.....
        r 28: ........................,,.........=..HHDHH.=.....
        r 29: ........................,,.........=....O...=.....
        r 30: ........................,,.........=........=.....
        r 31: ........................,,.........==========.....
        r 32: ............T...........,,........................
        r 33: ........................,,..........T.............
        r 34: ......*.................,,........................
        r 35: ........................,,........................
        r 36: ........................**........................
        r 37: ........................,,........................
```

**Reads-as cues built into the layout:**
- North water edge → "Ashen Isle is an island."
- `EEEE` at row 2 above the path drop-down → "the dock is the way off." Decorated with a wooden-dock frame, not amber-tinted floor.
- Vertical main path at cols 24-25 from dock to south → "follow the path." Branches west (row 19-20, to player's gate) and east (row 22, to Old Man's gate).
- Player spawn `P` at (9, 20) just outside the player's garden gate → first frame after fade-in shows player + garden + path simultaneously.
- Old Man `O` at (40, 29) inside his fenced yard, immediately south of his door at (40, 28) → he reads as living there, not standing in a stone pen.
- Sign `S` at (26, 5) next to the dock → optional thought-trigger anchor for an "Don't forget your way home" line later.
- `*` at (28, 10), (10, 17 inside garden), (6, 34) and `T` at (8, 6), (36, 7), (3, 9), (44, 25), (12, 32), (36, 33) → scattered decoration variety; no single frame dominates.

**Frame-pattern hints (Tiny Town atlas — exact frames documented in `docs/tilesets/tiny-town.md` per US-61):**
- `^` (roof) uses the row of brown roof tiles; `H` uses the row of wall-front tiles; `D` uses the door frame.
- `=` uses the wooden fence frames (horizontal and corner pieces — author selects per-cell).
- `~` uses the water frames; the dock E-zone uses a wooden-boardwalk-on-water frame.
- Buildings render as roof (top 2 rows) over wall-front (next 2 rows) over door row — top-down "you see roof above, walls below" convention.

### Fog Marsh (30×24)

Wet marsh enclosed by deep water on three sides. Dry path entering from the south, winding north to a ruined shrine in the NE corner. Marsh Hermit (`M`) on the dry path adjacent to the ruin's door (`D`). Whispering Stones (`W`) along the path mid-area.

```
        col  111111111122222222223
        col  0123456789012345678901234567890
        ----  ------------------------------
        r 00: ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        r 01: ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        r 02: ~::::r:::::r::::::::::r::::::~
        r 03: ~::::::r::::::::r::::RRRRRRR:~
        r 04: ~:::r::::::::r:::::::R.....R:~
        r 05: ~::::::::::::::::::::R.....R:~
        r 06: ~::::::r:::::::::::::R..*..R:~
        r 07: ~::::::::::::::::::::R.....R:~
        r 08: ~::::::r:::::::::::::R.....R:~
        r 09: ~:::::::::::r::::::::RRRDRRR:~
        r 10: ~::::::::::::r,,,,,,,,,,M::::~
        r 11: ~::::r::::::::,:::::::r::::::~
        r 12: ~:::::::::::::,::::::::::::::~
        r 13: ~::::::::r::::,::::r:::::::::~
        r 14: ~:::::::::::::,::::::::r:::::~
        r 15: ~:::::r:::::::,::::::::::::::~
        r 16: ~::::::::::::W,::::::r:::::::~
        r 17: ~:::::::r:::::,::::::::::::::~
        r 18: ~::::::::::::r,::::::::r:::::~
        r 19: ~:::::r:::::::,::::::::::::::~
        r 20: ~:::::::::r:::,:r::::::::::::~
        r 21: ~:::::::::::::,::::::::::::::~
        r 22: ~~~~~~~~~~~~~EEEE~~~~~~~~~~~~~
        r 23: ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

**Reads-as cues built into the layout:**
- Three-sided water border (`~`) → "the marsh is enclosed; there's no way around it." This is the geographic substrate that the future `fog-marsh-dead-end` phase needs.
- Wet ground (`:`) covering most of the interior, with reed (`r`) decorations sprinkled through wet cells but **never** on the dry path → "the marsh is alive and wet; the path is where it's safe to walk."
- Single dry path (`,`) winding north from the south entry, then bending east at row 10 toward the ruin → "follow the path; there is exactly one route."
- Whispering Stones (`W`) at (13, 16) immediately west of the path → triggered as the player walks past, no detour needed.
- Ruin (`R`-bordered, 7-wide × 7-tall, NE corner) with stone-floor interior (`.`) and a small relic (`*` at (24, 6)) → reads as "an ancient built thing here, in contrast to all the wet ground."
- Marsh Hermit `M` at (24, 10) on the dry path, immediately south of the ruin door at (24, 9) → he reads as the keeper of this ruin, not a random NPC in the swamp.
- South entry zone `EEEE` at row 22 cols 13-16, connecting to the path at (14, 21) → arriving from Ashen Isle's dock, the player lands directly on the dry path. Round-trip legibility confirmed.

**Frame-pattern hints (Tiny Dungeon atlas — exact frames in `docs/tilesets/tiny-dungeon.md` per US-61):**
- `:` uses a moss / damp / green-grey floor frame (distinct from the existing tan dungeon-floor frames `48-51`); if Tiny Dungeon lacks a suitable wet-frame, document the substitution choice in `fog-marsh.ts`.
- `,` uses a stone-step / boardwalk frame for dry path — visually distinct from `:`.
- `R` uses brick-wall frames `0-2`; `D` uses door frame `22` (existing EXIT frame, retained for the ruin door).
- `r` uses a small-bush or grass-tuft frame as a reed stand-in (Tiny Dungeon does not include true cattail sprites — accepted limitation per "Out of scope").
- `~` uses a deep-water frame; if Tiny Dungeon lacks one, the wet-edge decoration may layer a dark-blue-tinted variant of the wet-ground frame to visually differ from walkable wet ground.

### Notes for the build-loop

- These schematics are the **reference layout**. If a row differs by one cell from a 50- or 30-column count due to schematic drift, treat the topology (path connectivity, NPC adjacency, door positions, edge composition) as authoritative and adjust filler tiles as needed.
- All `(col, row)` coordinates given inline above are the binding spawn / trigger / door positions for the area data files.
- Decoration entries in the area files reference the schematics: comments like `// from world-legibility.md schematic, Ashen Isle row 19 col 9 — player garden gate` are encouraged for traceability.

---

## Done-when (observable)

### Structural — engine (US-58)

- [ ] `AreaDefinition.decorations: DecorationDefinition[]` exists in `src/data/areas/types.ts` (verified: source read) [US-58]
- [ ] `DecorationDefinition` has exactly `{ col, row, spriteFrame }` (verified: source read) [US-58]
- [ ] `GameScene.renderDecorations()` exists and is called in area-load order after `renderTileMap` and before `renderProps` (or alongside; depth ordering is what matters) [US-58]
- [ ] Decoration sprites render at depth 2; depth map in AGENTS.md is updated to insert "Decorations | 2 | main" between "Tiles | 0" and "Props | 3" [US-58]
- [ ] Missing-frame decoration logs a warning naming `(col, row)` and the missing frame, then skips (verified: source read of the warn-and-skip branch + a deliberate dev test entry with a bogus frame) [US-58]
- [ ] No collision contribution from decorations — `collision.ts` is not consulted for decoration cells (verified: source read; player walks through a decoration tile placed on a FLOOR cell) [US-58]

### Structural — Ashen Isle redesign (US-59)

- [ ] Continuous path from `playerSpawn` to Old Man's cottage to dock exit; verifiable by visually following the dirt/cobble decoration tiles in DevTools or the editor map view [US-59]
- [ ] At least one ≥ 3×3 building composition (roof + wall-front + door) using Tiny Town atlas frames [US-59]
- [ ] Old Man spawn `(col, row)` is on a path tile adjacent to a building door tile (verified: read coordinates from `ashen-isle.ts`, cross-reference the decoration layer) [US-59]
- [ ] At least one ≥ 4-tile fence run using a Tiny Town fence frame [US-59]
- [ ] At least one full area edge (one side: top OR bottom OR left OR right) is water tiles [US-59]
- [ ] At least three distinct decorative frame ids in use beyond grass + flower; no single frame > ~30% of decoration entries by count (verified: tally via grep or a small counter in the area file's load-time) [US-59]
- [ ] EXIT zone visually shows a dock or gate sprite, NOT amber-tinted floor (verified: open Ashen Isle, walk to the exit, screenshot reads as "wooden dock" or "wooden gate") [US-59]
- [ ] All existing `ashen-isle` triggers fire on the same flag keys after redesign (verified by walking the Old Man → dialogue → choice paths and observing the same flags set as before) [US-59]
- [ ] First frame after fade-in (at zoom 1) shows player + at least one decorated landmark in viewport (verified manually) [US-59]

### Structural — Fog Marsh redesign (US-60)

- [ ] Visible distinction between wet ground (most of FLOOR cells) and dry path (decoration overlay on a connected route) [US-60]
- [ ] Ruin corner (3-5 tiles) using Tiny Dungeon brick frames, placed in one corner [US-60]
- [ ] At least 8 reed/vegetation decorations in wet ground area, none on the dry path [US-60]
- [ ] At least one full edge is impassable wet/reed-wall composition (WALL cells with marsh-edge decoration) [US-60]
- [ ] Marsh Hermit spawn `(col, row)` is on the dry path adjacent to the ruin [US-60]
- [ ] EXIT zone reaches the dry path (verified by walking from the entry point to the exit on path tiles only — no need to step into wet ground) [US-60]
- [ ] Round-trip legibility: exiting Ashen Isle's dock → entering Fog Marsh lands on the dry path; exiting Fog Marsh → returning to Ashen Isle lands on the dock decoration (verified manually for both directions) [US-60]
- [ ] Whispering Stones trigger renders adjacent to or on the path (visible to a player following the path) [US-60]
- [ ] All existing `fog-marsh` triggers fire on the same flag keys after redesign [US-60]

### Structural — vocabulary docs (US-61)

- [ ] `docs/tilesets/tiny-town.md` exists with frame table covering all Ashen Isle decorations + a Reserved-for-future appendix [US-61]
- [ ] `docs/tilesets/tiny-dungeon.md` exists with frame table covering all Fog Marsh decorations + a Reserved-for-future appendix [US-61]
- [ ] Each doc explains the atlas grid math (frame = row × cols + col) [US-61]
- [ ] AGENTS.md "Directory layout" tree includes `docs/tilesets/` [US-61]

### Behavior — reads-as (legibility)

Each reads-as is paired with a mechanism proxy, per phase rule.

- [ ] **Ashen Isle reads-as a coastal village**: a first-time observer (someone who has never seen Ashen Isle before) given the question "where are you, and what are the things around you?" can identify (a) "I'm in / next to a village", (b) "that's a path", (c) "that's a house", (d) "that's the water / the edge of the island", (e) "that's the way out (the dock/gate)". At least 4 of 5 identifications correct = pass. [US-59]
- [ ] **Ashen Isle mechanism proxy**: every legibility element is structurally present per the US-59 acceptance criteria above. [US-59]
- [ ] **Fog Marsh reads-as a wet marsh with a ruin**: same observer test. Identifications: (a) "I'm in a marsh / wetland / swamp", (b) "the dry strip is the path", (c) "that broken-walls thing is a ruin / shrine / tomb", (d) "the edges are too thick / wet to cross", (e) "the door at the end is the way through". At least 4 of 5 = pass. [US-60]
- [ ] **Fog Marsh mechanism proxy**: every legibility element is structurally present per the US-60 acceptance criteria. [US-60]
- [ ] **Diegetic exit reads-as a thing you walk through**: same observer can point at the dock/gate on Ashen Isle and the door on Fog Marsh and say "that's the way out" — without seeing the player ever walk through them. [US-59, US-60]

### Variant baseline (per-area verification)

- [ ] **Ashen Isle**: redesigned area loads, fade-in from TitleScene shows the new layout, all NPC + trigger interactions still work end-to-end, exit to Fog Marsh works [US-59]
- [ ] **Fog Marsh**: redesigned area loads via the Ashen Isle exit, all NPC + trigger interactions still work end-to-end, exit back to Ashen Isle works [US-60]
- [ ] **Round-trip**: Ashen Isle → Fog Marsh → Ashen Isle, three full transitions, no orphan sprites, no console warnings, flags persist across transitions [US-59, US-60]

### Editor sync

- [ ] `tools/editor/src/mapRenderer.ts` renders the decoration layer on top of the base tile grid, before NPC circles and trigger overlays. Verified by opening the editor and seeing the redesigned Ashen Isle layout (path, houses, fence, water edge, dock) match what the game shows. [US-58, US-59]
- [ ] `cd tools/editor && npm run build` succeeds with the new types [US-58]

### Error paths

- [ ] A decoration with a bogus `spriteFrame` does NOT crash the area load — only logs a warning and skips (verified by adding a deliberate temp entry with `spriteFrame: 'bogus'`, observing console + visible missing decoration, then removing it) [US-58]
- [ ] A decoration on a coordinate outside `(mapCols, mapRows)` is not crashing — either ignored with a warning OR rendered off-grid harmlessly. Document the chosen behaviour in `renderDecorations` source comment. [US-58]

### Invariants

- [ ] `npx tsc --noEmit && npm run build` passes [phase]
- [ ] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors during 60 seconds of play covering: spawn on Ashen Isle, walk the path to the Old Man, full dialogue, walk to dock, transition to Fog Marsh, walk path to Marsh Hermit, full dialogue, Whispering Stones, return to Ashen Isle [phase]
- [ ] AGENTS.md "Directory layout" tree updated to include `docs/tilesets/` [phase]
- [ ] AGENTS.md "Depth map" updated to insert "Decorations | 2 | main" row between Tiles and Props [phase]
- [ ] AGENTS.md "File ownership" rows updated for: `data/areas/types.ts` (`AreaDefinition.decorations`, `DecorationDefinition`), `scenes/GameScene.ts` (`renderDecorations()`), `data/areas/ashen-isle.ts` and `fog-marsh.ts` (mention the redesigned compositions), `tools/editor/src/mapRenderer.ts` (decoration layer rendering) [phase]
- [ ] AGENTS.md "Behavior rules" gains a "Decorations" entry mirroring the existing "Decorative props (non-blocking)" entry — describing tile-snapped, depth 2, atlas-frame literal, no collision contribution, missing-frame warn-and-skip [phase]
- [ ] **Loop-invariant audit (Learning EP-01):** decorations are created once at area load, not per-frame; no `update()` work added [phase]

## Golden principles (phase-relevant)

- **Depth map authority:** Decorations land at depth 2 — a new entry, but explicit. Ad-hoc depths still prohibited.
- **Parameterized systems:** All redesigned-area work happens in data files. The engine (US-58) is generic; it doesn't know about Ashen Isle or Fog Marsh specifically.
- **No silent breaking changes:** `decorations` is required from the start, but every existing area definition is updated in this same phase, so no transitional state with missing fields hits `main`.
- **From LEARNINGS EP-01 (loop invariants):** decoration sprites are created once at area load; no per-frame creation, no per-frame `setTexture`. Mirror the props pattern.
- **From LEARNINGS #57 (depth-map authority):** the new depth 2 row must be added to the AGENTS.md depth map in the same PR that introduces it.
- **Communicative-not-pretty:** placeholder art stays placeholder. Any work that spends time on "make this look nicer" rather than "make this read more clearly" is out-of-scope and bumped to a later art-pass phase.

## Out of scope

- New tilesets beyond the existing tiny-town and tiny-dungeon. (If Fog Marsh's reed/marsh visual is unsatisfying with tiny-dungeon, that's accepted as a known limitation and addressed in a future art-pass phase, not here.)
- Midjourney / Flow / hand-painted art. Phase is explicitly Kenney CC0 only.
- Animated decorations (water shimmer, reed sway). Static frames only.
- Variable decoration sizes (multi-tile decoration sprites). Each decoration is exactly 1×1.
- Per-cell collision overrides driven by decoration kind (e.g. "this fence frame blocks but its neighbour doesn't"). Collision stays FLOOR / WALL only on the base layer.
- Wayfinding HUD, objective text, sparkle markers — those land in the dedicated `wayfinding` phase later.

## AGENTS.md sections affected

When this phase ships, the Phase Reconciliation Gate will update:
- **Directory layout** — add `docs/tilesets/` subtree.
- **Depth map** — insert "Decorations | 2 | main" between Tiles and Props.
- **File ownership** — updated rows for `data/areas/types.ts`, `scenes/GameScene.ts`, `data/areas/ashen-isle.ts`, `data/areas/fog-marsh.ts`, `tools/editor/src/mapRenderer.ts`.
- **Behavior rules** — new "Decorations" entry; existing "Tile rendering (sprite-based)" entry amended to mention the decoration layer rendering pass.
- **Scaling tuning guide** — no change.
- **Controls** — no change.
