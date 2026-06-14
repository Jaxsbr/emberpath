import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { InscribedStoneDefinition } from '../data/areas/types';
import { getFlag, setFlag } from '../triggers/flags';
import { LightingSystem } from './lighting';
import { ThoughtBubbleSystem } from './thoughtBubble';

// The "remember" verb (the-word phase, US-W3). Pip walks up to a carved stone
// and remembers — but only once she has been GIVEN the Word. Before that the
// marks are just marks she cannot read.
//
//  - No Word yet (`has_word` unset)  → tapping shows the pre-Word thought.
//  - Word, not yet remembered        → set `remembered_<id>`, light the stone,
//                                       and read the remembered lines aloud.
//  - Already remembered              → re-read the lines (the stone stays lit).
//
// Mirrors systems/npcInteraction.ts: a single reused "remember" prompt that
// fades in on the out-of-range → in-range transition, a shared tap test
// (duration + distance), and a SPACE fallback for desktop. The stone SPRITE and
// its collision are authored in the area's `objects` list (rendered + y-sorted +
// collided by the proven object pipeline); this system owns only the verb, the
// prompt, and the warm light that blooms when the stone is remembered.
const INTERACTION_RANGE = 1.5 * TILE_SIZE;
const TAP_MAX_DURATION = 300;
const TAP_MAX_DISTANCE = 15;
const PROMPT_BOB_AMP = 3; // px
const PROMPT_BOB_SPEED = 0.006; // rad/ms (~1 Hz)
const PROMPT_FADE_IN_MS = 200;
const PROMPT_FADE_OUT_MS = 140;
// A remembered stone holds a small, always-on warm pool (tier 1) so it reads as
// a kept gift — a steady mark of light in the cold, even when Pip walks away.
const STONE_LIGHT_RADIUS = 64;
const STONE_LIGHT_INTENSITY = 0.38;

export class InscribedStoneSystem {
  private scene: Phaser.Scene;
  private stones: InscribedStoneDefinition[];
  private lighting: LightingSystem;
  private thoughtBubble: ThoughtBubbleSystem;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;
  private promptVisible = false;
  private promptTween: Phaser.Tweens.Tween | null = null;
  private promptShownAt = 0;
  private nearestStone: InscribedStoneDefinition | null = null;
  private pointerDownTime = 0;
  private pointerDownPos = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    stones: InscribedStoneDefinition[],
    lighting: LightingSystem,
    thoughtBubble: ThoughtBubbleSystem,
  ) {
    this.scene = scene;
    this.stones = stones;
    this.lighting = lighting;
    this.thoughtBubble = thoughtBubble;
    this.lightAlreadyRemembered();
    this.setupInput();
  }

  // A returning player whose save already holds `remembered_<id>` should find
  // those stones still lit on scene create — re-register their warm pool now.
  private lightAlreadyRemembered(): void {
    for (const stone of this.stones) {
      if (getFlag(`remembered_${stone.id}`) === true) this.lightStone(stone);
    }
  }

  private setupInput(): void {
    if (this.scene.input.keyboard) {
      this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerDownTime = pointer.downTime;
      this.pointerDownPos = { x: pointer.x, y: pointer.y };
    });
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const duration = pointer.upTime - this.pointerDownTime;
      const dx = pointer.x - this.pointerDownPos.x;
      const dy = pointer.y - this.pointerDownPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (duration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE) {
        this.tryRemember();
      }
    });
  }

  update(playerCenterX: number, playerCenterY: number): void {
    this.nearestStone = this.findNearestStoneInRange(playerCenterX, playerCenterY);

    if (this.nearestStone) {
      if (!this.promptVisible) this.showPrompt();
      this.positionPrompt(playerCenterX, playerCenterY);
    } else if (this.promptVisible) {
      this.hidePrompt();
    }

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.tryRemember();
    }
  }

  private findNearestStoneInRange(px: number, py: number): InscribedStoneDefinition | null {
    let nearest: InscribedStoneDefinition | null = null;
    let nearestDist = Infinity;
    const offset = TILE_SIZE / 2;
    for (const stone of this.stones) {
      const cx = stone.col * TILE_SIZE + offset;
      const cy = stone.row * TILE_SIZE + offset;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= INTERACTION_RANGE && dist < nearestDist) {
        nearest = stone;
        nearestDist = dist;
      }
    }
    return nearest;
  }

  private tryRemember(): void {
    const stone = this.nearestStone;
    if (!stone) return;

    // Not given the Word yet — the marks are unreadable.
    if (getFlag('has_word') !== true) {
      this.thoughtBubble.show({ text: stone.preWordThought });
      return;
    }

    // First time remembering this stone: keep the gift (set the flag), light it,
    // then read the lines. Already-remembered stones simply re-read.
    if (getFlag(`remembered_${stone.id}`) !== true) {
      setFlag(`remembered_${stone.id}`, true);
      this.lightStone(stone);
    }
    for (const line of stone.rememberedLines) {
      this.thoughtBubble.show({ text: line });
    }
  }

  // Register (or refresh — registerLight is idempotent by id) the stone's warm
  // tier-1 pool. Called on remember and on load for already-remembered stones.
  private lightStone(stone: InscribedStoneDefinition): void {
    const cx = (stone.col + 0.5) * TILE_SIZE;
    const cy = (stone.row + 0.5) * TILE_SIZE;
    this.lighting.registerLight({
      id: `inscribed-stone:${stone.id}`,
      x: cx,
      y: cy,
      radius: STONE_LIGHT_RADIUS,
      intensity: STONE_LIGHT_INTENSITY,
      tier: 1,
    });
  }

  private ensurePrompt(): Phaser.GameObjects.Text {
    if (this.promptText) return this.promptText;
    const isMobile = !this.scene.sys.game.device.os.desktop;
    const text = isMobile ? 'Tap to remember' : 'Space to remember';
    this.promptText = this.scene.add.text(0, 0, text, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 },
    });
    this.promptText.setOrigin(0.5, 0);
    this.promptText.setDepth(150);
    this.promptText.setAlpha(0);
    this.promptText.setVisible(false);
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore(this.promptText);
    return this.promptText;
  }

  private positionPrompt(playerCenterX: number, playerCenterY: number): void {
    if (!this.promptText) return;
    const bob = Math.sin((this.scene.time.now - this.promptShownAt) * PROMPT_BOB_SPEED) * PROMPT_BOB_AMP;
    this.promptText.setPosition(playerCenterX, playerCenterY + TILE_SIZE * 0.6 + bob);
  }

  private showPrompt(): void {
    this.promptVisible = true;
    const prompt = this.ensurePrompt();
    this.promptTween?.stop();
    prompt.setVisible(true);
    prompt.setAlpha(0);
    prompt.setScale(0.85);
    this.promptShownAt = this.scene.time.now;
    this.promptTween = this.scene.tweens.add({
      targets: prompt,
      alpha: 1,
      scale: 1,
      duration: PROMPT_FADE_IN_MS,
      ease: 'Back.easeOut',
    });
  }

  private hidePrompt(): void {
    this.promptVisible = false;
    if (!this.promptText) return;
    const prompt = this.promptText;
    this.promptTween?.stop();
    this.promptTween = this.scene.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: PROMPT_FADE_OUT_MS,
      ease: 'Sine.easeIn',
      onComplete: () => prompt.setVisible(false),
    });
  }

  destroy(): void {
    this.promptTween?.stop();
    this.promptTween = null;
    this.promptText?.destroy();
    this.promptText = null;
    this.promptVisible = false;
  }
}
