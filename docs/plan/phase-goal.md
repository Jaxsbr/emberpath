# Phase: tile-architecture

## Phase goal

Rebuild the tile-rendering and collision foundation so every future area is built on a single coherent model: **vertex-based Wang terrain** (smooth blends between ground types like grass, sand, water, path), a **sparse object layer** that contributes to collision (trees, walls, gates, fences, lanterns), and **PixelLab-generated content** that replaces the Kenney CC0 atlases for Ashen Isle and Fog Marsh. The end state: one architecture, no `TileType` enum, no `area.map: TileType[][]`, no separate "decoration is visual but wall-as-tile is collision" split — terrain has a `passable` flag, objects have a `passable` flag, collision unifies both. The two existing areas migrate to the new model with new PixelLab tilesets and style-matched objects, the marsh-trap dead-end becomes a terrain-flip (path → water) the Wang resolver re-blends automatically, and the editor (`tools/editor`) gains vertex-aware brushes and object placement.

**Phase size waiver:** This phase exceeds the spec-author's 5-story rule by design — the operator (Jaco) explicitly waived the rule because shipping the architecture without the PixelLab content would degrade the visual baseline, and shipping the content without the architecture isn't possible. One PR at the end of US-98 (the final re-author).

### Stages and review pause point

The phase has two natural stages with an in-engine review checkpoint between them. **No code is shipped at the pause** — it's a verification gate before content generation begins:

1. **Architecture (US-92 + US-93 + US-94)** — new data model, Wang resolver in degenerate-mode, object layer + collision unification. At the end of stage 1, both Ashen Isle and Fog Marsh render *visually identical to today* using their existing Kenney frames wired into the new resolver. The operator verifies no regression in-engine.
2. **Content + final wiring (US-95 + US-96 + US-97 + US-98)** — PixelLab Wang tilesets, PixelLab style-matched objects, editor updates, final re-author with the new content. Marsh-trap closure migrates to a terrain-flip on the same tick.

### Stories in scope

- US-92 — Vertex terrain + object data model
- US-93 — Wang resolver + degenerate-mode fallback for Kenney atlases
- US-94 — Object layer rendering + collision unification
- US-95 — PixelLab Wang terrain tilesets (Ashen Isle + Fog Marsh chains)
- US-96 — PixelLab style-matched map objects
- US-97 — Editor (`tools/editor`) — vertex-aware terrain brush + object placer
- US-98 — Re-author Ashen Isle + Fog Marsh + marsh-trap terrain-flip migration

### Design direction

