# Phase: briar-wilds

Status: draft

## Phase goal

Stage 4 of Pip's pilgrim journey — **trials and hardship**. After homecoming-light's spiritual high, Pip leaves Ashen Isle eastward (a path the Ember has just opened) and walks into the Briar Wilds: thorny, twisted, mist-grey, oppressive but never cruel. The phase introduces one new state — **ember warmth** — which drains in *drain zones* (twisted false-hope patches that lure with sickly gold) and restores in *quiet places* (small clearings with a glowing sapling or quiet stone). The ember dims visibly but **never extinguishes** (hard floor); doubt-voice thought bubbles fire while Pip is in drain zones; ambient narration on entering a quiet place. The trial is endured by walking through, not won by skill — there is no fail state, no respawn, no skill check. The phase also corrects a perception gap shipped in homecoming-light: warmed NPCs (Wren, Old Man) become *visibly* brighter in the world so Pip can look back from the trial road and see the bright pockets of grace already given. Closes with a soft forward-looking thought near the far edge of Briar Wilds turning Pip toward the Heart Bridge that waits beyond.

### Stories in scope
- US-99 — Warmed-NPC visible brightening (homecoming-light polish)
- US-100 — Briar Wilds area + east-gated entry from Ashen Isle
- US-101 — Ember warmth state — drain, restore, hard floor, visual binding
- US-102 — Drain zones + doubt voices
- US-103 — Quiet places + closing reflection

### Design direction

The Briar Wilds aesthetic is **thorny / twisted / cool-mist** over softened grey-greens. Brambles, dead branches, low oppressive sky. **Kid-safe, never horror** — no skulls, no claw imagery, no jump-scare composition, no red. Drain zones read as **false hope**: a sickly twisted-gold light over dead bramble (the false-light decoy concept folded into the drain visual rather than as a separate object class — the trap and the lie are one). Quiet places read as **rest**: a small clearing with a glowing sapling or a quiet stone, palette-warm-gold against the cool mist, breathing-room composition.

The doubt-voice tone is **internal weariness**, not external menace. Lines like *"This path is too long..."*, *"Did the Ember really change anything?"*, *"You should have stayed at the village..."* — the voice of the Christian's own discouragement, not a demon. Ambient narration in quiet places is **breath**: *"Pip's ember steadies."*, *"The bramble parts here."*

The warmed-NPC brightening (US-99) must read as **a halo of restored color in the greyscale world** — the player should walk past Wren after warming and *see* the difference at a glance, not have to squint. The mechanism is the existing tier-1 light bumped to a clearly larger radius and higher intensity; it interacts with the desaturation pipeline so the warmed NPC's local area shows more original color. No pulse, no animation — a steady restored bubble of warmth.

The build-loop applies the frontend-design skill to all PixelLab generation prompts and to dialogue/thought text.

### Stories

#### US-99 — Warmed-NPC visible brightening

As a player who has shared the Ember with an NPC, I want to see a clear visible bubble of restored warmth around them in the world, so that the Ember's impact reads at a glance and I can mentally mark the bright pockets of grace I've left behind as I walk into the trials ahead.

**Acceptance criteria:**
- The current homecoming-light warming bump (small radius/intensity increase) is replaced with values clearly readable on screen — at least **1.5× baseline NPC radius** AND at least **2× baseline NPC intensity**, named in `LIGHTING_CONFIG` as `npcWarmedRadius` and `npcWarmedIntensity` (no magic numbers in call sites).
- The brightened light's local area shows visibly more original color than the surrounding greyscale world (the desaturation pipeline already mixes toward luminance based on lighting mask alpha; the higher intensity makes more original color come through).
- The brightening applies to **both Wren AND Old Man** on their respective `npc_warmed_<id>` flag flip — explicit per-NPC verification.
- **Driftwood (refused) does NOT brighten** — explicit negative verification.
- The brightening is steady, not animated — no pulse, no shimmer, no flicker.
- The brightened light persists across area transitions (Pip leaves Ashen Isle, returns; the bright bubble is still there, gated by the warming flag).
- Reset Progress restores the baseline (the warming-flag `onFlagChange` subscriber notifying with `undefined` re-registers the light at baseline radius/intensity, same path used today).
- The F3 debug overlay shows the new warmed radius/intensity values when inspecting a warmed NPC.

**User guidance:**
- Discovery: After warming Wren or Old Man (already shipped in homecoming-light), walk near them; the surrounding ground glows visibly warmer than around an unwarmed NPC.
- Manual section: `docs/plan/briar-wilds-manual-verify.md` — § US-99 Warmed-NPC visibility
- Key steps: 1) Reset Progress. 2) Play through to Ember + return to Ashen Isle. 3) Walk near Wren before warming — note the local color/light. 4) Warm Wren; walk near her again — note the larger, brighter bubble of color. 5) Repeat for Old Man (post-Wren). 6) Walk past Driftwood after refusing — confirm no brightening.

**Design rationale:** The shipped homecoming-light bump is too subtle to survive against the global desaturation. Doubling the visual signal (and giving each NPC a wider warmth halo) makes the *Holy Spirit's restorative impact on persons* readable at a glance, and gives Pip a visible breadcrumb trail of grace as she heads into Briar Wilds.

#### US-100 — Briar Wilds area + east-gated entry from Ashen Isle

As a player who has received the Ember and shared warmth, I want to discover that the eastern bramble that previously blocked my path has opened, so that the Ember mechanically unlocks the next stage of my journey.

