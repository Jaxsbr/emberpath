// Object kind registry — sparse-list overlay layer under the tile-architecture
// phase (US-92). ObjectInstances are placed in `area.objects` at cell coords
// and rendered above terrain at depth 2.5 (US-94 rendering rule). Each kind
// carries a `passable` flag — collision (US-94) ANDs cell-passability from
// terrain AND any blocking object at the cell.
//
// Stage 1 (US-92..US-94) wires every kind to the existing Kenney Tiny Town /
// Tiny Dungeon atlas frames so the new architecture renders visually identical
// to today. Stage 2 (US-96) re-points each kind's atlasKey/frame at PixelLab
// style-matched assets.
//
// Author-controlled vocabulary. Adding a kind requires editing this file —
// the closed string-literal union prevents user-input-driven id construction.

import type { ShadowShape } from './shadows';

export type ObjectKindId =
  // Shared — invisible collision filler (transparent PNG). Lets a single large
  // decorative object (e.g. a multi-cell cottage) carry per-cell collision: the
  // art draws on top, these block the body cells underneath. Collision keys the
  // anchor cell only (buildObjectCollisionMap), so one block = one blocked cell.
  | 'collision-block'
  // Ashen Isle — impassable
  | 'wall-stone'
  | 'wall-front'
  | 'wall-roof'
  | 'door-wood'
  | 'fence-rail'
  | 'cliff-stone'
  | 'tree-pine'
  | 'tree-oak'
  // Ashen Isle — cohesive multi-cell building (PixelLab, hand-painted). The
  // visible structure is one image spanning its footprint; collision comes from
  // collision-block cells laid under the body (door cell left open).
  | 'cottage'
  // Ashen Isle — the SAME cottage art at true 2× scale (FB-6, Jaco: "houses
  // render too small"). An 8×8-footprint variant of `cottage` reusing the same
  // painted image; collision is a tree-style FRONT-WALL-BASE band
  // (`collisionFootprint {dx:1,dy:5,w:6,h:2}`, #119) so the whole roof above is
  // walkable and Pip rounds behind for the see-through fade. Distinct kind so
  // only the rescaled house adopts the bigger geometry.
  | 'cottage-large'
  // Ashen Isle — dock props (PixelLab style-matched, weathered sepia/umber)
  | 'boat-row'
  | 'barrel-wood'
  | 'pier-wood'
  // Ashen Isle — passable
  | 'bush'
  | 'flower'
  | 'grass-tuft'
  | 'sign-wood'
  // Ashen Isle — impassable natural set-dressing (boulder lining the paths)
  | 'rock'
  // Fog Marsh — impassable
  | 'wall-tomb'
  | 'marsh-reeds'
  | 'door-tomb'
  | 'dead-tree'
  | 'gravestone'
  | 'marsh-stone'
  // Fog Marsh — the Marsh Hermit's house (FB-12, Jaco: a real house, not the
  // awkward stone-block ruin square that stood in for it). A cohesive 6×6 marsh
  // hut (its own PixelLab generation, marsh-toned to fit the hermit — weathered
  // planks, mossy thatch, reeds at the base), built on the same RED-foundation /
  // walkable-BLUE-base model as the player's `cottage-large`: collision is a
  // collision-block grid under the upper body, the front-wall base row stays
  // walkable and fires the see-through fade. Humbler (6×6) than the player's 8×8.
  | 'hermit-house'
  // Fog Marsh — passable
  | 'dry-reed'
  // Cattails/bulrushes ringing the pond (FB-13 slice 2) — taller, with brown
  // seed-heads, distinct from the thin `dry-reed` wisp, so the water reads as a
  // real marsh edge instead of a bare hole.
  | 'cattail'
  // Lily pads floating on the pond water (FB-13 slice 3) — flat green pads, a
  // touch of life on the open water so the pool reads as a living marsh basin.
  | 'lily-pad'
  | 'mushroom'
  | 'lantern-broken'
  // Briar Wilds — impassable. `briar-dead-tree` is a separate kind from
  // fog-marsh's `dead-tree` because the briar-wilds asset is its own PixelLab
  // generation with the briar palette, not the marsh palette.
  | 'bramble-cluster'
  | 'briar-dead-tree'
  // Briar Wilds — two extra dark-canopy variants + a bramble bush (FB-17 #1062:
  // make Briar read as a DARK FOREST, ~80% canopy off-path, not a lawn). Same
  // briar palette + top-down dome family as `briar-dead-tree`; used by the dense
  // `forestFill` layer. `briar-thicket` is a small impassable undergrowth bush.
  | 'briar-tree-dome'
  | 'briar-tree-cluster'
  | 'briar-thicket'
  // Briar Wilds — passable
  | 'twisted-root'
  // Heart Bridge — the figure who meets Pip at the crossing (US-HB3, Decision 1 =
  // FIGURE PRESENT, Jaco 2026-06-15). A wordless regal golden stag standing at the
  // far third of the span. Impassable presence (Pip walks past, not through);
  // `tall` so she passes behind it from above and in front from below, like a tree.
  // No dialogue/interaction — it is a placed object, not an NPC, so it carries no
  // "talk" prompt. PixelLab golden-stag generation, low-top-down to match Pip.
  | 'golden-stag';

