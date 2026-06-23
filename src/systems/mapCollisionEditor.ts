import Phaser from 'phaser';
import type { TerrainId } from '../maps/terrain';
import type { AreaDefinition } from '../data/areas/types';
import { getArea, getAllAreaIds } from '../data/areas/registry';
import { fillObjectBlockMap } from '../maps/objects';
import { AreaPassability, cellBlocks } from './collision';

// Map (area / per-tile) collision authoring — the editor-app tab (#184, U1).
//
// Ported out of the in-game `?editor=collision` mode (the now-deleted
// src/systems/collisionEditor.ts) into the standalone editor's EditorHostScene,
// reusing the Triggers tab's fitted top-down render (screen-space mapping, no
// world camera / pan — the host scene loads no tilesets). Jaco click-drags to
// toggle which cells block Pip, then Saves → POST /__collision/save → the STAGED
// file (staged/collision/<areaId>.json, gitignored). The staged JSON is reported
// by autonomy/apply-staged-collision.cjs and hand-applied — area collision has no
// flat JSON data home (it's computed from terrain vertices + object footprints),
// so this tool records the desired cell set rather than rewriting source.
//
// The starting state IS current real collision: the grid is seeded from the same
// `cellBlocks` predicate the game runs, with object footprints filled via the
// SHARED `fillObjectBlockMap` (one math, no drift — the same fn GameScene uses).
// So the over-blocked cottage shows as a solid red slab and Jaco erases the diff.

const BACKDROP_DEPTH = 58;
const GRID_DEPTH = 59;
const BLOCK_DEPTH = 60;
const OVERLAY_DEPTH = 61;
const FIT_PAD = 24; // screen px margin around the fitted map

const BLOCKED_COLOR = 0xff3344;
const BLOCKED_FILL_ALPHA = 0.4;

// Representative ground colours — spatial context only (not the shipped Wang art),
// matched to the Triggers tab so the two area views read identically.
const TERRAIN_COLOR: Record<TerrainId, number> = {
  grass: 0x6a7048,
  sand: 0xb6a878,
  path: 0x8a7a5a,
  'marsh-floor': 0x4a5340,
  water: 0x2b3a4a,
  stone: 0x6b6358,
  'briar-floor': 0x5a6050,
  'briar-thorn': 0x39322f,
  'briar-path': 0x8a7350,
};

export class MapCollisionEditorSystem {
  private backdrop: Phaser.GameObjects.Rectangle;
  private gridGfx: Phaser.GameObjects.Graphics;
  private blockGfx: Phaser.GameObjects.Graphics;
  private overlayGfx: Phaser.GameObjects.Graphics;

  private area: AreaDefinition | undefined;
  private cols = 0;
  private rows = 0;

  // Desired BLOCKED cells, keyed "col,row". Seeded from current real collision.
  private blocked = new Set<string>();
  private painting = false;
  private paintValue = true; // true = mark blocked, false = erase (set on first cell)
  private hoverCell: { col: number; row: number } | null = null;

  // Tile→screen mapping (fitted; mirrors TriggerEditorSystem).
  private tilePx = 16;
  private originX = 0;
  private originY = 0;

  private hud: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private countEl: HTMLDivElement | null = null;

  constructor(
    private scene: Phaser.Scene,
    private readonly areaId: string,
    private readonly opts?: {
      hudParent?: HTMLElement;
      onSwitchArea?: (areaId: string) => void;
    },
  ) {
    const cam = this.scene.cameras.main;
    cam.stopFollow();
    cam.setZoom(1);
    cam.setScroll(0, 0);
    const viewW = cam.width;
    const viewH = cam.height;

    this.backdrop = this.scene.add
      .rectangle(0, 0, viewW, viewH, 0x14101e, 1)
      .setOrigin(0, 0)
      .setDepth(BACKDROP_DEPTH);
    this.gridGfx = this.scene.add.graphics().setDepth(GRID_DEPTH);
    this.blockGfx = this.scene.add.graphics().setDepth(BLOCK_DEPTH);
    this.overlayGfx = this.scene.add.graphics().setDepth(OVERLAY_DEPTH);

    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore([this.backdrop, this.gridGfx, this.blockGfx, this.overlayGfx]);

    this.loadArea();
    this.setupMapping(viewW, viewH);
    this.setupInput();
    this.buildHud();
    this.redraw();
  }

