import Phaser from 'phaser';
import { TILE_SIZE, PLAYER_SIZE, NPC_SIZE, TileType } from '../maps/constants';
import { TILESETS, resolveFrame, hasTileset } from '../maps/tilesets';
import { AreaDefinition } from '../data/areas/types';
import { getArea, getDefaultAreaId } from '../data/areas/registry';
import { InputSystem } from '../systems/input';
import { moveWithCollision } from '../systems/movement';
import { NpcInteractionSystem } from '../systems/npcInteraction';
import { DialogueSystem } from '../systems/dialogue';
import { ThoughtBubbleSystem } from '../systems/thoughtBubble';
import { TriggerZoneSystem } from '../systems/triggerZone';
import { DebugOverlaySystem } from '../systems/debugOverlay';
import { AnimationSystem } from '../systems/animation';
import { evaluateCondition } from '../systems/conditions';
import { DIRECTIONS } from '../systems/direction';
import { NPC_SPRITES, getNpcSpriteIds, hasNpcSprite } from '../systems/npcSprites';
import { setFlag } from '../triggers/flags';

const TARGET_VISIBLE_TILES = 10;
const FADE_DURATION = 400;
// Source tilesets are 16×16; game tile size is 32×32 — sprites are scaled to TILE_SIZE on render.
const TILESET_SOURCE_SIZE = 16;

// Fox-pip sprite animation constants
// Idle: 4 frames per direction; Walk: 8 frames per direction (matches PixelLab output)
const ANIM_TYPES = ['idle', 'walk'] as const;
const FRAME_COUNTS: Record<typeof ANIM_TYPES[number], number> = { idle: 4, walk: 8 };
const ANIM_FRAME_RATE = 8;

export class GameScene extends Phaser.Scene {
  private area!: AreaDefinition;
  private inputSystem!: InputSystem;
  private npcInteraction!: NpcInteractionSystem;
  private dialogueSystem!: DialogueSystem;
  private thoughtBubble!: ThoughtBubbleSystem;
  private triggerZone!: TriggerZoneSystem;
  private debugOverlay!: DebugOverlaySystem;
  private animationSystem!: AnimationSystem;
  private player!: Phaser.GameObjects.Sprite;
  private tileLayer: Phaser.GameObjects.GameObject[] = [];
  private propSprites: Phaser.GameObjects.Sprite[] = [];
  private npcEntities: Phaser.GameObjects.GameObject[] = [];
  private npcSpritesById: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private boundWindowResize: (() => void) | null = null;
  private transitionInProgress = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load all 96 fox-pip animation frames (2 types × 8 directions, idle:4 frames, walk:8 frames)
    for (const anim of ANIM_TYPES) {
      const frameCount = FRAME_COUNTS[anim];
      for (const dir of DIRECTIONS) {
        for (let i = 0; i < frameCount; i++) {
          const key = `fox-pip-${anim}-${dir}-${i}`;
          const path = `characters/fox-pip/${anim}/${dir}/frame_00${i}.png`;
          this.load.image(key, path);
        }
      }
    }

    // Load tileset atlases as uniform-grid spritesheets. Frame ids are numeric
    // indices; resolveFrame() returns them as strings which Phaser accepts directly.
    // Nearest-neighbor filtering is applied globally via `pixelArt: true` in main.ts.
    for (const [id, def] of Object.entries(TILESETS)) {
      this.load.spritesheet(def.atlasKey, `tilesets/${id}/tilemap.png`, {
        frameWidth: TILESET_SOURCE_SIZE,
        frameHeight: TILESET_SOURCE_SIZE,
      });
    }