export interface ObjectKindDefinition {
  id: ObjectKindId;
  // Phaser texture key — every PixelLab object loads as its own single-frame
  // image, keyed `object-<id>`. GameScene.preload iterates OBJECT_KINDS and
  // calls `load.image(atlasKey, assetPath)`; renderObjects creates a
  // Phaser.GameObjects.Image without a frame argument so the default
  // `__BASE` frame is used.
  atlasKey: string;
  // Asset path under the Vite publicDir (`assets/`). Authoritative location
  // of the object's PNG. Defines the on-disk identity of the kind.
  assetPath: string;
  // Cell passability contribution. When false, any cell hosting an instance
  // of this kind blocks the player regardless of underlying terrain
  // passability (US-94 collision rule).
  passable: boolean;
  // Optional cell footprint. Defaults to {1,1} when omitted. Used by the
  // editor (US-97) and the future multi-cell collision lookup; stage 1's
  // `buildObjectCollisionMap` keys cells per (col,row) regardless of footprint.
  footprint?: { w: number; h: number };
  // Tall object (#346) — opts the kind into Y-sorted rendering. Tall objects
  // are drawn in the entity depth band [5, 5.49) keyed on the world-y of their
  // base, so the player passes BEHIND the object when standing above its base
  // (canopy occludes her) and IN FRONT when standing below. Non-tall objects
  // keep the flat decoration depth (2.5). Used for trees so a multi-tile canopy
  // reads with real depth instead of always painting under or over the player.
  tall?: boolean;
  // Optional collision sub-region relative to the anchor cell, in CELLS (#346).
  // When present, `buildObjectCollisionMap` blocks ONLY these cells instead of
  // the single anchor cell — so a tall tree blocks just its trunk-base cell and
  // the player can walk around and under the overhanging canopy. dx/dy offset
  // the region from the anchor (col+dx, row+dy); w/h is its cell span. Absent =
  // legacy single-anchor-cell behavior (preserves every existing object).
  collisionFootprint?: { dx: number; dy: number; w: number; h: number };
  // Optional base/ground-contact sub-region (in CELLS, anchor-relative) used
  // ONLY for Y-sort depth and the behind-object fade — NEVER for collision.
  // A `tall` building (the cottage) handles collision via separate
  // collision-block cells (door row left open), so it can't reuse
  // `collisionFootprint` (that would block the doorway). `baseFootprint` lets
  // it declare where its front wall meets the ground (dy = front row) so Pip
  // sorts behind it from the north and fades it when hidden, with collision
  // untouched. When absent, sort/fade fall back to `collisionFootprint`, then
  // to the full footprint bottom — so every existing tall object is unchanged.
  baseFootprint?: { dx: number; dy: number; w: number; h: number };
  // Pure collision marker — contributes collision via `buildObjectCollisionMap`
  // but is NEVER rendered (no sprite, no ground-contact shadow). The transparent
  // collision-block PNG drew nothing visually, but the FB-3/FB-4 shadow pass
  // still pooled an ellipse under every cell — so a multi-cell cottage's grid of
  // markers stacked into a heavy dark mass around its base (Jaco FB-8). Skipping
  // the render entirely is correct: collision is keyed off `area.objects`, not
  // the rendered sprite.
  invisible?: boolean;
  // FB-23 — per-kind authored collision, sub-cell granular. Array of [sdx, sdy]
  // offsets relative to the object's ANCHOR-cell top-left sub-cell (anchor cell
  // (col,row) → sub-cell (col*COLLISION_SUBDIV, row*COLLISION_SUBDIV); each cell
  // is COLLISION_SUBDIV² sub-cells of SUB_SIZE px). When present,
  // `buildObjectCollisionMap` blocks EXACTLY these sub-cells — superseding
  // `collisionFootprint` — so a small rock blocks only the part of its tile it
  // covers. Loaded from `src/data/object-shapes.json` and merged onto the kind at
  // module init (below). Absent = legacy collisionFootprint/anchor-cell behaviour.
  collisionCells?: Array<[number, number]>;
  // FB-23 (shadows) — per-kind authored ground shadow, a circle/oval/rectangle
  // sized + positioned in the shadow editor (?editor=shadow&target=object&kind=<id>),
  // loaded from object-shapes.json and merged onto the kind here. When present,
  // `renderObjects` builds the shadow from it (centre = anchor cell top-left + dx,dy
  // in PX) INSTEAD of the building-rect / tree-ellipse / prop-ellipse heuristic;
  // `noShadow` still wins over both. A kind with no `shadow` keeps the heuristic.
  // See src/maps/shadows.ts for the coordinate model.
  shadow?: ShadowShape;
  // Suppress the ground-contact shadow for this kind (Jaco #1064). The
  // ground-shadow canon (ellipse under every standing prop) is for DISCRETE
  // standing objects. Dense ground-cover that carpets the floor — the briar
  // undergrowth bushes packed between trunks, or a flat root decal lying ON the
  // ground — is NOT a standing prop: a per-instance oval under each one stacks
  // into a field of stray dark spots ("stray shadows that dont belong", #1064),
  // the same failure mode as the FB-8 marker grid. These kinds render their
  // sprite but cast no pooled shadow; the canon still applies to every tree,
  // building, character, and discrete prop.
  noShadow?: boolean;
}