**Acceptance criteria:**
- Ashen Isle gains a new **east exit** at a committed `(col, row)` on the eastern map edge, with `condition: 'has_ember_mark == true'`.
- Pre-Ember, the east exit zone exists but the condition gate suppresses transition; tile-snapped decoration cluster (thick brambles) renders over the exit tiles to visually block.
- Post-Ember, the bramble decoration is conditionally hidden (`condition: 'has_ember_mark == false'`) so the path visually opens; transition fires when Pip walks onto the exit zone.
- A first-time-arrival thought-bubble fires once when Pip first crosses into the east exit zone post-Ember (`condition: 'has_ember_mark == true && east_path_seen == false'`, `setFlags: { east_path_seen: true }`): *"The brambles have parted. A road east."*
- New file `src/data/areas/briar-wilds.ts` defines the area — Wang vertex terrain (~30×24 cells minimum), sparse `objects` (brambles, dead trees, twisted roots), `tileset: 'briar-wilds'` (new entry in `TILESETS` registry), exits back to Ashen Isle on the area's west edge.
- New PixelLab Wang tileset generated via `mcp__pixellab__` (personal account, **not** team — Learning EP-05) with primary terrain `briar-floor` and secondary terrain `briar-thorn` (or `briar-stone`). Single tileset for the area.
- New object kinds added to `src/maps/objects.ts`: at least `bramble-cluster` (impassable), `dead-tree` (impassable), `twisted-root` (passable decoration). All atlas frames generated via PixelLab.
- Atlas frame-pick verification: a labeled-atlas preview is rendered for the new tileset using `tools/atlas-preview.py` (or the equivalent in `maps/atlasPreview.ts`) and each Wang mask + each object frame is visually verified before the commit lands (compounded rule — Learning EP-03 / `visual-pick-without-verification`).
- `briar-wilds` registered in `src/data/areas/registry.ts`.
- Return path: at least one west-edge exit on Briar Wilds returns Pip to the eastern entry tile of Ashen Isle.
- Closing-reflection trigger placed near the far (east or north) edge of Briar Wilds: condition `briar_wilds_complete == false`, one-shot, `setFlags: { briar_wilds_complete: true }`, `type: 'thought'`. Sequence has at least 3 lines, ending on a forward-looking line such as *"A long stone bridge waits ahead, its stones scarred by something old..."*
- Briar Wilds is wired through every existing area-shape contract: collision (terrain + object passability), autosave (per-frame autosave throttled), Reset Progress (clears `east_path_seen`, `briar_wilds_complete`, all per-zone fire flags, ember warmth — see US-101), exit transitions (fade-in/out, deterministic resume), F3 debug overlay (zones, exits, NPC radii — none expected since zero NPCs), lighting (the player ember overlay carries into Briar Wilds; the area registers no NPC lights since there are no NPCs).
- Zero NPCs in Briar Wilds (intentional — trial endured alone). No `NpcDefinition` entries in the area file.

**User guidance:**
- Discovery: After warming Wren and Old Man (or sooner — only `has_ember_mark` gates the exit), walk to the eastern edge of Ashen Isle; the brambles that previously blocked the path have parted.
- Manual section: `docs/plan/briar-wilds-manual-verify.md` — § US-100 Area + entry
- Key steps: 1) Pre-Ember: walk to the east edge of Ashen Isle; brambles block, no transition fires. 2) Receive the Ember (Keeper rescue). 3) Return to Ashen Isle; walk east; brambles have parted; transition fires; first-time thought plays. 4) Walk west on Briar Wilds to confirm return to Ashen Isle. 5) Walk to the far edge of Briar Wilds; closing reflection fires once.

**Design rationale:** East-gated entry preserves Ashen Isle's existing north-marsh layout (no reauthor) and lets the Ember mechanically unlock the path — the operator's chosen logic. Eastern direction also reads as "a new direction in Pip's grown journey," distinct from the marsh chapter to the north. Closing-reflection beat sets up `heart-bridge` (the next phase) without committing to its content, parallel to how homecoming-light's reflection set up briar-wilds.

#### US-101 — Ember warmth state — drain, restore, hard floor, visual binding

As a player walking the trials, I want to *feel* the cost of the road in the steady dimming of my ember, so that the trial reads as something endured, not something I won by skill.

**Acceptance criteria:**
- New file `src/systems/emberWarmth.ts` exports `EmberWarmthSystem` with `update(dt)` and `getCurrentWarmth(): number` (range `[WARMTH_FLOOR, 1.0]`).
- New named constants in the system file (single source, no magic numbers):
  - `WARMTH_MAX = 1.0`
  - `WARMTH_FLOOR = 0.3` (hard floor — ember **never** falls below this; it is the visual minimum, the trial-endured-but-still-lit state)
  - `WARMTH_DRAIN_PER_SECOND = 0.08` (so a continuous drain takes ~8s to fall from 1.0 to floor — tunable, committed value)
  - `WARMTH_RESTORE_PER_SECOND = 0.20` (restoration faster than drain — quiet places are *generous*, mirrors prayer; tunable, committed value)
- New flag `ember_warmth: number` persisted via the existing `flags.ts` store (numeric flag value); default value on first-ever set is `WARMTH_MAX`.
- Per-frame `update(dt)`: reads current zone state from the area (drain zone overlap → drain; quiet place overlap → restore; otherwise → no change — no drift); applies `Math.max(WARMTH_FLOOR, Math.min(WARMTH_MAX, current ± rate × dt))`; writes back to the flag store **only when the value actually changes by more than `WARMTH_WRITE_EPSILON = 0.005`** (Learning EP-01 — no per-frame localStorage IO; the in-memory flag value updates each frame, the persisted value updates only on epsilon-bounded changes).
- Visual binding: the player ember overlay's radius and alpha lerp linearly between two pairs of constants in `LIGHTING_CONFIG`:
  - `playerEmberRadiusFloor` (visual radius at warmth = `WARMTH_FLOOR`) and `playerEmberRadiusFull` (visual radius at warmth = `WARMTH_MAX`)
  - `playerEmberAlphaFloor` and `playerEmberAlphaFull`
  - Floor values chosen so the overlay remains clearly visible — the ember **never disappears**, kid-safe.
