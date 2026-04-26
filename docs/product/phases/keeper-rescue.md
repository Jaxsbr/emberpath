# Phase: keeper-rescue

Status: planned (DEPENDS ON `fog-marsh-dead-end`)

> **This phase is captured for later.** It MUST ship after `fog-marsh-dead-end` because it consumes `marsh_trapped` and `escape_attempts` flags introduced there, and reuses the conditional-decoration mechanism added in US-68. When Phase 1 lands and the operator is ready to start this phase, re-run `/sabs:spec-author project=emberpath` to refine done-when criteria for any drift introduced by Phase 1's actual implementation. Story IDs are pre-allocated (US-70 through US-73); confirm none were claimed by an interim phase before starting.

## Phase goal

Rescue Pip from the Fog Marsh dead-end. After `fog-marsh-dead-end` lands the player at "I cannot do this alone" (`marsh_trapped: true`, `escape_attempts >= 4`), the Keeper — a luminous white heron, the master-prd.md allegorical Holy Spirit — appears in the marsh, gives Pip the Ember Mark in a story scene, and re-opens the path back to Ashen Isle. This phase closes beat 2 of the gospel arc with the player having received grace they could not earn or find.

## Design direction

**Light breaks in.** The Keeper is the first visually warm element to enter the desaturated marsh.

- **Keeper appears, doesn't ask permission.** The spawn condition fires the appearance; the player has no menu choice. Grace is given (master-prd.md: "the ember mark is given, not earned").
- **One conversation, one story scene, one new flag.** No dialogue branches, no skill checks, no inventory. Tap to advance (master-prd.md: "Action over explanation").
- **Ember Mark is visible.** After the story scene, Pip's sprite carries a subtle warm-light overlay (small ember above his head, or a tinted glow). The player sees they've changed.
- **Path re-opens, fog rolls back.** EDGE decorations swap back to PATH; collision restores; the closure visual is undone the same way it was made — same vocabulary, same mechanism.

The build-loop's `frontend-design` skill does NOT apply — this phase introduces no UI.

## Stories

### US-70 — Keeper sprite + portrait + registry entries

PixelLab generation of the Keeper (white heron). Idle (8 dirs × 4 frames) + walk (8 dirs × 4 frames) + 8 static poses + portrait. Style: white plumage with golden underglow; reads against marsh greens/blues. NPC_SPRITES + NPC_PORTRAITS registry entries; no in-game appearance yet (deferred to US-71). Portrait filter: `'linear'` (painterly, like Old Man) — the Keeper is allegorically "other," not a same-grade pixel-art neighbour.

**Acceptance criteria** (refine on phase start):
- PixelLab job for character "keeper" generates idle (8 dirs × 4 frames), walk (8 dirs × 4 frames), and static (8 single-frame poses).
- Assets land at `assets/npc/keeper/{idle,walk,static,portrait.png}` mirroring the Marsh Hermit / Old Man directory shape.
- `NPC_SPRITES` registry entry: `keeper: { idleFrameCount: 4, walkFrameCount: 4 }`.
- `NPC_PORTRAITS` registry entry: `keeper: { file: 'portrait.png', filter: 'linear' }`.
- `npx tsc --noEmit && npm run build` passes; deployed bundle includes the Keeper assets.

**Dependency:** PixelLab subscription credits + `mcp__pixellab-team__create_character` job. Generation may take a session — plan around that.

### US-71 — Keeper spawns when `marsh_trapped == true && escape_attempts >= 4`

The Keeper NPC spawns at a specific tile in Fog Marsh (proposed: `(col 14, row 8)` — on the path between the threshold at row 5 and the hermit at row 10, visible from south). Mechanism: `NpcDefinition` gains an optional `spawnCondition?: string`. GameScene's NPC pass filters on this condition at area load AND on flag-change. When the condition flips true, the Keeper fades into the scene (alpha 0 → 1 over 0.5s); the player's input is briefly suspended (≤ 1s) so the appearance is noticeable.

