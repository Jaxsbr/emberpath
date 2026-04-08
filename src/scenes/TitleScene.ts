import Phaser from 'phaser';

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
  }
}
