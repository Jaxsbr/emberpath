# Phase: tile-architecture

Status: Shipped

## Phase goal

Rebuild the tile-rendering and collision foundation so every future area is built on a single coherent model: **vertex-based Wang terrain** (smooth blends between ground types like grass, sand, water, path), a **sparse object layer** that contributes to collision (trees, walls, gates, fences, lanterns), and **PixelLab-generated content** that replaces the Kenney CC0 atlases for Ashen Isle and Fog Marsh. The end state: one architecture, no `TileType` enum, no `area.map: TileType[][]`, no separate "decoration is visual but wall-as-tile is collision" split — terrain has a `passable` flag, objects have a `passable` flag, collision unifies both. The two existing areas migrate to the new model with new PixelLab tilesets and style-matched objects, the marsh-trap dead-end becomes a terrain-flip (path → water) the Wang resolver re-blends automatically, and the editor (`tools/editor`) gains vertex-aware brushes and object placement.

This phase exceeds the spec-author's 5-story rule by design — the operator (Jaco) explicitly waived the rule because shipping the architecture without the PixelLab content would degrade the visual baseline, and shipping the content without the architecture isn't possible. One PR at the end of US-98 (the final re-author).

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

**Per-pair tileset prompts** push the project's "sepia-first, hope-gold reserved" palette explicitly. Example for Ashen Isle grass→sand: subject `"weathered sepia grass with scattered single-pixel weeds blending into pale dry sand"`, mood `"graphite storybook, sepia first; no hope-gold accents on terrain"`. Hope-gold (`#F2C95B` / `#E89C2A`) is **explicitly negative-prompted out of terrain tiles** — gold is reserved for narrative beats per `art-style.md` § Palette.

**Per-object prompts** use `create_map_object`'s style-matching mode: a 96×96 sample render of the area's terrain (post-US-95) is passed as `background_image: { type: 'path', path: '...' }` so PixelLab can match palette/outline weight. Object prompt example: `"weathered umber stone wall section, top-down, graphite storybook style, selective outline"`.

**Anti-patterns negative-prompted on every call** (sourced from `art-style.md` § What to avoid): pure-black outlines, neon saturation, hard cel-shading blocks, anime sparkle eyes, glossy metallic JRPG armor, clean vector tiles with no texture, high-frequency 8-bit crunch.

### Stories

#### US-92 [Shipped] — Vertex terrain + object data model

As an area author, I want areas to be authored as a **vertex grid of terrains** plus a **sparse list of objects**, each with a `passable` flag, so that one model expresses ground type, walkability, and overlay objects without the FLOOR/WALL/EXIT enum and without the "decoration is visual / wall-tile is collision" split.

**Acceptance criteria:**

- A new module `src/maps/terrain.ts` exports `TerrainId` (string-literal union of registered ids), `TerrainDefinition` (`{ id: string; passable: boolean; wangTilesetId: string; description: string }`), `TERRAINS: Record<TerrainId, TerrainDefinition>`, and `hasTerrain(id): boolean`. The registry has at least these initial entries: `'grass'`, `'sand'`, `'path'`, `'marsh-floor'`, `'water'`, `'stone'`. Water has `passable: false`; all others `passable: true` for stage 1 (final passability locked when content lands in US-98).
- A new module `src/maps/objects.ts` exports `ObjectKindId`, `ObjectKindDefinition` (`{ id: string; atlasKey: string; frame: string; passable: boolean; footprint?: { w: number; h: number } }`, footprint defaulting to `{w:1,h:1}` when omitted), `OBJECT_KINDS: Record<ObjectKindId, ObjectKindDefinition>`, and `hasObjectKind(id): boolean`. Initial entries cover the existing wall/door/tree/sign/flower/bush/gate vocabulary used by the two areas (final list locked by US-98 audit).
- `data/areas/types.ts` is rewritten: `AreaDefinition.map: TileType[][]` is **removed**; new fields are added — `terrain: TerrainId[][]` (the vertex grid; dimensions `(rows + 1) × (cols + 1)`, indexed `[vRow][vCol]`) and `objects: ObjectInstance[]` where `ObjectInstance = { kind: ObjectKindId; col: number; row: number; condition?: string }`.
- `TileType` enum (`maps/constants.ts`) is **removed**; `PLAYER_SIZE`, `TILE_SIZE`, `PLAYER_SPEED`, `NPC_SIZE` remain unchanged. Every consumer of `TileType` (collision, GameScene tile rendering, exit zones, conditional decorations, save-state version check) is migrated to read terrain passability or object passability instead. `grep -rn "TileType" src tools` returns zero hits at end of phase.
- `decorations: DecorationDefinition[]` and `props: PropDefinition[]` retain their existing shape and zero-collision contract — they remain visual-only overlays at depth 2 and 3. `condition?` field on decorations is preserved exactly as-is (the conditional-decoration pathway must keep working).
- `ExitDefinition[]` is unchanged — exits remain world-rectangles independent of terrain. Renderer paints exit zones via a new `EXIT_TINT_OVERLAY` (a translucent `Phaser.GameObjects.Rectangle` at depth 0.5, between terrain and objects) so the visual prompt "this is a way out" survives without an EXIT TileType. **Color is palette-driven, not hardcoded:** uses `STYLE_PALETTE.hopeGoldLight` (`#F2C95B`) at alpha 0.25 — exit invitations are the one terrain-adjacent visual permitted hope-gold, since they signal *the way to the next stage of the journey* (theological alignment with the "go forward" verb).
- TypeScript build passes (`npx tsc --noEmit && npm run build`) with the new types.

**User guidance:**

- Discovery: N/A — internal data-model migration; no user-visible behavior change in this story alone.
- Manual section: N/A — internal contract.
- Key steps: N/A — internal.

**Design rationale:** Vertex-based authoring (chosen over cell-based) lets a single-cell-wide path of sand cut through grass with smooth tapered shoulders — cell-based forces 2-cell-wide paths to get the same blend. The cost (slightly more abstract authoring) is hidden by the editor's brush in US-97. Removing `TileType` is mandatory under "no side-by-side" — anything that looks at FLOOR/WALL is the old model and must go. Water-as-terrain (not as object) keeps Wang blends working at water edges, which is the whole point of using Wang.

**Consumer adaptation:** `terrain` is consumed by (a) the Wang resolver in US-93 to pick atlas frames, (b) `collidesWithWall` in US-94 to derive cell passability from the 4 vertex terrains. `objects` is consumed by (c) GameScene's renderer in US-94 at depth 2.5, (d) `collidesWithWall` in US-94 to derive cell passability from object presence + kind, (e) the editor in US-97 to render and mutate. Each consumer reads the registry-resolved passability — no consumer hardcodes terrain or object ids beyond the registry lookup.

---

#### US-93 [Shipped] — Wang resolver + degenerate-mode fallback for Kenney atlases

As the tile renderer, I want a deterministic Wang resolver that samples a cell's 4 vertex terrains and picks the matching tile from a 16-mask table, with a graceful fallback when a Kenney-derived "degenerate Wang" tileset has no transition entry, so that stage 1 can ship visually identical to today using the existing Kenney atlases before stage 2's PixelLab content lands.

**Acceptance criteria:**

