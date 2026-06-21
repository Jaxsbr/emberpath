import { ObjectShapeEditorSystem, resolveEditorKind } from '@game/systems/objectShapeEditor';
import type { ObjectKindId } from '@game/maps/objects';
import type { EditorHostScene } from '../editorScene';
import { PhaserTab, type MountedSystem } from './phaserTab';

// Collision tab (#182 U2): per-object sub-cell collision authoring. Hosts the
// in-game ObjectShapeEditorSystem on the editor's Phaser scene; the system's own
// HUD (kind dropdown, paint help, Save) renders into the side panel. Picking a
// new kind from the dropdown calls back here (onSwitch) which tears down and
// remounts the system on that kind — no URL reload. Saves auto-write to
// src/data/object-shapes.json via the dev plugin (registered in vite.config, U4).
export class CollisionTab extends PhaserTab {
  private kind: ObjectKindId = resolveEditorKind(null);

  protected mountSystem(scene: EditorHostScene): MountedSystem {
    return new ObjectShapeEditorSystem(scene, this.kind, {
      hudParent: this.hudParent,
      onSwitch: (kind) => {
        this.kind = kind;
        this.remount();
      },
    });
  }
}
