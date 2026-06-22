import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import type { TerrainId } from '../maps/terrain';
import type { AreaDefinition, TriggerDefinition } from '../data/areas/types';
import { getArea, getAllAreaIds } from '../data/areas/registry';
import { getAuthoredTriggers } from '../data/areas/authored-triggers';
import {
  CONDITION_OPS,
  TRIGGER_TYPES,
  fromTriggerDefinition,
  toTriggerDefinition,
  emptyTriggerForm,
  type TriggerFormModel,
  type ConditionOp,
} from './triggerModel';

// Editor P3 (#187, U4-U6) — the Triggers authoring tab's in-editor system. The
// non-coder draws a trigger zone on the area map, fills a structured form
// (type, the line/scene it fires, the flag condition that gates it, the flags it
// sets), and Saves → POST /__trigger/save → the committed sidecar the registry
// spreads onto the area (Decision A-a). It mirrors the Collision/Shadow tabs'
// shape: a real Phaser scene for the spatial view + an HTML HUD in the side panel,
// and it does the form↔TriggerDefinition translation through triggerModel.ts so a
// trigger authored here evaluates byte-identically to a hand-written one.
//
// Authored triggers are EDITABLE; the area's inline (TypeScript-file) triggers are
// drawn for context as read-only ghosts so a new zone never collides with one
// (the runtime keys one-shot bookkeeping on `_trigger_fired_<id>`).

const BACKDROP_DEPTH = 58;
const GRID_DEPTH = 59;
const ZONE_DEPTH = 60;
const OVERLAY_DEPTH = 61;
const FIT_PAD = 24; // screen px margin around the fitted map

// Representative ground colours — spatial context only (not the shipped Wang art).
// Impassable terrains read darker/cooler so barriers are legible at a glance.
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

const TYPE_COLOR: Record<string, number> = {
  dialogue: 0x4ea3ff,
  story: 0xc97a3a,
  thought: 0xc9c24e,
  exit: 0x8a4ec9,
};

interface DragState {
  kind: 'draw' | 'move';
  startCol: number;
  startRow: number;
  originCol: number;
  originRow: number;
}

export class TriggerEditorSystem {
  private backdrop: Phaser.GameObjects.Rectangle;
  private gridGfx: Phaser.GameObjects.Graphics;
  private zoneGfx: Phaser.GameObjects.Graphics;
  private overlayGfx: Phaser.GameObjects.Graphics;

  private area: AreaDefinition | undefined;
  private cols = 0;
  private rows = 0;

  // Editable authored set + the inline (read-only) ghosts for context.
  private authored: TriggerDefinition[] = [];
  private inline: TriggerDefinition[] = [];

  private selected = -1; // index into `authored`, or -1
  private form: TriggerFormModel | null = null;

  // Tile→screen mapping.
  private tilePx = TILE_SIZE;
  private originX = 0;
  private originY = 0;

  private drag: DragState | null = null;
  private hoverTile: { col: number; row: number } | null = null;

