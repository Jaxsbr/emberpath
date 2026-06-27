import Phaser from 'phaser';
import { hasSave, loadSave, clearSave, resetWorld } from '../triggers/saveState';
import { toggleAudioMuted, isAudioMutedPref } from '../audio';
import { resetAllFlags, setFlag } from '../triggers/flags';
import { getArea } from '../data/areas/registry';
import { getScenario } from '../scenarios/registry';
import { TILE_SIZE } from '../maps/constants';
import { TERRAINS } from '../maps/terrain';
import { OBJECT_KINDS } from '../maps/objects';

// Storybook serif — the menu's first job is to read as a *game*, not a debug
// screen. A generic `serif` fallback is always last so even a device without
// Georgia still gets a warm storybook serif, never the old monospace look.
const TITLE_FONT = 'Georgia, "Times New Roman", serif';

// Warm palette — the whole game is "a small warm light in a drained grey world".
// The title screen is the one place we let that warmth glow at full colour (no
// desaturation pipeline runs here), so the first thing a player sees expresses
// the game's identity instead of a flat void.
const EMBER_GOLD = '#ffd9a0';
const EMBER_DEEP = '#ff9d4d';
const SECONDARY_COLOR = '#d8c3a5';
const RESET_COLOR = '#5a5a6a';

const GLOW_TEX_KEY = 'title-glow';
const GLOW_TEX_SIZE = 512;
const EMBER_TEX_KEY = 'title-ember';
const EMBER_TEX_SIZE = 16;

// Rising embers — same in-place-mutation idiom as AmbientMotesSystem (Learning
// EP-01: no per-frame allocation). A fixed pool drifts gently UP like sparks off
// a fire and recycles across the bottom edge, so the menu breathes instead of
// sitting frozen.
const EMBER_COUNT = 20;
const EMBER_RISE = -16;     // px/s base upward drift
const EMBER_SWAY_AMP = 9;   // px/s perpendicular sway amplitude
const EMBER_SWAY_SPEED = 0.6;
const EMBER_TWINKLE_SPEED = 0.9;
const EMBER_ALPHA_MIN = 0.18;
const EMBER_ALPHA_MAX = 0.5;
const EMBER_SIZE_MIN = 3;
const EMBER_SIZE_MAX = 8;

interface Ember {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  speed: number;
  phase: number;
  twPhase: number;
  baseAlpha: number;
  cycle: number;
}

export class TitleScene extends Phaser.Scene {
  private layoutObjects: Phaser.GameObjects.Text[] = [];
  private resetText!: Phaser.GameObjects.Text;
  private soundText!: Phaser.GameObjects.Text;
  private embers: Ember[] = [];
  private glow: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    // Process dev / testing URL params BEFORE any layout decision so the
    // post-reset Title renders in the no-save state on the same frame and a
    // refresh after the wipe doesn't re-trigger the wipe (history.replaceState
    // drops the consumed params).
    this.applyUrlReset();

    // Test bench: `?scenario=<id>` boots straight into a mid-game state in the
    // sandbox namespace, skipping the menu entirely. Returns true when it took
    // over, so we don't also render the Title.
    if (this.applyScenario()) return;

    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#15131f');
    this.createAtmosphere();

