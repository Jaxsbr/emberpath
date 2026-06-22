import { describe, it, expect } from 'vitest';
import {
  AreaPassability,
  subCellBlocks,
  cellBlocks,
  collidesWithWall,
  characterBox,
} from '../src/systems/collision';
import { TerrainId } from '../src/maps/terrain';
import { TILE_SIZE, SUB_SIZE, COLLISION_SUBDIV } from '../src/maps/constants';

const NPCish = 20;

// Build a (rows × cols) cell map of uniform terrain → (rows+1)×(cols+1) vertex grid.
function uniformTerrain(rows: number, cols: number, id: TerrainId): TerrainId[][] {
  const grid: TerrainId[][] = [];
  for (let r = 0; r <= rows; r++) {
    grid.push(new Array(cols + 1).fill(id));
  }
  return grid;
}

// Block the listed sub-cells (absolute scol,srow) in a fresh objectBlockMap.
function blockMap(subCells: Array<[number, number]>): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const [scol, srow] of subCells) m.set(`${scol},${srow}`, true);
  return m;
}

describe('FB-23 sub-cell object collision', () => {
  it('blocks only the authored sub-cells, not the rest of the parent tile', () => {
    // Rock at anchor cell (2,2). Authored shape = the centre/lower sub-cells
    // (the rock's actual footprint), mirroring object-shapes.json "rock".
    // Cell (2,2)'s sub-cells span scol/srow 8..11 (2 * COLLISION_SUBDIV = 8).
    const base = 2 * COLLISION_SUBDIV;
    const authored: Array<[number, number]> = [
      [base + 1, base + 1], [base + 2, base + 1],
      [base + 1, base + 2], [base + 2, base + 2],
      [base + 1, base + 3], [base + 2, base + 3],
    ];
    const p: AreaPassability = {
      terrain: uniformTerrain(5, 5, 'grass'),
      objectBlockMap: blockMap(authored),
    };

    // An authored sub-cell blocks.
    expect(subCellBlocks(base + 1, base + 1, p)).toBe(true);
    // The top-left sub-cell of the SAME tile is empty (the rock doesn't fill it).
    expect(subCellBlocks(base, base, p)).toBe(false);
    // The top-right corner sub-cell is empty too.
    expect(subCellBlocks(base + 3, base, p)).toBe(false);
  });

  it('lets the player AABB graze the empty corner of a rock tile but stops on its body', () => {
    const base = 2 * COLLISION_SUBDIV;
    const authored: Array<[number, number]> = [
      [base + 1, base + 1], [base + 2, base + 1],
      [base + 1, base + 2], [base + 2, base + 2],
    ];
    const p: AreaPassability = {
      terrain: uniformTerrain(5, 5, 'grass'),
      objectBlockMap: blockMap(authored),
    };

    // A 6px probe sitting in the tile's empty top-left corner — clear.
    const cornerX = 2 * TILE_SIZE; // top-left px of cell (2,2)
    const cornerY = 2 * TILE_SIZE;
    expect(collidesWithWall(cornerX, cornerY, 6, 6, p)).toBe(false);

    // The same probe over the rock body (sub-cell base+1) — blocked.
    const bodyX = 2 * TILE_SIZE + SUB_SIZE + 1;
    const bodyY = 2 * TILE_SIZE + SUB_SIZE + 1;
    expect(collidesWithWall(bodyX, bodyY, 6, 6, p)).toBe(true);
  });
});

