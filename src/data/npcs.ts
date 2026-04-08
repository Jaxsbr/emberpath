import { TILE_SIZE } from '../maps/constants';

export interface NpcDefinition {
  id: string;
  name: string;
  col: number;
  row: number;
  color: number;
}

export const NPC_SIZE = 24;

export const npcs: NpcDefinition[] = [
  { id: 'old-man', name: 'Old Man', col: 13, row: 12, color: 0x8b6914 },
];

export function getNpcBounds(npc: NpcDefinition): { x: number; y: number; width: number; height: number } {
  const offset = (TILE_SIZE - NPC_SIZE) / 2;
  return {
    x: npc.col * TILE_SIZE + offset,
    y: npc.row * TILE_SIZE + offset,
    width: NPC_SIZE,
    height: NPC_SIZE,
  };
}
