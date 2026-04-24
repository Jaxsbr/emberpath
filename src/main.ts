import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { StoryScene } from './scenes/StoryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  // Nearest-neighbor filtering — crisp pixel art for tilesets, fox-pip, and future sprites.
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  input: {
    touch: true,
  },
  backgroundColor: '#1a1a2e',
  scene: [TitleScene, GameScene, StoryScene],
};

new Phaser.Game(config);
