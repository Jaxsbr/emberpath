## Phase goal

Replace `fillRect`-based flat-color tile rendering with sprite-based rendering from Kenney dev-art atlases (tiny-town for Ashen Isle, tiny-dungeon for Fog Marsh), add per-cell tile variants for visual texture, introduce a non-blocking decorative prop system, and restyle exit zones as diegetic path/doorway tiles. The world should read as "a place worth walking through" instead of a geometry diagram, and Fog Marsh should feel visually distinct from Ashen Isle.

### Design direction

Charming classic-RPG overworld aesthetic (16-bit pixel-art tilemap idiom). **Ashen Isle** leans cool green-brown with scattered stones, withered shrubs, bare trees, and dirt paths — "quietly forsaken," not grimdark. **Fog Marsh** uses a dungeon/tomb aesthetic — brown brick walls, tan/grey stone floors, wooden doors, barrels, crates, altars, candles, bones — a visual cue for "trapped dead-end" in the allegory. Source tiles are 16px; render at 32px using nearest-neighbor filtering for crisp pixel art. Apply the `sabs:frontend-design` skill during implementation.

### Stories in scope

- US-48 — Sprite-based tile rendering
- US-49 — Tile variants with deterministic selection
- US-50 — Decorative prop scatter
- US-51 — Exit zones styled as path tiles

### Done-when (observable)

#### Error paths
- [ ] If an area's `tileset` id is not registered in `tilesets.ts`, `GameScene` logs a descriptive console error naming the missing tileset id and does not crash (scene may render fallback flat-color tiles or refuse to load with a clear message — either is acceptable, but silent failure is not) [US-48]
- [ ] If a `PropDefinition.spriteFrame` references a frame that does not exist in the tileset atlas, a console warning is logged naming the prop id and missing frame; scene continues to render other props [US-50]

#### Structural — assets & types
- [ ] `assets/tilesets/tiny-town/` exists and contains at least the source atlas PNG and a frame-mapping JSON (Phaser atlas format or equivalent index) [US-48]
- [ ] `assets/tilesets/tiny-dungeon/` exists with the same contents for the monochrome atlas [US-48]
- [ ] `src/maps/tilesets.ts` exists and exports a registry of tilesets keyed by id, each entry containing `{ atlasKey: string; tileFrames: Record<TileType, string[]> }` [US-49]
- [ ] `tilesets.ts` registry has entries for `tiny-town` and `tiny-dungeon`, each with `FLOOR` ≥3 frames, `WALL` ≥2 frames, `EXIT` ≥1 frame [US-49]
- [ ] `AreaDefinition` in `src/data/areas/types.ts` has required field `tileset: string` [US-48]
- [ ] `AreaDefinition` has required field `props: PropDefinition[]` [US-50]
- [ ] `PropDefinition` exported from `types.ts` with `{ id: string; col: number; row: number; spriteFrame: string }` at minimum [US-50]
- [ ] `src/data/areas/ashen-isle.ts` sets `tileset: 'tiny-town'` and defines ≥15 entries in `props` [US-50]
- [x] `src/data/areas/fog-marsh.ts` sets `tileset: 'tiny-dungeon'` and defines ≥10 entries in `props` [US-50]

#### Structural — rendering
- [ ] `GameScene.preload()` loads both tileset atlases via `this.load.atlas(...)` (or `load.image` + manual frame config) [US-48]
- [ ] `GameScene.renderTileMap()` contains zero `fillRect` calls for FLOOR/WALL/EXIT tiles (verified: grep in method body returns no matches) [US-48]
- [ ] `grep -n "tileGraphics" src/scenes/GameScene.ts` returns no matches — Graphics-based tile render path removed [US-48]
- [ ] `grep -rn "EXIT_COLOR" src/` returns no matches — constant removed [US-51]
- [ ] Nearest-neighbor texture filtering is applied to tileset textures (verified: `setFilter(Phaser.Textures.FilterMode.NEAREST)` or equivalent applied in preload or at texture load) [US-48]
- [ ] Tile variant selection function is pure — no `Math.random()` or date-based input; depends only on `(col, row, tileType, tilesetId)` (verified: read `tilesets.ts` variant picker) [US-49]
- [ ] Prop rendering adds sprites at depth 3 — between Tiles (0) and Entities (5) (verified: source reads `setDepth(3)` on prop sprites) [US-50]
- [ ] Prop sprites are not added to `collisionBoxes` / wall collision data structures — `collision.ts` is unchanged in this phase (verified: `git diff` for `collision.ts` is empty) [US-50]

