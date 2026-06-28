// #214 P2 — sprite-sheet accessor.
//
// Character animation frames ship as packed grids (assets/sheets/<id>.png),
// generated losslessly by scripts/pack-sprite-sheets.cjs. This module is the
// single bridge between the committed manifest and the game: it gives the loader
// the texture key + grid dims, and gives the animation/render code the frame
// INDEX for a logical frame name (e.g. 'idle-north-0', 'static-south'). Replaces
// the 607 individual load.image keys with 8 spritesheet textures.
import manifest from '../data/sprite-sheets.json';

export interface SheetMeta {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  count: number;
  index: Record<string, number>;
}

const SHEETS = manifest as Record<string, SheetMeta>;

const PIP_SHEET = 'fox-pip';

// Texture keys registered with Phaser (load.spritesheet). Distinct from the
// manifest ids so there's no collision with other texture namespaces.
export function pipTextureKey(): string {
  return 'sheet-fox-pip';
}
export function npcTextureKey(spriteId: string): string {
  return `sheet-npc-${spriteId}`;
}

export function pipSheet(): SheetMeta {
  return SHEETS[PIP_SHEET];
}
export function npcSheet(spriteId: string): SheetMeta {
  return SHEETS[`npc-${spriteId}`];
}

// All packed sheets, as [manifestId, meta] — used by the loader to enqueue each
// spritesheet exactly once.
export function allSheets(): Array<[string, SheetMeta]> {
  return Object.entries(SHEETS);
}

// Resolve a logical frame name to its row-major index in the packed grid.
function frameIndex(meta: SheetMeta, logicalKey: string): number {
  const idx = meta.index[logicalKey];
  if (idx === undefined) throw new Error(`sprite-sheet: unknown frame "${logicalKey}"`);
  return idx;
}

export function pipFrame(anim: string, dir: string, i: number): number {
  return frameIndex(pipSheet(), `${anim}-${dir}-${i}`);
}
export function npcFrame(spriteId: string, anim: string, dir: string, i: number): number {
  return frameIndex(npcSheet(spriteId), `${anim}-${dir}-${i}`);
}
export function npcStaticFrame(spriteId: string, dir: string): number {
  return frameIndex(npcSheet(spriteId), `static-${dir}`);
}
