## Phase goal

Replace the 4-direction fox sprite set with a new bipedal fox child character supporting 8-direction movement (idle and walk states only). Remove the run state, diagonal suppression, and run-related constants. Copy the new PixelLab-generated frames from `pixellab-research/fox-child-final/` into game assets and update GameScene + AnimationSystem to use 8 directions with variable per-type frame counts (idle: 4 frames, walk: 8 frames).

### Dependencies
- sprite-animation — archived ✓

### Stories in scope
- US-46 — Fox child sprite asset replacement
- US-47 — 8-direction movement and simplified animation states

### Done-when (observable)

#### Asset integration [US-46]
- [ ] `assets/characters/fox-pip/idle/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_00{0-3}.png` — 32 files present [US-46]
- [ ] `assets/characters/fox-pip/walk/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_00{0-7}.png` — 64 files present [US-46]
- [ ] `assets/characters/fox-pip/run/` directory does not exist [US-46]
- [ ] GameScene.preload() loads all 96 fox-pip frames: idle (8 dirs × 4 frames) + walk (8 dirs × 8 frames); does not reference run frames [US-46]
- [ ] 16 Phaser animations registered with keys `fox-pip-{idle,walk}-{north,north-east,east,south-east,south,south-west,west,north-west}` [US-46]
- [ ] idle animations have 4 frames each; walk animations have 8 frames each [US-46]
- [ ] All animations have frameRate 8 and repeat -1 [US-46]
- [ ] No references to `fox-pip-run-*` animation keys remain in `src/` (grep confirms zero matches) [US-46]
- [ ] Player sprite created using fox-pip animation, displayed at depth 5, collision bounding box remains PLAYER_SIZE (24px) [US-46]
- [ ] Player sprite `setScale()` value explicitly accounts for the new character's native PNG resolution; code comment documents native resolution and chosen scale [US-46]

#### Animation system simplification [US-47]
- [ ] AnimationSystem `AnimState` type is `'idle' | 'walk'` — no 'run' [US-47]
- [ ] AnimationSystem `Direction` type includes all 8 directions: north, north-east, east, south-east, south, south-west, west, north-west [US-47]
- [ ] `velocityToDirection()` maps velocity to 8 directions using octant boundaries (45-degree sectors) [US-47]
- [ ] No references to `RUN_MULTIPLIER` or `RUN_THRESHOLD_MS` in `src/systems/animation.ts` [US-47]
- [ ] `RUN_MULTIPLIER` and `RUN_THRESHOLD_MS` constants removed from `src/maps/constants.ts` [US-47]
- [ ] No `moveElapsedMs` property or walk-to-run timer logic in AnimationSystem [US-47]
- [ ] `getCurrentSpeed()` always returns PLAYER_SPEED [US-47]
- [ ] Diagonal suppression code block removed from GameScene.update() — no `suppressedVx`/`suppressedVy` variables [US-47]
- [ ] On spawn with no movement input, player sprite plays `fox-pip-idle-south` [US-47]
- [ ] After moving north-east then stopping, player sprite plays `fox-pip-idle-north-east` [US-47]
- [ ] Moving diagonally (W+D keys or diagonal joystick) produces diagonal movement and plays the corresponding diagonal direction animation [US-47]

#### Structural [phase]
- [ ] `npx tsc --noEmit && npm run build` passes with zero errors [phase]
- [ ] AGENTS.md reflects updated animation system: 2-state (idle/walk), 8-direction, variable frame counts (idle: 4, walk: 8), no run, no diagonal suppression [phase]

### Golden principles (phase-relevant)
- Depth map is non-negotiable: the player sprite must sit at depth 5 (Entities layer). Ad-hoc depth values are prohibited.
- PLAYER_SIZE (24px) is the collision bounding box constant — do not change it.
- Camera: `cam.startFollow(player)` must target the player sprite. Dual-camera `uiCam.ignore()` call must include the player sprite.
- Movement: axis-independent collision and wall-sliding via `moveWithCollision` must be preserved unchanged. Movement speed is PLAYER_SPEED (no run multiplier).
- Scene code must call systems-module functions, not duplicate them (Learning #64). Animation state logic lives in `systems/animation.ts`, not inlined in GameScene.
- Before submitting, check for: (a) setup operations that run every update loop iteration but only need to run once, (b) conditional branches where both outcomes produce the same result, (c) comments referencing behavior no longer present (Learning EP-01).
- When changing a system module, audit all callers (GameScene) to ensure they still work after run-state removal and 8-direction changes (Learning #70 — cross-cutting breaks during refactoring).
