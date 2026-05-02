// Terrain registry — vertex-grid ground types under the tile-architecture phase
// (US-92). Each cell on the world map is bounded by 4 vertex terrains in a
// (rows+1) × (cols+1) grid; the Wang resolver (US-93) samples these 4 vertices
// to pick the atlas frame, and collision (US-94) derives cell passability from
// the AND of all 4 vertices' passable flags.
//
// Terrain ids are a closed string-literal union — adding a new terrain requires
// editing this file. Author-controlled vocabulary, no user-input pathway.

export type TerrainId =
  | 'grass'
  | 'sand'
  | 'path'
  | 'marsh-floor'
  | 'water'
  | 'stone';

export interface TerrainDefinition {
  id: TerrainId;
  // Per-vertex passability. Cell passability = AND of the 4 vertex flags
  // (collision rule defined in US-94 collidesWithWall): a cell blocks only
  // when every vertex is impassable. A single passable vertex makes the
  // whole cell walkable — keeps gameplay legible and matches the player's
  // bounding-box assumption (cell-granular collision, not vertex-granular).
  passable: boolean;
  // Wang tileset id used to render cells whose vertices include this terrain.
  // For stage 1 (US-92..US-94) the registered tilesets are the existing
  // Kenney degenerate-mode atlases (`tiny-town` / `tiny-dungeon`); stage 2
  // (US-95) re-points each terrain at its PixelLab-generated tileset.
  wangTilesetId: string;
  description: string;
}

export const TERRAINS: Record<TerrainId, TerrainDefinition> = {
  grass: {
    id: 'grass',
    passable: true,
    wangTilesetId: 'ashen-isle-grass-sand',
    description: 'Sepia grass — Ashen Isle base ground',
  },
  sand: {
    id: 'sand',
    passable: true,
    wangTilesetId: 'ashen-isle-sand-path',
    description: 'Pale dry sand — Ashen Isle paths and shoulders',
  },
  path: {
    id: 'path',
    passable: true,
    wangTilesetId: 'fog-marsh-floor-path',
    description: 'Compacted sepia stones — walkable path tying both areas',
  },
  'marsh-floor': {
    id: 'marsh-floor',
    passable: true,
    wangTilesetId: 'fog-marsh-floor-path',
    description: 'Fog Marsh base — wet sepia mire',
  },
  water: {
    id: 'water',
    passable: false,
    wangTilesetId: 'fog-marsh-floor-water',
    description: 'Murky standing water — impassable; floods marsh-trap closure',
  },
  stone: {
    id: 'stone',
    passable: true,
    wangTilesetId: 'fog-marsh-floor-stone',
    description: 'Weathered umber stone — Fog Marsh tomb apron',
  },
};

export function hasTerrain(id: string): id is TerrainId {
  return Object.prototype.hasOwnProperty.call(TERRAINS, id);
}
