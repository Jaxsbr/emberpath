import Phaser from 'phaser';
import { TILE_SIZE, NPC_SIZE } from '../maps/constants';
import { NpcDefinition } from '../data/areas/types';
import { NpcLivePositions } from './collision';
const INTERACTION_RANGE = 1.5 * TILE_SIZE;
const TAP_MAX_DURATION = 300;
const TAP_MAX_DISTANCE = 15;
// The prompt breathes a little while shown so it reads as a live "you can talk
// here" affordance — a small floating bob, not a distraction.
const PROMPT_BOB_AMP = 3; // px
const PROMPT_BOB_SPEED = 0.006; // rad/ms (~1 Hz)
const PROMPT_FADE_IN_MS = 200;
const PROMPT_FADE_OUT_MS = 140;

export class NpcInteractionSystem {
  private scene: Phaser.Scene;
  private npcs: NpcDefinition[];
  private getLivePositions: (() => NpcLivePositions) | null = null;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  // Target visibility (whether an NPC is in range), so show/hide only fire on the
  // transition — the Text is created once and reused, never destroyed per enter/exit.
  private promptVisible = false;
  private promptTween: Phaser.Tweens.Tween | null = null;
  // Timestamp of the last showPrompt, so the bob starts at sine phase 0 (a neutral
  // offset) on every appearance instead of wherever absolute scene time happens to land.
  private promptShownAt = 0;
  private nearestNpc: NpcDefinition | null = null;
  private pointerDownTime = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private interactionCallback: ((npc: NpcDefinition) => void) | null = null;

  constructor(scene: Phaser.Scene, npcs: NpcDefinition[]) {
    this.scene = scene;
    this.npcs = npcs;
    this.setupInput();
  }

  /** Wire the NPC live-position provider. If not set, the system falls back to the static spawn tile. */
  setLivePositionsProvider(provider: () => NpcLivePositions): void {
    this.getLivePositions = provider;
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
      if (!this.promptVisible) this.showPrompt();
      this.positionPrompt(playerCenterX, playerCenterY);
    } else if (this.promptVisible) {
      this.hidePrompt();
    }

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryInteract();
    }
  }

  private findNearestNpcInRange(px: number, py: number): NpcDefinition | null {
    let nearest: NpcDefinition | null = null;
    let nearestDist = Infinity;

    const live = this.getLivePositions?.();
    const npcOffset = TILE_SIZE / 2;
    for (const npc of this.npcs) {
      const livePos = live?.get(npc.id);
      const npcCenterX = livePos ? livePos.x : npc.col * TILE_SIZE + npcOffset;
      const npcCenterY = livePos ? livePos.y : npc.row * TILE_SIZE + npcOffset;
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

  // Lazily build the prompt once and reuse it. Created hidden (alpha 0) so the
  // first showPrompt fades it in like every later one.
  private ensurePrompt(): Phaser.GameObjects.Text {
    if (this.promptText) return this.promptText;
    const isMobile = !this.scene.sys.game.device.os.desktop;
    const text = isMobile ? 'Tap to talk' : 'Space to talk';
    this.promptText = this.scene.add.text(0, 0, text, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 },
    });
    this.promptText.setOrigin(0.5, 0);
    this.promptText.setDepth(150);
    this.promptText.setAlpha(0);
    this.promptText.setVisible(false);
    // World object — prevent UI camera from rendering it at wrong scale.
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore(this.promptText);
    return this.promptText;
  }

  // Follow the player each frame, with a gentle floating bob so the affordance
  // reads as alive. Cheap: one sine + setPosition, no allocation.
  private positionPrompt(playerCenterX: number, playerCenterY: number): void {
    if (!this.promptText) return;
    const bob = Math.sin((this.scene.time.now - this.promptShownAt) * PROMPT_BOB_SPEED) * PROMPT_BOB_AMP;
    this.promptText.setPosition(playerCenterX, playerCenterY + TILE_SIZE * 0.6 + bob);
  }

  // Show only on the out-of-range → in-range transition: fade + a small upward
  // settle so it doesn't pop. Reuses the existing Text (no per-enter churn).
  private showPrompt(): void {
    this.promptVisible = true;
    const prompt = this.ensurePrompt();
    this.promptTween?.stop();
    prompt.setVisible(true);
    // Hard-reset to a known start (alpha 0, scale 0.85) like the scale already did,
    // so a re-show interrupting a half-done fade-out always plays the full clean
    // fade-in rather than starting from leftover alpha. Anchor the bob phase here too.
    prompt.setAlpha(0);
    prompt.setScale(0.85);
    this.promptShownAt = this.scene.time.now;
    this.promptTween = this.scene.tweens.add({
      targets: prompt,
      alpha: 1,
      scale: 1,
      duration: PROMPT_FADE_IN_MS,
      ease: 'Back.easeOut',
    });
  }

  // Hide on the in-range → out-of-range transition: quick fade, then park it
  // invisible (kept for the next show — never destroyed mid-play).
  private hidePrompt(): void {
    this.promptVisible = false;
    if (!this.promptText) return;
    const prompt = this.promptText;
    this.promptTween?.stop();
    this.promptTween = this.scene.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: PROMPT_FADE_OUT_MS,
      ease: 'Sine.easeIn',
      onComplete: () => prompt.setVisible(false),
    });
  }

  private tryInteract(): void {
    if (this.nearestNpc && this.interactionCallback) {
      this.interactionCallback(this.nearestNpc);
    }
  }

  destroy(): void {
    this.promptTween?.stop();
    this.promptTween = null;
    this.promptText?.destroy();
    this.promptText = null;
    this.promptVisible = false;
  }
}
