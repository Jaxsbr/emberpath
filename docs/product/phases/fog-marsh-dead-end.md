# Phase: fog-marsh-dead-end

Status: shipped

## Phase goal

Make Fog Marsh felt-mechanically inescapable. Today the player walks into the marsh, talks to the Marsh Hermit, optionally triggers the Whispering Stones and the marsh-vision story scene, then walks freely back south to Ashen Isle — the hermit's line "Through? There is no through. Only deeper" is currently flavour text without consequence. This phase makes that line true: the player walks deeper than the hermit, crosses a fog threshold that snaps shut behind them, and discovers the south path is gone. Walking against the closed exit reads as fog/water with no walkable surface, and a sequence of thought bubbles graduates from "the path is gone" to "I cannot do this alone." The phase ends at the felt-bottom of beat 2 — the player is stuck, knows they're stuck, and the rescue scaffolding (`marsh_trapped: true`, `escape_attempts >= 4`) is in place for `keeper-rescue` to consume. **The Keeper does not appear in this phase.**

## Design direction

**Mechanical truth, not warning labels.** From `master-prd.md`: "the Fog Marsh dead-end makes grace felt, not told." The player should feel "the path is gone," not see "Path closed!" UI text.

- **Visual closure dominates the message.** The exit cells, currently `PATH_VARIANTS` plank tiles, are replaced by `EDGE_VARIANTS` deep-water tiles when `marsh_trapped` flips. Same authoring vocabulary; no special-case rendering. The player sees the path was, and now isn't.
- **Trigger threshold has a place, not just a flag.** The threshold is north of the Marsh Hermit, on the dry path the hermit's line ("only deeper") points to. Crossing it is the player's choice, not a forced cutscene.
- **Escape-attempt feedback escalates.** First bump: "The fog has swallowed the way back." Third bump+: "I cannot do this alone." This pacing primes the rescue without naming it.
- **Closed is closed — no jiggle, no "almost works."** Walking into the closed exit is identical to walking into any wall. No half-second pause, no fade: collision is collision. The fog/water rendering is what tells the story.

The build-loop's `frontend-design` skill does NOT apply — this phase introduces zero UI.

## Safety criteria

This phase introduces no API endpoints, no user-text fields, no query interpolation, no LLM output. It does introduce a new optional `condition?: string` field on `DecorationDefinition` and a new optional `setFlags` field on `TriggerDefinition` — `evaluateCondition` already handles malformed or missing flag references gracefully, but the new fields must use that path consistently. Auto-added safety criteria:

- [ ] `ExitDefinition.condition` (existing) and `DecorationDefinition.condition` (new) are both routed through the existing `systems/conditions.ts:evaluateCondition` function — no parallel parser, no string interpolation [US-67, US-68]
- [ ] An `ExitDefinition.condition` referring to an unset flag (`'marsh_trapped == false'` when `marsh_trapped` has never been set) evaluates such that the exit fires as today — no console error, no false-trap (verified: source read of `evaluateCondition` semantics + manual on a fresh game) [US-67]
- [ ] A `DecorationDefinition.condition` evaluating to `false` results in the decoration NOT being added to the scene (or its `visible` set to `false`) — never half-rendered [US-68]
- [ ] Tampering with `emberpath_flags` in DevTools to set `marsh_trapped: true` from a fresh tab restores the trapped state correctly on Fog Marsh load — does NOT crash, does NOT half-render decorations [US-67, US-68]

## Stories

### US-66 — Threshold: marsh-deepens trigger sets `marsh_trapped: true` [Shipped]

As Pip following the Marsh Hermit's hint deeper north into the marsh, I want a single one-shot moment when I cross from "near the hermit" to "past the hermit," so that the trap closing has a felt cause-effect and isn't a random mid-walk surprise.

