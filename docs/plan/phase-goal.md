## Phase goal

Make Fog Marsh felt-mechanically inescapable. Today the player walks into the marsh, talks to the Marsh Hermit, optionally triggers the Whispering Stones and the marsh-vision story scene, then walks freely back south to Ashen Isle — the hermit's line "Through? There is no through. Only deeper" is currently flavour text without consequence. This phase makes that line true: the player walks deeper than the hermit, crosses a fog threshold that snaps shut behind them, and discovers the south path is gone. Walking against the closed exit reads as fog/water with no walkable surface, and a sequence of thought bubbles graduates from "the path is gone" to "I cannot do this alone." The phase ends at the felt-bottom of beat 2 — the player is stuck, knows they're stuck, and the rescue scaffolding (`marsh_trapped: true`, `escape_attempts >= 4`) is in place for `keeper-rescue` to consume. **The Keeper does not appear in this phase.**

### Design direction

**Mechanical truth, not warning labels.** From `master-prd.md`: "the Fog Marsh dead-end makes grace felt, not told." The player should feel "the path is gone," not see "Path closed!" UI text.

- **Visual closure dominates the message.** The exit cells, currently `PATH_VARIANTS` plank tiles, are replaced by `EDGE_VARIANTS` deep-water tiles when `marsh_trapped` flips. Same authoring vocabulary; no special-case rendering. The player sees the path was, and now isn't.
- **Trigger threshold has a place, not just a flag.** The threshold is north of the Marsh Hermit, on the dry path the hermit's line ("only deeper") points to. Crossing it is the player's choice, not a forced cutscene.
- **Escape-attempt feedback escalates.** First bump: "The fog has swallowed the way back." Third bump+: "I cannot do this alone." This pacing primes the rescue without naming it.
- **Closed is closed — no jiggle, no "almost works."** Walking into the closed exit is identical to walking into any wall. No half-second pause, no fade: collision is collision. The fog/water rendering is what tells the story.

The build-loop's `frontend-design` skill does NOT apply — this phase introduces zero UI.

### Stories in scope

- US-66 — Threshold: marsh-deepens trigger sets `marsh_trapped: true`
- US-67 — Exit closure mechanic: south exit becomes inert when `marsh_trapped: true`
- US-68 — Visual closure: exit decorations switch from PATH to EDGE when `marsh_trapped == true`
- US-69 — Escape-attempt feedback: thought escalation on bumping the closed exit

### Safety criteria

This phase introduces no API endpoints, no user-text fields, no query interpolation, no LLM output. It does introduce a new optional `condition?: string` field on `DecorationDefinition` and a new optional `setFlags` field on `TriggerDefinition` — `evaluateCondition` already handles malformed or missing flag references gracefully, but the new fields must use that path consistently.

- [x] `ExitDefinition.condition` (existing) and `DecorationDefinition.condition` (new) are both routed through the existing `systems/conditions.ts:evaluateCondition` function — no parallel parser, no string interpolation [US-67, US-68]
- [x] An `ExitDefinition.condition` referring to an unset flag (`'marsh_trapped == false'` when `marsh_trapped` has never been set) evaluates such that the exit fires as today — no console error, no false-trap (verified: source read of `evaluateCondition` semantics + manual on a fresh game) [US-67]
- [x] A `DecorationDefinition.condition` evaluating to `false` results in the decoration NOT being added to the scene (or its `visible` set to `false`) — never half-rendered [US-68]
- [x] Tampering with `emberpath_flags` in DevTools to set `marsh_trapped: true` from a fresh tab restores the trapped state correctly on Fog Marsh load — does NOT crash, does NOT half-render decorations [US-67, US-68]

### Done-when (observable)

#### Structural — threshold trigger (US-66)

- [x] `data/areas/fog-marsh.ts` declares a new trigger `id: 'marsh-deepens'`, type `thought`, position `(col 14, row 5)`, `width: 1, height: 2`, `repeatable: false` (verified: source read) [US-66]
- [x] `TriggerDefinition` in `data/areas/types.ts` has a new optional `setFlags?: Record<string, string | number | boolean>` field (verified: source read; field shape mirrors existing `DialogueChoice.setFlags`) [US-66]
- [x] `TriggerZoneSystem` consumes `trigger.setFlags` on fire, iterating entries and calling `setFlag(key, value)` for each (verified: source read of the fire path in `triggerZone.ts`) [US-66]
- [x] The new trigger sets `setFlags: { marsh_trapped: true }`; manual: walk through, observe DevTools `localStorage['emberpath_flags']` contains `marsh_trapped: true` [US-66]
- [x] The thought text in `actionRef` is exactly `"The fog rolls in behind me. The path is gone."` (verified: source read) [US-66]
- [x] Loading Fog Marsh directly with `playerSpawn (14, 12)` does NOT fire `marsh-deepens` on area load — only player-walked entry into the trigger band fires it (verified manually) [US-66]
- [x] After firing, `marsh_trapped` is `true` after a page refresh (existing localStorage persistence — regression check) [US-66]
- [x] **Variant baseline:** the existing `fog-entry-thought` trigger (no `setFlags`) continues to fire identically (regression: `marsh_trapped` does NOT get set as a side effect; only the new trigger sets it) [US-66]