- A new module `src/maps/wang.ts` exports `resolveWangFrame(tilesetId: string, terrainIds: [TerrainId, TerrainId, TerrainId, TerrainId]): string | null` where the 4-element tuple is `[topLeft, topRight, bottomRight, bottomLeft]` (clockwise from top-left, **a documented invariant pinned in a JSDoc and an inline test**).
- A new shape `WangTilesetDefinition` lives in `src/maps/tilesets.ts`: `{ atlasKey: string; primaryTerrain: TerrainId; secondaryTerrain: TerrainId | null; cornerMaskTable: Record<string, string[]>; fallbackFrames: string[] }` where `cornerMaskTable` keys are 4-bit binary strings `'0000'`..`'1111'` (a 1 means "secondary terrain at this corner, in clockwise order TL/TR/BR/BL") and values are arrays of frame strings (multiple frames per mask permitted; resolver hash-picks within the array via the existing FNV-1a-style hash from `tilesets.ts:hashCell`, preserving deterministic per-cell variation).
- The `TILESETS` registry rewrites `tiny-town` and `tiny-dungeon` as **degenerate Wang tilesets** — `cornerMaskTable['0000']` lists the existing FLOOR frames (`['0','1','2']` for tiny-town, `['48','49','50','51']` for tiny-dungeon), `cornerMaskTable['1111']` lists existing WALL frames (`['120','121','122']` / `['0','1','2']`); all other 14 mask entries are intentionally **omitted** from the table. `fallbackFrames` lists the FLOOR frames for both — used when the resolver hits an absent mask. Documented in module JSDoc as "degenerate Wang — no transition tiles; this tileset will be replaced by US-95 PixelLab generation."
- Resolver behavior: when the corner-mask table has an entry for the computed mask, hash-pick within its array. When absent, fall back to `fallbackFrames` hash-pick AND log a one-time-per-mask `console.warn` naming `(tilesetId, mask, expected: secondaryTerrain transition)`. The one-time guard uses a module-level `Set<string>` keyed `${tilesetId}:${mask}` so warnings don't spam every frame.
- A unit-style assertion (or runtime smoke check on `npm run dev` boot) verifies the corner-clockwise convention: a synthetic terrain grid with `[grass, sand, sand, grass]` corners produces mask `'0110'` (TR + BR are secondary), NOT `'0011'` or another ordering.
- `resolveFrame()` (the existing flat-bucket resolver) is **removed** — it has no consumers under the new model. `grep -rn "resolveFrame" src tools` returns zero hits.
- A new module `src/maps/atlasPreview.ts` (or extension to `tools/atlas-preview.py` — author's call, but TypeScript preferred for in-repo type-sharing) generates a labelled-atlas PNG for any `WangTilesetDefinition`: a 4×4 grid showing each mask `'0000'`..`'1111'` with the picked frame and the mask label overlaid in umber text. Used in US-95 for verification.
- TypeScript build passes (`npx tsc --noEmit && npm run build`).

**User guidance:**

- Discovery: N/A — internal renderer.
- Manual section: N/A — internal.
- Key steps: N/A — internal.

**Design rationale:** Hash-pick within a mask's frame array preserves the per-cell variation that today's `tilesets.ts` hash provides (Ashen Isle's 3-frame floor variation isn't lost). The `'0000'` + `'1111'` only convention for Kenney is the cleanest way to satisfy "no side-by-side" — the resolver runs in its single-mode degenerate case, not a different code path. The labelled-atlas preview is non-negotiable per Learning EP-03 (`visual-pick-without-verification` shipped twice in `tileset` and `world-legibility` retros — frame `116` was a wizard portrait when the operator expected stones).

---

#### US-94 [Shipped] — Object layer rendering + collision unification

As the player, I want trees, walls, gates, and fences to **render on top of terrain at the right depth** and to **block movement when their `passable: false`**, so that the world reads as cohesive (a tree visibly sits on grass) and so that walking into a wall stops me whether the wall is encoded as terrain or as an object.

**Acceptance criteria:**

- `GameScene` renders `area.objects` at depth band 2.5 (between Decorations at 2 and Entities at 5) via a new `renderObjects()` method called once after `renderTerrain()` and `renderDecorations()`. Each `ObjectInstance` is rendered as `Phaser.GameObjects.Image` using the registry-resolved `atlasKey + frame` and placed at world coords `(col * TILE_SIZE + TILE_SIZE/2, row * TILE_SIZE + TILE_SIZE/2)` with the existing display-size scaling.
- `Depth map` in `AGENTS.md` is updated: a new row "Objects" at depth 2.5, between Decorations (2) and Props (3). Existing depth values for entities/lighting/thoughts/etc. are unchanged.
- `systems/collision.ts:collidesWithWall` is rewritten to consult **both** terrain and object passability:
  - For a player bounding-box corner at `(x, y)`, derive the cell `(col, row) = (floor(x/TILE_SIZE), floor(y/TILE_SIZE))`.
  - **Terrain step:** look up the cell's 4 vertex terrains from `area.terrain[row][col]`, `[row][col+1]`, `[row+1][col+1]`, `[row+1][col]`. If **all four are `passable: false`**, the cell blocks. (Three-passable + one-impassable is treated as walkable terrain — the impassable-vertex affects rendering but does not block; collision is cell-granular, not vertex-granular. This keeps water collision predictable for players.)
  - **Object step:** if any `ObjectInstance` at `(col, row)` has `passable: false` (looked up via a runtime `Map<string, boolean>` keyed `"col,row"` built once at area load), the cell blocks.
  - Out-of-bounds (any vertex outside `area.terrain` dimensions) blocks, matching today's behavior.
- Object collision lookup is built in a new `GameScene.buildObjectCollisionMap()` method called once on `create()` AND **rebuilt on `onFlagChange` for any object whose `condition` references the changed flag** (preserves the marsh-trap-style conditional-collision-flip pathway under the new model). `grep` confirms `buildObjectCollisionMap` is invoked from both `create()` and the flag-change subscriber.
- `applyMarshTrappedState` (the legacy `area.map[22][13..16]` mutation) is **deleted** — its job moves to (a) US-98's terrain-flip authoring (path → water vertex flip on flag change) and (b) the object-collision-map rebuild for any objects gated by `marsh_trapped`. `grep -rn "applyMarshTrappedState" src` returns zero hits.
- Conditional objects: `ObjectInstance.condition?` is evaluated through `systems/conditions.ts:evaluateCondition`. Visibility is set once at `renderObjects()` AND re-evaluated only when a referenced flag actually changes (parses out flag names per the existing pattern in `data/areas/registry`-side spawnCondition handling, registers `onFlagChange` listeners, collects unsubscribes, invokes them in `cleanupResize`). Per-frame conditional-evaluation is forbidden (Learning EP-01).
- Rendering hygiene: object `Phaser.GameObjects.Image` references are tracked as instance fields on GameScene, reset to `[]` at the top of `renderObjects()`, and `uiCam.ignore`-ed (Learning EP-02).
- Existing `decorations` and `props` rendering remains identical — zero collision contribution, depth 2 and 3 respectively.
- TypeScript build passes; `npm run dev` boots Ashen Isle and Fog Marsh with **visually identical** rendering to pre-phase baseline (objects placed at WALL cells render the same Kenney WALL frame at the same world position the WALL tile rendered before; terrain at FLOOR cells renders the same FLOOR frames).

**User guidance:**

- Discovery: At end of US-94 the architecture is in place but content is unchanged — both areas look like today. The architecture-only review pause point lands here.
- Manual section: `docs/plan/tile-architecture-manual-verify.md` (new file) — § "Architecture-only baseline" with per-area screenshot checkboxes confirming visual parity with pre-phase Ashen Isle and Fog Marsh.
- Key steps: 1) Boot Ashen Isle. 2) Walk every wall cell — confirm collision. 3) Walk every FLOOR cell — confirm walkability. 4) Trigger marsh-trap dead-end on Fog Marsh — confirm the closure flips collision (now via object-collision-map rebuild on `marsh_trapped` flag change, since US-98's terrain-flip migration hasn't landed yet). 5) Press Reset Progress — confirm closure restores.

**Design rationale:** Cell-granular collision (4-vertex AND check) is chosen over vertex-granular because vertex-granular collision means the player can stand on a single grass corner of a mostly-water cell, which both reads weirdly and breaks the player-bounding-box assumption everywhere else. The cell-granular rule keeps gameplay legible: "if the cell is mostly impassable, you can't enter; if it's mostly passable, you can." Wang's smooth-blend visual is decoupled from collision granularity by design.

---

#### US-95 [Shipped] — PixelLab Wang terrain tilesets (Ashen Isle + Fog Marsh chains)

As an art-pipeline operator, I want PixelLab-generated 16-tile Wang tilesets for both areas, prompt-composed through the US-87 codex and chained via `lower_base_tile_id` for visual continuity, so that Ashen Isle and Fog Marsh ship with their own coherent art direction matching `docs/art-style.md` rather than reusing Kenney CC0 atlases.

**Acceptance criteria:**

