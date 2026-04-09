import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { AreaDefinition, TriggerDefinition, ExitDefinition, NpcDefinition } from '../data/areas/types';

const DEBUG_DEPTH = 50; // between entities (5) and UI (100)
const TRIGGER_ALPHA = 0.3;
const NPC_RADIUS_ALPHA = 0.15;
const INTERACTION_RANGE = 1.5 * TILE_SIZE;
const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '9px',
  color: '#ffffff',
  backgroundColor: '#000000aa',
  padding: { x: 2, y: 1 },
};

const TYPE_COLORS: Record<string, number> = {
  thought: 0x4488ff,  // blue
  story: 0xff44ff,    // magenta
  dialogue: 0x44ff88, // green
  exit: 0xffaa44,     // orange
};

export class DebugOverlaySystem {
  private scene: Phaser.Scene;
  private visible = false;
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private labels: Phaser.GameObjects.Text[] = [];
  private toggleKey: Phaser.Input.Keyboard.Key | null = null;
  private dialogueActiveCheck: (() => boolean) | null = null;
  private area: AreaDefinition | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (scene.input.keyboard) {
      this.toggleKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    }
  }

  setDialogueActiveCheck(check: () => boolean): void {
    this.dialogueActiveCheck = check;
  }

  loadArea(area: AreaDefinition): void {
    this.area = area;
    if (this.visible) {
      this.clear();
      this.draw();
    }
  }

  update(): void {
    if (this.toggleKey && Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
      // Guard: ignore toggle during dialogue
      if (this.dialogueActiveCheck && this.dialogueActiveCheck()) return;

      this.visible = !this.visible;
      if (this.visible) {
        this.draw();
      } else {
        this.clear();
      }
    }
  }

  private draw(): void {
    if (!this.area) return;

    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(DEBUG_DEPTH);

    // Ignore by UI camera so it renders in world space only
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore(this.graphics);

    this.drawTriggerZones(this.area.triggers);
    this.drawExitZones(this.area.exits);
    this.drawNpcRadii(this.area.npcs);
  }

  private drawTriggerZones(triggers: TriggerDefinition[]): void {
    if (!this.graphics) return;

    for (const trigger of triggers) {
      const color = TYPE_COLORS[trigger.type] ?? 0xffffff;
      const x = trigger.col * TILE_SIZE;
      const y = trigger.row * TILE_SIZE;
      const w = trigger.width * TILE_SIZE;
      const h = trigger.height * TILE_SIZE;

      this.graphics.fillStyle(color, TRIGGER_ALPHA);
      this.graphics.fillRect(x, y, w, h);
      this.graphics.lineStyle(1, color, 0.8);
      this.graphics.strokeRect(x, y, w, h);

      let labelText = `${trigger.id} [${trigger.type}]`;
      if (trigger.condition) {
        labelText += `\n${trigger.condition}`;
      }

      const label = this.scene.add.text(x + 2, y + 2, labelText, LABEL_STYLE);
      label.setDepth(DEBUG_DEPTH + 1);
      const uiCam = this.scene.cameras.getCamera('ui');
      if (uiCam) uiCam.ignore(label);
      this.labels.push(label);
    }
  }

  private drawExitZones(exits: ExitDefinition[]): void {
    if (!this.graphics) return;
    const color = TYPE_COLORS['exit'];

    for (const exit of exits) {
      const x = exit.col * TILE_SIZE;
      const y = exit.row * TILE_SIZE;
      const w = exit.width * TILE_SIZE;
      const h = exit.height * TILE_SIZE;

      this.graphics.fillStyle(color, TRIGGER_ALPHA);
      this.graphics.fillRect(x, y, w, h);
      this.graphics.lineStyle(1, color, 0.8);
      this.graphics.strokeRect(x, y, w, h);

      const labelText = `${exit.id} [exit]\n→ ${exit.destinationAreaId} (${exit.entryPoint.col},${exit.entryPoint.row})`;
      const label = this.scene.add.text(x + 2, y + 2, labelText, LABEL_STYLE);
      label.setDepth(DEBUG_DEPTH + 1);
      const uiCam = this.scene.cameras.getCamera('ui');
      if (uiCam) uiCam.ignore(label);
      this.labels.push(label);
    }
  }

  private drawNpcRadii(npcs: NpcDefinition[]): void {
    if (!this.graphics) return;

    for (const npc of npcs) {
      const cx = npc.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = npc.row * TILE_SIZE + TILE_SIZE / 2;

      this.graphics.fillStyle(0xffff00, NPC_RADIUS_ALPHA);
      this.graphics.fillCircle(cx, cy, INTERACTION_RANGE);
      this.graphics.lineStyle(1, 0xffff00, 0.5);
      this.graphics.strokeCircle(cx, cy, INTERACTION_RANGE);
    }
  }

  private clear(): void {
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];
  }

  destroy(): void {
    this.clear();
  }
}
