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
  'tiny-dungeon': {
    atlasKey: 'tileset-tiny-dungeon',
    tileFrames: {
      // Tan/orange dungeon floor (row 4 start — clearly distinct from brick walls).
      [TileType.FLOOR]: ['48', '49', '50', '51'],
      // Brown dark brick wall tops (row 0 start — strong color contrast with tan floor).
      [TileType.WALL]: ['0', '1', '2'],
      // Wooden door tile — reads as threshold.
      [TileType.EXIT]: ['22'],
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