#### Structural — exit closure (US-67)

- [x] `ExitDefinition.condition` is the existing field at `types.ts:67`; this story does NOT re-add it (verified: source read pre-phase) [US-67]
- [x] `fog-to-ashen` exit on `fog-marsh.ts` has `condition: 'marsh_trapped == false'` set (verified: source read) [US-67]
- [x] When `marsh_trapped == true`, cells at row 22 cols 13-16 are treated as walls by `collidesWithWall` — verified: source read of the collision flip (either `area.map` in-place mutation OR a flag-aware overlay in `systems/collision.ts`); manual: walk into the cells, player stops as if hitting a wall [US-67]
- [x] The collision flip happens on the same frame as the threshold trigger — no `scene.restart()`, no black flash (verified by walking through the threshold and immediately walking south to the old exit) [US-67]
- [x] A flag-change detection mechanism exists for `marsh_trapped` (subscriber API in `flags.ts` OR per-frame polling guarded by Learning EP-01); the same mechanism is reused by US-68 for decoration re-rendering (verified: source read; one shared mechanism, not two) [US-67, US-68]
- [x] When `marsh_trapped == false` (fresh game), the exit fires and transitions to Ashen Isle as today (regression check) [US-67]
- [x] `cd tools/editor && npm run build` passes; `flowRenderer` renders the conditional exit (verified pre-phase that `flowRenderer` reads the `condition` field; if the visible treatment was missing, this story adds a one-line dashed-arrow or label) [US-67]

#### Structural — visual closure (US-68)

- [x] `DecorationDefinition` in `data/areas/types.ts` has an optional `condition?: string` field (verified: source read) [US-68]
- [x] `GameScene.renderDecorations()` (or the sibling re-render hook) evaluates per-decoration condition and sets sprite visibility accordingly (verified: source read) [US-68]
- [x] `fog-marsh.ts` declares paired decorations at row 22 cols 13-16: PATH variants conditioned on `marsh_trapped == false`, EDGE variants conditioned on `marsh_trapped == true` (verified: source read) [US-68]
- [x] When `marsh_trapped` flips, the visible decoration on row 22 cols 13-16 swaps from PATH to EDGE on the same frame as the collision update (verified: manual + dev observation) [US-68]
- [x] Decoration re-evaluation runs ONLY on flag change, NOT per-frame full re-render (verified: source read; loop-invariant audit per Learning EP-01) [US-68]
- [x] **Atlas frame-pick verification (compounded):** PATH and EDGE frames are the existing `tiny-dungeon` indices already verified during `tileset` and `world-legibility` (`FRAME.PATH_A = '36'`, `PATH_B = '37'`, `EDGE_A = '33'`, `EDGE_B = '34'`, `EDGE_C = '35'`); no new atlas indices introduced. If any new index is needed, a labeled atlas preview is generated and visually verified before commit: `python3 tools/atlas-preview.py assets/tilesets/tiny-dungeon/tilemap.png /tmp/tiny-dungeon-preview.png && open /tmp/tiny-dungeon-preview.png` [US-68]
- [x] `tools/editor/src/mapRenderer.ts` either renders all conditional decorations regardless of condition OR has a documented behaviour for conditional decorations (verified: editor inspection + brief inline comment) [US-68]

#### Structural — escape-attempt feedback (US-69)

- [ ] Three new triggers on `fog-marsh.ts` at row 21 cols 13-16, each `width: 4, height: 1`, type `thought`, `repeatable: true`, with mutually-exclusive `escape_attempts` band conditions (verified: source read) [US-69]
- [ ] Each trigger fires its named thought (`"The fog has swallowed the way back."` / `"I tried this path. It's gone."` / `"I cannot do this alone."`) — texts verified against source [US-69]
- [ ] `TriggerDefinition` gains an optional `incrementFlags?: string[]` field; each escape trigger uses `incrementFlags: ['escape_attempts']`; `TriggerZoneSystem` calls `incrementFlag(name)` for each entry on fire (verified: source read of types.ts + triggerZone.ts; manual: bump the band repeatedly, observe `escape_attempts` increase in DevTools localStorage) [US-69]
- [ ] The bands are mutually exclusive at all `escape_attempts` values (0, 1 → first only; 2, 3 → second only; 4, 5, 6+ → third only) (verified: source read of the conditions) [US-69]
- [ ] After 4 distinct entries, `escape_attempts >= 4` AND the despair thought has fired at least once (verified manually) [US-69]
- [ ] Standing still on the band does NOT infinite-fire — existing repeatable semantics require exit-and-re-enter (verified: source read of repeatable semantics + manual) [US-69]
- [ ] `evaluateCondition` supports `<` and `>=` operators (verified: source read of `systems/conditions.ts`; if not supported pre-phase, this phase adds them with a focused done-when criterion stating `evaluateCondition('escape_attempts >= 4')` returns `true` when `escape_attempts === 4` and `false` when `escape_attempts === 3`, and similar for `<`) [US-69]

