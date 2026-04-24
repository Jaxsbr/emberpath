export const NPC_DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

export type NpcDirection = (typeof NPC_DIRECTIONS)[number];

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
