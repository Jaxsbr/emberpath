## Phase goal

Rename the visualizer tool to "editor" and build a visual rig authoring tab. The editor's new rig tab embeds a Phaser scene for real-time character rig preview, provides a direction picker for all 8 directions, displays the skeleton hierarchy, and lets the designer edit every part property (position, scale, rotation, depth, visibility, alpha) per direction with instant visual feedback. Rig configurations save to JSON and export to TypeScript for game integration. This phase focuses on direction profile editing (the idle/base pose) — state-specific profiles (walk, run) are deferred.

### Design direction

Match existing editor dark theme — navy backgrounds (#1a1a2e / #16213e), monospace typography (JetBrains Mono / Fira Code), accent red (#e94560), muted text (#8899aa). Property panels and controls follow the established detail-panel pattern. The Phaser scene background should use a neutral checkerboard or grid pattern (common in sprite editors) to make rig parts visible against any color.

### Stories in scope
- US-28 — Rename visualizer to editor
- US-29 — Rig editor tab with Phaser preview
- US-30 — Interactive direction profile editor
- US-31 — Rig configuration persistence and export

### Done-when (observable)

#### US-28 — Rename visualizer to editor
- [x] `tools/editor/` directory exists; `tools/visualizer/` does not exist [US-28]
- [x] `tools/editor/package.json` name field is `emberpath-editor` (was `emberpath-visualizer` or similar) [US-28]
- [x] `tools/editor/index.html` title contains "Editor" (not "Visualizer") [US-28]
- [x] `tools/editor/vite.config.ts` path alias `@game` still resolves to `../../src` [US-28]
- [x] `npx tsc --noEmit` passes inside `tools/editor/` [US-28]
- [x] `npm run dev` inside `tools/editor/` starts the Vite dev server and loads all existing tabs (map, dialogue, flow) without errors [US-28]
- [x] No remaining references to "visualizer" in file contents under `tools/editor/src/` (case-insensitive grep returns 0 matches) [US-28]
- [x] No references to "visualizer" in any .gitignore, CI workflow files (.github/), or root-level scripts/configs [US-28]
- [x] AGENTS.md directory layout and running instructions reference `tools/editor/` instead of `tools/visualizer/` [US-28]

#### US-29 — Rig editor tab with Phaser preview
- [x] A "Rig" tab button appears in the editor toolbar alongside Map, Dialogue, and Flow tabs [US-29]
- [x] Clicking the Rig tab displays an embedded Phaser scene that renders a character rig using the game's `CharacterRig` class and texture atlas [US-29]
- [x] A rig selector dropdown lists available rig definitions; selecting "fox" loads and renders the fox rig [US-29]
- [x] A direction picker with 8 clickable direction buttons (N, NE, E, SE, S, SW, W, NW) updates the rig's facing direction in the Phaser scene within the same frame [US-29]
- [x] A skeleton hierarchy panel displays all parts from the rig's bone tree in a collapsible tree structure (body → head → snout, etc.) [US-29]
- [x] Clicking a part name in the hierarchy visually highlights that part in the Phaser scene (e.g., tint change or outline) [US-29]
- [x] The Phaser scene background uses a grid or checkerboard pattern (not solid color) so rig parts are visible regardless of their color [US-29]
- [x] The Phaser scene renders at the correct atlas resolution — fox parts are sharp, not blurry or scaled incorrectly [US-29]
- [x] `npx tsc --noEmit && npm run build` passes inside `tools/editor/` with the rig tab included [US-29]
- [x] Switching rig selection in the dropdown resets all animation controller state — no visual artifacts carry over from the previous rig [US-29]
- [x] Clicking the Rig tab multiple times rapidly does not create duplicate Phaser scenes or duplicate hierarchy panels [US-29]
- [x] Rig preview scene uses explicit depth values: grid/checkerboard at depth 0, rig parts at their profile depth values, selection highlight at depth above all parts [US-29]
- [x] Rig tab UI elements use the editor's dark theme palette: navy backgrounds (#1a1a2e or #16213e), accent red (#e94560), muted text (#8899aa), monospace font [US-29]
- [x] Rig editor modules import all rig types (RigDefinition, DirectionProfile, BoneDefinition) from @game/rig/types — no local type re-declarations [US-29]

#### US-30 — Interactive direction profile editor
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

#### US-31 — Rig configuration persistence and export
- [ ] A "Save" button in the rig tab toolbar downloads a JSON file containing all direction profiles for the current rig (5 unique directions × all parts × all properties) [US-31]
- [ ] A "Load" button accepts a JSON file upload and restores all direction profiles into the editor, updating the Phaser preview [US-31]
- [ ] An "Export TS" button generates TypeScript code matching the `profiles: Record<UniqueDirection, DirectionProfile>` format used in `src/rig/characters/fox.ts` [US-31]
- [ ] The exported TypeScript is valid — pasting it into a rig definition file and running `npx tsc --noEmit` produces no type errors [US-31]
- [ ] Loading a JSON file that references parts not in the current rig's skeleton shows a warning listing the mismatched part names [US-31]
- [ ] Save/load round-trips without data loss — save, reload editor, load the saved file, all values match the pre-save state [US-31]
- [ ] Exported TypeScript pasted into fox.ts and loaded in the game (npm run dev) renders the fox rig identically to the editor preview [US-31]

#### Structural
- [ ] AGENTS.md directory layout includes `tools/editor/` tree with updated descriptions reflecting the rig tab addition [phase]
- [ ] AGENTS.md file ownership table includes entries for new rig editor modules (rig renderer, property editor, persistence) [phase]
- [ ] AGENTS.md running instructions reference `tools/editor/` path and port [phase]
- [ ] `docs/rig-system-guide.md` updated to reference the editor's rig tab for visual profile authoring [phase]

### Golden principles (phase-relevant)
- **Depth map adherence** (AGENTS.md) — rig preview renders parts at their profile depth values; the editor visualizes depth ordering
- **Systems-module architecture** — rig editor components (renderer, property editor, persistence) are separate modules, not monolithic
- **Responsive scaling** (AGENTS.md) — editor layout works at common desktop viewport sizes (the editor is a dev tool, not mobile-targeted)
- **Parameterized systems** (AGENTS.md) — rig editor receives rig definitions as data, no hardcoded fox-specific logic in editor components
- **Frame-based delta-time** (AGENTS.md) — Phaser preview scene uses delta time for any animation preview
