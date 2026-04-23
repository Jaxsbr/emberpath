# Phase: tileset

Status: draft

## Phase goal

Replace `fillRect`-based flat-color tile rendering with sprite-based rendering from Kenney dev-art atlases (tiny-town for Ashen Isle, monochrome-rpg for Fog Marsh), add per-cell tile variants for visual texture, introduce a non-blocking decorative prop system, and restyle exit zones as diegetic path/doorway tiles. The world should read as "a place worth walking through" instead of a geometry diagram, and Fog Marsh should feel visually distinct from Ashen Isle.

## Design direction

Charming classic-RPG overworld aesthetic (16-bit pixel-art tilemap idiom). **Ashen Isle** leans cool green-brown with scattered stones, withered shrubs, bare trees, and dirt paths — "quietly forsaken," not grimdark. **Fog Marsh** leans monochrome/desaturated grey with gravestones, skulls, twisted stumps, and dead shrubs — a visual cue for "dead-end" in the allegory. Source tiles are 16px; render at 32px using nearest-neighbor filtering for crisp pixel art. Build-loop must apply the `sabs:frontend-design` skill during implementation.

## Safety criteria

N/A — this phase introduces no API endpoints, user text input fields, or query interpolation. All new data flows are internal (area config → render). No auto-safety criteria apply.

## Stories

### US-48 — Sprite-based tile rendering

As a player, I want the map rendered with actual tile sprites instead of flat-color rectangles, so that the world looks like a place instead of a geometry diagram.

**Acceptance criteria**:
- `GameScene` loads the Kenney tiny-town tile atlas and renders FLOOR / WALL / EXIT tiles as sprites at `TILE_SIZE` (32px), source frames scaled 2× from 16px with nearest-neighbor (no smoothing)
- `AreaDefinition` gains a required `tileset` string field specifying which atlas to use
- Ashen Isle sets `tileset: 'tiny-town'`; Fog Marsh sets `tileset: 'monochrome-rpg'`
- EXIT tiles render via the tileset's path/doorway frame — `EXIT_COLOR` rectangle render path is removed
- `tileGraphics` Graphics object is removed from `GameScene`; all tile rendering happens via sprites
- Existing `visual.floorColor` / `visual.wallColor` fields are retained on `AreaDefinition` for the editor's map-overview mode (editor keeps rendering colored squares; the game scene ignores these fields)
- Both Ashen Isle and Fog Marsh load and render without console errors on scene start

**User guidance:**
- Discovery: Automatic on scene load — no user action required
- Manual section: N/A (no user-facing interaction)
- Key steps: N/A

**Design rationale:** Kenney tiny-town is the closest dev-art match to the bright-friendly tone of the fox child sprite; monochrome-rpg provides a contrasting grey/dead palette for Fog Marsh to reinforce the dead-end allegory. Retaining `visual.floorColor/wallColor` on `AreaDefinition` keeps the editor's minimap working without bundling atlases into the editor build.

---

### US-49 — Tile variants with deterministic selection

As a player, I want floor and wall tiles to have visual variation instead of a single repeated sprite, so that the world doesn't look like a checkerboard.

**Acceptance criteria**:
- Floor tiles select from ≥3 variant frames per tileset using a pure function of `(col, row)` — identical coordinates always produce the same frame on every render and every reload
- Wall tiles select from ≥2 variant frames per tileset with the same determinism property
- Variant selection is a pure function of `(col, row, tileType, tilesetId)` — no RNG state, no per-frame recomputation
- A single lookup module (`src/maps/tilesets.ts`) owns the registry: `tilesetId → { atlasKey, tileFrames: Record<TileType, string[]> }`
- Both tilesets (tiny-town, monochrome-rpg) have populated variant frame lists

**User guidance:**
- Discovery: Automatic — visual variation is ambient
- Manual section: N/A
- Key steps: N/A

**Design rationale:** Deterministic selection by coordinate is standard pixel-art-RPG practice — runtime RNG causes flicker between scene restarts and makes bug reports non-reproducible. A lookup module isolates atlas wiring from scene code so adding a third area later is a config change, not a scene edit.

---

### US-50 — Decorative prop scatter

As a player, I want scattered non-blocking decorations (bushes, stones, stumps, bones, gravestones) in each area, so that the world feels inhabited and I have landmarks to navigate by.

**Acceptance criteria**:
- `AreaDefinition` gains a required `props: PropDefinition[]` field
- `PropDefinition` is exported from `src/data/areas/types.ts` with at minimum `{ id: string; col: number; row: number; spriteFrame: string }`
- Props render as sprites at world-space depth 3 — between Tiles (0) and Entities (5) — so the fox walks in front of nearby props when overlapping
- Props are non-blocking: `collision.ts` is NOT modified; walking through a prop's tile coordinate produces no collision stop
- Ashen Isle defines ≥15 props using tiny-town environment frames (bushes, stones, trees, fences)
- Fog Marsh defines ≥10 props using monochrome-rpg environment frames (gravestones, skulls, dead shrubs, bones)
- Editor's `mapRenderer.ts` renders props as small colored dots/glyphs so the editor map-overview reflects prop positions
- AGENTS.md depth map updated to include `Props | 3 | main | Decorative non-blocking sprites` between Tiles and Entities