- The lighting system also dims the player's *light radius* in the lighting overlay along the same warmth axis (so dark scenes feel narrower when warmth is low) — separate constants `playerLightRadiusFloor` / `playerLightRadiusFull`. Floor value remains positive — the world is never pitch black.
- `EmberWarmthSystem` is constructed in `GameScene.create` only when the area registers drain zones OR quiet places (or always, since the system is cheap and harmless on areas with neither — pick the always path for simplicity; document the choice).
- Reset Progress: `resetAllFlags` clears `ember_warmth`; the warmth subscriber re-reads as `undefined` and the system seeds back to `WARMTH_MAX` on the same tick.
- Continue-from-save: warmth value loads from localStorage on scene boot; the player ember overlay renders at the saved warmth's visual radius/alpha within one frame of `create`.
- Per-frame work allocates **zero** JS objects (mutates a single private numeric field; calls `setPosition` / `setScale` / `setAlpha` on the existing overlay GameObject; no `{}`/`[]` literals — Learning EP-01).
- The F3 debug overlay shows current `warmth` value and current zone state (drain / quiet / neutral).
- TypeScript build passes (`npx tsc --noEmit && npm run build`).

**User guidance:**
- Discovery: First seen on entering Briar Wilds — the ember's visual radius starts at full and shrinks while in drain zones, restores in quiet places.
- Manual section: `docs/plan/briar-wilds-manual-verify.md` — § US-101 Warmth state
- Key steps: 1) Enter Briar Wilds with full warmth. 2) Walk through a drain zone; observe the ember overlay shrinking and the world dimming. 3) Walk into a quiet place; observe restoration. 4) Stand in a drain zone for ≥10s; confirm the ember stops shrinking at the visible floor (does not disappear). 5) Refresh the browser mid-drain; Continue resumes at the saved warmth value (overlay matches). 6) Reset Progress; warmth restores to full.

**Design rationale:** A single-axis state is the smallest possible compounding state — one new variable, one verb (walk-through), one floor (never extinguish). Faster restoration than drain mirrors prayer's generosity. The hard floor is the design promise to a 6–12 audience: this is not a fail state. Persisting the warmth across reload + transition means the trial *carries*; you cannot reset it by stepping back to Ashen Isle.

#### US-102 — Drain zones + doubt voices

As a player walking the trials, I want certain patches of the wilds to drain my ember and to whisper internal doubts as I cross them, so that the trial has texture and the doubts feel like my own weariness, not an external enemy.

**Acceptance criteria:**
- New optional field `AreaDefinition.drainZones?: DrainZoneDefinition[]` typed as `{ id: string, col: number, row: number, width: number, height: number, drainMultiplier?: number, doubts?: ThoughtDoubtSequence }`.
- `EmberWarmthSystem` checks per frame whether the player's bounding box centre overlaps any drain zone; if yes, drain rate = `WARMTH_DRAIN_PER_SECOND × (drainMultiplier ?? 1)`.
- On player **entry** into a drain zone (transition from outside → inside), if a `doubts` sequence is configured, the next doubt line is queued to the existing `ThoughtBubbleSystem` via `displayThought`.
- Doubt-line **escalation**: a per-zone integer flag `doubt_count_<zoneId>` increments on each fresh entry; the next line shown is `doubts.lines[doubt_count_<zoneId> % doubts.lines.length]` so re-entries cycle through the configured set.
- The doubt line uses the existing thought-bubble visual (cream/umber storybook bubble) — no new visual style; the *content* carries the tone (internal weariness, see Design direction).
- Briar Wilds defines **at least 2 drain zones** with at least **3 doubt lines each** (committed in `briar-wilds.ts`).
- Visual cue at each drain zone: tile-snapped decoration cluster (twisted gold light glyphs over dead bramble — sickly false-hope read), 4–8 decorations per zone, palette-driven (no raw hex; uses `STYLE_PALETTE.hopeGoldDeep` or similar tinted toward sick-warm).
- Drain zones do **not** block movement — Pip walks freely through; the cost is felt in the ember dimming and the doubt bubbles, not in collision.
- No fail state at any drain configuration — even with all drain zones traversed continuously, warmth stops at `WARMTH_FLOOR` (verified by US-101 floor; this story re-verifies the negative).
- Drain-zone overlap check is O(1) per zone per frame and allocates zero objects (Learning EP-01).
- Reset Progress clears all `doubt_count_<zoneId>` flags so a fresh playthrough starts the doubt sequences from the beginning.
- F3 debug overlay renders drain zone rectangles in a distinct color (e.g. `STYLE_PALETTE.burntSienna`) at the existing debug depth.

**User guidance:**
- Discovery: Walk Briar Wilds; you will pass through 2+ patches where the ground glows sickly gold over dead bramble. Each entry whispers a doubt.
- Manual section: `docs/plan/briar-wilds-manual-verify.md` — § US-102 Drain zones
- Key steps: 1) Enter Briar Wilds with full warmth. 2) Walk into the first drain zone; observe the ember dimming and a doubt bubble. 3) Walk out and back in; observe a *different* doubt line on re-entry (escalation). 4) Cross all drain zones in sequence; confirm the ember stops at the visible floor and never disappears. 5) Walk through with no quiet-place stops; reach the far edge — Pip arrives dim but lit.

**Design rationale:** Drain zones folded with doubt voices keep the spec tight (one story, two reinforcing surfaces). Internal-weariness tone (not external menace) fits the kid-safe brief and the gospel-allegory pattern of doubt as the believer's own fight, not a personalised enemy. Visual false-hope cue makes the trap *legible* — the player can see what's draining them, which is itself part of the lesson (sin presents as warmth, costs warmth). Re-entry cycling means the doubts feel responsive without authoring an essay.

#### US-103 — Quiet places + closing reflection

As a player walking the trials, I want small clearings of restoration where my ember steadies, and a soft moment at the end of the wilds that turns me toward what's next, so that the trial has rhythm and the journey reads as continuing.

