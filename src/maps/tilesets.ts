import { TileType } from './constants';
import { TerrainId } from './terrain';

// ───── Wang tileset definition (US-93) ─────
//
// `cornerMaskTable` is keyed by 4-bit binary strings `'0000'`..`'1111'` and
// values are arrays of frame strings. The Wang resolver hash-picks within the
// mask's array for per-cell variation. Multiple frames per mask are permitted.
//
// `fallbackFrames` is the resolver's escape hatch for absent-mask lookups —
// used by the degenerate Kenney tilesets registered below, which only register
// the all-primary mask `'0000'` and the all-secondary mask `'1111'`. The
// resolver also emits a one-time-per-mask `console.warn` when it falls back,
// making missing transitions discoverable without log spam.
//
// `primaryTerrain` and `secondaryTerrain` name the two terrains the tileset
// blends between (lower / upper in PixelLab parlance). `secondaryTerrain` is
// `null` for degenerate tilesets where every cell is conceptually the same
// terrain — Kenney atlases pre-US-95 fall in this bucket.

export interface WangTilesetDefinition {
  primaryTerrain: TerrainId;
  secondaryTerrain: TerrainId | null;
  cornerMaskTable: Record<string, string[]>;
  fallbackFrames: string[];
}

// Legacy flat-bucket definition retained alongside the wang block for stage 1
// rendering — GameScene still reads `tileFrames` until the renderer migrates
// to the wang resolver in US-94. Final removal lands at the end of stage 1.
export interface TilesetDefinition {
  atlasKey: string;
  tileFrames: Record<TileType, string[]>;
  // Optional Wang block. Stage 1 registers `tiny-town` and `tiny-dungeon` as
  // degenerate Wang tilesets — `cornerMaskTable['0000']` lists the existing
  // FLOOR frames, `cornerMaskTable['1111']` lists the existing WALL frames,
  // every other mask is intentionally omitted. Stage 2 (US-95) replaces the
  // Kenney atlases with PixelLab-generated tilesets that populate all 16
  // mask entries.
  wang?: WangTilesetDefinition;
}

export const TILESETS: Record<string, TilesetDefinition> = {
  'tiny-town': {
    atlasKey: 'tileset-tiny-town',
    tileFrames: {
      [TileType.FLOOR]: ['0', '1', '2'],
      [TileType.WALL]: ['120', '121', '122'],
      [TileType.EXIT]: ['15'],
    },
    // Degenerate Wang — no transition tiles registered. Replaced by US-95
    // PixelLab grass→sand and sand→path tilesets when content lands.
    wang: {
      primaryTerrain: 'grass',
      secondaryTerrain: null,
      cornerMaskTable: {
        '0000': ['0', '1', '2'],
        '1111': ['120', '121', '122'],
      },
      fallbackFrames: ['0', '1', '2'],
    },
  },
  'tiny-dungeon': {
    atlasKey: 'tileset-tiny-dungeon',
    tileFrames: {
      // Tan dungeon floor (row 4 start). Tiny Dungeon has no native wet/marsh
      // frames; the wet-vs-dry contrast in fog-marsh.ts is achieved by overlaying
      // wooden-plank decoration ('36'/'37') as a dry path on top of this base
      // tan floor. See docs/tilesets/tiny-dungeon.md for the substitution.
      [TileType.FLOOR]: ['48', '49', '50', '51'],
      // Brown dark brick wall tops (row 0 start — strong color contrast with tan floor).
      [TileType.WALL]: ['0', '1', '2'],
      // Wooden door tile — reads as threshold.
      [TileType.EXIT]: ['22'],
    },
    // Degenerate Wang — replaced by US-95 PixelLab marsh-floor→path,
    // marsh-floor→water, marsh-floor→stone tilesets.
    wang: {
      primaryTerrain: 'marsh-floor',
      secondaryTerrain: null,
      cornerMaskTable: {
        '0000': ['48', '49', '50', '51'],
        '1111': ['0', '1', '2'],
      },
      fallbackFrames: ['48', '49', '50', '51'],
    },
  },
};

export function hasTileset(tilesetId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TILESETS, tilesetId);
}

export function hashCell(col: number, row: number, kind: TileType, tilesetId: string): number {
  let h = 2166136261 >>> 0;
  h = Math.imul(h ^ col, 16777619) >>> 0;
  h = Math.imul(h ^ row, 16777619) >>> 0;
  h = Math.imul(h ^ kind, 16777619) >>> 0;
  for (let i = 0; i < tilesetId.length; i++) {
    h = Math.imul(h ^ tilesetId.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

// Legacy flat-bucket resolver — retained for stage-1 GameScene rendering until
// the renderer migrates to the wang resolver. Removed at end of stage 1.
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