**User guidance:**
- Discovery: Automatic on area load
- Manual section: N/A
- Key steps: N/A

**Design rationale:** Depth 3 is chosen so the fox (depth 5) can obscure smaller foreground props that overlap vertically, reading as near-camera, while keeping the player silhouette readable. Hand-placed (not procedurally scattered) because 10–25 props per area is small enough to place by hand and produces intentional landmarks; procedural scatter adds complexity and generic-looking fields.

**Consumer adaptation:** Each area passes its own tileset id and prop list; `PropDefinition.spriteFrame` references a frame in the area's registered tileset, not a global prop set. The game scene does not assume any specific prop taxonomy — areas are free to use whichever frames their tileset exposes.

---

### US-51 — Exit zones styled as path tiles

As a player, I want exit zones to look like paths or doorways in the art style, so that I can intuit where map boundaries lead without debug annotations.

**Acceptance criteria**:
- EXIT tiles in Ashen Isle render using tiny-town's dirt-path frame (specific frame name documented in `tilesets.ts`)
- EXIT tiles in Fog Marsh render using monochrome-rpg's flagstone/doorway frame (specific frame name documented)
- Debug overlay (F3) still highlights exit zones with orange outline and destination label (existing behavior preserved)
- `EXIT_COLOR` constant is removed from `GameScene.ts` and is no longer referenced anywhere in the source tree
- The exit tile reads as a walkable path/doorway to the player — not a glowing HUD marker

**User guidance:**
- Discovery: Walk toward map edges — path/doorway tiles indicate reachable exits
- Manual section: N/A (replaces existing visual only)
- Key steps: N/A

**Design rationale:** Diegetic exit markers (a dirt path that visibly leads off-screen) communicate affordance in art language rather than HUD language; the existing amber-gold rectangle reads as "debug annotation" rather than "game world."

---

## Done-when (observable)

### Error paths

- [ ] If an area's `tileset` id is not registered in `tilesets.ts`, `GameScene` logs a descriptive console error naming the missing tileset id and does not crash (scene may render fallback flat-color tiles or refuse to load with a clear message — either is acceptable, but silent failure is not) [US-48]
- [ ] If a `PropDefinition.spriteFrame` references a frame that does not exist in the tileset atlas, a console warning is logged naming the prop id and missing frame; scene continues to render other props [US-50]

### Structural — assets & types

- [ ] `assets/tilesets/tiny-town/` exists and contains at least the source atlas PNG and a frame-mapping JSON (Phaser atlas format or equivalent index) [US-48]
- [ ] `assets/tilesets/monochrome-rpg/` exists with the same contents for the monochrome atlas [US-48]
- [ ] `src/maps/tilesets.ts` exists and exports a registry of tilesets keyed by id, each entry containing `{ atlasKey: string; tileFrames: Record<TileType, string[]> }` [US-49]
- [ ] `tilesets.ts` registry has entries for `tiny-town` and `monochrome-rpg`, each with `FLOOR` ≥3 frames, `WALL` ≥2 frames, `EXIT` ≥1 frame [US-49]
- [ ] `AreaDefinition` in `src/data/areas/types.ts` has required field `tileset: string` [US-48]
- [ ] `AreaDefinition` has required field `props: PropDefinition[]` [US-50]
- [ ] `PropDefinition` exported from `types.ts` with `{ id: string; col: number; row: number; spriteFrame: string }` at minimum [US-50]
- [ ] `src/data/areas/ashen-isle.ts` sets `tileset: 'tiny-town'` and defines ≥15 entries in `props` [US-50]
- [ ] `src/data/areas/fog-marsh.ts` sets `tileset: 'monochrome-rpg'` and defines ≥10 entries in `props` [US-50]

### Structural — rendering

- [ ] `GameScene.preload()` loads both tileset atlases via `this.load.atlas(...)` (or `load.image` + manual frame config) [US-48]
- [ ] `GameScene.renderTileMap()` contains zero `fillRect` calls for FLOOR/WALL/EXIT tiles (verified: grep in method body returns no matches) [US-48]
- [ ] `grep -n "tileGraphics" src/scenes/GameScene.ts` returns no matches — Graphics-based tile render path removed [US-48]
- [ ] `grep -rn "EXIT_COLOR" src/` returns no matches — constant removed [US-51]
- [ ] Nearest-neighbor texture filtering is applied to tileset textures (verified: `setFilter(Phaser.Textures.FilterMode.NEAREST)` or equivalent applied in preload or at texture load) [US-48]
- [ ] Tile variant selection function is pure — no `Math.random()` or date-based input; depends only on `(col, row, tileType, tilesetId)` (verified: read `tilesets.ts` variant picker) [US-49]
- [ ] Prop rendering adds sprites at depth 3 — between Tiles (0) and Entities (5) (verified: source reads `setDepth(3)` on prop sprites) [US-50]
- [ ] Prop sprites are not added to `collisionBoxes` / wall collision data structures — `collision.ts` is unchanged in this phase (verified: `git diff` for `collision.ts` is empty) [US-50]

