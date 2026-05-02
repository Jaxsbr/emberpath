import { TILE_SIZE, NPC_SIZE } from '../maps/constants';
import { NpcDefinition } from '../data/areas/types';
import { TerrainId, TERRAINS } from '../maps/terrain';

export type NpcLivePositions = Map<string, { x: number; y: number }>;

// Snapshot of an area's per-cell passability under the tile-architecture model
// (US-94). Constructed once at area load and rebuilt on any flag change that
// affects conditional terrain (US-98) or conditional object collision (US-94).
//
// `terrain`: the (rows+1) × (cols+1) vertex grid from the area definition.
// `objectBlockMap`: cell-keyed runtime lookup `"col,row" → blocks`. Built by
// `GameScene.buildObjectCollisionMap` from the visible+impassable subset of
// `area.objects`. Per-frame collision is O(1) via Map lookup, not per-object
// iteration (Learning EP-01).
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

// Cell-granular passability under the new model (US-94). A cell `(col, row)`
// blocks if EITHER:
//   • The cell hosts an impassable visible object (objectBlockMap lookup), OR
//   • All four bounding vertex terrains have `passable: false` (the cell is
//     entirely impassable terrain — e.g. a fully-flooded cell).
//
// Three-passable + one-impassable terrain corners are treated as walkable —
// collision is cell-granular, not vertex-granular. This keeps gameplay
// legible: "if the cell is mostly impassable, you can't enter; if it's mostly
// passable, you can." Wang's smooth-blend visual is decoupled from collision
// granularity by design.
function cellBlocks(col: number, row: number, p: AreaPassability): boolean {
  const terrain = p.terrain;
  if (!terrain || terrain.length === 0) return true;
  const rowLen = terrain[0].length;
  // Out-of-bounds vertex check — any of the 4 vertices outside the grid blocks.
  if (
    row < 0 ||
    row + 1 >= terrain.length ||
    col < 0 ||
    col + 1 >= rowLen
  ) {
    return true;
  }
  if (p.objectBlockMap.get(`${col},${row}`)) return true;
  const tl = TERRAINS[terrain[row][col]];
  const tr = TERRAINS[terrain[row][col + 1]];
  const br = TERRAINS[terrain[row + 1][col + 1]];
  const bl = TERRAINS[terrain[row + 1][col]];
  if (!tl || !tr || !br || !bl) return true;
  return !tl.passable && !tr.passable && !br.passable && !bl.passable;
}

export function collidesWithWall(
  x: number,
  y: number,
  width: number,
  height: number,
  passability: AreaPassability,
): boolean {
  const left = Math.floor(x / TILE_SIZE);
  const right = Math.floor((x + width - 1) / TILE_SIZE);
  const top = Math.floor(y / TILE_SIZE);
  const bottom = Math.floor((y + height - 1) / TILE_SIZE);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (cellBlocks(col, row, passability)) return true;
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
