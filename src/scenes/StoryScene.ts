import Phaser from 'phaser';
import { StorySceneDefinition, StoryBeat } from '../data/areas/types';

const FADE_DURATION = 500;
const IMAGE_HEIGHT_RATIO = 0.58; // ~350/600 — upper portion for image
const TEXT_PADDING = 20;

export class StoryScene extends Phaser.Scene {
  private definition!: StorySceneDefinition;
  private currentBeatIndex = 0;
  private imageRect: Phaser.GameObjects.Rectangle | null = null;
  private imageLabel: Phaser.GameObjects.Text | null = null;
  private panelGraphics: Phaser.GameObjects.Graphics | null = null;
  private beatText: Phaser.GameObjects.Text | null = null;
  private advanceHint: Phaser.GameObjects.Text | null = null;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private ready = false;

  constructor() {
    super({ key: 'StoryScene' });
  }

  init(data: { definition: StorySceneDefinition }): void {
    this.definition = data.definition;
    this.currentBeatIndex = 0;
    this.ready = false;
  }

  create(): void {
    const { width, height } = this.scale;
    const imageH = Math.round(height * IMAGE_HEIGHT_RATIO);

    this.cameras.main.fadeIn(FADE_DURATION);
    this.time.delayedCall(FADE_DURATION, () => {
      this.ready = true;
    });

    // Image area — upper portion
    this.imageRect = this.add.rectangle(width / 2, imageH / 2, width, imageH, 0x333333);
    this.imageRect.setOrigin(0.5, 0.5);

    this.imageLabel = this.add.text(width / 2, imageH / 2, '', {
      fontSize: '20px',
      color: '#999999',
    });
    this.imageLabel.setOrigin(0.5, 0.5);

    // Text panel — lower portion
    this.panelGraphics = this.add.graphics();
    this.panelGraphics.fillStyle(0x111122, 0.95);
    this.panelGraphics.fillRect(0, imageH, width, height - imageH);

    this.beatText = this.add.text(TEXT_PADDING, imageH + TEXT_PADDING, '', {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: width - TEXT_PADDING * 2 },
      lineSpacing: 6,
    });

    // Advance prompt
    this.advanceHint = this.add.text(width / 2, height - 20, 'Tap or press Space to continue', {
      fontSize: '11px',
      color: '#666666',
    });
    this.advanceHint.setOrigin(0.5, 0.5);

    // Input
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    this.input.on('pointerup', () => {
      if (this.ready) this.advanceBeat();
    });

    this.scale.on('resize', this.handleResize, this);
    this.events.on('shutdown', this.cleanupResize, this);
    this.events.on('destroy', this.cleanupResize, this);

    this.showBeat(this.definition.beats[0]);
  }

  update(): void {
    if (!this.ready) return;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.advanceBeat();
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const imageH = Math.round(height * IMAGE_HEIGHT_RATIO);

    if (this.imageRect) {
      this.imageRect.setPosition(width / 2, imageH / 2);
      this.imageRect.setSize(width, imageH);
    }

    if (this.imageLabel) {
      this.imageLabel.setPosition(width / 2, imageH / 2);
    }

    if (this.panelGraphics) {
      this.panelGraphics.clear();
      this.panelGraphics.fillStyle(0x111122, 0.95);
      this.panelGraphics.fillRect(0, imageH, width, height - imageH);
    }

    if (this.beatText) {
      this.beatText.setPosition(TEXT_PADDING, imageH + TEXT_PADDING);
      this.beatText.setWordWrapWidth(width - TEXT_PADDING * 2);
    }

    if (this.advanceHint) {
      this.advanceHint.setPosition(width / 2, height - 20);
    }
  }

  private showBeat(beat: StoryBeat): void {
    if (this.imageRect && beat.imageColor !== undefined) {
      this.imageRect.setFillStyle(beat.imageColor);
    }
    if (this.imageLabel) {
      this.imageLabel.setText(beat.imageLabel ?? '');
    }
    if (this.beatText) {
      this.beatText.setText(beat.text);
    }
  }

  private advanceBeat(): void {
    this.currentBeatIndex++;
    if (this.currentBeatIndex < this.definition.beats.length) {
      this.showBeat(this.definition.beats[this.currentBeatIndex]);
    } else {
      this.exitScene();
    }
  }

  private exitScene(): void {
    this.ready = false;
    this.cameras.main.fadeOut(FADE_DURATION);
    this.time.delayedCall(FADE_DURATION, () => {
      this.scene.stop('StoryScene');
      this.scene.resume('GameScene');
    });
  }

  private cleanupResize(): void {
    this.scale.off('resize', this.handleResize, this);
    this.events.off('shutdown', this.cleanupResize, this);
    this.events.off('destroy', this.cleanupResize, this);
  }
}
