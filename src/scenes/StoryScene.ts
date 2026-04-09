import Phaser from 'phaser';
import { StorySceneDefinition, StoryBeat } from '../data/story-scenes';

const FADE_DURATION = 500;
const IMAGE_HEIGHT = 350;
const TEXT_PADDING = 20;

export class StoryScene extends Phaser.Scene {
  private definition!: StorySceneDefinition;
  private currentBeatIndex = 0;
  private imageRect: Phaser.GameObjects.Rectangle | null = null;
  private imageLabel: Phaser.GameObjects.Text | null = null;
  private beatText: Phaser.GameObjects.Text | null = null;
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
    this.cameras.main.fadeIn(FADE_DURATION);
    this.time.delayedCall(FADE_DURATION, () => {
      this.ready = true;
    });

    // Image area — upper portion
    this.imageRect = this.add.rectangle(400, IMAGE_HEIGHT / 2, 800, IMAGE_HEIGHT, 0x333333);
    this.imageRect.setOrigin(0.5, 0.5);

    this.imageLabel = this.add.text(400, IMAGE_HEIGHT / 2, '', {
      fontSize: '20px',
      color: '#999999',
    });
    this.imageLabel.setOrigin(0.5, 0.5);

    // Text panel — lower portion
    const panelGraphics = this.add.graphics();
    panelGraphics.fillStyle(0x111122, 0.95);
    panelGraphics.fillRect(0, IMAGE_HEIGHT, 800, 600 - IMAGE_HEIGHT);

    this.beatText = this.add.text(TEXT_PADDING, IMAGE_HEIGHT + TEXT_PADDING, '', {
      fontSize: '16px',
      color: '#ffffff',
      wordWrap: { width: 800 - TEXT_PADDING * 2 },
      lineSpacing: 6,
    });

    // Advance prompt
    const advanceHint = this.add.text(400, 580, 'Tap or press Space to continue', {
      fontSize: '11px',
      color: '#666666',
    });
    advanceHint.setOrigin(0.5, 0.5);

    // Input
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    this.input.on('pointerup', () => {
      if (this.ready) this.advanceBeat();
    });

    this.showBeat(this.definition.beats[0]);
  }

  update(): void {
    if (!this.ready) return;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.advanceBeat();
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
}
