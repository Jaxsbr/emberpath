import Phaser from 'phaser';
import { STYLE_PALETTE } from '../art/styleGuide';

// C2-b — the standing "what to do next" cue. A first-time player (a kid who can
// read, or an adult) should never have to guess the goal: the intro states it
// once, then this banner keeps ONE short, concrete objective on screen so the
// guidance isn't only reactive thoughts you stumble into.
//
// Screen-fixed at top-centre — created on the UI camera (scrollFactor 0) and
// ignored by the main camera so the world's zoom/scroll never moves it, the
// same split debugOverlay's HUD panel uses. Styled to match the thought bubble
// (cream panel, umber text) so it reads as the game's own quiet voice, but
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

const hexToInt = (h: string) => parseInt(h.slice(1), 16);
const PANEL_FILL_INT = hexToInt(STYLE_PALETTE.creamLight);
const PANEL_STROKE_INT = hexToInt(STYLE_PALETTE.umberDark);
const TEXT_COLOR = STYLE_PALETTE.umberDark;

export class ObjectiveBannerSystem {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Graphics | null = null;
  private text: Phaser.GameObjects.Text | null = null;
  private current: string | null = null;
  private listenersBound = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.scene.scale.on('resize', this.reflow, this);
    this.scene.events.on('shutdown', this.handleShutdown, this);
    this.scene.events.on('destroy', this.handleShutdown, this);
    this.listenersBound = true;
  }

  // Set (or replace) the on-screen objective. Idempotent for the same text so a
  // per-area re-set on Continue/transition doesn't rebuild GameObjects.
  setObjective(objective: string): void {
    if (objective === this.current && this.text) return;
    this.current = objective;
    this.clearObjects();

    this.text = this.scene.add.text(0, 0, objective, {
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: MAX_WIDTH, useAdvancedWrap: true },
      align: 'center',
    });
    this.text.setOrigin(0.5, 0);
    this.text.setScrollFactor(0);
    this.text.setDepth(BANNER_DEPTH);

    this.bg = this.scene.add.graphics();
    this.bg.setScrollFactor(0);
    this.bg.setDepth(BANNER_DEPTH - 1);

    // Render on the UI camera only — main camera ignores both so world zoom /
    // scroll never moves the banner (same split as debugOverlay's HUD).
    this.scene.cameras.main.ignore(this.text);
    this.scene.cameras.main.ignore(this.bg);

    this.reflow();
  }

  // Hide the objective (e.g. when the goal is met). Keeps the system alive so a
  // later beat can set a new objective without reconstruction.
  clear(): void {
    this.current = null;
    this.clearObjects();
  }

  // Re-centre horizontally and redraw the panel. Called on set and on resize so
  // the banner stays pinned to the top-centre across orientation changes.
  private reflow(): void {
    if (!this.text || !this.bg) return;
    const cx = this.scene.scale.width / 2;
    this.text.setPosition(cx, TOP_MARGIN + PADDING_Y);

    const w = this.text.width + PADDING_X * 2;
    const h = this.text.height + PADDING_Y * 2;
    this.bg.clear();
    this.bg.fillStyle(PANEL_FILL_INT, PANEL_ALPHA);
    this.bg.fillRoundedRect(cx - w / 2, TOP_MARGIN, w, h, CORNER_RADIUS);
    this.bg.lineStyle(STROKE_WIDTH, PANEL_STROKE_INT, 1);
    this.bg.strokeRoundedRect(cx - w / 2, TOP_MARGIN, w, h, CORNER_RADIUS);
  }

  private clearObjects(): void {
    this.bg?.destroy();
    this.bg = null;
    this.text?.destroy();
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
