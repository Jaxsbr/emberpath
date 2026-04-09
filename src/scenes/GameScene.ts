import Phaser from 'phaser';
import { TILE_SIZE, MAP_COLS, MAP_ROWS, TileType } from '../maps/constants';
import { worldMap } from '../maps/worldMap';
import { InputSystem } from '../systems/input';
import { moveWithCollision } from '../systems/movement';
import { npcs, NPC_SIZE } from '../data/npcs';
import { dialogues } from '../data/dialogues';
import { storyScenes, StorySceneDefinition } from '../data/story-scenes';
import { NpcInteractionSystem } from '../systems/npcInteraction';
import { DialogueSystem } from '../systems/dialogue';
import { ThoughtBubbleSystem } from '../systems/thoughtBubble';
import { TriggerZoneSystem } from '../systems/triggerZone';
import { setFlag } from '../triggers/flags';

const FLOOR_COLOR = 0x4a6741; // muted green — walkable space
const WALL_COLOR = 0x2c2c3a;  // dark slate — solid barrier
const PLAYER_COLOR = 0xd4a24e; // warm gold — the character you control
const PLAYER_SIZE = 24; // slightly smaller than tile for visual clearance

// Target tile count along the viewport's shorter axis. Camera zoom scales so
// roughly this many tiles are visible, keeping characters and text readable
// regardless of device resolution or orientation.
const TARGET_VISIBLE_TILES = 10;

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private npcInteraction!: NpcInteractionSystem;
  private dialogueSystem!: DialogueSystem;
  private thoughtBubble!: ThoughtBubbleSystem;
  private triggerZone!: TriggerZoneSystem;
  private player!: Phaser.GameObjects.Rectangle;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private npcRects: Phaser.GameObjects.Rectangle[] = [];

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
    this.thoughtBubble = new ThoughtBubbleSystem(this);
    this.thoughtBubble.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.triggerZone = new TriggerZoneSystem({
      onDialogue: (actionRef) => {
        const script = dialogues[actionRef];
        if (script) this.dialogueSystem.start(script);
      },
      onStory: (actionRef) => {
        this.launchStoryScene(actionRef);
      },
      onThought: (actionRef) => {
        this.showThought(actionRef);
      },
    });
    this.triggerZone.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.npcInteraction = new NpcInteractionSystem(this);
    this.npcInteraction.setInteractionCallback((npc) => {
      const script = dialogues[`${npc.id}-intro`];
      if (script) {
        this.dialogueSystem.start(script);
      }
    });
    this.dialogueSystem.setOnChoice((choice) => {
      if (choice.setFlags) {
        for (const [key, value] of Object.entries(choice.setFlags)) {
          setFlag(key, value);
        }
      }
    });
  }

  update(_time: number, delta: number): void {
    // Zone-level mutual exclusion: dialogue suppresses movement, NPC interaction, triggers
    if (this.dialogueSystem.isActive) {
      this.dialogueSystem.update();
      // Thought bubble still tracks player position during dialogue (queued thoughts display after)
      const pcx = this.player.x + PLAYER_SIZE / 2;
      const pcy = this.player.y + PLAYER_SIZE / 2;
      this.thoughtBubble.update(pcx, pcy);
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
    this.thoughtBubble.update(playerCenterX, playerCenterY);
    this.triggerZone.update(
      this.player.x - offset,
      this.player.y - offset,
      PLAYER_SIZE,
      PLAYER_SIZE,
    );
  }

  private renderTileMap(): void {
    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setDepth(0); // tiles at depth 0

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = worldMap[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const color = tile === TileType.WALL ? WALL_COLOR : FLOOR_COLOR;
        this.tileGraphics.fillStyle(color);
        this.tileGraphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
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
      this.npcRects.push(rect);
    }
  }

  private setupCamera(): void {
    const mapWidth = MAP_COLS * TILE_SIZE;
    const mapHeight = MAP_ROWS * TILE_SIZE;
    const cam = this.cameras.main;
    cam.setZoom(this.calculateZoom());
    cam.setBounds(0, 0, mapWidth, mapHeight);
    cam.startFollow(this.player);

    // UI camera — no zoom/scroll, renders dialogue/joystick/thought bubbles at screen coords
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    uiCam.setScroll(0, 0);
    // Prevent UI camera from double-rendering world objects
    uiCam.ignore([this.tileGraphics, this.player, ...this.npcRects]);

    this.scale.on('resize', this.handleResize, this);
    this.events.on('shutdown', this.cleanupResize, this);
    this.events.on('destroy', this.cleanupResize, this);
  }

  private calculateZoom(): number {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    const targetWorldSize = TARGET_VISIBLE_TILES * TILE_SIZE;
    return Math.max(1, shortSide / targetWorldSize);
  }

  private handleResize(): void {
    const mapWidth = MAP_COLS * TILE_SIZE;
    const mapHeight = MAP_ROWS * TILE_SIZE;
    const cam = this.cameras.main;
    // Zoom first — setBounds clamps scroll using displayWidth which depends on zoom
    cam.setZoom(this.calculateZoom());
    cam.setBounds(0, 0, mapWidth, mapHeight);
    // Snap camera to player after dimension/zoom change (prevents stale scroll on rotation)
    cam.centerOn(this.player.x + PLAYER_SIZE / 2, this.player.y + PLAYER_SIZE / 2);

    const uiCam = this.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.setSize(this.scale.width, this.scale.height);
    }
  }

  private cleanupResize(): void {
    this.scale.off('resize', this.handleResize, this);
    this.events.off('shutdown', this.cleanupResize, this);
    this.events.off('destroy', this.cleanupResize, this);
  }

  showThought(text: string, duration?: number): void {
    this.thoughtBubble.show({ text, duration });
  }

  launchStoryScene(definitionId: string): void {
    const definition = storyScenes[definitionId];
    if (!definition) return;
    this.scene.pause('GameScene');
    this.scene.launch('StoryScene', { definition });
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