Locked by `docs/art-style.md` and `art/styleGuide.ts` (US-87's codex). All PixelLab generations in US-95 and US-96 compose their prompts through `composeArtPrompt(subject, mood?)` so `STYLE_VIBE_PROMPT` and `STYLE_BASE_PROMPT` ride every request. PixelLab call settings standardised on:

- `view: "high top-down"` (matches storybook overhead read; "low top-down" reads as JRPG-perspective)
- `outline: "selective outline"` (interior detail rendered with shading per `art-style.md` § Line & Texture, exterior silhouette lined in umber)
- `shading: "basic shading"` for terrain (clustered ramps, no smooth gradients) and `"medium shading"` for objects (allows volumetric definition on trees/walls without going JRPG)
- `detail: "medium detail"` (highly detailed reads as commercial mobile-game pixel art; low detail reads as toy/jam)
- `tile_size: { width: 16, height: 16 }` (matches existing 16×16 atlases, TILE_SIZE constant unchanged)

Per-pair tileset prompts push the project's "sepia-first, hope-gold reserved" palette explicitly. Hope-gold (`#F2C95B` / `#E89C2A`) is **explicitly negative-prompted out of terrain tiles** — gold is reserved for narrative beats per `art-style.md` § Palette.

Per-object prompts use `create_map_object`'s style-matching mode: a 96×96 sample render of the area's terrain (post-US-95) is passed as `background_image` so PixelLab can match palette/outline weight.

### Done-when (observable)

#### US-92 — Vertex terrain + object data model

- [ ] `src/maps/terrain.ts` exists and exports `TerrainId`, `TerrainDefinition`, `TERRAINS`, `hasTerrain`; registry has at least `grass`, `sand`, `path`, `marsh-floor`, `water`, `stone` with correct `passable` flags (water: false; others: true) [US-92]
- [ ] `src/maps/objects.ts` exists and exports `ObjectKindId`, `ObjectKindDefinition`, `OBJECT_KINDS`, `hasObjectKind`; registry includes initial entries for every wall / door / tree / sign / flower / bush / gate kind referenced by the two areas [US-92]
- [ ] `data/areas/types.ts` `AreaDefinition` has `terrain: TerrainId[][]` (vertex grid, dimensions `(rows+1) × (cols+1)`), `objects: ObjectInstance[]`, and `conditionalTerrain?: ...[]`; `map: TileType[][]` field is removed (file inspection) [US-92]
- [ ] `TileType` enum is removed from `maps/constants.ts`; `grep -rn "TileType" src tools` returns zero hits [US-92]
- [ ] `decorations: DecorationDefinition[]` and `props: PropDefinition[]` retain shape and zero-collision contract (file inspection) [US-92]
- [ ] `ExitDefinition[]` is unchanged; renderer paints exit zones via a translucent overlay at depth 0.5 between terrain and objects, color sourced from `STYLE_PALETTE.hopeGoldLight` at alpha 0.25 (NOT a hardcoded hex literal) (file inspection — grep confirms `STYLE_PALETTE.hopeGoldLight` reference at the overlay creation site + manual screenshot at exit zones) [US-92]
- [ ] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-92]
- [ ] Consumer adaptation: `terrain` consumed by US-93 resolver and US-94 collision; `objects` consumed by US-94 renderer + collision and US-97 editor; no consumer hardcodes terrain or object ids beyond registry lookup (`grep -rn "'grass'\|'sand'\|'water'" src tools` shows registry usage only, not literal-string control flow outside the registry definition itself) [US-92]
- [ ] AGENTS.md reflects new modules `maps/terrain.ts`, `maps/objects.ts` and updated `data/areas/types.ts` ownership [US-92]

#### US-93 — Wang resolver + degenerate-mode fallback

- [ ] `src/maps/wang.ts` exists and exports `resolveWangFrame(tilesetId, terrainIds: [TL, TR, BR, BL])` with JSDoc pinning the clockwise-from-top-left corner convention [US-93]
- [ ] `WangTilesetDefinition` in `src/maps/tilesets.ts` has `cornerMaskTable: Record<string, string[]>` keyed `'0000'`..`'1111'` and `fallbackFrames: string[]` [US-93]
- [ ] `tiny-town` and `tiny-dungeon` are registered as degenerate Wang tilesets — `cornerMaskTable['0000']` lists existing FLOOR frames, `cornerMaskTable['1111']` lists existing WALL frames, all 14 other entries omitted; `fallbackFrames` lists FLOOR frames; module JSDoc notes "degenerate Wang — no transition tiles; replaced by US-95" [US-93]
- [ ] Resolver: present-mask path hash-picks within the entry's frame array via the existing FNV-1a-style hash; absent-mask path falls back to `fallbackFrames` AND logs a one-time-per-mask `console.warn(tilesetId, mask, expected: secondaryTerrain transition)` (file inspection + smoke run shows exactly one warn per absent mask seen, not per frame) [US-93]
- [ ] Corner-clockwise convention asserted: synthetic `[grass, sand, sand, grass]` corners produce mask `'0110'` (TR + BR are secondary), verified by inline test or runtime smoke check on `npm run dev` boot [US-93]
- [ ] `resolveFrame()` (legacy flat-bucket resolver) is removed; `grep -rn "resolveFrame" src tools` returns zero hits [US-93]
- [ ] `src/maps/atlasPreview.ts` (or `tools/atlas-preview.py` extension) generates a labelled-atlas PNG for any `WangTilesetDefinition`: 4×4 grid showing each `'0000'`..`'1111'` mask with picked frame and mask label overlaid in umber text [US-93]
- [ ] TypeScript build passes [US-93]
- [ ] AGENTS.md reflects new modules `maps/wang.ts`, `maps/atlasPreview.ts` and updated `maps/tilesets.ts` ownership [US-93]