**Acceptance criteria:**
- New trigger `marsh-deepens` on `data/areas/fog-marsh.ts`, type `thought`, position `(col 14, row 5)` with `width: 1, height: 2` so the player walking north up the path crosses it. One-shot (`repeatable: false`).
- **`TriggerDefinition` in `data/areas/types.ts` gains an optional field `setFlags?: Record<string, string | number | boolean>`** — same shape as the existing `DialogueChoice.setFlags`. The current trigger schema has no flag-set capability (verified: `types.ts:57` has no setFlags on TriggerDefinition; existing flags are set via dialogue choices only). `TriggerZoneSystem` (or wherever `setFlag` is currently called from `triggerZone.ts:72` for `_trigger_fired_<id>` bookkeeping) consumes the new field, iterating entries and calling `setFlag(key, value)` on fire.
- The new trigger uses `setFlags: { marsh_trapped: true }`.
- Thought text carried in `actionRef`: `"The fog rolls in behind me. The path is gone."`
- The trigger fires only via player walk-in, NOT on first area load. With `playerSpawn` at `(14, 12)`, loading Fog Marsh directly leaves `marsh_trapped` unset.
- After firing, `getFlag('marsh_trapped') === true` for the rest of the session and across page reloads (existing localStorage persistence in `flags.ts`).
- **Variant baseline:** existing triggers without `setFlags` (e.g., the `fog-entry-thought` trigger in `fog-marsh.ts`) continue to fire identically — the new field is additive (verified: source read of trigger fire path with no `setFlags` → no flag set).
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: Ambient. The thought bubble is the player-facing surface.
- Manual section: New `docs/plan/fog-marsh-dead-end-manual-verify.md`, "Threshold" subsection.
- Key steps: (1) Walk north past the Marsh Hermit on the dry path. (2) Cross the threshold tile. (3) Read the "fog rolls in behind me" thought.

**Design rationale:** Placing the trigger at `(14, 5)` (well north of the hermit at `(14, 10)` and the existing `marsh-vision` story trigger at `(14, 14)`) cleanly separates two player paths: walking south after talking to the hermit fires `marsh-vision` (gated on `spoke_to_marsh_hermit`); walking further north fires the dead-end trigger. Width-1 height-2 because the path is one tile wide; height-2 catches a player who steps fast.

**Consumer adaptation:** N/A — single-area trigger. The new `setFlags` field on `TriggerDefinition` is class-shared with all triggers; no consumer-specific defaults.

**Processing model:** Trigger fires through the existing `TriggerZoneSystem`. On fire: iterate `setFlags` entries → call `setFlag(key, value)` → emit thought. No new system, no new dispatch.

---

### US-67 — Exit closure mechanic: south exit becomes inert when `marsh_trapped: true` [Shipped]

As Pip stuck in the marsh, I want the south exit (back to Ashen Isle) to no longer carry me out, so that the closure is a real mechanical fact and not just a sad-faced sign.

**Acceptance criteria:**
- **The schema and runtime gate already exist** (verified: `types.ts:67` ExitDefinition.condition, `GameScene.ts:525` evaluates and skips transition). This story does NOT add either; it (a) sets the condition value on `fog-to-ashen` and (b) adds the missing collision flip.
- `fog-to-ashen` exit on `fog-marsh.ts` gets `condition: 'marsh_trapped == false'` (unset flag is treated as `false` per existing `evaluateCondition` semantics — a fresh game has `marsh_trapped` unset, the condition holds, the exit fires).
- The exit cells at row 22 cols 13-16 become **wall-collision** when `marsh_trapped == true` — walking south to the cells stops as if hitting any wall. Today the exit cells stay walkable when the transition skip fires (verified at `GameScene.ts:525`: only the transition is skipped; the cells stay FLOOR). This is the gap this story closes.
- Collision flip propagates without a scene restart: when the threshold trigger fires, GameScene's collision data for those cells updates on the same frame. Implementation hint: GameScene either (a) mutates `area.map` in place at the affected cells when `marsh_trapped` flips, or (b) maintains a flag-aware overlay queried by `collidesWithWall` in `systems/collision.ts`. Author chooses; the rule is no `scene.restart()` required.
- The flag-change detection mechanism is established in this story and consumed by US-68 for decorations: a single signal that fires once when `marsh_trapped` changes value. Implementation hint: `triggers/flags.ts` adds a lightweight subscriber API (`onFlagChange(name, cb): unsubscribe`) called from inside `setFlag`; GameScene subscribes during `create()` and unsubscribes on shutdown. Alternative: GameScene polls `getFlag('marsh_trapped')` once per frame and reacts to value changes (Learning EP-01: only the comparison runs per frame; mutation runs only on transition).
- When `marsh_trapped == false` (fresh game), the exit fires and transitions to Ashen Isle as today (regression check).
- `cd tools/editor && npm run build` passes — `tools/editor/src/flowRenderer.ts` already renders the existing `condition` field; no edits required (verified pre-phase). If the editor does NOT visibly mark conditional exits today, this story adds a one-line label or dashed-arrow treatment so the area author can see the gate.
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: N/A (mechanic).
- Manual section: "Exit closure" subsection in the manual-verify doc.
- Key steps: (1) Cross the threshold from US-66. (2) Walk south to row 22. (3) Bump the cells where the exit was — collision should be normal wall collision; no transition fires.

