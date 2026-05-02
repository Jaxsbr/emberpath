# Tile Architecture — Pre-Implementation Inventory

Working doc for the tile-architecture phase. Captures the current model so US-92's terrain.ts and objects.ts registries are designed against verified vocabulary, not guessed shape. Delete on phase archive.

## Current model snapshot

### TileType enum — `src/maps/constants.ts`

```ts
export enum TileType {
  FLOOR = 0,
  WALL = 1,
  EXIT = 2,  // render-only — never stored
}
```

`StoredTile = TileType.FLOOR | TileType.WALL` in `data/areas/types.ts`. EXIT is computed at render time from `area.exits` zones.

### AreaDefinition.map — `src/data/areas/types.ts`

`map: StoredTile[][]` (rows × cols). Ashen Isle is 38×50, Fog Marsh is 24×30.

### TileType consumers (12 sites, 11 files)

- `src/maps/constants.ts` — declaration
- `src/maps/tilesets.ts` — `TilesetDefinition.tileFrames: Record<TileType, string[]>`, `resolveFrame(tilesetId, kind, col, row)`, `hashCell(... kind ...)`
- `src/scenes/TitleScene.ts:110` — title backdrop wall check (low-impact; can stay terrain-passability after migration)
- `src/scenes/GameScene.ts:735-738, 866, 1260` — tile-frame lookup, `applyMarshTrappedState` mutation
- `src/systems/collision.ts:32, 44` — `collidesWithWall(map: TileType[][])` checks `=== TileType.WALL`
- `src/systems/movement.ts:1, 14` — re-exports `map: TileType[][]` to the collision call
- `src/systems/npcBehavior.ts:9, 50, 56` — pre-step wall sampling
- `src/data/areas/types.ts` — type alias
- `src/data/areas/ashen-isle.ts:1, 4-5` — `const F = TileType.FLOOR; const W = TileType.WALL;`
- `src/data/areas/fog-marsh.ts:1, 4-5` — same shorthand
- `tools/editor/src/mapRenderer.ts:1` — editor's tile renderer

### `applyMarshTrappedState` — `src/scenes/GameScene.ts:1257-`

Currently mutates `area.map[22][13..16]` between `FLOOR` ↔ `WALL` based on the `marsh_trapped` flag. Subscribed via `onFlagChange('marsh_trapped')` in `create()`. US-94 deletes this — its job moves to (a) terrain-flip authoring (US-98) and (b) the new `buildObjectCollisionMap` rebuild.

### Conditional decorations — `fog-marsh.ts:186-193`

```ts
{ col: 13, row: 22, spriteFrame: FRAME.PATH_A, condition: 'marsh_trapped == false' },
// ...PATH_A/B at 13-16,row 22 when not trapped...
{ col: 13, row: 22, spriteFrame: FRAME.EDGE_A, condition: 'marsh_trapped == true' },
// ...EDGE_A/B/C at 13-16,row 22 when trapped...
```

US-98 removes these — terrain-flip + Wang re-blend renders the closure correctly.

### Tilesets — `src/maps/tilesets.ts`

```ts
TILESETS = {
  'tiny-town':    { atlasKey: 'tileset-tiny-town',    tileFrames: { FLOOR: ['0','1','2'],     WALL: ['120','121','122'], EXIT: ['15'] } },
  'tiny-dungeon': { atlasKey: 'tileset-tiny-dungeon', tileFrames: { FLOOR: ['48','49','50','51'], WALL: ['0','1','2'],   EXIT: ['22'] } },
}
```

`hashCell` (FNV-1a-style) is the deterministic per-cell variation hash to preserve in US-93's resolver.

### Existing decoration vocabulary

**Ashen Isle (`FRAME` in ashen-isle.ts:11-26):**
- Wall-class (must become collision-bearing objects in US-92): `WALL_FRONT='72'`, `ROOF='64'`, `DOOR='97'`, `FENCE='80'`, `CLIFF_A/B/C='120-122'`
- Visual ground markings (stay decorations or become passable objects): `PATH='51'`, `DOCK='55'`
- Flora/objects: `TREE='6'`, `BUSH='30'`, `FLOWER='22'`, `SIGN='95'`

**Fog Marsh (FRAME in fog-marsh.ts):**
- Wall-class: tomb walls / dungeon walls (need verification by reading fog-marsh.ts FRAME block)
- Reeds/marsh flora: `REED_A`, `REED_B`
- Path/edge variants: `PATH_A`, `PATH_B`, `EDGE_A`, `EDGE_B`, `EDGE_C`
- `DOOR` (col 24, row 9 — tomb door)

