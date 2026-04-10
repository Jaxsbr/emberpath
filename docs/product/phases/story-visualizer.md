# Phase: story-visualizer

Status: shipped

## Phase goal

Build a read-only story visualizer — a separate Vite dev tool in `tools/visualizer/` that imports EmberPath's area data directly and renders three views: (1) spatial area map with NPCs, triggers, and exits overlaid, (2) dialogue tree node graphs showing branching and flag mutations, (3) inter-area story flow overview with flag dependencies. The visualizer gives the story author a feedback loop for crafting the narrative without running the game or reading raw TypeScript data files.

### Design direction

Dev tool — functional and clean. Dark background with high-contrast overlays. Color-coded elements matching the in-game debug overlay scheme (blue=thought, magenta=story, green=dialogue, orange=exit). Readable labels, no decorative elements. Optimized for a wide desktop viewport.

### Layout

```
+-----------------------------------------------+
| [Area: v Ashen Isle] [Map] [Dialogue] [Flow]  |
+-----------------------------------+-----------+
|                                   |           |
|          Active View              |  Detail   |
|     (map / graph / flow)          |  Panel    |
|                                   |           |
|                                   |           |
+-----------------------------------+-----------+
```

- **Top bar:** Area selector dropdown (left), view tabs (right)
- **Main area:** Active view content — canvas for map, graph for dialogue/flow
- **Detail panel:** Right sidebar showing full data for the selected element (trigger, NPC, exit, dialogue node, flag dependency)

## Stories

### US-19 — Visualizer project scaffold [Shipped]

As a developer, I want a separate Vite + TypeScript dev tool in `tools/visualizer/` that imports EmberPath's area data directly, so that I have a foundation to build visualization views without affecting the game build.

**Acceptance criteria:**
- `tools/visualizer/` contains its own `package.json`, `vite.config.ts`, `tsconfig.json`, and `index.html`
- `npm run dev` from `tools/visualizer/` starts a dev server on a port different from the game (e.g., 5174)
- The app imports `AreaDefinition` types and area data from `../../src/data/areas/` via path aliases
- An area selector (dropdown) lists all registered areas from the area registry
- Tab navigation switches between Map, Dialogue, and Flow views
- Selecting a different area updates the active view
- Active area and active tab are visually indicated at all times
- Project builds and type-checks cleanly

**User guidance:** N/A — internal development tool

**Design rationale:** Separate Vite project rather than adding a route to the game because the visualizer has different dependencies (DOM-based UI) and should not affect the game's bundle size or build.

### US-20 — Area map view [Shipped]

As a story author, I want to see an area's tile map with NPCs, triggers, and exits overlaid in a spatial view, so that I can understand the physical layout and placement of story elements without running the game.

**Acceptance criteria:**
- Canvas renders the tile grid with floor tiles in the area's floorColor and wall tiles in wallColor
- NPC positions rendered as labeled circles at their (col, row) coordinates
- Trigger zones rendered as colored rectangles matching the debug overlay color scheme (blue=thought, magenta=story, green=dialogue, orange=exit)
- Exit zones rendered with destination area labels
- Clicking a trigger, NPC, or exit shows its full definition in a detail panel (all fields from the type)
- Grid coordinates visible (row/col labels on axes)
- Player spawn position marked distinctly

**User guidance:** N/A — internal development tool

**Design rationale:** Canvas API over SVG because tile grids with 50x38+ cells render more efficiently on canvas, and the colored-rectangle approach matches the in-game debug overlay for familiarity.

**Interaction model:** Click any element (trigger zone, NPC, exit) on the map canvas to select it — the detail panel updates to show the clicked element's full data. Click empty space to deselect. Hover shows coordinates.

### US-21 — Dialogue tree view [Shipped]

As a story author, I want to see dialogue scripts rendered as node graphs showing speaker lines, branching choices, and flag mutations, so that I can trace conversation flow and verify branching logic without reading nested arrays.

**Acceptance criteria:**
- Dialogue selector lists all dialogue scripts in the current area
- Each dialogue renders as a directed graph: nodes = DialogueNodes, edges = nextId connections
- Choice branches render as labeled edges (choice text on the edge)
- Nodes display speaker name and text (truncated if long, full text on click)
- Flag mutations (setFlags) highlighted on choice edges with the flag name and value
- Start node is visually distinguished (different border or color)
- Terminal nodes (no nextId, no choices) are visually distinguished

**User guidance:** N/A — internal development tool

**Design rationale:** Node graph is the standard visualization for dialogue trees (Twine, Yarn Spinner, Articy). A simple top-down directed layout works for the current dialogue complexity (max ~10 nodes per script).

**Interaction model:** Select a dialogue from the dropdown to render its graph. Click a node to see full text content in the detail panel. The graph auto-layouts top-to-bottom (start node at top, terminals at bottom).

### US-22 — Story flow overview [Shipped]

As a story author, I want to see all areas, their connections, and flag dependencies in a single overview, so that I can trace the player's narrative journey across the entire game.

**Acceptance criteria:**
- Each area rendered as a labeled box
- Exit connections rendered as directed arrows between area boxes (with exit zone ID label)
- Within each area box: list of triggers with type icons/colors and their IDs
- Flag dependencies visualized: triggers/dialogues that set flags connect via dashed lines to triggers/exits that require those flags
- Conditional exits show their condition text on the arrow
- Default area visually marked as the starting point
- Clicking an area box navigates to Map tab with that area selected

