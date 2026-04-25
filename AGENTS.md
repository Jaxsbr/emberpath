# Emberpath

## Project type: phaser-game

## Purpose
Mobile-first top-down exploration game with story scenes, inspired by Pilgrim's Progress, using AI-generated art (Midjourney + Flow). An allegorical journey game POC that proves three things: character exploration, story scene triggers, and AI art rendering in-engine.

## Running

```bash
npm install
npm run dev      # Vite dev server at localhost:5173
npm run build    # Production build to dist/
```

### Editor (dev tool)

```bash
cd tools/editor
npm install
npm run dev      # Vite dev server at localhost:5174
npm run build    # Production build to tools/editor/dist/
```

## Controls

- **Desktop:** W/A/S/D to move up/left/down/right
- **Desktop dialogue choices:** Arrow keys browse (> prefix on selected), Enter confirms
- **Mobile:** Touch and drag anywhere to activate virtual joystick
- **Mobile dialogue choices:** Tap a choice to highlight it (browse), tap Confirm button to commit (browse-then-confirm pattern — prevents mis-taps)

## Directory layout

```
src/
  main.ts              # Phaser game config + bootstrap
  scenes/
    TitleScene.ts      # Title screen — "Emberpath" + Start button + flag reset
    GameScene.ts       # Game world — area loading, tile rendering, player, camera, system orchestration, exit zone transitions
    StoryScene.ts      # Full-screen story scenes — image placeholder + text panel + fade
  systems/
    input.ts           # InputSystem — WASD keyboard + virtual joystick
    movement.ts        # moveWithCollision — axis-independent movement with area collision data
    collision.ts       # collidesWithWall + collidesWithNpc — bounding box vs area map and NPCs
    npcInteraction.ts  # NpcInteractionSystem — proximity detection, interaction prompt, Space/tap trigger
    dialogue.ts        # DialogueSystem — text box, typewriter effect, choices, node graph traversal
    thoughtBubble.ts   # ThoughtBubbleSystem — floating text near player, auto-dismiss, sequential queue
    triggerZone.ts     # TriggerZoneSystem — zone overlap detection, type dispatch
    conditions.ts      # evaluateCondition — shared flag-based condition parsing (AND logic, comparison operators)
    animation.ts       # AnimationSystem — direction-aware sprite animation state machine (idle/walk/run) — delegates octant math to direction.ts
    direction.ts       # Shared 8-direction names (DIRECTIONS, Direction type) + vectorToDirection/velocityToDirection octant function (single source)
    npcSprites.ts      # NPC sprite registry — NPC_SPRITES keyed by sprite id with per-sprite frame counts, hasNpcSprite, getNpcSpriteIds
    npcBehavior.ts     # NpcBehaviorSystem — per-NPC idle/walk/aware/dialogue state machine, Chebyshev-bounded wander, pre-step wall sampling, setTexture on facing change, enterDialogue/exitDialogue, getLivePositions
    debugOverlay.ts    # DebugOverlaySystem — F3 toggleable overlay showing trigger zones, exit zones, NPC interaction/wander/awareness radii
  data/
    areas/
      types.ts         # AreaDefinition, ExitDefinition, NpcDefinition, TriggerDefinition, DialogueScript, StorySceneDefinition
      registry.ts      # Area registry — getArea(id), getAllAreaIds(), getDefaultAreaId()
      ashen-isle.ts    # Ashen Isle area definition (50x38 map, Old Man NPC, triggers, dialogues, story scene)
      fog-marsh.ts     # Fog Marsh area definition (30x24 map, Marsh Hermit NPC, triggers, dialogues, story scene)
  triggers/
    flags.ts           # Flag store — getFlag, setFlag, incrementFlag, resetAllFlags, localStorage persistence
  maps/
    constants.ts       # TILE_SIZE, PLAYER_SIZE, PLAYER_SPEED, NPC_SIZE, TileType (FLOOR/WALL/EXIT — EXIT is render-only)
    tilesets.ts        # TILESETS registry + resolveFrame() deterministic variant picker per (col,row,kind,tilesetId)
assets/
  characters/
    fox-pip/           # PixelLab-generated fox child animation frames (96 PNGs)
      idle/            # 8 directions × 4 frames each
        north/north-east/east/south-east/south/south-west/west/north-west/  frame_000..003.png
      walk/            # 8 directions × 8 frames each
        north/north-east/east/south-east/south/south-west/west/north-west/  frame_000..007.png
  tilesets/
    tiny-town/         # Kenney Tiny Town CC0 — 16×16 packed spritesheet (132 frames, 12×11), Ashen Isle
      tilemap.png      # atlas
      tilemap.json     # grid metadata + provenance
      Tilesheet.txt    # Kenney grid info
      License.txt      # CC0 attribution
    tiny-dungeon/      # Kenney Tiny Dungeon CC0 — 16×16 packed (132 frames, 12×11), Fog Marsh (tomb/dungeon aesthetic)
  npc/
    marsh-hermit/      # PixelLab-generated NPC sprite — 72 sprite PNGs + 1 portrait
      idle/            # 8 directions × 4 frames each
        north/north-east/east/south-east/south/south-west/west/north-west/  frame_000..003.png
      walk/            # 8 directions × 4 frames each
        north/north-east/east/south-east/south/south-west/west/north-west/  frame_000..003.png
      static/          # 8 single-frame PNGs: north.png / north-east.png / ... / north-west.png
      portrait.png     # 1024×1024 dialogue-UI portrait (pixel-art; nearest-filter)
    old-man/           # Same shape as marsh-hermit; portrait.png is painterly (linear-filter)
tools/
  editor/              # Standalone Vite dev tool — area map, dialogue tree, story flow
    src/
      main.ts          # App shell — area selector, tab navigation, detail panel
      style.css        # Dark theme CSS with debug overlay color variables
      mapRenderer.ts   # Canvas-based area map — tile grid, NPC circles, trigger/exit overlays
      dialogueRenderer.ts  # Dialogue tree node graph — BFS layout, SVG edges, flag annotations
      flowRenderer.ts  # Story flow overview — area boxes, exit arrows, flag dependency lines
    index.html         # Entry point
    package.json       # Separate Vite + TypeScript project
    vite.config.ts     # @game path alias to ../../src
    tsconfig.json      # Compiles editor + shared game types
```