- A new tool `tools/generate-tilesets.ts` exists. It defines a `TILESET_PLAN` constant — an ordered list of `{ areaId, lowerTerrain, upperTerrain, transitionDescription, transitionSize, lowerBaseTileFrom?, upperBaseTileFrom? }` entries. The plan covers:
  - **Ashen Isle chain:** (1) `grass` (lower) → `sand` (upper), transition `"dry sepia weeds and stray pebbles"`, transition_size 0.25; (2) `sand` (lower, chained from #1's upper base) → `path` (upper), transition `"compacted sepia stones"`, transition_size 0.25.
  - **Fog Marsh chain:** (3) `marsh-floor` (lower) → `dry-path` (upper, equivalent to Ashen's `path`), transition `"raised wooden planks at edge"`, transition_size 0.5; (4) `marsh-floor` (lower, chained from #3) → `water` (upper), transition `"murky reed shallows"`, transition_size 0.5; (5) `marsh-floor` (lower, chained from #3) → `stone` (upper), transition `"weathered umber rubble"`, transition_size 0.25.
  - Total: 5 PixelLab calls, each one chained to the prior call's tile id where applicable so palette continuity is preserved within an area.
- Every call uses `composeArtPrompt(subject, mood)` from `art/styleGuide.ts` (US-87) to build the `lower_description`, `upper_description`, and `transition_description` prompts — `STYLE_VIBE_PROMPT` and the anti-pattern list from `STYLE_BASE_PROMPT` ride every request. The script logs the composed prompt for each tile pair before printing the MCP invocation block.
- Standardised PixelLab settings on every call: `view: "high top-down"`, `outline: "selective outline"`, `shading: "basic shading"`, `detail: "medium detail"`, `tile_size: { width: 16, height: 16 }`. Hope-gold (`#F2C95B` / `#E89C2A`) is **explicitly named in negative prompts** for every terrain tile (gold reserved for narrative beats per `art-style.md` rule).
- Running `npx tsx tools/generate-tilesets.ts` exits 0 and prints exactly 5 invocation blocks (no auto-firing — same invocation-printing pattern as `tools/generate-scene-art.ts` from US-91; PixelLab MCP requires agent context).
- After generation, the 5 tileset PNGs + their metadata JSON are saved to `assets/tilesets/<area-or-pair-name>/tilemap.png` + `tilemap.json`. Naming locked: `assets/tilesets/ashen-isle-grass-sand/`, `ashen-isle-sand-path/`, `fog-marsh-floor-path/`, `fog-marsh-floor-water/`, `fog-marsh-floor-stone/`. Each `tilemap.json` records `{ name, source: 'PixelLab', generatedAt, tilesetId, lowerTerrain, upperTerrain, transitionDescription, transitionSize, prompt: composedPrompt, mcpSettings: {view, outline, shading, detail} }` for traceability.
- A new section `## PixelLab tilesets` in `assets/tilesets/ATTRIBUTION.md` (created if absent) records each generated set with the generation date, prompt, and PixelLab tileset id. Kenney CC0 sections remain for the soon-to-be-removed `tiny-town` / `tiny-dungeon` atlases until US-98 deletion.
- For each generated tileset, a labelled-atlas preview PNG is produced via the US-93 `atlasPreview.ts` tool — a 4×4 grid showing each `'0000'`..`'1111'` mask with frame and mask label overlaid. Saved to `/tmp/<tileset-name>-preview.png` (NOT committed). The labelled preview is opened in an image viewer and visually verified per the criteria below before the tileset is wired into `TILESETS`.
- **Sepia-first read test (per `art-style.md` § Palette rule):** each generated tileset, when chroma is removed at 50% scale, has distinguishable terrain identity in luminance-only view. Manual checkbox per tileset (5 entries), each accompanied by a one-sentence note in the manual-verify doc recording what is distinguishable.
- **Hope-gold absence audit:** for each terrain tileset, sampling the histogram peak in any image tool confirms hope-gold-family pixels (`#F2C95B`–`#E89C2A` ±10% in Lab space) are < 3% of total pixels. Manual checkbox per tileset (5 entries).
- **Wang corner correctness:** for each generated tileset, the labelled preview is inspected and each of the 16 mask tiles is verified to render the correct corner pattern. Mask `'0000'` must be uniform lower terrain; mask `'1111'` uniform upper; mask `'0001'` must show secondary terrain in the **bottom-left corner only** (per the resolver's TL/TR/BR/BL clockwise convention from US-93). Manual checkbox per mask per tileset (16 × 5 = 80 checkboxes).
- **Reroll budget:** 1 reroll per tileset baked into the budget (10 generations max). If a tileset needs > 1 reroll, it's flagged in the manual-verify doc with a one-paragraph note on what failed and what was changed in the prompt for the successful generation. Budget reconciliation table at end of phase records actual generations spent.
- TypeScript build passes (`npx tsc --noEmit && npm run build`) with the new tilesets registered in `TILESETS`.

**User guidance:**

- Discovery: Run `npx tsx tools/generate-tilesets.ts` after US-94 ships. Submit each printed MCP invocation through the agent's MCP-enabled session. Wait for each tileset (~100s async); use `mcp__pixellab-team__get_topdown_tileset` to retrieve when complete. Save PNG and metadata to the named paths.
- Manual section: `docs/plan/tile-architecture-manual-verify.md` — § "PixelLab tileset generation" with per-tileset sepia-first checkboxes, hope-gold absence checkboxes, and per-mask Wang correctness checkboxes (80 total).
- Key steps: 1) Run the generator script. 2) Submit each MCP call. 3) Save outputs. 4) Generate labelled preview. 5) Visual verify in image viewer. 6) Wire into `TILESETS`. 7) Run `npm run dev` and confirm in-engine.

**Design rationale:** Chaining via `lower_base_tile_id` is the difference between "my grass and my sand look like they belong to the same world" and "my grass and my sand look like two different artists." Within an area, every terrain pair downstream of the first reuses the prior call's tile id for palette anchoring. Cross-area chaining is intentionally NOT done — Ashen Isle and Fog Marsh should read as distinct registers of the same storybook (the village vs. the marsh), not as a continuous coastline. The negative-prompt of hope-gold on terrain enforces `art-style.md` rule "color is sacred" mechanically rather than relying on hope.

---

#### US-96 [Shipped] — PixelLab style-matched map objects

As an art-pipeline operator, I want every object kind referenced by the two areas (trees, walls, gates, fences, lanterns, signs, doors, etc.) generated through PixelLab's `create_map_object` style-matching mode against a sample render of the area's new tileset, so that objects visually cohere with the terrain they sit on rather than reading as a sticker overlay.

**Acceptance criteria:**

