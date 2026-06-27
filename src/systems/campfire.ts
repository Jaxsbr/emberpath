import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';

// Driftwood's campfire (US-156 / #1302). The opening goal is "find the one by the
// smoke"; the smoke beacon rises a plume the player walks toward, and when they
// arrive THIS is its source — a real little fire on the shore with Driftwood
// beside it. It grounds the allegory Jaco set (#1302): the fire is the light
// Driftwood made with his own hands (his works / the world); the Ember Pip carries
// is the warmer, truer one. Driftwood is proud of his fire but wishes it were
// more, and when offered the Ember he can see it is better yet can't let his own
// fire go. So the fire is a PERSISTENT prop (never cleared — it's his, he keeps
// it), unlike the smoke plume which clears once "find the smoke" is met.
//
// Rendered on the UI camera (projected from a fixed world tile every frame),
// exactly like the smoke beacon's glow — the main camera's desaturation pass
// crushes warm light to grey, and a fire that reads grey defeats the point. The
// projection math mirrors SmokeBeaconSystem so the fire stays pinned to its tile
// as the player moves. Fully procedural (no asset): a warm ground glow, a dark
// log base, three flickering flame layers, and a few rising sparks — deterministic
// per-index variation (Math.random is unavailable), no per-frame allocation.

const GLOW_TEX_KEY = 'campfire-glow';
const GLOW_TEX_SIZE = 64;
const FLAME_TEX_KEY = 'campfire-flame';
const FLAME_TEX_SIZE = 48;
const LOGS_TEX_KEY = 'campfire-logs';
const LOGS_TEX_W = 44;
const LOGS_TEX_H = 26;
const SPARK_TEX_KEY = 'campfire-spark';
const SPARK_TEX_SIZE = 8;

// Depths on the UI camera — below the smoke plume (SMOKE_DEPTH 80) so the smoke
// rises above the flames, and below dialogue/objective text so guidance wins.
const GLOW_DEPTH = 70;
const LOGS_DEPTH = 71;
const FLAME_DEPTH = 72;
const SPARK_DEPTH = 73;

const GLOW_SIZE = 2.0 * TILE_SIZE;      // world px
const GLOW_ALPHA = 0.62;
const FLICKER_SPEED = 7.5;              // rad/s base flame flicker

const LOGS_W = 1.15 * TILE_SIZE;        // world px
const LOGS_H = LOGS_W * (LOGS_TEX_H / LOGS_TEX_W);

const SPARK_COUNT = 6;
const SPARK_RISE = 1.4 * TILE_SIZE;     // world px a spark climbs before recycling
const SPARK_SPEED = 26;                 // world px/s

// Three stacked flame layers: outer envelope -> inner core. Width/height in world
// px (at the base), tint, base alpha, and a flicker phase offset so they don't
// pulse in lockstep (a real flame's layers shimmer independently). Deliberately
// LOW and BROAD (wider than tall at the outer layer) so the silhouette reads as a
// campfire lapping over its logs, not a tall candle/torch jet (ART gate, #1302).
const FLAMES = [
  { w: 1.28 * TILE_SIZE, h: 0.98 * TILE_SIZE, tint: 0xff6a2a, alpha: 0.5, phase: 0.0 },
  { w: 0.92 * TILE_SIZE, h: 0.72 * TILE_SIZE, tint: 0xffa23c, alpha: 0.72, phase: 1.7 },
  { w: 0.56 * TILE_SIZE, h: 0.5 * TILE_SIZE, tint: 0xffe39a, alpha: 0.95, phase: 3.4 },
];

interface Spark {
  img: Phaser.GameObjects.Image;
  prog: number;   // 0 (base) .. 1 (top)
  speed: number;  // per-spark rise multiplier
  xoff: number;   // base horizontal jitter (world px)
  phase: number;  // sway phase
}

export class CampfireSystem {
  private scene: Phaser.Scene;
  private baseX = 0;
  private baseY = 0;
  private active = false;
  private glow: Phaser.GameObjects.Image | null = null;
  private logs: Phaser.GameObjects.Image | null = null;
  private flames: Phaser.GameObjects.Image[] = [];
  private sparks: Spark[] = [];

  constructor(scene: Phaser.Scene, campfire: { col: number; row: number } | undefined) {
    this.scene = scene;
    if (!campfire) return;
    this.active = true;
    this.baseX = campfire.col * TILE_SIZE + TILE_SIZE / 2;
    this.baseY = campfire.row * TILE_SIZE + TILE_SIZE / 2;
    this.ensureTextures();
    this.build();
  }