#### US-94 — Object layer rendering + collision unification

- [ ] `GameScene.renderObjects()` exists, called once after `renderTerrain()` and `renderDecorations()`, places each `ObjectInstance` as `Phaser.GameObjects.Image` at depth 2.5 (file inspection) [US-94]
- [ ] AGENTS.md depth map updated: row "Objects" at depth 2.5 between Decorations (2) and Props (3) [US-94]
- [ ] `collidesWithWall` consults BOTH terrain (4-vertex AND-impassable rule) and object (cell `Map<string, boolean>` lookup) passability; out-of-bounds blocks (file inspection + collision smoke at terrain edges + at object cells) [US-94]
- [ ] `GameScene.buildObjectCollisionMap()` is called once in `create()` AND on `onFlagChange` for any flag referenced by an object's `condition` (file inspection + smoke: trigger marsh_trapped flag, confirm object collision rebuilt on the same tick) [US-94]
- [ ] `applyMarshTrappedState` is deleted; `grep -rn "applyMarshTrappedState" src` returns zero hits [US-94]
- [ ] `ObjectInstance.condition?` evaluated once at render AND on relevant `onFlagChange` only — never per-frame; subscriber unsubscribes collected and invoked in `cleanupResize` (file inspection + manual: enter Fog Marsh, trigger threshold, confirm conditional-object visibility flips on flag change) [US-94]
- [ ] Object `Phaser.GameObjects.Image` references tracked as instance fields, reset to `[]` at top of `renderObjects()`, `uiCam.ignore`-ed (file inspection — Learning EP-02 hygiene) [US-94]
- [ ] `decorations` and `props` rendering identical to pre-phase (zero collision contribution, depth 2 and 3 respectively) [US-94]
- [ ] **In-engine architecture-only baseline:** `npm run dev` shows Ashen Isle and Fog Marsh visually identical to pre-phase at desktop ~1280×720 viewport (zoom ~4×) AND mobile DevTools 360×640 viewport (zoom ~1.1×); side-by-side screenshots in manual-verify doc [US-94]
- [ ] Marsh-trap dead-end mechanic still works (threshold trigger flips conditional-object impassability via the new buildObjectCollisionMap path; closure restored on Reset Progress) — manual smoke test [US-94]
- [ ] AGENTS.md File ownership and Behavior rules sections updated for the new collision-unification rule and the deleted `applyMarshTrappedState` [US-94]

#### US-95 — PixelLab Wang terrain tilesets

