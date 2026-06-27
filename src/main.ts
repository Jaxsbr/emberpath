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
import { initAudio, getAudio } from './audio';
import { onFlagChange } from './triggers/flags';

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

// F5 (#200): the audio bed + SFX. The manager is a module-level singleton (like the
// end page and flags), so the music survives GameScene restarts on area transitions.
// initAudio is idempotent; it kicks off background decoding and stays silent until a
// scene calls setArea / sfx. Faint by default, with a persisted mute toggle.
initAudio();

// Milestone chimes fire once, the first time a story beat actually lands this session.
// onFlagChange only fires on a real setFlag (not on load), and milestone()'s once-gate
// dedups — so a Continue-resume that already holds the flag stays silent. We deliberately
// DON'T chime heart_bridge_crossing or game_complete here: the finale's `complete` swell
// (below) is the closing sound, and a chime right before it would step on the moment.
for (const flag of ['has_ember_mark', 'has_word', 'marsh_surrendered']) {
  onFlagChange(flag, () => getAudio()?.milestone(flag));
}

// The big warm swell at the very end, when the finale dispatches game-complete.
window.addEventListener('emberpath:game-complete', () => getAudio()?.sfx('sfx-complete'));