**Acceptance criteria:**
- New optional field `AreaDefinition.quietZones?: QuietZoneDefinition[]` typed as `{ id: string, col: number, row: number, width: number, height: number, restoreMultiplier?: number, narration?: ThoughtNarrationSequence }`.
- `EmberWarmthSystem` checks per frame whether the player's bounding box centre overlaps any quiet zone; if yes, restore rate = `WARMTH_RESTORE_PER_SECOND × (restoreMultiplier ?? 1)`.
- Drain and quiet overlap precedence: if a player is in BOTH a drain zone AND a quiet zone (overlapping definitions), the **quiet zone wins** (restoration overrides drain; design choice — grace stronger than trial). Behaviour committed in code with a code comment naming the design intent.
- Narration on **first entry** into each quiet zone: a one-time-per-zone thought-bubble line (e.g. *"Pip's ember steadies."*, *"The bramble parts here."*) — fired by setting a flag `quiet_seen_<zoneId>` on first entry.
- Each quiet zone auto-registers a **tier-2 light** (visible only with `has_ember_mark == true` — existing tier-2 mechanism) at the zone centre so the player sees quiet places as bright pockets after the Ember; placement uses the existing `LightingSystem.registerLight` API.
- Visual cue at each quiet zone: tile-snapped decoration cluster (a small clearing — glowing sapling, quiet stone, breathing-room composition), 3–6 decorations per zone, palette-warm-gold using `STYLE_PALETTE.hopeGoldLight`.
- Briar Wilds defines **at least 2 quiet zones** with first-entry narration committed in code.
- The closing-reflection trigger from US-100 fires from a quiet-place context near the far edge of Briar Wilds (the closing reflection IS one of the quiet zones, with the closing-reflection thought sequence as its narration AND the `briar_wilds_complete` setFlag as a second-tier set); this avoids requiring two side-by-side narrative beats at the same tile.
- Reset Progress clears all `quiet_seen_<zoneId>` flags; first-entry narration plays again on a fresh playthrough.
- Quiet-zone overlap check is O(1) per zone per frame and allocates zero objects (Learning EP-01).
- F3 debug overlay renders quiet zone rectangles in a distinct color (e.g. `STYLE_PALETTE.hopeGoldLight`) at the existing debug depth.

**User guidance:**
- Discovery: Walk Briar Wilds; alongside drain zones you will pass small clearings — a glowing sapling, a quiet stone — where the ember steadies.
- Manual section: `docs/plan/briar-wilds-manual-verify.md` — § US-103 Quiet places
- Key steps: 1) Walk through a drain zone with reduced warmth. 2) Step into the next quiet place; observe the ember restoring and a one-time narration line. 3) Step out and back in; observe no narration on re-entry (one-shot). 4) Reach the far quiet place at the eastern edge; the closing reflection plays; `briar_wilds_complete` is set; the line ends with a forward-look toward the Heart Bridge.

**Design rationale:** Quiet places give the trial *rhythm* — without them the phase reads as one long sustained drain, which is bleak. Restoration faster than drain keeps the trial bearable for a young player. Tier-2 lighting at quiet places means they read as *visible* warmth pockets in the world, the inverse of drain zones' false-warmth — the player learns to read the visual vocabulary. Folding the closing reflection into a quiet zone (rather than a separate trigger) is intentional — the journey turns at a place of rest, not at a place of doubt.

## Done-when (observable)

### US-99 — Warmed-NPC visible brightening

- [ ] `LIGHTING_CONFIG.npcWarmedRadius` constant defined; value ≥ `1.5 × LIGHTING_CONFIG.npcRadius` [US-99]
- [ ] `LIGHTING_CONFIG.npcWarmedIntensity` constant defined; value ≥ `2 × LIGHTING_CONFIG.npcIntensity` [US-99]
- [ ] All call sites that re-register a warmed NPC's light read from these constants — no inline magic numbers [US-99]
- [ ] On `npc_warmed_wren` flip, Wren's tier-1 light is re-registered with `npcWarmedRadius` + `npcWarmedIntensity` (existing `LightingSystem.registerLight` idempotent overwrite — Learning #63) [US-99]
- [ ] On `npc_warmed_old_man` flip, Old Man's tier-1 light is re-registered with `npcWarmedRadius` + `npcWarmedIntensity` [US-99]
- [ ] On `npc_refused_driftwood` flip, Driftwood's light is **NOT** re-registered (negative criterion — explicit code path verified) [US-99]
- [ ] Manual-verify § US-99: visit Wren before warming, note local light/colour; warm Wren, visit again — measurable proxy: at the NPC's tile, the lit *radius in tiles* visibly extends ≥ 1 tile wider than baseline AND the local area shows perceptibly more original colour than surrounding greyscale (in-engine smoke at desktop ~1280×720 + mobile 360×640 viewports — Learning EP-03) [US-99]
- [ ] Manual-verify § US-99: same observation for Old Man (post-Wren) [US-99]
- [ ] Manual-verify § US-99: walk past Driftwood after refusing; confirm no brightening (negative observation) [US-99]
- [ ] Brightening persists across area transitions (manual-verify: enter Fog Marsh and return to Ashen Isle; warmed NPC bubble still visible) [US-99]
- [ ] Reset Progress restores baseline radius/intensity (manual-verify: warm Wren, observe bubble, Reset Progress, return to Ashen Isle, confirm bubble back to baseline) [US-99]
- [ ] F3 debug overlay shows the new warmed radius/intensity values when a warmed NPC's light is in the registered list [US-99]

### US-100 — Briar Wilds area + east-gated entry

