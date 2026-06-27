import Phaser from 'phaser';
// MUST load before the scene imports: sandbox.ts decides the localStorage
// namespace from the URL at module-init, and flags.ts reads localStorage when it
// first loads (transitively via the scenes below). See sandbox.ts.
import './sandbox';
import { isSandbox } from './sandbox';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { StoryScene } from './scenes/StoryScene';
import { installEndGamePage } from './ui/endPage';

const config: Phaser.Types.Core.GameConfig = {
  // WebGL required — DesaturationPipeline (US-76) is a custom PostFX shader
  // pipeline registered from GameScene; canvas renderer cannot host it.
  type: Phaser.WEBGL,
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

const game = new Phaser.Game(config);

// Testbench-only handle: in sandbox/scenario mode, expose the running game so the
// headless capture harness can drive scenes that gameplay can't easily reach (e.g.
// `launchStoryScene('word-given')` to render a reveal scene's beats for a GATE-2
// capture). Gated on isSandbox() so it never leaks into a real player session.
if (isSandbox()) {
  (window as unknown as { __emberpathGame?: Phaser.Game }).__emberpathGame = game;
}

// F2 (#198): the end-of-game page listens for `emberpath:game-complete` (fired by the
// F1 finale) and fades a warm reveal-at-credits overlay over the game. Installed here,
// outside the Phaser scene graph, so it survives the scene freeze the finale triggers.
installEndGamePage();