- A new tool `tools/generate-map-objects.ts` exists. It defines an `OBJECT_PLAN` constant — an ordered list of `{ kindId, areaContext: 'ashen-isle' | 'fog-marsh', subject, mood?, footprint?, passable }` entries. After US-95 ships, the script first **renders a 96×96 sample tile patch** for each area (via a small helper that composites a few representative cells from the new tileset into a PNG) and saves it to `/tmp/<area>-sample.png`. The MCP invocation for each object then references this sample via `background_image: { type: 'path', path: '/tmp/<area>-sample.png' }`.
- The plan covers the full vocabulary needed by the two areas (final list locked by the US-98 author audit, but the initial plan must include): for Ashen Isle — `tree-pine`, `tree-bare`, `bush`, `flower`, `wall-stone`, `door-wood`, `gate-wood`, `fence-rail`, `sign-wood`, `tapestry`. For Fog Marsh — `dead-tree`, `marsh-stone`, `gravestone`, `mushroom`, `dry-reed`, `wall-tomb`, `door-tomb`, `lantern-broken`. ~18 unique object kinds. Each object's `passable` flag is set per `OBJECT_KINDS` (walls/gates/trees/gravestones impassable; flowers/bushes/signs/lanterns passable — author judgment per kind, committed in code).
- Every object call uses `composeArtPrompt(subject, mood)` to build the `description` prompt — `STYLE_VIBE_PROMPT` rides every request. Standardised PixelLab settings: `view: "high top-down"`, `outline: "selective outline"`, `shading: "medium shading"` (allows volumetric definition), `detail: "medium detail"`, `width: 32` and `height: 32` (or `48` for objects with footprint > 1×1 — script computes from `footprint`).
- Running `npx tsx tools/generate-map-objects.ts` exits 0 and prints one MCP invocation block per object in `OBJECT_PLAN`. Like US-95, invocation-printing not auto-firing.
- After generation, each object PNG is saved to `assets/objects/<area>/<kindId>.png`. Each object kind's `OBJECT_KINDS` registry entry's `atlasKey` and `frame` are updated to point to the new asset (objects are loaded as standalone images, not packed atlases — `frame: '0'` since each PNG is single-frame).
- `assets/objects/ATTRIBUTION.md` records each generated object with date, prompt, PixelLab object id, and `background_image` used.
- **Style-matched cohesion test:** for each object, the object PNG is composited onto the area sample tile patch at 1:1 scale and visually inspected — the object must read as "belonging to" the terrain (palette agrees, outline weight agrees, shading direction consistent). Manual checkbox per object (~18 entries).
- **Sepia-first read test:** each object, when chroma is removed at 100% scale, has a distinguishable silhouette of its named subject. Manual checkbox per object.
- **Hope-gold audit:** specifically for `lantern-*` objects (Ashen Isle has lit lanterns by some buildings; Fog Marsh's `lantern-broken` is intentionally extinguished), hope-gold IS permitted as the lantern flame. For all other object kinds (walls, trees, gates, fences, signs, gravestones, mushrooms, reeds, tapestry), hope-gold-family pixels < 5% of pixels. Manual checkbox per object — pass/fail recorded in the manual-verify doc.
- **Reroll budget:** 1 reroll per object (≤36 generations max for ~18 objects). Reconciled at end of phase.
- TypeScript build passes with `OBJECT_KINDS` populated.

**User guidance:**

- Discovery: Run `npx tsx tools/generate-map-objects.ts` after US-95 ships and the new Ashen Isle / Fog Marsh sample patches are saved. Submit each printed MCP invocation. Wait per object (~30-90s for 1-direction objects). Save outputs to named paths.
- Manual section: `docs/plan/tile-architecture-manual-verify.md` — § "PixelLab object generation" with per-object cohesion + sepia + hope-gold checkboxes.
- Key steps: 1) Render area sample patches via the helper. 2) Run generator. 3) Submit MCP calls. 4) Save PNGs. 5) Visual cohesion check (composite onto sample patch). 6) Wire into `OBJECT_KINDS`. 7) Run `npm run dev` and confirm in-engine.

**Design rationale:** Style-matching mode is the single technical control that turns "two AIs talking past each other" into "one art direction expressed across two pipelines." Without `background_image`, PixelLab's object generator picks a default palette that drifts from the area's terrain palette by 10-30% in chroma — readable in isolation, dissonant on top of the actual terrain. With it, the AI sees the terrain frozen and matches palette/outline weight by construction. Lantern flames being the *only* object permitted hope-gold continues `art-style.md`'s rule mechanically.

---

#### US-97 [Shipped] — Editor (`tools/editor`) — vertex-aware terrain brush + object placer

As an area author, I want the `tools/editor` map view to render the new terrain + object layers and let me paint terrain (with a cell-paint shortcut that bulk-sets all 4 of a cell's vertices, plus a finer vertex-paint mode) and place objects, so that re-authoring Ashen Isle and Fog Marsh in US-98 is a visual-editor task rather than hand-edited TypeScript literals.

**Acceptance criteria:**

- `tools/editor/src/mapRenderer.ts` is rewritten to read `area.terrain` (vertex grid) and `area.objects` (sparse list) instead of `area.map`. Terrain renders via the same Wang resolver as the game (imported from `@game/maps/wang.ts` via the existing path alias) — the editor uses the same atlas for visual fidelity.
- **Cell-paint mode (default):** clicking a cell sets all 4 of that cell's vertices to the active terrain. Drag-to-paint is supported (mousedown + mousemove). Active terrain is selected via a sidebar terrain picker showing a tile preview for each registered `TerrainId`.
- **Vertex-paint mode (toggle):** Shift-click (or a mode button) switches the cursor to vertex-precision — clicking the nearest vertex (Voronoi against the click position) sets that single vertex. The renderer shows vertex dots at integer grid positions when in this mode.
- **Object placer mode:** alt-click (or mode button) drops the active object kind at the clicked cell. Right-click on an object removes it. Active object kind is selected from a sidebar object picker showing a sprite preview per registered `ObjectKindId`. Object impassability is rendered as a thin red outline overlay in editor-only mode (toggleable, off by default).
- **Save:** an "Export TypeScript" button serializes the current `area.terrain` and `area.objects` back into the `data/areas/<id>.ts` file format (or copies the literal to clipboard for paste-in). The export preserves existing `decorations`, `props`, `npcs`, `triggers`, `dialogues`, `storyScenes`, `exits` fields untouched — only `terrain` and `objects` are regenerated. **No auto-write to disk** — the editor is read-mostly; the human pastes the export into the source file. Author-friendly diff for code review.
- **Detail panel:** clicking a cell shows the cell's 4 vertex terrains, the resolved Wang mask, the picked frame id, and any object instance at that cell with its passability. Useful for debugging Wang frame picks during US-98 re-authoring.
- **Conditional decoration / object visibility:** the editor shows conditional decorations and conditional objects by default in their "default-state" rendering (when their condition is true at game start), with a faint tint indicating they're conditional. A toggle in the sidebar flips to show their "alternate-state" rendering.
- Editor still loads and renders Ashen Isle and Fog Marsh after US-98's content lands — verifiable by running `cd tools/editor && npm run dev` and visiting `localhost:5174`. The editor's existing dialogue tree view and story flow view are unaffected.
- `tools/editor/src/main.ts` and other editor files compile under their existing `tsconfig.json`. The `@game` path alias resolves to the parent `src/`.

**User guidance:**

- Discovery: `cd tools/editor && npm run dev`, open `http://localhost:5174`.
- Manual section: `docs/plan/tile-architecture-manual-verify.md` — § "Editor smoke test" with checkboxes for terrain cell-paint, vertex-paint, object place/remove, conditional toggle, export-to-typescript round-trip.
- Key steps: 1) Open editor. 2) Switch to Ashen Isle. 3) Cell-paint a small grass→sand region. 4) Place a `tree-pine` object on the painted region. 5) Right-click to remove. 6) Switch to vertex-paint, fine-tune one vertex. 7) Click Export TypeScript, paste into a temp file, confirm structure.

**Design rationale:** The editor must ship in this phase — once US-92 lands the existing `mapRenderer.ts` breaks (it reads `area.map`). "Read-mostly with paste-back export" is the cheapest viable answer; auto-writing to disk would require a Node backend the editor doesn't have. Vertex-paint exposed as Shift-click rather than a separate tool minimises mode confusion — most authoring is cell-granular; vertex-granular is a rare power tool. Showing the resolved Wang mask in the detail panel is the single best feedback loop for spotting "this corner is wrong" during US-98.

**Consumer adaptation:** The editor is a consumer of `terrain.ts`, `objects.ts`, `wang.ts`, and `tilesets.ts` — same registries the game uses, no parallel definitions. Imports route through the `@game` path alias. Done-when (consumer adaptation): a `grep -rn "TerrainDefinition\|ObjectKindDefinition" tools/editor/src` shows imports from `@game/...`, not local redeclarations.

---

#### US-98 [Shipped] — Re-author Ashen Isle + Fog Marsh + marsh-trap terrain-flip migration

As the area author, I want both areas re-authored against the new model — vertex grids painted to express grass / sand / path / marsh-floor / water / stone correctly, objects placed for every wall / tree / gate / fence / sign / tapestry / etc. — and the marsh-trap dead-end migrated to a terrain-flip (path → water on those cells when `marsh_trapped == true`) the Wang resolver auto-blends, so that the phase ships with both areas fully on the new architecture and the new PixelLab content.

**Acceptance criteria:**

