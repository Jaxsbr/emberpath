export const TILE_SIZE = 32;
export const PLAYER_SIZE = 24;
export const PLAYER_SPEED = 160;
export const NPC_SIZE = 24;

export enum TileType {
  FLOOR = 0,
  WALL = 1,
  // Render-only. Never appears in AreaDefinition.map — the renderer selects EXIT
  // for cells that overlap an area.exits zone when looking up a tile frame.
  EXIT = 2,
}
