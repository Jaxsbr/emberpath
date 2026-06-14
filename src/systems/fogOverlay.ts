import Phaser from 'phaser';

// C12 — Fog Marsh atmosphere (2026-06-14). Playtester complaint: the marsh "reads
// as a grey stone dungeon, not fog." The root is systemic — Fog Marsh borrows the
// Tiny Dungeon tileset as a substitute, so its floor and walls are literal dungeon
// stone. A full art-direction tileset is a larger, separate slice; this gives the
// player the fog the area is named for without any new art, and a first capture
// (session 26) proved a few faint drifting puffs vanish into the already-grey
// scene. So the fog is now genuinely THICK, in two layers:
//
//   1. A screen-space VEIL (UI camera) — a vignette that closes pale mist in around
//      the edges of sight and stays clear in the centre, where Pip's ember light
//      pool sits. This is the dependable "we are deep in fog" signal, and it doubles
//      the game's core image: your warmth keeps a clear bubble while the drained
//      world fogs over beyond it. Center-clear, so it never veils the character the
//      player is reading (the camera keeps Pip near screen centre).
//   2. Drifting world-space WISPS (main camera) — a sparse pool of pale banks that
//      parallax past the scene as Pip walks, so the fog lives and moves rather than
//      reading as a static dirty lens. Mirrors AmbientMotesSystem: a fixed pool
//      mutated in place each frame (Learning EP-01 — no per-frame allocation),
//      recycled across the entering edge so on-screen density stays constant.
//
// Procedural (no assets). Opt-in per area via `fogOverlay`.

// --- drifting wisps (world space, main camera) ---
const WISP_TEX_KEY = 'fog-wisp';
const WISP_TEX_SIZE = 64;
// In front of scenery/props (3) and motes (4.2) but BEHIND the player/NPC entities
// (5) — wisps drift across the marsh in front of the stones, never over Pip.
const WISP_DEPTH = 4.6;
const WISP_COUNT = 14;
const VIEW_MARGIN = 200;        // wide band: banks are large, recycle well off-edge
const DRIFT_VX = 9;             // px/s base horizontal drift (a slow wind)
const SWAY_AMP = 4;             // px/s vertical sway amplitude
const SWAY_SPEED = 0.18;        // rad/s sway frequency (slow)
const WISP_PULSE_SPEED = 0.25;  // rad/s alpha breathe frequency
const WISP_ALPHA_MIN = 0.16;
const WISP_ALPHA_MAX = 0.34;
const WISP_W_MIN = 5 * 32;      // px (TILE_SIZE = 32) — wisps are wide
const WISP_W_MAX = 9 * 32;
const WISP_ASPECT = 0.62;       // height = width * ASPECT (low, drifting banks)

// --- screen veil (UI space, UI camera) ---
const VEIL_TEX_KEY = 'fog-veil';
const VEIL_TEX_SIZE = 256;
const VEIL_CLEAR = 0.34;        // fraction of radius kept fully clear (Pip's bubble)
const VEIL_DEPTH = -100;        // below every UI element (HUD, banner, beacon)
const VEIL_ALPHA_BASE = 0.5;    // edge mist opacity
const VEIL_ALPHA_PULSE = 0.08;  // gentle breathe around the base
const VEIL_PULSE_SPEED = 0.22;  // rad/s

interface Wisp {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  speed: number;   // 0.6..1.0 per-wisp drift multiplier
  phase: number;   // sway phase offset
  puPhase: number; // independent alpha-breathe phase
  baseAlpha: number;
}

