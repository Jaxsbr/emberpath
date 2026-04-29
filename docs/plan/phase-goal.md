# Phase: homecoming-light

## Phase goal

Pip's "spiritual high" beat. After receiving the Ember Mark, Pip walks back to Ashen Isle and discovers the Ember has a verb: she can share warmth with people. Three NPCs model three responses to her witness — Wren (warmed easily, the first fruit), Old Man (wary, then warmed once Pip has perseverance), Driftwood (charming refusal). Each warming is a small interactive moment: a "Share warmth" dialogue choice that triggers a short ember-pulse animation, after which the target's light blooms, decorations near them un-fade, and a per-NPC warmed-state dialogue takes over. Cumulative warmings step Ashen Isle's overall fading down a notch each. The phase ends with a soft reflection — *"There is more light to share, beyond this island..."* — that sets up Briar Wilds without committing to its content.

### Stories in scope
- US-82 — Wren, the hopeful one (warmed)
- US-83 — Driftwood, the charming refusal
- US-84 — Old Man, wary then warmed
- US-85 — Ember-pulse: the share-warmth verb
- US-86 — Cumulative warming + closing reflection

### Done-when (observable)

#### US-82 — Wren

- [x] Asset directory `assets/npc/wren/` contains 8 idle directions × 4 frames + 8 walk directions × 4 frames + 8 static poses + `portrait.png` [US-82]
- [x] `NPC_SPRITES` registry in `src/systems/npcSprites.ts` includes `wren` with `idleFrameCount: 4, walkFrameCount: 4` [US-82]
- [x] `NPC_PORTRAITS` registry includes `wren` entry with appropriate filter [US-82]
- [x] `src/data/areas/ashen-isle.ts` adds an `NpcDefinition` with `id: 'wren'`, `sprite: 'wren'`, `(col, row)` on a FLOOR tile within map bounds and not within 2 tiles of Old Man or Driftwood [US-82]
- [x] `wren-intro` dialogue script defined in `ashen-isle.ts` with at least 3 nodes; one node terminates in a `choices` block including a "Share warmth" option [US-82]
- [x] The "Share warmth" choice on Wren is gated via a node-level conditional path (or equivalent) that depends on `has_ember_mark == true && npc_warmed_wren == false` [US-82]
- [x] `wren-warmed` dialogue script defined with `condition: 'npc_warmed_wren == true'` and at least 2 nodes [US-82]
- [x] On choosing "Share warmth," `EmberShareSystem.startPulse` is invoked with Wren as target; the `onComplete` callback sets `npc_warmed_wren = true` (via `setFlag`) and resumes dialogue into the grateful node [US-82]
- [x] Wren auto-registers a tier-1 light at spawn via the existing NPC light-registration pathway [US-82]
- [x] Manual-verify section for Wren in `docs/plan/homecoming-light-manual-verify.md` includes checkboxes for: render, pre-warming dialogue, share-warmth choice availability, ember-pulse plays, post-warming dialogue swap, light brightening [US-82]

#### US-83 — Driftwood

- [x] Asset directory `assets/npc/driftwood/` complete (same shape as Wren — 8×idle, 8×walk, 8×static, portrait.png) [US-83]
- [x] `NPC_SPRITES` and `NPC_PORTRAITS` registries include `driftwood` [US-83]
- [x] `ashen-isle.ts` adds Driftwood `NpcDefinition` near the shore tile region (FLOOR tile) [US-83]
- [x] `driftwood-intro` dialogue script with at least 3 nodes including a "Share warmth" choice gated on `has_ember_mark == true && npc_refused_driftwood == false` [US-83]
- [x] Choosing "Share warmth" on Driftwood sets `npc_refused_driftwood = true` and routes to a polite-decline node — `EmberShareSystem.startPulse` is **not** invoked [US-83]
- [x] `driftwood-refused` script with `condition: 'npc_refused_driftwood == true'` and at least 2 nodes; the "Share warmth" choice is absent from this variant [US-83]
- [x] Driftwood's `lightOverride` produces a visually distinct light from Wren's and Old Man's (lower intensity OR smaller radius — chosen value committed in code, observable by F3 debug overlay) [US-83]
- [x] Manual-verify section for Driftwood: render, pre-attempt dialogue, refusal flag set on choice, no pulse plays on refusal, choice no longer offered on re-engage [US-83]

#### US-84 — Old Man

