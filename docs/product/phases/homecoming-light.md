# Phase: homecoming-light

Status: draft

## Phase goal

Pip's "spiritual high" beat. After receiving the Ember Mark, Pip walks back to Ashen Isle and discovers the Ember has a verb: she can share warmth with people. Three NPCs model three responses to her witness — Wren (warmed easily, the first fruit), Old Man (wary, then warmed once Pip has perseverance), Driftwood (charming refusal). Each warming is a small interactive moment: a "Share warmth" dialogue choice that triggers a short ember-pulse animation, after which the target's light blooms, decorations near them un-fade, and a per-NPC warmed-state dialogue takes over. Cumulative warmings step Ashen Isle's overall fading down a notch each. The phase ends with a soft reflection — *"There is more light to share, beyond this island..."* — that sets up Briar Wilds without committing to its content.

### Stories in scope
- US-82 — Wren, the hopeful one (warmed)
- US-83 — Driftwood, the charming refusal
- US-84 — Old Man, wary then warmed
- US-85 — Ember-pulse: the share-warmth verb
- US-86 — Cumulative warming + closing reflection

### Design direction

The Ember-pulse moment must read as **gift-giving, not power-projection**. Warm gold (existing `EMBER_COLOR = 0xf2c878`), ease-out grow, soft fade on land, ~500–700ms. No screen-shake, no impact frame, no SFX more aggressive than a soft chime (audio is out of scope this phase but the visual must not pre-suppose a punchy SFX).

NPC personalities are storybook and distinct: Wren is light, chirpy, young — the child voice. Old Man is weary but tender once thawed — short sentences, long pauses implied by node breaks. Driftwood is smooth and worldly — likeable, never abrasive, talks about other lights he has seen. The build-loop applies the frontend-design skill to dialogue text and PixelLab portrait direction.

Refusal must read as **respectful**, not as failure. No red text, no error chime, no "X" icon. Driftwood declines, Pip moves on, the world is not diminished.

### Stories

#### US-82 — Wren, the hopeful one (warmed)

As a player who just received the Ember, I want to meet a hopeful NPC who responds joyfully to my offer to share warmth, so that the spiritual high feels like a real first fruit.

**Acceptance criteria:**
- A new NPC `wren` (a young wren — small brown bird; species matches the name, distinct silhouette from Pip the fox and from any other claimed NPC species) is rendered in Ashen Isle at a FLOOR tile position not occupied by Old Man or Driftwood.
- Wren has a pre-warming dialogue describing her own faded longing (3+ nodes).
- Wren's pre-warming dialogue has a "Share warmth" choice gated on `has_ember_mark == true && npc_warmed_wren == false`.
- Choosing "Share warmth" fires the ember-pulse (US-85), sets `npc_warmed_wren = true`, and continues into a brief grateful response.
- A post-warming dialogue script `wren-warmed` swaps in via the existing `DialogueScript.condition` mechanism when `npc_warmed_wren == true`.
- Wren auto-registers a tier-1 light at spawn (existing NPC lighting pathway).
- Wren has a portrait shown in dialogue.

**User guidance:**
- Discovery: After the Keeper rescue, walk south back to Ashen Isle. Wren is visible at a tile near the village.
- Manual section: `docs/plan/homecoming-light-manual-verify.md` (new file)
- Key steps: 1) Walk to Wren. 2) Press Space/tap to talk. 3) Choose "Share warmth." 4) Watch the ember-pulse and Wren's response. 5) Re-engage to confirm post-warming dialogue plays.

**Design rationale:** Wren models the easy-acceptance case — the parable's good soil. The interaction is intentionally low-friction so the spiritual-high beat reads as joyful first fruit, not a puzzle.

#### US-83 — Driftwood, the charming refusal

As a player, I want to meet an NPC who politely declines the Ember, so that the gospel's reality (not everyone responds) is mechanically present without being preached.

**Acceptance criteria:**
- A new NPC `driftwood` (sea otter, worldly traveler) is rendered in Ashen Isle near the shore tile region.
- Driftwood has a charming-but-cynical dialogue talking about other lights he has seen (3+ nodes).
- Driftwood's pre-attempt dialogue has a "Share warmth" choice gated on `has_ember_mark == true && npc_refused_driftwood == false`.
- Choosing "Share warmth" sets `npc_refused_driftwood = true` and routes to a polite-decline node — **no ember-pulse, no warming, no light bump**.
- A `driftwood-refused` script swaps in (`condition: 'npc_refused_driftwood == true'`) for subsequent encounters with at least 2 nodes; the "Share warmth" choice is not present in this variant.
- Driftwood's `lightOverride` configures a visually distinct tier-1 light (cooler tone via lower intensity, OR smaller radius — author's call) so he reads as "lit by his own thing."
- Driftwood has a portrait that conveys charm (warm but worldly).

