import Phaser from 'phaser';
import { STYLE_PALETTE } from '../art/styleGuide';

// C2-b — the standing "what to do next" cue. A first-time player (a kid who can
// read, or an adult) should never have to guess the goal: the intro states it
// once, then this banner keeps ONE short, concrete objective on screen so the
// guidance isn't only reactive thoughts you stumble into.
//
// C4-c — the goal used to swap SILENTLY. When the objective changed (new area, a
// beat advancing the quest) the text just blinked over and a player — a kid
// especially — could miss that the "what do I do" anchor had updated. Now a
// genuine change plays a short attention beat: the banner settles down from
// just above with a gentle overshoot, and a hope-gold glow blooms behind it and
// fades. Hope-gold is the palette's reserved "the way forward" colour (style
// guide), so the cue reads as the game pointing: here's your next step.
//
// Screen-fixed at top-centre. Everything lives in one Container pinned with
// scrollFactor 0 and rendered on the UI camera only (main camera ignores it),
// so the world's zoom/scroll never moves it and the whole banner can be tweened
// as a unit. Styled to match the thought bubble (cream panel, umber text) but
// upright (not italic) because it's an instruction, not an inner thought.

const BANNER_DEPTH = 95; // above world/ember, below debug HUD (110) and dialogue
const FONT_SIZE = '12px';
const PADDING_X = 8;
const PADDING_Y = 5;
const TOP_MARGIN = 10;
const MAX_WIDTH = 260;
const CORNER_RADIUS = 6;
const STROKE_WIDTH = 1;
const PANEL_ALPHA = 0.9;

// Attention beat shown only on a genuine objective change (C4-c).
const SETTLE_DURATION_MS = 320;
const SETTLE_DROP_PX = 10; // starts this far above its resting Y and settles down
const GLOW_DURATION_MS = 620;
const GLOW_PAD = 5; // glow rect extends this far beyond the panel on each side
const GLOW_MAX_ALPHA = 0.55;

const hexToInt = (h: string) => parseInt(h.slice(1), 16);
const PANEL_FILL_INT = hexToInt(STYLE_PALETTE.creamLight);
const PANEL_STROKE_INT = hexToInt(STYLE_PALETTE.umberDark);
const GLOW_INT = hexToInt(STYLE_PALETTE.hopeGoldLight);
const TEXT_COLOR = STYLE_PALETTE.umberDark;

