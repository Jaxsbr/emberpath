# Phase: npc-behavior

Status: draft

## Phase goal

Bring the two existing NPCs (Marsh Hermit on Fog Marsh, Old Man on Ashen Isle) to life with sprite-based 8-direction animation, bounded random wander around their spawn tile, collision-aware path planning, and a player-awareness state that turns the NPC to face the player when the player is nearby or in dialogue. After this phase the world should read as inhabited rather than decorated — NPCs visibly walk a small territory around their spawn, idle, react to the player's approach by stopping and turning to look, and hold a static facing pose for the duration of any dialogue.

## Design direction

Behavior-only phase. No new HUD elements, dialogue chrome, or world UI introduced. Visual style is fully determined by the supplied PixelLab assets at `/Users/jacobusbrink/Jaxs/assets/emberpath/npc/{marsh-hermit,old-man}/{idle,walk,static}/`. Qualitative target: **"the NPC reads as a person who lives here and noticed me arrive."** This is exercised by:
- the awareness reads-as criterion + mechanism proxy in US-54
- the dialogue-facing reads-as criterion + mechanism proxy in US-55
- the aesthetic-traceability section in done-when (every aesthetic claim → at least one mechanically verifiable criterion)

Build-loop does NOT apply the `frontend-design` skill — there is no UI surface to design. All "feel" claims are traced to either a source-read assertion, a per-frame mechanism proxy, or an explicit observer note (marked as such).

## Safety criteria

N/A — this phase introduces no API endpoints, user text input fields, or query interpolation. NPC behavior consumes only internal state (`AreaDefinition`, player position, `area.map`). No auto-safety criteria apply.

## Stories

### US-52 — NPC sprite system & data model

As a player, I want the Marsh Hermit and Old Man rendered as animated 8-direction characters instead of coloured rectangles, so that they read as living characters in the world rather than placeholder markers.

**Acceptance criteria**:
- `assets/npc/marsh-hermit/{idle,walk}/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_000..003.png` exist (4 frames per direction × 8 directions × 2 animation types = 64 PNGs per NPC, copied from `/Users/jacobusbrink/Jaxs/assets/emberpath/npc/marsh-hermit/`).
- `assets/npc/marsh-hermit/static/{north,north-east,east,south-east,south,south-west,west,north-west}.png` exist (8 single-frame static poses, copied from the staging path).
- Identical asset tree exists under `assets/npc/old-man/`.
- `NpcDefinition` (in `src/data/areas/types.ts`) gains required fields `sprite: string` (asset id, e.g. `'marsh-hermit'`), `wanderRadius: number` (tiles, integer ≥ 0), `awarenessRadius: number` (tiles, integer ≥ 0). The existing `color: number` field is retained for the editor's map-overview rendering only (same retention pattern used for `visual.floorColor/wallColor` in the tileset phase).
- Ashen Isle's `old-man` NPC sets `sprite: 'old-man'`, `wanderRadius: 2`, `awarenessRadius: 3`. Fog Marsh's `marsh-hermit` NPC sets `sprite: 'marsh-hermit'`, `wanderRadius: 2`, `awarenessRadius: 3`.
- A central NPC sprite registry (`src/systems/npcSprites.ts` or equivalent) lists every NPC sprite id with its frame counts. `GameScene.preload()` iterates the registry once and loads all NPC frames for the registered sprite ids — no per-NPC duplicate loads.
- `GameScene.create()` registers, per registered sprite id, the 16 looping animations `npc-{spriteId}-{idle,walk}-{8 dirs}` at 8 fps `repeat: -1` (mirrors the fox-pip animation registration pattern). Static poses are NOT animations — they are loaded as 8 individual texture keys `npc-{spriteId}-static-{dir}` and applied via `sprite.setTexture(...)`.
- `GameScene.renderNpcs()` creates a `Phaser.GameObjects.Sprite` per NPC at depth 5 (Entities layer per the depth map), positioned at the spawn tile, playing `npc-{spriteId}-idle-south` initially. The previous `Phaser.GameObjects.Rectangle` render path is removed.
- Both NPCs render without console errors on scene start in their respective areas.

**User guidance:**
- Discovery: Walk into either area — the NPC visibly stands at their spawn position playing an idle animation.
- Manual section: N/A (the NPC is already discoverable via existing dialogue interaction).
- Key steps: N/A — no new player action required.

**Design rationale:** Using a per-sprite-id registry rather than hardcoding NPC asset paths in `GameScene.preload()` keeps the scene file from growing every time a third NPC is added — adding a new NPC becomes a registry entry plus a `sprite:` value on the area's `NpcDefinition`. Retaining `color` matches the established editor-vs-game split (the editor's map-overview can't bundle NPC sprite atlases). Static poses are loaded as plain images rather than 1-frame animations because Phaser animations cannot meaningfully "play" a single frame — `setTexture` is the idiomatic way to swap to a fixed pose.