export class FogOverlaySystem {
  private scene: Phaser.Scene;
  private wisps: Wisp[] = [];
  private veil: Phaser.GameObjects.Image | null = null;
  private uiCam: Phaser.Cameras.Scene2D.Camera | null;
  private initialised = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.uiCam = scene.cameras.getCamera('ui');
    this.ensureTextures();
    this.buildVeil();
  }

  private ensureTextures(): void {
    // Soft round wisp (cool pale core → transparent edge), stretched to a bank.
    if (!this.scene.textures.exists(WISP_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(WISP_TEX_KEY, WISP_TEX_SIZE, WISP_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = WISP_TEX_SIZE / 2;
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        g.addColorStop(0.0, 'rgba(230,236,240,1)');
        g.addColorStop(0.5, 'rgba(218,226,232,0.6)');
        g.addColorStop(1.0, 'rgba(206,216,224,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, WISP_TEX_SIZE, WISP_TEX_SIZE);
        canvas.refresh();
      }
    }
    // Vignette veil: clear bubble in the centre ramping to pale mist at the edge.
    if (!this.scene.textures.exists(VEIL_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(VEIL_TEX_KEY, VEIL_TEX_SIZE, VEIL_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = VEIL_TEX_SIZE / 2;
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        g.addColorStop(0.0, 'rgba(212,221,228,0)');
        g.addColorStop(VEIL_CLEAR, 'rgba(212,221,228,0)');
        g.addColorStop(0.72, 'rgba(212,221,228,0.72)');
        g.addColorStop(1.0, 'rgba(208,218,226,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VEIL_TEX_SIZE, VEIL_TEX_SIZE);
        canvas.refresh();
      }
    }
  }

  private buildVeil(): void {
    this.veil = this.scene.add.image(0, 0, VEIL_TEX_KEY);
    this.veil.setOrigin(0.5, 0.5);
    this.veil.setScrollFactor(0);
    this.veil.setDepth(VEIL_DEPTH);
    this.veil.setBlendMode(Phaser.BlendModes.NORMAL);
    this.veil.setAlpha(VEIL_ALPHA_BASE);
    // UI-camera element: the main camera must ignore it so it stays screen-fixed
    // (same rule the smoke beacon's glow follows, inverted — that one is UI-only too).
    this.scene.cameras.main.ignore(this.veil);
  }

  // Deterministic pseudo-random in [0,1) from an integer seed — Math.random is
  // unavailable / non-deterministic in this build (same constraint motes use).
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  // Lazily build the wisp pool on the first update, once the main camera's
  // worldView is populated. Re-runnable across a scene.restart.
  private init(view: Phaser.Geom.Rectangle): void {
    for (let i = 0; i < WISP_COUNT; i++) {
      const x = view.x - VIEW_MARGIN + this.rand(i * 2 + 1) * (view.width + VIEW_MARGIN * 2);
      const y = view.y - VIEW_MARGIN + this.rand(i * 2 + 2) * (view.height + VIEW_MARGIN * 2);
      const w = WISP_W_MIN + this.rand(i * 3 + 5) * (WISP_W_MAX - WISP_W_MIN);
      const img = this.scene.add.image(x, y, WISP_TEX_KEY);
      img.setOrigin(0.5, 0.5);
      img.setBlendMode(Phaser.BlendModes.NORMAL);
      img.setDepth(WISP_DEPTH);
      img.setDisplaySize(w, w * WISP_ASPECT);
      this.uiCam?.ignore(img); // main-camera object: UI cam must not double-render it
      this.wisps.push({
        img,
        x,
        y,
        speed: 0.6 + this.rand(i * 5 + 3) * 0.4,
        phase: this.rand(i * 7 + 4) * Math.PI * 2,
        puPhase: this.rand(i * 11 + 6) * Math.PI * 2,
        baseAlpha: WISP_ALPHA_MIN + this.rand(i * 13 + 8) * (WISP_ALPHA_MAX - WISP_ALPHA_MIN),
      });
    }
    this.initialised = true;
  }

  update(timeMs: number, deltaMs: number): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const t = timeMs * 0.001;

    // Veil: park at screen centre, sized to blanket the viewport corners, gently
    // breathing. Screen px (UI space), so it scales with the camera, not the zoom.
    if (this.veil) {
      const w = cam.width;
      const h = cam.height;
      if (w > 0 && h > 0) {
        const diag = Math.sqrt(w * w + h * h) * 1.06; // cover the corners
        this.veil.setPosition(w / 2, h / 2);
        this.veil.setDisplaySize(diag, diag);
        this.veil.setAlpha(VEIL_ALPHA_BASE + VEIL_ALPHA_PULSE * Math.sin(t * VEIL_PULSE_SPEED));
      }
    }

    const view = cam.worldView;
    if (view.width === 0 || view.height === 0) return; // not ready yet
    if (!this.initialised) {
      this.init(view);
      return;
    }
    const dt = deltaMs * 0.001;
    const left = view.x - VIEW_MARGIN;
    const right = view.x + view.width + VIEW_MARGIN;
    const top = view.y - VIEW_MARGIN;
    const bottom = view.y + view.height + VIEW_MARGIN;

    for (const wsp of this.wisps) {
      const sway = Math.sin(t * SWAY_SPEED + wsp.phase) * SWAY_AMP;
      wsp.x += DRIFT_VX * wsp.speed * dt;
      wsp.y += sway * dt;

      // Recycle across the opposite horizontal edge so wisps drift back in.
      if (wsp.x > right) { wsp.x = left; wsp.y = top + this.rand((wsp.x | 0) + 1) * (bottom - top); }
      else if (wsp.x < left) { wsp.x = right; wsp.y = top + this.rand((wsp.x | 0) + 2) * (bottom - top); }

      const pulse = 0.7 + 0.3 * Math.sin(t * WISP_PULSE_SPEED + wsp.puPhase);
      wsp.img.setPosition(wsp.x, wsp.y);
      wsp.img.setAlpha(wsp.baseAlpha * pulse);
    }
  }

  destroy(): void {
    for (const w of this.wisps) w.img.destroy();
    this.wisps = [];
    this.veil?.destroy();
    this.veil = null;
    this.initialised = false;
  }
}