**User guidance:**
- Discovery: Walk to Driftwood near the shore in Ashen Isle.
- Manual section: `docs/plan/homecoming-light-manual-verify.md`
- Key steps: 1) Walk to Driftwood. 2) Talk. 3) Choose "Share warmth." 4) Hear his polite refusal. 5) Re-engage; confirm "Share warmth" is no longer offered.

**Design rationale:** No villains — Driftwood is charming, not evil (Gospel principle #3). He represents the parable-of-the-sower's thorny-ground response — worldly wisdom that politely declines. The lack of pulse on refusal is a deliberate visual cue: nothing is taken from Pip when someone refuses.

#### US-84 — Old Man, wary then warmed

As a player, I want my first warming attempt on the cynical Old Man to be declined, then to succeed after I've warmed someone else, so that perseverance and witnessing-in-order are felt mechanically.

**Acceptance criteria:**
- The existing `old-man-illumined` script gains a "Share warmth" choice node that routes to a polite-decline node when Old Man is the target and Wren is not yet warmed.
- The "Share warmth" choice on Old Man is gated on `has_ember_mark == true && npc_warmed_old_man == false`.
- When `npc_warmed_wren == false`: the choice routes to a decline ("I've heard such promises before") — no pulse, no flag set on Old Man, conversational outcome only.
- A new variant `old-man-receptive` (`condition: 'has_ember_mark == true && npc_warmed_wren == true && npc_warmed_old_man == false'`) takes precedence; in this variant the "Share warmth" choice fires the pulse and sets `npc_warmed_old_man = true`.
- A new variant `old-man-warmed` (`condition: 'npc_warmed_old_man == true'`) swaps in for subsequent encounters with at least 2 nodes of warmed dialogue.
- Old Man's tier-1 light brightens on `npc_warmed_old_man` flip (same mechanism as Wren — see US-85).
- The pre-Ember `old-man-intro` dialogue is unchanged.

**User guidance:**
- Discovery: Talk to Old Man after returning to Ashen Isle. He'll acknowledge the Ember but decline at first.
- Manual section: `docs/plan/homecoming-light-manual-verify.md`
- Key steps: 1) Approach Old Man. 2) Talk. 3) Choose "Share warmth" — observe decline. 4) Walk to Wren and warm her. 5) Return to Old Man. 6) Choose "Share warmth" again — observe acceptance and pulse.

**Design rationale:** Wary-then-warmed mirrors the lived experience of the cynical-but-wounded who eventually receive after seeing another's transformation. The gate (Wren first) means the player feels "I had to start somewhere smaller before this one was ready" — a real witnessing pattern.

#### US-85 — Ember-pulse: the share-warmth verb

As a player, I want choosing "Share warmth" to feel like an action I performed, not just a line of text, so that ember-sharing reads as a verb.

**Acceptance criteria:**
- A new `EmberShareSystem` (file `src/systems/emberShare.ts`) exposes `startPulse(player, targetNpc, onComplete)`.
- During the pulse, `sharingInProgress = true` on `GameScene`; movement, NPC interaction, and trigger-zone evaluation suppress while true (zone-level mutual exclusion, same pattern as `transitionInProgress` / `spawnInProgress`).
- The pulse runs for `EMBER_PULSE_DURATION_MS = 600` (named constant, single source).
- Visual: a warm-gold (`EMBER_COLOR = 0xf2c878`) glow that grows from Pip and travels to the NPC, landing with a soft brightening flash on the NPC.
- On pulse end: callback fires (sets the `npc_warmed_<id>` flag and triggers any queued post-warming dialogue continuation).
- The pulse fires only on warming successes (Wren, Old-Man-receptive). Refusals (Driftwood) and wary-declines (Old Man pre-Wren) do NOT fire the pulse.
- On warming flag flip, the target NPC's tier-1 light is re-registered at higher intensity AND/OR radius (existing `LightingSystem.registerLight` idempotent overwrite — Learning #63).
- Alpha-gated decorations within the warmed NPC's light radius bloom in on the same flag-change tick (existing `maybeUpdateAlphaGates` forced-eval path on flag-change subscriber).
- Pulse GameObjects are tracked as instance fields on `EmberShareSystem` and reset at the top of the system's setup/restart-relevant method (Learning EP-02).
- Scene shutdown handler (`scene.events.on('shutdown', ...)`) cancels any in-flight tween and destroys any pulse GameObject — no leaked tweens (Learning EP-02).
- TypeScript build passes (`npx tsc --noEmit && npm run build`).