**Acceptance criteria** (refine on phase start):
- `NpcDefinition.spawnCondition?: string` added to `data/areas/types.ts`.
- GameScene's NPC creation pass filters NPCs on `spawnCondition` (using `evaluateCondition`) at area load.
- The same flag-change signal mechanism introduced in Phase 1 US-67 wakes up GameScene to re-evaluate spawn conditions when relevant flags change.
- Keeper NPC entry on `fog-marsh.ts` with `spawnCondition: 'marsh_trapped == true && escape_attempts >= 4'`, position `(14, 8)`, sprite `'keeper'`, wanderRadius `0` (Keeper does NOT wander), awarenessRadius `2`.
- Appearance is a 0.5s alpha fade-in (Phaser `tweens.add({ targets: keeperSprite, alpha: { from: 0, to: 1 }, duration: 500 })`); player input suspended for the duration of the fade (≤ 1s).
- **Variant baseline:** Marsh Hermit and Old Man without `spawnCondition` continue to spawn unconditionally on area load (regression check).

### US-72 — Keeper rescue dialogue + ember-mark story scene

Walk up to the Keeper; one-shot dialogue:
- Greeting: "You walked deeper than the path. Most do not."
- Action: "You cannot find the way. I am the way. Take this — and follow."

Sets `has_ember_mark: true` and `keeper_met: true`. Triggers a story scene `ember-given` (2-3 beats): warm-toned imagery showing the Keeper touching Pip's forehead, the ember spark passing, the marsh fog briefly parting. Story scene close returns to the world layer with the path re-opened (US-73).

**Acceptance criteria** (refine on phase start):
- New dialogue script `keeper-rescue` on `fog-marsh.ts` with `portraitId: 'keeper'`. Two nodes: greeting → action; final node sets `has_ember_mark: true` and `keeper_met: true` and triggers the `ember-given` story scene via the existing dialogue → story scene path.
- New story scene `ember-given` on `fog-marsh.ts` with 2-3 warm-toned beats. Beat 1: Keeper approaching Pip. Beat 2: ember passing. Beat 3 (optional): fog parting.
- Story scene close returns to GameScene; the path re-open mechanic in US-73 fires on the same frame the flag flips.

### US-73 — Path re-opens; Pip carries the ember mark