- `src/data/areas/ashen-isle.ts` is rewritten: `map: TileType[][]` removed, `terrain: TerrainId[][]` populated with the (rows+1)×(cols+1) = 39×51 vertex grid, `objects: ObjectInstance[]` populated for every previously-WALL cell + every existing `decoration` / `prop` that should now contribute collision (walls, doors, fences, signs at minimum). Existing `decorations` (paths, ground markings, scattered weeds) and `props` (purely-decorative items) retain their current shape and zero-collision semantics. NPCs (`Old Man`, `Wren`, `Driftwood`), dialogues, story scenes, exits, triggers — all unchanged in this story.
- `src/data/areas/fog-marsh.ts` is rewritten: same migration as Ashen Isle. Vertex grid is 25×31. The wooden-plank "dry path" decoration that previously overlay tan floor becomes **terrain `path` vertices** running between the two threshold zones — Wang resolver auto-blends the path edges into the surrounding marsh-floor. The marsh-trap-closure cells (today `area.map[22][13..16]` flipping FLOOR↔WALL) become **terrain vertices that flip path↔water on `marsh_trapped` flag change**:
  - Default state (`marsh_trapped == false`): vertices at row 22 cols 13-16 (and row 23 cols 13-16) are `path`.
  - Trapped state (`marsh_trapped == true`): same vertices flip to `water`.
  - The flip happens via a new `GameScene.applyConditionalTerrain()` method invoked once on `create()` AND on `onFlagChange('marsh_trapped')`. The method mutates `area.terrain` vertex values in place per a per-area `conditionalTerrain` declaration on `AreaDefinition` (new optional field — `conditionalTerrain?: { condition: string; vertices: { col, row, whenTrue: TerrainId, whenFalse: TerrainId }[] }[]`). Wang resolver re-renders the affected cells; collision unifies via terrain passability (water has `passable: false`).
- Conditional decorations on Fog Marsh that today represent the closure visually (PATH variants vs EDGE deep-water variants at row 22 cols 13-16) are **removed** — the terrain-flip + Wang re-blend renders the closure visual correctly without the parallel decoration system. The escape-band triggers at row 21 cols 13-16 and the threshold trigger at (col 14, row 5) are unchanged in mechanic, only the underlying collision/visual-flip mechanism changes.
- `tiny-town` and `tiny-dungeon` `WangTilesetDefinition` entries from US-93 are **removed from `TILESETS`** — both areas now reference the PixelLab-generated tilesets from US-95. `assets/tilesets/tiny-town/` and `assets/tilesets/tiny-dungeon/` directories are **deleted** along with their atlas PNGs and metadata. `assets/tilesets/ATTRIBUTION.md`'s Kenney sections are removed; only PixelLab attribution remains.
- The `@game/maps/tilesets.ts` module is renamed to `@game/maps/wangTilesets.ts` (or restructured) so the registered tilesets are PixelLab-only. `WangTilesetDefinition` is the only shape; the degenerate-mode shim and the one-time-mask-warning Set from US-93 are **removed** — every PixelLab tileset has all 16 mask entries populated, so the warning path becomes dead code.
- All references to the removed Kenney atlases / tilesets in `src/`, `tools/`, `docs/` are removed or updated. `grep -rn "tiny-town\|tiny-dungeon" src tools docs` returns zero hits except in (a) git history references and (b) phase retrospective archive files.
- **AGENTS.md update (Phase Reconciliation Gate territory but called out for traceability):** the file ownership table, depth map (Objects at 2.5), and behavior rules for tile rendering are updated to describe the shipped state at end of phase.
- **Per-area variant baseline check (Rule 4a):** verify Ashen Isle and Fog Marsh independently — every shipped scene, dialogue, NPC interaction, trigger, and exit works the same as pre-phase. Manual-verify checklist enumerates Ashen Isle (Old Man dialogue, Wren warming, Driftwood refusal, story-scene trigger, north exit gating, homecoming reflection, ember overlay, alpha-gated decorations) and Fog Marsh (Marsh Hermit dialogue, threshold trigger flipping closure, escape-attempt thoughts, Keeper rescue chain, story-scene trigger, fog-to-ashen exit gating) as separate per-feature checkboxes.
- **Save-state compatibility:** existing localStorage saves (`emberpath_save` v1) survive the phase. Saved area position is pixel coordinates not tile indices, so terrain/object migration doesn't invalidate them. Smoke test: pre-phase save → load post-phase → player resumes at same world position with no error. Manual checkbox in verify doc.
- **Reset-progress smoke test:** Reset Progress restores marsh-trap default state (path), clears warming flags, restores ember overlay state. Manual checkbox.
- TypeScript build passes (`npx tsc --noEmit && npm run build`).
- `npm run dev` boots; both areas play through every existing flow (Ashen Isle dialogues + Wren warming + Old Man perseverance + Driftwood refusal + village-centre reflection + north exit; Fog Marsh threshold trigger + escape attempts + Keeper rescue + story scenes + fog-to-ashen return) without regression. Manual smoke test recorded in verify doc per Learning EP-03.
- **In-engine smoke test at desktop AND mobile viewports** (Learning EP-03): both areas verified at desktop ~1280×720 (zoom ~4×) AND mobile DevTools 360×640 (zoom ~1.1×). Specifically the Wang transitions on terrain edges, the object rendering depth ordering (objects above terrain, below player), and the marsh-trap closure visual all read correctly at both viewports.

**User guidance:**

- Discovery: After US-95 + US-96 + US-97 ship, open the editor, repaint both areas with the new terrains, place all objects, export TypeScript, paste into the area files.
- Manual section: `docs/plan/tile-architecture-manual-verify.md` — § "Final re-author smoke test" — per-area per-feature checkboxes covering every shipped flow.
- Key steps: 1) Open `tools/editor`. 2) For each area: paint terrain layers (grass / sand / path / water / marsh-floor / stone), place all objects (walls, doors, fences, trees, signs, tapestry, etc.), declare conditional terrain for marsh-trap closure. 3) Export and paste. 4) Run `npm run dev`. 5) Walk every existing flow at both desktop and mobile viewports.

**Design rationale:** Terrain-flip beats object-flip for the marsh-trap closure because Wang re-blends the path-to-water edges automatically — the player sees a visibly-flooding closure (with smooth shore transitions) rather than a hard wall of water-objects appearing. The fact that `area.terrain` mutation triggers Wang re-resolution is the architectural payoff for choosing vertex-based terrain in US-92. Removing the Kenney atlases entirely (rather than keeping them around as "fallbacks") enforces "no side-by-side" — one architecture, one content source, no parallel solution.

---

## Done-when (observable)

### US-92 — Vertex terrain + object data model

- [ ] `src/maps/terrain.ts` exists and exports `TerrainId`, `TerrainDefinition`, `TERRAINS`, `hasTerrain`; registry has at least `grass`, `sand`, `path`, `marsh-floor`, `water`, `stone` with correct `passable` flags (water: false; others: true) [US-92]
- [ ] `src/maps/objects.ts` exists and exports `ObjectKindId`, `ObjectKindDefinition`, `OBJECT_KINDS`, `hasObjectKind`; registry includes initial entries for every wall / door / tree / sign / flower / bush / gate kind referenced by the two areas [US-92]
- [ ] `data/areas/types.ts` `AreaDefinition` has `terrain: TerrainId[][]` (vertex grid, dimensions `(rows+1) × (cols+1)`), `objects: ObjectInstance[]`, and `conditionalTerrain?: ...[]`; `map: TileType[][]` field is removed (file inspection) [US-92]
- [ ] `TileType` enum is removed from `maps/constants.ts`; `grep -rn "TileType" src tools` returns zero hits [US-92]
- [ ] `decorations: DecorationDefinition[]` and `props: PropDefinition[]` retain shape and zero-collision contract (file inspection) [US-92]
- [ ] `ExitDefinition[]` is unchanged; renderer paints exit zones via a translucent overlay at depth 0.5 between terrain and objects, color sourced from `STYLE_PALETTE.hopeGoldLight` at alpha 0.25 (NOT a hardcoded hex literal) (file inspection — grep confirms `STYLE_PALETTE.hopeGoldLight` reference at the overlay creation site + manual screenshot at exit zones) [US-92]
- [ ] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-92]
- [ ] Consumer adaptation: `terrain` consumed by US-93 resolver and US-94 collision; `objects` consumed by US-94 renderer + collision and US-97 editor; no consumer hardcodes terrain or object ids beyond registry lookup (`grep -rn "'grass'\|'sand'\|'water'" src tools` shows registry usage only, not literal-string control flow outside the registry definition itself) [US-92]
- [ ] AGENTS.md reflects new modules `maps/terrain.ts`, `maps/objects.ts` and updated `data/areas/types.ts` ownership [US-92]