- [x] `old-man-illumined` script extended with a "Share warmth" choice that routes to a `decline` node (existing nodes preserved; new branching) [US-84]
- [x] When `npc_warmed_wren == false`, choosing "Share warmth" fires no pulse and sets no Old Man flag (verified via flag-store inspection after the choice fires) [US-84]
- [x] New script `old-man-receptive` defined with `condition: 'has_ember_mark == true && npc_warmed_wren == true && npc_warmed_old_man == false'`; takes precedence over `old-man-illumined` due to longer/more specific condition [US-84]
- [x] `old-man-receptive`'s "Share warmth" choice invokes `EmberShareSystem.startPulse` with Old Man as target; `onComplete` sets `npc_warmed_old_man = true` [US-84]
- [x] New script `old-man-warmed` (`condition: 'npc_warmed_old_man == true'`) with at least 2 nodes of warmed dialogue [US-84]
- [x] Script-selection order verified: `old-man-warmed` > `old-man-receptive` > `old-man-illumined` > `old-man-intro` (manual-verify subsection walks the four states explicitly) [US-84]
- [x] Old Man's tier-1 light brightens on `npc_warmed_old_man` flip (same mechanism as Wren) [US-84]
- [x] Manual-verify section for Old Man covers all four states: pre-Ember intro, post-Ember wary decline, post-Wren acceptance with pulse, post-warming dialogue [US-84]

#### US-85 — Ember-pulse system

- [x] New file `src/systems/emberShare.ts` exports `EmberShareSystem` class [US-85]
- [x] `EmberShareSystem.startPulse(playerSprite, targetNpcSprite, onComplete)` accepts the two endpoints and a callback; returns void [US-85]
- [x] `GameScene` exposes `sharingInProgress: boolean` flag set true at pulse start, false at pulse end (or via `setSharingInProgress(true/false)` if encapsulated) [US-85]
- [x] During `sharingInProgress === true`: movement is suppressed (early-return in `update` world-walk branch), NPC interaction is suppressed, trigger-zone evaluation is suppressed [US-85]
- [x] `EMBER_PULSE_DURATION_MS = 600` is a named constant in `emberShare.ts` (single source; not duplicated) [US-85]
- [x] Pulse visual: a `Phaser.GameObjects.Arc` (or equivalent) with `EMBER_COLOR = 0xf2c878`, growing radius, traveling from `player.x/y` to `npc.x/y`, alpha tweened to fade on land [US-85]
- [x] Pulse renders at `depth ≥ 5.5` (same band as the player ember overlay) and is ignored by the UI camera (`uiCam.ignore`) [US-85]
- [x] On pulse end, the supplied `onComplete` callback fires; the system clears its in-flight references [US-85]
- [x] Pulse GameObject reference + tween reference are tracked as instance fields and reset at the top of `EmberShareSystem`'s setup method (Learning EP-02) [US-85]
- [x] Scene shutdown handler (`scene.events.on('shutdown', ...)` registered in the system) cancels in-flight tween and destroys pulse GameObject; verified by enter→share→leave-area-mid-pulse scenario in manual-verify [US-85]
- [x] On warming flag flip, target NPC's tier-1 light is re-registered with higher intensity/radius via existing `LightingSystem.registerLight` (idempotent overwrite — Learning #63) [US-85]
- [x] Alpha-gated decorations within the warmed NPC's new light radius bloom in on the warming flag-change tick (existing `maybeUpdateAlphaGates` forced re-eval triggered from `onFlagChange('npc_warmed_<id>')` subscriber) [US-85]
- [x] No-pulse path verified: refusal (Driftwood) and wary-decline (Old Man pre-Wren) produce no pulse GameObject (manual-verify subsection covers this explicitly) [US-85]
- [x] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-85]
- [x] Manual-verify "reads as" test: choose Share warmth → the pulse reads as gift-giving, not power-projection (no shake, no aggressive easing, gentle fade) [US-85]

#### US-86 — Cumulative warming + closing reflection

- [x] `effectiveDesaturationStrength` is computed from `warmingsCount` (count of `true` warming flags) using `base × (1 − 0.15 × warmingsCount)` clamped ≥ 0.4 [US-86]
- [x] The value is recomputed on warming-flag-change events only (subscriber registered for `npc_warmed_wren`, `npc_warmed_old_man`); not per-frame (Learning EP-01) [US-86]
- [x] The desaturation pipeline reads the recomputed value; visual desaturation reduction is observable post-warming (manual-verify subsection includes a before/after reads-as observation) [US-86]
- [x] Floor of 0.4 preserves Ashen Isle's faded identity (both NPCs warmed → world is softer but still reads as Ashen Isle, not as restored) [US-86]
- [x] `homecoming-reflection` thought-trigger added to `ashen-isle.ts` at a village-centre tile (col/row committed in code, FLOOR tile, near the existing tapestry/Old Man area) [US-86]
- [x] Trigger condition: `npc_warmed_wren == true && npc_warmed_old_man == true && homecoming_complete == false` [US-86]
- [x] Trigger config: `repeatable: false`, `setFlags: { homecoming_complete: true }`, `type: 'thought'` [US-86]
- [x] The reflection thought-bubble sequence has at least 3 lines, ending on "There is more light to share, beyond this island..." (or close paraphrase committed in code) [US-86]
- [x] Reset Progress restores baseline: after `resetAllFlags`, the desaturation flag-change subscriber notifies with `undefined` for warming flags, `effectiveDesaturationStrength` reverts to `LIGHTING_CONFIG.desaturationStrength` [US-86]
- [x] Reset Progress clears `npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete` (covered by existing `resetAllFlags` — verified via flag-store snapshot in manual-verify) [US-86]
- [x] Manual-verify section: walk after both warmings, observe softened color, observe reflection bubble at village centre, press Reset Progress, observe baseline restored [US-86]