  // Deterministic pseudo-random in [0,1) from an integer seed (same trick the
  // motes / smoke beacon use — Math.random isn't deterministic/available here).
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  private ensureTextures(): void {
    if (!this.scene.textures.exists(GLOW_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(GLOW_TEX_KEY, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = GLOW_TEX_SIZE / 2;
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        g.addColorStop(0.0, 'rgba(255,198,122,1)');
        g.addColorStop(0.5, 'rgba(255,150,70,0.5)');
        g.addColorStop(1.0, 'rgba(220,110,50,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
        canvas.refresh();
      }
    }
    // White flame silhouette (teardrop: pointed top, rounded base) — tinted per
    // layer, ADD-blended, so the tint controls colour.
    if (!this.scene.textures.exists(FLAME_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(FLAME_TEX_KEY, FLAME_TEX_SIZE, FLAME_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const cx = FLAME_TEX_SIZE / 2;
        const top = 3;
        const bottom = FLAME_TEX_SIZE - 2;
        // Widest point sits LOW (near the base) and the silhouette is broad — a
        // flame-tongue lapping up off the fuel, not a narrow symmetric teardrop.
        const mid = FLAME_TEX_SIZE * 0.74;
        const halfW = FLAME_TEX_SIZE * 0.46;
        const g = ctx.createLinearGradient(0, top, 0, bottom);
        g.addColorStop(0.0, 'rgba(255,255,255,1)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.92)');
        // Base stays bright (not faded) so the flame visibly roots into the logs.
        g.addColorStop(1.0, 'rgba(255,255,255,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.quadraticCurveTo(cx + halfW, mid, cx, bottom);
        ctx.quadraticCurveTo(cx - halfW, mid, cx, top);
        ctx.fill();
        canvas.refresh();
      }
    }
    // Two dark crossed logs with a warm ember gap — solid (not ADD), drawn on the
    // un-desaturated UI camera so the brown holds.
    if (!this.scene.textures.exists(LOGS_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(LOGS_TEX_KEY, LOGS_TEX_W, LOGS_TEX_H);
      if (canvas) {
        const ctx = canvas.getContext();
        const cy = LOGS_TEX_H * 0.62;
        // Glowing ember bed under/between the logs — the bright bridge from fuel to
        // flame (ART gate, #1302): an outer warm pool plus a hot inner core so the
        // flame visibly springs from live coals, not floaty air.
        ctx.fillStyle = 'rgba(255,140,60,0.8)';
        ctx.beginPath();
        ctx.ellipse(LOGS_TEX_W / 2, cy, LOGS_TEX_W * 0.4, LOGS_TEX_H * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,210,140,0.95)';
        ctx.beginPath();
        ctx.ellipse(LOGS_TEX_W / 2, cy, LOGS_TEX_W * 0.2, LOGS_TEX_H * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        const drawLog = (x1: number, y1: number, x2: number, y2: number) => {
          ctx.strokeStyle = '#3a2616';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.strokeStyle = '#52331d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        };
        drawLog(LOGS_TEX_W * 0.16, cy + 4, LOGS_TEX_W * 0.84, cy - 2);
        drawLog(LOGS_TEX_W * 0.2, cy - 3, LOGS_TEX_W * 0.8, cy + 5);
        canvas.refresh();
      }
    }
    if (!this.scene.textures.exists(SPARK_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(SPARK_TEX_KEY, SPARK_TEX_SIZE, SPARK_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = SPARK_TEX_SIZE / 2;
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        g.addColorStop(0.0, 'rgba(255,224,150,1)');
        g.addColorStop(1.0, 'rgba(255,170,80,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SPARK_TEX_SIZE, SPARK_TEX_SIZE);
        canvas.refresh();
      }
    }
  }

  private build(): void {
    const ui = (img: Phaser.GameObjects.Image, depth: number) => {
      img.setOrigin(0.5, 0.5);
      img.setDepth(depth);
      // UI-camera object: the main camera must NOT draw it (it would render a
      // desaturated grey copy underneath) — same rule the smoke beacon glow follows.
      this.scene.cameras.main.ignore(img);
    };

    this.glow = this.scene.add.image(this.baseX, this.baseY, GLOW_TEX_KEY);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    ui(this.glow, GLOW_DEPTH);

    this.logs = this.scene.add.image(this.baseX, this.baseY, LOGS_TEX_KEY);
    ui(this.logs, LOGS_DEPTH);

    for (const f of FLAMES) {
      const img = this.scene.add.image(this.baseX, this.baseY, FLAME_TEX_KEY);
      img.setBlendMode(Phaser.BlendModes.ADD);
      img.setTint(f.tint);
      // Origin at the flame's base so it grows upward from the logs, not centred.
      img.setOrigin(0.5, 1);
      img.setDepth(FLAME_DEPTH);
      this.scene.cameras.main.ignore(img);
      this.flames.push(img);
    }

    for (let i = 0; i < SPARK_COUNT; i++) {
      const img = this.scene.add.image(this.baseX, this.baseY, SPARK_TEX_KEY);
      img.setBlendMode(Phaser.BlendModes.ADD);
      ui(img, SPARK_DEPTH);
      this.sparks.push({
        img,
        prog: i / SPARK_COUNT,
        speed: 0.7 + this.rand(i * 5 + 2) * 0.4,
        xoff: (this.rand(i * 3 + 1) - 0.5) * (TILE_SIZE * 0.4),
        phase: this.rand(i * 7 + 4) * Math.PI * 2,
      });
    }
  }

  update(timeMs: number, deltaMs: number): void {
    if (!this.active) return;
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const zoom = cam.zoom;
    const halfW = cam.width * 0.5;
    const halfH = cam.height * 0.5;
    const baseSX = (this.baseX - cam.worldView.centerX) * zoom + halfW;
    const baseSY = (this.baseY - cam.worldView.centerY) * zoom + halfH;
    // Off-screen: park everything invisible (no edge-homing — the smoke beacon
    // already carries the off-screen wayfinding; the fire is just the up-close source).
    const offscreen =
      baseSX < -GLOW_SIZE * zoom ||
      baseSX > cam.width + GLOW_SIZE * zoom ||
      baseSY < -GLOW_SIZE * zoom ||
      baseSY > cam.height + GLOW_SIZE * zoom;

    const t = timeMs * 0.001;
    const dt = deltaMs * 0.001;

    if (this.glow) {
      const flick = 0.8 + 0.2 * Math.sin(t * FLICKER_SPEED) * Math.sin(t * 2.3 + 1.1);
      this.glow.setPosition(baseSX, baseSY);
      this.glow.setDisplaySize(GLOW_SIZE * zoom, GLOW_SIZE * zoom);
      this.glow.setAlpha(offscreen ? 0 : GLOW_ALPHA * flick);
    }

    if (this.logs) {
      // Logs sit a touch below the tile centre so the flames rise from their top.
      this.logs.setPosition(baseSX, baseSY + LOGS_H * 0.25 * zoom);
      this.logs.setDisplaySize(LOGS_W * zoom, LOGS_H * zoom);
      this.logs.setAlpha(offscreen ? 0 : 1);
    }

    for (let i = 0; i < this.flames.length; i++) {
      const f = FLAMES[i];
      const img = this.flames[i];
      // Per-layer flicker: height breathes, a little horizontal sway, alpha shimmer.
      const fl = Math.sin(t * FLICKER_SPEED + f.phase);
      const fl2 = Math.sin(t * (FLICKER_SPEED * 0.6) + f.phase * 1.7);
      const hScale = 1 + 0.16 * fl + 0.06 * fl2;
      const wScale = 1 + 0.08 * fl2;
      const sway = 0.07 * TILE_SIZE * fl2;
      // Flame base anchored ONTO the ember bed (origin is the flame's bottom) so it
      // roots into the logs instead of floating above them (ART gate, #1302).
      img.setPosition(baseSX + sway * zoom, baseSY + LOGS_H * 0.34 * zoom);
      img.setDisplaySize(f.w * wScale * zoom, f.h * hScale * zoom);
      img.setAlpha(offscreen ? 0 : f.alpha * (0.82 + 0.18 * fl));
    }

    const step = (SPARK_SPEED / SPARK_RISE) * dt;
    for (const s of this.sparks) {
      s.prog += step * s.speed;
      if (s.prog >= 1) {
        s.prog -= 1;
        s.xoff = (this.rand((t * 1000) | (s.phase * 91)) - 0.5) * (TILE_SIZE * 0.4);
      }
      const prog = s.prog;
      const sway = Math.sin(t * 1.6 + s.phase) * (0.18 * TILE_SIZE) * prog;
      const sx = baseSX + (s.xoff + sway) * zoom;
      const sy = baseSY - prog * SPARK_RISE * zoom;
      const alpha = (1 - prog) * Math.min(1, prog * 5);
      const size = (SPARK_TEX_SIZE * (0.5 + 0.5 * (1 - prog))) * zoom;
      s.img.setPosition(sx, sy);
      s.img.setDisplaySize(size, size);
      s.img.setAlpha(offscreen ? 0 : alpha * 0.9);
    }
  }

  destroy(): void {
    this.glow?.destroy();
    this.glow = null;
    this.logs?.destroy();
    this.logs = null;
    for (const img of this.flames) img.destroy();
    this.flames = [];
    for (const s of this.sparks) s.img.destroy();
    this.sparks = [];
    this.active = false;
  }
}
