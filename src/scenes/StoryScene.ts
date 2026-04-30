import Phaser from 'phaser';
import { StorySceneDefinition, StoryBeat } from '../data/areas/types';
import { TILE_SIZE } from '../maps/constants';
import { SCENE_ASSETS, BeatAsset } from '../art/sceneAssets';
import { STYLE_PALETTE } from '../art/styleGuide';

const FADE_DURATION = 500;
const IMAGE_HEIGHT_RATIO = 0.55;
const TEXT_PADDING = 16;
const BEAT_FONT_SIZE = 16;
const BEAT_LINE_SPACING = 6;
const BEAT_FONT_FAMILY = 'serif';
const LABEL_FONT_SIZE = 18;
const HINT_FONT_SIZE = 10;
const CHARS_PER_SECOND = 35;
const TARGET_VISIBLE_TILES = 10;
const BEAT_FADE_DURATION_MS = 400;

// Depth map (StoryScene) — explicit per US-89 done-when, no creation-order
// dependency. Documented inline per the AGENTS.md depth-map convention.
//   -1 = letterbox cream backing (under image, only visible when aspect leaves bars)
//    0 = beat image (or fallback rect — mutually exclusive per beat)
//    1 = image label (placeholder fallback only)
//   10 = text panel graphics
//   11 = beat text (typewriter target)
//   12 = advance hint
const DEPTH_LETTERBOX = -1;
const DEPTH_IMAGE = 0;
const DEPTH_LABEL = 1;
const DEPTH_PANEL = 10;
const DEPTH_BEAT_TEXT = 11;
const DEPTH_ADVANCE_HINT = 12;

const hexToInt = (h: string) => parseInt(h.slice(1), 16);
const PANEL_FILL_INT = hexToInt(STYLE_PALETTE.umberDark);
const PANEL_TEXT_COLOR = STYLE_PALETTE.creamLight;
const LETTERBOX_FILL_INT = hexToInt(STYLE_PALETTE.creamLight);
const HINT_COLOR = STYLE_PALETTE.sepiaLight;
const FALLBACK_RECT_COLOR = hexToInt(STYLE_PALETTE.sepiaDark);
const FALLBACK_LABEL_COLOR = STYLE_PALETTE.creamLight;

function textureKeyFor(sceneId: string, beatIndex: number, beat: StoryBeat): string {
  if (beat.assetRef) return `scene-${beat.assetRef}`;
  return `scene-${sceneId}-${beatIndex}`;
}

export class StoryScene extends Phaser.Scene {
  private definition!: StorySceneDefinition;
  private currentBeatIndex = 0;

  // Layered image stack (cross-fade)
  private currentBeatImage: Phaser.GameObjects.Image | null = null;
  private previousBeatImage: Phaser.GameObjects.Image | null = null;
  private crossFadeInProgress = false;
  private incomingFadeTween: Phaser.Tweens.Tween | null = null;
  private outgoingFadeTween: Phaser.Tweens.Tween | null = null;

  // Letterbox bg — only visible when an image leaves space at the slot edges
  private letterboxRect: Phaser.GameObjects.Rectangle | null = null;

  // Fallback (texture missing) — flat colour rect + label
  private imageRect: Phaser.GameObjects.Rectangle | null = null;
  private imageLabel: Phaser.GameObjects.Text | null = null;

  // Text panel + content
  private panelGraphics: Phaser.GameObjects.Graphics | null = null;
  private beatText: Phaser.GameObjects.Text | null = null;
  private advanceHint: Phaser.GameObjects.Text | null = null;

  // Input
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;

