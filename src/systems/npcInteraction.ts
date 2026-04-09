import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { npcs, NPC_SIZE, NpcDefinition } from '../data/npcs';

const INTERACTION_RANGE = 1.5 * TILE_SIZE; // 1.5 tiles in pixels
const TAP_MAX_DURATION = 300; // ms — longer than this is a drag, not a tap
const TAP_MAX_DISTANCE = 15; // px — further than this is a drag

export class NpcInteractionSystem {
  private scene: Phaser.Scene;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  private nearestNpc: NpcDefinition | null = null;
  private pointerDownTime = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private interactionCallback: ((npc: NpcDefinition) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupInput();
  }

  setInteractionCallback(cb: (npc: NpcDefinition) => void): void {
    this.interactionCallback = cb;
  }

  private setupInput(): void {
    if (this.scene.input.keyboard) {
      this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerDownTime = pointer.downTime;
      this.pointerDownPos = { x: pointer.x, y: pointer.y };
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const duration = pointer.upTime - this.pointerDownTime;
      const dx = pointer.x - this.pointerDownPos.x;
      const dy = pointer.y - this.pointerDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (duration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE) {
        this.tryInteract();
      }
    });
  }

  update(playerCenterX: number, playerCenterY: number): void {
    this.nearestNpc = this.findNearestNpcInRange(playerCenterX, playerCenterY);

    if (this.nearestNpc) {
      this.showPrompt(playerCenterX, playerCenterY);
    } else {
      this.hidePrompt();
    }

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryInteract();
    }
  }

  private findNearestNpcInRange(px: number, py: number): NpcDefinition | null {
    let nearest: NpcDefinition | null = null;
    let nearestDist = Infinity;

    const npcOffset = TILE_SIZE / 2;
    for (const npc of npcs) {
      const npcCenterX = npc.col * TILE_SIZE + npcOffset;
      const npcCenterY = npc.row * TILE_SIZE + npcOffset;
      const dx = px - npcCenterX;
      const dy = py - npcCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= INTERACTION_RANGE && dist < nearestDist) {
        nearest = npc;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  private showPrompt(playerCenterX: number, playerCenterY: number): void {
    const isMobile = !this.scene.sys.game.device.os.desktop;
    const text = isMobile ? 'Tap to talk' : 'Space to talk';

    if (!this.promptText) {
      this.promptText = this.scene.add.text(0, 0, text, {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 4, y: 2 },
      });
      this.promptText.setOrigin(0.5, 0);
      this.promptText.setDepth(150);
      // World object — prevent UI camera from rendering it at wrong scale
      const uiCam = this.scene.cameras.getCamera('ui');
      if (uiCam) uiCam.ignore(this.promptText);
    }

    this.promptText.setText(text);
    this.promptText.setPosition(playerCenterX, playerCenterY + TILE_SIZE * 0.6);
  }

  private hidePrompt(): void {
    if (this.promptText) {
      this.promptText.destroy();
      this.promptText = null;
    }
  }

  private tryInteract(): void {
    if (this.nearestNpc && this.interactionCallback) {
      this.interactionCallback(this.nearestNpc);
    }
  }

  destroy(): void {
    this.hidePrompt();
  }
}
