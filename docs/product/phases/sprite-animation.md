# Phase: sprite-animation

Status: draft

## Stories

### US-42 — Fox sprite asset integration

As a developer, I want the PixelLab-generated fox animation frames copied into the game's asset directory and preloaded as Phaser animations, so that the animation state machine can reference them by key.

**Acceptance criteria:**
- Dog-animation frames from `pixellab-research/dog-animations/` are copied to `assets/characters/fox-pip/` organized by animation type and direction (idle, walk, run × north, east, south, west)
- Source mapping: `animation-b456e6de` → idle, `walking-87ced120` → walk, `running-387f57ef` → run
- All 96 PNG files (3 animations × 4 directions × 8 frames) are present under `assets/characters/fox-pip/`
- GameScene preloads all frames and registers 12 Phaser animations keyed as `fox-pip-{anim}-{direction}` (e.g., `fox-pip-idle-south`)
- Old fox atlas references (`FOX_ATLAS_KEY`, `FOX_FRAME`, atlas loading of `characters/fox.png`/`characters/fox.json`) are removed from GameScene
- Player sprite is created using the new fox-pip animations instead of the old atlas

**User guidance:** N/A

**Design rationale:** Individual frame loading matches the PixelLab output format (separate PNGs per frame per direction) and avoids a build-time atlas packing step. Phaser's animation system handles individual frames natively via `this.anims.create()`. Frame key convention `fox-pip-{anim}-{dir}` is explicit and avoids collision with future characters.

### US-43 — Direction-aware idle animation

As a player, I want Pip to play an idle animation loop when I stop moving, facing the last direction I was heading, so the character feels alive when stationary.

**Acceptance criteria:**
- When no movement input is active, the idle animation plays for the character's current facing direction
- The character retains its last movement direction as the facing direction
- Default facing direction on spawn is south (toward the player/camera)
- Idle animation loops continuously until movement input resumes
- Animation plays at 8 FPS

**User guidance:**
- Discovery: Visible immediately on game start — Pip plays idle animation facing south
- Manual section: N/A (implicit gameplay behavior, no manual exists)
- Key steps: Start the game. Pip stands idle facing south with a looping animation. Move and stop — Pip idles facing the last direction you moved.

**Design rationale:** Default south-facing because it's the most visually expressive direction for first load (character faces the player/camera). 8 FPS matches the PixelLab animation preview timing and provides fluid pixel art animation without over-smoothing.

### US-44 — Walk animation on movement

As a player, I want Pip to play a walk animation in the direction I'm moving, so movement feels natural and responsive.

**Acceptance criteria:**
- When movement input is active, the walk animation plays in the current movement direction
- Direction is determined by the dominant input axis mapped to N/E/S/W (4-direction mapping)
- Diagonal movement is suppressed: when both axes have input, only the dominant axis applies (lesser axis zeroed); if equal magnitude, current facing direction is maintained
- Diagonal suppression is marked with a code comment as temporary until NE/NW/SE/SW sprites arrive
- Changing movement direction switches to the new direction's walk animation
- Walk speed is PLAYER_SPEED (160 px/s)

**Interaction model:** Same WASD + virtual joystick input flow as existing movement system (`systems/input.ts`). The only change is that diagonal input is filtered to single-axis before being applied to movement. No new input mechanisms introduced.

**User guidance:**
- Discovery: Press WASD or touch-drag to move
- Manual section: N/A (implicit gameplay behavior, no manual exists)
- Key steps: Press W to walk north — Pip plays the north walk animation. Press D to switch to east. Diagonal input (W+D) moves only along the dominant axis.

**Design rationale:** 4-direction mapping (not 8) because only orthogonal sprites are currently available. Diagonal suppression prevents visual discontinuity where the character sprite would face one cardinal direction while moving diagonally. Comment-marked for removal when diagonal sprites arrive.

### US-45 — Walk-to-run transition

As a player, I want Pip to transition from walking to running when I hold a direction for about 2 seconds, so movement feels progressively dynamic.

