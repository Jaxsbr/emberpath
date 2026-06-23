import { MapCollisionEditorSystem, resolveCollisionAreaId } from '@game/systems/mapCollisionEditor';
import type { EditorHostScene } from '../editorScene';
import { PhaserTab, type MountedSystem } from './phaserTab';

// Map collision tab (#184 U1). Mounts the MapCollisionEditorSystem onto the
// editor's Phaser scene: a fitted top-down view of the active area where the
// author paints which cells block Pip, seeded from current real collision. The
// tab owns the current area id (its own dropdown remounts on change — the same
// self-contained pattern as the Triggers tab), so the toolbar area-select
// doesn't drive it. Replaces the deleted in-game `?editor=collision` mode.
export class MapCollisionTab extends PhaserTab {
  private areaId: string = resolveCollisionAreaId(null);

  protected mountSystem(scene: EditorHostScene): MountedSystem {
    return new MapCollisionEditorSystem(scene, this.areaId, {
      hudParent: this.hudParent,
      onSwitchArea: (areaId) => {
        this.areaId = areaId;
        this.remount();
      },
    });
  }
}
