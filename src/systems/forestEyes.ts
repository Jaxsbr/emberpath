import Phaser from 'phaser';

// Forest eyes (FB-2, 2026-06-16). Jaco wants Briar Wilds to FEEL eerie — "random
// red eyes in the forest that come and go". This drifts a small pool of red eye-
// pairs that fade in at the dark edges of the view (never on the player), hold and
// blink for a moment, then fade out and move somewhere else — so the wilds read as
// watched, not empty.
//
// Like the NPC presence aura (C4-a), the eyes render on the UI camera, NOT the main
// camera: the main camera's desaturation pipeline would grey the red away, and red
// eyes that turned grey would lose the whole point. So each eye-pair holds a fixed
// WORLD position while it is open (it sits out there in the forest as the player
// moves past it) and the update loop projects that world point to screen pixels each
// frame, scaling by the main-camera zoom — exactly the C4-a presence-aura trick.
//
// Cost: a fixed pool of pairs, each a single pre-baked two-dot texture mutated in
// place (Learning EP-01 — no per-frame allocation). Math.random is unavailable /
// non-deterministic in this build, so variation comes from a sin-hash seeded by a
// per-eye counter bumped on each relocate (same approach as the ambient motes).

const EYES_TEX_KEY = 'forest-eyes';
const EYES_TEX_W = 48;
const EYES_TEX_H = 24;
// Above props / scenery but below thought bubbles (depth 8). They live on the UI
// camera so depth only orders them against other UI-camera objects.
const EYES_DEPTH = 6;

const PAIR_COUNT = 4;            // how many eye-pairs can exist at once (kept sparse)
const EYE_WIDTH = 30;           // on-screen width of a pair at zoom 1 (px)
const VIEW_MARGIN = 40;         // keep pairs this far inside the view edges

// State timings (ms). Ranges are sampled per cycle so the pairs never sync up.
const WAIT_MIN = 2200, WAIT_MAX = 6500;   // hidden between appearances
const FADE_IN = 650;
const OPEN_MIN = 1400, OPEN_MAX = 3600;   // how long they stare
const FADE_OUT = 550;
const BLINK_GAP_MIN = 1100, BLINK_GAP_MAX = 2900;
const BLINK_DUR = 130;          // a blink closes the eyes briefly
const ALPHA_MAX = 0.82;

// Placement: pairs sit in an annulus around the screen centre (≈ the player) so they
// never land on Pip and always read as "out there in the dark around you".
const RING_MIN = 0.30;          // fraction of half-min-view: inner edge of the ring
const RING_MAX = 0.52;          // outer edge of the ring

type EyeState = 'wait' | 'in' | 'open' | 'out';

interface EyePair {
  img: Phaser.GameObjects.Image;
  state: EyeState;
  timer: number;       // ms remaining in the current state
  duration: number;    // ms total of the current state (for fade lerp)
  x: number;           // fixed world position while open
  y: number;
  blinkTimer: number;  // ms until the next blink
  blinking: number;    // ms remaining in the current blink (0 = eyes open)
  seed: number;        // bumped each relocate to vary the sin-hash
}

