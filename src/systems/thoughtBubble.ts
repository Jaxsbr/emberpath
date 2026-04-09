import Phaser from 'phaser';

const THOUGHT_DEPTH = 150;
const DEFAULT_DURATION = 3000;
const PADDING_X = 8;
const PADDING_Y = 4;
const OFFSET_Y = -40; // above the player

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
      // Position thought near player using screen coordinates
      const camera = this.scene.cameras.main;
      const screenX = playerCenterX - camera.scrollX;
      const screenY = playerCenterY - camera.scrollY + OFFSET_Y;
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

    this.currentText = this.scene.add.text(0, 0, request.text, {
      fontSize: '12px',
      color: '#e0e0e0',
    });
    this.currentText.setOrigin(0.5, 1);
    this.currentText.setScrollFactor(0);
    this.currentText.setDepth(THOUGHT_DEPTH);

    const textWidth = this.currentText.width;
    const textHeight = this.currentText.height;

    this.currentBg = this.scene.add.rectangle(
      0,
      0,
      textWidth + PADDING_X * 2,
      textHeight + PADDING_Y * 2,
      0x222233,
      0.8,
    );
    this.currentBg.setOrigin(0.5, 1);
    this.currentBg.setScrollFactor(0);
    this.currentBg.setDepth(THOUGHT_DEPTH - 1);

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
