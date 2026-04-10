# Phase: character-rig

Status: draft

## Phase goal

Build a reusable 2D skeletal rig system with procedural animation, and implement Pip (fox kit) as the first character. The rig system uses bone hierarchies, 8-direction profiles, and texture atlas body parts — designed so that any character can be defined as a data-driven rig and animated without per-frame sprite art. Pip replaces the colored square in GameScene with a paper-puppet aesthetic fox that trots, runs, and idles with personality. Documentation is a first-class deliverable so future developers and artists can create new characters and swap art.

### Design direction

Paper-puppet storybook aesthetic. Body parts are warm-colored organic shapes (oranges, russets, creams, browns) with soft edges, evoking cut-out illustrations from a children's book. The fox should look deliberate — a style choice, not programmer placeholder. Think paper theater puppets or Eric Carle-style layered shapes. No flat geometric programmer art (pure rectangles, neon colors, hard pixel edges).

## Stories

### US-23 — Reusable skeletal rig engine

As a developer, I want a reusable 2D skeletal rig system that supports bone hierarchies, direction-aware rendering, and procedural animation, so that characters can be defined as data-driven rigs and animated without per-frame sprite art.

**Acceptance criteria:**
- A `CharacterRig` class accepts a rig definition (bone tree, part names, attachment points) and creates a Phaser Container with child Sprites from a texture atlas
- The rig supports 8 directions (N, NE, E, SE, S, SW, W, NW) via direction profiles that control per-part visibility, position, scale, rotation, and render order
- Direction profiles for W, SW, NW are auto-derived by mirroring E, SE, NE — no duplicate profile definitions needed (5 unique profiles, 3 mirrored)
- Setting a direction on the rig transitions part configurations to the new direction profile
- The rig exposes an update method that registered animation controllers call each frame with delta time
- Animation controllers are pluggable — the rig provides the API for external controllers to manipulate bone transforms; the rig does not contain animation logic itself
- The rig loads body-part textures from a Phaser texture atlas (JSON hash + PNG)
- Rig definition and direction profiles are pure data objects (no class instances) — serializable and inspectable

**User guidance:** N/A — internal system

**Design rationale:** A data-driven rig with pluggable animation controllers separates character definition from animation logic, allowing the same animation system to drive different characters (fox, heron, stag) by swapping rig definitions. Texture atlas approach (not Graphics primitives) ensures art-swap readiness — replace PNGs, keep the same rig. Mirroring halves the direction profile authoring workload.

### US-24 — Fox character rig (Pip)

As a player, I want to see a fox character instead of a colored square, so that the protagonist has visual identity and the game world feels inhabited.

**Acceptance criteria:**
- A fox rig definition exists with parts: body, head, snout, left-ear, right-ear, tail segments (3+), and legs (4 legs, upper + lower segments each) — minimum 16 named parts
- 8 direction profiles position, scale, rotate, depth-order, and show/hide the parts for the correct fox silhouette from each angle
- Side-facing profiles (E, W) show 4 legs and full tail chain; front-facing profile (S) shows face, 2 front legs, tail hidden or minimal; back-facing profile (N) shows tail prominently, back legs visible
- Placeholder PNG atlas exists with paper-puppet aesthetic parts — warm colors (oranges, russets, creams, browns), organic shapes with soft edges
- The fox rig replaces the colored rectangle in GameScene — movement, collision, camera follow, NPC interaction, and trigger zone detection all work unchanged
- The fox rig's collision bounding box matches the previous player dimensions (PLAYER_SIZE) — no gameplay regression

**User guidance:**
- Discovery: The fox character is visible immediately on game start — replaces the colored square
- Manual section: N/A (visual change, no new user interaction)
- Key steps: 1. Start the game. 2. Observe fox character in place of the previous square. 3. Move — fox responds to all input (WASD, joystick).

