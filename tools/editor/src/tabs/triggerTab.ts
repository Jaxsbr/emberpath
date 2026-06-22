import { TriggerEditorSystem, resolveTriggerAreaId } from '@game/systems/triggerEditor';
import type { EditorHostScene } from '../editorScene';
import { PhaserTab, type MountedSystem } from './phaserTab';

// Triggers tab (#187 U4-U6). Mounts the TriggerEditorSystem onto the editor's
// Phaser scene: a fitted top-down view of the active area where the author draws
// trigger zones, with the structured condition/effect form in the side HUD. The
// tab owns the current area id (its own dropdown remounts on change — the same
// self-contained pattern as the Collision tab's kind selector), so the toolbar
// area-select doesn't drive it.
export class TriggerTab extends PhaserTab {
  private areaId: string = resolveTriggerAreaId(null);

  protected mountSystem(scene: EditorHostScene): MountedSystem {
    return new TriggerEditorSystem(scene, this.areaId, {
      hudParent: this.hudParent,
      onSwitchArea: (areaId) => {
        this.areaId = areaId;
        this.remount();
      },
    });
  }
}