- [ ] `tools/generate-tilesets.ts` exists with `TILESET_PLAN` covering 5 entries: 2 Ashen chains (grass→sand, sand→path) + 3 Fog Marsh chains (floor→path, floor→water, floor→stone); chained via `lower_base_tile_id` within each area [US-95]
- [ ] Every prompt is composed via `composeArtPrompt(subject, mood)` from `art/styleGuide.ts` — `STYLE_VIBE_PROMPT` substring present in each printed prompt [US-95]
- [ ] Standardised PixelLab settings on every call: `view: "high top-down"`, `outline: "selective outline"`, `shading: "basic shading"`, `detail: "medium detail"`, `tile_size: { width: 16, height: 16 }`; hope-gold negative-prompted [US-95]
- [ ] Running `npx tsx tools/generate-tilesets.ts` exits 0 and prints exactly 5 invocation blocks [US-95]
- [ ] 5 tileset PNG + JSON pairs saved at named paths under `assets/tilesets/<area-or-pair-name>/`; each `tilemap.json` records `{ name, source: 'PixelLab', generatedAt, tilesetId, lowerTerrain, upperTerrain, transitionDescription, transitionSize, prompt, mcpSettings }` [US-95]
- [ ] `assets/tilesets/ATTRIBUTION.md` `## PixelLab tilesets` section records each generated tileset with date, prompt, and PixelLab tileset id [US-95]
- [ ] Labelled-atlas preview PNG generated via `atlasPreview.ts` (US-93) for each tileset; saved to `/tmp/<tileset-name>-preview.png` (NOT committed); each preview opened and inspected before wiring [US-95]
- [ ] **Sepia-first read test:** chroma-removed view at 50% scale shows distinguishable terrain identity for each of 5 tilesets — manual checkbox per tileset, one-sentence luminance note per [US-95]
- [ ] **Hope-gold absence audit:** for each terrain tileset, hope-gold-family pixels < 3% — manual checkbox per tileset, recorded in verify doc [US-95]
- [ ] **Wang corner correctness:** for each tileset's labelled preview, manual checkbox per mask × per tileset (16 × 5 = 80 checkboxes); mask `'0001'` shows secondary terrain in bottom-left corner only (clockwise convention from US-93) [US-95]
- [ ] Reroll budget: ≤ 1 reroll per tileset (10 generations max); if exceeded, paragraph note in verify doc explaining what changed in the prompt [US-95]
- [ ] **Error-path: PixelLab MCP failure.** If a `create_topdown_tileset` call returns failed status, the operator records the failure in the verify doc and reruns that single entry; the generator script does NOT attempt automatic retry [US-95]
- [ ] **Error-path: missing-tileset asset at runtime.** If a registered Wang tileset's atlas PNG is absent at boot, `GameScene.preload` logs descriptive error naming `(tilesetId, expected path)` and `renderTerrain` falls back to flat-color tiles using `area.visual.floorColor / wallColor` so the scene still loads [US-95]
- [ ] Cost reconciliation table at end of phase records actual generations spent for tilesets (US-95) and objects (US-96) [US-95]
- [ ] TypeScript build passes with new tilesets registered in `TILESETS` [US-95]
- [ ] **In-engine smoke at both viewports:** new tilesets render correctly at desktop AND mobile viewports; Wang transitions visible at terrain edges [US-95]

#### US-96 — PixelLab style-matched map objects

- [ ] `tools/generate-map-objects.ts` exists with `OBJECT_PLAN` covering at least the named ~18 objects across both areas; each has `kindId`, `areaContext`, `subject`, `mood?`, `footprint?`, `passable` [US-96]
- [ ] Pre-generation step: 96×96 area sample patches rendered via helper to `/tmp/<area>-sample.png`; each MCP call references its area's sample via `background_image: { type: 'path', path: '/tmp/<area>-sample.png' }` [US-96]
- [ ] Every prompt composed via `composeArtPrompt(subject, mood)` — `STYLE_VIBE_PROMPT` substring present in each [US-96]
- [ ] Standardised PixelLab settings: `view: "high top-down"`, `outline: "selective outline"`, `shading: "medium shading"`, `detail: "medium detail"`, `width`/`height` 32 (or 48 for objects with footprint > 1×1) [US-96]
- [ ] Running `npx tsx tools/generate-map-objects.ts` exits 0 and prints one invocation block per object in `OBJECT_PLAN` [US-96]
- [ ] Each object PNG saved to `assets/objects/<area>/<kindId>.png`; `OBJECT_KINDS` registry entry's `atlasKey` and `frame` updated to point to the new asset [US-96]
- [ ] `assets/objects/ATTRIBUTION.md` records each object with date, prompt, PixelLab object id, and `background_image` used [US-96]
- [ ] **Style-matched cohesion test:** for each object, composited onto its area sample patch at 1:1 scale and visually inspected — palette / outline / shading reads as belonging to the terrain. Manual checkbox per object (~18 entries) [US-96]
- [ ] **Sepia-first silhouette test:** chroma-removed each object at 100% scale; named subject's silhouette distinguishable. Manual checkbox per object [US-96]
- [ ] **Hope-gold audit:** lantern-* objects MAY include hope-gold flame; all other objects have hope-gold-family pixels < 5%. Manual checkbox per object [US-96]
- [ ] Reroll budget: ≤ 1 reroll per object (≤ 36 generations max); reconciled in cost table [US-96]
- [ ] **Error-path: PixelLab MCP failure.** If a `create_map_object` call returns failed status, operator records failure in verify doc and reruns that single entry; generator script does NOT auto-retry [US-96]
- [ ] **Error-path: missing-object asset at runtime.** If an `OBJECT_KINDS` entry's `atlasKey` fails to load at boot, `GameScene.preload` logs warning naming `(kindId, expected path)`, `renderObjects` skips rendering the missing object **but the object still contributes to collision** (per its registry `passable` flag) [US-96]
- [ ] TypeScript build passes with `OBJECT_KINDS` populated [US-96]
- [ ] **In-engine smoke at both viewports:** objects render at correct depth (above terrain, below entities) without z-fighting; passable objects walked through; impassable objects block movement [US-96]