#### Behavior — full sequence (US-66 + US-67 + US-68 + US-69)

- [x] **Trap closes**: spawn on Fog Marsh from a transition or load; walk to Marsh Hermit; talk through to "only deeper"; walk north past him; cross the threshold trigger. Observe in order: (a) thought "The fog rolls in behind me. The path is gone.", (b) `marsh_trapped` becomes `true` in DevTools localStorage, (c) within the same frame the south exit cells become wall-collision, (d) PATH→EDGE decoration swap on the south exit cells. Verified manually. [US-66, US-67, US-68]
- [ ] **Escape escalation**: with `marsh_trapped == true`, walk south to row 21, north out of the band, south back into the band — repeat ≥ 4 times. Each visit fires a thought; the thoughts escalate from "The fog has swallowed the way back." to "I cannot do this alone." Verified manually. [US-69]
- [x] **No regression on Ashen Isle**: New Game → Ashen Isle → Old Man dialogue → dock-to-fog transition still works; arriving on Fog Marsh, walking south back through the still-open exit (BEFORE the threshold) still transitions back to Ashen Isle. Verified manually. [US-67]
- [x] **Save / resume parity**: with `marsh_trapped == true`, force-close the tab and reopen, tap Continue — the closed-exit collision and EDGE decoration are restored on resume (the flag persists; collision and decoration state rebuilds from the flag at area-load time). Verified manually. [US-67, US-68; integration with `save-resume`]

#### Class baseline — every area's exits behave consistently

- [x] Ashen Isle's `exit-to-fog` exit (no `condition` set) still fires unconditionally as today (verified: source read + manual New Game playthrough) [US-67]
- [x] Fog Marsh's `fog-to-ashen` exit (`condition` set) gates on `marsh_trapped == false` (verified: source read + manual at both flag states) [US-67]

#### Variant baseline — conditional decorations on every area variant

- [x] Ashen Isle (no conditional decorations introduced): renders identically to today; visual screenshot at New Game spawn matches pre-phase baseline [US-68]
- [x] Fog Marsh in `marsh_trapped == false`: PATH frames render at row 22 cols 13-16 (verified: screenshot) [US-68]
- [x] Fog Marsh in `marsh_trapped == true`: EDGE frames render at row 22 cols 13-16 (verified: screenshot) [US-68]

#### Behavior — reads-as

- [x] **"The path is gone" reads-as "I can't go back the way I came"**: a first-time observer who watches the threshold fire and sees the EDGE swap describes the south exit as "no longer walkable; the marsh is too deep there now" — NOT "I think the path is hidden." (verified via observer note in manual-verify doc) [US-66, US-68]
- [x] **Closure mechanism proxy**: threshold sets `marsh_trapped: true` → exit-resolution pass evaluates `condition` and skips transition → `area.map` mutation (or overlay) makes cells wall → `renderDecorations` flips PATH to EDGE. Verified by source read of the call sequence. [US-66, US-67, US-68]
- [ ] **"I cannot do this alone" reads-as "this is hopeless"**: a first-time observer who triggers the third thought describes the player's situation as "stuck, no way out, doesn't know what to do" — NOT "the player will figure it out" or "this is just flavour text." (verified via observer note) [US-69]
- [ ] **Escalation mechanism proxy**: each band entry → `incrementFlag('escape_attempts')` → next band's condition evaluates true → next thought displays. Verified by source read of the increment + condition gate. [US-69]

#### Error paths

- [x] **Walking onto the now-walled exit cells**: collision is normal; no crash; no console error (verified manually) [US-67]
- [x] **Tampered flag** (DevTools sets `marsh_trapped: true` from a fresh tab): on Fog Marsh load, the trap state is restored — exit is closed, EDGE decorations render — without the threshold trigger having fired this session. No console errors. (verified manually) [US-67, US-68]
- [x] **Reset Progress while trapped**: clicking Reset Progress (existing TitleScene affordance) wipes `marsh_trapped` along with all flags via `resetAllFlags`; next session, Fog Marsh loads with the path open. (verified manually) [save-resume integration]
- [ ] **Tampered `escape_attempts`** (DevTools sets `escape_attempts: 99`): walking onto the band fires only the third (despair) thought, not multiple thoughts; mutual exclusion holds. (verified manually) [US-69]