### US-93 — Wang resolver + degenerate-mode fallback

- [ ] `src/maps/wang.ts` exists and exports `resolveWangFrame(tilesetId, terrainIds: [TL, TR, BR, BL])` with JSDoc pinning the clockwise-from-top-left corner convention [US-93]
- [ ] `WangTilesetDefinition` in `src/maps/tilesets.ts` has `cornerMaskTable: Record<string, string[]>` keyed `'0000'`..`'1111'` and `fallbackFrames: string[]` [US-93]
- [ ] `tiny-town` and `tiny-dungeon` are registered as degenerate Wang tilesets — `cornerMaskTable['0000']` lists existing FLOOR frames, `cornerMaskTable['1111']` lists existing WALL frames, all 14 other entries omitted; `fallbackFrames` lists FLOOR frames; module JSDoc notes "degenerate Wang — no transition tiles; replaced by US-95" [US-93]
- [ ] Resolver: present-mask path hash-picks within the entry's frame array via the existing FNV-1a-style hash; absent-mask path falls back to `fallbackFrames` AND logs a one-time-per-mask `console.warn(tilesetId, mask, expected: secondaryTerrain transition)` (file inspection + smoke run shows exactly one warn per absent mask seen, not per frame) [US-93]
- [ ] Corner-clockwise convention asserted: synthetic `[grass, sand, sand, grass]` corners produce mask `'0110'` (TR + BR are secondary), verified by inline test or runtime smoke check on `npm run dev` boot [US-93]
- [ ] `resolveFrame()` (legacy flat-bucket resolver) is removed; `grep -rn "resolveFrame" src tools` returns zero hits [US-93]
- [ ] `src/maps/atlasPreview.ts` (or `tools/atlas-preview.py` extension) generates a labelled-atlas PNG for any `WangTilesetDefinition`: 4×4 grid showing each `'0000'`..`'1111'` mask with picked frame and mask label overlaid in umber text [US-93]
- [ ] TypeScript build passes [US-93]
- [ ] AGENTS.md reflects new modules `maps/wang.ts`, `maps/atlasPreview.ts` and updated `maps/tilesets.ts` ownership [US-93]

### US-94 — Object layer rendering + collision unification

- [ ] `GameScene.renderObjects()` exists, called once after `renderTerrain()` and `renderDecorations()`, places each `ObjectInstance` as `Phaser.GameObjects.Image` at depth 2.5 (file inspection) [US-94]
- [ ] AGENTS.md depth map updated: row "Objects" at depth 2.5 between Decorations (2) and Props (3) [US-94]
- [ ] `collidesWithWall` consults BOTH terrain (4-vertex AND-impassable rule) and object (cell `Map<string, boolean>` lookup) passability; out-of-bounds blocks (file inspection + collision smoke at terrain edges + at object cells) [US-94]
- [ ] `GameScene.buildObjectCollisionMap()` is called once in `create()` AND on `onFlagChange` for any flag referenced by an object's `condition` (file inspection + smoke: trigger marsh_trapped flag, confirm object collision rebuilt on the same tick) [US-94]
- [ ] `applyMarshTrappedState` is deleted; `grep -rn "applyMarshTrappedState" src` returns zero hits [US-94]
- [ ] `ObjectInstance.condition?` evaluated once at render AND on relevant `onFlagChange` only — never per-frame; subscriber unsubscribes collected and invoked in `cleanupResize` (file inspection + manual: enter Fog Marsh, trigger threshold, confirm conditional-object visibility flips on flag change) [US-94]
- [ ] Object `Phaser.GameObjects.Image` references tracked as instance fields, reset to `[]` at top of `renderObjects()`, `uiCam.ignore`-ed (file inspection — Learning EP-02 hygiene) [US-94]
- [ ] `decorations` and `props` rendering identical to pre-phase (zero collision contribution, depth 2 and 3 respectively) [US-94]
- [ ] **In-engine architecture-only baseline:** `npm run dev` shows Ashen Isle and Fog Marsh visually identical to pre-phase at desktop ~1280×720 viewport (zoom ~4×) AND mobile DevTools 360×640 viewport (zoom ~1.1×); side-by-side screenshots in manual-verify doc [US-94, Learning EP-03]
- [ ] Marsh-trap dead-end mechanic still works (threshold trigger flips conditional-object impassability via the new buildObjectCollisionMap path; closure restored on Reset Progress) — manual smoke test [US-94]
- [ ] AGENTS.md File ownership and Behavior rules sections updated for the new collision-unification rule and the deleted `applyMarshTrappedState` [US-94]

### US-95 — PixelLab Wang terrain tilesets

- [ ] `tools/generate-tilesets.ts` exists with `TILESET_PLAN` covering 5 entries: 2 Ashen chains (grass→sand, sand→path) + 3 Fog Marsh chains (floor→path, floor→water, floor→stone); chained via `lower_base_tile_id` within each area [US-95]
- [ ] Every prompt is composed via `composeArtPrompt(subject, mood)` from `art/styleGuide.ts` — `STYLE_VIBE_PROMPT` substring present in each printed prompt (manual + grep on captured invocations) [US-95]
- [ ] Standardised PixelLab settings on every call: `view: "high top-down"`, `outline: "selective outline"`, `shading: "basic shading"`, `detail: "medium detail"`, `tile_size: { width: 16, height: 16 }`; hope-gold negative-prompted (file inspection of `TILESET_PLAN`) [US-95]
- [ ] Running `npx tsx tools/generate-tilesets.ts` exits 0 and prints exactly 5 invocation blocks [US-95]
- [ ] 5 tileset PNG + JSON pairs saved at named paths under `assets/tilesets/<area-or-pair-name>/`; each `tilemap.json` records `{ name, source: 'PixelLab', generatedAt, tilesetId, lowerTerrain, upperTerrain, transitionDescription, transitionSize, prompt, mcpSettings }` [US-95]
- [ ] `assets/tilesets/ATTRIBUTION.md` `## PixelLab tilesets` section records each generated tileset with date, prompt, and PixelLab tileset id [US-95]
- [ ] Labelled-atlas preview PNG generated via `atlasPreview.ts` (US-93) for each tileset; saved to `/tmp/<tileset-name>-preview.png` (NOT committed); each preview opened and inspected before wiring [US-95]
- [ ] **Sepia-first read test:** chroma-removed view at 50% scale shows distinguishable terrain identity for each of 5 tilesets — manual checkbox per tileset, one-sentence luminance note per [US-95, Learning EP-03]
- [ ] **Hope-gold absence audit:** for each terrain tileset, hope-gold-family pixels < 3% — manual checkbox per tileset, recorded in verify doc [US-95]
- [ ] **Wang corner correctness (Rule 4a variant baseline + Atlas frame-pick verification rule):** for each tileset's labelled preview, manual checkbox per mask × per tileset (16 × 5 = 80 checkboxes); mask `'0001'` shows secondary terrain in bottom-left corner only (clockwise convention from US-93) [US-95, Learning EP-03]
- [ ] Reroll budget: ≤ 1 reroll per tileset (10 generations max); if exceeded, paragraph note in verify doc explaining what changed in the prompt [US-95]
- [ ] **Error-path: PixelLab MCP failure.** If a `create_topdown_tileset` call returns failed status (HTTP error, timeout, malformed metadata, generation `failed` from `get_topdown_tileset`), the operator records the failure in the verify doc with the failure mode and reruns that single entry; the generator script does NOT attempt automatic retry (operator-controlled rerolls only) [US-95]
- [ ] **Error-path: missing-tileset asset at runtime.** If a registered Wang tileset's atlas PNG is absent at boot (deleted file, wrong path), `GameScene.preload` logs descriptive error naming `(tilesetId, expected path)` and `renderTerrain` falls back to flat-color tiles using `area.visual.floorColor / wallColor` so the scene still loads — same pattern as the existing fallback for unknown tileset id (file inspection + manual smoke: rename one tileset directory, boot, confirm fallback renders) [US-95]
- [ ] Cost reconciliation table at end of phase records actual generations spent for tilesets (US-95) and objects (US-96) [US-95, US-96]
- [ ] TypeScript build passes with new tilesets registered in `TILESETS` [US-95]
- [ ] **In-engine smoke at both viewports (Learning EP-03):** new tilesets render correctly at desktop AND mobile viewports; Wang transitions visible at terrain edges [US-95]

