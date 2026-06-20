import { TILE_SIZE, SUB_SIZE, COLLISION_SUBDIV, NPC_SIZE } from '../maps/constants';
import { NpcDefinition } from '../data/areas/types';
import { TerrainId, TERRAINS } from '../maps/terrain';

export type NpcLivePositions = Map<string, { x: number; y: number }>;

// Snapshot of an area's per-cell passability under the tile-architecture model
// (US-94). Constructed once at area load and rebuilt on any flag change that
// affects conditional terrain (US-98) or conditional object collision (US-94).
//
// `terrain`: the (rows+1) × (cols+1) vertex grid from the area definition.
// `objectBlockMap`: SUB-CELL-keyed runtime lookup `"scol,srow" → blocks` (FB-23).
// Built by `GameScene.buildObjectCollisionMap` from the visible+impassable subset
// of `area.objects`, at SUB_SIZE (8px) granularity so a kind's collision can hug
// its sprite. Per-frame collision is O(1) via Map lookup, not per-object iteration
// (Learning EP-01). Pre-FB-23 this was cell-keyed; a kind with no authored shape
// still fills every sub-cell of its anchor/footprint cells, so behaviour is
// identical until a kind is migrated.
//
// Out-of-bounds cells are treated as blocking (preserved from the legacy
// behaviour) — keeps the world a closed shape without per-area boundary
// declarations.
export interface AreaPassability {
  terrain: TerrainId[][];
  objectBlockMap: Map<string, boolean>;
}

function getNpcBounds(
  npc: NpcDefinition,
  livePositions?: NpcLivePositions,
): { x: number; y: number; width: number; height: number } {
  const live = livePositions?.get(npc.id);
  if (live) {
    return {
      x: live.x - NPC_SIZE / 2,
      y: live.y - NPC_SIZE / 2,
      width: NPC_SIZE,
      height: NPC_SIZE,
    };
  }
  const offset = (TILE_SIZE - NPC_SIZE) / 2;
  return {
    x: npc.col * TILE_SIZE + offset,
    y: npc.row * TILE_SIZE + offset,
    width: NPC_SIZE,
    height: NPC_SIZE,
  };
}

// Cell-granular TERRAIN passability (US-94). A cell `(col, row)` blocks on terrain
// if all four bounding vertex terrains have `passable: false` (the cell is entirely
// impassable terrain — e.g. a fully-flooded cell). Out-of-bounds blocks.
//
// Three-passable + one-impassable terrain corners are treated as walkable —
// collision is cell-granular, not vertex-granular. This keeps gameplay legible:
// "if the cell is mostly impassable, you can't enter; if it's mostly passable, you
// can." Wang's smooth-blend visual is decoupled from collision granularity by
// design. Object collision is handled separately at sub-cell granularity (FB-23).
function terrainBlocksCell(col: number, row: number, terrain: TerrainId[][]): boolean {
  if (!terrain || terrain.length === 0) return true;
  const rowLen = terrain[0].length;
  // Out-of-bounds vertex check — any of the 4 vertices outside the grid blocks.
  if (row < 0 || row + 1 >= terrain.length || col < 0 || col + 1 >= rowLen) {
    return true;
  }
  const tl = TERRAINS[terrain[row][col]];
  const tr = TERRAINS[terrain[row][col + 1]];
  const br = TERRAINS[terrain[row + 1][col + 1]];
  const bl = TERRAINS[terrain[row + 1][col]];
  if (!tl || !tr || !br || !bl) return true;
  return !tl.passable && !tr.passable && !br.passable && !bl.passable;
}

// Sub-cell passability (FB-23). A sub-cell `(scol, srow)` blocks if EITHER an
// authored object collision sub-cell sits there (objectBlockMap lookup, sub-cell
// keyed), OR the terrain at its PARENT cell is impassable. Terrain stays
// cell-grained; the object layer is the finer one. This is the per-frame predicate
// the player/NPC AABB sweep runs against.
export function subCellBlocks(scol: number, srow: number, p: AreaPassability): boolean {
  if (p.objectBlockMap.get(`${scol},${srow}`)) return true;
  const col = Math.floor(scol / COLLISION_SUBDIV);
  const row = Math.floor(srow / COLLISION_SUBDIV);
  return terrainBlocksCell(col, row, p.terrain);
}

// Cell-granular predicate retained for the per-area collision editor seed and the
// staging porter (both think in whole cells). A cell blocks if its terrain blocks
// OR ANY of its sub-cells carries object collision. Not used on the per-frame
// path — that's `subCellBlocks` via `collidesWithWall`.
export function cellBlocks(col: number, row: number, p: AreaPassability): boolean {
  if (terrainBlocksCell(col, row, p.terrain)) return true;
  const baseSCol = col * COLLISION_SUBDIV;
  const baseSRow = row * COLLISION_SUBDIV;
  for (let sy = 0; sy < COLLISION_SUBDIV; sy++) {
    for (let sx = 0; sx < COLLISION_SUBDIV; sx++) {
      if (p.objectBlockMap.get(`${baseSCol + sx},${baseSRow + sy}`)) return true;
    }
  }
  return false;
}

export function collidesWithWall(
  x: number,
  y: number,
  width: number,
  height: number,
  passability: AreaPassability,
): boolean {
  const left = Math.floor(x / SUB_SIZE);
  const right = Math.floor((x + width - 1) / SUB_SIZE);
  const top = Math.floor(y / SUB_SIZE);
  const bottom = Math.floor((y + height - 1) / SUB_SIZE);

  for (let srow = top; srow <= bottom; srow++) {
    for (let scol = left; scol <= right; scol++) {
      if (subCellBlocks(scol, srow, passability)) return true;
    }
  }
  return false;
}

export function collidesWithNpc(
  x: number, y: number, width: number, height: number,
  npcs: NpcDefinition[],
  livePositions?: NpcLivePositions,
): boolean {
  for (const npc of npcs) {
    const bounds = getNpcBounds(npc, livePositions);
    if (
      x < bounds.x + bounds.width &&
      x + width > bounds.x &&
      y < bounds.y + bounds.height &&
      y + height > bounds.y
    ) {
      return true;
    }
  }
  return false;
}
