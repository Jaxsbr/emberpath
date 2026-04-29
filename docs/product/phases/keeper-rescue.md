# Phase: keeper-rescue

Status: shipped

> **Refinement pass — 2026-04-26.** This spec was originally drafted alongside `fog-marsh-dead-end`. After Phase 1 shipped, the actual implementation was diffed against the draft and four drifts were reconciled: (1) `evaluateCondition` supports `AND` only — it does NOT support `&&`, `||`, or `OR`, so condition strings now use `AND` and the `OR`'d exit/decoration patterns are replaced by a flag flip; (2) the Keeper sprite + portrait already exist on disk at `~/Jaxs/assets/emberpath/npc/heron/`, so US-70 is asset-copy + registry edits, not a PixelLab generation; (3) the Keeper's final dialogue node needs to set flags AND launch a story scene — neither is wired today, so US-72 adds two small additive type-system fields (`DialogueNode.setFlags`, `DialogueScript.endStoryScene`); (4) the Phase 1 flag-change subscriber is hardcoded to `marsh_trapped` — US-71 generalises it so the spawn-condition watcher subscribes to every flag named in any NPC's `spawnCondition`. Story IDs (US-70 through US-73) confirmed unclaimed by interim phases.

## Phase goal

Rescue Pip from the Fog Marsh dead-end. After `fog-marsh-dead-end` lands the player at "I cannot do this alone" (`marsh_trapped: true`, `escape_attempts >= 4`), the Keeper — a luminous white heron, the master-prd.md allegorical Holy Spirit — appears in the marsh, gives Pip the Ember Mark in a story scene, and re-opens the path back to Ashen Isle. This phase closes beat 2 of the gospel arc with the player having received grace they could not earn or find.

## Design direction

**Light breaks in.** The Keeper is the first visually warm element to enter the desaturated marsh.

- **Keeper appears, doesn't ask permission.** The spawn condition fires the appearance; the player has no menu choice. Grace is given (master-prd.md: "the ember mark is given, not earned").
- **One conversation, one story scene, one new flag.** No dialogue branches, no skill checks, no inventory. Tap to advance (master-prd.md: "Action over explanation").
- **Ember Mark is visible.** After the story scene, Pip's sprite carries a subtle warm-light overlay (small ember above his head, or a tinted glow). The player sees they've changed.
- **Path re-opens by undoing the trap.** Rather than introducing a third decoration state or `OR` parser, the Keeper rescue **flips `marsh_trapped: false` as part of the same flag write that grants the ember.** All three Phase 1 effects (collision flip, decoration swap, exit gate) reverse using the same single-flag mechanism, in reverse — same vocabulary, same mechanism.

The build-loop's `frontend-design` skill does NOT apply — this phase introduces no UI.

## Stories

### US-70 — Heron sprite + portrait + registry entries (assets-on-disk) [Shipped]

The Keeper sprite + portrait already exist at `/Users/jacobusbrink/Jaxs/assets/emberpath/npc/heron/` (PixelLab-generated white-heron sage in hooded cloak, watercolor storybook palette). This story copies them into the project's asset tree and adds registry entries; it does not generate any new art.

**Naming reconciliation.** Existing convention is `npc.id == npc.sprite == asset folder`. Here we split: sprite id and asset folder are `heron` (matches the source folder, no rename); the in-game NPC id is `keeper` (narrative); the dialogue script id is `keeper-intro` (matches the `${npc.id}-intro` lookup in `NpcInteractionSystem`).

