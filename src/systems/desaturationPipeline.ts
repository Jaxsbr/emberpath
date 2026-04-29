import Phaser from 'phaser';
import { LIGHTING_CONFIG } from './lightingConfig';

// Custom post-FX pipeline that desaturates pixels outside the lit area (US-76).
// Reads the LightingSystem's RenderTexture as a per-pixel mask: where mask
// alpha = 1 (full fog), output is fully greyscaled; where mask alpha = 0
// (lit), output preserves color. Mix is scaled by LIGHTING_CONFIG.desaturationStrength.
//
// Implementation notes:
// - Sampler 0 (uMainSampler): scene framebuffer, automatic from PostFX pipeline.
// - Sampler 1 (uLightingMask): bound manually each frame from the lighting RT.
// - World-UV is computed from screen-UV using the camera scroll/zoom uniforms,
//   so the mask sample aligns with the world-space overlay regardless of
//   camera scroll.
//
// Performance: single texture read + one mat-mult-equivalent per fragment;
// well under the 2ms/frame budget on iPhone 12 / Pixel 5 class devices in
// the small viewports this game targets.

const FRAG_SHADER = `
#define SHADER_NAME EMBERPATH_DESATURATION

precision mediump float;

uniform sampler2D uMainSampler;
uniform sampler2D uLightingMask;
uniform vec2 uViewMin;     // top-left of camera worldView in world coords
uniform vec2 uViewSize;    // size of camera worldView in world coords
uniform vec2 uWorldSize;   // total world size (matches lighting RT dimensions)
uniform float uStrength;
uniform float uEnabled;
uniform float uFlipY;      // 1.0 if outTexCoord.y is GL-bottom-up, 0.0 if top-down

varying vec2 outTexCoord;

void main() {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  if (uEnabled < 0.5) {
    gl_FragColor = color;
    return;
  }

  // Map fragment UV (0..1 across the camera framebuffer) into world coords using
  // the camera's worldView rectangle. uFlipY handles Phaser's framebuffer Y
  // orientation — set from JS so we don't have to guess across renderer versions.
  vec2 viewUV = vec2(outTexCoord.x, mix(outTexCoord.y, 1.0 - outTexCoord.y, uFlipY));
  vec2 worldXY = uViewMin + viewUV * uViewSize;
  vec2 worldUV = worldXY / uWorldSize;

  float fogAlpha = 0.0;
  if (worldUV.x >= 0.0 && worldUV.x <= 1.0 && worldUV.y >= 0.0 && worldUV.y <= 1.0) {
    fogAlpha = texture2D(uLightingMask, worldUV).a;
  }

  // Luminance-weighted greyscale (Rec. 601 coefficients).
  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  vec3 grey = vec3(luminance);

  // Where fog is present, mix toward grey by (alpha * strength).
  float desatAmount = fogAlpha * uStrength;
  vec3 outColor = mix(color.rgb, grey, desatAmount);

  gl_FragColor = vec4(outColor, color.a);
}
`;

export class DesaturationPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  // Updated per-frame from GameScene before draw — no allocations in the hot path.
  private lightingTextureSource: WebGLTexture | null = null;
  private worldWidth = 0;
  private worldHeight = 0;
  private viewX = 0;
  private viewY = 0;
  private viewW = 0;
  private viewH = 0;
  // Effective desaturation strength — defaults to LIGHTING_CONFIG.desaturationStrength
  // and is pushed by GameScene when warming flags change (US-86 cumulative warming).
  // Recomputed only on warming-flag-change events, never per-frame (Learning EP-01).
  private currentStrength = LIGHTING_CONFIG.desaturationStrength;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'DesaturationPipeline',
      fragShader: FRAG_SHADER,
    });
  }

  // Called per-frame from GameScene with the latest world/camera state and the
  // lighting RT's GL texture handle. Stores primitives only (no allocation).
  // Reads the camera's worldView rectangle directly — that's Phaser's
  // authoritative "what's visible in world coords" and avoids re-deriving it
  // from scroll/zoom/screen-size (which gave wrong results across viewport
  // sizes and zoom levels).
  // Push a new effective desaturation strength (US-86 cumulative warming).
  // GameScene calls this from the warming-flag onFlagChange subscriber so the
  // value updates exactly on flag flip, never per-frame.
  setStrength(strength: number): void {
    this.currentStrength = strength;
  }

  getStrength(): number {
    return this.currentStrength;
  }

  setFrameState(
    lightingGlTexture: WebGLTexture | null,
    worldWidth: number,
    worldHeight: number,
    cam: Phaser.Cameras.Scene2D.Camera,
  ): void {
    this.lightingTextureSource = lightingGlTexture;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    const v = cam.worldView;
    this.viewX = v.x;
    this.viewY = v.y;
    this.viewW = v.width;
    this.viewH = v.height;
  }

  // PostFX pipeline draw entry point — called by Phaser each frame.
  // We bind the lighting mask to texture unit 1, set uniforms, then dispatch
  // the standard bindAndDraw for the framebuffer pass.
  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    const enabled = LIGHTING_CONFIG.enabled && this.lightingTextureSource !== null;

    this.set1f('uStrength', this.currentStrength);
    this.set1f('uEnabled', enabled ? 1 : 0);
    // Phaser's WebGL framebuffer for PostFX is bottom-up (GL convention) — Y
    // flip is required so the screen-top corresponds to the smaller world-Y.
    this.set1f('uFlipY', 1);
    this.set2f('uViewMin', this.viewX, this.viewY);
    this.set2f('uViewSize', this.viewW, this.viewH);
    this.set2f('uWorldSize', this.worldWidth, this.worldHeight);

    if (enabled && this.lightingTextureSource) {
      // Bind lighting RT to texture unit 1; the shader reads it via uLightingMask.
      // Direct GL calls — Phaser's PostFX wrapper API around extra samplers is
      // version-fragile, so doing this explicitly avoids surprises.
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lightingTextureSource);
      this.set1i('uLightingMask', 1);
      gl.activeTexture(gl.TEXTURE0); // restore default unit so other draws are unaffected
    }

    this.bindAndDraw(renderTarget);
  }
}