**User guidance:**
- Discovery: First seen during Wren's warming. Re-fires for Old Man's eventual acceptance.
- Manual section: `docs/plan/homecoming-light-manual-verify.md`
- Key steps: Choose "Share warmth" on a warmable NPC; observe the pulse animation, the NPC's light brightening, and any nearby alpha-gated decorations blooming in.

**Design rationale:** A dialogue-only "you shared warmth" line collapses the verb back into reading. The pulse is a small but felt moment — the player sees their action propagate visibly through the world. Implementation reuses the existing lighting and decoration infrastructure rather than introducing a parallel particle system.

#### US-86 — Cumulative warming + closing reflection

As a player, I want the world to grow visibly less faded as I warm people, and to feel a soft sense of completion when my witness on Ashen Isle is done, so that the spiritual-high arc reads as a journey through this island and a turning toward what's next.

**Acceptance criteria:**
- A derived value `effectiveDesaturationStrength` is computed as `LIGHTING_CONFIG.desaturationStrength × (1 − 0.15 × warmingsCount)` clamped ≥ 0.4, where `warmingsCount` = count of `true` warming flags (`npc_warmed_wren`, `npc_warmed_old_man`).
- The desaturation pipeline reads `effectiveDesaturationStrength`; the value is recomputed only on warming-flag-change events (Learning EP-01 — no per-frame full re-eval).
- The reduction is **visually noticeable but not full restoration** — Ashen Isle remains mostly faded after both warmings (the floor is set high enough that the world still reads as Ashen Isle, not as the Citadel).
- A new `homecoming-reflection` thought-trigger is added to `ashen-isle.ts` at a village-centre tile, condition `npc_warmed_wren == true && npc_warmed_old_man == true && homecoming_complete == false`, `repeatable: false`, with `setFlags: { homecoming_complete: true }`.
- The reflection trigger's `actionRef` points to a thought-bubble sequence with at least 3 lines, ending on "There is more light to share, beyond this island..."
- The trigger fires on entry; reuses existing `TriggerZoneSystem` semantics — no new mechanism.
- Reset Progress (`?reset=1` and the title-screen Reset button) restores the desaturation strength baseline AND clears `npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete` (existing `resetAllFlags` covers flags; the `effectiveDesaturationStrength` derived value reverts to baseline via the same flag-change subscriber notifying with `undefined`).
- The reflection beat fires only after the player has moved off the trigger after the second warming (existing one-shot trigger semantics; the player walking through the village centre during/after warming dialogue is the natural fire point).

**User guidance:**
- Discovery: After warming Wren and Old Man, walk through Ashen Isle and notice the world has softened. A reflection thought fires when Pip walks through the village centre.
- Manual section: `docs/plan/homecoming-light-manual-verify.md`
- Key steps: Warm Wren; warm Old Man; walk; observe the cumulative desaturation reduction; observe the reflection bubble; press Reset Progress; observe baseline restored.

