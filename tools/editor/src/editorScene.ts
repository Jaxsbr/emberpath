import Phaser from 'phaser';
import { OBJECT_KINDS } from '@game/maps/objects';
import { getCharacterKindIds, characterTextureKey, PLAYER_CHARACTER_ID } from '@game/maps/characters';

// The editor app's single Phaser scene (#182). It exists only to host the
// in-game authoring systems (ObjectShapeEditorSystem, ShadowEditorSystem) inside
// the standalone editor — those systems draw onto a real Phaser scene and read
// real textures, so the editor's preview is byte-identical to what ships.
//
// It preloads exactly the textures those systems touch: every object atlas
// (collision + object-shadow editing) and the idle-south frame of every
// character (character-shadow editing). It loads nothing else — no animations,
// no tilesets — because the authoring systems never reference them.
//
// `onReady` fires once after create(); `onFrame` is pumped every update() so a
// mounted system's own update() (key handling, drag) keeps running.
export class EditorHostScene extends Phaser.Scene {
  onReady?: (scene: EditorHostScene) => void;
  onFrame?: () => void;

  constructor() {
    super({ key: 'EditorHost' });
  }

  preload(): void {
    // Object atlases — keyed identically to GameScene.preload so def.atlasKey
    // resolves in both worlds.
    for (const def of Object.values(OBJECT_KINDS)) {
      this.load.image(def.atlasKey, def.assetPath);
    }

    // One idle-south frame per character — the exact key + path the shadow
    // editor resolves via characterTextureKey(). Mirrors the GameScene frame
    // path expression (`frame_00${i}` with i=0).
    for (const kind of getCharacterKindIds()) {
      const key = characterTextureKey(kind);
      const path =
        kind === PLAYER_CHARACTER_ID
          ? 'characters/fox-pip/idle/south/frame_000.png'
          : `npc/${kind}/idle/south/frame_000.png`;
      this.load.image(key, path);
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#14101e');
    this.onReady?.(this);
  }

  update(): void {
    this.onFrame?.();
  }
}
