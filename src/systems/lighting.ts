import Phaser from 'phaser';
import { LIGHTING_CONFIG } from './lightingConfig';
import { WARMTH_FLOOR, WARMTH_MAX } from './emberWarmth';

// Lerp between two values by current warmth (US-101). Warmth is clamped at
// the system level; this helper assumes input is in [WARMTH_FLOOR, WARMTH_MAX]
// but defends with a Math.min/max so a stale or out-of-range value can't
// produce a degenerate radius.
function lerpByWarmth(warmth: number, atFloor: number, atFull: number): number {
  const w = Math.max(WARMTH_FLOOR, Math.min(WARMTH_MAX, warmth));
  const t = (w - WARMTH_FLOOR) / (WARMTH_MAX - WARMTH_FLOOR);
  return atFloor + (atFull - atFloor) * t;
}

// Depth 6 — between Player ember overlay (5.5) and Thoughts (8). The Thoughts
// layer must render above the fog so escape monologue (US-79) and ambient
// thoughts remain readable through it.
const OVERLAY_DEPTH = 6;
const OVERLAY_COLOR = 0x000000;
const BRUSH_TEXTURE_KEY = '__lighting_brush';
const BRUSH_SIZE = 256;

export interface RegisteredLight {
  id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  tier: 1 | 2;
}

// LightingSystem renders a soft-falloff darkness overlay above world entities
// (depth 6, below Thoughts at 8 and UI at 100+). The player is the primary
// light; POI/NPC/tier-2 lights register via registerLight (US-75).
//
// Per-frame cost in update(): one rt.fill + one rt.erase per active light.
// Zero JS allocations (Learning EP-01) — the brush GameObject is reused
// frame-to-frame; only its position/scale/alpha mutate. Iteration uses
// indexed for-loops (not for...of) to avoid iterator allocation.
//
// Restart hygiene (Learning EP-02): all GameObject refs reset at the top of
// create() before any read; destroy() is idempotent. The brush canvas texture
// survives scene.restart (lives on the global texture manager) so the
// `textures.exists(BRUSH_TEXTURE_KEY)` guard skips re-baking on re-entry.
export class LightingSystem {
  private scene: Phaser.Scene;
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private brush: Phaser.GameObjects.Image | null = null;
  private lights: RegisteredLight[] = [];
  private hasEmber = false;
  private toggleKey: Phaser.Input.Keyboard.Key | null = null;
  private worldWidth = 0;
  private worldHeight = 0;
  // Last player position seen by update() — needed so isLitAt() can answer
  // "is this world point inside the player's light?" without GameScene
  // having to pass it on every query.
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  // US-101 — current ember warmth in [WARMTH_FLOOR, WARMTH_MAX]. Defaults to
  // 1.0 (full) so areas without an EmberWarmthSystem (or pre-load) read at
  // baseline post-Ember radius. GameScene calls setPlayerWarmth(w) each frame.
  private playerWarmth = 1.0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(worldWidth: number, worldHeight: number): void {
    // Reset refs first (Learning EP-02) — instance fields persist across
    // scene.restart so destroyed Phaser objects would otherwise be re-read.
    this.rt = null;
    this.brush = null;
    this.lights = [];
    this.hasEmber = false;
    this.playerWarmth = 1.0;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Pre-bake the radial gradient brush once. White-alpha gradient: alpha 1
    // at centre → alpha 0 at edge. Used with rt.erase: bright pixels subtract
    // more from the dark overlay, faded pixels subtract less, producing the
    // soft-falloff hole.
    if (!this.scene.textures.exists(BRUSH_TEXTURE_KEY)) {
      const canvas = this.scene.textures.createCanvas(BRUSH_TEXTURE_KEY, BRUSH_SIZE, BRUSH_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const cx = BRUSH_SIZE / 2;
        const cy = BRUSH_SIZE / 2;
        const r = BRUSH_SIZE / 2;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, BRUSH_SIZE, BRUSH_SIZE);
        canvas.refresh();
      }
    }

    this.rt = this.scene.add.renderTexture(0, 0, worldWidth, worldHeight);
    this.rt.setOrigin(0, 0);
    this.rt.setDepth(OVERLAY_DEPTH);
    // UI camera should not double-render the world-space overlay.
    this.scene.cameras.getCamera('ui')?.ignore(this.rt);

