import { mountPhaser, type PhaserHost } from '../phaserHost';
import type { EditorHostScene } from '../editorScene';

// Shared scaffold for the two Phaser-backed tabs (Collision, Shadow). Both mount
// an in-game authoring system onto a real EditorHostScene and let that system
// render its own HUD into a side panel (hudParent). The Phaser game is booted
// lazily on first activation (booting into a display:none container yields a
// 0-size canvas) and kept alive between tab switches; deactivation just unhooks
// the per-frame pump so a backgrounded tab's hotkeys (Enter/R) stop firing.
//
// Subclasses implement `mountSystem(scene)` — construct their editor system with
// `{ hudParent, onSwitch }` and return an object exposing `update()` (pumped each
// frame) and `destroy()` (called on kind/target switch and on teardown).
export interface MountedSystem {
  update(): void;
  destroy(): void;
}

export abstract class PhaserTab {
  protected hudParent!: HTMLElement;
  protected canvasHost!: HTMLElement;
  private host: PhaserHost | null = null;
  private booting: Promise<PhaserHost> | null = null;
  private system: MountedSystem | null = null;
  private scaffolded = false;

  constructor(protected readonly container: HTMLElement) {}

  protected abstract mountSystem(scene: EditorHostScene): MountedSystem;

  // Tear down the current system and mount a fresh one (kind/target switch).
  protected remount(): void {
    if (!this.host) return;
    this.system?.destroy();
    this.system = this.mountSystem(this.host.scene);
  }

  private buildScaffold(): void {
    if (this.scaffolded) return;
    this.container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'phaser-tab';

    const side = document.createElement('div');
    side.className = 'phaser-tab-hud';
    this.hudParent = side;

    const canvas = document.createElement('div');
    canvas.className = 'phaser-tab-canvas';
    this.canvasHost = canvas;

    wrap.appendChild(side);
    wrap.appendChild(canvas);
    this.container.appendChild(wrap);
    this.scaffolded = true;
  }

  async activate(): Promise<void> {
    this.buildScaffold();
    if (!this.host) {
      if (!this.booting) this.booting = mountPhaser(this.canvasHost);
      this.host = await this.booting;
    }
    if (!this.system) this.system = this.mountSystem(this.host.scene);
    // Pump the active system's update() each frame.
    this.host.scene.onFrame = () => this.system?.update();
  }

  deactivate(): void {
    if (this.host) this.host.scene.onFrame = undefined;
  }
}