#### Behavior — per-variant manual verification

Manual verification checklist written to `docs/plan/tileset-manual-verify.md`. Each per-area checkbox below is its own done-when criterion:

- [ ] **Ashen Isle**: On scene load, floor shows ≥3 visually distinct grass/ground variants across the visible map [US-49]
- [ ] **Ashen Isle**: Walls show ≥2 visually distinct stone/edge variants [US-49]
- [ ] **Ashen Isle**: ≥15 props visible across the map (bushes, stones, trees, fences) at expected positions [US-50]
- [ ] **Ashen Isle**: Exit tile renders as a dirt-path sprite; fox can walk into it and trigger area transition [US-51]
- [ ] **Ashen Isle**: Fox sprite renders in front of a prop when the fox's world y > prop's world y (verified by walking behind/in-front of a tree) [US-50]
- [ ] **Fog Marsh**: Floor shows ≥3 visually distinct grey/dead variants across the visible map [US-49]
- [ ] **Fog Marsh**: Walls show ≥2 visually distinct monochrome variants [US-49]
- [ ] **Fog Marsh**: ≥10 props visible (barrels, crates, altars, candles, bones) at expected positions [US-50]
- [ ] **Fog Marsh**: Exit tile renders as a wooden-door/dungeon-doorway sprite; area transition still fires on overlap [US-51]
- [ ] **Both areas**: Tile art renders crisp (no smoothing/blur) — visible on close inspection of a single tile [US-48]
- [ ] **Both areas**: No console errors or warnings during scene load or during normal play for 30 seconds [US-48]

#### Behavior — reads-as (required by Visual "reads as" compounded rule)
- [ ] Ashen Isle exit tile communicates "walkable path toward map edge" to a first-time player (rather than "glowing UI marker") — verified via manual check with a new-eye observer note in the manual-verify doc [US-51]
- [ ] Fog Marsh exit tile communicates "wooden door / tomb threshold" to a first-time player — verified same way [US-51]

#### Editor sync
- [ ] Editor's `tools/editor/src/mapRenderer.ts` renders props as small colored dots or glyphs at `(col, row)` positions — verified by opening the editor and inspecting either area [US-50]
- [ ] `cd tools/editor && npm run build` succeeds [US-48]

#### Invariants
- [ ] `npx tsc --noEmit && npm run build` passes for the main game [phase]
- [ ] AGENTS.md depth map includes a row for `Props | 3 | main | Decorative non-blocking sprites` between Tiles and Entities [US-50]
- [ ] AGENTS.md "Directory layout" tree reflects `assets/tilesets/` [phase]
- [ ] AGENTS.md "File ownership" table includes an entry for `src/maps/tilesets.ts` [US-49]
- [ ] AGENTS.md "Behavior rules" includes a new rule describing sprite-based tile rendering, per-area `tileset` field, nearest-neighbor filtering, deterministic variant selection, and non-blocking props [US-48]

### Golden principles (phase-relevant)

- **Depth map authority**: New visual elements must reference the depth map in AGENTS.md. Ad-hoc depth values are prohibited. (This phase adds `Props | 3`.)
- **Responsive scaling**: Phaser Scale.RESIZE mode — no fixed 800×600. Tile sprites must render correctly at any viewport size; the world stays 1600×1216 pixels for Ashen Isle.
- **Parameterized systems**: Area systems receive area data via constructor or parameters — no global imports. Tile and prop rendering must follow the same discipline: both receive the `AreaDefinition` as input.
- **No silent breaking changes**: Existing `visual.floorColor/wallColor` fields remain on `AreaDefinition` for editor use. They are retained explicitly, not silently removed.
- **From LEARNINGS EP-01**: Before submitting, check for (a) setup ops that run every loop iteration but only need to run once (tile sprite creation runs once in `renderTileMap`, NOT per frame), (b) dead guard conditions, (c) comments referencing behavior no longer present, (d) function names implying a different contract than the implementation.
- **Frontend-design skill applies**: This phase touches visual rendering — apply the `sabs:frontend-design` guidelines (distinctive palette, intentional pixel-art rendering, no generic defaults).