#### Auto-added safety criteria

- [x] All "Share warmth" dialogue choice conditions parse through the existing `evaluateCondition` parser — no new condition syntax, no `eval`/`Function` constructor introduced [phase]
- [x] NPC sprite/portrait paths come from the registries (`NPC_SPRITES`, `NPC_PORTRAITS`), never user-provided strings — no path-traversal risk surface [phase]
- [x] Dialogue text rendering uses the existing typewriter `text` property path (no `innerHTML` or raw-string DOM injection) [phase]

#### Async-cleanup safety

- [x] Pulse tween is cancelled on `scene.events.shutdown` — no orphaned timer callbacks (verified by enter→start-pulse→exit-area test in manual-verify) [phase]
- [x] Every `onFlagChange` subscriber added by this phase (effective-desaturation recompute, light-brightening on warm, alpha-gate force-eval) collects an unsubscribe function and invokes it in `cleanupResize` / scene-shutdown handler [phase]

#### Class baseline check (new NPCs join the existing NPC class)

- [x] Wren and Driftwood each register a tier-1 light at spawn via the existing auto-registration pathway [class:US-82, class:US-83]
- [x] Wren and Driftwood each appear in the F3 debug overlay's NPC interaction/wander/awareness radius rendering [class:US-82, class:US-83]
- [x] Wren and Driftwood are scoped to Ashen Isle only (do not appear in Fog Marsh) [class:US-82, class:US-83]
- [x] Wren and Driftwood have wander and awareness configured per the existing pattern (`wanderRadius` ≥ 1, `awarenessRadius` ≥ 1; values committed in code) [class:US-82, class:US-83]
- [x] Wren and Driftwood clean up on `scene.shutdown` per existing `NpcBehaviorSystem` lifecycle (no new cleanup code required, but verified) [class:US-82, class:US-83]

#### Variant baseline check (warming visuals apply across multiple NPC variants)

- [x] Light brightening on warming verified for both Wren AND Old Man — explicit per-NPC manual-verify checkbox; no "tested with one, assumed for both" [US-85]
- [x] Alpha-gated decoration bloom on warming verified for both Wren AND Old Man — explicit per-NPC manual-verify checkbox [US-85]
- [x] Driftwood verified to NOT brighten and NOT bloom — explicit negative checkbox in manual-verify [US-85]

#### Phase-level / structural

- [x] `AGENTS.md` updated with: new EmberShareSystem entry in File ownership; new "Ember sharing" Behavior rule; `sharingInProgress` added to the zone-level mutual exclusion list; new flags (`npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete`) named in the flag-persistence rule [phase]
- [x] Per-NPC unique encounter polish (beyond warmed/wary/refusing categories) is OUT OF SCOPE for this phase — deferred to `polish-and-vibe` per master PRD [phase]
- [x] Manual-verify file `docs/plan/homecoming-light-manual-verify.md` exists with subsections per story plus a "reads as" observer-test section [phase]
- [x] Atlas frame-pick verification rule: this phase introduces new whole-image NPC sprite art (PixelLab-generated) but no new atlas frame-index literals; the rule does NOT apply. Noted explicitly here and in the manual-verify doc to prevent future confusion [phase]

### Golden principles (phase-relevant)

- **Show, don't preach** — allegory works as game story first
- **Mechanical truth** — restoration is felt, not told (cumulative desaturation, ember-pulse, light bloom)
- **No villains** — Driftwood is charming, not evil; refusal reads as respectful
- **Free gift** — the Ember is given onward, not earned; the player chooses to share, the NPC receives or declines
- **Restoration targets persons, not objects** — Pip never shares the Ember with inanimate things; decoration changes follow as consequences of warming a person nearby
- **Loop-invariant operations and dead-guard avoidance (Learning EP-01)** — desaturation recomputed on flag-change only, not per-frame; pulse setup not re-run per tick
- **Phaser scene-restart hygiene (Learning EP-02)** — EmberShareSystem instance fields reset at the top of setup; tween cancellation on shutdown
