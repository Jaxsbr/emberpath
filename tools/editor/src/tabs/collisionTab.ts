import { ObjectShapeEditorSystem, resolveEditorKind } from '@game/systems/objectShapeEditor';
import {
  CharacterCollisionEditorSystem,
  resolveCharacterCollisionKind,
} from '@game/systems/characterCollisionEditor';
import type { ObjectKindId } from '@game/maps/objects';
import type { EditorHostScene } from '../editorScene';
import { PhaserTab, type MountedSystem } from './phaserTab';

type CollisionTarget = 'object' | 'character';

// Collision tab (#182 U2 + #185): per-OBJECT sub-cell collision authoring AND
// per-CHARACTER (Pip / NPC) body-rect authoring, behind one tab via a target
// toggle — mirroring the Shadow tab's object⇄character split. Object → the
// ObjectShapeEditorSystem (sub-cell paint over a footprint, saves to
// object-shapes.json). Character → the CharacterCollisionEditorSystem (a
// centre-referenced rect that travels with the sprite, saves to
// character-shapes.json). Each system's HUD (target toggle, kind dropdown, tools,
// Save) renders into the side panel; picking a new kind or flipping the target
// calls back here and remounts — no URL reload. Saves auto-write via the dev
// plugins registered in vite.config (U4 + #185).
export class CollisionTab extends PhaserTab {
  private target: CollisionTarget = 'object';
  private objectKind: ObjectKindId = resolveEditorKind(null);
  private characterKind: string = resolveCharacterCollisionKind(null);

  protected mountSystem(scene: EditorHostScene): MountedSystem {
    if (this.target === 'character') {
      return new CharacterCollisionEditorSystem(scene, this.characterKind, {
        hudParent: this.hudParent,
        onSwitch: (kind) => {
          this.characterKind = kind;
          this.remount();
        },
        onSwitchTarget: (target) => {
          this.target = target;
          this.remount();
        },
      });
    }
    return new ObjectShapeEditorSystem(scene, this.objectKind, {
      hudParent: this.hudParent,
      onSwitch: (kind) => {
        this.objectKind = kind;
        this.remount();
      },
      onSwitchTarget: (target) => {
        this.target = target;
        this.remount();
      },
    });
  }
}
