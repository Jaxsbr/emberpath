## Phase goal

Bring the two existing NPCs (Marsh Hermit on Fog Marsh, Old Man on Ashen Isle) to life with sprite-based 8-direction animation, bounded random wander around their spawn tile, collision-aware path planning, and a player-awareness state that turns the NPC to face the player when the player is nearby or in dialogue. After this phase the world should read as inhabited rather than decorated — NPCs visibly walk a small territory around their spawn, idle, react to the player's approach by stopping and turning to look, and hold a static facing pose for the duration of any dialogue.

### Stories in scope
- US-52 — NPC sprite system & data model
- US-53 — Bounded wander with collision-aware path planning
- US-54 — Player awareness & dynamic facing
- US-55 — Dialogue facing snap-and-hold

### Done-when (observable)

#### Structural — assets & types
- [x] `assets/npc/marsh-hermit/idle/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_000.png .. frame_003.png` exist (32 files) [US-52]
- [x] `assets/npc/marsh-hermit/walk/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_000.png .. frame_003.png` exist (32 files) [US-52]
- [x] `assets/npc/marsh-hermit/static/{north,north-east,east,south-east,south,south-west,west,north-west}.png` exist (8 files) [US-52]
- [x] `assets/npc/old-man/idle/...` (32 files), `assets/npc/old-man/walk/...` (32 files), `assets/npc/old-man/static/...` (8 files) exist [US-52]
- [x] Asset migration checklist (Learning #51): (1) `vite.config.ts` `publicDir: 'assets'` continues to serve the new `assets/npc/<sprite-id>/...` subtree without additional config (verified by browser network panel: a sample frame URL like `/npc/marsh-hermit/idle/south/frame_000.png` returns 200 in `npm run dev`); (2) editor's `tools/editor/vite.config.ts` is reviewed — either accommodates NPC sprites or explicitly skips them with a comment; (3) AGENTS.md Directory layout tree is updated to include `assets/npc/<sprite-id>/{idle,walk,static}/`; (4) `.gitignore` is not silently overwritten by the asset copy operation. [US-52]
- [x] `NpcDefinition` in `src/data/areas/types.ts` has required fields `sprite: string`, `wanderRadius: number`, `awarenessRadius: number` (verified: read the file) [US-52]
- [x] `NpcDefinition.color` is retained (verified: not removed; used by editor map-overview) [US-52]
- [x] `src/data/areas/ashen-isle.ts` Old Man npc: `sprite: 'old-man'`, `wanderRadius: 2`, `awarenessRadius: 3` [US-52]
- [x] `src/data/areas/fog-marsh.ts` Marsh Hermit npc: `sprite: 'marsh-hermit'`, `wanderRadius: 2`, `awarenessRadius: 3` [US-52]
- [x] NPC sprite registry module exists (e.g. `src/systems/npcSprites.ts`) and exports a registry keyed by sprite id with idle/walk frame counts and static directions [US-52]
- [x] `src/maps/constants.ts` exports `NPC_SPEED`, `NPC_IDLE_MIN_MS`, `NPC_IDLE_MAX_MS` (named, not literals in system code) [US-53]

#### Structural — systems
- [x] `src/systems/npcBehavior.ts` exists and exports `NpcBehaviorSystem` with `update(delta, playerPos)`, `getLivePositions()`, `enterDialogue(npcId, playerPos)`, `exitDialogue(npcId)` [US-53]
- [x] Octant `velocityToDirection` / `vectorToDirection` function is shared between player `AnimationSystem` and NPC behavior (verified: single source — extracted to a shared module like `src/systems/direction.ts`, or `AnimationSystem` exports it for reuse — no duplicate octant table) [US-53]
- [x] Refactor consumer audit (Learning #70): before extracting the octant function, every site in `src/` that computes a direction from a velocity or position vector (any use of `Math.atan2`, octant tables, or `'north'/'south'/...` direction strings derived from coordinates) is enumerated. Each site either calls the shared function or has an explicit one-line comment justifying a separate implementation. The audited file list is included in the PR description. [US-53]
- [x] `src/systems/collision.ts` consults NPC live positions when checking player↔NPC collision (verified: source reads from `NpcBehaviorSystem.getLivePositions()` or equivalent live source, NOT from static `npc.col, npc.row`) [US-53]
- [x] `src/systems/npcInteraction.ts` proximity check uses NPC live positions [US-53]
- [x] `NpcBehaviorSystem` registers a `scene.events.on('shutdown', ...)` cleanup that clears all per-NPC timers (verified: read source) [US-53]

#### Structural — rendering & preload
- [x] `GameScene.preload()` iterates the NPC sprite registry and loads idle (32 keys), walk (32 keys), static (8 keys) per registered sprite id (verified: read source) [US-52]
- [x] `GameScene.create()` (or `registerAnimations()`) registers `npc-{spriteId}-{idle,walk}-{8 dirs}` for each registered sprite id at 8 fps `repeat: -1` (verified: read source) [US-52]
- [x] Static poses are loaded as plain image keys `npc-{spriteId}-static-{dir}` and applied via `setTexture`, NOT registered as 1-frame animations [US-52]
- [x] `GameScene.renderNpcs()` creates `Phaser.GameObjects.Sprite` per NPC at depth 5; the previous `Phaser.GameObjects.Rectangle` render path is removed (`grep -n 'Rectangle' src/scenes/GameScene.ts | grep -i npc` returns no matches) [US-52]
- [x] Phaser API contract: each NPC is created as `Phaser.GameObjects.Sprite` (NOT `Image`, NOT `Container`) so BOTH `play(animKey)` and `setTexture(textureKey)` work on the same instance. Verified by source read AND by a smoke check at scene start that exercises both code paths once on each NPC (initial idle anim plays → forced `setTexture` to a static key → no console error/TypeError). [US-52]
- [x] `GameScene.update()` calls `npcBehavior.update(delta, playerCenter)` once per frame after `inputSystem.update()` and before `triggerZone.update()` [US-53]

#### Behavior — wander (US-53)
- [x] An NPC in `idle` transitions to `walk` after a dwell time within `[NPC_IDLE_MIN_MS, NPC_IDLE_MAX_MS]` (verified by adding a dev console log and observing the timing across 5+ cycles, OR by a direct unit-style assertion if test infra is available) [US-53]
- [x] When walking, the NPC moves at `NPC_SPEED` (≈ `PLAYER_SPEED * 0.4`) and never exceeds `NPC_SPEED` in any axis (verified by source read + manual observation that the NPC is visibly slower than the player) [US-53]
- [x] An NPC's tile position never has Chebyshev distance > `wanderRadius` from its spawn tile during 60 seconds of unattended wandering (verified manually by leaving the player at the spawn corner of each area for 60s and watching) [US-53]
- [x] An NPC never overlaps a `TileType.WALL` cell with its bounding box (verified: walk every NPC's wander region and visually confirm no wall clipping; debug overlay can help) [US-53]
- [x] An NPC blocked by a wall on a chosen step picks a different direction within the same frame (verified: place the NPC near a wall corner and observe — it must not get stuck or idle indefinitely against a wall when other directions are open) [US-53]

#### Behavior — awareness (US-54)
- [x] When the player enters Chebyshev tile distance ≤ `awarenessRadius` of an NPC in idle/walk, the NPC halts within one frame and transitions to `aware` state (verified manually; debug overlay shows state if added) [US-54]
- [x] An NPC in `aware` state does NOT move (position is constant frame-over-frame) [US-54]
- [x] An NPC in `aware` state continuously updates its `static` texture to face the player as the player walks a circle around it (verified manually for both NPCs) [US-54]
- [x] An NPC's `static` texture is updated only when quantized facing direction changes, NOT every frame (verified: source reads a `lastStaticDir` guard on `setTexture` calls — Learning EP-01 loop-invariant) [US-54]
- [x] When the player exits Chebyshev tile distance > `awarenessRadius`, the NPC transitions back to `idle` and resumes wander on the next dwell expiry (verified manually) [US-54]
- [x] Debug overlay (F3) draws each NPC's awareness radius as a yellow-dashed circle and wander radius as a green-dashed circle in world space at depth 50 (verified visually with F3 toggled) [US-54]

#### Behavior — dialogue facing (US-55)
- [x] On dialogue start (NPC interaction), the NPC's `state` becomes `dialogue`, its sprite swaps to `npc-{spriteId}-static-{dir}` where `dir` is the quantized (player − npc) direction at the moment of interaction (verified: approach Old Man from each of the 8 directions; in each case the dialogue opens with the NPC visibly facing the player) [US-55]
- [x] During an active dialogue, the NPC's facing texture is NOT updated even if internal state would otherwise change (verified: source has no per-frame `setTexture` while `state === 'dialogue'`) [US-55]
- [x] On dialogue end, if the player is within `awarenessRadius`, the NPC transitions to `aware`; otherwise to `idle` (verified manually for both transitions) [US-55]
- [x] `DialogueSystem` exposes an `onEnd` callback (or equivalent observable terminating event) and `GameScene` wires it to `npcBehavior.exitDialogue(npc.id)` [US-55]
- [x] Idempotency: `enterDialogue(npcId, playerPos)` called a second time while the NPC is already in `dialogue` state is a no-op — no facing recompute, no `setTexture`, no state mutation. `exitDialogue(npcId)` called when the NPC is not in `dialogue` state is a no-op (verified by source read of guard clauses at the top of each method). [US-55]
- [x] Failure recovery: if `dialogueSystem.start(...)` throws or returns a falsy result after `enterDialogue` has set state to `'dialogue'`, `GameScene` catches the failure and calls `exitDialogue(npc.id)` so the NPC does not get stuck in `dialogue` with no active dialogue UI (verified by source read; deliberate-throw test if test infra available). [US-55]
- [x] Close-cooldown preserved: the existing 100ms `lastCloseTime` cooldown on `NpcInteractionSystem` (Learning #69 prevention) remains effective after this phase — a tap-close-tap rapid sequence does NOT reopen dialogue, even though `exitDialogue` may transition the NPC to `aware` immediately. Verified by manual rapid tap test on both NPCs. [US-55]

#### Variant baseline (per-NPC)
- [x] Marsh Hermit: renders as 8-direction animated sprite at spawn (US-52); wanders within radius 2 of spawn without wall clipping for 60s (US-53); enters `aware` and faces the player when player is within 3 tiles (US-54); snaps to face-player static pose on dialogue open and holds for the dialogue's full duration (US-55) [US-52]
- [x] Old Man: renders as 8-direction animated sprite at spawn (US-52); wanders within radius 2 of spawn without wall clipping for 60s (US-53); enters `aware` and faces the player when player is within 3 tiles (US-54); snaps to face-player static pose on dialogue open and holds for the dialogue's full duration (US-55) [US-52]

#### Behavior — reads-as (observer + mechanism-proxy pairs)
- [x] Marsh Hermit awareness reads-as: a first-time observer can describe what happened when the player walks toward the Hermit using a phrase like "they noticed me / stopped to look / turned to watch" — NOT "they froze" or "they lagged". Verified via the manual-verify doc with a short observer note. [US-54]
- [x] Marsh Hermit awareness mechanism proxy: NPC velocity drops to 0 within 1 frame of the player's tile crossing into `awarenessRadius`; NPC `static` texture key changes within 1 frame of the player's quantized direction-from-NPC changing (verified via dev console log instrumentation OR by source read of state-transition + `setTexture` order). [US-54]
- [x] Old Man awareness reads-as: same observer test, same phrasing target. [US-54]
- [x] Old Man awareness mechanism proxy: same velocity-halt-within-1-frame and direction-change-within-1-frame assertions. [US-54]
- [x] Dialogue facing reads-as: a first-time observer can describe the dialogue opening as "the NPC turned to talk to me" — NOT "the NPC was already facing that way" or "I couldn't tell if they faced me". Verified for both NPCs via observer note. [US-55]
- [x] Dialogue facing mechanism proxy: on `enterDialogue`, the NPC's `setTexture(npc-{spriteId}-static-{dir})` call fires exactly once before `dialogueSystem.start()` is invoked, with `dir` matching the quantized (player − npc) direction at the moment of interaction (verified by source read of call order + a one-time dev console log on the `setTexture` site). [US-55]

#### Aesthetic traceability
- [x] "Reads as a person who lives here" (US-53 wander) traces to: NPC visibly moves around its spawn over a 60-second observation window with idle pauses between steps (covered by wander criteria above). [US-53]
- [x] "Looks rather than loops" (US-54 awareness static-vs-idle) traces to: in `aware` state the NPC sprite uses a `static/{dir}.png` texture (no animation playing), distinct from the looping idle frames — verified by source read of state→texture mapping AND by visual side-by-side inspection that static poses are visually distinct from `idle/{dir}/frame_000.png` in both NPCs' asset trees. [US-54]
- [x] "Turned to talk to me" (US-55 snap-and-hold) traces to: dialogue facing mechanism proxy criterion above. [US-55]

#### Class baseline (player+NPC animated-sprite shared behavior)
- [x] NPC sprites use nearest-neighbor filtering (inherited from global `pixelArt: true` in `main.ts` — verified: no per-NPC `setFilter` override that would smooth them) [US-52]
- [x] NPC sprites render at depth 5 (Entities layer per the depth map) [US-52]
- [x] NPC sprites use the same 8-direction octant model and direction names (`north`, `north-east`, `east`, `south-east`, `south`, `south-west`, `west`, `north-west`) as the player [US-52]
- [x] NPC sprites use the same shared `velocityToDirection` / `vectorToDirection` function as the player (no duplicate octant tables) [US-53]
- [x] NPC sprites are ignored by the UI camera (`uiCam.ignore(...)`) at scene setup, same way player and tile/prop sprites are [US-52]

#### Editor sync
- [x] Editor's `tools/editor/src/mapRenderer.ts` draws each NPC's wander radius (green-dashed) and awareness radius (yellow-dashed) circles around the spawn tile, in addition to the existing interaction radius (verified: open editor for both areas and inspect) [US-52]
- [x] `cd tools/editor && npm run build` succeeds [US-52]

#### Error paths
- [x] If an NPC's `sprite` id is not in the NPC sprite registry, `GameScene` logs a descriptive console error naming the NPC id and missing sprite id; the NPC falls back to the previous coloured-rectangle render path (or skips rendering entirely with a clear log — both acceptable; silent failure is not) [US-52]
- [x] If an NPC is constructed with `wanderRadius: 0`, the NPC stays on its spawn tile (no wander step is ever picked) but still participates in awareness and dialogue facing (verified by setting wanderRadius=0 on a temporary test config or by source-reading the wander step guard) [US-53]
- [x] If the player↔NPC collision check is queried during the brief window before `NpcBehaviorSystem.update()` has run for the first time after an area transition, the system returns the spawn position rather than throwing (verified: source reads either lazy-init at construction, or a defensive default) [US-53]

#### Invariants (phase-level)
- [x] `npx tsc --noEmit && npm run build` passes for the main game [phase]
- [x] `cd tools/editor && npm run build` passes [phase]
- [x] No console errors or warnings during 60 seconds of normal play in either area (player walks around, both NPCs wander, player approaches one NPC, opens dialogue, closes dialogue, walks away) [phase]
- [x] AGENTS.md File ownership table includes a row for `src/systems/npcBehavior.ts` and an updated row for `src/systems/npcInteraction.ts` (live-position consumption) [phase]
- [x] AGENTS.md Behavior rules includes a new rule describing NPC wander/awareness/dialogue states, configurable per-NPC `wanderRadius`/`awarenessRadius`, Chebyshev tile distance, shared octant function, and pre-step path sampling for collision [phase]
- [x] AGENTS.md Directory layout tree reflects `assets/npc/<sprite-id>/{idle,walk,static}/...` and `src/systems/npcBehavior.ts`, `src/systems/direction.ts` (or wherever the shared octant lives) [phase]
- [x] AGENTS.md File ownership row for `scenes/GameScene.ts` updated to mention NPC sprite preload (per registered sprite id), NPC animation registration, NPC behavior system orchestration, NPC live-position propagation to collision/interaction systems [phase]
- [x] AGENTS.md Behavior rules zone-level mutual-exclusion entry is amended to include "NPC awareness state transitions are suppressed during dialogue" so the rule statement matches the implemented behavior (Learning #9 agents-consistency) [phase]
- [x] Deploy verification (Learning #65): the GitHub Pages deploy workflow succeeds for the squash-merge commit on `main` (green check); any post-merge fixes go through a new PR, not direct-to-main. [phase]
- [x] Debug overlay z-order (Learning #57 facet): when interaction radius (solid yellow), wander radius (dashed green), and awareness radius (dashed yellow) circles all render at depth 50 around the same NPC, render order is documented in `debugOverlay.ts` as a comment (e.g., interaction → wander → awareness, drawn in that order) so visual stacking is deterministic. [phase]

### Golden principles (phase-relevant)

- Depth map authority: NPCs render at depth 5 (Entities) — already in the depth map. Awareness/wander debug circles render at depth 50 (Debug overlay) — already in the depth map. No new depths introduced.
- Parameterized systems: `NpcBehaviorSystem` receives the area's NPC list and map via constructor; no global imports. Per-NPC tuning lives on `NpcDefinition`, not in the system module. `NPC_SPEED` and idle-dwell bounds live in `src/maps/constants.ts`.
- Zone-level mutual exclusion: when dialogue is active, NPC behavior switches to `dialogue` state and ignores awareness checks — consistent with the existing rule that dialogue suppresses movement, interaction, and trigger evaluation.
- No silent breaking changes: `NpcDefinition.color` is retained explicitly (used by the editor's map overview), not silently removed when the new sprite system replaces game-scene rendering.
- LEARNINGS EP-01 (loop-invariant discipline): before submitting, check for (a) setup ops that run every loop iteration but only need to run once (NPC animation registration runs once per scene, NOT per frame; static `setTexture` only fires when facing direction *changes*); (b) dead guard conditions (the `lastStaticDir` guard exists specifically to avoid the case where `setTexture` is called every frame with the same input); (c) comments referencing behavior no longer present (e.g. don't leave a comment about `Rectangle`-based NPC rendering after the swap); (d) function names implying a different contract (e.g. `getLivePositions()` must actually return a live snapshot, not the static spawn map).
- Quality checks (from AGENTS.md): no-silent-pass, no-bare-except, error-path-coverage, agents-consistency.
