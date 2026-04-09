import { TILE_SIZE, NPC_SIZE, TileType } from '../maps/constants';
import { NpcDefinition } from '../data/areas/types';

function getNpcBounds(npc: NpcDefinition): { x: number; y: number; width: number; height: number } {
  const offset = (TILE_SIZE - NPC_SIZE) / 2;
  return {
    x: npc.col * TILE_SIZE + offset,
    y: npc.row * TILE_SIZE + offset,
    width: NPC_SIZE,
    height: NPC_SIZE,
  };
}

export function collidesWithWall(
  x: number, y: number, width: number, height: number,
  map: TileType[][],
): boolean {
  const left = Math.floor(x / TILE_SIZE);
  const right = Math.floor((x + width - 1) / TILE_SIZE);
  const top = Math.floor(y / TILE_SIZE);
  const bottom = Math.floor((y + height - 1) / TILE_SIZE);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
        return true;
      }
      if (map[row][col] === TileType.WALL) {
        return true;
      }
    }
  }
  return false;
}

export function collidesWithNpc(
  x: number, y: number, width: number, height: number,
  npcs: NpcDefinition[],
): boolean {
  for (const npc of npcs) {
    const bounds = getNpcBounds(npc);
    if (
      x < bounds.x + bounds.width &&
      x + width > bounds.x &&
      y < bounds.y + bounds.height &&
      y + height > bounds.y
    ) {
      return true;
    }
  }
  return false;
}
