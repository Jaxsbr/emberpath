import Phaser from 'phaser';
import { TILE_SIZE, MAP_COLS, MAP_ROWS, TileType } from '../maps/constants';
import { worldMap } from '../maps/worldMap';

const FLOOR_COLOR = 0x4a6741; // muted green — walkable space
const WALL_COLOR = 0x2c2c3a;  // dark slate — solid barrier

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.renderTileMap();
  }

  private renderTileMap(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(0); // tiles at depth 0

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = worldMap[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const color = tile === TileType.WALL ? WALL_COLOR : FLOOR_COLOR;
        graphics.fillStyle(color);
        graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