**Design rationale:** Cumulative effect makes restoration *visually felt* — mechanical truth (Gospel principle #2). The closing reflection is narrative scaffolding for Briar Wilds without committing to that area's content yet. The clamp at 0.4 preserves the island's identity so Ashen Isle never becomes "fixed" by witness alone — only the Heart Bridge fully removes the Fading.

## Done-when (observable)

### US-82 — Wren

- [ ] Asset directory `assets/npc/wren/` contains 8 idle directions × 4 frames + 8 walk directions × 4 frames + 8 static poses + `portrait.png` [US-82]
- [ ] `NPC_SPRITES` registry in `src/systems/npcSprites.ts` includes `wren` with `idleFrameCount: 4, walkFrameCount: 4` [US-82]
- [ ] `NPC_PORTRAITS` registry includes `wren` entry with appropriate filter [US-82]
- [ ] `src/data/areas/ashen-isle.ts` adds an `NpcDefinition` with `id: 'wren'`, `sprite: 'wren'`, `(col, row)` on a FLOOR tile within map bounds and not within 2 tiles of Old Man or Driftwood [US-82]
- [ ] `wren-intro` dialogue script defined in `ashen-isle.ts` with at least 3 nodes; one node terminates in a `choices` block including a "Share warmth" option [US-82]
- [ ] The "Share warmth" choice on Wren is gated via a node-level conditional path (or equivalent) that depends on `has_ember_mark == true && npc_warmed_wren == false` [US-82]
- [ ] `wren-warmed` dialogue script defined with `condition: 'npc_warmed_wren == true'` and at least 2 nodes [US-82]
- [ ] On choosing "Share warmth," `EmberShareSystem.startPulse` is invoked with Wren as target; the `onComplete` callback sets `npc_warmed_wren = true` (via `setFlag`) and resumes dialogue into the grateful node [US-82]
- [ ] Wren auto-registers a tier-1 light at spawn via the existing NPC light-registration pathway [US-82]
- [ ] Manual-verify section for Wren in `docs/plan/homecoming-light-manual-verify.md` includes checkboxes for: render, pre-warming dialogue, share-warmth choice availability, ember-pulse plays, post-warming dialogue swap, light brightening [US-82]

### US-83 — Driftwood

- [ ] Asset directory `assets/npc/driftwood/` complete (same shape as Wren — 8×idle, 8×walk, 8×static, portrait.png) [US-83]
- [ ] `NPC_SPRITES` and `NPC_PORTRAITS` registries include `driftwood` [US-83]
- [ ] `ashen-isle.ts` adds Driftwood `NpcDefinition` near the shore tile region (FLOOR tile) [US-83]
- [ ] `driftwood-intro` dialogue script with at least 3 nodes including a "Share warmth" choice gated on `has_ember_mark == true && npc_refused_driftwood == false` [US-83]
- [ ] Choosing "Share warmth" on Driftwood sets `npc_refused_driftwood = true` and routes to a polite-decline node — `EmberShareSystem.startPulse` is **not** invoked [US-83]
- [ ] `driftwood-refused` script with `condition: 'npc_refused_driftwood == true'` and at least 2 nodes; the "Share warmth" choice is absent from this variant [US-83]
- [ ] Driftwood's `lightOverride` produces a visually distinct light from Wren's and Old Man's (lower intensity OR smaller radius — chosen value committed in code, observable by F3 debug overlay) [US-83]
- [ ] Manual-verify section for Driftwood: render, pre-attempt dialogue, refusal flag set on choice, no pulse plays on refusal, choice no longer offered on re-engage [US-83]

### US-84 — Old Man

- [ ] `old-man-illumined` script extended with a "Share warmth" choice that routes to a `decline` node (existing nodes preserved; new branching) [US-84]
- [ ] When `npc_warmed_wren == false`, choosing "Share warmth" fires no pulse and sets no Old Man flag (verified via flag-store inspection after the choice fires) [US-84]
- [ ] New script `old-man-receptive` defined with `condition: 'has_ember_mark == true && npc_warmed_wren == true && npc_warmed_old_man == false'`; takes precedence over `old-man-illumined` due to longer/more specific condition [US-84]
- [ ] `old-man-receptive`'s "Share warmth" choice invokes `EmberShareSystem.startPulse` with Old Man as target; `onComplete` sets `npc_warmed_old_man = true` [US-84]
- [ ] New script `old-man-warmed` (`condition: 'npc_warmed_old_man == true'`) with at least 2 nodes of warmed dialogue [US-84]
- [ ] Script-selection order verified: `old-man-warmed` > `old-man-receptive` > `old-man-illumined` > `old-man-intro` (manual-verify subsection walks the four states explicitly) [US-84]
- [ ] Old Man's tier-1 light brightens on `npc_warmed_old_man` flip (same mechanism as Wren) [US-84]
- [ ] Manual-verify section for Old Man covers all four states: pre-Ember intro, post-Ember wary decline, post-Wren acceptance with pulse, post-warming dialogue [US-84]

### US-85 — Ember-pulse system

- [ ] New file `src/systems/emberShare.ts` exports `EmberShareSystem` class [US-85]
- [ ] `EmberShareSystem.startPulse(playerSprite, targetNpcSprite, onComplete)` accepts the two endpoints and a callback; returns void [US-85]
- [ ] `GameScene` exposes `sharingInProgress: boolean` flag set true at pulse start, false at pulse end (or via `setSharingInProgress(true/false)` if encapsulated) [US-85]
- [ ] During `sharingInProgress === true`: movement is suppressed (early-return in `update` world-walk branch), NPC interaction is suppressed, trigger-zone evaluation is suppressed [US-85]
- [ ] `EMBER_PULSE_DURATION_MS = 600` is a named constant in `emberShare.ts` (single source; not duplicated) [US-85]
- [ ] Pulse visual: a `Phaser.GameObjects.Arc` (or equivalent) with `EMBER_COLOR = 0xf2c878`, growing radius, traveling from `player.x/y` to `npc.x/y`, alpha tweened to fade on land [US-85]
- [ ] Pulse renders at `depth ≥ 5.5` (same band as the player ember overlay) and is ignored by the UI camera (`uiCam.ignore`) [US-85]
- [ ] On pulse end, the supplied `onComplete` callback fires; the system clears its in-flight references [US-85]
- [ ] Pulse GameObject reference + tween reference are tracked as instance fields and reset at the top of `EmberShareSystem`'s setup method (Learning EP-02) [US-85]
- [ ] Scene shutdown handler (`scene.events.on('shutdown', ...)` registered in the system) cancels in-flight tween and destroys pulse GameObject; verified by enter→share→leave-area-mid-pulse scenario in manual-verify [US-85]
- [ ] On warming flag flip, target NPC's tier-1 light is re-registered with higher intensity/radius via existing `LightingSystem.registerLight` (idempotent overwrite — Learning #63) [US-85]
- [ ] Alpha-gated decorations within the warmed NPC's new light radius bloom in on the warming flag-change tick (existing `maybeUpdateAlphaGates` forced re-eval triggered from `onFlagChange('npc_warmed_<id>')` subscriber) [US-85]
- [ ] No-pulse path verified: refusal (Driftwood) and wary-decline (Old Man pre-Wren) produce no pulse GameObject (manual-verify subsection covers this explicitly) [US-85]
- [ ] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-85]
- [ ] Manual-verify "reads as" test: choose Share warmth → the pulse reads as gift-giving, not power-projection (no shake, no aggressive easing, gentle fade) [US-85]

