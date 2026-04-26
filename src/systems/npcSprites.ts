export { DIRECTIONS, type Direction } from './direction';

export interface NpcSpriteDefinition {
  idleFrameCount: number;
  walkFrameCount: number;
}

export const NPC_SPRITES: Record<string, NpcSpriteDefinition> = {
  'marsh-hermit': { idleFrameCount: 4, walkFrameCount: 4 },
  'old-man': { idleFrameCount: 4, walkFrameCount: 4 },
  'heron': { idleFrameCount: 4, walkFrameCount: 4 },
};

export function hasNpcSprite(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(NPC_SPRITES, id);
}

export function getNpcSpriteIds(): string[] {
  return Object.keys(NPC_SPRITES);
}

// Portrait registry — one entry per dialogue-capable NPC. Square aspect
// (source 1024×1024) is assumed for both render math in DialogueSystem and
// for crisp scaling decisions; non-square portraits are out-of-scope for
// this phase. Per-id `filter` controls texture filtering: 'nearest' inherits
// the global pixelArt: true default; 'linear' is applied via setFilter on
// the loaded texture so painterly portraits don't get nearest-neighbor mush
// when downscaled from 1024 to ~96px.
export interface NpcPortraitDefinition {
  file: string;
  filter: 'nearest' | 'linear';
}

export const NPC_PORTRAITS: Record<string, NpcPortraitDefinition> = {
  'marsh-hermit': { file: 'portrait.png', filter: 'nearest' },
  'old-man': { file: 'portrait.png', filter: 'linear' },
  'heron': { file: 'portrait.png', filter: 'linear' },
};

export function hasNpcPortrait(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(NPC_PORTRAITS, id);
}

export function getNpcPortraitIds(): string[] {
  return Object.keys(NPC_PORTRAITS);
}