**Design rationale:** Reusing `condition` on ExitDefinition mirrors how triggers already work — same vocabulary, no new schema. Mutating `area.map` in place is the cheapest collision flip; a parallel "blocked" overlay is also acceptable. The "no scene restart" rule is what makes the closure feel ambient rather than scripted: from the player's frame-by-frame view, they walked north, fog rolled in, and walking back south finds wall where path was.

**Consumer adaptation:** `ExitDefinition` is consumed by GameScene's exit-resolution pass and by `tools/editor/src/flowRenderer.ts`. The `condition` field already serializes through both pre-phase. The flag-change detection mechanism is a shared GameScene concern (Title and StoryScene do not need it).

**Processing model:** On every player position update in GameScene, the exit-zone-overlap pass evaluates each exit's `condition` (via `evaluateCondition`) before initiating a transition. False-condition exits log no warning and produce no UI affordance — silently inert. Collision for the cells flows through `collidesWithWall` like any wall.

---

### US-68 — Visual closure: exit decorations switch from PATH to EDGE when `marsh_trapped == true` [Shipped]

As Pip looking at where the path used to be, I want to see fog/deep water where the planks were, so that the closure is visible, not just felt as collision.

**Acceptance criteria:**
- `DecorationDefinition` in `data/areas/types.ts` gains an optional field `condition?: string`. Same syntax as TriggerDefinition.condition. When the condition evaluates `false`, the decoration is not visible (`visible: false`) or not added to the scene.
- Two new decoration sets on `fog-marsh.ts` at row 22 cols 13-16 (the south exit cells):
  - PATH variants (`FRAME.PATH_A` / `FRAME.PATH_B`) conditioned on `marsh_trapped == false` — rendered when path is open.
  - EDGE variants (`FRAME.EDGE_A` / `FRAME.EDGE_B` / `FRAME.EDGE_C`) conditioned on `marsh_trapped == true` — rendered when path is closed; reads as deep water / fog.
- `GameScene.renderDecorations()` (or its sibling re-render hook) updates visibility when `marsh_trapped` flips so the visible decoration matches collision state on the same frame as the threshold trigger.
- The decoration re-evaluation does NOT run per-frame full re-render. Implementation hint: track a per-flag dirty bit set by `flags.ts` on write; consume it from GameScene's update loop and re-evaluate decoration conditions only when the bit is set, then clear the bit. Loop-invariant audit per Learning EP-01.
- After the threshold fires (US-66), walking back south to row 22 reveals deep-water frames where path frames were a moment ago. One-frame visual transition is acceptable; no fade.
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: Visual reads-as. No UI surface.
- Manual section: "Visual closure" subsection in the manual-verify doc, with screenshots at both states.
- Key steps: (1) Before threshold: walk to row 22 cols 13-16, see plank path. (2) After threshold: walk back, see deep water at the same cells.

**Design rationale:** Conditional decorations are a one-field schema add that mirrors trigger conditions — no new vocabulary for the build agent to learn. Re-rendering on flag change (rather than per-frame) protects the per-frame budget (Learning EP-01). PATH→EDGE swap in the same cells (rather than fade or particle effect) is faithful to master-prd.md's "Fading" theme: things don't dissolve, they're just gone.

