import Phaser from 'phaser';

// F1 — Heart Bridge stag finale (#197). The once-wordless King speaks a short warm
// invitation; as each beat lands a warm glow on the stag CRESCENDOS (Jaco #1254 visual=b),
// and when Pip answers "Yes" the glow blooms into a radiant burst that floods the screen
// with warm light — the closing image (finale=a: warmth/colour blooms OUT from the stag).
// All simulated in-engine (additive circles + tweens), NO new pixel art — reuses the same
// add.circle + tween idiom as EmberShareSystem.

const GLOW_COLOR = 0xffe6a8; // warm gold, a touch brighter than the ember pulse
const GLOW_BASE_RADIUS = 90; // design px; full level fills this radius
const GLOW_DEPTH = 5.4; // just under the ember pulse, above ground, below sprites' top
const GLOW_RAMP_MS = 900; // per-beat ease toward the new level
const BURST_EXPAND_MS = 1400;
const BURST_HOLD_MS = 500;
const FLOOD_FADE_MS = 1600;
const SPARK_COUNT = 10;

export class StagFinaleSystem {
  private scene: Phaser.Scene;
  private target: { x: number; y: number } | null = null;
  private glow: Phaser.GameObjects.Arc | null = null;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private level = 0;
  private burstObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events.once('shutdown', () => this.destroyAll());
    scene.events.once('destroy', () => this.destroyAll());
  }

  private destroyAll(): void {
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }
    if (this.glow) {
      this.glow.destroy();
      this.glow = null;
    }
    for (const obj of this.burstObjects) obj.destroy();
    this.burstObjects = [];
    this.target = null;
    this.level = 0;
  }

  /** Anchor the glow on the stag. Idempotent — repeat calls just refresh position. */
  attach(target: { x: number; y: number }): void {
    this.target = { x: target.x, y: target.y };
    if (!this.glow) {
      const g = this.scene.add.circle(target.x, target.y, GLOW_BASE_RADIUS, GLOW_COLOR, 1);
      g.setDepth(GLOW_DEPTH);
      g.setBlendMode(Phaser.BlendModes.ADD);
      g.setAlpha(0);
      g.setScale(0.001);
      const uiCam = this.scene.cameras.getCamera('ui');
      if (uiCam) uiCam.ignore(g);
      this.glow = g;
    } else {
      this.glow.setPosition(target.x, target.y);
    }
  }

  /** Ease the glow toward a 0..1 intensity. Each dialogue beat nudges it up. */
  setLevel(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.level = clamped;
    if (!this.glow) return;
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }
    // Alpha caps below 1 so the build stays "warming", saving the full blaze for the burst.
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: 0.12 + clamped * 0.5,
      scaleX: 0.4 + clamped * 0.85,
      scaleY: 0.4 + clamped * 0.85,
      duration: GLOW_RAMP_MS,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * The "Yes" payoff: the glow blooms outward into a radiant burst that floods the
   * screen with warm light, then holds. onComplete fires once the screen is full of
   * warmth — the moment the end-of-game page (F2) takes over.
   */
  burst(onComplete: () => void): void {
    const target = this.target;
    if (!target) {
      onComplete();
      return;
    }
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }

    const uiCam = this.scene.cameras.getCamera('ui');
    const ignoreUi = (obj: Phaser.GameObjects.GameObject) => {
      if (uiCam) uiCam.ignore(obj);
    };

    // 1) The stag's own glow flares up to full as the core of the burst.
    if (this.glow) {
      this.scene.tweens.add({
        targets: this.glow,
        alpha: 1,
        scaleX: 2.4,
        scaleY: 2.4,
        duration: BURST_EXPAND_MS,
        ease: 'Quad.easeOut',
      });
    }

    // 2) A bright expanding ring radiating from the stag.
    const ring = this.scene.add.circle(target.x, target.y, GLOW_BASE_RADIUS, 0xfff4d6, 0.9);
    ring.setDepth(GLOW_DEPTH + 0.05);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setScale(0.2);
    ignoreUi(ring);
    this.burstObjects.push(ring);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: BURST_EXPAND_MS,
      ease: 'Cubic.easeOut',
    });

    // 3) A scatter of warm sparks drifting outward (deterministic angles, no RNG).
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / SPARK_COUNT;
      const dist = 140 + (i % 3) * 40;
      const spark = this.scene.add.circle(target.x, target.y, 5, GLOW_COLOR, 1);
      spark.setDepth(GLOW_DEPTH + 0.1);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      ignoreUi(spark);
      this.burstObjects.push(spark);
      this.scene.tweens.add({
        targets: spark,
        x: target.x + Math.cos(angle) * dist,
        y: target.y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: BURST_EXPAND_MS + (i % 4) * 120,
        ease: 'Sine.easeOut',
      });
    }

    // 4) A warm screen-flood that swells to fill the closing image. A hand-placed
    //    rectangle proved fragile across the dual-camera setup (it rendered on only
    //    one camera and never covered the full viewport), so use Phaser's built-in
    //    camera fade — it draws a guaranteed full-viewport warm overlay on the main
    //    camera, washing the whole world (stag, glow, sparks) to warm light. The
    //    "Space to talk" prompt renders on this same camera, so the fade covers it too.
    const mainCam = this.scene.cameras.main;
    let fired = false;
    const finish = () => {
      if (fired) return;
      fired = true;
      this.scene.time.delayedCall(BURST_HOLD_MS, () => onComplete());
    };
    this.scene.time.delayedCall(Math.max(0, BURST_EXPAND_MS - 400), () => {
      if (!mainCam) {
        finish();
        return;
      }
      // fadeOut(duration, r, g, b, callback) — callback runs each frame with progress;
      // fire the hand-off once it reaches full warmth.
      mainCam.fadeOut(FLOOD_FADE_MS, 255, 241, 207, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress >= 1) finish();
      });
    });
  }
}
