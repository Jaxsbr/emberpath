import Phaser from 'phaser';
import { resetAllFlags } from '../triggers/flags';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height / 3, 'Emberpath', {
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const startText = this.add.text(width / 2, height / 2, 'Start', {
      fontSize: '32px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startText.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    const resetText = this.add.text(width / 2, height * 0.7, 'Reset Progress', {
      fontSize: '18px',
      color: '#666666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    resetText.on('pointerdown', () => {
      resetAllFlags();
      resetText.setText('Progress Reset!');
      this.time.delayedCall(1500, () => {
        resetText.setText('Reset Progress');
      });
    });
  }
}
