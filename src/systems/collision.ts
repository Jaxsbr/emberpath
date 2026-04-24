import { TILE_SIZE, NPC_SIZE, TileType } from '../maps/constants';
import { NpcDefinition } from '../data/areas/types';

export type NpcLivePositions = Map<string, { x: number; y: number }>;

function getNpcBounds(
  npc: NpcDefinition,
  livePositions?: NpcLivePositions,
): { x: number; y: number; width: number; height: number } {
  const live = livePositions?.get(npc.id);
  if (live) {
    // Live positions are centre coords — collision uses top-left.
    return {
      x: live.x - NPC_SIZE / 2,
      y: live.y - NPC_SIZE / 2,
      width: NPC_SIZE,
      height: NPC_SIZE,
    };
  }
  // Fallback: static spawn tile. Used before NpcBehaviorSystem.update has run.
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
  livePositions?: NpcLivePositions,
): boolean {
  for (const npc of npcs) {
    const bounds = getNpcBounds(npc, livePositions);
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