### US-96 — PixelLab style-matched map objects

- [ ] `tools/generate-map-objects.ts` exists with `OBJECT_PLAN` covering at least the named ~18 objects across both areas; each has `kindId`, `areaContext`, `subject`, `mood?`, `footprint?`, `passable` [US-96]
- [ ] Pre-generation step: 96×96 area sample patches rendered via helper to `/tmp/<area>-sample.png`; each MCP call references its area's sample via `background_image: { type: 'path', path: '/tmp/<area>-sample.png' }` (file inspection of generated invocations) [US-96]
- [ ] Every prompt composed via `composeArtPrompt(subject, mood)` — `STYLE_VIBE_PROMPT` substring present in each [US-96]
- [ ] Standardised PixelLab settings: `view: "high top-down"`, `outline: "selective outline"`, `shading: "medium shading"`, `detail: "medium detail"`, `width`/`height` 32 (or 48 for objects with footprint > 1×1) [US-96]
- [ ] Running `npx tsx tools/generate-map-objects.ts` exits 0 and prints one invocation block per object in `OBJECT_PLAN` [US-96]
- [ ] Each object PNG saved to `assets/objects/<area>/<kindId>.png`; `OBJECT_KINDS` registry entry's `atlasKey` and `frame` updated to point to the new asset [US-96]
- [ ] `assets/objects/ATTRIBUTION.md` records each object with date, prompt, PixelLab object id, and `background_image` used [US-96]
- [ ] **Style-matched cohesion test:** for each object, composited onto its area sample patch at 1:1 scale and visually inspected — palette / outline / shading reads as belonging to the terrain. Manual checkbox per object (~18 entries) [US-96, Learning EP-03]
- [ ] **Sepia-first silhouette test:** chroma-removed each object at 100% scale; named subject's silhouette distinguishable. Manual checkbox per object [US-96]
- [ ] **Hope-gold audit:** lantern-* objects MAY include hope-gold flame; all other objects have hope-gold-family pixels < 5%. Manual checkbox per object — pass/fail per kind [US-96]
- [ ] Reroll budget: ≤ 1 reroll per object (≤ 36 generations max); reconciled in cost table [US-96]
- [ ] **Error-path: PixelLab MCP failure.** If a `create_map_object` call returns failed status, operator records failure in verify doc and reruns that single entry; generator script does NOT auto-retry [US-96]
- [ ] **Error-path: missing-object asset at runtime.** If an `OBJECT_KINDS` entry's `atlasKey` fails to load at boot, `GameScene.preload` logs warning naming `(kindId, expected path)`, `renderObjects` skips rendering the missing object **but the object still contributes to collision** (per its registry `passable` flag) — keeps the area playable and prevents the player from walking through what should be a wall when an asset hiccups (file inspection + manual smoke: rename one object PNG, boot, confirm warn + invisible-but-blocking object at the cell) [US-96]
- [ ] TypeScript build passes with `OBJECT_KINDS` populated [US-96]
- [ ] **In-engine smoke at both viewports:** objects render at correct depth (above terrain, below entities) without z-fighting; passable objects walked through; impassable objects block movement [US-96, Learning EP-03]

### US-97 — Editor (`tools/editor`)

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

### US-98 — Re-author + marsh-trap migration

- [ ] `src/data/areas/ashen-isle.ts` rewritten: `map` removed, `terrain` populated as 39×51 vertex grid, `objects` populated for every previously-WALL cell + every wall/door/fence/sign/tapestry decoration that should now contribute collision; existing `decorations`, `props`, `npcs`, `triggers`, `dialogues`, `storyScenes`, `exits` unchanged [US-98]
- [ ] `src/data/areas/fog-marsh.ts` rewritten: same migration; vertex grid 25×31; wooden-plank "dry path" becomes `path` terrain vertices; closure cells become terrain vertices controlled by `conditionalTerrain` [US-98]
- [ ] `AreaDefinition.conditionalTerrain` field added to types in US-92 is exercised: Fog Marsh declares the marsh-trap closure vertices with `condition: 'marsh_trapped == true'`, `whenTrue: 'water'`, `whenFalse: 'path'` for vertices at row 22 cols 13-16 and row 23 cols 13-16 [US-98]
- [ ] `GameScene.applyConditionalTerrain()` mutates `area.terrain` vertex values per `conditionalTerrain` declaration; called once on `create()` AND on `onFlagChange` for any referenced flag; Wang resolver re-renders affected cells; collision unifies via terrain passability (water `passable: false`) [US-98]
- [ ] Conditional decorations representing the closure (PATH-vs-EDGE variants on Fog Marsh) are removed — terrain-flip + Wang re-blend renders the closure correctly without parallel decoration variants [US-98]
- [ ] `tiny-town` and `tiny-dungeon` `WangTilesetDefinition` entries removed from `TILESETS`; `assets/tilesets/tiny-town/` and `assets/tilesets/tiny-dungeon/` directories deleted; Kenney attribution sections removed from `ATTRIBUTION.md` [US-98]
- [ ] Degenerate-mode shim and one-time-mask warning Set from US-93 removed (every PixelLab tileset has all 16 mask entries, so the warning path becomes dead code) [US-98]
- [ ] `grep -rn "tiny-town\|tiny-dungeon" src tools docs` returns zero hits except phase retrospective archive files (file inspection) [US-98]
- [ ] AGENTS.md updated: file ownership for new modules, depth map (Objects at 2.5), behavior rules for tile rendering rewritten to describe the shipped state [US-98]
- [ ] **Per-area variant baseline check (Rule 4a):** Ashen Isle full feature checklist — Old Man dialogue, Wren warming, Driftwood refusal, story-scene trigger, north exit gating, homecoming reflection, ember overlay, alpha-gated decorations — each as separate checkbox in verify doc [US-98]
- [ ] **Per-area variant baseline check (Rule 4a):** Fog Marsh full feature checklist — Marsh Hermit dialogue, threshold trigger flipping closure, escape-attempt thoughts, Keeper rescue chain, story-scene trigger, fog-to-ashen exit gating, marsh-vision story scene — each as separate checkbox in verify doc [US-98]
- [ ] **Save-state compatibility:** pre-phase save loads post-phase without error; player resumes at same world position (manual smoke) [US-98]
- [ ] **Reset Progress smoke:** marsh-trap closure restored, warming flags cleared, ember overlay restored — manual checkbox [US-98]
- [ ] TypeScript build passes (`npx tsc --noEmit && npm run build`) [US-98]
- [ ] **In-engine smoke at both viewports (Learning EP-03):** desktop ~1280×720 (zoom ~4×) AND mobile DevTools 360×640 (zoom ~1.1×) — both areas play through every existing flow; Wang transitions on terrain edges, object depth ordering, marsh-trap closure visual all read correctly [US-98]
- [ ] Cost reconciliation: `## Cost reconciliation` section in manual-verify doc records actual PixelLab generations spent (tilesets US-95 + objects US-96 + rerolls) [US-98]
- [ ] Manual-verify doc `docs/plan/tile-architecture-manual-verify.md` exists with all per-story sections [US-98]

### Phase-level / structural

