import Phaser from 'phaser';
import { STYLE_PALETTE } from '../art/styleGuide';

const THOUGHT_DEPTH = 8;
const DEFAULT_DURATION = 4000;

// Design-pixel constants. Thought bubbles render in world space on the main
// camera, so these values are in world pixels — Phaser's pixelArt:true NEAREST
// sampling produces sharp output at any camera zoom. The s() helper exists for
// symmetry with dialogue.ts and as a hook for future zoom-aware tuning; for now
// it is identity (main-cam world pixels are already "design pixels" for this
// renderer).
const FONT_SIZE_DESIGN = 12;
const PADDING_X_DESIGN = 6;
const PADDING_Y_DESIGN = 4;
const OFFSET_Y_DESIGN = -28;
const THOUGHT_MAX_WIDTH_DESIGN = 110;
const THOUGHT_CORNER_RADIUS_DESIGN = 6;
const THOUGHT_STROKE_WIDTH_DESIGN = 1;
const PANEL_ALPHA = 0.92;

const hexToInt = (h: string) => parseInt(h.slice(1), 16);
const PANEL_FILL_INT = hexToInt(STYLE_PALETTE.creamLight);
const PANEL_STROKE_INT = hexToInt(STYLE_PALETTE.umberDark);
const TEXT_COLOR = STYLE_PALETTE.umberDark;
const FONT_FAMILY = 'serif';

export interface ThoughtRequest {
  text: string;
  duration?: number;
}

export class ThoughtBubbleSystem {
  private scene: Phaser.Scene;
  private queue: ThoughtRequest[] = [];
  private currentBg: Phaser.GameObjects.Graphics | null = null;
  private currentText: Phaser.GameObjects.Text | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;
  private active = false;
  private dialogueActiveCheck: (() => boolean) | null = null;
  private playerCenterX = 0;
  private playerCenterY = 0;
  private listenersBound = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.on('shutdown', this.handleShutdown, this);
    scene.events.on('destroy', this.handleShutdown, this);
    scene.scale.on('resize', this.handleResize, this);
    this.listenersBound = true;
  }

  /**
   * Symmetry hook with dialogue.ts's s() helper. Identity for main-camera
   * world-space thought bubbles; here so design-pixel constants above remain
   * the single tuning surface even as future iterations introduce per-zoom
   * adjustments.
   */
  private s(v: number): number {
    return v;
  }

  setDialogueActiveCheck(check: () => boolean): void {
    this.dialogueActiveCheck = check;
  }

  show(request: ThoughtRequest): void {
    this.queue.push(request);
    this.tryShowNext();
  }

  update(playerCenterX: number, playerCenterY: number): void {
    this.playerCenterX = playerCenterX;
    this.playerCenterY = playerCenterY;
    if (this.active && this.currentBg && this.currentText) {
      const offsetY = this.s(OFFSET_Y_DESIGN);
      this.currentText.setPosition(playerCenterX, playerCenterY + offsetY);
      this.currentBg.setPosition(playerCenterX, playerCenterY + offsetY);
    }
    if (!this.active && this.queue.length > 0) {
      this.tryShowNext();
    }
  }

  private tryShowNext(): void {
    if (this.active) return;
    if (this.queue.length === 0) return;
    if (this.dialogueActiveCheck && this.dialogueActiveCheck()) return;
    const request = this.queue.shift()!;
    this.displayThought(request);
  }

  private displayThought(request: ThoughtRequest): void {
    // Reset hygiene (Learning EP-02) — clear stale refs at the top before
    // creating fresh GameObjects so a scene.restart mid-bubble cannot leak.
    this.currentBg?.destroy();
    this.currentBg = null;
    this.currentText?.destroy();
    this.currentText = null;
    this.dismissTimer?.destroy();
    this.dismissTimer = null;

    this.active = true;
    const duration = request.duration ?? DEFAULT_DURATION;

    this.currentText = this.scene.add.text(0, 0, request.text, {
      fontSize: `${this.s(FONT_SIZE_DESIGN)}px`,
      color: TEXT_COLOR,
      fontStyle: 'italic',
      fontFamily: FONT_FAMILY,
      wordWrap: { width: this.s(THOUGHT_MAX_WIDTH_DESIGN), useAdvancedWrap: true },
      align: 'center',
    });
    this.currentText.setOrigin(0.5, 1);
    this.currentText.setDepth(THOUGHT_DEPTH);

    this.currentBg = this.scene.add.graphics();
    this.currentBg.setDepth(THOUGHT_DEPTH - 1);

    this.redrawBg();

    // Camera split — UI cam ignores both so they render exclusively on the main
    // camera (world space, follows the player).
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.ignore(this.currentText);
      uiCam.ignore(this.currentBg);
    }

    const offsetY = this.s(OFFSET_Y_DESIGN);
    this.currentText.setPosition(this.playerCenterX, this.playerCenterY + offsetY);
    this.currentBg.setPosition(this.playerCenterX, this.playerCenterY + offsetY);

    this.dismissTimer = this.scene.time.delayedCall(duration, () => {
      this.dismiss();
    });
  }

  private redrawBg(): void {
    if (!this.currentBg || !this.currentText) return;
    const padX = this.s(PADDING_X_DESIGN);
    const padY = this.s(PADDING_Y_DESIGN);
    const radius = this.s(THOUGHT_CORNER_RADIUS_DESIGN);
    const strokeW = this.s(THOUGHT_STROKE_WIDTH_DESIGN);
    const w = this.currentText.width + padX * 2;
    const h = this.currentText.height + padY * 2;
    this.currentBg.clear();
    this.currentBg.fillStyle(PANEL_FILL_INT, PANEL_ALPHA);
    this.currentBg.fillRoundedRect(-w / 2, -h, w, h, radius);
    this.currentBg.lineStyle(strokeW, PANEL_STROKE_INT, 1);
    this.currentBg.strokeRoundedRect(-w / 2, -h, w, h, radius);
  }

  private handleResize(): void {
    if (this.active && this.currentText) {
      this.currentText.setFontSize(this.s(FONT_SIZE_DESIGN));
      this.currentText.setWordWrapWidth(this.s(THOUGHT_MAX_WIDTH_DESIGN));
      this.redrawBg();
    }
  }

  private dismiss(): void {
    this.dismissTimer?.destroy();
    this.dismissTimer = null;
    this.currentBg?.destroy();
    this.currentBg = null;
    this.currentText?.destroy();
    this.currentText = null;
    this.active = false;
    this.tryShowNext();
  }

  private handleShutdown(): void {
    this.dismissTimer?.destroy();
    this.dismissTimer = null;
    this.currentBg?.destroy();
    this.currentBg = null;
    this.currentText?.destroy();
    this.currentText = null;
    this.queue = [];
    this.active = false;
    if (this.listenersBound) {
      this.scene.events.off('shutdown', this.handleShutdown, this);
      this.scene.events.off('destroy', this.handleShutdown, this);
      this.scene.scale.off('resize', this.handleResize, this);
      this.listenersBound = false;
    }
  }

  destroy(): void {
    this.handleShutdown();
  }
}
