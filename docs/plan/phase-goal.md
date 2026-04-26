# Phase: keeper-rescue

## Phase goal

Rescue Pip from the Fog Marsh dead-end. After `fog-marsh-dead-end` lands the player at "I cannot do this alone" (`marsh_trapped: true`, `escape_attempts >= 4`), the Keeper — a luminous white heron, the master-prd.md allegorical Holy Spirit — appears in the marsh, gives Pip the Ember Mark in a story scene, and re-opens the path back to Ashen Isle. This phase closes beat 2 of the gospel arc with the player having received grace they could not earn or find.

### Dependencies

- fog-marsh-dead-end (must be archived — supplies `marsh_trapped` and `escape_attempts` flags and the conditional collision/decoration mechanism this phase reverses)

### Stories in scope

- US-70 — Heron sprite + portrait + registry entries (assets-on-disk)
- US-71 — Keeper spawns when `marsh_trapped == true AND escape_attempts >= 4`
- US-72 — Keeper rescue dialogue + ember-given story scene + flag flips
- US-73 — Path re-opens; Pip carries the ember mark

### Done-when (observable)

#### US-70 — Heron assets + registry

- [x] `assets/npc/heron/{idle,walk,static,portrait.png,prompt.md}` exists in repo with the expected file counts (idle: 32, walk: 32, static: 8, portrait: 1, prompt.md: 1) [US-70]
- [x] `NPC_SPRITES['heron'] = { idleFrameCount: 4, walkFrameCount: 4 }` registered; `hasNpcSprite('heron')` returns true [US-70]
- [x] `NPC_PORTRAITS['heron'] = { file: 'portrait.png', filter: 'linear' }` registered; `hasNpcPortrait('heron')` returns true [US-70]
- [x] `npx tsc --noEmit && npm run build` passes [US-70]
- [x] Production bundle `dist/npc/heron/` includes idle, walk, static, portrait.png (verify via `find dist/npc/heron -type f | wc -l` — actual 74; spec drift: Vite `publicDir: 'assets'` copies to dist/ root, not dist/assets) [US-70]

#### US-71 — Conditional spawn + generalised flag-change subscriber

