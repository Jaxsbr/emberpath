import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import {
  AreaDefinition,
  TriggerDefinition,
  ExitDefinition,
  NpcDefinition,
  DrainZoneDefinition,
  QuietZoneDefinition,
} from '../data/areas/types';

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
// HUD panel — UI-camera-fixed, depth above world overlays. Multi-line text
// fed by an external provider (e.g. LightingSystem snapshot via GameScene).
const HUD_DEPTH = 110; // above UI camera default
const HUD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '11px',
  color: '#ffffff',
  backgroundColor: '#000000cc',
  padding: { x: 6, y: 4 },
};
const HUD_OFFSET_X = 8;
const HUD_OFFSET_Y = 8;

const TYPE_COLORS: Record<string, number> = {
  thought: 0x4488ff,  // blue
  story: 0xff44ff,    // magenta
  dialogue: 0x44ff88, // green
  exit: 0xffaa44,     // orange
};
// US-102/103 zone colors — distinct from trigger/exit so the F3 view reads as
// "drain = warm-sienna trap, quiet = hope-gold rest" at a glance. Drawn at
// TRIGGER_ALPHA so they sit visibly under any overlapping trigger/exit rect.
const DRAIN_ZONE_COLOR = 0xc97a3a;  // STYLE_PALETTE.burntSienna analog
const QUIET_ZONE_COLOR = 0xf2c95b;  // STYLE_PALETTE.hopeGoldLight analog

export class DebugOverlaySystem {
  private scene: Phaser.Scene;
  private visible = false;
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private labels: Phaser.GameObjects.Text[] = [];
  private toggleKey: Phaser.Input.Keyboard.Key | null = null;
  private dialogueActiveCheck: (() => boolean) | null = null;
  private area: AreaDefinition | null = null;
  // Optional HUD provider — when set, draw() creates a UI-camera text panel
  // showing the provider's multi-line string; update() refreshes it each
  // frame the overlay is visible. GameScene wires this in create() to
  // surface LightingSystem state (US-74 spec).
  private hudProvider: (() => string) | null = null;
  private hudText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (scene.input.keyboard) {
      this.toggleKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    }
  }

  setDialogueActiveCheck(check: () => boolean): void {
    this.dialogueActiveCheck = check;
  }

  setHudProvider(provider: () => string): void {
    this.hudProvider = provider;
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
    // Refresh HUD text every frame the overlay is visible. Provider returns a
    // primitive string — no allocation in this path beyond the string itself.
    if (this.visible && this.hudText && this.hudProvider) {
      this.hudText.setText(this.hudProvider());
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
    this.drawDrainZones(this.area.drainZones ?? []);
    this.drawQuietZones(this.area.quietZones ?? []);
    this.drawNpcRadii(this.area.npcs);
    this.drawHud();
  }

  // HUD text panel — UI-camera-fixed (main camera ignores it so the world's
  // zoom/scroll doesn't move it). Created only when a provider is set.
  private drawHud(): void {
    if (!this.hudProvider) return;
    this.hudText = this.scene.add.text(HUD_OFFSET_X, HUD_OFFSET_Y, this.hudProvider(), HUD_STYLE);
    this.hudText.setDepth(HUD_DEPTH);
    this.hudText.setScrollFactor(0);
    this.scene.cameras.main.ignore(this.hudText);
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

  private drawDrainZones(zones: DrainZoneDefinition[]): void {
    if (!this.graphics) return;
    for (const z of zones) {
      const x = z.col * TILE_SIZE;
      const y = z.row * TILE_SIZE;
      const w = z.width * TILE_SIZE;
      const h = z.height * TILE_SIZE;
      this.graphics.fillStyle(DRAIN_ZONE_COLOR, TRIGGER_ALPHA);
      this.graphics.fillRect(x, y, w, h);
      this.graphics.lineStyle(1, DRAIN_ZONE_COLOR, 0.8);
      this.graphics.strokeRect(x, y, w, h);

      const lineCount = z.doubts?.lines.length ?? 0;
      const labelText = `${z.id} [drain]${
        z.drainMultiplier !== undefined ? ` x${z.drainMultiplier}` : ''
      }\n${lineCount} doubt line${lineCount === 1 ? '' : 's'}`;
      const label = this.scene.add.text(x + 2, y + 2, labelText, LABEL_STYLE);
      label.setDepth(DEBUG_DEPTH + 1);
      const uiCam = this.scene.cameras.getCamera('ui');
      if (uiCam) uiCam.ignore(label);
      this.labels.push(label);
    }
  }

  private drawQuietZones(zones: QuietZoneDefinition[]): void {
    if (!this.graphics) return;
    for (const z of zones) {
      const x = z.col * TILE_SIZE;
      const y = z.row * TILE_SIZE;
      const w = z.width * TILE_SIZE;
      const h = z.height * TILE_SIZE;
      this.graphics.fillStyle(QUIET_ZONE_COLOR, TRIGGER_ALPHA);
      this.graphics.fillRect(x, y, w, h);
      this.graphics.lineStyle(1, QUIET_ZONE_COLOR, 0.8);
      this.graphics.strokeRect(x, y, w, h);

      const lineCount = z.narration?.lines.length ?? 0;
      const labelText = `${z.id} [quiet]${
        z.restoreMultiplier !== undefined ? ` x${z.restoreMultiplier}` : ''
      }\n${lineCount} narration line${lineCount === 1 ? '' : 's'}`;
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
    if (this.hudText) {
      this.hudText.destroy();
      this.hudText = null;
    }
  }

  destroy(): void {
    this.clear();
  }
}