// PixelLab style-matched object PNGs (US-96). Generated against a 32×32
// area-sample patch of each area's primary tileset frame so the object
// palette / outline weight match the surrounding terrain. Each PNG is a
// single 32×32 image with a transparent background.

export const OBJECT_KINDS: Record<ObjectKindId, ObjectKindDefinition> = {
  // Shared — invisible per-cell collision (transparent 1×1 PNG, scaled to the
  // cell at render so it draws nothing). Used to give a large multi-cell art
  // object real collision over its body.
  'collision-block': { id: 'collision-block', atlasKey: 'object-collision-block', assetPath: 'objects/_shared/collision-block.png', passable: false, invisible: true },
  // Ashen Isle
  'wall-stone':  { id: 'wall-stone',  atlasKey: 'object-wall-stone',  assetPath: 'objects/ashen-isle/wall-stone.png',  passable: false },
  'wall-front':  { id: 'wall-front',  atlasKey: 'object-wall-front',  assetPath: 'objects/ashen-isle/wall-front.png',  passable: false },
  'wall-roof':   { id: 'wall-roof',   atlasKey: 'object-wall-roof',   assetPath: 'objects/ashen-isle/wall-roof.png',   passable: false },
  // Door cells stay walkable: the original FLOOR door tiles posed dialogue
  // (e.g. the Old Man stands ON his own door cell at 40,28). A blocking door
  // would trap the NPC and break posing, so the door reads as "standing in the
  // open doorway" — passable by design.
  'door-wood':   { id: 'door-wood',   atlasKey: 'object-door-wood',   assetPath: 'objects/ashen-isle/door-wood.png',   passable: true },
  'fence-rail':  { id: 'fence-rail',  atlasKey: 'object-fence-rail',  assetPath: 'objects/ashen-isle/fence-rail.png',  passable: false },
  'cliff-stone': { id: 'cliff-stone', atlasKey: 'object-cliff-stone', assetPath: 'objects/ashen-isle/cliff-stone.png', passable: false },
  // Trees render at 4×4 (128×128, exact 1:1 — no distortion) so Pip (≈2 tiles /
  // 68px) reads SMALL against a real tree, not eye-to-eye with a token (Jaco
  // #346, 2026-06-14). The PNGs are high-top-down canopies (round oak / layered
  // pine) with a small trunk base at the bottom-center. Trees are `tall`
  // (Y-sorted — Pip walks behind the canopy from above, in front from below) and
  // collide ONLY on a single bottom-row trunk cell (col+1, row+3), so the player
  // can walk around and under the overhanging canopy.
  'tree-pine':   { id: 'tree-pine',   atlasKey: 'object-tree-pine',   assetPath: 'objects/ashen-isle/tree-pine.png',   passable: false, footprint: { w: 4, h: 4 }, tall: true, collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 } },
  'tree-oak':    { id: 'tree-oak',    atlasKey: 'object-tree-oak',    assetPath: 'objects/ashen-isle/tree-oak.png',    passable: false, footprint: { w: 4, h: 4 }, tall: true, collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 } },
  // Cohesive cottage — one 128px image over a 4×4 footprint. Collision is laid
  // separately as collision-block cells under the body (door cell left open), so
  // the anchor-only object collision rule doesn't leave the house walk-through.
  // `tall` + `baseFootprint` (front-wall row, dy=3) make Pip pass BEHIND the
  // house from the north (it occludes + fades to 50% with a white rim) and IN
  // FRONT from the south, exactly like a tree — without touching its collision
  // (that stays the collision-block grid, doorway open). Matches FB-3 pts 1+4.
  'cottage':     { id: 'cottage',     atlasKey: 'object-cottage',     assetPath: 'objects/ashen-isle/cottage.png',     passable: false, footprint: { w: 4, h: 4 }, tall: true, baseFootprint: { dx: 0, dy: 3, w: 4, h: 1 } },
  // True 2× cottage (FB-6). Same painted image (own atlas key, same file) drawn
  // over an 8×8 footprint so it reads as a real building, not a dollhouse.
  // Collision is now a TREE-STYLE base band (#119): `collisionFootprint`
  // {dx:1,dy:5,w:6,h:2} blocks only the front-wall BASE band (the two rows where
  // the house physically meets the ground), so the entire roof (dy 0-4) is
  // WALKABLE — Pip rounds the body, steps up under the roof, is drawn BEHIND the
  // sprite and fires the see-through fade, exactly like walking behind a tree
  // canopy. The band sits LOW on purpose: this is a tall sprite (its roof fills
  // most of the image, footprint top rows reach the ridge), so a mid-roof band
  // would block exactly the rows where Pip tucks under the roof and leave only the
  // thin ridge — above the painted mass — as walkable, where the fade barely
  // reads. Jaco first painted the mid-roof band in the editor; GATE-2 review (the
  // walk-behind read weak) moved it down to the front-wall base, which delivers
  // the strong tuck-behind. The bottom front-wall row (`baseFootprint` dy:7) stays
  // the walkable BLUE base and remains the fade trigger line for the front
  // approach. This replaces the old double-sourced collision (full-body tilemap
  // WALL band + an 8×7 collision-block grid in the area file), which over-blocked
  // the whole house so Pip could never reach a behind-the-body cell.
  'cottage-large': { id: 'cottage-large', atlasKey: 'object-cottage-large', assetPath: 'objects/ashen-isle/cottage.png', passable: false, footprint: { w: 8, h: 8 }, tall: true, collisionFootprint: { dx: 1, dy: 5, w: 6, h: 2 }, baseFootprint: { dx: 0, dy: 7, w: 8, h: 1 } },
  // Boat + pier read at true scale via `footprint` (US-98) — a 32px boat looked
  // like a toy on the dock (Jaco feedback 2026-06-13). Both moor in impassable
  // water; collision keys their anchor cell only, so the multi-tile footprint is
  // purely visual and never blocks the walkable shore.
  'boat-row':    { id: 'boat-row',    atlasKey: 'object-boat-row',    assetPath: 'objects/ashen-isle/boat-row.png',    passable: false, footprint: { w: 2, h: 2 } },
  'barrel-wood': { id: 'barrel-wood', atlasKey: 'object-barrel-wood', assetPath: 'objects/ashen-isle/barrel-wood.png', passable: false },
  'pier-wood':   { id: 'pier-wood',   atlasKey: 'object-pier-wood',   assetPath: 'objects/ashen-isle/pier-wood.png',   passable: false, footprint: { w: 2, h: 3 } },
  'bush':        { id: 'bush',        atlasKey: 'object-bush',        assetPath: 'objects/ashen-isle/bush.png',        passable: true },
  'flower':      { id: 'flower',      atlasKey: 'object-flower',      assetPath: 'objects/ashen-isle/flower.png',      passable: true },
  // Passable ground tuft — lived-in grass detail scattered through the open
  // bands so the island reads as a real place, not bare floor (Jaco directive
  // 2026-06-14: the areas "lack so much"). Reference: dense top-down village
  // groundcover (ref/terrain-ground).
  'grass-tuft':  { id: 'grass-tuft',  atlasKey: 'object-grass-tuft',  assetPath: 'objects/ashen-isle/grass-tuft.png',  passable: true },
  'sign-wood':   { id: 'sign-wood',   atlasKey: 'object-sign-wood',   assetPath: 'objects/ashen-isle/sign-wood.png',   passable: true },
  // Impassable mossy boulder — lines the sand-path edges and dots the grass as a
  // natural feature (same reference). Collision keys the anchor cell only; placed
  // beside paths in open grass so it never blocks a route.
  'rock':        { id: 'rock',        atlasKey: 'object-rock',        assetPath: 'objects/ashen-isle/rock.png',        passable: false },

  // Fog Marsh
  'wall-tomb':      { id: 'wall-tomb',      atlasKey: 'object-wall-tomb',      assetPath: 'objects/fog-marsh/wall-tomb.png',      passable: false },
  // C12b (2026-06-14): the impassable marsh boundary. Replaces wall-tomb as the
  // derived wall kind so the perimeter reads as a dense reed/cattail bank ("the
  // marsh is too thick this way") instead of a grey stone-block crypt wall — the
  // single biggest "dungeon, not fog" signal (Issue #67). Organic silhouette
  // survives the grey-out where the hard rectangular block read as a dungeon.
  'marsh-reeds':    { id: 'marsh-reeds',    atlasKey: 'object-marsh-reeds',    assetPath: 'objects/fog-marsh/marsh-reeds.png',    passable: false },
  'door-tomb':      { id: 'door-tomb',      atlasKey: 'object-door-tomb',      assetPath: 'objects/fog-marsh/door-tomb.png',      passable: false },
  // Gnarled leafless marsh dead tree (regenerated TOP-DOWN 2026-06-14, Slice 6 /
  // directives #344+#346) — a 128px image over a 4×4 footprint, bare branches
  // splaying outward as seen from straight above (marsh-toned twin of Briar's
  // briar-dead-tree). Like Ashen's oak/pine it is `tall` (Y-sorted on its trunk
  // base so Pip passes behind the upper branches from above and in front from
  // below) and collides ONLY on the trunk-base cell, so the bare branch spread
  // overhangs the rest of the 4×4 as walkable shade.
  'dead-tree':      { id: 'dead-tree',      atlasKey: 'object-dead-tree',      assetPath: 'objects/fog-marsh/dead-tree.png',      passable: false, footprint: { w: 4, h: 4 }, tall: true, collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 } },
  'gravestone':     { id: 'gravestone',     atlasKey: 'object-gravestone',     assetPath: 'objects/fog-marsh/gravestone.png',     passable: false },
  'marsh-stone':    { id: 'marsh-stone',    atlasKey: 'object-marsh-stone',    assetPath: 'objects/fog-marsh/marsh-stone.png',    passable: false },
  // Marsh Hermit's house (FB-12) — one 192px image over a 6×6 footprint. Same
  // model as `cottage-large`: `tall` + `baseFootprint` (front-wall row, dy=5) so
  // Pip sorts behind it from the north and the see-through fade fires when she
  // steps onto the walkable base; collision is laid as a collision-block grid
  // under the top 5 rows (see `hermitHouse()` in fog-marsh.ts), door row open.
  'hermit-house':   { id: 'hermit-house',   atlasKey: 'object-hermit-house',   assetPath: 'objects/fog-marsh/hermit-house.png',   passable: false, footprint: { w: 6, h: 6 }, tall: true, baseFootprint: { dx: 0, dy: 5, w: 6, h: 1 } },
  'dry-reed':       { id: 'dry-reed',       atlasKey: 'object-dry-reed',       assetPath: 'objects/fog-marsh/dry-reed.png',       passable: true },
  'cattail':        { id: 'cattail',        atlasKey: 'object-cattail',        assetPath: 'objects/fog-marsh/cattail.png',        passable: true },
  'lily-pad':       { id: 'lily-pad',       atlasKey: 'object-lily-pad',       assetPath: 'objects/fog-marsh/lily-pad.png',       passable: true },
  'mushroom':       { id: 'mushroom',       atlasKey: 'object-mushroom',       assetPath: 'objects/fog-marsh/mushroom.png',       passable: true },
  'lantern-broken': { id: 'lantern-broken', atlasKey: 'object-lantern-broken', assetPath: 'objects/fog-marsh/lantern-broken.png', passable: true },

  // Briar Wilds (US-100/T12) — PixelLab personal-account generations.
  'bramble-cluster': { id: 'bramble-cluster', atlasKey: 'object-bramble-cluster', assetPath: 'objects/briar-wilds/bramble-cluster.png', passable: false },
  // Gnarled leafless dead tree (regenerated TOP-DOWN 2026-06-14, Slice 7c /
  // directives #344+#346) — a 128px image over a 4×4 footprint, branches splaying
  // outward as seen from straight above. Like Ashen's oak/pine it is `tall`
  // (Y-sorted on its trunk base so Pip passes behind the upper branches from
  // above and in front from below) and collides ONLY on the trunk-base cell, so
  // the bare branch spread overhangs the rest of the 4×4 as walkable shade.
  'briar-dead-tree': { id: 'briar-dead-tree', atlasKey: 'object-briar-dead-tree', assetPath: 'objects/briar-wilds/briar-dead-tree.png', passable: false, footprint: { w: 4, h: 4 }, tall: true, collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 } },
  // Dark-forest densification (FB-17 #1062). Two extra overhead dome canopies in
  // the same briar palette (PixelLab top-down, 2026-06-19) — identical 4×4 `tall`
  // trunk-base collision to briar-dead-tree, so the `forestFill` layer can pack the
  // off-path void with mixed canopy that collides ONLY on its wall trunk-base cell
  // (reachability provably unchanged). `briar-thicket` is a small 2×2 impassable
  // undergrowth bush (anchor-cell-only collision) to close the gaps between trunks.
  'briar-tree-dome':    { id: 'briar-tree-dome',    atlasKey: 'object-briar-tree-dome',    assetPath: 'objects/briar-wilds/briar-tree-dome.png',    passable: false, footprint: { w: 4, h: 4 }, tall: true, collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 } },
  'briar-tree-cluster': { id: 'briar-tree-cluster', atlasKey: 'object-briar-tree-cluster', assetPath: 'objects/briar-wilds/briar-tree-cluster.png', passable: false, footprint: { w: 4, h: 4 }, tall: true, collisionFootprint: { dx: 1, dy: 3, w: 1, h: 1 } },
  'briar-thicket':      { id: 'briar-thicket',      atlasKey: 'object-briar-thicket',      assetPath: 'objects/briar-wilds/briar-thicket.png',      passable: false, footprint: { w: 2, h: 2 }, noShadow: true },
  'twisted-root':    { id: 'twisted-root',    atlasKey: 'object-twisted-root',    assetPath: 'objects/briar-wilds/twisted-root.png',    passable: true, noShadow: true },

  // Heart Bridge — the golden stag who meets Pip at the crossing (US-HB3). Rendered
  // 3×3 (96px) so it reads slightly LARGER than Pip (≈68px) — a presence, not a peer.
  // `tall` (Y-sorted on its base) so depth reads naturally as she passes; collision
  // keys only the bottom-center base cell, so the figure's body overhangs the rest of
  // its footprint as walkable space and Pip can step around to reach the seal.
  'golden-stag':     { id: 'golden-stag',     atlasKey: 'object-golden-stag',     assetPath: 'objects/heart-bridge/golden-stag.png',     passable: false, footprint: { w: 3, h: 3 }, tall: true, collisionFootprint: { dx: 1, dy: 2, w: 1, h: 1 } },
};

