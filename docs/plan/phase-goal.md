# Phase: briar-wilds

## Phase goal

Stage 4 of Pip's pilgrim journey — **trials and hardship**. After homecoming-light's spiritual high, Pip leaves Ashen Isle eastward (a path the Ember has just opened) and walks into the Briar Wilds: thorny, twisted, mist-grey, oppressive but never cruel. The phase introduces one new state — **ember warmth** — which drains in *drain zones* (twisted false-hope patches that lure with sickly gold) and restores in *quiet places* (small clearings with a glowing sapling or quiet stone). The ember dims visibly but **never extinguishes** (hard floor at `WARMTH_FLOOR = 0.3`); doubt-voice thought bubbles fire while Pip is in drain zones; ambient narration on entering a quiet place. The trial is endured by walking through, not won by skill — there is no fail state, no respawn, no skill check. The phase also corrects a perception gap shipped in homecoming-light: warmed NPCs (Wren, Old Man) become *visibly* brighter in the world so Pip can look back from the trial road and see the bright pockets of grace already given. Closes with a soft forward-looking thought near the far edge of Briar Wilds turning Pip toward the Heart Bridge that waits beyond.

### Stories in scope

- US-99 — Warmed-NPC visible brightening (homecoming-light polish)
- US-100 — Briar Wilds area + east-gated entry from Ashen Isle
- US-101 — Ember warmth state — drain, restore, hard floor, visual binding
- US-102 — Drain zones + doubt voices
- US-103 — Quiet places + closing reflection

### Done-when (observable)

#### US-99 — Warmed-NPC visible brightening

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

#### US-100 — Briar Wilds area + east-gated entry

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

#### US-101 — Ember warmth state

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

#### US-102 — Drain zones + doubt voices

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

#### US-103 — Quiet places + closing reflection

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

#### Auto-added safety criteria

- [ ] All new condition strings (east exit gate, conditional decorations, drain/quiet overlap conditions, doubt/narration triggers) parse through the existing `evaluateCondition` parser — no new condition syntax, no `eval`/`Function` constructor introduced [phase]
- [ ] All new flag names (`east_path_seen`, `briar_wilds_complete`, `doubt_count_<zoneId>`, `quiet_seen_<zoneId>`, `ember_warmth`) are scoped to the existing `flags.ts` store; no parallel persistence layer introduced [phase]
- [ ] All asset paths (PixelLab tilesets, object frames, decoration frames) come from author-defined registries (`TILESETS`, `OBJECT_KINDS`, area `decorations` arrays); no user-provided strings reach asset-loading code [phase]
- [ ] Doubt-line and narration text rendered via the existing thought-bubble `text` property path (no `innerHTML` / raw-string DOM injection) [phase]
- [ ] All new `LIGHTING_CONFIG` numeric fields (`npcWarmedRadius`, `npcWarmedIntensity`, `playerEmberRadiusFloor/Full`, `playerEmberAlphaFloor/Full`, `playerLightRadiusFloor/Full`) have explicit committed values, not `undefined`-by-default, so a missing config field cannot silently disable a feature [phase]

#### Async-cleanup safety

- [ ] `EmberWarmthSystem` registers any `onFlagChange` subscribers (e.g., for `ember_warmth` reset on Reset Progress) and collects unsubscribe functions invoked in the system's `destroy()` / `cleanupResize` path (no subscriber leaks across `scene.restart` — Learning EP-02) [phase]
- [ ] Tier-2 lights registered by quiet zones are de-registered (or left to the existing scene-shutdown lighting cleanup) — verified that area transitions don't leak quiet-zone lights from Briar Wilds back into Ashen Isle [phase]
- [ ] All instance-field GameObject references in `EmberWarmthSystem` (if any) are reset at the top of the system's setup/restart-relevant method (Learning EP-02) [phase]

#### Class baseline check (Briar Wilds joins the existing Area class)

- [ ] Briar Wilds wired through every existing area-shape contract enumerated in US-100; explicit re-verification per item in manual-verify [US-100]
- [ ] New object kinds (`bramble-cluster`, `dead-tree`, `twisted-root`) implement every `ObjectKindDefinition` field used by existing kinds: `id`, `atlasKey`, `frame`, `passable`, optional `footprint` (omitted explicitly if not used) [US-100]
- [ ] New terrain ids (`briar-floor`, `briar-thorn` or chosen names) implement every `TerrainDefinition` field used by existing terrains: `id`, `passable`, `wangTilesetId`, `description` [US-100]

#### Variant baseline check (warming brightening + ember overlay across both areas)

- [ ] Warmed-NPC brightening verified per-NPC: explicit checkboxes for **Wren** AND **Old Man** in the manual-verify doc; not "tested with one, assumed for both" [US-99]
- [ ] Driftwood verified to NOT brighten: explicit negative checkbox in manual-verify [US-99]
- [ ] Player ember overlay visual-binding verified in **Ashen Isle** (warmth at max, no zones — overlay reads at full radius/alpha) AND in **Fog Marsh** (warmth at max, no zones — same baseline) AND in **Briar Wilds** (warmth varies by zone — overlay shrinks/restores within bounds). Three explicit per-area checkboxes [US-101]
- [ ] Ember warmth state persists correctly across all three areas: enter Briar Wilds, drain to floor, walk back to Ashen Isle, walk to Fog Marsh, return to Briar Wilds — warmth value carries (not reset on transition); verified by F3 HUD readout per area [US-101]

#### Phase-level / structural

- [ ] `AGENTS.md` reflects new modules (`systems/emberWarmth.ts`), new directories (`assets/tilesets/briar-wilds/`, possibly `assets/objects/<kind>/`), and new behaviour rules (ember warmth state, drain zones, quiet places, warmed-NPC brightening) introduced in this phase [phase]
- [ ] Manual-verify file `docs/plan/briar-wilds-manual-verify.md` exists with: § US-99 Warmed-NPC visibility, § US-100 Area + entry, § US-101 Warmth state, § US-102 Drain zones, § US-103 Quiet places + closing — each as plain-language step-by-step walkthroughs (numbered concrete actions with described visible outcomes), ending with: *"If any step doesn't behave as described, record it in `docs/plan/briar-wilds-known-issues.md`. Phase cannot be marked complete until each gap is either fixed or explicitly deferred."* (Learning EP-06) [phase]
- [ ] PixelLab generation budget tracked in the phase log: count of generations fired against `mcp__pixellab__` (personal) — explicit Y/N that team server (`mcp__pixellab-team__`) was NOT used (Learning EP-05) [phase]
- [ ] Atlas frame-pick verification artefact (labeled-atlas PNG) generated and reviewed for the new Briar Wilds tileset AND for each new object kind; verification recorded as a yes/no with one-line observation per surface in the phase log (Learning EP-03) [phase]
- [ ] Per-zone and false-light-as-decoration "reads as" tests recorded in manual-verify: drain zone reads as *false hope*, quiet place reads as *rest*, warmed-NPC area reads as *restored colour bubble* (compounded "reads as" rule) [phase]
- [ ] Out-of-scope items explicitly listed in this spec are NOT shipped: scripture artifact / *remember* verb (deferred to `the-word`), explicit decoy-as-object class (deferred to `polish-and-vibe`), Briar Wilds NPCs (intentional zero), audio (deferred), per-zone fail/respawn (no fail state by design) [phase]

### Golden principles (phase-relevant)

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
