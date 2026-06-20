import Phaser from 'phaser';
import { COLLISION_SUBDIV } from '../maps/constants';
import { OBJECT_KINDS, ObjectKindId, ObjectKindDefinition, hasObjectKind } from '../maps/objects';

// FB-23 object-shape editor (U2). Boots via `?editor=object` (optionally
// `&kind=<id>`) and lets Jaco author per-OBJECT-KIND collision at sub-cell (8px)
// granularity, instead of the per-tile-per-area `collisionEditor`. Flow:
//   1. Pick a kind from the dropdown (rock, tree-oak, cottage-large…).
//   2. The kind's sprite renders large in the centre; a sub-cell grid overlays it.
//   3. Left-drag to paint/erase the sub-cells the kind should block.
//   4. Save → POST /__object-shape/save → merged into src/data/object-shapes.json.
// The saved sub-cell set is `collisionCells` ([sdx,sdy] offsets from the kind's
// anchor-cell top-left sub-cell), consumed by GameScene.buildObjectCollisionMap
// wherever that kind is placed — author once, applies everywhere.
//
// Why reboot-on-switch: changing the kind sets `?kind=` and reloads the scene.
// This keeps the editor stateless per kind (no mid-session texture/seed swap) and
// makes each kind trivially Playwright-addressable by URL.

const GRID_DEPTH = 60;
const BACKDROP_DEPTH = 58;
const SPRITE_DEPTH = 59;
const BLOCKED_COLOR = 0xff3344;
const BLOCKED_FILL_ALPHA = 0.4;
const GRID_LINE_COLOR = 0x66ccff;
const CELL_LINE_ALPHA = 0.5; // game-cell boundaries (bolder)
const SUB_LINE_ALPHA = 0.16; // sub-cell boundaries (faint)
const CURSOR_COLOR = 0xffffff;
const FIT_BOX = 480; // target on-screen px for the sprite's longest side

// Kinds offered in the selector: everything with a real sprite (skip invisible
// collision markers). Passable kinds are shown but flagged — you'd only open one
// to author a shadow (U5); collision painting on a passable kind is a no-op in
// game since it never contributes collision.
function selectableKinds(): ObjectKindId[] {
  return (Object.keys(OBJECT_KINDS) as ObjectKindId[]).filter((id) => !OBJECT_KINDS[id].invisible);
}

// Seed the paint set from the kind's CURRENT collision, mirroring
// buildObjectCollisionMap's source order: authored sub-cells → legacy
// collisionFootprint (whole cells) → single anchor cell. So the editor opens on
// exactly what blocks today and Jaco edits the diff. Passable kinds seed empty.
function seedSubCells(def: ObjectKindDefinition): Set<string> {
  const set = new Set<string>();
  if (def.passable) return set;
  if (def.collisionCells && def.collisionCells.length) {
    for (const [sdx, sdy] of def.collisionCells) set.add(`${sdx},${sdy}`);
    return set;
  }
  const cf = def.collisionFootprint;
  const c0 = cf ? cf.dx : 0;
  const r0 = cf ? cf.dy : 0;
  const cw = cf ? cf.w : 1;
  const ch = cf ? cf.h : 1;
  for (let dy = 0; dy < ch; dy++) {
    for (let dx = 0; dx < cw; dx++) {
      for (let sy = 0; sy < COLLISION_SUBDIV; sy++) {
        for (let sx = 0; sx < COLLISION_SUBDIV; sx++) {
          set.add(`${(c0 + dx) * COLLISION_SUBDIV + sx},${(r0 + dy) * COLLISION_SUBDIV + sy}`);
        }
      }
    }
  }
  return set;
}