- [ ] `src/data/areas/briar-wilds.ts` exists; exports an `AreaDefinition` with `terrain` (vertex grid) ≥ 30 wide × 24 tall, `objects` array (sparse), `tileset: 'briar-wilds'`, west-edge exit(s) returning to Ashen Isle, no `npcs` entries [US-100]
- [ ] `briar-wilds` registered in `src/data/areas/registry.ts` (so `getArea('briar-wilds')` returns the definition) [US-100]
- [ ] `TILESETS` registry in `src/maps/tilesets.ts` includes `briar-wilds` entry with `wang.primaryTerrain` and `wang.secondaryTerrain` set to the new terrain ids; both terrains added to `src/maps/terrain.ts` `TERRAINS` registry with `passable` flags committed [US-100]
- [ ] PixelLab Wang tileset for Briar Wilds generated via `mcp__pixellab__create_topdown_tileset` (personal account — Learning EP-05); generated atlas committed to `assets/tilesets/briar-wilds/tilemap.png` + `tilemap.json` provenance [US-100]
- [ ] At least 3 new object kinds added to `src/maps/objects.ts` `OBJECT_KINDS` registry: `bramble-cluster` (impassable), `dead-tree` (impassable), `twisted-root` (passable). Each kind references a generated PixelLab atlas frame committed under `assets/objects/<kind>/` (or the chosen path convention used by `tile-architecture`); each frame's `passable` flag matches the design intent above [US-100]
- [ ] Atlas frame-pick verification: a labeled-atlas preview is generated (via `tools/atlas-preview.py` OR `maps/atlasPreview.ts` browser path) for the new tileset AND for the new object kinds; each Wang mask's picked frame and each object frame is visually confirmed before commit lands. Verification step recorded in the phase log entry as a yes/no with one-line observation per surface (compounded rule — Learning EP-03 / `visual-pick-without-verification`) [US-100]
- [ ] `src/data/areas/ashen-isle.ts` adds an east-edge exit at a committed `(col, row)` with `condition: 'has_ember_mark == true'` and `destination: 'briar-wilds'` plus a destination entry-point [US-100]
- [ ] Ashen Isle adds a conditional decoration cluster (≥4 tile-snapped bramble decorations) over the east exit tiles with `condition: 'has_ember_mark == false'` so brambles render pre-Ember and are removed post-Ember (existing conditional-decoration mechanism; flag-change subscriber re-evaluates on Ember flip — Learning EP-01) [US-100]
- [ ] Pre-Ember: walking onto the east exit tile does NOT fire a transition (condition gate suppresses; manual-verify) [US-100]
- [ ] Post-Ember: walking onto the east exit tile fires the fade transition to Briar Wilds (manual-verify) [US-100]
- [ ] First-time-arrival thought trigger added to Ashen Isle near the east exit: `condition: 'has_ember_mark == true && east_path_seen == false'`, `setFlags: { east_path_seen: true }`, `repeatable: false`, `type: 'thought'`, sequence at least 1 line ending similar to *"The brambles have parted. A road east."* [US-100]
- [ ] West-edge exit on Briar Wilds returns Pip to the entry tile of Ashen Isle (manual-verify: walk west on Briar Wilds; arrive on Ashen Isle near the east exit tile) [US-100]
- [ ] Closing-reflection trigger placed at a committed `(col, row)` near the far edge of Briar Wilds: `condition: 'briar_wilds_complete == false'`, `setFlags: { briar_wilds_complete: true }`, `repeatable: false`, `type: 'thought'`, sequence ≥3 lines ending on a forward-look toward the Heart Bridge (line text committed in code) [US-100]
- [ ] Briar Wilds inherits all existing area behaviours: per-frame autosave throttled (write fires on real movement only — Learning EP-01); fade transitions on enter and exit; F3 debug overlay renders zones/exits; player ember overlay carries into the area; player position persists across reload via existing `saveState` (manual-verify covers each) [US-100]
- [ ] Reset Progress clears `east_path_seen`, `briar_wilds_complete`, `doubt_count_*`, `quiet_seen_*`, `ember_warmth` (covered by existing `resetAllFlags` — verified via flag-store snapshot in manual-verify) [US-100]
- [ ] In-engine smoke test passes at desktop viewport (~1280×720) AND mobile viewport (DevTools 360×640): walk Ashen Isle → bramble-blocked east exit pre-Ember → Keeper rescue → return → bramble parts → walk into Briar Wilds → walk to closing reflection → reflection fires → return west to Ashen Isle (Learning EP-03) [US-100]

### US-101 — Ember warmth state

