import Phaser from 'phaser';

export const EMBER_COLOR = 0xf2c878;
export const EMBER_PULSE_DURATION_MS = 600;
export const EMBER_PULSE_DEPTH = 5.5;
const EMBER_PULSE_START_RADIUS = 4;
const EMBER_PULSE_END_RADIUS = 12;

// Ember-pulse system — the "Share warmth" verb (US-85). startPulse plays a
// warm-gold disc that grows from the player and travels to a target NPC,
// landing with a soft fade. On completion, the supplied callback fires so the
// warming flag flip happens exactly when the pulse lands (light brighten +
// alpha-gate force-eval are downstream onFlagChange subscribers and ride the
// same flag-flip tick).
//
// Restart hygiene (Learning EP-02): pulseObject + pulseTween instance fields
// are reset at the top of startPulse and on shutdown — the Arc and Tween are
// scene-owned and don't survive scene.restart, so we never leak references.
export class EmberShareSystem {
  private scene: Phaser.Scene;
  private pulseObject: Phaser.GameObjects.Arc | null = null;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.pulseObject = null;
    this.pulseTween = null;
    scene.events.once('shutdown', () => {
      if (this.pulseTween) {
        this.pulseTween.stop();
        this.pulseTween = null;
      }
      if (this.pulseObject) {
        this.pulseObject.destroy();
        this.pulseObject = null;
      }
    });
  }

  startPulse(
    playerSprite: { x: number; y: number },
    targetNpcSprite: { x: number; y: number },
    onComplete: () => void,
  ): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    if (this.pulseObject) {
      this.pulseObject.destroy();
      this.pulseObject = null;
    }

    const arc = this.scene.add.circle(
      playerSprite.x,
      playerSprite.y,
      EMBER_PULSE_END_RADIUS,
      EMBER_COLOR,
      1,
    );
    arc.setDepth(EMBER_PULSE_DEPTH);
    arc.setScale(EMBER_PULSE_START_RADIUS / EMBER_PULSE_END_RADIUS);

    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore(arc);

    this.pulseObject = arc;

    this.pulseTween = this.scene.tweens.add({
      targets: arc,
      x: targetNpcSprite.x,
      y: targetNpcSprite.y,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: EMBER_PULSE_DURATION_MS,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.pulseObject) {
          this.pulseObject.destroy();
          this.pulseObject = null;
        }
        this.pulseTween = null;
        onComplete();
      },
    });
  }
}
