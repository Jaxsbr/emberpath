# Phase: sprite-refresh

Status: shipped

## Stories

### US-46 — Fox child sprite asset replacement

As a developer, I want the new bipedal fox child animation frames copied into the game's asset directory and the preload/registration system updated for variable frame counts and 8 directions, so the animation state machine can reference the new character.

**Acceptance criteria:**
- Fox child frames from `pixellab-research/fox-child-final/{idle,walk}` are copied to `assets/characters/fox-pip/` organized by animation type and direction (idle, walk × 8 directions)
- Source mapping: idle (8 directions × 4 frames = 32 PNGs), walk (8 directions × 8 frames = 64 PNGs)
- All 96 PNG files are present under `assets/characters/fox-pip/`
- Old `assets/characters/fox-pip/run/` directory is removed (run animation no longer exists)
- GameScene preloads all frames with correct per-animation-type frame counts (idle: 4, walk: 8)
- 16 Phaser animations registered as `fox-pip-{idle,walk}-{direction}` for all 8 directions
- All animations play at 8 FPS with repeat -1
- Player sprite is created using the new fox-pip animations; collision bounding box remains PLAYER_SIZE (24px)
- Player sprite `setScale()` value explicitly accounts for the new character's native PNG resolution (code comment documents native resolution and chosen scale)

**User guidance:** N/A

**Design rationale:** Variable frame counts per animation type (idle: 4, walk: 8) match the PixelLab output exactly. A per-type frame count config replaces the old uniform FRAME_COUNT constant. 8-direction registration matches the available sprite set and enables diagonal animation in US-47.

### US-47 — 8-direction movement and simplified animation states

As a player, I want Pip to animate in 8 directions (N, NE, E, SE, S, SW, W, NW) with idle and walk states only, so movement feels natural in all directions without a jarring run transition.

**Acceptance criteria:**
- AnimationSystem supports 8 directions: north, north-east, east, south-east, south, south-west, west, north-west
- AnimationSystem has only two states: idle and walk (run state removed entirely)
- `velocityToDirection()` maps velocity to 8 directions using octant boundaries (45-degree sectors)
- Walk-to-run timer, RUN_MULTIPLIER, and RUN_THRESHOLD_MS are removed from the animation system
- `getCurrentSpeed()` always returns PLAYER_SPEED (no speed acceleration)
- RUN_MULTIPLIER and RUN_THRESHOLD_MS removed from `src/maps/constants.ts`
- Diagonal suppression code in GameScene.update() is removed — movement works in all 8 directions
- Default facing direction on spawn is south
- When movement stops, idle animation plays for the last movement direction (including diagonals)

**Interaction model:** Same WASD + virtual joystick input flow as existing movement system. The change is that diagonal input is no longer suppressed — both axes are applied simultaneously, and the octant mapper selects the correct 8-direction animation. No new input mechanisms introduced.

**User guidance:**
- Discovery: Move diagonally (W+D, W+A, S+D, S+A) or drag joystick at an angle
- Manual section: N/A (implicit gameplay behavior, no manual exists)
- Key steps: Press W+D to move north-east — Pip plays the north-east walk animation. Release to stop — Pip idles facing north-east. Movement speed is constant (no run transition).

**Design rationale:** 8-direction animation eliminates the visual discontinuity of the diagonal suppression hack (character facing one cardinal while input implied a diagonal). Removing run simplifies the state machine and matches the available sprite set — run can be re-added when PixelLab generates run frames.

## Done-when (observable)