**Design rationale:** Paper-puppet aesthetic over flat programmer art because the warm, organic shapes match the storybook vision and could ship as a deliberate art style. This means the "placeholder" art is also valid art — not throwaway.

**Interaction model:** Same as existing — WASD/joystick movement, Space/tap for NPC interaction. No new input mechanisms. The visual representation changes but all controls are identical to the current colored square.

### US-25 — Walk and run procedural animations

As a player, I want the fox to trot and run with natural movement — body bob, leg gait, tail follow-through, ear sway — so that walking (the primary gameplay activity) feels enjoyable and alive.

**Acceptance criteria:**
- Walk animation plays when the character moves at walk speed: body bobs vertically, legs cycle in a natural gait pattern, tail segments follow with progressive phase delay, ears sway subtly
- Run animation plays at run speed: faster cycle, larger amplitudes, body pitches slightly forward, tail streams behind
- Speed-based auto-transition: holding a direction transitions from walk to run after a configurable delay — no run button
- Walk speed matches the existing PLAYER_SPEED (160 px/s); run speed is faster, controlled by a configurable multiplier in the rig definition
- Direction changes update the rig's direction profile — parts reposition for the new facing direction while animation continues
- Stopping movement transitions smoothly to idle (no abrupt freeze — deceleration curve)
- Walk/run parameters (bob height, leg swing amplitude, tail sway amplitude, run speed multiplier, walk-to-run delay) are defined in the fox rig definition, not hardcoded in the animation controller

**User guidance:**
- Discovery: Movement animations are visible as soon as the player moves
- Manual section: N/A (enhanced visual feedback, no new user action)
- Key steps: 1. Move with WASD/joystick — observe trotting animation. 2. Hold a direction — observe transition to run. 3. Change direction — parts reposition. 4. Stop — smooth transition to idle.

**Design rationale:** Procedural sine-wave animation over keyframed sprite sheets because it produces fluid, non-repeating motion from simple math, works for all 8 directions from a single parameter set, and allows real-time tuning without re-exporting art. Auto walk-to-run (no run button) keeps the control scheme simple for the 6-12 age target audience.

**Interaction model:** Same WASD/joystick controls as existing. Walk is default speed. Run triggers automatically after holding a direction for the configured delay. No new input required — complexity is hidden from the player.

### US-26 — Idle animation suite

As a player, I want the fox to breathe, sway its tail, look around, and eventually sit when standing still, so that Pip feels alive during story reading and exploration pauses.

**Acceptance criteria:**
- Breathing animation plays immediately when idle: gentle body scale oscillation
- Tail sway animation plays immediately when idle: slow, lazy sine wave distinct from the walk tail motion
- After a configurable delay (default ~3s): head turn animation — look left or right (randomized)
- After a longer delay (default ~6s): sit-down animation — legs tuck, body lowers, tail curls around
- Ear flick: random small rotation spikes on individual ears at random intervals (not synchronized)
- Any movement input resets idle timer and returns the rig to standing pose
- Breathing, tail sway, and ear flick compose simultaneously (all active during idle)
- Idle timing thresholds and animation amplitudes are configurable in the rig definition
- Idle timers and any internal state clean up on scene shutdown/destroy

**User guidance:**
- Discovery: Stop moving and wait — idle animations begin automatically
- Manual section: N/A (ambient animation, no user action)
- Key steps: 1. Stop moving — observe breathing and tail sway. 2. Wait ~3 seconds — fox looks around. 3. Wait ~6 seconds — fox sits down. 4. Move — fox stands up and idle resets.

**Design rationale:** Progressive idle (breathe → look → sit) rewards player patience and makes Pip feel alive during the frequent dialogue/story reading pauses that are central to this game. Randomized timing ensures no two idle sequences look identical.

**Interaction model:** Passive — no player input triggers idle. Any movement input cancels idle. This is the same as existing (colored square freezes on stop), but with life added.

### US-27 — Rig system implementor guide