describe('FB-23 back-compat + terrain', () => {
  it('cellBlocks reports a cell blocked when ANY of its sub-cells carries object collision', () => {
    const p: AreaPassability = {
      terrain: uniformTerrain(5, 5, 'grass'),
      objectBlockMap: blockMap([[2 * COLLISION_SUBDIV + 2, 2 * COLLISION_SUBDIV + 2]]),
    };
    expect(cellBlocks(2, 2, p)).toBe(true);
    expect(cellBlocks(3, 3, p)).toBe(false);
  });

  it('terrain stays cell-grained: an impassable cell blocks every sub-cell', () => {
    const p: AreaPassability = {
      terrain: uniformTerrain(5, 5, 'water'),
      objectBlockMap: new Map(),
    };
    // Both cell- and sub-cell predicates agree the whole cell is closed.
    expect(cellBlocks(2, 2, p)).toBe(true);
    for (let sy = 0; sy < COLLISION_SUBDIV; sy++) {
      for (let sx = 0; sx < COLLISION_SUBDIV; sx++) {
        expect(subCellBlocks(2 * COLLISION_SUBDIV + sx, 2 * COLLISION_SUBDIV + sy, p)).toBe(true);
      }
    }
  });

  it('passable terrain with no objects is fully walkable', () => {
    const p: AreaPassability = {
      terrain: uniformTerrain(5, 5, 'grass'),
      objectBlockMap: new Map(),
    };
    expect(cellBlocks(2, 2, p)).toBe(false);
    expect(subCellBlocks(9, 9, p)).toBe(false);
    expect(collidesWithWall(2 * TILE_SIZE, 2 * TILE_SIZE, NPCish, NPCish, p)).toBe(false);
  });

  it('out-of-bounds sub-cells block (closed world)', () => {
    const p: AreaPassability = {
      terrain: uniformTerrain(5, 5, 'grass'),
      objectBlockMap: new Map(),
    };
    expect(subCellBlocks(-1, 0, p)).toBe(true);
    expect(subCellBlocks(0, -1, p)).toBe(true);
    // Beyond the last cell (cells 0..4, so sub-cells 0..19 valid for the 5×5 map;
    // a sub-cell whose parent cell is the boundary cell 5 is OOB).
    expect(subCellBlocks(5 * COLLISION_SUBDIV, 0, p)).toBe(true);
  });
});

describe('#185 characterBox', () => {
  it('falls back to the legacy feet-square centred on the sprite when unauthored', () => {
    // null collision → exactly the pre-#185 behaviour: a fallbackSize square
    // centred on (cx, cy). This is the zero-regression guarantee.
    const cx = 100;
    const cy = 200;
    const size = 24;
    const box = characterBox(cx, cy, null, size);
    expect(box).toEqual({ x: cx - size / 2, y: cy - size / 2, width: size, height: size });
  });

  it('reproduces a legacy NPC grid placement byte-identically when unauthored', () => {
    // Legacy getNpcBounds for a still NPC: cx = col*TILE + TILE/2. With null
    // collision the box must be the NPC_SIZE square recovered from that centre.
    const col = 3;
    const cx = col * TILE_SIZE + TILE_SIZE / 2;
    const cy = 2 * TILE_SIZE + TILE_SIZE / 2;
    const size = 24;
    const box = characterBox(cx, cy, null, size);
    // Equivalent to the old `col*TILE + (TILE - size)/2` top-left.
    expect(box.x).toBe(col * TILE_SIZE + (TILE_SIZE - size) / 2);
    expect(box.width).toBe(size);
  });

  it('places an authored rect by its centre offset from the sprite centre', () => {
    // A body box hugging the lower torso: 18×14, dropped 6px toward the feet.
    const cx = 100;
    const cy = 200;
    const col = { w: 18, h: 14, dx: 0, dy: 6 };
    const box = characterBox(cx, cy, col, 24);
    expect(box).toEqual({
      x: cx + col.dx - col.w / 2, // 100 - 9 = 91
      y: cy + col.dy - col.h / 2, // 200 + 6 - 7 = 199
      width: 18,
      height: 14,
    });
  });

  it('honours a horizontal offset (dx) too', () => {
    const box = characterBox(50, 50, { w: 10, h: 10, dx: 4, dy: -2 }, 24);
    expect(box.x).toBe(50 + 4 - 5); // 49
    expect(box.y).toBe(50 - 2 - 5); // 43
  });
});