### US-86 — Cumulative warming + closing reflection

- [ ] `effectiveDesaturationStrength` is computed from `warmingsCount` (count of `true` warming flags) using `base × (1 − 0.15 × warmingsCount)` clamped ≥ 0.4 [US-86]
- [ ] The value is recomputed on warming-flag-change events only (subscriber registered for `npc_warmed_wren`, `npc_warmed_old_man`); not per-frame (Learning EP-01) [US-86]
- [ ] The desaturation pipeline reads the recomputed value; visual desaturation reduction is observable post-warming (manual-verify subsection includes a before/after reads-as observation) [US-86]
- [ ] Floor of 0.4 preserves Ashen Isle's faded identity (both NPCs warmed → world is softer but still reads as Ashen Isle, not as restored) [US-86]
- [ ] `homecoming-reflection` thought-trigger added to `ashen-isle.ts` at a village-centre tile (col/row committed in code, FLOOR tile, near the existing tapestry/Old Man area) [US-86]
- [ ] Trigger condition: `npc_warmed_wren == true && npc_warmed_old_man == true && homecoming_complete == false` [US-86]
- [ ] Trigger config: `repeatable: false`, `setFlags: { homecoming_complete: true }`, `type: 'thought'` [US-86]
- [ ] The reflection thought-bubble sequence has at least 3 lines, ending on "There is more light to share, beyond this island..." (or close paraphrase committed in code) [US-86]
- [ ] Reset Progress restores baseline: after `resetAllFlags`, the desaturation flag-change subscriber notifies with `undefined` for warming flags, `effectiveDesaturationStrength` reverts to `LIGHTING_CONFIG.desaturationStrength` [US-86]
- [ ] Reset Progress clears `npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete` (covered by existing `resetAllFlags` — verified via flag-store snapshot in manual-verify) [US-86]
- [ ] Manual-verify section: walk after both warmings, observe softened color, observe reflection bubble at village centre, press Reset Progress, observe baseline restored [US-86]

### Auto-added safety criteria

- [ ] All "Share warmth" dialogue choice conditions parse through the existing `evaluateCondition` parser — no new condition syntax, no `eval`/`Function` constructor introduced [phase]
- [ ] NPC sprite/portrait paths come from the registries (`NPC_SPRITES`, `NPC_PORTRAITS`), never user-provided strings — no path-traversal risk surface [phase]
- [ ] Dialogue text rendering uses the existing typewriter `text` property path (no `innerHTML` or raw-string DOM injection) [phase]

### Async-cleanup safety

