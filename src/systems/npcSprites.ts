export { DIRECTIONS, type Direction } from './direction';

export interface NpcSpriteDefinition {
  idleFrameCount: number;
  walkFrameCount: number;
}

export const NPC_SPRITES: Record<string, NpcSpriteDefinition> = {
  'marsh-hermit': { idleFrameCount: 4, walkFrameCount: 4 },
  'old-man': { idleFrameCount: 4, walkFrameCount: 4 },
};

export function hasNpcSprite(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(NPC_SPRITES, id);
}

export function getNpcSpriteIds(): string[] {
  return Object.keys(NPC_SPRITES);
}