## File ownership

| Module | Owns |
|---|---|
| `scenes/TitleScene.ts` | Title screen UI, scene transition to GameScene, flag reset |
| `scenes/GameScene.ts` | Area loading; sprite-based tile rendering (preloads per-area tileset spritesheet, renderTileMap iterates cells and calls resolveFrame from `maps/tilesets.ts` to pick deterministic variants per (col,row), FLOOR/WALL/EXIT sprites at depth 0); prop rendering (renderProps iterates area.props at depth 3 with missing-frame warning+skip); graceful flat-color fallback on unknown tileset id; fox-pip animated player sprite (preloads 96 frames across idle:4f and walk:8f per direction, registers 16 animations for 8 directions); NPC sprite preload driven by the NPC sprite registry (idle/walk per direction + static poses); NPC portrait preload driven by the portrait registry (`npc-portrait-<id>` keys) with a one-time `load.complete` callback that applies `setFilter(LINEAR)` to portraits whose registry filter is `'linear'` (nearest-filter portraits inherit the global pixelArt:true default); NPC animation registration mirroring fox-pip (npc-{spriteId}-{idle,walk}-{dir} at 8 fps repeat:-1); NPC behaviour system orchestration (construct after renderNpcs, call update before triggerZone each frame); NPC live-position propagation into collision + npcInteraction every tick; enterDialogue/exitDialogue hooks wired around dialogueSystem.start with try/catch recovery; 8-direction movement; camera setup; update loop; system orchestration; exit zone detection; area transitions with fade |
| `scenes/StoryScene.ts` | Full-screen story scenes — beat display, fade transitions, GameScene pause/resume |
| `systems/input.ts` | All input handling — keyboard keys, touch joystick lifecycle |
| `systems/movement.ts` | Position updates with collision checking — accepts area collision data (map + NPCs + optional npcLivePositions map) |
| `systems/collision.ts` | Wall and NPC collision detection — getNpcBounds/collidesWithNpc consult an optional NpcLivePositions map; fall back to static spawn tile when no live snapshot is available |
| `systems/npcInteraction.ts` | NPC proximity detection, interaction prompt, Space/tap trigger — accepts NPC list via constructor, consumes NPC live positions via setLivePositionsProvider (fallback: static spawn tile) |
| `systems/dialogue.ts` | Dialogue UI (text box, typewriter, choices), node graph state machine. ALSO portrait rendering: per-script-or-node optional `portraitId` resolved as `node.portraitId ?? script.portraitId ?? null`; portrait `Phaser.GameObjects.Image` anchored top-left of the box (origin `(0, 1)`, position `(s(BOX_PADDING), boxY)`) so its bottom edge is flush with the box top; mobile clamp `min(s(PORTRAIT_DESIGN_SIZE), canvasWidth * PORTRAIT_MOBILE_WIDTH_FRACTION)`; speaker label x conditionally offsets right of portrait (+s(8)) when active; four-branch setTexture guard so a swap only fires when the resolved id actually changes (Learning EP-01); error-fallback (unknown id or missing texture) logs and renders no portrait; lifecycle on start/showNode/redrawBox/handleResize/close mirrors every other dialogue UI element |
| `systems/thoughtBubble.ts` | Thought bubble display, auto-dismiss, sequential queue |
| `systems/triggerZone.ts` | Trigger zone evaluation, type dispatch — accepts triggers via constructor |
| `systems/conditions.ts` | Shared condition evaluation — flag-based AND logic with comparison operators |
| `systems/animation.ts` | AnimationSystem — 8-direction fox-pip sprite animation state machine (idle/walk), current speed provider. Octant math lives in `systems/direction.ts` — AnimationSystem is a consumer, not an owner |
| `systems/direction.ts` | DIRECTIONS (iteration order north..north-west), Direction type, vectorToDirection/velocityToDirection — single source of octant math, consumed by AnimationSystem + NpcBehaviorSystem |
| `systems/npcSprites.ts` | NPC sprite registry — NPC_SPRITES keyed by sprite id with per-sprite {idleFrameCount, walkFrameCount}, hasNpcSprite(id) predicate, getNpcSpriteIds() for preload/anim-reg iteration. ALSO portrait registry — NPC_PORTRAITS keyed by sprite id with per-id {file, filter: 'nearest'\|'linear'} (square-aspect 1024×1024 assumed), hasNpcPortrait(id) predicate, getNpcPortraitIds() for preload + per-portrait filter override |
| `systems/npcBehavior.ts` | NpcBehaviorSystem — per-NPC state machine (idle/walk/aware/dialogue); Chebyshev-bounded random wander off spawn tile with pre-step path sampling for wall collision; awareness gate halts the NPC and applies the `static/{dir}.png` texture only when the quantised facing direction changes (lastStaticDir guard, Learning EP-01); enterDialogue/exitDialogue idempotent hooks; getLivePositions exposes centre-of-bounding-box coords to collision + npcInteraction; scene.events.shutdown handler clears per-NPC state |
| `systems/debugOverlay.ts` | F3-toggled debug overlay — trigger zones, exit zones, NPC interaction radius (solid yellow), NPC wander radius (dashed green), NPC awareness radius (dashed yellow) in world space; draw order documented inline as the deterministic z-order |
| `data/areas/types.ts` | All shared types — AreaDefinition (includes required `tileset: string` and `props: PropDefinition[]`; `visual.floorColor/wallColor` retained for editor), ExitDefinition, NpcDefinition (required `sprite: string`, `wanderRadius: number`, `awarenessRadius: number`; `color` retained for editor map-overview), PropDefinition, TriggerDefinition, DialogueScript, StorySceneDefinition |
| `data/areas/registry.ts` | Area registry — maps area IDs to AreaDefinitions, getAllAreaIds() for enumeration |
| `data/areas/ashen-isle.ts` | Ashen Isle area definition — co-located map, NPCs, triggers, dialogues, story scenes, exits |
| `data/areas/fog-marsh.ts` | Fog Marsh area definition — co-located map, NPCs, triggers, dialogues, story scenes, exits |
| `triggers/flags.ts` | Flag store — read/write/increment/reset, localStorage persistence (shared across areas) |
| `maps/constants.ts` | Global constants — TILE_SIZE, PLAYER_SIZE, PLAYER_SPEED, NPC_SIZE, TileType enum (FLOOR=0, WALL=1, EXIT=2 render-only) |
| `maps/tilesets.ts` | TilesetDefinition + TILESETS registry (tiny-town, tiny-dungeon), resolveFrame(tilesetId, kind, col, row) pure variant picker using FNV-1a-style hash of (col,row,kind,tilesetId), hasTileset() predicate |
| `tools/editor/src/main.ts` | Editor app shell — area selector, tab navigation (map, dialogue, flow), view dispatch, detail panel |
| `tools/editor/src/mapRenderer.ts` | Canvas map view — tile grid, NPC circles, trigger/exit zone overlays, click-to-detail |
| `tools/editor/src/dialogueRenderer.ts` | Dialogue tree view — BFS node graph layout, SVG edges, choice labels, flag annotations |
| `tools/editor/src/flowRenderer.ts` | Story flow view — area boxes, exit arrows, flag dependency dashed lines |