// FB-23 — merge per-kind authored collision/shadow shapes onto the registry at
// module init. The JSON is the editable source of truth (written by the
// object-mode editor's save endpoint, committed as real game data); merging here
// keeps every consumer reading a single `OBJECT_KINDS[kind]` def. Entries for
// unknown ids (e.g. the `_doc` note) are skipped. Authored values OVERRIDE the
// kind's static collisionFootprint/shadow; a kind with no entry is untouched.
import objectShapesRaw from '../data/object-shapes.json';

interface ObjectShapeEntry {
  collision?: number[][];
  shadow?: ObjectKindDefinition['shadow'];
}

for (const [id, entry] of Object.entries(objectShapesRaw as Record<string, ObjectShapeEntry>)) {
  if (!hasObjectKind(id)) continue;
  const def = OBJECT_KINDS[id];
  if (entry.collision) {
    def.collisionCells = entry.collision.map((c) => [c[0], c[1]] as [number, number]);
  }
  if (entry.shadow) def.shadow = entry.shadow;
}

export function hasObjectKind(id: string): id is ObjectKindId {
  return Object.prototype.hasOwnProperty.call(OBJECT_KINDS, id);
}

// ObjectInstance — a placed object on a specific cell. Stored in
// `AreaDefinition.objects: ObjectInstance[]`. The `condition?` is evaluated
// through `systems/conditions.ts:evaluateCondition` (US-94 wiring) — same
// flag-driven gate used by decorations and triggers; no new condition syntax.
export interface ObjectInstance {
  kind: ObjectKindId;
  col: number;
  row: number;
  condition?: string;
}
