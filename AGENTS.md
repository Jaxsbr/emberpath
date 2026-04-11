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
    debugOverlay.ts    # DebugOverlaySystem — F3 toggleable overlay showing trigger zones, exit zones, NPC radii
  data/
    areas/
      types.ts         # AreaDefinition, ExitDefinition, NpcDefinition, TriggerDefinition, DialogueScript, StorySceneDefinition
      registry.ts      # Area registry — getArea(id), getAllAreaIds(), getDefaultAreaId()
      ashen-isle.ts    # Ashen Isle area definition (50x38 map, Old Man NPC, triggers, dialogues, story scene)
      fog-marsh.ts     # Fog Marsh area definition (30x24 map, Marsh Hermit NPC, triggers, dialogues, story scene)
  rig/
    types.ts           # RigDefinition, DirectionProfile, BoneDefinition, AnimationController, BoneState interfaces
    CharacterRig.ts    # 2D skeletal rig engine — container with atlas sprites, direction profiles, pluggable animation controllers
    characters/
      fox.ts           # Fox (Pip) rig definition — 46 named parts, 5 direction profiles, walk/run/idle params
    animations/
      walkRun.ts       # WalkRunController — body bob, leg gait, tail follow-through, walk-to-run transition, speed source of truth
      idle.ts          # IdleController — breathing, tail sway, head turn, sit-down, ear flick
  triggers/
    flags.ts           # Flag store — getFlag, setFlag, incrementFlag, resetAllFlags, localStorage persistence
  maps/
    constants.ts       # TILE_SIZE, PLAYER_SPEED, TileType
assets/
  characters/
    fox.png            # Fox texture atlas spritesheet (256x64, 16 body parts)
    fox.json           # Phaser JSON Hash atlas — frame coordinates for fox body parts
tools/
  generate-fox-atlas.mjs  # Atlas generator script — creates fox.png + fox.json from code (no dependencies)
  editor/              # Standalone Vite dev tool — area map, dialogue tree, story flow, and rig editor
    src/
      main.ts          # App shell — area selector, tab navigation, detail panel
      style.css        # Dark theme CSS with debug overlay color variables
      mapRenderer.ts   # Canvas-based area map — tile grid, NPC circles, trigger/exit overlays
      dialogueRenderer.ts  # Dialogue tree node graph — BFS layout, SVG edges, flag annotations
      flowRenderer.ts  # Story flow overview — area boxes, exit arrows, flag dependency lines
      rigRenderer.ts   # Rig editor — embedded Phaser scene, direction picker, skeleton hierarchy, property editor, Save/Load/Export TS
    index.html         # Entry point
    package.json       # Separate Vite + TypeScript project
    vite.config.ts     # @game path alias to ../../src
    tsconfig.json      # Compiles editor + shared game types
