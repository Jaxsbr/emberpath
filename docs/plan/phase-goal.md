## Phase goal

Build a reusable 2D skeletal rig system with procedural animation, and implement Pip (fox kit) as the first character. The rig system uses bone hierarchies, 8-direction profiles, and texture atlas body parts — designed so that any character can be defined as a data-driven rig and animated without per-frame sprite art. Pip replaces the colored square in GameScene with a paper-puppet aesthetic fox that trots, runs, and idles with personality. Documentation is a first-class deliverable so future developers and artists can create new characters and swap art.

### Design direction

Paper-puppet storybook aesthetic. Body parts are warm-colored organic shapes (oranges, russets, creams, browns) with soft edges, evoking cut-out illustrations from a children's book. The fox should look deliberate — a style choice, not programmer placeholder. Think paper theater puppets or Eric Carle-style layered shapes. No flat geometric programmer art (pure rectangles, neon colors, hard pixel edges).

### Stories in scope
- US-23 — Reusable skeletal rig engine
- US-24 — Fox character rig (Pip)
- US-25 — Walk and run procedural animations
- US-26 — Idle animation suite
- US-27 — Rig system implementor guide

### Done-when (observable)
- [x] `src/rig/CharacterRig.ts` exists and exports a `CharacterRig` class [US-23]
- [x] `src/rig/types.ts` exists and exports `RigDefinition`, `DirectionProfile`, `BoneDefinition`, and `AnimationController` interfaces [US-23]
- [x] `CharacterRig` constructor accepts a `RigDefinition` and a Phaser Scene, creates a Phaser Container with child Sprite objects sourced from a texture atlas [US-23]
- [x] `CharacterRig.setDirection(dir)` accepts 8 directions (N, NE, E, SE, S, SW, W, NW) and updates per-part visibility, position, scale, rotation, and depth order per the direction's profile [US-23]
- [x] Direction profiles for W, SW, NW are derived by mirroring E, SE, NE (container or part scaleX flip) — the fox rig definition contains only 5 unique direction profiles [US-23]
- [x] `CharacterRig.update(delta)` calls all registered animation controllers, passing delta time and current bone state [US-23]
- [x] Animation controllers are added via `addAnimationController()` or equivalent registration method — `CharacterRig` contains no animation logic itself [US-23]
- [x] `RigDefinition` and `DirectionProfile` are plain data objects (object literals / interfaces), not class instances [US-23]
- [x] `npx tsc --noEmit && npm run build` passes with the new rig module included [US-23]
- [x] `src/rig/characters/fox.ts` exists and exports a fox rig definition conforming to `RigDefinition` [US-24]
- [x] Fox rig defines minimum 16 named parts: body, head, snout, left-ear, right-ear, tail-1, tail-2, tail-3, front-left-upper-leg, front-left-lower-leg, front-right-upper-leg, front-right-lower-leg, back-left-upper-leg, back-left-lower-leg, back-right-upper-leg, back-right-lower-leg [US-24]
- [x] 5 unique direction profiles exist (S, N, E, SE, NE) with per-part position, scale, rotation, depth, and visibility configs [US-24]
- [x] S profile: face visible (eyes/snout detail), body wide and short (foreshortened), 2 front legs visible, back legs hidden, tail hidden or peeking [US-24]
- [x] E profile: full body profile (long oval), 4 legs visible (near pair at higher alpha/depth than far pair), 1 ear visible, full tail chain trailing [US-24]
- [x] N profile: back of head, tail prominent above/behind body, back legs visible, no face detail [US-24]
- [x] `assets/characters/fox.png` and `assets/characters/fox.json` exist as a valid Phaser texture atlas with named frames matching all fox body parts [US-24]
- [x] Placeholder PNGs use warm-palette colors (oranges, russets, creams, browns) with organic shapes — paper-puppet storybook aesthetic, not geometric programmer art (aspirational — visual verification required) [US-24]
- [x] Fox character reads as a fox from S and E facing directions — identifiable pointed ears, snout, and bushy multi-segment tail (aspirational — visual verification required) [US-24]
- [x] `GameScene.createPlayer()` creates a `CharacterRig` with the fox definition instead of `this.add.rectangle()` [US-24]
- [x] Fox rig container is positioned at the same coordinates as the previous rectangle and uses `setDepth(5)` per the depth map (Entities layer) [US-24]
- [x] Camera follows the fox rig container center — panning and zoom behavior unchanged from the rectangle player [US-24]
- [x] Collision bounding box derived from the fox rig matches PLAYER_SIZE (24px) — `moveWithCollision`, `NpcInteractionSystem`, `TriggerZoneSystem`, and `checkExitZones` all function without changes to their input dimensions [US-24]
- [x] Area transitions (fade-out → scene restart → fade-in) work with the fox rig — no visual glitches or position errors on area change [US-24]
- [x] `src/rig/animations/walkRun.ts` exists and exports a walk/run animation controller conforming to `AnimationController` [US-25]
- [x] When velocity > 0 at walk speed: body oscillates vertically (visible bob), legs rotate in alternating gait (front-left pairs with back-right), tail segments follow with progressive phase offset, ears sway [US-25]
- [x] When velocity > 0 at run speed: animation cycle is faster, bob amplitude is larger, body rotation tilts forward, tail segments stream behind with less sway [US-25]
- [x] Walk-to-run speed transition occurs after holding a direction continuously for a configurable delay (default ~0.8s) — player speed increases from PLAYER_SPEED to PLAYER_SPEED x run multiplier [US-25]
- [x] Releasing and re-pressing a direction resets the walk-to-run timer — brief taps stay at walk speed [US-25]
- [x] Direction changes call `CharacterRig.setDirection()` — animation continues at the current phase (no restart from frame 0) [US-25]
- [x] Stopping movement (velocity returns to 0) plays a brief deceleration — bob settles, legs return to neutral, tail swings to rest — before idle begins [US-25]
- [x] Walk/run parameters (bob height, leg swing amplitude, tail amplitude, run multiplier, walk-to-run delay) are read from the rig definition, not hardcoded in the controller [US-25]
- [x] The walk/run animation controller is the source of truth for current movement speed — GameScene queries the controller's current speed and applies it to the velocity calculation, replacing the hardcoded PLAYER_SPEED used in `InputSystem.getVelocity()` for the player character [US-25]
- [x] `npx tsc --noEmit && npm run build` passes [US-25]
- [x] `src/rig/animations/idle.ts` exists and exports an idle animation controller conforming to `AnimationController` [US-26]
- [x] At velocity 0: breathing plays immediately — body scaleX/scaleY oscillates gently (period >= 2 seconds) [US-26]
- [x] At velocity 0: tail sway plays immediately — tail segments oscillate at a slower frequency and smaller amplitude than the walk tail motion [US-26]
- [x] After ~3 seconds idle (configurable): head rotation plays — head turns left or right (direction randomized), then returns to center [US-26]
- [x] After ~6 seconds idle (configurable): sit animation plays — legs tuck or fold, body Y position lowers, tail curls to the side or around the body [US-26]
- [x] Ear flick triggers at random intervals on individual ears — small rotation spike that returns to baseline (not synchronized with breathing or tail) [US-26]
- [x] Any movement input (velocity > 0) resets idle timer to 0, cancels sit/head-turn in progress, returns rig to standing neutral pose [US-26]
- [x] Breathing, tail sway, and ear flick all play simultaneously (composable, not mutually exclusive) [US-26]
- [x] Idle timing parameters (head-turn delay, sit delay, ear-flick interval range, breathing period) are defined in the rig definition [US-26]
- [x] Idle controller cleans up any internal timers or state on scene shutdown/destroy — no lingering references after scene teardown [US-26]
- [x] `docs/rig-system-guide.md` exists with sections: Architecture Overview, Bone Hierarchy Model, Direction Profile Authoring, Animation Controller API, Art Replacement Workflow, Creating a New Character [US-27]
- [x] Architecture section contains an ASCII or Mermaid diagram showing: RigDefinition -> CharacterRig -> Container(Sprites), DirectionProfile -> setDirection(), AnimationController -> update() [US-27]
- [x] Direction Profile section includes a parameter table (field, description, type, example value) and annotated before/after layouts for S (front-facing) and E (side-facing) directions [US-27]
- [x] Animation Controller section includes a parameter table for the sine-wave model (parameter name, what it controls, default value, sensible range for tuning) [US-27]
- [x] Art Replacement section provides numbered steps: (1) atlas file locations, (2) naming convention for part PNGs, (3) recommended dimensions/resolution, (4) how to generate the atlas JSON, (5) how to verify the replacement in-game [US-27]
- [x] New Character section walks through "adding the Keeper — a white heron" as a concrete example: define RigDefinition, create direction profiles, create placeholder atlas, register with GameScene, verify [US-27]
- [x] All file paths and type names in the guide match actual codebase locations (e.g., `src/rig/types.ts`, `CharacterRig`, `RigDefinition`) [US-27]
- [x] AGENTS.md directory layout includes `src/rig/` tree with descriptions: `CharacterRig.ts`, `types.ts`, `characters/`, `animations/` [phase]
- [x] AGENTS.md file ownership table includes entries for all rig modules (`CharacterRig.ts`, `types.ts`, `characters/fox.ts`, `animations/walkRun.ts`, `animations/idle.ts`) [phase]
- [x] AGENTS.md depth map remains unchanged — fox rig renders at Entities depth (5), no new depth layers introduced [phase]
- [x] Fox rig texture atlas loaded in Phaser's preload — atlas key is documented in AGENTS.md behavior rules or file ownership [phase]

### Golden principles (phase-relevant)
- **Depth map adherence** (AGENTS.md) — fox rig renders at depth 5 (Entities layer); no ad-hoc depth values
- **Systems-module architecture** — rig engine, character definitions, and animation controllers are separate modules, not monolithic
- **Zone-level mutual exclusion** (AGENTS.md, Learning #56) — rig animations must not interfere with dialogue/story input capture; idle state is the natural result of velocity = 0 during dialogue
- **Responsive scaling** (AGENTS.md) — rig must render correctly across viewport sizes; camera zoom affects the rig container like any other world-space object
- **Frame-based delta-time movement** (AGENTS.md) — all animation uses delta time, no fixed-frame assumptions
- **Parameterized systems** (AGENTS.md, area-system pattern) — rig receives definition data via constructor/parameters, no global imports of character-specific data
