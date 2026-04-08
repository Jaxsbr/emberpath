import { TileType, MAP_COLS, MAP_ROWS } from './constants';

const F = TileType.FLOOR;
const W = TileType.WALL;

// 50 cols × 38 rows — walled perimeter with rooms, corridors, and open areas
// Map is 1600×1216 px at 32px tiles — ~4x the 800×600 canvas, requiring camera scrolling
export const worldMap: TileType[][] = [
  //0                                                                                              49
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 0
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 1
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 2
  [W,F,F,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,W,W,W,F,F,W,F,F,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,F,F,W], // 3
  [W,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,W,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,W], // 4
  [W,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,W], // 5
  [W,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,W,W,F,W,W,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,W], // 6
  [W,F,F,W,W,F,W,W,F,F,F,F,F,F,F,F,F,F,F,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,F,W,W,F,F,W], // 7
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 8
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 9
  [W,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W], // 10
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W], // 11
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W], // 12
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W], // 13
  [W,F,F,F,F,F,F,F,F,W,W,W,W,F,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,F,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W], // 14
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 15
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 16
  [W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W], // 17
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 18
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 19
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 20
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,F,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 21
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 22
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 23
  [W,F,F,W,W,W,W,W,F,F,F,F,F,F,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,F,F,F,F,F,F,W,W,W,W,F,F,W], // 24
  [W,F,F,W,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,W,F,F,W], // 25
  [W,F,F,W,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,W,F,F,W], // 26
  [W,F,F,W,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,W,F,F,W], // 27
  [W,F,F,W,W,F,W,W,F,F,F,F,F,F,W,W,W,F,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,F,W,W,W,F,F,F,F,F,F,W,W,F,W,F,F,W], // 28
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 29
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 30
  [W,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,W], // 31
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W], // 32
  [W,F,F,F,F,F,F,F,F,W,F,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,F,W], // 33
  [W,F,F,F,F,F,F,F,F,W,W,W,F,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,F,W,W,W,F,F,F,F,F,F,F,F,W], // 34
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 35
  [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 36
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 37
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
