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
  | 'lantern-broken';

export interface ObjectKindDefinition {
  id: ObjectKindId;
  // Phaser texture key — the atlas the frame is drawn from. Stage 1 reuses
  // 'tileset-tiny-town' / 'tileset-tiny-dungeon'; stage 2 (US-96) re-points to
  // 'object-<id>' single-frame assets.
  atlasKey: string;
  // Frame string within the atlas. For stage-2 single-frame object PNGs this
  // is '0' (loaded as Phaser image, not a packed atlas).
  frame: string;
  // Cell passability contribution. When false, any cell hosting an instance
  // of this kind blocks the player regardless of underlying terrain
  // passability (US-94 collision rule).
  passable: boolean;
  // Optional cell footprint. Defaults to {1,1} when omitted. Used by the
  // editor (US-97) and the future multi-cell collision lookup; stage 1's
  // `buildObjectCollisionMap` keys cells per (col,row) regardless of footprint.
  footprint?: { w: number; h: number };
}

// Stage-1 atlas keys reuse the Kenney atlases registered by GameScene.preload.
const ASHEN = 'tileset-tiny-town';
const MARSH = 'tileset-tiny-dungeon';

export const OBJECT_KINDS: Record<ObjectKindId, ObjectKindDefinition> = {
  // Ashen Isle — Tiny Town frames (verified against ashen-isle.ts FRAME block)
  'wall-stone':  { id: 'wall-stone',  atlasKey: ASHEN, frame: '120', passable: false },
  'wall-front':  { id: 'wall-front',  atlasKey: ASHEN, frame: '72',  passable: false },
  'wall-roof':   { id: 'wall-roof',   atlasKey: ASHEN, frame: '64',  passable: false },
  'door-wood':   { id: 'door-wood',   atlasKey: ASHEN, frame: '97',  passable: false },
  'fence-rail':  { id: 'fence-rail',  atlasKey: ASHEN, frame: '80',  passable: false },
  'cliff-stone': { id: 'cliff-stone', atlasKey: ASHEN, frame: '121', passable: false },
  'tree-pine':   { id: 'tree-pine',   atlasKey: ASHEN, frame: '6',   passable: false },
  'bush':        { id: 'bush',        atlasKey: ASHEN, frame: '30',  passable: true },
  'flower':      { id: 'flower',      atlasKey: ASHEN, frame: '22',  passable: true },
  'sign-wood':   { id: 'sign-wood',   atlasKey: ASHEN, frame: '95',  passable: true },

  // Fog Marsh — Tiny Dungeon frames (verified against fog-marsh.ts FRAME block)
  'wall-tomb':      { id: 'wall-tomb',      atlasKey: MARSH, frame: '4',  passable: false },
  'door-tomb':      { id: 'door-tomb',      atlasKey: MARSH, frame: '22', passable: false },
  'dead-tree':      { id: 'dead-tree',      atlasKey: MARSH, frame: '92', passable: false },
  'gravestone':     { id: 'gravestone',     atlasKey: MARSH, frame: '24', passable: false },
  'marsh-stone':    { id: 'marsh-stone',    atlasKey: MARSH, frame: '16', passable: false },
  'dry-reed':       { id: 'dry-reed',       atlasKey: MARSH, frame: '93', passable: true },
  'mushroom':       { id: 'mushroom',       atlasKey: MARSH, frame: '24', passable: true },
  'lantern-broken': { id: 'lantern-broken', atlasKey: MARSH, frame: '36', passable: true },
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
