import Phaser from 'phaser';
import { STYLE_PALETTE } from '../art/styleGuide';

const THOUGHT_DEPTH = 8;
const DEFAULT_DURATION = 4000;

// Native-pixel literals — same approach as systems/npcInteraction.ts's "Tap
// to talk" prompt. Phaser pixelArt:true NEAREST sampling chunks-up these
// glyphs cleanly across mobile and desktop zooms; the previous serif +
// design-pixel-scaled fontSize was destroying thin strokes at mobile zoom.
const FONT_SIZE = '12px';
const PADDING_X = 6;
const PADDING_Y = 4;
const OFFSET_Y = -28;
const MAX_WIDTH = 110;
const CORNER_RADIUS = 6;
const STROKE_WIDTH = 1;
const PANEL_ALPHA = 0.92;

const hexToInt = (h: string) => parseInt(h.slice(1), 16);
const PANEL_FILL_INT = hexToInt(STYLE_PALETTE.creamLight);
const PANEL_STROKE_INT = hexToInt(STYLE_PALETTE.umberDark);
const TEXT_COLOR = STYLE_PALETTE.umberDark;

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
    this.listenersBound = true;
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
      this.currentText.setPosition(playerCenterX, playerCenterY + OFFSET_Y);
      this.currentBg.setPosition(playerCenterX, playerCenterY + OFFSET_Y);
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
    // Reset hygiene (Learning EP-02) — clear any leftovers before creating
    // fresh GameObjects so a scene.restart mid-bubble cannot leak.
    this.currentBg?.destroy();
    this.currentBg = null;
    this.currentText?.destroy();
    this.currentText = null;
    this.dismissTimer?.destroy();
    this.dismissTimer = null;

    this.active = true;
    const duration = request.duration ?? DEFAULT_DURATION;

    this.currentText = this.scene.add.text(0, 0, request.text, {
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      fontStyle: 'italic',
      wordWrap: { width: MAX_WIDTH, useAdvancedWrap: true },
      align: 'center',
    });
    this.currentText.setOrigin(0.5, 1);
    this.currentText.setDepth(THOUGHT_DEPTH);

    this.currentBg = this.scene.add.graphics();
    this.currentBg.setDepth(THOUGHT_DEPTH - 1);
    this.redrawBg();

    // Camera split — UI cam ignores both so they render exclusively on the
    // main camera (world space, follows the player).
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.ignore(this.currentText);
      uiCam.ignore(this.currentBg);
    }

    this.currentText.setPosition(this.playerCenterX, this.playerCenterY + OFFSET_Y);
    this.currentBg.setPosition(this.playerCenterX, this.playerCenterY + OFFSET_Y);

    this.dismissTimer = this.scene.time.delayedCall(duration, () => {
      this.dismiss();
    });
  }

  /**
   * Draw the cream rounded panel + umber border around the text bounding box.
   *
   * Text origin is (0.5, 1) so text occupies local y = [-textHeight, 0]. To
   * keep symmetric vertical padding (the previous draw at -h..0 left 2*padY
   * above and 0 below), the panel spans local y = [-textHeight - padY, padY]
   * — equivalently top = -h + padY where h = textHeight + 2*padY.
   */
  private redrawBg(): void {
    if (!this.currentBg || !this.currentText) return;
    const w = this.currentText.width + PADDING_X * 2;
    const h = this.currentText.height + PADDING_Y * 2;
    const top = -h + PADDING_Y;
    this.currentBg.clear();
    this.currentBg.fillStyle(PANEL_FILL_INT, PANEL_ALPHA);
    this.currentBg.fillRoundedRect(-w / 2, top, w, h, CORNER_RADIUS);
    this.currentBg.lineStyle(STROKE_WIDTH, PANEL_STROKE_INT, 1);
    this.currentBg.strokeRoundedRect(-w / 2, top, w, h, CORNER_RADIUS);
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
      this.listenersBound = false;
    }
  }

  destroy(): void {
    this.handleShutdown();
  }
}