**Consumer adaptation:** The NPC sprite registry is consumed by both `GameScene` (for preload + animation registration) and the `NpcBehaviorSystem` (for resolving anim/texture keys at state-change time). Each consumer accesses the registry by id; there are no hardcoded NPC ids inside `GameScene` or the behavior system. Adding a third NPC to a third area must require zero edits to `GameScene` or `NpcBehaviorSystem` — only a registry entry and an `AreaDefinition.npcs` row.

---

### US-53 — Bounded wander with collision-aware path planning

As a player, I want NPCs to walk slowly around their spawn area in random 8-direction steps and pause to idle between steps, so that the world feels populated by characters who go about their day rather than statues fixed to a tile.

**Acceptance criteria**:
- A new `NpcBehaviorSystem` lives at `src/systems/npcBehavior.ts` and is constructed by `GameScene.create()` with the area's `NpcDefinition[]`, the area's `map`, and a per-NPC sprite reference. It owns each NPC's live state: `position { x, y }` (float), `spawnTile { col, row }`, `state` (`'idle' | 'walk' | 'aware' | 'dialogue'`), `facingDirection`, `targetPosition { x, y } | null`.
- Per frame in `update(delta, playerPos)`, the system advances each NPC's state machine. Default cadence: idle for a randomised dwell time (configurable: `NPC_IDLE_MIN_MS`, `NPC_IDLE_MAX_MS`, defaults 800–2400 ms), then pick a wander step.
- Wander step: pick one of the 8 directions uniformly at random. Compute the step's target as `spawnTile + chosen direction × stepTiles` (where `stepTiles = 1` per step). Convert to world coordinates.
- **Wander-radius enforcement:** Before committing a step, compute the candidate target's tile-distance from `spawnTile` using Chebyshev distance. If the candidate distance > `wanderRadius`, replace the chosen direction with the direction that most reduces Chebyshev distance to spawn (i.e. step back toward spawn) and re-derive the target. The NPC must NEVER occupy a tile whose Chebyshev distance from its spawn tile exceeds `wanderRadius`.
- **Collision-aware re-pick:** Before committing a step, sample tile cells along the path from current position to candidate target. If any sampled cell is `TileType.WALL` or out of bounds, re-pick the direction (excluding directions that have already failed this iteration). After 8 failed picks, fall back to idle for one dwell cycle. The NPC's bounding box must never overlap a wall during travel.
- NPC↔NPC collision: an NPC may not walk into another NPC's current bounding box. NPC↔player collision: an NPC may not walk into the player's bounding box. Failed pick triggers the re-pick rule above.
- NPC walk speed is a single named constant `NPC_SPEED` defined in `src/maps/constants.ts`, set to ~40% of `PLAYER_SPEED` (concrete proposal: `PLAYER_SPEED * 0.4`). The constant must NOT be hardcoded inside `NpcBehaviorSystem` or `GameScene`.
- During the `walk` state, the NPC sprite plays `npc-{spriteId}-walk-{facingDirection}`. During `idle` state, it plays `npc-{spriteId}-idle-{facingDirection}`. Direction is derived from current movement vector using the SAME octant function as the player's `AnimationSystem.velocityToDirection` — share the function (extract to `src/systems/direction.ts` or similar) rather than duplicating the math.
- Existing player↔NPC collision in `src/systems/collision.ts` and `src/systems/movement.ts` consults the NPC's **live position** (from the behavior system), not the static `npc.col, npc.row` from the definition. The static fields are the spawn position only.
- Existing `NpcInteractionSystem` proximity check uses the NPC's live position.
- Behavior system cleans up all timers / per-frame state on `scene.events.shutdown` (no orphaned tweens or timers across area transitions).

**User guidance:**
- Discovery: Stand at a distance (outside the awareness radius — see US-54) and watch — the NPC takes a step in a random direction every couple of seconds, never straying more than `wanderRadius` tiles from where they started, never passing through walls.
- Manual section: N/A (ambient world behavior).
- Key steps: N/A.

**Design rationale:** Tile-step wander (rather than continuous random-direction drift) is chosen because it composes cleanly with the existing tile-grid collision and keeps the NPC's "territory" legibly tied to a small set of cells the player can mentally map. Chebyshev distance for the radius check matches the 8-direction movement model — Euclidean would forbid corner cells that diagonal stepping naturally reaches, producing surprising "invisible walls". Pre-step path sampling (not post-step rollback) is cheaper and avoids visual glitches where the NPC briefly enters a wall and snaps back. Sharing `velocityToDirection` with the player is required to avoid the bug class where two octant implementations drift apart and produce subtly different facing for identical movement vectors.