#### Editor sync

- [ ] `tools/editor/` builds and renders Fog Marsh's new conditional triggers, exit, and decorations visibly — area author can see what's new (verified) [US-66, US-67, US-69]

#### Aesthetic traceability

- [x] **"Mechanical truth, not warning labels"** (design direction) traces to: no UI text saying "Path closed!"; the closure is collision + decoration only [phase]
- [x] **"Visual closure dominates the message"** (design direction) traces to: PATH→EDGE decoration swap on the same frame as collision; no fade [US-68]
- [ ] **"Escape-attempt feedback escalates"** (design direction) traces to: three thought triggers in escalating bands [US-69]
- [x] **"Closed is closed"** (design direction) traces to: exit cells become walls; same `collidesWithWall` path as any wall [US-67]

#### Invariants

- [x] `npx tsc --noEmit && npm run build` passes [phase]
- [x] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors during 90 seconds of play covering: New Game on Ashen Isle, walk to Old Man dialogue, walk to dock, transition to Fog Marsh, walk to Marsh Hermit, full dialogue, walk north past hermit, cross threshold, walk south, bump exit ≥ 4 times, force-close, reopen, Continue, observe state restored [phase]
- [ ] AGENTS.md "Behavior rules" gains a "Conditional exits and decorations" entry describing the shared `condition` field semantics (load-time and runtime evaluation, flag-change re-render contract, no-scene-restart rule) [phase]
- [ ] AGENTS.md "File ownership" rows updated for: `data/areas/types.ts` (added `TriggerDefinition.setFlags`, `TriggerDefinition.incrementFlags`, `DecorationDefinition.condition`), `data/areas/fog-marsh.ts` (threshold + escape triggers + conditional exit/decorations), `scenes/GameScene.ts` (decoration condition evaluation + flag-change re-render hook + collision flip), `triggers/flags.ts` (flag-change subscriber API or equivalent), `systems/triggerZone.ts` (consumes setFlags + incrementFlags) [phase]
- [ ] AGENTS.md "Directory layout" updated to add `docs/plan/fog-marsh-dead-end-manual-verify.md` [phase]
- [ ] **Loop-invariant audit (Learning EP-01):** confirmed no per-frame full decoration re-render; the flag-change hook only fires when the flag actually changed; no per-frame `evaluateCondition` for unconditional decorations; no per-frame `setTexture` with identical inputs [phase]
- [x] **Atlas frame-pick verification (compounded):** PATH and EDGE frames reuse the existing `tiny-dungeon` indices verified during `tileset` and `world-legibility` phases; no new indices introduced [phase]
- [ ] **Deploy verification (Learning #65):** GitHub Pages deploy workflow succeeds for the squash-merge commit on `main` (green check) [phase]
- [ ] **Deploy smoke (Learning #65, post-deploy):** open the deployed `https://jaxsbr.github.io/emberpath/` URL, walk past the threshold, refresh, verify trap state is restored on Continue (closed exit collision + EDGE decoration both present) [phase]

### Golden principles (phase-relevant)

- **Parameterized systems:** the new conditional fields on `DecorationDefinition` and the new `setFlags`/`incrementFlags` fields on `TriggerDefinition` reuse `evaluateCondition` and `setFlag`/`incrementFlag` from existing modules — no new condition syntax, no parallel parser, no parallel flag store.
- **No silent breaking changes:** existing exits, decorations, and triggers without the new optional fields continue to behave as today (unconditional / no flag side-effect). The new fields are additive.
- **From LEARNINGS EP-01 (loop invariants):** flag-change-driven re-renders, not per-frame re-evaluation. The hook fires once per flag change. Conditional decorations re-evaluate visibility only when their referenced flags change.
- **From LEARNINGS #57 (depth-map authority):** no new visual layers; decorations remain at depth 2.
- **Zone-level mutual exclusion (LEARNINGS #56):** triggers and exits are already suppressed during dialogue / transitions / StoryScene; the new threshold trigger and escape bands inherit the same suppression.
- **Mechanical truth (`master-prd.md` Gospel Integration Principles):** the trap is collision and decoration, not UI text. The player doesn't read "you are stuck" — they walk into water that wasn't water.

### Reference

Full spec, story bodies, design rationale, and AGENTS.md sections affected: `docs/product/phases/fog-marsh-dead-end.md`.