#### US-97 — Editor (`tools/editor`)

- [ ] `tools/editor/src/mapRenderer.ts` reads `area.terrain` and `area.objects`; uses the same Wang resolver as the game (imported via `@game/maps/wang`) [US-97]
- [ ] Cell-paint mode (default): click sets all 4 vertices of the cell to active terrain; drag-to-paint supported; sidebar terrain picker with per-terrain tile preview [US-97]
- [ ] Vertex-paint mode (Shift-click or mode toggle): nearest-vertex (Voronoi) selection; vertex dots rendered on grid in this mode [US-97]
- [ ] Object placer mode (Alt-click or mode toggle): drops active object kind at clicked cell; right-click removes; sidebar object picker with per-kind sprite preview; thin-red outline overlay for impassable objects (toggleable) [US-97]
- [ ] Export-to-TypeScript button serializes `area.terrain` and `area.objects` to a code block; preserves untouched `decorations`, `props`, `npcs`, `triggers`, `dialogues`, `storyScenes`, `exits`; copies to clipboard or shows in modal — no auto-write to disk [US-97]
- [ ] Detail panel on cell click shows: 4 vertex terrains, resolved Wang mask, picked frame id, object instance(s) with passability [US-97]
- [ ] Conditional decoration / object visibility toggle in sidebar — default state vs alternate state with faint tint indicator [US-97]
- [ ] `cd tools/editor && npm run dev` boots and renders Ashen Isle and Fog Marsh (post-US-98) without error; existing dialogue tree and story flow views unaffected [US-97]
- [ ] `tsc --noEmit` (editor's tsconfig) passes; `@game` path alias resolves to parent `src/` [US-97]
- [ ] Consumer adaptation: editor imports `TerrainDefinition`, `ObjectKindDefinition`, `WangTilesetDefinition`, resolver from `@game/...` — no local redeclaration; `grep -rn "TerrainDefinition\|ObjectKindDefinition" tools/editor/src` shows imports only [US-97]
- [ ] Manual smoke: cell-paint, vertex-paint (Shift-click), object place, object remove (right-click), conditional toggle, export round-trip — all per-control checkbox in verify doc [US-97]

#### US-98 — Re-author + marsh-trap migration

- [ ] `src/data/areas/ashen-isle.ts` rewritten: `map` removed, `terrain` populated as 39×51 vertex grid, `objects` populated for every previously-WALL cell + every wall/door/fence/sign/tapestry decoration that should now contribute collision; existing `decorations`, `props`, `npcs`, `triggers`, `dialogues`, `storyScenes`, `exits` unchanged [US-98]
- [ ] `src/data/areas/fog-marsh.ts` rewritten: same migration; vertex grid 25×31; wooden-plank "dry path" becomes `path` terrain vertices; closure cells become terrain vertices controlled by `conditionalTerrain` [US-98]
- [ ] `AreaDefinition.conditionalTerrain` field added in US-92 is exercised: Fog Marsh declares the marsh-trap closure vertices with `condition: 'marsh_trapped == true'`, `whenTrue: 'water'`, `whenFalse: 'path'` for vertices at row 22 cols 13-16 and row 23 cols 13-16 [US-98]
- [ ] `GameScene.applyConditionalTerrain()` mutates `area.terrain` vertex values per `conditionalTerrain` declaration; called once on `create()` AND on `onFlagChange` for any referenced flag; Wang resolver re-renders affected cells; collision unifies via terrain passability (water `passable: false`) [US-98]
- [ ] Conditional decorations representing the closure (PATH-vs-EDGE variants on Fog Marsh) are removed — terrain-flip + Wang re-blend renders the closure correctly without parallel decoration variants [US-98]
- [ ] `tiny-town` and `tiny-dungeon` `WangTilesetDefinition` entries removed from `TILESETS`; `assets/tilesets/tiny-town/` and `assets/tilesets/tiny-dungeon/` directories deleted; Kenney attribution sections removed from `ATTRIBUTION.md` [US-98]
- [ ] Degenerate-mode shim and one-time-mask warning Set from US-93 removed (every PixelLab tileset has all 16 mask entries, so the warning path becomes dead code) [US-98]
- [ ] `grep -rn "tiny-town\|tiny-dungeon" src tools docs` returns zero hits except phase retrospective archive files [US-98]
- [ ] AGENTS.md updated: file ownership for new modules, depth map (Objects at 2.5), behavior rules for tile rendering rewritten to describe the shipped state [US-98]
- [ ] **Per-area variant baseline check (Ashen Isle):** Old Man dialogue, Wren warming, Driftwood refusal, story-scene trigger, north exit gating, homecoming reflection, ember overlay, alpha-gated decorations — each as separate checkbox in verify doc [US-98]
- [ ] **Per-area variant baseline check (Fog Marsh):** Marsh Hermit dialogue, threshold trigger flipping closure, escape-attempt thoughts, Keeper rescue chain, story-scene trigger, fog-to-ashen exit gating, marsh-vision story scene — each as separate checkbox [US-98]
- [ ] **Save-state compatibility:** pre-phase save loads post-phase without error; player resumes at same world position (manual smoke) [US-98]
- [ ] **Reset Progress smoke:** marsh-trap closure restored, warming flags cleared, ember overlay restored — manual checkbox [US-98]
- [ ] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-98]
- [ ] **In-engine smoke at both viewports:** desktop ~1280×720 (zoom ~4×) AND mobile DevTools 360×640 (zoom ~1.1×) — both areas play through every existing flow; Wang transitions on terrain edges, object depth ordering, marsh-trap closure visual all read correctly [US-98]
- [ ] Cost reconciliation: `## Cost reconciliation` section in manual-verify doc records actual PixelLab generations spent (tilesets US-95 + objects US-96 + rerolls) [US-98]
- [ ] Manual-verify doc `docs/plan/tile-architecture-manual-verify.md` exists with all per-story sections [US-98]

