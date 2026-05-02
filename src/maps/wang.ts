// Wang tile resolver (US-93). Samples a cell's 4 vertex terrains, computes the
// 4-bit corner mask, and looks up the picked atlas frame in the registered
// `WangTilesetDefinition.cornerMaskTable`. When a mask is absent (degenerate
// tileset — Kenney atlases register only '0000' + '1111'), falls back to
// `fallbackFrames` and emits a one-time-per-mask warning.
//
// Determinism: when a mask entry has multiple frames, the picked frame is
// chosen by hashing (tilesetId, mask, col, row) via the existing FNV-1a-style
// hash from `tilesets.ts`. This preserves per-cell variation under the
// degenerate Kenney mode (Ashen Isle's 3-frame floor variation isn't lost).

import { TerrainId } from './terrain';
import { TILESETS, hashCell } from './tilesets';

/**
 * Corner-mask convention: terrainIds are listed CLOCKWISE starting from the
 * top-left corner — `[topLeft, topRight, bottomRight, bottomLeft]`.
 *
 * The 4-bit mask is built bit-by-bit in the same order: bit 3 = TL, bit 2 = TR,
 * bit 1 = BR, bit 0 = BL. A `1` at a position means that corner's terrain
 * matches the tileset's `secondaryTerrain` (the upper / blended-in terrain);
 * a `0` means it matches the `primaryTerrain` (the lower / base terrain).
 *
 * Worked example pinning the convention: with tileset `(grass primary, sand
 * secondary)` and corners `[grass, sand, sand, grass]`, the mask is `'0110'`
 * (TR + BR are secondary). NOT `'0011'` or any other ordering.
 *
 * This convention is asserted at module load below.
 */
export type CornerTuple = [TerrainId, TerrainId, TerrainId, TerrainId];

// One-time warning guard. Keyed `${tilesetId}:${mask}` so each absent mask
// warns once per session, not per render call (Learning EP-01: bounded log
// emission, not per-frame spam).
const warnedMasks = new Set<string>();

function maskFromTerrainIds(
  primaryTerrain: TerrainId | null,
  secondaryTerrain: TerrainId | null,
  terrainIds: CornerTuple,
): string {
  let m = 0;
  for (let i = 0; i < 4; i++) {
    const t = terrainIds[i];
    // A corner is "1" (secondary) when it matches the tileset's secondary
    // terrain. When primary === secondary (degenerate mode with no transition),
    // the rule degenerates to: any non-primary corner is "1"; an all-primary
    // grid is mask '0000' which routes to the FLOOR frames.
    let secondary: boolean;
    if (secondaryTerrain && primaryTerrain && primaryTerrain !== secondaryTerrain) {
      secondary = t === secondaryTerrain;
    } else {
      // Degenerate: any non-primary corner is treated as secondary, so
      // all-primary cells produce '0000'. This is what Kenney degenerate
      // tilesets need — a single mask key with FLOOR frames.
      secondary = primaryTerrain ? t !== primaryTerrain : false;
    }
    // bit 3 = TL (i=0), bit 2 = TR (i=1), bit 1 = BR (i=2), bit 0 = BL (i=3)
    if (secondary) m |= (1 << (3 - i));
  }
  return m.toString(2).padStart(4, '0');
}

export function resolveWangFrame(
  tilesetId: string,
  terrainIds: CornerTuple,
  col: number,
  row: number,
): string | null {
  const ts = TILESETS[tilesetId];
  if (!ts || !ts.wang) {
    console.error(
      `[wang] Unknown tileset id or missing wang block: '${tilesetId}'. Known ids: ${Object.keys(TILESETS).join(', ')}`,
    );
    return null;
  }
  const def = ts.wang;
  const mask = maskFromTerrainIds(def.primaryTerrain, def.secondaryTerrain, terrainIds);
  const frames = def.cornerMaskTable[mask];
  if (frames && frames.length > 0) {
    const idx = hashCellMask(tilesetId, mask, col, row) % frames.length;
    return frames[idx];
  }
  // Absent mask — degenerate fallback. Warn once per (tilesetId, mask).
  const key = `${tilesetId}:${mask}`;
  if (!warnedMasks.has(key)) {
    warnedMasks.add(key);
    console.warn(
      `[wang] '${tilesetId}' has no entry for mask '${mask}' (expected: secondaryTerrain transition). Falling back to fallbackFrames.`,
    );
  }
  if (def.fallbackFrames.length === 0) return null;
  const idx = hashCellMask(tilesetId, mask, col, row) % def.fallbackFrames.length;
  return def.fallbackFrames[idx];
}

