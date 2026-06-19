---
status: active
type: feat
issue: 157
created: 2026-06-19
area: briar
gate: GATE-1 (plan + Director's Brief) — visual change, GATE-2 (MP4) applies before merge
---

# Briar Wilds — organic curving path (FB-17 pt3 + pt4 eyes)

## Problem frame

Briar's walkable route is a **rigid axis-aligned serpentine**: the floor is carved as
orthogonal rectangles (`SEGMENTS` in `src/data/areas/briar-wilds.ts`), and the thorn
wall is a clean rectangular bramble edge in the 8-neighbourhood of those rectangles.
The result reads like a maze drawn on graph paper — hard 90° corners, a straight rigid
treeline. Jaco (FB-17 pt3, issue #157): replace it with a **round, windy, organic path —
no 90° turns**, the trail "path + grass" feel of a real forest track.

Folded in as a small unit: **FB-17 pt4** — the `forestEyes.ts` beady-red blinkers
currently ring the *player* (an annulus around screen-centre). Bias them OUT of the
player-ring and INTO the dark tree clusters so they read as "hidden among the trees,"
not orbiting Pip.

## Scope

**In scope**
- Re-shape the Briar route so it reads organic/curved with no hard 90° turn the player
  walks through (chosen direction per the Director's Brief / GATE-1).
- Re-anchor the FB-2 breadcrumb light-anchors + broken-lanterns + the west sign to the
  new route's bends (they currently sit ON the old path turns and MUST move with it).
- Keep the BFS-validated reachability invariant: spawn → both exits → every drain/quiet
  zone / inscribed stone / trigger / anchor reachable; collision-on-floor asserts hold.
  The validator `autonomy/briar-layout.cjs` is the single source of truth and must be
  updated in lockstep with the carve (the file comment says the data "mirrors VERBATIM"
  the validator — that contract stays).
- pt4: anchor forest-eye pairs to tree-cluster world positions instead of the
  screen-centre ring (`src/systems/forestEyes.ts`, + minimal `GameScene.ts` wiring to
  pass the cluster anchors / area object list).

**Out of scope (non-goals)**
- No change to the Quill hand-off, the-word mechanic, drain/quiet narration, inscribed
  stone, or the heart-bridge exit gating — only their *positions* move if the route moves.
- No new story/content text.
- No re-theme of the thorn/bramble sprites or the tileset palette.
- Drain/quiet/trigger zones keep their gameplay meaning; if a re-route moves a band, the
  zone moves WITH its band (kept co-located), not relocated arbitrarily.

## Direction decision (GATE-1 — see Director's Brief, mirrored to #157)

The square-tile grid cannot produce literal round curves from axis-aligned rectangle
carves — square cells yield orthogonal edges. Three ways to deliver the *organic read*,
in ascending effort/risk:

- **(a) Soften in place (RECOMMENDED).** Keep the serpentine topology; widen the corridor
  ~1 cell, replace the rectangular barrier edge with an **irregular jittered thorn line**
  (per-cell in/out via cluster logic, not a clean rect), and **chamfer every corner**
  (carve diagonal cell-steps at each bend) so no hard 90° internal corner is walked.
  Re-anchor the 7 light-anchors + lanterns to the new bend midpoints. Zero new art,
  smallest BFS delta, fastest. Trade-off: the trail is still thorn-floor framed by
  thorns — no *visibly distinct* dirt path.
- **(b) Re-route curvier.** Redraw `SEGMENTS` as more, shorter diagonal-stepped runs
  (staircase-approximated S-curves) — a genuinely twistier walk. Every lantern/anchor
  re-placed; full BFS re-validation. Medium effort/risk. Still no distinct path tile.
- **(c) Real trodden trail (Jaco's literal "path + grass tiles").** Introduce a visible
  worn-path treatment winding through grass — most storybook, most faithful to the
  wording. Biggest job: Briar has ONE floor tile today, so this needs a new path-tile
  art treatment (likely a PixelLab tile) + renderer/tileset touch, on top of all the
  re-routing. Highest effort/risk; a real-spend / art-direction call.

**CHOSEN: (c) — real trodden trail (Jaco #1060, 2026-06-19: "proceed with option C").**
GATE-1 direction approved. Spend (one PixelLab tileset gen) is within the existing sub
and explicitly authorized by his option-C choice.

### Option-C approach (de-risked: paint, don't re-carve)
The terrain system (`src/maps/terrain.ts` + `src/maps/tilesets.ts`) is a **vertex grid**
where each Wang tileset blends ONE terrain *pair* and the resolver picks the tileset from
a cell's 4 vertices (proven by Ashen mixing grass/sand/path). So option C does NOT require
re-carving the serpentine walls. Instead:

- **Keep the existing walkable corridor + thorn-object walls** → reachability/BFS provably
  unchanged (no wall moves, no collision change — `briar-path` is passable like `briar-floor`).
- **Paint a winding trodden-path terrain down the MIDDLE of the corridor**, with
  briar-floor "grass" shoulders. The painted trail meanders diagonally across vertices, so
  it reads as a round, windy, no-90° path — exactly the "path + grass" Jaco asked for —
  carried by the TILES, not the carve.
- **Painting constraint:** keep ≥1 briar-floor vertex buffer between any path vertex and
  any thorn vertex, so no single cell holds 3 terrains (the resolver blends pairs only).

## Implementation Units

### U1 — Generate the briar path Wang tileset (PixelLab)
- **Goal:** a `briar-floor → briar-path` top-down Wang tileset whose ground (lower) matches
  the existing briar floor for a seamless blend, upper = a worn trodden trail.
- **Tooling:** `mcp__pixellab__create_topdown_tileset` (cheap, ~1 gen, within the sub).
  - lower_description: the EXACT existing briar floor desc — "softened grey-green briar
    floor, mist-cool oppressive ground, kid-safe storybook sepia palette with mossy-green
    hint, no neon, no gold accents, no horror imagery".
  - upper_description: a worn trodden dirt/earth trail — "bare trodden earth path, warm
    tan-brown packed dirt with faint sepia grain, kid-safe storybook, soft grass border,
    no neon, no gold accents". (Tan-brown so it reads as a walked trail vs the grey-green
    ground; gold stays sacred/reserved.)
- **Files:** `assets/tilesets/briar-wilds-floor-path/tilemap.{png,json}` (committed),
  `assets/tilesets/ATTRIBUTION.md` (catalogue the gen).
- **Verification:** atlas preview (`src/maps/atlasPreview.ts`) renders all 16 masks; the
  lower edge visually matches the existing briar ground (seamless where path meets grass).

### U2 — Register the terrain + tileset
- **Goal:** wire `briar-path` terrain + the new tileset so the resolver + loader pick it up.
- **Files:** `src/maps/terrain.ts` (add `'briar-path'` to the `TerrainId` union + a
  `TERRAINS` entry, passable: true, wangTilesetId 'briar-wilds-floor-path'),
  `src/maps/tilesets.ts` (add `'briar-wilds-floor-path'` entry: primary `briar-floor`,
  secondary `briar-path`, standard `pixellabCornerMaskTable()`).
- **Patterns to follow:** the existing `briar-wilds-floor-thorn` tileset entry +
  `briar-floor` terrain entry (verbatim structure). Loader auto-picks it up (GameScene
  iterates `TILESETS` and loads `tilesets/<id>/tilemap.png`).
- **Verification:** `npm run build` clean; `hasTileset('briar-wilds-floor-path')` true;
  no resolver fallback warnings for briar-floor↔briar-path cells.

### U3 — Paint the winding trodden trail on Briar's vertex grid
- **Goal:** a curving path terrain winds the length of the corridor, briar-floor shoulders,
  reading as a round organic forest track.
- **Files:** `src/data/areas/briar-wilds.ts` (replace the uniform
  `deriveTerrainFromTileMap(briarTileMap, 'briar-floor')` with a painted grid: base
  briar-floor + a `briar-path` trail painted along the serpentine's centre-line),
  `autonomy/briar-layout.cjs` (assert the path stays passable + the ≥1-buffer-to-thorn
  invariant; BFS floor count unchanged).
- **Approach:** trace a centre-line through the carved corridor's bends (a poly-line of
  the corridor midpoints), paint `briar-path` vertices within ~1 cell of that line where
  the cell is interior floor (never within 1 vertex of a thorn vertex). The line uses the
  bend midpoints so the trail naturally curves through each turn.
- **Verification:** `briar-layout.cjs` passes (reachability + no path-touches-thorn cell);
  testbench `entering-briar` shows a continuous winding path Pip can walk end to end; no
  3-terrain cells (no resolver fallback warning).

### U4 — Re-anchor breadcrumb lanterns, light-anchors, sign, beacon to the trail
- **Goal:** the warm-light breadcrumb sits ON the painted trail's bends (clarity, North
  Star #1) — they currently sit on the old corridor centre, which the trail now follows,
  so most stay but each is verified ON a path cell.
- **Files:** `src/data/areas/briar-wilds.ts` (`lightAnchors`, `lanternCells`, sign,
  `lightBeacon`).
- **Verification:** every lantern/anchor coord is a `briar-path` (or floor) cell on the
  trail; breadcrumb traces the trail west→east without a dark gap.

### U5 — Bias forest-eyes into the tree clusters (FB-17 pt4)
- **Goal:** eye-pairs peer from the dark tree clusters, not from a ring around Pip.
- **Files:** `src/systems/forestEyes.ts`, `src/scenes/GameScene.ts` (pass the area's
  dead-tree / deep-forest cluster world-anchors to the system).
- **Approach:** replace `relocate()`'s screen-centre annulus with a pick from the tree
  cluster anchor list (nearest-to-view, off-player), still clamped inside the view +
  VIEW_MARGIN, still UI-camera ADD-blend (desat-proof), still never on Pip, fixed pool /
  no per-frame alloc (EP-01).
- **Verification:** capture shows pairs at the treeline near dead-tree clusters, none
  orbiting the player; `npm run build` clean.

## Lessons / canon honoured (binding — `docs/solutions/`)
- `cluster-not-scatter.md` — the new path-tile treatment + any tree adds stay clustered,
  not an even per-tile sprinkle; deliberate clearings kept (the lit rest pockets).
- `3-4-oblique-not-iso.md` — the new PixelLab tile is a top-down ground tileset (no
  oblique object angle); judged in scene by the art gate.
- `ground-shadow-canon.md` — no new entities; existing shadows unaffected.
- The new tile's `lower_description` reuses the EXACT existing briar-floor wording so the
  path↔grass seam is invisible (the Ashen-chain seamless-blend lesson).

## Test scenarios
- **Tileset (U1/U2):** atlas preview renders all 16 masks; `hasTileset('briar-wilds-floor-path')`
  true; no resolver fallback warning for any briar-floor↔briar-path cell.
- **Reachability (U3):** `briar-layout.cjs` — spawn (2,15) reaches both exits and every
  anchor; floor count unchanged vs main (path is passable, no wall moved); no path vertex
  sits within 1 vertex of a thorn vertex (no 3-terrain cell).
- **Wayfinding (U4):** each of the 7 lanterns/anchors sits on a `briar-path`/floor cell of
  the trail; breadcrumb steps west→east toward the beacon without a dark gap > N cells.
- **Eyes (U5):** with cluster anchors supplied, pairs appear adjacent to tree clusters
  and never within the player's body radius; with NO anchors (other areas) the system
  is inert / unchanged.
- **Build + boot:** `npm run build` clean; boot-smoke New-Game+move passes; testbench
  `entering-briar` walks the full winding trail.

## Verification posture
Visual change → **GATE-2**: capture the new crossing as an **MP4** (motion: walking the
curve, the eyes peering, the breadcrumb) and bring to Jaco for preview approval BEFORE
merge. Non-visual safety via premerge (tsc+build) + boot-smoke + cold pr-review +
cold art-review (any placement change). Do NOT self-merge a visual change without GATE-2.

## Deferred to implementation
- Exact trail width (1 vs ~2 cells) and how aggressively the centre-line meanders per
  bend — tuned by eye against the testbench MP4, within the ≥1-buffer-to-thorn invariant.
- Whether the trail wants a few hand-placed widenings (a worn "rest pocket" at each lit
  bend) vs a uniform width.
- Exact upper_description tan-brown value — confirm against the atlas preview that it
  reads as a walked trail, not gold, and holds the storybook sepia mood.