**Consumer adaptation:** `DecorationDefinition` is consumed by `GameScene.renderDecorations` and by `tools/editor/src/mapRenderer.ts` (decoration sprite layer). The editor must either (a) render all conditional decorations regardless of condition, OR (b) render them with a visual marker indicating they are conditional. Author chooses; document the choice in `tools/editor/src/mapRenderer.ts` inline.

**Processing model:** GameScene caches decoration sprites in a list. On each flag-change signal (not per-frame), iterate the conditional subset, evaluate `condition` per entry, set `sprite.visible` accordingly. Unconditional decorations are never re-evaluated.

---

### US-69 — Escape-attempt feedback: thought escalation on bumping the closed exit [Shipped]

As Pip walking back south to find the path is gone, I want the marsh to give me an honest reading of "you can't go back that way," and as I keep trying, I want it to graduate from informational to despairing, so that the trap feels like a closing window, not a stuck door.

**Acceptance criteria:**
- Three new triggers on `fog-marsh.ts` at row 21 cols 13-16 (one tile north of the now-walled exit row 22), each `width: 4, height: 1`, type `thought`, `repeatable: true`. Each gated on a different `escape_attempts` band:
  1. `condition: 'marsh_trapped == true && escape_attempts < 2'` — thought: `"The fog has swallowed the way back."`
  2. `condition: 'marsh_trapped == true && escape_attempts >= 2 && escape_attempts < 4'` — thought: `"I tried this path. It's gone."`
  3. `condition: 'marsh_trapped == true && escape_attempts >= 4'` — thought: `"I cannot do this alone."`
- Each trigger increments `escape_attempts` via the existing `incrementFlag` path (verified: `flags.ts:44` exports `incrementFlag`). `TriggerDefinition` gains a sibling `incrementFlags?: string[]` field — same dispatch path as US-66's `setFlags`. The trigger schema thus has both setFlags (US-66) and incrementFlags (US-69); both routed through TriggerZoneSystem on fire.
- Triggers fire on player band-entry (existing repeatable semantics: bounding-box overlap; player must exit and re-enter to re-fire). Standing still on the band does NOT infinite-fire.
- After 4 distinct entries, `escape_attempts >= 4` AND the despair thought has fired at least once.
- The bands are mutually exclusive at every `escape_attempts` value (0, 1 → first; 2, 3 → second; 4+ → third). Verify by source read of the conditions.
- Confirm the existing `evaluateCondition` supports `&&` AND comparison operators including `<` and `>=`. If only `==` is supported today, this story is the place to add `<` and `>=` — do so as a minimal addition with a unit-style done-when criterion (see structural section).
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: Ambient.
- Manual section: "Escape attempts" subsection in the manual-verify doc with all three escalation messages.
- Key steps: (1) After threshold fires, walk south to row 21, then north out of the band, then south back in. (2) Repeat ≥ 4 times. (3) Read each escalation thought; observe `escape_attempts` in DevTools localStorage.

**Design rationale:** Three thoughts is the smallest set that reads as escalation. Counting via `incrementFlag` reuses the existing flag-counter pattern. Three separate triggers gated on bands is cheaper than introducing a "thought escalation" trigger type — done-when criteria stay verifiable from source read.

**Consumer adaptation:** `incrementFlag` is consumed by trigger-pipeline semantics today (per AGENTS.md flag store row); this is the second consumer. The new `incrementFlags?: string[]` field on `TriggerDefinition` is consumed by `TriggerZoneSystem.fire()` only — no third caller.

**Processing model:** On each band entry, the existing TriggerZoneSystem evaluates the band's condition. If multiple bands evaluate to true on the same entry (they shouldn't, given mutually-exclusive `escape_attempts` ranges), the system fires the first match — verify mutual exclusion at all values.

---

## Done-when (observable)

### Structural — threshold trigger (US-66)