#### Phase-level / structural

- [ ] `AGENTS.md` reflects: new `maps/terrain.ts`, `maps/objects.ts`, `maps/wang.ts`, `maps/atlasPreview.ts` modules in File ownership; new `Objects` row at depth 2.5 in Depth map; rewritten Behavior rules for tile rendering, collision unification, conditional terrain flip; removal of `TileType`, `applyMarshTrappedState`, Kenney atlas references, legacy `resolveFrame` [phase]
- [ ] `npx tsc --noEmit && npm run build` passes [phase]
- [ ] No regression in any of the 22 prior shipped phases' features verified by per-area variant baseline checks [phase]

#### Auto-added safety criteria

- [ ] Conditional terrain / object / decoration conditions parse through existing `evaluateCondition` parser — no new condition syntax, no `eval` / `Function` constructor introduced [phase]
- [ ] Object kind ids, terrain ids, atlas keys, and frame strings come from registries (`OBJECT_KINDS`, `TERRAINS`, `TILESETS`), never from user-provided strings — no path-traversal risk surface [phase]
- [ ] Editor "Export TypeScript" copies code to clipboard or shows in a modal; no auto-write to disk, no eval, no execution of pasted code at editor runtime [phase]
- [ ] PixelLab MCP invocations contain only hardcoded constants from `TILESET_PLAN` / `OBJECT_PLAN` and registry-resolved values — no user-input pathway feeds the prompts [phase]
- [ ] Generated PNG paths in `assets/tilesets/<id>/` and `assets/objects/<area>/<kindId>.png` are derived from registry ids (string-literal union), never from user input [phase]

