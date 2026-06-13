import Phaser from 'phaser';

// C4-d — world-life ambience (2026-06-14). Playtester complaint #2 was "clearly
// not a game, lacks so much": areas rendered as static dioramas — nothing in the
// air, nothing moving but the player. This drifts a sparse field of soft motes
// (dust / pollen / floating specks) slowly through the scene so every area reads
// as a living place, not a frozen picture.
//
// Deliberately tuned to the drained-world vision rather than fighting it. The
// motes are warm-tinted and ADD-blended, and they render on the MAIN camera — so
// the desaturation pipeline greys them along with the world: in the cold/drained
// world they read as faint pale specks adrift (luminance survives desaturation,
// like the water shimmer), and the moment they pass through Pip's ember light (or
// any lit pool, where the mask lifts the grey-out) they warm to a soft gold. No
// shader work: the existing grey-out does the "your warmth brings the world back
// to life" storytelling for free. The hope-gold narrative colour is left alone —
// these are atmosphere, not a scripted beat.
//
// Cost: a fixed pool of motes, mutated in place each frame (Learning EP-01 — no
// per-frame allocation). The pool lives in the camera's view and recycles across
// the entering edge as it drifts, so a small count keeps a constant on-screen
// density regardless of how large the area is.

const MOTE_TEX_KEY = 'ambient-mote';
const MOTE_TEX_SIZE = 16;
// Behind the player/NPC entities (depth 5) so characters always read on top, but
// above props (3) — the motes drift in the air in front of the scenery.
const MOTE_DEPTH = 4.2;

const MOTE_COUNT = 22;          // fixed on-screen density (pool size)
const VIEW_MARGIN = 48;         // spawn/recycle band just outside the camera view
const DRIFT_VX = 5;             // px/s base horizontal drift
const DRIFT_VY = -7;            // px/s base vertical drift (gentle, upward)
const SWAY_AMP = 6;             // px/s perpendicular sway amplitude
const SWAY_SPEED = 0.5;         // rad/s sway frequency
const TWINKLE_SPEED = 0.7;      // rad/s alpha twinkle frequency
const ALPHA_MIN = 0.16;
const ALPHA_MAX = 0.44;
const SIZE_MIN = 3;
const SIZE_MAX = 7;

interface Mote {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  speed: number;   // 0.6..1.0 per-mote drift multiplier
  phase: number;   // sway/twinkle phase offset (0..2π)
  twPhase: number; // independent twinkle phase
  baseAlpha: number;
}

export class AmbientMotesSystem {
  private scene: Phaser.Scene;
  private motes: Mote[] = [];
  private uiCam: Phaser.Cameras.Scene2D.Camera | null;
  private initialised = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.uiCam = scene.cameras.getCamera('ui');
    this.ensureTexture();
  }

  // Pre-bake one soft round speck (warm-white core → transparent edge). Warm so a
  // mote in a lit pool reads gold; the desaturation pass collapses it to a pale
  // grey speck out in the cold.
  private ensureTexture(): void {
    if (this.scene.textures.exists(MOTE_TEX_KEY)) return;
    const canvas = this.scene.textures.createCanvas(MOTE_TEX_KEY, MOTE_TEX_SIZE, MOTE_TEX_SIZE);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const c = MOTE_TEX_SIZE / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.0, 'rgba(255,247,224,1)');   // warm-white core
    g.addColorStop(0.5, 'rgba(255,226,170,0.55)'); // soft gold falloff
    g.addColorStop(1.0, 'rgba(255,210,140,0)');    // transparent edge
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, MOTE_TEX_SIZE, MOTE_TEX_SIZE);
    canvas.refresh();
  }

  // Deterministic pseudo-random in [0,1) from an integer seed — Math.random is
  // unavailable / non-deterministic in this build (same constraint the NPC aura
  // phases use), so motes are varied by index instead.
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  // Lazily build the pool on the first update, once the main camera's worldView
  // is populated (it is centred on the player by then). Re-runnable: a
  // scene.restart drops the old images and this rebuilds against the new view.
  private init(view: Phaser.Geom.Rectangle): void {
    for (let i = 0; i < MOTE_COUNT; i++) {
      const x = view.x - VIEW_MARGIN + this.rand(i * 2 + 1) * (view.width + VIEW_MARGIN * 2);
      const y = view.y - VIEW_MARGIN + this.rand(i * 2 + 2) * (view.height + VIEW_MARGIN * 2);
      const img = this.scene.add.image(x, y, MOTE_TEX_KEY);
      img.setOrigin(0.5, 0.5);
      img.setBlendMode(Phaser.BlendModes.ADD);
      img.setDepth(MOTE_DEPTH);
      const size = SIZE_MIN + this.rand(i * 3 + 5) * (SIZE_MAX - SIZE_MIN);
      img.setDisplaySize(size, size);
      // Main-camera world object: the UI camera must ignore it or it would
      // double-render (no scroll/zoom) a ghost at the wrong screen spot — same
      // rule the ember overlay follows.
      this.uiCam?.ignore(img);
      this.motes.push({
        img,
        x,
        y,
        speed: 0.6 + this.rand(i * 5 + 3) * 0.4,
        phase: this.rand(i * 7 + 4) * Math.PI * 2,
        twPhase: this.rand(i * 11 + 6) * Math.PI * 2,
        baseAlpha: ALPHA_MIN + this.rand(i * 13 + 8) * (ALPHA_MAX - ALPHA_MIN),
      });
    }
    this.initialised = true;
  }

  // Drift + twinkle every frame. Recycles a mote across the entering edge when it
  // leaves the view band so the on-screen density stays constant as the camera
  // scrolls. No allocation in the loop.
  update(timeMs: number, deltaMs: number): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const view = cam.worldView;
    if (view.width === 0 || view.height === 0) return; // not ready yet
    if (!this.initialised) {
      this.init(view);
      return;
    }
    const t = timeMs * 0.001;
    const dt = deltaMs * 0.001;
    const left = view.x - VIEW_MARGIN;
    const right = view.x + view.width + VIEW_MARGIN;
    const top = view.y - VIEW_MARGIN;
    const bottom = view.y + view.height + VIEW_MARGIN;

    for (const m of this.motes) {
      const sway = Math.sin(t * SWAY_SPEED + m.phase) * SWAY_AMP;
      m.x += (DRIFT_VX * m.speed + sway) * dt;
      m.y += DRIFT_VY * m.speed * dt;

      // Recycle across the opposite edge so it drifts back into view.
      if (m.y < top) { m.y = bottom; m.x = left + this.rand((m.x | 0) + 1) * (right - left); }
      else if (m.y > bottom) { m.y = top; m.x = left + this.rand((m.x | 0) + 2) * (right - left); }
      if (m.x < left) m.x = right;
      else if (m.x > right) m.x = left;

      const tw = 0.5 + 0.5 * Math.sin(t * TWINKLE_SPEED + m.twPhase);
      m.img.setPosition(m.x, m.y);
      m.img.setAlpha(m.baseAlpha * (0.5 + 0.5 * tw));
    }
  }

  destroy(): void {
    for (const m of this.motes) m.img.destroy();
    this.motes = [];
    this.initialised = false;
  }
}