As a future developer or artist, I want comprehensive documentation for the character rig system, so that I can create new characters, define direction profiles, tune animations, and replace placeholder art without reverse-engineering the code.

**Acceptance criteria:**
- Guide exists covering: architecture overview, bone hierarchy model, direction profile authoring, animation controller API, art replacement workflow, creating a new character
- Architecture section includes a diagram (ASCII or Mermaid) showing relationships between rig definitions, direction profiles, animation controllers, and texture atlases
- Direction profile section explains each parameter (position, scale, rotation, depth, visibility) with before/after examples for front (S) and side (E) directions
- Animation controller section explains the sine-wave model with parameter tables (name, what it controls, default, range)
- Art replacement section provides step-by-step: atlas structure, naming convention, sizing, how to regenerate the atlas JSON, how to verify in-game
- New character section walks through a concrete example (e.g., "adding the Keeper — a white heron") from rig definition to rendering
- All file paths and type names reference actual source code

**User guidance:** N/A — developer documentation

**Design rationale:** Documentation as a first-class deliverable because the rig system is explicitly designed for reuse across multiple characters (Keeper, Driftwood, future NPCs). The art replacement workflow is critical since the entire design premise is placeholder → final art swap.

## Done-when (observable)

### US-23 — Reusable skeletal rig engine
- [ ] `src/rig/CharacterRig.ts` exists and exports a `CharacterRig` class [US-23]
- [ ] `src/rig/types.ts` exists and exports `RigDefinition`, `DirectionProfile`, `BoneDefinition`, and `AnimationController` interfaces [US-23]
- [ ] `CharacterRig` constructor accepts a `RigDefinition` and a Phaser Scene, creates a Phaser Container with child Sprite objects sourced from a texture atlas [US-23]
- [ ] `CharacterRig.setDirection(dir)` accepts 8 directions (N, NE, E, SE, S, SW, W, NW) and updates per-part visibility, position, scale, rotation, and depth order per the direction's profile [US-23]
- [ ] Direction profiles for W, SW, NW are derived by mirroring E, SE, NE (container or part scaleX flip) — the fox rig definition contains only 5 unique direction profiles [US-23]
- [ ] `CharacterRig.update(delta)` calls all registered animation controllers, passing delta time and current bone state [US-23]
- [ ] Animation controllers are added via `addAnimationController()` or equivalent registration method — `CharacterRig` contains no animation logic itself [US-23]
- [ ] `RigDefinition` and `DirectionProfile` are plain data objects (object literals / interfaces), not class instances [US-23]
- [ ] `npx tsc --noEmit && npm run build` passes with the new rig module included [US-23]

### US-24 — Fox character rig (Pip)
- [ ] `src/rig/characters/fox.ts` exists and exports a fox rig definition conforming to `RigDefinition` [US-24]
- [ ] Fox rig defines minimum 16 named parts: body, head, snout, left-ear, right-ear, tail-1, tail-2, tail-3, front-left-upper-leg, front-left-lower-leg, front-right-upper-leg, front-right-lower-leg, back-left-upper-leg, back-left-lower-leg, back-right-upper-leg, back-right-lower-leg [US-24]
- [ ] 5 unique direction profiles exist (S, N, E, SE, NE) with per-part position, scale, rotation, depth, and visibility configs [US-24]
- [ ] S profile: face visible (eyes/snout detail), body wide and short (foreshortened), 2 front legs visible, back legs hidden, tail hidden or peeking [US-24]
- [ ] E profile: full body profile (long oval), 4 legs visible (near pair at higher alpha/depth than far pair), 1 ear visible, full tail chain trailing [US-24]
- [ ] N profile: back of head, tail prominent above/behind body, back legs visible, no face detail [US-24]
- [ ] `assets/characters/fox.png` and `assets/characters/fox.json` exist as a valid Phaser texture atlas with named frames matching all fox body parts [US-24]
- [ ] Placeholder PNGs use warm-palette colors (oranges, russets, creams, browns) with organic shapes — paper-puppet storybook aesthetic, not geometric programmer art (aspirational — visual verification required) [US-24]
- [ ] Fox character reads as a fox from S and E facing directions — identifiable pointed ears, snout, and bushy multi-segment tail (aspirational — visual verification required) [US-24]
- [ ] `GameScene.createPlayer()` creates a `CharacterRig` with the fox definition instead of `this.add.rectangle()` [US-24]
- [ ] Fox rig container is positioned at the same coordinates as the previous rectangle and uses `setDepth(5)` per the depth map (Entities layer) [US-24]
- [ ] Camera follows the fox rig container center — panning and zoom behavior unchanged from the rectangle player [US-24]
- [ ] Collision bounding box derived from the fox rig matches PLAYER_SIZE (24px) — `moveWithCollision`, `NpcInteractionSystem`, `TriggerZoneSystem`, and `checkExitZones` all function without changes to their input dimensions [US-24]
- [ ] Area transitions (fade-out → scene restart → fade-in) work with the fox rig — no visual glitches or position errors on area change [US-24]

