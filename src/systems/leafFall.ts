import Phaser from 'phaser';

// Falling leaves (FB-2, 2026-06-16). Jaco wants Briar Wilds to feel like a living
// (if eerie) forest, not a still picture — "leaves falling effect". This drifts a
// sparse field of dead leaves down the screen, fluttering and tumbling, so the wood
// reads as wind-stirred even before the larger map redesign.
//
// A leaf is a weather effect the player should SEE, so — unlike the ambient motes,
// which deliberately desaturate into the drained world — the leaves render on the UI
// camera (no desat) and stay a muted autumn amber against the cold grey forest. They
// live in SCREEN space (a full-screen overlay that falls regardless of where the
// player walks), the standard way games layer rain/snow/leaves: the main camera
// ignores them so they aren't double-drawn and greyed.
//
// Cost: a fixed pool of leaves mutated in place each frame (Learning EP-01 — no
// per-frame allocation). Each leaf recycles to the top once it falls off the bottom,
// so a small count holds a constant on-screen density.

const LEAF_TEX_KEY = 'falling-leaf';
// Baked larger than it draws, with NEAREST filtering, so the pointed silhouette
// stays crisp when scaled down — a soft/blurry leaf just reads as another dust mote.
const LEAF_TEX_W = 24;
const LEAF_TEX_H = 32;
// Above world props but below thought bubbles (depth 8). They live on the UI camera
// so depth only orders them against other UI-camera objects.
const LEAF_DEPTH = 6;

const LEAF_COUNT = 22;          // fixed on-screen density (pool size)
const MARGIN = 48;              // spawn/recycle band just outside the screen
const FALL_MIN = 24, FALL_MAX = 52;   // px/s downward fall speed (per leaf)
const DRIFT_VX = 9;             // px/s base sideways drift (wind)
const SWAY_AMP = 22;            // px/s flutter amplitude (leaves swing as they fall)
const SWAY_SPEED = 0.9;         // rad/s flutter frequency
const ROT_MIN = 0.5, ROT_MAX = 1.6;   // rad/s tumble speed (signed per leaf)
// Near-opaque so each leaf reads as a solid shape, not a ghostly smear, against the
// dark drained forest (a faint leaf at low alpha just disappears into the gloom).
const ALPHA_MIN = 0.82, ALPHA_MAX = 1.0;
const SIZE_MIN = 20, SIZE_MAX = 30;   // on-screen height (px); reads as a leaf, not a speck

interface Leaf {
  img: Phaser.GameObjects.Image;
  x: number;        // screen px
  y: number;        // screen px
  fall: number;     // px/s downward
  drift: number;    // -1..1 sideways direction multiplier
  phase: number;    // flutter phase offset (0..2π)
  rot: number;      // current rotation (rad)
  rotSpeed: number; // rad/s (signed)
  seed: number;     // bumped on recycle to vary the sin-hash
}

