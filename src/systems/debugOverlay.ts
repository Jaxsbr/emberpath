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

    // Z-order per Learning #57 facet: interaction (solid yellow) → wander (dashed green)
    // → awareness (dashed yellow). All three render at DEBUG_DEPTH=50 on the same Graphics
    // instance; later draws visually paint on top so the order above is the stacking order.
    for (const npc of npcs) {
      const cx = npc.col * TILE_SIZE + TILE_SIZE / 2;
      const cy = npc.row * TILE_SIZE + TILE_SIZE / 2;

      // 1. Interaction range (solid yellow) — existing.
      this.graphics.fillStyle(0xffff00, NPC_RADIUS_ALPHA);
      this.graphics.fillCircle(cx, cy, INTERACTION_RANGE);
      this.graphics.lineStyle(1, 0xffff00, 0.5);
      this.graphics.strokeCircle(cx, cy, INTERACTION_RANGE);

      // 2. Wander radius (dashed green) — centred on spawn tile.
      this.drawDashedCircle(cx, cy, npc.wanderRadius * TILE_SIZE, 0x44ff44);

      // 3. Awareness radius (dashed yellow) — centred on spawn tile.
      this.drawDashedCircle(cx, cy, npc.awarenessRadius * TILE_SIZE, 0xffff00);
    }
  }

  private drawDashedCircle(cx: number, cy: number, radius: number, color: number): void {
    if (!this.graphics || radius <= 0) return;
    const segments = 48; // 48 × 7.5° gives a visibly dashed stroke without noise.
    const gap = 2; // draw segment, skip next — produces a ~50% duty-cycle dash.
    this.graphics.lineStyle(1, color, 0.8);
    for (let i = 0; i < segments; i += gap) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * radius;
      const y0 = cy + Math.sin(a0) * radius;
      const x1 = cx + Math.cos(a1) * radius;
      const y1 = cy + Math.sin(a1) * radius;
      this.graphics.beginPath();
      this.graphics.moveTo(x0, y0);
      this.graphics.lineTo(x1, y1);
      this.graphics.strokePath();
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
