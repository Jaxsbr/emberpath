import Phaser from 'phaser';
import { EditorHostScene } from './editorScene';

export interface PhaserHost {
  game: Phaser.Game;
  scene: EditorHostScene;
  destroy(): void;
}

// Boot a Phaser game into `parent` and resolve once its scene has created and
// finished loading (textures ready). The canvas auto-resizes to the parent
// (Phaser.Scale.RESIZE), matching the in-game RESIZE mode the authoring systems
// assume — so editor drag coordinates map 1:1 with the canvas, same as in-game.
export function mountPhaser(parent: HTMLElement): Promise<PhaserHost> {
  return new Promise((resolve) => {
    const scene = new EditorHostScene();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#14101e',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
      },
      scene,
    });
    scene.onReady = () => {
      resolve({
        game,
        scene,
        destroy() {
          game.destroy(true);
        },
      });
    };
  });
}