- [ ] `data/areas/fog-marsh.ts` declares a new trigger `id: 'marsh-deepens'`, type `thought`, position `(col 14, row 5)`, `width: 1, height: 2`, `repeatable: false` (verified: source read) [US-66]
- [ ] `TriggerDefinition` in `data/areas/types.ts` has a new optional `setFlags?: Record<string, string | number | boolean>` field (verified: source read; field shape mirrors existing `DialogueChoice.setFlags`) [US-66]
- [ ] `TriggerZoneSystem` consumes `trigger.setFlags` on fire, iterating entries and calling `setFlag(key, value)` for each (verified: source read of the fire path in `triggerZone.ts`) [US-66]
- [ ] The new trigger sets `setFlags: { marsh_trapped: true }`; manual: walk through, observe DevTools `localStorage['emberpath_flags']` contains `marsh_trapped: true` [US-66]
- [ ] The thought text in `actionRef` is exactly `"The fog rolls in behind me. The path is gone."` (verified: source read) [US-66]
- [ ] Loading Fog Marsh directly with `playerSpawn (14, 12)` does NOT fire `marsh-deepens` on area load — only player-walked entry into the trigger band fires it (verified manually) [US-66]
- [ ] After firing, `marsh_trapped` is `true` after a page refresh (existing localStorage persistence — regression check) [US-66]
- [ ] **Variant baseline:** the existing `fog-entry-thought` trigger (no `setFlags`) continues to fire identically (regression: `marsh_trapped` does NOT get set as a side effect; only the new trigger sets it) [US-66]

### Structural — exit closure (US-67)

- [ ] `ExitDefinition.condition` is the existing field at `types.ts:67`; this story does NOT re-add it (verified: source read pre-phase) [US-67]
- [ ] `fog-to-ashen` exit on `fog-marsh.ts` has `condition: 'marsh_trapped == false'` set (verified: source read) [US-67]
- [ ] When `marsh_trapped == true`, cells at row 22 cols 13-16 are treated as walls by `collidesWithWall` — verified: source read of the collision flip (either `area.map` in-place mutation OR a flag-aware overlay in `systems/collision.ts`); manual: walk into the cells, player stops as if hitting a wall [US-67]
- [ ] The collision flip happens on the same frame as the threshold trigger — no `scene.restart()`, no black flash (verified by walking through the threshold and immediately walking south to the old exit) [US-67]
- [ ] A flag-change detection mechanism exists for `marsh_trapped` (subscriber API in `flags.ts` OR per-frame polling guarded by Learning EP-01); the same mechanism is reused by US-68 for decoration re-rendering (verified: source read; one shared mechanism, not two) [US-67, US-68]
- [ ] When `marsh_trapped == false` (fresh game), the exit fires and transitions to Ashen Isle as today (regression check) [US-67]
- [ ] `cd tools/editor && npm run build` passes; `flowRenderer` renders the conditional exit (verified pre-phase that `flowRenderer` reads the `condition` field; if the visible treatment was missing, this story adds a one-line dashed-arrow or label) [US-67]

### Structural — visual closure (US-68)

- [ ] `DecorationDefinition` in `data/areas/types.ts` has an optional `condition?: string` field (verified: source read) [US-68]
- [ ] `GameScene.renderDecorations()` (or the sibling re-render hook) evaluates per-decoration condition and sets sprite visibility accordingly (verified: source read) [US-68]
- [ ] `fog-marsh.ts` declares paired decorations at row 22 cols 13-16: PATH variants conditioned on `marsh_trapped == false`, EDGE variants conditioned on `marsh_trapped == true` (verified: source read) [US-68]
- [ ] When `marsh_trapped` flips, the visible decoration on row 22 cols 13-16 swaps from PATH to EDGE on the same frame as the collision update (verified: manual + dev observation) [US-68]
- [ ] Decoration re-evaluation runs ONLY on flag change, NOT per-frame full re-render (verified: source read; loop-invariant audit per Learning EP-01) [US-68]
- [ ] **Atlas frame-pick verification (compounded):** PATH and EDGE frames are the existing `tiny-dungeon` indices already verified during `tileset` and `world-legibility` (`FRAME.PATH_A = '36'`, `PATH_B = '37'`, `EDGE_A = '33'`, `EDGE_B = '34'`, `EDGE_C = '35'`); no new atlas indices introduced. If any new index is needed, a labeled atlas preview is generated and visually verified before commit: `python3 tools/atlas-preview.py assets/tilesets/tiny-dungeon/tilemap.png /tmp/tiny-dungeon-preview.png && open /tmp/tiny-dungeon-preview.png` [US-68]
- [ ] `tools/editor/src/mapRenderer.ts` either renders all conditional decorations regardless of condition OR has a documented behaviour for conditional decorations (verified: editor inspection + brief inline comment) [US-68]

