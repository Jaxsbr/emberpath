# Phase: fog-and-light

Status: planned (DEPENDS ON `keeper-rescue`)

> **Phase intent — 2026-04-28.** A first playthrough of the shipped keeper-rescue arc revealed that the gospel beats encoded in the design (Fading → grace by inability → Ember → return) are present in the *code* but not in the *experience*. The Old Man reads as a broken NPC, the marsh dead-end reads as random stuckness, and the Ember Mark reads as a cosmetic glow with no callback. This phase introduces the fog-and-light substrate that has been part of the product vision from inception — a desaturated, fog-shrouded world whose visibility is bound to the player's light — and uses that substrate to rework Beats 1 and 2 so the existing arc actually communicates its intent. No new beats are added. This is the visual and narrative integration pass that makes the existing world land.

## Phase goal

Build a configurable fog-of-vision + selective-illumination system that becomes the substrate for all subsequent area work. With it in place, rework the Old Man, the Fog Marsh dead-end loop, the Keeper appearance, and the post-rescue return to Ashen Isle so that the felt experience matches the master-prd.md design intent: *the world is dim until light reaches it; you are the light; the Ember reveals what was always there.*

## Design direction

**The world is dim until light reaches it.**

- **You are the light.** A soft circular cutout of visibility follows the player. Outside the cutout the world is dark and desaturated. Re-fogging is instant when the player walks away — there is no roguelike memory of explored ground. The metaphor only holds if light is presence, not history.
- **Points of interest glow on their own.** NPCs, paths, trigger zones, and interactable objects carry small, lower-intensity lights so the player can read the world through fog without exposition. Wayfinding is by light, not by tile-art legibility.
- **Color is restoration, and you carry it with you.** Within the lit radius, desaturation lifts. Beyond it, the world stays grey. The Ember does not "fix" the world — it expands what you can restore as you move through it.
- **The Ember reveals, it does not buff.** Post-Ember, the player's radius grows AND a second tier of lights becomes visible: NPCs, paths, and objects that were always present but dormant now glow. The "I can see now" moment is the felt gospel of the Ember, not a stat increase.
- **Failure is felt; rescue is surrendered to.** Walking into a closed exit pushes you back with a visible fog-wall response and an escalating internal voice. The Keeper appears when the player *stops* trying — stillness near a closed exit, not attempt count. Grace meets the end of striving, not more striving.
- **The Old Man is the Fading.** He is barely visible, speaks short and dim, and his dialogue reframes the marsh as inheritance, not accident. After the Ember, he can see the player's light and his dialogue branches to reflect it. One scene; massive payload.

The build-loop's `frontend-design` skill does NOT apply — this phase introduces no DOM/HUD UI. All visual work lives inside the Phaser canvas.

## Stories

### US-74 — Lighting overlay system + LightingConfig + player light + debug toggle

Introduce the rendering substrate: a full-screen dark overlay with a soft circular cutout that follows the player. The overlay is driven by a single configuration object exposed for live tuning during dev.

**Acceptance criteria:**
- New `src/systems/lighting.ts` exporting a `LightingSystem` class. Owns the dark overlay (Phaser `RenderTexture` sized to the world), the player light cutout, and the per-frame redraw of any moving lights.
- New `src/systems/lightingConfig.ts` exporting `LIGHTING_CONFIG` as a single mutable object with named fields:
  - `playerRadiusPre: 96` (px, ~3 tiles)
  - `playerRadiusPost: 192` (px, ~6 tiles)
  - `playerFalloffPre: 32`, `playerFalloffPost: 48`
  - `poiRadius: 48`, `poiIntensity: 0.30`
  - `npcRadius: 40`, `npcIntensity: 0.25`
  - `tier2Radius: 56`, `tier2Intensity: 0.40` (lights that only become visible post-Ember)
  - `desaturationStrength: 1.0` (full grey outside lit area)
  - `refogDelayMs: 0` (instant; non-zero = fade-out tail)
  - `enabled: true` (master switch — false short-circuits the whole system, world renders as today)
- `LightingSystem.create(scene)` registers with `GameScene` after camera setup; the dark overlay sits above world tiles/decorations/props/entities but below the dialogue/UI layers (proposed depth: **6** — between Entities at 5/Player ember overlay at 5.5 and Thoughts at 8). The Thoughts layer must remain readable through fog.
- `LightingSystem.update(playerX, playerY, hasEmber)` is called once per frame from `GameScene.update`. Per-frame work allocates ZERO new objects/literals (Learning EP-01).
- Soft falloff: cutout uses an alpha gradient from 1.0 at radius core to 0.0 at radius+falloff edge. Implementation may use a pre-baked radial gradient texture stamped into the RenderTexture each frame, OR a custom shader pipeline — author choice; document in code comment.
- `LightingSystem.destroy()` is idempotent and called from `GameScene.cleanupResize` / scene shutdown. Re-entry safe (Learning EP-02): all GameObject refs nulled on destroy; instance state reset before next `create`.
- New keyboard toggle: `F4` (debug only, gated by existing debug-overlay infrastructure pattern in `systems/debugOverlay.ts`) toggles `LIGHTING_CONFIG.enabled` at runtime so the author can A/B the world with and without fog. F4 toggle is no-op in production builds (gated the same way as existing F3 trigger-zone overlay).
- New on-screen debug HUD entry (when F3 trigger-overlay is active): displays current `playerRadius`, `desaturationStrength`, `enabled`, and `hasEmber` reading. Source-readable in `debugOverlay.ts`.
- `npx tsc --noEmit && npm run build` passes.
- **Variant baseline (Rule 4a):** with `LIGHTING_CONFIG.enabled = false`, the game looks identical to the current shipped build — no overlay rendered, no per-frame lighting cost, no behavior change. Verified by toggling F4 mid-game.
- **Loop-invariant check (Learning EP-01):** `LightingSystem.update` allocates zero objects. Verified by `grep -nE "new |\\{.*:" src/systems/lighting.ts` within the update method body returning nothing inside the per-frame path.

