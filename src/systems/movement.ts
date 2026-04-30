import { NpcDefinition } from '../data/areas/types';
import { collidesWithWall, collidesWithNpc, NpcLivePositions, AreaPassability } from './collision';
import { InputVector } from './input';

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Collision dependencies for movement. Replaces the legacy `map: TileType[][]`
// shape with the unified passability snapshot under the tile-architecture
// model (US-94). The snapshot encapsulates terrain (vertex grid) and the
// runtime `objectBlockMap` GameScene maintains as conditional flags flip.
export interface AreaCollisionData {
  passability: AreaPassability;
  npcs: NpcDefinition[];
  npcLivePositions?: NpcLivePositions;
}

export function moveWithCollision(
  entity: Entity,
  velocity: InputVector,
  delta: number,
  area: AreaCollisionData,
): { x: number; y: number } {
  const dt = delta / 1000;
  let newX = entity.x;
  let newY = entity.y;

  const candidateX = entity.x + velocity.x * dt;
  if (
    !collidesWithWall(candidateX, entity.y, entity.width, entity.height, area.passability) &&
    !collidesWithNpc(candidateX, entity.y, entity.width, entity.height, area.npcs, area.npcLivePositions)
  ) {
    newX = candidateX;
  }

  const candidateY = entity.y + velocity.y * dt;
  if (
    !collidesWithWall(newX, candidateY, entity.width, entity.height, area.passability) &&
    !collidesWithNpc(newX, candidateY, entity.width, entity.height, area.npcs, area.npcLivePositions)
  ) {
    newY = candidateY;
  }

  return { x: newX, y: newY };
}