## Depth map

Explicit rendering order for visual layers (Learning #57):

| Layer | Depth | Camera | Description |
|---|---|---|---|
| Tiles | 0 | main | Floor, wall, and exit zone tile sprites |
| Props | 3 | main | Decorative non-blocking sprites (bushes, stones, gravestones, etc.) |
| Entities | 5 | main | Player character and NPCs |
| Thoughts | 8 | main | Thought bubble text and background (world-space, above player) |
| Debug overlay | 50 | main | Trigger zone rectangles, exit labels, NPC radii (F3 toggle) |
| UI | 100 | ui | Virtual joystick, HUD elements |
| Interaction prompt | 150 | main | NPC interaction prompt text (world-space) |
| Dialogue | 200 | ui | Dialogue box, speaker name, choice buttons |

New visual elements must reference this map. Ad-hoc depth values are prohibited.

## Behavior rules

- **Scene flow:** TitleScene → GameScene. StoryScene is a parallel scene launched/stopped by GameScene. TitleScene is always the first scene loaded.
- **Responsive scaling:** Phaser Scale.RESIZE mode — canvas adapts to container/viewport size. No fixed 800×600. The tile map world is fixed at 1600×1216 pixels; the camera viewport shows more or fewer tiles depending on screen dimensions.
- **Resize handling:** GameScene adds a direct `window.addEventListener('resize', ...)` that calls `this.scale.refresh()` after one `requestAnimationFrame` — this forces Phaser to re-detect parent dimensions on orientation change (Phaser's own handler only sets a dirty flag on window resize, which can miss DOM layout changes). The Phaser 'resize' event then propagates to all system handlers (dialogue, etc.) for repositioning. Listeners cleaned up on scene shutdown/destroy.
- **Movement:** Frame-based smooth movement (delta-time), not tile-snapping. Axis-independent collision allows sliding along walls and NPCs.
- **Collision:** Bounding box corners checked against tile map and NPC bounds. Out-of-bounds = collision.
- **Input priority:** Keyboard takes priority over joystick when any WASD key is held. Dialogue and StoryScene capture all input while active.
- **Virtual joystick:** Created on pointerdown, destroyed on pointerup. Uses scrollFactor(0) to stay fixed on screen.
- **Camera:** Dual-camera setup. Main camera follows player with zoom and world bounds. UI camera ('ui') has no zoom or scroll — renders dialogue, joystick, and thought bubbles at screen coordinates. Zoom = `min(viewportW, viewportH) / (TARGET_VISIBLE_TILES × TILE_SIZE)`, clamped ≥ 1. On resize: zoom updates first, then bounds (order matters for clamp correctness), then centerOn player. UI objects must call `cameras.main.ignore(obj)` so the zoomed camera doesn't render them off-screen. World objects created after camera setup must call `uiCam.ignore(obj)` to prevent double-rendering.
- **NPC interaction:** Proximity-based (1.5 tile radius). Space (desktop) or tap (mobile) to interact. Interaction prompt appears/disappears based on distance.
- **Dialogue:** Bottom-screen text box with typewriter effect. Space/tap advances or completes typewriter. All positions derive from `scale.width`/`scale.height` — no hardcoded pixel values. Data-driven node graphs in `data/dialogues.ts`. Optional `portraitId` on `DialogueScript` (script-level default) and `DialogueNode` (per-node override) — when set, an NPC portrait `Image` renders anchored above the box's top-left (bottom edge flush with box top), sized `PORTRAIT_DESIGN_SIZE` (96 design px) on desktop and clamped to `canvasWidth * PORTRAIT_MOBILE_WIDTH_FRACTION` (0.22) on mobile so it doesn't overflow narrow viewports. When a portrait is active the speaker label x offsets to the right of the portrait (`s(BOX_PADDING) + portraitWidth + s(8)`); when no portrait is set, dialogue renders unchanged from the pre-portrait baseline (Whispering Stones script verifies this case). The portrait `Image` is created once per dialogue and texture-swapped on portrait-id change to avoid a one-frame flicker (Learning EP-01).
- **Dialogue choices (desktop):** Arrow keys browse (> prefix), Enter or tap confirms immediately. No Confirm button on non-touch devices.
- **Dialogue choices (mobile):** Full-width 44px tappable rows. Tap to highlight (no commit). Confirm button appears below choices. Tap Confirm to commit. Browse-then-confirm pattern prevents mis-taps. Box expands dynamically to accommodate choices + Confirm.
- **Zone-level mutual exclusion (LEARNINGS #56):** When dialogue is active, movement, NPC interaction, trigger evaluation, and NPC awareness state transitions are all suppressed. NPCs in `dialogue` state hold their facing texture snapshotted at `enterDialogue` time and ignore awareness updates until `exitDialogue` fires. When StoryScene is active, GameScene is fully paused. Thought bubbles queue during dialogue and display after. On mobile, general taps are blocked while choice rows are active (`mobileChoicesActive` guard).
- **Trigger zones:** Fire on player entry (bounding box overlap). One-shot triggers use internal flags. Repeatable triggers require exit-then-re-enter. Conditions use flag comparisons with AND logic. Trigger types: `thought`, `story`, `dialogue`, `exit`.
- **Exit zones:** Defined in `ExitDefinition[]` on each area, separate from triggers. Walking into an exit zone fires fade-out → scene restart with new area → fade-in. Re-entrancy guard prevents double-fire during fade. Optional conditions (same syntax as triggers). Exit tiles rendered amber-gold (EXIT_COLOR 0xc89b3c). Non-existent destination logs console error without crashing.
- **Area transitions:** GameScene accepts `{ areaId, entryPoint }` via scene data. All systems (collision, movement, triggers, NPC interaction, dialogue, story scenes) are parameterized — they receive area data via constructor or method parameters, no global imports. During transition: movement, NPC interaction, triggers, and dialogue are suppressed (transitionInProgress guard).
- **Debug overlay:** F3 toggles visibility (off by default). Shows trigger zones as color-coded semi-transparent rectangles (blue=thought, magenta=story, green=dialogue, orange=exit), text labels with ID/type/condition, exit destination labels, NPC interaction radii as yellow circles. World-space at depth 50. Toggle is guarded during dialogue.
- **Flag persistence:** Flags stored in localStorage under 'emberpath_flags'. Flags work cross-area — set in one area, readable in another. Reset available from TitleScene.
- **Tile rendering (sprite-based):** Tiles are rendered via Phaser spritesheets loaded from `assets/tilesets/<id>/tilemap.png` (16×16 packed). Each `AreaDefinition` has a required `tileset: string` naming one of the registry entries in `maps/tilesets.ts`. `GameScene.preload()` loads every registered atlas. `renderTileMap()` iterates cells, determines tile kind (EXIT when cell overlaps an area.exits zone, else WALL or FLOOR from `area.map`), and calls `resolveFrame(tilesetId, kind, col, row)` — a pure function with FNV-1a hash determinism — to pick a variant. Sprites are placed at depth 0 and scaled to `TILE_SIZE` via `setDisplaySize`. Nearest-neighbor filtering is applied globally via `pixelArt: true` in the Phaser game config (`main.ts`). If `area.tileset` is unknown, a descriptive console error is logged and `renderFallbackTiles()` draws flat-color tiles using `visual.floorColor/wallColor` so the scene still loads. `EXIT_COLOR` and the old `tileGraphics` Graphics path are removed.
- **Decorative props (non-blocking):** `AreaDefinition.props: PropDefinition[]` is a list of `{ id, col, row, spriteFrame }` entries rendered by `GameScene.renderProps()` at depth 3 (between Tiles and Entities). Props look up their frame on the area's tileset atlas; a missing frame logs a warning naming the prop id and the missing frame, then skips that prop. Props are NOT added to collision structures — `collision.ts` is not consulted for props, so the player walks through their cells.
- **Player sprite (fox-pip):** Player is a `Phaser.GameObjects.Sprite` at Entities depth 5, using PixelLab-generated fox child animation frames (96 PNGs — idle: 8 dirs × 4 frames = 32, walk: 8 dirs × 8 frames = 64). Frames preloaded individually in `GameScene.preload()` using per-animation-type frame counts (`FRAME_COUNTS: {idle: 4, walk: 8}`). 16 Phaser animations registered as `fox-pip-{idle,walk}-{north,north-east,east,south-east,south,south-west,west,north-west}` at 8 FPS with `repeat: -1`. Collision bounding box is PLAYER_SIZE (24px). Rendered at native scale (68×68px, `setScale(1)`) — collision math uses PLAYER_SIZE directly. Vite serves assets from `assets/` (`publicDir: 'assets'` in vite.config.ts).
- **Animation state machine (`systems/animation.ts`):** `AnimationSystem` manages sprite animation state. Two states: idle (stationary), walk (moving). Tracks `facingDirection` (default south on spawn), plays 8-direction animation. Octant math lives in `systems/direction.ts` — `velocityToDirection(vx, vy)` maps velocity to one of 8 directions using octant boundaries (atan2 quantized to 45° sectors): north, north-east, east, south-east, south, south-west, west, north-west. AnimationSystem imports it; NpcBehaviorSystem imports it — single source, no duplicate octant tables. `getCurrentSpeed()` always returns PLAYER_SPEED — no speed acceleration. GameScene passes raw input velocity directly (no diagonal suppression).
- **NPC sprite rendering:** NPCs render as `Phaser.GameObjects.Sprite` at depth 5 (Entities layer). `GameScene.preload()` iterates the `NPC_SPRITES` registry (`systems/npcSprites.ts`) and loads per sprite id: idle frames (8 dirs × 4), walk frames (8 dirs × 4), and 8 single-image static poses. `registerAnimations()` creates `npc-{spriteId}-{idle,walk}-{dir}` Phaser animations at 8 fps `repeat: -1`. Static poses are NOT registered as animations — they are loaded as plain image keys `npc-{spriteId}-static-{dir}` and applied via `setTexture`. Adding a new NPC is a registry entry plus an `AreaDefinition.npcs` row — no GameScene code edit. Unknown sprite id falls back with a descriptive console error to a lowercase rectangle draw so the scene still loads (silent failure is not acceptable).
- **NPC behaviour (`systems/npcBehavior.ts`):** Each NPC runs a per-frame state machine with four states — `idle`, `walk`, `aware`, `dialogue`. Wander: from the NPC's current tile a random direction is picked uniformly and Chebyshev-clamped to `wanderRadius` around the spawn tile; the path from current centre to candidate tile centre is sampled 4× and the step is rejected if any sample collides with a wall. Dwell time is randomised per cycle in `[NPC_IDLE_MIN_MS, NPC_IDLE_MAX_MS]`. Awareness: the system computes Chebyshev tile distance to the player every frame; on entry (idle/walk → aware) the NPC halts, on exit (aware → idle) it resets the dwell timer. While aware, the static texture is reapplied ONLY when the quantised facing direction changes — `lastStaticDir` guard prevents per-frame `setTexture` with identical inputs (Learning EP-01 loop-invariant). Dialogue: `enterDialogue(npcId, playerCenter)` is idempotent, snaps once to face the player, stops the animation, applies the static texture; `exitDialogue(npcId)` is idempotent and transitions back to idle so awareness re-evaluates on the next tick. `getLivePositions()` exposes centre-of-bounding-box coords for `collision.ts` + `systems/npcInteraction.ts`; both fall back to the static spawn tile when no live snapshot is available (pre-first-update window after an area transition).
- **Debug overlay NPC radii (F3):** interaction radius (solid yellow) → wander radius (dashed green) → awareness radius (dashed yellow), drawn in that order at depth 50. The order is the deterministic visual z-order (Learning #57 facet) and documented inline in `debugOverlay.ts`.

## Scaling tuning guide

How zoom and UI scaling work and where to tweak them.

### Camera zoom (how many tiles are visible)

`scenes/GameScene.ts` — `TARGET_VISIBLE_TILES` constant (default: 10). This controls how many tiles fit along the viewport's shorter axis. The zoom formula is `min(viewportW, viewportH) / (TARGET_VISIBLE_TILES × TILE_SIZE)`, clamped ≥ 1.

- **Lower value** (e.g. 6) = more zoomed in, fewer tiles visible, characters/terrain appear larger. Good for close-up detail.
- **Higher value** (e.g. 14) = more zoomed out, more of the map visible, characters appear smaller. Good for wide-area overview.
- The `Math.max(1, ...)` clamp prevents zooming out below native resolution on large screens (desktop typically stays at zoom 1).

### Dialogue and UI text scaling

`systems/dialogue.ts` — all layout constants are in **design pixels** (authored for a reference viewport). The `s()` helper scales them by the main camera's zoom at render time: `s(v) = v * cameras.main.zoom`.

Tuning points (all in design pixels, top of dialogue.ts):
- `BOX_HEIGHT` (120) — dialogue panel height
- `BOX_PADDING` (12) — inner padding
- `SPEAKER_FONT_SIZE` (14) — NPC name label
- `TEXT_FONT_SIZE` (16) — dialogue body text
- `CHOICE_FONT_SIZE` (14) — choice row text
- `MOBILE_CHOICE_HEIGHT` (44) — tap target height per choice row
- `MOBILE_CONFIRM_HEIGHT` (44) — confirm button height
- `PORTRAIT_DESIGN_SIZE` (96) — square portrait render size on desktop (zoom 1)
- `PORTRAIT_MOBILE_WIDTH_FRACTION` (0.22) — mobile clamp as a fraction of `canvasWidth`

On desktop (zoom ≈ 1), these render at their literal pixel sizes. On mobile (zoom ≈ 3–4×), they scale proportionally. To make mobile text larger without affecting desktop, increase the design-pixel values.

### Resize / orientation change

`GameScene.setupCamera()` registers a direct `window.resize` listener that calls `this.scale.refresh()` after one `requestAnimationFrame`. This forces Phaser to re-detect parent bounds on every resize/rotation, then Phaser emits its own 'resize' event which `handleResize()` (GameScene) and `handleResize()` (DialogueSystem) both listen to. No manual intervention needed — zoom, bounds, camera, and UI all recalculate automatically.

## Quality checks

- no-silent-pass
- no-bare-except
- error-path-coverage
- agents-consistency

## Testing

No test framework configured in foundation phase. Verify command: `npx tsc --noEmit && npm run build` (Learning #15 — Vite uses esbuild, explicit tsc --noEmit enforces TypeScript strict mode).