**User guidance:** N/A — internal development tool

**Design rationale:** This is the highest-value view for story authoring — it shows the narrative graph that is currently invisible. Flag dependency visualization makes the implicit gating between story elements explicit.

**Interaction model:** Overview renders automatically from all registered areas. Click an area box to navigate to its Map view. Click a flag dependency line to see the full condition in the detail panel.

## Done-when (observable)

**US-19 — Visualizer project scaffold**
- [x] `tools/visualizer/package.json` exists with `vite` and `typescript` as devDependencies [US-19]
- [x] `tools/visualizer/vite.config.ts` exists with a path alias resolving imports from `../../src/data/areas/` [US-19]
- [x] `tools/visualizer/tsconfig.json` exists and compiles the visualizer source plus the shared `src/data/areas/` types [US-19]
- [x] `npm install && npm run dev` from `tools/visualizer/` starts a dev server without errors on a port other than 5173 [US-19]
- [x] The app imports area data via `getArea()` and `getDefaultAreaId()` from the area registry — area selector dropdown lists all registered areas (currently 2: Ashen Isle, Fog Marsh) [US-19]
- [x] Three view tabs (Map, Dialogue, Flow) are visible; clicking a tab switches the visible view container [US-19]
- [x] Selecting a different area in the dropdown updates the active view to show that area's data [US-19]
- [x] Active area name is visible in the dropdown and active view tab is visually highlighted at all times [US-19]
- [x] `npm run build` in `tools/visualizer/` completes without errors [US-19]
- [x] `npx tsc --noEmit` passes in `tools/visualizer/` with no type errors [US-19]

**US-20 — Area map view**
- [x] Canvas element renders when Map tab is active, sized to fit the area's tile grid [US-20]
- [x] Floor tiles render in the area's `visual.floorColor`, wall tiles in `visual.wallColor` [US-20]
- [x] NPC positions render as labeled circles at their (col, row) tile coordinates with name text [US-20]
- [x] Trigger zones render as colored semi-transparent rectangles: thought=blue, story=magenta, dialogue=green — matching the debug overlay color scheme in `systems/debugOverlay.ts` [US-20]
- [x] Exit zones render as orange rectangles with destination area ID as label text [US-20]
- [x] Clicking a trigger zone populates the detail panel with all `TriggerDefinition` fields (id, col, row, width, height, type, actionRef, condition, repeatable) [US-20]
- [x] Clicking an NPC populates the detail panel with all `NpcDefinition` fields (id, name, col, row, color) [US-20]
- [x] Clicking an exit populates the detail panel with all `ExitDefinition` fields (id, col, row, width, height, destinationAreaId, entryPoint, condition) [US-20]
- [x] Player spawn position renders as a distinct marker (different shape or color from NPCs) at `playerSpawn` coordinates [US-20]
- [x] Row and column indices are visible along the map edges (axis labels) [US-20]

**US-21 — Dialogue tree view**
- [x] Dialogue dropdown lists all keys from the selected area's `dialogues` record [US-21]
- [x] Selecting a dialogue renders a directed graph with one visual node per `DialogueNode` [US-21]
- [x] Directed edges connect nodes via `nextId` references [US-21]
- [x] Choice branches render as separate labeled edges — each edge shows the choice `text` [US-21]
- [x] Nodes display `speaker` name and truncated `text` (max 50 characters, ellipsis if longer) [US-21]
- [x] Clicking a node populates the detail panel with the full `DialogueNode` content (id, speaker, full text, nextId, choices) [US-21]
- [x] `setFlags` entries on choices render as highlighted annotations on the corresponding edge (flag name + value) [US-21]
- [x] Start node (matching `startNodeId`) has a visually distinct border or background color [US-21]
- [x] Terminal nodes (no `nextId` and no `choices`) have a visually distinct style (different color or border) [US-21]

**US-22 — Story flow overview**
- [x] All registered areas render as labeled boxes — layout is automatic, not manually positioned [US-22]
- [x] Exit connections render as directed arrows from source area box to destination area box, labeled with the exit ID [US-22]
- [x] Each area box lists its triggers with type-colored indicators (same color scheme as map view) and trigger IDs [US-22]
- [x] Flag dependencies render as dashed lines: `setFlags` in dialogue choices connect to triggers/exits whose `condition` references the same flag name [US-22]
- [x] Conditional exits display their condition text on or near the arrow [US-22]
- [x] The default area (from `getDefaultAreaId()`) has a visually distinct border or marker indicating it is the player's starting point [US-22]
- [x] Clicking an area box navigates to the Map tab with that area selected [US-22]

**Structural**
- [x] AGENTS.md directory layout updated to include `tools/visualizer/` with a description of its purpose [phase]
- [x] AGENTS.md file ownership table includes entries for visualizer modules [phase]

### Safety criteria
Safety criteria: N/A — this phase introduces no endpoints, user input fields, or query interpolation. The visualizer is a local dev tool that reads static area data.

## Golden principles (phase-relevant)
- **Single source of truth** — visualizer imports from `src/data/areas/` directly; no data duplication or separate data files
- **Systems-module architecture** (Learning #64) — visualizer code organized into renderer modules per view, not monolithic
- **Debug overlay color scheme** — map view trigger colors must match `systems/debugOverlay.ts` for consistency (blue=thought, magenta=story, green=dialogue, orange=exit)

## AGENTS.md sections affected
- Directory layout (new `tools/visualizer/` tree)
- File ownership (visualizer modules)
