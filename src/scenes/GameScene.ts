import Phaser from 'phaser';
import { TILE_SIZE, MAP_COLS, MAP_ROWS, TileType } from '../maps/constants';
import { worldMap } from '../maps/worldMap';
import { InputSystem } from '../systems/input';
import { moveWithCollision } from '../systems/movement';
import { npcs, NPC_SIZE } from '../data/npcs';
import { dialogues } from '../data/dialogues';
import { NpcInteractionSystem } from '../systems/npcInteraction';
import { DialogueSystem } from '../systems/dialogue';

const FLOOR_COLOR = 0x4a6741; // muted green — walkable space
const WALL_COLOR = 0x2c2c3a;  // dark slate — solid barrier
const PLAYER_COLOR = 0xd4a24e; // warm gold — the character you control
const PLAYER_SIZE = 24; // slightly smaller than tile for visual clearance

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private npcInteraction!: NpcInteractionSystem;
  private dialogueSystem!: DialogueSystem;
  private player!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.renderTileMap();
    this.renderNpcs();
    this.createPlayer();
    this.setupCamera();
    this.inputSystem = new InputSystem(this);
    this.dialogueSystem = new DialogueSystem(this);
    this.npcInteraction = new NpcInteractionSystem(this);
    this.npcInteraction.setInteractionCallback((npc) => {
      const script = dialogues[`${npc.id}-intro`];
      if (script) {
        this.dialogueSystem.start(script);
      }
    });
  }

  update(_time: number, delta: number): void {
    // Zone-level mutual exclusion: dialogue suppresses movement, NPC interaction, triggers
    if (this.dialogueSystem.isActive) {
      this.dialogueSystem.update();
      return;
    }

    this.inputSystem.update();
    const velocity = this.inputSystem.getVelocity();
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    const newPos = moveWithCollision(
      {
        x: this.player.x - offset,
        y: this.player.y - offset,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
      },
      velocity,
      delta,
    );
    this.player.setPosition(newPos.x + offset, newPos.y + offset);

    const playerCenterX = this.player.x + PLAYER_SIZE / 2;
    const playerCenterY = this.player.y + PLAYER_SIZE / 2;
    this.npcInteraction.update(playerCenterX, playerCenterY);
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

  private renderNpcs(): void {
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    for (const npc of npcs) {
      const x = npc.col * TILE_SIZE + offset;
      const y = npc.row * TILE_SIZE + offset;
      const rect = this.add.rectangle(x, y, NPC_SIZE, NPC_SIZE, npc.color);
      rect.setOrigin(0, 0);
      rect.setDepth(5); // entities depth layer
    }
  }

  private setupCamera(): void {
    const mapWidth = MAP_COLS * TILE_SIZE;
    const mapHeight = MAP_ROWS * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.startFollow(this.player);
  }

  private createPlayer(): void {
    // Start in an open floor area (row 2, col 2 — inside the walled perimeter)
    const startCol = 2;
    const startRow = 2;
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    const x = startCol * TILE_SIZE + offset;
    const y = startRow * TILE_SIZE + offset;

    this.player = this.add.rectangle(x, y, PLAYER_SIZE, PLAYER_SIZE, PLAYER_COLOR);
    this.player.setOrigin(0, 0);
    this.player.setDepth(5); // entities at depth 5
  }
}