export class ObjectiveBannerSystem {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private bg: Phaser.GameObjects.Graphics | null = null;
  private glow: Phaser.GameObjects.Graphics | null = null;
  private text: Phaser.GameObjects.Text | null = null;
  private current: string | null = null;
  private settleTween: Phaser.Tweens.Tween | null = null;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private listenersBound = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.scene.scale.on('resize', this.reflow, this);
    this.scene.events.on('shutdown', this.handleShutdown, this);
    this.scene.events.on('destroy', this.handleShutdown, this);
    this.listenersBound = true;
  }

  // Set (or replace) the on-screen objective. Idempotent for the same text so a
  // per-area re-set on Continue/transition doesn't rebuild GameObjects or replay
  // the attention beat. `animateDelayMs` holds the beat back so it plays once the
  // screen is visible — on an area transition the caller passes the fade
  // duration so the goal blooms in AFTER the fade clears, not invisibly under it.
  setObjective(objective: string, animateDelayMs = 0): void {
    if (objective === this.current && this.text) return;
    this.current = objective;
    this.clearObjects();

    this.glow = this.scene.add.graphics();
    this.glow.setAlpha(0);

    this.bg = this.scene.add.graphics();

    this.text = this.scene.add.text(0, PADDING_Y, objective, {
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: MAX_WIDTH, useAdvancedWrap: true },
      align: 'center',
    });
    this.text.setOrigin(0.5, 0);

    // One container holds glow → panel → text (back to front) and is the single
    // thing we position and tween. scrollFactor 0 pins it to the screen.
    this.container = this.scene.add.container(0, TOP_MARGIN, [this.glow, this.bg, this.text]);
    this.container.setScrollFactor(0);
    this.container.setDepth(BANNER_DEPTH);
    // Render on the UI camera only — main camera ignores the whole container so
    // world zoom / scroll never moves the banner (same split debugOverlay uses).
    this.scene.cameras.main.ignore(this.container);

    this.reflow();
    this.playChangeBeat(animateDelayMs);
  }

  // Hide the objective (e.g. when the goal is met). Keeps the system alive so a
  // later beat can set a new objective without reconstruction.
  clear(): void {
    this.current = null;
    this.clearObjects();
  }

  // Re-centre horizontally and redraw the panel + glow at the current text size.
  // Children are drawn relative to the container origin (panel top-left at
  // -w/2, 0) so a resize only moves the container and redraws — no reflow of the
  // tween state.
  private reflow(): void {
    if (!this.container || !this.text || !this.bg || !this.glow) return;
    this.container.x = this.scene.scale.width / 2;

    const w = this.text.width + PADDING_X * 2;
    const h = this.text.height + PADDING_Y * 2;
    const left = -w / 2;

    this.bg.clear();
    this.bg.fillStyle(PANEL_FILL_INT, PANEL_ALPHA);
    this.bg.fillRoundedRect(left, 0, w, h, CORNER_RADIUS);
    this.bg.lineStyle(STROKE_WIDTH, PANEL_STROKE_INT, 1);
    this.bg.strokeRoundedRect(left, 0, w, h, CORNER_RADIUS);

    // Soft hope-gold backing, slightly larger than the panel, so when it fades
    // in behind on a change the gold "blooms" past the cream edges.
    this.glow.clear();
    this.glow.fillStyle(GLOW_INT, 1);
    this.glow.fillRoundedRect(
      left - GLOW_PAD,
      -GLOW_PAD,
      w + GLOW_PAD * 2,
      h + GLOW_PAD * 2,
      CORNER_RADIUS + GLOW_PAD,
    );
  }

  // The C4-c attention beat: settle the panel down from just above with a gentle
  // overshoot, and bloom the hope-gold glow in then out. Fires only from
  // setObjective on a real change.
  private playChangeBeat(delayMs: number): void {
    if (!this.container || !this.glow) return;
    this.stopTweens();

    // Hold at the start state through the delay so nothing flashes settled
    // before the (possibly delayed) beat begins — under a black fade this stays
    // invisible until the screen clears.
    this.container.y = TOP_MARGIN - SETTLE_DROP_PX;
    this.container.setAlpha(0);
    this.settleTween = this.scene.tweens.add({
      targets: this.container,
      y: TOP_MARGIN,
      alpha: 1,
      delay: delayMs,
      duration: SETTLE_DURATION_MS,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.settleTween = null;
      },
    });

    this.glow.setAlpha(0);
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: GLOW_MAX_ALPHA, to: 0 },
      delay: delayMs,
      duration: GLOW_DURATION_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.glowTween = null;
      },
    });
  }

  private stopTweens(): void {
    if (this.settleTween) {
      this.settleTween.stop();
      this.settleTween = null;
    }
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = null;
    }
  }

  private clearObjects(): void {
    this.stopTweens();
    // Destroying the container destroys its children (glow/bg/text) too.
    this.container?.destroy();
    this.container = null;
    this.bg = null;
    this.glow = null;
    this.text = null;
  }

  private handleShutdown(): void {
    this.clearObjects();
    this.current = null;
    if (this.listenersBound) {
      this.scene.scale.off('resize', this.reflow, this);
      this.scene.events.off('shutdown', this.handleShutdown, this);
      this.scene.events.off('destroy', this.handleShutdown, this);
      this.listenersBound = false;
    }
  }

  destroy(): void {
    this.handleShutdown();
  }
}