**Acceptance criteria:**
- After holding continuous movement input for ~2 seconds, animation transitions from walk to run
- Movement speed increases from PLAYER_SPEED to PLAYER_SPEED × RUN_MULTIPLIER on transition
- RUN_MULTIPLIER is defined as a named constant in `src/maps/constants.ts`
- Walk-to-run time threshold (RUN_THRESHOLD_MS) is defined as a named constant
- Releasing all movement input resets the walk-to-run elapsed timer to 0
- Run animation plays in the current movement direction (same 4-direction mapping as walk)
- When movement stops from any state (walk or run), character transitions to idle animation (not back to walk, not a freeze frame)

**User guidance:**
- Discovery: Hold any movement direction for about 2 seconds
- Manual section: N/A (implicit gameplay behavior, no manual exists)
- Key steps: Hold W to walk north. After ~2 seconds Pip transitions to running with increased speed. Release and re-press to reset back to walking.

**Design rationale:** 2-second threshold provides natural feel — long enough to be intentional, short enough not to frustrate. Speed increase accompanies animation change so running isn't just cosmetic. Timer resets on release to make walk-to-run a sustained-input action, not a toggle.

## Done-when (observable)

- [ ] `assets/characters/fox-pip/idle/{north,east,south,west}/frame_00{0-7}.png` — 32 files present [US-42]
- [ ] `assets/characters/fox-pip/walk/{north,east,south,west}/frame_00{0-7}.png` — 32 files present [US-42]
- [ ] `assets/characters/fox-pip/run/{north,east,south,west}/frame_00{0-7}.png` — 32 files present [US-42]
- [ ] GameScene.preload() loads all 96 fox-pip frames and does not load the old fox atlas [US-42]
- [ ] 12 Phaser animations registered with keys `fox-pip-{idle,walk,run}-{north,east,south,west}` [US-42]
- [ ] No references to `FOX_ATLAS_KEY`, `FOX_FRAME`, `characters/fox.png`, or `characters/fox.json` remain in `src/` (grep confirms zero matches) [US-42]
- [ ] Player sprite created using `fox-pip` animation, displayed at PLAYER_SIZE (24px) [US-42]
- [ ] On spawn with no movement input, player sprite plays `fox-pip-idle-south` animation [US-43]
- [ ] After moving east then stopping, player sprite plays `fox-pip-idle-east` [US-43]
- [ ] Idle animations have `repeat: -1` (continuous loop) [US-43]
- [ ] Idle animation frameRate is 8 [US-43]
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

## Golden principles (phase-relevant)
- Depth map is non-negotiable: the player sprite must sit at depth 5 (Entities layer). Ad-hoc depth values are prohibited.
- PLAYER_SIZE (24px) is the collision bounding box constant — do not change it.
- Camera: `cam.startFollow(player)` must target the player sprite. Dual-camera `uiCam.ignore()` call must include the player sprite.
- Movement: axis-independent collision and wall-sliding via `moveWithCollision` must be preserved unchanged. Movement speed is either PLAYER_SPEED (walk) or PLAYER_SPEED × RUN_MULTIPLIER (run).
- No silent breaking changes: all systems that reference `this.player.x / .y` must continue to work.
- Scene code must call systems-module functions, not duplicate them (Learning #64). If animation state logic is significant, extract to a system module rather than inlining in GameScene.
- Before submitting, check for: (a) setup operations that run every update loop iteration but only need to run once, (b) conditional branches where both outcomes produce the same result, (c) comments referencing behavior no longer present (Learning EP-01).

## AGENTS.md sections affected
- Directory layout (add `assets/characters/fox-pip/`, remove `rig/` tree, remove `tools/generate-fox-atlas.mjs`)
- File ownership (add fox-pip animation entries, remove rig-related entries)
- Behavior rules (add sprite animation state machine, diagonal suppression, walk-to-run transition; remove rig coordinate model, walk/run speed, idle progression, editor bone connections, editor canvas drag, editor propagation highlighting sections)
- Depth map (no change — player remains at depth 5)
- Controls (no change)