### Asset integration [US-46]
- [x] `assets/characters/fox-pip/idle/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_00{0-3}.png` — 32 files present [US-46] [Shipped]
- [x] `assets/characters/fox-pip/walk/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_00{0-7}.png` — 64 files present [US-46] [Shipped]
- [x] `assets/characters/fox-pip/run/` directory does not exist [US-46] [Shipped]
- [x] GameScene.preload() loads all 96 fox-pip frames: idle (8 dirs × 4 frames) + walk (8 dirs × 8 frames); does not reference run frames [US-46] [Shipped]
- [x] 16 Phaser animations registered with keys `fox-pip-{idle,walk}-{north,north-east,east,south-east,south,south-west,west,north-west}` [US-46] [Shipped]
- [x] idle animations have 4 frames each; walk animations have 8 frames each [US-46] [Shipped]
- [x] All animations have frameRate 8 and repeat -1 [US-46] [Shipped]
- [x] No references to `fox-pip-run-*` animation keys remain in `src/` (grep confirms zero matches) [US-46] [Shipped]
- [x] Player sprite created using fox-pip animation, displayed at depth 5, collision bounding box remains PLAYER_SIZE (24px) [US-46] [Shipped]
- [x] Player sprite `setScale()` value explicitly accounts for the new character's native PNG resolution; code comment documents native resolution and chosen scale [US-46] [Shipped]

### Animation system simplification [US-47]
- [x] AnimationSystem `AnimState` type is `'idle' | 'walk'` — no 'run' [US-47] [Shipped]
- [x] AnimationSystem `Direction` type includes all 8 directions: north, north-east, east, south-east, south, south-west, west, north-west [US-47] [Shipped]
- [x] `velocityToDirection()` maps velocity to 8 directions using octant boundaries (45-degree sectors) [US-47] [Shipped]
- [x] No references to `RUN_MULTIPLIER` or `RUN_THRESHOLD_MS` in `src/systems/animation.ts` [US-47] [Shipped]
- [x] `RUN_MULTIPLIER` and `RUN_THRESHOLD_MS` constants removed from `src/maps/constants.ts` [US-47] [Shipped]
- [x] No `moveElapsedMs` property or walk-to-run timer logic in AnimationSystem [US-47] [Shipped]
- [x] `getCurrentSpeed()` always returns PLAYER_SPEED [US-47] [Shipped]
- [x] Diagonal suppression code block removed from GameScene.update() — no `suppressedVx`/`suppressedVy` variables [US-47] [Shipped]
- [x] On spawn with no movement input, player sprite plays `fox-pip-idle-south` [US-47] [Shipped]
- [x] After moving north-east then stopping, player sprite plays `fox-pip-idle-north-east` [US-47] [Shipped]
- [x] Moving diagonally (W+D keys or diagonal joystick) produces diagonal movement and plays the corresponding diagonal direction animation [US-47] [Shipped]

### Structural [phase]
- [x] `npx tsc --noEmit && npm run build` passes with zero errors [phase] [Shipped]
- [x] AGENTS.md reflects updated animation system: 2-state (idle/walk), 8-direction, variable frame counts (idle: 4, walk: 8), no run, no diagonal suppression [phase] [Shipped]

Safety criteria: N/A — this phase introduces no endpoints, user input fields, or query interpolation. All changes are internal game animation logic.

## Golden principles (phase-relevant)

- Depth map is non-negotiable: the player sprite must sit at depth 5 (Entities layer). Ad-hoc depth values are prohibited.
- PLAYER_SIZE (24px) is the collision bounding box constant — do not change it.
- Camera: `cam.startFollow(player)` must target the player sprite. Dual-camera `uiCam.ignore()` call must include the player sprite.
- Movement: axis-independent collision and wall-sliding via `moveWithCollision` must be preserved unchanged. Movement speed is PLAYER_SPEED (no run multiplier).
- Scene code must call systems-module functions, not duplicate them (Learning #64). Animation state logic lives in `systems/animation.ts`, not inlined in GameScene.
- Before submitting, check for: (a) setup operations that run every update loop iteration but only need to run once, (b) conditional branches where both outcomes produce the same result, (c) comments referencing behavior no longer present (Learning EP-01).
- When changing a system module, audit all callers (GameScene) to ensure they still work after run-state removal and 8-direction changes (Learning #70 — cross-cutting breaks during refactoring).

## AGENTS.md sections affected

- Directory layout: update `assets/characters/fox-pip/` to show idle and walk with 8 directions, remove run/
- File ownership: update fox-pip animation description (8-direction, 2-state, variable frame counts)
- Behavior rules: update animation state machine (2-state, 8-direction, no run, no diagonal suppression), remove walk-to-run transition, remove diagonal suppression, update player sprite frame counts and animation count
- Depth map: no change — player remains at depth 5
- Controls: no change to input bindings