export class LeafFallSystem {
  private scene: Phaser.Scene;
  private leaves: Leaf[] = [];
  private initialised = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureTexture();
  }

  // Pre-bake one leaf: a pointed almond blade with a short stem and a midrib vein,
  // muted autumn amber. NEAREST filtering keeps the silhouette crisp when scaled
  // down so a tumbling leaf reads as a leaf, not a soft dust mote.
  private ensureTexture(): void {
    if (this.scene.textures.exists(LEAF_TEX_KEY)) return;
    const canvas = this.scene.textures.createCanvas(LEAF_TEX_KEY, LEAF_TEX_W, LEAF_TEX_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const w = LEAF_TEX_W;
    const h = LEAF_TEX_H;
    const tipTop = h * 0.10;       // pointed top of the blade
    const tipBot = h * 0.82;       // base of the blade, where the stem starts
    // Blade — a pointed almond, widest just below centre (a real leaf taper).
    // Bright, saturated autumn amber so it pops against the dark drained forest.
    ctx.fillStyle = 'rgba(206,140,52,1)';
    ctx.beginPath();
    ctx.moveTo(w / 2, tipTop);
    ctx.quadraticCurveTo(w - 1, h * 0.42, w / 2, tipBot);
    ctx.quadraticCurveTo(1, h * 0.42, w / 2, tipTop);
    ctx.fill();
    // Darker edge so the shape holds against light ground.
    ctx.strokeStyle = 'rgba(110,68,28,0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Stem nub trailing from the base.
    ctx.strokeStyle = 'rgba(120,76,32,1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, tipBot);
    ctx.lineTo(w / 2, h - 1);
    ctx.stroke();
    // Midrib vein.
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, tipTop + 1);
    ctx.lineTo(w / 2, tipBot - 1);
    ctx.stroke();
    canvas.refresh();
    // Crisp downscale — without this the blade blurs into a round speck.
    this.scene.textures.get(LEAF_TEX_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // Deterministic pseudo-random in [0,1) from an integer seed (Math.random is
  // unavailable / non-deterministic here — same hash the ambient motes use).
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  // Lazily build the pool on the first update, once the camera dimensions are known.
  // Re-runnable: a scene.restart drops the old images and this rebuilds.
  private init(w: number, h: number): void {
    for (let i = 0; i < LEAF_COUNT; i++) {
      const x = this.rand(i * 2 + 1) * w;
      const y = this.rand(i * 2 + 2) * h;
      const img = this.scene.add.image(x, y, LEAF_TEX_KEY);
      img.setOrigin(0.5, 0.5);
      img.setScrollFactor(0);
      img.setDepth(LEAF_DEPTH);
      const size = SIZE_MIN + this.rand(i * 3 + 5) * (SIZE_MAX - SIZE_MIN); // on-screen height
      img.setDisplaySize(size * (LEAF_TEX_W / LEAF_TEX_H), size);
      img.setAlpha(ALPHA_MIN + this.rand(i * 13 + 8) * (ALPHA_MAX - ALPHA_MIN));
      // UI-camera object: the main camera must ignore it or it would double-render a
      // greyed-out copy through the desaturation pass (same rule the forest eyes use).
      this.scene.cameras.main.ignore(img);
      const dir = this.rand(i * 17 + 9) < 0.5 ? -1 : 1;
      this.leaves.push({
        img,
        x,
        y,
        fall: FALL_MIN + this.rand(i * 5 + 3) * (FALL_MAX - FALL_MIN),
        drift: (this.rand(i * 7 + 4) * 2 - 1),
        phase: this.rand(i * 11 + 6) * Math.PI * 2,
        rot: this.rand(i * 19 + 10) * Math.PI * 2,
        rotSpeed: dir * (ROT_MIN + this.rand(i * 23 + 12) * (ROT_MAX - ROT_MIN)),
        seed: i * 100 + 7,
      });
    }
    this.initialised = true;
  }

  // Fall + flutter + tumble every frame. Recycles a leaf to the top band when it
  // falls off the bottom so density stays constant. No allocation in the loop.
  update(timeMs: number, deltaMs: number): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const w = cam.width;
    const h = cam.height;
    if (w === 0 || h === 0) return; // not ready yet
    if (!this.initialised) {
      this.init(w, h);
      return;
    }
    const t = timeMs * 0.001;
    const dt = deltaMs * 0.001;

    for (const l of this.leaves) {
      const sway = Math.sin(t * SWAY_SPEED + l.phase) * SWAY_AMP;
      l.x += (DRIFT_VX * l.drift + sway) * dt;
      l.y += l.fall * dt;
      l.rot += l.rotSpeed * dt;

      // Recycle to the top once it falls off the bottom, at a fresh x.
      if (l.y > h + MARGIN) {
        l.seed += 31;
        l.y = -MARGIN;
        l.x = this.rand(l.seed) * w;
      }
      // Wrap sideways so wind never blows a leaf permanently off-screen.
      if (l.x < -MARGIN) l.x = w + MARGIN;
      else if (l.x > w + MARGIN) l.x = -MARGIN;

      l.img.setPosition(l.x, l.y);
      l.img.setRotation(l.rot);
    }
  }

  destroy(): void {
    for (const l of this.leaves) l.img.destroy();
    this.leaves = [];
    this.initialised = false;
  }
}
