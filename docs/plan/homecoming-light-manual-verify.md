# homecoming-light — Manual Verify

Run after every code change in this phase. Fresh-tab verification: `?reset=1` (and Reset Progress button) baselines world state.

## Atlas frame-pick verification (rule)

This phase introduces NEW WHOLE-IMAGE NPC sprite assets (PixelLab-generated PNGs), but NO new atlas-frame-index literals. The atlas-frame-pick rule does NOT apply to this phase. The asset directories `assets/npc/wren/` and `assets/npc/driftwood/` use the same per-direction PNG layout as `assets/npc/heron/`; the renderer iterates files by direction + frame_NNN.png convention, not by atlas frame index.

---

## Scenario 1 — Wren walkthrough (US-82)

Pre-conditions: post-keeper-rescue resume (or play through fog-marsh-dead-end + keeper-rescue → return to Ashen Isle).

- [ ] Wren is rendered at the central village tile (col 22, row 18) on the FLOOR layer. Sprite reads as a chestnut wren with a dusty-rose scarf, distinctly smaller and rounder than the heron and the fox.
- [ ] Walk up to Wren and press Space (or tap). The pre-warming dialogue `wren-receptive` plays: 3+ nodes ending on the offer node "Could you... share some? Just a little?" with two choices.
- [ ] The offer node has a "Share warmth" choice and a "Not yet" choice.
- [ ] Pick "Share warmth." A warm-gold pulse grows from Pip and travels to Wren, fading on land. Movement and interaction are suppressed during the pulse (~600ms).
- [ ] After the pulse, dialogue advances to `grateful` ("...!! Oh — oh, that's it.") then `thanks` and closes.
- [ ] Re-engage Wren. The post-warming script `wren-warmed` plays — 2 nodes, "You walked back! I hoped you would." → "I feel it still. Bright in here, just under the wings."
- [ ] After warming, Wren's NPC light is brighter than before (visible in fog; toggle F4 lighting on/off to compare).
- [ ] In the F3 debug HUD, the lights count includes Wren's id at the brighter radius.

---

## Scenario 2 — Driftwood walkthrough (US-83)

- [ ] Driftwood is rendered near the dock at (col 32, row 6). Sea otter silhouette, sea-green scarf, distinctly larger than Wren and Old Man.
- [ ] Pre-attempt dialogue (`driftwood-receptive` once you have the Ember): 3+ nodes ending on offer "Suppose you'd like to share some?"
- [ ] Choose "Share warmth." NO ember-pulse plays. Dialogue routes to the polite-decline node ("Kind of you. Truly. But I've got my own light…").
- [ ] After the choice fires, the flag store has `npc_refused_driftwood = true` (verify via DevTools → `localStorage.getItem('emberpath_flags')`).
- [ ] Re-engage Driftwood. The post-refusal script `driftwood-refused` plays — 2 nodes, "Still walking? Good. The dock is here when you're tired." The "Share warmth" choice is absent.
- [ ] Driftwood's tier-1 light is visibly distinct from Wren's and Old Man's — `lightOverride.intensity = 0.18` is dimmer than the default 0.25. F3 HUD `lights` line confirms.

---

## Scenario 3 — Old Man four states (US-84)

The Old Man's dialogue resolves in selectScriptForNpc walking the dictionary in insertion order; first matching condition wins. Walk all four states:

- [ ] **State A — pre-Ember intro.** Fresh save, no Ember. Talk to Old Man → `old-man-intro` plays ("You walk. I forgot how.").
- [ ] **State B — post-Ember wary decline.** After Keeper rescue (`has_ember_mark = true`), but Wren NOT yet warmed. Talk to Old Man → `old-man-illumined` plays. Pick "Share warmth" → routes to `wary_decline` ("No. Not yet. I've been wrong before."). Verify the flag store: `npc_warmed_old_man` is NOT set after this choice.
- [ ] **State C — post-Wren acceptance with pulse.** First warm Wren (Scenario 1), then return to Old Man. `old-man-receptive` plays. Pick "Share warmth" → ember-pulse animates from Pip to Old Man, lands, dialogue advances to `received` ("…oh. Oh.") then `parting`.
- [ ] **State D — post-warming.** Re-engage Old Man → `old-man-warmed` plays — 2 nodes, "You're back. Sit a moment, walker." → "I'd forgotten how the morning felt."

---

## Scenario 4 — Ember-pulse reads-as test (US-85)

- [ ] Choose "Share warmth" on a warmable NPC (Wren or post-Wren Old Man). The pulse reads as gift-giving: warm gold, ease-out grow, gentle fade. NO screen shake. NO aggressive easing. NO impact frame.
- [ ] Pulse duration feels brief (~600ms) — long enough to register, short enough not to drag.
- [ ] Movement input is fully suppressed during the pulse — pressing WASD or moving the joystick has no effect; the player sprite holds its position.
- [ ] No-pulse paths: confirm refusal (Driftwood "Share warmth") and wary-decline (Old Man pre-Wren "Share warmth") produce NO pulse GameObject in the world. Toggle F3 debug — no transient circle entities appear at the choice moment for these two paths.
- [ ] Scene-shutdown teardown: enter Wren's dialogue, pick "Share warmth," then mid-pulse trigger an area transition (walk into the south fog-marsh exit). The pulse should NOT leak into the next scene; the tween cancels on scene shutdown and the GameObject is destroyed.

---

## Scenario 5 — Cumulative desaturation + reflection (US-86)