    const titleText = this.add.text(width / 2, height / 3, 'Emberpath', {
      fontFamily: TITLE_FONT,
      fontSize: '64px',
      color: EMBER_GOLD,
      // Padding ≥ shadow blur so the glow fades smoothly instead of clipping at
      // the text texture bounds (which left a faint rectangle behind the words).
      padding: { x: 28, y: 24 },
    }).setOrigin(0.5).setDepth(10);
    // Soft ember glow behind the letters — the title itself looks lit.
    titleText.setShadow(0, 0, EMBER_DEEP, 22, true, true);
    // Gentle breathing so the title feels alive, like Pip's ember.
    this.tweens.add({
      targets: titleText,
      alpha: { from: 0.82, to: 1 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // A one-line evocative tagline that names the core mechanic (carry your
    // light home) at a young-child reading level — flavour, no doctrine.
    this.add.text(width / 2, height / 3 + 56, 'Carry the light home.', {
      fontFamily: TITLE_FONT,
      fontSize: '20px',
      color: SECONDARY_COLOR,
      fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(10).setAlpha(0.85);

    this.resetText = this.add.text(width / 2, height * 0.82, 'Reset Progress', {
      fontFamily: TITLE_FONT,
      fontSize: '16px',
      color: RESET_COLOR,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    this.resetText.on('pointerover', () => this.resetText.setColor('#8a8a9a'));
    this.resetText.on('pointerout', () => this.resetText.setColor(RESET_COLOR));
    this.resetText.on('pointerdown', () => {
      resetWorld();
      this.resetText.setText('Progress Reset!');
      this.time.delayedCall(1500, () => {
        this.resetText.setText('Reset Progress');
      });
      // Tear down Continue/New Game labels and re-render in the no-save state
      // on the same frame (US-65: Continue must disappear immediately so the
      // player doesn't see a stale primary button while the toast shows).
      this.renderTitleLayout();
    });

    // F5 (#200): sound on/off toggle, mirroring the Reset control. Reads + writes the
    // persisted mute pref so the choice carries across sessions; the live manager (if
    // already up) is updated too.
    const soundLabel = () => (isAudioMutedPref() ? 'Sound: Off' : 'Sound: On');
    this.soundText = this.add.text(width / 2, height * 0.88, soundLabel(), {
      fontFamily: TITLE_FONT,
      fontSize: '16px',
      color: RESET_COLOR,
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    this.soundText.on('pointerover', () => this.soundText.setColor('#8a8a9a'));
    this.soundText.on('pointerout', () => this.soundText.setColor(RESET_COLOR));
    this.soundText.on('pointerdown', () => {
      toggleAudioMuted();
      this.soundText.setText(soundLabel());
    });

    this.renderTitleLayout();
  }

  // Pre-bake the two warm textures (a big soft radial glow, a small ember speck)
  // and lay out the static atmosphere. The glow sits behind everything; the
  // rising-ember pool drifts above it but behind the text.
  private createAtmosphere(): void {
    this.ensureGlowTexture();
    this.ensureEmberTexture();

    const { width, height } = this.scale;

    this.glow = this.add.image(width / 2, height / 3, GLOW_TEX_KEY)
      .setDepth(1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setScale(Math.max(width, height) / GLOW_TEX_SIZE * 1.4);
    // The glow breathes in counter-phase to the title so the whole screen has a
    // slow, warm pulse like a settling fire.
    this.tweens.add({
      targets: this.glow,
      alpha: { from: 0.42, to: 0.62 },
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (let i = 0; i < EMBER_COUNT; i++) {
      const img = this.add.image(0, 0, EMBER_TEX_KEY)
        .setDepth(4)
        .setBlendMode(Phaser.BlendModes.ADD);
      const baseAlpha = EMBER_ALPHA_MIN + this.rand(i * 7.1) * (EMBER_ALPHA_MAX - EMBER_ALPHA_MIN);
      const size = EMBER_SIZE_MIN + this.rand(i * 3.7 + 1) * (EMBER_SIZE_MAX - EMBER_SIZE_MIN);
      img.setDisplaySize(size, size);
      const ember: Ember = {
        img,
        x: this.rand(i * 2.3 + 0.5) * width,
        y: this.rand(i * 5.9 + 0.2) * height,
        speed: 0.6 + this.rand(i * 1.7 + 0.9) * 0.4,
        phase: this.rand(i * 4.1) * Math.PI * 2,
        twPhase: this.rand(i * 6.3 + 0.4) * Math.PI * 2,
        baseAlpha,
        cycle: 0,
      };
      img.setPosition(ember.x, ember.y);
      this.embers.push(ember);
    }
  }

  update(_time: number, delta: number): void {
    if (this.embers.length === 0) return;
    const dt = delta / 1000;
    const { width, height } = this.scale;
    const t = this.time.now / 1000;
    for (const e of this.embers) {
      e.y += EMBER_RISE * e.speed * dt;
      e.x += Math.sin(t * EMBER_SWAY_SPEED + e.phase) * EMBER_SWAY_AMP * dt;
      // Recycle across the bottom edge once an ember rises off the top.
      // Advance a per-ember cycle counter and seed the new x from THAT (not from
      // the just-reset y, which is a constant — seeding off it sent every ember
      // back to the same column each lap, so the field retraced fixed streaks
      // instead of drifting). Counter-based seed keeps it deterministic (no
      // Math.random, resume-safe) while giving a fresh spread every lap.
      if (e.y < -16) {
        e.y = height + 16;
        e.cycle += 1;
        e.x = this.rand(e.phase * 3.7 + e.cycle * 1.7 + 0.13) * width;
      }
      const twinkle = 0.7 + 0.3 * Math.sin(t * EMBER_TWINKLE_SPEED + e.twPhase);
      e.img.setPosition(e.x, e.y);
      e.img.setAlpha(e.baseAlpha * twinkle);
    }
  }

  // Big soft warm radial — bright gold core fading to transparent. ADD-blended
  // over the dark background it reads as a pool of firelight behind the title.
  private ensureGlowTexture(): void {
    if (this.textures.exists(GLOW_TEX_KEY)) return;
    const canvas = this.textures.createCanvas(GLOW_TEX_KEY, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const c = GLOW_TEX_SIZE / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.0, 'rgba(255,196,120,0.85)');
    g.addColorStop(0.35, 'rgba(255,150,70,0.32)');
    g.addColorStop(0.7, 'rgba(120,70,40,0.10)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
    canvas.refresh();
  }

  // Small soft ember speck (warm-white core → transparent gold edge) — same
  // recipe as the in-game ambient motes so the menu and the world share a look.
  private ensureEmberTexture(): void {
    if (this.textures.exists(EMBER_TEX_KEY)) return;
    const canvas = this.textures.createCanvas(EMBER_TEX_KEY, EMBER_TEX_SIZE, EMBER_TEX_SIZE);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const c = EMBER_TEX_SIZE / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0.0, 'rgba(255,244,214,1)');
    g.addColorStop(0.5, 'rgba(255,200,130,0.55)');
    g.addColorStop(1.0, 'rgba(255,170,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, EMBER_TEX_SIZE, EMBER_TEX_SIZE);
    canvas.refresh();
  }

  // Deterministic pseudo-random in [0,1) from a seed — Math.random is avoided in
  // this build (same idiom as AmbientMotesSystem / the NPC aura phases), so the
  // ember field is varied by index instead.
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  private renderTitleLayout(): void {
    for (const obj of this.layoutObjects) obj.destroy();
    this.layoutObjects = [];

    const { width, height } = this.scale;

    if (hasSave()) {
      const continueText = this.makeButton(width / 2, height / 2 + 40, 'Continue', true);
      continueText.on('pointerdown', () => this.handleContinue());
      this.layoutObjects.push(continueText);

      const newGameText = this.makeButton(width / 2, height / 2 + 96, 'New Game', false);
      newGameText.on('pointerdown', () => this.handleNewGame());
      this.layoutObjects.push(newGameText);
    } else {
      const newGameText = this.makeButton(width / 2, height / 2 + 40, 'New Game', true);
      newGameText.on('pointerdown', () => this.handleNewGame());
      this.layoutObjects.push(newGameText);
    }
  }

  // A warm, tappable menu label. The primary action glows gold and pulses gently
  // so it reads as "start here"; the secondary is calmer. Hover brightens both.
  private makeButton(x: number, y: number, label: string, primary: boolean): Phaser.GameObjects.Text {
    const color = primary ? EMBER_GOLD : SECONDARY_COLOR;
    const btn = this.add.text(x, y, label, {
      fontFamily: TITLE_FONT,
      fontSize: primary ? '34px' : '22px',
      color,
      // Padding ≥ the primary glow blur so the shadow fades smoothly rather than
      // clipping into a faint box behind the label.
      padding: { x: 18, y: 14 },
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    if (primary) {
      btn.setShadow(0, 0, EMBER_DEEP, 14, true, true);
      this.tweens.add({
        targets: btn,
        alpha: { from: 0.8, to: 1 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor(color));
    return btn;
  }

  private handleContinue(): void {
    const save = loadSave();
    if (!save) {
      // hasSave was true on layout but loadSave returned null (race or scrub
      // during validation) — fall back to a fresh start.
      this.scene.start('GameScene');
      return;
    }
    const dest = getArea(save.areaId);
    if (!dest) {
      console.warn(`emberpath: Continue with unknown areaId '${save.areaId}' — falling back`);
      clearSave();
      this.scene.start('GameScene');
      return;
    }
    const { x, y } = save.position;
    const maxX = dest.mapCols * TILE_SIZE;
    const maxY = dest.mapRows * TILE_SIZE;
    if (x < 0 || x >= maxX || y < 0 || y >= maxY) {
      console.warn('emberpath: Continue position out of bounds — falling back to playerSpawn', save.position);
      clearSave();
      this.scene.start('GameScene');
      return;
    }
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    // Cell-passability check under the tile-architecture model: the cell blocks
    // if any object on it is impassable OR all four bounding terrain vertices
    // are impassable (matches systems/collision.ts:cellBlocks).
    const blockedByObject = dest.objects.some(
      (o) => o.col === col && o.row === row && OBJECT_KINDS[o.kind] && !OBJECT_KINDS[o.kind].passable,
    );
    const t = dest.terrain;
    const inBounds =
      row >= 0 && row + 1 < t.length && col >= 0 && col + 1 < (t[0]?.length ?? 0);
    const allImpassableTerrain =
      inBounds &&
      !TERRAINS[t[row][col]].passable &&
      !TERRAINS[t[row][col + 1]].passable &&
      !TERRAINS[t[row + 1][col + 1]].passable &&
      !TERRAINS[t[row + 1][col]].passable;
    if (blockedByObject || allImpassableTerrain || !inBounds) {
      console.warn('emberpath: Continue position on impassable cell — falling back to playerSpawn', save.position);
      clearSave();
      this.scene.start('GameScene');
      return;
    }
    this.scene.start('GameScene', { areaId: save.areaId, resumePosition: { x, y } });
  }

  private handleNewGame(): void {
    resetWorld();
    this.scene.start('GameScene');
  }

  private applyUrlReset(): void {
    const params = new URLSearchParams(window.location.search);
    let mutated = false;
    if (params.get('reset') === '1') {
      resetWorld();
      console.info('emberpath: ?reset=1 — flags + save wiped');
      params.delete('reset');
      mutated = true;
    }
    if (params.get('clearSave') === '1') {
      clearSave();
      console.info('emberpath: ?clearSave=1 — save wiped');
      params.delete('clearSave');
      mutated = true;
    }
    if (mutated) {
      const remaining = params.toString();
      const cleanedUrl = `${window.location.pathname}${remaining ? '?' + remaining : ''}${window.location.hash}`;
      window.history.replaceState({}, '', cleanedUrl);
    }
  }

  // Test bench (sandbox.ts): when `?scenario=<id>` names a known scenario, wipe
  // the sandbox namespace, write its flags, and jump straight into GameScene at
  // its area + position — skipping the menu. The sandbox namespace was already
  // selected at sandbox.ts import (`?scenario` implies sandbox), so resetAllFlags
  // / setFlag here only ever touch the throwaway keys; the real save is untouched.
  // Returns true when it booted a scenario. An unknown id falls through to the
  // normal Title (returns false) with a console warning.
  private applyScenario(): boolean {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('scenario');
    if (!id) return false;

    const scenario = getScenario(id);
    if (!scenario) {
      console.warn(`emberpath: unknown scenario '${id}' — falling back to Title`);
      return false;
    }
    if (!getArea(scenario.areaId)) {
      console.warn(`emberpath: scenario '${id}' has unknown areaId '${scenario.areaId}'`);
      return false;
    }

    // Atomic state build: clear the sandbox namespace, then write the flags.
    resetAllFlags();
    for (const [name, value] of Object.entries(scenario.flags)) setFlag(name, value);

    // Rewrite the URL to drop `?scenario` but keep `?sandbox=1`, so a manual
    // refresh stays in the throwaway namespace and resumes the sandbox run
    // (matches the applyUrlReset history.replaceState idiom).
    params.delete('scenario');
    params.set('sandbox', '1');
    const remaining = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${remaining ? '?' + remaining : ''}${window.location.hash}`,
    );

    // `entryPoint` (col,row) lets GameScene.createPlayer do the spawn math and,
    // together with the scenario's `*_intro_played` flag, keeps the intro skipped.
    // Omitted position → GameScene falls back to the area's playerSpawn.
    const data: { areaId: string; entryPoint?: { col: number; row: number } } = {
      areaId: scenario.areaId,
    };
    if (scenario.position) data.entryPoint = scenario.position;

    this.scene.start('GameScene', data);
    return true;
  }
}