### Structural — escape-attempt feedback (US-69)

- [ ] Three new triggers on `fog-marsh.ts` at row 21 cols 13-16, each `width: 4, height: 1`, type `thought`, `repeatable: true`, with mutually-exclusive `escape_attempts` band conditions (verified: source read) [US-69]
- [ ] Each trigger fires its named thought (`"The fog has swallowed the way back."` / `"I tried this path. It's gone."` / `"I cannot do this alone."`) — texts verified against source [US-69]
- [ ] `TriggerDefinition` gains an optional `incrementFlags?: string[]` field; each escape trigger uses `incrementFlags: ['escape_attempts']`; `TriggerZoneSystem` calls `incrementFlag(name)` for each entry on fire (verified: source read of types.ts + triggerZone.ts; manual: bump the band repeatedly, observe `escape_attempts` increase in DevTools localStorage) [US-69]
- [ ] The bands are mutually exclusive at all `escape_attempts` values (0, 1 → first only; 2, 3 → second only; 4, 5, 6+ → third only) (verified: source read of the conditions) [US-69]
- [ ] After 4 distinct entries, `escape_attempts >= 4` AND the despair thought has fired at least once (verified manually) [US-69]
- [ ] Standing still on the band does NOT infinite-fire — existing repeatable semantics require exit-and-re-enter (verified: source read of repeatable semantics + manual) [US-69]
- [ ] `evaluateCondition` supports `<` and `>=` operators (verified: source read of `systems/conditions.ts`; if not supported pre-phase, this phase adds them with a focused done-when criterion stating `evaluateCondition('escape_attempts >= 4')` returns `true` when `escape_attempts === 4` and `false` when `escape_attempts === 3`, and similar for `<`) [US-69]

### Behavior — full sequence (US-66 + US-67 + US-68 + US-69)

- [ ] **Trap closes**: spawn on Fog Marsh from a transition or load; walk to Marsh Hermit; talk through to "only deeper"; walk north past him; cross the threshold trigger. Observe in order: (a) thought "The fog rolls in behind me. The path is gone.", (b) `marsh_trapped` becomes `true` in DevTools localStorage, (c) within the same frame the south exit cells become wall-collision, (d) PATH→EDGE decoration swap on the south exit cells. Verified manually. [US-66, US-67, US-68]
- [ ] **Escape escalation**: with `marsh_trapped == true`, walk south to row 21, north out of the band, south back into the band — repeat ≥ 4 times. Each visit fires a thought; the thoughts escalate from "The fog has swallowed the way back." to "I cannot do this alone." Verified manually. [US-69]
- [ ] **No regression on Ashen Isle**: New Game → Ashen Isle → Old Man dialogue → dock-to-fog transition still works; arriving on Fog Marsh, walking south back through the still-open exit (BEFORE the threshold) still transitions back to Ashen Isle. Verified manually. [US-67]
- [ ] **Save / resume parity**: with `marsh_trapped == true`, force-close the tab and reopen, tap Continue — the closed-exit collision and EDGE decoration are restored on resume (the flag persists; collision and decoration state rebuilds from the flag at area-load time). Verified manually. [US-67, US-68; integration with `save-resume`]

### Class baseline — every area's exits behave consistently

The new `condition` field on ExitDefinition is now a class behaviour. Verify both areas:

- [ ] Ashen Isle's `exit-to-fog` exit (no `condition` set) still fires unconditionally as today (verified: source read + manual New Game playthrough) [US-67]
- [ ] Fog Marsh's `fog-to-ashen` exit (`condition` set) gates on `marsh_trapped == false` (verified: source read + manual at both flag states) [US-67]

### Variant baseline — conditional decorations on every area variant

The new `condition` field on DecorationDefinition is now a class behaviour. Verify both areas continue to render correctly:

- [ ] Ashen Isle (no conditional decorations introduced): renders identically to today; visual screenshot at New Game spawn matches pre-phase baseline [US-68]
- [ ] Fog Marsh in `marsh_trapped == false`: PATH frames render at row 22 cols 13-16 (verified: screenshot) [US-68]
- [ ] Fog Marsh in `marsh_trapped == true`: EDGE frames render at row 22 cols 13-16 (verified: screenshot) [US-68]

### Behavior — reads-as

Each reads-as is paired with an objective mechanism proxy.

- [ ] **"The path is gone" reads-as "I can't go back the way I came"**: a first-time observer who watches the threshold fire and sees the EDGE swap describes the south exit as "no longer walkable; the marsh is too deep there now" — NOT "I think the path is hidden." (verified via observer note in manual-verify doc) [US-66, US-68]
- [ ] **Closure mechanism proxy**: threshold sets `marsh_trapped: true` → exit-resolution pass evaluates `condition` and skips transition → `area.map` mutation (or overlay) makes cells wall → `renderDecorations` flips PATH to EDGE. Verified by source read of the call sequence. [US-66, US-67, US-68]
- [ ] **"I cannot do this alone" reads-as "this is hopeless"**: a first-time observer who triggers the third thought describes the player's situation as "stuck, no way out, doesn't know what to do" — NOT "the player will figure it out" or "this is just flavour text." (verified via observer note) [US-69]
- [ ] **Escalation mechanism proxy**: each band entry → `incrementFlag('escape_attempts')` → next band's condition evaluates true → next thought displays. Verified by source read of the increment + condition gate. [US-69]

### Error paths

- [ ] **Walking onto the now-walled exit cells**: collision is normal; no crash; no console error (verified manually) [US-67]
- [ ] **Tampered flag** (DevTools sets `marsh_trapped: true` from a fresh tab): on Fog Marsh load, the trap state is restored — exit is closed, EDGE decorations render — without the threshold trigger having fired this session. No console errors. (verified manually) [US-67, US-68]
- [ ] **Reset Progress while trapped**: clicking Reset Progress (existing TitleScene affordance) wipes `marsh_trapped` along with all flags via `resetAllFlags`; next session, Fog Marsh loads with the path open. (verified manually) [save-resume integration]
- [ ] **Tampered `escape_attempts`** (DevTools sets `escape_attempts: 99`): walking onto the band fires only the third (despair) thought, not multiple thoughts; mutual exclusion holds. (verified manually) [US-69]

### Editor sync

- [ ] `tools/editor/` builds and renders Fog Marsh's new conditional triggers, exit, and decorations visibly — area author can see what's new (verified) [US-66, US-67, US-69]

### Aesthetic traceability

- [ ] **"Mechanical truth, not warning labels"** (design direction) traces to: no UI text saying "Path closed!"; the closure is collision + decoration only [phase]
- [ ] **"Visual closure dominates the message"** (design direction) traces to: PATH→EDGE decoration swap on the same frame as collision; no fade [US-68]
- [ ] **"Escape-attempt feedback escalates"** (design direction) traces to: three thought triggers in escalating bands [US-69]
- [ ] **"Closed is closed"** (design direction) traces to: exit cells become walls; same `collidesWithWall` path as any wall [US-67]

### Invariants

