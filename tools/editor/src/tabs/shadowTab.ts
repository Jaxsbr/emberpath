import {
  ShadowEditorSystem,
  resolveShadowTarget,
  resolveShadowKind,
  type ShadowTarget,
} from '@game/systems/shadowEditor';
import type { EditorHostScene } from '../editorScene';
import { PhaserTab, type MountedSystem } from './phaserTab';

// Shadow tab (#182 U3): per-object and per-character ground-shadow authoring.
// Hosts the in-game ShadowEditorSystem on the editor's Phaser scene; its HUD
// (target toggle object⇄character, kind dropdown, shape tool, alpha, Save/Clear)
// renders into the side panel. Target/kind switches call back (onSwitch) which
// re-resolves a default kind for the new target and remounts — no URL reload.
// Object saves → object-shapes.json, character saves → character-shapes.json
// (dev plugins registered in vite.config, U4).
export class ShadowTab extends PhaserTab {
  private target: ShadowTarget = resolveShadowTarget(null);
  private kind: string = resolveShadowKind(this.target, null);

  protected mountSystem(scene: EditorHostScene): MountedSystem {
    return new ShadowEditorSystem(scene, this.target, this.kind, {
      hudParent: this.hudParent,
      onSwitch: ({ target, kind }) => {
        this.target = target;
        this.kind = resolveShadowKind(target, kind || null);
        this.remount();
      },
    });
  }
}
