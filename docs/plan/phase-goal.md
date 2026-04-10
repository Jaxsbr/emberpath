## Phase goal

Build a read-only story visualizer — a separate Vite dev tool in `tools/visualizer/` that imports EmberPath's area data directly and renders three views: (1) spatial area map with NPCs, triggers, and exits overlaid, (2) dialogue tree node graphs showing branching and flag mutations, (3) inter-area story flow overview with flag dependencies. The visualizer gives the story author a feedback loop for crafting the narrative without running the game or reading raw TypeScript data files.

### Design direction

Dev tool — functional and clean. Dark background with high-contrast overlays. Color-coded elements matching the in-game debug overlay scheme (blue=thought, magenta=story, green=dialogue, orange=exit). Readable labels, no decorative elements. Optimized for a wide desktop viewport.

### Dependencies
- area-system

### Stories in scope
- US-19 — Visualizer project scaffold
- US-20 — Area map view
- US-21 — Dialogue tree view
- US-22 — Story flow overview

### Done-when (observable)
- [ ] `tools/visualizer/package.json` exists with `vite` and `typescript` as devDependencies [US-19]
- [ ] `tools/visualizer/vite.config.ts` exists with a path alias resolving imports from `../../src/data/areas/` [US-19]
- [ ] `tools/visualizer/tsconfig.json` exists and compiles the visualizer source plus the shared `src/data/areas/` types [US-19]
- [ ] `npm install && npm run dev` from `tools/visualizer/` starts a dev server without errors on a port other than 5173 [US-19]
- [ ] The app imports area data via `getArea()` and `getDefaultAreaId()` from the area registry — area selector dropdown lists all registered areas (currently 2: Ashen Isle, Fog Marsh) [US-19]
- [ ] Three view tabs (Map, Dialogue, Flow) are visible; clicking a tab switches the visible view container [US-19]
- [ ] Selecting a different area in the dropdown updates the active view to show that area's data [US-19]
- [ ] Active area name is visible in the dropdown and active view tab is visually highlighted at all times [US-19]
- [ ] `npm run build` in `tools/visualizer/` completes without errors [US-19]
- [ ] `npx tsc --noEmit` passes in `tools/visualizer/` with no type errors [US-19]
- [ ] Canvas element renders when Map tab is active, sized to fit the area's tile grid [US-20]
- [ ] Floor tiles render in the area's `visual.floorColor`, wall tiles in `visual.wallColor` [US-20]
- [ ] NPC positions render as labeled circles at their (col, row) tile coordinates with name text [US-20]
- [ ] Trigger zones render as colored semi-transparent rectangles: thought=blue, story=magenta, dialogue=green — matching the debug overlay color scheme in `systems/debugOverlay.ts` [US-20]
- [ ] Exit zones render as orange rectangles with destination area ID as label text [US-20]
- [ ] Clicking a trigger zone populates the detail panel with all `TriggerDefinition` fields (id, col, row, width, height, type, actionRef, condition, repeatable) [US-20]
- [ ] Clicking an NPC populates the detail panel with all `NpcDefinition` fields (id, name, col, row, color) [US-20]
- [ ] Clicking an exit populates the detail panel with all `ExitDefinition` fields (id, col, row, width, height, destinationAreaId, entryPoint, condition) [US-20]
- [ ] Player spawn position renders as a distinct marker (different shape or color from NPCs) at `playerSpawn` coordinates [US-20]
- [ ] Row and column indices are visible along the map edges (axis labels) [US-20]
- [ ] Dialogue dropdown lists all keys from the selected area's `dialogues` record [US-21]
- [ ] Selecting a dialogue renders a directed graph with one visual node per `DialogueNode` [US-21]
- [ ] Directed edges connect nodes via `nextId` references [US-21]
- [ ] Choice branches render as separate labeled edges — each edge shows the choice `text` [US-21]
- [ ] Nodes display `speaker` name and truncated `text` (max 50 characters, ellipsis if longer) [US-21]
- [ ] Clicking a node populates the detail panel with the full `DialogueNode` content (id, speaker, full text, nextId, choices) [US-21]
- [ ] `setFlags` entries on choices render as highlighted annotations on the corresponding edge (flag name + value) [US-21]
- [ ] Start node (matching `startNodeId`) has a visually distinct border or background color [US-21]
- [ ] Terminal nodes (no `nextId` and no `choices`) have a visually distinct style (different color or border) [US-21]
- [ ] All registered areas render as labeled boxes — layout is automatic, not manually positioned [US-22]
- [ ] Exit connections render as directed arrows from source area box to destination area box, labeled with the exit ID [US-22]
- [ ] Each area box lists its triggers with type-colored indicators (same color scheme as map view) and trigger IDs [US-22]
- [ ] Flag dependencies render as dashed lines: `setFlags` in dialogue choices connect to triggers/exits whose `condition` references the same flag name [US-22]
- [ ] Conditional exits display their condition text on or near the arrow [US-22]
- [ ] The default area (from `getDefaultAreaId()`) has a visually distinct border or marker indicating it is the player's starting point [US-22]
- [ ] Clicking an area box navigates to the Map tab with that area selected [US-22]
- [ ] AGENTS.md directory layout updated to include `tools/visualizer/` with a description of its purpose [phase]
- [ ] AGENTS.md file ownership table includes entries for visualizer modules [phase]

### Golden principles (phase-relevant)
- **Single source of truth** — visualizer imports from `src/data/areas/` directly; no data duplication or separate data files
- **Systems-module architecture** (Learning #64) — visualizer code organized into renderer modules per view, not monolithic
- **Debug overlay color scheme** — map view trigger colors must match `systems/debugOverlay.ts` for consistency (blue=thought, magenta=story, green=dialogue, orange=exit)
