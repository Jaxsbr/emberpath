import { TileType } from '../maps/constants';
import { NpcDefinition } from '../data/areas/types';
import { collidesWithWall, collidesWithNpc } from './collision';
import { InputVector } from './input';

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AreaCollisionData {
  map: TileType[][];
  npcs: NpcDefinition[];
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
  if (!collidesWithWall(candidateX, entity.y, entity.width, entity.height, area.map) &&
      !collidesWithNpc(candidateX, entity.y, entity.width, entity.height, area.npcs)) {
    newX = candidateX;
  }

  const candidateY = entity.y + velocity.y * dt;
  if (!collidesWithWall(newX, candidateY, entity.width, entity.height, area.map) &&
      !collidesWithNpc(newX, candidateY, entity.width, entity.height, area.npcs)) {
    newY = candidateY;
  }

  return { x: newX, y: newY };
}
