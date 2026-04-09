import { collidesWithWall, collidesWithNpc } from './collision';
import { InputVector } from './input';

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Move an entity by the given velocity, checking collision on each axis independently.
 * Returns the new position. Axis-independent collision allows sliding along walls.
 */
export function moveWithCollision(entity: Entity, velocity: InputVector, delta: number): { x: number; y: number } {
  const dt = delta / 1000; // ms → seconds
  let newX = entity.x;
  let newY = entity.y;

  // Try X axis
  const candidateX = entity.x + velocity.x * dt;
  if (!collidesWithWall(candidateX, entity.y, entity.width, entity.height) &&
      !collidesWithNpc(candidateX, entity.y, entity.width, entity.height)) {
    newX = candidateX;
  }

  // Try Y axis
  const candidateY = entity.y + velocity.y * dt;
  if (!collidesWithWall(newX, candidateY, entity.width, entity.height) &&
      !collidesWithNpc(newX, candidateY, entity.width, entity.height)) {
    newY = candidateY;
  }

  return { x: newX, y: newY };
}
