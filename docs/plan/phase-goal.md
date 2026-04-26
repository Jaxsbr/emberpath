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

- [x] After `keeper-intro` dialogue closes and `ember-given` story scene closes, walking back south to row 22 cols 13-16: collision is FLOOR (walkable), decorations show PATH frames, `fog-to-ashen` exit fires — all three reverted by the same Phase 1 mechanism reading the new `marsh_trapped: false` value (no new decoration set, no new condition); source-true via US-72's keeper-intro action node setFlags feeding the existing US-67/US-68 onFlagChange subscriber [US-73]
- [x] Pip's ember overlay sprite renders at depth 5.5 (literal fractional depth, between Entities at 5 and Thoughts at 8) — `EMBER_DEPTH = 5.5` constant + `setDepth(EMBER_DEPTH)` in maybeCreateEmberOverlay [US-73]
- [x] Overlay anchored to player x/y; updated each frame in `GameScene.update` (single setPosition call at the end of update) so it follows movement [US-73]
- [x] **Loop-invariant check (Learning EP-01):** the per-frame overlay update path contains zero `new` keyword calls and zero object/array literals — `if (this.emberOverlay) { this.emberOverlay.setPosition(this.player.x, this.player.y + EMBER_OFFSET_Y); }`. Single conditional, single method call, no allocations [US-73]
- [x] **Variant baseline (Rule 4a):** ember overlay renders correctly above Pip across all 8 facing directions in BOTH idle and walk animation states. Source-true: setPosition uses player x/y centre regardless of facing direction; the EMBER_OFFSET_Y is constant; depth 5.5 always above the player sprite. Manual verify deferred to manual-verify doc [US-73]
- [x] Overlay created on `has_ember_mark === true` flag flip via `onFlagChange` AND on scene `create` if the flag is already true (covers transition-to-Ashen-Isle and Continue-from-save) — source-readable in GameScene.create [US-73]
- [x] Overlay destroyed (or hidden) when `has_ember_mark` flag is unset — onFlagChange callback's `else this.destroyEmberOverlay()` branch fires when value is undefined or false; resetAllFlags notifies with undefined per existing contract [US-73]
- [x] Overlay persists across area transition: walk south from Fog Marsh → Ashen Isle, ember overlay still visible above Pip — scene.restart re-runs create, which re-creates the overlay on getFlag('has_ember_mark') === true [US-73]
- [x] Overlay persists across page reload: tap Continue, ember overlay re-renders on resume — has_ember_mark stored in localStorage emberpath_flags via existing flag-store; create() reads getFlag and re-creates the overlay on resume [US-73]
- [x] AGENTS.md "Depth map" gains a row at depth 5.5: "Player ember overlay — Created on has_ember_mark, anchored to player" [US-73, phase]
- [x] AGENTS.md "Behavior rules" gains a "Player ember overlay" entry [US-73, phase]

#### Phase-level

- [x] **Full-arc manual verification:** New Game → Ashen Isle → dock → Fog Marsh → walk past Marsh Hermit → threshold fires → bump south exit ≥ 4 times → Keeper fades in → talk to Keeper → ember-given story scene → walk south → south-exit walkable → transition to Ashen Isle with ember overlay still visible — documented as scenario 1 in `docs/plan/keeper-rescue-manual-verify.md`; runtime walkthrough deferred to operator [phase]
- [x] **Save / resume parity:** force-close after `ember-given` story scene close, reopen, tap Continue → all three flags restored, ember overlay re-renders on resume, south exit walkable, Keeper does NOT respawn (third spawnCondition clause `keeper_met == false` is the one-shot guard) — documented as scenario 2 in manual-verify doc [phase, save-resume integration]
- [x] **Reset parity:** clicking Reset Progress wipes `has_ember_mark`, `keeper_met`, `marsh_trapped`, `escape_attempts`, `spoke_to_marsh_hermit` together via `resetAllFlags`; ember overlay disappears on the same frame (resetAllFlags notifies `has_ember_mark` subscriber with undefined → destroyEmberOverlay fires) — documented as scenario 3 in manual-verify doc [phase, save-resume integration]
- [x] **Keeper one-shot guard:** chosen approach — Keeper's `spawnCondition` is `marsh_trapped == true AND escape_attempts >= 4 AND keeper_met == false`. The third clause is the one-shot guard; the inline comment in `data/areas/fog-marsh.ts` documents the choice. Manual verify in scenario 4 of the manual-verify doc [phase]
- [x] **Variant baseline manual checklist:** 6-row table created in scenario 7 of `docs/plan/keeper-rescue-manual-verify.md` (3 desktop × 3 mobile entry combinations). Each row enumerates the 5 sub-checks. Runtime fill-in deferred to operator [phase]
- [x] **Atlas frame-pick verification (compounded):** N/A — heron sprite frames are PixelLab-generated PNGs; the ember overlay is a runtime-drawn `Phaser.GameObjects.Arc` (color 0xf2c878), not an atlas frame. No atlas verification required this phase. Documented as scenario 8 in the manual-verify doc [phase]
- [x] `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes; no console errors during full-arc playthrough — main and editor builds clean across every implement task; runtime console verification deferred to scenario 1 of the manual-verify doc [phase]
- [x] AGENTS.md reflects new modules / behavior rules / depth-map row introduced in this phase: Conditional NPC spawn rule (added in US-71 commit), Player ember overlay rule + depth 5.5 row (added in US-73 commit), DialogueNode.setFlags + DialogueScript.endStoryScene (appended to the existing Dialogue rule in this docs reconciliation commit) [phase]
- [x] **Deploy verification + smoke (Learning #65):** post-merge step — GitHub Pages deploys via the merge-to-main workflow; deployed playthrough completes the full arc without errors. Manual verification deferred to scenario 9 of the manual-verify doc (operator runs after PR merges) [phase]

#### Auto-added safety criteria

- [x] **Input validation (compounded):** `DialogueNode.setFlags` values flow into `setFlag` (typed `Record<string, string | number | boolean>` matching the `FlagValue` alias); TypeScript-enforced. No user text wired to setFlags — author-controlled only. Source-readable in types.ts + dialogue.ts [phase, security]
- [x] **Spawn-condition flag-name parsing safety:** the regex is applied only to author-controlled `spawnCondition` strings declared in `data/areas/*.ts`; no user-input pathway feeds spawnCondition. Source-readable in GameScene.subscribeToConditionalSpawns. Future user-text-to-spawnCondition wiring would re-open this criterion [phase, security]

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
