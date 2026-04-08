import { TILE_SIZE, TileType } from '../maps/constants';
import { worldMap } from '../maps/worldMap';

/**
 * Check if a rectangle at (x, y) with given width/height would overlap a wall tile.
 * Uses the entity's bounding box corners to check all tiles it would occupy.
 */
export function collidesWithWall(x: number, y: number, width: number, height: number): boolean {
  const left = Math.floor(x / TILE_SIZE);
  const right = Math.floor((x + width - 1) / TILE_SIZE);
  const top = Math.floor(y / TILE_SIZE);
  const bottom = Math.floor((y + height - 1) / TILE_SIZE);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (row < 0 || row >= worldMap.length || col < 0 || col >= worldMap[0].length) {
        return true; // Out of bounds = collision
      }
      if (worldMap[row][col] === TileType.WALL) {
        return true;
      }
    }
  }
  return false;
}
