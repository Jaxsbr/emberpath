import { TileType } from './constants';

export interface TilesetDefinition {
  atlasKey: string;
  tileFrames: Record<TileType, string[]>;
}

export const TILESETS: Record<string, TilesetDefinition> = {
  'tiny-town': {
    atlasKey: 'tileset-tiny-town',
    tileFrames: {
      [TileType.FLOOR]: ['0', '1', '2'],
      [TileType.WALL]: ['120', '121', '122'],
      [TileType.EXIT]: ['15'],
    },
  },
  'monochrome-rpg': {
    atlasKey: 'tileset-monochrome-rpg',
    tileFrames: {
      [TileType.FLOOR]: ['0', '1', '2'],
      [TileType.WALL]: ['34', '35', '36'],
      [TileType.EXIT]: ['17'],
    },
  },
};

export function hasTileset(tilesetId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TILESETS, tilesetId);
}

function hashCell(col: number, row: number, kind: TileType, tilesetId: string): number {
  let h = 2166136261 >>> 0;
  h = Math.imul(h ^ col, 16777619) >>> 0;
  h = Math.imul(h ^ row, 16777619) >>> 0;
  h = Math.imul(h ^ kind, 16777619) >>> 0;
  for (let i = 0; i < tilesetId.length; i++) {
    h = Math.imul(h ^ tilesetId.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

export function resolveFrame(
  tilesetId: string,
  kind: TileType,
  col: number,
  row: number,
): string | null {
  const ts = TILESETS[tilesetId];
  if (!ts) {
    console.error(`[tilesets] Unknown tileset id: '${tilesetId}'. Known ids: ${Object.keys(TILESETS).join(', ')}`);
    return null;
  }
  const frames = ts.tileFrames[kind];
  if (!frames || frames.length === 0) {
    console.warn(`[tilesets] Tileset '${tilesetId}' has no frames for TileType ${TileType[kind] ?? kind}`);
    return null;
  }
  return frames[hashCell(col, row, kind, tilesetId) % frames.length];
}
