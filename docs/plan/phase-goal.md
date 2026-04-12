## Phase goal

Integrate PixelLab-generated fox sprite animation frames into the game, replacing the static atlas placeholder with direction-aware animated sprites. Implement a three-state animation system (idle, walk, run) with 4-directional movement, diagonal suppression for cardinal-only sprites, and a walk-to-run transition triggered by sustained input.

### Stories in scope
- US-42 — Fox sprite asset integration
- US-43 — Direction-aware idle animation
- US-44 — Walk animation on movement
- US-45 — Walk-to-run transition

### Done-when (observable)
- [x] `assets/characters/fox-pip/idle/{north,east,south,west}/frame_00{0-7}.png` — 32 files present [US-42]
- [x] `assets/characters/fox-pip/walk/{north,east,south,west}/frame_00{0-7}.png` — 32 files present [US-42]
- [x] `assets/characters/fox-pip/run/{north,east,south,west}/frame_00{0-7}.png` — 32 files present [US-42]
- [x] GameScene.preload() loads all 96 fox-pip frames and does not load the old fox atlas [US-42]
- [x] 12 Phaser animations registered with keys `fox-pip-{idle,walk,run}-{north,east,south,west}` [US-42]
- [x] No references to `FOX_ATLAS_KEY`, `FOX_FRAME`, `characters/fox.png`, or `characters/fox.json` remain in `src/` (grep confirms zero matches) [US-42]
- [x] Player sprite created using `fox-pip` animation, displayed at PLAYER_SIZE (24px) [US-42]
- [x] On spawn with no movement input, player sprite plays `fox-pip-idle-south` animation [US-43]
- [x] After moving east then stopping, player sprite plays `fox-pip-idle-east` [US-43]
- [x] Idle animations have `repeat: -1` (continuous loop) [US-43]
- [x] Idle animation frameRate is 8 [US-43]
- [ ] Pressing W plays `fox-pip-walk-north`; D plays `fox-pip-walk-east`; S plays `fox-pip-walk-south`; A plays `fox-pip-walk-west` [US-44]
- [ ] Diagonal input (e.g., W+D) zeroes the lesser-magnitude axis — movement is single-axis only; a code comment marks diagonal suppression as temporary until diagonal sprites arrive [US-44]
- [ ] Equal-magnitude diagonal input (keyboard W+D) maintains current facing direction rather than flip-flopping [US-44]
- [ ] Walk animation frameRate is 8 [US-44]
- [ ] Movement speed during walk is PLAYER_SPEED (160 px/s) [US-44]
- [ ] After holding continuous movement input for ≥2s, animation switches from `fox-pip-walk-{dir}` to `fox-pip-run-{dir}` [US-45]
- [ ] `RUN_MULTIPLIER` constant exists in `src/maps/constants.ts`; run speed = PLAYER_SPEED × RUN_MULTIPLIER [US-45]
- [ ] `RUN_THRESHOLD_MS` constant exists in `src/maps/constants.ts`; walk-to-run timer uses this value [US-45]
- [ ] Releasing all movement input resets walk-to-run timer to 0 [US-45]
- [ ] Transitioning from movement (walk or run) to stationary switches to `fox-pip-idle-{dir}` — not a freeze frame [US-45]
- [ ] Run animation frameRate is 8 [US-45]
- [ ] `npx tsc --noEmit && npm run build` passes with zero errors [phase]
- [ ] AGENTS.md reflects new sprite animation system (fox-pip assets, animation state machine, diagonal suppression behavior) and removes stale rig system references [phase]

### Golden principles (phase-relevant)
- Depth map is non-negotiable: the player sprite must sit at depth 5 (Entities layer). Ad-hoc depth values are prohibited.
- PLAYER_SIZE (24px) is the collision bounding box constant — do not change it.
- Camera: `cam.startFollow(player)` must target the player sprite. Dual-camera `uiCam.ignore()` call must include the player sprite.
- Movement: axis-independent collision and wall-sliding via `moveWithCollision` must be preserved unchanged. Movement speed is either PLAYER_SPEED (walk) or PLAYER_SPEED × RUN_MULTIPLIER (run).
- No silent breaking changes: all systems that reference `this.player.x / .y` must continue to work.
- Scene code must call systems-module functions, not duplicate them (Learning #64). If animation state logic is significant, extract to a system module rather than inlining in GameScene.
- Before submitting, check for: (a) setup operations that run every update loop iteration but only need to run once, (b) conditional branches where both outcomes produce the same result, (c) comments referencing behavior no longer present (Learning EP-01).
