# Phase: rig-editor

Status: shipped

## Phase goal

Rename the visualizer tool to "editor" and build a visual rig authoring tab. The editor's new rig tab embeds a Phaser scene for real-time character rig preview, provides a direction picker for all 8 directions, displays the skeleton hierarchy, and lets the designer edit every part property (position, scale, rotation, depth, visibility, alpha) per direction with instant visual feedback. Rig configurations save to JSON and export to TypeScript for game integration. This phase focuses on direction profile editing (the idle/base pose) — state-specific profiles (walk, run) are deferred.

### Design direction

Match existing editor dark theme — navy backgrounds (#1a1a2e / #16213e), monospace typography (JetBrains Mono / Fira Code), accent red (#e94560), muted text (#8899aa). Property panels and controls follow the established detail-panel pattern. The Phaser scene background should use a neutral checkerboard or grid pattern (common in sprite editors) to make rig parts visible against any color.

## Stories

### US-28 — Rename visualizer to editor

As a developer, I want the game's development tool renamed from "visualizer" to "editor," so that the name reflects its expanded editing capabilities.

**Acceptance criteria:**
- `tools/visualizer/` directory renamed to `tools/editor/` with all internal references updated
- Package name, HTML title, and UI heading reflect "Editor"
- All existing functionality (map, dialogue, flow tabs) works unchanged after rename
- No stale "visualizer" references remain in the codebase

**User guidance:**
- Discovery: `cd tools/editor && npm run dev` (was tools/visualizer)
- Manual section: docs/rig-system-guide.md (update tool references)
- Key steps: 1. Navigate to tools/editor. 2. Run npm run dev. 3. Observe same functionality at new path.

**Design rationale:** The tool now supports editing (rig authoring), not just viewing. The name change prevents confusion and signals the tool's expanded purpose.

### US-29 — Rig editor tab with Phaser preview

As a designer, I want a "rig" tab in the editor with an embedded Phaser scene that renders a character rig, so that I can see the rig in real time while configuring it.

**Acceptance criteria:**
- New "Rig" tab appears alongside existing Map, Dialogue, and Flow tabs
- Embedded Phaser scene renders the selected rig using the game's `CharacterRig` class and texture atlas
- Rig selector dropdown to choose which rig definition to load
- Direction picker with 8 clickable direction buttons updates the rig's facing in real time
- Skeleton hierarchy panel shows all parts in a collapsible tree structure
- Clicking a part in the hierarchy highlights it in the Phaser scene
- Scene background uses a grid/checkerboard pattern
- No duplicate scenes on rapid tab clicks; rig switch resets animation state cleanly

**User guidance:**
- Discovery: Open editor, click "Rig" tab in the toolbar
- Manual section: docs/rig-system-guide.md — "Visual Profile Authoring" section
- Key steps: 1. Open editor (npm run dev). 2. Click Rig tab. 3. Select fox from rig dropdown. 4. Click directions to see the rig rotate. 5. Click parts in the hierarchy to highlight them.

**Design rationale:** An embedded Phaser scene (not Canvas2D or SVG) ensures the rig renders identically to the game engine — what you see in the editor is what you get in-game. The hierarchy panel makes the 46-part skeleton navigable.

**Interaction model:** Click-based navigation — click tabs to switch views, click direction buttons to rotate rig, click parts in hierarchy or scene to select. Same tab-based pattern as the existing map/dialogue/flow views.

### US-30 — Interactive direction profile editor

As a designer, I want to edit every property of every rig part for the selected direction, with changes reflected instantly in the Phaser preview, so that I can visually author direction profiles without editing TypeScript.

**Acceptance criteria:**
- Selecting a part (from hierarchy or scene click) opens a property editor panel
- Editable properties per part per direction: x, y, scaleX, scaleY, rotation, depth, visible, alpha
- Changes apply immediately to the Phaser preview (real-time, no save/refresh)
- Switching direction loads that direction's profile values into the property editor
- Only the 5 unique directions are directly editable; mirrored directions show source with indicator
- All parts are individually selectable and editable
- DOM input events don't bleed into Phaser scene click events
- Selection state is consistent regardless of whether selection originates from hierarchy or scene

**User guidance:**
- Discovery: In Rig tab, select a part — property panel appears on the right
- Manual section: docs/rig-system-guide.md — "Direction Profile Authoring" section
- Key steps: 1. Select a direction (e.g., S). 2. Click a part (e.g., head). 3. Adjust x/y to reposition, scaleX/scaleY to resize, rotation to rotate. 4. See changes in the Phaser scene instantly. 5. Switch to another direction — different profile values load.

**Design rationale:** Per-direction editing (not global) because each direction needs a unique part arrangement (the fox looks very different from S vs E). Editing the 5 unique directions is sufficient — mirrored directions derive automatically. Real-time preview eliminates the code-edit-refresh cycle that currently makes rig authoring slow.

**Interaction model:** Same click-to-select pattern as existing detail panel in map/dialogue views. Property editor uses standard numeric inputs with the established detail-panel CSS pattern. No new input mechanisms.

### US-31 — Rig configuration persistence and export

As a developer, I want to save rig configurations to JSON and export to TypeScript, so that editor work persists between sessions and integrates with the game.

**Acceptance criteria:**
- Save downloads a JSON file containing all direction profiles
- Load accepts a JSON file and restores all direction profiles, updating preview
- Export generates TypeScript matching the `profiles: Record<UniqueDirection, DirectionProfile>` format
- Exported TypeScript is valid (passes tsc) and renders identically in-game
- Load validates part names against current skeleton, warns on mismatches
- Save/load round-trips without data loss

**User guidance:**
- Discovery: Save/Load/Export buttons in the rig tab toolbar area
- Manual section: docs/rig-system-guide.md — "Saving and Exporting Profiles" section
- Key steps: 1. Configure rig profiles. 2. Click Save — JSON downloads. 3. Close/reopen editor. 4. Click Load — select the JSON file. 5. Click Export TS — get TypeScript code to paste into the rig definition.

**Design rationale:** JSON for persistence (structured, diffable, versionable) and TypeScript export for game integration. The rig system consumes TypeScript `RigDefinition` objects, so the export must match that format exactly. Separate save (full fidelity) and export (game-ready format) because the JSON may contain editor-only metadata in future phases.

## Done-when (observable)

### US-28 — Rename visualizer to editor
- [ ] `tools/editor/` directory exists; `tools/visualizer/` does not exist [US-28]
- [ ] `tools/editor/package.json` name field is `emberpath-editor` (was `emberpath-visualizer` or similar) [US-28]
- [ ] `tools/editor/index.html` title contains "Editor" (not "Visualizer") [US-28]
- [ ] `tools/editor/vite.config.ts` path alias `@game` still resolves to `../../src` [US-28]
- [ ] `npx tsc --noEmit` passes inside `tools/editor/` [US-28]
- [ ] `npm run dev` inside `tools/editor/` starts the Vite dev server and loads all existing tabs (map, dialogue, flow) without errors [US-28]
- [ ] No remaining references to "visualizer" in file contents under `tools/editor/src/` (case-insensitive grep returns 0 matches) [US-28]
- [ ] No references to "visualizer" in any .gitignore, CI workflow files (.github/), or root-level scripts/configs [US-28]
- [ ] AGENTS.md directory layout and running instructions reference `tools/editor/` instead of `tools/visualizer/` [US-28]

### US-29 — Rig editor tab with Phaser preview
- [ ] A "Rig" tab button appears in the editor toolbar alongside Map, Dialogue, and Flow tabs [US-29]
- [ ] Clicking the Rig tab displays an embedded Phaser scene that renders a character rig using the game's `CharacterRig` class and texture atlas [US-29]
- [ ] A rig selector dropdown lists available rig definitions; selecting "fox" loads and renders the fox rig [US-29]
- [ ] A direction picker with 8 clickable direction buttons (N, NE, E, SE, S, SW, W, NW) updates the rig's facing direction in the Phaser scene within the same frame [US-29]
- [ ] A skeleton hierarchy panel displays all parts from the rig's bone tree in a collapsible tree structure (body → head → snout, etc.) [US-29]
- [ ] Clicking a part name in the hierarchy visually highlights that part in the Phaser scene (e.g., tint change or outline) [US-29]
- [ ] The Phaser scene background uses a grid or checkerboard pattern (not solid color) so rig parts are visible regardless of their color [US-29]
- [ ] The Phaser scene renders at the correct atlas resolution — fox parts are sharp, not blurry or scaled incorrectly [US-29]
- [ ] `npx tsc --noEmit && npm run build` passes inside `tools/editor/` with the rig tab included [US-29]
- [ ] Switching rig selection in the dropdown resets all animation controller state — no visual artifacts carry over from the previous rig [US-29]
- [ ] Clicking the Rig tab multiple times rapidly does not create duplicate Phaser scenes or duplicate hierarchy panels [US-29]
- [ ] Rig preview scene uses explicit depth values: grid/checkerboard at depth 0, rig parts at their profile depth values, selection highlight at depth above all parts [US-29]
- [ ] Rig tab UI elements use the editor's dark theme palette: navy backgrounds (#1a1a2e or #16213e), accent red (#e94560), muted text (#8899aa), monospace font [US-29]
- [ ] Rig editor modules import all rig types (RigDefinition, DirectionProfile, BoneDefinition) from @game/rig/types — no local type re-declarations [US-29]

### US-30 — Interactive direction profile editor
- [ ] Selecting a part (from hierarchy click or Phaser scene click) opens a property editor panel showing that part's current values for the selected direction [US-30]
- [ ] The property editor displays editable fields for: x, y, scaleX, scaleY, rotation, depth, visible, alpha [US-30]
- [ ] Changing any numeric field (x, y, scaleX, scaleY, rotation, depth, alpha) via input updates the Phaser scene in real time (no save/refresh required) [US-30]
- [ ] Toggling the `visible` checkbox hides/shows the part in the Phaser scene immediately [US-30]
- [ ] Switching direction via the direction picker loads that direction's profile values into the property editor — values differ between S and E profiles [US-30]
- [ ] Edits to a direction profile persist in editor state when switching between directions (edit S profile → switch to E → switch back to S → edits are retained) [US-30]
- [ ] Only the 5 unique directions (S, N, E, SE, NE) are directly editable; selecting a mirrored direction (W, SW, NW) shows the source direction's values with a "mirrored from E/SE/NE" indicator [US-30]
- [ ] All 46 fox parts are individually selectable and editable [US-30]
- [ ] Part selection in the Phaser scene (click on a rendered sprite) selects that part in the hierarchy panel and opens its properties [US-30]
- [ ] Clicking on HTML property editor controls does not trigger Phaser scene pointer events (no accidental part selection when editing numeric fields) [US-30]
- [ ] Rapidly alternating between hierarchy click and Phaser scene click on different parts always converges to the last-clicked part — no stale or split selection state [US-30]

### US-31 — Rig configuration persistence and export
- [ ] A "Save" button in the rig tab toolbar downloads a JSON file containing all direction profiles for the current rig (5 unique directions × all parts × all properties) [US-31]
- [ ] A "Load" button accepts a JSON file upload and restores all direction profiles into the editor, updating the Phaser preview [US-31]
- [ ] An "Export TS" button generates TypeScript code matching the `profiles: Record<UniqueDirection, DirectionProfile>` format used in `src/rig/characters/fox.ts` [US-31]
- [ ] The exported TypeScript is valid — pasting it into a rig definition file and running `npx tsc --noEmit` produces no type errors [US-31]
- [ ] Loading a JSON file that references parts not in the current rig's skeleton shows a warning listing the mismatched part names [US-31]
- [ ] Save/load round-trips without data loss — save, reload editor, load the saved file, all values match the pre-save state [US-31]
- [ ] Exported TypeScript pasted into fox.ts and loaded in the game (npm run dev) renders the fox rig identically to the editor preview [US-31]

### Structural
- [ ] AGENTS.md directory layout includes `tools/editor/` tree with updated descriptions reflecting the rig tab addition [phase]
- [ ] AGENTS.md file ownership table includes entries for new rig editor modules (rig renderer, property editor, persistence) [phase]
- [ ] AGENTS.md running instructions reference `tools/editor/` path and port [phase]
- [ ] `docs/rig-system-guide.md` updated to reference the editor's rig tab for visual profile authoring [phase]

### Safety criteria
Safety criteria: N/A — this phase introduces no API endpoints, no server-side user input handling, no query interpolation, and no LLM output. All changes are client-side dev tooling (local file save/load via browser file API). The JSON load validates part names against the skeleton (done-when criterion in US-31).

## Golden principles (phase-relevant)
- **Depth map adherence** (AGENTS.md) — rig preview renders parts at their profile depth values; the editor visualizes depth ordering
- **Systems-module architecture** — rig editor components (renderer, property editor, persistence) are separate modules, not monolithic
- **Responsive scaling** (AGENTS.md) — editor layout works at common desktop viewport sizes (the editor is a dev tool, not mobile-targeted)
- **Parameterized systems** (AGENTS.md) — rig editor receives rig definitions as data, no hardcoded fox-specific logic in editor components
- **Frame-based delta-time** (AGENTS.md) — Phaser preview scene uses delta time for any animation preview

## AGENTS.md sections affected
- Directory layout (`tools/visualizer/` → `tools/editor/`, new rig editor source files)
- File ownership (new editor modules: rig renderer, property editor, persistence/export)
- Running instructions (editor path and port change)
- Behavior rules (may need note about editor's Phaser scene being separate from game's)

## User documentation
`docs/rig-system-guide.md` already exists from the character-rig phase. This phase adds sections for:
- "Visual Profile Authoring" — using the rig tab to edit direction profiles
- "Direction Profile Authoring" — per-part property editing workflow
- "Saving and Exporting Profiles" — JSON save/load and TypeScript export workflow