- [ ] Before any warming: F3 HUD `desaturation: 1.00` (the `LIGHTING_CONFIG.desaturationStrength` base).
- [ ] Warm Wren. F3 HUD updates to `desaturation: 0.85` (1.0 × (1 − 0.15)). Visually, the world is slightly less grey within the lit radius.
- [ ] Warm Old Man (after Wren). F3 HUD updates to `desaturation: 0.70`. World softer still, but Ashen Isle remains visibly faded — floor 0.4 preserves the island's identity.
- [ ] Walk through (col 24, row 22). The `homecoming-reflection` thought bubble fires with three lines: "Two warmer than they were." → "What stays is mine to carry." → "There is more light to share, beyond this island..."
- [ ] After the reflection, walking back through (24, 22) does NOT re-fire the trigger (one-shot via `repeatable: false` AND the `homecoming_complete == false` condition gate).
- [ ] Press **Reset Progress** (title screen Reset button or `?reset=1`). Re-enter Ashen Isle. F3 HUD shows `desaturation: 1.00` (baseline restored). Wren's and Old Man's lights are at baseline radius/intensity. `npc_warmed_wren`, `npc_warmed_old_man`, `npc_refused_driftwood`, `homecoming_complete` are all gone from the flag store.

---

## Scenario 6 — Variant baseline (US-85 cross-NPC verification)

Light-brightening + alpha-gate bloom verified explicitly per warmable NPC, no "tested with one, assumed for both":

- [ ] **Wren** light brightening: Warm Wren, observe her tier-1 light radius/intensity step up.
- [ ] **Wren** alpha-gate bloom: any alpha-gated decoration within Wren's new (brighter) radius blooms in on the warming-flag-change tick. (Currently no alpha-gated decorations are placed adjacent to Wren in `ashenDecorations` — observation will be a no-op pass; verify the subscriber fires by toggling the flag manually via DevTools `setFlag('npc_warmed_wren', true)` and watching the F3 HUD lights count update.)
- [ ] **Old Man** light brightening: Warm Old Man, observe his tier-1 light step up.
- [ ] **Old Man** alpha-gate bloom: same as Wren — no adjacent alpha-gated decorations in this phase, but the subscriber path is symmetric.
- [ ] **Driftwood** NOT brightening: confirm refusal does NOT alter Driftwood's light (check F3 HUD entry stays at `intensity: 0.18`).
- [ ] **Driftwood** NOT blooming: no decorations bloom near Driftwood on refusal.

---

## Scenario 7 — Class baseline (US-82, US-83 join the existing NPC class)

- [ ] Wren and Driftwood each register a tier-1 light at spawn via `registerNpcLight`. Verify F3 HUD includes `wren` and `driftwood` entries on entering Ashen Isle.
- [ ] Wren and Driftwood appear in the F3 debug overlay's NPC interaction radius (yellow), wander radius (dashed green), and awareness radius (dashed yellow) circles.
- [ ] Wren and Driftwood are scoped to Ashen Isle. Walk to Fog Marsh; neither NPC appears.
- [ ] Wren wanders within radius 2; Driftwood holds within radius 1 — observable by watching them over a few seconds.
- [ ] Both clean up on `scene.shutdown` — area transition does not leak NPCs (no console warnings about destroyed sprites; `npcSpritesById` clears on the next scene's `create`).

---

## Scenario 8 — Async-cleanup safety (US-85, US-86 [phase])

- [ ] Pulse tween is cancelled on `scene.events.shutdown`. Scenario: enter Wren dialogue, pick "Share warmth," walk into the fog-marsh exit DURING the pulse (within the 600ms window). The transition fires; no orphaned pulse object remains in the destination scene; no console errors.
- [ ] Every onFlagChange subscriber added by this phase has a collected unsubscribe. Visit Ashen Isle, then Fog Marsh, then Ashen Isle again 3 times. Each transition runs `cleanupResize` which iterates `warmingUnsubscribes` and the desat subscriber unsubscribes — no stale callbacks accumulate (verify by setting a warming flag manually after a few transitions and confirming only one re-register fires, not N).

---

## Scenario 9 — "Reads as" observer test (US-82, US-83, US-84, US-85, US-86)

Subjective but recorded — does the felt experience match the design intent?

- [ ] **Wren** reads as joyful first fruit. Warming her feels like a small win, not a chore.
- [ ] **Driftwood** reads as a respectful refusal. NOT as failure, NOT as villain — Pip moves on, the world is not diminished.
- [ ] **Old Man wary-decline** reads as honest weariness, not rejection. The "Not yet" line carries tenderness.
- [ ] **Ember-pulse** reads as gift-giving. The action is YOURS — you chose to share.
- [ ] **Cumulative desaturation** reads as restoration. The world is visibly softer post-warming, but still feels like Ashen Isle.
- [ ] **Reflection bubble** reads as a turning, not a conclusion. "Beyond this island" lands as invitation, not loss.

---

## Scenario 10 — Save / resume parity

- [ ] Warm Wren mid-game, force-close the tab. Reopen, hit Continue. Wren's light is still at the brighter radius/intensity (the warming subscriber re-registers on scene create when the flag is true).
- [ ] After warming both NPCs, force-close. Reopen. The `homecoming_complete` flag is still false until the player walks the village-centre tile (the trigger is one-shot but resume into Ashen Isle does not auto-fire).
- [ ] After the reflection bubble fires, force-close. Reopen. Walk (24, 22) again. The thought does NOT re-fire (one-shot + `homecoming_complete == true` blocks the condition).

---

## Deploy verification (post-merge)

- [ ] Once PR merges, the GitHub Pages deploy at `https://jaxsbr.github.io/emberpath/` shows Wren and Driftwood placed correctly. No `404`s on `assets/npc/wren/**` or `assets/npc/driftwood/**`. No console errors about missing portraits.
