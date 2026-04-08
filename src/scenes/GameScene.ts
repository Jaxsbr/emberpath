import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.add.text(100, 100, 'Game World', {
      fontSize: '24px',
      color: '#ffffff',
    });
  }
}