### US-25 — Walk and run procedural animations
- [ ] `src/rig/animations/walkRun.ts` exists and exports a walk/run animation controller conforming to `AnimationController` [US-25]
- [ ] When velocity > 0 at walk speed: body oscillates vertically (visible bob), legs rotate in alternating gait (front-left pairs with back-right), tail segments follow with progressive phase offset, ears sway [US-25]
- [ ] When velocity > 0 at run speed: animation cycle is faster, bob amplitude is larger, body rotation tilts forward, tail segments stream behind with less sway [US-25]
- [ ] Walk-to-run speed transition occurs after holding a direction continuously for a configurable delay (default ~0.8s) — player speed increases from PLAYER_SPEED to PLAYER_SPEED x run multiplier [US-25]
- [ ] Releasing and re-pressing a direction resets the walk-to-run timer — brief taps stay at walk speed [US-25]
- [ ] Direction changes call `CharacterRig.setDirection()` — animation continues at the current phase (no restart from frame 0) [US-25]
- [ ] Stopping movement (velocity returns to 0) plays a brief deceleration — bob settles, legs return to neutral, tail swings to rest — before idle begins [US-25]
- [ ] Walk/run parameters (bob height, leg swing amplitude, tail amplitude, run multiplier, walk-to-run delay) are read from the rig definition, not hardcoded in the controller [US-25]
- [ ] The walk/run animation controller is the source of truth for current movement speed — GameScene queries the controller's current speed and applies it to the velocity calculation, replacing the hardcoded PLAYER_SPEED used in `InputSystem.getVelocity()` for the player character [US-25]
- [ ] `npx tsc --noEmit && npm run build` passes [US-25]

### US-26 — Idle animation suite
- [ ] `src/rig/animations/idle.ts` exists and exports an idle animation controller conforming to `AnimationController` [US-26]
- [ ] At velocity 0: breathing plays immediately — body scaleX/scaleY oscillates gently (period >= 2 seconds) [US-26]
- [ ] At velocity 0: tail sway plays immediately — tail segments oscillate at a slower frequency and smaller amplitude than the walk tail motion [US-26]
- [ ] After ~3 seconds idle (configurable): head rotation plays — head turns left or right (direction randomized), then returns to center [US-26]
- [ ] After ~6 seconds idle (configurable): sit animation plays — legs tuck or fold, body Y position lowers, tail curls to the side or around the body [US-26]
- [ ] Ear flick triggers at random intervals on individual ears — small rotation spike that returns to baseline (not synchronized with breathing or tail) [US-26]
- [ ] Any movement input (velocity > 0) resets idle timer to 0, cancels sit/head-turn in progress, returns rig to standing neutral pose [US-26]
- [ ] Breathing, tail sway, and ear flick all play simultaneously (composable, not mutually exclusive) [US-26]
- [ ] Idle timing parameters (head-turn delay, sit delay, ear-flick interval range, breathing period) are defined in the rig definition [US-26]
- [ ] Idle controller cleans up any internal timers or state on scene shutdown/destroy — no lingering references after scene teardown [US-26]