- [x] `NpcDefinition.spawnCondition?: string` added to `data/areas/types.ts`; existing NPCs without this field compile + spawn unchanged [US-71]
- [x] `GameScene.renderNpcs` (or equivalent gate) skips NPCs whose `spawnCondition` evaluates false at area-load time — verified by direct-load Fog Marsh on a fresh save: Keeper has no sprite, no NpcBehavior entry, no NpcInteraction entry [US-71]
- [x] GameScene parses every NPC's `spawnCondition` for flag names (regex: `/\b([a-z_][a-z0-9_]*)\s*(==|!=|>=|>|<=|<)/gi`) and calls `onFlagChange(flagName, ...)` for each unique name; unsubscribes collected and invoked in `cleanupResize` [US-71]
- [x] Keeper appears in Fog Marsh at `(14, 8)` exactly when `marsh_trapped == true AND escape_attempts >= 4 AND keeper_met == false` (third clause is the one-shot guard — phase-level criterion folded into the spawnCondition; manual verify deferred to manual-verify doc) [US-71]
- [x] Spawn fade is a 500ms alpha 0 → 1 tween via `this.tweens.add({ targets: keeperSprite, alpha: { from: 0, to: 1 }, duration: 500 })`; player input suspended for the duration of the fade and resumes ≤ 1000ms after spawn [US-71]
- [x] **Variant baseline (Rule 4a):** Marsh Hermit (no `spawnCondition`) still spawns unconditionally on Fog Marsh load and continues to wander + be interactable after Keeper spawn; Old Man (no `spawnCondition`) still spawns unconditionally on Ashen Isle load [US-71]
- [x] **Phase 1 regression:** the pre-existing hardcoded `onFlagChange('marsh_trapped', ...)` collision-flip + decoration-swap subscriber still fires on the threshold trigger; not regressed by the additive subscription [US-71]
- [x] **Class baseline check (Rule 4 — Learning #59):** Keeper inherits all shared NPC behaviors. Verified post-spawn: (a) `npc-heron-idle-south` animation at 8 fps (registered via shared registerAnimations loop in GameScene); (b) does NOT wander (`wanderRadius: 0` clamps the Chebyshev step); (c) turns to face player when player enters `awarenessRadius: 2` (shared `lastStaticDir` guard in NpcBehaviorSystem); (d) NPC interaction prompt raises via shared NpcInteractionSystem; (e) enters dialogue state on interaction (shared `enterDialogue` in NpcBehaviorSystem); (f) portrait renders with `linear` filter (NPC_PORTRAITS['heron'] from US-70); (g) bounding box collides via the shared moveWithCollision NPC pass once registerNpc puts the runtime into livePositions. Source-readable; manual-verify doc covers the runtime walkthrough [US-71]
- [x] **Idempotency guard (Learning #63):** `evaluateConditionalSpawns()` is safely re-entrant. Guard via "if NPC.id already in `npcSpritesById`, skip" before the spawn render path. Verified by setting two relevant flags in the same dialogue node — Keeper spawns exactly once [US-71]
- [x] **Error path (Learning #10):** an `NpcDefinition` with a malformed `spawnCondition` (e.g., `"marsh_trapped &&"` or `"unknown_op ?? true"`) does not crash GameScene; `evaluateCondition` returns false on parse failure (existing Phase 1 behavior, regression check via systems/conditions.ts:18 fallthrough), the NPC stays unspawned, no console error storm [US-71]
- [x] AGENTS.md "Behavior rules" gains a "Conditional NPC spawn" entry [US-71, phase]
- [x] **Named constants (Learning #6 facet):** `KEEPER_FADE_DURATION_MS = 500` and `KEEPER_INPUT_SUSPEND_MS = 1000` declared as named constants at the top of `GameScene.ts` (mirrors `FADE_DURATION = 400`, `SAVE_THROTTLE_MS = 1000`); not inlined as magic numbers in the tween call [US-71]

#### US-72 — Dialogue + flag side-effects + story scene chain

- [x] `DialogueNode.setFlags?: Record<string, string | number | boolean>` added to `data/areas/types.ts` [US-72]
- [x] `DialogueSystem` fires `setFlag(k, v)` for every entry in `node.setFlags` when a node is shown, BEFORE the typewriter starts; source-readable in showNode (top of method, before clearChoices/redrawBox/typewriter) [US-72]
- [x] `DialogueScript.endStoryScene?: string` added to `data/areas/types.ts` [US-72]
- [x] `GameScene.dialogueSystem.setOnEnd` callback launches `endStoryScene` (when present) AFTER `flushSave` — verified by reading the order in `GameScene.create` (flushSave -> getEndStoryScene -> launchStoryScene) [US-72]
- [x] `keeper-intro` dialogue script on `fog-marsh.ts`: `portraitId: 'heron'`, `endStoryScene: 'ember-given'`, two nodes (greeting → action), action node has `setFlags: { has_ember_mark: true, keeper_met: true, marsh_trapped: false }` [US-72]
- [x] `ember-given` story scene on `fog-marsh.ts` with 3 beats. imageColors: beat 1 `0xd9a657` (warm gold), beat 2 `0xf2c878` (brighter ember), beat 3 `0xe8d8b8` (pale dawn). Labels: 'The Keeper draws near' / 'The ember passes' / 'The fog parts' [US-72]
- [x] **Error path (Learning #10):** if `endStoryScene` references an id not present in `area.storyScenes`, the existing `launchStoryScene` error path fires (`console.error('Story scene definition not found: ...')` at GameScene.ts:636) and GameScene resumes normally — no crash, no orphaned state [US-72]
- [x] **Existing-script regression (Rule 4a):** Marsh Hermit dialogue (uses `DialogueChoice.setFlags`) continues to set `spoke_to_marsh_hermit: true` on greeting choice; Old Man dialogue (no setFlags) closes without flag changes — paths preserved (no edits to existing scripts) [US-72]
- [x] **Existing-script regression:** All dialogue scripts WITHOUT `endStoryScene` close via the existing `exitDialogue + flushSave` path with NO story scene launch — getEndStoryScene returns null when no script declared it; the `if (endStoryScene)` guard skips launchStoryScene for Old Man, Marsh Hermit, Whispering Stones [US-72]

#### US-73 — Path re-opens via flag flip + ember overlay

- [ ] After `keeper-intro` dialogue closes and `ember-given` story scene closes, walking back south to row 22 cols 13-16: collision is FLOOR (walkable), decorations show PATH frames, `fog-to-ashen` exit fires — all three reverted by the same Phase 1 mechanism reading the new `marsh_trapped: false` value (no new decoration set, no new condition) [US-73]
- [ ] Pip's ember overlay sprite renders at depth 5.5 (literal fractional depth, between Entities at 5 and Thoughts at 8) — verified by reading `setDepth(5.5)` in `GameScene` [US-73]
- [ ] Overlay anchored to player x/y; updated each frame in `GameScene.update` so it follows movement [US-73]
- [ ] **Loop-invariant check (Learning EP-01):** the per-frame overlay update path contains zero `new` keyword calls and zero object/array literals — only `setPosition(this.player.x, this.player.y - OFFSET)` (or equivalent). Verified by `grep -n "new \|{.*:" GameScene.ts` within the overlay update block [US-73]
- [ ] **Variant baseline (Rule 4a):** ember overlay renders correctly above Pip across all 8 facing directions in BOTH idle and walk animation states. Manual verify: walk Pip in each direction post-rescue, confirm overlay tracks the head position in every animation frame (no z-fighting, no offset jitter) [US-73]
- [ ] Overlay created on `has_ember_mark === true` flag flip via `onFlagChange` AND on scene `create` if the flag is already true (covers transition-to-Ashen-Isle and Continue-from-save) [US-73]
- [ ] Overlay destroyed (or hidden) when `has_ember_mark` flag is unset — fires on Reset Progress (the existing `resetAllFlags` notifies subscribers with `undefined`) [US-73]
- [ ] Overlay persists across area transition: walk south from Fog Marsh → Ashen Isle, ember overlay still visible above Pip [US-73]
- [ ] Overlay persists across page reload: tap Continue, ember overlay re-renders on resume [US-73]
- [ ] AGENTS.md "Depth map" gains a row at depth 5.5: "Player ember overlay — Created on has_ember_mark, anchored to player" [US-73, phase]
- [ ] AGENTS.md "Behavior rules" gains a "Player ember overlay" entry [US-73, phase]

#### Phase-level

- [ ] **Full-arc manual verification:** New Game → Ashen Isle → dock → Fog Marsh → walk past Marsh Hermit → threshold fires → bump south exit ≥ 4 times → Keeper fades in → talk to Keeper → ember-given story scene → walk south → south-exit walkable → transition to Ashen Isle with ember overlay still visible [phase]
- [ ] **Save / resume parity:** force-close after `ember-given` story scene close, reopen, tap Continue → `has_ember_mark: true` AND `marsh_trapped: false` AND `keeper_met: true` restored, ember overlay re-renders on resume, south exit walkable from a Fog Marsh resume, Keeper does NOT respawn (gated by `keeper_met` — add `spawnCondition` second clause OR check in spawn pass that NPC.id is not already in scene state) [phase, save-resume integration]
- [ ] **Reset parity:** clicking Reset Progress wipes `has_ember_mark`, `keeper_met`, `marsh_trapped`, `escape_attempts`, `spoke_to_marsh_hermit` together via `resetAllFlags`; ember overlay disappears on the same frame [phase, save-resume integration]
- [ ] **Keeper one-shot guard:** after rescue, walking back into Fog Marsh from Ashen Isle does NOT respawn the Keeper. Either the Keeper's `spawnCondition` is extended to `marsh_trapped == true AND escape_attempts >= 4 AND keeper_met == false`, OR the spawn pass tracks already-spawned NPC ids — author choice; document in code [phase]
- [ ] **Variant baseline manual checklist:** open `docs/plan/keeper-rescue-manual-verify.md`, walk through one row per surface — desktop fresh New Game, desktop Continue mid-Fog-Marsh, desktop Continue post-rescue, mobile fresh New Game, mobile Continue mid-Fog-Marsh, mobile Continue post-rescue. Each row checks: Keeper spawn fires correctly, dialogue + portrait render, story scene fires, ember overlay renders, south exit re-opens [phase]
- [ ] **Atlas frame-pick verification (compounded):** Heron sprite frames are PixelLab-generated PNGs (not atlas-indexed), so the labeled-atlas verification step does NOT apply to the sprite. The ember overlay reuses an existing atlas frame OR is a tiny new PNG — IF a new atlas frame is used, run `python3 tools/atlas-preview.py assets/tilesets/<id>/tilemap.png /tmp/preview.png && open /tmp/preview.png` and visually verify the chosen frame BEFORE commit. IF a new PNG asset is used, no atlas check is required [phase]
- [ ] `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes; no console errors during full-arc playthrough [phase]
- [ ] AGENTS.md reflects new modules / behavior rules / depth-map row introduced in this phase (Conditional NPC spawn, Player ember overlay, depth 5.5 row, DialogueNode.setFlags, DialogueScript.endStoryScene) [phase]
- [ ] **Deploy verification + smoke (Learning #65):** GitHub Pages deploys; deployed playthrough completes the full arc without errors [phase]

#### Auto-added safety criteria

- [ ] **Input validation (compounded):** `DialogueNode.setFlags` values flow into `setFlag` which writes to localStorage. The flag store accepts only `string | number | boolean` (TypeScript-enforced via the `FlagValue` type alias). No additional sanitisation needed because the values are author-controlled (no user text input is wired to setFlags) [phase, security]
- [ ] **Spawn-condition flag-name parsing safety:** the regex `/\b([a-z_][a-z0-9_]*)\s*(==|!=|>=|>|<=|<)/gi` is applied to author-controlled `spawnCondition` strings only (no user input). If a future story wires user-text to spawnCondition, this criterion must be revisited [phase, security]

### Golden principles (phase-relevant)

- **Loop-invariant EP-01 (no per-frame allocations):** The ember overlay update in `GameScene.update` must call `setPosition(...)` only — zero `new`, zero literals. The conditional-spawn subscriber API fires per flag-change, never per-frame.
- **Conditional exits and decorations:** Both gated through `systems/conditions.ts:evaluateCondition` — same parser, same flag store, no parallel logic. Re-evaluated only when a referenced flag actually changes via the existing `onFlagChange` subscriber pattern. **No scene restart** on flag flip — collision/decoration/spawn updates apply on the same frame as the trigger or dialogue node fires.
- **Trigger flag side-effects (parity):** Existing `TriggerDefinition.setFlags`/`incrementFlags` ordering is preserved. The new `DialogueNode.setFlags` mirrors `DialogueChoice.setFlags` shape and fires BEFORE the typewriter starts so a downstream `onFlagChange` subscriber sees the new value within the same call stack as `showNode`.
- **Save / resume (atomic flush order):** `flushSave()` runs BEFORE the story-scene launch in the dialogue `setOnEnd` callback so a tab-close mid-story-scene resumes with the rescue committed. URL-param resets and Continue precedence rules unchanged.
- **Zone-level mutual exclusion (LEARNINGS #56):** Keeper spawn fade suspends player input the same way transitions and dialogue do. No movement, NPC interaction, trigger evaluation, or NPC awareness updates fire while the fade is in flight.
- **NPC sprite rendering (registry-driven):** Adding the Keeper is a registry entry (`NPC_SPRITES`/`NPC_PORTRAITS`) plus an `AreaDefinition.npcs` row — no GameScene code edit for the sprite/portrait pipeline. Unknown sprite/portrait id falls back with a descriptive console error.
- **Dialogue (portrait + node graph):** `portraitId: 'heron'` on `keeper-intro` reuses the existing portrait pipeline (linear filter via `NPC_PORTRAITS`). Texture-swap on portrait change only — no per-frame work.
- **Quality checks (project-defined):** `no-silent-pass`, `no-bare-except`, `error-path-coverage`, `agents-consistency`. The `evaluateCondition` parse-failure path returns false silently by design; new error paths (malformed spawnCondition, missing storyScene id) must be observable (`console.error`) and recoverable (no crash).
- **Investigate-first mandate (server/schema/cross-cutting phases):** This phase modifies `data/areas/types.ts` schema, `GameScene.ts` lifecycle, and `systems/dialogue.ts` showNode. Every implement task MUST be preceded by an investigate task that confirms current source structure and queues the specific implement.