function hashCellMask(tilesetId: string, mask: string, col: number, row: number): number {
  // Reuse the FNV-1a-style mixer from tilesets.hashCell so per-cell variation
  // matches the legacy per-cell determinism. We re-derive here rather
  // than importing the legacy fn directly because the legacy signature was
  // `(col, row, kind, tilesetId)` numeric kind axis; here the `kind` axis is
  // the mask string instead, mixed character-by-character.
  let h = 2166136261 >>> 0;
  h = Math.imul(h ^ col, 16777619) >>> 0;
  h = Math.imul(h ^ row, 16777619) >>> 0;
  for (let i = 0; i < tilesetId.length; i++) {
    h = Math.imul(h ^ tilesetId.charCodeAt(i), 16777619) >>> 0;
  }
  for (let i = 0; i < mask.length; i++) {
    h = Math.imul(h ^ mask.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
}

// Re-export hashCell so consumers needing the legacy hash can find it via wang.ts.
export { hashCell };

// ───── Per-cell tileset selection (US-98) ─────
//
// Under the multi-pair authoring model an area can paint cells with any
// combination of registered terrains, but each Wang tileset is a single
// (primary, secondary) pair. The renderer must therefore pick the matching
// tileset per cell based on the cell's corner-terrain set.
//
// Algorithm: collect the unique terrains across the 4 corners. If only one
// terrain is present, find a tileset where it is the primary; the cell
// renders at mask '0000'. If two terrains are present, find the tileset
// whose (primary, secondary) pair matches; the cell's mask is computed
// against that tileset. Three or more distinct terrains in a single cell
// are not authored under the supported tileset registry — fall back to the
// area's `defaultTilesetId` so the renderer still produces a frame.
//
// Match preference when multiple tilesets satisfy the constraint (e.g.
// marsh-floor appears as primary in three Fog Marsh tilesets):
//   1. Exact (primary, secondary) match.
//   2. Single-terrain cell — first tileset where the terrain is primary.
//   3. Fall back to defaultTilesetId.
//
// The function is pure / deterministic; per-frame O(N) over TILESETS — but
// N = 7 today, so the cost is trivial. If TILESETS grows >100 in some
// future expansion, swap to a `Map<TerrainPair, tilesetId>` index built at
// module load.

export function pickWangTilesetForCell(
  corners: CornerTuple,
  defaultTilesetId: string,
): string {
  const unique = Array.from(new Set(corners));
  // Single-terrain cell: prefer a tileset where this terrain is the primary.
  if (unique.length === 1) {
    const t = unique[0];
    for (const [id, def] of Object.entries(TILESETS)) {
      if (def.wang.primaryTerrain === t) return id;
    }
    // Fallback: any tileset that registers this terrain at all.
    for (const [id, def] of Object.entries(TILESETS)) {
      if (def.wang.primaryTerrain === t || def.wang.secondaryTerrain === t) return id;
    }
    return defaultTilesetId;
  }
  // Two-terrain cell: find the (primary, secondary) match in either order.
  if (unique.length === 2) {
    const [a, b] = unique;
    for (const [id, def] of Object.entries(TILESETS)) {
      const p = def.wang.primaryTerrain;
      const s = def.wang.secondaryTerrain;
      if (s === null) continue; // degenerate tileset can't represent a transition
      if ((p === a && s === b) || (p === b && s === a)) return id;
    }
    // Fallback to the default tileset; the cell will render with whatever
    // mask the default tileset's pair produces — visually wrong but
    // mechanically intact.
    return defaultTilesetId;
  }
  // 3+ distinct terrains in a single cell — not supported by the registry.
  return defaultTilesetId;
}

// ───── Boot-time corner-clockwise convention assertion ─────
//
// Pinned per the spec: a synthetic terrain grid with corners
// [grass, sand, sand, grass] must produce mask '0110' (TR + BR are secondary).
// Runs once at module import; throws on mismatch so a future refactor can't
// silently flip the convention. See US-93 done-when.

(function assertCornerConvention(): void {
  const m = maskFromTerrainIds('grass', 'sand', ['grass', 'sand', 'sand', 'grass']);
  if (m !== '0110') {
    throw new Error(
      `[wang] Corner-clockwise convention broken: expected '0110' for [grass, sand, sand, grass] under (primary=grass, secondary=sand), got '${m}'.`,
    );
  }
})();