  private hud: HTMLDivElement | null = null;
  private listEl: HTMLDivElement | null = null;
  private formEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;

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
    this.zoneGfx = this.scene.add.graphics().setDepth(ZONE_DEPTH);
    this.overlayGfx = this.scene.add.graphics().setDepth(OVERLAY_DEPTH);

    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) uiCam.ignore([this.backdrop, this.gridGfx, this.zoneGfx, this.overlayGfx]);

    this.loadArea();
    this.setupMapping(viewW, viewH);
    this.setupInput();
    this.buildHud();
    this.redraw();
  }

  private loadArea(): void {
    this.area = getArea(this.areaId);
    const all = this.area?.triggers ?? [];
    this.authored = getAuthoredTriggers(this.areaId).map((t) => ({ ...t }));
    const authoredIds = new Set(this.authored.map((t) => t.id));
    // getArea returns the MERGED area; the inline ghosts are everything the
    // registry didn't add from the sidecar.
    this.inline = all.filter((t) => !authoredIds.has(t.id));
    // Canonical area dimensions — same source the CollisionEditor uses
    // (collisionEditor.ts). mapCols/mapRows are the tile counts; the vertex
    // grid is (rows+1)×(cols+1), so these equal terrain[0].length-1 /
    // terrain.length-1 but read straight from the model instead of re-deriving.
    this.cols = this.area?.mapCols ?? 0;
    this.rows = this.area?.mapRows ?? 0;
    this.selected = this.authored.length > 0 ? 0 : -1;
    this.form = this.selected >= 0 ? fromTriggerDefinition(this.authored[0]).form : null;
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

  private screenToTile(px: number, py: number): { col: number; row: number } {
    const col = Math.floor((px - this.originX) / this.tilePx);
    const row = Math.floor((py - this.originY) / this.tilePx);
    return {
      col: Math.max(0, Math.min(this.cols - 1, col)),
      row: Math.max(0, Math.min(this.rows - 1, row)),
    };
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
  }

  private zoneContains(t: TriggerDefinition, col: number, row: number): boolean {
    return col >= t.col && col < t.col + t.width && row >= t.row && row < t.row + t.height;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.cols === 0) return;
    const { col, row } = this.screenToTile(pointer.x, pointer.y);

    // Inside the selected zone → move it. Inside another authored zone → select.
    if (this.selected >= 0 && this.zoneContains(this.authored[this.selected], col, row)) {
      const z = this.authored[this.selected];
      this.drag = { kind: 'move', startCol: col, startRow: row, originCol: z.col, originRow: z.row };
      return;
    }
    const hit = this.authored.findIndex((t) => this.zoneContains(t, col, row));
    if (hit >= 0) {
      this.select(hit);
      return;
    }
    // Empty ground → rubber-band a new zone.
    this.drag = { kind: 'draw', startCol: col, startRow: row, originCol: col, originRow: row };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.cols === 0) return;
    this.hoverTile = this.screenToTile(pointer.x, pointer.y);
    if (!this.drag) {
      this.redraw();
      return;
    }
    if (this.drag.kind === 'move' && this.selected >= 0 && this.form) {
      const z = this.authored[this.selected];
      const dCol = this.hoverTile.col - this.drag.startCol;
      const dRow = this.hoverTile.row - this.drag.startRow;
      z.col = Math.max(0, Math.min(this.cols - z.width, this.drag.originCol + dCol));
      z.row = Math.max(0, Math.min(this.rows - z.height, this.drag.originRow + dRow));
      this.form.col = z.col;
      this.form.row = z.row;
      this.syncFormInputs();
    }
    this.redraw();
  }

  private onPointerUp(): void {
    if (this.drag?.kind === 'draw' && this.hoverTile) {
      const c0 = Math.min(this.drag.startCol, this.hoverTile.col);
      const r0 = Math.min(this.drag.startRow, this.hoverTile.row);
      const c1 = Math.max(this.drag.startCol, this.hoverTile.col);
      const r1 = Math.max(this.drag.startRow, this.hoverTile.row);
      const def = toTriggerDefinition(
        emptyTriggerForm(this.nextId(), c0, r0, c1 - c0 + 1, r1 - r0 + 1),
      );
      this.authored.push(def);
      this.select(this.authored.length - 1);
    }
    this.drag = null;
    this.redraw();
  }

  private nextId(): string {
    const taken = new Set([...this.inline, ...this.authored].map((t) => t.id));
    let n = 1;
    while (taken.has(`${this.areaId}-t${n}`)) n++;
    return `${this.areaId}-t${n}`;
  }

  private select(index: number): void {
    this.selected = index;
    this.form = index >= 0 ? fromTriggerDefinition(this.authored[index]).form : null;
    this.renderList();
    this.renderForm();
    this.redraw();
  }

  // ---- drawing --------------------------------------------------------------

  private redraw(): void {
    this.drawGrid();
    this.drawZones();
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

  private drawZones(): void {
    const g = this.zoneGfx;
    g.clear();
    // Inline ghosts — read-only context.
    for (const t of this.inline) {
      this.strokeZone(g, t, 0x888888, 0.12, 0.6, true);
    }
    // Authored zones, coloured by type; selected one brighter + filled.
    this.authored.forEach((t, i) => {
      const color = TYPE_COLOR[t.type] ?? 0xffffff;
      const isSel = i === this.selected;
      this.strokeZone(g, t, color, isSel ? 0.28 : 0.14, isSel ? 1 : 0.8, false);
    });
  }

  private strokeZone(
    g: Phaser.GameObjects.Graphics,
    t: TriggerDefinition,
    color: number,
    fillAlpha: number,
    lineAlpha: number,
    dashed: boolean,
  ): void {
    const { x, y } = this.tileToScreen(t.col, t.row);
    const w = t.width * this.tilePx;
    const h = t.height * this.tilePx;
    g.fillStyle(color, fillAlpha);
    g.fillRect(x, y, w, h);
    g.lineStyle(dashed ? 1 : 2, color, lineAlpha);
    g.strokeRect(x, y, w, h);
  }

  private drawOverlay(): void {
    const g = this.overlayGfx;
    g.clear();
    // In-progress draw rectangle.
    if (this.drag?.kind === 'draw' && this.hoverTile) {
      const c0 = Math.min(this.drag.startCol, this.hoverTile.col);
      const r0 = Math.min(this.drag.startRow, this.hoverTile.row);
      const c1 = Math.max(this.drag.startCol, this.hoverTile.col);
      const r1 = Math.max(this.drag.startRow, this.hoverTile.row);
      const { x, y } = this.tileToScreen(c0, r0);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRect(x, y, (c1 - c0 + 1) * this.tilePx, (r1 - r0 + 1) * this.tilePx);
    }
    // Hover cell.
    if (this.hoverTile && !this.drag) {
      const { x, y } = this.tileToScreen(this.hoverTile.col, this.hoverTile.row);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeRect(x, y, this.tilePx, this.tilePx);
    }
  }

  // ---- HUD ------------------------------------------------------------------

  private buildHud(): void {
    const hud = document.createElement('div');
    hud.id = 'trigger-editor-hud';
    const embedded = !!this.opts?.hudParent;
    hud.style.cssText =
      (embedded ? 'position:static;' : 'position:fixed;top:10px;left:10px;z-index:9999;') +
      'font:12px/1.4 system-ui,sans-serif;background:rgba(20,16,30,0.94);color:#eee;' +
      'padding:10px 12px;border-radius:6px;max-width:300px;max-height:92vh;overflow:auto;' +
      'box-shadow:0 2px 10px rgba(0,0,0,0.5);';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:6px';
    title.textContent = 'Trigger editor';
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
      'Drag on empty ground to draw a zone. Click a zone to edit; drag inside it to move.<br>' +
      'Grey ghosts are inline (code) triggers — read-only context.';
    hud.appendChild(help);

    const list = document.createElement('div');
    list.style.cssText = 'margin-bottom:8px';
    hud.appendChild(list);
    this.listEl = list;

    const form = document.createElement('div');
    hud.appendChild(form);
    this.formEl = form;

    const status = document.createElement('div');
    status.style.cssText = 'margin-top:8px;min-height:14px;opacity:0.95';
    hud.appendChild(status);
    this.statusEl = status;

    (this.opts?.hudParent ?? document.body).appendChild(hud);
    this.hud = hud;
    this.renderList();
    this.renderForm();
  }

  private renderList(): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    const label = document.createElement('div');
    label.style.cssText = 'font-weight:600;margin-bottom:4px';
    label.textContent = `Authored triggers (${this.authored.length})`;
    this.listEl.appendChild(label);
    this.authored.forEach((t, i) => {
      const b = document.createElement('button');
      b.textContent = `${t.type}: ${t.id}`;
      b.style.cssText =
        'display:block;width:100%;text-align:left;cursor:pointer;border:0;border-radius:4px;' +
        'margin-bottom:3px;padding:4px 7px;font-size:11px;' +
        (i === this.selected ? 'background:#c97a3a;color:#fff;font-weight:600' : 'background:#3a3550;color:#ddd');
      b.addEventListener('click', () => this.select(i));
      this.listEl!.appendChild(b);
    });
  }

  private field(label: string, control: HTMLElement): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:6px';
    const l = document.createElement('label');
    l.textContent = label;
    l.style.cssText = 'display:block;font-size:11px;opacity:0.85;margin-bottom:2px';
    row.appendChild(l);
    row.appendChild(control);
    return row;
  }

  private input(value: string, onChange: (v: string) => void): HTMLInputElement {
    const el = document.createElement('input');
    el.value = value;
    el.style.cssText = 'width:100%;padding:3px;box-sizing:border-box';
    el.addEventListener('input', () => onChange(el.value));
    return el;
  }

  private renderForm(): void {
    if (!this.formEl) return;
    this.formEl.innerHTML = '';
    if (!this.form || this.selected < 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'opacity:0.7;font-style:italic';
      empty.textContent = 'Draw a zone to create a trigger.';
      this.formEl.appendChild(empty);
      return;
    }
    const f = this.form;

    // id
    this.formEl.appendChild(this.field('Trigger id', this.input(f.id, (v) => { f.id = v; })));

    // type
    const typeSel = document.createElement('select');
    typeSel.style.cssText = 'width:100%;padding:3px';
    for (const ty of TRIGGER_TYPES) {
      const o = document.createElement('option');
      o.value = ty;
      o.textContent = ty;
      if (ty === f.type) o.selected = true;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener('change', () => { f.type = typeSel.value as typeof f.type; this.redraw(); });
    this.formEl.appendChild(this.field('Type', typeSel));

    // actionRef
    const action = document.createElement('textarea');
    action.value = f.actionRef;
    action.rows = 2;
    action.style.cssText = 'width:100%;padding:3px;box-sizing:border-box;resize:vertical';
    action.placeholder = 'dialogue/story id, or the thought/exit text';
    action.addEventListener('input', () => { f.actionRef = action.value; });
    this.formEl.appendChild(this.field('Action ref / text', action));

    // zone coords
    const coordWrap = document.createElement('div');
    coordWrap.style.cssText = 'display:flex;gap:4px';
    const mk = (k: 'col' | 'row' | 'width' | 'height', min: number) => {
      const el = document.createElement('input');
      el.type = 'number';
      el.min = String(min);
      el.value = String(f[k]);
      el.title = k;
      el.style.cssText = 'width:25%;padding:3px;box-sizing:border-box';
      el.addEventListener('input', () => {
        const n = Math.max(min, Math.floor(Number(el.value) || min));
        f[k] = n;
        if (this.selected >= 0) {
          this.authored[this.selected].col = f.col;
          this.authored[this.selected].row = f.row;
          this.authored[this.selected].width = f.width;
          this.authored[this.selected].height = f.height;
        }
        this.redraw();
      });
      return el;
    };
    coordWrap.appendChild(mk('col', 0));
    coordWrap.appendChild(mk('row', 0));
    coordWrap.appendChild(mk('width', 1));
    coordWrap.appendChild(mk('height', 1));
    this.formEl.appendChild(this.field('Zone (col / row / w / h)', coordWrap));

    // condition clauses
    this.formEl.appendChild(this.clauseBlock(f));

    // setFlags
    this.formEl.appendChild(this.setFlagsBlock(f));

    // incrementFlags
    this.formEl.appendChild(
      this.field(
        'Increment flags (comma-sep)',
        this.input(f.incrementFlags.join(', '), (v) => {
          f.incrementFlags = v.split(',').map((s) => s.trim()).filter((s) => s !== '');
        }),
      ),
    );

    // repeatable
    const repWrap = document.createElement('label');
    repWrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;cursor:pointer';
    const rep = document.createElement('input');
    rep.type = 'checkbox';
    rep.checked = f.repeatable;
    rep.addEventListener('change', () => { f.repeatable = rep.checked; });
    repWrap.appendChild(rep);
    repWrap.appendChild(document.createTextNode('Repeatable (fires every entry)'));
    this.formEl.appendChild(repWrap);

    // actions
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save triggers';
    saveBtn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#c97a3a;color:#fff;padding:6px 10px;font-weight:600;width:100%';
    saveBtn.addEventListener('click', () => void this.save());
    this.formEl.appendChild(saveBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete this trigger';
    delBtn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#5a4a6a;color:#fff;padding:5px 10px;margin-top:5px;width:100%';
    delBtn.addEventListener('click', () => this.deleteSelected());
    this.formEl.appendChild(delBtn);
  }

  private clauseBlock(f: TriggerFormModel): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px';
    const l = document.createElement('label');
    l.textContent = 'Condition (all must hold)';
    l.style.cssText = 'display:block;font-size:11px;opacity:0.85;margin-bottom:2px';
    wrap.appendChild(l);
    f.clauses.forEach((clause, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:3px;margin-bottom:3px';
      const flag = document.createElement('input');
      flag.value = clause.flag;
      flag.placeholder = 'flag';
      flag.style.cssText = 'flex:2;min-width:0;padding:3px';
      flag.addEventListener('input', () => { clause.flag = flag.value; });
      const op = document.createElement('select');
      op.style.cssText = 'flex:1;min-width:0;padding:3px';
      for (const o of CONDITION_OPS) {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        if (o === clause.op) opt.selected = true;
        op.appendChild(opt);
      }
      op.addEventListener('change', () => { clause.op = op.value as ConditionOp; });
      const val = document.createElement('input');
      val.value = clause.value;
      val.placeholder = 'value';
      val.style.cssText = 'flex:2;min-width:0;padding:3px';
      val.addEventListener('input', () => { clause.value = val.value; });
      const rm = document.createElement('button');
      rm.textContent = '×';
      rm.style.cssText = 'cursor:pointer;border:0;border-radius:4px;background:#5a4a6a;color:#fff;padding:0 7px';
      rm.addEventListener('click', () => { f.clauses.splice(i, 1); this.renderForm(); });
      row.append(flag, op, val, rm);
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.textContent = '+ clause';
    add.style.cssText = 'cursor:pointer;border:0;border-radius:4px;background:#3a3550;color:#ddd;padding:3px 8px;font-size:11px';
    add.addEventListener('click', () => { f.clauses.push({ flag: '', op: '==', value: 'true' }); this.renderForm(); });
    wrap.appendChild(add);
    return wrap;
  }

  private setFlagsBlock(f: TriggerFormModel): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px';
    const l = document.createElement('label');
    l.textContent = 'Set flags on fire';
    l.style.cssText = 'display:block;font-size:11px;opacity:0.85;margin-bottom:2px';
    wrap.appendChild(l);
    f.setFlags.forEach((entry, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:3px;margin-bottom:3px';
      const name = document.createElement('input');
      name.value = entry.name;
      name.placeholder = 'flag';
      name.style.cssText = 'flex:2;min-width:0;padding:3px';
      name.addEventListener('input', () => { entry.name = name.value; });
      const val = document.createElement('input');
      val.value = entry.value;
      val.placeholder = 'true / number / text';
      val.style.cssText = 'flex:2;min-width:0;padding:3px';
      val.addEventListener('input', () => { entry.value = val.value; });
      const rm = document.createElement('button');
      rm.textContent = '×';
      rm.style.cssText = 'cursor:pointer;border:0;border-radius:4px;background:#5a4a6a;color:#fff;padding:0 7px';
      rm.addEventListener('click', () => { f.setFlags.splice(i, 1); this.renderForm(); });
      row.append(name, val, rm);
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.textContent = '+ flag';
    add.style.cssText = 'cursor:pointer;border:0;border-radius:4px;background:#3a3550;color:#ddd;padding:3px 8px;font-size:11px';
    add.addEventListener('click', () => { f.setFlags.push({ name: '', value: 'true' }); this.renderForm(); });
    wrap.appendChild(add);
    return wrap;
  }

  // Push live col/row back into the number inputs after a drag-move (cheap: just
  // re-render the form so the coord inputs reflect the new position).
  private syncFormInputs(): void {
    this.renderForm();
  }

  private deleteSelected(): void {
    if (this.selected < 0) return;
    this.authored.splice(this.selected, 1);
    this.selected = this.authored.length > 0 ? 0 : -1;
    this.form = this.selected >= 0 ? fromTriggerDefinition(this.authored[0]).form : null;
    this.renderList();
    this.renderForm();
    this.redraw();
    this.setStatus('Removed (not yet saved — Save to persist).', true);
  }

  private setStatus(msg: string, ok: boolean): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = ok ? '#8fe388' : '#ff8888';
    }
  }

  private async save(): Promise<void> {
    // Compile the live form into the selected entry first.
    if (this.selected >= 0 && this.form) {
      const id = this.form.id.trim();
      if (!/^[A-Za-z0-9_-]+$/.test(id)) {
        this.setStatus('Invalid id — use letters, digits, _ or -.', false);
        return;
      }
      const clashesInline = this.inline.some((t) => t.id === id);
      const clashesAuthored = this.authored.some((t, i) => i !== this.selected && t.id === id);
      if (clashesInline || clashesAuthored) {
        this.setStatus(`Duplicate id "${id}".`, false);
        return;
      }
      this.authored[this.selected] = toTriggerDefinition(this.form);
    }
    this.setStatus('Saving…', true);
    try {
      const res = await fetch('/__trigger/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId: this.areaId, triggers: this.authored }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        this.setStatus(`Save failed (${res.status}): ${body.error ?? ''}`, false);
        return;
      }
      const body = (await res.json()) as { path?: string; count?: number };
      this.renderList();
      this.setStatus(`Saved ${body.count ?? this.authored.length} trigger(s) → ${body.path ?? ''}`, true);
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
    this.zoneGfx.destroy();
    this.overlayGfx.destroy();
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
  }
}

// Resolve a `?area=` against the area family, defaulting to the first.
export function resolveTriggerAreaId(raw: string | null | undefined): string {
  const all = getAllAreaIds();
  if (raw && all.includes(raw)) return raw;
  return all[0];
}