export class ForestEyesSystem {
  private scene: Phaser.Scene;
  private uiCam: Phaser.Cameras.Scene2D.Camera | null;
  private pairs: EyePair[] = [];
  private initialised = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.uiCam = scene.cameras.getCamera('ui');
    this.ensureTexture();
  }

  // Pre-bake two red glows side by side — a soft menacing pair, brightest at the
  // core so they read as eyes, not lamps.
  private ensureTexture(): void {
    if (this.scene.textures.exists(EYES_TEX_KEY)) return;
    const canvas = this.scene.textures.createCanvas(EYES_TEX_KEY, EYES_TEX_W, EYES_TEX_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const cy = EYES_TEX_H / 2;
    const r = EYES_TEX_H / 2;
    for (const cx of [EYES_TEX_W * 0.30, EYES_TEX_W * 0.70]) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0.0, 'rgba(255,70,50,1)');     // hot red core
      g.addColorStop(0.45, 'rgba(210,30,25,0.65)'); // deep red falloff
      g.addColorStop(1.0, 'rgba(150,15,15,0)');     // transparent edge
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, EYES_TEX_W, EYES_TEX_H);
    }
    canvas.refresh();
  }

  // Deterministic pseudo-random in [0,1) from an integer seed (Math.random is
  // unavailable / non-deterministic here — same hash the ambient motes use).
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  private build(): void {
    for (let i = 0; i < PAIR_COUNT; i++) {
      const img = this.scene.add.image(0, 0, EYES_TEX_KEY);
      img.setOrigin(0.5, 0.5);
      img.setBlendMode(Phaser.BlendModes.ADD);
      img.setDepth(EYES_DEPTH);
      img.setAlpha(0);
      // UI-camera object: the main camera must NOT draw it (it would render a
      // greyed-out copy through the desaturation pass). It is absent from the UI
      // ignore list, so the UI camera renders it.
      this.scene.cameras.main.ignore(img);
      this.pairs.push({
        img,
        state: 'wait',
        // Stagger the first appearance so they don't all open together.
        timer: 400 + this.rand(i * 3 + 1) * (WAIT_MAX - 400),
        duration: 1,
        x: 0,
        y: 0,
        blinkTimer: BLINK_GAP_MIN + this.rand(i * 5 + 2) * (BLINK_GAP_MAX - BLINK_GAP_MIN),
        blinking: 0,
        seed: i * 100 + 7,
      });
    }
    this.initialised = true;
  }

  // Choose a fresh fixed world position for a pair: in a ring around the screen
  // centre (≈ the player), clamped inside the view so it stays on-screen.
  private relocate(p: EyePair, view: Phaser.Geom.Rectangle): void {
    p.seed += 31;
    const angle = this.rand(p.seed) * Math.PI * 2;
    const halfMin = Math.min(view.width, view.height) * 0.5;
    const ring = (RING_MIN + this.rand(p.seed + 1) * (RING_MAX - RING_MIN)) * halfMin;
    let x = view.centerX + Math.cos(angle) * ring;
    let y = view.centerY + Math.sin(angle) * ring;
    x = Math.max(view.x + VIEW_MARGIN, Math.min(view.x + view.width - VIEW_MARGIN, x));
    y = Math.max(view.y + VIEW_MARGIN, Math.min(view.y + view.height - VIEW_MARGIN, y));
    p.x = x;
    p.y = y;
  }

  private startState(p: EyePair, state: EyeState): void {
    p.state = state;
    if (state === 'wait') p.duration = WAIT_MIN + this.rand(p.seed + 3) * (WAIT_MAX - WAIT_MIN);
    else if (state === 'in') p.duration = FADE_IN;
    else if (state === 'open') p.duration = OPEN_MIN + this.rand(p.seed + 4) * (OPEN_MAX - OPEN_MIN);
    else p.duration = FADE_OUT;
    p.timer = p.duration;
  }

  update(timeMs: number, deltaMs: number): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const view = cam.worldView;
    if (view.width === 0 || view.height === 0) return; // not ready yet
    if (!this.initialised) { this.build(); return; }

    const zoom = cam.zoom;
    const viewCx = view.centerX;
    const viewCy = view.centerY;
    const halfW = cam.width * 0.5;
    const halfH = cam.height * 0.5;

    for (const p of this.pairs) {
      p.timer -= deltaMs;
      if (p.timer <= 0) {
        if (p.state === 'wait') { this.relocate(p, view); this.startState(p, 'in'); }
        else if (p.state === 'in') this.startState(p, 'open');
        else if (p.state === 'open') this.startState(p, 'out');
        else this.startState(p, 'wait');
      }

      // Base alpha by state (fade in/out lerp; full while open; zero while waiting).
      let baseAlpha = 0;
      if (p.state === 'in') baseAlpha = ALPHA_MAX * (1 - p.timer / p.duration);
      else if (p.state === 'open') baseAlpha = ALPHA_MAX;
      else if (p.state === 'out') baseAlpha = ALPHA_MAX * (p.timer / p.duration);

      // Blink only while open: a brief close, then schedule the next one.
      if (p.state === 'open') {
        if (p.blinking > 0) {
          p.blinking -= deltaMs;
        } else {
          p.blinkTimer -= deltaMs;
          if (p.blinkTimer <= 0) {
            p.blinking = BLINK_DUR;
            p.blinkTimer = BLINK_GAP_MIN + this.rand(p.seed + (timeMs | 0)) * (BLINK_GAP_MAX - BLINK_GAP_MIN);
          }
        }
      } else {
        p.blinking = 0;
      }
      if (p.blinking > 0) baseAlpha *= 0.05; // eyes shut

      if (baseAlpha <= 0.001) {
        p.img.setAlpha(0);
        continue;
      }

      // Project the fixed world position to screen pixels (UI camera has no scroll/
      // zoom), scaling the pair by the main-camera zoom so it sits in the world.
      p.img.setPosition((p.x - viewCx) * zoom + halfW, (p.y - viewCy) * zoom + halfH);
      p.img.setDisplaySize(EYE_WIDTH * zoom, EYE_WIDTH * 0.5 * zoom);
      p.img.setAlpha(baseAlpha);
    }
  }

  destroy(): void {
    for (const p of this.pairs) p.img.destroy();
    this.pairs = [];
    this.initialised = false;
  }
}
