import Phaser from 'phaser';
import { TILE_SIZE, NPC_SIZE, TileType } from '../maps/constants';
import { AreaDefinition } from '../data/areas/types';
import { getArea, getDefaultAreaId } from '../data/areas/registry';
import { InputSystem } from '../systems/input';
import { moveWithCollision } from '../systems/movement';
import { NpcInteractionSystem } from '../systems/npcInteraction';
import { DialogueSystem } from '../systems/dialogue';
import { ThoughtBubbleSystem } from '../systems/thoughtBubble';
import { TriggerZoneSystem } from '../systems/triggerZone';
import { DebugOverlaySystem } from '../systems/debugOverlay';
import { evaluateCondition } from '../systems/conditions';
import { setFlag } from '../triggers/flags';

const PLAYER_COLOR = 0xd4a24e;
const PLAYER_SIZE = 24;
const TARGET_VISIBLE_TILES = 10;
const EXIT_COLOR = 0xc89b3c; // amber-gold — reads as passage/doorway
const FADE_DURATION = 400;

export class GameScene extends Phaser.Scene {
  private area!: AreaDefinition;
  private inputSystem!: InputSystem;
  private npcInteraction!: NpcInteractionSystem;
  private dialogueSystem!: DialogueSystem;
  private thoughtBubble!: ThoughtBubbleSystem;
  private triggerZone!: TriggerZoneSystem;
  private debugOverlay!: DebugOverlaySystem;
  private player!: Phaser.GameObjects.Rectangle;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private npcRects: Phaser.GameObjects.Rectangle[] = [];
  private boundWindowResize: (() => void) | null = null;
  private transitionInProgress = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data?: { areaId?: string; entryPoint?: { col: number; row: number } }): void {
    this.transitionInProgress = false;
    const areaId = data?.areaId ?? getDefaultAreaId();
    const area = getArea(areaId);
    if (!area) {
      console.error(`Area not found: ${areaId}`);
      return;
    }
    this.area = area;

    this.renderTileMap();
    this.renderNpcs();
    this.createPlayer(data?.entryPoint);
    this.setupCamera();
    // Fade in when entering from an area transition
    if (data?.entryPoint) {
      this.cameras.main.fadeIn(FADE_DURATION, 0, 0, 0);
    }
    this.inputSystem = new InputSystem(this);
    this.dialogueSystem = new DialogueSystem(this);
    this.thoughtBubble = new ThoughtBubbleSystem(this);
    this.thoughtBubble.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.triggerZone = new TriggerZoneSystem(this.area.triggers, {
      onDialogue: (actionRef) => {
        const script = this.area.dialogues[actionRef];
        if (!script) {
          console.error(`Dialogue script not found: ${actionRef}`);
          return;
        }
        this.dialogueSystem.start(script);
      },
      onStory: (actionRef) => {
        this.launchStoryScene(actionRef);
      },
      onThought: (actionRef) => {
        this.showThought(actionRef);
      },
    });
    this.triggerZone.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.npcInteraction = new NpcInteractionSystem(this, this.area.npcs);
    this.npcInteraction.setInteractionCallback((npc) => {
      const script = this.area.dialogues[`${npc.id}-intro`];
      if (!script) {
        console.error(`NPC dialogue script not found: ${npc.id}-intro`);
        return;
      }
      this.dialogueSystem.start(script);
    });
    this.dialogueSystem.setOnChoice((choice) => {
      if (choice.setFlags) {
        for (const [key, value] of Object.entries(choice.setFlags)) {
          setFlag(key, value);
        }
      }
    });
    this.debugOverlay = new DebugOverlaySystem(this);
    this.debugOverlay.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.debugOverlay.loadArea(this.area);
  }

  update(_time: number, delta: number): void {
    // Suppress all interaction during area transition
    if (this.transitionInProgress) return;

    if (this.dialogueSystem.isActive) {
      this.dialogueSystem.update();
      const pcx = this.player.x + PLAYER_SIZE / 2;
      const pcy = this.player.y + PLAYER_SIZE / 2;
      this.thoughtBubble.update(pcx, pcy);
      this.debugOverlay.update();
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
      { map: this.area.map, npcs: this.area.npcs },
    );
    this.player.setPosition(newPos.x + offset, newPos.y + offset);

    const playerCenterX = this.player.x + PLAYER_SIZE / 2;
    const playerCenterY = this.player.y + PLAYER_SIZE / 2;
    this.npcInteraction.update(playerCenterX, playerCenterY);
    this.thoughtBubble.update(playerCenterX, playerCenterY);

    const playerBoundsX = this.player.x - offset;
    const playerBoundsY = this.player.y - offset;
    this.triggerZone.update(playerBoundsX, playerBoundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.checkExitZones(playerBoundsX, playerBoundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.debugOverlay.update();
  }

  private renderTileMap(): void {
    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setDepth(0);

    // Build a set of exit zone tile coordinates for distinct rendering
    const exitTiles = new Set<string>();
    for (const exit of this.area.exits) {
      for (let r = exit.row; r < exit.row + exit.height; r++) {
        for (let c = exit.col; c < exit.col + exit.width; c++) {
          exitTiles.add(`${c},${r}`);
        }
      }
    }

    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        const tile = this.area.map[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        let color: number;
        if (exitTiles.has(`${col},${row}`)) {
          color = EXIT_COLOR;
        } else if (tile === TileType.WALL) {
          color = this.area.visual.wallColor;
        } else {
          color = this.area.visual.floorColor;
        }
        this.tileGraphics.fillStyle(color);
        this.tileGraphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private renderNpcs(): void {
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    for (const npc of this.area.npcs) {
      const x = npc.col * TILE_SIZE + offset;
      const y = npc.row * TILE_SIZE + offset;
      const rect = this.add.rectangle(x, y, NPC_SIZE, NPC_SIZE, npc.color);
      rect.setOrigin(0, 0);
      rect.setDepth(5);
      this.npcRects.push(rect);
    }
  }

  private setupCamera(): void {
    const mapWidth = this.area.mapCols * TILE_SIZE;
    const mapHeight = this.area.mapRows * TILE_SIZE;
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

    // Direct window resize listener — Phaser's ScaleManager only sets a dirty flag
    // on window.resize (it calls refresh() only on orientationchange). Chrome DevTools
    // rotation fires resize, not orientationchange, so Phaser may miss the update if
    // the DOM hasn't settled by the next step(). We force a refresh after one animation
    // frame so the parent container has its final dimensions.
    this.boundWindowResize = () => {
      requestAnimationFrame(() => {
        if (this.scene.isActive()) {
          this.scale.refresh();
        }
      });
    };
    window.addEventListener('resize', this.boundWindowResize);

    this.events.on('shutdown', this.cleanupResize, this);
    this.events.on('destroy', this.cleanupResize, this);
  }

  private calculateZoom(): number {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    const targetWorldSize = TARGET_VISIBLE_TILES * TILE_SIZE;
    return Math.max(1, shortSide / targetWorldSize);
  }

  private handleResize(): void {
    const mapWidth = this.area.mapCols * TILE_SIZE;
    const mapHeight = this.area.mapRows * TILE_SIZE;
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

  private checkExitZones(px: number, py: number, pw: number, ph: number): void {
    for (const exit of this.area.exits) {
      const zoneX = exit.col * TILE_SIZE;
      const zoneY = exit.row * TILE_SIZE;
      const zoneW = exit.width * TILE_SIZE;
      const zoneH = exit.height * TILE_SIZE;

      const overlaps =
        px < zoneX + zoneW &&
        px + pw > zoneX &&
        py < zoneY + zoneH &&
        py + ph > zoneY;

      if (overlaps) {
        if (exit.condition && !evaluateCondition(exit.condition)) {
          continue;
        }
        this.transitionToArea(exit.destinationAreaId, exit.entryPoint);
        return;
      }
    }
  }

  private transitionToArea(areaId: string, entryPoint: { col: number; row: number }): void {
    const destination = getArea(areaId);
    if (!destination) {
      console.error(`Exit zone references non-existent area: ${areaId}`);
      return;
    }

    this.transitionInProgress = true;

    this.cameras.main.fadeOut(FADE_DURATION, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ areaId, entryPoint });
    });
  }

  private cleanupResize(): void {
    this.scale.off('resize', this.handleResize, this);
    if (this.boundWindowResize) {
      window.removeEventListener('resize', this.boundWindowResize);
      this.boundWindowResize = null;
    }
    // Clean up any in-progress fade tweens to prevent orphaned callbacks
    this.cameras?.main?.removeAllListeners('camerafadeoutcomplete');
    this.events.off('shutdown', this.cleanupResize, this);
    this.events.off('destroy', this.cleanupResize, this);
  }

  showThought(text: string, duration?: number): void {
    this.thoughtBubble.show({ text, duration });
  }

  launchStoryScene(definitionId: string): void {
    const definition = this.area.storyScenes[definitionId];
    if (!definition) {
      console.error(`Story scene definition not found: ${definitionId}`);
      return;
    }
    this.scene.pause('GameScene');
    this.scene.launch('StoryScene', { definition });
  }

  private createPlayer(entryPoint?: { col: number; row: number }): void {
    const spawn = entryPoint ?? this.area.playerSpawn;
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    const x = spawn.col * TILE_SIZE + offset;
    const y = spawn.row * TILE_SIZE + offset;

    this.player = this.add.rectangle(x, y, PLAYER_SIZE, PLAYER_SIZE, PLAYER_COLOR);
    this.player.setOrigin(0, 0);
    this.player.setDepth(5); // entities at depth 5
  }
}
