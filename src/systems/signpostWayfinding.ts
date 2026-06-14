import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { OBJECT_KINDS } from '../maps/objects';
import { SignpostDefinition } from '../data/areas/types';

// C7 — signpost wayfinding (Jaco idea, 2026-06-14). Playtester complaint #1 was
// "confused, don't know where to go". The world already has decorative wooden
// signposts but they say nothing. This turns each declared signpost into a real
// wayfinding cue: walk into its radius and the sign lights up — a soft white
// outline fades in behind it, and a short destination label ("Fog Marsh ↑")
// fades in above it telling a first-time player where that path leads.
// Step out of range and both fade back out.
//
// Reuses the C4-e talk-prompt idiom: every visual is created ONCE up front and
// reused — show/hide only toggle visibility + tween alpha (Learning EP-01, no
// per-enter/exit allocation). The only per-frame work while a sign is shown is
// one Math.sin label bob, mirroring the talk prompt so the cue reads as alive.
//
// Rendering: the outline + label live on the MAIN camera (the UI camera ignores
// them, same rule the talk prompt / motes follow) so the desaturation pipeline
// treats them like the rest of the world. The player is by definition close to
// the sign when in range, so Pip's ember light lifts the grey-out around it and
// the white outline + label read in colour — the "your warmth wakes the world"
// language carries the highlight for free.

// Trigger radius — the "collision sphere" around a sign. A touch over 2 tiles so
// the cue arrives just before the player reaches the post, not on contact.
const SIGN_RANGE = 2.2 * TILE_SIZE;
// White outline clone sits a hair behind the real sign (sign objects draw at
// 2.5) and slightly larger, so white reads as a halo/outline around the edges.
const OUTLINE_DEPTH = 2.49;
const OUTLINE_SCALE = 1.16;
const OUTLINE_MAX_ALPHA = 0.85;
const LABEL_DEPTH = 150; // same band as the talk prompt — above world art
const FADE_IN_MS = 220;
const FADE_OUT_MS = 150;
// Gentle label bob so the cue breathes (matches the talk prompt's ~1 Hz, 3 px).
const LABEL_BOB_AMP = 3; // px
const LABEL_BOB_SPEED = 0.006; // rad/ms
// Lift the label a full tile above the post top. The post is only ~1 tile tall,
// so a label sitting just above it overlaps the (taller) player standing right
// next to the sign (Jaco, 2026-06-14). One tile of clearance reads cleanly.
const LABEL_LIFT = TILE_SIZE;

interface SignEntry {
  def: SignpostDefinition;
  centerX: number;
  centerY: number;
  topY: number;
  outline: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
  visible: boolean;
  outlineTween: Phaser.Tweens.Tween | null;
  labelTween: Phaser.Tweens.Tween | null;
}

export class SignpostWayfindingSystem {
  private scene: Phaser.Scene;
  private uiCam: Phaser.Cameras.Scene2D.Camera | null;
  private entries: SignEntry[] = [];

  constructor(scene: Phaser.Scene, signposts: SignpostDefinition[]) {
    this.scene = scene;
    this.uiCam = scene.cameras.getCamera('ui');
    for (const def of signposts) {
      this.entries.push(this.build(def));
    }
  }

  // Create the per-sign visuals once. Both start invisible and parked.
  private build(def: SignpostDefinition): SignEntry {
    const kind = def.kind ?? 'sign-wood';
    const objDef = OBJECT_KINDS[kind];
    const fp = objDef?.footprint ?? { w: 1, h: 1 };
    const topLeftX = def.col * TILE_SIZE;
    const topLeftY = def.row * TILE_SIZE;
    const centerX = topLeftX + (fp.w * TILE_SIZE) / 2;
    const centerY = topLeftY + (fp.h * TILE_SIZE) / 2;

    // White outline clone of the sign — only if its atlas is loaded. Centred on
    // the sign and scaled up a touch so the white shows as an edge halo behind
    // the real (depth 2.5) sprite.
    let outline: Phaser.GameObjects.Image | null = null;
    if (objDef && this.scene.textures.exists(objDef.atlasKey)) {
      outline = this.scene.add.image(centerX, centerY, objDef.atlasKey);
      outline.setOrigin(0.5, 0.5);
      outline.setDisplaySize(fp.w * TILE_SIZE * OUTLINE_SCALE, fp.h * TILE_SIZE * OUTLINE_SCALE);
      outline.setTintFill(0xffffff); // solid white silhouette → reads as an outline halo
      outline.setDepth(OUTLINE_DEPTH);
      outline.setAlpha(0);
      outline.setVisible(false);
      this.uiCam?.ignore(outline);
    }

    const label = this.scene.add.text(centerX, topLeftY, def.label, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#fff7e0',
      backgroundColor: '#1a1208cc',
      padding: { x: 6, y: 3 },
    });
    label.setOrigin(0.5, 1); // sits just above the sign top
    label.setDepth(LABEL_DEPTH);
    label.setAlpha(0);
    label.setVisible(false);
    this.uiCam?.ignore(label);

    return {
      def,
      centerX,
      centerY,
      topY: topLeftY,
      outline,
      label,
      visible: false,
      outlineTween: null,
      labelTween: null,
    };
  }

  // Proximity check each frame. Show/hide fire only on the out↔in-range edge;
  // while shown, the only per-frame work is the label bob (one Math.sin).
  update(playerCenterX: number, playerCenterY: number): void {
    for (const e of this.entries) {
      const dx = playerCenterX - e.centerX;
      const dy = playerCenterY - e.centerY;
      const inRange = dx * dx + dy * dy <= SIGN_RANGE * SIGN_RANGE;

      if (inRange && !e.visible) this.show(e);
      else if (!inRange && e.visible) this.hide(e);

      if (e.visible) {
        const bob = Math.sin(this.scene.time.now * LABEL_BOB_SPEED) * LABEL_BOB_AMP;
        e.label.setPosition(e.centerX, e.topY - 4 - LABEL_LIFT + bob);
      }
    }
  }

  private show(e: SignEntry): void {
    e.visible = true;

    e.labelTween?.stop();
    e.label.setVisible(true);
    e.label.setScale(0.9);
    e.labelTween = this.scene.tweens.add({
      targets: e.label,
      alpha: 1,
      scale: 1,
      duration: FADE_IN_MS,
      ease: 'Back.easeOut',
    });

    if (e.outline) {
      e.outlineTween?.stop();
      e.outline.setVisible(true);
      e.outlineTween = this.scene.tweens.add({
        targets: e.outline,
        alpha: OUTLINE_MAX_ALPHA,
        duration: FADE_IN_MS,
        ease: 'Sine.easeOut',
      });
    }
  }

  private hide(e: SignEntry): void {
    e.visible = false;

    e.labelTween?.stop();
    e.labelTween = this.scene.tweens.add({
      targets: e.label,
      alpha: 0,
      duration: FADE_OUT_MS,
      ease: 'Sine.easeIn',
      onComplete: () => e.label.setVisible(false),
    });

    if (e.outline) {
      e.outlineTween?.stop();
      const outline = e.outline;
      e.outlineTween = this.scene.tweens.add({
        targets: outline,
        alpha: 0,
        duration: FADE_OUT_MS,
        ease: 'Sine.easeIn',
        onComplete: () => outline.setVisible(false),
      });
    }
  }

  destroy(): void {
    for (const e of this.entries) {
      e.outlineTween?.stop();
      e.labelTween?.stop();
      e.outline?.destroy();
      e.label.destroy();
    }
    this.entries = [];
  }
}