**Acceptance criteria:**
- Asset copy: `cp -R ~/Jaxs/assets/emberpath/npc/heron/{idle,walk,static,portrait.png,prompt.md} <repo>/assets/npc/heron/`. Resulting tree mirrors the existing NPC layout (idle: 8 dirs × 4 frames = 32 PNGs; walk: 8 dirs × 4 frames = 32 PNGs; static: 8 single-frame PNGs; portrait.png at folder root).
- `NPC_SPRITES` registry entry: `'heron': { idleFrameCount: 4, walkFrameCount: 4 }` in `src/systems/npcSprites.ts`.
- `NPC_PORTRAITS` registry entry: `'heron': { file: 'portrait.png', filter: 'linear' }` in `src/systems/npcSprites.ts`. The `linear` filter matches the Old Man's painterly portrait — the Keeper is allegorically "other," not a same-grade pixel-art neighbour.
- `npx tsc --noEmit && npm run build` passes; the `dist/assets/npc/heron/` folder appears in the production bundle.

**Out of scope (assets shipped but not used):** The source folder also contains a `fireball/` set (8 dirs × 6 frames). The current `NpcSpriteDefinition` schema only supports `idleFrameCount` and `walkFrameCount`. The fireball frames are not loaded or registered in this phase — they remain available on disk for a future phase that extends the schema (e.g., a "blessing" animation during the ember-given story scene).

### US-71 — Keeper spawns when `marsh_trapped == true AND escape_attempts >= 4` [Shipped]

The Keeper NPC spawns at a specific tile in Fog Marsh (proposed: `(col 14, row 8)` — on the path between the threshold at row 5 and the hermit at row 10, visible from south). Mechanism: `NpcDefinition` gains an optional `spawnCondition?: string`. GameScene's NPC pass filters on this condition at area load AND on flag-change. The flag-change subscriber is **generalised** — the prior Phase 1 hardcoded subscription to `marsh_trapped` is extended so GameScene parses every NPC's `spawnCondition` for flag names and subscribes to each via `onFlagChange`. When any spawn-relevant flag flips, the spawn pass re-evaluates and any newly-eligible NPC fades into the scene (alpha 0 → 1 over 0.5s).

**Acceptance criteria:**
- `NpcDefinition.spawnCondition?: string` added to `data/areas/types.ts`.
- GameScene's NPC creation pass filters NPCs on `spawnCondition` (using `evaluateCondition`) at area load — NPCs whose condition evaluates false are not added to the scene at all (no sprite, no NpcBehavior entry, no NpcInteraction entry).
- A new `private spawnConditionUnsubscribes: (() => void)[]` collection is wired in `GameScene.create`. For each NPC with a `spawnCondition`, GameScene parses out flag names (regex: `/\b([a-z_][a-z0-9_]*)\s*(==|!=|>=|>|<=|<)/gi`) and calls `onFlagChange(flagName, () => this.evaluateConditionalSpawns())` for each unique name. Unsubscribes are collected and invoked in `cleanupResize`.
- `evaluateConditionalSpawns()` walks the conditional-NPC list once and, for any NPC whose condition is now true and is not yet in the scene, runs the spawn render path (sprite, behavior entry, interaction entry, animations) and tweens alpha 0 → 1 over 500ms via `this.tweens.add({...})`. Existing in-scene NPCs are not duplicated.
- Player input is suspended during the fade — `transitionInProgress`-equivalent guard or a dedicated `spawnInProgress` flag, whichever is smallest; player input resumes within 1000ms of the fade start.
- Keeper NPC entry on `fog-marsh.ts`: `{ id: 'keeper', name: 'The Keeper', col: 14, row: 8, color: 0xfff5d6, sprite: 'heron', wanderRadius: 0, awarenessRadius: 2, spawnCondition: 'marsh_trapped == true AND escape_attempts >= 4' }`. (Note: `&&` is NOT a valid join — only literal `AND` is parsed by `evaluateCondition`.)
- **Variant baseline (compounded — Rule 4a):** Marsh Hermit and Old Man spawn unconditionally on area load (regression check — they have no `spawnCondition`). After Keeper spawn, Marsh Hermit still wanders and is interactable.
- The pre-existing hardcoded `onFlagChange('marsh_trapped', ...)` for collision + decoration flip in `GameScene.create` is preserved — the new generalised subscription is additive, not a replacement.

