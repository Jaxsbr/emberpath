import Phaser from 'phaser';

const THOUGHT_DEPTH = 150;
const DEFAULT_DURATION = 4000;
const PADDING_X = 10;
const PADDING_Y = 6;
const OFFSET_Y = -50; // above the player
const FONT_SIZE = 14;
const FONT_COLOR = '#ffffff';
const BG_COLOR = 0x222244;
const BG_ALPHA = 0.85;

export interface ThoughtRequest {
  text: string;
  duration?: number;
}

export class ThoughtBubbleSystem {
  private scene: Phaser.Scene;
  private queue: ThoughtRequest[] = [];
  private currentBg: Phaser.GameObjects.Rectangle | null = null;
  private currentText: Phaser.GameObjects.Text | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;
  private active = false;
  private dialogueActiveCheck: (() => boolean) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setDialogueActiveCheck(check: () => boolean): void {
    this.dialogueActiveCheck = check;
  }

  show(request: ThoughtRequest): void {
    this.queue.push(request);
    this.tryShowNext();
  }

  update(playerCenterX: number, playerCenterY: number): void {
    if (this.active && this.currentBg && this.currentText) {
      // Convert player world position to screen coordinates (accounting for camera zoom)
      const cam = this.scene.cameras.main;
      const screenX = (playerCenterX - cam.scrollX) * cam.zoom;
      const screenY = (playerCenterY - cam.scrollY) * cam.zoom + OFFSET_Y;
      this.currentText.setPosition(screenX, screenY);
      this.currentBg.setPosition(screenX, screenY);
    }

    // Try to show queued thoughts when dialogue closes
    if (!this.active && this.queue.length > 0) {
      this.tryShowNext();
    }
  }

  private tryShowNext(): void {
    if (this.active) return;
    if (this.queue.length === 0) return;

    // Defer if dialogue is active
    if (this.dialogueActiveCheck && this.dialogueActiveCheck()) return;

    const request = this.queue.shift()!;
    this.displayThought(request);
  }

  private displayThought(request: ThoughtRequest): void {
    this.active = true;
    const duration = request.duration ?? DEFAULT_DURATION;
    console.log('[thought] displaying:', request.text, 'duration:', duration);

    this.currentText = this.scene.add.text(0, 0, request.text, {
      fontSize: `${FONT_SIZE}px`,
      color: FONT_COLOR,
      fontStyle: 'italic',
    });
    this.currentText.setOrigin(0.5, 1);
    this.currentText.setScrollFactor(0);
    this.currentText.setDepth(THOUGHT_DEPTH);
    this.scene.cameras.main.ignore(this.currentText);

    const textWidth = this.currentText.width;
    const textHeight = this.currentText.height;

    this.currentBg = this.scene.add.rectangle(
      0,
      0,
      textWidth + PADDING_X * 2,
      textHeight + PADDING_Y * 2,
      BG_COLOR,
      BG_ALPHA,
    );
    this.currentBg.setOrigin(0.5, 1);
    this.currentBg.setScrollFactor(0);
    this.currentBg.setDepth(THOUGHT_DEPTH - 1);
    this.scene.cameras.main.ignore(this.currentBg);

    this.dismissTimer = this.scene.time.delayedCall(duration, () => {
      this.dismiss();
    });
  }

  private dismiss(): void {
    this.dismissTimer?.destroy();
    this.dismissTimer = null;
    this.currentBg?.destroy();
    this.currentBg = null;
    this.currentText?.destroy();
    this.currentText = null;
    this.active = false;

    // Try next in queue
    this.tryShowNext();
  }

  destroy(): void {
    this.dismiss();
    this.queue = [];
  }
}