### Behavior — per-variant manual verification

Manual verification checklist written to `docs/plan/tileset-manual-verify.md`. Each per-area checkbox below is its own done-when criterion:

- [ ] **Ashen Isle**: On scene load, floor shows ≥3 visually distinct grass/ground variants across the visible map [US-49]
- [ ] **Ashen Isle**: Walls show ≥2 visually distinct stone/edge variants [US-49]
- [ ] **Ashen Isle**: ≥15 props visible across the map (bushes, stones, trees, fences) at expected positions [US-50]
- [ ] **Ashen Isle**: Exit tile renders as a dirt-path sprite; fox can walk into it and trigger area transition [US-51]
- [ ] **Ashen Isle**: Fox sprite renders in front of a prop when the fox's world y > prop's world y (verified by walking behind/in-front of a tree) [US-50]
- [ ] **Fog Marsh**: Floor shows ≥3 visually distinct grey/dead variants across the visible map [US-49]
- [ ] **Fog Marsh**: Walls show ≥2 visually distinct monochrome variants [US-49]
- [ ] **Fog Marsh**: ≥10 props visible (gravestones, skulls, dead shrubs, bones) at expected positions [US-50]
- [ ] **Fog Marsh**: Exit tile renders as a flagstone/doorway sprite; area transition still fires on overlap [US-51]
- [ ] **Both areas**: Tile art renders crisp (no smoothing/blur) — visible on close inspection of a single tile [US-48]
- [ ] **Both areas**: No console errors or warnings during scene load or during normal play for 30 seconds [US-48]

### Behavior — reads-as (required by Visual "reads as" compounded rule)

- [ ] Ashen Isle exit tile communicates "walkable path toward map edge" to a first-time player (rather than "glowing UI marker") — verified via manual check with a new-eye observer note in the manual-verify doc [US-51]
- [ ] Fog Marsh exit tile communicates "doorway/stone threshold" to a first-time player — verified same way [US-51]

### Editor sync

- [ ] Editor's `tools/editor/src/mapRenderer.ts` renders props as small colored dots or glyphs at `(col, row)` positions — verified by opening the editor and inspecting either area [US-50]
- [ ] `cd tools/editor && npm run build` succeeds [US-48]

### Invariants

- [ ] `npx tsc --noEmit && npm run build` passes for the main game [phase]
- [ ] AGENTS.md depth map includes a row for `Props | 3 | main | Decorative non-blocking sprites` between Tiles and Entities [US-50]
- [ ] AGENTS.md "Directory layout" tree reflects `assets/tilesets/` [phase]
- [ ] AGENTS.md "File ownership" table includes an entry for `src/maps/tilesets.ts` [US-49]
- [ ] AGENTS.md "Behavior rules" includes a new rule describing sprite-based tile rendering, per-area `tileset` field, nearest-neighbor filtering, deterministic variant selection, and non-blocking props [US-48]

## Golden principles (phase-relevant)

- **Depth map authority**: New visual elements must reference the depth map in AGENTS.md. Ad-hoc depth values are prohibited. (This phase adds `Props | 3`.)
- **Responsive scaling**: Phaser Scale.RESIZE mode — no fixed 800×600. Tile sprites must render correctly at any viewport size; the world stays 1600×1216 pixels for Ashen Isle.
- **Parameterized systems**: Area systems receive area data via constructor or parameters — no global imports. Tile and prop rendering must follow the same discipline: both receive the `AreaDefinition` as input.
- **No silent breaking changes**: Existing `visual.floorColor/wallColor` fields remain on `AreaDefinition` for editor use. They are retained explicitly, not silently removed.
- **From LEARNINGS EP-01**: Before submitting, check for (a) setup ops that run every loop iteration but only need to run once (tile sprite creation runs once in `renderTileMap`, NOT per frame), (b) dead guard conditions, (c) comments referencing behavior no longer present, (d) function names implying a different contract than the implementation.

## AGENTS.md sections affected

When this phase ships, the Phase Reconciliation Gate will update:
- **Directory layout** — add `assets/tilesets/` subtree, add `src/maps/tilesets.ts`
- **File ownership** — add row for `src/maps/tilesets.ts`; update row for `scenes/GameScene.ts` to reflect sprite-based tile rendering and prop rendering
- **Depth map** — add `Props | 3 | main | Decorative non-blocking sprites` row between Tiles and Entities
- **Behavior rules** — add tileset rendering rule (sprite-based, per-area atlas via `tileset` field, nearest-neighbor filtering, deterministic variant selection, non-blocking props)