- [ ] New file `src/systems/emberWarmth.ts` exports `EmberWarmthSystem` class with `update(dt: number): void` and `getCurrentWarmth(): number` [US-101]
- [ ] Constants `WARMTH_MAX = 1.0`, `WARMTH_FLOOR = 0.3`, `WARMTH_DRAIN_PER_SECOND = 0.08`, `WARMTH_RESTORE_PER_SECOND = 0.20`, `WARMTH_WRITE_EPSILON = 0.005` defined in `emberWarmth.ts` (single source; no duplication) [US-101]
- [ ] `ember_warmth` numeric flag persisted via the existing `flags.ts` flag store; initial value on first-ever set is `WARMTH_MAX`. If the existing `FlagValue` type does not already accept floats, the type is extended (or a sibling persistence field is added to `saveState.ts`) — choice committed in code with a one-line comment naming the rationale [US-101]
- [ ] Error-path: on `GameScene.create`, if the loaded `ember_warmth` value is non-finite (NaN/±∞), out of `[WARMTH_FLOOR, WARMTH_MAX]`, or the wrong type, the system clamps to the valid range (or seeds back to `WARMTH_MAX` if unrecoverable) AND emits a once-per-session warn — no crash, no zero-radius / infinite-radius overlay (mirrors existing `saveState` scrub-on-corrupt pattern) [US-101]
- [ ] Per-frame `update(dt)` clamps to `[WARMTH_FLOOR, WARMTH_MAX]`; the ember **never** goes below `WARMTH_FLOOR` (verify with stress: stand in a drain zone for ≥30s; warmth holds at floor) [US-101]
- [ ] Persisted flag value updates only when in-memory value diverges by `> WARMTH_WRITE_EPSILON` from last persisted value (Learning EP-01 — no per-frame localStorage IO) [US-101]
- [ ] Visual binding: player ember overlay's radius lerps between `LIGHTING_CONFIG.playerEmberRadiusFloor` (at warmth = `WARMTH_FLOOR`) and `playerEmberRadiusFull` (at warmth = `WARMTH_MAX`); alpha lerps between `playerEmberAlphaFloor` and `playerEmberAlphaFull`; **all four constants are committed values such that the overlay remains clearly visible at floor** [US-101]
- [ ] Lighting overlay: player light radius in the lighting RT lerps between `LIGHTING_CONFIG.playerLightRadiusFloor` and `playerLightRadiusFull`; floor value > 0 so the world is never pitch black [US-101]
- [ ] `EmberWarmthSystem` constructed in `GameScene.create` regardless of area (cheap on areas with no zones; safer than conditional construction) — choice documented in code comment [US-101]
- [ ] System reads the active area's `drainZones` and `quietZones` arrays via constructor parameter; no global imports [US-101]
- [ ] Per-frame work allocates **zero** JS object literals (verified by code review: no `{}` / `[]` inside `update()`; coordinates passed via primitive args; only `setPosition` / `setScale` / `setAlpha` mutations on the existing overlay) [US-101]
- [ ] Reset Progress: `resetAllFlags` clears `ember_warmth`; `EmberWarmthSystem`'s flag-change subscriber receives `undefined` and seeds back to `WARMTH_MAX` on the same tick (verified by flag-store snapshot + observed full-radius overlay restoration in manual-verify) [US-101]
- [ ] Continue-from-save: warmth value loads from localStorage on `GameScene.create`; player ember overlay renders at the saved warmth's visual radius/alpha within one frame of `create` (manual-verify: refresh mid-drain, click Continue, observe overlay at the dimmed visual state) [US-101]
- [ ] F3 debug overlay shows `warmth: <0.00–1.00>` and `zone: drain | quiet | neutral` in the HUD provider [US-101]
- [ ] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-101]
- [ ] In-engine smoke test (Learning EP-03): walk into Briar Wilds at full warmth → drain zone → observe overlay shrink and world dim → quiet place → observe overlay restore → stress hold in drain ≥30s → confirm visual floor → desktop viewport (~1280×720) + mobile (360×640) [US-101]

### US-102 — Drain zones + doubt voices

- [ ] New optional field `AreaDefinition.drainZones?: DrainZoneDefinition[]` added to `src/data/areas/types.ts` with shape `{ id, col, row, width, height, drainMultiplier?, doubts? }`; `ThoughtDoubtSequence` typed as `{ lines: string[] }` (or equivalent) [US-102]
- [ ] `EmberWarmthSystem` consumes `drainZones` and applies drain rate while player bounding box centre overlaps any zone [US-102]
- [ ] On player entry transition (outside → inside) into a drain zone, `incrementFlag('doubt_count_<zoneId>')` fires AND the next doubt line `doubts.lines[(doubt_count_<zoneId> - 1) % doubts.lines.length]` is queued via `ThoughtBubbleSystem.displayThought` [US-102]
- [ ] Briar Wilds defines **at least 2 drain zones** with **at least 3 doubt lines each** committed in `briar-wilds.ts`; doubt-line tone matches the design direction (internal weariness, not external menace — verified by reading the committed lines) [US-102]
- [ ] Each drain zone has a tile-snapped visual decoration cluster (4–8 decorations) using PixelLab-generated false-hope frames tinted toward sick-warm gold; palette-driven (no raw hex literals — uses `STYLE_PALETTE.*` constants) [US-102]
- [ ] Drain zones do NOT contribute to collision (verified: walk through a drain zone; no slow-down or block) [US-102]
- [ ] Per-frame drain check is O(1) per zone and allocates zero objects (code review verifies no per-frame object allocation in the overlap check) [US-102]
- [ ] Reset Progress clears all `doubt_count_*` flags (covered by existing `resetAllFlags` — verified via flag-store snapshot) [US-102]
- [ ] F3 debug overlay renders drain zone rectangles in a distinct color at the existing debug depth (existing rendering pattern; new color from `STYLE_PALETTE`) [US-102]
- [ ] In-engine smoke test (Learning EP-03): enter drain zone at full warmth → observe ember dim + first doubt line → walk out and back in → observe DIFFERENT doubt line (escalation) → cross drain zone repeatedly until cycle wraps → confirm cycle behaviour matches `% lines.length`; desktop + mobile viewports [US-102]
- [ ] Negative verification: stand in a drain zone for ≥30s; warmth holds at `WARMTH_FLOOR`, no fail state, no respawn, doubt bubbles continue to queue normally [US-102]
- [ ] Error-path: drain zones with `(col, row)` outside the area's terrain grid OR with `width`/`height ≤ 0` are skipped on area load with a once-per-session warn naming the offending zone id; the area still loads and other zones still function (no crash on author error) [US-102]

### US-103 — Quiet places + closing reflection

