import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { OBJECT_KINDS, ObjectKindId, hasObjectKind } from '../maps/objects';
import {
  ShadowShape,
  defaultEntityShadow,
} from '../maps/shadows';
import {
  getCharacterKindIds,
  getCharacterShadow,
  characterTextureKey,
  characterTextureFrame,
  isCharacterKind,
  PLAYER_CHARACTER_ID,
} from '../maps/characters';

// #FB-23 shadow shape editor. Mounted by the standalone editor app's Shadow tab,
// which supplies the target (object | character) and kind (the in-game `?editor=`
// boot was removed in #184).
// Shadows are VISIBLE (Jaco's direction 2026-06-21), so unlike collision they get
// a real shape tool: drop a CIRCLE / OVAL / RECTANGLE, drag it to position, drag a
// handle to size it, Save. The result is the per-kind `shadow` ({shape,w,h,dx,dy,
// alpha}) read by GameScene wherever the kind appears — for an OBJECT it overrides
// the FB-21 heuristic; for a CHARACTER (Pip / an NPC sprite kind) it overrides the
// feet-ellipse default and tracks the entity as it walks.
//
// Two families, one editor:
//   - target=object    → kind is an ObjectKindId; ref point = the anchor cell's
//     top-left; scale = cellPx/TILE; saves to object-shapes.json.
//   - target=character → kind is 'pip' or an NPC sprite id; ref point = the sprite
//     CENTRE; scale = the sprite's fit scale; saves to character-shapes.json.
// Both express dx,dy as the shape CENTRE offset from the ref point IN WORLD PX, so
// what you author is exactly what the renderer draws (shared resolveShadow math).

export type ShadowTarget = 'object' | 'character';

const BACKDROP_DEPTH = 58;
const SPRITE_DEPTH = 59;
const SHADOW_FILL_DEPTH = 59.5; // the real black shadow preview, under the sprite-edit overlay
const OVERLAY_DEPTH = 60;
const FIT_BOX = 420; // target on-screen px for the sprite's longest side
const HANDLE_PX = 11; // half-size of a drag handle hit box (screen px)
const OUTLINE_COLOR = 0x66ccff;
const HANDLE_COLOR = 0xffffff;
const REF_COLOR = 0xffcc44;

type Mode = 'circle' | 'oval' | 'rect';

function shadowToMode(s: ShadowShape): Mode {
  if (s.shape === 'rect') return 'rect';
  return Math.abs(s.w - s.h) < 0.5 ? 'circle' : 'oval';
}