    // Brush GameObject for rt.erase. Constructed via the GameObjects.Image
    // constructor directly (NOT scene.add or scene.make) so it is guaranteed
    // not to be added to any scene display/update list. rt.erase calls
    // renderWebGL on the object explicitly, which works regardless of
    // display-list membership. Bypassing the factory also dodges any
    // Phaser-version-specific quirk where the `add: false` config field
    // might silently be ignored.
    this.brush = new Phaser.GameObjects.Image(this.scene, 0, 0, BRUSH_TEXTURE_KEY);
    this.brush.setOrigin(0.5, 0.5);

    // F4 toggles LIGHTING_CONFIG.enabled at runtime for A/B comparison with the
    // keeper-rescue baseline (Rule 4a variant baseline). Production builds keep
    // the binding active — there's no harm and authors can debug deployed sites.
    if (this.scene.input.keyboard) {
      this.toggleKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
    }
  }

  update(playerX: number, playerY: number, hasEmber: boolean): void {
    if (this.toggleKey && Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
      LIGHTING_CONFIG.enabled = !LIGHTING_CONFIG.enabled;
    }
    if (!this.rt || !this.brush) return;
    if (!LIGHTING_CONFIG.enabled) {
      if (this.rt.visible) this.rt.setVisible(false);
      return;
    }
    if (!this.rt.visible) this.rt.setVisible(true);
    this.hasEmber = hasEmber;
    this.lastPlayerX = playerX;
    this.lastPlayerY = playerY;

    // Fill solid dark, then erase circular holes per light.
    this.rt.clear();
    this.rt.fill(OVERLAY_COLOR, 1);

    // Player light — primary. Pre-Ember uses fixed pre values. Post-Ember
    // lerps the radius between the warmth floor and full pair (US-101). Floor
    // value committed >0 so the world is never pitch black even at WARMTH_FLOOR.
    const pRadius = hasEmber
      ? lerpByWarmth(this.playerWarmth, LIGHTING_CONFIG.playerLightRadiusFloor, LIGHTING_CONFIG.playerLightRadiusFull)
      : LIGHTING_CONFIG.playerRadiusPre;
    const pFalloff = hasEmber ? LIGHTING_CONFIG.playerFalloffPost : LIGHTING_CONFIG.playerFalloffPre;
    this.eraseLight(playerX, playerY, pRadius + pFalloff, 1.0);

    // Registered lights — POI, NPC, tier-2. Indexed loop avoids iterator
    // allocation (Learning EP-01).
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const intensity = light.tier === 2 && !hasEmber ? 0 : light.intensity;
      if (intensity <= 0) continue;
      this.eraseLight(light.x, light.y, light.radius, intensity);
    }

    // Defensive: park the brush far off-screen at end of frame. The brush is
    // not added to the scene display list, but in case any future code path
    // (or Phaser internal) traverses the texture's GameObject, this keeps it
    // out of any visible viewport.
    this.brush.setPosition(-99999, -99999);
  }

  // Stamp the pre-baked radial brush into the RT with ERASE blend so the dark
  // overlay is subtracted by the brush's alpha. Brush GameObject is reused —
  // only setPosition/setScale/setAlpha mutate per call (zero JS allocation).
  private eraseLight(x: number, y: number, radius: number, alpha: number): void {
    if (!this.rt || !this.brush) return;
    const scale = (radius * 2) / BRUSH_SIZE;
    this.brush.setPosition(x, y);
    this.brush.setScale(scale);
    this.brush.setAlpha(alpha);
    this.rt.erase(this.brush);
  }

  registerLight(light: RegisteredLight): void {
    // Idempotent (Learning #63): replace any existing entry with the same id
    // rather than duplicating. Called outside per-frame paths (NPC spawn,
    // trigger declaration) so findIndex's closure cost is acceptable.
    const idx = this.lights.findIndex((l) => l.id === light.id);
    if (idx >= 0) this.lights[idx] = light;
    else this.lights.push(light);
  }

  unregisterLight(id: string): void {
    const idx = this.lights.findIndex((l) => l.id === id);
    if (idx >= 0) this.lights.splice(idx, 1);
  }

  // In-place position sync for NPC lights — called per-frame from GameScene
  // so wandering NPCs carry their light. Indexed loop + Map.get = zero JS
  // allocation in this path (Learning EP-01). No-op for ids not in the
  // positions map (e.g. trigger or decoration lights are static).
  syncPositions(positions: Map<string, { x: number; y: number }>): void {
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const pos = positions.get(light.id);
      if (pos) {
        light.x = pos.x;
        light.y = pos.y;
      }
    }
  }

  // Brief visual pulse at the given world coordinates — used by US-79 to
  // make blocked escape attempts felt as a fog "shove" rather than silent
  // collision. A soft white-grey circle fades from `fogFlashIntensity` to 0
  // over `fogFlashDurationMs`. Allocated per-call (one Arc + one tween) —
  // only fires on the actual collision attempt, not per-frame, so the
  // allocation cost is bounded by player intent (Learning EP-01 facet).
  flashFog(x: number, y: number, durationMs?: number): void {
    if (!LIGHTING_CONFIG.enabled) return;
    const dur = durationMs ?? LIGHTING_CONFIG.fogFlashDurationMs;
    const intensity = LIGHTING_CONFIG.fogFlashIntensity;
    const flash = this.scene.add.circle(x, y, 96, 0xeeeeee, intensity);
    flash.setDepth(6.5); // just above the lighting overlay (6), below thoughts (8)
    this.scene.cameras.getCamera('ui')?.ignore(flash);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: dur,
      onComplete: () => flash.destroy(),
    });
  }

  // Public getters for the F3 debug HUD.
  getHasEmber(): boolean {
    return this.hasEmber;
  }

  getPlayerRadius(): number {
    if (!this.hasEmber) return LIGHTING_CONFIG.playerRadiusPre;
    return lerpByWarmth(this.playerWarmth, LIGHTING_CONFIG.playerLightRadiusFloor, LIGHTING_CONFIG.playerLightRadiusFull);
  }

  setPlayerWarmth(warmth: number): void {
    this.playerWarmth = warmth;
  }

  getLightCount(): number {
    return this.lights.length;
  }

  // Coverage test for alpha-gated decorations (US-77). Originally checked the
  // player's light + any active registered light (including tier-2 post-Ember).
  // Replaced with a tier-2-only check (US-81 follow-up): an alpha-gated
  // decoration should appear only when its paired tier-2 light is active —
  // i.e. when the player carries the Ember AND the decoration falls inside
  // any tier-2 light's coverage. Otherwise the player's own light radius
  // would reveal tier-2 decorations the moment they walk past, defeating the
  // "the Ember reveals what was always there" beat.
  //
  // Squared-distance comparison avoids a sqrt per call.
  isLitAt(x: number, y: number): boolean {
    if (!this.hasEmber) return false;
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      if (light.tier !== 2) continue;
      const dx = x - light.x;
      const dy = y - light.y;
      if (dx * dx + dy * dy <= light.radius * light.radius) return true;
    }
    return false;
  }

  // Returns the underlying GL texture handle of the lighting RenderTexture so
  // the DesaturationPipeline (US-76) can bind it as a second sampler. Returns
  // null when the rt is uninitialised or the renderer is canvas-mode.
  //
  // Phaser 3.80+ wraps glTexture in a WebGLTextureWrapper; the raw handle
  // lives on `.webGLTexture`. Falls back to the unwrapped value for older
  // builds in case of regression.
  getMaskGlTexture(): WebGLTexture | null {
    if (!this.rt) return null;
    const source = this.rt.texture?.source?.[0];
    if (!source) return null;
    const glTex = (source as unknown as { glTexture?: unknown }).glTexture;
    if (!glTex) return null;
    const wrapped = (glTex as { webGLTexture?: WebGLTexture }).webGLTexture;
    if (wrapped) return wrapped;
    return glTex as WebGLTexture;
  }

  destroy(): void {
    this.rt?.destroy();
    this.brush?.destroy();
    this.rt = null;
    this.brush = null;
    this.lights = [];
    this.toggleKey = null;
  }
}
