import Phaser from 'phaser';
import { hasSave, loadSave, clearSave, resetWorld } from '../triggers/saveState';
import { getArea } from '../data/areas/registry';
import { TILE_SIZE, TileType } from '../maps/constants';

const PRIMARY_FONT_SIZE = '32px';
const SECONDARY_FONT_SIZE = '20px';
const PRIMARY_COLOR = '#ffffff';
const SECONDARY_COLOR = '#aaaaaa';

export class TitleScene extends Phaser.Scene {
  private layoutObjects: Phaser.GameObjects.Text[] = [];
  private resetText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    // Process dev / testing URL params BEFORE any layout decision so the
    // post-reset Title renders in the no-save state on the same frame and a
    // refresh after the wipe doesn't re-trigger the wipe (history.replaceState
    // drops the consumed params).
    this.applyUrlReset();

    const { width, height } = this.scale;

    this.add.text(width / 2, height / 3, 'Emberpath', {
      fontSize: '48px',
      color: PRIMARY_COLOR,
    }).setOrigin(0.5);

    this.resetText = this.add.text(width / 2, height * 0.7, 'Reset Progress', {
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

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

    this.renderTitleLayout();
  }

  private renderTitleLayout(): void {
    for (const obj of this.layoutObjects) obj.destroy();
    this.layoutObjects = [];

    const { width, height } = this.scale;

    if (hasSave()) {
      const continueText = this.add.text(width / 2, height / 2, 'Continue', {
        fontSize: PRIMARY_FONT_SIZE,
        color: PRIMARY_COLOR,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      continueText.on('pointerdown', () => this.handleContinue());
      this.layoutObjects.push(continueText);

      const newGameText = this.add.text(width / 2, height / 2 + 50, 'New Game', {
        fontSize: SECONDARY_FONT_SIZE,
        color: SECONDARY_COLOR,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      newGameText.on('pointerdown', () => this.handleNewGame());
      this.layoutObjects.push(newGameText);
    } else {
      const newGameText = this.add.text(width / 2, height / 2, 'New Game', {
        fontSize: PRIMARY_FONT_SIZE,
        color: PRIMARY_COLOR,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      newGameText.on('pointerdown', () => this.handleNewGame());
      this.layoutObjects.push(newGameText);
    }
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
    const tile = dest.map[row]?.[col];
    if (tile === TileType.WALL) {
      console.warn('emberpath: Continue position on WALL tile — falling back to playerSpawn', save.position);
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
}
