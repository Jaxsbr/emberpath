import Phaser from 'phaser';

// Frog pond ambient (FB-13 slice 4, 2026-06-17). The Fog Marsh has a real pond
// now (slices 1-3: water basin, cattails, lily pads) but it sits dead-still. A
// marsh should feel ALIVE — so a single frog surfaces at one of three fixed pond
// spots, rises from the water, sits a beat, then submerges and re-emerges at a
// different spot. Sparse and calm (a real pond plops occasionally, it doesn't
// churn), so the marsh reads as inhabited, not a flat painting.
//
// Same pattern as ForestEyesSystem: the frog renders on the UI camera, NOT the
// main camera. The main camera's desaturation pass would grey the frog into the
// fog and kill the "spot of life" read — so the frog holds a fixed WORLD spot
// while up and the loop projects that point to screen pixels each frame, scaled
// by the main-camera zoom (so it sits in the world as Pip moves past it).
//
// Cost: one pre-baked frog texture mutated in place (Learning EP-01 — no per-
// frame allocation). Math.random is unavailable / non-deterministic in this
// build, so timing variation comes from a sin-hash seeded by a per-cycle
// counter (same approach as the forest eyes and ambient motes).

const FROG_TEX_KEY = 'marsh-frog';
const FROG_TEX_W = 32;
const FROG_TEX_H = 26;
// Above the water tile + lily-pad decoration, below thought bubbles (depth 8).
// On the UI camera, so depth only orders it against other UI-camera objects.
const FROG_DEPTH = 6;

const FROG_WIDTH = 22;          // on-screen width when up, at zoom 1 (px)

// State timings (ms). A calm marsh: long waits between surfacings, a brief sit.
const WAIT_MIN = 3600, WAIT_MAX = 8200;   // submerged, between appearances
const RISE = 520;                          // emerging from the water
const HOLD_MIN = 1700, HOLD_MAX = 3800;    // sitting at the surface
const SUBMERGE = 460;                       // sinking back under
const RISE_OFFSET = 13;         // px the frog travels up out of the water as it rises
const ALPHA_MAX = 0.9;

type FrogState = 'wait' | 'rise' | 'hold' | 'submerge';

interface Spot { x: number; y: number; }

export class FrogPondSystem {
  private scene: Phaser.Scene;
  private spots: Spot[];
  private img: Phaser.GameObjects.Image | null = null;
  private state: FrogState = 'wait';
  private timer = 0;
  private duration = 1;
  private spot = 0;        // index into spots of the current surfacing
  private seed = 11;       // bumped each relocate to vary the sin-hash
  private initialised = false;

  // spots: fixed pond world positions (px) the frog cycles among (3 expected).
  constructor(scene: Phaser.Scene, spots: Spot[]) {
    this.scene = scene;
    this.spots = spots;
    this.ensureTexture();
  }