On `has_ember_mark == true`:
- The south-exit conditional decorations swap back from EDGE to PATH (uses the existing US-68 condition mechanism — extend either by adding a third decoration set with condition `has_ember_mark == true` that re-shows PATH frames AND extending the EDGE set's condition to `marsh_trapped == true && has_ember_mark == false`).
- The wall mutation reverts (collision becomes walkable again at row 22 cols 13-16).
- The exit's `condition` extends: `'marsh_trapped == false || has_ember_mark == true'` — fires once the ember is given.
- Pip's sprite gains a subtle ember overlay (small warm-light sprite at depth 5.5 between Entities and Thoughts, anchored to player position, follows in update loop). Persists across area transitions.
- Walking back south to Ashen Isle works; the ember overlay carries to Ashen Isle and remains for the rest of the session (and across page reloads — `has_ember_mark` is in `flags.ts`).

**Acceptance criteria** (refine on phase start):
- Decoration conditions on `fog-marsh.ts` row 22 cols 13-16 updated to three-state model: PATH if `marsh_trapped == false`, EDGE if `marsh_trapped == true && has_ember_mark == false`, PATH if `has_ember_mark == true`. (The third covers "trapped, then rescued" — same PATH visual as fresh game.)
- Exit `fog-to-ashen` condition: `'marsh_trapped == false || has_ember_mark == true'`.
- Collision flip reverts when `has_ember_mark == true` — the same mechanism Phase 1 introduced, run again with the inverse predicate.
- New ember overlay sprite on `scenes/GameScene.ts` rendered at depth 5.5, created when `has_ember_mark == true`, anchored to player x/y in update loop. Tween or static — author choice; document.
- AGENTS.md "Depth map" gains a new row at depth 5.5 for the ember overlay.

## Done-when (compact — captured for later refinement)

- [ ] Keeper sprite + portrait registry entries exist; tsc + build pass; both render correctly via the existing `npcSprites` / `npcPortraits` registries [US-70]
- [ ] `NpcDefinition.spawnCondition?: string` added to `data/areas/types.ts`; existing NPCs (Marsh Hermit, Old Man) unaffected [US-71]
- [ ] Keeper appears in Fog Marsh at `(14, 8)` exactly when `marsh_trapped == true && escape_attempts >= 4`; appearance is a 0.5s alpha fade-in; player input suspended ≤ 1s during fade [US-71]
- [ ] **Variant baseline:** Marsh Hermit and Old Man without `spawnCondition` still spawn unconditionally on area load (regression check) [US-71]
- [ ] Keeper dialogue is one-shot; sets `has_ember_mark: true` and `keeper_met: true`; triggers `ember-given` story scene on close [US-72]
- [ ] `ember-given` story scene has 2-3 beats; warm-toned imagery; closes back to GameScene with path re-opened [US-72]
- [ ] After story scene close, south-exit cells revert to PATH decoration AND walkable collision AND firing transition; same single-frame swap as US-68 closure (Learning EP-01: re-render only on flag change) [US-73]
- [ ] Pip's ember overlay sprite renders at depth 5.5 above Entities below Thoughts; follows player x/y in update loop; persists across area transitions; persists across page reloads via `has_ember_mark` flag [US-73]
- [ ] **Full path manual:** New Game → Ashen Isle → dock → Fog Marsh → walk past Marsh Hermit → threshold fires → bump exit ≥ 4 times → Keeper fades in → talk to Keeper → ember-given story scene → walk south → south-exit reopens → transition to Ashen Isle with ember overlay still visible [phase]
- [ ] **Save / resume parity:** force-close after ember-given story scene close, reopen, tap Continue → `has_ember_mark: true` restored, ember overlay re-renders on resume, south exit walkable, Keeper does NOT respawn (one-shot via `keeper_met`) [phase, save-resume integration]
- [ ] **Reset parity:** clicking Reset Progress wipes `has_ember_mark`, `keeper_met`, `marsh_trapped`, `escape_attempts` together via `resetAllFlags` [phase, save-resume integration]
- [ ] `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes; no console errors during full-arc playthrough [phase]
- [ ] AGENTS.md "Behavior rules" gains a "Conditional NPC spawn" entry; AGENTS.md "Depth map" gains row for Player ember overlay at depth 5.5 [phase]
- [ ] **Atlas frame-pick verification (compounded):** Keeper sprite frames are PixelLab-generated, not atlas-indexed; this story is exempt from the atlas-preview check. Any decoration changes (the third PATH-after-ember set) reuse existing `tiny-dungeon` indices [phase]
- [ ] **Deploy verification + smoke (Learning #65):** GitHub Pages deploys; deployed playthrough completes the full arc without errors [phase]

## Dependencies

- **Phase `fog-marsh-dead-end` MUST ship first.** This phase reads `marsh_trapped` and `escape_attempts` from Phase 1 and extends US-67's exit `condition` and US-68's decoration `condition` mechanism.
- **PixelLab credit availability** for Keeper sprite generation (US-70).
- **`evaluateCondition` operator support:** `&&`, `||`, `==`, `<`, `>=` — all introduced or verified in Phase 1.

## Out of scope

- Beats 3 + 4 of the gospel arc (Heart Bridge, Citadel) — future phases.
- Keeper following Pip back to Ashen Isle as a companion NPC — Keeper appears once, gives the ember, scene closes.
- Re-triggering the rescue (one-shot per save; gated by `keeper_met`).
- Multi-language support.
- Sound / music cue on Keeper appearance (audio pipeline = `audio-pass-1`, future).
- Animated ember on the Keeper's beak / interaction handoff — the story scene carries the visual.

## AGENTS.md sections affected (anticipated)

- **Directory layout** — add Keeper sprite folder under `assets/npc/keeper/`; add `docs/plan/keeper-rescue-manual-verify.md`.
- **File ownership** — updated rows for `data/areas/types.ts` (`NpcDefinition.spawnCondition`), `data/areas/fog-marsh.ts` (Keeper NPC, ember-given story scene, third decoration set), `scenes/GameScene.ts` (NPC spawn-condition gate, ember overlay update loop), `systems/npcSprites.ts` + `systems/npcPortraits.ts` (Keeper registry entries).
- **Behavior rules** — new "Conditional NPC spawn" entry; updated "Save / resume" entry to mention `keeper_met` and `has_ember_mark` flags as cross-area persistent.
- **Depth map** — new row at depth 5.5 for Player ember overlay.