```

## File ownership

| Module | Owns |
|---|---|
| `scenes/TitleScene.ts` | Title screen UI, scene transition to GameScene, flag reset |
| `scenes/GameScene.ts` | Area loading, tile rendering, fox rig player (CharacterRig + WalkRunController + IdleController), camera setup, update loop, system orchestration, exit zone detection, area transitions with fade |
| `scenes/StoryScene.ts` | Full-screen story scenes — beat display, fade transitions, GameScene pause/resume |
| `systems/input.ts` | All input handling — keyboard keys, touch joystick lifecycle |
| `systems/movement.ts` | Position updates with collision checking — accepts area collision data (map + NPCs) |
| `systems/collision.ts` | Wall and NPC collision detection — accepts map and NPC arrays as parameters |
| `systems/npcInteraction.ts` | NPC proximity detection, interaction prompt, Space/tap trigger — accepts NPC list via constructor |
| `systems/dialogue.ts` | Dialogue UI (text box, typewriter, choices), node graph state machine |
| `systems/thoughtBubble.ts` | Thought bubble display, auto-dismiss, sequential queue |
| `systems/triggerZone.ts` | Trigger zone evaluation, type dispatch — accepts triggers via constructor |
| `systems/conditions.ts` | Shared condition evaluation — flag-based AND logic with comparison operators |
| `systems/debugOverlay.ts` | F3-toggled debug overlay — trigger zones, exit zones, NPC interaction radii in world space |
| `data/areas/types.ts` | All shared types — AreaDefinition, ExitDefinition, NpcDefinition, TriggerDefinition, DialogueScript, StorySceneDefinition |
| `data/areas/registry.ts` | Area registry — maps area IDs to AreaDefinitions, getAllAreaIds() for enumeration |
| `data/areas/ashen-isle.ts` | Ashen Isle area definition — co-located map, NPCs, triggers, dialogues, story scenes, exits |
| `data/areas/fog-marsh.ts` | Fog Marsh area definition — co-located map, NPCs, triggers, dialogues, story scenes, exits |
| `triggers/flags.ts` | Flag store — read/write/increment/reset, localStorage persistence (shared across areas) |
| `maps/constants.ts` | Global constants — TILE_SIZE, PLAYER_SIZE, PLAYER_SPEED, NPC_SIZE, TileType enum |
| `rig/types.ts` | All rig type definitions — RigDefinition, DirectionProfile, BoneDefinition, AnimationController, BoneState, RigContext, WalkRunParams, IdleParams |
| `rig/CharacterRig.ts` | 2D skeletal rig engine — Phaser Container with atlas Sprites, 8-direction profiles (5 unique + 3 mirrored), pluggable animation controllers, delta-time update |
| `rig/characters/fox.ts` | Fox (Pip) rig definition — 46 named parts (body, neck, head, snout, eyes, nose, ears, shoulders, hips, 4 legs with upper/lower/ankle/paw/4 toes, 3 tail segments), 5 direction profiles, walkRun + idle animation parameters, collisionSize 24 |
| `rig/animations/walkRun.ts` | Walk/run animation controller — body bob, alternating leg gait, tail follow-through, ear sway, walk-to-run transition, deceleration settle, speed source of truth |
| `rig/animations/idle.ts` | Idle animation controller — breathing, tail sway, random ear flick, head turn after 3s, sit-down after 6s, all reset on movement |
| `tools/generate-fox-atlas.mjs` | Fox atlas generator — creates fox.png + fox.json (256×64, 16 frames) using Node.js built-in zlib, no external dependencies |
| `tools/editor/src/main.ts` | Editor app shell — area selector, tab navigation, view dispatch, detail panel |
| `tools/editor/src/mapRenderer.ts` | Canvas map view — tile grid, NPC circles, trigger/exit zone overlays, click-to-detail |
| `tools/editor/src/dialogueRenderer.ts` | Dialogue tree view — BFS node graph layout, SVG edges, choice labels, flag annotations |
| `tools/editor/src/flowRenderer.ts` | Story flow view — area boxes, exit arrows, flag dependency dashed lines |
| `tools/editor/src/rigRenderer.ts` | Rig editor — embedded Phaser scene (CharacterRig + checkerboard grid), direction picker (8 directions), skeleton hierarchy panel, property editor (x/y/scale/rotation/depth/alpha/visible per part per direction), Save JSON/Load JSON/Export TS persistence toolbar |

## Depth map

Explicit rendering order for visual layers (Learning #57):

| Layer | Depth | Camera | Description |
|---|---|---|---|
| Tiles | 0 | main | Floor, wall, and exit zone tile graphics |
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
- **Dialogue:** Bottom-screen text box with typewriter effect. Space/tap advances or completes typewriter. All positions derive from `scale.width`/`scale.height` — no hardcoded pixel values. Data-driven node graphs in `data/dialogues.ts`.
- **Dialogue choices (desktop):** Arrow keys browse (> prefix), Enter or tap confirms immediately. No Confirm button on non-touch devices.
- **Dialogue choices (mobile):** Full-width 44px tappable rows. Tap to highlight (no commit). Confirm button appears below choices. Tap Confirm to commit. Browse-then-confirm pattern prevents mis-taps. Box expands dynamically to accommodate choices + Confirm.
- **Zone-level mutual exclusion (LEARNINGS #56):** When dialogue is active, movement, NPC interaction, and trigger evaluation are all suppressed. When StoryScene is active, GameScene is fully paused. Thought bubbles queue during dialogue and display after. On mobile, general taps are blocked while choice rows are active (`mobileChoicesActive` guard).
- **Trigger zones:** Fire on player entry (bounding box overlap). One-shot triggers use internal flags. Repeatable triggers require exit-then-re-enter. Conditions use flag comparisons with AND logic. Trigger types: `thought`, `story`, `dialogue`, `exit`.
- **Exit zones:** Defined in `ExitDefinition[]` on each area, separate from triggers. Walking into an exit zone fires fade-out → scene restart with new area → fade-in. Re-entrancy guard prevents double-fire during fade. Optional conditions (same syntax as triggers). Exit tiles rendered amber-gold (EXIT_COLOR 0xc89b3c). Non-existent destination logs console error without crashing.
- **Area transitions:** GameScene accepts `{ areaId, entryPoint }` via scene data. All systems (collision, movement, triggers, NPC interaction, dialogue, story scenes) are parameterized — they receive area data via constructor or method parameters, no global imports. During transition: movement, NPC interaction, triggers, and dialogue are suppressed (transitionInProgress guard).
- **Debug overlay:** F3 toggles visibility (off by default). Shows trigger zones as color-coded semi-transparent rectangles (blue=thought, magenta=story, green=dialogue, orange=exit), text labels with ID/type/condition, exit destination labels, NPC interaction radii as yellow circles. World-space at depth 50. Toggle is guarded during dialogue.
- **Flag persistence:** Flags stored in localStorage under 'emberpath_flags'. Flags work cross-area — set in one area, readable in another. Reset available from TitleScene.
- **Character rig (fox):** Player is a `CharacterRig` (Phaser Container at Entities depth 5) with fox rig definition. Atlas preloaded in `GameScene.preload()` via `this.load.atlas(foxRigDefinition.atlasKey, 'characters/fox.png', 'characters/fox.json')` — Vite serves from `assets/` (`publicDir: 'assets'` in vite.config.ts). Direction derived from velocity via 8-sector atan2 mapping. Collision bounding box is PLAYER_SIZE (24px), same as the previous rectangle player.
- **Rig coordinate model (bone-chain):** `BoneDefinition` supports optional `inheritScale?: boolean` and `inheritRotation?: boolean` fields (both default `false`). Fox profiles store parent-relative coordinates — each bone's offset is relative to its parent's world position. `CharacterRig.update()` and `setDirection()` both resolve world positions via a shared depth-first tree-walk (`resolvePositions()`): world position = parent world position + local profile offset + local state offset. When `inheritRotation` is `true`, the local offset vector is rotated by the parent's world rotation before adding. When `inheritScale` is `true`, the local offset and sprite scale are multiplied by the parent's world scale. Animation controllers benefit from automatic propagation — a body bob `offsetY` applied to the `body` bone automatically moves all descendants (neck, head, shoulders, etc.) without manual per-bone writes. Sprites remain flat siblings in the root Phaser Container — no nested Containers are used.
- **Walk/run speed:** `WalkRunController` is the source of truth for player movement speed. Walk speed = PLAYER_SPEED (160). After holding a direction for 0.8s, speed transitions to PLAYER_SPEED × runMultiplier (1.8). Releasing and re-pressing resets the timer. GameScene queries `walkRunController.getCurrentSpeed()` each frame.
- **Idle progression:** At velocity 0: breathing + tail sway start immediately. After 3s: random head turn. After 6s: sit-down with eased leg tuck and body lower. Random ear flicks throughout. Any movement resets all idle state.

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