  // Pre-bake a small storybook frog peeking from the water: a moss-green dome
  // with two bulging eyes on top, deep-umber outline (never pure black, per the
  // art bible), a lighter throat. Natural greens only — gold is the sacred
  // colour and is never spent on ambient critters.
  private ensureTexture(): void {
    if (this.scene.textures.exists(FROG_TEX_KEY)) return;
    const canvas = this.scene.textures.createCanvas(FROG_TEX_KEY, FROG_TEX_W, FROG_TEX_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const cx = FROG_TEX_W / 2;
    const umber = '#3a2e1f';
    const bodyTop = '#7c8a45';      // moss-green crown
    const bodyBot = '#5e6c33';      // darker green near the waterline
    const throat = '#9aa85e';       // pale throat highlight

    // Body dome — a wide low hump sitting on the waterline (flat bottom).
    const domeY = FROG_TEX_H - 6;   // waterline
    const domeRx = 11, domeRy = 9;
    const grad = ctx.createLinearGradient(0, domeY - domeRy, 0, domeY);
    grad.addColorStop(0, bodyTop);
    grad.addColorStop(1, bodyBot);
    ctx.lineWidth = 2;
    ctx.strokeStyle = umber;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, domeY, domeRx, domeRy, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Throat highlight — a soft lighter patch low-centre.
    ctx.fillStyle = throat;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, domeY - 2, 4.5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Two bulging eyes poking up above the crown (the frog signature).
    const eyeY = domeY - domeRy + 1;
    for (const ex of [cx - 5, cx + 5]) {
      // eye mound (green, umber-outlined)
      ctx.fillStyle = bodyTop;
      ctx.strokeStyle = umber;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // pupil
      ctx.fillStyle = umber;
      ctx.beginPath();
      ctx.arc(ex, eyeY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // a tiny life-catch highlight
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ex - 0.7, eyeY - 0.8, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nostrils — two faint dots between the eyes and the snout.
    ctx.fillStyle = umber;
    ctx.globalAlpha = 0.6;
    for (const nx of [cx - 1.6, cx + 1.6]) {
      ctx.beginPath();
      ctx.arc(nx, domeY - 4, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    canvas.refresh();
  }

  // Deterministic pseudo-random in [0,1) from an integer seed (Math.random is
  // unavailable / non-deterministic here — same hash the forest eyes use).
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  private build(): void {
    const img = this.scene.add.image(0, 0, FROG_TEX_KEY);
    img.setOrigin(0.5, 1);   // anchor at the waterline (bottom) so it rises upward
    img.setDepth(FROG_DEPTH);
    img.setAlpha(0);
    // UI-camera object: the main camera must NOT draw it (it would render a
    // greyed-out copy through the desaturation pass).
    this.scene.cameras.main.ignore(img);
    this.img = img;
    // Start submerged with a staggered first surfacing.
    this.state = 'wait';
    this.duration = WAIT_MIN;
    this.timer = 700 + this.rand(3) * (WAIT_MAX - 700);
    this.initialised = true;
  }

  // Move to a different pond spot than the current one.
  private relocate(): void {
    this.seed += 37;
    if (this.spots.length <= 1) { this.spot = 0; return; }
    // pick an offset of 1..(n-1) so we always land on a different spot
    const step = 1 + Math.floor(this.rand(this.seed) * (this.spots.length - 1));
    this.spot = (this.spot + step) % this.spots.length;
  }

  private startState(state: FrogState): void {
    this.state = state;
    if (state === 'wait') this.duration = WAIT_MIN + this.rand(this.seed + 3) * (WAIT_MAX - WAIT_MIN);
    else if (state === 'rise') this.duration = RISE;
    else if (state === 'hold') this.duration = HOLD_MIN + this.rand(this.seed + 4) * (HOLD_MAX - HOLD_MIN);
    else this.duration = SUBMERGE;
    this.timer = this.duration;
  }

  update(_timeMs: number, deltaMs: number): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const view = cam.worldView;
    if (view.width === 0 || view.height === 0) return; // not ready yet
    if (!this.initialised) { this.build(); return; }
    const img = this.img;
    if (!img) return;

    this.timer -= deltaMs;
    if (this.timer <= 0) {
      if (this.state === 'wait') { this.relocate(); this.startState('rise'); }
      else if (this.state === 'rise') this.startState('hold');
      else if (this.state === 'hold') this.startState('submerge');
      else this.startState('wait');
    }

    // Alpha + vertical emergence by state. progress 0→1 within the state.
    let alpha = 0;
    let rise = 0; // px raised above the waterline (0 = just breaking surface)
    if (this.state === 'rise') {
      const t = 1 - this.timer / this.duration;
      alpha = ALPHA_MAX * t;
      rise = RISE_OFFSET * t;
    } else if (this.state === 'hold') {
      alpha = ALPHA_MAX;
      rise = RISE_OFFSET;
    } else if (this.state === 'submerge') {
      const t = this.timer / this.duration;
      alpha = ALPHA_MAX * t;
      rise = RISE_OFFSET * t;
    }

    if (alpha <= 0.001) { img.setAlpha(0); return; }

    const zoom = cam.zoom;
    const halfW = cam.width * 0.5;
    const halfH = cam.height * 0.5;
    const s = this.spots[this.spot];
    // Project the fixed world spot to screen pixels (UI camera has no scroll/
    // zoom), lifting the frog up out of the water by `rise`, scaled by zoom.
    const sx = (s.x - view.centerX) * zoom + halfW;
    const sy = (s.y - view.centerY) * zoom + halfH;
    img.setPosition(sx, sy - rise * zoom);
    img.setDisplaySize(FROG_WIDTH * zoom, FROG_WIDTH * (FROG_TEX_H / FROG_TEX_W) * zoom);
    img.setAlpha(alpha);
  }

  destroy(): void {
    this.img?.destroy();
    this.img = null;
    this.initialised = false;
  }
}
