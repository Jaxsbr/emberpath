import { TileType, MAP_COLS, MAP_ROWS } from './constants';

const F = TileType.FLOOR;
const W = TileType.WALL;

// 25 cols × 19 rows — walled perimeter with open interior and interior walls
export const worldMap: TileType[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
  [W,F,F,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,F,F,W],
  [W,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,W],
  [W,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,W],
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,W,W,W,F,W,W,W,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
  [W,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,W],
  [W,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,W],
  [W,F,F,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,F,F,W],
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];

// Validate dimensions match constants
if (worldMap.length !== MAP_ROWS) {
  throw new Error(`worldMap has ${worldMap.length} rows, expected ${MAP_ROWS}`);
}
for (let r = 0; r < worldMap.length; r++) {
  if (worldMap[r].length !== MAP_COLS) {
    throw new Error(`worldMap row ${r} has ${worldMap[r].length} cols, expected ${MAP_COLS}`);
  }
}