#### Async-cleanup safety

- [ ] Every `onFlagChange` subscriber added by this phase (object-collision-map rebuild, conditional-terrain re-evaluation, conditional-object visibility) collects an unsubscribe function and invokes it in `cleanupResize` / scene-shutdown [phase]
- [ ] Object `Phaser.GameObjects.Image` references reset at top of `renderObjects()` AND destroyed on `scene.events.shutdown` (Learning EP-02) [phase]

#### Class baseline check

- [ ] Every PixelLab object kind appears in the F3 debug overlay's collision-cell rendering (impassable objects show as filled red cells; passable objects unmarked) [phase]
- [ ] Every PixelLab object kind is `uiCam.ignore`-ed (renders main-camera only) [phase]
- [ ] Every PixelLab object kind cleans up on `scene.shutdown` per existing GameScene cleanup lifecycle [phase]

#### Variant baseline check

- [ ] Wang resolver verified on Ashen Isle (grass / sand / path terrains + transitions) — explicit per-terrain transition checkbox in verify doc [phase]
- [ ] Wang resolver verified on Fog Marsh (marsh-floor / path / water / stone terrains + transitions) — explicit per-terrain transition checkbox in verify doc [phase]
- [ ] Object rendering verified on Ashen Isle (every kind: tree, wall, door, gate, fence, sign, tapestry, bush, flower) — per-kind checkbox [phase]
- [ ] Object rendering verified on Fog Marsh (every kind: dead-tree, marsh-stone, gravestone, mushroom, dry-reed, wall-tomb, door-tomb, lantern-broken) — per-kind checkbox [phase]
- [ ] Conditional terrain flip verified at marsh-trap closure (path → water on flag flip; reverts on Reset Progress) — explicit checkbox [phase]

### Golden principles (phase-relevant)

From `AGENTS.md` and `docs/plan/LEARNINGS.md`:

- **Loop-invariant operations and dead guards (Learning EP-01):** terrain Wang resolution runs once per cell at area load (cached via Phaser tile sprites), conditional terrain / object / decoration evaluation runs once at create + only on flag-change events (subscriber-based), per-frame collision is O(1) via the runtime cell-keyed `Map<string, boolean>` not per-object iteration.
- **Phaser scene-restart hygiene (Learning EP-02):** every new GameObject reference (object sprites, exit-tint overlays, conditional terrain re-render artifacts) reset at top of its create method; `scene.events.shutdown` handler clears all subscribers and destroys references.
- **Visual-pick-without-verification (Learning EP-03):** every PixelLab generation gated behind labelled-atlas preview + sepia-first + hope-gold-absence + Wang-corner-correctness checks; in-engine smoke at desktop AND mobile viewports for both areas after content lands.
- **Pattern-reuse context check (Learning EP-04):** GameScene runs on the main camera; the Wang resolver and object renderer target the main camera; UI camera is unaffected — pattern reuse from `dialogue.ts` (UI camera) is explicitly avoided in this phase.
- **Show, don't preach** — the marsh-trap terrain-flip is mechanical truth (the player sees the path become water rather than reading "you cannot pass" text); no preaching, no error chime.
- **Free gift** — content stays freely-moveable: terrain and objects are author-controlled data, not procedural; the editor exists to make this visible.
- **No villains** — no design choice in this phase frames terrain or objects as adversaries; impassable objects (walls, gravestones) are environmental, not malicious.