  // Lifecycle / typewriter
  private ready = false;
  private fullText = '';
  private revealedCount = 0;
  private typewriterComplete = false;
  private typewriterTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'StoryScene' });
  }

  /** Scale a design-pixel value by the same zoom factor GameScene uses. */
  private s(v: number): number {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    const zoom = Math.max(1, shortSide / (TARGET_VISIBLE_TILES * TILE_SIZE));
    return v * zoom;
  }

  init(data: { definition: StorySceneDefinition }): void {
    this.definition = data.definition;
    this.currentBeatIndex = 0;
    this.ready = false;

    // Reset hygiene (Learning EP-02): null all GameObject refs at the top of
    // init so a scene.restart starts from a clean slate. Tweens are cleared
    // in cleanupResize.
    this.currentBeatImage = null;
    this.previousBeatImage = null;
    this.crossFadeInProgress = false;
    this.incomingFadeTween = null;
    this.outgoingFadeTween = null;
    this.letterboxRect = null;
    this.imageRect = null;
    this.imageLabel = null;
    this.panelGraphics = null;
    this.beatText = null;
    this.advanceHint = null;
    this.typewriterTimer = null;
    this.fullText = '';
    this.revealedCount = 0;
    this.typewriterComplete = false;
  }

  preload(): void {
    Object.entries(SCENE_ASSETS).forEach(([sceneId, beats]) => {
      beats.forEach((beat: BeatAsset, beatIndex: number) => {
        const key = `scene-${sceneId}-${beatIndex}`;
        if (this.textures.exists(key)) return;
        if (beat.kind === 'animated') {
          console.warn(
            `[StoryScene.preload] animated beats not yet exercised; (${sceneId}, ${beatIndex}) entry='${beat.file}' skipped — fallback rect will render`,
          );
          return;
        }
        this.load.image(key, beat.file);
      });
    });
    // Missing-file path: log (sceneId, beatIndex, expected path) and proceed —
    // showBeat detects the missing texture and renders the fallback rect+label.
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      const match = /^scene-(.+)-(\d+)$/.exec(file.key);
      if (match) {
        console.warn(
          `[StoryScene.preload] missing file: sceneId=${match[1]} beatIndex=${match[2]} expected path=assets/${file.url}`,
        );
      }
    });
  }

  create(): void {
    const { width, height } = this.scale;
    const imageH = Math.round(height * IMAGE_HEIGHT_RATIO);

    this.cameras.main.fadeIn(FADE_DURATION);
    this.time.delayedCall(FADE_DURATION, () => {
      this.ready = true;
    });

    this.letterboxRect = this.add.rectangle(width / 2, imageH / 2, width, imageH, LETTERBOX_FILL_INT);
    this.letterboxRect.setOrigin(0.5, 0.5);
    this.letterboxRect.setDepth(DEPTH_LETTERBOX);

    this.panelGraphics = this.add.graphics();
    this.panelGraphics.setDepth(DEPTH_PANEL);
    this.redrawPanel(width, height, imageH);

    const pad = this.s(TEXT_PADDING);
    this.beatText = this.add.text(pad, imageH + pad, '', {
      fontSize: `${this.s(BEAT_FONT_SIZE)}px`,
      color: PANEL_TEXT_COLOR,
      fontFamily: BEAT_FONT_FAMILY,
      wordWrap: { width: width - pad * 2 },
      lineSpacing: this.s(BEAT_LINE_SPACING),
    });
    this.beatText.setDepth(DEPTH_BEAT_TEXT);

    this.advanceHint = this.add.text(width / 2, height - this.s(12), 'Tap or press Space to continue', {
      fontSize: `${this.s(HINT_FONT_SIZE)}px`,
      color: HINT_COLOR,
    });
    this.advanceHint.setOrigin(0.5, 0.5);
    this.advanceHint.setDepth(DEPTH_ADVANCE_HINT);

    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    this.input.on('pointerup', () => {
      if (this.ready) this.advanceBeat();
    });

    this.scale.on('resize', this.handleResize, this);
    this.events.on('shutdown', this.cleanupResize, this);
    this.events.on('destroy', this.cleanupResize, this);

    this.showInitialBeat(this.definition.beats[0]);
  }

  update(): void {
    if (!this.ready) return;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.advanceBeat();
    }
  }

  private redrawPanel(width: number, height: number, imageH: number): void {
    if (!this.panelGraphics) return;
    this.panelGraphics.clear();
    this.panelGraphics.fillStyle(PANEL_FILL_INT, 0.95);
    this.panelGraphics.fillRect(0, imageH, width, height - imageH);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const imageH = Math.round(height * IMAGE_HEIGHT_RATIO);
    const pad = this.s(TEXT_PADDING);

    if (this.letterboxRect) {
      this.letterboxRect.setPosition(width / 2, imageH / 2);
      this.letterboxRect.setSize(width, imageH);
    }
    if (this.currentBeatImage) {
      this.fitImageToSlot(this.currentBeatImage, width, imageH);
    }
    if (this.previousBeatImage) {
      this.fitImageToSlot(this.previousBeatImage, width, imageH);
    }
    if (this.imageRect) {
      this.imageRect.setPosition(width / 2, imageH / 2);
      this.imageRect.setSize(width, imageH);
    }
    if (this.imageLabel) {
      this.imageLabel.setPosition(width / 2, imageH / 2);
      this.imageLabel.setFontSize(this.s(LABEL_FONT_SIZE));
    }

    this.redrawPanel(width, height, imageH);

    if (this.beatText) {
      this.beatText.setPosition(pad, imageH + pad);
      this.beatText.setFontSize(this.s(BEAT_FONT_SIZE));
      this.beatText.setWordWrapWidth(width - pad * 2);
    }

    if (this.advanceHint) {
      this.advanceHint.setPosition(width / 2, height - this.s(12));
      this.advanceHint.setFontSize(this.s(HINT_FONT_SIZE));
    }
  }

  private fitImageToSlot(img: Phaser.GameObjects.Image, slotWidth: number, slotHeight: number): void {
    const tex = img.texture.getSourceImage();
    const srcW = tex.width || 1;
    const srcH = tex.height || 1;
    const scale = Math.min(slotWidth / srcW, slotHeight / srcH);
    img.setScale(scale);
    img.setPosition(slotWidth / 2, slotHeight / 2);
  }

  private renderImageOrFallback(beat: StoryBeat, beatIndex: number): Phaser.GameObjects.Image | null {
    const { width, height } = this.scale;
    const imageH = Math.round(height * IMAGE_HEIGHT_RATIO);
    const key = textureKeyFor(this.definition.id, beatIndex, beat);

    if (this.textures.exists(key)) {
      this.imageRect?.destroy();
      this.imageRect = null;
      this.imageLabel?.destroy();
      this.imageLabel = null;

      const img = this.add.image(width / 2, imageH / 2, key);
      img.setOrigin(0.5, 0.5);
      img.setDepth(DEPTH_IMAGE);
      this.fitImageToSlot(img, width, imageH);
      return img;
    }

    // Fallback path — flat-color rect + label.
    if (!this.imageRect) {
      this.imageRect = this.add.rectangle(width / 2, imageH / 2, width, imageH, FALLBACK_RECT_COLOR);
      this.imageRect.setOrigin(0.5, 0.5);
      this.imageRect.setDepth(DEPTH_IMAGE);
    } else if (beat.imageColor !== undefined) {
      this.imageRect.setFillStyle(beat.imageColor);
    }
    if (!this.imageLabel) {
      this.imageLabel = this.add.text(width / 2, imageH / 2, '', {
        fontSize: `${this.s(LABEL_FONT_SIZE)}px`,
        color: FALLBACK_LABEL_COLOR,
        fontFamily: BEAT_FONT_FAMILY,
      });
      this.imageLabel.setOrigin(0.5, 0.5);
      this.imageLabel.setDepth(DEPTH_LABEL);
    }
    this.imageLabel.setText(beat.imageLabel ?? '');
    return null;
  }

  private showInitialBeat(beat: StoryBeat): void {
    this.currentBeatImage = this.renderImageOrFallback(beat, 0);
    this.startTypewriter(beat.text);
  }

  private startTypewriter(text: string): void {
    this.fullText = text;
    this.revealedCount = 0;
    this.typewriterComplete = false;
    if (this.beatText) this.beatText.setText('');
    if (this.advanceHint) this.advanceHint.setVisible(false);

    this.typewriterTimer?.destroy();
    this.typewriterTimer = this.time.addEvent({
      delay: 1000 / CHARS_PER_SECOND,
      callback: () => {
        this.revealedCount++;
        if (this.beatText) {
          this.beatText.setText(this.fullText.substring(0, this.revealedCount));
        }
        if (this.revealedCount >= this.fullText.length) {
          this.typewriterComplete = true;
          this.typewriterTimer?.destroy();
          this.typewriterTimer = null;
          if (this.advanceHint) this.advanceHint.setVisible(true);
        }
      },
      loop: true,
    });
  }

  private advanceBeat(): void {
    // Two-tap: first tap completes typewriter, second tap advances.
    if (!this.typewriterComplete) {
      this.completeTypewriter();
      return;
    }
    // Cross-fade re-entrancy guard. Once typewriter is complete and the
    // outgoing tween is running, additional taps are no-ops until the fade
    // settles (US-89 done-when).
    if (this.crossFadeInProgress) {
      return;
    }
    this.currentBeatIndex++;
    if (this.currentBeatIndex < this.definition.beats.length) {
      this.crossFadeToBeat(this.definition.beats[this.currentBeatIndex]);
    } else {
      this.exitScene();
    }
  }

  private crossFadeToBeat(beat: StoryBeat): void {
    // Promote current → previous, prepare incoming.
    this.previousBeatImage = this.currentBeatImage;
    this.currentBeatImage = null;
    this.crossFadeInProgress = true;

    const incoming = this.renderImageOrFallback(beat, this.currentBeatIndex);

    if (incoming) {
      incoming.setAlpha(0);
      this.currentBeatImage = incoming;

      this.incomingFadeTween = this.tweens.add({
        targets: incoming,
        alpha: 1,
        duration: BEAT_FADE_DURATION_MS,
        onComplete: () => {
          this.incomingFadeTween = null;
        },
      });

      if (this.previousBeatImage) {
        const outgoing = this.previousBeatImage;
        this.outgoingFadeTween = this.tweens.add({
          targets: outgoing,
          alpha: 0,
          duration: BEAT_FADE_DURATION_MS,
          onComplete: () => {
            outgoing.destroy();
            if (this.previousBeatImage === outgoing) {
              this.previousBeatImage = null;
            }
            this.outgoingFadeTween = null;
            this.crossFadeInProgress = false;
          },
        });
      } else {
        // No previous image — clear the guard the moment incoming lands.
        this.tweens.add({
          targets: incoming,
          alpha: 1,
          duration: 1,
          onComplete: () => {
            this.crossFadeInProgress = false;
          },
        });
      }
    } else {
      // Incoming uses the fallback path (texture missing) — no Image to fade.
      // Tear the previous image immediately if present and clear the guard.
      this.previousBeatImage?.destroy();
      this.previousBeatImage = null;
      this.crossFadeInProgress = false;
    }

    this.startTypewriter(beat.text);
  }

  private completeTypewriter(): void {
    this.typewriterTimer?.destroy();
    this.typewriterTimer = null;
    this.revealedCount = this.fullText.length;
    this.typewriterComplete = true;
    if (this.beatText) {
      this.beatText.setText(this.fullText);
    }
    if (this.advanceHint) {
      this.advanceHint.setVisible(true);
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
    if (this.incomingFadeTween) {
      this.incomingFadeTween.stop();
      this.incomingFadeTween = null;
    }
    if (this.outgoingFadeTween) {
      this.outgoingFadeTween.stop();
      this.outgoingFadeTween = null;
    }
    this.crossFadeInProgress = false;
    this.typewriterTimer?.destroy();
    this.typewriterTimer = null;
  }
}