### US-27 — Rig system implementor guide
- [ ] `docs/rig-system-guide.md` exists with sections: Architecture Overview, Bone Hierarchy Model, Direction Profile Authoring, Animation Controller API, Art Replacement Workflow, Creating a New Character [US-27]
- [ ] Architecture section contains an ASCII or Mermaid diagram showing: RigDefinition -> CharacterRig -> Container(Sprites), DirectionProfile -> setDirection(), AnimationController -> update() [US-27]
- [ ] Direction Profile section includes a parameter table (field, description, type, example value) and annotated before/after layouts for S (front-facing) and E (side-facing) directions [US-27]
- [ ] Animation Controller section includes a parameter table for the sine-wave model (parameter name, what it controls, default value, sensible range for tuning) [US-27]
- [ ] Art Replacement section provides numbered steps: (1) atlas file locations, (2) naming convention for part PNGs, (3) recommended dimensions/resolution, (4) how to generate the atlas JSON, (5) how to verify the replacement in-game [US-27]
- [ ] New Character section walks through "adding the Keeper — a white heron" as a concrete example: define RigDefinition, create direction profiles, create placeholder atlas, register with GameScene, verify [US-27]
- [ ] All file paths and type names in the guide match actual codebase locations (e.g., `src/rig/types.ts`, `CharacterRig`, `RigDefinition`) [US-27]

### Structural
- [ ] AGENTS.md directory layout includes `src/rig/` tree with descriptions: `CharacterRig.ts`, `types.ts`, `characters/`, `animations/` [phase]
- [ ] AGENTS.md file ownership table includes entries for all rig modules (`CharacterRig.ts`, `types.ts`, `characters/fox.ts`, `animations/walkRun.ts`, `animations/idle.ts`) [phase]
- [ ] AGENTS.md depth map remains unchanged — fox rig renders at Entities depth (5), no new depth layers introduced [phase]
- [ ] Fox rig texture atlas loaded in Phaser's preload — atlas key is documented in AGENTS.md behavior rules or file ownership [phase]

### Safety criteria
Safety criteria: N/A — this phase introduces no API endpoints, no user input fields, no query interpolation, and no LLM output handling. All changes are client-side rendering within the existing Phaser game canvas.

## Golden principles (phase-relevant)
- **Depth map adherence** (AGENTS.md) — fox rig renders at depth 5 (Entities layer); no ad-hoc depth values
- **Systems-module architecture** — rig engine, character definitions, and animation controllers are separate modules, not monolithic
- **Zone-level mutual exclusion** (AGENTS.md, Learning #56) — rig animations must not interfere with dialogue/story input capture; idle state is the natural result of velocity = 0 during dialogue
- **Responsive scaling** (AGENTS.md) — rig must render correctly across viewport sizes; camera zoom affects the rig container like any other world-space object
- **Frame-based delta-time movement** (AGENTS.md) — all animation uses delta time, no fixed-frame assumptions
- **Parameterized systems** (AGENTS.md, area-system pattern) — rig receives definition data via constructor/parameters, no global imports of character-specific data

## AGENTS.md sections affected
- Directory layout (new `src/rig/` tree with subdirectories)
- File ownership (new rig modules: engine, types, fox definition, animation controllers)
- Behavior rules (fox character replaces colored square; walk/run/idle behavior)
- Scaling tuning guide (rig follows camera zoom automatically — may need a note)

## User documentation
No user-facing manual exists for Emberpath (game, not a tool). The rig system guide (`docs/rig-system-guide.md`) serves as the developer documentation for this phase. No player-facing documentation is needed — the fox character is a visual enhancement with no new user controls.