**Behavior rule update (AGENTS.md):** "Conditional NPC spawn — `NpcDefinition.spawnCondition` gates initial render and post-load spawn-on-flag-change. GameScene parses each spawn condition for flag names, subscribes per-flag, re-evaluates on change, and fades the sprite in over 500ms."

### US-72 — Keeper rescue dialogue + ember-given story scene + flag flips [Shipped]

Walk up to the Keeper; one-shot dialogue (`keeper-intro`):
- Greeting: "You walked deeper than the path. Most do not."
- Action: "You cannot find the way. I am the way. Take this — and follow."

The dialogue's terminal node sets `has_ember_mark: true`, `keeper_met: true`, and `marsh_trapped: false` (the rescue undoes the trap state — see Design direction). Dialogue close then launches the `ember-given` story scene (2-3 beats: warm-toned imagery showing the Keeper touching Pip's forehead, the ember spark passing, the marsh fog briefly parting).

**Mechanism gap fixed in this phase.** Today, `DialogueNode` cannot set flags (only `DialogueChoice` can), and `DialogueScript` cannot launch a story scene on close. Two small additive type-system additions wire the Keeper's terminal node to do both:

**Acceptance criteria:**
- `DialogueNode.setFlags?: Record<string, string | number | boolean>` added to `data/areas/types.ts` (mirrors `DialogueChoice.setFlags`).
- `DialogueSystem.showNode()` (or equivalent) iterates `node.setFlags ?? {}` calling `setFlag(key, value)` for each entry — fires on node display, parallel to `TriggerZoneSystem`'s pattern. Order: setFlags BEFORE the typewriter starts so an immediate flag-change subscriber sees the new value.
- `DialogueScript.endStoryScene?: string` added to `data/areas/types.ts`.
- `DialogueSystem` exposes `getEndStoryScene(): string | undefined` (reads the active script's field) OR passes the field as an argument to the `onEnd` callback. `GameScene.dialogueSystem.setOnEnd` callback in `GameScene.create` calls `this.launchStoryScene(endStoryScene)` when present, AFTER `flushSave()` so the world state is checkpointed before the story scene pauses GameScene.
- New dialogue script `keeper-intro` on `fog-marsh.ts` with `portraitId: 'heron'` and `endStoryScene: 'ember-given'`. Two nodes: greeting → action. The action node has `setFlags: { has_ember_mark: true, keeper_met: true, marsh_trapped: false }`.
- New story scene `ember-given` on `fog-marsh.ts` with 2-3 warm-toned beats. Beat 1: Keeper approaching Pip (imageColor warm gold ~`0xd9a657`, imageLabel "The Keeper draws near"). Beat 2: ember passing (imageColor brighter warm ~`0xf2c878`, imageLabel "The ember passes"). Beat 3 (optional): fog parting (imageColor pale ~`0xe8d8b8`, imageLabel "The fog parts").
- **Existing-NPC regression:** Marsh Hermit dialogue (which uses `DialogueChoice.setFlags`, not the new `DialogueNode.setFlags`) continues to set `spoke_to_marsh_hermit: true` on each greeting choice. The Old Man's dialogue (no setFlags anywhere) is unchanged.
- **Existing-script regression:** All dialogue scripts WITHOUT `endStoryScene` close as before — `setOnEnd` callback runs only the existing `exitDialogue + flushSave` path, no story scene launches.

### US-73 — Path re-opens; Pip carries the ember mark [Shipped]

Because US-72 sets `marsh_trapped: false` in the same atomic flag write that grants the ember, the existing Phase 1 mechanism reverses everything else for free:
- `applyMarshTrappedState` (Phase 1) flips collision back to FLOOR on row 22 cols 13-16 — same callback, inverse predicate.
- The conditional decoration set with `condition: 'marsh_trapped == false'` re-shows PATH frames; the `marsh_trapped == true` set hides — same `updateConditionalDecorations` pass.
- The exit `condition: 'marsh_trapped == false'` re-fires — no exit-condition change needed.

This story is therefore **only** about the visible ember overlay on Pip's sprite. No new decoration set. No exit-condition extension. No three-state model. No `OR` parser work.

**Acceptance criteria:**
- Ember overlay sprite: a small warm-light texture (existing tileset frame OR a new tiny PNG asset — author choice; document in code comment) created in `GameScene` when `getFlag('has_ember_mark') === true`, anchored to player x/y, updated each frame in `update()` to follow the player.
- Overlay rendered at depth 5.5 (between Entities at 5 and Thoughts at 8). Use `setDepth(5.5)` literally — Phaser accepts fractional depths.
- A flag-change subscriber on `has_ember_mark` toggles overlay visibility — created when the flag flips true; destroyed (or hidden) on Reset Progress when the flag flips back to undefined.
- Overlay persists across area transitions: `GameScene.create` creates the overlay if `getFlag('has_ember_mark') === true` at scene start (so a transition to Ashen Isle after the rescue still shows the ember).
- Overlay persists across page reloads via `has_ember_mark` flag in localStorage `emberpath_flags` (no new persistence layer — the existing flag store covers it).
- AGENTS.md "Depth map" gains a new row at depth 5.5 for "Player ember overlay" between Entities (5) and Thoughts (8).
- AGENTS.md "Behavior rules" gains a "Player ember overlay" entry: "Created when `has_ember_mark === true` (US-73). Anchored to player x/y, updated each frame in GameScene.update. Visibility tracks the flag via `onFlagChange`. Persists across area transitions and page reloads."

## Done-when

### US-70 (heron assets + registry)
- [ ] `assets/npc/heron/{idle,walk,static,portrait.png,prompt.md}` exists in repo with the expected file counts (idle: 32, walk: 32, static: 8, portrait: 1, prompt.md: 1) [US-70]
- [ ] `NPC_SPRITES['heron'] = { idleFrameCount: 4, walkFrameCount: 4 }` registered; `hasNpcSprite('heron')` returns true [US-70]
- [ ] `NPC_PORTRAITS['heron'] = { file: 'portrait.png', filter: 'linear' }` registered; `hasNpcPortrait('heron')` returns true [US-70]
- [ ] `npx tsc --noEmit && npm run build` passes [US-70]
- [ ] Production bundle `dist/assets/npc/heron/` includes idle, walk, static, portrait.png (verify via `find dist/assets/npc/heron -type f | wc -l` — expected ≥ 73) [US-70]

### US-71 (conditional spawn + generalised flag-change subscriber)
- [ ] `NpcDefinition.spawnCondition?: string` added to `data/areas/types.ts`; existing NPCs without this field compile + spawn unchanged [US-71]
- [ ] `GameScene.renderNpcs` (or equivalent gate) skips NPCs whose `spawnCondition` evaluates false at area-load time — verified by direct-load Fog Marsh on a fresh save: Keeper has no sprite, no NpcBehavior entry, no NpcInteraction entry [US-71]
- [ ] GameScene parses every NPC's `spawnCondition` for flag names (regex: `/\b([a-z_][a-z0-9_]*)\s*(==|!=|>=|>|<=|<)/gi`) and calls `onFlagChange(flagName, ...)` for each unique name; unsubscribes collected and invoked in `cleanupResize` [US-71]
- [ ] Keeper appears in Fog Marsh at `(14, 8)` exactly when `marsh_trapped == true AND escape_attempts >= 4` (manual verify: walk past threshold → escape_attempts increments via 4 bumps → Keeper fades in within one frame of the 4th bump) [US-71]
- [ ] Spawn fade is a 500ms alpha 0 → 1 tween via `this.tweens.add({ targets: keeperSprite, alpha: { from: 0, to: 1 }, duration: 500 })`; player input suspended for the duration of the fade and resumes ≤ 1000ms after spawn [US-71]
- [ ] **Variant baseline (Rule 4a):** Marsh Hermit (no `spawnCondition`) still spawns unconditionally on Fog Marsh load and continues to wander + be interactable after Keeper spawn; Old Man (no `spawnCondition`) still spawns unconditionally on Ashen Isle load [US-71]
- [ ] **Phase 1 regression:** the pre-existing hardcoded `onFlagChange('marsh_trapped', ...)` collision-flip + decoration-swap subscriber still fires on the threshold trigger; not regressed by the additive subscription [US-71]
- [ ] **Class baseline check (Rule 4 — Learning #59):** Keeper inherits all shared NPC behaviors from existing instances (Marsh Hermit, Old Man). Verified by direct observation post-spawn: (a) Keeper renders `npc-heron-idle-south` animation at 8 fps on initial spawn — same animation pipeline as other NPCs; (b) Keeper does NOT wander (`wanderRadius: 0` — `NpcBehaviorSystem` Chebyshev clamp produces no movement); (c) Keeper turns to face player when player enters `awarenessRadius: 2` — same `lastStaticDir` guard as other NPCs; (d) walking up to the Keeper raises the standard NPC interaction prompt (depth 150); (e) the Keeper enters dialogue state (`enterDialogue` → snap-to-face → animation stop → static texture) on interaction; (f) the Keeper's portrait renders with `linear` filter on dialogue open (matches Old Man, distinct from Marsh Hermit's nearest filter); (g) Keeper bounding box collides with player movement (player cannot walk through Keeper) [US-71]
- [ ] **Idempotency guard (Learning #63):** `evaluateConditionalSpawns()` is callable multiple times from the per-flag subscribers (multiple subscribed flags can change in a single frame). Re-entry must be safe — guard via "if NPC.id already in `npcSpritesById`, skip" before the spawn render path. Verified by setting two relevant flags in the same dialogue node — the Keeper spawns exactly once [US-71]
- [ ] **Error path (Learning #10):** an `NpcDefinition` with a malformed `spawnCondition` (e.g., `"marsh_trapped &&"` or `"unknown_op ?? true"`) does not crash GameScene; `evaluateCondition` returns false on parse failure (existing Phase 1 behavior, regression check), the NPC stays unspawned, no console error storm. Verified by adding a temporary throwaway NPC with a bad condition during dev — area loads cleanly [US-71]
- [ ] AGENTS.md "Behavior rules" gains a "Conditional NPC spawn" entry [US-71, phase]
- [ ] **Named constants (Learning #6 facet):** `KEEPER_FADE_DURATION_MS = 500` and `KEEPER_INPUT_SUSPEND_MS = 1000` declared as named constants at the top of `GameScene.ts` (mirrors `FADE_DURATION = 400`, `SAVE_THROTTLE_MS = 1000`); not inlined as magic numbers in the tween call [US-71]

### US-72 (dialogue + flag side-effects + story scene chain)
- [ ] `DialogueNode.setFlags?: Record<string, string | number | boolean>` added to `data/areas/types.ts` [US-72]
- [ ] `DialogueSystem` fires `setFlag(k, v)` for every entry in `node.setFlags` when a node is shown, BEFORE the typewriter starts; verified by a trace test: a downstream `onFlagChange` subscriber registered before the dialogue starts sees the new value within the same call stack as `showNode` [US-72]
- [ ] `DialogueScript.endStoryScene?: string` added to `data/areas/types.ts` [US-72]
- [ ] `GameScene.dialogueSystem.setOnEnd` callback launches `endStoryScene` (when present) AFTER `flushSave` — verified by reading the order in `GameScene.create` [US-72]
- [ ] `keeper-intro` dialogue script on `fog-marsh.ts`: `portraitId: 'heron'`, `endStoryScene: 'ember-given'`, two nodes (greeting → action), action node has `setFlags: { has_ember_mark: true, keeper_met: true, marsh_trapped: false }` [US-72]
- [ ] `ember-given` story scene on `fog-marsh.ts` with 2-3 beats. Specific imageColor commitments: beat 1 `0xd9a657` (warm gold), beat 2 `0xf2c878` (brighter ember), beat 3 (optional) `0xe8d8b8` (pale dawn). imageLabel strings as documented in US-72 above [US-72]
- [ ] **Error path (Learning #10):** if `endStoryScene` references an id not present in `area.storyScenes`, the existing `launchStoryScene` error path fires (`console.error('Story scene definition not found: ...')`) and GameScene resumes normally — no crash, no orphaned state. Verified by temporarily setting `endStoryScene: 'nonexistent'` during dev [US-72]
- [ ] **Existing-script regression (Rule 4a):** Marsh Hermit dialogue (uses `DialogueChoice.setFlags`) continues to set `spoke_to_marsh_hermit: true` on greeting choice; Old Man dialogue (no setFlags) closes without flag changes [US-72]
- [ ] **Existing-script regression:** All dialogue scripts WITHOUT `endStoryScene` close via the existing `exitDialogue + flushSave` path with NO story scene launch — verified by Old Man, Marsh Hermit, Whispering Stones [US-72]

### US-73 (path re-opens via flag flip + ember overlay)
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

### Phase-level
- [ ] **Full-arc manual verification:** New Game → Ashen Isle → dock → Fog Marsh → walk past Marsh Hermit → threshold fires → bump south exit ≥ 4 times → Keeper fades in → talk to Keeper → ember-given story scene → walk south → south-exit walkable → transition to Ashen Isle with ember overlay still visible [phase]
- [ ] **Save / resume parity:** force-close after `ember-given` story scene close, reopen, tap Continue → `has_ember_mark: true` AND `marsh_trapped: false` AND `keeper_met: true` restored, ember overlay re-renders on resume, south exit walkable from a Fog Marsh resume, Keeper does NOT respawn (gated by `keeper_met` — add `spawnCondition` second clause OR check in spawn pass that NPC.id is not already in scene state) [phase, save-resume integration]
- [ ] **Reset parity:** clicking Reset Progress wipes `has_ember_mark`, `keeper_met`, `marsh_trapped`, `escape_attempts`, `spoke_to_marsh_hermit` together via `resetAllFlags`; ember overlay disappears on the same frame [phase, save-resume integration]
- [ ] **Keeper one-shot guard:** after rescue, walking back into Fog Marsh from Ashen Isle does NOT respawn the Keeper. Either the Keeper's `spawnCondition` is extended to `marsh_trapped == true AND escape_attempts >= 4 AND keeper_met == false`, OR the spawn pass tracks already-spawned NPC ids — author choice; document in code [phase]
- [ ] **Variant baseline manual checklist:** open `docs/plan/keeper-rescue-manual-verify.md`, walk through one row per surface — desktop fresh New Game, desktop Continue mid-Fog-Marsh, desktop Continue post-rescue, mobile fresh New Game, mobile Continue mid-Fog-Marsh, mobile Continue post-rescue. Each row checks: Keeper spawn fires correctly, dialogue + portrait render, story scene fires, ember overlay renders, south exit re-opens [phase]
- [ ] **Atlas frame-pick verification (compounded):** Heron sprite frames are PixelLab-generated PNGs (not atlas-indexed), so the labeled-atlas verification step does NOT apply to the sprite. The ember overlay reuses an existing atlas frame OR is a tiny new PNG — IF a new atlas frame is used, run `python3 tools/atlas-preview.py assets/tilesets/<id>/tilemap.png /tmp/preview.png && open /tmp/preview.png` and visually verify the chosen frame BEFORE commit. IF a new PNG asset is used, no atlas check is required [phase]
- [ ] `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes; no console errors during full-arc playthrough [phase]
- [ ] AGENTS.md reflects new modules / behavior rules / depth-map row introduced in this phase (Conditional NPC spawn, Player ember overlay, depth 5.5 row, DialogueNode.setFlags, DialogueScript.endStoryScene) [phase]
- [ ] **Deploy verification + smoke (Learning #65):** GitHub Pages deploys; deployed playthrough completes the full arc without errors [phase]

### Auto-added safety criteria
- [ ] **Input validation (compounded):** `DialogueNode.setFlags` values flow into `setFlag` which writes to localStorage. The flag store accepts only `string | number | boolean` (TypeScript-enforced via the `FlagValue` type alias). No additional sanitisation needed because the values are author-controlled (no user text input is wired to setFlags) [phase, security]
- [ ] **Spawn-condition flag-name parsing safety:** the regex `/\b([a-z_][a-z0-9_]*)\s*(==|!=|>=|>|<=|<)/gi` is applied to author-controlled `spawnCondition` strings only (no user input). If a future story wires user-text to spawnCondition, this criterion must be revisited [phase, security]

## Dependencies

- **Phase `fog-marsh-dead-end` MUST be shipped first.** This phase reads `marsh_trapped` and `escape_attempts` from Phase 1 and reverses Phase 1's collision/decoration mechanism by flipping `marsh_trapped` back to false.
- **Heron assets on disk:** confirmed present at `~/Jaxs/assets/emberpath/npc/heron/` as of 2026-04-26 (idle 32 frames, walk 32 frames, static 8 frames, portrait.png, prompt.md).
- **`evaluateCondition` operator support:** `==`, `!=`, `>=`, `>`, `<=`, `<` joined by literal `AND` (uppercase, whitespace-bounded). `&&`, `||`, lowercase `and`, lowercase `or`, and `OR` are NOT supported. This phase does not extend the parser.

## Out of scope

- Beats 3 + 4 of the gospel arc (Heart Bridge, Citadel) — future phases.
- Keeper following Pip back to Ashen Isle as a companion NPC — Keeper appears once, gives the ember, scene closes.
- Re-triggering the rescue (one-shot per save; gated by `keeper_met`).
- Multi-language support.
- Sound / music cue on Keeper appearance (audio pipeline = `audio-pass-1`, future).
- Animated ember on the Keeper's beak / interaction handoff — the story scene carries the visual.
- **Adding `OR` to `evaluateCondition`** — not needed for this phase; the rescue flips `marsh_trapped: false` so the existing single-flag conditions reverse for free.
- **Heron `fireball` animation set** — 48 frames ship with the assets (8 dirs × 6 frames, "summoning light/blessing") but `NpcSpriteDefinition` only supports `idleFrameCount` and `walkFrameCount` today. A future phase may extend the schema and use these in the `ember-given` story scene.

## AGENTS.md sections affected (anticipated — written by the build-loop's Phase Reconciliation Gate after the phase ships, not at spec time)

- **Directory layout** — add `assets/npc/heron/` (idle/walk/static/portrait.png/prompt.md); add `docs/plan/keeper-rescue-manual-verify.md`.
- **File ownership** — updated rows for `data/areas/types.ts` (`NpcDefinition.spawnCondition`, `DialogueNode.setFlags`, `DialogueScript.endStoryScene`); `data/areas/fog-marsh.ts` (Keeper NPC entry, `keeper-intro` dialogue, `ember-given` story scene); `scenes/GameScene.ts` (generalised spawn-condition subscriber, ember overlay update loop, dialogue endStoryScene chaining); `systems/dialogue.ts` (DialogueNode.setFlags fire on showNode, endStoryScene exposed to onEnd); `systems/npcSprites.ts` (`heron` sprite + portrait registry entries).
- **Behavior rules** — new "Conditional NPC spawn" entry; new "Player ember overlay" entry; updated "Dialogue" entry to mention `DialogueNode.setFlags` and `DialogueScript.endStoryScene`; updated "Save / resume" entry to mention `keeper_met`, `has_ember_mark`, and the post-rescue `marsh_trapped == false` state as cross-area persistent.
- **Depth map** — new row at depth 5.5 for Player ember overlay.
