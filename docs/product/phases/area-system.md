# Phase: area-system

Status: shipped

## Phase goal

Introduce a multi-area architecture that decouples GameScene from hardcoded world data. Each area is a self-contained declarative definition (map, NPCs, triggers, dialogues, story scenes, exits, visual config) that the engine loads dynamically. A second test area (Fog Marsh prototype) demonstrates all interaction mechanisms end-to-end. A debug overlay makes trigger zones and NPC radii visible for testing.

## Stories

### US-14 — Declarative area definition format [Shipped]

As a developer, I want a typed `AreaDefinition` interface that bundles a tile map, NPCs, triggers, dialogues, story scenes, visual config, spawn point, and exit zones into one co-located unit, so that each area's complete rule set is reviewable in one place.

**Acceptance criteria:**
- AreaDefinition type is exported from a shared module with all required fields (map, NPCs, triggers, dialogues, story scenes, exits, spawn, visual config)
- ExitDefinition type includes destination area, entry point, position, and optional condition
- Area registry provides lookup by ID
- Existing Ashen Isle data refactored into a valid AreaDefinition with zero gameplay changes
- All area types pass TypeScript strict mode

**User guidance:** N/A — internal type definition and data restructuring.

**Design rationale:** Co-located area definitions chosen over scattered global files because the primary debugging workflow is reviewing all of an area's rules, conditions, NPCs, and triggers in one place. A single AreaDefinition (or co-located file pair for large maps) lets a developer read one file and understand an area's complete behavior.

### US-15 — Dynamic area loading in GameScene [Shipped]

As a developer, I want GameScene to load all world data from an AreaDefinition passed at scene start, so that the engine is decoupled from any specific area's data.

**Acceptance criteria:**
- GameScene accepts area ID via scene data and resolves it through the area registry
- Tile rendering, NPC spawning, triggers, dialogues, story scenes, and collision all use area-provided data
- Collision functions accept area data as parameters (no global imports of worldMap or npcs)
- Camera bounds adapt to per-area dimensions
- Player spawns at the area's defined spawn point
- Existing Ashen Isle gameplay is identical after refactor

**User guidance:** N/A — internal refactor, identical gameplay experience.

**Design rationale:** Parameterized loading (area data injected via scene init and passed to systems) chosen over import-time binding to enable area switching without full scene reconstruction. Collision functions become pure (map + NPCs as parameters) rather than coupled to globals.

### US-16 — Exit zone triggers and area transitions [Shipped]

As a player, I want to walk into an exit zone and transition to a different area with a fade effect, so that I can explore multiple connected locations.

**Acceptance criteria:**
- New trigger type `exit` (or separate ExitDefinition dispatch) handles area transitions
- Walking into an exit zone triggers fade-out → area reload → fade-in
- Player appears at destination's specified entry point
- Transition is guarded against re-entrancy (double-fire protection)
- Works on both desktop and mobile

**Interaction model:** Exit zones fire on player overlap, same as existing trigger zones — no new input required. The player walks into the zone and the transition happens automatically. This matches the existing trigger pattern (walk into zone → effect fires). The new behavior is the effect: area transition instead of dialogue/thought/story.

**User guidance:**
- Discovery: Walk toward the map edge where distinctly colored exit tiles are visible
- Key steps: 1. Walk toward the exit zone (visually distinct tiles at a map edge). 2. Screen fades out. 3. New area loads and fades in with player at the entry point.

**Design rationale:** Exit zones implemented as a trigger-like mechanism rather than special map tile types because it reuses the existing trigger infrastructure (conditions, one-shot/repeatable flags, dialogue suppression) and keeps the data authoring format uniform — area authors define exits the same way they define triggers.

### US-17 — Second test area (Fog Marsh prototype) [Shipped]

As a developer, I want a second area definition with a distinct map, NPCs, and all trigger mechanism types, so that the area system is tested end-to-end and every interaction mechanism is demonstrable in at least one area.

**Acceptance criteria:**
- Fog Marsh area definition exists with a tile map of deliberately different dimensions
- Fog Marsh has at least 1 NPC with a unique dialogue script
- Fog Marsh demonstrates ALL trigger types: thought, story, dialogue-via-zone, and exit
- Fog Marsh has a story scene with at least 2 beats
- Fog Marsh uses distinct visual config (different colors)
- Connected bidirectionally to Ashen Isle via exit zones
- All trigger mechanism behaviors (conditions, one-shot, repeatable, dialogue suppression) work correctly

**User guidance:** N/A — test content for developer validation; same interaction patterns as Ashen Isle.

**Design rationale:** Fog Marsh uses different map dimensions deliberately to validate dynamic sizing code paths (camera zoom, collision bounds, tile rendering). Includes every trigger mechanism type to serve as a comprehensive testbed — this is foundational work, so proving each mechanism works across areas is the priority over story content quality.

### US-18 — Debug overlay for trigger and exit zones [Shipped]

As a developer, I want a toggleable debug overlay that renders trigger zone boundaries, types, conditions, and NPC interaction radii on the game map, so that I can visually verify area rule sets during testing without reading data files.