- [ ] New optional field `AreaDefinition.quietZones?: QuietZoneDefinition[]` added to `src/data/areas/types.ts` with shape `{ id, col, row, width, height, restoreMultiplier?, narration? }` [US-103]
- [ ] `EmberWarmthSystem` consumes `quietZones` and applies restore rate while player bounding box centre overlaps any zone [US-103]
- [ ] Drain + quiet overlap precedence: when player is inside both, **quiet wins** (restore is applied; drain is suppressed for that frame). Behaviour committed in code with a one-line comment naming the design intent [US-103]
- [ ] On player entry into a quiet zone, if `quiet_seen_<zoneId> == false`, the narration line is queued via `ThoughtBubbleSystem.displayThought` and `setFlag('quiet_seen_<zoneId>', true)` fires; on subsequent entries no narration plays (one-shot per zone) [US-103]
- [ ] Each quiet zone auto-registers a tier-2 light at the zone centre via `LightingSystem.registerLight({ id: 'quiet:<zoneId>', x, y, radius, intensity, tier: 2 })`; tier-2 means the light renders at intensity 0 until `has_ember_mark == true` (existing tier-2 mechanism) [US-103]
- [ ] Briar Wilds defines **at least 2 quiet zones** with first-entry narration committed in `briar-wilds.ts` [US-103]
- [ ] Each quiet zone has a tile-snapped decoration cluster (3–6 decorations) using PixelLab-generated quiet-place frames (sapling, stone, breathing-room composition); palette-warm-gold using `STYLE_PALETTE.hopeGoldLight` (no raw hex) [US-103]
- [ ] The closing-reflection beat (US-100) is implemented as one of Briar Wilds' quiet zones, with the closing-reflection thought sequence as its `narration` AND with a separate `setFlags: { briar_wilds_complete: true }` mechanism so the same zone serves both restoration and the journey-turn beat [US-103]
- [ ] Per-frame quiet-check is O(1) per zone and allocates zero objects [US-103]
- [ ] Reset Progress clears all `quiet_seen_*` flags (covered by `resetAllFlags`; first-entry narration plays again on a fresh playthrough — manual-verify) [US-103]
- [ ] F3 debug overlay renders quiet zone rectangles in a distinct color (e.g. `STYLE_PALETTE.hopeGoldLight`) [US-103]
- [ ] In-engine smoke test (Learning EP-03): walk through drain zone; warmth dims → step into quiet place; observe restore + first-entry narration → step out and back in; observe NO narration → reach far quiet place; observe closing reflection sequence + `briar_wilds_complete` set; desktop + mobile viewports [US-103]
- [ ] Error-path: quiet zones with `(col, row)` outside the area's terrain grid OR with `width`/`height ≤ 0` are skipped on area load with a once-per-session warn naming the offending zone id; the area still loads and other zones still function (no crash on author error) [US-103]
- [ ] Closing-reflection narration sequence is rendered as multiple sequential thought bubbles via the existing `ThoughtBubbleSystem` queue (≥3 lines, one bubble per line, queued in order, dismissed sequentially) — verified by manual-verify subsection observing each line in turn [US-103]

### Auto-added safety criteria

- [ ] All new condition strings (east exit gate, conditional decorations, drain/quiet overlap conditions, doubt/narration triggers) parse through the existing `evaluateCondition` parser — no new condition syntax, no `eval`/`Function` constructor introduced [phase]
- [ ] All new flag names (`east_path_seen`, `briar_wilds_complete`, `doubt_count_<zoneId>`, `quiet_seen_<zoneId>`, `ember_warmth`) are scoped to the existing `flags.ts` store; no parallel persistence layer introduced [phase]
- [ ] All asset paths (PixelLab tilesets, object frames, decoration frames) come from author-defined registries (`TILESETS`, `OBJECT_KINDS`, area `decorations` arrays); no user-provided strings reach asset-loading code [phase]
- [ ] Doubt-line and narration text rendered via the existing thought-bubble `text` property path (no `innerHTML` / raw-string DOM injection) [phase]
- [ ] All new `LIGHTING_CONFIG` numeric fields (`npcWarmedRadius`, `npcWarmedIntensity`, `playerEmberRadiusFloor/Full`, `playerEmberAlphaFloor/Full`, `playerLightRadiusFloor/Full`) have explicit committed values, not `undefined`-by-default, so a missing config field cannot silently disable a feature [phase]

### Async-cleanup safety

- [ ] `EmberWarmthSystem` registers any `onFlagChange` subscribers (e.g., for `ember_warmth` reset on Reset Progress) and collects unsubscribe functions invoked in the system's `destroy()` / `cleanupResize` path (no subscriber leaks across `scene.restart` — Learning EP-02) [phase]
- [ ] Tier-2 lights registered by quiet zones are de-registered (or left to the existing scene-shutdown lighting cleanup) — verified that area transitions don't leak quiet-zone lights from Briar Wilds back into Ashen Isle [phase]
- [ ] All instance-field GameObject references in `EmberWarmthSystem` (if any) are reset at the top of the system's setup/restart-relevant method (Learning EP-02) [phase]

### Class baseline check (Briar Wilds joins the existing Area class)

- [ ] Briar Wilds wired through every existing area-shape contract enumerated in US-100; explicit re-verification per item in manual-verify [class:US-100]
- [ ] New object kinds (`bramble-cluster`, `dead-tree`, `twisted-root`) implement every `ObjectKindDefinition` field used by existing kinds: `id`, `atlasKey`, `frame`, `passable`, optional `footprint` (omitted explicitly if not used) [class:US-100]
- [ ] New terrain ids (`briar-floor`, `briar-thorn` or chosen names) implement every `TerrainDefinition` field used by existing terrains: `id`, `passable`, `wangTilesetId`, `description` [class:US-100]

### Variant baseline check (warming brightening + ember overlay across both areas)

- [ ] Warmed-NPC brightening verified per-NPC: explicit checkboxes for **Wren** AND **Old Man** in the manual-verify doc; not "tested with one, assumed for both" [variant:US-99]
- [ ] Driftwood verified to NOT brighten: explicit negative checkbox in manual-verify [variant:US-99]
- [ ] Player ember overlay visual-binding verified in **Ashen Isle** (warmth at max, no zones — overlay reads at full radius/alpha) AND in **Fog Marsh** (warmth at max, no zones — same baseline) AND in **Briar Wilds** (warmth varies by zone — overlay shrinks/restores within bounds). Three explicit per-area checkboxes [variant:US-101]
- [ ] Ember warmth state persists correctly across all three areas: enter Briar Wilds, drain to floor, walk back to Ashen Isle, walk to Fog Marsh, return to Briar Wilds — warmth value carries (not reset on transition); verified by F3 HUD readout per area [variant:US-101]

### Phase-level / structural