## Target model (US-92 design intent)

### TerrainId registry — `src/maps/terrain.ts`

```ts
export type TerrainId = 'grass' | 'sand' | 'path' | 'marsh-floor' | 'water' | 'stone';

export interface TerrainDefinition {
  id: TerrainId;
  passable: boolean;
  wangTilesetId: string;
  description: string;
}

export const TERRAINS: Record<TerrainId, TerrainDefinition> = {
  grass:        { ..., passable: true, wangTilesetId: 'ashen-isle-grass-sand', ... },
  sand:         { ..., passable: true, wangTilesetId: 'ashen-isle-sand-path', ... },
  path:         { ..., passable: true, wangTilesetId: 'fog-marsh-floor-path', ... },
  'marsh-floor':{ ..., passable: true, wangTilesetId: 'fog-marsh-floor-path', ... },
  water:        { ..., passable: false, ... },
  stone:        { ..., passable: true, wangTilesetId: 'fog-marsh-floor-stone', ... },
};
```

Note: `wangTilesetId` is forward-looking — the tileset registered under that id is created in US-95. For stage 1, the existing degenerate `tiny-town`/`tiny-dungeon` Wang tilesets cover the FLOOR-vs-WALL case via the `'0000'`/`'1111'` corner masks; transitional tilesets land in stage 2.

### ObjectKindId registry — `src/maps/objects.ts`

Initial vocabulary derived from current decoration usage + US-95/96 spec list:

**Ashen Isle (impassable):** `wall-stone` (was `WALL_FRONT`/`ROOF`), `door-wood` (was `DOOR`), `fence-rail` (was `FENCE`), `tree-pine` (was `TREE`), `cliff-stone` (was `CLIFF_*`)
**Ashen Isle (passable):** `bush` (was `BUSH`), `flower` (was `FLOWER`), `sign-wood` (was `SIGN`)

**Fog Marsh (impassable):** `wall-tomb`, `door-tomb`, `dead-tree`, `gravestone`, `marsh-stone`
**Fog Marsh (passable):** `dry-reed` (was `REED_*`), `mushroom`, `lantern-broken`

```ts
export interface ObjectKindDefinition {
  id: ObjectKindId;
  atlasKey: string;
  frame: string;
  passable: boolean;
  footprint?: { w: number; h: number };  // defaults to {1,1}
}
```

Stage 1 (US-92) registers each kind pointing at the existing Kenney atlas + frame so US-94's renderer + collision unification can run with no visual regression. Stage 2 (US-96) re-points each `atlasKey`/`frame` at PixelLab assets.

### AreaDefinition rewrite

Add: `terrain: TerrainId[][]` (vertex grid, `(rows+1) × (cols+1)`), `objects: ObjectInstance[]`, `conditionalTerrain?: ...[]`.
Remove: `map: StoredTile[][]`.

Stage-1 area files keep all existing decorations/props/triggers untouched — only `map` migrates to `terrain` and the previously-WALL cells get a corresponding `ObjectInstance` in `objects`. US-98 does the full re-author.

## Implementation order — stage 1

1. **US-92**: write `terrain.ts` + `objects.ts` registries (no consumer changes yet); update `types.ts` to include the new fields alongside existing `map` (keep both during migration); add `EXIT_TINT_OVERLAY` infrastructure.
2. **US-92 (cont.)**: migrate every TileType consumer to read from terrain/objects passability — types.ts, collision.ts, movement.ts, npcBehavior.ts, GameScene.ts (4 sites), TitleScene.ts, mapRenderer.ts, tilesets.ts (TileType-keyed → wang-keyed). Final step: remove `TileType` enum + `area.map` field.
3. **US-93**: write `wang.ts` resolver + `WangTilesetDefinition` shape + degenerate `tiny-town`/`tiny-dungeon` entries with `cornerMaskTable['0000']`/`['1111']` only; remove `resolveFrame()`; write `atlasPreview.ts`.
4. **US-94**: write `renderObjects()`, `buildObjectCollisionMap()`, conditional-object subscriber wiring in GameScene; rewrite `collidesWithWall` to consult both terrain + objects; delete `applyMarshTrappedState`; verify both areas render visually identical to today.

Stage-1 done-when checkpoint: both areas play through every flow with no visual regression on Kenney frames before stage 2 generation begins.