**Acceptance criteria:**
- Overlay toggled via keyboard shortcut (off by default)
- Trigger zones rendered as semi-transparent color-coded rectangles
- Each zone shows its ID, type, and condition (if any) as labels
- Exit zones show destination area and entry point
- NPC interaction radii rendered as circles
- Overlay is world-space (moves with camera), refreshes on area change

**Interaction model:** Single key toggle (on/off). Overlay is view-only — no interaction with the zones themselves.

**User guidance:**
- Discovery: Press the debug toggle key during gameplay
- Key steps: 1. Press the debug key. 2. Colored overlays appear showing all trigger zones with types and conditions. 3. NPC interaction radii appear as circles. 4. Press again to hide.

**Design rationale:** World-space overlay with keyboard toggle chosen over a separate debug panel or console output because developers need to see zone boundaries in spatial context relative to the map, player position, and NPCs. Implemented as a system module in `src/systems/` per the project's systems-module architecture convention.

## Done-when (observable)

- [ ] `AreaDefinition` interface exported from a shared module with fields: id, name, map (TileType[][]), mapCols, mapRows, npcs (NpcDefinition[]), triggers (TriggerDefinition[]), dialogues (Record<string, DialogueScript>), storyScenes (Record<string, StorySceneDefinition>), playerSpawn ({ col, row }), exits (ExitDefinition[]), visual ({ floorColor, wallColor }) [US-14]
- [ ] `ExitDefinition` type exported with fields: id, col, row, width, height, destinationAreaId, entryPoint ({ col, row }), condition (optional string) [US-14]
- [ ] Area registry module exports a record or function that maps area IDs to AreaDefinitions — single lookup point for all registered areas [US-14]
- [ ] Ashen Isle area definition exists as a valid AreaDefinition containing: the 50x38 tile map, Old Man NPC, 3 existing triggers, old-man-intro dialogue, ashen-isle-intro story scene, spawn at (2, 2), visual config matching current colors (floorColor: 0x4a6741, wallColor: 0x2c2c3a) [US-14]
- [ ] `npx tsc --noEmit` passes — all area types fully typed, no `any` casts [US-14]
- [ ] GameScene.create() reads area ID from scene data and loads the corresponding AreaDefinition via the area registry [US-15]
- [ ] Tile map renders from the area's map array and visual config (floorColor, wallColor), not hardcoded worldMap import [US-15]
- [ ] NPC rendering uses the area's npcs array, not the global npcs import [US-15]
- [ ] TriggerZoneSystem receives triggers via constructor parameter or load method — does not import from `data/triggers` [US-15]
- [ ] Dialogue lookup and story scene lookup use the area's records, not global imports [US-15]
- [ ] `collidesWithWall` uses the area's map and dimensions — not imported worldMap/MAP_COLS/MAP_ROWS globals [US-15]
- [ ] `collidesWithNpc` uses the area's NPC list — not imported global npcs [US-15]
- [ ] Camera bounds set to area's (mapCols x TILE_SIZE) by (mapRows x TILE_SIZE) [US-15]
- [ ] Player spawns at the area's playerSpawn coordinates [US-15]
- [ ] NpcInteractionSystem receives the area's NPC list and dialogue records — not global imports [US-15]
- [ ] Ashen Isle gameplay unchanged after refactor — same map, same NPC, same triggers, same dialogues, same story scene (manual smoke test) [US-15]
- [ ] TriggerType union includes `'exit'` or exit zones are dispatched via ExitDefinition[] separate from triggers (either approach acceptable, but the choice is documented in the area definition) [US-16]
- [ ] Walking into an exit zone fires fade-out → area reload with new AreaDefinition → fade-in [US-16]
- [ ] Player position after transition matches the destination exit's entryPoint (col, row) [US-16]
- [ ] A transition-in-progress guard prevents double-firing if player overlaps a second exit zone during fade (re-entrancy guard per Learning #63) [US-16]
- [ ] Dialogue, NPC interaction, and trigger evaluation are suppressed during transition (zone-level mutual exclusion per Learning #56) [US-16]
- [ ] Input (movement) is disabled during fade to prevent player drift during area load [US-16]
- [ ] Transition fade tweens/timers are cleaned up on scene shutdown to prevent orphaned callbacks [US-16] (async cleanup)
- [ ] Exit zone tiles use a visually distinct color from both floor and wall tiles, positioned at map edges — reads as a passage or doorway, not decoration or obstacle [US-16] (visual reads-as)
- [ ] If exit zone references a non-existent area ID, a console error is logged and the transition does not fire — no crash, no blank screen [US-16] (error path)
- [ ] Fog Marsh AreaDefinition exists with a tile map of different dimensions than Ashen Isle's 50x38 (e.g., 30x24 or similar — deliberately different to validate dynamic sizing) [US-17]
- [ ] Fog Marsh has at least 1 NPC with a unique dialogue script (branching or linear) [US-17]
- [ ] Fog Marsh has at least 1 thought-type trigger zone [US-17]
- [ ] Fog Marsh has at least 1 story-type trigger zone with a StorySceneDefinition of at least 2 beats [US-17]
- [ ] Fog Marsh has at least 1 dialogue-type trigger zone (zone-triggered dialogue, distinct from NPC-triggered) [US-17]
- [ ] Fog Marsh has distinct visual config — different floorColor and wallColor from Ashen Isle [US-17]
- [ ] Bidirectional exit zones connect Ashen Isle <-> Fog Marsh (exit in each area leads to the other) [US-17]
- [ ] At least one Fog Marsh trigger has a condition, and the condition evaluates correctly (fires only when condition is met, does not fire otherwise) [US-17]
- [ ] Shared trigger behaviors verified on Fog Marsh triggers: condition evaluation with AND logic, one-shot flag tracking via `_trigger_fired_` prefix, repeatable exit-then-re-enter semantics, dialogue-active suppression [US-17] (class baseline per Learning #59)
- [ ] Fog Marsh NPC data, dialogue scripts, triggers, and story scene definitions are co-located with the area definition — not in global files [US-17]
- [ ] A keyboard shortcut toggles the debug overlay on/off (not visible by default) [US-18]
- [ ] Trigger zones render as semi-transparent colored rectangles in world space, color-coded by type (distinct color per trigger type: thought, story, dialogue, exit) [US-18]
- [ ] Each zone overlay shows the zone's ID and type as a text label [US-18]
- [ ] Zones with conditions display the condition string as part of the label [US-18]
- [ ] Exit zones show destination area ID and entry point coordinates in their label [US-18]
- [ ] NPC interaction radii render as semi-transparent circles (1.5 tile radius per AGENTS.md behavior rules) [US-18]
- [ ] Overlay renders in world space (follows camera) and is ignored by the UI camera [US-18]
- [ ] Overlay refreshes when area changes — shows the new area's zones after transition [US-18]
- [ ] Debug overlay depth is between entities (5) and UI (100), value documented in AGENTS.md depth map [US-18]
- [ ] Debug overlay logic lives in `src/systems/` as a system module, not inline in GameScene (per Learning #64 — scene code must call systems-module functions) [US-18]
- [ ] Debug toggle key is ignored while dialogue is active — does not conflict with dialogue input handlers (per Learning #69 — scene-level input handler guard) [US-18]
- [ ] AGENTS.md updated: directory layout includes area definitions path, file ownership for area definition files and area registry, behavior rules for area transitions and exit zones, depth map includes debug overlay layer, exit trigger type documented [phase]
- [ ] Old single-area global data files (`data/npcs.ts`, `data/triggers.ts`, `data/dialogues.ts`, `data/story-scenes.ts`, `maps/worldMap.ts`) are removed — their data lives in area definitions; imports updated throughout the codebase [phase]
- [ ] `maps/constants.ts` retains only truly global constants (TILE_SIZE, PLAYER_SPEED, TileType enum) — MAP_COLS and MAP_ROWS removed since dimensions are per-area [phase]

## AGENTS.md sections affected

When this phase ships, the build-loop's Phase Reconciliation Gate should update these AGENTS.md sections:

- **Directory layout** — add `src/data/areas/` directory with per-area definition files and area registry
- **File ownership** — add entries for area definition files, area registry, debug overlay system (`systems/debugOverlay.ts` or similar); remove entries for deleted global data files (`data/npcs.ts`, `data/triggers.ts`, `data/dialogues.ts`, `data/story-scenes.ts`, `maps/worldMap.ts`)
- **Depth map** — add debug overlay layer (between entities 5 and UI 100)
- **Behavior rules** — add area transition rules (exit zone behavior, fade transition, mutual exclusion during transition, debug overlay toggle), update trigger zone documentation to include `exit` type
- **Constants section** — update to reflect MAP_COLS/MAP_ROWS removed from `maps/constants.ts`

## User documentation

No user guide exists. This phase is foundational — area transitions are discoverable through gameplay (exit zone markers) and the debug overlay is a developer tool. In-game tutorial/help is deferred to a future UX phase.

## Backlog

- **Area state persistence** — save/restore current area ID across browser refresh. Currently, page refresh always restarts at Ashen Isle (default area). Flags persist correctly cross-area, but area position does not. Lightweight follow-up — ~1 story.

## Golden principles (phase-relevant)
- **Responsive scaling** — areas with different dimensions must scale correctly via the existing zoom formula (TARGET_VISIBLE_TILES)
- **Zone-level mutual exclusion** (Learning #56) — area transitions must respect dialogue state; triggers and interaction suppressed during transition
- **Camera dual-setup** — main + UI cameras must initialize correctly per area; debug overlay on main camera only
- **Flag persistence** — flags work cross-area via the shared flag store; flags set in one area are readable in another
- **Depth map** (Learning #57) — exit zone markers and debug overlay must use documented depth values, no ad-hoc assignments
- **Systems-module architecture** (Learning #64) — new logic (debug overlay, area loading) belongs in `src/systems/`, not inline in scenes
- **Input handler guards** (Learning #69) — debug toggle must not conflict with dialogue or interaction input handlers
