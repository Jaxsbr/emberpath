import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { AreaDefinition } from '../data/areas/types';
import { AreaPassability, cellBlocks } from './collision';

// Collision paint editor (#119, U2). Boots over a real area render (so the
// scene — cottage sprite, fences, trees — is visible underneath) and lets Jaco
// click-drag to toggle which cells block Pip, then Save the result to a STAGED
// file (never the live game code). The staged JSON is later ported into the
// game by `autonomy/apply-staged-collision.cjs` (U3) and proven before commit.
//
// Why an editable layer seeded from real collision: the grid starts as an exact
// copy of what `cellBlocks` blocks today (so the over-blocked cottage shows as a
// solid red slab), and Jaco erases the slab down to the thin base band he wants
// Pip to collide with. Single source of truth stays `cellBlocks` — the editor
// never invents a second collision rule, it just records the desired cell set.

const GRID_DEPTH = 60; // above world entities + the F4 overlay, below UI (100)
const BLOCKED_COLOR = 0xff3344;
const BLOCKED_FILL_ALPHA = 0.4;
const GRID_LINE_COLOR = 0x66ccff;
const GRID_LINE_ALPHA = 0.13;
const CURSOR_COLOR = 0xffffff;
const PAN_SPEED = 600; // world px/sec for WASD/arrow camera pan

export class CollisionEditorSystem {
  private graphics: Phaser.GameObjects.Graphics;
  // Desired BLOCKED cells, keyed "col,row". Seeded from current real collision.
  private blocked = new Set<string>();
  private painting = false;
  private paintValue = true; // true = mark blocked, false = erase (set on first cell)
  private hoverCell: { col: number; row: number } | null = null;
  private readonly areaId: string;
  private readonly cols: number;
  private readonly rows: number;

  private panKeys: Phaser.Input.Keyboard.Key[] = [];
  private saveKey: Phaser.Input.Keyboard.Key | null = null;
  private resetKey: Phaser.Input.Keyboard.Key | null = null;

  // DOM HUD — a fixed corner panel with a Save button + status line. Plain DOM
  // (not Phaser text) so the save round-trip is trivially Playwright-testable:
  // click `#collision-save`, read `#collision-status`.
  private hud: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private countEl: HTMLDivElement | null = null;

  constructor(
    private scene: Phaser.Scene,
    area: AreaDefinition,
    passability: AreaPassability,
  ) {
    this.areaId = area.id;
    this.cols = area.mapCols;
    this.rows = area.mapRows;

    // Seed the paint layer from the live collision predicate so the starting
    // state IS current real collision — Jaco edits the diff, not from scratch.
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (cellBlocks(col, row, passability)) this.blocked.add(`${col},${row}`);
      }
    }

    this.graphics = this.scene.add.graphics().setDepth(GRID_DEPTH);
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore(this.graphics);

    this.setupCamera();
    this.setupInput();
    this.buildHud();
    this.redraw();
  }

  // Free camera: stop following Pip, center on the map, pan with WASD / arrows
  // (handled in update). Centering on the map (not Pip's spawn) means the editor
  // opens looking at the middle of the area regardless of where the player spawned.
  private setupCamera(): void {
    const cam = this.scene.cameras.main;
    cam.stopFollow();
    cam.centerOn((this.cols * TILE_SIZE) / 2, (this.rows * TILE_SIZE) / 2);
    const kb = this.scene.input.keyboard;
    if (kb) {
      const C = Phaser.Input.Keyboard.KeyCodes;
      this.panKeys = [
        kb.addKey(C.W), kb.addKey(C.A), kb.addKey(C.S), kb.addKey(C.D),
        kb.addKey(C.UP), kb.addKey(C.LEFT), kb.addKey(C.DOWN), kb.addKey(C.RIGHT),
      ];
      this.saveKey = kb.addKey(C.ENTER);
      this.resetKey = kb.addKey(C.R);
    }
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
  }

  private cellAt(pointer: Phaser.Input.Pointer): { col: number; row: number } | null {
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(wp.x / TILE_SIZE);
    const row = Math.floor(wp.y / TILE_SIZE);
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return { col, row };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer);
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
    const cell = this.cellAt(pointer);
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

  // Pan the free camera each frame from held keys. Called from GameScene.update
  // while in editor mode (gameplay update is suppressed).
  update(_time: number, delta: number): void {
    if (!this.panKeys.length) return;
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    const [w, a, s, d, up, left, down, right] = this.panKeys;
    if (a.isDown || left.isDown) dx -= 1;
    if (d.isDown || right.isDown) dx += 1;
    if (w.isDown || up.isDown) dy -= 1;
    if (s.isDown || down.isDown) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const cam = this.scene.cameras.main;
      cam.scrollX += dx * PAN_SPEED * dt;
      cam.scrollY += dy * PAN_SPEED * dt;
    }
    if (this.saveKey && Phaser.Input.Keyboard.JustDown(this.saveKey)) void this.save();
    if (this.resetKey && Phaser.Input.Keyboard.JustDown(this.resetKey)) this.clearAll();
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();
    // Faint full grid so every cell boundary is visible while painting.
    g.lineStyle(1, GRID_LINE_COLOR, GRID_LINE_ALPHA);
    for (let col = 0; col <= this.cols; col++) {
      g.lineBetween(col * TILE_SIZE, 0, col * TILE_SIZE, this.rows * TILE_SIZE);
    }
    for (let row = 0; row <= this.rows; row++) {
      g.lineBetween(0, row * TILE_SIZE, this.cols * TILE_SIZE, row * TILE_SIZE);
    }
    // Blocked cells.
    g.fillStyle(BLOCKED_COLOR, BLOCKED_FILL_ALPHA);
    g.lineStyle(1, BLOCKED_COLOR, 0.6);
    for (const key of this.blocked) {
      const [col, row] = key.split(',').map(Number);
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    }
    // Hover cursor outline.
    if (this.hoverCell) {
      g.lineStyle(2, CURSOR_COLOR, 0.9);
      g.strokeRect(this.hoverCell.col * TILE_SIZE, this.hoverCell.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  private clearAll(): void {
    this.blocked.clear();
    this.updateCount();
    this.redraw();
  }

  private buildHud(): void {
    const hud = document.createElement('div');
    hud.id = 'collision-editor-hud';
    hud.style.cssText =
      'position:fixed;top:10px;left:10px;z-index:9999;font:12px/1.4 system-ui,sans-serif;' +
      'background:rgba(20,16,30,0.92);color:#eee;padding:10px 12px;border-radius:6px;' +
      'max-width:240px;box-shadow:0 2px 10px rgba(0,0,0,0.5);';
    hud.innerHTML =
      `<div style="font-weight:600;margin-bottom:4px">Collision editor — ${this.areaId}</div>` +
      `<div style="opacity:0.8;margin-bottom:6px">Left-drag: toggle cells (red = blocks Pip).<br>` +
      `WASD / arrows: pan. R: clear all. Enter or Save: write staged file.</div>`;

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
    status.style.cssText = 'margin-top:6px;min-height:14px;opacity:0.9';
    hud.appendChild(status);
    this.statusEl = status;

    document.body.appendChild(hud);
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
  // (the plugin is a dev-server middleware), which is the only context the
  // editor is ever used in.
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

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    this.graphics.destroy();
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
  }
}