- [ ] Pulse tween is cancelled on `scene.events.shutdown` — no orphaned timer callbacks (verified by enter→start-pulse→exit-area test in manual-verify) [phase]
- [ ] Every `onFlagChange` subscriber added by this phase (effective-desaturation recompute, light-brightening on warm, alpha-gate force-eval) collects an unsubscribe function and invokes it in `cleanupResize` / scene-shutdown handler [phase]

### Class baseline check (new NPCs join the existing NPC class)

- [ ] Wren and Driftwood each register a tier-1 light at spawn via the existing auto-registration pathway [class:US-82, class:US-83]
- [ ] Wren and Driftwood each appear in the F3 debug overlay's NPC interaction/wander/awareness radius rendering [class:US-82, class:US-83]
- [ ] Wren and Driftwood are scoped to Ashen Isle only (do not appear in Fog Marsh) [class:US-82, class:US-83]
- [ ] Wren and Driftwood have wander and awareness configured per the existing pattern (`wanderRadius` ≥ 1, `awarenessRadius` ≥ 1; values committed in code) [class:US-82, class:US-83]
- [ ] Wren and Driftwood clean up on `scene.shutdown` per existing `NpcBehaviorSystem` lifecycle (no new cleanup code required, but verified) [class:US-82, class:US-83]

### Variant baseline check (warming visuals apply across multiple NPC variants)

- [ ] Light brightening on warming verified for both Wren AND Old Man — explicit per-NPC manual-verify checkbox; no "tested with one, assumed for both" [US-85]
- [ ] Alpha-gated decoration bloom on warming verified for both Wren AND Old Man — explicit per-NPC manual-verify checkbox [US-85]
- [ ] Driftwood verified to NOT brighten and NOT bloom — explicit negative checkbox in manual-verify [US-85]

### Phase-level / structural

- [ ] `AGENTS.md` updated with: new EmberShareSystem entry in File ownership; new "Ember sharing" Behavior rule; `sharingInProgress` added to the zone-level mutual exclusion list; new flags (`npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete`) named in the flag-persistence rule [phase]
- [ ] Per-NPC unique encounter polish (beyond warmed/wary/refusing categories) is OUT OF SCOPE for this phase — deferred to `polish-and-vibe` per master PRD [phase]
- [ ] Manual-verify file `docs/plan/homecoming-light-manual-verify.md` exists with subsections per story plus a "reads as" observer-test section [phase]
- [ ] Atlas frame-pick verification rule: this phase introduces new whole-image NPC sprite art (PixelLab-generated) but no new atlas frame-index literals; the rule does NOT apply. Noted explicitly here and in the manual-verify doc to prevent future confusion [phase]

## Golden principles (phase-relevant)

- **Show, don't preach** — allegory works as game story first
- **Mechanical truth** — restoration is felt, not told (cumulative desaturation, ember-pulse, light bloom)
- **No villains** — Driftwood is charming, not evil; refusal reads as respectful
- **Free gift** — the Ember is given onward, not earned; the player chooses to share, the NPC receives or declines
- **Restoration targets persons, not objects** — Pip never shares the Ember with inanimate things; decoration changes follow as consequences of warming a person nearby
- **Loop-invariant operations and dead-guard avoidance (Learning EP-01)** — desaturation recomputed on flag-change only, not per-frame; pulse setup not re-run per tick
- **Phaser scene-restart hygiene (Learning EP-02)** — EmberShareSystem instance fields reset at the top of setup; tween cancellation on shutdown

## AGENTS.md sections affected

- **File ownership** — add `systems/emberShare.ts` row (EmberShareSystem responsibilities)
- **Behavior rules** — add "Ember sharing" rule (the share-warmth verb, sharingInProgress mutual exclusion, pulse-only-on-warming, light bump + alpha-gate bloom on flag change); add `sharingInProgress` to the zone-level mutual exclusion item
- **Flag persistence** — list new flags (`npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete`) and their reset behavior
- **Depth map** — verify pulse depth assignment fits the existing band (5.5); update only if a new band is needed (none expected)

## User documentation impact

- New file: `docs/plan/homecoming-light-manual-verify.md` — per-story walkthroughs + reads-as observer tests + reset-progress verification
- No master-PRD update needed for this phase (the master PRD already lists `homecoming-light` in the Implementation Roadmap)
- PRD index (`docs/product/PRD.md`) updated by the spec-author auto-proceed step with a new row: `| homecoming-light | Draft | US-82, US-83, US-84, US-85, US-86 | [phases/homecoming-light.md](phases/homecoming-light.md) |`