export class ObjectShapeEditorSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image | null = null;
  private backdrop: Phaser.GameObjects.Rectangle;
  private blocked: Set<string>;
  private painting = false;
  private paintValue = true;
  private hover: { scol: number; srow: number } | null = null;

  private readonly kind: ObjectKindId;
  private readonly def: ObjectKindDefinition;
  private readonly fpW: number;
  private readonly fpH: number;
  private readonly subCols: number;
  private readonly subRows: number;
  private readonly cellPx: number; // on-screen px per game cell
  private readonly subPx: number; // on-screen px per sub-cell
  private readonly originX: number;
  private readonly originY: number;

  private saveKey: Phaser.Input.Keyboard.Key | null = null;
  private resetKey: Phaser.Input.Keyboard.Key | null = null;

  private hud: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private countEl: HTMLDivElement | null = null;

  constructor(private scene: Phaser.Scene, kind: ObjectKindId) {
    this.kind = kind;
    this.def = OBJECT_KINDS[kind];
    const fp = this.def.footprint ?? { w: 1, h: 1 };
    this.fpW = fp.w;
    this.fpH = fp.h;
    this.subCols = this.fpW * COLLISION_SUBDIV;
    this.subRows = this.fpH * COLLISION_SUBDIV;
    this.blocked = seedSubCells(this.def);

    // Fit the sprite to FIT_BOX on its longest side; sub-cell px derives from it.
    this.cellPx = Math.max(8, Math.floor(FIT_BOX / Math.max(this.fpW, this.fpH)));
    this.subPx = this.cellPx / COLLISION_SUBDIV;
    const spriteW = this.fpW * this.cellPx;
    const spriteH = this.fpH * this.cellPx;

    const cam = this.scene.cameras.main;
    cam.stopFollow();
    cam.setZoom(1);
    cam.setScroll(0, 0);
    const viewW = cam.width;
    const viewH = cam.height;
    this.originX = Math.round((viewW - spriteW) / 2);
    this.originY = Math.round((viewH - spriteH) / 2);

    // Opaque backdrop so the area underneath doesn't distract.
    this.backdrop = this.scene.add
      .rectangle(0, 0, viewW, viewH, 0x14101e, 1)
      .setOrigin(0, 0)
      .setDepth(BACKDROP_DEPTH);

    // The kind's sprite, drawn at footprint scale (1:1 with the grid).
    if (this.scene.textures.exists(this.def.atlasKey)) {
      this.sprite = this.scene.add
        .image(this.originX, this.originY, this.def.atlasKey)
        .setOrigin(0, 0)
        .setDepth(SPRITE_DEPTH);
      this.sprite.setDisplaySize(spriteW, spriteH);
    }

    this.graphics = this.scene.add.graphics().setDepth(GRID_DEPTH);
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.ignore(this.graphics);
      uiCam.ignore(this.backdrop);
      if (this.sprite) uiCam.ignore(this.sprite);
    }

    this.setupInput();
    this.buildHud();
    this.redraw();
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    const kb = this.scene.input.keyboard;
    if (kb) {
      this.saveKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.resetKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    }
  }

  // Pointer (screen px) → sub-cell offset, or null if outside the grid.
  private subAt(pointer: Phaser.Input.Pointer): { scol: number; srow: number } | null {
    const scol = Math.floor((pointer.x - this.originX) / this.subPx);
    const srow = Math.floor((pointer.y - this.originY) / this.subPx);
    if (scol < 0 || srow < 0 || scol >= this.subCols || srow >= this.subRows) return null;
    return { scol, srow };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const sub = this.subAt(pointer);
    if (!sub) return;
    const key = `${sub.scol},${sub.srow}`;
    this.paintValue = !this.blocked.has(key);
    this.painting = true;
    this.apply(sub);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const sub = this.subAt(pointer);
    this.hover = sub;
    if (this.painting && sub) this.apply(sub);
    this.redraw();
  }

  private onPointerUp(): void {
    this.painting = false;
  }

  private apply(sub: { scol: number; srow: number }): void {
    const key = `${sub.scol},${sub.srow}`;
    if (this.paintValue) this.blocked.add(key);
    else this.blocked.delete(key);
    this.updateCount();
    this.redraw();
  }

  // The editor has no per-frame work beyond its own hotkeys; gameplay is
  // suppressed while it's active (GameScene.update).
  update(): void {
    if (this.saveKey && Phaser.Input.Keyboard.JustDown(this.saveKey)) void this.save();
    if (this.resetKey && Phaser.Input.Keyboard.JustDown(this.resetKey)) this.clearAll();
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();
    const x0 = this.originX;
    const y0 = this.originY;
    const w = this.subCols * this.subPx;
    const h = this.subRows * this.subPx;

    // Blocked sub-cells.
    g.fillStyle(BLOCKED_COLOR, BLOCKED_FILL_ALPHA);
    for (const key of this.blocked) {
      const [scol, srow] = key.split(',').map(Number);
      g.fillRect(x0 + scol * this.subPx, y0 + srow * this.subPx, this.subPx, this.subPx);
    }

    // Faint sub-cell grid.
    g.lineStyle(1, GRID_LINE_COLOR, SUB_LINE_ALPHA);
    for (let c = 0; c <= this.subCols; c++) {
      g.lineBetween(x0 + c * this.subPx, y0, x0 + c * this.subPx, y0 + h);
    }
    for (let r = 0; r <= this.subRows; r++) {
      g.lineBetween(x0, y0 + r * this.subPx, x0 + w, y0 + r * this.subPx);
    }
    // Bolder game-cell grid on top.
    g.lineStyle(1.5, GRID_LINE_COLOR, CELL_LINE_ALPHA);
    for (let c = 0; c <= this.fpW; c++) {
      g.lineBetween(x0 + c * this.cellPx, y0, x0 + c * this.cellPx, y0 + h);
    }
    for (let r = 0; r <= this.fpH; r++) {
      g.lineBetween(x0, y0 + r * this.cellPx, x0 + w, y0 + r * this.cellPx);
    }

    // Hover cursor.
    if (this.hover) {
      g.lineStyle(2, CURSOR_COLOR, 0.9);
      g.strokeRect(
        x0 + this.hover.scol * this.subPx,
        y0 + this.hover.srow * this.subPx,
        this.subPx,
        this.subPx,
      );
    }
  }

  private clearAll(): void {
    this.blocked.clear();
    this.updateCount();
    this.redraw();
  }

  private buildHud(): void {
    const hud = document.createElement('div');
    hud.id = 'object-editor-hud';
    hud.style.cssText =
      'position:fixed;top:10px;left:10px;z-index:9999;font:12px/1.4 system-ui,sans-serif;' +
      'background:rgba(20,16,30,0.92);color:#eee;padding:10px 12px;border-radius:6px;' +
      'max-width:260px;box-shadow:0 2px 10px rgba(0,0,0,0.5);';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:6px';
    title.textContent = 'Object collision editor';
    hud.appendChild(title);

    // Kind selector — switching reboots the scene with ?kind=<id>.
    const select = document.createElement('select');
    select.id = 'object-kind-select';
    select.style.cssText = 'width:100%;margin-bottom:6px;padding:3px';
    for (const id of selectableKinds()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = OBJECT_KINDS[id].passable ? `${id} (passable)` : id;
      if (id === this.kind) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('editor', 'object');
      url.searchParams.set('kind', select.value);
      window.location.href = url.toString();
    });
    hud.appendChild(select);

    const help = document.createElement('div');
    help.style.cssText = 'opacity:0.8;margin-bottom:6px';
    help.innerHTML =
      'Left-drag: paint / erase collision sub-cells (red = blocks Pip).<br>' +
      'Bold lines = game tiles, faint = 8px sub-cells.<br>' +
      'R: clear all. Enter or Save: write object-shapes.json.';
    hud.appendChild(help);

    const count = document.createElement('div');
    count.id = 'object-count';
    count.style.cssText = 'margin-bottom:6px;font-weight:600';
    hud.appendChild(count);
    this.countEl = count;

    const btn = document.createElement('button');
    btn.id = 'object-save';
    btn.textContent = 'Save object shape';
    btn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#c97a3a;color:#fff;' +
      'padding:6px 10px;font-weight:600;width:100%';
    btn.addEventListener('click', () => void this.save());
    hud.appendChild(btn);

    const status = document.createElement('div');
    status.id = 'object-status';
    status.style.cssText = 'margin-top:6px;min-height:14px;opacity:0.9';
    hud.appendChild(status);
    this.statusEl = status;

    document.body.appendChild(hud);
    this.hud = hud;
    this.updateCount();
  }

  private updateCount(): void {
    if (this.countEl) {
      this.countEl.textContent = `${this.blocked.size} sub-cells · ${this.fpW}×${this.fpH} tiles`;
    }
  }

  private setStatus(msg: string, ok: boolean): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = ok ? '#8fe388' : '#ff8888';
    }
  }

  // POST the authored sub-cells to the dev plugin, which merges them into
  // src/data/object-shapes.json under this kind. Sorted for a stable diff.
  private async save(): Promise<void> {
    const collision = [...this.blocked]
      .map((k) => k.split(',').map(Number) as [number, number])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const payload = { kind: this.kind, collision };
    this.setStatus('Saving…', true);
    try {
      const res = await fetch('/__object-shape/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.setStatus(`Save failed (${res.status})`, false);
        return;
      }
      const body = (await res.json()) as { path?: string };
      this.setStatus(`Saved ${this.kind} → ${body.path ?? 'object-shapes.json'} (${collision.length} sub-cells)`, true);
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
    this.backdrop.destroy();
    if (this.sprite) this.sprite.destroy();
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
  }
}

// Resolve the `?kind=` param to a valid kind id, defaulting to the first
// collision-bearing (non-passable, visible) kind so the editor opens on
// something useful even with no kind specified.
export function resolveEditorKind(raw: string | null | undefined): ObjectKindId {
  if (raw && hasObjectKind(raw)) return raw as ObjectKindId;
  const firstBlocking = selectableKinds().find((id) => !OBJECT_KINDS[id].passable);
  return firstBlocking ?? selectableKinds()[0];
}
