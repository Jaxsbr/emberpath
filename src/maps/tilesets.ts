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

export interface TilesetDefinition {
  atlasKey: string;
  // Wang block. Stage 1 registers `tiny-town` and `tiny-dungeon` as
  // degenerate Wang tilesets — `cornerMaskTable['0000']` lists the existing
  // FLOOR frames, `cornerMaskTable['1111']` lists the existing WALL frames,
  // every other mask is intentionally omitted. Stage 2 (US-95) replaces the
  // Kenney atlases with PixelLab-generated tilesets that populate all 16
  // mask entries.
  wang: WangTilesetDefinition;
}

export const TILESETS: Record<string, TilesetDefinition> = {
  'tiny-town': {
    atlasKey: 'tileset-tiny-town',
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
    // Degenerate Wang — replaced by US-95 PixelLab marsh-floor→path,
    // marsh-floor→water, marsh-floor→stone tilesets. Tiny Dungeon has no native
    // wet/marsh frames; the wet-vs-dry contrast in fog-marsh is achieved during
    // stage 1 by the wooden-plank decoration overlay (frames 36/37) — replaced
    // by proper marsh-floor→path Wang transitions in US-95.
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

// FNV-1a-style mixer used by wang.ts hashCellMask for per-cell variation.
// `kind` is included in the mix so future per-frame-class hashing (e.g.
// terrain-class vs object-class) can re-key without colliding.
export function hashCell(col: number, row: number, kind: number, tilesetId: string): number {
  let h = 2166136261 >>> 0;
  h = Math.imul(h ^ col, 16777619) >>> 0;
  h = Math.imul(h ^ row, 16777619) >>> 0;
  h = Math.imul(h ^ kind, 16777619) >>> 0;
  for (let i = 0; i < tilesetId.length; i++) {
    h = Math.imul(h ^ tilesetId.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