export class ShadowEditorSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private shadowGfx: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image | null = null;
  private backdrop: Phaser.GameObjects.Rectangle;

  // Authored shape state, in WORLD px relative to the ref point.
  private shape: ShadowShape;
  private mode: Mode;

  // Screen-space mapping.
  private pxPerWorld = 1;
  private refScreenX = 0;
  private refScreenY = 0;

  // Drag state.
  private dragging: 'move' | 'east' | 'south' | null = null;
  private dragStart = { px: 0, py: 0, dx: 0, dy: 0, w: 0, h: 0 };

  private saveKey: Phaser.Input.Keyboard.Key | null = null;

  private hud: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private readoutEl: HTMLDivElement | null = null;

  constructor(
    private scene: Phaser.Scene,
    private readonly target: ShadowTarget,
    private readonly kind: string,
    // Editor-app hosting (#182): `hudParent` flows the HUD inside that container
    // (static, not the fixed full-screen overlay used in-game); `onSwitch` makes
    // target/kind controls call back (the editor app tears down + remounts) instead
    // of a URL reload. Both absent → original in-game behaviour, byte-for-byte.
    private readonly opts?: {
      hudParent?: HTMLElement;
      onSwitch?: (next: { target: ShadowTarget; kind: string }) => void;
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

    // Resolve the sprite + the world→screen mapping per family.
    const textureKey = this.resolveTextureKey();
    if (textureKey && this.scene.textures.exists(textureKey)) {
      // Characters are packed sheets — show the idle-south frame; objects are
      // single-frame textures (frame undefined → default __BASE).
      const frame = this.target === 'object' ? undefined : characterTextureFrame(this.kind);
      this.sprite = this.scene.add.image(0, 0, textureKey, frame).setDepth(SPRITE_DEPTH);
    }

    if (this.target === 'object') {
      this.setupObjectMapping(viewW, viewH);
    } else {
      this.setupCharacterMapping(viewW, viewH);
    }

    this.shape = this.seedShape();
    this.mode = shadowToMode(this.shape);

    this.shadowGfx = this.scene.add.graphics().setDepth(SHADOW_FILL_DEPTH);
    this.graphics = this.scene.add.graphics().setDepth(OVERLAY_DEPTH);
    const uiCam = this.scene.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.ignore(this.graphics);
      uiCam.ignore(this.shadowGfx);
      uiCam.ignore(this.backdrop);
      if (this.sprite) uiCam.ignore(this.sprite);
    }

    this.setupInput();
    this.buildHud();
    this.redraw();
  }

  private resolveTextureKey(): string | null {
    if (this.target === 'object') {
      const def = OBJECT_KINDS[this.kind as ObjectKindId];
      return def ? def.atlasKey : null;
    }
    return characterTextureKey(this.kind);
  }

  // OBJECT: ref = anchor cell top-left (the sprite's top-left). Fit the footprint
  // sprite to FIT_BOX; 1 game cell = cellPx screen px → pxPerWorld = cellPx/TILE.
  private setupObjectMapping(viewW: number, viewH: number): void {
    const def = OBJECT_KINDS[this.kind as ObjectKindId];
    const fp = def?.footprint ?? { w: 1, h: 1 };
    const cellPx = Math.max(8, Math.floor(FIT_BOX / Math.max(fp.w, fp.h)));
    const spriteW = fp.w * cellPx;
    const spriteH = fp.h * cellPx;
    this.pxPerWorld = cellPx / TILE_SIZE;
    const originX = Math.round((viewW - spriteW) / 2);
    const originY = Math.round((viewH - spriteH) / 2);
    this.refScreenX = originX;
    this.refScreenY = originY;
    if (this.sprite) {
      this.sprite.setOrigin(0, 0).setPosition(originX, originY).setDisplaySize(spriteW, spriteH);
    }
  }

  // CHARACTER: ref = sprite CENTRE. The in-game sprite renders at native px
  // (scale 1), so 1 world px = 1 native px; fit the native frame to FIT_BOX →
  // pxPerWorld = fitScale, centred on screen.
  private setupCharacterMapping(viewW: number, viewH: number): void {
    const nativeW = this.sprite ? this.sprite.width : 64;
    const nativeH = this.sprite ? this.sprite.height : 64;
    const fit = FIT_BOX / Math.max(nativeW, nativeH);
    this.pxPerWorld = fit;
    const cx = Math.round(viewW / 2);
    const cy = Math.round(viewH / 2);
    this.refScreenX = cx;
    this.refScreenY = cy;
    if (this.sprite) {
      this.sprite.setOrigin(0.5, 0.5).setPosition(cx, cy).setDisplaySize(nativeW * fit, nativeH * fit);
    }
  }

  // Seed from the kind's CURRENT authored shadow; else a sensible starting shape
  // so Jaco adjusts a real shadow rather than drawing from nothing.
  private seedShape(): ShadowShape {
    if (this.target === 'object') {
      const def = OBJECT_KINDS[this.kind as ObjectKindId];
      if (def?.shadow) return { ...def.shadow };
      const fp = def?.footprint ?? { w: 1, h: 1 };
      const w = fp.w * TILE_SIZE * 0.5;
      return {
        shape: 'ellipse',
        w,
        h: w * 0.4,
        dx: (fp.w * TILE_SIZE) / 2, // footprint centre x
        dy: fp.h * TILE_SIZE - TILE_SIZE * 0.2, // near the footprint bottom
        alpha: 0.26,
      };
    }
    const authored = getCharacterShadow(this.kind);
    if (authored) return { ...authored };
    // Match the FB-21 feet-ellipse default seed (width ≈ 0.82× body, dropped to feet).
    const footOffset = this.kind === PLAYER_CHARACTER_ID ? 22 : 20;
    return defaultEntityShadow(24 * 0.82, footOffset, 0.22);
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    const kb = this.scene.input.keyboard;
    if (kb) this.saveKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }

  // Screen coords of the shape centre + handle positions.
  private centreScreen(): { x: number; y: number } {
    return {
      x: this.refScreenX + this.shape.dx * this.pxPerWorld,
      y: this.refScreenY + this.shape.dy * this.pxPerWorld,
    };
  }
  private eastHandle(): { x: number; y: number } {
    const c = this.centreScreen();
    return { x: c.x + (this.shape.w / 2) * this.pxPerWorld, y: c.y };
  }
  private southHandle(): { x: number; y: number } {
    const c = this.centreScreen();
    return { x: c.x, y: c.y + (this.shape.h / 2) * this.pxPerWorld };
  }

  private near(px: number, py: number, h: { x: number; y: number }): boolean {
    return Math.abs(px - h.x) <= HANDLE_PX && Math.abs(py - h.y) <= HANDLE_PX;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const { x, y } = pointer;
    if (this.near(x, y, this.eastHandle())) this.dragging = 'east';
    else if (this.near(x, y, this.southHandle())) this.dragging = 'south';
    else if (this.insideShape(x, y)) this.dragging = 'move';
    else this.dragging = null;
    if (this.dragging) {
      this.dragStart = {
        px: x,
        py: y,
        dx: this.shape.dx,
        dy: this.shape.dy,
        w: this.shape.w,
        h: this.shape.h,
      };
    }
  }

  private insideShape(px: number, py: number): boolean {
    const c = this.centreScreen();
    const hw = (this.shape.w / 2) * this.pxPerWorld;
    const hh = (this.shape.h / 2) * this.pxPerWorld;
    if (hw <= 0 || hh <= 0) return false;
    if (this.mode === 'rect') {
      return Math.abs(px - c.x) <= hw && Math.abs(py - c.y) <= hh;
    }
    const nx = (px - c.x) / hw;
    const ny = (py - c.y) / hh;
    return nx * nx + ny * ny <= 1;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const dpx = (pointer.x - this.dragStart.px) / this.pxPerWorld;
    const dpy = (pointer.y - this.dragStart.py) / this.pxPerWorld;
    if (this.dragging === 'move') {
      this.shape.dx = Math.round(this.dragStart.dx + dpx);
      this.shape.dy = Math.round(this.dragStart.dy + dpy);
    } else if (this.dragging === 'east') {
      const w = Math.max(2, Math.round((this.dragStart.w + dpx * 2) * 10) / 10);
      this.shape.w = w;
      if (this.mode === 'circle') this.shape.h = w;
    } else if (this.dragging === 'south') {
      const h = Math.max(2, Math.round((this.dragStart.h + dpy * 2) * 10) / 10);
      this.shape.h = h;
      if (this.mode === 'circle') this.shape.w = h;
    }
    this.updateReadout();
    this.redraw();
  }

  private onPointerUp(): void {
    this.dragging = null;
  }

  update(): void {
    if (this.saveKey && Phaser.Input.Keyboard.JustDown(this.saveKey)) void this.save();
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.shape.shape = mode === 'rect' ? 'rect' : 'ellipse';
    if (mode === 'circle') {
      const d = Math.max(this.shape.w, this.shape.h);
      this.shape.w = d;
      this.shape.h = d;
    }
    this.updateReadout();
    this.redraw();
  }

  private redraw(): void {
    const c = this.centreScreen();
    const hw = (this.shape.w / 2) * this.pxPerWorld;
    const hh = (this.shape.h / 2) * this.pxPerWorld;

    // Real black shadow preview at its authored alpha — what actually ships.
    const sg = this.shadowGfx;
    sg.clear();
    sg.fillStyle(0x000000, this.shape.alpha);
    if (this.shape.shape === 'rect') sg.fillRect(c.x - hw, c.y - hh, hw * 2, hh * 2);
    else sg.fillEllipse(c.x, c.y, hw * 2, hh * 2);

    // Editing overlay: outline, handles, ref crosshair.
    const g = this.graphics;
    g.clear();
    g.lineStyle(2, OUTLINE_COLOR, 0.95);
    if (this.shape.shape === 'rect') g.strokeRect(c.x - hw, c.y - hh, hw * 2, hh * 2);
    else g.strokeEllipse(c.x, c.y, hw * 2, hh * 2);

    // Reference-point crosshair (anchor top-left for objects, sprite centre for
    // characters) + a faint line to the shape centre so the offset is legible.
    g.lineStyle(1, REF_COLOR, 0.9);
    g.lineBetween(this.refScreenX - 8, this.refScreenY, this.refScreenX + 8, this.refScreenY);
    g.lineBetween(this.refScreenX, this.refScreenY - 8, this.refScreenX, this.refScreenY + 8);
    g.lineStyle(1, REF_COLOR, 0.4);
    g.lineBetween(this.refScreenX, this.refScreenY, c.x, c.y);

    // Handles.
    g.fillStyle(HANDLE_COLOR, 1);
    for (const h of [this.eastHandle(), this.southHandle()]) {
      g.fillRect(h.x - 5, h.y - 5, 10, 10);
    }
  }

  private buildHud(): void {
    const hud = document.createElement('div');
    hud.id = 'shadow-editor-hud';
    const embedded = !!this.opts?.hudParent;
    hud.style.cssText =
      (embedded ? 'position:static;' : 'position:fixed;top:10px;left:10px;z-index:9999;') +
      'font:12px/1.4 system-ui,sans-serif;' +
      'background:rgba(20,16,30,0.92);color:#eee;padding:10px 12px;border-radius:6px;' +
      'max-width:280px;box-shadow:0 2px 10px rgba(0,0,0,0.5);';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;margin-bottom:6px';
    title.textContent = `Shadow editor — ${this.target}`;
    hud.appendChild(title);

    // Kind selector — switching reboots with the new kind.
    const select = document.createElement('select');
    select.id = 'shadow-kind-select';
    select.style.cssText = 'width:100%;margin-bottom:6px;padding:3px';
    for (const id of this.selectableKinds()) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      if (id === this.kind) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => this.reboot({ kind: select.value }));
    hud.appendChild(select);

    // Target toggle (object ⇄ character) — reboots into the other family.
    const targetRow = document.createElement('div');
    targetRow.style.cssText = 'margin-bottom:6px';
    for (const t of ['object', 'character'] as ShadowTarget[]) {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText =
        'cursor:pointer;border:0;border-radius:4px;margin-right:4px;padding:3px 8px;' +
        (t === this.target ? 'background:#c97a3a;color:#fff;font-weight:600' : 'background:#3a3550;color:#ddd');
      b.addEventListener('click', () => {
        if (t !== this.target) this.reboot({ target: t, kind: '' });
      });
      targetRow.appendChild(b);
    }
    hud.appendChild(targetRow);

    // Shape mode: circle / oval / rect.
    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'margin-bottom:6px';
    for (const m of ['circle', 'oval', 'rect'] as Mode[]) {
      const b = document.createElement('button');
      b.id = `shadow-mode-${m}`;
      b.textContent = m;
      b.style.cssText =
        'cursor:pointer;border:0;border-radius:4px;margin-right:4px;padding:3px 8px;' +
        (m === this.mode ? 'background:#5a86c9;color:#fff;font-weight:600' : 'background:#3a3550;color:#ddd');
      b.addEventListener('click', () => {
        this.setMode(m);
        for (const mm of ['circle', 'oval', 'rect'] as Mode[]) {
          const el = document.getElementById(`shadow-mode-${mm}`);
          if (el)
            el.style.cssText =
              'cursor:pointer;border:0;border-radius:4px;margin-right:4px;padding:3px 8px;' +
              (mm === this.mode
                ? 'background:#5a86c9;color:#fff;font-weight:600'
                : 'background:#3a3550;color:#ddd');
        }
      });
      modeRow.appendChild(b);
    }
    hud.appendChild(modeRow);

    // Alpha slider.
    const alphaRow = document.createElement('div');
    alphaRow.style.cssText = 'margin-bottom:6px;display:flex;align-items:center;gap:6px';
    const alphaLabel = document.createElement('span');
    alphaLabel.textContent = 'alpha';
    const alpha = document.createElement('input');
    alpha.type = 'range';
    alpha.min = '0';
    alpha.max = '0.6';
    alpha.step = '0.01';
    alpha.value = String(this.shape.alpha);
    alpha.style.flex = '1';
    alpha.addEventListener('input', () => {
      this.shape.alpha = Number(alpha.value);
      this.updateReadout();
      this.redraw();
    });
    alphaRow.appendChild(alphaLabel);
    alphaRow.appendChild(alpha);
    hud.appendChild(alphaRow);

    const help = document.createElement('div');
    help.style.cssText = 'opacity:0.8;margin-bottom:6px';
    help.innerHTML =
      'Drag the shape to position. Drag the white handles to size.<br>' +
      'Yellow cross = ' +
      (this.target === 'object' ? 'anchor cell top-left.' : 'sprite centre.') +
      '<br>Enter or Save: write the shadow.';
    hud.appendChild(help);

    const readout = document.createElement('div');
    readout.id = 'shadow-readout';
    readout.style.cssText = 'margin-bottom:6px;font-weight:600;font-family:monospace;font-size:11px';
    hud.appendChild(readout);
    this.readoutEl = readout;

    const btn = document.createElement('button');
    btn.id = 'shadow-save';
    btn.textContent = 'Save shadow';
    btn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#c97a3a;color:#fff;' +
      'padding:6px 10px;font-weight:600;width:100%';
    btn.addEventListener('click', () => void this.save());
    hud.appendChild(btn);

    const clearBtn = document.createElement('button');
    clearBtn.id = 'shadow-clear';
    clearBtn.textContent = 'Clear authored (revert to default)';
    clearBtn.style.cssText =
      'cursor:pointer;border:0;border-radius:4px;background:#5a4a6a;color:#fff;' +
      'padding:5px 10px;margin-top:5px;width:100%';
    clearBtn.addEventListener('click', () => void this.clearAuthored());
    hud.appendChild(clearBtn);

    const status = document.createElement('div');
    status.id = 'shadow-status';
    status.style.cssText = 'margin-top:6px;min-height:14px;opacity:0.9';
    hud.appendChild(status);
    this.statusEl = status;

    (this.opts?.hudParent ?? document.body).appendChild(hud);
    this.hud = hud;
    this.updateReadout();
  }

  private selectableKinds(): string[] {
    if (this.target === 'object') {
      return (Object.keys(OBJECT_KINDS) as ObjectKindId[]).filter((id) => !OBJECT_KINDS[id].invisible);
    }
    return getCharacterKindIds();
  }

  private reboot(next: { target?: ShadowTarget; kind?: string }): void {
    if (this.opts?.onSwitch) {
      this.opts.onSwitch({ target: next.target ?? this.target, kind: next.kind ?? '' });
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('editor', 'shadow');
    url.searchParams.set('target', next.target ?? this.target);
    if (next.kind) url.searchParams.set('kind', next.kind);
    else url.searchParams.delete('kind');
    window.location.href = url.toString();
  }

  private updateReadout(): void {
    if (!this.readoutEl) return;
    const s = this.shape;
    this.readoutEl.textContent = `${s.shape} w${s.w} h${s.h} dx${s.dx} dy${s.dy} a${s.alpha.toFixed(2)}`;
  }

  private setStatus(msg: string, ok: boolean): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = ok ? '#8fe388' : '#ff8888';
    }
  }

  private endpoint(): string {
    return this.target === 'object' ? '/__object-shape/save' : '/__character-shape/save';
  }

  private async save(): Promise<void> {
    const payload = { kind: this.kind, shadow: { ...this.shape } };
    this.setStatus('Saving…', true);
    try {
      const res = await fetch(this.endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.setStatus(`Save failed (${res.status})`, false);
        return;
      }
      const body = (await res.json()) as { path?: string };
      this.setStatus(`Saved ${this.kind} shadow → ${body.path ?? ''}`, true);
    } catch (err) {
      this.setStatus(`Save error: ${String(err)}`, false);
    }
  }

  private async clearAuthored(): Promise<void> {
    const payload = { kind: this.kind, shadow: null };
    this.setStatus('Clearing…', true);
    try {
      const res = await fetch(this.endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.setStatus(`Clear failed (${res.status})`, false);
        return;
      }
      this.setStatus(`Cleared ${this.kind} — reverts to default shadow`, true);
    } catch (err) {
      this.setStatus(`Clear error: ${String(err)}`, false);
    }
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    this.graphics.destroy();
    this.shadowGfx.destroy();
    this.backdrop.destroy();
    if (this.sprite) this.sprite.destroy();
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
    this.hud = null;
  }
}

// Resolve `?target=` to a valid family (default 'object').
export function resolveShadowTarget(raw: string | null | undefined): ShadowTarget {
  return raw === 'character' ? 'character' : 'object';
}

// Resolve `?kind=` against the chosen family, with a sensible default.
export function resolveShadowKind(target: ShadowTarget, raw: string | null | undefined): string {
  if (target === 'character') {
    if (raw && isCharacterKind(raw)) return raw;
    return PLAYER_CHARACTER_ID;
  }
  if (raw && hasObjectKind(raw)) return raw;
  const firstVisible = (Object.keys(OBJECT_KINDS) as ObjectKindId[]).find((id) => !OBJECT_KINDS[id].invisible);
  return firstVisible ?? (Object.keys(OBJECT_KINDS)[0] as ObjectKindId);
}