  private loadArea(): void {
    this.area = getArea(this.areaId);
    // Canonical area dimensions — same source CollisionEditor/TriggerEditor use.
    this.cols = this.area?.mapCols ?? 0;
    this.rows = this.area?.mapRows ?? 0;
    this.blocked.clear();
    if (!this.area) return;
    // Build the passability from terrain + object footprints via the SHARED math
    // (evaluate = () => true: preview every object's block regardless of flags),
    // then seed the paint layer from the live `cellBlocks` predicate so the
    // starting state IS current real collision — Jaco edits the diff, not scratch.
    const objectBlockMap = new Map<string, boolean>();
    fillObjectBlockMap(objectBlockMap, this.area.objects ?? [], () => true);
    const passability: AreaPassability = { terrain: this.area.terrain, objectBlockMap };
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (cellBlocks(col, row, passability)) this.blocked.add(`${col},${row}`);
      }
    }
  }

  private setupMapping(viewW: number, viewH: number): void {
    const cols = Math.max(1, this.cols);
    const rows = Math.max(1, this.rows);
    const fit = Math.min((viewW - FIT_PAD * 2) / cols, (viewH - FIT_PAD * 2) / rows);
    this.tilePx = Math.max(4, Math.floor(fit));
    this.originX = Math.round((viewW - this.tilePx * cols) / 2);
    this.originY = Math.round((viewH - this.tilePx * rows) / 2);
  }

  private tileToScreen(col: number, row: number): { x: number; y: number } {
    return { x: this.originX + col * this.tilePx, y: this.originY + row * this.tilePx };
  }

  private screenToCell(px: number, py: number): { col: number; row: number } | null {
    const col = Math.floor((px - this.originX) / this.tilePx);
    const row = Math.floor((py - this.originY) / this.tilePx);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return { col, row };
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const cell = this.screenToCell(pointer.x, pointer.y);
    if (!cell) return;
    const key = `${cell.col},${cell.row}`;
    // First cell decides the stroke direction: clicking a blocked cell erases,
    // clicking a clear cell paints — so a single drag is consistently add OR
    // remove, never a flicker of both.
    this.paintValue = !this.blocked.has(key);
    this.painting = true;
    this.applyCell(cell);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const cell = this.screenToCell(pointer.x, pointer.y);
    this.hoverCell = cell;
    if (this.painting && cell) this.applyCell(cell);
    this.redraw();
  }

  private onPointerUp(): void {
    this.painting = false;
  }

  private applyCell(cell: { col: number; row: number }): void {
    const key = `${cell.col},${cell.row}`;
    if (this.paintValue) this.blocked.add(key);
    else this.blocked.delete(key);
    this.updateCount();
    this.redraw();
  }

  // ---- drawing --------------------------------------------------------------

  private redraw(): void {
    this.drawGrid();
    this.drawBlocked();
    this.drawOverlay();
  }

  private drawGrid(): void {
    const g = this.gridGfx;
    g.clear();
    if (this.cols === 0) return;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const terr = this.area?.terrain?.[r]?.[c] as TerrainId | undefined;
        const color = terr && TERRAIN_COLOR[terr] !== undefined ? TERRAIN_COLOR[terr] : 0x3a3550;
        const { x, y } = this.tileToScreen(c, r);
        g.fillStyle(color, 1);
        g.fillRect(x, y, this.tilePx, this.tilePx);
      }
    }
    // Object footprints — small dark markers for placement reference.
    g.fillStyle(0x000000, 0.45);
    for (const obj of this.area?.objects ?? []) {
      const { x, y } = this.tileToScreen(obj.col, obj.row);
      const s = Math.max(3, this.tilePx * 0.4);
      g.fillRect(x + (this.tilePx - s) / 2, y + (this.tilePx - s) / 2, s, s);
    }
    // Faint grid lines.
    g.lineStyle(1, 0x000000, 0.18);
    for (let c = 0; c <= this.cols; c++) {
      const x = this.originX + c * this.tilePx;
      g.lineBetween(x, this.originY, x, this.originY + this.rows * this.tilePx);
    }
    for (let r = 0; r <= this.rows; r++) {
      const y = this.originY + r * this.tilePx;
      g.lineBetween(this.originX, y, this.originX + this.cols * this.tilePx, y);
    }
  }

  private drawBlocked(): void {
    const g = this.blockGfx;
    g.clear();
    g.fillStyle(BLOCKED_COLOR, BLOCKED_FILL_ALPHA);
    g.lineStyle(1, BLOCKED_COLOR, 0.6);
    for (const key of this.blocked) {
      const [col, row] = key.split(',').map(Number);
      const { x, y } = this.tileToScreen(col, row);
      g.fillRect(x, y, this.tilePx, this.tilePx);
      g.strokeRect(x, y, this.tilePx, this.tilePx);
    }
  }

  private drawOverlay(): void {
    const g = this.overlayGfx;
    g.clear();
    if (this.hoverCell) {
      const { x, y } = this.tileToScreen(this.hoverCell.col, this.hoverCell.row);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRect(x, y, this.tilePx, this.tilePx);
    }
  }

  // ---- HUD ------------------------------------------------------------------

  private buildHud(): void {
    const hud = document.createElement('div');
    hud.id = 'map-collision-hud';
    const embedded = !!this.opts?.hudParent;
    hud.style.cssText =
      (embedded ? 'position:static;' : 'position:fixed;top:10px;left:10px;z-index:9999;') +
      'font:12px/1.4 system-ui,sans-serif;background:rgba(20,16,30,0.94);color:#eee;' +
      'padding:10px 12px;border-radius:6px;max-width:300px;max-height:92vh;overflow:auto;' +
      'box-shadow:0 2px 10px rgba(0,0,0,0.5);';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:6px';
    title.textContent = 'Map collision';
    hud.appendChild(title);

    // Area selector.
    const areaSel = document.createElement('select');
    areaSel.style.cssText = 'width:100%;margin-bottom:6px;padding:3px';
    for (const id of getAllAreaIds()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = getArea(id)?.name ?? id;
      if (id === this.areaId) opt.selected = true;
      areaSel.appendChild(opt);
    }
    areaSel.addEventListener('change', () => this.opts?.onSwitchArea?.(areaSel.value));
    hud.appendChild(areaSel);

    const help = document.createElement('div');
    help.style.cssText = 'opacity:0.8;margin-bottom:6px';
    help.innerHTML =
      'Left-drag to toggle cells (red = blocks Pip). Seeded from current real ' +
      'collision — erase the diff, then Save the staged map.';
    hud.appendChild(help);

    const count = document.createElement('div');
    count.id = 'collision-count';
    count.style.cssText = 'margin-bottom:6px;font-weight:600';
    hud.appendChild(count);
    this.countEl = count;

    const btn = document.createElement('button');
    btn.id = 'collision-save';
    btn.textContent = 'Save staged map';
    btn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#c97a3a;color:#fff;' +
      'padding:6px 10px;font-weight:600;width:100%';
    btn.addEventListener('click', () => void this.save());
    hud.appendChild(btn);

    const status = document.createElement('div');
    status.id = 'collision-status';
    status.style.cssText = 'margin-top:8px;min-height:14px;opacity:0.95';
    hud.appendChild(status);
    this.statusEl = status;

    (this.opts?.hudParent ?? document.body).appendChild(hud);
    this.hud = hud;
    this.updateCount();
  }

  private updateCount(): void {
    if (this.countEl) this.countEl.textContent = `${this.blocked.size} blocked cells`;
  }

  private setStatus(msg: string, ok: boolean): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = ok ? '#8fe388' : '#ff8888';
    }
  }

  // POST the desired blocked-cell set to the Vite dev plugin, which writes
  // staged/collision/<areaId>.json. The endpoint only exists in `vite dev`
  // (the plugin is a dev-server middleware) — the only context the editor runs in.
  private async save(): Promise<void> {
    const blocked = [...this.blocked]
      .map((k) => k.split(',').map(Number) as [number, number])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const payload = { areaId: this.areaId, cols: this.cols, rows: this.rows, blocked };
    this.setStatus('Saving…', true);
    try {
      const res = await fetch('/__collision/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.setStatus(`Save failed (${res.status})`, false);
        return;
      }
      const body = (await res.json()) as { path?: string };
      this.setStatus(`Saved ${body.path ?? 'staged file'} (${blocked.length} cells)`, true);
    } catch (err) {
      this.setStatus(`Save error: ${String(err)}`, false);
    }
  }

  update(): void {
    // No per-frame work; drawing is event-driven.
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    this.backdrop.destroy();
    this.gridGfx.destroy();
    this.blockGfx.destroy();
    this.overlayGfx.destroy();
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
  }
}

// Resolve a `?area=` against the area family, defaulting to the first.
export function resolveCollisionAreaId(raw: string | null | undefined): string {
  const all = getAllAreaIds();
  if (raw && all.includes(raw)) return raw;
  return all[0];
}