- [ ] `AGENTS.md` reflects new modules (`systems/emberWarmth.ts`), new directories (`assets/tilesets/briar-wilds/`, possibly `assets/objects/<kind>/`), and new behaviour rules (ember warmth state, drain zones, quiet places, warmed-NPC brightening) introduced in this phase [phase]
- [ ] Manual-verify file `docs/plan/briar-wilds-manual-verify.md` exists with: § US-99 Warmed-NPC visibility, § US-100 Area + entry, § US-101 Warmth state, § US-102 Drain zones, § US-103 Quiet places + closing — each as plain-language step-by-step walkthroughs (numbered concrete actions with described visible outcomes), ending with: *"If any step doesn't behave as described, record it in `docs/plan/briar-wilds-known-issues.md`. Phase cannot be marked complete until each gap is either fixed or explicitly deferred."* (Learning EP-06) [phase]
- [ ] PixelLab generation budget tracked in the phase log: count of generations fired against `mcp__pixellab__` (personal) — explicit Y/N that team server (`mcp__pixellab-team__`) was NOT used (Learning EP-05) [phase]
- [ ] Atlas frame-pick verification artefact (labeled-atlas PNG) generated and reviewed for the new Briar Wilds tileset AND for each new object kind; verification recorded as a yes/no with one-line observation per surface in the phase log (Learning EP-03) [phase]
- [ ] Per-zone and false-light-as-decoration "reads as" tests recorded in manual-verify: drain zone reads as *false hope*, quiet place reads as *rest*, warmed-NPC area reads as *restored colour bubble* (compounded "reads as" rule) [phase]
- [ ] Out-of-scope items explicitly listed in this spec are NOT shipped: scripture artifact / *remember* verb (deferred to `the-word`), explicit decoy-as-object class (deferred to `polish-and-vibe`), Briar Wilds NPCs (intentional zero), audio (deferred), per-zone fail/respawn (no fail state by design) [phase]

## Golden principles (phase-relevant)

- **Show, don't preach** — drain zones, doubt voices, ember dimming carry the meaning; no in-game explanation of the allegory
- **Mechanical truth** — the trial is felt, not told (Gospel principle #2); warmed NPCs visibly carry restored colour
- **No villains** — doubt voices are internal weariness, not external menace; drain zones are *uneasy*, not malicious (Gospel principle #3)
- **Free gift** — quiet places restore freely; the player does not earn restoration with skill (mirrors prayer)
- **Restoration targets persons, not objects** — warmed-NPC brightening (US-99) is the visible restoration of a *person*; drain/quiet zones affect Pip's interior state (warmth), not the bramble itself (Gospel principle #8)
- **The trial is endured by walking through, not won by skill** — hard floor on warmth, no fail state, no respawn, no skill check (master PRD Design Risk: ember dimming for 6–12 audience)
- **Loop-invariant operations and dead-guard avoidance (Learning EP-01)** — warmth flag persisted only on epsilon-bounded change, zone overlap checks zero-allocation, ember-overlay updates use mutate-not-allocate
- **Phaser scene-restart hygiene (Learning EP-02)** — `EmberWarmthSystem` instance fields reset at top of setup; subscribers collected and cleaned in shutdown
- **Visual stories require an in-engine smoke test (Learning EP-03)** — every story with a visible surface (US-99, US-100, US-101, US-102, US-103) has a desktop + mobile in-engine smoke test recorded before the story can be marked complete
- **Pattern-reuse criteria must be context-checked at spec time (Learning EP-04)** — visual binding for the player ember overlay reuses the existing main-camera overlay pattern (not the UI-camera dialogue scaling pattern); doubt-voice/narration reuses the existing main-camera thought-bubble pattern (already shipped)
- **Verify which MCP server has remaining budget (Learning EP-05)** — all PixelLab generations this phase fire against `mcp__pixellab__` (personal); team server not used; logged in phase log
- **Author-facing UX gaps (Learning EP-06)** — manual-verify file is plain-language step-by-step walkthroughs, not abstract jargon; gaps escalate to `briar-wilds-known-issues.md`

## AGENTS.md sections affected

- **Directory layout** — new `src/systems/emberWarmth.ts`; new `src/data/areas/briar-wilds.ts`; new `assets/tilesets/briar-wilds/` directory; new entries under `assets/objects/` (or chosen path) for new object kinds
- **File ownership** — add `systems/emberWarmth.ts` row (EmberWarmthSystem responsibilities); add `data/areas/briar-wilds.ts` row (Briar Wilds area definition + drain/quiet zones + closing reflection); update `data/areas/types.ts` row to mention new optional `drainZones` / `quietZones` fields; update `data/areas/ashen-isle.ts` row to mention new east exit + bramble decoration; update `maps/tilesets.ts` and `maps/objects.ts` rows for new entries
- **Behavior rules** — add "Ember warmth state" rule (system, drain/restore, hard floor, visual binding, persistence); add "Drain zones" rule (entry/escalation, doubt voices, no collision, no fail state); add "Quiet places" rule (restoration, narration on first entry, tier-2 lighting, drain-overlap precedence); update "POI lighting" rule with the new warmed NPC `npcWarmedRadius` / `npcWarmedIntensity` constants; add east-exit gate to Conditional exits and decorations rule
- **Depth map** — verify the lighting overlay (depth 6) and player ember overlay (depth 5.5) accommodate the new warmth-driven binding without re-banding; expected: no new depth bands needed
- **Quality checks** — no changes (existing `no-silent-pass`, `no-bare-except`, `error-path-coverage`, `agents-consistency` cover the new code)

## User documentation impact

- New file: `docs/plan/briar-wilds-manual-verify.md` — per-story plain-language walkthroughs (Learning EP-06) + reads-as observer tests + reset-progress verification + cross-area variant checks
- No master-PRD update needed (the master PRD already lists `briar-wilds` in the Implementation Roadmap with the exact mechanic introduced)
- PRD index (`docs/product/PRD.md`) updated by the spec-author auto-proceed step with a new row: `| briar-wilds | Draft | US-99, US-100, US-101, US-102, US-103 | [phases/briar-wilds.md](phases/briar-wilds.md) |` and the `Next up` paragraph rewritten to describe `briar-wilds`