- [ ] `npx tsc --noEmit && npm run build` passes [phase]
- [ ] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors during 90 seconds of play covering: New Game on Ashen Isle, walk to Old Man dialogue, walk to dock, transition to Fog Marsh, walk to Marsh Hermit, full dialogue, walk north past hermit, cross threshold, walk south, bump exit ≥ 4 times, force-close, reopen, Continue, observe state restored [phase]
- [ ] AGENTS.md "Behavior rules" gains a "Conditional exits and decorations" entry describing the shared `condition` field semantics (load-time and runtime evaluation, flag-change re-render contract, no-scene-restart rule) [phase]
- [ ] AGENTS.md "File ownership" rows updated for: `data/areas/types.ts` (added `TriggerDefinition.setFlags`, `TriggerDefinition.incrementFlags`, `DecorationDefinition.condition`), `data/areas/fog-marsh.ts` (threshold + escape triggers + conditional exit/decorations), `scenes/GameScene.ts` (decoration condition evaluation + flag-change re-render hook + collision flip), `triggers/flags.ts` (flag-change subscriber API or equivalent), `systems/triggerZone.ts` (consumes setFlags + incrementFlags) [phase]
- [ ] AGENTS.md "Directory layout" updated to add `docs/plan/fog-marsh-dead-end-manual-verify.md` [phase]
- [ ] **Loop-invariant audit (Learning EP-01):** confirmed no per-frame full decoration re-render; the flag-change hook only fires when the flag actually changed; no per-frame `evaluateCondition` for unconditional decorations; no per-frame `setTexture` with identical inputs [phase]
- [ ] **Atlas frame-pick verification (compounded):** PATH and EDGE frames reuse the existing `tiny-dungeon` indices verified during `tileset` and `world-legibility` phases; no new indices introduced [phase]
- [ ] **Deploy verification (Learning #65):** GitHub Pages deploy workflow succeeds for the squash-merge commit on `main` (green check) [phase]
- [ ] **Deploy smoke (Learning #65, post-deploy):** open the deployed `https://jaxsbr.github.io/emberpath/` URL, walk past the threshold, refresh, verify trap state is restored on Continue (closed exit collision + EDGE decoration both present) [phase]

## Golden principles (phase-relevant)

- **Parameterized systems:** the new conditional fields on `DecorationDefinition` and the new `setFlags`/`incrementFlags` fields on `TriggerDefinition` reuse `evaluateCondition` and `setFlag`/`incrementFlag` from existing modules — no new condition syntax, no parallel parser, no parallel flag store.
- **No silent breaking changes:** existing exits, decorations, and triggers without the new optional fields continue to behave as today (unconditional / no flag side-effect). The new fields are additive.
- **From LEARNINGS EP-01 (loop invariants):** flag-change-driven re-renders, not per-frame re-evaluation. The hook fires once per flag change. Conditional decorations re-evaluate visibility only when their referenced flags change.
- **From LEARNINGS #57 (depth-map authority):** no new visual layers; decorations remain at depth 2.
- **Zone-level mutual exclusion (LEARNINGS #56):** triggers and exits are already suppressed during dialogue / transitions / StoryScene; the new threshold trigger and escape bands inherit the same suppression.
- **Mechanical truth (`master-prd.md` Gospel Integration Principles):** the trap is collision and decoration, not UI text. The player doesn't read "you are stuck" — they walk into water that wasn't water.

## Out of scope

- The Keeper appearance, dialogue, ember-mark grant, or any rescue path. Deferred to phase `keeper-rescue`.
- Any change to Ashen Isle.
- Map geometry changes to Fog Marsh beyond the new triggers and decorations (no new tiles north of the current 24-row map).
- Multi-language support for the thought texts.
- Sound or music cue on the trap closing (audio pipeline = `audio-pass-1`, future).
- Mid-marsh save points or any save-system changes (handled by `save-resume`; this phase consumes, doesn't extend).
- Changing the order of beats — the player can still trigger the existing `whispering-stones` and `marsh-vision` story scenes regardless of trap state; this phase doesn't reroute those.

## AGENTS.md sections affected

When this phase ships, the Phase Reconciliation Gate will update:
- **Directory layout** — add `docs/plan/fog-marsh-dead-end-manual-verify.md`.
- **File ownership** — updated rows for `data/areas/types.ts`, `data/areas/fog-marsh.ts`, `scenes/GameScene.ts`, `triggers/flags.ts` (flag-change subscriber API), `systems/triggerZone.ts` (consumes setFlags + incrementFlags).
- **Behavior rules** — new "Conditional exits and decorations" entry covering: the shared `condition` field semantics, the flag-change re-render contract for decorations, the exit-resolution gate for inert exits, the no-scene-restart rule. New "Trigger flag side-effects" entry covering `setFlags` and `incrementFlags` on TriggerDefinition.
- **Depth map** — no change.
- **Scaling tuning guide** — no change.
