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

// PixelLab-generated Wang tilesets (US-95). Each has all 16 mask entries
// populated — the resolver always finds a frame and never falls back. Stage-1
// Kenney degenerate tilesets retained until US-98 deletes them along with
// the legacy atlas directories. The PixelLab tilesets share an identical
// frame layout (4×4 grid, mask→frame mapping) because the spritesheet was
// produced by the same `tileset15` algorithm — see assets/tilesets/<id>/
// tilemap.json for per-tileset metadata, and tools/wire-tilesets.ts for the
// parser that produced these entries.

function pixellabCornerMaskTable(): Record<string, string[]> {
  return {
    '0000': ['6'],
    '0001': ['10'],
    '0010': ['7'],
    '0011': ['9'],
    '0100': ['2'],
    '0101': ['4'],
    '0110': ['11'],
    '0111': ['15'],
    '1000': ['5'],
    '1001': ['1'],
    '1010': ['14'],
    '1011': ['8'],
    '1100': ['3'],
    '1101': ['13'],
    '1110': ['0'],
    '1111': ['12'],
  };
}
const PIXELLAB_FALLBACK_FRAMES = (): string[] => ['6']; // mask '0000' = all-primary

export const TILESETS: Record<string, TilesetDefinition> = {
  // ───── PixelLab Wang tilesets — Ashen Isle chain ─────
  'ashen-isle-grass-sand': {
    atlasKey: 'tileset-ashen-isle-grass-sand',
    wang: {
      primaryTerrain: 'grass',
      secondaryTerrain: 'sand',
      cornerMaskTable: pixellabCornerMaskTable(),
      fallbackFrames: PIXELLAB_FALLBACK_FRAMES(),
    },
  },
  'ashen-isle-sand-path': {
    atlasKey: 'tileset-ashen-isle-sand-path',
    wang: {
      primaryTerrain: 'sand',
      secondaryTerrain: 'path',
      cornerMaskTable: pixellabCornerMaskTable(),
      fallbackFrames: PIXELLAB_FALLBACK_FRAMES(),
    },
  },
  // ───── PixelLab Wang tilesets — Fog Marsh chain ─────
  'fog-marsh-floor-path': {
    atlasKey: 'tileset-fog-marsh-floor-path',
    wang: {
      primaryTerrain: 'marsh-floor',
      secondaryTerrain: 'path',
      cornerMaskTable: pixellabCornerMaskTable(),
      fallbackFrames: PIXELLAB_FALLBACK_FRAMES(),
    },
  },
  'fog-marsh-floor-water': {
    atlasKey: 'tileset-fog-marsh-floor-water',
    wang: {
      primaryTerrain: 'marsh-floor',
      secondaryTerrain: 'water',
      cornerMaskTable: pixellabCornerMaskTable(),
      fallbackFrames: PIXELLAB_FALLBACK_FRAMES(),
    },
  },
  'fog-marsh-floor-stone': {
    atlasKey: 'tileset-fog-marsh-floor-stone',
    wang: {
      primaryTerrain: 'marsh-floor',
      secondaryTerrain: 'stone',
      cornerMaskTable: pixellabCornerMaskTable(),
      fallbackFrames: PIXELLAB_FALLBACK_FRAMES(),
    },
  },
  // ───── Briar Wilds (US-100) ─────
  // PixelLab Wang tileset, briar-floor (lower) -> briar-thorn (upper).
  // Generated 2026-05-04 against mcp__pixellab__ (personal account) — Learning
  // EP-05 budget logged in phase log T12. Atlas committed to
  // assets/tilesets/briar-wilds-floor-thorn/tilemap.{png,json}.
  'briar-wilds-floor-thorn': {
    atlasKey: 'tileset-briar-wilds-floor-thorn',
    wang: {
      primaryTerrain: 'briar-floor',
      secondaryTerrain: 'briar-thorn',
      cornerMaskTable: pixellabCornerMaskTable(),
      fallbackFrames: PIXELLAB_FALLBACK_FRAMES(),
    },
  },

  // ───── Legacy Kenney degenerate tilesets — pending US-98 deletion ─────
  // Retained so the editor's tools/editor renderer keeps loading until US-97
  // rewrites it; both areas now reference the PixelLab tilesets above.
  'tiny-town': {
    atlasKey: 'tileset-tiny-town',
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