**Behavior rule update (AGENTS.md):** "Lighting — A `LightingSystem` renders a soft-falloff darkness overlay above world entities (depth 6, below thoughts/UI). Configuration lives in `LIGHTING_CONFIG` and is live-tunable via F4 (toggle) and dev-only key bindings. Player light radius expands when `has_ember_mark === true`; POI/NPC/tier-2 lights register through `LightingSystem.registerLight`."

### US-75 — POI / NPC / tier-2 light registration

Wayfinding lights for NPCs, paths, trigger zones, and interactable objects. Two tiers: tier-1 always visible; tier-2 dormant until the Ember is granted.

**Acceptance criteria:**
- `LightingSystem.registerLight({ x, y, radius, intensity, tier: 1 | 2, id })` adds a light to the active set. Lights are removed via `unregisterLight(id)`.
- All NPCs in the scene auto-register a tier-1 light at spawn time, sized `LIGHTING_CONFIG.npcRadius` / `npcIntensity`. The Old Man's light is registered with reduced intensity (`npcIntensity * 0.6` — explicitly dimmer to read as "fading"); document this exception in `data/areas/ashen-isle.ts` via a per-NPC `lightOverride?: { radius?: number; intensity?: number }` field, optional and additive to the schema.
- `NpcDefinition.lightOverride?: { radius?: number; intensity?: number; tier?: 1 | 2 }` added to `data/areas/types.ts`. Default behavior preserved when absent (Marsh Hermit, Keeper unchanged).
- `TriggerDefinition.light?: { radius?: number; intensity?: number; tier?: 1 | 2 }` added to `data/areas/types.ts`. When set, the trigger zone registers a light at its centre. Used to mark "this is a place worth investigating" (e.g., the Ashen Isle dock, the Fog Marsh threshold).
- `DecorationDefinition.light?: { ... }` (same shape) added — supports lit objects (a glowing path stone, a lantern). Optional. Default behavior preserved when absent.
- All lights de-register on area transition via the same shutdown path that destroys the overlay; no leaks across `scene.restart` (Learning EP-02).
- Tier-2 lights are still *registered* in the active set when the player has no Ember — they're just rendered with intensity 0 (invisible). On `has_ember_mark` flag flip, `LightingSystem` re-evaluates: tier-2 lights become visible at `LIGHTING_CONFIG.tier2Intensity`. No re-registration required, no scene restart.
- **Variant baseline (Rule 4a):** Marsh Hermit and Keeper render with their tier-1 lights at default intensity; Old Man renders dimmer (verified by visual comparison to other NPCs in the same scene); a tier-2 trigger declared anywhere in the scene is INVISIBLE pre-Ember and VISIBLE post-Ember.
- **Idempotency guard (Learning #63):** `registerLight` called twice with the same `id` does not duplicate the light — the second call replaces the first. Verified by setting two relevant flags in a single dialogue node that both register the same light (synthetic dev-only test).
- **Field ownership clarity (Learning #59 facet):** the per-NPC light is owned by `LightingSystem`, not `NpcBehaviorSystem`. NPC death/despawn (future) must call `unregisterLight(npc.id)`.

**Behavior rule update (AGENTS.md):** "POI lighting — NPCs auto-register a dim light at spawn; triggers and decorations opt in via `light?:` field. Two tiers: tier-1 always rendered, tier-2 only rendered when `has_ember_mark === true`. The Old Man's light is intentionally dimmer (`lightOverride.intensity`) as a visual reading of the Fading."

### US-76 — Desaturation post-FX with lift-within-lit-radius

The world outside the lit area renders desaturated; within the lit area, color returns. Implemented as a camera post-FX pipeline.

**Acceptance criteria:**
- New Phaser post-FX pipeline registered with the main camera that applies a luminance-weighted greyscale conversion. Strength scales by `LIGHTING_CONFIG.desaturationStrength` (0.0 = full color, 1.0 = full grey).
- Per-pixel desaturation amount is gated by lit coverage: pixels inside any active light's radius keep their color; pixels outside go grey. Implementation can either (a) sample the lighting overlay's alpha as a mask in the desaturation shader, or (b) render the desaturated and saturated worlds to separate render textures and composite — author choice; document the choice in code comment with measured frame-cost.
- The Thoughts and Dialogue layers (camera-ignored or rendered above the post-FX) are NOT desaturated. Verified by spawning a thought bubble in unlit area: bubble text remains its original colors.
- The UI camera ('ui' camera at depth 100+) is NOT touched by the post-FX. Joystick, HUD, dialogue box render in original colors regardless of world fog state.
- `LIGHTING_CONFIG.desaturationStrength = 0` makes the FX a no-op visually (still mounted but produces no visible change). Verified by toggling at runtime via debug HUD.
- **Variant baseline (Rule 4a):** with `LIGHTING_CONFIG.enabled = false`, the post-FX pipeline detaches entirely (no greyscale, no compositing cost) — game renders identically to today.
- **Performance budget:** per-frame post-FX cost measured on a mid-tier mobile device (target: <2ms/frame on iPhone 12 / Pixel 5 class). If exceeded, fall back to the pre-baked-texture approach. Document the chosen approach + measured cost in code comment.
- **Loop-invariant check (Learning EP-01):** the per-frame `update` for the post-FX allocates zero objects in the JS layer; uniforms are written via existing Phaser shader-data setters, not new objects.

### US-77 — Ember toggle: radius expand + tier-2 reveal + hidden-object alpha gating

Wire the Ember Mark into the lighting system as the single switch that changes world legibility.

**Acceptance criteria:**
- `LightingSystem.update` reads `getFlag('has_ember_mark')` once per frame (via cached subscriber, not direct flag read on every tick — see EP-01) and selects `playerRadiusPre/Post` and `playerFalloffPre/Post` accordingly. Transition is instant by default; configurable `LIGHTING_CONFIG.emberTransitionMs` (default `0`) can ease the radius change for theatrical reveal.
- On `has_ember_mark` flag flip from false→true (via existing `onFlagChange` subscriber pattern), `LightingSystem` flips an internal `hasEmber: boolean` state. Tier-2 lights begin rendering at their configured intensity on the next frame. No scene restart, no tile reload.
- On flag flip true→false (Reset Progress wipes flags), tier-2 lights fade back to 0 intensity within `LIGHTING_CONFIG.emberTransitionMs` (default 0 = instant). Player radius reverts to pre-Ember. The existing Ember overlay sprite (depth 5.5) destruction continues to fire from its own subscriber — the lighting system is independent of the visual ember disc.
- New `DecorationDefinition.alphaGatedByLight?: boolean` field added to `data/areas/types.ts`. When `true`, the decoration sprite's alpha is set per-frame to its lit coverage: 1.0 if its centre falls inside any active light, 0.0 if outside. This is what makes "objects revealed by the Ember" possible — a tier-2 light registered at the same position lights an alpha-gated decoration only post-Ember.
- Alpha-gated decorations are evaluated only when the player moves more than `LIGHTING_CONFIG.alphaGateRecheckPx` (default 8 px) since last evaluation, OR when `hasEmber` flips. Not per-frame — this is the only acceptable shortcut to per-frame allocation discipline (movement-gated invalidation, not render-gated). Document the threshold in code.
- **Atomic flip parity (precedent — keeper-rescue US-72):** the same dialogue-node `setFlags` write that sets `has_ember_mark: true` and `marsh_trapped: false` already commits in one frame. Lighting expansion + tier-2 reveal + decoration alpha re-evaluation all observe the same frame as the existing collision-flip and decoration-swap. Verified by walking the keeper-intro flow: on dialogue close, the player should *immediately* see the bigger lit radius and any tier-2 lights/decorations registered in the marsh — no perceptible lag.
- **Idempotency (Learning #63):** flipping `has_ember_mark` rapidly true→false→true (synthetic dev-only test) does not leak GameObjects, double-render lights, or strand decorations at intermediate alphas.
- **Variant baseline (Rule 4a):** with `LIGHTING_CONFIG.enabled = false`, the Ember toggle has zero visual effect on world fog/light/desaturation; the existing depth-5.5 ember overlay disc still appears as today.

### US-78 — Ashen Isle Beat 1 rework: Old Man speaks the Fading

Replace the Old Man's current "stuck in doorway" non-interactivity with a short, dim dialogue that establishes the Fading. Wire his light to read as fading. Add a return-state dialogue branch for post-Ember (covered in US-81).

**Acceptance criteria:**
- Old Man's NPC entry in `data/areas/ashen-isle.ts` gains `lightOverride: { intensity: <reduced> }` (per US-75). Visible as a faint silhouette through the fog from ~2 tiles away — the player can find him without exposition.
- Old Man's interaction is enabled (he is no longer blocked by his sprite position; if his current position prevents proximity-radius interaction, move him by ≤2 tiles to a position where the player can approach).
- New dialogue script `old-man-fading` on `ashen-isle.ts` with `portraitId: 'old-man'`, 3 nodes:
  - **Greeting (dim):** "You walk. I forgot how." (sets flag `spoke_to_old_man: true`)
  - **Farewell (resigned):** "Go where the path goes. Mine ended." (no flag)
  - The dialogue conveys: he was a traveller; he stopped; he is fading; the player is not yet stopped. **Show, don't preach.** No theological vocabulary.
- Dialogue tone: short sentences. No exclamation marks. Pauses (em-dashes or ellipses) acceptable. Total dialogue text ≤ 200 characters across both nodes.
- **Existing-NPC regression (Rule 4a):** Marsh Hermit and Keeper dialogues unchanged.
- **Save/resume:** `spoke_to_old_man` flag persists across reload via existing `emberpath_flags` localStorage; verified by talking to Old Man, force-close, Continue, and confirming the flag survives in localStorage inspection.
- **Master-prd alignment:** the dialogue is the textual encoding of beat 1 (the Fading). The PRD's "show, don't preach" principle requires that no node mentions God, Jesus, sin, salvation, ember, or rescue. The Old Man speaks only of his own stillness.

### US-79 — Visible escape failures with escalating monologue

Replace the current invisible "4 attempts" mechanic and the random "rock thoughts" with a felt loop: the player walks into the closed exit, gets a visible push-back response, and an escalating internal voice tracks how many times it has happened.

**Acceptance criteria:**
- Existing Phase-1 `escape_attempts` counter and threshold trigger remain — the counter logic is reused, but the *feedback* changes.
- When `marsh_trapped == true` and the player attempts to walk through the south exit (row 22 cols 13-16), the existing collision blocks them. NEW: a fog-wall flash effect renders at the attempted-cross tile (a brief white-to-grey alpha pulse on the lighting overlay at that location, ~250ms). Source: `LightingSystem.flashFog(x, y, durationMs)`. Author-tunable via `LIGHTING_CONFIG.fogFlashDurationMs` (default 250) and `LIGHTING_CONFIG.fogFlashIntensity` (default 0.6).
- The existing `escape_attempts` increment continues to fire on each blocked attempt. NEW: a thought-bubble line is queued from a small ordered pool, escalating in tone:
  - Attempt 1: "The path is gone."
  - Attempt 2: "There must be a way back."
  - Attempt 3: "I cannot find it."
  - Attempt 4+: "I cannot do this." (latches; further attempts repeat this line silently OR no-op — author choice)
- Lines are stored in `data/areas/fog-marsh.ts` as a new `escapeMonologue: string[]` field on the area definition (or in a per-area dialogue table — author choice). Source-readable.
- The previous random "rock" / Whispering Stones thoughts are REMOVED from the marsh's trigger zones. Their trigger entries are deleted (not commented out — Learning #6 facet: dead code is a smell). The Whispering Stones dialogue script and any narrative affordance it carried is either repurposed for a future area OR fully removed; if removed, document the removal in the PR description.
- **Existing trigger regression (Rule 4a):** the `marsh_trapped` threshold trigger (US-66/67) still fires on first descent into the marsh; the Marsh Hermit dialogue still fires on interaction.
- **Save/resume:** `escape_attempts` counter continues to persist (existing behavior); the monologue index is derived from the counter, no new persisted state.
- **Loop-invariant check (Learning EP-01):** the fog-flash animation uses a pre-allocated tween or a rectangle from a small pool; per-trigger work allocates ≤ 1 object (the tween config), and only on the actual collision attempt — not per-frame.
- **Variant baseline:** the rebound + monologue fires identically on desktop (W key into wall) and mobile (joystick-into-wall), and on every facing direction approach to the closed exit (north-pushed, west-pushed corner cases).

### US-80 — Surrender-triggered Keeper rescue

Replace the `escape_attempts >= 4` Keeper-spawn condition with a surrender-by-stillness condition: the Keeper appears when the player stops trying.

**Acceptance criteria:**
- New flag `marsh_surrendered: boolean` (default unset). Set to `true` by a new lightweight system `SurrenderSystem` (or inline in `GameScene.update`) when ALL of: (a) `marsh_trapped == true`, (b) `escape_attempts >= 2` (player has tried at least twice — surrender requires effort first), (c) the player has remained within `SURRENDER_PROXIMITY_TILES = 4` tiles of the closed south exit, (d) the player has produced no movement input (keyboard, joystick, tap-move) for `SURRENDER_DURATION_MS = 4000` (4 seconds, configurable).
- Constants `SURRENDER_PROXIMITY_TILES`, `SURRENDER_DURATION_MS`, `SURRENDER_MIN_ATTEMPTS` declared as named constants at the top of the implementing file (Learning #6 facet — no magic numbers).
- Keeper's `spawnCondition` in `data/areas/fog-marsh.ts` updated to `marsh_trapped == true AND marsh_surrendered == true AND keeper_met == false`. The `escape_attempts >= 4` clause is REMOVED — the surrender flag subsumes it (it requires `escape_attempts >= 2` plus stillness, which is a stricter and more meaningful condition).
- The existing generalised `onFlagChange` subscriber for spawn conditions (US-71) automatically picks up the new flag name `marsh_surrendered` via the regex parse — no new subscription wiring required. Verified by reading `subscribeToConditionalSpawns` in `GameScene` and confirming the regex match.
- The Keeper still fades in via the existing 500ms alpha tween; player input still suspends for the fade duration.
- **Variant baseline (Rule 4a):** if the player keeps moving forever after `escape_attempts >= 2`, the Keeper does NOT appear. If the player stops within proximity for ≥4s on the very first arrival (before attempt #2), the Keeper does NOT appear (effort-then-surrender is the required pattern). Both cases verified manually.
- **Edge case — input vs stillness:** dialogue interaction (e.g., walking up to Marsh Hermit and talking) does NOT count as movement; the surrender timer continues to count down while in dialogue. Verified by talking to the Hermit, closing dialogue without moving, then standing still — Keeper appears once total quiescence + proximity is met. Author judgement: this is acceptable because dialogue-then-stillness is still a form of "stopping."
- **Edge case — proximity reset:** if the player walks AWAY from the south exit (beyond `SURRENDER_PROXIMITY_TILES`), the surrender timer resets to 0. Re-arrives, restarts counting. Verified manually.
- **Save/resume:** `marsh_surrendered` flag persists. If the player force-closes mid-surrender-timer and Continues, the timer restarts (it is not persisted as a partial value — this is intentional; the felt act of surrender must happen in one continuous moment). Document this in code.
- **Loop-invariant check (Learning EP-01):** the surrender timer is a single `number` field on `GameScene`, incremented by `delta` each frame, reset to 0 on input or proximity-exit. Zero allocations per frame.
- **Existing-content regression:** the `escape_attempts` counter is still incremented (still readable in saves; future analytics could use it); the threshold trigger and exit-closure mechanism (US-66 through US-69) are unchanged. The only behavioral change is the *Keeper trigger condition*.

**Behavior rule update (AGENTS.md):** "Surrender trigger — A flag-based system that fires when the player has tried, then stopped, near a context-significant location. Used by the Keeper rescue (`marsh_surrendered` in Fog Marsh). Configurable by `SURRENDER_*` constants. Reset on input or proximity exit; not persisted as a partial timer."

### US-81 — Post-Ember reveal: Ashen Isle tier-2 POI + Old Man post-Ember branch

The payoff. Walking back to Ashen Isle with the Ember reveals tier-2 lights that were always present, including a new findable element. The Old Man can now see the player's light and his dialogue branches.

**Acceptance criteria:**
- One new tier-2 trigger zone added to `ashen-isle.ts` at a position the player walked past blind in the pre-Ember playthrough. Triggers a thought-bubble or short scene that hints at beat 3 (the Heart Bridge) without spoiling it. Suggested location: somewhere visually adjacent to the dock the player used to leave for the marsh — they crossed the spot, but the trigger was tier-2-lit and invisible. Author chooses exact tile.
- The trigger's `light: { tier: 2, ... }` registers a tier-2 light at its centre, invisible pre-Ember and visible post-Ember.
- One new tier-2 alpha-gated decoration sprite added near the trigger (e.g., a faint path leading off-map, or a small marker stone) with `alphaGatedByLight: true`. Invisible pre-Ember, visible post-Ember. Sourced from existing tilesets — no new art assets in this story.
- Old Man dialogue script `old-man-fading` (from US-78) gains a conditional branch: when `has_ember_mark == true`, the greeting node is replaced (or a new dialogue script `old-man-illumined` is selected by `NpcInteractionSystem` — author choice; document the chosen pattern):
  - **Greeting (illumined):** "You carry it now. Then you are not yet me."
  - **Farewell (illumined):** "Go on. The path is more than this."
  - Tone: still short, still dim, but no longer hopeless. The Old Man recognises the light he himself does not carry.
- Branching mechanism: either (a) `DialogueScript.condition?: string` field added to `data/areas/types.ts` (mirrors `TriggerDefinition.condition`) so `NpcInteractionSystem` can pick the script whose condition matches; OR (b) a new `branchOnFlag?: { flag: string; whenTrue: string; whenFalse: string }` field on the NPC's interaction config; OR (c) inline `condition` per dialogue node within a single script. Author choice — pick the smallest type-system addition that unblocks this story; document the rationale in the PR.
- **Existing dialogue regression (Rule 4a):** Marsh Hermit, Keeper dialogues unchanged. Pre-Ember Old Man dialogue (`spoke_to_old_man`) still fires on first interaction; the post-Ember branch only fires when `has_ember_mark == true`.
- **Save/resume:** post-Ember Old Man dialogue fires on Continue from a post-rescue save — the `has_ember_mark` flag is already persisted (US-73); this story does not add new persisted state.
- **Variant baseline (Rule 4a):** desktop fresh New Game → walks to Old Man → sees pre-Ember dialogue. Then completes Fog Marsh arc → returns → sees post-Ember dialogue. Mobile same. Continue from a saved post-Ember state lands on post-Ember dialogue immediately.
- **Master-prd alignment:** the new tier-2 trigger and Old Man post-Ember branch together close beat 2 — the Ember has visible meaning in the world, not just on the player's sprite. The hint-toward-beat-3 trigger sets up the next phase (Heart Bridge) without committing its mechanism.

## Done-when

### US-74 (lighting overlay system + LightingConfig + player light + debug toggle)
- [ ] `src/systems/lighting.ts` and `src/systems/lightingConfig.ts` exist; `LightingSystem` class with `create`, `update`, `destroy`, `flashFog`, `registerLight`, `unregisterLight` methods [US-74]
- [ ] `LIGHTING_CONFIG` exposes all named fields with documented defaults; live-tunable at runtime [US-74]
- [ ] Dark overlay renders at depth 6 (between Player ember overlay 5.5 and Thoughts 8); does NOT obscure Thoughts or UI [US-74]
- [ ] Soft falloff visible — circular cutout fades smoothly from cleared core to fully dark fog over `falloff` pixels [US-74]
- [ ] F4 toggles `LIGHTING_CONFIG.enabled`; with `enabled = false` the build looks identical to today (variant baseline) [US-74]
- [ ] F3 debug HUD includes new lines: player radius, desaturation strength, lighting enabled, has-ember [US-74]
- [ ] **Loop-invariant (Learning EP-01):** `LightingSystem.update` body contains zero `new` and zero object/array literals; verified via grep [US-74]
- [ ] **Restart hygiene (Learning EP-02):** all GameObject refs in `LightingSystem` reset at top of `create`; no leaks across `scene.restart` (verified by transition Ashen↔Fog↔Ashen 5x and inspecting GameObject count) [US-74]
- [ ] AGENTS.md "Behavior rules" gains "Lighting" entry; "Depth map" gains row at depth 6 for the lighting overlay [US-74, phase]
- [ ] `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes [US-74]

### US-75 (POI / NPC / tier-2 light registration)
- [ ] `NpcDefinition.lightOverride?`, `TriggerDefinition.light?`, `DecorationDefinition.light?` added to `data/areas/types.ts` [US-75]
- [ ] All NPCs auto-register a tier-1 light at spawn time; default radius/intensity from `LIGHTING_CONFIG.npcRadius/npcIntensity` [US-75]
- [ ] Old Man's light is dimmer (`lightOverride.intensity` reduced) — visible from ~2 tiles in fog as a faint silhouette [US-75]
- [ ] Tier-2 lights render at intensity 0 pre-Ember, full intensity post-Ember (synthetic dev-only test trigger verifies) [US-75]
- [ ] Lights de-register on area transition; no leaks (verify via GameObject count after 5x transition) [US-75]
- [ ] **Idempotency (Learning #63):** `registerLight` with duplicate id replaces, doesn't duplicate [US-75]
- [ ] **Variant baseline (Rule 4a):** Marsh Hermit, Keeper render with default-intensity tier-1 lights; Old Man visibly dimmer; tier-2 invisible pre-Ember; tier-2 visible post-Ember [US-75]
- [ ] AGENTS.md "Behavior rules" gains "POI lighting" entry [US-75, phase]

### US-76 (desaturation post-FX with lift-within-lit-radius)
- [ ] Custom Phaser post-FX pipeline registered with main camera; applies luminance-weighted greyscale [US-76]
- [ ] Desaturation amount per-pixel gated by lighting overlay alpha — color preserved inside lit radii, grey outside [US-76]
- [ ] Thoughts and Dialogue layers NOT desaturated (verified by spawning a thought bubble in unlit area — text retains color) [US-76]
- [ ] UI camera unaffected (joystick, dialogue box, HUD all original colors regardless of fog state) [US-76]
- [ ] `LIGHTING_CONFIG.desaturationStrength = 0` produces no visible change [US-76]
- [ ] **Variant baseline (Rule 4a):** with `LIGHTING_CONFIG.enabled = false`, post-FX detaches; renders identically to today [US-76]
- [ ] **Performance:** measured per-frame post-FX cost on iPhone 12-class device < 2ms; documented in code comment [US-76]
- [ ] **Loop-invariant (Learning EP-01):** per-frame `update` allocates zero JS objects [US-76]

### US-77 (Ember toggle: radius expand + tier-2 reveal + hidden-object alpha gating)
- [ ] `LightingSystem` reads `has_ember_mark` via cached subscriber; selects pre/post player radius and falloff [US-77]
- [ ] On flag flip false→true, player radius expands within `LIGHTING_CONFIG.emberTransitionMs`; tier-2 lights become visible on next frame [US-77]
- [ ] On flag flip true→false (Reset Progress), tier-2 lights fade out; player radius reverts; no leaked objects [US-77]
- [ ] `DecorationDefinition.alphaGatedByLight?: boolean` added; alpha-gated decorations show iff their centre falls inside any active light [US-77]
- [ ] Alpha-gate re-evaluation movement-gated (`alphaGateRecheckPx`, default 8 px), not per-frame [US-77]
- [ ] **Atomic flip parity:** the keeper-intro `setFlags` write committing `has_ember_mark: true` and `marsh_trapped: false` produces — in the same frame — bigger lit radius + tier-2 reveal + decoration alpha re-evaluation + collision flip + decoration swap. Verified by manual playthrough [US-77]
- [ ] **Idempotency (Learning #63):** rapid true→false→true on `has_ember_mark` (synthetic dev-only test) leaks zero GameObjects [US-77]
- [ ] **Variant baseline (Rule 4a):** with `LIGHTING_CONFIG.enabled = false`, Ember toggle has zero effect on world fog/light/desaturation; depth-5.5 ember disc still appears as today [US-77]

### US-78 (Ashen Isle Beat 1 rework: Old Man speaks the Fading)
- [ ] Old Man's NPC entry has `lightOverride: { intensity: <reduced> }`; visible as faint silhouette through fog [US-78]
- [ ] Old Man's interaction radius reachable by player; if his current position blocked interaction, moved by ≤2 tiles to a reachable position [US-78]
- [ ] New `old-man-fading` dialogue script with `portraitId: 'old-man'`, 3 nodes, total text ≤ 200 characters; sets `spoke_to_old_man: true` on greeting [US-78]
- [ ] Dialogue tone respects "show, don't preach": no theological vocabulary; no exclamation marks; pauses acceptable [US-78]
- [ ] **Existing-NPC regression (Rule 4a):** Marsh Hermit and Keeper dialogues unchanged [US-78]
- [ ] **Save/resume:** `spoke_to_old_man` flag persists across reload [US-78]

### US-79 (visible escape failures with escalating monologue)
- [ ] `LightingSystem.flashFog(x, y, durationMs)` exists; renders fog-wall pulse at the attempted-cross tile [US-79]
- [ ] On each blocked south-exit attempt while `marsh_trapped == true`, fog-flash fires AND a thought-bubble line from the escalating pool is queued [US-79]
- [ ] Monologue lines defined in `data/areas/fog-marsh.ts` (or per-area table); 4 entries with the documented escalation; latches on attempt 4+ [US-79]
- [ ] Whispering Stones / random "rock" thoughts removed from Fog Marsh trigger zones; dead trigger entries deleted, not commented out [US-79]
- [ ] **Existing-trigger regression (Rule 4a):** marsh-trapped threshold + Marsh Hermit dialogue unchanged [US-79]
- [ ] **Save/resume:** `escape_attempts` counter persistence preserved (existing behavior); monologue index derived, not persisted [US-79]
- [ ] **Loop-invariant (Learning EP-01):** fog-flash uses pre-allocated tween/rectangle pool; per-trigger work allocates ≤ 1 object [US-79]
- [ ] **Variant baseline:** rebound + monologue fires on desktop and mobile, on every approach direction (north/east/west pushed onto the closed south exit) [US-79]

### US-80 (surrender-triggered Keeper rescue)
- [ ] New flag `marsh_surrendered: boolean`; set by surrender system when proximity + stillness + min-attempts conditions met [US-80]
- [ ] Constants `SURRENDER_PROXIMITY_TILES`, `SURRENDER_DURATION_MS`, `SURRENDER_MIN_ATTEMPTS` declared as named at top of implementing file (Learning #6 facet) [US-80]
- [ ] Keeper `spawnCondition` updated to `marsh_trapped == true AND marsh_surrendered == true AND keeper_met == false`; `escape_attempts >= 4` clause REMOVED [US-80]
- [ ] Generalised flag-change subscriber (US-71) auto-picks up `marsh_surrendered` via existing regex parse — no new subscription wiring [US-80]
- [ ] **Variant baseline (Rule 4a):** player keeps moving forever post-attempts → no Keeper. Player stops on first arrival before attempt #2 → no Keeper. Effort-then-surrender pattern required; both negatives verified [US-80]
- [ ] **Edge case — dialogue:** dialogue interaction does NOT count as movement; surrender timer continues during dialogue [US-80]
- [ ] **Edge case — proximity exit:** walking beyond `SURRENDER_PROXIMITY_TILES` resets timer to 0 [US-80]
- [ ] **Save/resume:** `marsh_surrendered` persists; partial timer does NOT persist (force-close mid-surrender resets the timer on Continue); behavior documented in code [US-80]
- [ ] **Loop-invariant (Learning EP-01):** surrender timer is a single `number` field; per-frame increment + reset; zero allocations [US-80]
- [ ] **Existing-content regression:** `escape_attempts` increment, threshold trigger, exit-closure mechanism unchanged; only Keeper trigger condition changes [US-80]
- [ ] AGENTS.md "Behavior rules" gains "Surrender trigger" entry [US-80, phase]

### US-81 (post-Ember reveal: Ashen Isle tier-2 POI + Old Man post-Ember branch)
- [ ] One new tier-2 trigger zone in `ashen-isle.ts` at a position the player crossed pre-Ember; triggers a thought-bubble/short scene hinting at beat 3 [US-81]
- [ ] One new tier-2 alpha-gated decoration sprite near the trigger; sourced from existing tilesets, no new art [US-81]
- [ ] Old Man post-Ember dialogue branch fires when `has_ember_mark == true`; pre-Ember branch when false; mechanism (DialogueScript.condition / branchOnFlag / inline node condition) chosen and documented in PR [US-81]
- [ ] Post-Ember dialogue text: "You carry it now. Then you are not yet me." / "Go on. The path is more than this." [US-81]
- [ ] **Existing-NPC regression (Rule 4a):** Marsh Hermit, Keeper dialogues unchanged; pre-Ember Old Man dialogue still fires when flag false [US-81]
- [ ] **Save/resume:** post-Ember Old Man dialogue fires on Continue from a post-rescue save (uses existing `has_ember_mark` persistence) [US-81]
- [ ] **Variant baseline (Rule 4a):** desktop and mobile, fresh New Game → pre-Ember dialogue → completes Fog Marsh → returns → post-Ember dialogue. Continue from post-Ember save lands on post-Ember dialogue immediately [US-81]
- [ ] **Master-prd alignment:** new tier-2 trigger and Old Man branch close beat 2 visibly; trigger hints at beat 3 without committing its mechanism [US-81]

### Phase-level
- [ ] **Full-arc manual verification (lit world):** New Game → spawn into desaturated, fogged Ashen Isle with player light visible → find Old Man as faint silhouette → talk to Old Man (Fading dialogue) → find dock by its tier-1 light → walk to Fog Marsh → past Marsh Hermit → threshold fires → walk into closed exit (fog flash + escalating monologue, attempts 1–4) → stop near exit ≥ 4s → Keeper fades in → talk to Keeper → ember-given story scene → on dialogue close, lit radius expands + tier-2 lights become visible + desaturation lifts further within the bigger radius → walk south → exit walkable → transition to Ashen Isle → bigger lit radius reveals tier-2 trigger near the dock (new thought/scene fires) and tier-2 alpha-gated decoration → walk to Old Man → post-Ember dialogue branch fires. Documented as scenario 1 in `docs/plan/fog-and-light-manual-verify.md` [phase]
- [ ] **Save / resume parity:** force-close at every major beat (mid-Fading-dialogue, mid-rebound, mid-surrender-timer, mid-ember-given scene, post-rescue in marsh, post-rescue in Ashen Isle) and Continue. Lit radius, tier-2 visibility, desaturation, and Old Man dialogue branch all restore correctly. Documented as scenario 2 [phase, save-resume integration]
- [ ] **Reset parity:** Reset Progress wipes `has_ember_mark`, `keeper_met`, `marsh_trapped`, `escape_attempts`, `marsh_surrendered`, `spoke_to_marsh_hermit`, `spoke_to_old_man` together; tier-2 lights fade out, player radius reverts, post-Ember Old Man dialogue stops firing — same frame as the flag wipe. Documented as scenario 3 [phase, save-resume integration]
- [ ] **Variant baseline manual checklist:** 6-row table in `docs/plan/fog-and-light-manual-verify.md` (3 desktop × 3 mobile entry combinations) covering: fresh New Game, Continue mid-Fog-Marsh, Continue post-rescue. Each row checks: lighting renders, Old Man dialogue branches correctly, escape rebound + monologue fires, Keeper surrender-spawn fires, post-Ember tier-2 reveal renders [phase]
- [ ] **Performance budget:** combined lighting + post-FX + alpha-gating + monologue cost measured on mid-tier mobile (iPhone 12 / Pixel 5 class) — average frame time < 16.67ms (60fps) sustained across the full-arc playthrough; documented in PR [phase]
- [ ] **Lighting kill-switch verification:** with `LIGHTING_CONFIG.enabled = false`, the entire game renders identically to the keeper-rescue baseline — no fog, no desaturation, no tier-gated decorations visible (alpha-gated decorations default-show or default-hide per author choice — document the chosen default). Documented as scenario 5 [phase]
- [ ] `npx tsc --noEmit && npm run build` passes; `cd tools/editor && npm run build` passes; no console errors during full-arc playthrough [phase]
- [ ] AGENTS.md reflects new modules / behavior rules / depth-map rows: Lighting (depth 6 row), POI lighting, Surrender trigger, DialogueScript condition (or chosen branching mechanism) [phase]
- [ ] **Deploy verification + smoke (Learning #65):** GitHub Pages deploys; deployed playthrough completes the full lit-world arc without errors [phase]

### Auto-added safety criteria
- [ ] **Input validation (compounded):** new `lightOverride`, `light`, `alphaGatedByLight`, dialogue branch fields are author-controlled (declared in `data/areas/*.ts`); no user-text pathway feeds them. TypeScript-enforced via existing typed schema. Source-readable [phase, security]
- [ ] **Surrender system input source:** the surrender timer reads movement input from existing `InputSystem`; no new untrusted input pathway. Source-readable [phase, security]

## Dependencies

- **Phase `keeper-rescue` MUST be shipped first.** This phase reuses `marsh_trapped`, `escape_attempts`, `has_ember_mark`, `keeper_met`, the generalised `onFlagChange` spawn-condition subscriber, the `DialogueNode.setFlags` mechanism, and the `DialogueScript.endStoryScene` chain. All of these were added in keeper-rescue and remain unchanged here.
- **Phaser 3 post-FX pipeline support:** the desaturation FX assumes Phaser 3.60+ post-pipeline API (`Phaser.Renderer.WebGL.Pipelines.PostFXPipeline`). Verify version in `package.json` before US-76 implementation; fallback to `tintFill` + composite if the pipeline API is unavailable.
- **Existing systems untouched in shape:** `systems/conditions.ts` (no parser extension), `systems/dialogue.ts` (only adds the optional `condition` or branching field per US-81 author choice), `triggers/flags.ts` (no schema change), `triggers/saveState.ts` (no new persisted shape — only new flag names).

## Out of scope

- **Beats 3 + 4 of the gospel arc** (Heart Bridge, Citadel) — future phases. The US-81 tier-2 trigger HINTS at beat 3 but does not commit its mechanism.
- **Persistent fog-of-war / explored memory** — explicitly rejected; fog re-renders instantly on player exit. Configurable via `LIGHTING_CONFIG.refogDelayMs` for future tuning, not gameplay change.
- **Per-area lighting palette** (e.g., warmer fog in marsh, cooler in Ashen Isle) — single global palette this phase. Per-area overrides may come in a later polish pass.
- **Audio cues** (Keeper appearance music, fog-wall whoosh, ember chime) — audio pipeline is `audio-pass-1`, future.
- **Multi-language support.**
- **Shader-based volumetric fog or particle fog** — flat alpha overlay is sufficient for the metaphor and ships within performance budget. Volumetric fog would be a future polish phase, not a gameplay change.
- **Removing the depth-5.5 Ember disc above Pip's head** — the disc is the personal mark; the lit-radius expansion is the world response. Both stay.
- **Combat, puzzles, inventory, stats, resources, time-of-day, weather** — out of scope for this game, period (master-prd.md alignment).

## AGENTS.md sections affected (anticipated — written by the build-loop's Phase Reconciliation Gate after the phase ships)

- **Directory layout** — add `src/systems/lighting.ts`, `src/systems/lightingConfig.ts`; add `docs/plan/fog-and-light-manual-verify.md`.
- **File ownership** — updated rows for `data/areas/types.ts` (`NpcDefinition.lightOverride`, `TriggerDefinition.light`, `DecorationDefinition.light`, `DecorationDefinition.alphaGatedByLight`, dialogue branching field per US-81); `data/areas/ashen-isle.ts` (Old Man dialogue rework, `lightOverride`, tier-2 trigger, alpha-gated decoration); `data/areas/fog-marsh.ts` (escape monologue, Keeper spawnCondition update, removal of Whispering Stones triggers); `scenes/GameScene.ts` (LightingSystem create/update/destroy wiring, surrender timer, fog-flash on collision); `systems/dialogue.ts` (condition/branching addition per US-81 author choice); `systems/npcSprites.ts` (no change — only data-side `lightOverride` consumption).
- **Behavior rules** — new "Lighting", "POI lighting", "Surrender trigger" entries; updated "Dialogue" entry to mention the chosen branching mechanism if added; updated "Save / resume" entry to mention new flags `spoke_to_old_man` and `marsh_surrendered`.
- **Depth map** — new row at depth 6 for the lighting overlay (between Player ember overlay 5.5 and Thoughts 8). Document Thoughts (8) as the explicit reason the lighting depth is 6, not higher.