- [ ] `AGENTS.md` reflects: new `maps/terrain.ts`, `maps/objects.ts`, `maps/wang.ts`, `maps/atlasPreview.ts` modules in File ownership; new `Objects` row at depth 2.5 in Depth map; rewritten Behavior rules for tile rendering, collision unification, conditional terrain flip; removal of `TileType`, `applyMarshTrappedState`, Kenney atlas references, legacy `resolveFrame` [phase]
- [ ] `npx tsc --noEmit && npm run build` passes [phase]
- [ ] No regression in any of the 22 prior shipped phases' features verified by per-area variant baseline checks (US-98 done-when above) [phase]

### Auto-added safety criteria

- [ ] Conditional terrain / object / decoration conditions parse through existing `evaluateCondition` parser — no new condition syntax, no `eval` / `Function` constructor introduced [phase]
- [ ] Object kind ids, terrain ids, atlas keys, and frame strings come from registries (`OBJECT_KINDS`, `TERRAINS`, `TILESETS`), never from user-provided strings — no path-traversal risk surface [phase]
- [ ] Editor "Export TypeScript" copies code to clipboard or shows in a modal; **no auto-write to disk**, **no eval**, no execution of pasted code at editor runtime — paste happens manually in the source tree [phase]
- [ ] PixelLab MCP invocations contain only hardcoded constants from `TILESET_PLAN` / `OBJECT_PLAN` and registry-resolved values — no user-input pathway feeds the prompts [phase]
- [ ] Generated PNG paths in `assets/tilesets/<id>/` and `assets/objects/<area>/<kindId>.png` are derived from registry ids (string-literal union), never from user input — `grep` confirms path construction uses registry values only [phase]

### Async-cleanup safety

- [ ] Every `onFlagChange` subscriber added by this phase (object-collision-map rebuild, conditional-terrain re-evaluation, conditional-object visibility) collects an unsubscribe function and invokes it in `cleanupResize` / scene-shutdown [phase]
- [ ] Object `Phaser.GameObjects.Image` references reset at top of `renderObjects()` AND destroyed on `scene.events.shutdown` (Learning EP-02) [phase]

### Class baseline check (new ObjectInstances join the existing world-overlay class)

- [ ] Every PixelLab object kind appears in the F3 debug overlay's collision-cell rendering (impassable objects show as filled red cells; passable objects unmarked) [class:US-94, class:US-96]
- [ ] Every PixelLab object kind is `uiCam.ignore`-ed (renders main-camera only) [class:US-94, class:US-96]
- [ ] Every PixelLab object kind cleans up on `scene.shutdown` per existing GameScene cleanup lifecycle [class:US-94, class:US-96]

### Variant baseline check (resolver and renderer apply across both areas)

- [ ] Wang resolver verified on Ashen Isle (grass / sand / path terrains + transitions) — explicit per-terrain transition checkbox in verify doc [US-95, Rule 4a]
- [ ] Wang resolver verified on Fog Marsh (marsh-floor / path / water / stone terrains + transitions) — explicit per-terrain transition checkbox in verify doc [US-95, Rule 4a]
- [ ] Object rendering verified on Ashen Isle (every kind: tree, wall, door, gate, fence, sign, tapestry, bush, flower) — per-kind checkbox [US-96, Rule 4a]
- [ ] Object rendering verified on Fog Marsh (every kind: dead-tree, marsh-stone, gravestone, mushroom, dry-reed, wall-tomb, door-tomb, lantern-broken) — per-kind checkbox [US-96, Rule 4a]
- [ ] Conditional terrain flip verified at marsh-trap closure (path → water on flag flip; reverts on Reset Progress) — explicit checkbox [US-98]

## Cost mapping (PixelLab)

| Source | Calls | Generations (incl. 1 reroll budget) |
|---|---|---|
| US-95 — terrain tilesets (Ashen × 2 + Fog × 3 = 5 pairs) | 5 | up to 10 |
| US-96 — map objects (~18 unique kinds) | 18 | up to 36 |
| **Total this phase** | **23** | **up to 46** |

PixelLab Basic tier: ~1500 generations remaining. This phase spends up to 46, leaving > 1450. Comfortably within budget.

## Golden principles (phase-relevant)

From `AGENTS.md` and `docs/plan/LEARNINGS.md`:

- **Loop-invariant operations and dead guards (Learning EP-01):** terrain Wang resolution runs once per cell at area load (cached via Phaser tile sprites), conditional terrain / object / decoration evaluation runs once at create + only on flag-change events (subscriber-based), per-frame collision is O(1) via the runtime cell-keyed `Map<string, boolean>` not per-object iteration.
- **Phaser scene-restart hygiene (Learning EP-02):** every new GameObject reference (object sprites, exit-tint overlays, conditional terrain re-render artifacts) reset at top of its create method; `scene.events.shutdown` handler clears all subscribers and destroys references.
- **Visual-pick-without-verification (Learning EP-03):** every PixelLab generation gated behind labelled-atlas preview + sepia-first + hope-gold-absence + Wang-corner-correctness checks; in-engine smoke at desktop AND mobile viewports for both areas after content lands.
- **Pattern-reuse context check (Learning EP-04):** GameScene runs on the main camera; the Wang resolver and object renderer target the main camera; UI camera is unaffected — pattern reuse from `dialogue.ts` (UI camera) is explicitly avoided in this phase.
- **Show, don't preach** — the marsh-trap terrain-flip is mechanical truth (the player sees the path become water rather than reading "you cannot pass" text); no preaching, no error chime.
- **Free gift** — content stays freely-moveable: terrain and objects are author-controlled data, not procedural; the editor exists to make this visible.
- **No villains** — no design choice in this phase frames terrain or objects as adversaries; impassable objects (walls, gravestones) are environmental, not malicious.

## AGENTS.md sections affected

- **Directory layout** — add `src/maps/terrain.ts`, `src/maps/objects.ts`, `src/maps/wang.ts`, `src/maps/atlasPreview.ts`; add `assets/tilesets/<pixellab-tilesets>/`, `assets/objects/<area>/<kindId>.png`; remove `assets/tilesets/tiny-town/`, `assets/tilesets/tiny-dungeon/`; add `tools/generate-tilesets.ts`, `tools/generate-map-objects.ts`.
- **File ownership** — add rows for the four new `maps/` modules, `tools/generate-tilesets.ts`, `tools/generate-map-objects.ts`; rewrite `data/areas/types.ts` row (terrain + objects + conditionalTerrain fields); rewrite `scenes/GameScene.ts` row (renderObjects, buildObjectCollisionMap, applyConditionalTerrain — replacing applyMarshTrappedState); rewrite `systems/collision.ts` row (terrain-passability + object-passability unification); rewrite `tools/editor/src/mapRenderer.ts` row (vertex paint + object placer + export-typescript).
- **Depth map** — add Objects row at depth 2.5 between Decorations (2) and Props (3); add Exit-tint overlay row at depth 0.5 between Tiles (0) and Decorations (2).
- **Behavior rules** — rewrite "Tile rendering (sprite-based)" to describe Wang resolution; add new "Object layer rendering and collision unification" rule; rewrite "Conditional exits and decorations" to add conditional terrain (path↔water flip) and conditional object passability; remove "TileType" mentions; remove `applyMarshTrappedState` references.

## User documentation impact

- New file: `docs/plan/tile-architecture-manual-verify.md` — sections per story (US-92..US-98) with per-checkbox verification, the architecture-only baseline pause point screenshots (US-94), per-mask Wang correctness (US-95, 80 entries), per-object cohesion + sepia + hope-gold (US-96), editor controls (US-97), per-area per-feature regression checks (US-98), save-state compatibility, Reset Progress, cost reconciliation table.
- No master-PRD update needed (Implementation Roadmap doesn't list `tile-architecture` because it's foundation work, not a journey-stage phase; this is acceptable per spec-author convention — foundation phases live in PRD index but not the master roadmap).
- PRD index (`docs/product/PRD.md`) updated by spec-author auto-proceed step with new row: `| tile-architecture | Draft | US-92, US-93, US-94, US-95, US-96, US-97, US-98 | [phases/tile-architecture.md](phases/tile-architecture.md) |`.
- "Next up" paragraph in PRD updates to describe `tile-architecture` and frames `briar-wilds` as the next journey-stage phase after this foundation work ships.
