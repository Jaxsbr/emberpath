import Phaser from 'phaser';

const THOUGHT_DEPTH = 8; // above entities (5) but below debug overlay (50)
const DEFAULT_DURATION = 4000;
const PADDING_X = 6;
const PADDING_Y = 3;
const OFFSET_Y = -30; // world pixels above player center
const FONT_SIZE = 10; // world pixels — camera zoom scales this visually
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
      // Position in world space — camera zoom handles visual scaling
      this.currentText.setPosition(playerCenterX, playerCenterY + OFFSET_Y);
      this.currentBg.setPosition(playerCenterX, playerCenterY + OFFSET_Y);
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
      fontSize: `${FONT_SIZE}px`,
      color: FONT_COLOR,
      fontStyle: 'italic',
    });
    this.currentText.setOrigin(0.5, 1);
    this.currentText.setDepth(THOUGHT_DEPTH);

    // Tell the UI camera to ignore world-space thought objects
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.ignore(this.currentText);
    }

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
    this.currentBg.setDepth(THOUGHT_DEPTH - 1);
    if (uiCam) {
      uiCam.ignore(this.currentBg);
    }

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