**Consumer adaptation:** `NpcBehaviorSystem` is constructed once per `GameScene` with the area-specific NPC list and map; it does not import any global state. `NPC_SPEED`, `NPC_IDLE_MIN_MS`, `NPC_IDLE_MAX_MS` live in `src/maps/constants.ts` so future areas can tune cadence without editing system code.

**Processing model:** `GameScene.update()` calls `npcBehavior.update(delta, playerPos)` once per frame after `inputSystem.update()` and before `triggerZone.update()`. The behavior system internally: (1) advances per-NPC timers, (2) for each NPC in `walk`, integrates position by `NPC_SPEED * delta`, (3) on arrival at target (within `ARRIVAL_EPSILON`), transitions to `idle` and resets dwell timer, (4) on dwell timer expiry, picks next wander step using the rules above. The behavior system itself never writes to `area.map` or to other systems — it owns its own state and exposes a read-only `getLivePositions(): Map<npcId, {x, y}>` for collision and interaction systems to consume.

---

### US-54 — Player awareness & dynamic facing

As a player, I want NPCs to stop walking and turn to look at me when I get close, so that they feel aware of me as another presence in the world rather than going about their loop while I pass through.

**Acceptance criteria**:
- Per frame, for each NPC, `NpcBehaviorSystem` computes Chebyshev tile distance between the NPC's current tile and the player's current tile. If distance ≤ `awarenessRadius` and the NPC is in `idle` or `walk`, the NPC transitions to the `aware` state.
- In `aware` state: the NPC halts movement immediately (no inertial slide), cancels any in-flight wander target, and continuously updates `facingDirection` to point at the player. Facing is derived from the (player_position − npc_position) world-space vector quantized to 8 directions using the SAME octant function used by the player and by US-53 wander.
- In `aware` state, the NPC sprite displays the corresponding `npc-{spriteId}-static-{facingDirection}` texture (the single static frame for that direction). No animation plays — the NPC is visibly still but visibly tracking.
- Per frame, while in `aware` state, if the player has moved enough that the quantized facing direction has changed, the texture updates to the new direction's static frame. Texture is NOT updated when the direction is unchanged (no per-frame `setTexture` on identical inputs — Learning EP-01 loop-invariant rule).
- When the player moves outside the awareness radius (Chebyshev tile distance > `awarenessRadius`) and the NPC is in `aware`, the NPC transitions back to `idle`, restarts its dwell timer, and resumes the wander cycle from US-53 on the next dwell expiry.
- The awareness check is mutually exclusive with dialogue: an NPC in the `dialogue` state ignores awareness transitions until dialogue ends (handled by US-55).
- Debug overlay (F3) draws each NPC's awareness radius as a yellow-dashed circle in world space at depth 50, distinct from the existing solid-yellow interaction radius circle. The debug overlay also draws each NPC's wander radius as a green-dashed circle around the spawn tile.
- The visual transition is unmistakable: walking up to either NPC visibly causes them to stop and turn to face the player as the player circles them.

**User guidance:**
- Discovery: Walk toward either NPC. At ~3 tiles distance, they stop walking and turn to look at you. Walk a circle around them — they continuously rotate to track. Walk away — they resume their wander loop.
- Manual section: N/A (ambient behavior; no player action required).
- Key steps: N/A.

**Design rationale:** Awareness uses tile distance rather than pixel distance because the existing game-feel vocabulary (interaction radius in tiles, wander radius in tiles) is tile-based — mixing units would make tuning surprising. Chebyshev specifically (rather than Euclidean) means a player approaching diagonally registers awareness at the same step as a player approaching cardinally — this matches the 8-direction movement grid. Transitioning to a static texture (not the idle animation) is what conveys "looking" — an idle animation on a stopped character reads as "looping placeholder", while a still pose with a head turned reads as "watching". The visible halt-and-turn is the entire point of the feature; if the player can't tell that the NPC noticed them, the behavior provides no value.

**Consumer adaptation:** Awareness radius is per-NPC (`awarenessRadius` on `NpcDefinition`), so the editor can later tune individual NPCs (a sleeping NPC could have radius 0, a watchtower guard could have radius 8). `NpcBehaviorSystem` reads it from the definition; no system-level constant.

**Processing model:** Awareness check runs at the top of each NPC's per-frame update before wander/idle progression. State transitions are one-way per frame: idle/walk → aware on enter, aware → idle on exit, never both in the same frame. Texture updates only fire on facing-direction *change*, tracked via a per-NPC `lastStaticDir` field.

---

### US-55 — Dialogue facing snap-and-hold

