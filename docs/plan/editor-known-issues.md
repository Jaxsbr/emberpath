# Editor Known Issues — captured during US-97 walkthrough

Operator feedback gathered after the US-97 editor rewrite shipped. Triaged into "fixable in this phase" / "tile-content phase work" / "future authoring polish" so the next iteration knows the order of attack.

## 1. No canvas zoom

**Reported:** "editor can't zoom"

**Diagnosis:** `mapRenderer.ts` draws into an HTMLCanvasElement at fixed 16px-per-tile (`CELL = 16`). For a 50×38 Ashen Isle this gives a 800×608 canvas — fine for desktop overview but every paint click is small and there's no way to zoom in to see what you're doing on a 16×16 PixelLab tile. There's also no way to zoom out for full-area context on a smaller laptop screen.

**Fix scope:** small-medium. Add a CSS transform-scale on the canvas via wheel/+/− keys, or render at variable CELL with a slider. Pan via space-drag. Mid-priority — the area-author can work without it but it's friction.

## 2. Terrain painting only renders sand on Ashen / path on Marsh, regardless of which terrain is selected

**Reported:** "editor can't actually paint any terrain other than sand in isles and path in marsh?? (perhaps it can but there is a bug or incorrect tile selection)"

**Diagnosis:** **Confirmed bug — root cause is the single-tileset-per-area model.** Each area's `tileset` field names ONE Wang tileset:
- Ashen Isle → `'ashen-isle-grass-sand'` (primary = grass, secondary = sand)
- Fog Marsh → `'fog-marsh-floor-path'` (primary = marsh-floor, secondary = path)

The Wang resolver builds the mask by checking each corner: `'1'` if it matches the tileset's `secondaryTerrain`, `'0'` otherwise. So painting:

- `grass` on Ashen → all 4 corners `'0'` → mask `'0000'` → grass frame ✓
- `sand` on Ashen → all 4 corners `'1'` → mask `'1111'` → sand frame ✓
- `path` on Ashen → all 4 corners are non-secondary → all `'0'` actually... wait, the maskFromTerrainIds checks `t === secondaryTerrain`. `path !== sand`, so mask `'0000'` → grass frame (would render as grass, not sand). Need to verify in-engine. Possibly the bug presents differently per painted terrain.

Either way: a single-tileset area can only render its registered (primary, secondary) pair correctly. Painting `path`, `marsh-floor`, `water`, or `stone` on Ashen Isle (or `grass`, `sand`, `water`, or `stone` on Fog Marsh) produces wrong frames because the renderer doesn't know to switch tilesets per cell.

**Fix scope:** medium-large. Add a `pickWangTilesetForCell(corners)` helper that, given the 4 vertex terrains, finds the registered tileset whose `(primaryTerrain, secondaryTerrain)` set matches. Replace `area.tileset` lookups in `GameScene.renderTileMap` and `tools/editor/src/mapRenderer.ts` with the per-cell pick. This is the architectural change the spec implicitly assumed but didn't call out — it's required for US-98's marsh-trap path↔water flip to render correctly. **Doing this as part of US-98 architectural scaffolding.**

## 3. No way to author triggers, NPCs, exits, or map transitions

**Reported:** "editor can't setup triggers or npcs or map transitions"

**Diagnosis:** US-97's spec only asked for terrain + objects + Export. Triggers / NPCs / exits / dialogues are still authored by hand in the area `.ts` files. The editor renders them (read-only overlays) but there's no UI to add / move / configure them. Same applies to NPC sprites, NPC dialogue scripts, story scenes, decorations, and trigger conditions.

**Fix scope:** large. Each authoring surface (trigger, NPC, exit, dialogue) needs its own modal + serializer extension to Export. This is a separate phase's worth of work — call it `editor-authoring-tools` and queue after the immediate tile-content work.

## 4. Project-owner walkthrough needed to scope all editor gaps

**Reported:** "general project owner like walk through is needed to clarify all editor gaps/needs"

**Diagnosis:** The editor was specced narrowly for US-97 (terrain + objects). Stage 2 surfaced multiple gaps the spec didn't anticipate (zoom, multi-tileset rendering, trigger/NPC/exit authoring, undo/redo, save state preservation). A 30-minute walkthrough with the operator, capturing every "I'd want to do X here" friction point, would let us spec a `editor-v2` phase with proper coverage.

**Fix scope:** scheduling task, not code. **Action: schedule a walkthrough session before specing the next editor-focused phase.**

## Triage order

1. **Now (US-98 architectural scaffolding):** per-cell tileset selection (fixes issue 2).
2. **Mid-phase polish:** canvas zoom + pan (issue 1).
3. **After tile-architecture phase ships:** schedule the project-owner walkthrough (issue 4).
4. **Post-walkthrough:** spec `editor-authoring-tools` phase covering issue 3 + everything the walkthrough surfaces.
