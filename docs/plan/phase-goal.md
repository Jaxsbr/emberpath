## Phase goal

Introduce a multi-area architecture that decouples GameScene from hardcoded world data. Each area is a self-contained declarative definition (map, NPCs, triggers, dialogues, story scenes, exits, visual config) that the engine loads dynamically. A second test area (Fog Marsh prototype) demonstrates all interaction mechanisms end-to-end. A debug overlay makes trigger zones and NPC radii visible for testing.

### Stories in scope
- US-14 — Declarative area definition format
- US-15 — Dynamic area loading in GameScene
- US-16 — Exit zone triggers and area transitions
- US-17 — Second test area (Fog Marsh prototype)
- US-18 — Debug overlay for trigger and exit zones

### Done-when (observable)
- [x] `AreaDefinition` interface exported from a shared module with fields: id, name, map (TileType[][]), mapCols, mapRows, npcs (NpcDefinition[]), triggers (TriggerDefinition[]), dialogues (Record<string, DialogueScript>), storyScenes (Record<string, StorySceneDefinition>), playerSpawn ({ col, row }), exits (ExitDefinition[]), visual ({ floorColor, wallColor }) [US-14]
- [x] `ExitDefinition` type exported with fields: id, col, row, width, height, destinationAreaId, entryPoint ({ col, row }), condition (optional string) [US-14]
- [x] Area registry module exports a record or function that maps area IDs to AreaDefinitions — single lookup point for all registered areas [US-14]
- [x] Ashen Isle area definition exists as a valid AreaDefinition containing: the 50x38 tile map, Old Man NPC, 3 existing triggers, old-man-intro dialogue, ashen-isle-intro story scene, spawn at (2, 2), visual config matching current colors (floorColor: 0x4a6741, wallColor: 0x2c2c3a) [US-14]
- [x] `npx tsc --noEmit` passes — all area types fully typed, no `any` casts [US-14]
- [x] GameScene.create() reads area ID from scene data and loads the corresponding AreaDefinition via the area registry [US-15]
- [x] Tile map renders from the area's map array and visual config (floorColor, wallColor), not hardcoded worldMap import [US-15]
- [x] NPC rendering uses the area's npcs array, not the global npcs import [US-15]
- [x] TriggerZoneSystem receives triggers via constructor parameter or load method — does not import from `data/triggers` [US-15]
- [x] Dialogue lookup and story scene lookup use the area's records, not global imports [US-15]
- [x] `collidesWithWall` uses the area's map and dimensions — not imported worldMap/MAP_COLS/MAP_ROWS globals [US-15]
- [x] `collidesWithNpc` uses the area's NPC list — not imported global npcs [US-15]
- [x] Camera bounds set to area's (mapCols x TILE_SIZE) by (mapRows x TILE_SIZE) [US-15]
- [x] Player spawns at the area's playerSpawn coordinates [US-15]
- [x] NpcInteractionSystem receives the area's NPC list and dialogue records — not global imports [US-15]
- [x] Ashen Isle gameplay unchanged after refactor — same map, same NPC, same triggers, same dialogues, same story scene (manual smoke test) [US-15]
- [x] TriggerType union includes `'exit'` or exit zones are dispatched via ExitDefinition[] separate from triggers (either approach acceptable, but the choice is documented in the area definition) [US-16]
- [x] Walking into an exit zone fires fade-out → area reload with new AreaDefinition → fade-in [US-16]
- [x] Player position after transition matches the destination exit's entryPoint (col, row) [US-16]
- [x] A transition-in-progress guard prevents double-firing if player overlaps a second exit zone during fade (re-entrancy guard per Learning #63) [US-16]
- [x] Dialogue, NPC interaction, and trigger evaluation are suppressed during transition (zone-level mutual exclusion per Learning #56) [US-16]
- [x] Input (movement) is disabled during fade to prevent player drift during area load [US-16]
- [x] Transition fade tweens/timers are cleaned up on scene shutdown to prevent orphaned callbacks [US-16] (async cleanup)
- [x] Exit zone tiles use a visually distinct color from both floor and wall tiles, positioned at map edges — reads as a passage or doorway, not decoration or obstacle [US-16] (visual reads-as)
- [x] If exit zone references a non-existent area ID, a console error is logged and the transition does not fire — no crash, no blank screen [US-16] (error path)
- [x] Fog Marsh AreaDefinition exists with a tile map of different dimensions than Ashen Isle's 50x38 (e.g., 30x24 or similar — deliberately different to validate dynamic sizing) [US-17]
- [x] Fog Marsh has at least 1 NPC with a unique dialogue script (branching or linear) [US-17]
- [x] Fog Marsh has at least 1 thought-type trigger zone [US-17]
- [x] Fog Marsh has at least 1 story-type trigger zone with a StorySceneDefinition of at least 2 beats [US-17]
- [x] Fog Marsh has at least 1 dialogue-type trigger zone (zone-triggered dialogue, distinct from NPC-triggered) [US-17]
- [x] Fog Marsh has distinct visual config — different floorColor and wallColor from Ashen Isle [US-17]
- [x] Bidirectional exit zones connect Ashen Isle <-> Fog Marsh (exit in each area leads to the other) [US-17]
- [x] At least one Fog Marsh trigger has a condition, and the condition evaluates correctly (fires only when condition is met, does not fire otherwise) [US-17]
- [x] Shared trigger behaviors verified on Fog Marsh triggers: condition evaluation with AND logic, one-shot flag tracking via `_trigger_fired_` prefix, repeatable exit-then-re-enter semantics, dialogue-active suppression [US-17] (class baseline per Learning #59)
- [x] Fog Marsh NPC data, dialogue scripts, triggers, and story scene definitions are co-located with the area definition — not in global files [US-17]
- [x] A keyboard shortcut toggles the debug overlay on/off (not visible by default) [US-18]
- [x] Trigger zones render as semi-transparent colored rectangles in world space, color-coded by type (distinct color per trigger type: thought, story, dialogue, exit) [US-18]
- [x] Each zone overlay shows the zone's ID and type as a text label [US-18]
- [x] Zones with conditions display the condition string as part of the label [US-18]
- [x] Exit zones show destination area ID and entry point coordinates in their label [US-18]
- [x] NPC interaction radii render as semi-transparent circles (1.5 tile radius per AGENTS.md behavior rules) [US-18]
- [x] Overlay renders in world space (follows camera) and is ignored by the UI camera [US-18]
- [x] Overlay refreshes when area changes — shows the new area's zones after transition [US-18]
- [x] Debug overlay depth is between entities (5) and UI (100), value documented in AGENTS.md depth map [US-18]
- [x] Debug overlay logic lives in `src/systems/` as a system module, not inline in GameScene (per Learning #64 — scene code must call systems-module functions) [US-18]
- [x] Debug toggle key is ignored while dialogue is active — does not conflict with dialogue input handlers (per Learning #69 — scene-level input handler guard) [US-18]
- [x] AGENTS.md updated: directory layout includes area definitions path, file ownership for area definition files and area registry, behavior rules for area transitions and exit zones, depth map includes debug overlay layer, exit trigger type documented [phase]
- [x] Old single-area global data files (`data/npcs.ts`, `data/triggers.ts`, `data/dialogues.ts`, `data/story-scenes.ts`, `maps/worldMap.ts`) are removed — their data lives in area definitions; imports updated throughout the codebase [phase]
- [x] `maps/constants.ts` retains only truly global constants (TILE_SIZE, PLAYER_SPEED, TileType enum) — MAP_COLS and MAP_ROWS removed since dimensions are per-area [phase]

### Golden principles (phase-relevant)
- **Responsive scaling** — areas with different dimensions must scale correctly via the existing zoom formula (TARGET_VISIBLE_TILES)
- **Zone-level mutual exclusion** (Learning #56) — area transitions must respect dialogue state; triggers and interaction suppressed during transition
- **Camera dual-setup** — main + UI cameras must initialize correctly per area; debug overlay on main camera only
- **Flag persistence** — flags work cross-area via the shared flag store; flags set in one area are readable in another
- **Depth map** (Learning #57) — exit zone markers and debug overlay must use documented depth values, no ad-hoc assignments
- **Systems-module architecture** (Learning #64) — new logic (debug overlay, area loading) belongs in `src/systems/`, not inline in scenes
- **Input handler guards** (Learning #69) — debug toggle must not conflict with dialogue or interaction input handlers