As a player, I want the NPC to face me directly during conversation regardless of which side I approached them from, so that dialogue feels like the NPC is talking *to me* rather than reciting at the wall.

**Acceptance criteria**:
- `NpcBehaviorSystem` exposes `enterDialogue(npcId, playerPos)` and `exitDialogue(npcId)` methods. `GameScene` wires `npcInteraction.setInteractionCallback` to call `enterDialogue(npc.id, playerCenter)` *before* invoking `dialogueSystem.start(...)`. `GameScene` subscribes to a dialogue-end event (extending `DialogueSystem` with an `onEnd` callback if not present) and calls `exitDialogue(npc.id)` when dialogue closes.
- On `enterDialogue`: the NPC's `state` becomes `'dialogue'`. Movement halts immediately. `facingDirection` is set ONCE from the (player − npc) vector quantized to 8 directions, using the shared octant function. The NPC sprite swaps to `npc-{spriteId}-static-{facingDirection}` and is NOT updated again for the duration of the dialogue (even if the player wanders during dialogue — though existing `dialogue-active` mutual exclusion in AGENTS.md already suppresses player movement).
- During the `dialogue` state, the awareness check (US-54) is inert — the NPC stays in `dialogue`, not `aware`, regardless of player distance.
- On `exitDialogue`: if the player is currently within `awarenessRadius`, the NPC transitions to `aware` (US-54 applies). Otherwise the NPC transitions to `idle` and resumes the wander cycle on the next dwell expiry.
- Dialogue facing must be the snap-once `static` texture, not the idle animation — matches the awareness rule. The visual difference between "dialogue" (still, facing player, dialogue box up) and "aware" (still, facing player, no dialogue box) is purely the dialogue box.
- Trigger-zone-initiated dialogues (e.g. `'old-man-intro'` triggered by walking onto a zone, if any are added later) use the same `enterDialogue` path. NPC-initiated dialogues are routed through the same hook so behavior is consistent.
- Both NPCs (Marsh Hermit, Old Man) face the player correctly when interacted with from each of the 8 approach directions.

**User guidance:**
- Discovery: Approach an NPC from any direction and press Space (desktop) or tap (mobile). The NPC immediately turns to face you, dialogue opens, and they stay facing you for the entire conversation.
- Manual section: N/A (extends an existing interaction; no new control to teach).
- Key steps: N/A — same Space/tap action that already starts dialogue.

**Design rationale:** Snap-once-and-hold (rather than continuously tracking during dialogue) is chosen because the player cannot move during dialogue (existing zone mutual-exclusion rule), so the (player − npc) vector cannot meaningfully change — re-computing it per frame would burn CPU on identical inputs. The snap on `enterDialogue` is what makes the NPC feel like they "looked up" to address the player. Routing trigger-zone-initiated and NPC-initiated dialogues through the same `enterDialogue` hook avoids the bug class where one entry point sets facing and the other doesn't.

**Consumer adaptation:** `enterDialogue/exitDialogue` are id-keyed so multi-NPC areas work without changes. The hook does not assume a specific dialogue script naming convention — it takes the npc id and player position and updates state, nothing more.

**Processing model:** `enterDialogue` is called by `GameScene`'s NPC-interaction callback synchronously before `dialogueSystem.start()`. `exitDialogue` is called from a new `DialogueSystem.setOnEnd(cb)` hook that fires when the script completes (last node's `nextId` resolves to nothing) or when the dialogue is closed. The state transition happens before the dialogue UI animates in, so the NPC is already facing correctly by the time the dialogue box appears.

---

## Done-when (observable)

### Structural — assets & types

