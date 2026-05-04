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

export type ObjectKindId =
  // Ashen Isle — impassable
  | 'wall-stone'
  | 'wall-front'
  | 'wall-roof'
  | 'door-wood'
  | 'fence-rail'
  | 'cliff-stone'
  | 'tree-pine'
  // Ashen Isle — passable
  | 'bush'
  | 'flower'
  | 'sign-wood'
  // Fog Marsh — impassable
  | 'wall-tomb'
  | 'door-tomb'
  | 'dead-tree'
  | 'gravestone'
  | 'marsh-stone'
  // Fog Marsh — passable
  | 'dry-reed'
  | 'mushroom'
  | 'lantern-broken'
  // Briar Wilds — impassable. `briar-dead-tree` is a separate kind from
  // fog-marsh's `dead-tree` because the briar-wilds asset is its own PixelLab
  // generation with the briar palette, not the marsh palette.
  | 'bramble-cluster'
  | 'briar-dead-tree'
  // Briar Wilds — passable
  | 'twisted-root';

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
}

// PixelLab style-matched object PNGs (US-96). Generated against a 32×32
// area-sample patch of each area's primary tileset frame so the object
// palette / outline weight match the surrounding terrain. Each PNG is a
// single 32×32 image with a transparent background.

export const OBJECT_KINDS: Record<ObjectKindId, ObjectKindDefinition> = {
  // Ashen Isle
  'wall-stone':  { id: 'wall-stone',  atlasKey: 'object-wall-stone',  assetPath: 'objects/ashen-isle/wall-stone.png',  passable: false },
  'wall-front':  { id: 'wall-front',  atlasKey: 'object-wall-front',  assetPath: 'objects/ashen-isle/wall-front.png',  passable: false },
  'wall-roof':   { id: 'wall-roof',   atlasKey: 'object-wall-roof',   assetPath: 'objects/ashen-isle/wall-roof.png',   passable: false },
  'door-wood':   { id: 'door-wood',   atlasKey: 'object-door-wood',   assetPath: 'objects/ashen-isle/door-wood.png',   passable: false },
  'fence-rail':  { id: 'fence-rail',  atlasKey: 'object-fence-rail',  assetPath: 'objects/ashen-isle/fence-rail.png',  passable: false },
  'cliff-stone': { id: 'cliff-stone', atlasKey: 'object-cliff-stone', assetPath: 'objects/ashen-isle/cliff-stone.png', passable: false },
  'tree-pine':   { id: 'tree-pine',   atlasKey: 'object-tree-pine',   assetPath: 'objects/ashen-isle/tree-pine.png',   passable: false },
  'bush':        { id: 'bush',        atlasKey: 'object-bush',        assetPath: 'objects/ashen-isle/bush.png',        passable: true },
  'flower':      { id: 'flower',      atlasKey: 'object-flower',      assetPath: 'objects/ashen-isle/flower.png',      passable: true },
  'sign-wood':   { id: 'sign-wood',   atlasKey: 'object-sign-wood',   assetPath: 'objects/ashen-isle/sign-wood.png',   passable: true },

  // Fog Marsh
  'wall-tomb':      { id: 'wall-tomb',      atlasKey: 'object-wall-tomb',      assetPath: 'objects/fog-marsh/wall-tomb.png',      passable: false },
  'door-tomb':      { id: 'door-tomb',      atlasKey: 'object-door-tomb',      assetPath: 'objects/fog-marsh/door-tomb.png',      passable: false },
  'dead-tree':      { id: 'dead-tree',      atlasKey: 'object-dead-tree',      assetPath: 'objects/fog-marsh/dead-tree.png',      passable: false },
  'gravestone':     { id: 'gravestone',     atlasKey: 'object-gravestone',     assetPath: 'objects/fog-marsh/gravestone.png',     passable: false },
  'marsh-stone':    { id: 'marsh-stone',    atlasKey: 'object-marsh-stone',    assetPath: 'objects/fog-marsh/marsh-stone.png',    passable: false },
  'dry-reed':       { id: 'dry-reed',       atlasKey: 'object-dry-reed',       assetPath: 'objects/fog-marsh/dry-reed.png',       passable: true },
  'mushroom':       { id: 'mushroom',       atlasKey: 'object-mushroom',       assetPath: 'objects/fog-marsh/mushroom.png',       passable: true },
  'lantern-broken': { id: 'lantern-broken', atlasKey: 'object-lantern-broken', assetPath: 'objects/fog-marsh/lantern-broken.png', passable: true },

  // Briar Wilds (US-100/T12) — PixelLab personal-account generations.
  'bramble-cluster': { id: 'bramble-cluster', atlasKey: 'object-bramble-cluster', assetPath: 'objects/briar-wilds/bramble-cluster.png', passable: false },
  'briar-dead-tree': { id: 'briar-dead-tree', atlasKey: 'object-briar-dead-tree', assetPath: 'objects/briar-wilds/briar-dead-tree.png', passable: false },
  'twisted-root':    { id: 'twisted-root',    atlasKey: 'object-twisted-root',    assetPath: 'objects/briar-wilds/twisted-root.png',    passable: true },
};

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