    // Load per-NPC sprite frames driven by the registry — adding a new NPC becomes
    // a registry entry plus an AreaDefinition row, with no scene-file edit.
    for (const spriteId of getNpcSpriteIds()) {
      const def = NPC_SPRITES[spriteId];
      for (const dir of DIRECTIONS) {
        for (let i = 0; i < def.idleFrameCount; i++) {
          this.load.image(`npc-${spriteId}-idle-${dir}-${i}`, `npc/${spriteId}/idle/${dir}/frame_00${i}.png`);
        }
        for (let i = 0; i < def.walkFrameCount; i++) {
          this.load.image(`npc-${spriteId}-walk-${dir}-${i}`, `npc/${spriteId}/walk/${dir}/frame_00${i}.png`);
        }
        // Static poses are single-frame — loaded as plain image keys and applied via setTexture.
        this.load.image(`npc-${spriteId}-static-${dir}`, `npc/${spriteId}/static/${dir}.png`);
      }
    }
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
    this.renderProps();
    this.renderNpcs();
    this.registerAnimations();
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
      this.thoughtBubble.update(this.player.x, this.player.y);
      this.debugOverlay.update();
      return;
    }

    this.inputSystem.update();
    const inputVelocity = this.inputSystem.getVelocity();

    const inputSpeed = Math.sqrt(inputVelocity.x * inputVelocity.x + inputVelocity.y * inputVelocity.y);
    const hasInput = inputSpeed > 0;

    // Update animation state with raw velocity — 8-direction sprites support diagonal movement
    this.animationSystem.update(inputVelocity.x, inputVelocity.y);
    const currentSpeed = this.animationSystem.getCurrentSpeed();

    let moveVx = 0;
    let moveVy = 0;
    if (hasInput) {
      const dirX = inputVelocity.x / inputSpeed;
      const dirY = inputVelocity.y / inputSpeed;
      moveVx = dirX * currentSpeed;
      moveVy = dirY * currentSpeed;
    }

    const halfSize = PLAYER_SIZE / 2;
    const newPos = moveWithCollision(
      {
        x: this.player.x - halfSize,
        y: this.player.y - halfSize,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
      },
      { x: moveVx, y: moveVy },
      delta,
      { map: this.area.map, npcs: this.area.npcs },
    );
    this.player.setPosition(newPos.x + halfSize, newPos.y + halfSize);

    this.npcInteraction.update(this.player.x, this.player.y);
    this.thoughtBubble.update(this.player.x, this.player.y);

    // Collision bounds for trigger/exit zone checks
    const boundsX = this.player.x - halfSize;
    const boundsY = this.player.y - halfSize;
    this.triggerZone.update(boundsX, boundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.checkExitZones(boundsX, boundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.debugOverlay.update();
  }

  private renderTileMap(): void {
    this.tileLayer = [];

    const exitTiles = new Set<string>();
    for (const exit of this.area.exits) {
      for (let r = exit.row; r < exit.row + exit.height; r++) {
        for (let c = exit.col; c < exit.col + exit.width; c++) {
          exitTiles.add(`${c},${r}`);
        }
      }
    }

    // Fallback: unknown tileset id — render flat-color tiles so the scene still
    // loads with a clear console error (US-48 error-path).
    if (!hasTileset(this.area.tileset)) {
      console.error(
        `[GameScene] Unknown tileset id '${this.area.tileset}' on area '${this.area.id}'. ` +
          `Rendering flat-color fallback.`,
      );
      this.renderFallbackTiles(exitTiles);
      return;
    }

    const atlasKey = TILESETS[this.area.tileset].atlasKey;
    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        const tile = this.area.map[row][col];
        const kind = exitTiles.has(`${col},${row}`)
          ? TileType.EXIT
          : tile === TileType.WALL
          ? TileType.WALL
          : TileType.FLOOR;
        const frame = resolveFrame(this.area.tileset, kind, col, row);
        if (frame === null) continue;
        const sprite = this.add.sprite(col * TILE_SIZE, row * TILE_SIZE, atlasKey, frame);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
        sprite.setDepth(0);
        this.tileLayer.push(sprite);
      }
    }
  }

  private renderProps(): void {
    this.propSprites = [];
    if (!hasTileset(this.area.tileset)) return;
    const atlasKey = TILESETS[this.area.tileset].atlasKey;
    const texture = this.textures.get(atlasKey);
    for (const prop of this.area.props) {
      if (!texture.has(prop.spriteFrame)) {
        console.warn(
          `[GameScene] Prop '${prop.id}' references missing frame '${prop.spriteFrame}' ` +
            `on tileset '${this.area.tileset}'; skipping.`,
        );
        continue;
      }
      const sprite = this.add.sprite(
        prop.col * TILE_SIZE,
        prop.row * TILE_SIZE,
        atlasKey,
        prop.spriteFrame,
      );
      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
      sprite.setDepth(3);
      this.propSprites.push(sprite);
    }
  }

  private renderFallbackTiles(exitTiles: Set<string>): void {
    const g = this.add.graphics();
    g.setDepth(0);
    const FALLBACK_EXIT = 0xc89b3c;
    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        const tile = this.area.map[row][col];
        const color = exitTiles.has(`${col},${row}`)
          ? FALLBACK_EXIT
          : tile === TileType.WALL
          ? this.area.visual.wallColor
          : this.area.visual.floorColor;
        g.fillStyle(color);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this.tileLayer.push(g);
  }

  private renderNpcs(): void {
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    for (const npc of this.area.npcs) {
      const cx = npc.col * TILE_SIZE + offset + NPC_SIZE / 2;
      const cy = npc.row * TILE_SIZE + offset + NPC_SIZE / 2;
      if (hasNpcSprite(npc.sprite)) {
        const sprite = this.add.sprite(cx, cy, `npc-${npc.sprite}-idle-south-0`);
        sprite.setDepth(5);
        sprite.play(`npc-${npc.sprite}-idle-south`);
        this.npcEntities.push(sprite);
        this.npcSpritesById.set(npc.id, sprite);
      } else {
        console.error(`NPC '${npc.id}' references unknown sprite id '${npc.sprite}' — falling back to rectangle render.`);
        const rect = this.add.rectangle(cx - NPC_SIZE / 2, cy - NPC_SIZE / 2, NPC_SIZE, NPC_SIZE, npc.color);
        rect.setOrigin(0, 0);
        rect.setDepth(5);
        this.npcEntities.push(rect);
      }
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
    uiCam.ignore([...this.tileLayer, ...this.propSprites, this.player, ...this.npcEntities]);

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
    cam.centerOn(this.player.x, this.player.y);

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
    // Clean up player sprite
    this.player?.destroy();
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

  private registerAnimations(): void {
    // Register 16 fox-pip animations: fox-pip-{idle,walk}-{8 directions}
    // idle: 4 frames per direction; walk: 8 frames per direction
    for (const anim of ANIM_TYPES) {
      const frameCount = FRAME_COUNTS[anim];
      for (const dir of DIRECTIONS) {
        const key = `fox-pip-${anim}-${dir}`;
        const frames: { key: string }[] = [];
        for (let i = 0; i < frameCount; i++) {
          frames.push({ key: `fox-pip-${anim}-${dir}-${i}` });
        }
        this.anims.create({
          key,
          frames,
          frameRate: ANIM_FRAME_RATE,
          repeat: -1,
        });
      }
    }

    // Register per-NPC animations: npc-{spriteId}-{idle,walk}-{8 directions}.
    // Static poses are NOT registered as animations — they are plain textures applied via setTexture.
    for (const spriteId of getNpcSpriteIds()) {
      const def = NPC_SPRITES[spriteId];
      for (const anim of ANIM_TYPES) {
        const frameCount = anim === 'idle' ? def.idleFrameCount : def.walkFrameCount;
        for (const dir of DIRECTIONS) {
          const key = `npc-${spriteId}-${anim}-${dir}`;
          const frames: { key: string }[] = [];
          for (let i = 0; i < frameCount; i++) {
            frames.push({ key: `npc-${spriteId}-${anim}-${dir}-${i}` });
          }
          this.anims.create({
            key,
            frames,
            frameRate: ANIM_FRAME_RATE,
            repeat: -1,
          });
        }
      }
    }
  }

  private createPlayer(entryPoint?: { col: number; row: number }): void {
    const spawn = entryPoint ?? this.area.playerSpawn;
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    // Position is center of the player's collision tile cell
    const x = spawn.col * TILE_SIZE + offset + PLAYER_SIZE / 2;
    const y = spawn.row * TILE_SIZE + offset + PLAYER_SIZE / 2;

    this.player = this.add.sprite(x, y, 'fox-pip-idle-south-0');
    this.player.setDepth(5); // Entities layer — depth 5 per depth map
    // Native PNG resolution: 68×68px. Scale 1.0 renders at native size.
    // Collision bounding box uses PLAYER_SIZE (24px) in math directly — display size is independent.
    this.player.setScale(1);
    this.animationSystem = new AnimationSystem(this.player);
  }
}