- [ ] `assets/npc/marsh-hermit/idle/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_000.png .. frame_003.png` exist (32 files) [US-52]
- [ ] `assets/npc/marsh-hermit/walk/{north,north-east,east,south-east,south,south-west,west,north-west}/frame_000.png .. frame_003.png` exist (32 files) [US-52]
- [ ] `assets/npc/marsh-hermit/static/{north,north-east,east,south-east,south,south-west,west,north-west}.png` exist (8 files) [US-52]
- [ ] `assets/npc/old-man/idle/...` (32 files), `assets/npc/old-man/walk/...` (32 files), `assets/npc/old-man/static/...` (8 files) exist [US-52]
- [ ] **Asset migration checklist (Learning #51):** (1) `vite.config.ts` `publicDir: 'assets'` continues to serve the new `assets/npc/<sprite-id>/...` subtree without additional config (verified by browser network panel: a sample frame URL like `/npc/marsh-hermit/idle/south/frame_000.png` returns 200 in `npm run dev`); (2) editor's `tools/editor/vite.config.ts` is reviewed — either accommodates NPC sprites or explicitly skips them with a comment; (3) AGENTS.md "Directory layout" tree is updated to include `assets/npc/<sprite-id>/{idle,walk,static}/`; (4) `.gitignore` is not silently overwritten by the asset copy operation. [US-52]
- [ ] `NpcDefinition` in `src/data/areas/types.ts` has required fields `sprite: string`, `wanderRadius: number`, `awarenessRadius: number` (verified: read the file) [US-52]
- [ ] `NpcDefinition.color` is retained (verified: not removed; used by editor map-overview) [US-52]
- [ ] `src/data/areas/ashen-isle.ts` Old Man npc: `sprite: 'old-man'`, `wanderRadius: 2`, `awarenessRadius: 3` [US-52]
- [ ] `src/data/areas/fog-marsh.ts` Marsh Hermit npc: `sprite: 'marsh-hermit'`, `wanderRadius: 2`, `awarenessRadius: 3` [US-52]
- [ ] NPC sprite registry module exists (e.g. `src/systems/npcSprites.ts`) and exports a registry keyed by sprite id with idle/walk frame counts and static directions [US-52]
- [ ] `src/maps/constants.ts` exports `NPC_SPEED`, `NPC_IDLE_MIN_MS`, `NPC_IDLE_MAX_MS` (named, not literals in system code) [US-53]

### Structural — systems

- [ ] `src/systems/npcBehavior.ts` exists and exports `NpcBehaviorSystem` with `update(delta, playerPos)`, `getLivePositions()`, `enterDialogue(npcId, playerPos)`, `exitDialogue(npcId)` [US-53, US-55]
- [ ] Octant `velocityToDirection` / `vectorToDirection` function is shared between player `AnimationSystem` and NPC behavior (verified: single source — extracted to a shared module like `src/systems/direction.ts`, or `AnimationSystem` exports it for reuse — no duplicate octant table) [US-53]
- [ ] **Refactor consumer audit (Learning #70):** Before extracting the octant function, every site in `src/` that computes a direction from a velocity or position vector (any use of `Math.atan2`, octant tables, or `'north'/'south'/...` direction strings derived from coordinates) is enumerated. Each site either calls the shared function or has an explicit one-line comment justifying a separate implementation. The audited file list is included in the PR description. [US-53]
- [ ] `src/systems/collision.ts` consults NPC live positions when checking player↔NPC collision (verified: source reads from `NpcBehaviorSystem.getLivePositions()` or equivalent live source, NOT from static `npc.col, npc.row`) [US-53]
- [ ] `src/systems/npcInteraction.ts` proximity check uses NPC live positions [US-53]
- [ ] `NpcBehaviorSystem` registers a `scene.events.on('shutdown', ...)` cleanup that clears all per-NPC timers (verified: read source) [US-53]

### Structural — rendering & preload

- [ ] `GameScene.preload()` iterates the NPC sprite registry and loads idle (32 keys), walk (32 keys), static (8 keys) per registered sprite id (verified: read source) [US-52]
- [ ] `GameScene.create()` (or `registerAnimations()`) registers `npc-{spriteId}-{idle,walk}-{8 dirs}` for each registered sprite id at 8 fps `repeat: -1` (verified: read source) [US-52]
- [ ] Static poses are loaded as plain image keys `npc-{spriteId}-static-{dir}` and applied via `setTexture`, NOT registered as 1-frame animations [US-52]
- [ ] `GameScene.renderNpcs()` creates `Phaser.GameObjects.Sprite` per NPC at depth 5; the previous `Phaser.GameObjects.Rectangle` render path is removed (`grep -n 'Rectangle' src/scenes/GameScene.ts | grep -i npc` returns no matches) [US-52]
- [ ] **Phaser API contract:** Each NPC is created as `Phaser.GameObjects.Sprite` (NOT `Image`, NOT `Container`) so that BOTH `play(animKey)` and `setTexture(textureKey)` work on the same instance. Verified by source read AND by a smoke check at scene start that exercises both code paths once on each NPC (initial idle anim plays → forced `setTexture` to a static key → no console error/TypeError). [US-52]
- [ ] `GameScene.update()` calls `npcBehavior.update(delta, playerCenter)` once per frame after `inputSystem.update()` and before `triggerZone.update()` [US-53]

### Behavior — wander (US-53)

- [ ] An NPC in `idle` transitions to `walk` after a dwell time within `[NPC_IDLE_MIN_MS, NPC_IDLE_MAX_MS]` (verified by adding a dev console log and observing the timing across 5+ cycles, OR by a direct unit-style assertion if test infra is available) [US-53]
- [ ] When walking, the NPC moves at `NPC_SPEED` (≈ `PLAYER_SPEED * 0.4`) and never exceeds `NPC_SPEED` in any axis (verified by source read + manual observation that the NPC is visibly slower than the player) [US-53]
- [ ] An NPC's tile position never has Chebyshev distance > `wanderRadius` from its spawn tile during 60 seconds of unattended wandering (verified manually by leaving the player at the spawn corner of each area for 60s and watching) [US-53]
- [ ] An NPC never overlaps a `TileType.WALL` cell with its bounding box (verified: walk every NPC's wander region and visually confirm no wall clipping; debug overlay can help) [US-53]
- [ ] An NPC blocked by a wall on a chosen step picks a different direction within the same frame (verified: place the NPC near a wall corner and observe — it must not get stuck or idle indefinitely against a wall when other directions are open) [US-53]

### Behavior — awareness (US-54)

- [ ] When the player enters Chebyshev tile distance ≤ `awarenessRadius` of an NPC in idle/walk, the NPC halts within one frame and transitions to `aware` state (verified manually; debug overlay shows state if added) [US-54]
- [ ] An NPC in `aware` state does NOT move (position is constant frame-over-frame) [US-54]
- [ ] An NPC in `aware` state continuously updates its `static` texture to face the player as the player walks a circle around it (verified manually for both NPCs) [US-54]
- [ ] An NPC's `static` texture is updated only when quantized facing direction changes, NOT every frame (verified: source reads a `lastStaticDir` guard on `setTexture` calls — Learning EP-01 loop-invariant) [US-54]
- [ ] When the player exits Chebyshev tile distance > `awarenessRadius`, the NPC transitions back to `idle` and resumes wander on the next dwell expiry (verified manually) [US-54]
- [ ] Debug overlay (F3) draws each NPC's awareness radius as a yellow-dashed circle and wander radius as a green-dashed circle in world space at depth 50 (verified visually with F3 toggled) [US-54]

### Behavior — dialogue facing (US-55)

- [ ] On dialogue start (NPC interaction), the NPC's `state` becomes `dialogue`, its sprite swaps to `npc-{spriteId}-static-{dir}` where `dir` is the quantized (player − npc) direction at the moment of interaction (verified: approach Old Man from each of the 8 directions; in each case the dialogue opens with the NPC visibly facing the player) [US-55]
- [ ] During an active dialogue, the NPC's facing texture is NOT updated even if internal state would otherwise change (verified: source has no per-frame `setTexture` while `state === 'dialogue'`) [US-55]
- [ ] On dialogue end, if the player is within `awarenessRadius`, the NPC transitions to `aware`; otherwise to `idle` (verified manually for both transitions) [US-55]
- [ ] `DialogueSystem` exposes an `onEnd` callback (or equivalent observable terminating event) and `GameScene` wires it to `npcBehavior.exitDialogue(npc.id)` [US-55]
- [ ] **Idempotency:** `enterDialogue(npcId, playerPos)` called a second time while the NPC is already in `dialogue` state is a no-op — no facing recompute, no `setTexture`, no state mutation. `exitDialogue(npcId)` called when the NPC is not in `dialogue` state is a no-op (verified by source read of guard clauses at the top of each method). [US-55]
- [ ] **Failure recovery:** If `dialogueSystem.start(...)` throws or returns a falsy result after `enterDialogue` has set state to `'dialogue'`, `GameScene` catches the failure and calls `exitDialogue(npc.id)` so the NPC does not get stuck in `dialogue` with no active dialogue UI (verified by source read; deliberate-throw test if test infra available). [US-55]
- [ ] **Close-cooldown preserved:** The existing 100ms `lastCloseTime` cooldown on `NpcInteractionSystem` (Learning #69 prevention) remains effective after this phase — a tap-close-tap rapid sequence does NOT reopen dialogue, even though `exitDialogue` may transition the NPC to `aware` immediately. Verified by manual rapid tap test on both NPCs. [US-55]

### Variant baseline (per-NPC verification — required by spec rule 4a)

Every behavior criterion below must be verified for **both** NPCs separately. The build-loop's manual-verification doc must list each NPC as a separate checkbox per criterion, not a single "both NPCs work" checkbox.

- [ ] **Marsh Hermit**: renders as 8-direction animated sprite at spawn (US-52); wanders within radius 2 of spawn without wall clipping for 60s (US-53); enters `aware` and faces the player when player is within 3 tiles (US-54); snaps to face-player static pose on dialogue open and holds for the dialogue's full duration (US-55) [US-52, US-53, US-54, US-55]
- [ ] **Old Man**: renders as 8-direction animated sprite at spawn (US-52); wanders within radius 2 of spawn without wall clipping for 60s (US-53); enters `aware` and faces the player when player is within 3 tiles (US-54); snaps to face-player static pose on dialogue open and holds for the dialogue's full duration (US-55) [US-52, US-53, US-54, US-55]

### Behavior — reads-as (required by Visual "reads as" compounded rule)

Each reads-as is paired with an **objective mechanism proxy** so a regression that breaks the underlying mechanism is caught even if the observer test isn't run (per Learning #1 borderline tightening).

- [ ] **Marsh Hermit awareness reads-as:** A first-time observer can describe what happened when the player walks toward the Hermit using a phrase like "they noticed me / stopped to look / turned to watch" — NOT "they froze" or "they lagged". Verified via the manual-verify doc with a short observer note. [US-54]
- [ ] **Marsh Hermit awareness mechanism proxy:** NPC velocity drops to 0 within 1 frame of the player's tile crossing into `awarenessRadius`; NPC `static` texture key changes within 1 frame of the player's quantized direction-from-NPC changing (verified via dev console log instrumentation OR by source read of state-transition + `setTexture` order). [US-54]
- [ ] **Old Man awareness reads-as:** Same observer test, same phrasing target. [US-54]
- [ ] **Old Man awareness mechanism proxy:** Same velocity-halt-within-1-frame and direction-change-within-1-frame assertions. [US-54]
- [ ] **Dialogue facing reads-as:** A first-time observer can describe the dialogue opening as "the NPC turned to talk to me" — NOT "the NPC was already facing that way" or "I couldn't tell if they faced me". Verified for both NPCs via observer note. [US-55]
- [ ] **Dialogue facing mechanism proxy:** On `enterDialogue`, the NPC's `setTexture(npc-{spriteId}-static-{dir})` call fires exactly once before `dialogueSystem.start()` is invoked, with `dir` matching the quantized (player − npc) direction at the moment of interaction (verified by source read of call order + a one-time dev console log on the `setTexture` site). [US-55]

### Aesthetic traceability (Design direction → done-when)

Per the spec rule that every aesthetic claim must trace to at least one done-when criterion:

- [ ] **"Reads as a person who lives here"** (US-53 wander) traces to: NPC visibly moves around its spawn over a 60-second observation window with idle pauses between steps (covered by wander criteria above). [US-53]
- [ ] **"Looks rather than loops"** (US-54 awareness static-vs-idle) traces to: in `aware` state the NPC sprite uses a `static/{dir}.png` texture (no animation playing), distinct from the looping idle frames — verified by source read of state→texture mapping AND by visual side-by-side inspection that static poses are visually distinct from `idle/{dir}/frame_000.png` in both NPCs' asset trees. [US-54]
- [ ] **"Turned to talk to me"** (US-55 snap-and-hold) traces to: dialogue facing mechanism proxy criterion above. [US-55]

### Class baseline (player+NPC animated-sprite shared behavior — required by spec rule 4)

The player already has these behaviors via `AnimationSystem`. Each NPC, joining the same animated-sprite class, must explicitly satisfy each one:

- [ ] NPC sprites use nearest-neighbor filtering (inherited from global `pixelArt: true` in `main.ts` — verified: no per-NPC `setFilter` override that would smooth them) [US-52]
- [ ] NPC sprites render at depth 5 (Entities layer per the depth map) [US-52]
- [ ] NPC sprites use the same 8-direction octant model and direction names (`north`, `north-east`, `east`, `south-east`, `south`, `south-west`, `west`, `north-west`) as the player [US-52, US-53]
- [ ] NPC sprites use the same shared `velocityToDirection` / `vectorToDirection` function as the player (no duplicate octant tables) [US-53]
- [ ] NPC sprites are ignored by the UI camera (`uiCam.ignore(...)`) at scene setup, same way player and tile/prop sprites are [US-52]

### Editor sync

- [ ] Editor's `tools/editor/src/mapRenderer.ts` draws each NPC's wander radius (green-dashed) and awareness radius (yellow-dashed) circles around the spawn tile, in addition to the existing interaction radius (verified: open editor for both areas and inspect) [US-52, US-54]
- [ ] `cd tools/editor && npm run build` succeeds [US-52]

### Error paths

- [ ] If an NPC's `sprite` id is not in the NPC sprite registry, `GameScene` logs a descriptive console error naming the NPC id and missing sprite id; the NPC falls back to the previous coloured-rectangle render path (or skips rendering entirely with a clear log — both acceptable; silent failure is not) [US-52]
- [ ] If an NPC is constructed with `wanderRadius: 0`, the NPC stays on its spawn tile (no wander step is ever picked) but still participates in awareness and dialogue facing (verified by setting wanderRadius=0 on a temporary test config or by source-reading the wander step guard) [US-53]
- [ ] If the player↔NPC collision check is queried during the brief window before `NpcBehaviorSystem.update()` has run for the first time after an area transition, the system returns the spawn position rather than throwing (verified: source reads either lazy-init at construction, or a defensive default) [US-53]

### Invariants

- [ ] `npx tsc --noEmit && npm run build` passes for the main game [phase]
- [ ] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors or warnings during 60 seconds of normal play in either area (player walks around, both NPCs wander, player approaches one NPC, opens dialogue, closes dialogue, walks away) [phase]
- [ ] AGENTS.md "File ownership" table includes a row for `src/systems/npcBehavior.ts` and an updated row for `src/systems/npcInteraction.ts` (live-position consumption) [phase]
- [ ] AGENTS.md "Behavior rules" includes a new rule describing NPC wander/awareness/dialogue states, configurable per-NPC `wanderRadius`/`awarenessRadius`, Chebyshev tile distance, shared octant function, and pre-step path sampling for collision [phase]
- [ ] AGENTS.md "Directory layout" tree reflects `assets/npc/<sprite-id>/{idle,walk,static}/...` and `src/systems/npcBehavior.ts`, `src/systems/direction.ts` (or wherever the shared octant lives) [phase]
- [ ] AGENTS.md "File ownership" row for `scenes/GameScene.ts` updated to mention NPC sprite preload (per registered sprite id), NPC animation registration, NPC behavior system orchestration, NPC live-position propagation to collision/interaction systems [phase]
- [ ] AGENTS.md "Behavior rules" zone-level mutual-exclusion entry is amended to include "NPC awareness state transitions are suppressed during dialogue" so the rule statement matches the implemented behavior (per Learning #9 agents-consistency) [phase]
- [ ] **Deploy verification (Learning #65):** the GitHub Pages deploy workflow succeeds for the squash-merge commit on `main` (green check); any post-merge fixes go through a new PR, not direct-to-main. [phase]
- [ ] **Debug overlay z-order (Learning #57 facet):** when interaction radius (solid yellow), wander radius (dashed green), and awareness radius (dashed yellow) circles all render at depth 50 around the same NPC, render order is documented in `debugOverlay.ts` as a comment (e.g., interaction → wander → awareness, drawn in that order) so visual stacking is deterministic. [US-54]

## Golden principles (phase-relevant)

- **Depth map authority**: NPCs render at depth 5 (Entities) — already in the depth map. Awareness/wander debug circles render at depth 50 (Debug overlay) — already in the depth map. No new depths introduced.
- **Parameterized systems**: `NpcBehaviorSystem` receives the area's NPC list and map via constructor; no global imports. Per-NPC tuning lives on `NpcDefinition`, not in the system module. `NPC_SPEED` and idle-dwell bounds live in `src/maps/constants.ts`.
- **Zone-level mutual exclusion**: When dialogue is active, NPC behavior switches to `dialogue` state and ignores awareness checks — consistent with the existing rule that dialogue suppresses movement, interaction, and trigger evaluation.
- **No silent breaking changes**: `NpcDefinition.color` is retained explicitly (used by the editor's map overview), not silently removed when the new sprite system replaces game-scene rendering.
- **From LEARNINGS EP-01**: Before submitting, check for (a) setup ops that run every loop iteration but only need to run once (NPC animation registration runs once per scene, NOT per frame; static `setTexture` only fires when facing direction *changes*); (b) dead guard conditions (the `lastStaticDir` guard exists specifically to avoid the case where `setTexture` is called every frame with the same input); (c) comments referencing behavior no longer present (e.g. don't leave a comment about `Rectangle`-based NPC rendering after the swap); (d) function names implying a different contract (e.g. `getLivePositions()` must actually return a live snapshot, not the static spawn map).

## AGENTS.md sections affected

When this phase ships, the Phase Reconciliation Gate will update:
- **Directory layout** — add `assets/npc/<sprite-id>/{idle,walk,static}/` subtree, add `src/systems/npcBehavior.ts`, add shared `src/systems/direction.ts` (or document the shared octant location), add `src/systems/npcSprites.ts`
- **File ownership** — new rows for `src/systems/npcBehavior.ts`, `src/systems/npcSprites.ts`, and the shared direction module; updated rows for `scenes/GameScene.ts` (NPC sprite preload, anim registration, behavior system orchestration), `systems/npcInteraction.ts` (live-position consumption), `systems/collision.ts` (live-position consumption), `systems/animation.ts` (octant function extracted/shared), `systems/debugOverlay.ts` (wander + awareness circles), `data/areas/types.ts` (`NpcDefinition.sprite/wanderRadius/awarenessRadius`)
- **Behavior rules** — add NPC wander/idle/aware/dialogue state machine rule, Chebyshev tile distance for wander/awareness checks, pre-step path sampling for wall collision, snap-once dialogue facing, shared octant function with player
- **Controls** — no change (interaction control unchanged)
